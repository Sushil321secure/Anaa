import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { YogaBooking, YogaSession } from './yoga.model.js';
import { YOGA } from './config.js';
import { normalizeMeetLink } from './meet.js';
import { validTimezone, zonedToUtc } from './time.js';
import { cancelBookingRecord, cancelWholeSession, freeSeat, joinWindowFor, newReference, notifyBooking, sessionEnd, takeSeat } from './yoga.service.js';
import { checkoutPrefill, createOrder, verifyPaymentSignature } from '../payments/razorpay.js';
import { User } from '../users/user.model.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../audit/audit.model.js';
import { env } from '../../config/env.js';

const isManager = (u) => ['OWNER', 'ADMIN'].includes(u.role);
const managers = requireRole('OWNER', 'ADMIN');
const coachOrManager = requireRole('OWNER', 'ADMIN', 'DIETITIAN');
const customers = requireRole('CUSTOMER');
const oid = (id, what = 'Record') => { if (!mongoose.isValidObjectId(id)) throw new ApiError(404, `${what} not found`); return id; };
const idOf = (v) => String(v?._id ?? v ?? '');
const BOOKABLE = ['awaiting_meeting_link', 'scheduled'];

async function loadSession(id, { link = false } = {}) {
  const q = YogaSession.findById(oid(id, 'Yoga session')).populate('coach', 'name');
  if (link) q.select('+meetingLink');
  const s = await q;
  if (!s) throw new ApiError(404, 'Yoga session not found');
  return s;
}
// Coach of the session, or OWNER/ADMIN. Everyone else is told the session does not exist.
function assertCanManage(user, s) {
  if (isManager(user)) return;
  if (user.role === 'DIETITIAN' && idOf(s.coach) === String(user._id)) return;
  throw new ApiError(404, 'Yoga session not found');
}

// Never includes meetingLink. Staff only see whether one has been added.
function view(s, user, extra = {}) {
  const o = s.toObject ? s.toObject() : { ...s };
  delete o.meetingLink;
  if (!user || user.role === 'CUSTOMER') { delete o.meetingLinkStatus; delete o.meetingLinkUpdatedAt; delete o.coachNotes; delete o.createdBy; }
  return { ...o, seatsLeft: Math.max(0, s.maxParticipants - s.seatsTaken), isFree: !s.pricePaise, endsAt: sessionEnd(s), joinWindow: joinWindowFor(s), ...extra };
}
const warningsFor = (s) => {
  const w = [];
  if (s.durationMinutes > YOGA.freeMeetMaxMinutes) w.push(`A free Google Meet account ends group meetings (3 or more people) after ${YOGA.freeMeetMaxMinutes} minutes. This ${s.durationMinutes}-minute session will be cut off unless the coach hosts with a paid Google Workspace account.`);
  return w;
};

// ------------------------------------------------------------------ sessions
export const sessionRoutes = Router();
sessionRoutes.use(requireAuth);

const baseSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).default(''),
  coachId: z.string().refine(mongoose.isValidObjectId, 'Choose a coach'),
  category: z.enum(YOGA.categories).default('Hatha'),
  difficultyLevel: z.enum(YOGA.levels).default('ALL_LEVELS'),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().refine(validTimezone, 'Unknown timezone'),
  durationMinutes: z.number().int().min(10).max(300),
  maxParticipants: z.number().int().min(1).max(YOGA.maxParticipantsCap),
  pricePaise: z.number().int().min(0).max(100000000).default(0),
  bookingOpensAt: z.string().datetime().nullable().optional(),
  bookingClosesAt: z.string().datetime().nullable().optional(),
});

