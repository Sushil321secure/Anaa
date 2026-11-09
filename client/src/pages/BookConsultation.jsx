import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { fetchFees, selectAppointments } from '../features/appointments/appointmentSlice.js';
import { selectUser } from '../features/auth/authSlice.js';
import { inr } from '../utils/format.js';

const OPTIONS = [
  { mode: 'ONLINE', icon: 'video', title: 'Online consultation', sub: 'One-to-one video call with a certified nutritionist, from wherever you are.', points: ['Personalised guidance on your goals', 'Joins from phone or laptop', 'Time chosen in Indian Standard Time'], fee: 'onlinePaise' },
  { mode: 'OFFLINE', icon: 'users', title: 'Offline consultation', sub: 'Meet your nutritionist in person at the clinic for a detailed, hands-on session.', points: ['Face-to-face assessment', 'Same personalised guidance', 'Time chosen in Indian Standard Time'], fee: 'offlinePaise' },
];

export default function BookConsultation() {
  useDocumentMeta('Book a Consultation | Anaa Nutricare', 'Book a paid one-to-one nutrition consultation with Anaa Nutricare, online (₹1,500) or offline (₹1,000).');
  const dispatch = useDispatch();
  const { fees } = useSelector(selectAppointments);
  const user = useSelector(selectUser);
  useEffect(() => { dispatch(fetchFees()); }, [dispatch]);
  const isCustomer = user?.role === 'CUSTOMER';
  const target = (mode) => `/portal/appointments?mode=${mode}`;

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <div className="container"><Link to="/">Home</Link><span aria-hidden="true">&rsaquo;</span><span aria-current="page">Book a consultation</span></div>
      </nav>

      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Diet consultation</p>
          <h1>Book a <span>consultation</span></h1>
          <p className="lead">Choose how you would like to meet your nutritionist. Pick a date and time, pay securely online, and your consultation is confirmed.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="consult-grid">
            {OPTIONS.map((o) => (
              <article key={o.mode} className="consult-card">
                <span className="consult-ico"><Icon name={o.icon} size={26} /></span>
                <h2>{o.title}</h2>
                <p className="consult-fee">{inr(fees[o.fee])} <small>per consultation</small></p>
                <p className="muted">{o.sub}</p>
                <ul>{o.points.map((p) => <li key={p}><Icon name="check" size={16} /> {p}</li>)}</ul>
                {isCustomer ? (
                  <Link className="btn btn-primary btn-lg" to={target(o.mode)}>Choose a time <Icon name="arrow" size={18} /></Link>
                ) : (
                  <Link className="btn btn-primary btn-lg" to="/login" state={{ from: target(o.mode) }}>Log in to book <Icon name="arrow" size={18} /></Link>
                )}
              </article>
            ))}
          </div>
          {!user && <p className="consult-note">New here? <Link to="/register">Create a free account</Link>, then come back and choose a time. Already a client with a wellness package? Your package consultations can be used for either type.</p>}
        </div>
      </section>

      <section className="section alt">
        <div className="container consult-alt">
          <div>
            <h2 className="section-title">Not ready to book yet?</h2>
            <p className="lead">A free discovery call is a separate, no-cost conversation to tell us your goals and ask questions. It is not a consultation.</p>
          </div>
          <Link className="btn btn-outline btn-lg" to="/discovery-call">Request a free discovery call</Link>
        </div>
      </section>
    </>
  );
}
