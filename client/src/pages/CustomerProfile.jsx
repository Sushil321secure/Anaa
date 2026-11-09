import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Badge, FormRow, PageHeader } from '../components/ui.jsx';
import PasswordField from '../components/PasswordField.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { selectUser } from '../features/auth/authSlice.js';
import { changePassword, clearAccount, saveProfile, selectAccount } from '../features/account/accountSlice.js';

const fromUser = (u) => ({
  name: u.name || '', phone: u.phone || '', dob: u.dob ? u.dob.slice(0, 10) : '', gender: u.gender || '', city: u.city || '',
  heightCm: u.heightCm ?? '', healthGoal: u.healthGoal || '',
});

export default function CustomerProfile() {
  useDocumentMeta('My Profile | Anaa Nutricare');
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { profile, password } = useSelector(selectAccount);
  const [form, setForm] = useState(() => fromUser(user));
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  useEffect(() => () => { dispatch(clearAccount()); }, [dispatch]);

  const pe = profile.error?.details || {};
  const we = password.error?.details || {};

  function saveForm(e) {
    e.preventDefault();
    dispatch(saveProfile({ ...form, heightCm: form.heightCm === '' ? '' : Number(form.heightCm) }));
  }
  async function savePassword(e) {
    e.preventDefault();
    const res = await dispatch(changePassword(pw));
    if (changePassword.fulfilled.match(res)) setPw({ currentPassword: '', newPassword: '' });
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Keep your details up to date so your nutritionist can help you better." />
      <section className="panel">
        <h2>Account</h2>
        <dl className="profile-dl">
          <div><dt>Name</dt><dd>{user.name}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Phone</dt><dd>{user.phone || 'Not added'}</dd></div>
          <div><dt>Email status</dt><dd>{user.emailVerifiedAt ? <Badge tone="ok">Verified</Badge> : <Badge tone="warn">Not verified</Badge>}</dd></div>
        </dl>
      </section>
      <div className="grid-2">
        <form className="panel" onSubmit={saveForm} noValidate>
          <h2>Personal details</h2>
          <Alert kind="ok">{profile.status === 'done' ? 'Your profile was saved.' : null}</Alert>
          <Alert>{profile.status === 'failed' && !profile.error?.details ? profile.error?.message : null}</Alert>
          <div className="form-grid">
            <div className="span-2"><FormRow label="Full name" id="pf-name" error={pe.name?.[0]}><input id="pf-name" value={form.name} onChange={set('name')} required autoComplete="name" /></FormRow></div>
            <FormRow label="Email" id="pf-email" hint="Your email is your login and cannot be changed here."><input id="pf-email" value={user.email} readOnly disabled /></FormRow>
            <FormRow label="Phone" id="pf-phone" error={pe.phone?.[0]}><input id="pf-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></FormRow>
            <FormRow label="Date of birth" id="pf-dob" error={pe.dob?.[0]}><input id="pf-dob" type="date" value={form.dob} onChange={set('dob')} autoComplete="bday" /></FormRow>
            <FormRow label="Gender" id="pf-gender"><select id="pf-gender" value={form.gender} onChange={set('gender')}><option value="">Prefer not to say</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></FormRow>
            <FormRow label="City" id="pf-city"><input id="pf-city" value={form.city} onChange={set('city')} autoComplete="address-level2" /></FormRow>
            <FormRow label="Height (cm)" id="pf-height" error={pe.heightCm?.[0]} hint="Used to work out your BMI."><input id="pf-height" type="number" min="50" max="250" value={form.heightCm} onChange={set('heightCm')} /></FormRow>
            <div className="span-2"><FormRow label="Your health goal" id="pf-goal"><input id="pf-goal" maxLength={300} value={form.healthGoal} onChange={set('healthGoal')} placeholder="For example: manage weight, PCOS, sports nutrition" /></FormRow></div>
          </div>
          <div className="form-actions"><button className="btn btn-primary" disabled={profile.status === 'loading'}>{profile.status === 'loading' ? 'Saving…' : 'Save changes'}</button></div>
        </form>

        <form className="panel" onSubmit={savePassword} noValidate>
          <h2>Change password</h2>
          <Alert kind="ok">{password.status === 'done' ? 'Your password was changed.' : null}</Alert>
          <Alert>{password.status === 'failed' && !password.error?.details ? password.error?.message : null}</Alert>
          <PasswordField id="pw-current" label="Current password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} error={we.currentPassword?.[0]} />
          <PasswordField id="pw-new" label="New password" autoComplete="new-password" showMeter value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} error={we.newPassword?.[0]} hint="At least 8 characters with a letter and a number." />
          <div className="form-actions"><button className="btn btn-primary" disabled={password.status === 'loading'}>{password.status === 'loading' ? 'Saving…' : 'Update password'}</button></div>
        </form>
      </div>
    </>
  );
}
