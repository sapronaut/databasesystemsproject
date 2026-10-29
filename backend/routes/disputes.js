const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const where = ['OPEN', 'RESOLVED', 'REJECTED'].includes(req.query.status) ? { status: req.query.status } : {};
  const disputes = await prisma.dispute.findMany({
    where,
    include: {
      customer: { select: { id: true, fullName: true, email: true } },
      transaction: { include: { merchant: { select: { merchantName: true } } } },
      resolvedBy: { select: { email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(disputes);
});

router.post('/:id/resolve', async (req, res) => {
  const { status, resolution } = req.body;
  if (!['RESOLVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'status must be RESOLVED or REJECTED' });
  }
  const note = typeof resolution === 'string' ? resolution.trim() : '';
  if (note.length < 3) return res.status(400).json({ error: 'Add a short resolution note' });

  const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } });
  if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
  if (dispute.status !== 'OPEN') return res.status(409).json({ error: 'This dispute has already been decided' });

  const steps = [
    prisma.dispute.update({
      where: { id: dispute.id },
      data: { status, resolution: note, resolvedAt: new Date(), resolvedById: req.user.userId }
    }),
    prisma.auditLog.create({
      data: { userId: req.user.userId, action: `DISPUTE_${status}`, tableAffected: 'Dispute' }
    })
  ];
  if (status === 'RESOLVED') {
    steps.push(prisma.transaction.update({ where: { id: dispute.transactionId }, data: { status: 'DECLINED' } }));
  }
  await prisma.$transaction(steps);
  res.json({ success: true });
});

module.exports = router;
