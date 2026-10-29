const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', authorize('ADMIN', 'AUDITOR'), async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { email: true, role: true } } },
    orderBy: { timestamp: 'desc' },
    take: 100
  });
  res.json(logs);
});

module.exports = router;
