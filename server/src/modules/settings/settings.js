import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  { key: { type: String, required: true, unique: true }, value: { type: mongoose.Schema.Types.Mixed } },
  { timestamps: true },
);
export const Setting = mongoose.model('Setting', settingSchema);

// Operational defaults the owner can change in the admin portal (Settings). Days use 0 = Sunday ... 6 = Saturday, in IST.
export const DEFAULTS = {
  availability: { days: [1, 2, 3, 4, 5, 6], startHour: 10, endHour: 18, slotMinutes: 45, minNoticeHours: 2, cancelBeforeHours: 24, maxDaysAhead: 30 },
  // Pay-as-you-go single consultation fees (paise): online ₹1,500, offline (in clinic) ₹1,000.
  consultationFees: { onlinePaise: 150000, offlinePaise: 100000 },
  // Online video consultation joining window (minutes): joining opens before the start and stays open this long after the booked end.
  consultationCall: { joinBeforeMinutes: 10, graceAfterMinutes: 15 },
  // Log & Earn programme switches. OFF until the owner enables it. 100 points = ₹50 was only an example from the brief:
  // the conversion below is a placeholder the owner must confirm. The ₹100 per-order cap is a fixed business rule (default).
  rewardsProgram: { enabled: false, paisePer100Points: 5000, maxDiscountPaise: 10000, minRedeemPoints: 0, expiryEnabled: true, inviteValidDays: 14, expiringSoonDays: 5 },
};

export async function getSetting(key) {
  const doc = await Setting.findOne({ key }).lean();
  return { ...DEFAULTS[key], ...(doc?.value || {}) };
}

export async function setSetting(key, value) {
  await Setting.updateOne({ key }, { $set: { value } }, { upsert: true });
  return getSetting(key);
}
