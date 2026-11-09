import Icon from './Icon.jsx';
import { STATUS_LABEL } from '../utils/format.js';

// Small presentational pieces shared by the customer and admin portals.

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return <p className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>;
}

export function Loading({ text = 'Loading…' }) {
  return <p className="loading" role="status"><span className="spinner" aria-hidden="true" /> {text}</p>;
}

export function EmptyState({ icon = 'leaf', title, text, action }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={28} /></span>
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function StatCard({ icon, label, value, hint, tone = 'purple' }) {
  return (
    <article className={`stat stat-${tone}`}>
      <span className="stat-icon"><Icon name={icon} size={22} /></span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint && <p className="stat-hint">{hint}</p>}
      </div>
    </article>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const STATUS_TONE = { CONFIRMED: 'info', IN_PROGRESS: 'ok', COMPLETED: 'ok', CANCELLED: 'off', NO_SHOW: 'warn', PAID: 'ok', NEW: 'info', REWARDED: 'ok', PENDING: 'warn', REJECTED: 'off' };
export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{STATUS_LABEL[status] || status}</Badge>;
}

/** A labelled form control (input/select/textarea) with an error line, matching Field's look. */
export function FormRow({ label, id, error, hint, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function ConfirmDialog({ title, text, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }) {
  return (
    <div className="modal-back" role="presentation" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="cta-row">
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</button>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Keep it</button>
        </div>
      </div>
    </div>
  );
}
