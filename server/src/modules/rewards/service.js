import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  RewardWallet, RewardTransaction, RewardRedemption, ReferralInvitation, RewardExpiryRun, RULE_KEYS,
} from './models.js';
import {
  getProgram, getRules, RULE_LABELS, monthKey, endOfIstMonth, startOfIstMonth, pointsWorth, maxPointsForDiscount,
} from './config.js';
import { User } from '../users/user.model.js';
import { Purchase } from '../purchases/purchase.model.js';
import { Appointment } from '../appointments/appointment.model.js';
import { sendTemplate } from '../mail/mailer.js';
import { audit } from '../audit/audit.model.js';
import { ApiError, normalizeEmail } from '../../utils/http.js';
import { env } from '../../config/env.js';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const noSmtpDev = () => env.NODE_ENV !== 'production' && !env.SMTP_HOST;

/** Only verified, active customers take part: points are never issued to unverified accounts or staff. */
export const isEligible = (user) => Boolean(user && user.role === 'CUSTOMER' && user.isActive && user.emailVerifiedAt);

// ====================================================================== wallet and lots

async function bumpWallet(userId, inc) {
  return RewardWallet.findOneAndUpdate({ user: userId }, { $inc: inc, $setOnInsert: { user: userId } }, { upsert: true, new: true });
}

export async function getWallet(userId) {
  return (await RewardWallet.findOne({ user: userId }).lean()) || { user: userId, available: 0, totalEarned: 0, totalRedeemed: 0, totalExpired: 0 };
}

const unexpired = (now) => ({ $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] });

/** Lots that can still be spent, earliest expiry first (lots that never expire go last). */
async function activeLots(userId, now) {
  const lots = await RewardTransaction.find({ user: userId, remaining: { $gt: 0 }, expiredAt: null, ...unexpired(now) }).lean();
  return lots.sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity) || a.createdAt - b.createdAt);
}

/** The balance a customer can actually spend right now: the sum of unexpired lots. */
export async function spendableBalance(userId, now = new Date()) {
  const lots = await activeLots(userId, now);
  return lots.reduce((n, l) => n + l.remaining, 0);
}

/**
 * Takes `points` out of the customer's lots, earliest expiry first. Every lot is updated with a conditional write
 * (remaining >= take), so two requests can never spend the same points: the loser rolls back and re-plans.
 */
async function consumePoints(userId, points, now, attempts = 6) {
  for (let a = 0; a < attempts; a += 1) {
    const lots = await activeLots(userId, now);
    if (lots.reduce((n, l) => n + l.remaining, 0) < points) throw new ApiError(400, 'You do not have enough reward points', { code: 'INSUFFICIENT_POINTS' });
    const applied = [];
    let need = points;
    let failed = false;
    for (const lot of lots) {
      if (need <= 0) break;
      const take = Math.min(lot.remaining, need);
      const r = await RewardTransaction.updateOne({ _id: lot._id, remaining: { $gte: take }, expiredAt: null }, { $inc: { remaining: -take } });
      if (r.modifiedCount !== 1) { failed = true; break; }
      applied.push({ lot: lot._id, points: take });
      need -= take;
    }
    if (!failed) return applied;
    for (const x of applied) await RewardTransaction.updateOne({ _id: x.lot, expiredAt: null }, { $inc: { remaining: x.points } });
  }
  throw new ApiError(409, 'Your points are being used by another request. Please try again.', { code: 'BUSY' });
}

async function giveBack(allocations) {
  for (const x of allocations) await RewardTransaction.updateOne({ _id: x.lot, expiredAt: null }, { $inc: { remaining: x.points } });
}

// ====================================================================== earning

/**
 * Credits points for a verified event. Safe to call repeatedly: the idempotency key makes the second call a no-op.
 * Returns { credited, points, balance } or { skipped: reason } or { duplicate: true }.
 */
