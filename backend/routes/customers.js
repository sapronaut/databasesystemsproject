const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

const fields = ['fullName', 'email', 'phone', 'dateOfBirth', 'address', 'city', 'state', 'accountNumber'];

function clean(body) {
  const data = {};
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() : body[f];
  }
  return data;
}

function validate(data, partial) {
  const errors = {};
  if (!partial) {
    for (const f of fields) {
      if (!data[f]) errors[f] = 'Required';
    }
  }
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) errors.email = 'Enter a valid email';
  if (data.phone && !/^\d{10}$/.test(data.phone)) errors.phone = 'Enter a 10-digit phone number';
  if (data.dateOfBirth) {
    const d = new Date(data.dateOfBirth);
    if (isNaN(d.getTime()) || d > new Date()) errors.dateOfBirth = 'Enter a date in the past';
  }
  return errors;
}

function reject(res, errors) {
  return res.status(400).json({ error: 'Please fix the highlighted fields', fields: errors });
}

router.get('/', async (req, res) => {
  const search = (req.query.search || '').trim();
  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } }
        ]
      }
    : {};

  if (req.query.page === undefined) {
    const all = await prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json(all);
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 8, 1), 100);
  const [total, data] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit })
  ]);
  res.json({ data, total, page, pages: Math.ceil(total / limit) });
});

router.get('/:id', async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  const data = clean(req.body);
  const errors = validate(data, false);
  if (Object.keys(errors).length) return reject(res, errors);
  const customer = await prisma.customer.create({ data: { ...data, dateOfBirth: new Date(data.dateOfBirth) } });
  res.status(201).json(customer);
});

router.put('/:id', authorize('ADMIN'), async (req, res) => {
  const data = clean(req.body);
  const errors = validate(data, true);
  if (Object.keys(errors).length) return reject(res, errors);
  if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);
  const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
  res.json(customer);
});

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  await prisma.customer.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
