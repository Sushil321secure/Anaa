import { useState } from 'react';
import { Badge } from './ui.jsx';
import { api } from '../services/api.js';
import { fmtDateTime } from '../utils/format.js';

/** Dietitian (or admin) pastes or replaces the Google Meet link of one appointment. The saved link is never shown again here. */
export default function MeetLinkEditor({ appointment: a, onSaved }) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const ready = a.meetLinkStatus === 'ADDED';

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError(null); setDone(false);
    try {
      await api(`/consultation-meet/${a._id}/link`, { method: 'PATCH', body: { meetLink: link } });
      setLink(''); setDone(true);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="meet-editor" onSubmit={save} noValidate>
      <p style={{ margin: '0 0 6px' }}>
        <strong>Google Meet link:</strong> {ready ? <Badge tone="ok">Available</Badge> : <Badge tone="warn">Pending</Badge>}
        {ready && a.meetLinkUpdatedAt && <small className="muted"> · updated {fmtDateTime(a.meetLinkUpdatedAt)}</small>}
      </p>
      <input aria-label="Google Meet link" type="url" inputMode="url" autoComplete="off" placeholder="https://meet.google.com/abc-defg-hij" value={link} onChange={(e) => setLink(e.target.value)} style={{ width: '100%', marginBottom: 6 }} />
      <button type="submit" className="btn btn-outline btn-sm" disabled={busy || !link.trim()}>{busy ? 'Saving…' : ready ? 'Update link' : 'Save link'}</button>
      {error && <p role="alert" style={{ color: '#b3261e', margin: '6px 0 0' }}>{error}</p>}
      {done && <p role="status" style={{ color: '#2e6b25', margin: '6px 0 0' }}>Link saved. The customer was e-mailed.</p>}
    </form>
  );
}
