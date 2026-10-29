ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CUSTOMER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AUDITOR';

CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

ALTER TABLE "User" ADD COLUMN "customerId" TEXT;
CREATE UNIQUE INDEX "User_customerId_key" ON "User"("customerId");
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Dispute" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolution" TEXT,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_dispute_reason_length" CHECK (char_length("reason") BETWEEN 5 AND 500)
);

CREATE INDEX "Dispute_customerId_idx" ON "Dispute"("customerId");
CREATE INDEX "Dispute_transactionId_idx" ON "Dispute"("transactionId");
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE SCHEMA IF NOT EXISTS custom;