export async function earn({ userId, ruleKey, refId, key, amountPaise, metadata, now = new Date(), notify = true }) {
  if (!RULE_KEYS.includes(ruleKey)) throw new Error(`Unknown reward rule ${ruleKey}`);
  const program = await getProgram();
  if (!program.enabled) return { skipped: 'PROGRAMME_OFF' };
  const rule = (await getRules())[ruleKey];
  if (!rule.enabled || rule.points < 1) return { skipped: 'RULE_OFF' };
  const user = await User.findById(userId);
  if (!isEligible(user)) return { skipped: 'NOT_ELIGIBLE' };
  if (ruleKey === 'PURCHASE' && (amountPaise ?? 0) < (rule.minPurchasePaise || 0)) return { skipped: 'BELOW_MINIMUM' };
  const existing = await RewardTransaction.findOne({ idempotencyKey: key }).lean();
  if (existing) return { duplicate: true, tx: existing };

  const points = rule.points;
  let tx;
  try {
    tx = await RewardTransaction.create({
      user: user._id, type: 'EARN', points, remaining: points, source: ruleKey, refId, idempotencyKey: key, metadata,
      expiresAt: program.expiryEnabled ? endOfIstMonth(now) : undefined,
    });
  } catch (err) {
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }
  await bumpWallet(user._id, { available: points, totalEarned: points });
  const balance = await spendableBalance(user._id, now);
  if (notify) sendTemplate(user.email, 'rewardEarned', { name: user.name, points, reason: RULE_LABELS[ruleKey], expiresAt: tx.expiresAt, balance });
  return { credited: true, points, tx, balance };
}

// ====================================================================== redemption

/** Works out what a redemption would be worth and enforces every rule. Nothing is changed. */
export async function quoteRedemption({ user, points, pricePaise, now = new Date() }) {
  const program = await getProgram();
  if (!program.enabled) throw new ApiError(400, 'Reward points are not available right now', { code: 'PROGRAMME_OFF' });
  if (!isEligible(user)) throw new ApiError(403, 'Please verify your email to use reward points', { code: 'NOT_VERIFIED' });
  const balance = await spendableBalance(user._id, now);
  const capPaise = Math.max(0, Math.min(program.maxDiscountPaise, pricePaise - 100)); // always leave at least ₹1 to pay
  const maxByCap = maxPointsForDiscount(capPaise, program.paisePer100Points);
  const info = {
    balance, capPaise, maxPoints: Math.min(balance, maxByCap), paisePer100Points: program.paisePer100Points,
    minRedeemPoints: program.minRedeemPoints, pricePaise,
  };
  if (points === undefined || points === null) return info;
  if (!Number.isInteger(points) || points < 1) throw new ApiError(400, 'Enter a whole number of points', { code: 'BAD_POINTS' });
  if (points < program.minRedeemPoints) throw new ApiError(400, `You need to use at least ${program.minRedeemPoints} points`, { code: 'BELOW_MINIMUM' });
  if (points > balance) throw new ApiError(400, 'You do not have enough reward points', { code: 'INSUFFICIENT_POINTS' });
  if (points > maxByCap) {
    throw new ApiError(400, `You can use at most ${maxByCap} points (₹${(capPaise / 100).toLocaleString('en-IN')}) on one order`, { code: 'OVER_ORDER_CAP' });
  }
  const discountPaise = pointsWorth(points, program.paisePer100Points);
  if (discountPaise < 1) throw new ApiError(400, 'That many points is not worth a discount yet', { code: 'BAD_POINTS' });
  return { ...info, points, discountPaise, payablePaise: pricePaise - discountPaise };
}

/** Takes the points out of the wallet while the payment is open. Released automatically if the payment fails. */
export async function reserveRedemption({ user, points, purchaseId, pricePaise, now = new Date() }) {
  const quote = await quoteRedemption({ user, points, pricePaise, now });
  const allocations = await consumePoints(user._id, points, now);
  try {
    const redemption = await RewardRedemption.create({
      user: user._id, purchase: purchaseId, points, discountPaise: quote.discountPaise, allocations, status: 'RESERVED',
    });
    const tx = await RewardTransaction.create({
      user: user._id, type: 'REDEEM', points: -points, source: 'REDEMPTION', refId: purchaseId, status: 'PENDING',
      idempotencyKey: `redeem:${purchaseId}`, metadata: { redemption: redemption._id, discountPaise: quote.discountPaise },
    });
    redemption.redeemTx = tx._id;
    await redemption.save();
    await bumpWallet(user._id, { available: -points });
    return { redemption, discountPaise: quote.discountPaise };
  } catch (err) {
    await giveBack(allocations);
    throw err;
  }
}

