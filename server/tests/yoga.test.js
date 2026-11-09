// Group yoga sessions (Google Meet link workflow): sessions, roles, link security, booking, payment, capacity, reminders.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_YOGA_MONGO_URI || 'mongodb://127.0.0.1:27017/anaa_test_yoga';
process.env.JWT_SECRET = 'yoga-test-secret-yoga-test-secret-1';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.RAZORPAY_MOCK = 'true';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret_for_tests';

const mongoose = (await import('mongoose')).default;
let dbUp = false;
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  dbUp = true;
} catch {
  console.log('MongoDB not reachable: yoga tests skipped');
}
const skip = !dbUp;

const { createApp } = await import('../src/app.js');
const { User } = await import('../src/modules/users/user.model.js');
const { YogaSession, YogaBooking } = await import('../src/modules/yoga/yoga.model.js');
const { runYogaMaintenance } = await import('../src/modules/yoga/yoga.service.js');
const { normalizeMeetLink } = await import('../src/modules/yoga/meet.js');
const { zonedToUtc } = await import('../src/modules/yoga/time.js');
const { EmailLog } = await import('../src/modules/mail/emailLog.model.js');

let server;
let base;
if (dbUp) {
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
}
after(async () => { server?.close(); if (dbUp) await mongoose.disconnect(); });

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
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), put: (p, b) => call('PUT', p, b), patch: (p, b) => call('PATCH', p, b) };
}
let seq = 0;
async function person(role) {
  const email = `${role.toLowerCase()}${Date.now().toString(36)}${seq++}@yoga.test`;
  const user = await User.create({ name: `${role} ${seq}`, email, role, passwordHash: await bcrypt.hash('Yoga@12345', 4), emailVerifiedAt: new Date() });
  const c = client();
  assert.equal((await c.post('/auth/login', { email, password: 'Yoga@12345' })).status, 200);
  return { c, user };
}
const MIN = 60000;
const LINK = 'https://meet.google.com/abc-defg-hij';
// A session body in UTC wall-clock time, starting `inMin` minutes from now (minute precision).
function body(coach, inMin, extra = {}) {
  const iso = new Date(Math.ceil((Date.now() + inMin * MIN) / MIN) * MIN).toISOString();
  return { title: 'Morning Flow', description: 'Gentle vinyasa', coachId: String(coach._id), category: 'Vinyasa', difficultyLevel: 'BEGINNER', sessionDate: iso.slice(0, 10), startTime: iso.slice(11, 16), timezone: 'UTC', durationMinutes: 45, maxParticipants: 10, pricePaise: 0, ...extra };
}
// Straight into the database, for states the API (rightly) refuses to create, such as a session that has already started.
const direct = (coach, startsInMin, extra = {}) => YogaSession.create({ title: 'Direct', coach: coach._id, sessionDate: '2026-01-01', startTime: '10:00', timezone: 'UTC', startsAt: new Date(Date.now() + startsInMin * MIN), durationMinutes: 45, maxParticipants: 10, status: 'scheduled', meetingLink: LINK, meetingLinkStatus: 'ADDED', ...extra });
const sign = (orderId, paymentId) => crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
async function published(admin, coach, inMin, extra = {}, withLink = true) {
  const r = await admin.c.post('/yoga-sessions', body(coach.user, inMin, extra));
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const id = r.data.session._id;
  assert.equal((await admin.c.patch(`/yoga-sessions/${id}/status`, { action: 'publish' })).status, 200);
  if (withLink) assert.equal((await admin.c.patch(`/yoga-sessions/${id}/meeting-link`, { meetingLink: LINK })).status, 200);
  return id;
}

test('Google Meet link validation accepts only real meeting rooms', () => {
  assert.equal(normalizeMeetLink(' https://meet.google.com/abc-defg-hij?authuser=0 '), LINK);
  for (const bad of ['http://meet.google.com/abc-defg-hij', 'https://meet.google.com.evil.com/abc-defg-hij', 'https://evil.com/abc-defg-hij', 'https://meet.google.com/', 'https://meet.google.com/abcd-efgh-ijk', 'https://zoom.us/j/123', 'javascript:alert(1)', 'https://user@meet.google.com/abc-defg-hij', 'not a url', 'https://meet.google.com/abc-defg-hij/extra'])
    assert.equal(normalizeMeetLink(bad), null, bad);
});

