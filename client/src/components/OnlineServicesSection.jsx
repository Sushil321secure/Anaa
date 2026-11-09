import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { api } from '../services/api.js';
import { inr } from '../utils/format.js';
import { localTime } from '../pages/yoga/yogaUtils.js';

/** Home page: the two online services. Fees and sessions come live from the server; nothing here is hard-coded. */
export default function OnlineServicesSection() {
  const [fees, setFees] = useState(null);
  const [sessions, setSessions] = useState(null);
  useEffect(() => {
    api('/appointments/fees').then(setFees).catch(() => setFees(null));
    api('/yoga-public').then((r) => setSessions(r.items)).catch(() => setSessions([]));
  }, []);
  const next = (sessions || []).slice(0, 2);

  return (
    <section className="section alt online-services" id="online" aria-labelledby="online-title">
      <div className="container">
        <p className="kicker">Learn and heal from anywhere</p>
        <h2 className="section-title" id="online-title">Two ways to work with us online</h2>
        <div className="online-grid">
          <article className="panel online-card">
            <span className="online-icon"><Icon name="video" size={26} /></span>
            <h3>Online diet consultation</h3>
            <p>A private one-to-one video consultation with a qualified dietitian, from your phone or laptop. No travel, no waiting room.</p>
            <ul className="online-points">
              <li>Online consultation{fees ? <strong> {inr(fees.onlinePaise)}</strong> : null}</li>
              <li>In-clinic consultation{fees ? <strong> {inr(fees.offlinePaise)}</strong> : null}</li>
              <li>Pick a time that suits you and pay securely online</li>
            </ul>
            <div className="cta-row">
              <Link className="btn btn-primary" to="/book-consultation">Book a consultation <Icon name="arrow" size={18} /></Link>
              <Link className="btn btn-outline" to="/discovery-call">Free discovery call</Link>
            </div>
          </article>

          <article className="panel online-card">
            <span className="online-icon yoga"><Icon name="leaf" size={26} /></span>
            <h3>Global online yoga sessions</h3>
            <p>Live group yoga with our coaches over Google Meet, open to participants anywhere in the world. Times show in your own time zone.</p>
            {sessions === null ? <p className="muted">Loading upcoming sessions…</p> : next.length === 0 ? (
              <p className="muted">New group sessions are being scheduled. Create a free account and we will show them here as soon as they open.</p>
            ) : (
              <ul className="online-points">
                {next.map((s) => <li key={s._id}><strong>{s.title}</strong><br /><small className="muted">{localTime(s.startsAt)} · {s.durationMinutes} min · {s.pricePaise ? inr(s.pricePaise) : 'Free'}</small></li>)}
              </ul>
            )}
            <div className="cta-row">
              <Link className="btn btn-primary" to="/online-yoga">See yoga sessions <Icon name="arrow" size={18} /></Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