/** Payment verified by the backend: the reservation becomes a real redemption. Idempotent. */
export async function confirmRedemption(purchaseId, now = new Date()) {
  const redemption = await RewardRedemption.findOneAndUpdate({ purchase: purchaseId, status: 'RESERVED' }, { $set: { status: 'CONFIRMED', confirmedAt: now } }, { new: true });
  if (!redemption) return null;
  await RewardTransaction.updateOne({ _id: redemption.redeemTx }, { $set: { status: 'POSTED' } });
  await bumpWallet(redemption.user, { totalRedeemed: redemption.points });
  const user = await User.findById(redemption.user);
  if (user) sendTemplate(user.email, 'redemptionSuccessful', { name: user.name, points: redemption.points, discountPaise: redemption.discountPaise, balance: await spendableBalance(user._id, now) });
  return redemption;
}

/**
 * Payment failed or was cancelled: give the points back. Points whose month has already ended are not resurrected;
 * they are recorded as expired instead. Idempotent: only a RESERVED redemption can be released, once.
 */
export async function releaseRedemption(purchaseId, reason = 'PAYMENT_FAILED', now = new Date()) {
  const redemption = await RewardRedemption.findOneAndUpdate({ purchase: purchaseId, status: 'RESERVED' }, { $set: { status: 'RELEASED', releasedAt: now, releaseReason: reason } }, { new: true });
  if (!redemption) return null;
  let restored = 0;
  let lost = 0;
  for (const x of redemption.allocations) {
    const r = await RewardTransaction.updateOne({ _id: x.lot, expiredAt: null }, { $inc: { remaining: x.points } });
    if (r.modifiedCount === 1) restored += x.points; else lost += x.points; // lot already expired by the monthly job
  }
  await RewardTransaction.updateOne({ _id: redemption.redeemTx }, { $set: { status: 'REVERSED' } });
  await RewardTransaction.create({
    user: redemption.user, type: 'REVERSE', points: redemption.points, source: 'REDEMPTION', refId: purchaseId,
    idempotencyKey: `redeem-reverse:${purchaseId}`, metadata: { redemption: redemption._id, reason },
  });
  let inc = redemption.points;
  if (lost > 0) {
    await RewardTransaction.create({
      user: redemption.user, type: 'EXPIRE', points: -lost, source: 'EXPIRY', refId: redemption._id,
      idempotencyKey: `expire-release:${redemption._id}`, metadata: { note: 'Reserved points expired while the payment was open' },
    });
    inc -= lost;
    await bumpWallet(redemption.user, { totalExpired: lost });
  }
  await bumpWallet(redemption.user, { available: inc });
  const user = await User.findById(redemption.user);
  if (user) sendTemplate(user.email, 'rewardReversal', { name: user.name, points: restored, lost, reason: 'Your payment did not go through' });
  return { redemption, restored, lost };
}

// ====================================================================== admin adjustments

export async function adjustPoints({ userId, points, reason, adminId, now = new Date() }) {
  if (!Number.isInteger(points) || points === 0) throw new ApiError(400, 'Points must be a non-zero whole number');
  const program = await getProgram();
  const user = await User.findOne({ _id: userId, role: 'CUSTOMER' });
  if (!user) throw new ApiError(404, 'Customer not found');
  const key = `adjust:${crypto.randomUUID()}`;
  let tx;
  if (points > 0) {
    tx = await RewardTransaction.create({
      user: user._id, type: 'ADJUSTMENT', points, remaining: points, source: 'ADMIN', idempotencyKey: key, createdBy: adminId,
      metadata: { reason }, expiresAt: program.expiryEnabled ? endOfIstMonth(now) : undefined,
    });
    await bumpWallet(user._id, { available: points, totalEarned: points });
  } else {
    const allocations = await consumePoints(user._id, -points, now);
    try {
      tx = await RewardTransaction.create({ user: user._id, type: 'ADJUSTMENT', points, source: 'ADMIN', idempotencyKey: key, createdBy: adminId, metadata: { reason } });
    } catch (err) {
      await giveBack(allocations);
      throw err;
    }
    await bumpWallet(user._id, { available: points });
  }
  await audit(adminId, 'rewards.adjust', 'user', user._id, { points, reason });
  return { tx, balance: await spendableBalance(user._id, now) };
}

