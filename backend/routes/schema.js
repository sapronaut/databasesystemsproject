const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SCHEMA = 'custom';
const NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYSTEM_COLUMNS = ['id', 'created_at'];
const MAX_TABLES = 20;
const MAX_COLUMNS = 30;

const TYPES = {
  text: { sql: 'TEXT', cast: 'text' },
  integer: { sql: 'INTEGER', cast: 'integer' },
  decimal: { sql: 'NUMERIC(12,2)', cast: 'numeric' },
  boolean: { sql: 'BOOLEAN', cast: 'boolean' },
  date: { sql: 'DATE', cast: 'date' },
  timestamp: { sql: 'TIMESTAMP(3)', cast: 'timestamp' }
};

const FROM_CATALOG = {
  text: 'text',
  integer: 'integer',
  numeric: 'decimal',
  boolean: 'boolean',
  date: 'date',
  'timestamp without time zone': 'timestamp'
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const bad = (message) => new HttpError(400, message);

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    const message = String(err.message || '');
    if (/invalid input syntax|out of range|value too long|numeric field overflow|null value in column|invalid input value/i.test(message)) {
      return res.status(400).json({ error: 'One of the values doesn’t fit its column type' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
};

function assertName(value, label) {
  if (typeof value !== 'string' || !NAME_RE.test(value)) {
    throw bad(`${label} must start with a letter and use only lowercase letters, numbers and underscores (up to 40 characters)`);
  }
}

function assertColumn(def) {
  assertName(def.name, 'Column name');
  if (SYSTEM_COLUMNS.includes(def.name)) throw bad(`"${def.name}" is added automatically`);
  if (!TYPES[def.type]) throw bad('Choose a valid column type');
}

const columnSql = (def) => `"${def.name}" ${TYPES[def.type].sql}${def.nullable === false ? ' NOT NULL' : ''}`;

async function customTableNames() {
  const rows = await prisma.$queryRaw`SELECT table_name::text AS name FROM information_schema.tables WHERE table_schema = ${SCHEMA} AND table_type = 'BASE TABLE'`;
  return rows.map((r) => r.name);
}

async function requireCustomTable(name) {
  if (typeof name !== 'string' || !NAME_RE.test(name)) throw new HttpError(404, 'Table not found');
  const names = await customTableNames();
  if (!names.includes(name)) throw new HttpError(404, 'Table not found');
  const cols = await prisma.$queryRaw`SELECT column_name::text AS name, data_type::text AS type, is_nullable::text AS nullable FROM information_schema.columns WHERE table_schema = ${SCHEMA} AND table_name = ${name} ORDER BY ordinal_position`;
  return cols.map((c) => ({ name: c.name, type: FROM_CATALOG[c.type] || c.type, nullable: c.nullable === 'YES' }));
}

const audit = (req, action, target) =>
  prisma.auditLog.create({ data: { userId: req.user.userId, action, tableAffected: target } });

router.get('/', handle(async (req, res) => {
  const rows = await prisma.$queryRaw`
    SELECT c.table_schema::text AS schema_name, c.table_name::text AS table_name, c.column_name::text AS col_name,
           c.data_type::text AS col_type, c.is_nullable::text AS nullable, c.ordinal_position::int AS position
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE t.table_type = 'BASE TABLE' AND c.table_schema IN ('public', 'custom') AND c.table_name <> '_prisma_migrations'
    ORDER BY c.table_schema, c.table_name, c.ordinal_position`;

  const map = new Map();
  for (const r of rows) {
    const key = `${r.schema_name}.${r.table_name}`;
    if (!map.has(key)) {
      map.set(key, { schema: r.schema_name, name: r.table_name, editable: r.schema_name === SCHEMA, columns: [] });
    }
    map.get(key).columns.push({
      name: r.col_name,
      type: FROM_CATALOG[r.col_type] || r.col_type,
      nullable: r.nullable === 'YES',
      system: r.schema_name === SCHEMA && SYSTEM_COLUMNS.includes(r.col_name)
    });
  }

  const tables = [...map.values()].sort((a, b) => {
    if (a.editable !== b.editable) return a.editable ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const t of tables) {
    if (t.editable && NAME_RE.test(t.name)) {
      const counted = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM ${SCHEMA}."${t.name}"`);
      t.rowCount = counted[0].n;
    }
  }

  res.json({ tables, types: Object.keys(TYPES), limits: { tables: MAX_TABLES, columns: MAX_COLUMNS } });
}));

router.post('/tables', handle(async (req, res) => {
  const { name, columns } = req.body;
  assertName(name, 'Table name');
  if (!Array.isArray(columns) || columns.length === 0) throw bad('Add at least one column');
  if (columns.length > MAX_COLUMNS) throw bad(`A table can have at most ${MAX_COLUMNS} columns`);

  const seen = new Set();
  const defs = columns.map((c) => {
    assertColumn(c);
    if (seen.has(c.name)) throw bad(`Column "${c.name}" appears twice`);
    seen.add(c.name);
    return columnSql(c);
  });

  const existing = await customTableNames();
  if (existing.includes(name)) throw new HttpError(409, 'A table with this name already exists');
  if (existing.length >= MAX_TABLES) throw bad(`You can create at most ${MAX_TABLES} custom tables`);

  const ddl = `CREATE TABLE ${SCHEMA}."${name}" (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMP(3) NOT NULL DEFAULT now(), ${defs.join(', ')})`;
  await prisma.$transaction([prisma.$executeRawUnsafe(ddl), audit(req, 'CREATE_TABLE', `${SCHEMA}.${name}`)]);
  res.status(201).json({ name });
}));

router.post('/tables/:name/columns', handle(async (req, res) => {
  const cols = await requireCustomTable(req.params.name);
  const def = { name: req.body.name, type: req.body.type, nullable: req.body.nullable };
  assertColumn(def);
  if (cols.some((c) => c.name === def.name)) throw new HttpError(409, 'This table already has that column');
  if (cols.length >= MAX_COLUMNS + SYSTEM_COLUMNS.length) throw bad(`A table can have at most ${MAX_COLUMNS} columns`);

  if (def.nullable === false) {
    const counted = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM ${SCHEMA}."${req.params.name}"`);
    if (counted[0].n > 0) throw bad('This table already has rows, so the new column must allow empty values');
  }

  const ddl = `ALTER TABLE ${SCHEMA}."${req.params.name}" ADD COLUMN ${columnSql(def)}`;
  await prisma.$transaction([prisma.$executeRawUnsafe(ddl), audit(req, 'ADD_COLUMN', `${SCHEMA}.${req.params.name}.${def.name}`)]);
  res.status(201).json({ name: def.name });
}));

router.delete('/tables/:name/columns/:column', handle(async (req, res) => {
  const cols = await requireCustomTable(req.params.name);
  const column = req.params.column;
  if (SYSTEM_COLUMNS.includes(column)) throw bad('System columns can’t be removed');
  if (!cols.some((c) => c.name === column) || !NAME_RE.test(column)) throw new HttpError(404, 'Column not found');

  const ddl = `ALTER TABLE ${SCHEMA}."${req.params.name}" DROP COLUMN "${column}"`;
  await prisma.$transaction([prisma.$executeRawUnsafe(ddl), audit(req, 'DROP_COLUMN', `${SCHEMA}.${req.params.name}.${column}`)]);
  res.json({ success: true });
}));

router.delete('/tables/:name', handle(async (req, res) => {
  await requireCustomTable(req.params.name);
  if (req.query.confirm !== req.params.name) throw bad('Type the table name to confirm');
  const ddl = `DROP TABLE ${SCHEMA}."${req.params.name}"`;
  await prisma.$transaction([prisma.$executeRawUnsafe(ddl), audit(req, 'DROP_TABLE', `${SCHEMA}.${req.params.name}`)]);
  res.json({ success: true });
}));

router.get('/tables/:name/rows', handle(async (req, res) => {
  await requireCustomTable(req.params.name);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
  const counted = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM ${SCHEMA}."${req.params.name}"`);
  const data = await prisma.$queryRawUnsafe(
    `SELECT * FROM ${SCHEMA}."${req.params.name}" ORDER BY created_at DESC LIMIT $1::int OFFSET $2::int`,
    limit,
    (page - 1) * limit
  );
  res.json({ data, total: counted[0].n, page, pages: Math.ceil(counted[0].n / limit) });
}));

router.post('/tables/:name/rows', handle(async (req, res) => {
  const cols = await requireCustomTable(req.params.name);
  const editable = cols.filter((c) => !SYSTEM_COLUMNS.includes(c.name));
  const values = req.body.values && typeof req.body.values === 'object' ? req.body.values : {};

  for (const key of Object.keys(values)) {
    if (!editable.some((c) => c.name === key)) throw bad(`Unknown column "${key}"`);
  }

  const names = [];
  const placeholders = [];
  const params = [];
  for (const c of editable) {
    const v = values[c.name];
    if (v === undefined || v === null || v === '') {
      if (!c.nullable) throw bad(`"${c.name}" is required`);
      continue;
    }
    params.push(String(v));
    names.push(`"${c.name}"`);
    placeholders.push(`$${params.length}::${TYPES[c.type].cast}`);
  }

  const sql = names.length
    ? `INSERT INTO ${SCHEMA}."${req.params.name}" (${names.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id::text AS id`
    : `INSERT INTO ${SCHEMA}."${req.params.name}" DEFAULT VALUES RETURNING id::text AS id`;
  const inserted = await prisma.$queryRawUnsafe(sql, ...params);
  res.status(201).json({ id: inserted[0].id });
}));

router.delete('/tables/:name/rows/:id', handle(async (req, res) => {
  await requireCustomTable(req.params.name);
  if (!UUID_RE.test(req.params.id)) throw new HttpError(404, 'Row not found');
  const removed = await prisma.$executeRawUnsafe(`DELETE FROM ${SCHEMA}."${req.params.name}" WHERE id = $1::uuid`, req.params.id);
  if (!removed) throw new HttpError(404, 'Row not found');
  res.json({ success: true });
}));

module.exports = router;
