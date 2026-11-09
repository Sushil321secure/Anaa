import mongoose from 'mongoose';

// One body-measurement check-in. Only the date is required so a customer can log just what they measured.
const progressSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true }, // the check-in day (stored as UTC midnight of the IST date)
    weightKg: { type: Number, min: 10, max: 400 },
    waistCm: { type: Number, min: 30, max: 250 },
    bodyFatPct: { type: Number, min: 2, max: 70 },
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);
progressSchema.index({ customer: 1, date: -1 });

export const ProgressEntry = mongoose.model('ProgressEntry', progressSchema);
