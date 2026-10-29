const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function loadCustomer(req, res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, include: { customer: true } });
  if (!user || !user.customer) {
    return res.status(409).json({ error: 'This login isn’t linked to a customer record yet. Ask an administrator to link it.' });
  }
  req.customer = user.customer;
  next();
}

router.use(loadCustomer);

router.get('/', async (req, res) => {
  const id = req.customer.id;
  const [transactions, flagged, openDisputes, risk] = await Promise.all([
    prisma.transaction.count({ where: { customerId: id } }),
    prisma.fraudPrediction.count({ where: { predictionResult: 'FRAUD', transaction: { customerId: id } } }),
    prisma.dispute.count({ where: { customerId: id, status: 'OPEN' } }),
    prisma.$queryRaw`SELECT calculate_customer_risk(${id}::text)::float8 AS risk`
  ]);
  res.json({ customer: req.customer, stats: { transactions, flagged, openDisputes, riskPercent: risk[0].risk } });
});

router.get('/transactions', async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 8, 1), 50);
  const where = { customerId: req.customer.id };
  const [total, data] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: {
        merchant: { select: { merchantName: true, category: true } },
        disputes: { select: { id: true, status: true }, orderBy: { createdAt: 'desc' } }
      },
      orderBy: { transactionTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })
  ]);
  res.json({ data, total, page, pages: Math.ceil(total / limit) });
});

router.get('/disputes', async (req, res) => {
  const disputes = await prisma.dispute.findMany({
    where: { customerId: req.customer.id },
    include: { transaction: { include: { merchant: { select: { merchantName: true } } } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(disputes.map(({ resolvedById, ...rest }) => rest));
});

router.post('/disputes', async (req, res) => {
  const { transactionId, reason } = req.body;
  const text = typeof reason === 'string' ? reason.trim() : '';
  if (!transactionId) return res.status(400).json({ error: 'Choose a transaction to report' });
  if (text.length < 5 || text.length > 500) {
    return res.status(400).json({ error: 'Describe the problem in 5 to 500 characters' });
  }
  const transaction = await prisma.transaction.findFirst({ where: { id: transactionId, customerId: req.customer.id } });
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  const open = await prisma.dispute.findFirst({ where: { transactionId, status: 'OPEN' } });
  if (open) return res.status(409).json({ error: 'You already have an open report for this transaction' });
  const dispute = await prisma.dispute.create({
    data: { transactionId, customerId: req.customer.id, reason: text }
  });
  res.status(201).json(dispute);
});

module.exports = router;
