ALTER TABLE radiology_orders
    ADD COLUMN IF NOT EXISTS visit_id INTEGER,
    ADD COLUMN IF NOT EXISTS admission_id INTEGER,
    ADD COLUMN IF NOT EXISTS source VARCHAR(24),
    ADD COLUMN IF NOT EXISTS source_soap_note_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_action_id UUID;

ALTER TABLE diagnoses
    ADD COLUMN IF NOT EXISTS source VARCHAR(24),
    ADD COLUMN IF NOT EXISTS source_soap_note_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_action_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='radiology_orders'::regclass AND conname='radiology_orders_visit_fk') THEN
        ALTER TABLE radiology_orders ADD CONSTRAINT radiology_orders_visit_fk
            FOREIGN KEY (visit_id) REFERENCES patient_visits(visit_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='radiology_orders'::regclass AND conname='radiology_orders_admission_fk') THEN
        ALTER TABLE radiology_orders ADD CONSTRAINT radiology_orders_admission_fk
            FOREIGN KEY (admission_id) REFERENCES admissions(admission_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='radiology_orders'::regclass AND conname='radiology_orders_source_soap_note_fk') THEN
        ALTER TABLE radiology_orders ADD CONSTRAINT radiology_orders_source_soap_note_fk
            FOREIGN KEY (source_soap_note_id) REFERENCES soap_notes(soap_note_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='radiology_orders'::regclass AND conname='radiology_orders_source_action_fk') THEN
        ALTER TABLE radiology_orders ADD CONSTRAINT radiology_orders_source_action_fk
            FOREIGN KEY (source_action_id) REFERENCES soap_clinical_actions(action_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='diagnoses'::regclass AND conname='diagnoses_source_soap_note_fk') THEN
        ALTER TABLE diagnoses ADD CONSTRAINT diagnoses_source_soap_note_fk
            FOREIGN KEY (source_soap_note_id) REFERENCES soap_notes(soap_note_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='diagnoses'::regclass AND conname='diagnoses_source_action_fk') THEN
        ALTER TABLE diagnoses ADD CONSTRAINT diagnoses_source_action_fk
            FOREIGN KEY (source_action_id) REFERENCES soap_clinical_actions(action_id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_radiology_orders_source_action
    ON radiology_orders(source_action_id) WHERE source_action_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_diagnoses_source_action
    ON diagnoses(source_action_id) WHERE source_action_id IS NOT NULL;
