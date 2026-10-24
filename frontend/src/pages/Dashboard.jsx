import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { inr, initial, tint, when } from '../format';

function Ring({ value, ready }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - (ready ? Math.min(value, 1) : 0));
  return (
    <svg viewBox="0 0 180 180" className="ring" role="img" aria-label={`${(value * 100).toFixed(0)} percent of transactions flagged`}>
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff9500" />
          <stop offset="100%" stopColor="#ff3b30" />
        </linearGradient>
      </defs>
      <circle cx="90" cy="90" r={r} className="ring-track" />
      <circle cx="90" cy="90" r={r} className="ring-bar" stroke="url(#ringGrad)" strokeDasharray={c} strokeDashoffset={offset} />
      <text x="90" y="92" textAnchor="middle" className="ring-value">{(value * 100).toFixed(0)}%</text>
      <text x="90" y="116" textAnchor="middle" className="ring-label">flagged</text>
    </svg>
  );
}

function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [alerts, setAlerts] = useState([]);
  const [merchants, setMerchants] = useState([]);
  const [highRisk, setHighRisk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, m, h] = await Promise.all([
        api.get('/alerts'),
        api.get('/analytics/merchant-summary'),
        api.get('/analytics/high-risk')
      ]);
      setAlerts(a.data);
      setMerchants(m.data);
      setHighRisk(h.data);
      setError('');
    } catch (err) {
      setError('Couldn’t load the overview. Check that the API is running, then refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setReady(true), 80);
      return () => clearTimeout(t);
    }
  }, [loading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const simulate = async () => {
    setBusy(true);
    try {
      const [cs, ms, models] = await Promise.all([api.get('/customers'), api.get('/merchants'), api.get('/predictions/models')]);
      if (!cs.data.length || !ms.data.length || !models.data.length) {
        setToast('Add a customer, merchant and model first.');
        return;
      }
      const pick = (list) => list[Math.floor(Math.random() * list.length)];
      const merchant = pick(ms.data);
      const amount = Math.round(500 + Math.random() * 49500);
      const fraud = amount > 20000;
      const tx = await api.post('/transactions', {
        customerId: pick(cs.data).id,
        merchantId: merchant.id,
        amount,
        paymentMethod: 'Credit Card',
        deviceType: 'Web',
        ipAddress: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        location: merchant.city
      });
      await api.post('/predictions', {
        transactionId: tx.data.id,
        modelId: models.data[0].id,
        predictionResult: fraud ? 'FRAUD' : 'NOT_FRAUD',
        confidenceScore: Number((fraud ? 0.8 + Math.random() * 0.19 : 0.05 + Math.random() * 0.3).toFixed(4))
      });
      setToast(fraud ? `${inr(amount)} flagged — alert created` : `${inr(amount)} looks clean`);
      await load();
    } catch (err) {
      setToast('Couldn’t simulate a transaction.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="subtitle">Loading overview…</p>;

  const totalTx = merchants.reduce((s, m) => s + m.totalTransactions, 0);
  const fraudTx = merchants.reduce((s, m) => s + m.fraudCount, 0);
  const rate = totalTx ? fraudTx / totalTx : 0;
  const open = alerts.filter((a) => a.alertStatus === 'OPEN');
  const flaggedAmount = highRisk.reduce((s, r) => s + Number(r.amount), 0);
  const topFraud = Math.max(1, ...merchants.map((m) => m.fraudCount));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="large-title">Overview</h1>
          <p className="subtitle">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {user.role === 'ADMIN' && (
          <button className="btn" onClick={simulate} disabled={busy}>{busy ? 'Simulating…' : 'Simulate transaction'}</button>
        )}
      </div>

      {error && <div className="note-error">{error}</div>}

      <section className="hero">
        <div className="hero-card">
          <Ring value={rate} ready={ready} />
          <div className="hero-copy">
            <h2>{fraudTx} of {totalTx} transactions flagged</h2>
            <p>The model scores every transaction. High-confidence fraud opens an alert automatically.</p>
          </div>
        </div>
        <div className="tiles">
          <div className="tile">
            <span className="tile-label">Open alerts</span>
            <span className={`tile-value ${open.length ? 'red' : ''}`}>{open.length}</span>
          </div>
          <div className="tile">
            <span className="tile-label">High risk</span>
            <span className="tile-value">{highRisk.length}</span>
          </div>
          <div className="tile wide">
            <span className="tile-label">Value of high-risk transactions</span>
            <span className="tile-value">{inr(flaggedAmount)}</span>
          </div>
        </div>
      </section>

      <h2 className="section-title">Needs review <Link to="/alerts">See all</Link></h2>
      <div className="group">
        {open.length === 0 && (
          <div className="empty"><strong>Nothing to review</strong>New fraud predictions will show up here.</div>
        )}
        {open.slice(0, 5).map((a, i) => {
          const tx = a.prediction.transaction;
          return (
            <Link to="/alerts" className="row" key={a.id}>
              <span className="avatar" style={{ background: tint(i) }}>{initial(tx.customer.fullName)}</span>
              <div className="row-main">
                <div className="row-title">{tx.customer.fullName}</div>
                <div className="row-sub">{tx.merchant.merchantName} · {when(a.generatedTime)}</div>
              </div>
              <div className="row-trail">
                <div className="row-amount">{inr(tx.amount)}</div>
                <span className="pill red">{(Number(a.prediction.confidenceScore) * 100).toFixed(0)}% fraud</span>
              </div>
            </Link>
          );
        })}
      </div>

      <h2 className="section-title">Merchants</h2>
      <div className="group">
        {merchants.length === 0 && (
          <div className="empty"><strong>No merchants yet</strong>Add a merchant to start tracking.</div>
        )}
        {merchants.map((m, i) => (
          <div className="row" key={m.merchantId}>
            <span className="avatar" style={{ background: tint(i + 2) }}>{initial(m.merchantName)}</span>
            <div className="row-main">
              <div className="row-title">{m.merchantName}</div>
              <div className="row-sub">{m.totalTransactions} transactions · {inr(m.totalAmount)}</div>
            </div>
            <div className="row-trail">
              <div className="row-amount">{m.fraudCount} flagged</div>
              <div className="bar"><span style={{ width: `${(m.fraudCount / topFraud) * 100}%` }} /></div>
            </div>
          </div>
        ))}
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

export default Dashboard;