async function checkCoach(id) {
  const c = await User.findOne({ _id: id, role: 'DIETITIAN', isActive: true }).select('name');
  if (!c) throw new ApiError(400, 'Choose an active coach (a dietitian account).');
  return c;
}
function computeTimes(d) {
  const startsAt = zonedToUtc(d.sessionDate, d.startTime, d.timezone);
  if (!startsAt) throw new ApiError(400, 'That date and time does not exist in the chosen timezone.');
  const opens = d.bookingOpensAt ? new Date(d.bookingOpensAt) : undefined;
  const closes = d.bookingClosesAt ? new Date(d.bookingClosesAt) : undefined;
  if (opens && closes && closes <= opens) throw new ApiError(400, 'Booking must close after it opens.');
  if (closes && closes > startsAt) throw new ApiError(400, 'Booking cannot stay open after the session starts.');
  return { startsAt, bookingOpensAt: opens, bookingClosesAt: closes };
}

sessionRoutes.get('/', asyncHandler(async (req, res) => {
  const u = req.user;
  const q = z.object({ status: z.string().optional(), when: z.enum(['upcoming', 'past', 'all']).default('all') }).parse(req.query);
  const now = new Date();
  const filter = {};
  if (u.role === 'CUSTOMER') {
    filter.status = { $in: BOOKABLE };
    filter.startsAt = { $gt: now };
  } else if (u.role === 'DIETITIAN') filter.coach = u._id;
  else if (!isManager(u)) throw new ApiError(403, 'Forbidden');
  if (u.role !== 'CUSTOMER') {
    if (q.status) filter.status = q.status;
    if (q.when === 'upcoming') filter.startsAt = { $gt: now };
    if (q.when === 'past') filter.startsAt = { $lte: now };
  }
  const items = await YogaSession.find(filter).populate('coach', 'name').sort(u.role !== 'CUSTOMER' && q.when === 'past' ? { startsAt: -1 } : { startsAt: 1 }).limit(300);
  let mine = new Map();
  if (u.role === 'CUSTOMER') mine = new Map((await YogaBooking.find({ user: u._id, session: { $in: items.map((s) => s._id) }, bookingStatus: { $in: ['pending', 'confirmed'] } }).select('session bookingStatus').lean()).map((b) => [String(b.session), b.bookingStatus]));
  res.json({ items: items.map((s) => view(s, u, u.role === 'CUSTOMER' ? { myBooking: mine.get(String(s._id)) || null } : {})) });
}));

sessionRoutes.get('/:id', asyncHandler(async (req, res) => {
  const s = await loadSession(req.params.id);
  const u = req.user;
  if (u.role === 'CUSTOMER') {
    if (s.status === 'draft') throw new ApiError(404, 'Yoga session not found');
    const mine = await YogaBooking.findOne({ user: u._id, session: s._id, bookingStatus: { $in: ['pending', 'confirmed'] } }).select('bookingStatus').lean();
    return res.json({ session: view(s, u, { myBooking: mine?.bookingStatus || null }) });
  }
  assertCanManage(u, s);
  res.json({ session: view(s, u), warnings: warningsFor(s) });
}));

sessionRoutes.post('/', managers, asyncHandler(async (req, res) => {
  const d = baseSchema.parse(req.body);
  await checkCoach(d.coachId);
  const times = computeTimes(d);
  if (times.startsAt <= new Date()) throw new ApiError(400, 'The session must start in the future.');
  const s = await YogaSession.create({ ...d, coach: d.coachId, ...times, createdBy: req.user._id, status: 'draft' });
  await audit(req.user._id, 'yoga.create', 'yogaSession', s._id, { title: s.title });
  res.status(201).json({ session: view(await s.populate('coach', 'name'), req.user), warnings: warningsFor(s) });
}));

