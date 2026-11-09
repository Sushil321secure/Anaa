import mongoose from 'mongoose';
import { Appointment } from '../appointments/appointment.model.js';
import { getSetting } from '../settings/settings.js';
import { ApiError } from '../../utils/http.js';
import { JOINABLE_STATUSES, joinWindow } from './window.js';

const idOf = (v) => String(v?._id ?? v ?? '');

/**
 * The single authorisation decision for a consultation room, used by REST and Socket.IO alike.
 * Never trusts the caller: loads the appointment and checks ownership / assignment itself.
 * Non-participants always get 404 (so appointment ids cannot be probed). Returns canJoin + a reason instead of throwing for
 * "not yet / already over / not joinable" so the UI can explain.
 */
export async function resolveAccess(user, appointmentId, now = new Date()) {
  if (!mongoose.isValidObjectId(appointmentId)) throw new ApiError(404, 'Consultation not found');
  const appt = await Appointment.findById(appointmentId).populate([{ path: 'customer', select: 'name' }, { path: 'dietitian', select: 'name' }]);
  if (!appt) throw new ApiError(404, 'Consultation not found');
  const userId = String(user._id ?? user.sub);
  const role = idOf(appt.customer) === userId ? 'CUSTOMER' : user.role === 'DIETITIAN' && appt.dietitian && idOf(appt.dietitian) === userId ? 'DIETITIAN' : null;
  if (!role) throw new ApiError(404, 'Consultation not found');

  const cfg = await getSetting('consultationCall');
  const window = joinWindow(appt, cfg, now);
  let canJoin = true;
  let reason = null;
  if (appt.mode !== 'ONLINE') { canJoin = false; reason = 'NOT_ONLINE'; }
  else if (appt.status === 'CANCELLED') { canJoin = false; reason = 'CANCELLED'; }
  else if (!JOINABLE_STATUSES.includes(appt.status)) { canJoin = false; reason = 'CLOSED'; }
  else if (!appt.dietitian) { canJoin = false; reason = 'NO_DIETITIAN'; }
  else if (window.state === 'EARLY') { canJoin = false; reason = 'TOO_EARLY'; }
  else if (window.state === 'CLOSED') { canJoin = false; reason = 'CLOSED'; }

  const peerDoc = role === 'CUSTOMER' ? appt.dietitian : appt.customer;
  return { appt, role, canJoin, reason, window, peerName: peerDoc?.name || null, cfg };
}

export const REASON_TEXT = {
  NOT_ONLINE: 'This is an in-clinic appointment, so there is no video room.',
  CANCELLED: 'This consultation was cancelled.',
  CLOSED: 'This consultation is closed.',
  NO_DIETITIAN: 'A dietitian has not been assigned to this consultation yet.',
  TOO_EARLY: 'The consultation room is not open yet.',
};