// ====================================================================== expiry

/** Expires whatever is left of every lot whose month has ended. Each lot is claimed atomically, so nothing expires twice. */
export async function expireDueLots(now = new Date()) {
  const due = await RewardTransaction.find({ remaining: { $gt: 0 }, expiredAt: null, expiresAt: { $lte: now } }).select('_id').lean();
  let lotsExpired = 0;
  let pointsExpired = 0;
  const users = new Set();
  for (const { _id } of due) {
    const lot = await RewardTransaction.findOneAndUpdate({ _id, remaining: { $gt: 0 }, expiredAt: null }, { $set: { remaining: 0, expiredAt: now } }, { new: false });
    if (!lot) continue; // someone else (or a redemption) got there first
    try {
      await RewardTransaction.create({
        user: lot.user, type: 'EXPIRE', points: -lot.remaining, source: 'EXPIRY', refId: lot._id, idempotencyKey: `expire:${lot._id}`,
        metadata: { period: monthKey(new Date(lot.expiresAt.getTime() - 1)), lotSource: lot.source },
      });
    } catch (err) {
      if (err.code === 11000) continue; // already recorded
      throw err;
    }
    await bumpWallet(lot.user, { available: -lot.remaining, totalExpired: lot.remaining });
    lotsExpired += 1;
    pointsExpired += lot.remaining;
    users.add(String(lot.user));
  }
  return { lotsExpired, pointsExpired, usersAffected: users.size };
}

export async function expiringThisMonth(userId, now = new Date()) {
  const end = endOfIstMonth(now);
  const lots = await RewardTransaction.find({ user: userId, remaining: { $gt: 0 }, expiredAt: null, expiresAt: { $gt: now, $lte: end } }).lean();
  return { points: lots.reduce((n, l) => n + l.remaining, 0), at: end };
}

// ====================================================================== wallet summary and reconciliation

export async function walletSummary(userId, now = new Date()) {
  const wallet = await getWallet(userId);
  const exp = await expiringThisMonth(userId, now);
  return {
    available: await spendableBalance(userId, now),
    totalEarned: wallet.totalEarned,
    totalRedeemed: wallet.totalRedeemed,
    totalExpired: wallet.totalExpired,
    expiringThisMonth: exp.points,
    expiresAt: exp.points > 0 ? exp.at : null,
  };
}

/** Proves the wallet agrees with the ledger: the sum of all ledger rows, and the sum of open lots, must both equal `available`. */
export async function reconcileWallet(userId) {
  const wallet = await getWallet(userId);
  const [sum] = await RewardTransaction.aggregate([{ $match: { user: new mongoose.Types.ObjectId(String(userId)) } }, { $group: { _id: null, n: { $sum: '$points' } } }]);
  const [lots] = await RewardTransaction.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)), remaining: { $gt: 0 }, expiredAt: null } },
    { $group: { _id: null, n: { $sum: '$remaining' } } },
  ]);
  const ledger = sum?.n || 0;
  const open = lots?.n || 0;
  return { wallet: wallet.available, ledger, openLots: open, consistent: wallet.available === ledger && wallet.available === open };
}

// ====================================================================== referrals

