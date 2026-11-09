import { Link } from 'react-router-dom';
import Slider from './Slider.jsx';
import ServiceCard from './ServiceCard.jsx';
import { dietServices, programSlug } from '../content/site.js';

// Cards visible per row: 4 on desktop, 2 on tablets, 1 on phones.
const COLUMNS = [[1100, 4], [700, 2]];

// The 16 diet consultation services as an auto-advancing carousel. Every service is also listed under
// "See all 16 services", so none depends on the slider to be reachable.
export default function DietServicesCarousel({ alt = false, id = 'diet', kicker = 'Diet consultation', intro = 'Eat right, not less. Choose the area you want support with.', children }) {
  return (
    <section className={`section svc${alt ? ' alt' : ''}`} id={id}>
      <div className="container">
        <p className="kicker">{kicker}</p>
        <h2 className="section-title">Consultation we provide</h2>
        {intro && <p className="lead">{intro}</p>}
        <Slider
          items={dietServices}
          getKey={(s) => s.title}
          label="Diet consultation services"
          columns={COLUMNS}
          className="svc-slider"
          renderItem={(s, copy) => <ServiceCard service={s} copy={copy} />}
        />
        <details className="svc-all">
          <summary>See all {dietServices.length} services</summary>
          <ul>
            {dietServices.map((s) => (
              <li key={s.title} id={programSlug(s)}>
                <Link to="/discovery-call" state={{ interest: s.title }}>{s.title}</Link>
              </li>
            ))}
          </ul>
        </details>
        <p className="note">Photos are illustrative. Nutrition guidance complements, and does not replace, your doctor&apos;s treatment.</p>
        {children}
      </div>
    </section>
  );
}
