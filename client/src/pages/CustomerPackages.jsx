import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Badge, EmptyState, Loading, PageHeader } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { fetchMyPurchases, selectPurchases } from '../features/purchases/purchaseSlice.js';
import { fmtDate, inr } from '../utils/format.js';

export default function CustomerPackages() {
  useDocumentMeta('My Packages | Anaa Nutricare');
  const dispatch = useDispatch();
  const { items, status } = useSelector(selectPurchases);
  useEffect(() => { dispatch(fetchMyPurchases()); }, [dispatch]);

  return (
    <>
      <PageHeader title="My packages" subtitle="Your wellness packages, remaining consultations and expiry dates." actions={<Link className="btn btn-primary" to="/packages">Buy or renew a package</Link>} />
      {status === 'loading' && !items.length ? <Loading /> : items.length === 0 ? (
        <section className="panel"><EmptyState icon="package" title="You have no packages yet" text="Pick the plan that fits your goal. Savings are shown on every package." action={<Link className="btn btn-primary" to="/packages">View wellness packages</Link>} /></section>
      ) : (
        <div className="grid-2">
          {items.map((p) => (
            <article key={p.id} className="panel">
              <div className="panel-head">
                <h2>{p.packageName}</h2>
                {p.valid ? <Badge tone="ok">Active</Badge> : p.expired ? <Badge tone="off">Expired</Badge> : <Badge tone="warn">Not active</Badge>}
              </div>
              <div className="meter" aria-hidden="true"><span style={{ width: `${(p.consultationsRemaining / Math.max(1, p.consultationsTotal)) * 100}%` }} /></div>
              <p style={{ margin: '0 0 14px' }}><strong>{p.consultationsRemaining}</strong> of {p.consultationsTotal} consultations remaining{p.valid && p.consultationsRemaining === 0 ? <><br /><small className="muted">All consultations in this package are used. The package itself stays valid until {fmtDate(p.expiresAt)}. You can <Link to="/portal/appointments">pay for a single consultation</Link> or <Link to="/packages">renew your package</Link>.</small></> : null}</p>
              <dl className="kv">
                <dt>Started</dt><dd>{fmtDate(p.paidAt)}</dd>
                <dt>Valid until</dt><dd>{fmtDate(p.expiresAt)}</dd>
                <dt>Amount paid</dt><dd>{p.pricePaise ? inr(p.pricePaise) : '—'}</dd>
                {p.savingsPaise > 0 && (<><dt>You saved</dt><dd>{inr(p.savingsPaise)}</dd></>)}
              </dl>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
