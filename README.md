# fraudGuard — Credit Card Fraud Detection System

a role-based web application for monitoring card transactions, scoring them for fraud, and reviewing the alerts that result. 

the core idea: fraud-response logic lives inside the database. When a fraud prediction is stored, a PostgreSQL trigger opens an alert and declines the transaction automatically, no matter which part of the application wrote the prediction.

## features

- normalized relational schema (3NF) with 8 tables, enforced keys, enums and indexes
- PostgreSQL trigger, stored procedure, function and two views
- JWT authentication, bcrypt password hashing, role-based access (Admin / Analyst) on a single Users table
- customers CRUD with validation, search and pagination
- transactions list with search, status filter and pagination
- alert review workflow that writes to an audit log atomically
- admin-only audit log page
- responsive down to phones

## tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router, Axios |
| Backend | Node.js, Express |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Auth | JWT, bcryptjs |
| Containers | Docker, Docker Compose, nginx |

## database design

tables: `User`, `Customer`, `Merchant`, `Transaction`, `MLModel`, `FraudPrediction`, `FraudAlert`, `AuditLog`.

| Object | Purpose |
| --- | --- |
| `trg_fraud_prediction_alert` (trigger) | Creates an open alert and declines the transaction when a prediction is FRAUD |
| `resolve_fraud_alert` (stored procedure) | Updates an alert and writes the audit entry in one atomic step |
| `calculate_customer_risk` (function) | Percentage of a customer's transactions predicted as fraud |
| `high_risk_transactions` (view) | Fraud predictions with confidence of at least 0.80, joined across four tables |
| `merchant_fraud_summary` (view) | Per-merchant transaction and fraud counts using GROUP BY |

the SQL lives in `backend/sql/db_logic.sql`.

## roles

| role | can do |
| --- | --- |
| Admin | Everything: manage customers, create predictions, review alerts, view the audit log |
| Analyst | View customers, transactions and alerts; review alerts |

## getting started

### prerequisites

- node.js 20 or newer
- a PostgreSQL database (a free Supabase project works)

### backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate deploy
node index.js
```

fill in `backend/.env` with your own connection strings and a long random `JWT_SECRET`. Apply the trigger, procedure and views once:

```bash
npx prisma db execute --file sql/db_logic.sql --schema schema.prisma
```

create the first admin by running the seed script, or by inserting a user with a bcrypt hash and the `ADMIN` role.

### frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

open http://localhost:5173.

### with Docker

```bash
docker compose up --build
```

the app is served at http://localhost:8080 and the API at http://localhost:5000.

## Backup and restore

```bash
pg_dump "$DIRECT_URL" --format=custom --file=backups/fraudguard.dump
pg_restore --clean --if-exists --no-owner --dbname="$DIRECT_URL" backups/fraudguard.dump
```

## security notes

- passwords are hashed with bcrypt
- database access goes through Prisma, which parameterizes queries
- secrets are read from environment variables and `.env` files are git-ignored
- public sign-up always creates an Analyst; only admins can create admins

