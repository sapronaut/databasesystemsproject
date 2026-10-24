const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/high-risk', async (req, res) => {
  const rows = await prisma.$queryRaw`SELECT * FROM high_risk_transactions ORDER BY "transactionTime" DESC`;
  res.json(rows);
});

router.get('/merchant-summary', async (req, res) => {
  const rows = await prisma.$queryRaw`SELECT * FROM merchant_fraud_summary ORDER BY "fraudCount" DESC`;
  res.json(rows);
});

router.get('/customer-risk/:id', async (req, res) => {
  const rows = await prisma.$queryRaw`SELECT calculate_customer_risk(${req.params.id}::text)::float8 AS risk`;
  res.json({ customerId: req.params.id, riskPercent: rows[0].risk });
});

module.exports = router;