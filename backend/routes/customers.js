const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const customers = await prisma.customer.findMany();
  res.json(customers);
});

router.get('/:id', async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: 'Not found' });
  res.json(customer);
});

router.post('/', async (req, res) => {
  const customer = await prisma.customer.create({ data: req.body });
  res.json(customer);
});

router.put('/:id', async (req, res) => {
  const customer = await prisma.customer.update({ where: { id: req.params.id }, data: req.body });
  res.json(customer);
});

router.delete('/:id', async (req, res) => {
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;