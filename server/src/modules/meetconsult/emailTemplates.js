const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const wrap = (title, body) => `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2 style="color:#5b1f9e">${esc(title)}</h2>${body}<p style="color:#777;font-size:12px">Anaa Nutricare – Good Nutrition. Better Life.</p></div>`;
const fmtIst = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST';
const HOW = 'Log in to Anaa Nutricare, open Appointments and press Join Google Meet (it unlocks shortly before the start).';

// Sent when the dietitian adds or changes the Google Meet link. The link is not in the e-mail: people log in to get it.
export const meetTemplates = {
  consultMeetLink: ({ name, dietitianName, startsAt, durationMinutes, updated }) => ({
    subject: updated ? 'Your Google Meet link was updated' : 'Your Google Meet link is ready',
    text: `Hi ${name}, ${dietitianName} ${updated ? 'updated' : 'added'} the Google Meet link for your online consultation on ${fmtIst(startsAt)} (${durationMinutes} minutes). ${HOW}`,
    html: wrap(updated ? 'Your Google Meet link was updated' : 'Your Google Meet link is ready', `<p>Hi ${esc(name)},</p><p>${esc(dietitianName)} ${updated ? 'updated' : 'added'} the Google Meet link for your online consultation on <strong>${esc(fmtIst(startsAt))}</strong> (${esc(durationMinutes)} minutes).</p><p>${esc(HOW)}</p>`),
  }),
};
