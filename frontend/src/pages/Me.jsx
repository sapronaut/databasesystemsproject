import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { errorText } from '../roles';
import { inr, initial, tint, when } from '../format';

const statusPill = { PENDING: ['orange', 'Pending'], DECLINED: ['red', 'Declined'], APPROVED: ['green', 'Approved'] };
const disputePill = { OPEN: ['orange', 'Report open'], RESOLVED: ['green', 'Report upheld'], REJECTED: ['grey', 'Report rejected'] };

function Me() {
  const [profile, setProfile] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([api.get('/me'), api.get('/me/disputes')]);
      setProfile(p.data);
      setDisputes(d.data);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Couldn’t load your account. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary, tick]);

  useEffect(() => {
    api.get('/me/transactions', { params: { page, limit: 6 } })
      .then((res) => { setRows(res.data.data); setPages(res.data.pages); })
      .catch(() => {});
  }, [page, tick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const openReport = (t) => {
    setTarget(t);
    setReason('');
    setReasonError('');
  };

  const submit = async () => {
    const text = reason.trim();
    if (text.length < 5) {
      setReasonError('Describe the problem in at least 5 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/me/disputes', { transactionId: target.id, reason: text });
      setToast('Report sent. Our team will review it.');
      setTarget(null);
      setTick((n) => n + 1);
    } catch (err) {
      setReasonError(errorText(err, 'Couldn’t send your report. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="subtitle">Loading your account…</p>;
  if (error && !profile) return <div className="note-error">{error}</div>;

  const c = profile.customer;
  const s = profile.stats;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="large-title">Hello, {c.fullName.split(' ')[0]}</h1>
          <p className="subtitle">Account {c.accountNumber} · {c.city}, {c.state}</p>
        </div>
      </div>

      <section className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 28 }}>
        <div className="tile"><span className="tile-label">Transactions</span><span className="tile-value">{s.transactions}</span></div>
        <div className="tile"><span className="tile-label">Held by fraud checks</span><span className={`tile-value ${s.flagged ? 'red' : ''}`}>{s.flagged}</span></div>
        <div className="tile"><span className="tile-label">Open reports</span><span className="tile-value">{s.openDisputes}</span></div>
        <div className="tile"><span className="tile-label">Flagged share</span><span className="tile-value">{Number(s.riskPercent).toFixed(1)}%</span></div>
      </section>

      <h2 className="section-title">Your transactions</h2>
      <div className="group">
        {rows.length === 0 && <div className="empty"><strong>No transactions yet</strong>Your purchases will appear here.</div>}
        {rows.map((t, i) => {
          const [color, label] = statusPill[t.status];
          const latest = t.disputes[0];
          return (
            <div className="row" key={t.id}>
              <span className="avatar" style={{ background: tint(i) }}>{initial(t.merchant.merchantName)}</span>
              <div className="row-main">
                <div className="row-title">{t.merchant.merchantName}</div>
                <div className="row-sub">{when(t.transactionTime)} · {t.location}</div>
              </div>
              <div className="row-trail">
                <div className="row-amount">{inr(t.amount)}</div>
                <span className={`pill ${color}`}>{label}</span>
              </div>
              <div className="row-actions">
                {latest ? (
                  <span className={`pill ${disputePill[latest.status][0]}`}>{disputePill[latest.status][1]}</span>
                ) : (
                  <button className="btn tint small" onClick={() => openReport(t)}>Report a problem</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pager">
        <span>Page {page} of {Math.max(pages, 1)}</span>
        <div className="pager-actions">
          <button className="btn ghost small" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn ghost small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>

      <h2 className="section-title">Your reports</h2>
      <div className="group">
        {disputes.length === 0 && <div className="empty"><strong>No reports</strong>If you don’t recognise a charge, use Report a problem.</div>}
        {disputes.map((d, i) => (
          <div className="row" key={d.id}>
            <span className="avatar" style={{ background: tint(i + 2) }}>{initial(d.transaction.merchant.merchantName)}</span>
            <div className="row-main">
              <div className="row-title">{d.transaction.merchant.merchantName} · {inr(d.transaction.amount)}</div>
              <div className="row-sub">{d.resolution ? `Decision: ${d.resolution}` : d.reason}</div>
            </div>
            <div className="row-trail">
              <span className={`pill ${disputePill[d.status][0]}`}>{disputePill[d.status][1]}</span>
              <div className="row-sub">{when(d.createdAt)}</div>
            </div>
          </div>
        ))}
      </div>

      {target && (
        <div className="scrim" onClick={() => setTarget(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Report a problem</h3>
            <p>{target.merchant.merchantName} · {inr(target.amount)}. Tell us what looks wrong.</p>
            <textarea
              className={`field ${reasonError ? 'invalid' : ''}`}
              placeholder="For example: I didn’t make this purchase"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
            />
            {reasonError && <div className="field-error" style={{ marginBottom: 12 }}>{reasonError}</div>}
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setTarget(null)}>Cancel</button>
              <button className="btn" onClick={submit} disabled={saving}>{saving ? 'Sending…' : 'Send report'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

export default Me;