test('wall-clock time in a zone converts to the right UTC instant', () => {
  assert.equal(zonedToUtc('2026-12-01', '18:30', 'Asia/Kolkata').toISOString(), '2026-12-01T13:00:00.000Z');
  assert.equal(zonedToUtc('2026-07-01', '09:00', 'America/New_York').toISOString(), '2026-07-01T13:00:00.000Z'); // EDT
  assert.equal(zonedToUtc('2026-12-01', '09:00', 'America/New_York').toISOString(), '2026-12-01T14:00:00.000Z'); // EST
  assert.equal(zonedToUtc('2026-03-08', '02:30', 'America/New_York'), null, 'a time skipped by DST does not exist');
  assert.equal(zonedToUtc('2026-02-31', '10:00', 'UTC'), null);
});

test('admin creates, edits and publishes; only admins may; warnings and validation', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const cust = await person('CUSTOMER');
  assert.equal((await cust.c.post('/yoga-sessions', body(coach.user, 120))).status, 403);
  assert.equal((await coach.c.post('/yoga-sessions', body(coach.user, 120))).status, 403, 'a coach cannot create sessions');
  assert.equal((await client().post('/yoga-sessions', body(coach.user, 120))).status, 401);

  const r = await admin.c.post('/yoga-sessions', body(coach.user, 120, { durationMinutes: 90 }));
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.session.status, 'draft');
  assert.match(r.data.warnings[0], /60 minutes/);
  assert.equal(JSON.stringify(r.data).includes('meet.google.com'), false);
  assert.equal((await admin.c.post('/yoga-sessions', body(coach.user, 120, { maxParticipants: 101 }))).status, 400, 'above the Google Meet limit');
  assert.equal((await admin.c.post('/yoga-sessions', body(coach.user, -30))).status, 400, 'must be in the future');
  assert.equal((await admin.c.post('/yoga-sessions', body(cust.user, 120))).status, 400, 'coach must be a dietitian account');
  assert.equal((await admin.c.post('/yoga-sessions', body(coach.user, 120, { timezone: 'Mars/Base' }))).status, 400);

  // drafts are invisible to participants
  assert.equal((await cust.c.get('/yoga-sessions')).data.items.length, 0);
  assert.equal((await cust.c.get(`/yoga-sessions/${r.data.session._id}`)).status, 404);
  const pub = await admin.c.patch(`/yoga-sessions/${r.data.session._id}/status`, { action: 'publish' });
  assert.equal(pub.data.session.status, 'awaiting_meeting_link');
  assert.equal((await cust.c.get('/yoga-sessions')).data.items.length, 1);

  const upd = await admin.c.put(`/yoga-sessions/${r.data.session._id}`, body(coach.user, 120, { title: 'Evening Flow', durationMinutes: 60 }));
  assert.equal(upd.data.session.title, 'Evening Flow');
  assert.deepEqual(upd.data.warnings, []);
});

test('meeting link: only the assigned coach or an admin; never in participant or list responses', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const otherCoach = await person('DIETITIAN');
  const cust = await person('CUSTOMER');
  const id = await published(admin, coach, 180, {}, false);

  assert.equal((await otherCoach.c.patch(`/yoga-sessions/${id}/meeting-link`, { meetingLink: LINK })).status, 404, 'not their session');
  assert.equal((await cust.c.patch(`/yoga-sessions/${id}/meeting-link`, { meetingLink: LINK })).status, 403);
  assert.equal((await coach.c.patch(`/yoga-sessions/${id}/meeting-link`, { meetingLink: 'https://evil.com/abc-defg-hij' })).status, 400);
  const ok = await coach.c.patch(`/yoga-sessions/${id}/meeting-link`, { meetingLink: `${LINK}?authuser=1` });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.session.status, 'scheduled', 'adding the link makes it scheduled');
  assert.equal(ok.data.session.meetingLinkStatus, 'ADDED');
  assert.equal(JSON.stringify(ok.data).includes('meet.google.com'), false, 'the link is not echoed back');
  assert.equal((await YogaSession.findById(id).select('+meetingLink')).meetingLink, LINK, 'stored without the query string');

  for (const [who, path] of [[cust, `/yoga-sessions/${id}`], [cust, '/yoga-sessions'], [coach, `/yoga-sessions/${id}`], [coach, '/yoga-sessions'], [admin, `/yoga-sessions/${id}`], [admin, '/yoga-sessions']]) {
    assert.equal(JSON.stringify((await who.c.get(path)).data).includes('meet.google.com'), false, `link leaked in GET ${path}`);
  }
  assert.equal((await cust.c.get(`/yoga-sessions/${id}`)).data.session.meetingLinkStatus, undefined, 'participants do not even learn link status');
  assert.equal((await otherCoach.c.get(`/yoga-sessions/${id}`)).status, 404);
  assert.equal((await otherCoach.c.get('/yoga-sessions')).data.items.length, 0, 'a coach only lists their own');
  assert.equal((await otherCoach.c.get(`/yoga-sessions/${id}/join`)).status, 404);
  assert.equal((await coach.c.get(`/yoga-sessions/${id}/join`)).data.meetingLink, LINK);
});

