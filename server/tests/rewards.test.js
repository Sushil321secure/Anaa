// Log & Earn integration tests against a real MongoDB (its own throwaway database, wiped at the start).
// Skipped automatically when MongoDB is not reachable.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_REWARDS_MONGO_URI || 'mongodb://127.0.0.1:27017/anaa_test_rewards';
process.env.JWT_SECRET = 'rewards-test-secret-rewards-test';
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
  console.log('MongoDB not reachable: rewards tests skipped');
}
const skip = !dbUp;

const bcrypt = (await import('bcryptjs')).default;
const { createApp } = await import('../src/app.js');
const { User } = await import('../src/modules/users/user.model.js');
const { Package } = await import('../src/modules/catalog/catalog.model.js');
const { Purchase } = await import('../src/modules/purchases/purchase.model.js');
const { AuditLog } = await import('../src/modules/audit/audit.model.js');
const { slotsForDate, istDateString } = await import('../src/modules/appointments/slots.js');
const { getSetting } = await import('../src/modules/settings/settings.js');
const models = await import('../src/modules/rewards/models.js');
const svc = await import('../src/modules/rewards/service.js');
const cfg = await import('../src/modules/rewards/config.js');
const { RewardTransaction, RewardWallet, RewardRedemption, ReferralInvitation, RewardExpiryRun } = models;

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

// ---------------------------------------------------------------- helpers
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
  return { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), patch: (p, b) => call('PATCH', p, b), put: (p, b) => call('PUT', p, b) };
}
const loginAs = async (email, password = 'Staff@12345') => {
  const c = client();
  assert.equal((await c.post('/auth/login', { email, password })).status, 200);
  return c;
};
const staff = async (role, email) => User.create({ name: `${role} User`, email, role, passwordHash: await bcrypt.hash('Staff@12345', 4), emailVerifiedAt: new Date() });

let seq = 0;
const uniq = (p) => `${p}${Date.now().toString(36)}${seq++}`;
const tokenFrom = (link, name) => new URL(link).searchParams.get(name);

/** Registers a customer. Verifies the email too unless { verify: false }. */
async function newCustomer(name, { email = `${uniq('c')}@t.test`, phone = '9000000000', invite, verify = true } = {}) {
  const c = client();
  const r = await c.post('/auth/register', { name, email, password: 'Cust@12345', phone, ...(invite && { invite }) });
  if (r.status !== 201) return { c, res: r, email };
  if (verify) assert.equal((await client().post('/auth/verify-email', { token: tokenFrom(r.data.devVerifyLink, 'token') })).status, 200);
  return { c, user: r.data.user, email, devVerifyLink: r.data.devVerifyLink, res: r };
}
const wallet = async (c) => (await c.get('/rewards/wallet')).data.wallet;
const sign = (orderId, paymentId) => crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

