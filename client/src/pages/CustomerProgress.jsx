import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import LineChart from '../components/LineChart.jsx';
import { Alert, EmptyState, FormRow, Loading, PageHeader } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { addProgress, clearProgressSave, deleteProgress, fetchProgress, selectProgress } from '../features/progress/progressSlice.js';
import { fmtDate, istToday } from '../utils/format.js';

const METRICS = [
  { key: 'weightKg', label: 'Weight', unit: ' kg' },
  { key: 'waistCm', label: 'Waist', unit: ' cm' },
  { key: 'bodyFatPct', label: 'Body fat', unit: ' %' },
  { key: 'bmi', label: 'BMI', unit: '' },
];

const blank = () => ({ date: istToday(), weightKg: '', waistCm: '', bodyFatPct: '', notes: '' });

export default function CustomerProgress() {
  useDocumentMeta('My Progress | Anaa Nutricare');
  const dispatch = useDispatch();
  const { items, heightCm, status, save } = useSelector(selectProgress);
  const [form, setForm] = useState(blank);
  const [metric, setMetric] = useState('weightKg');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    dispatch(fetchProgress());
    return () => { dispatch(clearProgressSave()); };
  }, [dispatch]);

  const m = METRICS.find((x) => x.key === metric);
  const points = useMemo(() => items.filter((e) => e[metric] != null).map((e) => ({ x: e.date, y: e[metric] })), [items, metric]);
  const available = METRICS.filter((x) => items.some((e) => e[x.key] != null));

  async function onSubmit(e) {
    e.preventDefault();
    const body = { date: form.date, notes: form.notes || undefined };
    for (const k of ['weightKg', 'waistCm', 'bodyFatPct']) if (form[k] !== '') body[k] = Number(form[k]);
    const res = await dispatch(addProgress(body));
    if (addProgress.fulfilled.match(res)) setForm(blank());
  }
  const err = save.error?.details;
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <>
      <PageHeader title="My progress" subtitle="Log your measurements and watch the trend. Share them with your nutritionist at your next consultation." />

      <div className="grid-2">
        <section className="panel">
          <h2>Add a check-in</h2>
          <form onSubmit={onSubmit} noValidate>
            <Alert>{save.status === 'failed' && !err ? save.error?.message : null}</Alert>
            <div className="form-grid">
              <FormRow label="Date" id="p-date" error={err?.date?.[0]}><input id="p-date" type="date" max={istToday()} value={form.date} onChange={set('date')} required /></FormRow>
              <FormRow label="Weight (kg)" id="p-weight" error={err?.weightKg?.[0]}><input id="p-weight" type="number" step="0.1" min="10" max="400" inputMode="decimal" value={form.weightKg} onChange={set('weightKg')} /></FormRow>
              <FormRow label="Waist (cm)" id="p-waist" error={err?.waistCm?.[0]}><input id="p-waist" type="number" step="0.1" min="30" max="250" inputMode="decimal" value={form.waistCm} onChange={set('waistCm')} /></FormRow>
              <FormRow label="Body fat (%)" id="p-fat" error={err?.bodyFatPct?.[0]}><input id="p-fat" type="number" step="0.1" min="2" max="70" inputMode="decimal" value={form.bodyFatPct} onChange={set('bodyFatPct')} /></FormRow>
              <div className="span-2"><FormRow label="Notes (optional)" id="p-notes"><input id="p-notes" maxLength={300} value={form.notes} onChange={set('notes')} /></FormRow></div>
            </div>
            {save.status === 'failed' && err && <Alert>{err[''] || err.root || 'Enter at least one measurement'}</Alert>}
            <div className="form-actions"><button className="btn btn-primary" disabled={save.status === 'loading'}>{save.status === 'loading' ? 'Saving…' : 'Save check-in'}</button></div>
            {!heightCm && <p className="field-hint" style={{ marginTop: 12 }}>Add your height in <Link to="/portal/profile">your profile</Link> to see your BMI.</p>}
          </form>
        </section>

        <section className="panel">
          <h2>Trend</h2>
          {status === 'loading' && !items.length ? <Loading /> : points.length === 0 && items.length === 0 ? (
            <EmptyState icon="chart" title="No check-ins yet" text="Your first check-in starts the chart." />
          ) : (
            <>
              <div className="chart-legend" role="group" aria-label="Measurement">
                {available.map((x) => <button key={x.key} type="button" aria-pressed={metric === x.key} onClick={() => setMetric(x.key)}>{x.label}</button>)}
              </div>
              <LineChart points={points} unit={m.unit} label={`${m.label} over time`} />
              {first && last && first !== last && <p className="muted" style={{ marginBottom: 0 }}>{m.label}: {first.y}{m.unit} on {fmtDate(first.x)} → {last.y}{m.unit} on {fmtDate(last.x)} ({(last.y - first.y > 0 ? '+' : '') + (last.y - first.y).toFixed(1)}{m.unit})</p>}
            </>
          )}
        </section>
      </div>

      {items.length > 0 && (
        <section className="panel">
          <h2>History</h2>
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Body fat</th><th>BMI</th><th>Notes</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {[...items].reverse().map((e) => (
                  <tr key={e._id}>
                    <td data-label="Date" className="nowrap">{fmtDate(e.date)}</td>
                    <td data-label="Weight">{e.weightKg != null ? `${e.weightKg} kg` : '—'}</td>
                    <td data-label="Waist">{e.waistCm != null ? `${e.waistCm} cm` : '—'}</td>
                    <td data-label="Body fat">{e.bodyFatPct != null ? `${e.bodyFatPct} %` : '—'}</td>
                    <td data-label="BMI">{e.bmi ?? '—'}</td>
                    <td data-label="Notes">{e.notes || '—'}</td>
                    <td data-label="" className="actions"><button type="button" className="btn btn-ghost btn-sm" aria-label={`Delete check-in of ${fmtDate(e.date)}`} onClick={() => dispatch(deleteProgress(e._id))}><Icon name="trash" size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
