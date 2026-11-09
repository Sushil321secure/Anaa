import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { programSlug } from '../content/site.js';

// One diet consultation service: photo, title, short description and an Enquire button.
// The image file is named after the service slug. `copy` marks the duplicated slides of the looping slider:
// their link is taken out of the tab order.
export default function ServiceCard({ service, copy = false }) {
  const slug = programSlug(service);
  return (
    <article className="svc-card">
      <div className="svc-img">
        <img src={`/images/services/diet/${slug}.webp`} alt={copy ? '' : service.alt} width="800" height="600" decoding="async" draggable="false" />
      </div>
      <div className="svc-body">
        <h3>{service.title}</h3>
        <p>{service.text}</p>
        <Link className="btn btn-outline" to="/discovery-call" state={{ interest: service.title }} tabIndex={copy ? -1 : undefined}>
          Enquire <Icon name="arrow" size={16} />
        </Link>
      </div>
    </article>
  );
}
