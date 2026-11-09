import crypto from 'node:crypto';
import { YogaBooking, YogaSession } from './yoga.model.js';
import { YOGA } from './config.js';
import { User } from '../users/user.model.js';
import { sendTemplate } from '../mail/mailer.js';

export const newReference = () => `YG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
export const sessionEnd = (s) => new Date(new Date(s.startsAt).getTime() + s.durationMinutes * 60000);
export const joinWindowFor = (s, now = new Date()) => {
  const opensAt = new Date(new Date(s.startsAt).getTime() - YOGA.joinBeforeMinutes * 60000);
  const closesAt = new Date(sessionEnd(s).getTime() + YOGA.joinAfterEndMinutes * 60000);
  return { opensAt, closesAt, open: now >= opensAt && now <= closesAt };
};

// Seats: an atomic counter guarded by the capacity, so concurrent requests can never overbook.
export const takeSeat = (sessionId) => YogaSession.findOneAndUpdate(
  { _id: sessionId, $expr: { $lt: ['$seatsTaken', '$maxParticipants'] } },
  { $inc: { seatsTaken: 1 } },
  { new: true },
);
export const freeSeat = (sessionId) => YogaSession.updateOne({ _id: sessionId, seatsTaken: { $gt: 0 } }, { $inc: { seatsTaken: -1 } });

const mailData = (booking, session, user, coachName) => ({
  name: user.name, title: session.title, coachName, startsAt: session.startsAt, timezone: session.timezone,
  durationMinutes: session.durationMinutes, bookingReference: booking.bookingReference,
});
export async function notifyBooking(template, booking, session, extra = {}) {
  const [user, coach] = await Promise.all([User.findById(booking.user).select('name email'), User.findById(session.coach).select('name')]);
  if (!user?.email) return false;
  return sendTemplate(user.email, template, { ...mailData(booking, session, user, coach?.name || 'Your coach'), ...extra });
}

/** Cancels a pending/confirmed booking once, frees the seat and flags paid bookings for a manual refund. */
export async function cancelBookingRecord(booking, { by, reason, byClinic = false, notify = true }) {
  const wasPaid = booking.paymentStatus === 'paid';
  const done = await YogaBooking.findOneAndUpdate(
    { _id: booking._id, bookingStatus: { $in: ['pending', 'confirmed'] } },
    { $set: { bookingStatus: 'cancelled', cancelledAt: new Date(), cancelledBy: by, cancellationReason: reason, ...(wasPaid ? { paymentStatus: 'refund_due' } : booking.paymentStatus === 'pending' ? { paymentStatus: 'failed' } : {}) } },
    { new: true },
  );
  if (!done) return null; // already cancelled by someone else
  await freeSeat(done.session);
  if (notify && booking.bookingStatus === 'confirmed') {
    const session = await YogaSession.findById(done.session);
    await notifyBooking('yogaCancelled', done, session, { byClinic, reason, refundDue: wasPaid });
  }
  return done;
}

export async function cancelWholeSession(session, reason) {
  const bookings = await YogaBooking.find({ session: session._id, bookingStatus: { $in: ['pending', 'confirmed'] } });
  for (const b of bookings) await cancelBookingRecord(b, { reason, byClinic: true });
}

/** Releases unpaid held seats and sends the 24 h and 15 min reminders. Safe to run repeatedly. */
export async function runYogaMaintenance(now = new Date()) {
  const out = { released: 0, reminders24: 0, reminders15: 0 };
  const stale = await YogaBooking.find({ bookingStatus: 'pending', holdExpiresAt: { $lt: now } });
  for (const b of stale) if (await cancelBookingRecord(b, { reason: 'Payment not completed in time', notify: false })) out.released += 1;

  const live = ['awaiting_meeting_link', 'scheduled'];
  const sessions = await YogaSession.find({ status: { $in: live }, startsAt: { $gt: now, $lte: new Date(now.getTime() + 24 * 3600 * 1000) } });
  for (const s of sessions) {
    const ms = s.startsAt.getTime() - now.getTime();
    const lead = ms <= 15 * 60000 ? '15m' : '24h';
    const flag = lead === '15m' ? 'reminder15At' : 'reminder24At';
    const bookings = await YogaBooking.find({ session: s._id, bookingStatus: 'confirmed', [flag]: null });
    for (const b of bookings) {
      // A booking made inside the last 24 h does not also get a "24 hours" reminder.
      if (lead === '24h' && b.bookedAt && s.startsAt.getTime() - b.bookedAt.getTime() < 24 * 3600 * 1000) { await YogaBooking.updateOne({ _id: b._id }, { $set: { reminder24At: now } }); continue; }
      const claimed = await YogaBooking.findOneAndUpdate({ _id: b._id, [flag]: null }, { $set: { [flag]: now } }); // claim first: never sent twice
      if (!claimed) continue;
      await notifyBooking('yogaReminder', b, s, { lead });
      out[lead === '15m' ? 'reminders15' : 'reminders24'] += 1;
    }
  }
  return out;
}

let timer;
export function startYogaScheduler({ everyMs = 60 * 1000 } = {}) {
  if (timer) return;
  const tick = () => runYogaMaintenance().catch((err) => console.error('yoga maintenance failed:', err.message));
  setTimeout(tick, 20 * 1000).unref();
  timer = setInterval(tick, everyMs);
  timer.unref();
}
export const stopYogaScheduler = () => { clearInterval(timer); timer = undefined; };
