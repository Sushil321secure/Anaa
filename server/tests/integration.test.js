// Integration tests against a real MongoDB (a throwaway "anaa_test" database, wiped at the start).
// They are skipped automatically when MongoDB is not reachable.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/anaa_test';
process.env.JWT_SECRET = 'integration-test-secret-integration';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const mongoose = (await import('mongoose')).default;
let dbUp = false;
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 2500 });
  dbUp = true;
} catch {
  console.log('MongoDB not reachable: integration tests skipped');
}
const skip = !dbUp;

const bcrypt = (await import('bcryptjs')).default;
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/modules/users/user.model.js');
const { Package } = await import('../src/modules/catalog/catalog.model.js');
const { slotsForDate, istDateString } = await import('../src/modules/appointments/slots.js');
const { getSetting, setSetting } = await import('../src/modules/settings/settings.js');

let server;
let base;
if (dbUp) {
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
}
after(async () => {
  server?.close();
  if (dbUp) await mongoose.disconnect();
});

// Tiny cookie-keeping HTTP client
function client() {
  let cookie = '';
  const call = async (method, path, body, extra = {}) => {
    const isForm = body instanceof FormData;
    const res = await fetch(base + '/api' + path, {
      method,
      headers: { Origin: 'http://localhost:5173', ...(cookie && { Cookie: cookie }), ...(body && !isForm && { 'Content-Type': 'application/json' }), ...extra },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  };
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), patch: (p, b) => call('PATCH', p, b), put: (p, b) => call('PUT', p, b), del: (p) => call('DELETE', p) };
}

