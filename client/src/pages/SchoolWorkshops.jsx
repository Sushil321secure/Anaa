import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { school } from '../content/schoolWorkshops.js';

export default function SchoolWorkshops() {
  useDocumentMeta('School Wellness Workshops | Anaa Nutricare', 'Nutrition games, lessons, curriculum planning, teacher training, parent workshops and student health assessments for schools.');
  const enquire = { interest: 'School Wellness Workshops' };
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <div className="container">
          <Link to="/">Home</Link><span aria-hidden="true">&rsaquo;</span>
          <Link to="/services#workshops">Workshops</Link><span aria-hidden="true">&rsaquo;</span>
          <span aria-current="page">School Wellness Workshops</span>
        </div>
      </nav>

      <section className="page-hero wt-hero">
        <div className="container page-hero-grid">
          <div>
            <p className="eyebrow">Workshops</p>
            <h1>School wellness <span>workshops</span></h1>
            <p className="lead">{school.intro}</p>
            <ul className="wt-who" aria-label="Who the workshops are for">
              <li>Students</li><li>Teachers</li><li>Parents</li><li>Schools</li>
            </ul>
            <div className="cta-row">
              <Link className="btn btn-primary btn-lg" to="/discovery-call" state={enquire}>Enquire for your school <Icon name="arrow" size={18} /></Link>
              <a className="btn btn-outline btn-lg" href="#sw-assessments">Student assessments</a>
            </div>
          </div>
          <div className="page-hero-art"><img src="/images/school-wellness-workshops.webp" width="580" height="450" alt="Children stretching together on yoga mats in a bright room" /></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="kicker">What we offer</p>
          <h2 className="section-title">Learning healthy habits, together</h2>
          <div className="feature-grid sw-grid">
            {school.groups.map((g) => (
              <article key={g.title} className="feature">
                <span className="icon-bubble purple"><Icon name={g.icon} /></span>
                <h3>{g.title}</h3>
                <ul className="sw-items">
                  {g.items.map((i) => (
                    <li key={i.title}><Icon name="check" size={16} /><span><strong>{i.title}</strong>{i.text}</span></li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="sw-assessments">
        <div className="container wt-split">
          <div>
            <p className="kicker">Assessments</p>
            <h2 className="section-title">{school.assessment.title}</h2>
            <p>{school.assessment.text}</p>
            <p className="wt-impact"><Icon name="shield" size={20} /> {school.assessment.note}</p>
          </div>
          <div className="wt-fun">
            <p className="kicker">Online or offline</p>
            {school.modes.map((m) => (
              <article key={m.label} className="wt-fun-card">
                <span className="icon-bubble"><Icon name={m.label.startsWith('Offline') ? 'pin' : 'video'} /></span>
                <div><h3>{m.label}</h3><p style={{ margin: 0 }}>{m.text}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-band-inner">
          <div><h2>Bring healthy eating to your school</h2><p>Tell us about your school and we will suggest the right workshops.</p></div>
          <Link className="btn btn-primary btn-lg" to="/discovery-call" state={enquire}>Enquire now</Link>
        </div>
      </section>
    </>
  );
}
