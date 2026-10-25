ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS chk_transaction_amount_positive;
ALTER TABLE "Transaction" ADD CONSTRAINT chk_transaction_amount_positive CHECK (amount > 0);

ALTER TABLE "FraudPrediction" DROP CONSTRAINT IF EXISTS chk_prediction_confidence_range;
ALTER TABLE "FraudPrediction" ADD CONSTRAINT chk_prediction_confidence_range CHECK ("confidenceScore" >= 0 AND "confidenceScore" <= 1);

ALTER TABLE "MLModel" DROP CONSTRAINT IF EXISTS chk_model_accuracy_range;
ALTER TABLE "MLModel" ADD CONSTRAINT chk_model_accuracy_range CHECK (accuracy >= 0 AND accuracy <= 1);

ALTER TABLE "Customer" DROP CONSTRAINT IF EXISTS chk_customer_phone_digits;
ALTER TABLE "Customer" ADD CONSTRAINT chk_customer_phone_digits CHECK (phone ~ '^[0-9]{10}$');
