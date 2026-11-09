import mongoose from 'mongoose';

// Prices are integer paise. null means "pricing on request" (no value is invented).
const base = {
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  summary: { type: String, required: true, trim: true, maxlength: 400 },
  pricePaise: { type: Number, min: 0, default: null },
  isActive: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 },
};

export const Service = mongoose.model(
  'Service',
  new mongoose.Schema({ ...base, durationMinutes: { type: Number, min: 5, max: 480 } }, { timestamps: true }),
);

export const PACKAGE_BADGES = ['MOST_POPULAR', 'BEST_VALUE'];

export const Package = mongoose.model(
  'Package',
  new mongoose.Schema(
    {
      ...base,
      durationDays: { type: Number, min: 1 },
      // Single-month rate used as the reference for savings. Savings are derived (see pricing.js), never typed in.
      referenceMonthlyPaise: { type: Number, min: 0, default: null },
      badge: { type: String, enum: [...PACKAGE_BADGES, null], default: null },
      tagline: { type: String, trim: true, maxlength: 160 },
      bestFor: { type: String, trim: true, maxlength: 300 },
      // Entitlements granted on successful payment.
      initialConsultMinutes: { type: Number, min: 5, max: 480, default: 45 },
      followUpConsults: { type: Number, min: 0, default: 0 },
      dietPlans: { type: Number, min: 0, default: 1 },
      dietRevisionsLabel: { type: String, trim: true, maxlength: 80 },
      features: [{ type: String, trim: true, maxlength: 200 }],
    },
    { timestamps: true },
  ),
);
