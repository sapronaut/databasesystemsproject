import { useEffect, useState } from 'react';
import api from '../api';
import { initial, tint, when } from '../format';

function Audit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/audit')
      .then((res) => setLogs(res.data))
      .catch(() => setError('Couldn’t load the audit log. Check that the API is running, then try again.'))
      .finally(() => setLoading(false));
  }, []);

  const label = (action) => action.replace('RESOLVE_ALERT_', 'Alert ').replace('REVIEWED', 'confirmed').replace('DISMISSED', 'dismissed');

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="large-title">Audit log</h1>
          <p className="subtitle">Every review decision, newest first</p>
        </div>
      </div>

      {error && <div className="note-error">{error}</div>}

      <div className="group">
        {!loading && logs.length === 0 && (
          <div className="empty"><strong>No activity yet</strong>Reviewing an alert adds an entry here.</div>
        )}
        {logs.map((l, i) => (
          <div className="row" key={l.id}>
            <span className="avatar" style={{ background: tint(i) }}>{initial(l.user.email)}</span>
            <div className="row-main">
              <div className="row-title">{label(l.action)}</div>
              <div className="row-sub">{l.user.email} · {l.tableAffected}</div>
            </div>
            <div className="row-trail row-sub">{when(l.timestamp)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export default Audit;
