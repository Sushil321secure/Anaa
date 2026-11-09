import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { api } from '../services/api.js';
import { windowState } from './JoinConsultation.jsx';

export const isMeet = (a) => a.provider === 'GOOGLE_MEET';

/** Small label for how an online consultation is held. Appointments saved before this option existed count as the in-app room. */
export function MethodLabel({ appointment: a }) {
  if (a.mode === 'OFFLINE') return null;
  return <span className={`badge ${isMeet(a) ? 'badge-info' : 'badge-neutral'}`}>{isMeet(a) ? 'Google Meet' : 'In-app video'}</span>;
}

const human = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
};

/**
 * Join Google Meet button for one appointment, for the customer or the assigned dietitian. Follows the same joining window as the
 * in-app room. The link is fetched from the server at the moment of joining and is never kept on the page.
 * `staff` changes the wording when the link is still missing.
 */
export default function JoinGoogleMeet({ appointment: a, win, staff = false }) {
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!isMeet(a) || a.mode === 'OFFLINE' || !['CONFIRMED', 'IN_PROGRESS'].includes(a.status)) return null;
  if (!a.dietitian) return staff ? null : <p className="muted join-note">A dietitian will be assigned before your consultation.</p>;
  const w = windowState(a, win, now);
  if (w.state === 'CLOSED') return null;
  const ready = a.meetLinkStatus === 'ADDED';

  async function join() {
    setBusy(true); setError(null);
    try {
      const { meetingLink } = await api(`/consultation-meet/${a._id}/join`);
      window.open(meetingLink, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="join-box">
      {w.state === 'EARLY'
        ? <span className="join-count"><Icon name="clock" size={16} /> {w.start - now > win.joinBeforeMinutes * 60000 ? `Starts in ${human(w.start - now)}` : `Opens in ${human(w.opensAt - now)}`}</span>
        : <span className="join-count live"><Icon name="video" size={16} /> {w.start > now ? `Starts in ${human(w.start - now)}` : 'In progress'}</span>}
      {ready ? (
        <button type="button" className={`btn btn-sm ${w.state === 'OPEN' ? 'btn-primary' : 'btn-outline'}`} disabled={w.state !== 'OPEN' || busy} onClick={join}
          title={w.state === 'EARLY' ? `Joining opens ${win.joinBeforeMinutes} minutes before the start` : undefined}>
          {busy ? 'Opening…' : 'Join Google Meet'}
        </button>
      ) : (
        <p className="muted join-note">{staff ? 'Add the Google Meet link so the customer can join.' : 'Your dietitian has not added the Google Meet link yet. We will e-mail you when it is ready.'}</p>
      )}
      {error && <p className="join-note" role="alert" style={{ color: '#b3261e' }}>{error}</p>}
    </div>
  );
}
