import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, ConfirmDialog, EmptyState, Loading, PageHeader } from '../../components/ui.jsx';
import useDocumentMeta from '../../hooks/useDocumentMeta.js';
import { bookSession, openMeeting, yoga } from '../../features/yoga/yogaApi.js';
import { BookingBadge, Times, level } from './YogaParts.jsx';
import { localTime, rupees } from './yogaUtils.js';

const TABS = ['Explore', 'My bookings', 'History'];

export default function CustomerYoga() {
  useDocumentMeta('Online yoga | Anaa Nutricare');
  const [tab, setTab] = useState('Explore');
  const [sessions, setSessions] = useState({ items: [], status: 'loading' });
  const [bookings, setBookings] = useState({ items: [], status: 'loading', cancelBeforeHours: 12 });
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [toCancel, setToCancel] = useState(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const [s, b] = await Promise.allSettled([yoga.sessions(), yoga.myBookings()]);
    setSessions(s.status === 'fulfilled' ? { items: s.value.items, status: 'ready' } : { items: [], status: 'failed' });
    setBookings(b.status === 'fulfilled' ? { items: b.value.items, status: 'ready', cancelBeforeHours: b.value.cancelBeforeHours } : { items: [], status: 'failed', cancelBeforeHours: 12 });
    if (s.status === 'rejected') setError(s.reason.message);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 20000); return () => clearInterval(t); }, []); // unlocks Join Session on time

  async function book(s) {
    setBusy(s._id); setError(null); setMsg(null);
    try {
      const b = await bookSession(s._id);
      setMsg(`You are booked for ${s.title}. Reference ${b.bookingReference}. A confirmation e-mail is on its way.`);
      setTab('My bookings');
    } catch (e) { setError(e.message); } finally { setBusy(null); await load(); }
  }
  async function join(b) {
    setBusy(b._id); setError(null);
    try { openMeeting((await yoga.join(b._id)).meetingLink); } catch (e) { setError(e.message); await load(); } finally { setBusy(null); }
  }
  async function cancel() {
    const b = toCancel;
    setBusy(b._id); setError(null);
    try {
      const r = await yoga.cancelBooking(b._id);
      setMsg(r.refundDue ? 'Booking cancelled. Our team will refund your payment and contact you.' : 'Booking cancelled.');
      setToCancel(null);
    } catch (e) { setError(e.message); } finally { setBusy(null); await load(); }
  }

  const active = (b) => ['pending', 'confirmed'].includes(b.bookingStatus) && !['completed', 'cancelled'].includes(b.session.status) && new Date(b.session.endsAt).getTime() > now;
  const upcoming = bookings.items.filter(active).sort((a, b) => new Date(a.session.startsAt) - new Date(b.session.startsAt));
  const history = bookings.items.filter((b) => !active(b));
  const joinable = (b) => b.bookingStatus === 'confirmed' && b.linkReady && ['scheduled', 'ongoing'].includes(b.session.status) && now >= new Date(b.session.joinWindow.opensAt) && now <= new Date(b.session.joinWindow.closesAt);

  return (
    <>
      <PageHeader title="Online yoga" subtitle="Live group yoga on Google Meet. Book a session, then join from here at the time." />
      <Alert kind="ok">{msg}</Alert>
      <Alert>{error}</Alert>
      <div className="tabs" role="tablist" aria-label="Yoga sections">
        {TABS.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}{t === 'My bookings' && upcoming.length > 0 ? ` (${upcoming.length})` : ''}</button>)}
      </div>

      {tab === 'Explore' && (
        sessions.status === 'loading' ? <Loading /> : sessions.items.length === 0 ? (
          <section className="panel"><EmptyState icon="calendar" title="No sessions open for booking" text="New group yoga sessions are added regularly. Please check back soon." /></section>
        ) : (
          <div className="yoga-grid">
            {sessions.items.map((s) => (
              <article key={s._id} className="panel yoga-card">
                <div className="yoga-card-head"><h3>{s.title}</h3><Badge tone={s.isFree ? 'ok' : 'info'}>{rupees(s.pricePaise)}</Badge></div>
                <p className="muted">{s.category} · {level(s.difficultyLevel)} · with {s.coach?.name}</p>
                {s.description && <p>{s.description}</p>}
                <p><Times session={s} /><br /><small className="muted">{s.durationMinutes} minutes</small></p>
                <p className="muted">{s.seatsLeft > 0 ? `${s.seatsLeft} of ${s.maxParticipants} seats left` : 'This session is full'}</p>
                {s.myBooking === 'confirmed' ? <Badge tone="ok">You are booked</Badge> : (
                  <button type="button" className="btn btn-primary" disabled={!!busy || s.seatsLeft === 0} onClick={() => book(s)}>
                    {busy === s._id ? 'Please wait…' : s.seatsLeft === 0 ? 'Full' : s.isFree ? 'Book for free' : `Book and pay ${rupees(s.pricePaise)}`}
                  </button>
                )}
              </article>
            ))}
          </div>
        )
      )}

      {tab === 'My bookings' && (
        bookings.status === 'loading' ? <Loading /> : upcoming.length === 0 ? (
          <section className="panel"><EmptyState icon="video" title="No upcoming yoga bookings" text="Book a session from Explore." action={<button type="button" className="btn btn-primary" onClick={() => setTab('Explore')}>Explore sessions</button>} /></section>
        ) : (
          <ul className="row-list">
            {upcoming.map((b) => (
              <li key={b._id} className="row-card yoga-booking">
                <div>
                  <h3>{b.session.title}</h3>
                  <p className="muted">with {b.session.coach?.name} · {b.session.durationMinutes} min · Ref {b.bookingReference}</p>
                  <p><Times session={b.session} /></p>
                  <p>{<BookingBadge status={b.bookingStatus} />}{b.session.status === 'ongoing' && <> <Badge tone="ok">Live now</Badge></>}</p>
                </div>
                <div className="row-actions">
                  {joinable(b)
                    ? <button type="button" className="btn btn-primary" disabled={busy === b._id} onClick={() => join(b)}>{busy === b._id ? 'Opening…' : 'Join Session'}</button>
                    : b.bookingStatus === 'confirmed' && (
                      <p className="muted join-note">
                        {new Date(b.session.joinWindow.opensAt) > now ? `Join opens ${localTime(b.session.joinWindow.opensAt)}` : !b.linkReady ? 'Your coach will add the meeting link shortly.' : 'Joining is closed.'}
                      </p>
                    )}
                  {b.canCancel && <button type="button" className="btn btn-outline btn-sm" onClick={() => setToCancel(b)}>Cancel</button>}
                  {b.bookingStatus === 'confirmed' && !b.canCancel && <small className="muted">Cancellation closes {bookings.cancelBeforeHours} h before the start.</small>}
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'History' && (
        bookings.status === 'loading' ? <Loading /> : history.length === 0 ? (
          <section className="panel"><EmptyState icon="calendar" title="No past sessions yet" text="Completed and cancelled sessions appear here." /></section>
        ) : (
          <section className="panel">
            <div className="table-wrap">
              <table className="rtable">
                <thead><tr><th>Session</th><th>When</th><th>Reference</th><th>Status</th><th>Attendance</th></tr></thead>
                <tbody>
                  {history.map((b) => (
                    <tr key={b._id}>
                      <td data-label="Session">{b.session.title}<br /><small className="muted">with {b.session.coach?.name}</small></td>
                      <td data-label="When"><Times session={b.session} /></td>
                      <td data-label="Reference" className="nowrap">{b.bookingReference}</td>
                      <td data-label="Status"><BookingBadge status={b.session.status === 'cancelled' && b.bookingStatus !== 'cancelled' ? 'cancelled' : b.bookingStatus} />{b.paymentStatus === 'refund_due' && <><br /><small className="muted">Refund in progress</small></>}</td>
                      <td data-label="Attendance">{b.attendance === 'present' ? 'Attended' : b.attendance === 'absent' ? 'Absent' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}

      {toCancel && (
        <ConfirmDialog danger title="Cancel this booking?" confirmLabel="Cancel booking" busy={busy === toCancel._id}
          text={`${toCancel.session.title}, ${localTime(toCancel.session.startsAt)}.${toCancel.paymentStatus === 'paid' ? ' Your payment will be refunded by our team.' : ''}`}
          onConfirm={cancel} onCancel={() => setToCancel(null)} />
      )}
    </>
  );
}
