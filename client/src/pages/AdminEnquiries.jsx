import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAssignees, fetchEnquiries, updateEnquiry } from '../features/enquiries/enquirySlice.js';
import { Alert, EmptyState, Loading, PageHeader } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';

const STATUSES = ['NEW', 'CONTACTED', 'SCHEDULED', 'CONVERTED', 'CLOSED'];
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—');
const toLocalInput = (d) => (d ? new Date(new Date(d).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 16) : '');

export default function AdminEnquiries() {
  useDocumentMeta('Enquiries | Anaa Admin');
  const dispatch = useDispatch();
  const { items, total, page, pages, status, error } = useSelector((s) => s.enquiries.list);
  const assignees = useSelector((s) => s.enquiries.assignees);
  const saveError = useSelector((s) => s.enquiries.saveError);
  const [filter, setFilter] = useState({ status: '', q: '' });
  const [pageNo, setPageNo] = useState(1);

  useEffect(() => { dispatch(fetchAssignees()); }, [dispatch]);
  useEffect(() => {
    const t = setTimeout(() => dispatch(fetchEnquiries({ ...filter, page: pageNo })), filter.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [dispatch, filter, pageNo]);

  const save = (id, changes) => dispatch(updateEnquiry({ id, changes }));

  return (
    <>
      <PageHeader title="Discovery-call enquiries" subtitle="Free discovery-call requests from the website. Assign them, update the status and set follow-up reminders." />
      <div className="toolbar">
        <input aria-label="Search enquiries" placeholder="Search name, email, phone" value={filter.q} onChange={(e) => { setPageNo(1); setFilter({ ...filter, q: e.target.value }); }} />
        <select aria-label="Filter by status" value={filter.status} onChange={(e) => { setPageNo(1); setFilter({ ...filter, status: e.target.value }); }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="muted">{total} total</span>
      </div>
      <Alert>{saveError || (status === 'failed' ? error : null)}</Alert>
      {status === 'loading' && items.length === 0 && <Loading />}
      {status === 'ready' && items.length === 0 && <section className="panel"><EmptyState icon="mail" title="No enquiries match" text="New discovery-call requests will appear here." /></section>}
      {items.length > 0 && (
        <section className="panel"><div className="table-wrap">
          <table className="rtable">
            <thead>
              <tr><th>Visitor</th><th>Goal</th><th>Preferred (IST)</th><th>Status</th><th>Assigned to</th><th>Follow-up (IST)</th></tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e._id}>
                  <td data-label="Visitor"><strong>{e.name}</strong><br /><a href={`mailto:${e.email}`}>{e.email}</a><br />{e.phone}</td>
                  <td data-label="Goal">{e.goal}{e.message && <><br /><small className="muted">{e.message}</small></>}</td>
                  <td data-label="Preferred (IST)">{fmt(e.preferredAt)}</td>
                  <td data-label="Status">
                    <select aria-label={`Status for ${e.name}`} value={e.status} onChange={(ev) => save(e._id, { status: ev.target.value })}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td data-label="Assigned to">
                    <select aria-label={`Assign ${e.name}`} value={e.assignedTo?._id || ''} onChange={(ev) => save(e._id, { assignedTo: ev.target.value || null })}>
                      <option value="">Unassigned</option>
                      {assignees.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                  </td>
                  <td data-label="Follow-up (IST)">
                    <input type="datetime-local" aria-label={`Follow-up for ${e.name}`} defaultValue={toLocalInput(e.followUpAt)} key={e.followUpAt || 'none'}
                      onBlur={(ev) => { const v = ev.target.value; if (v !== toLocalInput(e.followUpAt)) save(e._id, { followUpAt: v ? new Date(`${v}:00+05:30`).toISOString() : null }); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></section>
      )}
      {pages > 1 && (
        <div className="toolbar">
          <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPageNo(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className="btn btn-outline" disabled={page >= pages} onClick={() => setPageNo(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
