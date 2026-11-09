import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { trip } from '../content/wellnessTrip.js';

export default function WellnessTrip() {
  useDocumentMeta('Wellness Trip | Anaa Nutricare', 'A monthly Sunday farm wellness trip for families, friends, corporates, societies and schools: fitness, farming, traditional meals and fresh produce.');
  const enquire = { interest: 'Wellness Trip' };
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <div className="container">
          <Link to="/">Home</Link><span aria-hidden="true">&rsaquo;</span>
          <Link to="/services#public-health">Public Health &amp; Nutrition Awareness</Link><span aria-hidden="true">&rsaquo;</span>
          <span aria-current="page">Wellness Trip</span>
        </div>
      </nav>

      <section className="page-hero wt-hero">
        <div className="container page-hero-grid">
          <div>
            <p className="eyebrow">Public health &amp; nutrition awareness</p>
            <h1>Wellness <span>Trip</span></h1>
            <p className="lead">{trip.intro}</p>
            <ul className="wt-who" aria-label="Who the trip is for">
              {trip.audience.map((a) => <li key={a}>{a}</li>)}
            </ul>
            <div className="cta-row">
              <Link className="btn btn-primary btn-lg" to="/discovery-call" state={enquire}>Enquire about a trip <Icon name="arrow" size={18} /></Link>
              <a className="btn btn-outline btn-lg" href="#wt-booking">Price &amp; booking</a>
            </div>
          </div>
          <div className="page-hero-art"><img src="/images/wellness-trip.webp" width="580" height="450" alt="Group practising yoga outdoors at sunset" /></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="kicker">What is included</p>
          <h2 className="section-title">A day of movement, farming and real food</h2>
          <div className="feature-grid four wt-grid">
            {trip.highlights.map((h) => (
              <article key={h.title} className="feature">
                <span className="icon-bubble purple"><Icon name={h.icon} /></span>
                <h3>{h.title}</h3>
                <p>{h.text}</p>
                <ul className="wt-list">{h.items.map((i) => <li key={i}><Icon name="check" size={15} /> {i}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container wt-split">
          <div>
            <p className="kicker">From the farm</p>
            <h2 className="section-title">{trip.fresh.title}</h2>
            <p>{trip.fresh.text}</p>
            <p>{trip.fresh.market}</p>
            <p className="wt-impact"><Icon name="heart" size={20} /> {trip.fresh.impact}</p>
          </div>
          <div className="wt-fun">
            <p className="kicker">Fun time</p>
            {trip.fun.map((f) => (
              <article key={f.title} className="wt-fun-card">
                <span className="icon-bubble"><Icon name={f.icon} /></span>
                <div>
                  <h3>{f.title}</h3>
                  <ul className="wt-chips">{f.items.map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="kicker">Project schedule</p>
          <h2 className="section-title">{trip.schedule.when}</h2>
          <p className="lead"><strong>{trip.schedule.time}.</strong> {trip.schedule.options}</p>
          <ol className="steps wt-steps">
            {trip.schedule.steps.map((s, i) => (
              <li key={s.title}>
                <span className="step-no" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section alt" id="wt-booking">
        <div className="container wt-book">
          <div className="wt-price">
            <p className="kicker">Price</p>
            <p className="wt-amount">{trip.booking.price}</p>
            <p>{trip.booking.priceNote}</p>
            <Link className="btn btn-primary btn-lg" to="/discovery-call" state={enquire}>Book now <Icon name="arrow" size={18} /></Link>
          </div>
          <div>
            <p className="kicker">Please note</p>
            <ul className="wt-rules">
              {trip.booking.rules.map((r) => <li key={r}><Icon name="shield" size={18} /> {r}</li>)}
            </ul>
            <p className="note">Trip details and pricing follow the previous Anaa website and are confirmed with you when you enquire.</p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-band-inner">
          <div><h2>Planning a trip for your team, family or school?</h2><p>Tell us your group size and preferred Sunday and we will get back to you.</p></div>
          <Link className="btn btn-primary btn-lg" to="/discovery-call" state={enquire}>Enquire now</Link>
        </div>
      </section>
    </>
  );
}
