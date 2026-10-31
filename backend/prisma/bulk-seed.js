require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

const CUSTOMER_COUNT = 40;
const TRANSACTION_COUNT = 150;
const DAYS_BACK = 45;
const DEMO_DOMAIN = 'demo.fraudguard.in';

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Rohan', 'Karan', 'Ishaan', 'Siddharth', 'Rahul', 'Amit', 'Priya', 'Ananya', 'Diya', 'Kavya', 'Meera', 'Neha', 'Pooja', 'Riya', 'Sneha', 'Tanvi'];
const lastNames = ['Sharma', 'Patel', 'Iyer', 'Reddy', 'Nair', 'Gupta', 'Mehta', 'Singh', 'Kulkarni', 'Das', 'Bose', 'Menon', 'Joshi', 'Verma', 'Chopra', 'Rao', 'Pillai', 'Banerjee', 'Kapoor', 'Malhotra'];
const places = [
  ['Mumbai', 'Maharashtra'], ['Pune', 'Maharashtra'], ['Bengaluru', 'Karnataka'], ['Mysuru', 'Karnataka'],
  ['Chennai', 'Tamil Nadu'], ['Coimbatore', 'Tamil Nadu'], ['Hyderabad', 'Telangana'], ['Kolkata', 'West Bengal'],
  ['Delhi', 'Delhi'], ['Gurugram', 'Haryana'], ['Ahmedabad', 'Gujarat'], ['Jaipur', 'Rajasthan'],
  ['Kochi', 'Kerala'], ['Lucknow', 'Uttar Pradesh'], ['Bhubaneswar', 'Odisha']
];
const streets = ['MG Road', 'Park Street', 'Anna Salai', 'Brigade Road', 'Linking Road', 'Residency Road', 'Banjara Hills', 'Salt Lake', 'Civil Lines', 'Marine Drive'];

const merchantSeeds = [
  { name: 'Flipkart', category: 'E-commerce', city: 'Bengaluru' },
  { name: 'Swiggy', category: 'Food Delivery', city: 'Bengaluru' },
  { name: 'Zomato', category: 'Food Delivery', city: 'Gurugram' },
  { name: 'BigBasket', category: 'Groceries', city: 'Bengaluru' },
  { name: 'MakeMyTrip', category: 'Travel', city: 'Gurugram' },
  { name: 'IndiGo Airlines', category: 'Travel', city: 'Gurugram' },
  { name: 'Reliance Digital', category: 'Electronics', city: 'Mumbai' },
  { name: 'Croma', category: 'Electronics', city: 'Mumbai' },
  { name: 'Myntra', category: 'Fashion', city: 'Bengaluru' },
  { name: 'Tanishq Jewellers', category: 'Jewellery', city: 'Chennai' },
  { name: 'BookMyShow', category: 'Entertainment', city: 'Mumbai' },
  { name: 'Apollo Pharmacy', category: 'Healthcare', city: 'Chennai' },
  { name: 'Indian Oil Fuel Station', category: 'Fuel', city: 'Delhi' },
  { name: 'Uber India', category: 'Transport', city: 'Hyderabad' },
  { name: 'Nykaa', category: 'Beauty', city: 'Mumbai' }
];

const paymentMethods = ['Credit Card', 'Contactless', 'Online Checkout', 'Card on File'];
const deviceTypes = ['Mobile', 'Web', 'POS Terminal'];
const fraudLocations = ['Lagos, Nigeria', 'Moscow, Russia', 'Dubai, UAE', 'Bucharest, Romania', 'Kyiv, Ukraine', 'Singapore'];
const reviewNotes = ['Customer confirmed they did not make this purchase', 'Card blocked and reissued', 'Matches known fraud ring pattern', 'Escalated to the cards team', 'Chargeback initiated'];
const dismissNotes = ['Customer confirmed the purchase by phone', 'Regular travel purchase, verified', 'Known merchant, normal spending pattern', 'Customer was abroad, verified by SMS'];

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const chance = (p) => Math.random() < p;
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Number(n.toFixed(4));

function buildCustomers() {
  const used = new Set();
  const list = [];
  while (list.length < CUSTOMER_COUNT) {
    const first = pick(firstNames);
    const last = pick(lastNames);
    const key = `${first}.${last}`.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    const [city, state] = pick(places);
    list.push({
      id: randomUUID(),
      fullName: `${first} ${last}`,
      email: `${key}@${DEMO_DOMAIN}`,
      phone: String(pick([6, 7, 8, 9])) + String(randInt(0, 999999999)).padStart(9, '0'),
      dateOfBirth: new Date(Date.UTC(randInt(1965, 2002), randInt(0, 11), randInt(1, 28))),
      address: `${randInt(1, 240)}, ${pick(streets)}`,
      city,
      state,
      accountNumber: `ACC${2001 + list.length}`
    });
  }
  return list;
}

function buildMerchants() {
  return merchantSeeds.map((m) => ({
    id: randomUUID(),
    merchantName: m.name,
    category: m.category,
    city: m.city,
    country: 'India'
  }));
}

