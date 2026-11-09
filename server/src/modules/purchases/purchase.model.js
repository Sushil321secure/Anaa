import mongoose from 'mongoose';

export const PURCHASE_STATUSES = ['CREATED', 'PAID', 'FAILED'];

// One row per package checkout. Pricing and entitlements are copied from the package at purchase time,
// so later admin edits never change what a customer already bought.
const purchaseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required() { return this.kind !== 'CONSULTATION'; } },
    // PACKAGE = a wellness package. CONSULTATION = one pay-as-you-go consultation (mode says online or offline).
    kind: { type: String, enum: ['PACKAGE', 'CONSULTATION'], default: 'PACKAGE' },
    mode: { type: String, enum: ['ONLINE', 'OFFLINE'] },
    snapshot: {
      name: String,
      durationDays: Number,
      pricePaise: Number,
      referenceMonthlyPaise: Number,
      referencePaise: Number,
      savingsPaise: Number,
      effectiveMonthlyPaise: Number,
    },
    status: { type: String, enum: PURCHASE_STATUSES, default: 'CREATED', index: true },
    // ONLINE = paid through Razorpay. MANUAL = staff recorded a payment received another way (cash, UPI, bank transfer).
    source: { type: String, enum: ['ONLINE', 'MANUAL'], default: 'ONLINE' },
    note: { type: String, trim: true, maxlength: 300 },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    razorpayOrderId: { type: String, unique: true, sparse: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    // Entitlements: only meaningful once status is PAID.
    // Reward points used on this order. The discount is computed by the backend and the points are reserved before payment starts.
    discountPaise: { type: Number, min: 0, default: 0 },
    rewardPointsUsed: { type: Number, min: 0, default: 0 },
    amountPaidPaise: Number, // what the customer actually paid (price minus discount)
    consultationsTotal: { type: Number, min: 0, default: 0 },
    consultationsUsed: { type: Number, min: 0, default: 0 },
    paidAt: Date, // UTC
    expiresAt: Date, // UTC
  },
  { timestamps: true },
);

export const Purchase = mongoose.model('Purchase', purchaseSchema);