test('free booking: confirm, duplicate refused, capacity enforced, booking window enforced', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const [a, b, c] = [await person('CUSTOMER'), await person('CUSTOMER'), await person('CUSTOMER')];
  const id = await published(admin, coach, 300, { maxParticipants: 2 });
  const first = await a.c.post(`/yoga-sessions/${id}/book`);
  assert.equal(first.status, 201);
  assert.equal(first.data.confirmed, true);
  assert.match(first.data.booking.bookingReference, /^YG-/);
  assert.equal((await a.c.post(`/yoga-sessions/${id}/book`)).status, 409, 'duplicate');
  assert.equal((await b.c.post(`/yoga-sessions/${id}/book`)).status, 201);
  assert.equal((await c.c.post(`/yoga-sessions/${id}/book`)).status, 409, 'full');
  assert.equal((await YogaSession.findById(id)).seatsTaken, 2);
  assert.equal((await admin.c.post(`/yoga-sessions/${id}/book`)).status, 403, 'only customers book');
  const mail = await EmailLog.findOne({ to: a.user.email, template: 'yogaBookingConfirmed' });
  assert.ok(mail, 'confirmation e-mail attempted');
  assert.equal((await a.c.get('/yoga-sessions')).data.items.find((x) => x._id === id).myBooking, 'confirmed');

  const later = await published(admin, coach, 600, { bookingOpensAt: new Date(Date.now() + 120 * MIN).toISOString() });
  assert.equal((await a.c.post(`/yoga-sessions/${later}/book`)).status, 409, 'booking not open yet');
  const draft = await admin.c.post('/yoga-sessions', body(coach.user, 600));
  assert.equal((await a.c.post(`/yoga-sessions/${draft.data.session._id}/book`)).status, 404, 'cannot book a draft');
});

test('concurrent bookings never exceed capacity', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const people = await Promise.all(Array.from({ length: 12 }, () => person('CUSTOMER')));
  const id = await published(admin, coach, 400, { maxParticipants: 3 });
  const results = await Promise.all(people.map((p) => p.c.post(`/yoga-sessions/${id}/book`)));
  assert.equal(results.filter((r) => r.status === 201).length, 3);
  assert.equal(results.filter((r) => r.status === 409).length, 9);
  assert.equal(await YogaBooking.countDocuments({ session: id, bookingStatus: 'confirmed' }), 3);
  assert.equal((await YogaSession.findById(id)).seatsTaken, 3);
  // same person double-clicking
  const id2 = await published(admin, coach, 410, { maxParticipants: 5 });
  const twin = await Promise.all([people[0].c.post(`/yoga-sessions/${id2}/book`), people[0].c.post(`/yoga-sessions/${id2}/book`), people[0].c.post(`/yoga-sessions/${id2}/book`)]);
  assert.equal(twin.filter((r) => r.status === 201).length, 1);
  assert.equal((await YogaSession.findById(id2)).seatsTaken, 1, 'duplicate attempts give their seat back');
});

