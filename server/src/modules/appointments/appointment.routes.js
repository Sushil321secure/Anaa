import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Appointment } from './appointment.model.js';
import { isValidSlot, slotsForDate } from './slots.js';
import { consumeConsultation, releaseConsultation } from '../purchases/entitlements.js';
import { User } from '../users/user.model.js';
import { getSetting } from '../settings/settings.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { sendTemplate } from '../mail/mailer.js';
import { audit } from '../audit/audit.model.js';
import { Purchase } from '../purchases/purchase.model.js';
import { onConsultationBooked, onConsultationCancelled, onConsultationCompleted } from '../rewards/service.js';

const router = Router();
const customerOnly = [requireAuth, requireRole('CUSTOMER')];
const dietitianCount = async () => Math.max(1, await User.countDocuments({ role: 'DIETITIAN', isActive: true }));
const populateOpts = [{ path: 'dietitian', select: 'name' }];

// Free times on an IST date: each slot's remaining capacity = dietitians - confirmed bookings.
router.get('/slots', ...customerOnly, asyncHandler(async (req, res) => {
  const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query);
  const cfg = await getSetting('availability');
  const slots = slotsForDate(date, cfg);
  if (!slots.length) return res.json({ date, slotMinutes: cfg.slotMinutes, slots: [] });
  const capacity = await dietitianCount();
  const booked = await Appointment.aggregate([
    { $match: { status: 'CONFIRMED', startsAt: { $gte: slots[0], $lte: slots[slots.length - 1] } } },
    { $group: { _id: '$startsAt', n: { $sum: 1 } } },
  ]);
  const count = new Map(booked.map((b) => [b._id.getTime(), b.n]));
  const mine = new Set((await Appointment.find({ customer: req.user._id, status: 'CONFIRMED', startsAt: { $in: slots } }).select('startsAt').lean()).map((a) => a.startsAt.getTime()));
  res.json({
    date,
    slotMinutes: cfg.slotMinutes,
    slots: slots.map((s) => ({ startsAt: s, available: capacity - (count.get(s.getTime()) || 0) > 0 && !mine.has(s.getTime()) })),
  });
}));

router.get('/fees', asyncHandler(async (req, res) => {
  const f = await getSetting('consultationFees');
  res.json({ onlinePaise: f.onlinePaise, offlinePaise: f.offlinePaise });
}));

router.get('/mine', ...customerOnly, asyncHandler(async (req, res) => {
  const items = await Appointment.find({ customer: req.user._id }).populate(populateOpts).sort({ startsAt: -1 }).limit(100).lean();
  res.json({ items, cancelBeforeHours: (await getSetting('availability')).cancelBeforeHours, callWindow: await getSetting('consultationCall') });
}));

const bookSchema = z.object({ startsAt: z.string().datetime(), mode: z.enum(['ONLINE', 'OFFLINE']).default('ONLINE'), provider: z.enum(['WEBRTC', 'GOOGLE_MEET']).default('WEBRTC'), notes: z.string().trim().max(500).optional() })
  .refine((d) => !(d.provider === 'GOOGLE_MEET' && d.mode !== 'ONLINE'), { message: 'Google Meet is only available for online consultations.', path: ['provider'] });

// Booking uses one consultation from the customer's package. The consume is atomic and is given back if the slot is taken.
router.post('/', ...customerOnly, asyncHandler(async (req, res) => {
  const { startsAt, notes, mode, provider } = bookSchema.parse(req.body);
  const start = new Date(startsAt);
  const now = new Date();
  const cfg = await getSetting('availability');
  if (!isValidSlot(start, cfg, now)) throw new ApiError(400, 'That time is not available. Please choose another slot.');
  if (await Appointment.exists({ customer: req.user._id, startsAt: start, status: 'CONFIRMED' })) throw new ApiError(409, 'You already have an appointment at that time.');

  const purchase = await consumeConsultation(req.user._id, now, mode);
  if (!purchase) throw new ApiError(403, `You have no ${mode.toLowerCase()} consultation available. Pay for one, or buy a wellness package.`);

  const capacity = await dietitianCount();
  let appt = null;
  try {
    for (let slotNo = 1; slotNo <= capacity && !appt; slotNo += 1) {
      try {
        appt = await Appointment.create({ customer: req.user._id, purchase: purchase._id, mode, provider, startsAt: start, durationMinutes: cfg.slotMinutes, slotNo, notes });
      } catch (err) {
        if (err.code !== 11000) throw err; // slot number already used: try the next one
      }
    }
  } catch (err) {
    await releaseConsultation(purchase._id);
    throw err;
  }
  if (!appt) {
    await releaseConsultation(purchase._id);
    throw new ApiError(409, 'That slot was just taken. Please choose another time.');
  }
  sendTemplate(req.user.email, 'appointmentConfirmed', { name: req.user.name, startsAt: start, durationMinutes: cfg.slotMinutes });
  await audit(req.user._id, 'appointment.book', 'appointment', appt._id, { startsAt: start });
  await onConsultationBooked({ userId: req.user._id, appointmentId: appt._id }).catch((err) => console.error('referral update failed', err.message));
  res.status(201).json({ appointment: appt, consultationsRemaining: Math.max(0, purchase.consultationsTotal - purchase.consultationsUsed) });
}));

