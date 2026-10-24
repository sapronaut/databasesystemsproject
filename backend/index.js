require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticate } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', authenticate, require('./routes/customers'));
app.use('/api/transactions', authenticate, require('./routes/transactions'));
app.use('/api/merchants', authenticate, require('./routes/merchants'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));