import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { corporate } from '../content/corporateWorkshops.js';

export default function CorporateWorkshops() {
  useDocumentMeta('Corporate Workshops | Anaa Nutricare', 'Corporate wellness workshops and webinars: health talks, chair yoga, Tabata, Zumba, healthy cooking, a 3-day wellness package and individual sessions.');
  const enquire = { interest: 'Corporate Workshops' };
  const { group, individual } = corporate;
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <div className="container">
          <Link to="/">Home</Link><span aria-hidden="true">&rsaquo;</span>
          <Link to="/services#workshops">Workshops</Link><span aria-hidden="true">&rsaquo;</span>
          <span aria-current="page">Corporate Workshops</span>
        </div>
      </nav>

      <section className="page-hero wt-hero">
        <div className="container page-hero-grid">
          <div>
            <p className="eyebrow">Workshops</p>
            <h1>Corporate <span>workshops</span></h1>
            <p className="lead">{corporate.intro}</p>
            <ul className="wt-who" aria-label="Formats">
              <li>Workshops</li><li>Webinars</li><li>Online</li><li>Offline</li>
            </ul>
            <div className="cta-row">
              <Link className="btn btn-primary btn-lg" to="/discovery-call" state={enquire}>Enquire for your company <Icon name="arrow" size={18} /></Link>
              <a className="btn btn-outline btn-lg" href="#cw-package">3-day package</a>
            </div>
          </div>
          <div className="page-hero-art"><img src="/images/corporate-workshops.webp" width="800" height="600" alt="Colleagues stretching together on mats in a bright workspace" /></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="kicker">{group.mode}</p>
          <h2 className="section-title">{group.title}</h2>
          <ul className="cw-grid">
            {group.items.map((i) => (
              <li key={i.title} className="cw-card">
                <span className="icon-bubble purple"><Icon name={i.icon} /></span>
                <h3>{i.title}</h3>
                {i.detail && <p>{i.detail}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" id="cw-package" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cw-package">
            <span className="icon-bubble"><Icon name="calendar" size={26} /></span>
            <div>
              <h2>{corporate.package.title}</h2>
              <p>{corporate.package.text}</p>
            </div>
            <Link className="btn btn-primary btn-lg" to="/discovery-call" state={{ interest: 'Corporate Workshops: 3-day wellness package' }}>Ask about the package</Link>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container cw-indiv">
          <div className="cw-indiv-media"><img src="/images/corporate-individual.webp" width="800" height="600" alt="Employee stretching at her desk" loading="lazy" /></div>
          <div>
            <p className="kicker">One to one</p>
            <h2 className="section-title">{individual.title}</h2>
            <ul className="cw-indiv-list">
              {individual.items.map((i) => (
                <li key={i.title}>
                  <span className="icon-bubble purple"><Icon name={i.icon} /></span>
                  <div>
                    <h3>{i.title}</h3>
                    <p>{i.text}</p>
                    {i.tags && <ul className="wt-chips">{i.tags.map((t) => <li key={t}>{t}</li>)}</ul>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="note">Wellness guidance complements, and does not replace, medical care.</p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-band-inner">
          <div><h2>Healthier, happier teams</h2><p>Tell us your team size and preferred format and we will plan the right sessions.</p></div>
          <Link className="btn btn-primary btn-lg" to="/discovery-call" state={enquire}>Enquire now</Link>
        </div>
      </section>
    </>
  );
}
