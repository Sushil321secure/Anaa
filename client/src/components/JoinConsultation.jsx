import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

// Same rule as the server (server/src/modules/consultations/window.js); the server stays the authority when the room is entered.
export function windowState(a, win, now = Date.now()) {
  const start = new Date(a.startsAt).getTime();
  const opensAt = start - win.joinBeforeMinutes * 60000;
  const closesAt = start + (a.durationMinutes + win.graceAfterMinutes) * 60000;
  return { state: now < opensAt ? 'EARLY' : now > closesAt ? 'CLOSED' : 'OPEN', opensAt, closesAt, start };
}
export const isLiveOrUpcoming = (a, win, now = Date.now()) => ['CONFIRMED', 'IN_PROGRESS'].includes(a.status) && (a.mode === 'OFFLINE' ? new Date(a.startsAt).getTime() > now : windowState(a, win, now).state !== 'CLOSED');

function human(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Countdown + Join button for one online appointment. `to` is the room URL, `needsDietitian` hides it until one is assigned. */
export default function JoinConsultation({ appointment: a, win, to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (a.mode === 'OFFLINE' || !['CONFIRMED', 'IN_PROGRESS'].includes(a.status)) return null;
  if (!a.dietitian) return <p className="muted join-note">A dietitian will be assigned before your consultation.</p>;
  const w = windowState(a, win, now);
  if (w.state === 'CLOSED') return null;
  if (w.state === 'EARLY') {
    return (
      <div className="join-box">
        <span className="join-count"><Icon name="clock" size={16} /> {w.start - now > win.joinBeforeMinutes * 60000 ? `Starts in ${human(w.start - now)}` : `Room opens in ${human(w.opensAt - now)}`}</span>
        <button type="button" className="btn btn-outline btn-sm" disabled title={`The room opens ${win.joinBeforeMinutes} minutes before the start`}>Join consultation</button>
      </div>
    );
  }
  return (
    <div className="join-box">
      <span className="join-count live"><Icon name="video" size={16} /> {w.start > now ? `Starts in ${human(w.start - now)}` : 'In progress'}</span>
      <Link to={to} className="btn btn-primary btn-sm">Join consultation</Link>
    </div>
  );
}
