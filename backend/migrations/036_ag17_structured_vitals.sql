ALTER TABLE soap_clinical_actions
    ADD COLUMN IF NOT EXISTS finding_type VARCHAR(24),
    ADD COLUMN IF NOT EXISTS value NUMERIC,
    ADD COLUMN IF NOT EXISTS systolic INTEGER,
    ADD COLUMN IF NOT EXISTS diastolic INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='soap_clinical_actions'::regclass
          AND conname='soap_clinical_actions_finding_type_check'
    ) THEN
        ALTER TABLE soap_clinical_actions
            ADD CONSTRAINT soap_clinical_actions_finding_type_check
            CHECK (finding_type IS NULL OR finding_type IN ('TEMPERATURE','BLOOD_PRESSURE','PULSE','SPO2'));
    END IF;
END $$;

ALTER TABLE vital_signs
    ADD COLUMN IF NOT EXISTS source VARCHAR(24),
    ADD COLUMN IF NOT EXISTS source_soap_note_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_action_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='vital_signs'::regclass AND conname='vital_signs_source_soap_note_fk') THEN
        ALTER TABLE vital_signs ADD CONSTRAINT vital_signs_source_soap_note_fk
            FOREIGN KEY (source_soap_note_id) REFERENCES soap_notes(soap_note_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='vital_signs'::regclass AND conname='vital_signs_source_action_fk') THEN
        ALTER TABLE vital_signs ADD CONSTRAINT vital_signs_source_action_fk
            FOREIGN KEY (source_action_id) REFERENCES soap_clinical_actions(action_id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vital_signs_source_action
    ON vital_signs(source_action_id) WHERE source_action_id IS NOT NULL;
