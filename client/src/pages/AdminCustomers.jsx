import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Alert, Badge, EmptyState, Loading, PageHeader } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { fetchCustomers, selectStaff } from '../features/staff/staffSlice.js';
import { fmtDate } from '../utils/format.js';

export default function AdminCustomers() {
  useDocumentMeta('Customers | Anaa Admin');
  const dispatch = useDispatch();
  const { customers } = useSelector(selectStaff);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => dispatch(fetchCustomers({ q, page })), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [dispatch, q, page]);

  return (
    <>
      <PageHeader title="Customers" subtitle={`${customers.total} registered customer${customers.total === 1 ? '' : 's'}`} />
      <div className="toolbar">
        <input type="search" aria-label="Search customers" placeholder="Search name, email or phone" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
      </div>
      <Alert>{customers.status === 'failed' ? customers.error?.message : null}</Alert>
      {customers.status === 'loading' && !customers.items.length ? <Loading /> : customers.items.length === 0 ? (
        <section className="panel"><EmptyState icon="users" title="No customers found" text={q ? 'Try a different search.' : 'Customers appear here after they sign up.'} /></section>
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Name</th><th>Contact</th><th>City</th><th>Consultations left</th><th>Joined</th><th><span className="sr-only">Open</span></th></tr></thead>
              <tbody>
                {customers.items.map((c) => (
                  <tr key={c._id}>
                    <td data-label="Name"><strong>{c.name}</strong></td>
                    <td data-label="Contact">{c.email}<br /><small className="muted">{c.phone || 'no phone'}</small></td>
                    <td data-label="City">{c.city || '—'}</td>
                    <td data-label="Consultations left">{c.consultationsLeft > 0 ? <Badge tone="ok">{c.consultationsLeft}</Badge> : <Badge tone="off">none</Badge>}</td>
                    <td data-label="Joined" className="nowrap">{fmtDate(c.createdAt)}</td>
                    <td data-label="" className="actions"><Link className="btn btn-outline btn-sm" to={`/admin/customers/${c._id}`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {customers.pages > 1 && (
            <div className="cta-row" style={{ marginTop: 16, alignItems: 'center' }}>
              <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span className="muted">Page {customers.page} of {customers.pages}</span>
              <button type="button" className="btn btn-outline btn-sm" disabled={page >= customers.pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
