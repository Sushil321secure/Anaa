// Google Meet option for one-to-one online consultations, next to the existing in-app (WebRTC) room. Real MongoDB, own database.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MEET_MONGO_URI || 'mongodb://127.0.0.1:27017/anaa_test_meet';
process.env.JWT_SECRET = 'meet-test-secret-meet-test-secret-1';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const mongoose = (await import('mongoose')).default;
let dbUp = false;
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  dbUp = true;
} catch {
  console.log('MongoDB not reachable: Google Meet consultation tests skipped');
}
const skip = !dbUp;

const { createApp } = await import('../src/app.js');
const { User } = await import('../src/modules/users/user.model.js');
const { Package } = await import('../src/modules/catalog/catalog.model.js');
const { Purchase } = await import('../src/modules/purchases/purchase.model.js');
const { Appointment } = await import('../src/modules/appointments/appointment.model.js');
const { EmailLog } = await import('../src/modules/mail/emailLog.model.js');
const { slotsForDate, istDateString } = await import('../src/modules/appointments/slots.js');
const { getSetting } = await import('../src/modules/settings/settings.js');
const { templates } = await import('../src/modules/mail/templates.js');

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
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), patch: (p, b) => call('PATCH', p, b) };
}
let seq = 0;
async function person(role) {
  const email = `${role.toLowerCase()}${Date.now().toString(36)}${seq++}@meet.test`;
  const user = await User.create({ name: `${role} ${seq}`, email, role, passwordHash: await bcrypt.hash('Meet@12345', 4), emailVerifiedAt: new Date(), phone: '9000000002' });
  const c = client();
  assert.equal((await c.post('/auth/login', { email, password: 'Meet@12345' })).status, 200);
  return { c, user };
}
const MIN = 60000;
const LINK = 'https://meet.google.com/abc-defg-hij';
const LINK2 = 'https://meet.google.com/qrs-tuvw-xyz';

async function withCredit(user, n = 5) {
  const pkg = await Package.create({ name: 'Credit', slug: `c${seq++}`, summary: 's', pricePaise: 1000000, referenceMonthlyPaise: 1000000, durationDays: 30, followUpConsults: n, dietPlans: 1 });
  await Purchase.create({ user: user._id, package: pkg._id, snapshot: { name: 'Credit', durationDays: 30, pricePaise: 1000000 }, status: 'PAID', consultationsTotal: n, paidAt: new Date(), expiresAt: new Date(Date.now() + 30 * 864e5) });
}
let slotCounter = 0;
async function nextSlot() {
  const availability = await getSetting('availability');
  for (let d = 3; d < 25; d += 1) {
    const slots = slotsForDate(istDateString(new Date(Date.now() + d * 24 * 3600 * 1000)), availability);
    if (slots.length > slotCounter % slots.length) { const s = slots[slotCounter % slots.length]; slotCounter += 1; return s; }
  }
  throw new Error('no slot');
}
const book = async (c, extra) => c.post('/appointments', { startsAt: (await nextSlot()).toISOString(), ...extra });
// An appointment placed straight in the database so its start time can be anywhere.
const appt = (customer, dietitian, offsetMin, extra = {}) => Appointment.create({
  customer: customer._id, purchase: new mongoose.Types.ObjectId(), dietitian: dietitian?._id, mode: 'ONLINE', provider: 'GOOGLE_MEET',
  startsAt: new Date(Date.now() + offsetMin * MIN), durationMinutes: 45, slotNo: 1 + seq++, ...extra,
});
// E-mails are sent in the background (the request does not wait for them), so wait briefly for the log row.
async function mailsTo(to, n) {
  for (let i = 0; i < 40; i += 1) {
    const rows = await EmailLog.find({ to, template: 'consultMeetLink' }).sort('createdAt');
    if (rows.length >= n) return rows;
    await new Promise((r) => setTimeout(r, 50));
  }
  return EmailLog.find({ to, template: 'consultMeetLink' }).sort('createdAt');
}
const noLinkIn = (obj) => !JSON.stringify(obj).includes('meet.google.com');

