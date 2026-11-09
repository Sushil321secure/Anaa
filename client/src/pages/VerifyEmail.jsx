import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import { Alert, Loading } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { fetchMe, verifyEmail } from '../features/auth/authSlice.js';

export default function VerifyEmail() {
  useDocumentMeta('Verify email | Anaa Nutricare');
  const dispatch = useDispatch();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState({ status: token ? 'loading' : 'missing', points: 0, message: '' });
  const started = useRef(false); // React StrictMode runs effects twice in development: a link must only be used once

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    dispatch(verifyEmail(token)).then((res) => {
      if (verifyEmail.fulfilled.match(res)) {
        setState({ status: 'done', points: res.payload.pointsEarned || 0, message: '' });
        dispatch(fetchMe());
      } else {
        setState({ status: 'failed', points: 0, message: res.payload?.message || 'Could not verify your email.' });
      }
    });
  }, [dispatch, token]);

  return (
    <AuthShell mode="login">
      <h1>Verify your email</h1>
      {state.status === 'loading' && <Loading text="Verifying…" />}
      {state.status === 'missing' && <Alert kind="info">This page needs the link from your verification email.</Alert>}
      {state.status === 'failed' && (
        <>
          <Alert>{state.message}</Alert>
          <p className="sub">Log in and use “Resend verification email” from your portal.</p>
        </>
      )}
      {state.status === 'done' && (
        <>
          <Alert kind="ok">Your email address is verified.{state.points > 0 ? ` You earned ${state.points} Log & Earn points.` : ''}</Alert>
          <p><Link className="btn btn-primary" to="/portal">Go to my portal</Link></p>
        </>
      )}
      {state.status !== 'done' && <p className="alt-link"><Link to="/login">Back to login</Link></p>}
    </AuthShell>
  );
}
