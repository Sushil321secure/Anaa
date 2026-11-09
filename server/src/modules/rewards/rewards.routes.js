import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { RewardTransaction, ReferralInvitation } from './models.js';
import { getProgram, getRules, RULE_LABELS } from './config.js';
import { createInvitation, quoteRedemption, walletSummary } from './service.js';
import adminRouter from './rewards.admin.routes.js';
import { Package } from '../catalog/catalog.model.js';
import { computePricing } from '../catalog/pricing.js';
import { User } from '../users/user.model.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { env } from '../../config/env.js';

const router = Router();
const customer = [requireAuth, requireRole('CUSTOMER')];
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------- public: what the programme is (never any personal data)
export async function publicProgram() {
  const program = await getProgram();
  if (!program.enabled) return { enabled: false };
  const rules = await getRules();
  return {
    enabled: true,
    paisePer100Points: program.paisePer100Points,
    maxDiscountPaise: program.maxDiscountPaise,
    minRedeemPoints: program.minRedeemPoints,
    expiryEnabled: program.expiryEnabled,
    earn: Object.values(rules).filter((r) => r.enabled && r.points > 0).map((r) => ({ key: r.key, label: RULE_LABELS[r.key], points: r.points, minPurchasePaise: r.key === 'PURCHASE' ? r.minPurchasePaise : undefined })),
  };
}

/** Terms are generated from the live settings so they can never disagree with how the programme actually behaves. */
export async function termsFor(program, rules) {
  const t = [];
  if (!program.enabled) return ['The Log & Earn rewards programme is not running at the moment.'];
  t.push('Points are only issued to registered customers with a verified email address, and only for activities the Anaa Nutricare system has itself verified.');
  const active = Object.values(rules).filter((r) => r.enabled && r.points > 0);
  for (const r of active) {
    if (r.key === 'REGISTRATION') t.push(`${r.points} points are credited once, when you verify your email.`);
    if (r.key === 'PURCHASE') t.push(`${r.points} points are credited when a wellness package payment is confirmed${r.minPurchasePaise ? ` (amount paid ${rupees(r.minPurchasePaise)} or more)` : ''}. Failed or cancelled payments earn nothing.`);
    if (r.key === 'CONSULTATION') t.push(`${r.points} points are credited when a paid consultation is marked completed.`);
    if (r.key === 'REFERRAL') t.push(`${r.points} points are credited to the referrer, once, after the friend they invited registers with the invited email, verifies it, and completes a paid consultation. The friend does not receive points for the referral.`);
  }
  t.push(`100 points = ${rupees(program.paisePer100Points)}.`);
  t.push(`You can use points on any package purchase. The discount on one order is capped at ${rupees(program.maxDiscountPaise)}, and you can redeem on several orders in the same month while your points last.`);
  if (program.minRedeemPoints) t.push(`You need to use at least ${program.minRedeemPoints} points at a time.`);
  if (program.expiryEnabled) t.push('Unused points expire at the end of each calendar month (Indian Standard Time). Points do not carry forward to the next month.');
  t.push('Points have no cash value and cannot be transferred or sold. Reward points may be adjusted or reversed if an activity is cancelled, refunded or found to be fraudulent.');
  t.push('We may change or end the programme. Points already earned keep their stated expiry date.');
  return t;
}

router.get('/program', asyncHandler(async (req, res) => {
  res.json(await publicProgram());
}));

// The sign-up page uses this to pre-fill the invited email. Anyone holding the emailed link may read what it was sent to
// (and the first name of whoever invited them), nothing else.
router.get('/invitation', rateLimit({ windowMs: 60 * 1000, limit: 30, skip: () => env.NODE_ENV === 'test', standardHeaders: true, legacyHeaders: false }), asyncHandler(async (req, res) => {
  const { token } = z.object({ token: z.string().min(20).max(200) }).parse(req.query);
  const inv = await ReferralInvitation.findOne({ tokenHash: crypto.createHash('sha256').update(token).digest('hex') }).lean();
  if (!inv || inv.status !== 'INVITATION_SENT' || !inv.active || inv.expiresAt <= new Date()) return res.json({ valid: false });
  const referrer = await User.findById(inv.referrer).select('name').lean();
  res.json({ valid: true, invitedEmail: inv.invitedEmail, referrerName: (referrer?.name || 'A friend').split(' ')[0] });
}));

// ---------------------------------------------------------------- customer wallet
router.get('/wallet', ...customer, asyncHandler(async (req, res) => {
  const [program, rules, wallet] = await Promise.all([getProgram(), getRules(), walletSummary(req.user._id)]);
  res.json({
    verified: Boolean(req.user.emailVerifiedAt),
    wallet,
    program: await publicProgram(),
    terms: await termsFor(program, rules),
  });
}));

const SOURCE_LABEL = { ...RULE_LABELS, REDEMPTION: 'Used at checkout', EXPIRY: 'Points expired', ADMIN: 'Adjustment by Anaa Nutricare' };
router.get('/transactions', ...customer, asyncHandler(async (req, res) => {
  const { page } = z.object({ page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  const size = 20;
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    RewardTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).lean(),
    RewardTransaction.countDocuments(filter),
  ]);
  res.json({
    items: items.map((t) => ({
      _id: t._id, type: t.type, points: t.points, status: t.status, createdAt: t.createdAt, expiresAt: t.expiresAt, expiredAt: t.expiredAt,
      label: t.type === 'REVERSE' ? 'Points returned (payment did not go through)' : SOURCE_LABEL[t.source] || t.source, source: t.source,
    })),
    total, page, pages: Math.max(1, Math.ceil(total / size)),
  });
}));

// ---------------------------------------------------------------- checkout helpers (nothing is changed here)
router.get('/quote', ...customer, asyncHandler(async (req, res) => {
  const q = z.object({ packageId: z.string().refine(mongoose.isValidObjectId, 'Invalid package'), points: z.coerce.number().int().optional() }).parse(req.query);
  const pkg = await Package.findOne({ _id: q.packageId, isActive: true }).lean();
  if (!pkg) throw new ApiError(404, 'Package not found');
  const pricing = computePricing(pkg);
  if (!pricing.priced) throw new ApiError(400, 'This package is priced on request');
  res.json({ quote: await quoteRedemption({ user: req.user, points: q.points, pricePaise: pricing.pricePaise }) });
}));

// ---------------------------------------------------------------- referrals
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test', keyGenerator: (req) => String(req.user?._id || req.ip),
  message: { message: 'You have sent a lot of invitations. Please try again in an hour.' },
});

router.post('/referrals', ...customer, inviteLimiter, asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.string().trim().email('Enter a valid email address') }).parse(req.body);
  const { invitation, devInviteLink } = await createInvitation({ referrer: req.user, email });
  res.status(201).json({ referral: publicReferral(invitation), devInviteLink });
}));

// The referrer only ever sees progress. Nothing about the friend's health, plans, reports or consultation notes is stored here or returned.
const publicReferral = (r) => ({
  _id: r._id, invitedEmail: r.invitedEmail, status: r.status, createdAt: r.createdAt, expiresAt: r.expiresAt,
  registeredAt: r.registeredAt, successAt: r.successAt, rewardPoints: r.rewardPoints,
});

router.get('/referrals', ...customer, asyncHandler(async (req, res) => {
  const items = await ReferralInvitation.find({ referrer: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ items: items.map(publicReferral) });
}));

router.use('/admin', adminRouter);

export default router;
