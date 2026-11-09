import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Badge, FormRow, Loading, PageHeader } from '../components/ui.jsx';
import PasswordField from '../components/PasswordField.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { selectUser } from '../features/auth/authSlice.js';
import { clearStaffAction, createStaffUser, fetchStaffUsers, selectStaff, updateStaffUser } from '../features/staff/staffSlice.js';
import { ROLE_LABEL } from '../utils/format.js';

const blank = { name: '', email: '', phone: '', role: 'DIETITIAN', password: '' };

export default function AdminStaff() {
  useDocumentMeta('Staff | Anaa Admin');
  const dispatch = useDispatch();
  const me = useSelector(selectUser);
  const { users, action } = useSelector(selectStaff);
  const [form, setForm] = useState(blank);
  const [pwFor, setPwFor] = useState(null);
  const [newPw, setNewPw] = useState('');
  const isOwner = me.role === 'OWNER';
  // Admins may only manage dietitians and operations staff; the server enforces this too.
  const roles = isOwner ? ['OWNER', 'ADMIN', 'DIETITIAN', 'OPERATIONS'] : ['DIETITIAN', 'OPERATIONS'];
  const manageable = (u) => isOwner || ['DIETITIAN', 'OPERATIONS'].includes(u.role);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { dispatch(fetchStaffUsers()); return () => { dispatch(clearStaffAction()); }; }, [dispatch]);

  async function create(e) {
    e.preventDefault();
    const res = await dispatch(createStaffUser({ ...form, phone: form.phone || undefined }));
    if (createStaffUser.fulfilled.match(res)) setForm(blank);
  }
  async function changePw(e) {
    e.preventDefault();
    const res = await dispatch(updateStaffUser({ id: pwFor._id, changes: { password: newPw } }));
    if (updateStaffUser.fulfilled.match(res)) { setPwFor(null); setNewPw(''); }
  }
  const err = action.error?.details || {};

  return (
    <>
      <PageHeader title="Staff" subtitle="Accounts for your dietitians, admins and operations team." />
      <Alert kind="ok">{action.status === 'done' ? action.message : null}</Alert>
      <Alert>{action.status === 'failed' && !action.error?.details ? action.error?.message : null}</Alert>
      <div className="grid-2">
        <section className="panel">
          <h2>Team</h2>
          {users.status === 'loading' && !users.items.length ? <Loading /> : (
            <div className="table-wrap">
              <table className="rtable">
                <thead><tr><th>Name</th><th>Role</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {users.items.map((u) => (
                    <tr key={u._id}>
                      <td data-label="Name"><strong>{u.name}</strong><br /><small className="muted">{u.email}</small></td>
                      <td data-label="Role">
                        {manageable(u) && u._id !== me._id ? (
                          <select aria-label={`Role of ${u.name}`} value={u.role} onChange={(e) => dispatch(updateStaffUser({ id: u._id, changes: { role: e.target.value } }))}>
                            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                        ) : ROLE_LABEL[u.role]}
                      </td>
                      <td data-label="Status">{u.isActive ? <Badge tone="ok">Active</Badge> : <Badge tone="off">Disabled</Badge>}</td>
                      <td data-label="" className="actions">
                        {manageable(u) && u._id !== me._id && (
                          <>
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => dispatch(updateStaffUser({ id: u._id, changes: { isActive: !u.isActive } }))}>{u.isActive ? 'Disable' : 'Enable'}</button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setPwFor(u); setNewPw(''); }}>Set password</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div>
          <form className="panel" onSubmit={create} noValidate>
            <h2>Add a team member</h2>
            <FormRow label="Full name" id="st-name" error={err.name?.[0]}><input id="st-name" value={form.name} onChange={set('name')} required /></FormRow>
            <FormRow label="Email" id="st-email" error={err.email?.[0]}><input id="st-email" type="email" value={form.email} onChange={set('email')} required /></FormRow>
            <FormRow label="Phone (optional)" id="st-phone" error={err.phone?.[0]}><input id="st-phone" type="tel" value={form.phone} onChange={set('phone')} /></FormRow>
            <FormRow label="Role" id="st-role"><select id="st-role" value={form.role} onChange={set('role')}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></FormRow>
            <PasswordField id="st-pw" label="Temporary password" showMeter autoComplete="new-password" value={form.password} onChange={set('password')} error={err.password?.[0]} hint="Share it securely and ask them to change it in their profile." />
            <div className="form-actions"><button className="btn btn-primary" disabled={action.status === 'loading'}>Create account</button></div>
          </form>
          {pwFor && (
            <form className="panel" onSubmit={changePw} noValidate style={{ marginTop: 20 }}>
              <h2>New password for {pwFor.name}</h2>
              <PasswordField id="st-newpw" label="New password" showMeter autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} error={err.password?.[0]} />
              <div className="form-actions"><button className="btn btn-primary" disabled={!newPw}>Save password</button><button type="button" className="btn btn-outline" onClick={() => setPwFor(null)}>Cancel</button></div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
