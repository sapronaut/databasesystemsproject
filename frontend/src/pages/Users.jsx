import { useEffect, useState } from 'react';
import api from '../api';
import { errorText, roleColor, roleLabel } from '../roles';
import { initial, tint, when } from '../format';

const roles = ['ADMIN', 'ANALYST', 'AUDITOR', 'CUSTOMER'];
const roleHelp = {
  ADMIN: 'Full access, including users and the schema manager',
  ANALYST: 'Reviews alerts and disputes, manages customers',
  AUDITOR: 'Read-only: transactions, alerts and the audit log',
  CUSTOMER: 'Sees only their own account and can report problems'
};

const blank = { email: '', password: '', role: 'ANALYST', customerId: '' };

function Users() {
  const me = JSON.parse(localStorage.getItem('user') || 'null');
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/customers')])
      .then(([u, c]) => { setRows(u.data); setCustomers(c.data); setError(''); })
      .catch(() => setError('Couldn’t load users. Check that the API is running, then try again.'))
      .finally(() => setLoading(false));
  }, [tick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const openNew = () => {
    setForm(blank);
    setErrors({});
    setFormError('');
    setEditing('new');
  };

  const openEdit = (u) => {
    setForm({ email: u.email, password: '', role: u.role, customerId: u.customerId || '' });
    setErrors({});
    setFormError('');
    setEditing(u);
  };

  const change = (key, value) => {
    setForm({ ...form, [key]: value });
    setErrors({ ...errors, [key]: undefined });
  };

  const validate = () => {
    const e = {};
    if (editing === 'new') {
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email';
      if (form.password.length < 8) e.password = 'Use at least 8 characters';
    } else if (form.password && form.password.length < 8) {
      e.password = 'Use at least 8 characters';
    }
    if (form.role === 'CUSTOMER' && !form.customerId) e.customerId = 'Choose the customer this login belongs to';
    return e;
  };

  const save = async (e) => {
    e.preventDefault();
    const found = validate();
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        await api.post('/users', { email: form.email.trim(), password: form.password, role: form.role, customerId: form.customerId || undefined });
      } else {
        const body = { role: form.role, customerId: form.role === 'CUSTOMER' ? form.customerId : null };
        if (form.password) body.password = form.password;
        await api.put(`/users/${editing.id}`, body);
      }
      setToast(editing === 'new' ? 'User created' : 'User updated');
      setEditing(null);
      setTick((n) => n + 1);
    } catch (err) {
      setFormError(errorText(err, 'Couldn’t save this user.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/users/${removing.id}`);
      setToast('User deleted');
      setRemoving(null);
      setTick((n) => n + 1);
    } catch (err) {
      setRemoving(null);
      setToast(errorText(err, 'Couldn’t delete this user.'));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="large-title">Users</h1>
          <p className="subtitle">{rows.length} accounts · one table, access decided by role</p>
        </div>
        <button className="btn" onClick={openNew}>Add user</button>
      </div>

      {error && <div className="note-error">{error}</div>}

      <div className="group">
        {!loading && rows.length === 0 && <div className="empty"><strong>No users</strong></div>}
        {rows.map((u, i) => (
          <div className="row" key={u.id}>
            <span className="avatar" style={{ background: tint(i) }}>{initial(u.email)}</span>
            <div className="row-main">
              <div className="row-title">{u.email}{u.id === me.id ? ' (you)' : ''}</div>
              <div className="row-sub">{u.customer ? `Linked to ${u.customer.fullName} · ` : ''}Joined {when(u.createdAt)}</div>
            </div>
            <div className="row-trail"><span className={`pill ${roleColor[u.role]}`}>{roleLabel[u.role]}</span></div>
            <div className="row-actions">
              <button className="btn tint small" onClick={() => openEdit(u)}>Edit</button>
              {u.id !== me.id && <button className="btn danger small" onClick={() => setRemoving(u)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="scrim" onClick={() => setEditing(null)}>
          <form className="sheet wide" onClick={(e) => e.stopPropagation()} onSubmit={save} noValidate>
            <h3>{editing === 'new' ? 'New user' : 'Edit user'}</h3>
            <p>{roleHelp[form.role]}</p>

            <div className="field-wrap">
              <label className="field-label" htmlFor="u-email">Email</label>
              <input id="u-email" className={`field ${errors.email ? 'invalid' : ''}`} type="email" value={form.email} disabled={editing !== 'new'} onChange={(e) => change('email', e.target.value)} />
              {errors.email && <div className="field-error">{errors.email}</div>}
            </div>

            <div className="field-wrap">
              <label className="field-label" htmlFor="u-pass">{editing === 'new' ? 'Password' : 'New password (leave blank to keep)'}</label>
              <input id="u-pass" className={`field ${errors.password ? 'invalid' : ''}`} type="password" value={form.password} onChange={(e) => change('password', e.target.value)} />
              {errors.password && <div className="field-error">{errors.password}</div>}
            </div>

            <div className="field-wrap">
              <label className="field-label" htmlFor="u-role">Role</label>
              <select id="u-role" className="field" value={form.role} disabled={editing !== 'new' && editing.id === me.id} onChange={(e) => change('role', e.target.value)}>
                {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
              </select>
            </div>

            {form.role === 'CUSTOMER' && (
              <div className="field-wrap">
                <label className="field-label" htmlFor="u-cust">Linked customer</label>
                <select id="u-cust" className={`field ${errors.customerId ? 'invalid' : ''}`} value={form.customerId} onChange={(e) => change('customerId', e.target.value)}>
                  <option value="">Choose a customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.fullName} · {c.accountNumber}</option>)}
                </select>
                {errors.customerId && <div className="field-error">{errors.customerId}</div>}
              </div>
            )}

            {formError && <div className="note-error">{formError}</div>}
            <div className="sheet-actions">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Create user' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}

      {removing && (
        <div className="scrim" onClick={() => setRemoving(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {removing.email}?</h3>
            <p>Users with audit history can’t be deleted. Change their role instead.</p>
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setRemoving(null)}>Cancel</button>
              <button className="btn danger" onClick={remove}>Delete user</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

export default Users;
