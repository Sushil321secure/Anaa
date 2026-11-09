import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

export const inr = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const BADGE_TEXT = { MOST_POPULAR: 'Most popular', BEST_VALUE: 'Best value' };

// Pay button for live packages; built-in (fallback) cards send visitors to a discovery call instead.
export default function PackageCard({ pkg, onBuy, busy, disabled }) {
  const { pricing } = pkg;
  const consults = 1 + (pkg.followUpConsults || 0);
  const canPay = pricing.priced && !pkg.fallback && onBuy;
  return (
    <article className={`pkg-card${pkg.badge === 'MOST_POPULAR' ? ' pkg-featured' : ''}${pkg.badge === 'BEST_VALUE' ? ' pkg-value' : ''}`}>
      {pkg.badge && <span className="pkg-badge">{BADGE_TEXT[pkg.badge]}</span>}
      <h2>{pkg.name}</h2>
      {pkg.tagline && <p className="pkg-tagline">{pkg.tagline}</p>}

      {pricing.priced ? (
        <div className="pkg-price">
          <strong>{inr(pricing.pricePaise)}</strong>
          <span>for {pkg.durationDays} days ({pricing.months} {pricing.months === 1 ? 'month' : 'months'})</span>
          <small>
            Effective {inr(pricing.effectiveMonthlyPaise)} per month
            {pricing.months > 1 && pricing.pricePaise % pricing.months !== 0 ? ' (approx.)' : ''}
          </small>
          {pricing.label && <em className="pkg-save">{pricing.label}</em>}
          {pricing.savingsPaise > 0 && (
            <small className="pkg-ref">Compared with {pricing.months} × {inr(pkg.referenceMonthlyPaise)} monthly. You save {inr(pricing.savingsPaise)} ({pricing.savingsPercent}%).</small>
          )}
        </div>
      ) : (
        <p className="pkg-price"><strong>Pricing on request</strong></p>
      )}

      <p className="pkg-for"><b>Best for:</b> {pkg.bestFor || pkg.summary}</p>

      <dl className="pkg-stats">
        <div><dt>Consultations</dt><dd>{consults}</dd><small>{pkg.initialConsultMinutes}-min initial + {pkg.followUpConsults} follow-up{pkg.followUpConsults === 1 ? '' : 's'}</small></div>
        <div><dt>Diet programmes</dt><dd>{pkg.dietPlans}</dd><small>{pkg.dietRevisionsLabel}</small></div>
      </dl>

      <ul className="pkg-features">
        {pkg.features?.map((f) => <li key={f}><Icon name="check" size={16} /> {f}</li>)}
      </ul>

      <div className="pkg-actions">
        {canPay ? (
          <button className="btn btn-primary" onClick={() => onBuy(pkg)} disabled={disabled}>
            {busy ? 'Opening payment…' : `Book & pay ${inr(pricing.pricePaise)}`}
          </button>
        ) : (
          <Link className="btn btn-primary" to="/discovery-call" state={{ interest: pkg.name }}>
            {pkg.fallback ? `Book ${pkg.name}` : 'Enquire now'}
          </Link>
        )}
        {canPay && <Link className="pkg-link" to="/discovery-call" state={{ interest: pkg.name }}>Not sure? Book a free discovery call</Link>}
      </div>
    </article>
  );
}
