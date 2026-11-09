// Appointment times are stored in UTC and generated/validated in Indian Standard Time (UTC+5:30, no DST).
const IST_MS = 330 * 60 * 1000;

export const istDateString = (d) => {
  const t = new Date(d.getTime() + IST_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};
export const istToUtc = (y, m, d, h, min) => new Date(Date.UTC(y, m, d, h, min) - IST_MS);

/** All bookable start times (UTC Dates) on an IST calendar date, after applying working days, hours and notice. */
export function slotsForDate(dateStr, cfg, now = new Date()) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  if (!cfg.days.includes(dow)) return [];
  const out = [];
  const endMin = cfg.endHour * 60;
  for (let m = cfg.startHour * 60; m + cfg.slotMinutes <= endMin; m += cfg.slotMinutes) {
    out.push(istToUtc(y, mo - 1, d, Math.floor(m / 60), m % 60));
  }
  const earliest = now.getTime() + cfg.minNoticeHours * 3600 * 1000;
  const latest = now.getTime() + cfg.maxDaysAhead * 24 * 3600 * 1000;
  return out.filter((s) => s.getTime() >= earliest && s.getTime() <= latest);
}

export const isValidSlot = (startsAt, cfg, now = new Date()) =>
  slotsForDate(istDateString(startsAt), cfg, now).some((s) => s.getTime() === startsAt.getTime());
