-- 046_patient_charges_paid_status.sql
-- Allow PAID and SETTLED billing statuses for patient_charges
ALTER TABLE patient_charges DROP CONSTRAINT IF EXISTS patient_charges_billing_status_check;
ALTER TABLE patient_charges ADD CONSTRAINT patient_charges_billing_status_check CHECK (billing_status IN ('PENDING','BILLED','PAID','SETTLED','CANCELLED','WAIVED'));
