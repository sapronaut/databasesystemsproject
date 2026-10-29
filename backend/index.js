require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticate, authorize } = require('./middleware/auth');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true }));
app.use(express.json());

const staff = authorize('ADMIN', 'ANALYST', 'AUDITOR');
const desk = authorize('ADMIN', 'ANALYST');
const admin = authorize('ADMIN');

app.use('/api/auth', require('./routes/auth'));
app.use('/api/me', authenticate, authorize('CUSTOMER'), require('./routes/me'));
app.use('/api/customers', authenticate, desk, require('./routes/customers'));
app.use('/api/transactions', authenticate, staff, require('./routes/transactions'));
app.use('/api/merchants', authenticate, staff, require('./routes/merchants'));
app.use('/api/predictions', authenticate, staff, require('./routes/predictions'));
app.use('/api/alerts', authenticate, staff, require('./routes/alerts'));
app.use('/api/analytics', authenticate, staff, require('./routes/analytics'));
app.use('/api/disputes', authenticate, desk, require('./routes/disputes'));
app.use('/api/audit', authenticate, authorize('ADMIN', 'AUDITOR'), require('./routes/audit'));
app.use('/api/users', authenticate, admin, require('./routes/users'));
app.use('/api/schema', authenticate, admin, require('./routes/schema'));

app.use((err, req, res, next) => {
  if (err.code === 'P2002') {
    const t = err.meta && err.meta.target;
    const name = Array.isArray(t) ? t.join(', ') : t || 'value';
    return res.status(409).json({ error: `A record with this ${name} already exists` });
  }
  if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
  if (err.code === 'P2003') return res.status(409).json({ error: 'This record is referenced by other data and can’t be deleted' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