test('paid booking: seat held, confirmed only after a verified signature; forged, retried and abandoned payments handled', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const cust = await person('CUSTOMER');
  const other = await person('CUSTOMER');
  const id = await published(admin, coach, 500, { pricePaise: 49900, maxParticipants: 1 });

  const start = await cust.c.post(`/yoga-sessions/${id}/book`, { amountPaise: 1 });
  assert.equal(start.status, 201);
  assert.equal(start.data.confirmed, false);
  assert.equal(start.data.checkout.amountPaise, 49900, 'price comes from the database, not the browser');
  assert.equal((await YogaSession.findById(id)).seatsTaken, 1, 'seat is held while paying');
  assert.equal((await other.c.post(`/yoga-sessions/${id}/book`)).status, 409, 'a held seat is not available to others');

  const orderId = start.data.checkout.orderId;
  const forged = await cust.c.post('/yoga-bookings/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'f'.repeat(64) });
  assert.equal(forged.status, 400);
  assert.equal((await YogaBooking.findById(start.data.booking._id)).bookingStatus, 'pending', 'forged payment confirms nothing');
  assert.equal((await other.c.post('/yoga-bookings/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_1', razorpay_signature: sign(orderId, 'pay_1') })).status, 404, "someone else's order");

  const good = await cust.c.post('/yoga-bookings/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_1', razorpay_signature: sign(orderId, 'pay_1') });
  assert.equal(good.status, 200);
  assert.equal(good.data.booking.bookingStatus, 'confirmed');
  assert.equal(good.data.booking.paymentStatus, 'paid');
  assert.equal((await cust.c.post('/yoga-bookings/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_1', razorpay_signature: sign(orderId, 'pay_1') })).status, 200, 'retry is idempotent');
  assert.equal((await YogaSession.findById(id)).seatsTaken, 1);
  assert.ok(await EmailLog.findOne({ to: cust.user.email, template: 'yogaBookingConfirmed' }));

  // abandoned checkout releases the seat at once; an expired hold is released by maintenance
  const id2 = await published(admin, coach, 510, { pricePaise: 20000, maxParticipants: 1 });
  const s2 = await other.c.post(`/yoga-sessions/${id2}/book`);
  assert.equal((await other.c.post(`/yoga-bookings/${s2.data.booking._id}/payment-failed`)).status, 200);
  assert.equal((await YogaSession.findById(id2)).seatsTaken, 0);
  const s3 = await other.c.post(`/yoga-sessions/${id2}/book`);
  assert.equal(s3.status, 201);
  await YogaBooking.updateOne({ _id: s3.data.booking._id }, { $set: { holdExpiresAt: new Date(Date.now() - MIN) } });
  assert.equal((await runYogaMaintenance()).released, 1);
  assert.equal((await YogaSession.findById(id2)).seatsTaken, 0);
  // paying after the hold expired but with a seat still free recovers the booking
  const late = await other.c.post('/yoga-bookings/verify', { razorpay_order_id: s3.data.checkout.orderId, razorpay_payment_id: 'pay_2', razorpay_signature: sign(s3.data.checkout.orderId, 'pay_2') });
  assert.equal(late.status, 200);
  assert.equal(late.data.booking.bookingStatus, 'confirmed');
});

test('join: only a confirmed booking, only inside the window, only when a link exists', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const cust = await person('CUSTOMER');
  const stranger = await person('CUSTOMER');
  const soon = await direct(coach.user, 10);          // inside the 15 min window
  const far = await direct(coach.user, 120);          // window not open
  const over = await direct(coach.user, -90);         // ended
  const noLink = await direct(coach.user, 10, { meetingLink: undefined, meetingLinkStatus: 'MISSING', status: 'awaiting_meeting_link' });
  const mk = (s, extra = {}) => YogaBooking.create({ user: cust.user._id, session: s._id, bookingReference: `YG-T-${crypto.randomBytes(3).toString('hex')}`, bookingStatus: 'confirmed', bookedAt: new Date(), ...extra });
  const [bSoon, bFar, bOver, bNoLink] = [await mk(soon), await mk(far), await mk(over), await mk(noLink)];

  const ok = await cust.c.get(`/yoga-bookings/${bSoon._id}/join`);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.meetingLink, LINK);
  assert.equal((await stranger.c.get(`/yoga-bookings/${bSoon._id}/join`)).status, 404, "another person's booking");
  assert.equal((await client().get(`/yoga-bookings/${bSoon._id}/join`)).status, 401);
  assert.equal((await coach.c.get(`/yoga-bookings/${bSoon._id}/join`)).status, 403, 'staff use the staff join');
  const early = await cust.c.get(`/yoga-bookings/${bFar._id}/join`);
  assert.equal(early.status, 409);
  assert.equal(JSON.stringify(early.data).includes('meet.google.com'), false);
  assert.equal((await cust.c.get(`/yoga-bookings/${bOver._id}/join`)).status, 409, 'after the end');
  assert.match((await cust.c.get(`/yoga-bookings/${bNoLink._id}/join`)).data.message, /not added the meeting link/);
  // cancelled or pending bookings cannot join
  await YogaBooking.updateOne({ _id: bSoon._id }, { $set: { bookingStatus: 'cancelled' } });
  assert.equal((await cust.c.get(`/yoga-bookings/${bSoon._id}/join`)).status, 403);
  await YogaBooking.updateOne({ _id: bSoon._id }, { $set: { bookingStatus: 'pending' } });
  assert.equal((await cust.c.get(`/yoga-bookings/${bSoon._id}/join`)).status, 403);
  await YogaBooking.updateOne({ _id: bSoon._id }, { $set: { bookingStatus: 'confirmed' } });
  // a cancelled session cannot be joined
  await YogaSession.updateOne({ _id: soon._id }, { $set: { status: 'cancelled' } });
  assert.equal((await cust.c.get(`/yoga-bookings/${bSoon._id}/join`)).status, 409);

  const mine = await cust.c.get('/yoga-bookings/my-bookings');
  assert.equal(JSON.stringify(mine.data).includes('meet.google.com'), false, 'my-bookings never carries the link');
  assert.equal(mine.data.items.find((b) => b._id === String(bFar._id)).canJoin, false);
  assert.ok(admin);
});

