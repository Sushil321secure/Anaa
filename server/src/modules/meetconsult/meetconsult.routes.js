import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Appointment } from '../appointments/appointment.model.js';
import { resolveAccess, REASON_TEXT } from '../consultations/access.js';
import { JOINABLE_STATUSES, joinWindow } from '../consultations/window.js';
import { getSetting } from '../settings/settings.js';
import { normalizeMeetLink } from '../yoga/meet.js';
import { sendTemplate } from '../mail/mailer.js';
import { audit } from '../audit/audit.model.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

// Google Meet option for one-to-one online consultations. Separate from the in-app (WebRTC) room: nothing here touches
// the consultation room, signalling or STUN. The dietitian pastes a Meet link by hand; the link is never returned by any
// list endpoint, only by /join, and only to the customer or the assigned dietitian of that appointment.
const router = Router();
router.use(requireAuth);

const idOf = (v) => String(v?._id ?? v ?? '');
const oid = (id) => { if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Appointment not found'); return id; };

// Only the assigned dietitian or an owner/admin may add or replace the link. Everyone else is told the appointment does not exist.
router.patch('/:id/link', requireRole('OWNER', 'ADMIN', 'DIETITIAN'), asyncHandler(async (req, res) => {
  const { meetLink } = z.object({ meetLink: z.string().trim().min(1).max(200) }).parse(req.body);
  const appt = await Appointment.findById(oid(req.params.id)).populate([{ path: 'customer', select: 'name email' }, { path: 'dietitian', select: 'name' }]);
  if (!appt) throw new ApiError(404, 'Appointment not found');
  if (req.user.role === 'DIETITIAN' && idOf(appt.dietitian) !== String(req.user._id)) throw new ApiError(404, 'Appointment not found');
  if (appt.provider !== 'GOOGLE_MEET') throw new ApiError(409, 'This consultation uses the in-app video room, not Google Meet.');
  if (appt.mode !== 'ONLINE') throw new ApiError(409, 'Only online consultations can have a Google Meet link.');
  if (!JOINABLE_STATUSES.includes(appt.status)) throw new ApiError(409, `A ${appt.status.toLowerCase().replace('_', ' ')} appointment cannot have a link added.`);
  if (!appt.dietitian) throw new ApiError(409, 'Assign a dietitian to this appointment first.');
  const cfg = await getSetting('consultationCall');
  if (joinWindow(appt, cfg).state === 'CLOSED') throw new ApiError(409, 'This consultation is over, so the link can no longer be changed.');
  const link = normalizeMeetLink(meetLink);
  if (!link) throw new ApiError(400, 'Enter a Google Meet link like https://meet.google.com/abc-defg-hij');

  const updated = appt.meetLinkStatus === 'ADDED';
  appt.meetLink = link;
  appt.meetLinkStatus = 'ADDED';
  appt.meetLinkUpdatedAt = new Date();
  await appt.save();
  await audit(req.user._id, 'consultation.meetLink', 'appointment', appt._id, { updated }); // the link itself is not logged
  // The e-mail names the dietitian and the time, and asks the customer to log in. The link itself is never e-mailed.
  if (appt.customer?.email) sendTemplate(appt.customer.email, 'consultMeetLink', { name: appt.customer.name, dietitianName: appt.dietitian?.name || 'Your dietitian', startsAt: appt.startsAt, durationMinutes: appt.durationMinutes, updated });
  res.json({ appointment: { _id: appt._id, provider: appt.provider, meetLinkStatus: appt.meetLinkStatus, meetLinkUpdatedAt: appt.meetLinkUpdatedAt } });
}));

// The link, for the customer or the assigned dietitian of this appointment, only while joining is allowed.
router.get('/:id/join', asyncHandler(async (req, res) => {
  const a = await resolveAccess(req.user, req.params.id); // 404 for anyone who is not a participant
  if (a.appt.provider !== 'GOOGLE_MEET') throw new ApiError(409, 'This consultation uses the in-app video room, not Google Meet.');
  if (!a.canJoin) throw new ApiError(409, REASON_TEXT[a.reason] || 'You cannot join this consultation now.', { reason: a.reason, opensAt: a.window.opensAt, closesAt: a.window.closesAt });
  const withLink = await Appointment.findById(a.appt._id).select('+meetLink');
  if (!withLink?.meetLink) throw new ApiError(409, a.role === 'CUSTOMER' ? 'Your dietitian has not added the Google Meet link yet. Please check back shortly.' : 'Add the Google Meet link first.', { reason: 'NO_LINK' });
  res.json({ meetingLink: withLink.meetLink });
}));

export default router;
