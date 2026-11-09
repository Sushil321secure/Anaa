import { yogaTemplates } from '../yoga/emailTemplates.js';
import { meetTemplates } from '../meetconsult/emailTemplates.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const wrap = (title, body) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2 style="color:#5b1f9e">${esc(title)}</h2>${body}<p style="color:#777;font-size:12px">Anaa Nutricare – Good Nutrition. Better Life.</p></div>`;
const fmtIst = (d) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST' : 'not specified');

// All user-supplied values are HTML-escaped.
export const templates = {
  enquiryConfirmation: ({ name, preferredAt }) => ({
    subject: 'We received your discovery call request',
    text: `Hi ${name}, thanks for your request. Our team will contact you to arrange a time. Requested slot: ${fmtIst(preferredAt)} (not yet confirmed).`,
    html: wrap('Thanks for reaching out', `<p>Hi ${esc(name)},</p><p>We have received your free discovery call request. Our team will contact you to arrange a suitable time.</p><p>Requested slot: <strong>${esc(fmtIst(preferredAt))}</strong> (this is a request and is not yet confirmed).</p>`),
  }),
  enquiryAssigned: ({ staffName, enquiry }) => ({
    subject: `New enquiry assigned: ${enquiry.name}`,
    text: `Hi ${staffName}, an enquiry from ${enquiry.name} (${enquiry.email}, ${enquiry.phone}) was assigned to you. Goal: ${enquiry.goal}.`,
    html: wrap('Enquiry assigned to you', `<p>Hi ${esc(staffName)},</p><p><strong>${esc(enquiry.name)}</strong> (${esc(enquiry.email)}, ${esc(enquiry.phone)})</p><p>Goal: ${esc(enquiry.goal)}</p><p>Preferred time: ${esc(fmtIst(enquiry.preferredAt))}</p><p>Please follow up from the admin portal.</p>`),
  }),
  welcome: ({ name }) => ({
    subject: 'Welcome to Anaa Nutricare',
    text: `Hi ${name}, welcome to Anaa Nutricare. You can now log in to book consultations, see your diet plans and track your progress.`,
    html: wrap('Welcome to Anaa Nutricare', `<p>Hi ${esc(name)},</p><p>Your account is ready. Log in to book consultations, see your diet plans and track your progress.</p>`),
  }),
  passwordReset: ({ name, link }) => ({
    subject: 'Reset your Anaa Nutricare password',
    text: `Hi ${name}, use this link to choose a new password (valid for 1 hour): ${link}. If you did not ask for this, you can ignore this email.`,
    html: wrap('Reset your password', `<p>Hi ${esc(name)},</p><p><a href="${esc(link)}">Choose a new password</a>. The link works for one hour and can be used once.</p><p>If you did not ask for this, you can ignore this email.</p>`),
  }),
  appointmentConfirmed: ({ name, startsAt, durationMinutes }) => ({
    subject: 'Your consultation is booked',
    text: `Hi ${name}, your consultation is booked for ${fmtIst(startsAt)} (${durationMinutes} minutes).`,
    html: wrap('Consultation booked', `<p>Hi ${esc(name)},</p><p>Your consultation is booked for <strong>${esc(fmtIst(startsAt))}</strong> (${esc(durationMinutes)} minutes).</p><p>You can see or cancel it in your portal.</p>`),
  }),
  appointmentAssigned: ({ name, customerName, startsAt, durationMinutes, mode }) => ({
    subject: 'A consultation was assigned to you',
    text: `Hi ${name}, a ${String(mode).toLowerCase()} consultation with ${customerName} is scheduled for ${fmtIst(startsAt)} (${durationMinutes} minutes). Open the Appointments page in the admin portal to join.`,
    html: wrap('Consultation assigned', `<p>Hi ${esc(name)},</p><p>A ${esc(String(mode).toLowerCase())} consultation with <strong>${esc(customerName)}</strong> is scheduled for <strong>${esc(fmtIst(startsAt))}</strong> (${esc(durationMinutes)} minutes).</p><p>Open <em>Appointments</em> in the admin portal to join when the room opens.</p>`),
  }),
  appointmentCancelled: ({ name, startsAt, returned, byClinic }) => ({
    subject: 'Your consultation was cancelled',
    text: `Hi ${name}, the consultation on ${fmtIst(startsAt)} was cancelled${byClinic ? ' by the clinic' : ''}. ${returned ? 'The consultation has been returned to your package.' : 'It was cancelled too close to the time, so it was not returned.'}`,
    html: wrap('Consultation cancelled', `<p>Hi ${esc(name)},</p><p>The consultation on <strong>${esc(fmtIst(startsAt))}</strong> was cancelled${byClinic ? ' by the clinic' : ''}.</p><p>${returned ? 'It has been returned to your package, so you can book another time.' : 'It was cancelled too close to the start time, so it was not returned to your package.'}</p>`),
  }),
  dietPlanReady: ({ name, title }) => ({
    subject: 'Your new diet plan is ready',
    text: `Hi ${name}, your nutritionist added a diet plan: ${title}. Log in to your portal to download it.`,
    html: wrap('Your diet plan is ready', `<p>Hi ${esc(name)},</p><p>Your nutritionist added a new diet plan: <strong>${esc(title)}</strong>.</p><p>Log in to your portal to download it.</p>`),
  }),
  verifyEmail: ({ name, link }) => ({
    subject: 'Verify your email for Anaa Nutricare',
    text: `Hi ${name}, please confirm your email address to finish setting up your account (and start earning Log & Earn points): ${link}`,
    html: wrap('Verify your email', `<p>Hi ${esc(name)},</p><p>Please confirm your email address to finish setting up your account.</p><p><a href="${esc(link)}">Verify my email</a></p><p>The link works for 48 hours.</p>`),
  }),
  rewardEarned: ({ name, points, reason, expiresAt, balance }) => ({
    subject: `You earned ${points} Log & Earn points`,
    text: `Hi ${name}, you earned ${points} points (${reason}). Your balance is ${balance} points.${expiresAt ? ` These points expire on ${fmtIst(expiresAt)}.` : ''}`,
    html: wrap('You earned reward points', `<p>Hi ${esc(name)},</p><p>You earned <strong>${esc(points)} points</strong> for: ${esc(reason)}.</p><p>Your balance is <strong>${esc(balance)} points</strong>.</p>${expiresAt ? `<p>These points expire at the end of the month (${esc(fmtIst(expiresAt))}).</p>` : ''}`),
  }),
  referralInvite: ({ referrerName, link, expiresAt, points }) => ({
    subject: `${referrerName} invited you to Anaa Nutricare`,
    text: `${referrerName} thinks you would like personalised nutrition care at Anaa Nutricare. Create your account with this email address using this link (valid until ${fmtIst(expiresAt)}): ${link}`,
    html: wrap('You have been invited', `<p><strong>${esc(referrerName)}</strong> invited you to Anaa Nutricare, personalised nutrition care with certified nutritionists.</p><p><a href="${esc(link)}">Create your account</a> using this email address.</p><p>The invitation is valid until ${esc(fmtIst(expiresAt))} and only works with the email address it was sent to.</p>`),
  }),
  referralRewardCredited: ({ name, points, balance }) => ({
    subject: `Your referral earned ${points} points`,
    text: `Hi ${name}, a friend you invited completed their first paid consultation, so we added ${points} points. Your balance is ${balance} points.`,
    html: wrap('Your referral reward', `<p>Hi ${esc(name)},</p><p>A friend you invited completed their first paid consultation, so we added <strong>${esc(points)} points</strong> to your wallet.</p><p>Your balance is <strong>${esc(balance)} points</strong>.</p>`),
  }),
  pointsExpiringSoon: ({ name, points, expiresAt }) => ({
    subject: `${points} reward points expire soon`,
    text: `Hi ${name}, ${points} of your points expire on ${fmtIst(expiresAt)}. Use them on your next package before then; unused points do not carry forward.`,
    html: wrap('Your points expire soon', `<p>Hi ${esc(name)},</p><p><strong>${esc(points)} points</strong> expire on ${esc(fmtIst(expiresAt))}. Use them at checkout before then. Unused points do not carry forward to next month.</p>`),
  }),
  redemptionSuccessful: ({ name, points, discountPaise, balance }) => ({
    subject: 'Reward points used on your order',
    text: `Hi ${name}, you used ${points} points and saved ₹${(discountPaise / 100).toLocaleString('en-IN')}. Your balance is ${balance} points.`,
    html: wrap('Points redeemed', `<p>Hi ${esc(name)},</p><p>You used <strong>${esc(points)} points</strong> and saved <strong>₹${esc((discountPaise / 100).toLocaleString('en-IN'))}</strong>.</p><p>Your balance is ${esc(balance)} points.</p>`),
  }),
  rewardReversal: ({ name, points, lost, reason }) => ({
    subject: 'Reward points returned',
    text: `Hi ${name}, ${reason}. ${points} points were returned to your wallet.${lost ? ` ${lost} points had already expired and could not be returned.` : ''}`,
    html: wrap('Points returned', `<p>Hi ${esc(name)},</p><p>${esc(reason)}. <strong>${esc(points)} points</strong> were returned to your wallet.</p>${lost ? `<p>${esc(lost)} points had already expired and could not be returned.</p>` : ''}`),
  }),
};

// Group yoga e-mails live with their module.
Object.assign(templates, yogaTemplates, meetTemplates);
