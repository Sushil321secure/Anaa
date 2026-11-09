import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Alert, ConfirmDialog, EmptyState, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { selectUser } from '../features/auth/authSlice.js';
import { clearStaffAction, fetchDietitians, fetchStaffAppointments, selectStaff, updateStaffAppointment } from '../features/staff/staffSlice.js';
import JoinConsultation, { isLiveOrUpcoming } from '../components/JoinConsultation.jsx';
import JoinGoogleMeet, { MethodLabel, isMeet } from '../components/JoinGoogleMeet.jsx';
import MeetLinkEditor from '../components/MeetLinkEditor.jsx';
import { fmtDateTime } from '../utils/format.js';

const VIEWS = { upcoming: 'Upcoming', past: 'Past and closed', all: 'Everything' };

export default function AdminAppointments() {
  useDocumentMeta('Appointments | Anaa Admin');
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { appointments, dietitians, action } = useSelector(selectStaff);
  const callWindow = appointments.callWindow;
  const [view, setView] = useState('upcoming');
  const [toCancel, setToCancel] = useState(null);
  const [notesFor, setNotesFor] = useState({});

  const reload = useCallback(() => {
    const now = new Date().toISOString();
    const params = view === 'upcoming' ? { from: new Date(Date.now() - 4 * 3600 * 1000).toISOString() } : view === 'past' ? { to: now } : {};
    dispatch(fetchStaffAppointments(params));
  }, [dispatch, view]);
  useEffect(reload, [reload]);
  useEffect(() => { dispatch(fetchDietitians()); return () => { dispatch(clearStaffAction()); }; }, [dispatch]);

  const update = (id, changes) => dispatch(updateStaffAppointment({ id, changes }));
  const isDiet = user.role === 'DIETITIAN';
  const shown = view === 'upcoming' ? appointments.items.filter((a) => isLiveOrUpcoming(a, callWindow)) : appointments.items;

  return (
    <>
      <PageHeader title="Appointments" subtitle="All booked consultations (times in IST). Assign a dietitian, add a video link, and close each consultation." />
      <div className="toolbar">
        <select aria-label="Show" value={view} onChange={(e) => setView(e.target.value)}>{Object.entries(VIEWS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <Alert kind="ok">{action.status === 'done' ? action.message : null}</Alert>
      <Alert>{action.status === 'failed' ? action.error?.message : appointments.status === 'failed' ? appointments.error?.message : null}</Alert>
      {appointments.status === 'loading' && !appointments.items.length ? <Loading /> : shown.length === 0 ? (
        <section className="panel"><EmptyState icon="calendar" title="No appointments" text="Nothing matches this view." /></section>
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>When</th><th>Customer</th><th>Dietitian</th><th>Status</th><th>Video link and notes</th><th>Actions</th></tr></thead>
              <tbody>
                {shown.map((a) => {
                  const open = ['CONFIRMED', 'IN_PROGRESS'].includes(a.status);
                  const draft = notesFor[a._id] ?? { meetingUrl: a.meetingUrl || '', staffNotes: a.staffNotes || '' };
                  return (
                    <tr key={a._id}>
                      <td data-label="When" className="nowrap"><strong>{fmtDateTime(a.startsAt)}</strong><br /><small className="muted">{a.durationMinutes} min</small><br /><MethodLabel appointment={a} /></td>
                      <td data-label="Customer"><Link to={`/admin/customers/${a.customer?._id}`}>{a.customer?.name}</Link><br /><small className="muted">{a.customer?.phone || a.customer?.email}</small>{a.notes && <><br /><small>“{a.notes}”</small></>}</td>
                      <td data-label="Dietitian">
                        {open ? (
                          <select aria-label="Assign dietitian" value={a.dietitian?._id || ''} onChange={(e) => update(a._id, { dietitianId: e.target.value || null })} disabled={isDiet && !!a.dietitian && a.dietitian._id !== user._id}>
                            <option value="">Unassigned</option>
                            {dietitians.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                          </select>
                        ) : (a.dietitian?.name || '—')}
                      </td>
                      <td data-label="Status"><StatusBadge status={a.status} /></td>
                      <td data-label="Video link and notes" className="cell-wide">
                        {isMeet(a) && open && (isDiet ? a.dietitian?._id === user._id : ['OWNER', 'ADMIN'].includes(user.role)) && a.dietitian && <MeetLinkEditor appointment={a} onSaved={reload} />}
                        {isMeet(a) && open && !a.dietitian && <p className="muted" style={{ margin: '0 0 6px' }}>Assign a dietitian, then they add the Google Meet link here.</p>}
                        <input aria-label="Video link" placeholder="https://… video link" value={draft.meetingUrl} onChange={(e) => setNotesFor({ ...notesFor, [a._id]: { ...draft, meetingUrl: e.target.value } })} style={{ width: '100%', marginBottom: 6 }} />
                        <input aria-label="Staff notes" placeholder="Internal notes" value={draft.staffNotes} onChange={(e) => setNotesFor({ ...notesFor, [a._id]: { ...draft, staffNotes: e.target.value } })} style={{ width: '100%' }} />
                        {(draft.meetingUrl !== (a.meetingUrl || '') || draft.staffNotes !== (a.staffNotes || '')) && (
                          <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => { update(a._id, draft); setNotesFor((n) => { const { [a._id]: _drop, ...rest } = n; return rest; }); }}>Save</button>
                        )}
                      </td>
                      <td data-label="Actions" className="actions">
                        {a.dietitian?._id === user._id && (isMeet(a) ? <JoinGoogleMeet appointment={a} win={callWindow} staff /> : <JoinConsultation appointment={a} win={callWindow} to={`/consultation/${a._id}`} />)}
                        {open && <button type="button" className="btn btn-primary btn-sm" onClick={() => update(a._id, { status: 'COMPLETED' })}>Complete</button>}
                        {a.status === 'CONFIRMED' && <button type="button" className="btn btn-outline btn-sm" onClick={() => update(a._id, { status: 'NO_SHOW' })}>No-show</button>}
                        {open && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setToCancel(a)}>Cancel</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {toCancel && (
        <ConfirmDialog
          danger
          title="Cancel this consultation?"
          text={`${toCancel.customer?.name}, ${fmtDateTime(toCancel.startsAt)}. The consultation goes back into the customer's package and they are emailed.`}
          confirmLabel="Cancel consultation"
          busy={action.status === 'loading'}
          onConfirm={async () => { await update(toCancel._id, { status: 'CANCELLED' }); setToCancel(null); }}
          onCancel={() => setToCancel(null)}
        />
      )}
    </>
  );
}
