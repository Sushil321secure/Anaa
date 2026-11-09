import { useState } from 'react';

// 0..4 from length and character variety (a hint only: the server enforces the real rule).
export function passwordScore(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s += 1;
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) s += 1;
  if (p.length >= 12) s += 1;
  if (/[^A-Za-z0-9]/.test(p) && /[A-Z]/.test(p)) s += 1;
  return s;
}

export default function PasswordField({ id, label, value, onChange, error, autoComplete, showMeter = false, hint, required = true }) {
  const [show, setShow] = useState(false);
  const score = showMeter ? passwordScore(value) : 0;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
        <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
      </div>
      {showMeter && value && <div className="pw-meter" data-score={score} aria-hidden="true"><span /><span /><span /><span /></div>}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}
