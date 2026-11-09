import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User, STAFF_ROLES } from '../users/user.model.js';
import { Enquiry } from '../enquiries/enquiry.model.js';
import { Appointment } from '../appointments/appointment.model.js';
import { istDateString, istToUtc } from '../appointments/slots.js';
import { Package } from '../catalog/catalog.model.js';
import { computePricing, totalConsultations } from '../catalog/pricing.js';
import { Purchase } from '../purchases/purchase.model.js';
import { describe, expiryFrom } from '../purchases/entitlements.js';
import { ReferralInvitation } from '../rewards/models.js';
import { earn, reconcileWallet, walletSummary } from '../rewards/service.js';
import { DEFAULTS, getSetting, setSetting } from '../settings/settings.js';
import { passwordField } from '../auth/auth.routes.js';
import { ApiError, asyncHandler, normalizeEmail } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../audit/audit.model.js';

const router = Router();
router.use(requireAuth, requireRole(...STAFF_ROLES));
const managers = requireRole('OWNER', 'ADMIN');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const oid = (id, what = 'Record') => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, `${what} not found`);
  return id;
};

// ---------------------------------------------------------------- dashboard
router.get('/stats', asyncHandler(async (req, res) => {
  const now = new Date();
  const [y, m, d] = istDateString(now).split('-').map(Number);
  const dayStart = istToUtc(y, m - 1, d, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const weekEnd = new Date(dayStart.getTime() + 7 * 24 * 3600 * 1000);
  const canSeeMoney = ['OWNER', 'ADMIN'].includes(req.user.role);
  const [customers, newEnquiries, today, upcoming, activePackages, revenue, next] = await Promise.all([
    User.countDocuments({ role: 'CUSTOMER' }),
    Enquiry.countDocuments({ status: 'NEW' }),
    Appointment.countDocuments({ status: 'CONFIRMED', startsAt: { $gte: dayStart, $lt: dayEnd } }),
    Appointment.countDocuments({ status: 'CONFIRMED', startsAt: { $gte: now, $lt: weekEnd } }),
    Purchase.countDocuments({ status: 'PAID', expiresAt: { $gt: now }, $expr: { $lt: ['$consultationsUsed', '$consultationsTotal'] } }),
    canSeeMoney ? Purchase.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, total: { $sum: { $ifNull: ['$amountPaidPaise', '$snapshot.pricePaise'] } }, n: { $sum: 1 } } }]) : [],
    Appointment.find({ status: 'CONFIRMED', startsAt: { $gte: now } }).populate('customer', 'name').populate('dietitian', 'name').sort({ startsAt: 1 }).limit(6).lean(),
  ]);
  res.json({
    customers, newEnquiries, appointmentsToday: today, appointmentsNext7Days: upcoming, activePackages,
    revenuePaise: canSeeMoney ? revenue[0]?.total || 0 : null,
    paidOrders: canSeeMoney ? revenue[0]?.n || 0 : null,
    nextAppointments: next,
  });
}));

router.get('/dietitians', asyncHandler(async (req, res) => {
  // Owners and admins also get the e-mail, so two people with the same name can be told apart.
  const withEmail = ['OWNER', 'ADMIN'].includes(req.user.role);
  res.json({ items: await User.find({ role: 'DIETITIAN', isActive: true }).select(withEmail ? 'name email' : 'name').sort('name email').lean() });
}));

// ---------------------------------------------------------------- customers
router.get('/customers', asyncHandler(async (req, res) => {
  const { q, page } = z.object({ q: z.string().trim().max(80).optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  const filter = { role: 'CUSTOMER' };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const size = 20;
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).lean(),
    User.countDocuments(filter),
  ]);
  const ids = items.map((c) => c._id);
  const active = await Purchase.aggregate([
    { $match: { user: { $in: ids }, status: 'PAID', expiresAt: { $gt: new Date() } } },
    { $group: { _id: '$user', left: { $sum: { $subtract: ['$consultationsTotal', '$consultationsUsed'] } } } },
  ]);
  const left = new Map(active.map((a) => [String(a._id), a.left]));
  res.json({ items: items.map((c) => ({ ...c, consultationsLeft: left.get(String(c._id)) || 0 })), total, page, pages: Math.max(1, Math.ceil(total / size)) });
}));

router.get('/customers/:id', asyncHandler(async (req, res) => {
  const customer = await User.findOne({ _id: oid(req.params.id, 'Customer'), role: 'CUSTOMER' }).lean();
  if (!customer) throw new ApiError(404, 'Customer not found');
  const [purchases, appointments, referral, balance] = await Promise.all([
    Purchase.find({ user: customer._id, status: 'PAID' }).sort({ paidAt: -1 }).lean(),
    Appointment.find({ customer: customer._id }).populate('dietitian', 'name').sort({ startsAt: -1 }).limit(50).lean(),
    ReferralInvitation.findOne({ referredUser: customer._id }).populate('referrer', 'name').select('-tokenHash').lean(),
    walletSummary(customer._id),
  ]);
  res.json({
    customer,
    purchases: purchases.map((p) => ({ ...describe(p), source: p.source, note: p.note })),
    appointments,
    referredBy: referral ? { name: referral.referrer?.name, status: referral.status } : null,
    rewardBalance: balance.available,
    rewardWallet: balance,
    rewardCheck: await reconcileWallet(customer._id),
  });
}));

