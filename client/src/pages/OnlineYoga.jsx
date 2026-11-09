import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { selectUser } from '../features/auth/authSlice.js';
import { api } from '../services/api.js';
import { inr } from '../utils/format.js';
import { LEVEL_LABEL, localTime, originalTime, sameZone } from './yoga/yogaUtils.js';

const STEPS = [
  ['Create a free account', 'Register once. You can book free and paid sessions with the same account.'],
  ['Book your session', 'Choose a session in your own time zone. Paid sessions are confirmed after a secure online payment.'],
  ['Join from your account', 'At the session time, press Join Session in your bookings. It opens Google Meet in a new tab.'],
];

export default function OnlineYoga() {
  useDocumentMeta('Online Group Yoga Sessions | Anaa Nutricare', 'Live online group yoga with Anaa Nutricare coaches on Google Meet, open to participants worldwide.');
  const user = useSelector(selectUser);
  const [items, setItems] = useState(null);
  useEffect(() => { api('/yoga-public').then((r) => setItems(r.items)).catch(() => setItems([])); }, []);
  const customer = user?.role === 'CUSTOMER';
  const cta = customer ? { to: '/portal/yoga', label: 'Book in my account' } : user ? null : { to: '/register', label: 'Create a free account' };

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <div className="container"><Link to="/">Home</Link><span aria-hidden="true">&rsaquo;</span><span aria-current="page">Online yoga</span></div>
      </nav>
      <section className="page-hero">
        <div className="container">
          <p className="kicker">Group yoga, live online</p>
          <h1>Global online yoga sessions</h1>
          <p className="lead">Practise with an Anaa Nutricare coach in a live group class on Google Meet, wherever you are. Sessions are shown in your own time zone.</p>
          <div className="cta-row">
            {cta && <Link className="btn btn-primary" to={cta.to}>{cta.label} <Icon name="arrow" size={18} /></Link>}
            {!user && <Link className="btn btn-outline" to="/login">Log in</Link>}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Upcoming sessions</h2>
          {items === null ? <p className="muted">Loading sessions…</p> : items.length === 0 ? (
            <p className="lead">No sessions are open for booking right now. New group sessions are added regularly, so please check back soon, or <Link to="/contact">contact us</Link> to ask about upcoming classes.</p>
          ) : (
            <div className="yoga-grid">
              {items.map((s) => (
                <article key={s._id} className="panel yoga-card">
                  <div className="yoga-card-head"><h3>{s.title}</h3><span className={`badge ${s.pricePaise ? 'badge-info' : 'badge-ok'}`}>{s.pricePaise ? inr(s.pricePaise) : 'Free'}</span></div>
                  <p className="muted">{s.category} · {LEVEL_LABEL[s.difficultyLevel]}{s.coachName ? ` · with ${s.coachName}` : ''}</p>
                  {s.description && <p>{s.description}</p>}
                  <p><strong>{localTime(s.startsAt)}</strong>{!sameZone(s.timezone) && <><br /><small className="muted">{originalTime(s.startsAt, s.timezone)}</small></>}<br /><small className="muted">{s.durationMinutes} minutes</small></p>
                  <p className="muted">{s.seatsLeft > 0 ? `${s.seatsLeft} seats left` : 'Full'}</p>
                  {customer ? <Link className="btn btn-primary" to="/portal/yoga">Book in my account</Link> : !user && <Link className="btn btn-primary" to="/login" state={{ from: '/portal/yoga' }}>Log in to book</Link>}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <h2 className="section-title">How it works</h2>
          <ol className="steps-grid">
            {STEPS.map(([t, d], i) => <li key={t}><span className="step-n">{i + 1}</span><h3>{t}</h3><p>{d}</p></li>)}
          </ol>
          <p className="muted">Classes use Google Meet, so you need a device with a camera and microphone and a stable connection. Yoga is not a substitute for medical advice: tell your coach about any injury or health condition before you practise.</p>
        </div>
      </section>
    </>
  );
}
