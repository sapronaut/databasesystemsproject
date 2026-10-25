import { useEffect, useState } from 'react';
import api from '../api';
import { inr, initial, tint, when } from '../format';

const filters = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'REVIEWED', label: 'Confirmed' },
  { value: 'DISMISSED', label: 'Dismissed' }
];

const statusPill = { OPEN: ['red', 'Open'], REVIEWED: ['green', 'Confirmed'], DISMISSED: ['grey', 'Dismissed'] };

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const load = () => {
    api.get('/alerts')
      .then((res) => { setAlerts(res.data); setError(''); })
      .catch(() => setError('Couldn’t load alerts. Check that the API is running, then try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const openSheet = (alert, status) => {
    setTarget({ alert, status });
    setRemarks('');
  };

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/alerts/${target.alert.id}/resolve`, { status: target.status, remarks });
      setToast(target.status === 'REVIEWED' ? 'Alert confirmed' : 'Alert dismissed');
      setTarget(null);
      load();
    } catch (err) {
      setToast('Couldn’t update the alert.');
    } finally {
      setSaving(false);
    }
  };

  const visible = filter === 'ALL' ? alerts : alerts.filter((a) => a.alertStatus === filter);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="large-title">Alerts</h1>
          <p className="subtitle">{alerts.filter((a) => a.alertStatus === 'OPEN').length} open</p>
        </div>
        <div className="seg">
          {filters.map((f) => (
            <button key={f.value} className={filter === f.value ? 'active' : ''} onClick={() => setFilter(f.value)}>{f.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="note-error">{error}</div>}

      <div className="group">
        {!loading && visible.length === 0 && (
          <div className="empty"><strong>No alerts here</strong>Alerts appear when the model flags a transaction as fraud.</div>
        )}
        {visible.map((a, i) => {
          const tx = a.prediction.transaction;
          const [color, label] = statusPill[a.alertStatus];
          return (
            <div className="row" key={a.id}>
              <span className="avatar" style={{ background: tint(i) }}>{initial(tx.customer.fullName)}</span>
              <div className="row-main">
                <div className="row-title">{tx.customer.fullName} · {inr(tx.amount)}</div>
                <div className="row-sub">{tx.merchant.merchantName} · {when(a.generatedTime)}{a.remarks ? ` · ${a.remarks}` : ''}</div>
              </div>
              <div className="row-trail">
                <span className={`pill ${color}`}>{label}</span>
                <div className="row-sub">{(Number(a.prediction.confidenceScore) * 100).toFixed(0)}% confidence</div>
              </div>
              {a.alertStatus === 'OPEN' && (
                <div className="row-actions">
                  <button className="btn danger small" onClick={() => openSheet(a, 'REVIEWED')}>Confirm fraud</button>
                  <button className="btn ghost small" onClick={() => openSheet(a, 'DISMISSED')}>Dismiss</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {target && (
        <div className="scrim" onClick={() => setTarget(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{target.status === 'REVIEWED' ? 'Confirm this fraud?' : 'Dismiss this alert?'}</h3>
            <p>{target.alert.prediction.transaction.customer.fullName} · {inr(target.alert.prediction.transaction.amount)}. Your decision is saved to the audit log.</p>
            <textarea className="field" placeholder="Add a note (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setTarget(null)}>Cancel</button>
              <button className={`btn ${target.status === 'REVIEWED' ? 'danger' : ''}`} onClick={submit} disabled={saving}>
                {saving ? 'Saving…' : target.status === 'REVIEWED' ? 'Confirm fraud' : 'Dismiss alert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

export default Alerts;
