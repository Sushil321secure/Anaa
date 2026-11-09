import { Server } from 'socket.io';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { COOKIE_NAME } from '../middleware/auth.js';
import { Appointment } from '../modules/appointments/appointment.model.js';
import { resolveAccess } from '../modules/consultations/access.js';
import { ConsultationSession, roomIdFor } from '../modules/consultations/session.model.js';

/**
 * Signaling gateway for one-to-one video consultations. It only relays offer / answer / ICE between the two authorised
 * people of one appointment; it never sees media. Every room join is re-authorised against the database.
 * Logs carry appointment ids and roles only: never tokens, names, e-mail addresses or health information.
 */
const log = (...a) => { if (env.NODE_ENV !== 'test') console.info('[consult]', ...a); };
// The two people of one appointment know each other's name; nothing else about them is shared over the socket.
const displayName = (n) => String(n || '').trim() || null;
const MAX_SDP = 30000;
const MAX_MSGS_PER_10S = 400;

function validSdp(d) {
  return d && typeof d === 'object' && ['offer', 'answer'].includes(d.type) && typeof d.sdp === 'string' && d.sdp.length > 0 && d.sdp.length <= MAX_SDP;
}
function validCandidate(c) {
  if (c === null) return true; // end-of-candidates marker
  return c && typeof c === 'object' && typeof c.candidate === 'string' && c.candidate.length <= 2000
    && (c.sdpMid == null || typeof c.sdpMid === 'string') && (c.sdpMLineIndex == null || Number.isInteger(c.sdpMLineIndex));
}

