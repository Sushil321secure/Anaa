import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, EmptyState, Loading, PageHeader } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { fetchMyPlans, selectDietPlans } from '../features/dietplans/dietPlanSlice.js';
import { downloadFile } from '../services/api.js';
import { fmtBytes, fmtDate } from '../utils/format.js';

export default function CustomerDietPlans() {
  useDocumentMeta('Diet Plans | Anaa Nutricare');
  const dispatch = useDispatch();
  const { items, status } = useSelector(selectDietPlans);
  const [error, setError] = useState(null);
  useEffect(() => { dispatch(fetchMyPlans()); }, [dispatch]);

  async function download(p) {
    setError(null);
    try { await downloadFile(`/diet-plans/${p._id}/file`, p.fileName); } catch (err) { setError(err.message); }
  }

  return (
    <>
      <PageHeader title="Diet plans" subtitle="Plans prepared for you by your nutritionist. Only you and the Anaa team can see them." />
      <Alert>{error}</Alert>
      {status === 'loading' && !items.length ? <Loading /> : items.length === 0 ? (
        <section className="panel"><EmptyState icon="file" title="No diet plan yet" text="After your consultation your nutritionist will upload your personalised plan here." /></section>
      ) : (
        <ul className="row-list">
          {items.map((p) => (
            <li key={p._id} className="row-card">
              <div>
                <h3>{p.title}</h3>
                <p className="muted">Added {fmtDate(p.createdAt)}{p.uploadedBy?.name ? ` by ${p.uploadedBy.name}` : ''} · {p.fileName} ({fmtBytes(p.size)})</p>
                {(p.validFrom || p.validTo) && <p className="muted">Valid {p.validFrom ? `from ${fmtDate(p.validFrom)}` : ''} {p.validTo ? `to ${fmtDate(p.validTo)}` : ''}</p>}
                {p.notes && <p style={{ marginTop: 6 }}>{p.notes}</p>}
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => download(p)}><Icon name="download" size={16} /> Download</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