test('coach lifecycle: start, participants, attendance, complete; outsiders refused', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const other = await person('DIETITIAN');
  const [a, b] = [await person('CUSTOMER'), await person('CUSTOMER')];
  const id = await published(admin, coach, 400);
  await a.c.post(`/yoga-sessions/${id}/book`);
  await b.c.post(`/yoga-sessions/${id}/book`);
  assert.equal((await coach.c.patch(`/yoga-sessions/${id}/status`, { action: 'cancel' })).status, 403, 'a coach cannot cancel');
  assert.equal((await a.c.get(`/yoga-sessions/${id}/participants`)).status, 403);
  assert.equal((await other.c.get(`/yoga-sessions/${id}/participants`)).status, 404);
  const list = await coach.c.get(`/yoga-sessions/${id}/participants`);
  assert.equal(list.data.items.length, 2);
  assert.equal((await coach.c.post(`/yoga-sessions/${id}/attendance`, { entries: [{ bookingId: list.data.items[0]._id, status: 'present' }] })).status, 409, 'not started yet');
  assert.equal((await coach.c.patch(`/yoga-sessions/${id}/status`, { action: 'complete' })).status, 409, 'cannot complete before the start time');

  // move the session into the past so it can run
  await YogaSession.updateOne({ _id: id }, { $set: { startsAt: new Date(Date.now() - 10 * MIN) } });
  assert.equal((await coach.c.patch(`/yoga-sessions/${id}/status`, { action: 'start' })).data.session.status, 'ongoing');
  const att = await coach.c.post(`/yoga-sessions/${id}/attendance`, { entries: [{ bookingId: list.data.items[0]._id, status: 'present' }, { bookingId: list.data.items[1]._id, status: 'absent' }] });
  assert.equal(att.data.updated, 2);
  assert.equal((await other.c.post(`/yoga-sessions/${id}/attendance`, { entries: [{ bookingId: list.data.items[0]._id, status: 'absent' }] })).status, 404);
  assert.equal((await coach.c.patch(`/yoga-sessions/${id}/status`, { action: 'complete' })).data.session.status, 'completed');
  const after = await admin.c.get('/yoga-bookings');
  assert.deepEqual(after.data.items.filter((x) => String(x.session._id) === id).map((x) => `${x.bookingStatus}/${x.attendance}`).sort(), ['completed/absent', 'completed/present']);
  assert.equal((await coach.c.patch(`/yoga-sessions/${id}/meeting-link`, { meetingLink: LINK })).status, 409, 'link frozen after completion');
  assert.equal((await a.c.get('/yoga-bookings')).status, 403, 'participants cannot list all bookings');
  assert.equal((await admin.c.get('/yoga-bookings/summary/overview')).data.completed, 1);
});