export function attachSignaling(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_ORIGIN, credentials: true },
    transports: ['websocket', 'polling'], // websocket first, long-polling as the fallback
    maxHttpBufferSize: 100 * 1024,
    pingInterval: 10000,
    pingTimeout: 12000,
  });

  // Auth: an appointment-scoped token (cross-site deployments) or the login cookie. Both are verified on every handshake.
  io.use((socket, next) => {
    try {
      const t = socket.handshake.auth?.token;
      if (t) {
        const p = jwt.verify(t, env.JWT_SECRET);
        if (p.purpose !== 'consultation') throw new Error('wrong token');
        socket.data = { ...socket.data, userId: p.sub, role: p.role, onlyAppointment: p.apt };
      } else {
        const p = jwt.verify(cookie.parse(socket.handshake.headers.cookie || '')[COOKIE_NAME], env.JWT_SECRET);
        socket.data = { ...socket.data, userId: p.sub, role: p.role };
      }
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  const peersIn = async (room) => (await io.in(room).fetchSockets()).filter((s) => s.data.consultRole);

  async function leaveRoom(socket, reason) {
    const { room, consultRole, appointmentId } = socket.data;
    if (!room) return;
    socket.data.room = undefined;
    socket.data.consultRole = undefined;
    clearTimeout(socket.data.closeTimer);
    socket.leave(room);
    const now = new Date();
    const stillThere = await peersIn(room);
    const peerWasHere = stillThere.some((s) => s.data.consultRole !== consultRole);
    const sess = await ConsultationSession.findOne({ appointment: appointmentId });
    if (sess) {
      sess.set(consultRole === 'CUSTOMER' ? 'customerLeftAt' : 'dietitianLeftAt', now);
      if (peerWasHere && sess.activeSince) {
        sess.durationSeconds += Math.max(0, Math.round((now - sess.activeSince) / 1000));
        sess.activeSince = undefined;
      }
      if (!stillThere.length) { sess.sessionStatus = 'ENDED'; sess.endedAt = now; } else sess.sessionStatus = 'WAITING';
      await sess.save().catch((e) => log('session save failed', e.message));
    }
    socket.to(room).emit('consultation:participant-left', { role: consultRole, reason });
    log('left', appointmentId, consultRole, reason);
  }

  io.on('connection', (socket) => {
    log('socket connected', socket.id, socket.data.role, socket.conn.transport.name);
    const budget = { n: 0, t: Date.now() };
    const allowed = () => {
      if (Date.now() - budget.t > 10000) { budget.n = 0; budget.t = Date.now(); }
      budget.n += 1;
      return budget.n <= MAX_MSGS_PER_10S;
    };
    const fail = (ack, code, message) => {
      if (typeof ack === 'function') ack({ ok: false, code, message });
      else socket.emit('consultation:error', { code, message });
    };

    socket.on('consultation:join', async (payload, ack) => {
      try {
        if (!allowed()) return fail(ack, 'RATE_LIMITED', 'Too many requests.');
        const appointmentId = String(payload?.appointmentId || '');
        if (socket.data.onlyAppointment && socket.data.onlyAppointment !== appointmentId) return fail(ack, 'FORBIDDEN', 'This token is for a different consultation.');
        let a;
        try { a = await resolveAccess({ sub: socket.data.userId, role: socket.data.role }, appointmentId); } catch { return fail(ack, 'NOT_FOUND', 'Consultation not found.'); }
        if (!a.canJoin) return fail(ack, a.reason || 'CLOSED', 'You cannot join this consultation now.');
        const room = roomIdFor(a.appt._id);
        if (socket.data.room === room) {
          return ack?.({ ok: true, role: a.role, roomId: room, peerPresent: (await peersIn(room)).some((s) => s.id !== socket.id), peerName: displayName(a.peerName), closesAt: a.window.closesAt });
        }
        if (socket.data.room) await leaveRoom(socket, 'switched');

        // One live connection per person: a second tab/device replaces the first.
        for (const other of await peersIn(room)) {
          if (other.data.userId === socket.data.userId) {
            other.emit('consultation:error', { code: 'REPLACED', message: 'You joined this consultation from another tab or device.' });
            clearTimeout(other.data.closeTimer);
            other.data.room = undefined;
            other.data.consultRole = undefined;
            other.leave(room);
          }
        }
        const now = new Date();
        const sess = await ConsultationSession.findOneAndUpdate(
          { appointment: a.appt._id },
          { $setOnInsert: { customer: a.appt.customer._id, dietitian: a.appt.dietitian._id, roomId: room } },
          { upsert: true, new: true },
        );
        const peer = (await peersIn(room)).find((s) => s.data.consultRole !== a.role);
        sess.set(a.role === 'CUSTOMER' ? 'customerJoinedAt' : 'dietitianJoinedAt', now);
        sess.joinCount += 1;
        sess.endedAt = undefined;
        if (peer) {
          sess.sessionStatus = 'ACTIVE';
          sess.startedAt ??= now;
          sess.activeSince = now;
        } else sess.sessionStatus = 'WAITING';
        await sess.save();
        if (peer) await Appointment.updateOne({ _id: a.appt._id, status: 'CONFIRMED' }, { $set: { status: 'IN_PROGRESS', startedAt: now } });

        socket.data.room = room;
        socket.data.consultRole = a.role;
        socket.data.appointmentId = String(a.appt._id);
        socket.join(room);
        const ms = Math.min(a.window.closesAt.getTime() - Date.now(), 2 ** 31 - 1);
        socket.data.closeTimer = setTimeout(() => {
          socket.emit('consultation:ended', { reason: 'WINDOW_CLOSED' });
          leaveRoom(socket, 'window-closed').catch(() => {});
        }, Math.max(ms, 0));
        socket.data.closeTimer.unref?.();

        log('join', a.appt._id, a.role, peer ? 'peer-present' : 'alone');
        ack?.({ ok: true, role: a.role, roomId: room, peerPresent: Boolean(peer), peerName: displayName(a.peerName), closesAt: a.window.closesAt });
        // The person already waiting in the room is the one who sends the offer.
        socket.to(room).emit('consultation:participant-joined', { role: a.role, name: displayName(a.role === 'CUSTOMER' ? a.appt.customer.name : a.appt.dietitian.name) });
        if (!peer) socket.emit('consultation:waiting', { waitingFor: a.role === 'CUSTOMER' ? 'DIETITIAN' : 'CUSTOMER' });
      } catch (err) {
        log('join error', err.message);
        fail(ack, 'SERVER_ERROR', 'Could not join the consultation.');
      }
    });

    // Relays: only to the other member of the same authorised room, with strict payload validation.
    const relay = (event, valid, build) => socket.on(event, (payload, ack) => {
      const room = socket.data.room;
      if (!room) return fail(ack, 'NOT_IN_ROOM', 'Join the consultation first.');
      if (!allowed()) return fail(ack, 'RATE_LIMITED', 'Too many requests.');
      if (!valid(payload)) return fail(ack, 'BAD_PAYLOAD', 'Invalid message.');
      socket.to(room).emit(event, build(payload));
      ack?.({ ok: true });
    });
    relay('consultation:offer', (p) => validSdp(p?.description) && p.description.type === 'offer', (p) => ({ description: { type: 'offer', sdp: p.description.sdp }, restart: Boolean(p.restart) }));
    relay('consultation:answer', (p) => validSdp(p?.description) && p.description.type === 'answer', (p) => ({ description: { type: 'answer', sdp: p.description.sdp } }));
    relay('consultation:ice-candidate', (p) => validCandidate(p?.candidate), (p) => ({ candidate: p.candidate }));
    relay('consultation:reject', () => true, (p) => ({ reason: String(p?.reason || '').slice(0, 100) }));
    relay('consultation:reconnect', () => true, () => ({}));
    relay('consultation:media-state', (p) => typeof p?.audio === 'boolean' && typeof p?.video === 'boolean', (p) => ({ audio: p.audio, video: p.video }));

    socket.on('consultation:leave', async (_p, ack) => { await leaveRoom(socket, 'left'); ack?.({ ok: true }); });
    socket.on('disconnect', (why) => { log('socket disconnected', socket.id, why); leaveRoom(socket, 'disconnected').catch(() => {}); });
  });
  return io;
}
