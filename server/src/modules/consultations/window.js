// Pure join-window rules for an online consultation (no DB, so they can be unit-tested).
export const JOINABLE_STATUSES = ['CONFIRMED', 'IN_PROGRESS'];

/**
 * state: 'EARLY' (opens later), 'OPEN', 'CLOSED' (past end + grace).
 * opensAt = start - joinBeforeMinutes; closesAt = start + duration + graceAfterMinutes.
 */
export function joinWindow(appt, cfg, now = new Date()) {
  const start = new Date(appt.startsAt).getTime();
  const opensAt = new Date(start - cfg.joinBeforeMinutes * 60000);
  const closesAt = new Date(start + (appt.durationMinutes + cfg.graceAfterMinutes) * 60000);
  const t = now.getTime();
  const state = t < opensAt.getTime() ? 'EARLY' : t > closesAt.getTime() ? 'CLOSED' : 'OPEN';
  return { state, opensAt, closesAt };
}