async function makeStaff(role, email) {
  return User.create({ name: `${role} User`, email, role, passwordHash: await bcrypt.hash('Staff@12345', 4), emailVerifiedAt: new Date() });
}
async function login(email, password = 'Staff@12345') {
  const c = client();
  const r = await c.post('/auth/login', { email, password });
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.data)}`);
  return c;
}
async function newCustomer(name, email, extra = {}) {
  const c = client();
  const r = await c.post('/auth/register', { name, email, password: 'Cust@12345', phone: '9000000000', ...extra });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { c, user: r.data.user };
}
// First bookable slot at least 3 days ahead
async function futureSlot(offsetIndex = 0) {
  const cfg = await getSetting('availability');
  for (let d = 3; d < 20; d += 1) {
    const slots = slotsForDate(istDateString(new Date(Date.now() + d * 24 * 3600 * 1000)), cfg);
    if (slots.length > offsetIndex) return slots[offsetIndex];
  }
  throw new Error('no slot');
}

let owner;
let admin;
let dietitian;
let essential;
let transformation;
before(async () => {
  if (!dbUp) return;
  await makeStaff('OWNER', 'owner@t.test');
  await makeStaff('ADMIN', 'admin@t.test');
  await makeStaff('DIETITIAN', 'diet@t.test');
  await makeStaff('OPERATIONS', 'ops@t.test');
  [owner, admin, dietitian] = [await login('owner@t.test'), await login('admin@t.test'), await login('diet@t.test')];
  essential = await Package.create({ name: 'Essential', slug: 'essential', summary: 's', pricePaise: 1250000, referenceMonthlyPaise: 1250000, durationDays: 30, followUpConsults: 1, dietPlans: 1 });
  transformation = await Package.create({ name: 'Transformation', slug: 'transformation', summary: 's', pricePaise: 2440000, referenceMonthlyPaise: 1250000, durationDays: 60, followUpConsults: 2, dietPlans: 2 });
});

test('auth: register validation, duplicate email, login, me, logout', { skip }, async () => {
  const c = client();
  const weak = await c.post('/auth/register', { name: 'A B', email: 'weak@t.test', password: 'password' });
  assert.equal(weak.status, 400);
  assert.ok(weak.data.details.password);
  const ok = await c.post('/auth/register', { name: 'Asha Rao', email: 'ASHA@t.test ', password: 'Asha@12345', phone: '9876543210' });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.email, 'asha@t.test');
  assert.equal(ok.data.user.role, 'CUSTOMER');
  assert.equal(ok.data.user.emailVerifiedAt, undefined, 'a new account starts unverified');
  assert.equal((await c.post('/auth/register', { name: 'Asha Rao', email: 'asha@t.test', password: 'Asha@12345' })).status, 409);
  assert.equal((await c.get('/auth/me')).data.user.email, 'asha@t.test');
  await c.post('/auth/logout');
  assert.equal((await c.get('/auth/me')).status, 401);
  assert.equal((await c.post('/auth/login', { email: 'asha@t.test', password: 'wrong-pass1' })).status, 401);
  assert.equal((await c.post('/auth/login', { email: 'asha@t.test', password: 'Asha@12345' })).status, 200);
  // role cannot be chosen at sign-up
  const sneaky = await client().post('/auth/register', { name: 'Sneaky', email: 'sneaky@t.test', password: 'Sneaky@12345', role: 'OWNER' });
  assert.equal(sneaky.data.user.role, 'CUSTOMER');
});

test('auth: forgot and reset password (single use, hides unknown emails)', { skip }, async () => {
  const { c } = await newCustomer('Reset Me', 'reset@t.test');
  const unknown = await client().post('/auth/forgot-password', { email: 'nobody@t.test' });
  assert.equal(unknown.status, 200);
  assert.equal(unknown.data.devResetLink, undefined, 'no link for unknown emails');
  const f = await client().post('/auth/forgot-password', { email: 'reset@t.test' });
  const token = new URL(f.data.devResetLink).searchParams.get('token');
  assert.equal((await client().post('/auth/reset-password', { token, password: 'short' })).status, 400);
  assert.equal((await client().post('/auth/reset-password', { token, password: 'Brand@New1' })).status, 200);
  assert.equal((await client().post('/auth/reset-password', { token, password: 'Another@New1' })).status, 400, 'token works once');
  assert.equal((await client().post('/auth/login', { email: 'reset@t.test', password: 'Cust@12345' })).status, 401);
  assert.equal((await client().post('/auth/login', { email: 'reset@t.test', password: 'Brand@New1' })).status, 200);
  void c;
});

test('profile: update, validation and password change', { skip }, async () => {
  const { c } = await newCustomer('Profile P', 'profile@t.test');
  const upd = await c.patch('/me', { name: 'Profile Person', city: 'Bengaluru', heightCm: 170, gender: 'FEMALE', dob: '1990-05-01', healthGoal: 'Energy' });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.user.heightCm, 170);
  assert.equal((await c.patch('/me', { heightCm: 20 })).status, 400);
  assert.equal((await c.patch('/me', { dob: '2999-01-01' })).status, 400);
  assert.equal((await c.post('/me/password', { currentPassword: 'nope', newPassword: 'Newpass@123' })).status, 400);
  assert.equal((await c.post('/me/password', { currentPassword: 'Cust@12345', newPassword: 'Newpass@123' })).status, 200);
  assert.equal((await client().post('/auth/login', { email: 'profile@t.test', password: 'Newpass@123' })).status, 200);
});

test('access control: customers cannot use staff APIs, anonymous cannot use customer APIs', { skip }, async () => {
  const { c } = await newCustomer('Nosy', 'nosy@t.test');
  for (const p of ['/staff/stats', '/staff/customers', '/staff/users', '/staff/appointments', '/enquiries']) assert.equal((await c.get(p)).status, 403, p);
  for (const p of ['/appointments/mine', '/progress/mine', '/diet-plans/mine', '/rewards/wallet']) assert.equal((await client().get(p)).status, 401, p);
  assert.equal((await dietitian.get('/staff/users')).status, 403, 'dietitians cannot manage staff');
  assert.equal((await dietitian.get('/appointments/mine')).status, 403, 'staff do not use the customer API');
});

test('packages: staff records a payment, entitlements appear, appointments consume and return them', { skip }, async () => {
  const { c, user } = await newCustomer('Booker', 'booker@t.test');
  assert.equal((await c.get('/purchases/mine')).data.items.length, 0);
  const slotA = await futureSlot(0);
  const noPack = await c.post('/appointments', { startsAt: slotA.toISOString() });
  assert.equal(noPack.status, 403, 'no consultations yet');

  const assign = await admin.post(`/staff/customers/${user._id}/packages`, { packageId: String(essential._id), note: 'UPI ref 123456' });
  assert.equal(assign.status, 201);
  assert.equal(assign.data.purchase.consultationsRemaining, 2); // 1 initial + 1 follow-up
  assert.equal((await admin.post(`/staff/customers/${user._id}/packages`, { packageId: String(essential._id), note: '' })).status, 400, 'note required');

  const mine = await c.get('/purchases/mine');
  assert.equal(mine.data.items[0].consultationsRemaining, 2);

  const slots = await c.get(`/appointments/slots?date=${istDateString(slotA)}`);
  assert.ok(slots.data.slots.find((s) => s.startsAt === slotA.toISOString())?.available);

  const book = await c.post('/appointments', { startsAt: slotA.toISOString(), notes: 'First visit' });
  assert.equal(book.status, 201);
  assert.equal(book.data.consultationsRemaining, 1);
  assert.equal((await c.post('/appointments', { startsAt: slotA.toISOString() })).status, 409, 'same customer cannot double book a time');
  assert.equal((await c.post('/appointments', { startsAt: new Date(Date.now() + 3600 * 1000).toISOString() })).status, 400, 'too soon / not a slot');
  assert.equal((await c.post('/appointments', { startsAt: '2020-01-01T10:00:00.000Z' })).status, 400, 'past');

  // cancelling well ahead returns the consultation
  const cancel = await c.post(`/appointments/${book.data.appointment._id}/cancel`);
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.consultationReturned, true);
  assert.equal((await c.get('/purchases/mine')).data.items[0].consultationsRemaining, 2);
  assert.equal((await c.post(`/appointments/${book.data.appointment._id}/cancel`)).status, 400, 'already cancelled');

  // use both consultations, the third booking is refused
  const s1 = await futureSlot(1);
  const s2 = await futureSlot(2);
  const s3 = await futureSlot(3);
  assert.equal((await c.post('/appointments', { startsAt: s1.toISOString() })).status, 201);
  assert.equal((await c.post('/appointments', { startsAt: s2.toISOString() })).status, 201);
  const over = await c.post('/appointments', { startsAt: s3.toISOString() });
  assert.equal(over.status, 403);
  assert.equal((await c.get('/purchases/mine')).data.items[0].consultationsRemaining, 0);
});

test('appointments: capacity is shared, parallel bookings never exceed it, clinic cancel returns the consultation', { skip }, async () => {
  // one dietitian exists -> capacity 1 per time. Two customers fight for the same slot at the same moment.
  const a = await newCustomer('Race A', 'racea@t.test');
  const b = await newCustomer('Race B', 'raceb@t.test');
  for (const u of [a, b]) await admin.post(`/staff/customers/${u.user._id}/packages`, { packageId: String(transformation._id), note: 'cash' });
  const slot = await futureSlot(5);
  const [ra, rb] = await Promise.all([a.c.post('/appointments', { startsAt: slot.toISOString() }), b.c.post('/appointments', { startsAt: slot.toISOString() })]);
  assert.deepEqual([ra.status, rb.status].sort(), [201, 409], 'exactly one booking wins');
  const loser = ra.status === 409 ? a : b;
  const winner = ra.status === 201 ? a : b;
  assert.equal((await loser.c.get('/purchases/mine')).data.items[0].consultationsRemaining, 3, 'the losing booking gave its consultation back');
  const listed = await admin.get('/staff/appointments');
  const appt = listed.data.items.find((x) => x.startsAt === slot.toISOString());
  assert.equal(appt.customer.email, winner.user.email);
  // assign a dietitian, complete, cancel by clinic
  const d = await admin.get('/staff/dietitians');
  assert.equal((await admin.patch(`/staff/appointments/${appt._id}`, { dietitianId: d.data.items[0]._id, staffNotes: 'Bring reports' })).status, 200);
  assert.equal((await admin.patch(`/staff/appointments/${appt._id}`, { status: 'CANCELLED' })).status, 200);
  assert.equal((await winner.c.get('/purchases/mine')).data.items[0].consultationsRemaining, 3, 'clinic cancellation returns it');
  assert.equal((await winner.c.get('/appointments/mine')).data.items[0].status, 'CANCELLED');
});

test('diet plans: staff uploads, only the owner customer downloads, bad files are refused', { skip }, async () => {
  const mine = await newCustomer('Plan Owner', 'planowner@t.test');
  const other = await newCustomer('Other Person', 'otherperson@t.test');
  const pdf = new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'], { type: 'application/pdf' });
  const form = new FormData();
  form.set('customerId', String(mine.user._id));
  form.set('title', 'Week 1 plan');
  form.set('notes', 'Low oil');
  form.set('file', pdf, 'plan.pdf');
  const up = await dietitian.post('/diet-plans', form);
  assert.equal(up.status, 201, JSON.stringify(up.data));
  const id = up.data.plan._id;
  assert.equal((await mine.c.get('/diet-plans/mine')).data.items.length, 1);
  const dl = await mine.c.get(`/diet-plans/${id}/file`);
  assert.equal(dl.status, 200);
  assert.match(dl.headers.get('content-disposition'), /attachment/);
  assert.equal(dl.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(dl.data.toString().startsWith('%PDF'));
  assert.equal((await other.c.get(`/diet-plans/${id}/file`)).status, 404, 'another customer cannot download it');
  assert.equal((await client().get(`/diet-plans/${id}/file`)).status, 401);
  assert.equal((await other.c.get('/diet-plans/mine')).data.items.length, 0);

  const bad = new FormData();
  bad.set('customerId', String(mine.user._id));
  bad.set('title', 'Malware');
  bad.set('file', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'x.exe');
  assert.equal((await dietitian.post('/diet-plans', bad)).status, 400);
  assert.equal((await mine.c.post('/diet-plans', form)).status, 403, 'customers cannot upload');
  assert.equal((await dietitian.del(`/diet-plans/${id}`)).status, 200);
  assert.equal((await mine.c.get(`/diet-plans/${id}/file`)).status, 404);
});

test('progress: add, list with BMI, validation, delete, staff view', { skip }, async () => {
  const { c, user } = await newCustomer('Tracker', 'tracker@t.test');
  await c.patch('/me', { heightCm: 160 });
  assert.equal((await c.post('/progress', { date: '2026-10-01' })).status, 400, 'needs a measurement');
  assert.equal((await c.post('/progress', { date: '2026-10-01', weightKg: 5 })).status, 400);
  assert.equal((await c.post('/progress', { date: '2999-01-01', weightKg: 60 })).status, 400, 'no future dates');
  const a = await c.post('/progress', { date: '2026-10-01', weightKg: 64, waistCm: 80 });
  await c.post('/progress', { date: '2026-10-15', weightKg: 62.5 });
  assert.equal(a.status, 201);
  const list = await c.get('/progress/mine');
  assert.equal(list.data.items.length, 2);
  assert.equal(list.data.items[0].bmi, 25);
  assert.ok(list.data.items[0].date < list.data.items[1].date, 'oldest first for charts');
  assert.equal((await dietitian.get(`/progress/customer/${user._id}`)).data.items.length, 2);
  assert.equal((await c.del(`/progress/${a.data.item._id}`)).status, 200);
  assert.equal((await c.get('/progress/mine')).data.items.length, 1);
});

test('staff: dashboard stats, customer search, user management rules, settings', { skip }, async () => {
  const stats = await admin.get('/staff/stats');
  assert.equal(stats.status, 200);
  assert.ok(stats.data.customers >= 5);
  assert.ok(stats.data.revenuePaise > 0, 'admin sees revenue');
  assert.equal((await dietitian.get('/staff/stats')).data.revenuePaise, null, 'dietitian does not see revenue');
  const found = await admin.get('/staff/customers?q=booker');
  assert.equal(found.data.items[0].email, 'booker@t.test');
  const detail = await admin.get(`/staff/customers/${found.data.items[0]._id}`);
  assert.equal(detail.data.purchases[0].packageName, 'Essential');

  // admins can add dietitians but not owners/admins
  const mk = (role, email) => admin.post('/staff/users', { name: 'New Staff', email, role, password: 'Staff@12345' });
  assert.equal((await mk('DIETITIAN', 'newdiet@t.test')).status, 201);
  assert.equal((await mk('ADMIN', 'newadmin@t.test')).status, 403);
  assert.equal((await mk('DIETITIAN', 'newdiet@t.test')).status, 409);
  assert.equal((await owner.post('/staff/users', { name: 'Second Admin', email: 'newadmin@t.test', role: 'ADMIN', password: 'Staff@12345' })).status, 201);
  const users = await owner.get('/staff/users');
  const ownerRow = users.data.items.find((u) => u.email === 'owner@t.test');
  assert.equal((await owner.patch(`/staff/users/${ownerRow._id}`, { isActive: false })).status, 400, 'cannot deactivate yourself');
  const nd = users.data.items.find((u) => u.email === 'newdiet@t.test');
  assert.equal((await admin.patch(`/staff/users/${nd._id}`, { isActive: false })).status, 200);
  assert.equal((await client().post('/auth/login', { email: 'newdiet@t.test', password: 'Staff@12345' })).status, 401, 'deactivated staff cannot log in');

  assert.equal((await admin.put('/staff/settings/availability', { days: [1, 2], startHour: 12, endHour: 10, slotMinutes: 30, minNoticeHours: 1, cancelBeforeHours: 24, maxDaysAhead: 30 })).status, 400);
  const ok = await admin.put('/staff/settings/availability', { days: [1, 2, 3, 4, 5, 6], startHour: 9, endHour: 17, slotMinutes: 45, minNoticeHours: 2, cancelBeforeHours: 24, maxDaysAhead: 30 });
  assert.equal(ok.data.availability.startHour, 9);
  assert.equal((await dietitian.put('/staff/settings/availability', {})).status, 403);
  await setSetting('availability', { days: [1, 2, 3, 4, 5, 6], startHour: 10, endHour: 18, slotMinutes: 45, minNoticeHours: 2, cancelBeforeHours: 24, maxDaysAhead: 30 });
});
