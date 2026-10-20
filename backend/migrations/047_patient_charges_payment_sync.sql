-- Migration 047: Canonical patient charges billing status and payment synchronization
-- Ensures patient_charges check constraint permits SETTLED and PAID
-- Creates fast lookup indexes on payments and patient_charges

DO $$
BEGIN
    ALTER TABLE patient_charges DROP CONSTRAINT IF EXISTS patient_charges_billing_status_check;
    ALTER TABLE patient_charges ADD CONSTRAINT patient_charges_billing_status_check
        CHECK (billing_status IN ('PENDING', 'BILLED', 'PAID', 'SETTLED', 'CANCELLED', 'WAIVED'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments (payment_reference);
CREATE INDEX IF NOT EXISTS idx_payments_txn_ref ON payments (transaction_reference);
CREATE INDEX IF NOT EXISTS idx_patient_charges_patient_status ON patient_charges (patient_id, billing_status);
