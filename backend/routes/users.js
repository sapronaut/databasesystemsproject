const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROLES = ['ADMIN', 'ANALYST', 'AUDITOR', 'CUSTOMER'];
const select = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  customerId: true,
  customer: { select: { fullName: true } }
};

async function linkProblem(role, customerId, exceptUserId) {
  if (role !== 'CUSTOMER') return null;
  if (!customerId) return { status: 400, error: 'Choose the customer this login belongs to' };
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return { status: 404, error: 'Customer not found' };
  const where = { customerId };
  if (exceptUserId) where.NOT = { id: exceptUserId };
  const taken = await prisma.user.findFirst({ where });
  if (taken) return { status: 409, error: 'That customer already has a login' };
  return null;
}

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({ select, orderBy: { createdAt: 'desc' } });
  res.json(users);
});

router.post('/', async (req, res) => {
  const { email, password, role, customerId } = req.body;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Choose a valid role' });
  const problem = await linkProblem(role, customerId, null);
  if (problem) return res.status(problem.status).json({ error: problem.error });

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: { email: email.trim().toLowerCase(), passwordHash, role, customerId: role === 'CUSTOMER' ? customerId : null },
      select
    }),
    prisma.auditLog.create({ data: { userId: req.user.userId, action: `CREATE_USER_${role}`, tableAffected: 'User' } })
  ]);
  res.status(201).json(user);
});

router.put('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { role, customerId, password } = req.body;
  if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ error: 'Choose a valid role' });
  const nextRole = role || user.role;
  if (user.id === req.user.userId && nextRole !== user.role) {
    return res.status(400).json({ error: 'You can’t change your own role' });
  }
  const nextCustomer = customerId !== undefined ? customerId : user.customerId;
  const problem = await linkProblem(nextRole, nextCustomer, user.id);
  if (problem) return res.status(problem.status).json({ error: problem.error });

  const data = { role: nextRole, customerId: nextRole === 'CUSTOMER' ? nextCustomer : null };
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    data.passwordHash = await bcrypt.hash(password, 10);
  }
  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data, select }),
    prisma.auditLog.create({ data: { userId: req.user.userId, action: `UPDATE_USER_${nextRole}`, tableAffected: 'User' } })
  ]);
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.userId) return res.status(400).json({ error: 'You can’t delete your own account' });
  try {
    await prisma.$transaction([
      prisma.user.delete({ where: { id: req.params.id } }),
      prisma.auditLog.create({ data: { userId: req.user.userId, action: 'DELETE_USER', tableAffected: 'User' } })
    ]);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'This user has audit history, so it can’t be deleted. Change their role instead.' });
    }
    if (err.code === 'P2025') return res.status(404).json({ error: 'User not found' });
    throw err;
  }
});

module.exports = router;
