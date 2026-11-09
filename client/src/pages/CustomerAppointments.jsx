import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert, ConfirmDialog, EmptyState, FormRow, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { bookAndRefresh, cancelAndRefresh, clearAppointmentAction, fetchFees, fetchMyAppointments, fetchSlots, selectAppointments, setAppointmentError } from '../features/appointments/appointmentSlice.js';
import { buyPackage, fetchMyPurchases, selectPurchases } from '../features/purchases/purchaseSlice.js';
import JoinConsultation, { isLiveOrUpcoming } from '../components/JoinConsultation.jsx';
import JoinGoogleMeet, { MethodLabel, isMeet } from '../components/JoinGoogleMeet.jsx';
import { addDays, inr, fmtDateTime, fmtTime, fmtWeekday, istToday } from '../utils/format.js';

const DAYS_SHOWN = 14;

export default function CustomerAppointments() {
  useDocumentMeta('Appointments | Anaa Nutricare');
  const dispatch = useDispatch();
  const { items, cancelBeforeHours, callWindow, status, slots, action, fees } = useSelector(selectAppointments);
  const purchases = useSelector(selectPurchases);
  const today = istToday();
  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(today, i)), [today]);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [toCancel, setToCancel] = useState(null);
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'OFFLINE' ? 'OFFLINE' : 'ONLINE');
  const [provider, setProvider] = useState('WEBRTC'); // how an online consultation is held: the in-app room or Google Meet

  useEffect(() => {
    dispatch(fetchMyAppointments());
    dispatch(fetchMyPurchases());
    dispatch(fetchFees());
    return () => { dispatch(clearAppointmentAction()); };
  }, [dispatch]);
  useEffect(() => { setSlot(null); dispatch(fetchSlots(date)); }, [dispatch, date]);

  const usable = purchases.items.filter((p) => p.active && (p.kind !== 'CONSULTATION' || p.mode === mode));
  const left = usable.reduce((n, p) => n + p.consultationsRemaining, 0);
  const totalLeft = purchases.items.filter((p) => p.active).reduce((n, p) => n + p.consultationsRemaining, 0);
  const feePaise = mode === 'ONLINE' ? fees.onlinePaise : fees.offlinePaise;
  const paying = Boolean(purchases.buying);
  const now = Date.now();
  const upcoming = items.filter((a) => isLiveOrUpcoming(a, callWindow, now)).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const past = items.filter((a) => !upcoming.includes(a));
  const busy = action.status === 'loading' || paying;

  async function book() {
    if (left === 0) {
      // no credit for this type of consultation: pay for one first (verified on the server), then book the chosen time
      const paid = await dispatch(buyPackage({ mode }));
      if (!buyPackage.fulfilled.match(paid)) { dispatch(setAppointmentError(paid.payload?.message || 'The payment did not complete.')); return; }
      await dispatch(fetchMyPurchases());
    }
    const res = await dispatch(bookAndRefresh({ startsAt: slot, mode, ...(mode === 'ONLINE' ? { provider } : {}), notes: notes || undefined }));
    if (res.type.endsWith('/fulfilled')) { setNotes(''); setSlot(null); }
    dispatch(fetchSlots(date));
  }
  async function confirmCancel() {
    await dispatch(cancelAndRefresh(toCancel._id));
    setToCancel(null);
    dispatch(fetchSlots(date));
  }
  const cancelEarly = toCancel && new Date(toCancel.startsAt).getTime() - now >= cancelBeforeHours * 3600 * 1000;

  return (
    <>
      <PageHeader title="Appointments" subtitle={`Book an online or offline consultation with your nutritionist. Times are in Indian Standard Time (IST). ${totalLeft} package consultation${totalLeft === 1 ? '' : 's'} left.`} />
      <Alert kind={action.status === 'done' ? 'ok' : 'error'}>{action.message || action.error?.message}</Alert>

      <div className="grid-2">
        <section className="panel">
          <h2>Book a consultation</h2>
          {purchases.status === 'loading' && !purchases.items.length ? <Loading /> : (
            <>
              <div className="mode-pick" role="group" aria-label="Consultation type">
                {[['ONLINE', 'Online consultation', fees.onlinePaise, 'Video call from anywhere'], ['OFFLINE', 'Offline consultation', fees.offlinePaise, 'In person at the clinic']].map(([m, label, paise, sub]) => (
                  <button key={m} type="button" className="mode-btn" aria-pressed={mode === m} onClick={() => setMode(m)}>
                    <strong>{label}</strong><span>{inr(paise)}</span><small>{sub}</small>
                  </button>
                ))}
              </div>
              {mode === 'ONLINE' && (
                <div className="mode-pick" role="group" aria-label="How to meet online">
                  {[['WEBRTC', 'In-app video', 'Opens inside Anaa Nutricare. Nothing to install.'], ['GOOGLE_MEET', 'Google Meet', 'Your dietitian shares a Google Meet link.']].map(([p, label, sub]) => (
                    <button key={p} type="button" className="mode-btn" aria-pressed={provider === p} onClick={() => setProvider(p)}>
                      <strong>{label}</strong><small>{sub}</small>
                    </button>
                  ))}
                </div>
              )}
              <p className="muted" style={{ marginTop: 0 }}>{left > 0 ? `You have ${left} ${mode.toLowerCase()} consultation${left === 1 ? '' : 's'} ready to use, so there is nothing more to pay.` : `Pay ${inr(feePaise)} securely online and your time is booked straight away. Or `}{left === 0 && <Link to="/packages">view wellness packages</Link>}{left === 0 && ' for better value.'}</p>
              <div className="date-strip" role="group" aria-label="Choose a date">
                {days.map((d) => {
                  const w = fmtWeekday(`${d}T06:00:00Z`).split(' ');
                  return (
                    <button key={d} type="button" className="date-btn" aria-pressed={d === date} onClick={() => setDate(d)}>
                      <small>{w[0].replace(',', '')}</small><strong>{Number(d.slice(8))}</strong><small>{w[2] || ''}</small>
                    </button>
                  );
                })}
              </div>
              {slots.status === 'loading' ? <Loading text="Finding free times…" /> : slots.items.length === 0 ? (
                <p className="muted">No times are left on this day. Please pick another date.</p>
              ) : (
                <div className="slot-grid" role="group" aria-label="Choose a time">
                  {slots.items.map((s) => (
                    <button key={s.startsAt} type="button" className="slot-btn" disabled={!s.available} aria-pressed={slot === s.startsAt} onClick={() => setSlot(s.startsAt)}>{fmtTime(s.startsAt)}</button>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 18 }}>
                <FormRow label="Anything the nutritionist should know? (optional)" id="notes">
                  <textarea id="notes" rows="3" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </FormRow>
                <button type="button" className="btn btn-primary" onClick={book} disabled={!slot || busy}>{busy ? 'Please wait…' : !slot ? 'Choose a time' : left > 0 ? `Book ${fmtTime(slot)}` : `Pay ${inr(feePaise)} & book ${fmtTime(slot)}`}</button>
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <h2>Upcoming</h2>
          {status === 'loading' && !items.length ? <Loading /> : upcoming.length === 0 ? (
            <p className="muted">You have no upcoming consultations.</p>
          ) : (
            <ul className="row-list">
              {upcoming.map((a) => (
                <li key={a._id} className="row-card">
                  <div>
                    <h3>{fmtDateTime(a.startsAt)}</h3>
                    <p className="muted">{a.mode === 'OFFLINE' ? 'Offline' : 'Online'} · {a.durationMinutes} min · {a.dietitian?.name ? `with ${a.dietitian.name}` : 'dietitian to be assigned'} <MethodLabel appointment={a} /></p>
                  </div>
                  <div className="row-actions">
                    {isMeet(a) ? <JoinGoogleMeet appointment={a} win={callWindow} /> : <JoinConsultation appointment={a} win={callWindow} to={`/consultation/${a._id}`} />}
                    {a.status === 'CONFIRMED' && new Date(a.startsAt) > now && <button type="button" className="btn btn-outline btn-sm" onClick={() => setToCancel(a)}>Cancel</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {past.length > 0 && (
        <section className="panel">
          <h2>History</h2>
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>When</th><th>Dietitian</th><th>Status</th></tr></thead>
              <tbody>
                {past.map((a) => (
                  <tr key={a._id}>
                    <td data-label="When">{fmtDateTime(a.startsAt)}</td>
                    <td data-label="Dietitian">{a.dietitian?.name || '—'}</td>
                    <td data-label="Status"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {toCancel && (
        <ConfirmDialog
          danger
          title="Cancel this consultation?"
          text={cancelEarly ? `${fmtDateTime(toCancel.startsAt)}. Because there are more than ${cancelBeforeHours} hours to go, the consultation goes back into your package.` : `${fmtDateTime(toCancel.startsAt)}. It starts in less than ${cancelBeforeHours} hours, so the consultation will not be returned to your package.`}
          confirmLabel="Yes, cancel it"
          busy={busy}
          onConfirm={confirmCancel}
          onCancel={() => setToCancel(null)}
        />
      )}
    </>
  );
}