test('participant cancellation follows the policy; admin cancellation cancels everyone and flags refunds', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const [a, b, c] = [await person('CUSTOMER'), await person('CUSTOMER'), await person('CUSTOMER')];
  const id = await published(admin, coach, 3 * 60); // 3 h away: inside the 12 h cut-off
  const book = await a.c.post(`/yoga-sessions/${id}/book`);
  const refused = await a.c.post(`/yoga-bookings/${book.data.booking._id}/cancel`, {});
  assert.equal(refused.status, 409);
  assert.match(refused.data.message, /12 hours/);

  const id2 = await published(admin, coach, 3 * 24 * 60, { pricePaise: 30000, maxParticipants: 5 });
  const p = await b.c.post(`/yoga-sessions/${id2}/book`);
  const oid2 = p.data.checkout.orderId;
  await b.c.post('/yoga-bookings/verify', { razorpay_order_id: oid2, razorpay_payment_id: 'pay_9', razorpay_signature: sign(oid2, 'pay_9') });
  await c.c.post(`/yoga-sessions/${id2}/book`); // still pending payment
  assert.equal((await a.c.post(`/yoga-bookings/${p.data.booking._id}/cancel`, {})).status, 404, "not someone else's booking");
  const cancelled = await b.c.post(`/yoga-bookings/${p.data.booking._id}/cancel`, { reason: 'Travelling' });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.refundDue, true, 'paid cancellation is flagged for a refund');
  assert.equal((await YogaSession.findById(id2)).seatsTaken, 1, 'seat returned (the other is still held)');
  assert.equal((await b.c.post(`/yoga-bookings/${p.data.booking._id}/cancel`, {})).status, 409, 'cannot cancel twice');
  assert.equal((await b.c.post(`/yoga-sessions/${id2}/book`)).status, 201, 'can rebook after cancelling');

  const full = await admin.c.patch(`/yoga-sessions/${id}/status`, { action: 'cancel', reason: 'Coach unwell' });
  assert.equal(full.data.session.status, 'cancelled');
  assert.equal((await YogaBooking.findById(book.data.booking._id)).bookingStatus, 'cancelled');
  assert.ok(await EmailLog.findOne({ to: a.user.email, template: 'yogaCancelled' }));
  assert.equal((await a.c.post(`/yoga-sessions/${id}/book`)).status, 409, 'cannot book a cancelled session');
  const paidCancel = await admin.c.patch(`/yoga-sessions/${id2}/status`, { action: 'cancel', reason: 'Venue issue' });
  assert.equal(paidCancel.status, 200);
  assert.equal((await admin.c.get('/yoga-bookings/summary/overview')).data.refundDue >= 1, true);
});

test('rescheduling notifies booked participants and resets reminders; capacity cannot drop below bookings', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const [a, b] = [await person('CUSTOMER'), await person('CUSTOMER')];
  const id = await published(admin, coach, 2 * 24 * 60);
  await a.c.post(`/yoga-sessions/${id}/book`);
  await b.c.post(`/yoga-sessions/${id}/book`);
  assert.equal((await admin.c.put(`/yoga-sessions/${id}`, body(coach.user, 2 * 24 * 60, { maxParticipants: 1 }))).status, 400);
  const moved = await admin.c.put(`/yoga-sessions/${id}`, body(coach.user, 3 * 24 * 60));
  assert.equal(moved.status, 200);
  assert.equal(moved.data.notified, true);
  assert.ok(await EmailLog.findOne({ to: a.user.email, template: 'yogaRescheduled' }));
  assert.ok(await EmailLog.findOne({ to: b.user.email, template: 'yogaRescheduled' }));
  const unchanged = await admin.c.put(`/yoga-sessions/${id}`, { ...body(coach.user, 0), sessionDate: moved.data.session.sessionDate, startTime: moved.data.session.startTime, title: 'Renamed' });
  assert.equal(unchanged.data.notified, false, 'no e-mail when only the title changes');
});

