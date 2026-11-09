import mongoose from 'mongoose';

// Metadata only (who joined when, how long). No media, no SDP, no tokens are ever stored.
const sessionSchema = new mongoose.Schema(
  {
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dietitian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: String, required: true },
    sessionStatus: { type: String, enum: ['WAITING', 'ACTIVE', 'ENDED'], default: 'WAITING' },
    customerJoinedAt: Date,
    dietitianJoinedAt: Date,
    customerLeftAt: Date,
    dietitianLeftAt: Date,
    startedAt: Date, // first time both were in the room
    activeSince: Date, // set while both are in the room
    endedAt: Date,
    durationSeconds: { type: Number, default: 0 }, // time with both participants present, accumulated across rejoins
    joinCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const ConsultationSession = mongoose.model('ConsultationSession', sessionSchema);
export const roomIdFor = (appointmentId) => `consultation_${appointmentId}`;
