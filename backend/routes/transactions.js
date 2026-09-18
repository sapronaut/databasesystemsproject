const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    include: { customer: true, merchant: true, fraudPrediction: true }
  });
  res.json(transactions);
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