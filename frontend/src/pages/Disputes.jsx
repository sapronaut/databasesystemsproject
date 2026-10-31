import { useEffect, useState } from 'react';
import api from '../api';
import { errorText } from '../roles';
import { inr, initial, tint, when } from '../format';

const filters = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED', label: 'Upheld' },
  { value: 'REJECTED', label: 'Rejected' }
];

const pill = { OPEN: ['orange', 'Open'], RESOLVED: ['green', 'Upheld'], REJECTED: ['grey', 'Rejected'] };

function Disputes() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/disputes', { params: { status: status || undefined } })
      .then((res) => { setRows(res.data); setError(''); })
      .catch(() => setError('Couldn’t load reports. Check that the API is running, then try again.'))
      .finally(() => setLoading(false));
  }, [status, tick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const openSheet = (dispute, decision) => {
    setTarget({ dispute, decision });
    setNote('');
    setNoteError('');
  };

  const submit = async () => {
    if (note.trim().length < 3) {
      setNoteError('Add a short note for the customer.');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/disputes/${target.dispute.id}/resolve`, { status: target.decision, resolution: note.trim() });
      setToast(target.decision === 'RESOLVED' ? 'Report upheld and transaction reversed' : 'Report rejected');
      setTarget(null);
      setTick((n) => n + 1);
    } catch (err) {
      setNoteError(errorText(err, 'Couldn’t save your decision.'));
    } finally {
      setSaving(false);
    }
  };

  const open = rows.filter((r) => r.status === 'OPEN').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="large-title">Disputes</h1>
          <p className="subtitle">Problems reported by customers · {open} open in this view</p>
        </div>
        <div className="seg">
          {filters.map((f) => (
            <button key={f.value} className={status === f.value ? 'active' : ''} onClick={() => setStatus(f.value)}>{f.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="note-error">{error}</div>}

      <div className="group">
        {!loading && rows.length === 0 && <div className="empty"><strong>No reports here</strong>Customers can report a transaction from their account page.</div>}
        {rows.map((d, i) => {
          const [color, label] = pill[d.status];
          return (
            <div className="row" key={d.id}>
              <span className="avatar" style={{ background: tint(i) }}>{initial(d.customer.fullName)}</span>
              <div className="row-main">
                <div className="row-title">{d.customer.fullName} · {inr(d.transaction.amount)} at {d.transaction.merchant.merchantName}</div>
                <div className="row-sub">“{d.reason}”{d.resolution ? ` — ${d.resolution}` : ''}</div>
              </div>
              <div className="row-trail">
                <span className={`pill ${color}`}>{label}</span>
                <div className="row-sub">{when(d.createdAt)}</div>
              </div>
              {d.status === 'OPEN' && (
                <div className="row-actions">
                  <button className="btn danger small" onClick={() => openSheet(d, 'RESOLVED')}>Uphold</button>
                  <button className="btn ghost small" onClick={() => openSheet(d, 'REJECTED')}>Reject</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {target && (
        <div className="scrim" onClick={() => setTarget(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{target.decision === 'RESOLVED' ? 'Uphold this report?' : 'Reject this report?'}</h3>
            <p>
              {target.decision === 'RESOLVED'
                ? 'The transaction will be reversed (set to Declined) and the decision logged.'
                : 'The transaction stays as it is and the decision is logged.'}
            </p>
            <textarea
              className={`field ${noteError ? 'invalid' : ''}`}
              placeholder="Note shown to the customer"
              value={note}
              onChange={(e) => { setNote(e.target.value); setNoteError(''); }}
            />
            {noteError && <div className="field-error" style={{ marginBottom: 12 }}>{noteError}</div>}
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setTarget(null)}>Cancel</button>
              <button className={`btn ${target.decision === 'RESOLVED' ? 'danger' : ''}`} onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : target.decision === 'RESOLVED' ? 'Uphold report' : 'Reject report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

export default Disputes;
