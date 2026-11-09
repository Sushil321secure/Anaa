import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import LineChart from '../components/LineChart.jsx';
import Icon from '../components/Icon.jsx';
import { Alert, Badge, EmptyState, FormRow, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { selectUser } from '../features/auth/authSlice.js';
import { fetchCatalog, selectCatalog } from '../features/catalog/catalogSlice.js';
import { adjustRewards, assignPackage, clearStaffAction, fetchCustomerDetail, selectStaff } from '../features/staff/staffSlice.js';
import { clearUpload, deletePlan, fetchCustomerPlans, selectDietPlans, uploadPlan } from '../features/dietplans/dietPlanSlice.js';
import { fetchCustomerProgress, selectProgress } from '../features/progress/progressSlice.js';
import { downloadFile } from '../services/api.js';
import { fmtBytes, fmtDate, fmtDateTime, inr } from '../utils/format.js';

const TABS = ['Overview', 'Packages', 'Appointments', 'Diet plans', 'Progress'];

function Overview({ data, canAdjust, id }) {
  const dispatch = useDispatch();
  const { action } = useSelector(selectStaff);
  const [adj, setAdj] = useState({ points: '', reason: '' });
  const c = data.customer;
  async function submit(e) {
    e.preventDefault();
    const res = await dispatch(adjustRewards({ customerId: id, points: Number(adj.points), reason: adj.reason }));
    if (adjustRewards.fulfilled.match(res)) { setAdj({ points: '', reason: '' }); dispatch(fetchCustomerDetail(id)); }
  }
  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Profile</h2>
        <dl className="kv">
          <dt>Email</dt><dd>{c.email}</dd>
          <dt>Phone</dt><dd>{c.phone || '—'}</dd>
          <dt>City</dt><dd>{c.city || '—'}</dd>
          <dt>Gender</dt><dd>{c.gender ? c.gender.charAt(0) + c.gender.slice(1).toLowerCase() : '—'}</dd>
          <dt>Date of birth</dt><dd>{c.dob ? fmtDate(c.dob) : '—'}</dd>
          <dt>Height</dt><dd>{c.heightCm ? `${c.heightCm} cm` : '—'}</dd>
          <dt>Health goal</dt><dd>{c.healthGoal || '—'}</dd>
          <dt>Joined</dt><dd>{fmtDate(c.createdAt)}</dd>
          <dt>Account</dt><dd>{c.isActive ? <Badge tone="ok">Active</Badge> : <Badge tone="off">Disabled</Badge>}</dd>
        </dl>
      </section>
      <section className="panel">
        <h2>Referrals and rewards</h2>
        <dl className="kv">
                    <dt>Referred by</dt><dd>{data.referredBy ? `${data.referredBy.name} (${data.referredBy.status.toLowerCase()})` : '—'}</dd>
          <dt>Reward points</dt><dd><strong>{data.rewardBalance}</strong>{data.rewardCheck && !data.rewardCheck.consistent && <> <Badge tone="warn">ledger mismatch</Badge></>}</dd>
          <dt>Earned / redeemed</dt><dd>{data.rewardWallet?.totalEarned ?? 0} / {data.rewardWallet?.totalRedeemed ?? 0}</dd>
        </dl>
        {canAdjust && (
          <form onSubmit={submit} noValidate style={{ marginTop: 18 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Adjust points</h3>
            <Alert kind="ok">{action.status === 'done' && action.message?.startsWith('Reward') ? action.message : null}</Alert>
            <Alert>{action.status === 'failed' ? action.error?.message : null}</Alert>
            <div className="form-grid">
              <FormRow label="Points (+ or −)" id="adj-points"><input id="adj-points" type="number" step="1" value={adj.points} onChange={(e) => setAdj({ ...adj, points: e.target.value })} required /></FormRow>
              <FormRow label="Reason" id="adj-reason"><input id="adj-reason" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} required minLength={5} /></FormRow>
            </div>
            <div className="form-actions"><button className="btn btn-outline btn-sm" disabled={!adj.points || adj.reason.trim().length < 5}>Apply</button></div>
          </form>
        )}
      </section>
    </div>
  );
}

function Packages({ data, id, canAssign }) {
  const dispatch = useDispatch();
  const { packages } = useSelector(selectCatalog);
  const { action } = useSelector(selectStaff);
  const [form, setForm] = useState({ packageId: '', note: '' });
  async function submit(e) {
    e.preventDefault();
    const res = await dispatch(assignPackage({ customerId: id, ...form }));
    if (assignPackage.fulfilled.match(res)) { setForm({ packageId: '', note: '' }); dispatch(fetchCustomerDetail(id)); }
  }
  const err = action.error?.details || {};
  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Packages</h2>
        {data.purchases.length === 0 ? <p className="muted">No packages yet.</p> : (
          <ul className="row-list">
            {data.purchases.map((p) => (
              <li key={p.id} className="row-card">
                <div>
                  <h3>{p.packageName} {p.valid ? <Badge tone="ok">Active</Badge> : p.expired ? <Badge tone="off">Expired</Badge> : <Badge tone="warn">Not active</Badge>}</h3>
                  <p className="muted">{p.consultationsRemaining} of {p.consultationsTotal} left · {fmtDate(p.paidAt)} to {fmtDate(p.expiresAt)}</p>
                  <p className="muted">{p.pricePaise ? inr(p.pricePaise) : '—'} · {p.source === 'MANUAL' ? `recorded by staff${p.note ? `: ${p.note}` : ''}` : 'paid online'}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {canAssign && (
        <form className="panel" onSubmit={submit} noValidate>
          <h2>Record a payment</h2>
          <p className="muted" style={{ marginTop: 0 }}>Use this when the customer paid by cash, UPI or bank transfer. They get the consultations straight away.</p>
          <Alert kind="ok">{action.status === 'done' && action.message?.startsWith('Package') ? action.message : null}</Alert>
          <Alert>{action.status === 'failed' && !action.error?.details ? action.error?.message : null}</Alert>
          <FormRow label="Package" id="as-pkg" error={err.packageId?.[0]}>
            <select id="as-pkg" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })} required>
              <option value="">Choose a package…</option>
              {packages.map((p) => <option key={p._id} value={p._id}>{p.name}{p.pricing?.priced ? ` · ${inr(p.pricing.pricePaise)}` : ''}</option>)}
            </select>
          </FormRow>
          <FormRow label="Payment note" id="as-note" error={err.note?.[0]} hint="For example: UPI reference 1234, or cash received.">
            <input id="as-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} required />
          </FormRow>
          <div className="form-actions"><button className="btn btn-primary" disabled={action.status === 'loading' || !form.packageId}>{action.status === 'loading' ? 'Saving…' : 'Add package'}</button></div>
        </form>
      )}
    </div>
  );
}

function Plans({ id, canWrite }) {
  const dispatch = useDispatch();
  const { items, status, upload } = useSelector(selectDietPlans);
  const [form, setForm] = useState({ title: '', notes: '', validFrom: '', validTo: '' });
  const [fileKey, setFileKey] = useState(0);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { dispatch(fetchCustomerPlans(id)); return () => { dispatch(clearUpload()); }; }, [dispatch, id]);

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData();
    fd.set('customerId', id);
    fd.set('title', form.title);
    if (form.notes) fd.set('notes', form.notes);
    if (form.validFrom) fd.set('validFrom', form.validFrom);
    if (form.validTo) fd.set('validTo', form.validTo);
    if (file) fd.set('file', file);
    const res = await dispatch(uploadPlan(fd));
    if (uploadPlan.fulfilled.match(res)) { setForm({ title: '', notes: '', validFrom: '', validTo: '' }); setFile(null); setFileKey((k) => k + 1); }
  }
  async function download(p) {
    setError(null);
    try { await downloadFile(`/diet-plans/${p._id}/file`, p.fileName); } catch (err) { setError(err.message); }
  }
  const ue = upload.error?.details || {};
  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Diet plans</h2>
        <Alert>{error}</Alert>
        {status === 'loading' && !items.length ? <Loading /> : items.length === 0 ? <p className="muted">No diet plans uploaded yet.</p> : (
          <ul className="row-list">
            {items.map((p) => (
              <li key={p._id} className="row-card">
                <div><h3>{p.title}</h3><p className="muted">{fmtDate(p.createdAt)} · {p.fileName} ({fmtBytes(p.size)})</p></div>
                <div className="actions" style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => download(p)}><Icon name="download" size={15} /> Download</button>
                  {canWrite && <button type="button" className="btn btn-ghost btn-sm" aria-label={`Delete ${p.title}`} onClick={() => dispatch(deletePlan(p._id))}><Icon name="trash" size={15} /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {canWrite && (
        <form className="panel" onSubmit={submit} noValidate>
          <h2>Upload a plan</h2>
          <Alert kind="ok">{upload.status === 'done' ? 'Diet plan uploaded. The customer was notified.' : null}</Alert>
          <Alert>{upload.status === 'failed' && !upload.error?.details ? upload.error?.message : null}</Alert>
          <FormRow label="Title" id="dp-title" error={ue.title?.[0]}><input id="dp-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} required /></FormRow>
          <FormRow label="File (PDF, JPG, PNG or WebP, up to 8 MB)" id="dp-file"><input key={fileKey} id="dp-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files[0] || null)} required /></FormRow>
          <div className="form-grid">
            <FormRow label="Valid from" id="dp-from"><input id="dp-from" type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></FormRow>
            <FormRow label="Valid to" id="dp-to"><input id="dp-to" type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} /></FormRow>
          </div>
          <FormRow label="Notes for the customer (optional)" id="dp-notes"><textarea id="dp-notes" rows="3" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormRow>
          <div className="form-actions"><button className="btn btn-primary" disabled={upload.status === 'loading' || !file || form.title.length < 2}>{upload.status === 'loading' ? 'Uploading…' : 'Upload plan'}</button></div>
        </form>
      )}
    </div>
  );
}

function ProgressTab({ id }) {
  const dispatch = useDispatch();
  const { items, status } = useSelector(selectProgress);
  useEffect(() => { dispatch(fetchCustomerProgress(id)); }, [dispatch, id]);
  const weights = useMemo(() => items.filter((e) => e.weightKg != null).map((e) => ({ x: e.date, y: e.weightKg })), [items]);
  if (status === 'loading' && !items.length) return <Loading />;
  if (!items.length) return <section className="panel"><EmptyState icon="chart" title="No check-ins" text="The customer has not logged any measurements yet." /></section>;
  return (
    <div className="grid-2">
      <section className="panel"><h2>Weight (kg)</h2>{weights.length ? <LineChart points={weights} unit=" kg" label="Weight over time" /> : <p className="muted">No weight entries.</p>}</section>
      <section className="panel">
        <h2>Check-ins</h2>
        <div className="table-wrap">
          <table className="rtable">
            <thead><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Body fat</th><th>BMI</th></tr></thead>
            <tbody>{[...items].reverse().map((e) => (
              <tr key={e._id}><td data-label="Date" className="nowrap">{fmtDate(e.date)}</td><td data-label="Weight">{e.weightKg ?? '—'}</td><td data-label="Waist">{e.waistCm ?? '—'}</td><td data-label="Body fat">{e.bodyFatPct ?? '—'}</td><td data-label="BMI">{e.bmi ?? '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { detail } = useSelector(selectStaff);
  const [tab, setTab] = useState('Overview');
  useDocumentMeta(`${detail.data?.customer?.name || 'Customer'} | Anaa Admin`);

  useEffect(() => {
    dispatch(fetchCustomerDetail(id));
    dispatch(fetchCatalog());
    return () => { dispatch(clearStaffAction()); };
  }, [dispatch, id]);

  const d = detail.data?.customer?._id === id ? detail.data : null;
  const role = user.role;
  return (
    <>
      <PageHeader title={d?.customer.name || 'Customer'} subtitle={d ? `${d.customer.email}${d.customer.phone ? ` · ${d.customer.phone}` : ''}` : undefined} actions={<Link className="btn btn-outline" to="/admin/customers">All customers</Link>} />
      <Alert>{detail.status === 'failed' ? detail.error?.message : null}</Alert>
      {!d ? <Loading /> : (
        <>
          <div className="tabs" role="tablist" aria-label="Customer sections">
            {TABS.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
          </div>
          {tab === 'Overview' && <Overview data={d} id={id} canAdjust={['OWNER', 'ADMIN'].includes(role)} />}
          {tab === 'Packages' && <Packages data={d} id={id} canAssign={['OWNER', 'ADMIN', 'OPERATIONS'].includes(role)} />}
          {tab === 'Appointments' && (
            <section className="panel">
              <h2>Appointments</h2>
              {d.appointments.length === 0 ? <p className="muted">No appointments.</p> : (
                <div className="table-wrap"><table className="rtable">
                  <thead><tr><th>When</th><th>Dietitian</th><th>Status</th><th>Notes</th></tr></thead>
                  <tbody>{d.appointments.map((a) => (
                    <tr key={a._id}><td data-label="When" className="nowrap">{fmtDateTime(a.startsAt)}</td><td data-label="Dietitian">{a.dietitian?.name || '—'}</td><td data-label="Status"><StatusBadge status={a.status} /></td><td data-label="Notes">{a.notes || a.staffNotes || '—'}</td></tr>
                  ))}</tbody>
                </table></div>
              )}
            </section>
          )}
          {tab === 'Diet plans' && <Plans id={id} canWrite={['OWNER', 'ADMIN', 'DIETITIAN'].includes(role)} />}
          {tab === 'Progress' && <ProgressTab id={id} />}
        </>
      )}
    </>
  );
}
