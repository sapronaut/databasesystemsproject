const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const merchants = await prisma.merchant.findMany();
  res.json(merchants);
});

router.get('/:id', async (req, res) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: req.params.id } });
  if (!merchant) return res.status(404).json({ error: 'Not found' });
  res.json(merchant);
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  const merchant = await prisma.merchant.create({ data: req.body });
  res.json(merchant);
});

router.put('/:id', authorize('ADMIN'), async (req, res) => {
  const merchant = await prisma.merchant.update({ where: { id: req.params.id }, data: req.body });
  res.json(merchant);
});

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  await prisma.merchant.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;