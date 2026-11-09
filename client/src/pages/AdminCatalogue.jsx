import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Badge, FormRow, Loading, PageHeader } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { clearStaffAction, fetchAdminCatalog, saveCatalogItem, selectStaff } from '../features/staff/staffSlice.js';
import { inr } from '../utils/format.js';

const rupees = (paise) => (paise == null ? '' : String(paise / 100));
const toPaise = (v) => (v === '' || v == null ? null : Math.round(Number(v) * 100));

const pkgToForm = (p) => ({
  name: p?.name || '', tagline: p?.tagline || '', summary: p?.summary || '', bestFor: p?.bestFor || '',
  price: rupees(p?.pricePaise), referenceMonthly: rupees(p?.referenceMonthlyPaise), durationDays: p?.durationDays ?? 30,
  initialConsultMinutes: p?.initialConsultMinutes ?? 45, followUpConsults: p?.followUpConsults ?? 1, dietPlans: p?.dietPlans ?? 1,
  dietRevisionsLabel: p?.dietRevisionsLabel || '', badge: p?.badge || '', features: (p?.features || []).join('\n'), sortOrder: p?.sortOrder ?? 0, isActive: p?.isActive ?? true,
});

function PackageForm({ item, onDone }) {
  const dispatch = useDispatch();
  const { action } = useSelector(selectStaff);
  const [f, setF] = useState(() => pkgToForm(item));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const err = action.error?.details || {};
  async function submit(e) {
    e.preventDefault();
    const data = {
      name: f.name, summary: f.summary, tagline: f.tagline, bestFor: f.bestFor, dietRevisionsLabel: f.dietRevisionsLabel,
      pricePaise: toPaise(f.price), referenceMonthlyPaise: toPaise(f.referenceMonthly), durationDays: Number(f.durationDays),
      initialConsultMinutes: Number(f.initialConsultMinutes), followUpConsults: Number(f.followUpConsults), dietPlans: Number(f.dietPlans),
      badge: f.badge || null, features: f.features.split('\n').map((x) => x.trim()).filter(Boolean), sortOrder: Number(f.sortOrder), isActive: f.isActive,
    };
    const res = await dispatch(saveCatalogItem({ kind: 'packages', id: item?._id, data }));
    if (saveCatalogItem.fulfilled.match(res)) onDone();
  }
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>{item ? `Edit ${item.name}` : 'New package'}</h2>
      <Alert>{action.status === 'failed' && !action.error?.details ? action.error?.message : action.status === 'failed' ? 'Please check the highlighted fields.' : null}</Alert>
      <div className="form-grid">
        <FormRow label="Package name" id="pk-name" error={err.name?.[0]}><input id="pk-name" value={f.name} onChange={set('name')} required /></FormRow>
        <FormRow label="Tagline" id="pk-tag"><input id="pk-tag" value={f.tagline} onChange={set('tagline')} maxLength={160} /></FormRow>
        <div className="span-2"><FormRow label="Short description" id="pk-sum" error={err.summary?.[0]}><input id="pk-sum" value={f.summary} onChange={set('summary')} maxLength={400} required /></FormRow></div>
        <div className="span-2"><FormRow label="Best for" id="pk-best"><input id="pk-best" value={f.bestFor} onChange={set('bestFor')} maxLength={300} /></FormRow></div>
        <FormRow label="Package price (₹)" id="pk-price" hint="Leave empty to show “Pricing on request”."><input id="pk-price" type="number" min="0" step="1" value={f.price} onChange={set('price')} /></FormRow>
        <FormRow label="One-month reference rate (₹)" id="pk-ref" hint="Savings are worked out against this rate."><input id="pk-ref" type="number" min="0" step="1" value={f.referenceMonthly} onChange={set('referenceMonthly')} /></FormRow>
        <FormRow label="Duration (days)" id="pk-days"><input id="pk-days" type="number" min="1" value={f.durationDays} onChange={set('durationDays')} required /></FormRow>
        <FormRow label="First consultation (minutes)" id="pk-first"><input id="pk-first" type="number" min="5" max="480" value={f.initialConsultMinutes} onChange={set('initialConsultMinutes')} /></FormRow>
        <FormRow label="Follow-up consultations" id="pk-fu" hint="Customers can book 1 first consultation plus this many follow-ups."><input id="pk-fu" type="number" min="0" max="50" value={f.followUpConsults} onChange={set('followUpConsults')} /></FormRow>
        <FormRow label="Diet programmes included" id="pk-dp"><input id="pk-dp" type="number" min="0" max="50" value={f.dietPlans} onChange={set('dietPlans')} /></FormRow>
        <FormRow label="Diet-plan revisions (wording)" id="pk-rev"><input id="pk-rev" value={f.dietRevisionsLabel} onChange={set('dietRevisionsLabel')} maxLength={80} /></FormRow>
        <FormRow label="Highlight badge" id="pk-badge"><select id="pk-badge" value={f.badge} onChange={set('badge')}><option value="">None</option><option value="MOST_POPULAR">Most popular</option><option value="BEST_VALUE">Best value</option></select></FormRow>
        <div className="span-2"><FormRow label="Benefits (one per line)" id="pk-feat"><textarea id="pk-feat" rows="6" value={f.features} onChange={set('features')} /></FormRow></div>
        <FormRow label="Display order" id="pk-order"><input id="pk-order" type="number" value={f.sortOrder} onChange={set('sortOrder')} /></FormRow>
        <div className="check-row"><input id="pk-active" type="checkbox" checked={f.isActive} onChange={set('isActive')} /><label htmlFor="pk-active">Show this package on the website</label></div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={action.status === 'loading'}>{action.status === 'loading' ? 'Saving…' : 'Save package'}</button>
        <button type="button" className="btn btn-outline" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function ServiceForm({ item, onDone }) {
  const dispatch = useDispatch();
  const { action } = useSelector(selectStaff);
  const [f, setF] = useState({ name: item?.name || '', summary: item?.summary || '', price: rupees(item?.pricePaise), durationMinutes: item?.durationMinutes ?? 45, isActive: item?.isActive ?? true, sortOrder: item?.sortOrder ?? 0 });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  async function submit(e) {
    e.preventDefault();
    const data = { name: f.name, summary: f.summary, pricePaise: toPaise(f.price), durationMinutes: Number(f.durationMinutes), isActive: f.isActive, sortOrder: Number(f.sortOrder) };
    const res = await dispatch(saveCatalogItem({ kind: 'services', id: item?._id, data }));
    if (saveCatalogItem.fulfilled.match(res)) onDone();
  }
  const err = action.error?.details || {};
  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>{item ? `Edit ${item.name}` : 'New service'}</h2>
      <Alert>{action.status === 'failed' && !action.error?.details ? action.error?.message : null}</Alert>
      <div className="form-grid">
        <FormRow label="Service name" id="sv-name" error={err.name?.[0]}><input id="sv-name" value={f.name} onChange={set('name')} required /></FormRow>
        <FormRow label="Duration (minutes)" id="sv-min"><input id="sv-min" type="number" min="5" max="480" value={f.durationMinutes} onChange={set('durationMinutes')} /></FormRow>
        <div className="span-2"><FormRow label="Description" id="sv-sum" error={err.summary?.[0]}><input id="sv-sum" value={f.summary} onChange={set('summary')} maxLength={400} required /></FormRow></div>
        <FormRow label="Price (₹)" id="sv-price" hint="Leave empty for “Pricing on request”."><input id="sv-price" type="number" min="0" value={f.price} onChange={set('price')} /></FormRow>
        <FormRow label="Display order" id="sv-order"><input id="sv-order" type="number" value={f.sortOrder} onChange={set('sortOrder')} /></FormRow>
        <div className="check-row"><input id="sv-active" type="checkbox" checked={f.isActive} onChange={set('isActive')} /><label htmlFor="sv-active">Show on the website</label></div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={action.status === 'loading'}>Save service</button>
        <button type="button" className="btn btn-outline" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export default function AdminCatalogue() {
  useDocumentMeta('Packages and services | Anaa Admin');
  const dispatch = useDispatch();
  const { catalog, action } = useSelector(selectStaff);
  const [editing, setEditing] = useState(null); // { kind, item }
  useEffect(() => { dispatch(fetchAdminCatalog()); return () => { dispatch(clearStaffAction()); }; }, [dispatch]);
  const close = () => { setEditing(null); dispatch(clearStaffAction()); };

  if (editing?.kind === 'packages') return (<><PageHeader title="Wellness packages" /><PackageForm item={editing.item} onDone={close} /></>);
  if (editing?.kind === 'services') return (<><PageHeader title="Consultation services" /><ServiceForm item={editing.item} onDone={close} /></>);

  return (
    <>
      <PageHeader title="Packages and services" subtitle="Prices, durations, benefits and consultation entitlements. Changes show on the website straight away." />
      <Alert kind="ok">{action.status === 'done' ? action.message : null}</Alert>
      {catalog.status === 'loading' && !catalog.packages.length ? <Loading /> : (
        <>
          <section className="panel">
            <div className="panel-head"><h2>Wellness packages</h2><button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ kind: 'packages' })}>Add package</button></div>
            <div className="table-wrap">
              <table className="rtable">
                <thead><tr><th>Package</th><th>Price</th><th>Duration</th><th>Consultations</th><th>Savings</th><th>Visible</th><th><span className="sr-only">Edit</span></th></tr></thead>
                <tbody>
                  {catalog.packages.map((p) => (
                    <tr key={p._id}>
                      <td data-label="Package"><strong>{p.name}</strong>{p.badge && <> <Badge tone="info">{p.badge === 'MOST_POPULAR' ? 'Most popular' : 'Best value'}</Badge></>}</td>
                      <td data-label="Price">{p.pricing?.priced ? inr(p.pricing.pricePaise) : 'On request'}</td>
                      <td data-label="Duration">{p.durationDays} days</td>
                      <td data-label="Consultations">{1 + (p.followUpConsults || 0)}</td>
                      <td data-label="Savings">{p.pricing?.savingsPaise > 0 ? `${inr(p.pricing.savingsPaise)} (${p.pricing.savingsPercent}%)` : '—'}</td>
                      <td data-label="Visible">{p.isActive ? <Badge tone="ok">Yes</Badge> : <Badge tone="off">Hidden</Badge>}</td>
                      <td data-label="" className="actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing({ kind: 'packages', item: p })}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Consultation services</h2><button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({ kind: 'services' })}>Add service</button></div>
            <div className="table-wrap">
              <table className="rtable">
                <thead><tr><th>Service</th><th>Duration</th><th>Price</th><th>Visible</th><th><span className="sr-only">Edit</span></th></tr></thead>
                <tbody>
                  {catalog.services.map((s) => (
                    <tr key={s._id}>
                      <td data-label="Service"><strong>{s.name}</strong></td>
                      <td data-label="Duration">{s.durationMinutes ? `${s.durationMinutes} min` : '—'}</td>
                      <td data-label="Price">{s.pricePaise != null ? inr(s.pricePaise) : 'On request'}</td>
                      <td data-label="Visible">{s.isActive ? <Badge tone="ok">Yes</Badge> : <Badge tone="off">Hidden</Badge>}</td>
                      <td data-label="" className="actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing({ kind: 'services', item: s })}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
