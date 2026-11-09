import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  RewardWallet, RewardTransaction, RewardRedemption, ReferralInvitation, RewardExpiryRun, RewardRule, RULE_KEYS, REFERRAL_STATUSES, TX_TYPES, TX_SOURCES,
} from './models.js';
import { getProgram, getRules, saveProgram, monthKey, startOfIstMonth, endOfIstMonth } from './config.js';
import { adjustPoints, approveReferral, rejectReferral, reconcileWallet, runRewardMaintenance, walletSummary } from './service.js';
import { User } from '../users/user.model.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../audit/audit.model.js';
import { istToUtc } from '../appointments/slots.js';

// Rewards administration is limited to OWNER and ADMIN. Every change below writes an audit row.
const router = Router();
router.use(requireAuth, requireRole('OWNER', 'ADMIN'));

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const oid = (id, what = 'Record') => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, `${what} not found`);
  return id;
};
const page = z.coerce.number().int().min(1).default(1);

async function customerIdsMatching(q) {
  const rx = new RegExp(escapeRegex(q), 'i');
  return (await User.find({ role: 'CUSTOMER', $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select('_id').limit(500).lean()).map((u) => u._id);
}

// ---------------------------------------------------------------- programme settings and rules
router.get('/config', asyncHandler(async (req, res) => {
  res.json({ program: await getProgram(), rules: Object.values(await getRules()) });
}));

const programSchema = z.object({
  enabled: z.boolean(),
  paisePer100Points: z.number().int().min(1).max(1000000),
  maxDiscountPaise: z.number().int().min(0).max(10000000),
  minRedeemPoints: z.number().int().min(0).max(1000000),
  expiryEnabled: z.boolean(),
  inviteValidDays: z.number().int().min(1).max(90),
  expiringSoonDays: z.number().int().min(1).max(28),
});
const rulesSchema = z.array(z.object({
  key: z.enum(RULE_KEYS), enabled: z.boolean(), points: z.number().int().min(0).max(1000000), minPurchasePaise: z.number().int().min(0).max(100000000).default(0),
})).max(RULE_KEYS.length);

router.put('/config', asyncHandler(async (req, res) => {
  const body = z.object({ program: programSchema, rules: rulesSchema }).parse(req.body);
  for (const r of body.rules) if (r.enabled && r.points < 1) throw new ApiError(400, `${r.key}: set a number of points before switching the rule on`, { rules: [`${r.key} needs points`] });
  const before = { program: await getProgram(), rules: Object.values(await getRules()).map(({ key, enabled, points, minPurchasePaise }) => ({ key, enabled, points, minPurchasePaise })) };
  await saveProgram(body.program);
  await getRules(); // make sure all rows exist
  for (const r of body.rules) {
    await RewardRule.updateOne({ key: r.key }, { $set: { enabled: r.enabled, points: r.points, minPurchasePaise: r.minPurchasePaise, updatedBy: req.user._id } });
  }
  await audit(req.user._id, 'rewards.config', 'rewards', undefined, { before, after: body });
  res.json({ program: await getProgram(), rules: Object.values(await getRules()) });
}));

// ---------------------------------------------------------------- wallets
router.get('/wallets', asyncHandler(async (req, res) => {
  const { q, page: p } = z.object({ q: z.string().trim().max(80).optional(), page }).parse(req.query);
  const filter = {};
  if (q) filter.user = { $in: await customerIdsMatching(q) };
  const size = 20;
  const [items, total] = await Promise.all([
    RewardWallet.find(filter).sort({ available: -1 }).skip((p - 1) * size).limit(size).populate('user', 'name email phone').lean(),
    RewardWallet.countDocuments(filter),
  ]);
  res.json({ items, total, page: p, pages: Math.max(1, Math.ceil(total / size)) });
}));

router.get('/wallets/:userId', asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: oid(req.params.userId, 'Customer'), role: 'CUSTOMER' }).select('name email phone emailVerifiedAt').lean();
  if (!user) throw new ApiError(404, 'Customer not found');
  const [summary, reconcile, transactions] = await Promise.all([
    walletSummary(user._id), reconcileWallet(user._id),
    RewardTransaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  res.json({ user, wallet: summary, reconcile, transactions });
}));

// ---------------------------------------------------------------- transactions
router.get('/transactions', asyncHandler(async (req, res) => {
  const q = z.object({
    q: z.string().trim().max(80).optional(), type: z.enum(TX_TYPES).optional(), source: z.enum(TX_SOURCES).optional(),
    userId: z.string().optional(), page,
  }).parse(req.query);
  const filter = {};
  if (q.type) filter.type = q.type;
  if (q.source) filter.source = q.source;
  if (q.userId) filter.user = oid(q.userId, 'Customer');
  if (q.q) filter.user = { $in: await customerIdsMatching(q.q) };
  const size = 25;
  const [items, total] = await Promise.all([
    RewardTransaction.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * size).limit(size).populate('user', 'name email').lean(),
    RewardTransaction.countDocuments(filter),
  ]);
  res.json({ items, total, page: q.page, pages: Math.max(1, Math.ceil(total / size)) });
}));

