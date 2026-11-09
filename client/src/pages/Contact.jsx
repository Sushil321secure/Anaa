import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Field from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { contact } from '../content/site.js';
import { resetSubmit, submitEnquiry } from '../features/enquiries/enquirySlice.js';

export default function Contact() {
  useDocumentMeta('Contact Us | Anaa Nutricare', 'Call, email or send us a message. Anaa Nutricare, Bengaluru, India.');
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.enquiries.submit);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fieldError = (k) => error?.details?.[k]?.[0];

  useEffect(() => () => { dispatch(resetSubmit()); }, [dispatch]);

  // Contact messages are stored as enquiries so the team sees them in one place.
  const onSubmit = (e) => {
    e.preventDefault();
    dispatch(submitEnquiry({ ...form, goal: 'General enquiry (Contact page)' }));
  };

  return (
    <section className="container page">
      <h1>Contact Us</h1>
      <div className="contact-grid">
        <ul className="contact-list">
          <li><span className="icon-bubble"><Icon name="phone" /></span><span><strong>Phone</strong><a href={contact.phoneHref}>{contact.phone}</a></span></li>
          <li><span className="icon-bubble"><Icon name="mail" /></span><span><strong>Email</strong><a href={`mailto:${contact.email}`}>{contact.email}</a></span></li>
          <li><span className="icon-bubble"><Icon name="pin" /></span><span><strong>Address</strong>{contact.address.map((line) => <span key={line} className="addr-line">{line}</span>)}</span></li>
        </ul>
        {status === 'done' ? (
          <div className="card" role="status">
            <h2>Message sent</h2>
            <p>Thank you. Our team will get back to you soon.</p>
          </div>
        ) : (
          <form className="card" onSubmit={onSubmit} noValidate>
            <Field id="name" label="Full name" autoComplete="name" required value={form.name} onChange={set('name')} error={fieldError('name')} />
            <Field id="email" label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={fieldError('email')} />
            <Field id="phone" label="Phone" type="tel" autoComplete="tel" required value={form.phone} onChange={set('phone')} error={fieldError('phone')} />
            <div className="field">
              <label htmlFor="message">Message</label>
              <textarea id="message" rows="5" maxLength="1000" required value={form.message} onChange={set('message')} />
            </div>
            {error && <p className="form-error" role="alert">{error.message}</p>}
            <button className="btn btn-primary" disabled={status === 'loading'}>{status === 'loading' ? 'Sending…' : 'Send message'}</button>
          </form>
        )}
      </div>
    </section>
  );
}
