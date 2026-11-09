import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Badge, FormRow, PageHeader } from '../components/ui.jsx';
import PasswordField from '../components/PasswordField.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { selectUser } from '../features/auth/authSlice.js';
import { changePassword, clearAccount, saveProfile, selectAccount } from '../features/account/accountSlice.js';
import { fmtDate, ROLE_LABEL } from '../utils/format.js';

// Account page for staff (owner, admin, dietitian/coach, operations): see your details, edit name and phone, change password.
export default function MyProfile() {
  useDocumentMeta('My profile | Anaa Admin');
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { profile, password } = useSelector(selectAccount);
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  useEffect(() => () => { dispatch(clearAccount()); }, [dispatch]);
  const pe = profile.error?.details || {};

  async function savePassword(e) {
    e.preventDefault();
    const res = await dispatch(changePassword(pw));
    if (changePassword.fulfilled.match(res)) setPw({ currentPassword: '', newPassword: '' });
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Your account details. Your email is your login." />
      <section className="panel">
        <h2>Account</h2>
        <dl className="profile-dl">
          <div><dt>Name</dt><dd>{user.name}</dd></div>
          <div><dt>Email</dt><dd>{user.email}</dd></div>
          <div><dt>Phone</dt><dd>{user.phone || 'Not added'}</dd></div>
          <div><dt>Role</dt><dd><Badge tone="info">{ROLE_LABEL[user.role] || user.role}</Badge></dd></div>
          <div><dt>Email status</dt><dd>{user.emailVerifiedAt ? <Badge tone="ok">Verified</Badge> : <Badge tone="warn">Not verified</Badge>}</dd></div>
          {user.createdAt && <div><dt>Member since</dt><dd>{fmtDate(user.createdAt)}</dd></div>}
        </dl>
      </section>
      <div className="grid-2">
        <form className="panel" onSubmit={(e) => { e.preventDefault(); dispatch(saveProfile(form)); }} noValidate>
          <h2>Edit details</h2>
          <Alert kind="ok">{profile.status === 'done' ? 'Your profile was saved.' : null}</Alert>
          <Alert>{profile.status === 'failed' && !profile.error?.details ? profile.error?.message : null}</Alert>
          <FormRow label="Full name" id="mp-name" error={pe.name?.[0]}><input id="mp-name" value={form.name} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormRow>
          <FormRow label="Email" id="mp-email" hint="Your email is your login and cannot be changed here."><input id="mp-email" value={user.email} readOnly disabled /></FormRow>
          <FormRow label="Phone" id="mp-phone" error={pe.phone?.[0]}><input id="mp-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormRow>
          <div className="form-actions"><button className="btn btn-primary" disabled={profile.status === 'loading'}>{profile.status === 'loading' ? 'Saving…' : 'Save changes'}</button></div>
        </form>

        <form className="panel" onSubmit={savePassword} noValidate>
          <h2>Change password</h2>
          <Alert kind="ok">{password.status === 'done' ? 'Your password was changed.' : null}</Alert>
          <Alert>{password.status === 'failed' && !password.error?.details ? password.error?.message : null}</Alert>
          <PasswordField id="mp-current" label="Current password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} error={password.error?.details?.currentPassword?.[0]} />
          <PasswordField id="mp-new" label="New password" autoComplete="new-password" showMeter value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} error={password.error?.details?.newPassword?.[0]} />
          <div className="form-actions"><button className="btn btn-primary" disabled={password.status === 'loading'}>{password.status === 'loading' ? 'Saving…' : 'Update password'}</button></div>
        </form>
      </div>
    </>
  );
}
