import mongoose from 'mongoose';
import { YOGA } from './config.js';

const ref = (to, extra = {}) => ({ type: mongoose.Schema.Types.ObjectId, ref: to, ...extra });

const sessionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    coach: ref('User', { required: true, index: true }), // a DIETITIAN-role staff account
    category: { type: String, enum: YOGA.categories, default: 'Hatha' },
    difficultyLevel: { type: String, enum: YOGA.levels, default: 'ALL_LEVELS' },
    sessionDate: { type: String, required: true }, // wall-clock date in `timezone` (YYYY-MM-DD)
    startTime: { type: String, required: true }, // wall-clock time in `timezone` (HH:mm)
    timezone: { type: String, required: true }, // IANA name, the session's intended zone
    startsAt: { type: Date, required: true, index: true }, // UTC instant: the source of truth for all time logic
    durationMinutes: { type: Number, required: true, min: 10, max: 300 },
    maxParticipants: { type: Number, required: true, min: 1, max: YOGA.maxParticipantsCap },
    seatsTaken: { type: Number, default: 0, min: 0 }, // confirmed + pending (held) bookings, updated atomically
    pricePaise: { type: Number, default: 0, min: 0 }, // 0 = free
    currency: { type: String, default: 'INR' },
    sessionType: { type: String, enum: ['GROUP'], default: 'GROUP' },
    meetingProvider: { type: String, enum: ['GOOGLE_MEET'], default: 'GOOGLE_MEET' },
    meetingLink: { type: String, select: false }, // never returned unless a route asks for it explicitly
    meetingLinkStatus: { type: String, enum: ['MISSING', 'ADDED'], default: 'MISSING' },
    meetingLinkUpdatedAt: Date,
    bookingOpensAt: Date,
    bookingClosesAt: Date,
    status: { type: String, enum: YOGA.statuses, default: 'draft', index: true },
    coachNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    createdBy: ref('User'),
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);

const bookingSchema = new mongoose.Schema(
  {
    user: ref('User', { required: true, index: true }),
    session: ref('YogaSession', { required: true, index: true }),
    bookingReference: { type: String, required: true, unique: true },
    bookingStatus: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending', index: true },
    paymentStatus: { type: String, enum: ['not_required', 'pending', 'paid', 'failed', 'refund_due'], default: 'not_required' },
    amountPaise: { type: Number, default: 0 },
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: String,
    holdExpiresAt: Date, // pending paid bookings hold a seat until this time
    bookedAt: Date,
    cancelledAt: Date,
    cancelledBy: ref('User'),
    cancellationReason: { type: String, maxlength: 300 },
    attendance: { type: String, enum: ['unmarked', 'present', 'absent'], default: 'unmarked' },
    attendanceMarkedAt: Date,
    reminder24At: Date,
    reminder15At: Date,
  },
  { timestamps: true },
);
// One live booking per person per session, enforced by the database. "Live" = pending or confirmed. The filter uses a range
// instead of $in because partial indexes only accept $in from MongoDB 6.0 and the UAT server runs MongoDB 4.4. The statuses sort
// alphabetically as cancelled < completed < confirmed < pending, so ">= 'confirmed'" is exactly pending + confirmed.
bookingSchema.index({ user: 1, session: 1 }, { unique: true, partialFilterExpression: { bookingStatus: { $gte: 'confirmed' } } });

export const YogaSession = mongoose.model('YogaSession', sessionSchema);
export const YogaBooking = mongoose.model('YogaBooking', bookingSchema);
