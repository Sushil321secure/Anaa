import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, FormRow, Loading, PageHeader } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { clearStaffAction, fetchSettings, saveSettings, selectStaff } from '../features/staff/staffSlice.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Availability({ value }) {
  const dispatch = useDispatch();
  const { action } = useSelector(selectStaff);
  const [f, setF] = useState({ ...value });
  const n = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) });
  const toggle = (d) => setF({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() });
  const hours = Array.from({ length: 25 }, (_, h) => h);
  const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 || h === 24 ? 'am' : 'pm'}`;
  const err = action.error?.details || {};
  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); dispatch(saveSettings({ key: 'availability', value: f })); }} noValidate>
      <h2>Consultation hours</h2>
      <p className="muted" style={{ marginTop: 0 }}>Customers can book consultations in these hours (Indian Standard Time). Each dietitian you add lets one more person book the same time.</p>
      <FormRow label="Days open" id="av-days"><div className="day-picker" role="group" aria-label="Days open">{DAYS.map((d, i) => <label key={d}><input type="checkbox" checked={f.days.includes(i)} onChange={() => toggle(i)} /> {d}</label>)}</div></FormRow>
      <div className="form-grid">
        <FormRow label="Opens" id="av-start"><select id="av-start" value={f.startHour} onChange={n('startHour')}>{hours.slice(0, 24).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></FormRow>
        <FormRow label="Closes" id="av-end" error={err.endHour?.[0]}><select id="av-end" value={f.endHour} onChange={n('endHour')}>{hours.slice(1).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select></FormRow>
        <FormRow label="Consultation length (minutes)" id="av-len"><input id="av-len" type="number" min="15" max="180" step="5" value={f.slotMinutes} onChange={n('slotMinutes')} /></FormRow>
        <FormRow label="Minimum notice (hours)" id="av-notice"><input id="av-notice" type="number" min="0" max="168" value={f.minNoticeHours} onChange={n('minNoticeHours')} /></FormRow>
        <FormRow label="Free cancellation until (hours before)" id="av-cancel" hint="Cancel earlier than this and the consultation returns to the package."><input id="av-cancel" type="number" min="0" max="168" value={f.cancelBeforeHours} onChange={n('cancelBeforeHours')} /></FormRow>
        <FormRow label="Book up to (days ahead)" id="av-ahead"><input id="av-ahead" type="number" min="1" max="120" value={f.maxDaysAhead} onChange={n('maxDaysAhead')} /></FormRow>
      </div>
      <div className="form-actions"><button className="btn btn-primary" disabled={action.status === 'loading' || f.days.length === 0}>Save hours</button></div>
    </form>
  );
}

export default function AdminSettings() {
  useDocumentMeta('Settings | Anaa Admin');
  const dispatch = useDispatch();
  const { settings, action } = useSelector(selectStaff);
  useEffect(() => { dispatch(fetchSettings()); return () => { dispatch(clearStaffAction()); }; }, [dispatch]);
  const d = settings.data;
  return (
    <>
      <PageHeader title="Settings" subtitle="Booking hours. Reward rules are under Log & Earn." />
      <Alert kind="ok">{action.status === 'done' ? action.message : null}</Alert>
      <Alert>{action.status === 'failed' ? action.error?.message : null}</Alert>
      {!d ? <Loading /> : (
        <div className="grid-2">
          <Availability value={d.availability} />
        </div>
      )}
    </>
  );
}