sessionRoutes.put('/:id', managers, asyncHandler(async (req, res) => {
  const s = await loadSession(req.params.id);
  if (['completed', 'cancelled'].includes(s.status)) throw new ApiError(409, `A ${s.status} session cannot be edited.`);
  const d = baseSchema.parse(req.body);
  await checkCoach(d.coachId);
  if (d.maxParticipants < s.seatsTaken) throw new ApiError(400, `${s.seatsTaken} seats are already booked, so capacity cannot go below that.`);
  const times = computeTimes(d);
  const rescheduled = times.startsAt.getTime() !== s.startsAt.getTime();
  if (rescheduled && times.startsAt <= new Date()) throw new ApiError(400, 'The new start time must be in the future.');
  Object.assign(s, { ...d, coach: d.coachId, ...times, bookingOpensAt: times.bookingOpensAt ?? null, bookingClosesAt: times.bookingClosesAt ?? null });
  await s.save();
  await audit(req.user._id, 'yoga.update', 'yogaSession', s._id, { rescheduled });
  if (rescheduled) {
    const bookings = await YogaBooking.find({ session: s._id, bookingStatus: 'confirmed' });
    await YogaBooking.updateMany({ session: s._id }, { $set: { reminder24At: null, reminder15At: null } });
    for (const b of bookings) await notifyBooking('yogaRescheduled', b, s);
  }
  res.json({ session: view(await s.populate('coach', 'name'), req.user), warnings: warningsFor(s), notified: rescheduled });
}));

sessionRoutes.patch('/:id/meeting-link', coachOrManager, asyncHandler(async (req, res) => {
  const s = await loadSession(req.params.id);
  assertCanManage(req.user, s);
  const { meetingLink } = z.object({ meetingLink: z.string().trim().min(1).max(200) }).parse(req.body);
  if (['completed', 'cancelled'].includes(s.status) || sessionEnd(s) < new Date()) throw new ApiError(409, 'The link can only be changed before the session ends.');
  const link = normalizeMeetLink(meetingLink);
  if (!link) throw new ApiError(400, 'Enter a Google Meet link like https://meet.google.com/abc-defg-hij');
  s.meetingLink = link;
  s.meetingLinkStatus = 'ADDED';
  s.meetingLinkUpdatedAt = new Date();
  if (s.status === 'awaiting_meeting_link') s.status = 'scheduled';
  await s.save();
  await audit(req.user._id, 'yoga.meetingLink', 'yogaSession', s._id, {}); // the link itself is not written to the audit log
  res.json({ session: view(s, req.user) });
}));

const detailsSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000),
  category: z.enum(YOGA.categories),
  difficultyLevel: z.enum(YOGA.levels),
});
sessionRoutes.patch('/:id/details', coachOrManager, asyncHandler(async (req, res) => {
  const s = await loadSession(req.params.id);
  assertCanManage(req.user, s);
  if (['completed', 'cancelled'].includes(s.status)) throw new ApiError(409, `A ${s.status} session cannot be edited.`);
  Object.assign(s, detailsSchema.parse(req.body));
  await s.save();
  await audit(req.user._id, 'yoga.details', 'yogaSession', s._id, {});
  res.json({ session: view(s, req.user) });
}));

sessionRoutes.patch('/:id/notes', coachOrManager, asyncHandler(async (req, res) => {
  const s = await loadSession(req.params.id);
  assertCanManage(req.user, s);
  s.coachNotes = z.object({ coachNotes: z.string().trim().max(2000) }).parse(req.body).coachNotes;
  await s.save();
  res.json({ session: view(s, req.user) });
}));

