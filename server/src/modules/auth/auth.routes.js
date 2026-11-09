import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../users/user.model.js';
import { attachInvitation, earn, resolveInviteForRegistration } from '../rewards/service.js';
import { sendTemplate } from '../mail/mailer.js';
import { ApiError, asyncHandler, normalizeEmail } from '../../utils/http.js';
import { COOKIE_NAME, cookieOptions, requireAuth, signToken } from '../../middleware/auth.js';
import { env } from '../../config/env.js';

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.NODE_ENV === 'production' ? 30 : 500, skip: () => env.NODE_ENV === 'test', standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Please wait a few minutes and try again.' } });

const emailField = z.string().trim().email('Enter a valid email address').transform(normalizeEmail);
export const passwordField = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Use at least one letter and one number');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: emailField,
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number').optional().or(z.literal('').transform(() => undefined)),
  password: passwordField,
  invite: z.string().trim().max(200).optional(), // token from a referral invitation email
});

const loginSchema = z.object({ email: emailField, password: z.string().min(1, 'Enter your password') });

// Short-lived, single-use password reset tokens. Only a hash of the token is stored.
const resetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
resetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 3600 }); // clean up old rows
const PasswordReset = mongoose.models.PasswordReset || mongoose.model('PasswordReset', resetSchema);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const noSmtpDev = () => env.NODE_ENV !== 'production' && !env.SMTP_HOST;

// Email verification: only a hash of the token is stored. Verified email is required for rewards, referrals and redemptions.
const verifySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
verifySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });
const EmailVerification = mongoose.models.EmailVerification || mongoose.model('EmailVerification', verifySchema);

async function sendVerification(user) {
  const token = crypto.randomBytes(32).toString('hex');
  await EmailVerification.create({ user: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 48 * 3600 * 1000) });
  const link = `${env.CLIENT_ORIGIN}/verify-email?token=${token}`;
  sendTemplate(user.email, 'verifyEmail', { name: user.name, link });
  return noSmtpDev() ? link : undefined; // local development only: with no SMTP the link is returned instead of emailed
}

router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  if (await User.exists({ email: data.email })) throw new ApiError(409, 'An account with this email already exists');
  // An invitation only works with the exact email it was sent to (throws otherwise). Unknown/expired links are simply ignored.
  const { invitation, ignored } = await resolveInviteForRegistration(data.invite, data.email);
  const passwordHash = await bcrypt.hash(data.password, 12);
  // Role is never taken from the request body: public registration always creates a CUSTOMER.
  const user = await User.create({ name: data.name, email: data.email, phone: data.phone, passwordHash, role: 'CUSTOMER' });
  if (invitation) await attachInvitation(invitation, user).catch((err) => console.error('referral link failed', err.message));
  const devVerifyLink = await sendVerification(user);
  sendTemplate(user.email, 'welcome', { name: user.name });
  res.cookie(COOKIE_NAME, signToken(user), cookieOptions).status(201).json({ user, devVerifyLink, inviteIgnored: ignored });
}));

router.post('/verify-email', authLimiter, asyncHandler(async (req, res) => {
  const { token } = z.object({ token: z.string().min(20).max(200) }).parse(req.body);
  const row = await EmailVerification.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!row) throw new ApiError(400, 'This verification link is invalid or has expired. Log in and ask for a new one.');
  const user = await User.findOneAndUpdate({ _id: row.user, emailVerifiedAt: { $exists: false } }, { $set: { emailVerifiedAt: new Date() } }, { new: true })
    || (await User.findById(row.user));
  // The one-time registration reward. The idempotency key means verifying twice (or a retry) can never pay it twice.
  const reward = await earn({ userId: user._id, ruleKey: 'REGISTRATION', refId: user._id, key: `registration:${user._id}` });
  res.json({ ok: true, user, pointsEarned: reward.credited ? reward.points : 0 });
}));

router.post('/resend-verification', requireAuth, authLimiter, asyncHandler(async (req, res) => {
  if (req.user.emailVerifiedAt) return res.json({ ok: true, alreadyVerified: true });
  res.json({ ok: true, devVerifyLink: await sendVerification(req.user) });
}));

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new ApiError(401, 'Invalid email or password');
  res.cookie(COOKIE_NAME, signToken(user), cookieOptions).json({ user });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined }).json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

// Always answers the same way so the endpoint cannot be used to find out which emails have accounts.
router.post('/forgot-password', authLimiter, asyncHandler(async (req, res) => {
  const { email } = z.object({ email: emailField }).parse(req.body);
  const user = await User.findOne({ email, isActive: true });
  let devResetLink;
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await PasswordReset.create({ user: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
    const link = `${env.CLIENT_ORIGIN}/reset-password?token=${token}`;
    sendTemplate(user.email, 'passwordReset', { name: user.name, link });
    // Local development only: with no SMTP configured nobody can receive the email, so the link is returned here.
    if (env.NODE_ENV !== 'production' && !env.SMTP_HOST) devResetLink = link;
  }
  res.json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.', devResetLink });
}));

router.post('/reset-password', authLimiter, asyncHandler(async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(20).max(200), password: passwordField }).parse(req.body);
  const row = await PasswordReset.findOneAndUpdate(
    { tokenHash: sha256(token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!row) throw new ApiError(400, 'This reset link is invalid or has expired. Please request a new one.');
  await User.updateOne({ _id: row.user }, { $set: { passwordHash: await bcrypt.hash(password, 12) } });
  await PasswordReset.updateMany({ user: row.user, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } });
  res.json({ ok: true });
}));

export default router;
