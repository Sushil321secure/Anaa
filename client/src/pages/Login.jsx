import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import Field from '../components/Field.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { Alert } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { clearAuthError, homeFor, login, selectAuthError, selectAuthStatus, selectUser } from '../features/auth/authSlice.js';

// Shown only in the local development build, where the seed script creates these demo accounts.
const DEMO = [
  ['Customer', 'customer@anaa.test'], ['Owner', 'owner@anaa.test'], ['Admin', 'admin@anaa.test'], ['Dietitian', 'dietitian@anaa.test'], ['Operations', 'ops@anaa.test'],
];

export default function Login() {
  useDocumentMeta('Login | Anaa Nutricare', 'Sign in to your Anaa Nutricare account.');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(selectUser);
  const busy = useSelector(selectAuthStatus) === 'loading';
  const error = useSelector(selectAuthError);
  const [form, setForm] = useState({ email: '', password: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);
  if (user) return <Navigate to={location.state?.from || homeFor(user)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    const result = await dispatch(login(form));
    if (login.fulfilled.match(result)) navigate(location.state?.from || homeFor(result.payload), { replace: true });
  }

  return (
    <AuthShell mode="login">
      <h1>Welcome back</h1>
      <p className="sub">Sign in to your account</p>
      <form onSubmit={onSubmit} noValidate>
        <Alert>{error && !error.details ? error.message : error?.details ? 'Please check the highlighted fields.' : null}</Alert>
        <Field id="email" label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={error?.details?.email?.[0]} />
        <PasswordField id="password" label="Password" autoComplete="current-password" value={form.password} onChange={set('password')} error={error?.details?.password?.[0]} />
        <p style={{ textAlign: 'right', margin: '-6px 0 10px' }}><Link to="/forgot-password">Forgot password?</Link></p>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
      </form>
      <p className="alt-link">New here? <Link to="/register">Create an account</Link></p>
      {import.meta.env.DEV && (
        <div className="demo-box">
          <strong>Development demo accounts</strong> (password <code>Demo@12345</code>). Click to fill:
          <div className="cta-row" style={{ marginTop: 8 }}>
            {DEMO.map(([label, email]) => (
              <button key={email} type="button" className="btn btn-outline btn-sm" onClick={() => setForm({ email, password: 'Demo@12345' })}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
