import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Alert, Badge, ConfirmDialog, EmptyState, Loading, PageHeader } from '../../components/ui.jsx';
import useDocumentMeta from '../../hooks/useDocumentMeta.js';
import { selectUser } from '../../features/auth/authSlice.js';
import { openMeeting, yoga } from '../../features/yoga/yogaApi.js';
import SessionForm from './SessionForm.jsx';
import { BookingBadge, SessionBadge, Times, level } from './YogaParts.jsx';
import { CATEGORIES, LEVEL_LABEL, MEET_HELP, PAY_LABEL, rupees } from './yogaUtils.js';

// Staff view of one session: Google Meet setup, participants, attendance, notes and the session lifecycle.
export default function YogaSessionDetail() {
  useDocumentMeta('Yoga session | Anaa Admin');
  const { id } = useParams();
  const user = useSelector(selectUser);
  const admin = ['OWNER', 'ADMIN'].includes(user.role);
  const [session, setSession] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [people, setPeople] = useState({ items: [], seatsTaken: 0 });
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [state, setState] = useState('loading');
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [editDetails, setEditDetails] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([yoga.session(id), yoga.participants(id)]);
      setSession(s.session); setWarnings(s.warnings || []); setPeople(p); setNotes((n) => n || s.session.coachNotes || ''); setState('ready');
    } catch (e) { setError(e.message); setState('failed'); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    setBusy(true); setError(null); setMsg(null);
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const mark = (bookingId, status) => run(() => yoga.attendance(id, [{ bookingId, status }]));
  const host = async () => { try { openMeeting((await yoga.staffJoin(id)).meetingLink); } catch (e) { setError(e.message); } };

  if (state === 'loading') return <Loading />;
  if (state === 'failed') return <section className="panel"><EmptyState icon="calendar" title="Session not found" text={error} action={<Link className="btn btn-outline" to="/admin/yoga">Back to yoga sessions</Link>} /></section>;

  const s = session;
  const closed = ['completed', 'cancelled'].includes(s.status);
  const started = new Date(s.startsAt) <= new Date();
  const confirmed = people.items.filter((b) => ['confirmed', 'completed'].includes(b.bookingStatus));
  const others = people.items.filter((b) => !['confirmed', 'completed'].includes(b.bookingStatus));

  return (
    <>
      <PageHeader title={s.title} subtitle={`${s.coach?.name} · ${s.category} · ${level(s.difficultyLevel)}`} actions={<Link className="btn btn-outline" to="/admin/yoga">All yoga sessions</Link>} />
      <Alert kind="ok">{msg}</Alert>
      <Alert>{error}</Alert>
      {warnings.map((w) => <Alert key={w} kind="info">{w}</Alert>)}
      {s.status === 'draft' && (
        <Alert kind="info">
          This session is a <b>draft</b>: participants cannot see or book it yet.
          {admin ? (new Date(s.startsAt) <= new Date() ? ' Its start time has passed, so use "Edit or reschedule" to pick a new time, then publish.' : ' Press Publish to open it for booking.') : ' Ask an admin to publish it once your Meet link is added.'}
        </Alert>
      )}

      <section className="panel">
        <div className="detail-grid">
          <div><p className="muted">When</p><p><Times session={s} /></p></div>
          <div><p className="muted">Duration</p><p>{s.durationMinutes} minutes</p></div>
          <div><p className="muted">Seats</p><p>{s.seatsTaken} of {s.maxParticipants} taken</p></div>
          <div><p className="muted">Price</p><p>{rupees(s.pricePaise)}</p></div>
          <div><p className="muted">Status</p><p><SessionBadge status={s.status} /></p></div>
        </div>
        {s.description && <p>{s.description}</p>}
        <div className="actions-row">
          {admin && s.status === 'draft' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => yoga.status(id, 'publish'), 'Session published.')}>Publish</button>}
          {s.status === 'scheduled' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => yoga.status(id, 'start'), 'Session marked as started.')}>Mark as started</button>}
          {['scheduled', 'ongoing'].includes(s.status) && started && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setConfirm('complete')}>Mark as completed</button>}
          {s.meetingLinkStatus === 'ADDED' && !closed && <button type="button" className="btn btn-outline" onClick={host}>Open Google Meet</button>}
          {admin && !closed && <button type="button" className="btn btn-outline" onClick={() => setEdit(true)}>Edit or reschedule</button>}
          {!admin && !closed && <button type="button" className="btn btn-outline" onClick={() => setEditDetails({ title: s.title, description: s.description || '', category: s.category, difficultyLevel: s.difficultyLevel })}>Edit details</button>}
          {admin && !closed && <button type="button" className="btn btn-ghost" onClick={() => setConfirm('cancel')}>Cancel session</button>}
        </div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Google Meet setup {s.meetingLinkStatus === 'ADDED' ? <Badge tone="ok">Link added</Badge> : <Badge tone="warn">Link missing</Badge>}</h2>
          <ol className="steps-list">{MEET_HELP.map((t) => <li key={t}>{t}</li>)}</ol>
          <form onSubmit={(e) => { e.preventDefault(); run(async () => { await yoga.setLink(id, link); setLink(''); }, s.status === 'draft' ? 'Meeting link saved. The session is still a draft, so an admin must publish it before participants can see it.' : 'Meeting link saved.'); }}>
            <div className="field">
              <label htmlFor="meet-link">{s.meetingLinkStatus === 'ADDED' ? 'Replace the meeting link' : 'Google Meet link'}</label>
              <input id="meet-link" type="url" inputMode="url" autoComplete="off" placeholder="https://meet.google.com/abc-defg-hij" value={link} onChange={(e) => setLink(e.target.value)} disabled={closed} />
              <p className="field-hint">Only meet.google.com room links are accepted. The saved link is never shown here again or to the public.</p>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || closed || !link.trim()}>Save link</button>
          </form>
          <p className="muted" style={{ marginTop: 12 }}>Tip: in Google Meet set access to <em>Trusted</em> or <em>Restricted</em>, so a forwarded link alone does not let strangers in.</p>
        </section>

        <section className="panel">
          <h2>Session notes</h2>
          <div className="field"><label htmlFor="coach-notes">Notes (visible to staff only)</label><textarea id="coach-notes" rows={6} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={() => run(() => yoga.setNotes(id, notes), 'Notes saved.')}>Save notes</button>
        </section>
      </div>

      <section className="panel">
        <h2>Participants ({confirmed.length})</h2>
        {!started && <p className="muted">Attendance can be marked once the session has started. It is recorded by hand, because Google Meet attendance is not tracked here.</p>}
        {confirmed.length === 0 ? <p className="muted">No confirmed participants yet.</p> : (
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Participant</th><th>Reference</th><th>Payment</th><th>Attendance</th></tr></thead>
              <tbody>
                {confirmed.map((b) => (
                  <tr key={b._id}>
                    <td data-label="Participant">{b.user?.name}<br /><small className="muted">{b.user?.email}</small></td>
                    <td data-label="Reference" className="nowrap">{b.bookingReference}</td>
                    <td data-label="Payment">{PAY_LABEL[b.paymentStatus]}</td>
                    <td data-label="Attendance" className="actions">
                      <button type="button" className={`btn btn-sm ${b.attendance === 'present' ? 'btn-primary' : 'btn-outline'}`} disabled={!started || busy || s.status === 'cancelled'} aria-pressed={b.attendance === 'present'} onClick={() => mark(b._id, b.attendance === 'present' ? 'unmarked' : 'present')}>Present</button>
                      <button type="button" className={`btn btn-sm ${b.attendance === 'absent' ? 'btn-primary' : 'btn-outline'}`} disabled={!started || busy || s.status === 'cancelled'} aria-pressed={b.attendance === 'absent'} onClick={() => mark(b._id, b.attendance === 'absent' ? 'unmarked' : 'absent')}>Absent</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {others.length > 0 && (
          <details style={{ marginTop: 14 }}>
            <summary>Cancelled and unpaid bookings ({others.length})</summary>
            <ul className="row-list">{others.map((b) => <li key={b._id} className="row-card"><div><h3>{b.user?.name}</h3><p className="muted">{b.bookingReference} · {PAY_LABEL[b.paymentStatus]}</p></div><BookingBadge status={b.bookingStatus} /></li>)}</ul>
          </details>
        )}
      </section>

      {editDetails && (
        <div className="modal-back" role="presentation" onClick={() => setEditDetails(null)}>
          <form className="modal wide" role="dialog" aria-modal="true" aria-label="Edit session details" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); run(async () => { await yoga.details(id, editDetails); setEditDetails(null); }, 'Details saved.'); }}>
            <h2>Edit session details</h2>
            <p className="muted">Coaches can change the title, description, category and level. The date, time, price and seats are set by an admin.</p>
            <div className="field"><label htmlFor="ed-title">Title</label><input id="ed-title" value={editDetails.title} maxLength={120} onChange={(e) => setEditDetails({ ...editDetails, title: e.target.value })} /></div>
            <div className="field"><label htmlFor="ed-desc">Description</label><textarea id="ed-desc" rows={4} maxLength={2000} value={editDetails.description} onChange={(e) => setEditDetails({ ...editDetails, description: e.target.value })} /></div>
            <div className="form-grid">
              <div className="field"><label htmlFor="ed-cat">Category</label><select id="ed-cat" value={editDetails.category} onChange={(e) => setEditDetails({ ...editDetails, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="field"><label htmlFor="ed-lvl">Difficulty</label><select id="ed-lvl" value={editDetails.difficultyLevel} onChange={(e) => setEditDetails({ ...editDetails, difficultyLevel: e.target.value })}>{Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            </div>
            <div className="actions-row"><button type="submit" className="btn btn-primary" disabled={busy || editDetails.title.trim().length < 3}>Save details</button><button type="button" className="btn btn-outline" onClick={() => setEditDetails(null)}>Close</button></div>
          </form>
        </div>
      )}
      {edit && <SessionForm session={s} onClose={() => setEdit(false)} onSaved={(r) => { setEdit(false); setMsg(`Session saved.${r.notified ? ' Booked participants were e-mailed about the new time.' : ''}`); load(); }} />}
      {confirm === 'complete' && (
        <ConfirmDialog title="Mark this session as completed?" text="Confirmed bookings become completed. Check attendance first: you can still change it afterwards." confirmLabel="Mark completed" busy={busy}
          onConfirm={async () => { await run(() => yoga.status(id, 'complete'), 'Session completed.'); setConfirm(null); }} onCancel={() => setConfirm(null)} />
      )}
      {confirm === 'cancel' && (
        <ConfirmDialog danger title="Cancel this session?" confirmLabel="Cancel session" busy={busy}
          text={<>All {people.seatsTaken} booking(s) are cancelled and the participants e-mailed. Paid bookings are marked for a refund.<span className="field" style={{ display: 'block', marginTop: 12 }}><label htmlFor="cancel-reason">Reason (shown to participants)</label><input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></span></>}
          onConfirm={async () => { await run(() => yoga.status(id, 'cancel', reason || undefined), 'Session cancelled.'); setConfirm(null); }} onCancel={() => setConfirm(null)} />
      )}
    </>
  );
}