sessionRoutes.patch('/:id/status', coachOrManager, asyncHandler(async (req, res) => {
  const { action, reason } = z.object({ action: z.enum(['publish', 'start', 'complete', 'cancel']), reason: z.string().trim().max(300).optional() }).parse(req.body);
  const s = await loadSession(req.params.id, { link: true });
  assertCanManage(req.user, s);
  const now = new Date();
  if ((action === 'publish' || action === 'cancel') && !isManager(req.user)) throw new ApiError(403, 'Only an admin can do that.');
  if (action === 'publish') {
    if (s.status !== 'draft') throw new ApiError(409, 'Only a draft can be published.');
    if (s.startsAt <= now) throw new ApiError(400, 'The start time has already passed. Edit the session and choose a new date and time, then publish.');
    s.status = s.meetingLinkStatus === 'ADDED' ? 'scheduled' : 'awaiting_meeting_link';
  } else if (action === 'start') {
    if (s.status !== 'scheduled') throw new ApiError(409, s.status === 'awaiting_meeting_link' ? 'Add the Google Meet link before starting.' : `A ${s.status} session cannot be started.`);
    s.status = 'ongoing';
    s.startedAt = now;
  } else if (action === 'complete') {
    if (!['scheduled', 'ongoing'].includes(s.status)) throw new ApiError(409, `A ${s.status} session cannot be completed.`);
    if (s.startsAt > now) throw new ApiError(409, 'The session has not started yet.');
    s.status = 'completed';
    s.completedAt = now;
    await YogaBooking.updateMany({ session: s._id, bookingStatus: 'confirmed' }, { $set: { bookingStatus: 'completed' } });
    const stale = await YogaBooking.find({ session: s._id, bookingStatus: 'pending' });
    for (const b of stale) await cancelBookingRecord(b, { reason: 'Session ended', notify: false });
  } else {
    if (['completed', 'cancelled'].includes(s.status)) throw new ApiError(409, `This session is already ${s.status}.`);
    s.status = 'cancelled';
    s.cancelledAt = now;
    s.cancelReason = reason;
    await s.save();
    await cancelWholeSession(s, reason || 'The session was cancelled');
  }
  await s.save();
  await audit(req.user._id, `yoga.${action}`, 'yogaSession', s._id, { reason });
  res.json({ session: view(s, req.user) });
}));

sessionRoutes.get('/:id/participants', coachOrManager, asyncHandler(async (req, res) => {
  const s = await loadSession(req.params.id);
  assertCanManage(req.user, s);
  const items = await YogaBooking.find({ session: s._id }).populate('user', 'name email phone').sort({ bookedAt: 1, createdAt: 1 }).lean();
  res.json({ items, seatsTaken: s.seatsTaken, maxParticipants: s.maxParticipants });
}));

sessionRoutes.post('/:id/attendance', coachOrManager, asyncHandler(async (req, res) => {
  const s = await loadSession(req.params.id);
  assertCanManage(req.user, s);
  const { entries } = z.object({ entries: z.array(z.object({ bookingId: z.string().refine(mongoose.isValidObjectId), status: z.enum(['present', 'absent', 'unmarked']) })).min(1).max(200) }).parse(req.body);
  if (s.status === 'cancelled' || s.status === 'draft' || s.startsAt > new Date()) throw new ApiError(409, 'Attendance can be marked once the session has started.');
  let updated = 0;
  for (const e of entries) {
    const r = await YogaBooking.updateOne({ _id: e.bookingId, session: s._id, bookingStatus: { $in: ['confirmed', 'completed'] } }, { $set: { attendance: e.status, attendanceMarkedAt: e.status === 'unmarked' ? null : new Date() } });
    updated += r.modifiedCount;
  }
  await audit(req.user._id, 'yoga.attendance', 'yogaSession', s._id, { count: entries.length });
  res.json({ updated });
}));

// The coach (or an admin) opens the meeting: the link goes only to authorised staff.
sessionRoutes.get('/:id/join', coachOrManager, asyncHandler(async (req, res) => {
  const s = await loadSession(req.params.id, { link: true });
  assertCanManage(req.user, s);
  if (!s.meetingLink) throw new ApiError(409, 'Add the Google Meet link first.');
  if (s.status === 'cancelled') throw new ApiError(409, 'This session was cancelled.');
  res.json({ meetingLink: s.meetingLink });
}));

