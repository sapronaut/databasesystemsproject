const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', authorize('ADMIN', 'ANALYST'), async (req, res) => {
  const alerts = await prisma.fraudAlert.findMany({
    include: {
      prediction: { include: { transaction: { include: { customer: true, merchant: true } } } },
      reviewedBy: { select: { id: true, email: true, role: true } }
    },
    orderBy: { generatedTime: 'desc' }
  });
  res.json(alerts);
});

router.post('/:id/resolve', authorize('ADMIN', 'ANALYST'), async (req, res) => {
  const { status, remarks } = req.body;
  if (!['REVIEWED', 'DISMISSED'].includes(status)) {
    return res.status(400).json({ error: 'status must be REVIEWED or DISMISSED' });
  }
  try {
    await prisma.$executeRaw`CALL resolve_fraud_alert(${req.params.id}::text, ${req.user.userId}::text, ${status}::"AlertStatus", ${remarks || null}::text)`;
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: 'Alert not found or could not be resolved' });
  }
});

module.exports = router;