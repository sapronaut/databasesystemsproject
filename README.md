# FraudGuard — Credit Card Fraud Detection System

A role-based web application for monitoring card transactions, scoring them for fraud, and reviewing the alerts that result. Built for BCSE307L Database Systems (VIT Vellore).

The core idea: fraud-response logic lives inside the database. When a fraud prediction is stored, a PostgreSQL trigger opens an alert and declines the transaction automatically, no matter which part of the application wrote the prediction.

## Features

- Normalized relational schema (3NF) with 8 tables, enforced keys, enums and indexes
- PostgreSQL trigger, stored procedure, function and two views
- JWT authentication, bcrypt password hashing, role-based access (Admin / Analyst) on a single Users table
- Customers CRUD with validation, search and pagination
- Transactions list with search, status filter and pagination
- Alert review workflow that writes to an audit log atomically
- Admin-only audit log page
- Light and dark themes with an iOS-inspired interface, responsive down to phones

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router, Axios |
| Backend | Node.js, Express |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Auth | JWT, bcryptjs |
| Containers | Docker, Docker Compose, nginx |

## Database design

Tables: `User`, `Customer`, `Merchant`, `Transaction`, `MLModel`, `FraudPrediction`, `FraudAlert`, `AuditLog`.

| Object | Purpose |
| --- | --- |
| `trg_fraud_prediction_alert` (trigger) | Creates an open alert and declines the transaction when a prediction is FRAUD |
| `resolve_fraud_alert` (stored procedure) | Updates an alert and writes the audit entry in one atomic step |
| `calculate_customer_risk` (function) | Percentage of a customer's transactions predicted as fraud |
| `high_risk_transactions` (view) | Fraud predictions with confidence of at least 0.80, joined across four tables |
| `merchant_fraud_summary` (view) | Per-merchant transaction and fraud counts using GROUP BY |

The SQL lives in `backend/sql/db_logic.sql`.

## Roles

| Role | Can do |
| --- | --- |
| Admin | Everything: manage customers, create predictions, review alerts, view the audit log |
| Analyst | View customers, transactions and alerts; review alerts |

## Getting started

### Prerequisites

- Node.js 20 or newer
- A PostgreSQL database (a free Supabase project works)

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate deploy
node index.js
```

Fill in `backend/.env` with your own connection strings and a long random `JWT_SECRET`. Apply the trigger, procedure and views once:

```bash
npx prisma db execute --file sql/db_logic.sql --schema schema.prisma
```

Create the first admin by running the seed script, or by inserting a user with a bcrypt hash and the `ADMIN` role.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173.

### With Docker

```bash
docker compose up --build
```

The app is served at http://localhost:8080 and the API at http://localhost:5000.

## Backup and restore

```bash
pg_dump "$DIRECT_URL" --format=custom --file=backups/fraudguard.dump
pg_restore --clean --if-exists --no-owner --dbname="$DIRECT_URL" backups/fraudguard.dump
```

## Security notes

- Passwords are hashed with bcrypt
- Database access goes through Prisma, which parameterizes queries
- Secrets are read from environment variables and `.env` files are git-ignored
- Public sign-up always creates an Analyst; only admins can create admins

## Team

- Add team members and responsibilities here

## Live demo

- Add the deployed URL here