test('booking: method is saved with the appointment; WebRTC stays the default; Meet needs an online consultation', { skip }, async () => {
  const cust = await person('CUSTOMER');
  await withCredit(cust.user);
  const def = await book(cust.c, { mode: 'ONLINE' });
  assert.equal(def.status, 201, JSON.stringify(def.data));
  assert.equal(def.data.appointment.provider, 'WEBRTC', 'default is unchanged: the in-app room');
  const meet = await book(cust.c, { mode: 'ONLINE', provider: 'GOOGLE_MEET' });
  assert.equal(meet.status, 201);
  assert.equal(meet.data.appointment.provider, 'GOOGLE_MEET');
  assert.equal(meet.data.appointment.meetLinkStatus, 'PENDING');
  assert.equal((await book(cust.c, { mode: 'OFFLINE', provider: 'GOOGLE_MEET' })).status, 400, 'no Meet for an in-clinic visit');
  assert.equal((await book(cust.c, { mode: 'ONLINE', provider: 'ZOOM' })).status, 400);
  const mine = await cust.c.get('/appointments/mine');
  assert.deepEqual(mine.data.items.map((a) => `${a.provider}/${a.meetLinkStatus}`).sort(), ['GOOGLE_MEET/PENDING', 'WEBRTC/PENDING']);
});

test('link: only the assigned dietitian or an owner/admin; strict Meet validation; customer is e-mailed on add and update', { skip }, async () => {
  const owner = await person('OWNER');
  const diet = await person('DIETITIAN');
  const other = await person('DIETITIAN');
  const cust = await person('CUSTOMER');
  const stranger = await person('CUSTOMER');
  const a = await appt(cust.user, null, 5);
  assert.equal((await owner.c.patch(`/consultation-meet/${a._id}/link`, { meetLink: LINK })).status, 409, 'needs a dietitian first');
  assert.equal((await owner.c.patch(`/staff/appointments/${a._id}`, { dietitianId: String(diet.user._id) })).status, 200);

  const url = `/consultation-meet/${a._id}/link`;
  assert.equal((await cust.c.patch(url, { meetLink: LINK })).status, 403, 'the customer cannot set it');
  assert.equal((await stranger.c.patch(url, { meetLink: LINK })).status, 403);
  assert.equal((await other.c.patch(url, { meetLink: LINK })).status, 404, 'a different dietitian');
  assert.equal((await client().patch(url, { meetLink: LINK })).status, 401);
  for (const bad of ['https://zoom.us/j/123', 'http://meet.google.com/abc-defg-hij', 'https://meet.google.com.evil.com/abc-defg-hij', 'https://meet.google.com/', 'javascript:alert(1)', 'not a url'])
    assert.equal((await diet.c.patch(url, { meetLink: bad })).status, 400, bad);

  const ok = await diet.c.patch(url, { meetLink: `${LINK}?authuser=0` });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.appointment.meetLinkStatus, 'ADDED');
  assert.ok(noLinkIn(ok.data), 'the link is not echoed back');
  assert.equal((await Appointment.findById(a._id).select('+meetLink')).meetLink, LINK, 'stored normalised, without the query string');
  const first = (await mailsTo(cust.user.email, 1))[0];
  assert.ok(first, 'customer e-mailed when the link is added');
  assert.match(first.subject, /ready/);

  assert.equal((await owner.c.patch(url, { meetLink: LINK2 })).status, 200, 'an owner/admin can replace it');
  const logs = await mailsTo(cust.user.email, 2);
  assert.equal(logs.length, 2);
  assert.match(logs[1].subject, /updated/, 'e-mailed again when it changes');

  // the e-mail template never carries the link
  const m = templates.consultMeetLink({ name: 'Asha', dietitianName: 'Ravi', startsAt: new Date(), durationMinutes: 45, updated: false });
  assert.ok(noLinkIn(m) && /Join Google Meet/.test(m.text));
  assert.match(templates.consultMeetLink({ name: '<b>x</b>', dietitianName: 'R', startsAt: new Date(), durationMinutes: 45 }).html, /&lt;b&gt;/);

  // not exposed by any list
  for (const [who, path] of [[cust, '/appointments/mine'], [owner, '/staff/appointments'], [diet, '/staff/appointments']]) {
    const r = await who.c.get(path);
    assert.equal(r.status, 200);
    assert.ok(noLinkIn(r.data), `link leaked in GET ${path}`);
  }
  const row = (await cust.c.get('/appointments/mine')).data.items.find((x) => x._id === String(a._id));
  assert.equal(row.meetLinkStatus, 'ADDED', 'but the status is visible, so the UI can say "available"');
});