// ------------------------------------------------------------------ booking
sessionRoutes.post('/:id/book', customers, asyncHandler(async (req, res) => {
  const s = await loadSession(req.params.id);
  const now = new Date();
  if (s.status === 'draft') throw new ApiError(404, 'Yoga session not found');
  if (!BOOKABLE.includes(s.status) || s.startsAt <= now) throw new ApiError(409, 'This session is not open for booking.');
  if ((s.bookingOpensAt && now < s.bookingOpensAt) || (s.bookingClosesAt && now > s.bookingClosesAt)) throw new ApiError(409, 'Booking for this session is not open right now.');

  let booking = await YogaBooking.findOne({ user: req.user._id, session: s._id, bookingStatus: { $in: ['pending', 'confirmed'] } });
  if (booking?.bookingStatus === 'confirmed') throw new ApiError(409, 'You have already booked this session.');
  if (!booking) {
    if (!(await takeSeat(s._id))) throw new ApiError(409, 'This session is full.');
    try {
      booking = await YogaBooking.create({
        user: req.user._id, session: s._id, bookingReference: newReference(), amountPaise: s.pricePaise,
        ...(s.pricePaise
          ? { bookingStatus: 'pending', paymentStatus: 'pending', holdExpiresAt: new Date(now.getTime() + YOGA.paymentHoldMinutes * 60000) }
          : { bookingStatus: 'confirmed', paymentStatus: 'not_required', bookedAt: now }),
      });
    } catch (err) {
      await freeSeat(s._id);
      if (err.code === 11000) throw new ApiError(409, 'You have already booked this session.');
      throw err;
    }
  }
  if (!s.pricePaise) {
    await notifyBooking('yogaBookingConfirmed', booking, s);
    return res.status(201).json({ booking, confirmed: true });
  }
  try {
    const order = await createOrder({ amountPaise: s.pricePaise, receipt: `yoga_${booking._id}`, notes: { bookingId: String(booking._id), yoga: 'true' } });
    booking.razorpayOrderId = order.id;
    booking.amountPaise = s.pricePaise;
    booking.holdExpiresAt = new Date(now.getTime() + YOGA.paymentHoldMinutes * 60000);
    await booking.save();
    res.status(201).json({
      booking, confirmed: false,
      checkout: { bookingId: booking._id, keyId: env.RAZORPAY_KEY_ID, orderId: order.id, amountPaise: booking.amountPaise, packageName: s.title, prefill: checkoutPrefill(req.user) },
    });
  } catch (err) {
    await cancelBookingRecord(booking, { by: req.user._id, reason: 'Payment could not be started', notify: false });
    throw err;
  }
}));

// ------------------------------------------------------------------ bookings
export const bookingRoutes = Router();
bookingRoutes.use(requireAuth);

const verifySchema = z.object({ razorpay_order_id: z.string().min(1).max(100), razorpay_payment_id: z.string().min(1).max(100), razorpay_signature: z.string().min(1).max(200) });

bookingRoutes.post('/verify', customers, asyncHandler(async (req, res) => {
  const body = verifySchema.parse(req.body);
  const booking = await YogaBooking.findOne({ razorpayOrderId: body.razorpay_order_id, user: req.user._id });
  if (!booking) throw new ApiError(404, 'Order not found');
  if (booking.paymentStatus === 'paid' && ['confirmed', 'completed'].includes(booking.bookingStatus)) return res.json({ booking }); // idempotent retry
  if (!verifyPaymentSignature({ orderId: body.razorpay_order_id, paymentId: body.razorpay_payment_id, signature: body.razorpay_signature })) throw new ApiError(400, 'Payment could not be verified. Your booking was not confirmed.');
  const s = await YogaSession.findById(booking.session);
  const paid = { bookingStatus: 'confirmed', paymentStatus: 'paid', razorpayPaymentId: body.razorpay_payment_id, bookedAt: new Date(), holdExpiresAt: null };
  let done = await YogaBooking.findOneAndUpdate({ _id: booking._id, bookingStatus: 'pending' }, { $set: paid }, { new: true });
  if (!done && booking.bookingStatus === 'cancelled') {
    // The seat hold expired while the customer was paying. Take a seat again if one is left; otherwise flag the payment for a refund.
    if (s && BOOKABLE.includes(s.status) && (await takeSeat(s._id))) {
      try { done = await YogaBooking.findOneAndUpdate({ _id: booking._id, bookingStatus: 'cancelled' }, { $set: { ...paid, cancelledAt: null, cancellationReason: null } }, { new: true }); } catch { done = null; }
      if (!done) await freeSeat(s._id);
    }
    if (!done) {
      await YogaBooking.updateOne({ _id: booking._id }, { $set: { paymentStatus: 'refund_due', razorpayPaymentId: body.razorpay_payment_id } });
      throw new ApiError(409, 'Your payment was received but the session filled up or closed while you were paying. We will refund you.');
    }
  }
  if (!done) throw new ApiError(409, 'This booking can no longer be confirmed.');
  await notifyBooking('yogaBookingConfirmed', done, s, { amountPaise: done.amountPaise });
  await audit(req.user._id, 'yoga.pay', 'yogaBooking', done._id, { amountPaise: done.amountPaise });
  res.json({ booking: done });
}));

