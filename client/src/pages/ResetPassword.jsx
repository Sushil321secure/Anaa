import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import PasswordField from '../components/PasswordField.jsx';
import { Alert } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { clearAccount, resetPassword, selectAccount } from '../features/account/accountSlice.js';

export default function ResetPassword() {
  useDocumentMeta('Reset password | Anaa Nutricare');
  const dispatch = useDispatch();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { reset } = useSelector(selectAccount);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const mismatch = again && password !== again ? 'The passwords do not match' : null;
  useEffect(() => () => { dispatch(clearAccount()); }, [dispatch]);

  if (!token) {
    return (
      <AuthShell mode="reset">
        <h1>Reset link missing</h1>
        <p className="sub">This page needs the link from your reset email.</p>
        <p><Link className="btn btn-primary" to="/forgot-password">Request a new link</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="reset">
      <h1>Choose a new password</h1>
      <p className="sub">Use at least 8 characters with a letter and a number.</p>
      {reset.status === 'done' ? (
        <>
          <Alert kind="ok">Your password was changed. You can log in now.</Alert>
          <p><Link className="btn btn-primary" to="/login">Go to login</Link></p>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (!mismatch) dispatch(resetPassword({ token, password })); }} noValidate>
          <Alert>{reset.error?.message}</Alert>
          <PasswordField id="password" label="New password" autoComplete="new-password" showMeter value={password} onChange={(e) => setPassword(e.target.value)} error={reset.error?.details?.password?.[0]} />
          <PasswordField id="again" label="Repeat new password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} error={mismatch} />
          <button className="btn btn-primary" disabled={reset.status === 'loading' || !password || !!mismatch}>{reset.status === 'loading' ? 'Saving…' : 'Change password'}</button>
        </form>
      )}
    </AuthShell>
  );
}