export async function createInvitation({ referrer, email, now = new Date() }) {
  const program = await getProgram();
  const rule = (await getRules()).REFERRAL;
  if (!program.enabled || !rule.enabled || rule.points < 1) throw new ApiError(400, 'The referral programme is not active right now', { code: 'PROGRAMME_OFF' });
  if (!isEligible(referrer)) throw new ApiError(403, 'Please verify your email before inviting friends', { code: 'NOT_VERIFIED' });
  const invited = normalizeEmail(email);
  if (invited === referrer.email) throw new ApiError(400, 'You cannot refer yourself', { code: 'SELF_REFERRAL' });
  if (await User.exists({ email: invited })) throw new ApiError(409, 'This person already has an Anaa account, so they cannot be referred', { code: 'ALREADY_CUSTOMER' });

  const live = await ReferralInvitation.findOne({ invitedEmail: invited, active: true });
  if (live) {
    if (live.status === 'INVITATION_SENT' && live.expiresAt <= now) {
      await ReferralInvitation.updateOne({ _id: live._id, status: 'INVITATION_SENT' }, { $set: { status: 'EXPIRED', active: false } });
    } else {
      throw new ApiError(409, 'This email address has already been invited', { code: 'DUPLICATE_REFERRAL' });
    }
  }
  const token = crypto.randomBytes(32).toString('hex');
  let invitation;
  try {
    invitation = await ReferralInvitation.create({
      referrer: referrer._id, invitedEmail: invited, tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + program.inviteValidDays * 24 * 3600 * 1000),
    });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'This email address has already been invited', { code: 'DUPLICATE_REFERRAL' });
    throw err;
  }
  const link = `${env.CLIENT_ORIGIN}/register?invite=${token}`;
  sendTemplate(invited, 'referralInvite', { referrerName: referrer.name, link, expiresAt: invitation.expiresAt, points: rule.points });
  await audit(referrer._id, 'referral.invite', 'referral', invitation._id, { invitedEmail: invited });
  return { invitation, devInviteLink: noSmtpDev() ? link : undefined };
}

/**
 * Called by sign-up before the account is created. A valid invitation must be used with the exact invited email;
 * an unknown, used or expired link is ignored (the person simply registers normally without a referral).
 */
export async function resolveInviteForRegistration(token, email, now = new Date()) {
  if (!token) return { invitation: null };
  const invitation = await ReferralInvitation.findOne({ tokenHash: sha256(String(token)) });
  if (!invitation) return { invitation: null, ignored: 'INVALID' };
  if (invitation.status !== 'INVITATION_SENT' || !invitation.active) return { invitation: null, ignored: 'USED' };
  if (invitation.expiresAt <= now) {
    await ReferralInvitation.updateOne({ _id: invitation._id, status: 'INVITATION_SENT' }, { $set: { status: 'EXPIRED', active: false } });
    return { invitation: null, ignored: 'EXPIRED' };
  }
  if (invitation.invitedEmail !== email) {
    throw new ApiError(400, 'This invitation was sent to a different email address. Please register with the email address that was invited.', { invite: ['Wrong email for this invitation'], code: 'WRONG_EMAIL' });
  }
  return { invitation };
}

export async function attachInvitation(invitation, user, now = new Date()) {
  const referrer = await User.findById(invitation.referrer).lean();
  const sameHousehold = referrer?.phone && user.phone && digits(referrer.phone) === digits(user.phone);
  const claimed = await ReferralInvitation.findOneAndUpdate(
    { _id: invitation._id, status: 'INVITATION_SENT', active: true },
    { $set: { status: 'REGISTERED', referredUser: user._id, registeredAt: now, ...(sameHousehold && { flagged: true, flagReason: 'Same phone number as the referrer' }) } },
    { new: true },
  );
  return claimed;
}

export async function onConsultationBooked({ userId, appointmentId, now = new Date() }) {
  await ReferralInvitation.updateOne(
    { referredUser: userId, active: true, status: 'REGISTERED' },
    { $set: { status: 'CONSULTATION_BOOKED', appointment: appointmentId, bookedAt: now } },
  );
}

export async function onConsultationCancelled({ userId, appointmentId }) {
  await ReferralInvitation.updateOne(
    { referredUser: userId, active: true, appointment: appointmentId, status: { $in: ['CONSULTATION_BOOKED', 'AWAITING_COMPLETION'] } },
    { $set: { status: 'REGISTERED' }, $unset: { appointment: '', bookedAt: '' } },
  );
}

async function creditReferral(invitation) {
  const result = await earn({
    userId: invitation.referrer, ruleKey: 'REFERRAL', refId: invitation._id, key: `referral:${invitation._id}`, notify: false,
    metadata: { invitation: String(invitation._id) },
  });
  if (!result.credited && !result.duplicate) return result; // rule off or referrer not eligible: stays SUCCESSFUL, retried by maintenance
  const tx = result.tx || (await RewardTransaction.findOne({ idempotencyKey: `referral:${invitation._id}` }));
  await ReferralInvitation.updateOne({ _id: invitation._id, status: 'SUCCESSFUL' }, { $set: { status: 'REWARD_CREDITED', rewardTx: tx._id, rewardPoints: tx.points } });
  if (result.credited) {
    const referrer = await User.findById(invitation.referrer);
    if (referrer) sendTemplate(referrer.email, 'referralRewardCredited', { name: referrer.name, points: tx.points, balance: result.balance });
  }
  return result;
}

