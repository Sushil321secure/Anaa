import { useEffect, useState } from 'react';
import { Alert, FormRow } from '../../components/ui.jsx';
import { yoga } from '../../features/yoga/yogaApi.js';
import { CATEGORIES, LEVEL_LABEL, browserZone, zones } from './yogaUtils.js';

const toLocalInput = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const blank = () => ({ title: '', description: '', coachId: '', category: 'Hatha', difficultyLevel: 'ALL_LEVELS', sessionDate: '', startTime: '07:00', timezone: browserZone(), durationMinutes: 45, maxParticipants: 20, price: 0, bookingOpensAt: '', bookingClosesAt: '' });

// Create or edit a yoga session. Times are entered in the session's own timezone; the server stores UTC.
export default function SessionForm({ session, onClose, onSaved }) {
  const [f, setF] = useState(() => (session
    ? { ...blank(), ...session, coachId: session.coach?._id || session.coach || '', price: session.pricePaise / 100, bookingOpensAt: toLocalInput(session.bookingOpensAt), bookingClosesAt: toLocalInput(session.bookingClosesAt) }
    : blank()));
  const [coaches, setCoaches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErr, setFieldErr] = useState({});
  const [publishNow, setPublishNow] = useState(true);
  useEffect(() => { yoga.dietitians().then((r) => setCoaches(r.items)).catch(() => {}); }, []);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const num = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value === '' ? '' : Number(e.target.value) }));

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (f.title.trim().length < 3) errs.title = 'Enter a title (at least 3 characters).';
    if (!f.coachId) errs.coachId = 'Choose a coach.';
    if (!f.sessionDate) errs.sessionDate = 'Choose a date.';
    if (!(f.durationMinutes >= 10)) errs.durationMinutes = 'At least 10 minutes.';
    if (!(f.maxParticipants >= 1 && f.maxParticipants <= 100)) errs.maxParticipants = 'Between 1 and 100 (the free Google Meet limit).';
    if (!(f.price >= 0)) errs.price = 'Enter 0 for a free session.';
    setFieldErr(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    const body = {
      title: f.title, description: f.description, coachId: f.coachId, category: f.category, difficultyLevel: f.difficultyLevel,
      sessionDate: f.sessionDate, startTime: f.startTime, timezone: f.timezone, durationMinutes: Number(f.durationMinutes), maxParticipants: Number(f.maxParticipants),
      pricePaise: Math.round(Number(f.price) * 100),
      bookingOpensAt: f.bookingOpensAt ? new Date(f.bookingOpensAt).toISOString() : null,
      bookingClosesAt: f.bookingClosesAt ? new Date(f.bookingClosesAt).toISOString() : null,
    };
    try {
      if (session) { onSaved(await yoga.update(session._id, body)); return; }
      const created = await yoga.create(body);
      let published = false;
      if (publishNow) {
        try { await yoga.status(created.session._id, 'publish'); published = true; } catch (err) { created.warnings = [...(created.warnings || []), `Created as a draft because publishing failed: ${err.message}`]; }
      }
      onSaved({ ...created, published });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" role="presentation" onClick={onClose}>
      <form className="modal wide" role="dialog" aria-modal="true" aria-label={session ? 'Edit yoga session' : 'Create yoga session'} onClick={(e) => e.stopPropagation()} onSubmit={submit} noValidate>
        <h2>{session ? 'Edit yoga session' : 'Create yoga session'}</h2>
        <Alert>{error}</Alert>
        <div className="form-grid">
          <div className="span-2"><FormRow label="Title" id="ys-title" error={fieldErr.title}><input id="ys-title" value={f.title} onChange={set('title')} maxLength={120} /></FormRow></div>
          <div className="span-2"><FormRow label="Description" id="ys-desc"><textarea id="ys-desc" rows={3} value={f.description} onChange={set('description')} maxLength={2000} /></FormRow></div>
          <FormRow label="Coach" id="ys-coach" error={fieldErr.coachId}>
            <select id="ys-coach" value={f.coachId} onChange={set('coachId')}><option value="">Choose a coach…</option>{coaches.map((c) => <option key={c._id} value={c._id}>{c.email ? `${c.name} (${c.email})` : c.name}</option>)}</select>
          </FormRow>
          <FormRow label="Category" id="ys-cat"><select id="ys-cat" value={f.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></FormRow>
          <FormRow label="Difficulty" id="ys-lvl"><select id="ys-lvl" value={f.difficultyLevel} onChange={set('difficultyLevel')}>{Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></FormRow>
          <FormRow label="Timezone of the session" id="ys-tz" hint="Date and time below are in this zone. Participants see their own local time.">
            <input id="ys-tz" list="ys-zones" value={f.timezone} onChange={set('timezone')} /><datalist id="ys-zones">{zones().map((z) => <option key={z} value={z} />)}</datalist>
          </FormRow>
          <FormRow label="Date" id="ys-date" error={fieldErr.sessionDate}><input id="ys-date" type="date" value={f.sessionDate} onChange={set('sessionDate')} /></FormRow>
          <FormRow label="Start time" id="ys-time"><input id="ys-time" type="time" value={f.startTime} onChange={set('startTime')} /></FormRow>
          <FormRow label="Duration (minutes)" id="ys-dur" error={fieldErr.durationMinutes} hint={f.durationMinutes > 60 ? 'Free Google Meet ends group calls after 60 minutes.' : undefined}><input id="ys-dur" type="number" min="10" max="300" value={f.durationMinutes} onChange={num('durationMinutes')} /></FormRow>
          <FormRow label="Maximum participants" id="ys-max" error={fieldErr.maxParticipants}><input id="ys-max" type="number" min="1" max="100" value={f.maxParticipants} onChange={num('maxParticipants')} /></FormRow>
          <FormRow label="Price (₹, 0 = free)" id="ys-price" error={fieldErr.price}><input id="ys-price" type="number" min="0" step="1" value={f.price} onChange={num('price')} /></FormRow>
          <span />
          <FormRow label="Booking opens (optional)" id="ys-open"><input id="ys-open" type="datetime-local" value={f.bookingOpensAt} onChange={set('bookingOpensAt')} /></FormRow>
          <FormRow label="Booking closes (optional)" id="ys-close"><input id="ys-close" type="datetime-local" value={f.bookingClosesAt} onChange={set('bookingClosesAt')} /></FormRow>
        </div>
        {!session && (
          <label className="check" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
            <span>Publish right away (participants can see and book it at once). Untick to keep it as a draft.</span>
          </label>
        )}
        <div className="actions-row">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : session ? 'Save changes' : 'Create session'}</button>
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </form>
    </div>
  );
}
