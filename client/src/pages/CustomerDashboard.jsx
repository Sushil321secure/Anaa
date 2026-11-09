import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Badge, EmptyState, Loading, PageHeader, StatCard } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { selectUser } from '../features/auth/authSlice.js';
import { fetchMyPurchases, selectPurchases } from '../features/purchases/purchaseSlice.js';
import { fetchMyAppointments, selectAppointments } from '../features/appointments/appointmentSlice.js';
import { fetchProgress, selectProgress } from '../features/progress/progressSlice.js';
import { fetchWallet, selectRewards } from '../features/rewards/rewardsSlice.js';
import { fetchMyPlans, selectDietPlans } from '../features/dietplans/dietPlanSlice.js';
import { fmtDate, fmtDateTime } from '../utils/format.js';

export default function CustomerDashboard() {
  useDocumentMeta('My Dashboard | Anaa Nutricare');
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const purchases = useSelector(selectPurchases);
  const appts = useSelector(selectAppointments);
  const progress = useSelector(selectProgress);
  const rewards = useSelector(selectRewards);
  const plans = useSelector(selectDietPlans);

  useEffect(() => {
    dispatch(fetchMyPurchases());
    dispatch(fetchMyAppointments());
    dispatch(fetchProgress());
    dispatch(fetchWallet());
    dispatch(fetchMyPlans());
  }, [dispatch]);

  // A package stays current until it expires, even when every consultation in it has been used.
  const active = purchases.items.filter((p) => p.valid && (p.kind !== 'CONSULTATION' || p.consultationsRemaining > 0));
  const left = active.reduce((n, p) => n + p.consultationsRemaining, 0);
  const soonest = [...active].sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))[0];
  const next = appts.items.filter((a) => a.status === 'CONFIRMED' && new Date(a.startsAt) > new Date()).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  const withWeight = progress.items.filter((e) => e.weightKg != null);
  const lastW = withWeight[withWeight.length - 1];
  const firstW = withWeight[0];
  const loading = [purchases.status, appts.status].includes('loading') && !purchases.items.length;

  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Here is where you are with your wellness plan." actions={<Link className="btn btn-primary" to="/portal/appointments"><Icon name="calendar" size={18} /> Book a consultation</Link>} />
      {loading ? <Loading /> : (
        <>
          <div className="stats">
            <StatCard icon="video" label="Consultations left" value={left} hint={soonest ? `Valid until ${fmtDate(soonest.expiresAt)}` : 'No active package'} />
            <StatCard icon="calendar" tone="green" label="Next appointment" value={next ? fmtDate(next.startsAt, { year: undefined }) : 'None booked'} hint={next ? fmtDateTime(next.startsAt).split(', ').pop() : 'Book one from Appointments'} />
            <StatCard icon="chart" tone="orange" label="Latest weight" value={lastW ? `${lastW.weightKg} kg` : '—'} hint={lastW && firstW && firstW !== lastW ? `${(lastW.weightKg - firstW.weightKg).toFixed(1)} kg since ${fmtDate(firstW.date, { year: undefined })}` : 'Add a check-in in Progress'} />
            <StatCard icon="gift" label="Reward points" value={rewards.wallet.data?.wallet.available ?? 0} hint={rewards.wallet.data?.wallet.expiringThisMonth ? `${rewards.wallet.data.wallet.expiringThisMonth} expiring this month` : 'Log & Earn points'} />
          </div>

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head"><h2>My package</h2><Link className="btn btn-ghost btn-sm" to="/portal/packages">All packages</Link></div>
              {active.length === 0 ? (
                <EmptyState icon="package" title="No active package" text="Choose a wellness package to start booking consultations." action={<Link className="btn btn-primary" to="/packages">View packages</Link>} />
              ) : active.map((p) => (
                <div key={p.id}>
                  <h3 style={{ margin: 0 }}>{p.packageName} <Badge tone="ok">Active</Badge></h3>
                  <div className="meter" aria-hidden="true"><span style={{ width: `${(p.consultationsRemaining / p.consultationsTotal) * 100}%` }} /></div>
                  <p className="muted" style={{ margin: 0 }}>{p.consultationsRemaining} of {p.consultationsTotal} consultations remaining · expires {fmtDate(p.expiresAt)}</p>
                </div>
              ))}
            </section>

            <section className="panel">
              <div className="panel-head"><h2>Upcoming consultation</h2><Link className="btn btn-ghost btn-sm" to="/portal/appointments">Manage</Link></div>
              {next ? (
                <>
                  <p style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>{fmtDateTime(next.startsAt)}</p>
                  <p className="muted" style={{ margin: 0 }}>{next.durationMinutes} minutes · {next.dietitian?.name ? `with ${next.dietitian.name}` : 'dietitian to be assigned'} · IST</p>
                </>
              ) : (
                <EmptyState icon="calendar" title="Nothing booked yet" text={left > 0 ? 'Pick a time that suits you.' : 'Buy a package to book consultations.'} action={<Link className="btn btn-outline" to="/portal/appointments">{left > 0 ? 'Choose a time' : 'See appointments'}</Link>} />
              )}
            </section>

            <section className="panel">
              <div className="panel-head"><h2>Diet plans</h2><Link className="btn btn-ghost btn-sm" to="/portal/diet-plans">View all</Link></div>
              {plans.items.length === 0 ? <p className="muted">Your nutritionist will add your diet plan here after your consultation.</p> : (
                <ul className="row-list">{plans.items.slice(0, 2).map((p) => <li key={p._id} className="row-card"><div><h3>{p.title}</h3><p className="muted">Added {fmtDate(p.createdAt)}</p></div></li>)}</ul>
              )}
            </section>

            <section className="panel">
              <div className="panel-head"><h2>Refer a friend</h2><Link className="btn btn-ghost btn-sm" to="/portal/rewards">Rewards</Link></div>
              <p className="muted" style={{ marginTop: 0 }}>Invite a friend by email. When they complete their first paid consultation, you earn Log &amp; Earn points.</p>
            </section>
          </div>
        </>
      )}
    </>
  );
}
