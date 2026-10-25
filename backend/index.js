require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticate } = require('./middleware/auth');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true }));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', authenticate, require('./routes/customers'));
app.use('/api/transactions', authenticate, require('./routes/transactions'));
app.use('/api/merchants', authenticate, require('./routes/merchants'));
app.use('/api/predictions', authenticate, require('./routes/predictions'));
app.use('/api/alerts', authenticate, require('./routes/alerts'));
app.use('/api/analytics', authenticate, require('./routes/analytics'));
app.use('/api/audit', authenticate, require('./routes/audit'));

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