// Record a package paid for outside the website (cash, UPI, bank transfer). Gives the customer the same entitlements.
router.post('/customers/:id/packages', requireRole('OWNER', 'ADMIN', 'OPERATIONS'), asyncHandler(async (req, res) => {
  const { packageId, note } = z.object({ packageId: z.string().refine(mongoose.isValidObjectId, 'Invalid package'), note: z.string().trim().min(3, 'Add a note, for example "UPI payment ref 1234"').max(300) }).parse(req.body);
  const customer = await User.findOne({ _id: oid(req.params.id, 'Customer'), role: 'CUSTOMER', isActive: true });
  if (!customer) throw new ApiError(404, 'Customer not found');
  const pkg = await Package.findById(packageId).lean();
  if (!pkg) throw new ApiError(404, 'Package not found');
  const pricing = computePricing(pkg);
  const paidAt = new Date();
  const purchase = await Purchase.create({
    user: customer._id, package: pkg._id, status: 'PAID', source: 'MANUAL', note, assignedBy: req.user._id,
    snapshot: {
      name: pkg.name, durationDays: pkg.durationDays,
      pricePaise: pricing.priced ? pricing.pricePaise : 0, referenceMonthlyPaise: pkg.referenceMonthlyPaise ?? undefined,
      referencePaise: pricing.referencePaise, savingsPaise: pricing.savingsPaise, effectiveMonthlyPaise: pricing.effectiveMonthlyPaise,
    },
    consultationsTotal: totalConsultations(pkg), paidAt, expiresAt: expiryFrom(paidAt, pkg.durationDays || 30), amountPaidPaise: pricing.priced ? pricing.pricePaise : 0,
  });
  await audit(req.user._id, 'purchase.manual', 'purchase', purchase._id, { customer: customer._id, package: pkg.name, note });
  await earn({ userId: customer._id, ruleKey: 'PURCHASE', refId: purchase._id, key: `purchase:${purchase._id}`, amountPaise: pricing.priced ? pricing.pricePaise : 0, metadata: { package: pkg.name, manual: true } })
    .catch((err) => console.error('purchase reward failed', err.message));
  res.status(201).json({ purchase: describe(purchase) });
}));

// ---------------------------------------------------------------- staff accounts
router.get('/users', managers, asyncHandler(async (req, res) => {
  res.json({ items: await User.find({ role: { $in: STAFF_ROLES } }).sort({ role: 1, name: 1 }).lean() });
}));

const staffInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform(normalizeEmail),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number').optional().or(z.literal('').transform(() => undefined)),
  role: z.enum(STAFF_ROLES),
  password: passwordField,
});

// Only an OWNER can create or change OWNER/ADMIN accounts.
const canManageRole = (actor, role) => actor.role === 'OWNER' || ['DIETITIAN', 'OPERATIONS'].includes(role);

router.post('/users', managers, asyncHandler(async (req, res) => {
  const data = staffInput.parse(req.body);
  if (!canManageRole(req.user, data.role)) throw new ApiError(403, 'Only the owner can create owner or admin accounts');
  if (await User.exists({ email: data.email })) throw new ApiError(409, 'An account with this email already exists');
  const user = await User.create({ name: data.name, email: data.email, phone: data.phone, role: data.role, passwordHash: await bcrypt.hash(data.password, 12), emailVerifiedAt: new Date() });
  await audit(req.user._id, 'user.create', 'user', user._id, { role: data.role, email: data.email });
  res.status(201).json({ user });
}));

router.patch('/users/:id', managers, asyncHandler(async (req, res) => {
  const data = z.object({ name: z.string().trim().min(2).max(120).optional(), role: z.enum(STAFF_ROLES).optional(), isActive: z.boolean().optional(), password: passwordField.optional() }).parse(req.body);
  const target = await User.findOne({ _id: oid(req.params.id, 'User'), role: { $in: STAFF_ROLES } });
  if (!target) throw new ApiError(404, 'User not found');
  if (!canManageRole(req.user, target.role) || (data.role && !canManageRole(req.user, data.role))) throw new ApiError(403, 'Only the owner can change owner or admin accounts');
  if (String(target._id) === String(req.user._id) && (data.isActive === false || (data.role && data.role !== target.role))) throw new ApiError(400, 'You cannot deactivate or change the role of your own account');
  if (data.name) target.name = data.name;
  if (data.role) target.role = data.role;
  if (data.isActive !== undefined) target.isActive = data.isActive;
  if (data.password) target.passwordHash = await bcrypt.hash(data.password, 12);
  await target.save();
  await audit(req.user._id, 'user.update', 'user', target._id, { ...data, password: data.password ? '(changed)' : undefined });
  res.json({ user: target });
}));

// ---------------------------------------------------------------- settings
const settingsSchemas = {
  availability: z.object({
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(1).max(24),
    slotMinutes: z.number().int().min(15).max(180),
    minNoticeHours: z.number().int().min(0).max(168),
    cancelBeforeHours: z.number().int().min(0).max(168),
    maxDaysAhead: z.number().int().min(1).max(120),
  }).refine((v) => v.endHour > v.startHour, { message: 'Closing time must be after opening time', path: ['endHour'] }),
};

router.get('/settings', asyncHandler(async (req, res) => {
  res.json({ availability: await getSetting('availability'), defaults: DEFAULTS });
}));

router.put('/settings/:key', managers, asyncHandler(async (req, res) => {
  const schema = settingsSchemas[req.params.key];
  if (!schema) throw new ApiError(404, 'Unknown setting');
  const value = schema.parse(req.body);
  const saved = await setSetting(req.params.key, value);
  await audit(req.user._id, 'settings.update', 'setting', undefined, { key: req.params.key, value });
  res.json({ [req.params.key]: saved });
}));

export default router;
