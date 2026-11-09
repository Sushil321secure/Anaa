// Wall-clock time in an IANA timezone <-> UTC, without a date library.
export function validTimezone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return typeof tz === 'string' && tz.length < 60; } catch { return false; }
}
function offsetMinutes(utcMs, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000) / 60000;
}
/** "2026-12-01" + "18:30" in "Asia/Kolkata" -> Date (UTC instant). Returns null for impossible wall times. */
export function zonedToUtc(date, time, tz) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let utc = wall - offsetMinutes(wall, tz) * 60000;
  utc = wall - offsetMinutes(utc, tz) * 60000; // second pass settles DST edges
  const back = new Date(utc + offsetMinutes(utc, tz) * 60000);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || back.getUTCHours() !== h || back.getUTCMinutes() !== mi) return null; // e.g. 31 Feb or a DST gap
  return new Date(utc);
}
export const fmtInZone = (date, tz) => new Date(date).toLocaleString('en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }) + ` (${tz})`;
