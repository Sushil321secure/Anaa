import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { computePricing, totalConsultations } from '../src/modules/catalog/pricing.js';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/unused';
process.env.JWT_SECRET = 'test-secret-test-secret';
const { verifyPaymentSignature } = await import('../src/modules/payments/razorpay.js');
const { expiryFrom } = await import('../src/modules/purchases/entitlements.js');

const M = 1250000;
const essential = { durationDays: 30, pricePaise: 1250000, referenceMonthlyPaise: M, followUpConsults: 1 };
const transformation = { durationDays: 60, pricePaise: 2440000, referenceMonthlyPaise: M, badge: 'MOST_POPULAR', followUpConsults: 2 };
const complete = { durationDays: 90, pricePaise: 3200000, referenceMonthlyPaise: M, badge: 'BEST_VALUE', followUpConsults: 4 };

test('Essential has no discount and shows START YOUR JOURNEY', () => {
  const p = computePricing(essential);
  assert.equal(p.savingsPaise, 0);
  assert.equal(p.effectiveMonthlyPaise, 1250000);
  assert.equal(p.label, 'START YOUR JOURNEY');
});

test('Transformation saves Rs 600 (2.4%) against 2 x Rs 12,500', () => {
  const p = computePricing(transformation);
  assert.equal(p.referencePaise, 2500000);
  assert.equal(p.savingsPaise, 60000);
  assert.equal(p.savingsPercent, 2.4);
  assert.equal(p.effectiveMonthlyPaise, 1220000);
  assert.equal(p.label, 'SAVE ₹600');
});

test('Complete Wellness saves Rs 5,500 (14.7%) against 3 x Rs 12,500', () => {
  const p = computePricing(complete);
  assert.equal(p.referencePaise, 3750000);
  assert.equal(p.savingsPaise, 550000);
  assert.equal(p.savingsPercent, 14.7);
  assert.equal(p.effectiveMonthlyPaise, 1066667); // approx Rs 10,667
  assert.equal(p.label, 'SAVE ₹5,500 – BEST VALUE');
});

test('a price above the reference never produces negative savings; null price is "on request"', () => {
  assert.equal(computePricing({ ...essential, pricePaise: 1500000 }).savingsPaise, 0);
  assert.equal(computePricing({ durationDays: 30, pricePaise: null }).priced, false);
});

test('consultation entitlement is the initial consultation plus follow-ups', () => {
  assert.deepEqual([essential, transformation, complete].map(totalConsultations), [2, 3, 5]);
});

test('package expiry is paidAt plus the package duration', () => {
  const paid = new Date('2026-11-03T10:00:00.000Z');
  assert.equal(expiryFrom(paid, 60).toISOString(), '2027-01-02T10:00:00.000Z');
});

test('payment signature: valid accepted, tampered or missing rejected', () => {
  const secret = 'rzp_test_secret';
  const sign = (o, p) => crypto.createHmac('sha256', secret).update(`${o}|${p}`).digest('hex');
  const good = sign('order_1', 'pay_1');
  assert.equal(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: good }, secret), true);
  assert.equal(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_2', signature: good }, secret), false);
  assert.equal(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: 'abc' }, secret), false);
  assert.equal(verifyPaymentSignature({ orderId: 'order_1', paymentId: 'pay_1', signature: good }, ''), false);
});
