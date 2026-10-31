import { useEffect, useState } from 'react';
import api from '../api';
import { Search } from '../components/Icons';
import { inr, initial, tint, when } from '../format';

const filters = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'APPROVED', label: 'Approved' }
];

const statusPill = { PENDING: 'orange', DECLINED: 'red', APPROVED: 'green' };

function Transactions() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    api.get('/transactions', { params: { page, limit: 8, status: status || undefined, search: search || undefined } })
      .then((res) => {
        setRows(res.data.data);
        setPages(res.data.pages);
        setTotal(res.data.total);
        setError('');
      })
      .catch(() => setError('Couldn’t load transactions. Check that the API is running, then try again.'))
      .finally(() => setLoading(false));
  }, [page, status, search]);

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="large-title">Transactions</h1>
          <p className="subtitle">{total} {total === 1 ? 'transaction' : 'transactions'}</p>
        </div>
      </div>

      <div className="toolbar">
        <label className="search">
          <Search />
          <input placeholder="Search customer or merchant" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="seg" role="tablist">
          {filters.map((f) => (
            <button key={f.value} className={status === f.value ? 'active' : ''} onClick={() => changeStatus(f.value)}>{f.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="note-error">{error}</div>}

      <div className="group">
        {!loading && rows.length === 0 && (
          <div className="empty"><strong>No transactions found</strong>Try a different search or filter.</div>
        )}
        {rows.map((t, i) => (
          <div className="row" key={t.id}>
            <span className="avatar" style={{ background: tint(i) }}>{initial(t.customer.fullName)}</span>
            <div className="row-main">
              <div className="row-title">{t.customer.fullName}</div>
              <div className="row-sub">{t.merchant.merchantName} · {when(t.transactionTime)}</div>
            </div>
            <div className="row-trail">
              <div className="row-amount">{inr(t.amount)}</div>
              <span className={`pill ${statusPill[t.status]}`}>{t.status.charAt(0) + t.status.slice(1).toLowerCase()}</span>
              {t.fraudPrediction && t.fraudPrediction.predictionResult === 'FRAUD' && (
                <span className="pill red" style={{ marginLeft: 6 }}>Fraud {(Number(t.fraudPrediction.confidenceScore) * 100).toFixed(0)}%</span>
              )}
            </div>
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
    </>
  );
}

export default Transactions;
