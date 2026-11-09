// One-to-one video consultation: join window, REST access rules, Socket.IO room authorisation and signalling relay,
// against a real MongoDB (own throwaway database) and a real Socket.IO server over a real network port.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_ROOM_MONGO_URI || 'mongodb://127.0.0.1:27017/anaa_test_room';
process.env.JWT_SECRET = 'room-test-secret-room-test-secret-1';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const mongoose = (await import('mongoose')).default;
let dbUp = false;
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  dbUp = true;
} catch {
  console.log('MongoDB not reachable: consultation room tests skipped');
}
const skip = !dbUp;

const http = (await import('node:http')).default;
const { io: ioc } = await import('socket.io-client');
const { createApp } = await import('../src/app.js');
const { attachSignaling } = await import('../src/signaling/index.js');
const { Appointment } = await import('../src/modules/appointments/appointment.model.js');
const { ConsultationSession } = await import('../src/modules/consultations/session.model.js');
const { User } = await import('../src/modules/users/user.model.js');
const { joinWindow } = await import('../src/modules/consultations/window.js');

let server;
let ioServer;
let base;
if (dbUp) {
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  server = http.createServer(createApp());
  ioServer = attachSignaling(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
}
const sockets = [];
after(async () => {
  sockets.forEach((s) => s.close());
  ioServer?.close();
  server?.close();
  if (dbUp) await mongoose.disconnect();
});

function client() {
  let cookie = '';
  const call = async (method, path, body) => {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: { Origin: 'http://localhost:5173', ...(cookie && { Cookie: cookie }), ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), patch: (p, b) => call('PATCH', p, b), cookie: () => cookie };
}
let seq = 0;
async function person(role) {
  const email = `${role.toLowerCase()}${Date.now().toString(36)}${seq++}@room.test`;
  const user = await User.create({ name: `${role} Person`, email, role, passwordHash: await bcrypt.hash('Room@12345', 4), emailVerifiedAt: new Date() });
  const c = client();
  const r = await c.post('/auth/login', { email, password: 'Room@12345' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { c, user };
}
const MIN = 60000;
// An appointment whose start is `offsetMin` minutes from now.
const appt = (customer, dietitian, offsetMin, extra = {}) => Appointment.create({
  customer: customer._id, purchase: new mongoose.Types.ObjectId(), dietitian: dietitian?._id, mode: 'ONLINE',
  startsAt: new Date(Date.now() + offsetMin * MIN), durationMinutes: 45, slotNo: 1 + seq++, ...extra,
});

function connect(auth, headers) {
  const s = ioc(base, { auth, extraHeaders: headers, transports: ['websocket'], reconnection: false, forceNew: true });
  sockets.push(s);
  return s;
}
const connected = (s) => new Promise((res, rej) => { s.once('connect', () => res(s)); s.once('connect_error', rej); });
const emit = (s, ev, payload) => new Promise((res) => s.emit(ev, payload, res));
const next = (s, ev, ms = 3000) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error(`timeout waiting for ${ev}`)), ms);
  s.once(ev, (d) => { clearTimeout(t); res(d); });
});
async function enter(p, a) {
  const t = await p.c.post(`/consultations/${a._id}/token`);
  assert.equal(t.status, 200, JSON.stringify(t.data));
  const s = await connected(connect({ token: t.data.token }));
  return s;
}
const SDP = (type) => ({ type, sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' });

test('join window: opens 10 min before, stays open until end + grace', () => {
  const cfg = { joinBeforeMinutes: 10, graceAfterMinutes: 15 };
  const a = { startsAt: new Date('2030-01-01T10:00:00Z'), durationMinutes: 45 };
  const at = (min) => joinWindow(a, cfg, new Date(a.startsAt.getTime() + min * MIN)).state;
  assert.equal(at(-11), 'EARLY');
  assert.equal(at(-10), 'OPEN');
  assert.equal(at(0), 'OPEN');
  assert.equal(at(45 + 15), 'OPEN');
  assert.equal(at(45 + 16), 'CLOSED');
});

test('REST: participants can see the room, everyone else gets 404; early/cancelled/ended/unassigned are explained and refused', { skip }, async () => {
  const cust = await person('CUSTOMER');
  const other = await person('CUSTOMER');
  const diet = await person('DIETITIAN');
  const otherDiet = await person('DIETITIAN');
  const open = await appt(cust.user, diet.user, 2);

  const c1 = await cust.c.get(`/consultations/${open._id}`);
  assert.equal(c1.status, 200);
  assert.equal(c1.data.role, 'CUSTOMER');
  assert.equal(c1.data.canJoin, true);
  assert.equal(c1.data.peer.name, 'DIETITIAN Person');
  assert.equal(JSON.stringify(c1.data).includes('@room.test'), false, 'no e-mail addresses in the response');
  const d1 = await diet.c.get(`/consultations/${open._id}`);
  assert.equal(d1.data.role, 'DIETITIAN');
  assert.equal(d1.data.canJoin, true);

  assert.equal((await other.c.get(`/consultations/${open._id}`)).status, 404, 'another customer');
  assert.equal((await otherDiet.c.get(`/consultations/${open._id}`)).status, 404, 'an unassigned dietitian');
  assert.equal((await other.c.post(`/consultations/${open._id}/token`)).status, 404);
  assert.equal((await client().get(`/consultations/${open._id}`)).status, 401, 'login required');
  assert.equal((await cust.c.get('/consultations/not-an-id')).status, 404);

  const early = await appt(cust.user, diet.user, 30);
  const e = await cust.c.get(`/consultations/${early._id}`);
  assert.deepEqual([e.data.canJoin, e.data.reason, e.data.window.state], [false, 'TOO_EARLY', 'EARLY']);
  assert.equal((await cust.c.post(`/consultations/${early._id}/token`)).status, 409);

  const ended = await appt(cust.user, diet.user, -90);
  assert.equal((await cust.c.get(`/consultations/${ended._id}`)).data.reason, 'CLOSED');
  assert.equal((await diet.c.post(`/consultations/${ended._id}/token`)).status, 409);

  const cancelled = await appt(cust.user, diet.user, 2, { status: 'CANCELLED' });
  assert.equal((await cust.c.get(`/consultations/${cancelled._id}`)).data.reason, 'CANCELLED');
  const completed = await appt(cust.user, diet.user, 2, { status: 'COMPLETED' });
  assert.equal((await diet.c.post(`/consultations/${completed._id}/token`)).status, 409);

  const noDiet = await appt(cust.user, null, 2);
  assert.equal((await cust.c.get(`/consultations/${noDiet._id}`)).data.reason, 'NO_DIETITIAN');
  const offline = await appt(cust.user, diet.user, 2, { mode: 'OFFLINE' });
  assert.equal((await cust.c.get(`/consultations/${offline._id}`)).data.reason, 'NOT_ONLINE');
});

test('socket: unauthenticated and wrong-purpose connections are refused', { skip }, async () => {
  await assert.rejects(connected(connect({})), /unauthorized/);
  const cust = await person('CUSTOMER');
  const jwt = (await import('jsonwebtoken')).default;
  const wrong = jwt.sign({ sub: String(cust.user._id), role: 'CUSTOMER', purpose: 'something-else' }, process.env.JWT_SECRET);
  await assert.rejects(connected(connect({ token: wrong })), /unauthorized/);
});

test('socket: both participants end up in the same room and can exchange offer, answer and ICE; outsiders cannot join or relay', { skip }, async () => {
  const cust = await person('CUSTOMER');
  const diet = await person('DIETITIAN');
  const intruder = await person('CUSTOMER');
  const otherDiet = await person('DIETITIAN');
  const a = await appt(cust.user, diet.user, 1);

  // Relay before joining is refused
  const sc = await enter(cust, a);
  assert.equal((await emit(sc, 'consultation:offer', { description: SDP('offer') })).code, 'NOT_IN_ROOM');

  // The customer joins first and is told to wait.
  const waiting = next(sc, 'consultation:waiting');
  const j1 = await emit(sc, 'consultation:join', { appointmentId: String(a._id) });
  assert.deepEqual([j1.ok, j1.role, j1.peerPresent, j1.roomId], [true, 'CUSTOMER', false, `consultation_${a._id}`]);
  assert.equal((await waiting).waitingFor, 'DIETITIAN');

  // The dietitian joins the same room: the waiting customer is notified (and would send the offer).
  const sd = await enter(diet, a);
  const joined = next(sc, 'consultation:participant-joined');
  const j2 = await emit(sd, 'consultation:join', { appointmentId: String(a._id) });
  assert.deepEqual([j2.ok, j2.role, j2.peerPresent, j2.roomId], [true, 'DIETITIAN', true, j1.roomId], 'same room');
  const info = await joined;
  assert.equal(info.role, 'DIETITIAN');
  assert.equal(Object.keys(info).sort().join(), 'name,role', 'only role and display name are shared');

  // Offer -> answer -> ICE both ways
  const gotOffer = next(sd, 'consultation:offer');
  assert.equal((await emit(sc, 'consultation:offer', { description: SDP('offer') })).ok, true);
  assert.equal((await gotOffer).description.type, 'offer');
  const gotAnswer = next(sc, 'consultation:answer');
  await emit(sd, 'consultation:answer', { description: SDP('answer') });
  assert.equal((await gotAnswer).description.type, 'answer');
  const cand = { candidate: 'candidate:1 1 udp 2122260223 10.0.0.1 54321 typ host', sdpMid: '0', sdpMLineIndex: 0 };
  const c2d = next(sd, 'consultation:ice-candidate');
  const d2c = next(sc, 'consultation:ice-candidate');
  await emit(sc, 'consultation:ice-candidate', { candidate: cand });
  await emit(sd, 'consultation:ice-candidate', { candidate: cand });
  assert.equal((await c2d).candidate.candidate, cand.candidate);
  assert.equal((await d2c).candidate.candidate, cand.candidate);

  // Payload validation
  assert.equal((await emit(sc, 'consultation:offer', { description: { type: 'answer', sdp: 'x' } })).code, 'BAD_PAYLOAD');
  assert.equal((await emit(sc, 'consultation:offer', { description: { type: 'offer', sdp: 'x'.repeat(40000) } })).code, 'BAD_PAYLOAD');
  assert.equal((await emit(sc, 'consultation:ice-candidate', { candidate: { candidate: 5 } })).code, 'BAD_PAYLOAD');

  // Outsiders: another customer and an unassigned dietitian cannot join, even with a valid token for their own appointment.
  const own = await appt(intruder.user, diet.user, 1);
  const si = await enter(intruder, own);
  assert.equal((await emit(si, 'consultation:join', { appointmentId: String(a._id) })).code, 'FORBIDDEN', 'token is bound to its own appointment');
  const rogue = connect({}, { Cookie: otherDiet.c.cookie() });
  await connected(rogue);
  assert.equal((await emit(rogue, 'consultation:join', { appointmentId: String(a._id) })).code, 'NOT_FOUND');
  const rogue2 = connect({}, { Cookie: intruder.c.cookie() });
  await connected(rogue2);
  assert.equal((await emit(rogue2, 'consultation:join', { appointmentId: String(a._id) })).code, 'NOT_FOUND');
  assert.equal((await emit(rogue2, 'consultation:offer', { description: SDP('offer') })).code, 'NOT_IN_ROOM');

  // Both have been in: the appointment is IN_PROGRESS (not COMPLETED) and a session was recorded.
  assert.equal((await Appointment.findById(a._id)).status, 'IN_PROGRESS');
  const sess = await ConsultationSession.findOne({ appointment: a._id });
  assert.equal(sess.sessionStatus, 'ACTIVE');
  assert.ok(sess.startedAt && sess.customerJoinedAt && sess.dietitianJoinedAt);

  // A customer cannot mark it completed (staff endpoint) and an unrelated customer cannot touch it.
  assert.equal((await cust.c.patch(`/staff/appointments/${a._id}`, { status: 'COMPLETED' })).status, 403);

  // Leaving: the peer is told, the session records the time together; the last to leave ends the session.
  const left = next(sd, 'consultation:participant-left');
  await emit(sc, 'consultation:leave');
  assert.equal((await left).role, 'CUSTOMER');
  await emit(sd, 'consultation:leave');
  await new Promise((r) => setTimeout(r, 150));
  const fin = await ConsultationSession.findOne({ appointment: a._id }).lean();
  assert.equal(fin.sessionStatus, 'ENDED');
  assert.ok(fin.endedAt);
  assert.equal(JSON.stringify(fin).includes('sdp'), false, 'no signalling data stored');
  assert.equal((await Appointment.findById(a._id)).status, 'IN_PROGRESS', 'ending the call does not complete the appointment');

  // The dietitian (not the customer) completes it.
  assert.equal((await diet.c.patch(`/staff/appointments/${a._id}`, { status: 'COMPLETED' })).status, 200);
  assert.equal((await Appointment.findById(a._id)).status, 'COMPLETED');
  assert.equal((await cust.c.post(`/consultations/${a._id}/token`)).status, 409, 'completed consultations cannot be joined');
});

test('assigning a dietitian e-mails them (logged as skipped without SMTP) and only that dietitian can then enter the room', { skip }, async () => {
  const { EmailLog } = await import('../src/modules/mail/emailLog.model.js');
  const owner = await person('OWNER');
  const cust = await person('CUSTOMER');
  const diet = await person('DIETITIAN');
  const a = await appt(cust.user, null, 1);
  assert.equal((await diet.c.get(`/consultations/${a._id}`)).status, 404, 'not assigned yet');
  assert.equal((await owner.c.patch(`/staff/appointments/${a._id}`, { dietitianId: String(diet.user._id) })).status, 200);
  const mail = await EmailLog.findOne({ to: diet.user.email, template: 'appointmentAssigned' });
  assert.ok(mail, 'assignment e-mail was attempted');
  assert.equal((await diet.c.get(`/consultations/${a._id}`)).data.canJoin, true);
});

test('socket: rejoining from a second tab replaces the first; a dropped connection is reported and can be rejoined', { skip }, async () => {
  const cust = await person('CUSTOMER');
  const diet = await person('DIETITIAN');
  const a = await appt(cust.user, diet.user, 1);
  const s1 = await enter(cust, a);
  await emit(s1, 'consultation:join', { appointmentId: String(a._id) });
  const sd = await enter(diet, a);
  await emit(sd, 'consultation:join', { appointmentId: String(a._id) });

  const replaced = next(s1, 'consultation:error');
  const s2 = await enter(cust, a);
  const rejoin = await emit(s2, 'consultation:join', { appointmentId: String(a._id) });
  assert.equal(rejoin.ok, true);
  assert.equal((await replaced).code, 'REPLACED');

  const gone = next(sd, 'consultation:participant-left');
  s2.close();
  assert.equal((await gone).reason, 'disconnected');
  const back = await enter(cust, a);
  const again = next(sd, 'consultation:participant-joined');
  assert.equal((await emit(back, 'consultation:join', { appointmentId: String(a._id) })).peerPresent, true);
  assert.equal((await again).role, 'CUSTOMER');
});
