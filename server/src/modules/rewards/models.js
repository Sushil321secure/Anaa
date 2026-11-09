import mongoose from 'mongoose';

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

// ---------------------------------------------------------------- RewardRule
// Admin-managed: nothing about reward amounts is hard-coded. Rules are created on first read with points 0 and enabled=false.
export const RULE_KEYS = ['REGISTRATION', 'PURCHASE', 'CONSULTATION', 'REFERRAL'];
const ruleSchema = new Schema(
  {
    key: { type: String, enum: RULE_KEYS, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    points: { type: Number, min: 0, max: 1000000, default: 0 },
    minPurchasePaise: { type: Number, min: 0, default: 0 }, // PURCHASE rule: smallest amount actually paid that qualifies
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
export const RewardRule = mongoose.model('RewardRule', ruleSchema);

// ---------------------------------------------------------------- RewardWallet
// Denormalised balances for fast reads. The ledger (RewardTransaction) is the source of truth and `reconcileWallet` proves they agree.
const walletSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, unique: true },
    available: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalRedeemed: { type: Number, default: 0 },
    totalExpired: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const RewardWallet = mongoose.model('RewardWallet', walletSchema);

// ---------------------------------------------------------------- RewardTransaction (the ledger)
// `points` is signed: EARN +, REDEEM -, EXPIRE -, REVERSE +/-, ADJUSTMENT +/-. Positive rows that add spendable points are "lots":
// they carry `expiresAt` and a `remaining` counter that redemptions consume (earliest expiry first), so points earned in
// different months are never treated as one lump.
export const TX_TYPES = ['EARN', 'REDEEM', 'EXPIRE', 'REVERSE', 'ADJUSTMENT'];
export const TX_SOURCES = ['REGISTRATION', 'PURCHASE', 'CONSULTATION', 'REFERRAL', 'REDEMPTION', 'EXPIRY', 'ADMIN'];
const txSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TX_TYPES, required: true },
    points: { type: Number, required: true },
    source: { type: String, enum: TX_SOURCES, required: true },
    refId: { type: ObjectId }, // the purchase / appointment / invitation / lot / redemption this relates to
    expiresAt: Date, // UTC; first instant of the next IST month
    remaining: Number, // lots only: points not yet spent or expired
    expiredAt: Date, // lots only: set by the expiry job when the leftover was expired
    idempotencyKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ['POSTED', 'PENDING', 'REVERSED'], default: 'POSTED' },
    metadata: { type: Schema.Types.Mixed }, // never health data: only ids, labels and reasons
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
txSchema.index({ user: 1, createdAt: -1 });
txSchema.index({ user: 1, remaining: 1, expiresAt: 1 });
txSchema.index({ expiresAt: 1, remaining: 1, expiredAt: 1 });
txSchema.index({ type: 1, source: 1, createdAt: -1 });
export const RewardTransaction = mongoose.model('RewardTransaction', txSchema);

// ---------------------------------------------------------------- RewardRedemption
// Points used on one checkout. RESERVED while the payment is open, CONFIRMED after verified payment, RELEASED if it fails.
const redemptionSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    purchase: { type: ObjectId, ref: 'Purchase', required: true, unique: true },
    points: { type: Number, required: true, min: 1 },
    discountPaise: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ['RESERVED', 'CONFIRMED', 'RELEASED'], default: 'RESERVED', index: true },
    allocations: [{ _id: false, lot: { type: ObjectId, ref: 'RewardTransaction' }, points: Number }],
    redeemTx: { type: ObjectId, ref: 'RewardTransaction' },
    confirmedAt: Date,
    releasedAt: Date,
    releaseReason: String,
  },
  { timestamps: true },
);
redemptionSchema.index({ status: 1, createdAt: 1 });
export const RewardRedemption = mongoose.model('RewardRedemption', redemptionSchema);

// ---------------------------------------------------------------- ReferralInvitation
export const REFERRAL_STATUSES = ['INVITATION_SENT', 'REGISTERED', 'CONSULTATION_BOOKED', 'AWAITING_COMPLETION', 'SUCCESSFUL', 'REWARD_CREDITED', 'EXPIRED', 'REJECTED'];
const invitationSchema = new Schema(
  {
    referrer: { type: ObjectId, ref: 'User', required: true, index: true },
    invitedEmail: { type: String, required: true, lowercase: true, trim: true }, // normalised; registration must use exactly this
    tokenHash: { type: String, required: true, unique: true }, // only the hash is stored; the raw token lives in the emailed link
    status: { type: String, enum: REFERRAL_STATUSES, default: 'INVITATION_SENT', index: true },
    active: { type: Boolean, default: true }, // false once EXPIRED or REJECTED; the unique index below uses it
    expiresAt: { type: Date, required: true },
    referredUser: { type: ObjectId, ref: 'User', index: true, sparse: true },
    registeredAt: Date,
    appointment: { type: ObjectId, ref: 'Appointment' },
    bookedAt: Date,
    completedAt: Date,
    successAt: Date,
    rewardTx: { type: ObjectId, ref: 'RewardTransaction' },
    rewardPoints: Number,
    flagged: { type: Boolean, default: false }, // suspicious (for example the same phone number): reward waits for an admin decision
    flagReason: String,
    reviewedBy: { type: ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectReason: String,
  },
  { timestamps: true },
);
// One live invitation per email address, ever: blocks duplicate invitations and "already referred" emails.
invitationSchema.index({ invitedEmail: 1 }, { unique: true, partialFilterExpression: { active: true } });
export const ReferralInvitation = mongoose.model('ReferralInvitation', invitationSchema);

// ---------------------------------------------------------------- RewardExpiryRun
// One row per (type, calendar month in IST). The unique index makes the monthly jobs idempotent across restarts and replicas.
const runSchema = new Schema(
  {
    type: { type: String, enum: ['EXPIRY', 'REMINDER'], required: true },
    period: { type: String, required: true }, // 'YYYY-MM' in Asia/Kolkata
    startedAt: Date,
    lastRunAt: Date,
    lotsExpired: { type: Number, default: 0 },
    pointsExpired: { type: Number, default: 0 },
    usersAffected: { type: Number, default: 0 },
    remindersSent: { type: Number, default: 0 },
    error: String,
  },
  { timestamps: true },
);
runSchema.index({ type: 1, period: 1 }, { unique: true });
export const RewardExpiryRun = mongoose.model('RewardExpiryRun', runSchema);
