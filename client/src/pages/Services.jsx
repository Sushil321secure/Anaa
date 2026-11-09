import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import DietServicesCarousel from '../components/DietServicesCarousel.jsx';
import ProgramCard from '../components/ProgramCard.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { awareness, fitnessPrograms, programSlug, workshops } from '../content/site.js';
import { fetchCatalog, selectCatalog } from '../features/catalog/catalogSlice.js';

// One category = one section, so diet consultation, fitness, awareness and workshops stay separate.
function Category({ id, kicker, title, intro, items, idPrefix = '', alt, note }) {
  return (
    <section className={`section${alt ? ' alt' : ''}`} id={id}>
      <div className="container">
        <p className="kicker">{kicker}</p>
        <h2 className="section-title">{title}</h2>
        {intro && <p className="lead">{intro}</p>}
        <div className="card-grid">
          {items.map((p) => (
            <article key={p.title} id={idPrefix + programSlug(p)} className="card">
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              {p.to ? (
                <div className="card-actions">
                  <Link className="btn btn-outline" to={p.to}>Find out more <Icon name="arrow" size={16} /></Link>
                  <Link className="btn-link" to="/discovery-call" state={{ interest: p.title }}>Enquire</Link>
                </div>
              ) : (
                <Link className="btn btn-outline" to="/discovery-call" state={{ interest: p.title }}>Enquire <Icon name="arrow" size={16} /></Link>
              )}
            </article>
          ))}
        </div>
        {note && <p className="note">{note}</p>}
      </div>
    </section>
  );
}

export default function Services() {
  useDocumentMeta('Services | Anaa Nutricare', 'Diet consultations, fitness and wellness programmes, public health awareness and workshops from Anaa Nutricare, Bengaluru.');
  const dispatch = useDispatch();
  const { services, status } = useSelector(selectCatalog);
  useEffect(() => {
    if (status === 'idle') dispatch(fetchCatalog());
  }, [dispatch, status]);

  return (
    <>
      <section className="page-hero compact">
        <div className="container">
          <p className="eyebrow">Services</p>
          <h1>Nutrition care <span>designed around you</span></h1>
          <p className="lead">Diet consultations, fitness and wellness programmes, awareness and workshops, guided by our nutrition team.</p>
        </div>
      </section>

      {services.length > 0 && (
        <section className="section">
          <div className="container">
            <h2 className="section-title">Consultations</h2>
            <div className="card-grid">
              {services.map((s) => (
                <article key={s._id} className="card">
                  <h3>{s.name}</h3>
                  <p>{s.summary}</p>
                  <p className="muted">{s.durationMinutes ? `${s.durationMinutes} min · ` : ''}{s.pricePaise != null ? `₹${s.pricePaise / 100}` : 'Pricing on request'}</p>
                  <Link className="btn btn-outline" to="/discovery-call" state={{ interest: s.name }}>Enquire about this</Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <DietServicesCarousel alt={services.length === 0} />
      <section className={`section prog${services.length > 0 ? ' alt' : ''}`} id="fitness">
        <div className="container">
          <p className="kicker">Fitness &amp; wellness programmes</p>
          <h2 className="section-title">Our popular programmes</h2>
          <div className="prog-grid">
            {fitnessPrograms.map((p) => <ProgramCard key={p.title} program={p} id={programSlug(p)} lazy />)}
          </div>
        </div>
      </section>
      <Category id="public-health" kicker="Public health & nutrition awareness" title="Awareness for healthier communities" items={awareness} />
      <Category id="workshops" kicker="Workshops" title="Workshops for workplaces and schools" items={workshops} idPrefix="workshop-" alt />
    </>
  );
}