/**
 * The single place where completing a paid consultation turns into rewards: the customer's own consultation points,
 * and (once) the referral reward for the person who invited them. Only the referrer is ever rewarded for a referral.
 */
export async function onConsultationCompleted({ appointmentId, customerId, paid, now = new Date() }) {
  const out = { consultation: null, referral: null };
  if (!paid) return out; // an unpaid consultation never earns or qualifies anything
  out.consultation = await earn({ userId: customerId, ruleKey: 'CONSULTATION', refId: appointmentId, key: `consultation:${appointmentId}`, now });

  const customer = await User.findById(customerId);
  if (!customer?.emailVerifiedAt) return out; // the referred person must have verified their email
  const claimed = await ReferralInvitation.findOneAndUpdate(
    { referredUser: customerId, active: true, flagged: false, status: { $in: ['REGISTERED', 'CONSULTATION_BOOKED', 'AWAITING_COMPLETION'] } },
    { $set: { status: 'SUCCESSFUL', successAt: now, completedAt: now, appointment: appointmentId } },
    { new: true },
  );
  if (claimed) {
    out.referral = await creditReferral(claimed);
  } else {
    // flagged referral: remember that the consultation happened, so an admin approval can pay it out later
    await ReferralInvitation.updateOne(
      { referredUser: customerId, active: true, flagged: true, completedAt: { $exists: false } },
      { $set: { completedAt: now, appointment: appointmentId } },
    );
  }
  return out;
}

export async function approveReferral({ id, adminId, now = new Date() }) {
  const inv = await ReferralInvitation.findOne({ _id: id, active: true });
  if (!inv) throw new ApiError(404, 'Referral not found or already closed');
  await ReferralInvitation.updateOne({ _id: inv._id }, { $set: { flagged: false, reviewedBy: adminId, reviewedAt: now } });
  await audit(adminId, 'referral.approve', 'referral', inv._id, { flagReason: inv.flagReason });
  if (inv.completedAt) {
    const claimed = await ReferralInvitation.findOneAndUpdate(
      { _id: inv._id, status: { $in: ['REGISTERED', 'CONSULTATION_BOOKED', 'AWAITING_COMPLETION'] } },
      { $set: { status: 'SUCCESSFUL', successAt: now } },
      { new: true },
    );
    if (claimed) await creditReferral(claimed);
  }
  return ReferralInvitation.findById(inv._id).lean();
}

export async function rejectReferral({ id, adminId, reason, now = new Date() }) {
  const inv = await ReferralInvitation.findOneAndUpdate(
    { _id: id, active: true, status: { $in: ['INVITATION_SENT', 'REGISTERED', 'CONSULTATION_BOOKED', 'AWAITING_COMPLETION'] } },
    { $set: { status: 'REJECTED', active: false, rejectReason: reason, reviewedBy: adminId, reviewedAt: now } },
    { new: true },
  );
  if (!inv) throw new ApiError(404, 'Referral not found, or it can no longer be rejected');
  await audit(adminId, 'referral.reject', 'referral', inv._id, { reason });
  return inv;
}

// ====================================================================== scheduled maintenance

const RESERVATION_TTL_MS = 45 * 60 * 1000;

/**
 * Everything the background job does, in one idempotent pass (safe to run any number of times, on any number of servers):
 * expire finished months, email "expiring soon" once per month, release abandoned checkouts, expire old invitations,
 * move referrals to AWAITING_COMPLETION, and retry referral rewards that were waiting for the programme to be switched on.
 */
