import Icon from './Icon.jsx';
import { social } from '../content/site.js';

const labels = { facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn', whatsapp: 'WhatsApp' };

// Round brand-coloured links. Only profiles with a URL are rendered. size: 'sm' (top bar) | 'lg' (footer).
export default function SocialLinks({ size = 'lg', className = '' }) {
  const items = Object.entries(social).filter(([, url]) => url);
  if (items.length === 0) return null;
  return (
    <ul className={`social-links ${size} ${className}`} aria-label="Anaa on social media">
      {items.map(([name, url]) => (
        <li key={name}>
          <a className={`sl-${name}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Anaa Nutricare on ${labels[name]} (opens in a new tab)`} title={labels[name]}>
            <Icon name={name} size={size === 'sm' ? 18 : 24} />
          </a>
        </li>
      ))}
    </ul>
  );
}
