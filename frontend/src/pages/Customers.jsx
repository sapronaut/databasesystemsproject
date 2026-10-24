import { useEffect, useState } from 'react';
import api from '../api';
import { Search } from '../components/Icons';
import { initial, tint } from '../format';

const emptyForm = { fullName: '', email: '', phone: '', dateOfBirth: '', address: '', city: '', state: '', accountNumber: '' };

const labels = {
  fullName: 'Full name',
  email: 'Email',
  phone: 'Phone',
  dateOfBirth: 'Date of birth',
  address: 'Address',
  city: 'City',
  state: 'State',
  accountNumber: 'Account number'
};

const inputTypes = { email: 'email', phone: 'tel', dateOfBirth: 'date' };

function validate(f) {
  const e = {};
  Object.keys(emptyForm).forEach((k) => {
    if (!String(f[k]).trim()) e[k] = 'Required';
  });
  if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
  if (f.phone && !/^\d{10}$/.test(f.phone.trim())) e.phone = 'Enter a 10-digit phone number';
  if (f.dateOfBirth && new Date(f.dateOfBirth) > new Date()) e.dateOfBirth = 'Enter a date in the past';
  return e;
}

function Customers() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isAdmin = user.role === 'ADMIN';

  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [removing, setRemoving] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    api.get('/customers', { params: { page, limit: 8, search: search || undefined } })
      .then((res) => {
        setRows(res.data.data);
        setPages(res.data.pages);
        setTotal(res.data.total);
        setError('');
      })
      .catch(() => setError('Couldn’t load customers. Check that the API is running, then try again.'))
      .finally(() => setLoading(false));
  }, [page, search, tick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const openNew = () => {
    setForm(emptyForm);
    setFieldErrors({});
    setFormError('');
    setEditing('new');
  };

  const openEdit = (c) => {
    const next = {};
    Object.keys(emptyForm).forEach((k) => { next[k] = k === 'dateOfBirth' ? c[k].slice(0, 10) : c[k]; });
    setForm(next);
    setFieldErrors({});
    setFormError('');
    setEditing(c);
  };

  const change = (key, value) => {
    setForm({ ...form, [key]: value });
    if (fieldErrors[key]) setFieldErrors({ ...fieldErrors, [key]: undefined });
  };

  const save = async (e) => {
    e.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        await api.post('/customers', form);
      } else {
        await api.put(`/customers/${editing.id}`, form);
      }
      setToast(editing === 'new' ? 'Customer added' : 'Changes saved');
      setEditing(null);
      setTick((t) => t + 1);
    } catch (err) {
      const data = err.response && err.response.data;
      if (data && data.fields) setFieldErrors(data.fields);
      setFormError((data && data.error) || 'Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/customers/${removing.id}`);
      setToast('Customer deleted');
      setRemoving(null);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else setTick((t) => t + 1);
    } catch (err) {
      setRemoving(null);
      setToast((err.response && err.response.data && err.response.data.error) || 'Couldn’t delete this customer.');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="large-title">Customers</h1>
          <p className="subtitle">{total} {total === 1 ? 'customer' : 'customers'}</p>
        </div>
        {isAdmin && <button className="btn" onClick={openNew}>Add customer</button>}
      </div>

      <div className="toolbar">
        <label className="search">
          <Search />
          <input placeholder="Search name, email or city" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && <div className="note-error">{error}</div>}

      <div className="group">
        {!loading && rows.length === 0 && (
          <div className="empty">
            <strong>No customers found</strong>
            {search ? 'Try a different search.' : isAdmin ? 'Add your first customer to get started.' : 'Customers will appear here.'}
          </div>
        )}
        {rows.map((c, i) => (
          <div className="row" key={c.id}>
            <span className="avatar" style={{ background: tint(i) }}>{initial(c.fullName)}</span>
            <div className="row-main">
              <div className="row-title">{c.fullName}</div>
              <div className="row-sub">{c.email} · {c.city}, {c.state}</div>
            </div>
            <div className="row-trail">
              <div className="row-amount">{c.accountNumber}</div>
              <div className="row-sub">{c.phone}</div>
            </div>
            {isAdmin && (
              <div className="row-actions">
                <button className="btn tint small" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn danger small" onClick={() => setRemoving(c)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pager">
        <span>Page {page} of {Math.max(pages, 1)}</span>
        <div className="pager-actions">
          <button className="btn ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn ghost small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>

      {editing && (
        <div className="scrim" onClick={() => setEditing(null)}>
          <form className="sheet wide" onClick={(e) => e.stopPropagation()} onSubmit={save} noValidate>
            <h3>{editing === 'new' ? 'New customer' : 'Edit customer'}</h3>
            <p>{editing === 'new' ? 'Add the details exactly as they appear on the account.' : 'Update the details, then save.'}</p>
            <div className="form-grid">
              {Object.keys(emptyForm).map((k) => (
                <div key={k} className={`field-wrap ${k === 'address' ? 'full' : ''}`}>
                  <label className="field-label" htmlFor={k}>{labels[k]}</label>
                  <input
                    id={k}
                    className={`field ${fieldErrors[k] ? 'invalid' : ''}`}
                    type={inputTypes[k] || 'text'}
                    value={form[k]}
                    onChange={(e) => change(k, e.target.value)}
                  />
                  {fieldErrors[k] && <div className="field-error">{fieldErrors[k]}</div>}
                </div>
              ))}
            </div>
            {formError && <div className="note-error">{formError}</div>}
            <div className="sheet-actions">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Add customer' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}

      {removing && (
        <div className="scrim" onClick={() => setRemoving(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {removing.fullName}?</h3>
            <p>This can’t be undone. Customers with transactions can’t be deleted.</p>
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setRemoving(null)}>Cancel</button>
              <button className="btn danger" onClick={remove}>Delete customer</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

export default Customers;
