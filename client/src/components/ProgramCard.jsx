import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { programSlug } from '../content/site.js';

// The one programme card used everywhere (home slider, Services page), so image, size and button never differ.
// `copy` marks the duplicated slides of the looping slider: their link is taken out of the tab order.
export default function ProgramCard({ program, copy = false, id, lazy = false }) {
  const slug = programSlug(program);
  return (
    <article className="prog-card" id={id}>
      <div className="prog-img">
        <img src={`/images/programs/${slug}.webp`} alt="" width="1200" height="675" loading={lazy ? 'lazy' : undefined} decoding="async" draggable="false" />
      </div>
      <div className="prog-body">
        <h3>{program.title}</h3>
        <p>{program.text}</p>
        <Link className="btn btn-outline" to={`/programs/${slug}`} tabIndex={copy ? -1 : undefined}>Find out more <Icon name="arrow" size={16} /></Link>
      </div>
    </article>
  );
}
