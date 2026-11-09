import mongoose from 'mongoose';

export const ENQUIRY_STATUSES = ['NEW', 'CONTACTED', 'SCHEDULED', 'CONVERTED', 'CLOSED'];

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    goal: { type: String, required: true, trim: true, maxlength: 300 },
    preferredAt: Date, // UTC; a request only, never a confirmed appointment
    message: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'NEW', index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    followUpAt: Date,
  },
  { timestamps: true },
);

export const Enquiry = mongoose.model('Enquiry', enquirySchema);
