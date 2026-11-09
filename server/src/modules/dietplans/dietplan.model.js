import mongoose from 'mongoose';

// A diet plan document uploaded by staff for one customer. The file lives in private storage (never served statically):
// it can only be downloaded through an authenticated route that checks the customer or a staff role.
const dietPlanSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    notes: { type: String, trim: true, maxlength: 1000 },
    validFrom: Date,
    validTo: Date,
    file: {
      storedName: { type: String, required: true }, // random name on disk, never the user's file name
      originalName: { type: String, required: true },
      mime: { type: String, required: true },
      size: { type: Number, required: true },
    },
  },
  { timestamps: true },
);

export const DietPlan = mongoose.model('DietPlan', dietPlanSchema);
