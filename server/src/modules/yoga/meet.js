// Only genuine Google Meet room links are accepted: https://meet.google.com/abc-defg-hij (query string dropped).
export function normalizeMeetLink(input) {
  let u;
  try { u = new URL(String(input).trim()); } catch { return null; }
  if (u.protocol !== 'https:' || u.hostname !== 'meet.google.com' || u.username || u.password || u.port) return null;
  if (!/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u.pathname)) return null;
  return `https://meet.google.com${u.pathname}`;
}