// Customers can cancel their own upcoming appointment. The consultation is returned only when cancelled early enough.
router.post('/:id/cancel', ...customerOnly, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Appointment not found');
  const cfg = await getSetting('availability');
  const now = new Date();
  const appt = await Appointment.findOne({ _id: req.params.id, customer: req.user._id });
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (appt.status !== 'CONFIRMED' || appt.startsAt <= now) throw new ApiError(400, 'Only upcoming appointments can be cancelled.');
  const early = appt.startsAt.getTime() - now.getTime() >= cfg.cancelBeforeHours * 3600 * 1000;
  const done = await Appointment.findOneAndUpdate(
    { _id: appt._id, status: 'CONFIRMED' },
    { $set: { status: 'CANCELLED', cancelledAt: now, cancelledBy: req.user._id, consultationReturned: early } },
    { new: true },
  );
  if (!done) throw new ApiError(409, 'This appointment was already changed.');
  if (early) await releaseConsultation(appt.purchase);
  await onConsultationCancelled({ userId: req.user._id, appointmentId: appt._id }).catch((err) => console.error('referral update failed', err.message));
  sendTemplate(req.user.email, 'appointmentCancelled', { name: req.user.name, startsAt: appt.startsAt, returned: early });
  await audit(req.user._id, 'appointment.cancel', 'appointment', appt._id, { early });
  res.json({ appointment: done, consultationReturned: early });
}));

// ---------------------------------------------------------------- staff
export const staffAppointments = Router();
const staffRoles = [requireAuth, requireRole('OWNER', 'ADMIN', 'OPERATIONS', 'DIETITIAN')];

staffAppointments.get('/', ...staffRoles, asyncHandler(async (req, res) => {
  const q = z.object({ status: z.string().optional(), from: z.string().datetime().optional(), to: z.string().datetime().optional(), mine: z.string().optional() }).parse(req.query);
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.from || q.to) filter.startsAt = { ...(q.from && { $gte: new Date(q.from) }), ...(q.to && { $lte: new Date(q.to) }) };
  // Dietitians see their own appointments and unassigned ones.
  if (req.user.role === 'DIETITIAN' || q.mine === 'true') filter.$or = [{ dietitian: req.user._id }, { dietitian: null }];
  const items = await Appointment.find(filter).populate([{ path: 'customer', select: 'name email phone' }, ...populateOpts]).sort({ startsAt: 1 }).limit(300).lean();
  res.json({ items, callWindow: await getSetting('consultationCall') });
}));

const patchSchema = z.object({
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  dietitianId: z.string().nullable().optional(),
  staffNotes: z.string().trim().max(1000).optional(),
  meetingUrl: z.string().trim().max(500).url().or(z.literal('')).optional(),
});

staffAppointments.patch('/:id', ...staffRoles, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Appointment not found');
  const data = patchSchema.parse(req.body);
  const appt = await Appointment.findById(req.params.id).populate('customer', 'email name');
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (data.dietitianId !== undefined) {
    if (req.user.role === 'DIETITIAN' && data.dietitianId && data.dietitianId !== String(req.user._id)) throw new ApiError(403, 'Dietitians can only assign themselves.');
    if (data.dietitianId) {
      const d = await User.findOne({ _id: data.dietitianId, role: 'DIETITIAN', isActive: true });
      if (!d) throw new ApiError(400, 'Choose an active dietitian');
    }
    const changed = String(appt.dietitian || '') !== String(data.dietitianId || '');
    appt.dietitian = data.dietitianId || undefined;
    if (changed && data.dietitianId) {
      const d = await User.findById(data.dietitianId).select('name email');
      if (d?.email) sendTemplate(d.email, 'appointmentAssigned', { name: d.name, customerName: appt.customer.name, startsAt: appt.startsAt, durationMinutes: appt.durationMinutes, mode: appt.mode });
    }
  }
  if (data.staffNotes !== undefined) appt.staffNotes = data.staffNotes;
  if (data.meetingUrl !== undefined) appt.meetingUrl = data.meetingUrl;
  const wasConfirmedBefore = ['CONFIRMED', 'IN_PROGRESS'].includes(appt.status);
  if (data.status && data.status !== appt.status) {
    const wasConfirmed = ['CONFIRMED', 'IN_PROGRESS'].includes(appt.status);
    if (data.status === 'CANCELLED') {
      appt.cancelledAt = new Date();
      appt.cancelledBy = req.user._id;
      // A clinic-side cancellation always gives the consultation back.
      if (wasConfirmed && !appt.consultationReturned) {
        await releaseConsultation(appt.purchase);
        appt.consultationReturned = true;
      }
      sendTemplate(appt.customer.email, 'appointmentCancelled', { name: appt.customer.name, startsAt: appt.startsAt, returned: true, byClinic: true });
    }
    appt.status = data.status;
  }
  try {
    await appt.save();
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'That time slot is already taken by another confirmed appointment.');
    throw err;
  }
  await audit(req.user._id, 'appointment.update', 'appointment', appt._id, data);
  if (data.status === 'COMPLETED' && wasConfirmedBefore) {
    // Rewards are decided here, on the backend, from the real state: a COMPLETED appointment that was booked against a PAID package.
    const paid = Boolean(await Purchase.exists({ _id: appt.purchase, status: 'PAID' }));
    await onConsultationCompleted({ appointmentId: appt._id, customerId: appt.customer._id || appt.customer, paid })
      .catch((err) => console.error('reward processing failed', err.message));
  }
  if (data.status === 'CANCELLED') await onConsultationCancelled({ userId: appt.customer._id || appt.customer, appointmentId: appt._id }).catch(() => {});
  res.json({ appointment: appt });
}));

export default router;
