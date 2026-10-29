import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { errorText } from '../roles';
import { when } from '../format';

const typeLabels = {
  text: 'Text',
  integer: 'Whole number',
  decimal: 'Decimal',
  boolean: 'Yes / No',
  date: 'Date',
  timestamp: 'Date & time'
};
const typeOptions = Object.keys(typeLabels);
const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
const nameHint = 'Start with a letter; use lowercase letters, numbers and underscores';
const blankColumn = () => ({ name: '', type: 'text', nullable: true });

function CellInput({ column, value, onChange }) {
  const common = { className: 'field compact', value: value === undefined ? '' : value, onChange: (e) => onChange(e.target.value) };
  if (column.type === 'boolean') {
    return (
      <select {...common}>
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  const inputType = { integer: 'number', decimal: 'number', date: 'date', timestamp: 'datetime-local', text: 'text' }[column.type] || 'text';
  const extra = column.type === 'decimal' ? { step: '0.01' } : column.type === 'integer' ? { step: '1' } : {};
  return <input type={inputType} placeholder={column.name} {...extra} {...common} />;
}

function show(value, type) {
  if (value === null || value === undefined) return '—';
  if (type === 'boolean') return value ? 'Yes' : 'No';
  if (type === 'timestamp') return when(value);
  if (type === 'date') return String(value).slice(0, 10);
  return String(value);
}

function Schema() {
  const [catalog, setCatalog] = useState(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [tick, setTick] = useState(0);

  const [rows, setRows] = useState([]);
  const [rowPage, setRowPage] = useState(1);
  const [rowPages, setRowPages] = useState(1);
  const [rowTotal, setRowTotal] = useState(0);
  const [rowTick, setRowTick] = useState(0);
  const [newRow, setNewRow] = useState({});
  const [rowError, setRowError] = useState('');

  const [colForm, setColForm] = useState(blankColumn());
  const [colError, setColError] = useState('');

  const [creating, setCreating] = useState(false);
  const [tableName, setTableName] = useState('');
  const [tableCols, setTableCols] = useState([blankColumn()]);
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);

  const [dropping, setDropping] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [dropError, setDropError] = useState('');

  const load = useCallback(() => {
    api.get('/schema')
      .then((res) => { setCatalog(res.data); setError(''); })
      .catch((err) => setError(errorText(err, 'Couldn’t load the schema. Check that the API is running, then try again.')));
  }, []);

  useEffect(load, [load, tick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const tables = catalog ? catalog.tables : [];
  const selected = tables.find((t) => `${t.schema}.${t.name}` === selectedKey) || null;

  useEffect(() => {
    if (catalog && !selected && tables.length) setSelectedKey(`${tables[0].schema}.${tables[0].name}`);
  }, [catalog, selected, tables]);

  useEffect(() => {
    setRowPage(1);
    setNewRow({});
    setRowError('');
    setColError('');
  }, [selectedKey]);

  useEffect(() => {
    if (!selected || !selected.editable) {
      setRows([]);
      return;
    }
    api.get(`/schema/tables/${selected.name}/rows`, { params: { page: rowPage, limit: 6 } })
      .then((res) => { setRows(res.data.data); setRowPages(res.data.pages); setRowTotal(res.data.total); })
      .catch(() => setRows([]));
  }, [selected && selected.name, selected && selected.editable, rowPage, rowTick, tick]);

  const refreshAll = () => { setTick((n) => n + 1); setRowTick((n) => n + 1); };

  const openCreate = () => {
    setTableName('');
    setTableCols([blankColumn()]);
    setCreateError('');
    setCreating(true);
  };

  const updateCol = (index, patch) => setTableCols(tableCols.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const createTable = async (e) => {
    e.preventDefault();
    if (!NAME_RE.test(tableName)) return setCreateError(`Table name: ${nameHint}.`);
    if (tableCols.some((c) => !NAME_RE.test(c.name))) return setCreateError(`Column names: ${nameHint}.`);
    if (new Set(tableCols.map((c) => c.name)).size !== tableCols.length) return setCreateError('Column names must be different from each other.');
    setSaving(true);
    setCreateError('');
    try {
      await api.post('/schema/tables', { name: tableName, columns: tableCols });
      setCreating(false);
      setSelectedKey(`custom.${tableName}`);
      setToast(`Table ${tableName} created`);
      refreshAll();
    } catch (err) {
      setCreateError(errorText(err, 'Couldn’t create the table.'));
    } finally {
      setSaving(false);
    }
  };

  const addColumn = async (e) => {
    e.preventDefault();
    if (!NAME_RE.test(colForm.name)) return setColError(`${nameHint}.`);
    setColError('');
    try {
      await api.post(`/schema/tables/${selected.name}/columns`, colForm);
      setColForm(blankColumn());
      setToast(`Column ${colForm.name} added`);
      refreshAll();
    } catch (err) {
      setColError(errorText(err, 'Couldn’t add the column.'));
    }
  };

  const dropColumn = async (name) => {
    try {
      await api.delete(`/schema/tables/${selected.name}/columns/${name}`);
      setToast(`Column ${name} removed`);
      refreshAll();
    } catch (err) {
      setToast(errorText(err, 'Couldn’t remove the column.'));
    }
  };

  const insertRow = async (e) => {
    e.preventDefault();
    setRowError('');
    try {
      await api.post(`/schema/tables/${selected.name}/rows`, { values: newRow });
      setNewRow({});
      setToast('Row added');
      refreshAll();
    } catch (err) {
      setRowError(errorText(err, 'Couldn’t add the row.'));
    }
  };

  const deleteRow = async (id) => {
    try {
      await api.delete(`/schema/tables/${selected.name}/rows/${id}`);
      setToast('Row deleted');
      refreshAll();
    } catch (err) {
      setToast(errorText(err, 'Couldn’t delete the row.'));
    }
  };

  const dropTable = async () => {
    setDropError('');
    try {
      await api.delete(`/schema/tables/${selected.name}`, { params: { confirm: confirmText } });
      setDropping(false);
      setConfirmText('');
      setSelectedKey('');
      setToast(`Table ${selected.name} dropped`);
      refreshAll();
    } catch (err) {
      setDropError(errorText(err, 'Couldn’t drop the table.'));
    }
  };

  const custom = tables.filter((t) => t.editable);
  const core = tables.filter((t) => !t.editable);
  const editableColumns = selected ? selected.columns.filter((c) => !c.system) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="large-title">Schema</h1>
          <p className="subtitle">Create tables and fields live. Every change is logged in the audit log.</p>
        </div>
        <button className="btn" onClick={openCreate}>New table</button>
      </div>

      {error && <div className="note-error">{error}</div>}
      {!catalog && !error && <p className="subtitle">Loading schema…</p>}

      {catalog && (
        <div className="schema-layout">
          <div className="stack">
            <div>
              <div className="tag-note">Your tables</div>
              <div className="group">
                {custom.length === 0 && <div className="empty"><strong>No custom tables</strong>Create one to get started.</div>}
                {custom.map((t) => (
                  <button key={t.name} className={`row clickable ${selectedKey === `custom.${t.name}` ? 'selected' : ''}`} onClick={() => setSelectedKey(`custom.${t.name}`)}>
                    <div className="row-main">
                      <div className="row-title">{t.name}</div>
                      <div className="row-sub">{t.columns.length - 2} fields · {t.rowCount} rows</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="tag-note">Core tables · read-only</div>
              <div className="group">
                {core.map((t) => (
                  <button key={t.name} className={`row clickable ${selectedKey === `public.${t.name}` ? 'selected' : ''}`} onClick={() => setSelectedKey(`public.${t.name}`)}>
                    <div className="row-main">
                      <div className="row-title">{t.name}</div>
                      <div className="row-sub">{t.columns.length} columns</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selected && (
            <div className="stack">
              <div>
                <div className="tag-note">
                  {selected.editable ? 'Columns' : 'Columns · core tables change through migrations so the trigger, procedure and API keep working'}
                </div>
                <div className="group">
                  {selected.columns.map((c) => (
                    <div className="row" key={c.name}>
                      <div className="row-main">
                        <div className="row-title">{c.name}</div>
                        <div className="row-sub">{typeLabels[c.type] || c.type} · {c.nullable ? 'optional' : 'required'}{c.system ? ' · system' : ''}</div>
                      </div>
                      {selected.editable && !c.system && (
                        <button className="btn danger small" onClick={() => dropColumn(c.name)}>Drop</button>
                      )}
                    </div>
                  ))}
                  {selected.editable && (
                    <form className="inline-form" onSubmit={addColumn}>
                      <input className="field compact" placeholder="new_field" value={colForm.name} onChange={(e) => setColForm({ ...colForm, name: e.target.value })} />
                      <select className="field compact" value={colForm.type} onChange={(e) => setColForm({ ...colForm, type: e.target.value })}>
                        {typeOptions.map((t) => <option key={t} value={t}>{typeLabels[t]}</option>)}
                      </select>
                      <label className="check">
                        <input type="checkbox" checked={colForm.nullable === false} onChange={(e) => setColForm({ ...colForm, nullable: !e.target.checked })} />
                        Required
                      </label>
                      <button className="btn small" type="submit">Add field</button>
                    </form>
                  )}
                </div>
                {colError && <div className="field-error" style={{ marginTop: 8 }}>{colError}</div>}
              </div>

              {selected.editable && (
                <div>
                  <div className="tag-note">Data · {rowTotal} rows</div>
                  <div className="group">
                    {editableColumns.length > 0 && (
                      <form className="inline-form" onSubmit={insertRow}>
                        {editableColumns.map((c) => (
                          <CellInput key={c.name} column={c} value={newRow[c.name]} onChange={(v) => setNewRow({ ...newRow, [c.name]: v })} />
                        ))}
                        <button className="btn small" type="submit">Add row</button>
                      </form>
                    )}
                    {rows.length > 0 && (
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              {editableColumns.map((c) => <th key={c.name}>{c.name}</th>)}
                              <th>Added</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.id}>
                                {editableColumns.map((c) => <td key={c.name}>{show(r[c.name], c.type)}</td>)}
                                <td>{when(r.created_at)}</td>
                                <td><button className="btn danger small" onClick={() => deleteRow(r.id)}>Delete</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {rows.length === 0 && <div className="empty"><strong>No rows yet</strong>Add the first one above.</div>}
                  </div>
                  {rowError && <div className="field-error" style={{ marginTop: 8 }}>{rowError}</div>}
                  <div className="pager">
                    <span>Page {rowPage} of {Math.max(rowPages, 1)}</span>
                    <div className="pager-actions">
                      <button className="btn ghost small" disabled={rowPage <= 1} onClick={() => setRowPage(rowPage - 1)}>Previous</button>
                      <button className="btn ghost small" disabled={rowPage >= rowPages} onClick={() => setRowPage(rowPage + 1)}>Next</button>
                    </div>
                  </div>
                </div>
              )}

              {selected.editable && (
                <div className="danger-zone">
                  <button className="btn danger" onClick={() => { setDropping(true); setConfirmText(''); setDropError(''); }}>Drop this table</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {creating && (
        <div className="scrim" onClick={() => setCreating(false)}>
          <form className="sheet wide" onClick={(e) => e.stopPropagation()} onSubmit={createTable} noValidate>
            <h3>New table</h3>
            <p>An id and a created-at column are added automatically.</p>
            <div className="field-wrap">
              <label className="field-label" htmlFor="t-name">Table name</label>
              <input id="t-name" className="field" placeholder="loan_notes" value={tableName} onChange={(e) => setTableName(e.target.value)} />
            </div>
            <div className="field-label">Fields</div>
            {tableCols.map((c, i) => (
              <div className="col-builder" key={i}>
                <input className="field compact" placeholder="field_name" value={c.name} onChange={(e) => updateCol(i, { name: e.target.value })} />
                <select className="field compact" value={c.type} onChange={(e) => updateCol(i, { type: e.target.value })}>
                  {typeOptions.map((t) => <option key={t} value={t}>{typeLabels[t]}</option>)}
                </select>
                <label className="check">
                  <input type="checkbox" checked={c.nullable === false} onChange={(e) => updateCol(i, { nullable: !e.target.checked })} />
                  Required
                </label>
                <button type="button" className="btn ghost small" disabled={tableCols.length === 1} onClick={() => setTableCols(tableCols.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn tint small" style={{ marginBottom: 16 }} onClick={() => setTableCols([...tableCols, blankColumn()])}>Add another field</button>
            {createError && <div className="note-error">{createError}</div>}
            <div className="sheet-actions">
              <button type="button" className="btn ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Creating…' : 'Create table'}</button>
            </div>
          </form>
        </div>
      )}

      {dropping && selected && (
        <div className="scrim" onClick={() => setDropping(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Drop {selected.name}?</h3>
            <p>This deletes the table and all {rowTotal} rows. It can’t be undone. Type the table name to confirm.</p>
            <input className="field" placeholder={selected.name} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            {dropError && <div className="note-error">{dropError}</div>}
            <div className="sheet-actions">
              <button className="btn ghost" onClick={() => setDropping(false)}>Cancel</button>
              <button className="btn danger" disabled={confirmText !== selected.name} onClick={dropTable}>Drop table</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

export default Schema;
