import { Router } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { resolveAccess, REASON_TEXT } from './access.js';
import { ConsultationSession, roomIdFor } from './session.model.js';

const router = Router();
router.use(requireAuth, rateLimit({ windowMs: 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false }));

export const SOCKET_TOKEN_TTL = '10m';
const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || null;

// Room details for the join screen. No side effects: nothing is recorded until the person actually enters the room.
router.get('/:id', asyncHandler(async (req, res) => {
  const a = await resolveAccess(req.user, req.params.id);
  const session = await ConsultationSession.findOne({ appointment: a.appt._id }).lean();
  res.json({
    appointment: { id: a.appt._id, startsAt: a.appt.startsAt, durationMinutes: a.appt.durationMinutes, status: a.appt.status, mode: a.appt.mode },
    role: a.role,
    you: firstName(req.user.name),
    peer: { name: a.peerName, role: a.role === 'CUSTOMER' ? 'DIETITIAN' : 'CUSTOMER' },
    canJoin: a.canJoin,
    reason: a.reason,
    message: a.reason ? REASON_TEXT[a.reason] : null,
    window: { state: a.window.state, opensAt: a.window.opensAt, closesAt: a.window.closesAt, serverNow: new Date() },
    session: session ? { status: session.sessionStatus, durationSeconds: session.durationSeconds, endedAt: session.endedAt } : null,
  });
}));

// A short-lived token scoped to this one appointment, so the WebSocket does not depend on the cross-site cookie.
router.post('/:id/token', asyncHandler(async (req, res) => {
  const a = await resolveAccess(req.user, req.params.id);
  if (!a.canJoin) throw new ApiError(409, REASON_TEXT[a.reason] || 'You cannot join this consultation now.', { reason: a.reason });
  const token = jwt.sign({ sub: String(req.user._id), role: req.user.role, apt: String(a.appt._id), purpose: 'consultation' }, env.JWT_SECRET, { expiresIn: SOCKET_TOKEN_TTL });
  res.json({ token, roomId: roomIdFor(a.appt._id), role: a.role });
}));

export default router;