function buildTransactions(customers, merchants) {
  const now = Date.now();
  const transactions = [];
  const flags = [];
  for (let i = 0; i < TRANSACTION_COUNT; i++) {
    const customer = pick(customers);
    const merchant = pick(merchants);
    const suspicious = chance(0.11);
    const amount = suspicious ? randInt(22000, 95000) : Math.min(round2(Math.exp(rand(5.5, 9.4))), 18000);
    const at = new Date(now - Math.random() * DAYS_BACK * 86400000);
    transactions.push({
      id: randomUUID(),
      customerId: customer.id,
      merchantId: merchant.id,
      amount,
      transactionTime: at,
      paymentMethod: suspicious ? pick(['Online Checkout', 'Card on File']) : pick(paymentMethods),
      deviceType: suspicious ? pick(['Web', 'Mobile']) : pick(deviceTypes),
      ipAddress: `${randInt(11, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
      location: suspicious && chance(0.7) ? pick(fraudLocations) : merchant.city,
      status: 'PENDING'
    });
    flags.push(suspicious);
  }
  return { transactions, flags };
}

function buildPredictions(transactions, flags, modelId) {
  const predictions = [];
  transactions.forEach((t, i) => {
    const roll = Math.random();
    if (!flags[i] && roll < 0.07) {
      t.status = roll < 0.04 ? 'PENDING' : 'DECLINED';
      return;
    }
    const flagged = flags[i] ? chance(0.9) : chance(0.02);
    if (!flagged) t.status = 'APPROVED';
    predictions.push({
      id: randomUUID(),
      transactionId: t.id,
      modelId,
      predictionResult: flagged ? 'FRAUD' : 'NOT_FRAUD',
      confidenceScore: flagged ? round4(rand(0.78, 0.99)) : round4(rand(0.02, 0.38)),
      predictionTime: new Date(t.transactionTime.getTime() + randInt(1, 30) * 1000)
    });
  });
  return predictions;
}

async function resolveSome(fraudPredictionIds) {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.log('No admin user found, leaving every alert open.');
    return 0;
  }
  const alerts = await prisma.fraudAlert.findMany({
    where: { predictionId: { in: fraudPredictionIds } },
    include: { prediction: { select: { transactionId: true } } },
    orderBy: { generatedTime: 'asc' }
  });
  const toResolve = alerts.slice(0, Math.floor(alerts.length * 0.55));
  for (const alert of toResolve) {
    const confirmed = chance(0.65);
    const status = confirmed ? 'REVIEWED' : 'DISMISSED';
    const remark = confirmed ? pick(reviewNotes) : pick(dismissNotes);
    await prisma.$executeRaw`CALL resolve_fraud_alert(${alert.id}::text, ${admin.id}::text, ${status}::"AlertStatus", ${remark}::text)`;
    if (!confirmed) {
      await prisma.transaction.update({ where: { id: alert.prediction.transactionId }, data: { status: 'APPROVED' } });
    }
  }
  return toResolve.length;
}

async function loadDemo() {
  const existing = await prisma.customer.count({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } } });
  if (existing > 0) {
    console.log('Demo data is already loaded. Run with --clear first to reload it.');
    return;
  }

  let model = await prisma.mLModel.findFirst();
  if (!model) {
    model = await prisma.mLModel.create({
      data: { modelName: 'FraudNet v1', algorithm: 'Random Forest', accuracy: 0.94, version: '1.0', trainingDate: new Date('2026-01-15') }
    });
  }

  const customers = buildCustomers();
  const merchants = buildMerchants();
  const { transactions, flags } = buildTransactions(customers, merchants);
  const predictions = buildPredictions(transactions, flags, model.id);

  await prisma.customer.createMany({ data: customers });
  await prisma.merchant.createMany({ data: merchants });
  await prisma.transaction.createMany({ data: transactions });
  await prisma.fraudPrediction.createMany({ data: predictions });

  const fraudPredictionIds = predictions.filter((p) => p.predictionResult === 'FRAUD').map((p) => p.id);
  if (fraudPredictionIds.length) {
    await prisma.$executeRaw`UPDATE "FraudAlert" fa SET "generatedTime" = fp."predictionTime" FROM "FraudPrediction" fp WHERE fp.id = fa."predictionId" AND fa."predictionId" = ANY(${fraudPredictionIds}::text[])`;
  }
  const resolved = await resolveSome(fraudPredictionIds);

  console.log(`Loaded ${customers.length} customers, ${merchants.length} merchants, ${transactions.length} transactions, ${predictions.length} predictions.`);
  console.log(`${fraudPredictionIds.length} alerts raised by the trigger, ${resolved} of them reviewed.`);
}

async function clearDemo() {
  const owner = { email: { endsWith: `@${DEMO_DOMAIN}` } };
  const alerts = await prisma.fraudAlert.deleteMany({ where: { prediction: { transaction: { customer: owner } } } });
  const predictions = await prisma.fraudPrediction.deleteMany({ where: { transaction: { customer: owner } } });
  const transactions = await prisma.transaction.deleteMany({ where: { customer: owner } });
  const customers = await prisma.customer.deleteMany({ where: owner });
  const merchants = await prisma.merchant.deleteMany({
    where: { merchantName: { in: merchantSeeds.map((m) => m.name) }, transactions: { none: {} } }
  });
  console.log(`Removed ${customers.count} customers, ${merchants.count} merchants, ${transactions.count} transactions, ${predictions.count} predictions, ${alerts.count} alerts.`);
}

(process.argv.includes('--clear') ? clearDemo() : loadDemo())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
