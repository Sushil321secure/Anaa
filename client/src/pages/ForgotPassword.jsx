import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import Field from '../components/Field.jsx';
import { Alert } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { clearAccount, forgotPassword, selectAccount } from '../features/account/accountSlice.js';

export default function ForgotPassword() {
  useDocumentMeta('Forgot password | Anaa Nutricare');
  const dispatch = useDispatch();
  const { forgot } = useSelector(selectAccount);
  const [email, setEmail] = useState('');
  useEffect(() => () => { dispatch(clearAccount()); }, [dispatch]);

  return (
    <AuthShell mode="reset">
      <h1>Forgot your password?</h1>
      <p className="sub">Enter your email and we will send you a link to choose a new one.</p>
      {forgot.status === 'done' ? (
        <>
          <Alert kind="ok">{forgot.message}</Alert>
          {forgot.devResetLink && (
            <Alert kind="info">
              Development mode: email is not configured, so here is your reset link:{' '}
              <a href={forgot.devResetLink}>Open reset link</a>
            </Alert>
          )}
          <p className="alt-link"><Link to="/login">Back to login</Link></p>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); dispatch(forgotPassword(email)); }} noValidate>
          <Alert>{forgot.error?.message}</Alert>
          <Field id="email" label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={forgot.error?.details?.email?.[0]} />
          <button className="btn btn-primary" disabled={forgot.status === 'loading'}>{forgot.status === 'loading' ? 'Sending…' : 'Send reset link'}</button>
          <p className="alt-link"><Link to="/login">Back to login</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
