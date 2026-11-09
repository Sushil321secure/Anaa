import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Alert, Badge, EmptyState, Loading, PageHeader, StatCard } from '../../components/ui.jsx';
import useDocumentMeta from '../../hooks/useDocumentMeta.js';
import { selectUser } from '../../features/auth/authSlice.js';
import { yoga } from '../../features/yoga/yogaApi.js';
import SessionForm from './SessionForm.jsx';
import { BookingBadge, SessionBadge, Times } from './YogaParts.jsx';
import { PAY_LABEL, rupees } from './yogaUtils.js';

const TABS = ['Overview', 'Sessions', 'Bookings & attendance'];

function OverviewList({ title, hint, empty, items, action }) {
  return (
    <section className="panel">
      <h2>{title}{items?.length ? <> <Badge tone="warn">{items.length}</Badge></> : null}</h2>
      <p className="muted" style={{ marginTop: 0 }}>{hint}</p>
      {!items ? <Loading /> : items.length === 0 ? <p className="muted">{empty}</p> : (
        <ul className="row-list">
          {items.map((s) => (
            <li key={s._id} className="row-card">
              <div><h3>{s.title}</h3><p className="muted">{s.coach?.name} · <Times session={s} /></p></div>
              <div className="row-actions">{action?.(s)}<Link className="btn btn-outline btn-sm" to={`/admin/yoga/${s._id}`}>Open</Link></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// /admin/yoga: admins manage everything; a coach (dietitian) sees only their own sessions.
export default function AdminYoga() {
  useDocumentMeta('Yoga sessions | Anaa Admin');
  const user = useSelector(selectUser);
  const admin = ['OWNER', 'ADMIN'].includes(user.role);
  const [tab, setTab] = useState(admin ? 'Overview' : 'Sessions');
  const [when, setWhen] = useState('upcoming');
  const [status, setStatus] = useState('');
  const [sessions, setSessions] = useState({ items: [], status: 'loading' });
  const [overview, setOverview] = useState(null);
  const [bookings, setBookings] = useState({ items: [], status: 'idle' });
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const loadSessions = useCallback(() => {
    setSessions((s) => ({ ...s, status: 'loading' }));
    yoga.sessions({ when, status }).then((r) => setSessions({ items: r.items, status: 'ready' })).catch((e) => { setSessions({ items: [], status: 'failed' }); setError(e.message); });
  }, [when, status]);
  useEffect(loadSessions, [loadSessions]);
  const loadOverview = useCallback(() => { if (admin) yoga.overview().then(setOverview).catch(() => {}); }, [admin]);
  useEffect(loadOverview, [loadOverview, sessions.items]);
  useEffect(() => { if (tab === 'Overview') loadOverview(); }, [tab, loadOverview]);
  useEffect(() => {
    if (tab !== 'Bookings & attendance' || !admin) return;
    setBookings((b) => ({ ...b, status: 'loading' }));
    yoga.allBookings().then((r) => setBookings({ items: r.items, status: 'ready' })).catch((e) => { setBookings({ items: [], status: 'failed' }); setError(e.message); });
  }, [tab, admin]);

  const publish = async (id) => {
    setError(null);
    setMsg(null);
    try { await yoga.status(id, 'publish'); setMsg('Session published. Participants can now see and book it.'); loadSessions(); loadOverview(); } catch (e) { setError(e.message); }
  };

  return (
    <>
      <PageHeader
        title="Yoga sessions"
        subtitle={admin ? 'Online group yoga on Google Meet. Create sessions, assign coaches and follow bookings.' : 'Your assigned online group yoga sessions.'}
        actions={admin && <button type="button" className="btn btn-primary" onClick={() => setForm('new')}>Create yoga session</button>}
      />
      <Alert kind="ok">{msg}</Alert>
      <Alert>{error}</Alert>
      {admin && (
        <div className="tabs" role="tablist" aria-label="Yoga sections">
          {TABS.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      )}

      {tab === 'Overview' && admin && (
        <>
          <div className="stats">
            <StatCard icon="calendar" label="Upcoming sessions" value={overview?.upcoming ?? '…'} />
            <StatCard icon="users" label="Confirmed bookings" value={overview?.bookings ?? '…'} />
            <StatCard icon="video" tone="orange" label="Awaiting Meet link" value={overview?.awaitingLink ?? '…'} hint="Published, upcoming, no link yet" />
            <StatCard icon="check" tone="green" label="Completed sessions" value={overview?.completed ?? '…'} />
          </div>
          {overview?.refundDue > 0 && <Alert kind="info">{overview.refundDue} cancelled paid booking(s) are waiting for a manual refund. Refund them in Razorpay, then tell the participant.</Alert>}
          <OverviewList title="Ready to publish" empty="No drafts are waiting." hint="The coach added the Meet link, but participants cannot see these until you publish them."
            items={overview?.draftsReadyList} action={(s) => <button type="button" className="btn btn-primary btn-sm" onClick={() => publish(s._id)}>Publish</button>} />
          <OverviewList title="Needs a Google Meet link" empty="Every published upcoming session has its link." hint="Published sessions waiting for the coach to add the link."
            items={overview?.awaitingList} />
          <OverviewList title="Ended but not closed" empty="Nothing is overdue." hint="The scheduled end has passed. Open each one, mark attendance and mark it completed."
            items={overview?.overdueList} />
          <p className="muted">Need another coach? <Link to="/admin/staff">Manage staff</Link> and add a dietitian account.</p>
        </>
      )}

      {tab === 'Sessions' && (
        <>
          <div className="toolbar">
            <select aria-label="When" value={when} onChange={(e) => setWhen(e.target.value)}><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="all">All</option></select>
            <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option><option value="draft">Draft</option><option value="awaiting_meeting_link">Awaiting link</option><option value="scheduled">Scheduled</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          {sessions.status === 'loading' && !sessions.items.length ? <Loading /> : sessions.items.length === 0 ? (
            <section className="panel"><EmptyState icon="calendar" title="No yoga sessions" text={admin ? 'Create the first session to get started.' : 'No sessions are assigned to you yet.'} /></section>
          ) : (
            <section className="panel">
              <div className="table-wrap">
                <table className="rtable">
                  <thead><tr><th>When</th><th>Session</th><th>Seats</th><th>Price</th><th>Meet link</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {sessions.items.map((s) => (
                      <tr key={s._id}>
                        <td data-label="When" className="nowrap"><Times session={s} /><br /><small className="muted">{s.durationMinutes} min</small></td>
                        <td data-label="Session"><strong>{s.title}</strong><br /><small className="muted">{s.coach?.name} · {s.category}</small></td>
                        <td data-label="Seats">{s.seatsTaken} / {s.maxParticipants}</td>
                        <td data-label="Price">{rupees(s.pricePaise)}</td>
                        <td data-label="Meet link">{s.meetingLinkStatus === 'ADDED' ? <Badge tone="ok">Added</Badge> : <Badge tone="warn">Missing</Badge>}</td>
                        <td data-label="Status"><SessionBadge status={s.status} /></td>
                        <td data-label="Actions" className="actions">
                          <Link className="btn btn-outline btn-sm" to={`/admin/yoga/${s._id}`}>Open</Link>
                          {admin && s.status === 'draft' && <button type="button" className="btn btn-primary btn-sm" onClick={() => publish(s._id)}>Publish</button>}
                          {admin && !['completed', 'cancelled'].includes(s.status) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(s)}>Edit</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'Bookings & attendance' && admin && (
        bookings.status === 'loading' && !bookings.items.length ? <Loading /> : bookings.items.length === 0 ? (
          <section className="panel"><EmptyState icon="users" title="No bookings yet" text="Bookings appear here as participants book." /></section>
        ) : (
          <section className="panel">
            <div className="table-wrap">
              <table className="rtable">
                <thead><tr><th>Participant</th><th>Session</th><th>Reference</th><th>Booking</th><th>Payment</th><th>Attendance</th></tr></thead>
                <tbody>
                  {bookings.items.map((b) => (
                    <tr key={b._id}>
                      <td data-label="Participant">{b.user?.name}<br /><small className="muted">{b.user?.email}</small></td>
                      <td data-label="Session">{b.session ? <Link to={`/admin/yoga/${b.session._id}`}>{b.session.title}</Link> : '—'}</td>
                      <td data-label="Reference" className="nowrap">{b.bookingReference}</td>
                      <td data-label="Booking"><BookingBadge status={b.bookingStatus} /></td>
                      <td data-label="Payment">{PAY_LABEL[b.paymentStatus]}{b.amountPaise ? ` · ${rupees(b.amountPaise)}` : ''}</td>
                      <td data-label="Attendance">{b.attendance === 'unmarked' ? '—' : b.attendance === 'present' ? 'Present' : 'Absent'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}

      {form && (
        <SessionForm
          session={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSaved={(r) => {
            loadOverview();
            setMsg(`${form === 'new' ? (r.published ? 'Session created and published. Participants can see it now.' : 'Session created as a draft. Publish it so participants can see it.') : 'Session saved.'}${r.warnings?.length ? ` Note: ${r.warnings[0]}` : ''}${r.notified ? ' Booked participants were e-mailed about the new time.' : ''}`);
            setForm(null);
            loadSessions();
          }}
        />
      )}
    </>
  );
}
