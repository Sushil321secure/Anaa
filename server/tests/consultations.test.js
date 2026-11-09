// Pay-as-you-go online (₹1,500) and offline (₹1,000) consultations, against a real MongoDB (own throwaway database).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_CONSULT_MONGO_URI || 'mongodb://127.0.0.1:27017/anaa_test_consult';
process.env.JWT_SECRET = 'consult-test-secret-consult-test-1';
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
  console.log('MongoDB not reachable: consultation tests skipped');
}
const skip = !dbUp;

const { createApp } = await import('../src/app.js');
const { Package } = await import('../src/modules/catalog/catalog.model.js');
const { Purchase } = await import('../src/modules/purchases/purchase.model.js');
const { RewardTransaction } = await import('../src/modules/rewards/models.js');
const { slotsForDate, istDateString } = await import('../src/modules/appointments/slots.js');
const { getSetting } = await import('../src/modules/settings/settings.js');

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
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b) };
}
let seq = 0;
async function newCustomer() {
  const c = client();
  const r = await c.post('/auth/register', { name: 'Pay Customer', email: `p${Date.now().toString(36)}${seq++}@t.test`, password: 'Cust@12345', phone: '9000000001' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { c, user: r.data.user };
}
const sign = (orderId, paymentId) => crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
async function payConsultation(c, mode) {
  const co = await c.post('/purchases/consultation-checkout', { mode });
  assert.equal(co.status, 201, JSON.stringify(co.data));
  const paymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
  const v = await c.post('/purchases/verify', { razorpay_order_id: co.data.orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(co.data.orderId, paymentId) });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return { co: co.data, purchase: v.data.purchase };
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
const book = async (c, mode) => c.post('/appointments', { startsAt: (await nextSlot()).toISOString(), mode });

test('fees are online ₹1,500 and offline ₹1,000', { skip }, async () => {
  const { c } = await newCustomer();
  const r = await c.get('/appointments/fees');
  assert.deepEqual(r.data, { onlinePaise: 150000, offlinePaise: 100000 });
});

test('checkout charges the server-side fee for each mode and ignores any amount from the browser', { skip }, async () => {
  const { c } = await newCustomer();
  const on = await c.post('/purchases/consultation-checkout', { mode: 'ONLINE', amountPaise: 1 });
  const off = await c.post('/purchases/consultation-checkout', { mode: 'OFFLINE', amountPaise: 1 });
  assert.equal(on.data.amountPaise, 150000);
  assert.equal(off.data.amountPaise, 100000);
  assert.equal((await c.post('/purchases/consultation-checkout', { mode: 'HOME' })).status, 400);
});

test('booking without a paid consultation or package is refused', { skip }, async () => {
  const { c } = await newCustomer();
  assert.equal((await book(c, 'ONLINE')).status, 403);
});

test('an unverified or forged payment gives no consultation', { skip }, async () => {
  const { c } = await newCustomer();
  const co = await c.post('/purchases/consultation-checkout', { mode: 'ONLINE' });
  const bad = await c.post('/purchases/verify', { razorpay_order_id: co.data.orderId, razorpay_payment_id: 'pay_x', razorpay_signature: 'f'.repeat(64) });
  assert.equal(bad.status, 400);
  assert.equal((await book(c, 'ONLINE')).status, 403);
});

test('a paid online consultation books online once, and cannot be used for offline', { skip }, async () => {
  const { c } = await newCustomer();
  const { purchase } = await payConsultation(c, 'ONLINE');
  assert.equal(purchase.consultationsRemaining, 1);
  assert.equal((await book(c, 'OFFLINE')).status, 403, 'online credit must not cover an offline visit');
  const ok = await book(c, 'ONLINE');
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.appointment.mode, 'ONLINE');
  assert.equal((await book(c, 'ONLINE')).status, 403, 'the credit is single use');
});

test('a paid offline consultation books offline', { skip }, async () => {
  const { c } = await newCustomer();
  await payConsultation(c, 'OFFLINE');
  const ok = await book(c, 'OFFLINE');
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.appointment.mode, 'OFFLINE');
});

test('package consultations can be used for either mode', { skip }, async () => {
  const { c, user } = await newCustomer();
  const pkg = await Package.create({ name: 'Essential', slug: `e${seq++}`, summary: 's', pricePaise: 1250000, referenceMonthlyPaise: 1250000, durationDays: 30, followUpConsults: 3, dietPlans: 1 });
  await Purchase.create({ user: user._id, package: pkg._id, snapshot: { name: 'Essential', durationDays: 30, pricePaise: 1250000 }, status: 'PAID', consultationsTotal: 2, paidAt: new Date(), expiresAt: new Date(Date.now() + 30 * 864e5) });
  assert.equal((await book(c, 'OFFLINE')).status, 201);
  assert.equal((await book(c, 'ONLINE')).status, 201);
});

test('a single consultation earns no package-purchase reward points', { skip }, async () => {
  const { c, user } = await newCustomer();
  await payConsultation(c, 'ONLINE');
  assert.equal(await RewardTransaction.countDocuments({ user: user._id, source: 'PURCHASE' }), 0);
});

test('payment window is pre-filled with name, email and (only a valid) phone', { skip }, async () => {
  const { c } = await newCustomer(); // registered with phone 9000000001
  const co = await c.post('/purchases/consultation-checkout', { mode: 'ONLINE' });
  assert.equal(co.data.prefill.contact, '9000000001');
  assert.match(co.data.prefill.email, /@t\.test$/);
  const { checkoutPrefill } = await import('../src/modules/payments/razorpay.js');
  assert.equal(checkoutPrefill({ name: 'A', email: 'a@b.c', phone: '+91 98765-43210' }).contact, '+919876543210');
  assert.equal('contact' in checkoutPrefill({ name: 'A', email: 'a@b.c', phone: '123' }), false, 'a bad phone is not passed');
  assert.equal('contact' in checkoutPrefill({ name: 'A', email: 'a@b.c' }), false);
});

test('a package with every consultation used is still valid until it expires', { skip }, async () => {
  const { describe } = await import('../src/modules/purchases/entitlements.js');
  const { user } = await newCustomer();
  const pkg = await Package.create({ name: 'Full Used', slug: `fu${seq++}`, summary: 's', pricePaise: 1000000, referenceMonthlyPaise: 1000000, durationDays: 30, followUpConsults: 3, dietPlans: 1 });
  const p = await Purchase.create({ user: user._id, package: pkg._id, snapshot: { name: 'Full Used', durationDays: 30, pricePaise: 1000000 }, status: 'PAID', consultationsTotal: 3, consultationsUsed: 3, paidAt: new Date(), expiresAt: new Date(Date.now() + 30 * 864e5) });
  const d = describe(p);
  assert.equal(d.active, false, 'no consultations left to book with');
  assert.equal(d.valid, true, 'but the package itself is still running');
  assert.equal(d.expired, false);
  const old = describe(await Purchase.findByIdAndUpdate(p._id, { $set: { expiresAt: new Date(Date.now() - 864e5) } }, { new: true }));
  assert.equal(old.valid, false);
  assert.equal(old.expired, true);
});
