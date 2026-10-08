ALTER TABLE soap_clinical_actions
    ADD COLUMN IF NOT EXISTS projection VARCHAR(2),
    ADD COLUMN IF NOT EXISTS clinical_indication VARCHAR(500);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='soap_clinical_actions'::regclass
          AND conname='soap_clinical_actions_projection_check'
    ) THEN
        ALTER TABLE soap_clinical_actions
            ADD CONSTRAINT soap_clinical_actions_projection_check
            CHECK (projection IS NULL OR projection IN ('PA', 'AP'));
    END IF;
END $$;