test('reminders: 24 h and 15 min, each sent once, never to late bookers or cancelled bookings', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const [early, late, gone] = [await person('CUSTOMER'), await person('CUSTOMER'), await person('CUSTOMER')];
  const id = await published(admin, coach, 20 * 60); // 20 h away
  await early.c.post(`/yoga-sessions/${id}/book`);
  await YogaBooking.updateOne({ user: early.user._id, session: id }, { $set: { bookedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000) } }); // booked days ago
  await late.c.post(`/yoga-sessions/${id}/book`); // booked just now: inside the 24 h window
  const g = await gone.c.post(`/yoga-sessions/${id}/book`);
  await gone.c.post(`/yoga-bookings/${g.data.booking._id}/cancel`, {}).catch(() => {});
  await YogaBooking.updateOne({ _id: g.data.booking._id }, { $set: { bookingStatus: 'cancelled' } });

  const first = await runYogaMaintenance();
  assert.equal(first.reminders24, 1, 'only the early booker gets the 24 h reminder');
  assert.equal((await runYogaMaintenance()).reminders24, 0, 'not sent twice');
  assert.equal(await EmailLog.countDocuments({ to: early.user.email, template: 'yogaReminder' }), 1);
  assert.equal(await EmailLog.countDocuments({ to: late.user.email, template: 'yogaReminder' }), 0);
  assert.equal(await EmailLog.countDocuments({ to: gone.user.email, template: 'yogaReminder' }), 0);

  await YogaSession.updateOne({ _id: id }, { $set: { startsAt: new Date(Date.now() + 10 * MIN) } });
  const soon = await runYogaMaintenance();
  assert.equal(soon.reminders15, 2, 'both confirmed participants get the 15 minute reminder');
  assert.equal((await runYogaMaintenance()).reminders15, 0);
  const mail = await EmailLog.findOne({ to: early.user.email, template: 'yogaReminder' }).sort('-createdAt');
  assert.ok(mail);
});

test('e-mails carry the details but never the meeting link', async () => {
  const { templates } = await import('../src/modules/mail/templates.js');
  const d = { name: 'Asha', title: 'Morning Flow', coachName: 'Ravi', startsAt: new Date('2026-12-01T13:00:00Z'), timezone: 'Asia/Kolkata', durationMinutes: 45, bookingReference: 'YG-ABC', lead: '15m', amountPaise: 49900 };
  for (const name of ['yogaBookingConfirmed', 'yogaReminder', 'yogaCancelled', 'yogaRescheduled']) {
    const m = templates[name](d);
    const all = `${m.subject} ${m.text} ${m.html}`;
    assert.equal(all.includes('meet.google.com'), false, name);
    for (const must of ['Morning Flow', 'Ravi', 'YG-ABC', '45']) assert.ok(all.includes(must), `${name} lacks ${must}`);
  }
  assert.match(templates.yogaBookingConfirmed(d).text, /Asia\/Kolkata/);
  assert.match(templates.yogaBookingConfirmed({ ...d, name: '<script>x</script>' }).html, /&lt;script&gt;/, 'escaped');
});

test('public advertising endpoint needs no login, lists only bookable sessions and never leaks links or private fields', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const open = await published(admin, coach, 700, { title: 'Public Flow', pricePaise: 25000 });
  const draft = await admin.c.post('/yoga-sessions', body(coach.user, 700, { title: 'Hidden Draft' }));
  const done = await direct(coach.user, -120, { title: 'Past One', status: 'completed' });
  const r = await client().get('/yoga-public');
  assert.equal(r.status, 200);
  const titles = r.data.items.map((s) => s.title);
  assert.ok(titles.includes('Public Flow'));
  assert.ok(!titles.includes('Hidden Draft') && !titles.includes('Past One'), 'drafts and past sessions are not advertised');
  const s = r.data.items.find((x) => x.title === 'Public Flow');
  assert.equal(s.pricePaise, 25000);
  const raw = JSON.stringify(r.data);
  for (const bad of ['meet.google.com', 'meetingLink', 'email', 'coachNotes', 'createdBy']) assert.equal(raw.includes(bad), false, bad);
  assert.ok(open && draft && done);
});

