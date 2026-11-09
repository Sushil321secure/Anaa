import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/http.js';

// RAZORPAY_MOCK=true (never honoured in production) creates local fake orders so checkout can be developed and tested without keys.
// The payment signature is still verified for real, with RAZORPAY_KEY_SECRET.
export const razorpayMock = () => env.RAZORPAY_MOCK === 'true' && env.NODE_ENV !== 'production';
// What Razorpay's payment window pre-fills. The saved phone is passed only when it looks like a real number.
export function checkoutPrefill(user) {
  const digits = String(user.phone || '').replace(/[^\d+]/g, '');
  return { name: user.name, email: user.email, ...(/^\+?\d{10,13}$/.test(digits) && { contact: digits }) };
}
export const razorpayConfigured = () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

// Razorpay signs "<order_id>|<payment_id>" with the key secret (HMAC-SHA256, hex).
export function verifyPaymentSignature({ orderId, paymentId, signature }, secret = env.RAZORPAY_KEY_SECRET) {
  if (!secret || !orderId || !paymentId || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function createOrder({ amountPaise, receipt, notes }) {
  if (razorpayMock() && razorpayConfigured()) return { id: `order_mock_${crypto.randomBytes(8).toString('hex')}`, amount: amountPaise, receipt, notes };
  if (!razorpayConfigured()) throw new ApiError(503, 'Online payment is not available yet. Please contact us to book.');
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  let res;
  try {
    res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
    });
  } catch {
    throw new ApiError(502, 'Payment provider is unreachable. Please try again.');
  }
  if (!res.ok) throw new ApiError(502, 'Could not start the payment. Please try again.');
  return res.json();
}