test('link: refused for WebRTC appointments, in-clinic visits, and finished or cancelled appointments', { skip }, async () => {
  const owner = await person('OWNER');
  const diet = await person('DIETITIAN');
  const cust = await person('CUSTOMER');
  const web = await appt(cust.user, diet.user, 5, { provider: 'WEBRTC' });
  assert.equal((await diet.c.patch(`/consultation-meet/${web._id}/link`, { meetLink: LINK })).status, 409, 'WebRTC appointments use the in-app room');
  const clinic = await appt(cust.user, diet.user, 5, { mode: 'OFFLINE' });
  assert.equal((await diet.c.patch(`/consultation-meet/${clinic._id}/link`, { meetLink: LINK })).status, 409);
  const done = await appt(cust.user, diet.user, 5, { status: 'COMPLETED' });
  assert.equal((await diet.c.patch(`/consultation-meet/${done._id}/link`, { meetLink: LINK })).status, 409);
  const cancelled = await appt(cust.user, diet.user, 5, { status: 'CANCELLED' });
  assert.equal((await diet.c.patch(`/consultation-meet/${cancelled._id}/link`, { meetLink: LINK })).status, 409);
  const over = await appt(cust.user, diet.user, -120);
  assert.equal((await owner.c.patch(`/consultation-meet/${over._id}/link`, { meetLink: LINK })).status, 409, 'ended long ago');
  assert.equal((await diet.c.patch('/consultation-meet/not-an-id/link', { meetLink: LINK })).status, 404);
});

test('join: only the customer and the assigned dietitian, only when the link exists and the existing joining window is open', { skip }, async () => {
  const owner = await person('OWNER');
  const diet = await person('DIETITIAN');
  const other = await person('DIETITIAN');
  const cust = await person('CUSTOMER');
  const stranger = await person('CUSTOMER');
  const open = await appt(cust.user, diet.user, 5, { meetLink: LINK, meetLinkStatus: 'ADDED' });
  const early = await appt(cust.user, diet.user, 120, { meetLink: LINK, meetLinkStatus: 'ADDED' });
  const noLink = await appt(cust.user, diet.user, 5);
  const noDiet = await appt(cust.user, null, 5, { meetLink: LINK, meetLinkStatus: 'ADDED' });
  const over = await appt(cust.user, diet.user, -120, { meetLink: LINK, meetLinkStatus: 'ADDED' });
  const cancelled = await appt(cust.user, diet.user, 5, { meetLink: LINK, meetLinkStatus: 'ADDED', status: 'CANCELLED' });
  const web = await appt(cust.user, diet.user, 5, { provider: 'WEBRTC' });

  const j = (who, a) => who.c.get(`/consultation-meet/${a._id}/join`);
  assert.equal((await j(cust, open)).data.meetingLink, LINK, 'customer');
  assert.equal((await j(diet, open)).data.meetingLink, LINK, 'assigned dietitian');
  assert.equal((await j(stranger, open)).status, 404, "another customer's link");
  assert.equal((await j(other, open)).status, 404, "another dietitian's link");
  assert.equal((await j(owner, open)).status, 404, 'admins manage the link but do not join as a participant');
  assert.equal((await client().get(`/consultation-meet/${open._id}/join`)).status, 401);

  const e = await j(cust, early);
  assert.equal(e.status, 409);
  assert.equal(e.data.details.reason, 'TOO_EARLY');
  assert.ok(noLinkIn(e.data), 'no link before the window opens');
  const nl = await j(cust, noLink);
  assert.equal(nl.status, 409);
  assert.match(nl.data.message, /has not added the Google Meet link/);
  assert.match((await j(diet, noLink)).data.message, /Add the Google Meet link first/);
  assert.equal((await j(cust, noDiet)).data.details.reason, 'NO_DIETITIAN');
  assert.equal((await j(cust, over)).status, 409, 'after the window closes');
  assert.equal((await j(cust, cancelled)).status, 409);
  assert.equal((await j(cust, web)).status, 409, 'WebRTC appointments are not joined through Meet');
  assert.ok(noLinkIn((await j(cust, early)).data) && noLinkIn((await j(cust, over)).data));
});

test('WebRTC is unaffected: a default appointment still gets a room token, and a Meet one still cannot be used to read links through it', { skip }, async () => {
  const diet = await person('DIETITIAN');
  const cust = await person('CUSTOMER');
  const web = await appt(cust.user, diet.user, 3, { provider: 'WEBRTC' });
  const t = await cust.c.post(`/consultations/${web._id}/token`);
  assert.equal(t.status, 200, JSON.stringify(t.data));
  assert.equal(t.data.roomId, `consultation_${web._id}`);
  const meet = await appt(cust.user, diet.user, 3, { meetLink: LINK, meetLinkStatus: 'ADDED' });
  const info = await cust.c.get(`/consultations/${meet._id}`);
  assert.ok(noLinkIn(info.data), 'the in-app room endpoints never carry a Meet link');
});