export async function runRewardMaintenance(now = new Date()) {
  const result = { expiry: null, reminders: 0, released: 0, invitationsExpired: 0, awaiting: 0, retried: 0 };
  const program = await getProgram();

  // 1. month-end expiry
  const exp = await expireDueLots(now);
  result.expiry = exp;
  if (exp.lotsExpired > 0) {
    const period = monthKey(new Date(startOfIstMonth(now).getTime() - 1)); // the month that just ended
    await RewardExpiryRun.updateOne(
      { type: 'EXPIRY', period },
      { $setOnInsert: { type: 'EXPIRY', period, startedAt: now }, $set: { lastRunAt: now }, $inc: { lotsExpired: exp.lotsExpired, pointsExpired: exp.pointsExpired, usersAffected: exp.usersAffected } },
      { upsert: true },
    );
  }

  // 2. "expiring soon" email: once per month, in the last N days
  if (program.enabled && program.expiryEnabled) {
    const end = endOfIstMonth(now);
    const daysLeft = (end.getTime() - now.getTime()) / 86400000;
    if (daysLeft <= program.expiringSoonDays) {
      const period = monthKey(now);
      let first = false;
      try {
        await RewardExpiryRun.create({ type: 'REMINDER', period, startedAt: now, lastRunAt: now });
        first = true;
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
      if (first) {
        const lots = await RewardTransaction.aggregate([
          { $match: { remaining: { $gt: 0 }, expiredAt: null, expiresAt: { $gt: now, $lte: end } } },
          { $group: { _id: '$user', points: { $sum: '$remaining' } } },
        ]);
        let sent = 0;
        for (const row of lots) {
          const user = await User.findById(row._id);
          if (!isEligible(user)) continue;
          sendTemplate(user.email, 'pointsExpiringSoon', { name: user.name, points: row.points, expiresAt: end });
          sent += 1;
        }
        await RewardExpiryRun.updateOne({ type: 'REMINDER', period }, { $set: { remindersSent: sent } });
        result.reminders = sent;
      }
    }
  }

  // 3. abandoned checkouts give their points back
  const stale = await RewardRedemption.find({ status: 'RESERVED', createdAt: { $lt: new Date(now.getTime() - RESERVATION_TTL_MS) } }).lean();
  for (const r of stale) {
    const paid = await Purchase.exists({ _id: r.purchase, status: 'PAID' });
    if (paid) { await confirmRedemption(r.purchase, now); continue; }
    await Purchase.updateOne({ _id: r.purchase, status: 'CREATED' }, { $set: { status: 'FAILED' } });
    if (await releaseRedemption(r.purchase, 'CHECKOUT_TIMEOUT', now)) result.released += 1;
  }

  // 4. invitations that were never used
  const inv = await ReferralInvitation.updateMany({ status: 'INVITATION_SENT', active: true, expiresAt: { $lte: now } }, { $set: { status: 'EXPIRED', active: false } });
  result.invitationsExpired = inv.modifiedCount;

  // 5. referred customers whose booked consultation time has passed
  const booked = await ReferralInvitation.find({ status: 'CONSULTATION_BOOKED', active: true, appointment: { $exists: true } }).lean();
  for (const b of booked) {
    const appt = await Appointment.findById(b.appointment).select('startsAt status').lean();
    if (appt && appt.status === 'CONFIRMED' && appt.startsAt <= now) {
      const r = await ReferralInvitation.updateOne({ _id: b._id, status: 'CONSULTATION_BOOKED' }, { $set: { status: 'AWAITING_COMPLETION' } });
      result.awaiting += r.modifiedCount;
    }
  }

  // 6. referral rewards that were waiting (rule was off or the referrer was not yet verified)
  const waiting = await ReferralInvitation.find({ status: 'SUCCESSFUL', active: true, rewardTx: { $exists: false } }).limit(200);
  for (const w of waiting) {
    const r = await creditReferral(w);
    if (r.credited) result.retried += 1;
  }
  return result;
}

let timer;
/** Runs the maintenance pass shortly after start-up and then every hour. Idempotent, so extra copies are harmless. */
export function startRewardScheduler({ everyMs = 60 * 60 * 1000 } = {}) {
  if (timer) return;
  const tick = () => runRewardMaintenance().catch((err) => console.error('reward maintenance failed:', err.message));
  setTimeout(tick, 30 * 1000).unref();
  timer = setInterval(tick, everyMs);
  timer.unref();
}
export const stopRewardScheduler = () => { clearInterval(timer); timer = undefined; };