bookingRoutes.get('/my-bookings', customers, asyncHandler(async (req, res) => {
  const items = await YogaBooking.find({ user: req.user._id }).populate({ path: 'session', populate: { path: 'coach', select: 'name' } }).sort({ createdAt: -1 }).limit(200);
  const now = new Date();
  res.json({
    cancelBeforeHours: YOGA.cancelBeforeHours,
    items: items.filter((b) => b.session).map((b) => {
      const s = b.session;
      const w = joinWindowFor(s, now);
      const canJoin = b.bookingStatus === 'confirmed' && ['scheduled', 'ongoing'].includes(s.status) && s.meetingLinkStatus === 'ADDED' && w.open;
      const canCancel = b.bookingStatus === 'confirmed' && s.status !== 'completed' && s.startsAt.getTime() - now.getTime() >= YOGA.cancelBeforeHours * 3600 * 1000;
      return { ...b.toObject(), session: view(s, req.user), canJoin, canCancel, linkReady: s.meetingLinkStatus === 'ADDED' };
    }),
  });
}));

bookingRoutes.post('/:id/cancel', customers, asyncHandler(async (req, res) => {
  const b = await YogaBooking.findOne({ _id: oid(req.params.id, 'Booking'), user: req.user._id });
  if (!b) throw new ApiError(404, 'Booking not found');
  const s = await YogaSession.findById(b.session);
  const { reason } = z.object({ reason: z.string().trim().max(300).optional() }).parse(req.body ?? {});
  if (!['pending', 'confirmed'].includes(b.bookingStatus)) throw new ApiError(409, 'This booking is already closed.');
  if (b.bookingStatus === 'confirmed' && s.startsAt.getTime() - Date.now() < YOGA.cancelBeforeHours * 3600 * 1000) throw new ApiError(409, `Bookings can be cancelled up to ${YOGA.cancelBeforeHours} hours before the session.`);
  const done = await cancelBookingRecord(b, { by: req.user._id, reason: reason || 'Cancelled by participant' });
  if (!done) throw new ApiError(409, 'This booking was already cancelled.');
  res.json({ booking: done, refundDue: done.paymentStatus === 'refund_due' });
}));

// Closing the Razorpay window without paying gives the held seat back straight away.
bookingRoutes.post('/:id/payment-failed', customers, asyncHandler(async (req, res) => {
  const b = await YogaBooking.findOne({ _id: oid(req.params.id, 'Booking'), user: req.user._id, bookingStatus: 'pending' });
  if (b) await cancelBookingRecord(b, { by: req.user._id, reason: 'Payment not completed', notify: false });
  res.json({ ok: true });
}));

// Meeting link: only the owner of a confirmed booking, only inside the join window.
bookingRoutes.get('/:id/join', customers, asyncHandler(async (req, res) => {
  const b = await YogaBooking.findOne({ _id: oid(req.params.id, 'Booking'), user: req.user._id });
  if (!b) throw new ApiError(404, 'Booking not found');
  const s = await loadSession(b.session, { link: true });
  if (b.bookingStatus !== 'confirmed') throw new ApiError(403, 'Only confirmed bookings can join.');
  if (s.status === 'cancelled') throw new ApiError(409, 'This session was cancelled.');
  if (s.status === 'awaiting_meeting_link' || (!s.meetingLink && ['scheduled', 'ongoing'].includes(s.status))) throw new ApiError(409, 'The coach has not added the meeting link yet. Please check back shortly.');
  if (!['scheduled', 'ongoing'].includes(s.status)) throw new ApiError(409, 'This session is not live.');
  const w = joinWindowFor(s);
  if (!w.open) throw new ApiError(409, new Date() < w.opensAt ? `Joining opens ${YOGA.joinBeforeMinutes} minutes before the start.` : 'This session has ended.', { opensAt: w.opensAt, closesAt: w.closesAt });
  res.json({ meetingLink: s.meetingLink });
}));

