import mongoose from 'mongoose';

export const APPOINTMENT_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const appointmentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', required: true }, // entitlement it consumed
    dietitian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    mode: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },
    startsAt: { type: Date, required: true, index: true }, // UTC
    durationMinutes: { type: Number, required: true },
    slotNo: { type: Number, required: true }, // 1..number of dietitians: lets parallel consultations share a time
    status: { type: String, enum: APPOINTMENT_STATUSES, default: 'CONFIRMED', index: true },
    notes: { type: String, trim: true, maxlength: 500 }, // from the customer
    staffNotes: { type: String, trim: true, maxlength: 1000 },
    startedAt: Date, // first moment both people were in the video room
    meetingUrl: { type: String, trim: true, maxlength: 500 },
    // How an online consultation is held: the in-app video room (WebRTC, default) or a Google Meet link the dietitian pastes in.
    provider: { type: String, enum: ['WEBRTC', 'GOOGLE_MEET'], default: 'WEBRTC' },
    meetLink: { type: String, select: false }, // never returned by lists; only by /api/consultation-meet/:id/join
    meetLinkStatus: { type: String, enum: ['PENDING', 'ADDED'], default: 'PENDING' },
    meetLinkUpdatedAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    consultationReturned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Race-safe double-booking guard: only one CONFIRMED appointment per (time, slotNo).
appointmentSchema.index({ startsAt: 1, slotNo: 1 }, { unique: true, partialFilterExpression: { status: 'CONFIRMED' } });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
