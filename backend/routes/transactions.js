const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
  const { status, search } = req.query;

  const where = {};
  if (status && ['APPROVED', 'DECLINED', 'PENDING'].includes(status)) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { customer: { fullName: { contains: search, mode: 'insensitive' } } },
      { merchant: { merchantName: { contains: search, mode: 'insensitive' } } }
    ];
  }

  const [total, data] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      include: { customer: true, merchant: true, fraudPrediction: true },
      orderBy: { transactionTime: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  res.json({ data, total, page, pages: Math.ceil(total / limit) });
});

router.get('/:id', async (req, res) => {
  const txn = await prisma.transaction.findUnique({
    where: { id: req.params.id },
    include: { customer: true, merchant: true, fraudPrediction: true }
  });
  if (!txn) return res.status(404).json({ error: 'Not found' });
  res.json(txn);
});

router.post('/', async (req, res) => {
  const txn = await prisma.transaction.create({ data: req.body });
  res.json(txn);
});

module.exports = router;