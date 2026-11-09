// All dates are stored in UTC and shown in Indian Standard Time.
const IST = 'Asia/Kolkata';

export const inr = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const fmtDate = (d, opts) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric', ...opts }) : '—');
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true }) : '—');
export const fmtDateTime = (d) => (d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—');
export const fmtWeekday = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short' });

/** Today's date in IST as YYYY-MM-DD (for date inputs and the slot picker). */
export const istToday = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
export const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export const fmtBytes = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const ROLE_LABEL = { OWNER: 'Owner', ADMIN: 'Admin', DIETITIAN: 'Dietitian', OPERATIONS: 'Operations', CUSTOMER: 'Customer' };
export const STATUS_LABEL = { CONFIRMED: 'Confirmed', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'No-show' };
