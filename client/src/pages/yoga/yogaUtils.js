// Times are stored in UTC with the session's own timezone. Participants see their local time; the original zone stays visible.
export const localTime = (d) => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
export const originalTime = (d, tz) => {
  try { return new Date(d).toLocaleString('en-GB', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) + ` · ${tz}`; } catch { return tz; }
};
export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
export const sameZone = (tz) => tz === browserZone();
export const zones = () => (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC', 'Asia/Kolkata']);
export const rupees = (paise) => (paise ? `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'Free');

export const SESSION_LABEL = { draft: 'Draft', awaiting_meeting_link: 'Awaiting link', scheduled: 'Scheduled', ongoing: 'Ongoing', completed: 'Completed', cancelled: 'Cancelled' };
export const SESSION_TONE = { draft: 'neutral', awaiting_meeting_link: 'warn', scheduled: 'info', ongoing: 'ok', completed: 'ok', cancelled: 'off' };
export const BOOKING_LABEL = { pending: 'Awaiting payment', confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed' };
export const BOOKING_TONE = { pending: 'warn', confirmed: 'info', cancelled: 'off', completed: 'ok' };
export const PAY_LABEL = { not_required: 'Free', pending: 'Pending', paid: 'Paid', failed: 'Not paid', refund_due: 'Refund due' };
export const LEVEL_LABEL = { BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced', ALL_LEVELS: 'All levels' };
export const CATEGORIES = ['Hatha', 'Vinyasa', 'Ashtanga', 'Yin', 'Restorative', 'Prenatal', 'Pranayama & Meditation', 'Therapeutic', 'Other'];
export const MEET_HELP = [
  'Open https://meet.google.com/',
  'Sign in using the Google account that will host the session.',
  'Select New meeting.',
  'Select Create a meeting for later.',
  'Copy the generated meeting link.',
  'Return here and paste the link below.',
  'Save the link.',
];
