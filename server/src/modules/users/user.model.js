import mongoose from 'mongoose';

export const ROLES = ['OWNER', 'ADMIN', 'DIETITIAN', 'OPERATIONS', 'CUSTOMER'];
export const STAFF_ROLES = ROLES.filter((r) => r !== 'CUSTOMER');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Always stored trimmed + lowercased (see normalizeEmail); unique index blocks duplicates.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'CUSTOMER', index: true },
    isActive: { type: Boolean, default: true },
    emailVerifiedAt: { type: Date },
    // Customer profile
    dob: Date,
    gender: { type: String, enum: ['FEMALE', 'MALE', 'OTHER', ''], default: '' },
    city: { type: String, trim: true, maxlength: 80 },
    heightCm: { type: Number, min: 50, max: 250 },
    healthGoal: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
