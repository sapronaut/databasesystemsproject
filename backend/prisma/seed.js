const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.create({
    data: { email: 'admin@fraudsystem.com', passwordHash: 'placeholder', role: 'ADMIN' }
  });

  await prisma.user.create({
    data: { email: 'analyst@fraudsystem.com', passwordHash: 'placeholder', role: 'ANALYST' }
  });

  const customer = await prisma.customer.create({
    data: {
      fullName: 'Ravi Kumar',
      email: 'ravi@example.com',
      phone: '9876543210',
      dateOfBirth: new Date('1995-04-12'),
      address: '12 MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      accountNumber: 'ACC1001'
    }
  });

  const merchant = await prisma.merchant.create({
    data: { merchantName: 'Amazon India', category: 'E-commerce', city: 'Bangalore', country: 'India' }
  });

  const model = await prisma.mLModel.create({
    data: { modelName: 'FraudNet v1', algorithm: 'Random Forest', accuracy: 0.94, version: '1.0', trainingDate: new Date('2026-01-15') }
  });

  const txn = await prisma.transaction.create({
    data: {
      customerId: customer.id,
      merchantId: merchant.id,
      amount: 15000,
      paymentMethod: 'Credit Card',
      deviceType: 'Mobile',
      ipAddress: '192.168.1.1',
      location: 'Bangalore',
      status: 'PENDING'
    }
  });

  const prediction = await prisma.fraudPrediction.create({
    data: {
      transactionId: txn.id,
      modelId: model.id,
      predictionResult: 'FRAUD',
      confidenceScore: 0.87
    }
  });

  await prisma.fraudAlert.create({
    data: { predictionId: prediction.id, alertStatus: 'OPEN', reviewedById: admin.id }
  });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });