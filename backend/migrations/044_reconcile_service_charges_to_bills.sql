-- Link additive Lab/X-ray order charges to the canonical financial bill ledger.
ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);
ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS source_order_id VARCHAR(100);
ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS source_service_code VARCHAR(80);
ALTER TABLE bills ADD COLUMN IF NOT EXISTS patient_settled_baseline NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS insurance_settled_baseline NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bill_items_service_source
    ON bill_items(source_type, source_order_id, source_service_code)
    WHERE source_type IS NOT NULL AND source_order_id IS NOT NULL AND source_service_code IS NOT NULL;