test('fixes: coach edits own details, admin edits a started session, host can open a draft link, dashboard counts match their lists', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const other = await person('DIETITIAN');
  const cust = await person('CUSTOMER');

  // coach edits descriptive details of their own session only; times/price/seats stay admin-only
  const mine = await admin.c.post('/yoga-sessions', body(coach.user, 300));
  const id = mine.data.session._id;
  const det = await coach.c.patch(`/yoga-sessions/${id}/details`, { title: 'Sunrise Flow', description: 'Updated by coach', category: 'Yin', difficultyLevel: 'BEGINNER' });
  assert.equal(det.status, 200);
  assert.equal(det.data.session.title, 'Sunrise Flow');
  assert.equal((await other.c.patch(`/yoga-sessions/${id}/details`, { title: 'Hijack', description: '', category: 'Yin', difficultyLevel: 'BEGINNER' })).status, 404);
  assert.equal((await cust.c.patch(`/yoga-sessions/${id}/details`, { title: 'Hijack', description: '', category: 'Yin', difficultyLevel: 'BEGINNER' })).status, 403);
  assert.equal((await coach.c.put(`/yoga-sessions/${id}`, body(coach.user, 300))).status, 403, 'coach cannot change time, price or seats');

  // a draft with a link: the host can open it, participants still cannot see it, publishing makes it visible
  assert.equal((await coach.c.patch(`/yoga-sessions/${id}/meeting-link`, { meetingLink: LINK })).status, 200);
  assert.equal((await coach.c.get(`/yoga-sessions/${id}/join`)).data.meetingLink, LINK, 'host can open a draft');
  assert.equal((await cust.c.get('/yoga-sessions')).data.items.some((x) => x._id === id), false);
  const ov1 = (await admin.c.get('/yoga-bookings/summary/overview')).data;
  assert.ok(ov1.draftsReadyList.some((x) => x._id === id), 'dashboard shows drafts that have a link and need publishing');
  await admin.c.patch(`/yoga-sessions/${id}/status`, { action: 'publish' });
  assert.equal((await cust.c.get('/yoga-sessions')).data.items.some((x) => x._id === id), true, 'published: participants see it');
  const ov2 = (await admin.c.get('/yoga-bookings/summary/overview')).data;
  assert.equal(ov2.draftsReadyList.some((x) => x._id === id), false);
  assert.equal(ov2.awaitingList.some((x) => x._id === id), false, 'link was added, so it is no longer awaiting');

  // the count always equals its list; an old link-less session no longer inflates it, and shows as overdue instead
  const old = await direct(coach.user, -300, { status: 'awaiting_meeting_link', meetingLink: undefined, meetingLinkStatus: 'MISSING' });
  const fresh = await admin.c.post('/yoga-sessions', body(coach.user, 400));
  await admin.c.patch(`/yoga-sessions/${fresh.data.session._id}/status`, { action: 'publish' });
  const ov3 = (await admin.c.get('/yoga-bookings/summary/overview')).data;
  assert.equal(ov3.awaitingLink, ov3.awaitingList.length);
  assert.equal(ov3.awaitingList.some((x) => x._id === String(old._id)), false, 'a past session is not "awaiting"');
  assert.equal(ov3.overdueList.some((x) => x._id === String(old._id)), true, 'but it is flagged as needing to be closed');
  assert.equal(ov3.awaitingList.some((x) => x._id === fresh.data.session._id), true);

  // admin can edit a session that has already started (no reschedule) and a not-yet-started one
  await YogaSession.updateOne({ _id: id }, { $set: { startsAt: new Date(Date.now() - 5 * MIN) } });
  const cur = (await admin.c.get(`/yoga-sessions/${id}`)).data.session;
  const edited = await admin.c.put(`/yoga-sessions/${id}`, { title: 'Edited by admin', description: cur.description, coachId: String(coach.user._id), category: cur.category, difficultyLevel: cur.difficultyLevel, sessionDate: cur.sessionDate, startTime: cur.startTime, timezone: cur.timezone, durationMinutes: 50, maxParticipants: 12, pricePaise: 10000 });
  assert.equal(edited.status, 200, JSON.stringify(edited.data));
  assert.equal(edited.data.session.title, 'Edited by admin');
  assert.equal(edited.data.session.maxParticipants, 12);
  assert.equal((await admin.c.patch(`/yoga-sessions/${fresh.data.session._id}/status`, { action: 'publish' })).status, 409, 'already published');
});

test('coach dropdown data: admins get each coach with an e-mail; other staff only get names', { skip }, async () => {
  const admin = await person('ADMIN');
  const coach = await person('DIETITIAN');
  const a = await admin.c.get('/staff/dietitians');
  assert.ok(a.data.items.length >= 1 && a.data.items.every((c) => typeof c.email === 'string'));
  const d = await coach.c.get('/staff/dietitians');
  assert.ok(d.data.items.every((c) => c.email === undefined), 'a coach does not receive colleagues e-mails');
});