// ---------------------------------------------------------------- manual adjustments (reason is mandatory, always audited)
router.post('/adjust', asyncHandler(async (req, res) => {
  const data = z.object({
    customerId: z.string().refine(mongoose.isValidObjectId, 'Invalid customer'),
    points: z.number().int().refine((n) => n !== 0, 'Points cannot be zero').refine((n) => Math.abs(n) <= 100000, 'Too many points'),
    reason: z.string().trim().min(5, 'Give a reason of at least 5 characters').max(200),
  }).parse(req.body);
  const result = await adjustPoints({ userId: data.customerId, points: data.points, reason: data.reason, adminId: req.user._id });
  res.status(201).json({ transaction: result.tx, balance: result.balance });
}));

// ---------------------------------------------------------------- referrals
router.get('/referrals', asyncHandler(async (req, res) => {
  const q = z.object({ status: z.enum(REFERRAL_STATUSES).optional(), flagged: z.enum(['true', 'false']).optional(), q: z.string().trim().max(80).optional(), page }).parse(req.query);
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.flagged) filter.flagged = q.flagged === 'true';
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ invitedEmail: rx }, { referrer: { $in: await customerIdsMatching(q.q) } }];
  }
  const size = 20;
  const [items, total] = await Promise.all([
    ReferralInvitation.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * size).limit(size).populate('referrer', 'name email').populate('referredUser', 'name email').select('-tokenHash').lean(),
    ReferralInvitation.countDocuments(filter),
  ]);
  res.json({ items, total, page: q.page, pages: Math.max(1, Math.ceil(total / size)) });
}));

router.post('/referrals/:id/approve', asyncHandler(async (req, res) => {
  res.json({ referral: await approveReferral({ id: oid(req.params.id, 'Referral'), adminId: req.user._id }) });
}));

router.post('/referrals/:id/reject', asyncHandler(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(5, 'Give a reason of at least 5 characters').max(200) }).parse(req.body);
  res.json({ referral: await rejectReferral({ id: oid(req.params.id, 'Referral'), adminId: req.user._id, reason }) });
}));

// ---------------------------------------------------------------- reports
router.get('/reports', asyncHandler(async (req, res) => {
  const { month } = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(req.query);
  const key = month || monthKey(new Date());
  const [y, m] = key.split('-').map(Number);
  const from = istToUtc(y, m - 1, 1, 0, 0);
  const to = istToUtc(y, m, 1, 0, 0);
  const window = { createdAt: { $gte: from, $lt: to } };

  const rows = await RewardTransaction.aggregate([
    { $match: window },
    { $group: { _id: { type: '$type', source: '$source' }, points: { $sum: '$points' }, count: { $sum: 1 } } },
  ]);
  const sum = (fn) => rows.filter(fn).reduce((n, r) => ({ points: n.points + r.points, count: n.count + r.count }), { points: 0, count: 0 });
  const earnedBySource = Object.fromEntries(RULE_KEYS.map((k) => [k, sum((r) => r._id.type === 'EARN' && r._id.source === k).points]));
  const redemptions = await RewardRedemption.aggregate([
    { $match: { status: 'CONFIRMED', confirmedAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, points: { $sum: '$points' }, discountPaise: { $sum: '$discountPaise' }, orders: { $sum: 1 } } },
  ]);
  const referrals = await ReferralInvitation.aggregate([{ $match: window }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
  const [expiringNow] = await RewardTransaction.aggregate([
    { $match: { remaining: { $gt: 0 }, expiredAt: null, expiresAt: { $gt: new Date(), $lte: endOfIstMonth(new Date()) } } },
    { $group: { _id: null, points: { $sum: '$remaining' }, users: { $addToSet: '$user' } } },
  ]);
  const runs = await RewardExpiryRun.find().sort({ period: -1, type: 1 }).limit(24).lean();
  res.json({
    month: key,
    earned: { total: sum((r) => r._id.type === 'EARN').points, bySource: earnedBySource },
    adjustments: { added: rows.filter((r) => r._id.type === 'ADJUSTMENT' && r.points > 0).reduce((n, r) => n + r.points, 0), removed: -rows.filter((r) => r._id.type === 'ADJUSTMENT' && r.points < 0).reduce((n, r) => n + r.points, 0) },
    redeemed: { points: redemptions[0]?.points || 0, discountPaise: redemptions[0]?.discountPaise || 0, orders: redemptions[0]?.orders || 0 },
    reversed: sum((r) => r._id.type === 'REVERSE').points,
    expired: -sum((r) => r._id.type === 'EXPIRE').points,
    referrals: Object.fromEntries(referrals.map((r) => [r._id, r.n])),
    expiringThisMonth: { points: expiringNow?.points || 0, customers: expiringNow?.users.length || 0, at: endOfIstMonth(new Date()) },
    expiryRuns: runs,
  });
}));

router.post('/maintenance/run', asyncHandler(async (req, res) => {
  const result = await runRewardMaintenance();
  await audit(req.user._id, 'rewards.maintenance', 'rewards', undefined, result);
  res.json({ result });
}));

export { startOfIstMonth };
export default router;
