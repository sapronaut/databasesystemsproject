CREATE OR REPLACE FUNCTION create_fraud_alert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "FraudAlert" (id, "predictionId", "alertStatus", "generatedTime")
  VALUES (gen_random_uuid()::text, NEW.id, 'OPEN', NOW());
  UPDATE "Transaction" SET status = 'DECLINED' WHERE id = NEW."transactionId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fraud_prediction_alert
AFTER INSERT ON "FraudPrediction"
FOR EACH ROW
WHEN (NEW."predictionResult" = 'FRAUD')
EXECUTE FUNCTION create_fraud_alert();

CREATE OR REPLACE PROCEDURE resolve_fraud_alert(
  p_alert_id TEXT,
  p_user_id TEXT,
  p_status "AlertStatus",
  p_remarks TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "FraudAlert"
  SET "alertStatus" = p_status, "reviewedById" = p_user_id, remarks = p_remarks
  WHERE id = p_alert_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alert % not found', p_alert_id;
  END IF;

  INSERT INTO "AuditLog" (id, "userId", action, "tableAffected", "timestamp")
  VALUES (gen_random_uuid()::text, p_user_id, 'RESOLVE_ALERT_' || p_status::text, 'FraudAlert', NOW());
END;
$$;

CREATE OR REPLACE FUNCTION calculate_customer_risk(p_customer_id TEXT) RETURNS NUMERIC AS $$
DECLARE
  total_count INT;
  fraud_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count FROM "Transaction" WHERE "customerId" = p_customer_id;
  IF total_count = 0 THEN
    RETURN 0;
  END IF;
  SELECT COUNT(*) INTO fraud_count
  FROM "Transaction" t
  JOIN "FraudPrediction" fp ON fp."transactionId" = t.id
  WHERE t."customerId" = p_customer_id AND fp."predictionResult" = 'FRAUD';
  RETURN ROUND(fraud_count::NUMERIC / total_count * 100, 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW high_risk_transactions AS
SELECT
  t.id AS "transactionId",
  c."fullName" AS "customerName",
  m."merchantName" AS "merchantName",
  t.amount,
  fp."confidenceScore",
  t."transactionTime"
FROM "Transaction" t
JOIN "Customer" c ON c.id = t."customerId"
JOIN "Merchant" m ON m.id = t."merchantId"
JOIN "FraudPrediction" fp ON fp."transactionId" = t.id
WHERE fp."predictionResult" = 'FRAUD' AND fp."confidenceScore" >= 0.80;

CREATE OR REPLACE VIEW merchant_fraud_summary AS
SELECT
  m.id AS "merchantId",
  m."merchantName" AS "merchantName",
  COUNT(t.id)::int AS "totalTransactions",
  COUNT(fp.id) FILTER (WHERE fp."predictionResult" = 'FRAUD')::int AS "fraudCount",
  COALESCE(SUM(t.amount), 0)::float8 AS "totalAmount"
FROM "Merchant" m
LEFT JOIN "Transaction" t ON t."merchantId" = m.id
LEFT JOIN "FraudPrediction" fp ON fp."transactionId" = t.id
GROUP BY m.id, m."merchantName";