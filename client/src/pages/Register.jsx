import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { Alert } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { api } from '../services/api.js';
import { clearAuthError, homeFor, register, selectAuthError, selectAuthStatus, selectUser } from '../features/auth/authSlice.js';

export default function Register() {
  useDocumentMeta('Sign Up | Anaa Nutricare', 'Create your Anaa Nutricare account.');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invite = params.get('invite') || '';
  const user = useSelector(selectUser);
  const busy = useSelector(selectAuthStatus) === 'loading';
  const error = useSelector(selectAuthError);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [invitation, setInvitation] = useState(null); // { valid, invitedEmail, referrerName }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fieldError = (k) => error?.details?.[k]?.[0];

  // An invitation link must be used with the exact email it was sent to, so fill it in and lock it.
  useEffect(() => {
    if (!invite) return;
    api(`/rewards/invitation?token=${encodeURIComponent(invite)}`)
      .then((r) => { setInvitation(r); if (r.valid) setForm((f) => ({ ...f, email: r.invitedEmail })); })
      .catch(() => setInvitation({ valid: false }));
  }, [invite]);

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);
  if (user) return <Navigate to={homeFor(user)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    if (invite && invitation?.valid) payload.invite = invite;
    const result = await dispatch(register(payload));
    if (register.fulfilled.match(result)) navigate(homeFor(result.payload.user), { replace: true });
  }
  const locked = Boolean(invitation?.valid);

  return (
    <AuthShell mode="register">
      <h1>Create your account</h1>
      <p className="sub">It takes less than a minute.</p>
      {invitation?.valid && <Alert kind="ok">{invitation.referrerName} invited you. Register with this email address ({invitation.invitedEmail}) to keep the invitation.</Alert>}
      {invitation && !invitation.valid && <Alert kind="info">This invitation link has expired or was already used. You can still create an account.</Alert>}
      <form onSubmit={onSubmit} noValidate>
        <Alert>{error && !error.details ? error.message : error?.details ? error.details.invite ? error.message : 'Please check the highlighted fields.' : null}</Alert>
        <Field id="name" label="Full name" autoComplete="name" required value={form.name} onChange={set('name')} error={fieldError('name')} />
        <Field id="email" label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} readOnly={locked} error={fieldError('email')} />
        <Field id="phone" label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={fieldError('phone')} />
        <PasswordField id="password" label="Password" autoComplete="new-password" showMeter value={form.password} onChange={set('password')} error={fieldError('password')} hint="At least 8 characters with a letter and a number." />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="alt-link">Already have an account? <Link to="/login">Login</Link></p>
    </AuthShell>
  );
}
