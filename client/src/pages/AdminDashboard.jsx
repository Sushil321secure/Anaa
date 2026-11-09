import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { EmptyState, Loading, PageHeader, StatCard, Alert } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { selectUser } from '../features/auth/authSlice.js';
import { fetchStats, selectStaff } from '../features/staff/staffSlice.js';
import { fmtDateTime, inr, ROLE_LABEL } from '../utils/format.js';

export default function AdminDashboard() {
  useDocumentMeta('Overview | Anaa Admin');
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { stats } = useSelector(selectStaff);
  useEffect(() => { dispatch(fetchStats()); }, [dispatch]);
  const d = stats.data;
  const canSeeMoney = ['OWNER', 'ADMIN'].includes(user.role);

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} subtitle={`${ROLE_LABEL[user.role]} overview of Anaa Nutricare today.`} actions={<Link className="btn btn-primary" to="/admin/customers"><Icon name="users" size={18} /> View customers</Link>} />
      <Alert>{stats.status === 'failed' ? stats.error?.message : null}</Alert>
      {!d ? <Loading /> : (
        <>
          <div className="stats">
            <StatCard icon="users" label="Customers" value={d.customers} />
            <StatCard icon="mail" tone="orange" label="New enquiries" value={d.newEnquiries} hint="Waiting for a first reply" />
            <StatCard icon="calendar" tone="green" label="Consultations today" value={d.appointmentsToday} hint={`${d.appointmentsNext7Days} in the next 7 days`} />
            <StatCard icon="package" label="Active packages" value={d.activePackages} hint="With consultations left" />
            {canSeeMoney && <StatCard icon="chart" tone="green" label="Package revenue" value={inr(d.revenuePaise)} hint={`${d.paidOrders} paid package${d.paidOrders === 1 ? '' : 's'}`} />}
          </div>

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head"><h2>Next consultations</h2><Link className="btn btn-ghost btn-sm" to="/admin/appointments">All appointments</Link></div>
              {d.nextAppointments.length === 0 ? <EmptyState icon="calendar" title="Nothing scheduled" text="Upcoming consultations will show up here." /> : (
                <ul className="row-list">
                  {d.nextAppointments.map((a) => (
                    <li key={a._id} className="row-card">
                      <div><h3>{a.customer?.name || 'Customer'}</h3><p className="muted">{fmtDateTime(a.startsAt)} · {a.dietitian?.name || 'unassigned'}</p></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel">
              <h2>Quick links</h2>
              <ul className="row-list">
                <li><Link className="row-card" to="/admin/enquiries"><span>Discovery-call enquiries</span><Icon name="arrow" size={18} /></Link></li>
                <li><Link className="row-card" to="/admin/customers"><span>Customers and packages</span><Icon name="arrow" size={18} /></Link></li>
                <li><Link className="row-card" to="/admin/appointments"><span>Appointments</span><Icon name="arrow" size={18} /></Link></li>
                {canSeeMoney && <li><Link className="row-card" to="/admin/catalogue"><span>Packages and prices</span><Icon name="arrow" size={18} /></Link></li>}
                {canSeeMoney && <li><Link className="row-card" to="/admin/settings"><span>Booking hours and rewards</span><Icon name="arrow" size={18} /></Link></li>}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
