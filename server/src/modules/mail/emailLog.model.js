import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    template: { type: String, required: true },
    status: { type: String, enum: ['SENT', 'FAILED', 'SKIPPED'], required: true },
    error: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const EmailLog = mongoose.model('EmailLog', emailLogSchema);
