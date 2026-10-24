const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authorize } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/models', async (req, res) => {
  const models = await prisma.mLModel.findMany();
  res.json(models);
});

router.get('/', async (req, res) => {
  const predictions = await prisma.fraudPrediction.findMany({
    include: { transaction: true, model: true, fraudAlert: true }
  });
  res.json(predictions);
});

router.post('/', authorize('ADMIN'), async (req, res) => {
  try {
    const prediction = await prisma.fraudPrediction.create({ data: req.body });
    res.json(prediction);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;