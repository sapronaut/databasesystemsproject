# Data Dictionary and Relational Schema

Credit Card Fraud Detection System (FraudGuard) — BCSE307L Database Systems

Database: PostgreSQL. Schema managed with Prisma. Surrogate primary keys are UUID strings stored as `TEXT`.

## 1. Relational schema

Primary keys are underlined in notation as `PK`, foreign keys as `FK`.

```
User(PK id, email, passwordHash, role, createdAt)
Customer(PK id, fullName, email, phone, dateOfBirth, address, city, state, accountNumber, createdAt)
Merchant(PK id, merchantName, category, city, country, createdAt)
Transaction(PK id, FK customerId, FK merchantId, amount, transactionTime, paymentMethod, deviceType, ipAddress, location, status)
MLModel(PK id, modelName, algorithm, accuracy, version, trainingDate)
FraudPrediction(PK id, FK transactionId, FK modelId, predictionResult, confidenceScore, predictionTime)
FraudAlert(PK id, FK predictionId, alertStatus, generatedTime, FK reviewedById, remarks)
AuditLog(PK id, FK userId, action, tableAffected, timestamp)
```

## 2. Relationships

| Parent | Relationship | Child | Cardinality | Foreign key | On delete |
| --- | --- | --- | --- | --- | --- |
| Customer | makes | Transaction | 1 : M | Transaction.customerId | RESTRICT |
| Merchant | receives | Transaction | 1 : M | Transaction.merchantId | RESTRICT |
| Transaction | has | FraudPrediction | 1 : 1 | FraudPrediction.transactionId (UNIQUE) | RESTRICT |
| MLModel | generates | FraudPrediction | 1 : M | FraudPrediction.modelId | RESTRICT |
| FraudPrediction | raises | FraudAlert | 1 : 0..1 | FraudAlert.predictionId (UNIQUE) | RESTRICT |
| User | reviews | FraudAlert | 1 : M (optional) | FraudAlert.reviewedById | SET NULL |
| User | performs | AuditLog | 1 : M | AuditLog.userId | RESTRICT |

All foreign keys update with CASCADE. RESTRICT stops a parent row from being deleted while child rows exist, which is why a customer with transactions cannot be deleted.

## 3. Data dictionary

### 3.1 User

Single table for every account. Access level is decided by the `role` column, not by separate tables.

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | TEXT | PK | Unique user identifier (UUID) |
| email | TEXT | NOT NULL, UNIQUE | Login email, stored in lower case |
| passwordHash | TEXT | NOT NULL | bcrypt hash of the password |
| role | Role enum (ADMIN, ANALYST) | NOT NULL, DEFAULT ANALYST | Authorization level |
| createdAt | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Account creation time |

Indexes: `User_email_key` (unique), `User_email_idx`.

### 3.2 Customer

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | TEXT | PK | Unique customer identifier |
| fullName | TEXT | NOT NULL | Customer name |
| email | TEXT | NOT NULL, UNIQUE | Contact email |
| phone | TEXT | NOT NULL, CHECK 10 digits | Contact number |
| dateOfBirth | TIMESTAMP(3) | NOT NULL | Date of birth |
| address | TEXT | NOT NULL | Street address |
| city | TEXT | NOT NULL | City |
| state | TEXT | NOT NULL | State |
| accountNumber | TEXT | NOT NULL, UNIQUE | Card account number |
| createdAt | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Record creation time |

Indexes: `Customer_city_state_idx` for location searches.

### 3.3 Merchant

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | TEXT | PK | Unique merchant identifier |
| merchantName | TEXT | NOT NULL | Merchant name |
| category | TEXT | NOT NULL | Business category |
| city | TEXT | NOT NULL | City of operation |
| country | TEXT | NOT NULL | Country |
| createdAt | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Record creation time |

Indexes: `Merchant_category_idx`.

### 3.4 Transaction

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | TEXT | PK | Unique transaction identifier |
| customerId | TEXT | NOT NULL, FK to Customer(id) | Customer who made the transaction |
| merchantId | TEXT | NOT NULL, FK to Merchant(id) | Merchant that received it |
| amount | DECIMAL(12,2) | NOT NULL, CHECK amount > 0 | Transaction value |
| transactionTime | TIMESTAMP(3) | NOT NULL, DEFAULT now() | When the transaction happened |
| paymentMethod | TEXT | NOT NULL | For example Credit Card |
| deviceType | TEXT | NOT NULL | Device used (Web, Mobile) |
| ipAddress | TEXT | NOT NULL | Source IP address |
| location | TEXT | NOT NULL | Transaction location |
| status | TransactionStatus enum (APPROVED, DECLINED, PENDING) | NOT NULL, DEFAULT PENDING | Processing state; the fraud trigger sets DECLINED |

Indexes: `Transaction_customerId_idx`, `Transaction_merchantId_idx`, `Transaction_transactionTime_idx`.