// Admin dashboard: every number has the list behind it, computed the same way.
bookingRoutes.get('/summary/overview', managers, asyncHandler(async (req, res) => {
  const now = new Date();
  const notOver = { $gt: new Date(now.getTime() - 24 * 3600 * 1000) }; // started within a day or later: still relevant
  const pick = (q) => YogaSession.find(q).populate('coach', 'name').sort({ startsAt: 1 }).limit(20).select('title startsAt timezone durationMinutes status meetingLinkStatus coach seatsTaken maxParticipants');
  const [upcoming, completed, bookings, refundDue, awaiting, draftsReady, overdueRaw] = await Promise.all([
    YogaSession.countDocuments({ status: { $in: [...BOOKABLE, 'ongoing'] }, startsAt: { $gt: now } }),
    YogaSession.countDocuments({ status: 'completed' }),
    YogaBooking.countDocuments({ bookingStatus: { $in: ['confirmed', 'completed'] } }),
    YogaBooking.countDocuments({ paymentStatus: 'refund_due' }),
    pick({ status: 'awaiting_meeting_link', startsAt: { $gt: now } }),
    pick({ status: 'draft', meetingLinkStatus: 'ADDED', startsAt: { $gt: now } }),
    pick({ status: { $in: ['scheduled', 'ongoing', 'awaiting_meeting_link'] }, startsAt: { $lte: now, ...notOver } }),
  ]);
  // "Overdue": the scheduled end has passed but nobody closed the session.
  const overdue = overdueRaw.filter((x) => sessionEnd(x) < now);
  res.json({ upcoming, completed, bookings, refundDue, awaitingLink: awaiting.length, awaitingList: awaiting, draftsReadyList: draftsReady, overdueList: overdue });
}));

bookingRoutes.get('/', managers, asyncHandler(async (req, res) => {
  const q = z.object({ session: z.string().optional(), status: z.string().optional(), page: z.coerce.number().int().min(1).default(1) }).parse(req.query);
  const filter = {};
  if (q.session) filter.session = oid(q.session, 'Yoga session');
  if (q.status) filter.bookingStatus = q.status;
  const [items, total] = await Promise.all([
    YogaBooking.find(filter).populate('user', 'name email').populate('session', 'title startsAt timezone status').sort({ createdAt: -1 }).skip((q.page - 1) * 50).limit(50).lean(),
    YogaBooking.countDocuments(filter),
  ]);
  res.json({ items, total, page: q.page, pages: Math.max(1, Math.ceil(total / 50)) });
}));

// ------------------------------------------------------------------ public (no login): what the website advertises
// Only marketing fields. No meeting link, no participant data, no coach contact details.
export const publicYogaRoutes = Router();
publicYogaRoutes.get('/', asyncHandler(async (req, res) => {
  const items = await YogaSession.find({ status: { $in: BOOKABLE }, startsAt: { $gt: new Date() } }).populate('coach', 'name').sort({ startsAt: 1 }).limit(12)
    .select('title description category difficultyLevel startsAt timezone durationMinutes maxParticipants seatsTaken pricePaise coach');
  res.json({ items: items.map((s) => ({ _id: s._id, title: s.title, description: s.description, category: s.category, difficultyLevel: s.difficultyLevel, startsAt: s.startsAt, timezone: s.timezone, durationMinutes: s.durationMinutes, seatsLeft: Math.max(0, s.maxParticipants - s.seatsTaken), pricePaise: s.pricePaise, coachName: s.coach?.name || null })) });
}));
