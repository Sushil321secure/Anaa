import mongoose from 'mongoose';

// Customer feedback is stored exactly as the customer wrote it (text only: no photos or avatars).
// Spelling is not "corrected" in code; any edit goes through the admin screen after owner approval.
const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    quote: { type: String, required: true, maxlength: 2000 },
    isPublished: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Testimonial = mongoose.model('Testimonial', testimonialSchema);