### 3.5 MLModel

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | TEXT | PK | Unique model identifier |
| modelName | TEXT | NOT NULL | Model name |
| algorithm | TEXT | NOT NULL | Algorithm used |
| accuracy | DECIMAL(5,4) | NOT NULL, CHECK between 0 and 1 | Measured accuracy |
| version | TEXT | NOT NULL | Model version |
| trainingDate | TIMESTAMP(3) | NOT NULL | When it was trained |

### 3.6 FraudPrediction

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | TEXT | PK | Unique prediction identifier |
| transactionId | TEXT | NOT NULL, UNIQUE, FK to Transaction(id) | Transaction that was scored |
| modelId | TEXT | NOT NULL, FK to MLModel(id) | Model that produced the score |
| predictionResult | PredictionResult enum (FRAUD, NOT_FRAUD) | NOT NULL | Outcome |
| confidenceScore | DECIMAL(5,4) | NOT NULL, CHECK between 0 and 1 | Model confidence |
| predictionTime | TIMESTAMP(3) | NOT NULL, DEFAULT now() | When it was scored |

Indexes: `FraudPrediction_transactionId_key` (unique), `FraudPrediction_modelId_idx`, `FraudPrediction_predictionResult_idx`.

Trigger: `trg_fraud_prediction_alert` runs after insert when `predictionResult = 'FRAUD'`.

### 3.7 FraudAlert

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | TEXT | PK | Unique alert identifier |
| predictionId | TEXT | NOT NULL, UNIQUE, FK to FraudPrediction(id) | Prediction that raised the alert |
| alertStatus | AlertStatus enum (OPEN, REVIEWED, DISMISSED) | NOT NULL, DEFAULT OPEN | Review state |
| generatedTime | TIMESTAMP(3) | NOT NULL, DEFAULT now() | When the alert was raised |
| reviewedById | TEXT | NULL, FK to User(id) | Reviewer, empty until reviewed |
| remarks | TEXT | NULL | Reviewer's note |

Indexes: `FraudAlert_predictionId_key` (unique), `FraudAlert_alertStatus_idx`.

### 3.8 AuditLog

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| id | TEXT | PK | Unique log entry identifier |
| userId | TEXT | NOT NULL, FK to User(id) | User who acted |
| action | TEXT | NOT NULL | What was done, for example RESOLVE_ALERT_REVIEWED |
| tableAffected | TEXT | NOT NULL | Table that changed |
| timestamp | TIMESTAMP(3) | NOT NULL, DEFAULT now() | When it happened |

Indexes: `AuditLog_userId_idx`, `AuditLog_timestamp_idx`.

## 4. Database objects

| Object | Type | Purpose |
| --- | --- | --- |
| create_fraud_alert / trg_fraud_prediction_alert | Trigger function and trigger | Opens an alert and declines the transaction when a FRAUD prediction is inserted |
| resolve_fraud_alert | Stored procedure | Updates an alert and inserts an AuditLog row in one transaction |
| calculate_customer_risk | Function | Returns the percentage of a customer's transactions predicted as fraud |
| high_risk_transactions | View | FRAUD predictions with confidence of 0.80 or more, joined across Transaction, Customer, Merchant and FraudPrediction |
| merchant_fraud_summary | View | Transaction count, fraud count and total amount per merchant using GROUP BY |

## 5. Normalization

**First normal form.** Every column holds a single atomic value and every table has a primary key. There are no repeating groups; many transactions per customer live in separate rows of Transaction.

**Second normal form.** Every table uses a single-column primary key, so no non-key attribute can depend on part of a key.

**Third normal form.** No non-key attribute depends on another non-key attribute:

- Merchant details are stored once in Merchant and referenced from Transaction, so merchant name and category are not repeated on every transaction.
- Model name, algorithm and accuracy are stored once in MLModel, not repeated on every prediction.
- Reviewer identity is referenced through `reviewedById` instead of storing the reviewer's email on the alert.
- In Customer, `city` and `state` are both address attributes of the customer. City does not determine state, because city names repeat across states, so no transitive dependency exists.
- `location` and `ipAddress` on Transaction describe that particular transaction and cannot be derived from the customer or merchant.

Every determinant in each table is a candidate key, so the tables are also in Boyce-Codd normal form.

## 6. Check constraints

Added in `backend/sql/constraints.sql` because Prisma cannot declare them:

| Constraint | Table | Rule |
| --- | --- | --- |
| chk_transaction_amount_positive | Transaction | amount > 0 |
| chk_prediction_confidence_range | FraudPrediction | confidenceScore between 0 and 1 |
| chk_model_accuracy_range | MLModel | accuracy between 0 and 1 |
| chk_customer_phone_digits | Customer | phone is exactly 10 digits |

## 7. ER diagram updates

The ER diagram drawn earlier has six entities. Add two more so every table is derived from it:

- **USER** with attributes id (PK), email, passwordHash, role, createdAt
- **AUDIT_LOG** with attributes id (PK), userId (FK), action, tableAffected, timestamp

Add two relationships: **USER reviews FRAUD_ALERT** (1 : M, optional on the alert side) and **USER performs AUDIT_LOG** (1 : M).
