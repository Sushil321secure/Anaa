import { env } from '../../config/env.js';
import { fmtInZone } from './time.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const wrap = (title, body) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2 style="color:#5b1f9e">${esc(title)}</h2>${body}<p style="color:#777;font-size:12px">Anaa Nutricare – Good Nutrition. Better Life.</p></div>`;
const where = () => `${env.CLIENT_ORIGIN}/portal/yoga`;
// No meeting link is ever e-mailed: people log in and use Join Session.
const details = (d) => `<table style="border-collapse:collapse"><tr><td style="padding:3px 12px 3px 0;color:#777">Session</td><td><strong>${esc(d.title)}</strong></td></tr><tr><td style="padding:3px 12px 3px 0;color:#777">Coach</td><td>${esc(d.coachName)}</td></tr><tr><td style="padding:3px 12px 3px 0;color:#777">When</td><td>${esc(fmtInZone(d.startsAt, d.timezone))}</td></tr><tr><td style="padding:3px 12px 3px 0;color:#777">Duration</td><td>${esc(d.durationMinutes)} minutes</td></tr><tr><td style="padding:3px 12px 3px 0;color:#777">Reference</td><td>${esc(d.bookingReference)}</td></tr></table>`;
const plain = (d) => `Session: ${d.title}\nCoach: ${d.coachName}\nWhen: ${fmtInZone(d.startsAt, d.timezone)}\nDuration: ${d.durationMinutes} minutes\nReference: ${d.bookingReference}`;
const JOIN = 'To join, log in to Anaa Nutricare, open Yoga > My bookings and press Join Session (it unlocks 15 minutes before the start).';

export const yogaTemplates = {
  yogaBookingConfirmed: (d) => ({
    subject: `Yoga booking confirmed: ${d.title}`,
    text: `Hi ${d.name}, your yoga booking is confirmed.${d.amountPaise ? ` Payment received: Rs ${(d.amountPaise / 100).toFixed(2)}.` : ''}\n${plain(d)}\n${JOIN}`,
    html: wrap('Your yoga booking is confirmed', `<p>Hi ${esc(d.name)},</p>${d.amountPaise ? `<p>We received your payment of <strong>₹${esc((d.amountPaise / 100).toFixed(2))}</strong>.</p>` : ''}${details(d)}<p>${esc(JOIN)} <a href="${esc(where())}">Open my bookings</a></p>`),
  }),
  yogaReminder: (d) => ({
    subject: d.lead === '24h' ? `Tomorrow: ${d.title}` : `Starting soon: ${d.title}`,
    text: `Hi ${d.name}, your yoga session ${d.lead === '24h' ? 'is in about 24 hours' : 'starts in about 15 minutes'}.\n${plain(d)}\n${JOIN}`,
    html: wrap(d.lead === '24h' ? 'Your yoga session is tomorrow' : 'Your yoga session starts soon', `<p>Hi ${esc(d.name)},</p>${details(d)}<p>${esc(JOIN)} <a href="${esc(where())}">Open my bookings</a></p>`),
  }),
  yogaCancelled: (d) => ({
    subject: `Yoga booking cancelled: ${d.title}`,
    text: `Hi ${d.name}, ${d.byClinic ? 'the session was cancelled by Anaa Nutricare' : 'your booking was cancelled'}.${d.reason ? ` Reason: ${d.reason}.` : ''}${d.refundDue ? ' Your payment will be refunded by our team; we will contact you.' : ''}\n${plain(d)}`,
    html: wrap('Yoga booking cancelled', `<p>Hi ${esc(d.name)},</p><p>${d.byClinic ? 'This session was cancelled by Anaa Nutricare.' : 'Your booking was cancelled.'}${d.reason ? ` Reason: ${esc(d.reason)}.` : ''}</p>${d.refundDue ? '<p>Your payment will be refunded by our team. We will contact you if we need anything.</p>' : ''}${details(d)}`),
  }),
  yogaRescheduled: (d) => ({
    subject: `Yoga session rescheduled: ${d.title}`,
    text: `Hi ${d.name}, your yoga session has a new time. Your booking stays valid. If you can no longer attend, you can cancel from your bookings.\nNew time: ${fmtInZone(d.startsAt, d.timezone)}\n${plain(d)}`,
    html: wrap('Your yoga session was rescheduled', `<p>Hi ${esc(d.name)},</p><p>The session has a <strong>new time</strong>. Your booking stays valid, and you can cancel it from your bookings if the new time does not suit you.</p>${details(d)}`),
  }),
};