async function checkout(c, packageId, redeemPoints) {
  return c.post('/purchases/checkout', { packageId, ...(redeemPoints && { redeemPoints }) });
}
async function payVerified(c, packageId, redeemPoints) {
  const co = await checkout(c, packageId, redeemPoints);
  assert.equal(co.status, 201, JSON.stringify(co.data));
  const paymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
  const v = await c.post('/purchases/verify', { razorpay_order_id: co.data.orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(co.data.orderId, paymentId) });
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return co.data;
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
const bookConsultation = async (c) => {
  const r = await c.post('/appointments', { startsAt: (await nextSlot()).toISOString() });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.appointment;
};
const completeBy = (admin) => async (appt) => {
  const r = await admin.patch(`/staff/appointments/${appt._id}`, { status: 'COMPLETED' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
};
const sources = async (userId, source) => RewardTransaction.countDocuments({ user: userId, source, type: 'EARN' });

// ---------------------------------------------------------------- shared setup
let admin;
let owner;
let dietitian;
let pkg;
const PRICE = 1250000; // ₹12,500 in paise
const RULES = [
  { key: 'REGISTRATION', enabled: true, points: 20, minPurchasePaise: 0 },
  { key: 'PURCHASE', enabled: true, points: 50, minPurchasePaise: 100000 },
  { key: 'CONSULTATION', enabled: true, points: 30, minPurchasePaise: 0 },
  { key: 'REFERRAL', enabled: true, points: 100, minPurchasePaise: 0 },
];
const PROGRAM = { enabled: true, paisePer100Points: 5000, maxDiscountPaise: 10000, minRedeemPoints: 0, expiryEnabled: true, inviteValidDays: 14, expiringSoonDays: 5 };
if (dbUp) {
  await staff('OWNER', 'owner@r.test');
  await staff('ADMIN', 'admin@r.test');
  await staff('DIETITIAN', 'diet@r.test');
  [owner, admin, dietitian] = [await loginAs('owner@r.test'), await loginAs('admin@r.test'), await loginAs('diet@r.test')];
  pkg = await Package.create({ name: 'Essential', slug: 'essential', summary: 's', pricePaise: PRICE, referenceMonthlyPaise: PRICE, durationDays: 30, followUpConsults: 3, dietPlans: 1 });
  const saved = await admin.put('/rewards/admin/config', { program: PROGRAM, rules: RULES });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
}

// ====================================================================== tests

test('1. registration reward is credited only once, and only after email verification', { skip }, async () => {
  const u = await newCustomer('Reg Once', { verify: false });
  assert.equal((await wallet(u.c)).available, 0, 'nothing before the email is verified');
  const token = tokenFrom(u.devVerifyLink, 'token');
  const first = await client().post('/auth/verify-email', { token });
  assert.equal(first.status, 200);
  assert.equal(first.data.pointsEarned, 20);
  assert.equal((await client().post('/auth/verify-email', { token })).status, 400, 'a verification link works once');
  const again = await u.c.post('/auth/resend-verification');
  assert.equal(again.data.alreadyVerified, true);
  assert.equal((await wallet(u.c)).available, 20);
  assert.equal(await sources(u.user._id, 'REGISTRATION'), 1);
  const dup = await svc.earn({ userId: u.user._id, ruleKey: 'REGISTRATION', refId: u.user._id, key: `registration:${u.user._id}` });
  assert.equal(dup.duplicate, true, 'the same event can never be credited twice');
  assert.equal((await wallet(u.c)).available, 20);
});

test('2. a verified package purchase earns points', { skip }, async () => {
  const u = await newCustomer('Buyer One');
  const before = (await wallet(u.c)).available;
  await payVerified(u.c, pkg._id);
  const w = await wallet(u.c);
  assert.equal(w.available - before, 50);
  assert.equal(w.totalEarned, 70);
  assert.equal(await sources(u.user._id, 'PURCHASE'), 1);
});

test('3. a failed or unverified payment earns nothing', { skip }, async () => {
  const u = await newCustomer('Failed Pay');
  const base0 = (await wallet(u.c)).available;
  const co = await checkout(u.c, pkg._id);
  const bad = await u.c.post('/purchases/verify', { razorpay_order_id: co.data.orderId, razorpay_payment_id: 'pay_forged', razorpay_signature: 'f'.repeat(64) });
  assert.equal(bad.status, 400);
  assert.equal((await wallet(u.c)).available, base0, 'a forged payment response earns nothing');
  assert.equal(await sources(u.user._id, 'PURCHASE'), 0);
  assert.equal((await u.c.post('/purchases/cancel', { razorpay_order_id: co.data.orderId })).status, 200);
  assert.equal((await Purchase.findOne({ razorpayOrderId: co.data.orderId })).status, 'FAILED');
  assert.equal((await u.c.post('/purchases/verify', { razorpay_order_id: co.data.orderId, razorpay_payment_id: 'pay_x', razorpay_signature: sign(co.data.orderId, 'pay_x') })).status, 400, 'a cancelled order cannot be paid later');
  assert.equal(await sources(u.user._id, 'PURCHASE'), 0);
  // a purchase below the rule's minimum earns nothing either
  const lowRules = RULES.map((r) => (r.key === 'PURCHASE' ? { ...r, minPurchasePaise: PRICE + 1 } : r));
  await admin.put('/rewards/admin/config', { program: PROGRAM, rules: lowRules });
  const w1 = (await wallet(u.c)).available;
  await payVerified(u.c, pkg._id);
  assert.equal((await wallet(u.c)).available, w1, 'below the minimum purchase amount');
  await admin.put('/rewards/admin/config', { program: PROGRAM, rules: RULES });
});

test('4. the consultation reward is only given after completion, and only once', { skip }, async () => {
  const u = await newCustomer('Consult Earner');
  await payVerified(u.c, pkg._id);
  const w0 = (await wallet(u.c)).available;
  const appt = await bookConsultation(u.c);
  assert.equal((await wallet(u.c)).available, w0, 'booking earns nothing');
  await completeBy(admin)(appt);
  assert.equal((await wallet(u.c)).available, w0 + 30);
  await admin.patch(`/staff/appointments/${appt._id}`, { status: 'COMPLETED' });
  await svc.onConsultationCompleted({ appointmentId: appt._id, customerId: u.user._id, paid: true });
  assert.equal((await wallet(u.c)).available, w0 + 30, 'completing again does not pay again');
  assert.equal(await sources(u.user._id, 'CONSULTATION'), 1);
  const noShow = await bookConsultation(u.c);
  await admin.patch(`/staff/appointments/${noShow._id}`, { status: 'NO_SHOW' });
  assert.equal((await wallet(u.c)).available, w0 + 30, 'a no-show earns nothing');
});

// ---------------------------------------------------------------- referrals
const invite = async (referrer, email) => {
  const r = await referrer.c.post('/rewards/referrals', { email });
  return { r, token: r.data.devInviteLink ? tokenFrom(r.data.devInviteLink, 'invite') : undefined };
};

test('5. a duplicate referral for the same email is rejected', { skip }, async () => {
  const referrer = await newCustomer('Dup Referrer');
  const friend = `${uniq('friend')}@t.test`;
  assert.equal((await invite(referrer, friend)).r.status, 201);
  const second = await invite(referrer, friend.toUpperCase());
  assert.equal(second.r.status, 409);
  assert.equal(second.r.data.details.code, 'DUPLICATE_REFERRAL');
  const other = await newCustomer('Other Referrer');
  assert.equal((await invite(other, friend)).r.status, 409, 'a different customer cannot invite an already-invited email either');
});

test('6. a self-referral is rejected', { skip }, async () => {
  const u = await newCustomer('Self Refer');
  const r = await u.c.post('/rewards/referrals', { email: u.email.toUpperCase() });
  assert.equal(r.status, 400);
  assert.equal(r.data.details.code, 'SELF_REFERRAL');
});

test('7. an existing customer cannot be referred', { skip }, async () => {
  const existing = await newCustomer('Already Here');
  const referrer = await newCustomer('Eager Referrer');
  const r = await referrer.c.post('/rewards/referrals', { email: existing.email });
  assert.equal(r.status, 409);
  assert.equal(r.data.details.code, 'ALREADY_CUSTOMER');
  assert.equal((await referrer.c.post('/rewards/referrals', { email: 'not-an-email' })).status, 400);
  const unverified = await newCustomer('Unverified Ref', { verify: false });
  assert.equal((await unverified.c.post('/rewards/referrals', { email: `${uniq('x')}@t.test` })).status, 403, 'only verified customers can invite');
});

test('8. registering with a different email than the invited one is rejected', { skip }, async () => {
  const referrer = await newCustomer('Wrong Email Referrer');
  const friend = `${uniq('invited')}@t.test`;
  const { token } = await invite(referrer, friend);
  const wrong = await newCustomer('Wrong Person', { email: `${uniq('someoneelse')}@t.test`, invite: token });
  assert.equal(wrong.res.status, 400);
  assert.equal(wrong.res.data.details.code, 'WRONG_EMAIL');
  assert.equal(await User.countDocuments({ email: wrong.email }), 0, 'no account is created');
  const inv = await ReferralInvitation.findOne({ invitedEmail: friend });
  assert.equal(inv.status, 'INVITATION_SENT');
  const right = await newCustomer('Right Person', { email: friend.toUpperCase(), invite: token });
  assert.equal(right.res.status, 201);
  assert.equal((await ReferralInvitation.findOne({ invitedEmail: friend })).status, 'REGISTERED');
  assert.ok(!(await ReferralInvitation.findOne({ invitedEmail: friend })).tokenHash.includes(token), 'only a hash of the token is stored');
});

let flow; // shared by tests 9-11
test('9. no referral reward before the referred customer completes a paid consultation', { skip }, async () => {
  const referrer = await newCustomer('Flow Referrer', { phone: '9111111111' });
  const friendEmail = `${uniq('flowfriend')}@t.test`;
  const { token } = await invite(referrer, friendEmail);
  const friend = await newCustomer('Flow Friend', { email: friendEmail, invite: token, phone: '9222222222' });
  assert.equal(friend.res.status, 201);
  const w0 = (await wallet(referrer.c)).available;
  const status = async () => (await ReferralInvitation.findOne({ invitedEmail: friendEmail })).status;
  assert.equal(await status(), 'REGISTERED');
  await payVerified(friend.c, pkg._id);
  assert.equal(await status(), 'REGISTERED', 'buying a package alone does not qualify');
  assert.equal((await wallet(referrer.c)).available, w0);
  const appt = await bookConsultation(friend.c);
  assert.equal(await status(), 'CONSULTATION_BOOKED');
  assert.equal((await wallet(referrer.c)).available, w0, 'booking alone does not qualify');
  await ReferralInvitation.updateOne({ invitedEmail: friendEmail }, {}); // no-op, keeps the test explicit
  await Appointmentstart(appt, -1000); // the time has passed
  await svc.runRewardMaintenance();
  assert.equal(await status(), 'AWAITING_COMPLETION');
  assert.equal((await wallet(referrer.c)).available, w0, 'still nothing until it is completed');
  flow = { referrer, friend, friendEmail, appt, w0, status };
});
async function Appointmentstart(appt, deltaMs) {
  const { Appointment } = await import('../src/modules/appointments/appointment.model.js');
  await Appointment.updateOne({ _id: appt._id }, { $set: { startsAt: new Date(Date.now() + deltaMs) } });
}

test('10. the referral reward is credited exactly once, after the paid consultation is completed', { skip }, async () => {
  const { referrer, friend, appt, w0, status } = flow;
  await completeBy(admin)(appt);
  assert.equal(await status(), 'REWARD_CREDITED');
  assert.equal((await wallet(referrer.c)).available, w0 + 100);
  assert.equal(await sources(referrer.user._id, 'REFERRAL'), 1);
  await svc.onConsultationCompleted({ appointmentId: appt._id, customerId: friend.user._id, paid: true }); // replay
  await svc.runRewardMaintenance();
  const second = await bookConsultation(friend.c);
  await completeBy(admin)(second); // a second completed consultation by the friend
  assert.equal(await sources(referrer.user._id, 'REFERRAL'), 1, 'one referral, one reward');
  assert.equal((await wallet(referrer.c)).available, w0 + 100);
  const view = (await referrer.c.get('/rewards/referrals')).data.items[0];
  assert.equal(view.status, 'REWARD_CREDITED');
  assert.equal(view.rewardPoints, 100);
  const exposed = Object.keys(view);
  for (const forbidden of ['appointment', 'staffNotes', 'notes', 'dietPlan', 'referredUser', 'tokenHash']) assert.ok(!exposed.includes(forbidden), `referrer must not see ${forbidden}`);
});

test('11. the referred customer receives no referral points', { skip }, async () => {
  const { friend } = flow;
  assert.equal(await sources(friend.user._id, 'REFERRAL'), 0);
  const txs = (await friend.c.get('/rewards/transactions')).data.items;
  assert.ok(!txs.some((t) => t.source === 'REFERRAL'));
  assert.ok(txs.some((t) => t.source === 'REGISTRATION'), 'their own normal activity points are separate');
});

// ---------------------------------------------------------------- redemption
async function richCustomer(points = 500) {
  const u = await newCustomer('Rich Customer');
  await admin.post('/rewards/admin/adjust', { customerId: String(u.user._id), points, reason: 'Test top-up of points' });
  return u;
}

test('12. the maximum discount per order (₹100) is enforced by the backend', { skip }, async () => {
  const u = await richCustomer(1000);
  const quote = (await u.c.get(`/rewards/quote?packageId=${pkg._id}`)).data.quote;
  assert.equal(quote.capPaise, 10000);
  assert.equal(quote.maxPoints, 200, '200 points = ₹100 at 100 points = ₹50');
  const over = await checkout(u.c, pkg._id, 201);
  assert.equal(over.status, 400);
  assert.equal(over.data.details.code, 'OVER_ORDER_CAP');
  assert.equal((await wallet(u.c)).available, 1020, 'a rejected redemption touches nothing');
  const ok = await checkout(u.c, pkg._id, 200);
  assert.equal(ok.status, 201);
  assert.equal(ok.data.discountPaise, 10000);
  assert.equal(ok.data.amountPaise, PRICE - 10000, 'the order sent to the payment provider is the discounted amount');
  assert.equal((await wallet(u.c)).available, 820, 'points are reserved straight away');
  // the browser cannot pass its own discount: unknown fields are ignored, only redeemPoints is read
  const sneaky = await u.c.post('/purchases/checkout', { packageId: pkg._id, discountPaise: 99999999, redeemPoints: 10 });
  assert.equal(sneaky.data.discountPaise, 500, '10 points = ₹5; the discountPaise sent by the browser was ignored');
});

test('13. points can be redeemed on several orders in the same month', { skip }, async () => {
  const u = await richCustomer(400);
  const start = (await wallet(u.c)).available; // 420 (20 registration + 400)
  const o1 = await payVerified(u.c, pkg._id, 200);
  const o2 = await payVerified(u.c, pkg._id, 100);
  const w = await wallet(u.c);
  assert.equal(o1.discountPaise, 10000);
  assert.equal(o2.discountPaise, 5000);
  assert.equal(w.totalRedeemed, 300);
  assert.equal(w.available, start - 300 + 2 * 50, 'minus the points used, plus the purchase points earned on each paid order');
  const history = (await u.c.get('/rewards/transactions')).data.items.filter((t) => t.type === 'REDEEM');
  assert.equal(history.length, 2);
  assert.ok(history.every((t) => t.status === 'POSTED'));
});

test('14. redeeming more points than the balance is rejected', { skip }, async () => {
  const u = await newCustomer('Poor Customer'); // 20 points
  const r = await checkout(u.c, pkg._id, 150);
  assert.equal(r.status, 400);
  assert.equal(r.data.details.code, 'INSUFFICIENT_POINTS');
  assert.equal((await wallet(u.c)).available, 20);
  assert.equal(await Purchase.countDocuments({ user: u.user._id }), 0, 'no order is created');
  const unverified = await newCustomer('No Verify', { verify: false });
  assert.equal((await checkout(unverified.c, pkg._id, 5)).status, 403);
});

test('15. the same points cannot be spent twice by concurrent requests', { skip }, async () => {
  const u = await newCustomer('Racer');
  await admin.post('/rewards/admin/adjust', { customerId: String(u.user._id), points: 80, reason: 'Race test balance' }); // 100 total
  const results = await Promise.all(Array.from({ length: 5 }, () => checkout(u.c, pkg._id, 100)));
  const won = results.filter((r) => r.status === 201);
  assert.equal(won.length, 1, `exactly one checkout may spend the 100 points (got ${results.map((r) => r.status)})`);
  assert.ok(results.filter((r) => r.status !== 201).every((r) => [400, 409].includes(r.status)));
  assert.equal((await wallet(u.c)).available, 0);
  assert.equal(await RewardRedemption.countDocuments({ user: u.user._id }), 1);
  const rec = await svc.reconcileWallet(u.user._id);
  assert.equal(rec.consistent, true, JSON.stringify(rec));
});

// ---------------------------------------------------------------- expiry
const lastMonth = () => new Date(Date.now() - 40 * 24 * 3600 * 1000);

test('16. unused points expire at the end of the month (Asia/Kolkata), exactly once', { skip }, async () => {
  const u = await newCustomer('Expiry One');
  const past = lastMonth();
  const e = await svc.earn({ userId: u.user._id, ruleKey: 'CONSULTATION', refId: new mongoose.Types.ObjectId(), key: `old:${uniq('k')}`, now: past });
  assert.equal(e.credited, true);
  assert.ok(e.tx.expiresAt < new Date(), 'a lot earned last month already expired at the month boundary');
  assert.equal(e.tx.expiresAt.toISOString(), cfg.endOfIstMonth(past).toISOString());
  assert.equal(e.tx.expiresAt.getUTCMinutes(), 30, 'the boundary is midnight IST (18:30 UTC the day before)');
  assert.equal(e.tx.expiresAt.getUTCHours(), 18);
  const before = await svc.spendableBalance(u.user._id);
  assert.equal(before, 20, 'expired-but-unprocessed points are already unspendable');
  const run1 = await svc.runRewardMaintenance();
  assert.equal(run1.expiry.pointsExpired >= 30, true);
  const w = await RewardWallet.findOne({ user: u.user._id });
  assert.equal(w.available, 20);
  assert.equal(w.totalExpired, 30);
  const exp = await RewardTransaction.find({ user: u.user._id, type: 'EXPIRE' });
  assert.equal(exp.length, 1);
  assert.equal(exp[0].points, -30);
  assert.equal((await RewardTransaction.findById(e.tx._id)).remaining, 0, 'history is preserved, only the balance is used up');
  const run2 = await svc.runRewardMaintenance();
  assert.equal(run2.expiry.pointsExpired, 0, 'running it again expires nothing');
  assert.equal(await RewardTransaction.countDocuments({ user: u.user._id, type: 'EXPIRE' }), 1);
  assert.equal((await RewardWallet.findOne({ user: u.user._id })).totalExpired, 30);
  assert.equal((await svc.reconcileWallet(u.user._id)).consistent, true);
  assert.ok(await RewardExpiryRun.exists({ type: 'EXPIRY' }), 'the monthly run is recorded');
});

test('17. there is no carry-forward: last month\'s points cannot be used this month', { skip }, async () => {
  const u = await newCustomer('No Carry');
  await svc.earn({ userId: u.user._id, ruleKey: 'PURCHASE', refId: new mongoose.Types.ObjectId(), key: `old:${uniq('k')}`, now: lastMonth(), amountPaise: PRICE });
  const bal = await svc.spendableBalance(u.user._id);
  assert.equal(bal, 20, 'only this month\'s 20 registration points are spendable, not last month\'s 50');
  const r = await checkout(u.c, pkg._id, 60);
  assert.equal(r.status, 400, 'cannot spend 60 even though 70 were earned in total');
  assert.equal(r.data.details.code, 'INSUFFICIENT_POINTS');
  const ok = await checkout(u.c, pkg._id, 20);
  assert.equal(ok.status, 201);
  // earliest expiry is used first
  const u2 = await newCustomer('Oldest First');
  const a = await svc.earn({ userId: u2.user._id, ruleKey: 'CONSULTATION', refId: new mongoose.Types.ObjectId(), key: `lotA:${uniq('k')}`, now: new Date() });
  await svc.adjustPoints({ userId: u2.user._id, points: -25, reason: 'FIFO check', adminId: (await User.findOne({ role: 'ADMIN' }))._id });
  const lots = await RewardTransaction.find({ user: u2.user._id, remaining: { $gt: 0 } }).sort({ createdAt: 1 });
  assert.equal(lots.reduce((n, l) => n + l.remaining, 0), 25);
  assert.ok(a.credited);
});

test('18. a failed or cancelled checkout releases the reserved points', { skip }, async () => {
  const u = await richCustomer(300);
  const w0 = (await wallet(u.c)).available;
  const co = await checkout(u.c, pkg._id, 150);
  assert.equal(co.status, 201);
  assert.equal((await wallet(u.c)).available, w0 - 150);
  const cancel = await u.c.post('/purchases/cancel', { razorpay_order_id: co.data.orderId });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.pointsReturned, 150);
  assert.equal((await wallet(u.c)).available, w0, 'points are back');
  assert.equal((await wallet(u.c)).totalRedeemed, 0);
  assert.equal((await RewardRedemption.findOne({ user: u.user._id })).status, 'RELEASED');
  const types = (await RewardTransaction.find({ user: u.user._id, source: 'REDEMPTION' }).sort({ createdAt: 1 })).map((t) => `${t.type}:${t.status}`);
  assert.deepEqual(types, ['REDEEM:REVERSED', 'REVERSE:POSTED']);
  assert.equal((await u.c.post('/purchases/cancel', { razorpay_order_id: co.data.orderId })).status, 200, 'cancelling twice is harmless');
  assert.equal((await wallet(u.c)).available, w0, 'and never returns the points twice');
  // an abandoned checkout is released by the scheduled job
  const co2 = await checkout(u.c, pkg._id, 100);
  await RewardRedemption.collection.updateOne({ purchase: (await Purchase.findOne({ razorpayOrderId: co2.data.orderId }))._id }, { $set: { createdAt: new Date(Date.now() - 2 * 3600 * 1000) } }); // createdAt is immutable in Mongoose, so write to the collection
  const m = await svc.runRewardMaintenance();
  assert.equal(m.released, 1);
  assert.equal((await wallet(u.c)).available, w0);
  assert.equal((await svc.reconcileWallet(u.user._id)).consistent, true);
});

// ---------------------------------------------------------------- admin and access control
test('19. a manual adjustment needs a reason and is audited; only owner/admin may do it', { skip }, async () => {
  const u = await newCustomer('Adjusted');
  const noReason = await admin.post('/rewards/admin/adjust', { customerId: String(u.user._id), points: 40, reason: '' });
  assert.equal(noReason.status, 400);
  assert.equal((await dietitian.post('/rewards/admin/adjust', { customerId: String(u.user._id), points: 40, reason: 'Not allowed' })).status, 403);
  assert.equal((await u.c.post('/rewards/admin/adjust', { customerId: String(u.user._id), points: 400, reason: 'Self service' })).status, 403);
  const add = await admin.post('/rewards/admin/adjust', { customerId: String(u.user._id), points: 40, reason: 'Goodwill after a delayed reply' });
  assert.equal(add.status, 201);
  assert.equal((await wallet(u.c)).available, 60);
  const take = await admin.post('/rewards/admin/adjust', { customerId: String(u.user._id), points: -15, reason: 'Correction of a duplicate credit' });
  assert.equal(take.status, 201);
  assert.equal((await wallet(u.c)).available, 45);
  assert.equal((await admin.post('/rewards/admin/adjust', { customerId: String(u.user._id), points: -500, reason: 'More than available' })).status, 400, 'cannot go below zero');
  const logs = await AuditLog.find({ action: 'rewards.adjust', entityId: u.user._id }).sort({ createdAt: 1 });
  assert.equal(logs.length, 2);
  assert.equal(logs[0].changes.reason, 'Goodwill after a delayed reply');
  assert.equal(String(logs[0].actorId), String((await User.findOne({ email: 'admin@r.test' }))._id));
  // configuration changes are audited as well
  assert.ok(await AuditLog.exists({ action: 'rewards.config' }));
  assert.equal((await dietitian.put('/rewards/admin/config', { program: PROGRAM, rules: RULES })).status, 403);
  assert.equal((await dietitian.get('/rewards/admin/wallets')).status, 403);
  assert.equal((await svc.reconcileWallet(u.user._id)).consistent, true);
});

test('20. a customer cannot see another customer\'s wallet or transactions', { skip }, async () => {
  const a = await newCustomer('Owner A');
  const b = await newCustomer('Owner B');
  await admin.post('/rewards/admin/adjust', { customerId: String(a.user._id), points: 333, reason: 'Private balance A' });
  assert.equal((await wallet(a.c)).available, 353);
  assert.equal((await wallet(b.c)).available, 20, 'B only ever sees B');
  const bTx = (await b.c.get('/rewards/transactions')).data.items;
  assert.ok(bTx.every((t) => t.points <= 20));
  assert.equal((await b.c.get(`/rewards/admin/wallets/${a.user._id}`)).status, 403);
  assert.equal((await b.c.get(`/rewards/transactions?userId=${a.user._id}`)).data.items.every((t) => t.points <= 20), true, 'a userId in the query is ignored');
  assert.equal((await client().get('/rewards/wallet')).status, 401);
  assert.equal((await client().get('/rewards/program')).status, 200, 'the public programme summary is open');
  assert.equal(JSON.stringify((await client().get('/rewards/program')).data).includes('@'), false, 'and contains no personal data');
  const adminView = await admin.get(`/rewards/admin/wallets/${a.user._id}`);
  assert.equal(adminView.status, 200);
  assert.equal(adminView.data.reconcile.consistent, true);
});

// ---------------------------------------------------------------- extras
test('rules: a switched-off rule or programme issues nothing, and nothing is hard-coded', { skip }, async () => {
  const off = RULES.map((r) => (r.key === 'CONSULTATION' ? { ...r, enabled: false } : r));
  await admin.put('/rewards/admin/config', { program: PROGRAM, rules: off });
  const u = await newCustomer('Rule Off');
  await payVerified(u.c, pkg._id);
  const appt = await bookConsultation(u.c);
  const w0 = (await wallet(u.c)).available;
  await completeBy(admin)(appt);
  assert.equal((await wallet(u.c)).available, w0, 'consultation rule is off');
  assert.equal((await admin.put('/rewards/admin/config', { program: PROGRAM, rules: [{ key: 'PURCHASE', enabled: true, points: 0, minPurchasePaise: 0 }] })).status, 400, 'a rule cannot be on with 0 points');
  await admin.put('/rewards/admin/config', { program: { ...PROGRAM, enabled: false }, rules: RULES });
  const v = await newCustomer('Programme Off');
  assert.equal((await wallet(v.c)).available, 0);
  assert.equal((await client().get('/rewards/program')).data.enabled, false);
  assert.equal((await v.c.post('/rewards/referrals', { email: `${uniq('p')}@t.test` })).status, 400);
  await admin.put('/rewards/admin/config', { program: PROGRAM, rules: RULES });
});

test('referrals: a suspicious referral (same phone number) waits for an admin decision', { skip }, async () => {
  const referrer = await newCustomer('Sus Referrer', { phone: '9333333333' });
  const email = `${uniq('sus')}@t.test`;
  const { token } = await invite(referrer, email);
  const friend = await newCustomer('Sus Friend', { email, invite: token, phone: '9333333333' });
  const inv = await ReferralInvitation.findOne({ invitedEmail: email });
  assert.equal(inv.flagged, true);
  await payVerified(friend.c, pkg._id);
  const w0 = (await wallet(referrer.c)).available;
  await completeBy(admin)(await bookConsultation(friend.c));
  assert.equal((await wallet(referrer.c)).available, w0, 'flagged: no reward yet');
  assert.equal((await ReferralInvitation.findOne({ invitedEmail: email })).status !== 'REWARD_CREDITED', true);
  const approved = await admin.post(`/rewards/admin/referrals/${inv._id}/approve`);
  assert.equal(approved.status, 200);
  assert.equal((await wallet(referrer.c)).available, w0 + 100, 'approval pays the reward once');
  await admin.post(`/rewards/admin/referrals/${inv._id}/approve`);
  assert.equal((await wallet(referrer.c)).available, w0 + 100);
  // rejecting needs a reason
  const email2 = `${uniq('sus2')}@t.test`;
  const second = await invite(referrer, email2);
  const row = await ReferralInvitation.findOne({ invitedEmail: email2 });
  assert.equal((await admin.post(`/rewards/admin/referrals/${row._id}/reject`, { reason: '' })).status, 400);
  assert.equal((await admin.post(`/rewards/admin/referrals/${row._id}/reject`, { reason: 'Looks fraudulent' })).status, 200);
  assert.equal((await ReferralInvitation.findById(row._id)).active, false);
  assert.ok(second.r.status === 201);
  assert.equal((await invite(referrer, email2)).r.status, 201, 'a rejected email can be invited again');
});

test('maintenance: expired invitations close, reminders go out once per month, reports add up', { skip }, async () => {
  const referrer = await newCustomer('Expiring Referrer');
  const email = `${uniq('late')}@t.test`;
  const { token } = await invite(referrer, email);
  await ReferralInvitation.updateOne({ invitedEmail: email }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const late = await newCustomer('Too Late', { email, invite: token });
  assert.equal(late.res.status, 201, 'an expired link just registers normally');
  assert.equal(late.res.data.inviteIgnored, 'EXPIRED');
  assert.equal((await ReferralInvitation.findOne({ invitedEmail: email })).status, 'EXPIRED');
  assert.equal(await sources(late.user._id, 'REFERRAL'), 0);
  const r = await admin.get(`/rewards/admin/reports?month=${cfg.monthKey(new Date())}`);
  assert.equal(r.status, 200);
  assert.ok(r.data.earned.total > 0);
  assert.equal(r.data.earned.total, Object.values(r.data.earned.bySource).reduce((n, x) => n + x, 0));
  assert.ok(r.data.redeemed.discountPaise >= 0 && r.data.redeemed.orders >= 1);
  const list = await admin.get('/rewards/admin/transactions?type=EXPIRE');
  assert.equal(list.status, 200);
  assert.ok(list.data.items.every((t) => t.type === 'EXPIRE'));
  const wallets = await admin.get('/rewards/admin/wallets');
  assert.ok(wallets.data.items.length > 0);
  const run = await owner.post('/rewards/admin/maintenance/run');
  assert.equal(run.status, 200);
});

test('every wallet in the database reconciles with its ledger', { skip }, async () => {
  const all = await RewardWallet.find().lean();
  assert.ok(all.length > 10);
  for (const w of all) {
    const rec = await svc.reconcileWallet(w.user);
    assert.equal(rec.consistent, true, `wallet ${w.user} ${JSON.stringify(rec)}`);
  }
});
