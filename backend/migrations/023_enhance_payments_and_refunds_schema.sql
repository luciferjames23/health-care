-- Migration 023: Enhance payments and refunds schema for full database persistence, refund tracking, and context isolation

-- 1. Make bill_id in payments table NULLABLE so appointment payments are not forced to link to unrelated bills
ALTER TABLE payments ALTER COLUMN bill_id DROP NOT NULL;

-- 2. Make bill_id and approved_by in refunds table NULLABLE for appointment & automated mock refunds
ALTER TABLE refunds ALTER COLUMN bill_id DROP NOT NULL;
ALTER TABLE refunds ALTER COLUMN approved_by DROP NOT NULL;

-- 3. Add payment_id, appointment_id, refund_reference, created_at, updated_at to refunds table if not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'payment_id') THEN
        ALTER TABLE refunds ADD COLUMN payment_id INT REFERENCES payments(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'appointment_id') THEN
        ALTER TABLE refunds ADD COLUMN appointment_id INT REFERENCES appointments(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'refund_reference') THEN
        ALTER TABLE refunds ADD COLUMN refund_reference VARCHAR(64) UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'created_at') THEN
        ALTER TABLE refunds ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'updated_at') THEN
        ALTER TABLE refunds ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- 4. Create performance & lookup indexes on refunds
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_patient_id ON refunds(patient_id);
CREATE INDEX IF NOT EXISTS idx_refunds_appointment_id ON refunds(appointment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_bill_id ON refunds(bill_id);
CREATE INDEX IF NOT EXISTS idx_refunds_reference ON refunds(refund_reference);
