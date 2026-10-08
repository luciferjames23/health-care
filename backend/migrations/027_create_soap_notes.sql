CREATE TABLE IF NOT EXISTS soap_notes (
    soap_note_id BIGSERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    visit_id INTEGER NOT NULL REFERENCES patient_visits(visit_id) ON DELETE RESTRICT,
    admission_id INTEGER NULL REFERENCES admissions(admission_id) ON DELETE RESTRICT,
    author_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    author_name VARCHAR(150) NOT NULL,
    author_role VARCHAR(50) NOT NULL,
    department_id INTEGER NULL REFERENCES departments(id) ON DELETE SET NULL,
    dictation_language VARCHAR(20),
    raw_transcript TEXT,
    subjective TEXT NOT NULL DEFAULT '',
    objective TEXT NOT NULL DEFAULT '',
    assessment TEXT NOT NULL DEFAULT '',
    plan TEXT NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SIGNED', 'AMENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    signed_at TIMESTAMPTZ,
    signed_by INTEGER NULL REFERENCES users(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    parent_note_id BIGINT NULL REFERENCES soap_notes(soap_note_id) ON DELETE RESTRICT,
    ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    ai_draft JSONB,
    ai_model VARCHAR(120),
    source VARCHAR(32) NOT NULL DEFAULT 'VOICE',
    CONSTRAINT soap_notes_sign_state_check CHECK (
        (status = 'DRAFT' AND signed_at IS NULL AND signed_by IS NULL)
        OR (status IN ('SIGNED', 'AMENDED') AND signed_at IS NOT NULL AND signed_by IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_soap_notes_patient_history ON soap_notes(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soap_notes_visit_history ON soap_notes(visit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_soap_notes_admission ON soap_notes(admission_id);
CREATE INDEX IF NOT EXISTS idx_soap_notes_parent ON soap_notes(parent_note_id);

ALTER TABLE soap_notes ADD COLUMN IF NOT EXISTS ai_draft JSONB;

CREATE OR REPLACE FUNCTION validate_soap_note_context()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM patient_visits v WHERE v.visit_id=NEW.visit_id AND v.patient_id=NEW.patient_id) THEN
        RAISE EXCEPTION 'SOAP visit does not belong to patient';
    END IF;
    IF NEW.admission_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM admissions a WHERE a.admission_id=NEW.admission_id AND a.patient_id=NEW.patient_id AND a.visit_id=NEW.visit_id
    ) THEN
        RAISE EXCEPTION 'SOAP admission does not belong to patient and visit';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_soap_notes_context ON soap_notes;
CREATE TRIGGER trg_soap_notes_context
BEFORE INSERT OR UPDATE OF patient_id, visit_id, admission_id ON soap_notes
FOR EACH ROW EXECUTE FUNCTION validate_soap_note_context();

CREATE OR REPLACE FUNCTION prevent_signed_soap_note_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('SIGNED', 'AMENDED') THEN
        RAISE EXCEPTION 'Signed SOAP notes are immutable; create an amendment instead.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_soap_notes_immutable ON soap_notes;
CREATE TRIGGER trg_soap_notes_immutable
BEFORE UPDATE OR DELETE ON soap_notes
FOR EACH ROW EXECUTE FUNCTION prevent_signed_soap_note_mutation();

DO $$
DECLARE
    action_constraint RECORD;
BEGIN
    FOR action_constraint IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'audit_logs'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%action%'
    LOOP
        EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', action_constraint.conname);
    END LOOP;
END $$;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
    'CREATE_PATIENT', 'UPDATE_PATIENT', 'CREATE_DOCTOR', 'UPDATE_DOCTOR',
    'CREATE_APPOINTMENT', 'CANCEL_APPOINTMENT', 'RESCHEDULE_APPOINTMENT',
    'UPDATE_SCHEDULE', 'CHANGE_PASSWORD', 'PROCESS_MOCK_PAYMENT', 'PROCESS_MOCK_REFUND',
    'SOAP_CREATED', 'SOAP_TRANSCRIPTION_CREATED', 'SOAP_AI_DRAFT_GENERATED', 'SOAP_DRAFT_SAVED',
    'SOAP_DRAFT_UPDATED', 'SOAP_LOADED_FOR_REVIEW', 'SOAP_SIGNED', 'SOAP_AMENDED'
));

DO $$
DECLARE user_id_type TEXT;
BEGIN
    SELECT data_type INTO user_id_type FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='users' AND column_name='id';
    IF user_id_type='integer' THEN
        ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
        ALTER TABLE audit_logs ALTER COLUMN user_id TYPE INTEGER USING user_id::integer;
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;
