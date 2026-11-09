import { api } from '../../services/api.js';
import { checkoutImage } from '../../utils/checkoutBrand.js';

// Group yoga (Google Meet). Kept separate from the one-to-one consultation code; plain request helpers, no shared state.
export const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o || {}).forEach(([k, v]) => { if (v !== '' && v != null) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};
export const yoga = {
  sessions: (o) => api(`/yoga-sessions${qs(o)}`),
  session: (id) => api(`/yoga-sessions/${id}`),
  create: (body) => api('/yoga-sessions', { method: 'POST', body }),
  update: (id, body) => api(`/yoga-sessions/${id}`, { method: 'PUT', body }),
  setLink: (id, meetingLink) => api(`/yoga-sessions/${id}/meeting-link`, { method: 'PATCH', body: { meetingLink } }),
  details: (id, body) => api(`/yoga-sessions/${id}/details`, { method: 'PATCH', body }),
  setNotes: (id, coachNotes) => api(`/yoga-sessions/${id}/notes`, { method: 'PATCH', body: { coachNotes } }),
  status: (id, action, reason) => api(`/yoga-sessions/${id}/status`, { method: 'PATCH', body: { action, reason } }),
  participants: (id) => api(`/yoga-sessions/${id}/participants`),
  attendance: (id, entries) => api(`/yoga-sessions/${id}/attendance`, { method: 'POST', body: { entries } }),
  staffJoin: (id) => api(`/yoga-sessions/${id}/join`),
  book: (id) => api(`/yoga-sessions/${id}/book`, { method: 'POST' }),
  myBookings: () => api('/yoga-bookings/my-bookings'),
  cancelBooking: (id, reason) => api(`/yoga-bookings/${id}/cancel`, { method: 'POST', body: { reason } }),
  join: (id) => api(`/yoga-bookings/${id}/join`),
  allBookings: (o) => api(`/yoga-bookings${qs(o)}`),
  overview: () => api('/yoga-bookings/summary/overview'),
  verify: (body) => api('/yoga-bookings/verify', { method: 'POST', body }),
  paymentFailed: (id) => api(`/yoga-bookings/${id}/payment-failed`, { method: 'POST' }),
  dietitians: () => api('/staff/dietitians'),
};

// Opens Meet in a new tab. The link is fetched from the server at the moment of joining and never stored.
export function openMeeting(link) {
  window.open(link, '_blank', 'noopener,noreferrer');
}

let script;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  script ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { script = undefined; reject(new Error('Could not load the payment window. Check your connection.')); };
    document.body.appendChild(s);
  });
  return script;
}

/** Books a session. Free sessions confirm at once; paid ones open Razorpay and confirm only after the server verifies the payment. */
export async function bookSession(sessionId) {
  const res = await yoga.book(sessionId);
  if (res.confirmed) return res.booking;
  const c = res.checkout;
  let paid = false;
  try {
    await loadCheckout();
    const payment = await new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        key: c.keyId, order_id: c.orderId, amount: c.amountPaise, currency: 'INR', name: 'Anaa Nutricare', image: checkoutImage(), description: c.packageName, prefill: c.prefill,
        theme: { color: '#5b1f9e' }, handler: resolve,
        modal: { ondismiss: () => reject(new Error('Payment was cancelled. You have not been charged and your seat was released.')) },
      });
      rzp.on?.('payment.failed', () => reject(new Error('The payment failed. You have not been charged and your seat was released.')));
      rzp.open();
    });
    paid = true;
    return (await yoga.verify(payment)).booking;
  } catch (err) {
    if (!paid) await yoga.paymentFailed(c.bookingId).catch(() => {});
    throw err;
  }
}
