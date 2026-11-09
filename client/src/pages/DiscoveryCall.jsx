import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import Field from '../components/Field.jsx';
import { resetSubmit, submitEnquiry } from '../features/enquiries/enquirySlice.js';

export default function DiscoveryCall() {
  const dispatch = useDispatch();
  const location = useLocation();
  const { status, error } = useSelector((s) => s.enquiries.submit);
  const interest = location.state?.interest;
  const [form, setForm] = useState({ name: '', email: '', phone: '', goal: interest ? `Interested in: ${interest}` : '', preferredAt: '', message: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fieldError = (k) => error?.details?.[k]?.[0];

  useEffect(() => {
    document.title = 'Free Discovery Call | Anaa Nutricare';
    return () => { dispatch(resetSubmit()); };
  }, [dispatch]);

  function onSubmit(e) {
    e.preventDefault();
    const payload = { ...form };
    // datetime-local has no timezone: interpret it as the business timezone (IST) and send UTC.
    payload.preferredAt = form.preferredAt ? new Date(`${form.preferredAt}:00+05:30`).toISOString() : undefined;
    for (const k of Object.keys(payload)) if (payload[k] === '') delete payload[k];
    dispatch(submitEnquiry(payload));
  }

  if (status === 'done') {
    return (
      <section className="auth-card">
        <h1>Thank you!</h1>
        <p>We have received your request and sent a confirmation email. Our team will contact you to arrange a suitable time. Your preferred slot is a request, not a confirmed appointment.</p>
        <Link className="btn btn-outline" to="/">Back to home</Link>
      </section>
    );
  }

  return (
    <section className="auth-card wide">
      <h1>Book a Free Discovery Call</h1>
      <form onSubmit={onSubmit} noValidate>
        <Field id="name" label="Full name" autoComplete="name" required value={form.name} onChange={set('name')} error={fieldError('name')} />
        <Field id="email" label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={fieldError('email')} />
        <Field id="phone" label="Phone" type="tel" autoComplete="tel" required value={form.phone} onChange={set('phone')} error={fieldError('phone')} />
        <Field id="goal" label="Main health / wellness goal" required value={form.goal} onChange={set('goal')} error={fieldError('goal')} />
        <Field id="preferredAt" label="Preferred date & time (India time)" type="datetime-local" value={form.preferredAt} onChange={set('preferredAt')} error={fieldError('preferredAt')} />
        <div className="field">
          <label htmlFor="message">Additional message (optional)</label>
          <textarea id="message" rows="4" maxLength="1000" value={form.message} onChange={set('message')} />
        </div>
        {error && <p className="form-error" role="alert">{error.message}</p>}
        <button className="btn btn-primary" disabled={status === 'loading'}>{status === 'loading' ? 'Sending…' : 'Request Discovery Call'}</button>
      </form>
    </section>
  );
}
