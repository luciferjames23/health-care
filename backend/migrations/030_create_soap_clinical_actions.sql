CREATE TABLE IF NOT EXISTS soap_clinical_actions (
    action_id UUID PRIMARY KEY,
    soap_note_id BIGINT NOT NULL REFERENCES soap_notes(soap_note_id) ON DELETE RESTRICT,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    visit_id INTEGER NOT NULL REFERENCES patient_visits(visit_id) ON DELETE RESTRICT,
    admission_id INTEGER NULL REFERENCES admissions(admission_id) ON DELETE RESTRICT,
    action_key VARCHAR(64) NOT NULL,
    action_type VARCHAR(32) NOT NULL CHECK (action_type IN (
        'MEDICATION_ORDER', 'LAB_ORDER', 'DIAGNOSTIC_ORDER', 'IMAGING_ORDER',
        'DIAGNOSIS_CANDIDATE', 'CLINICAL_FINDING', 'FOLLOW_UP', 'REFERRAL'
    )),
    intent VARCHAR(24) NOT NULL CHECK (intent IN (
        'CREATE_ORDER', 'DOCUMENT_FINDING', 'DOCUMENT_HISTORY', 'CONSIDER', 'FOLLOW_UP'
    )),
    name TEXT NOT NULL,
    code VARCHAR(80),
    dose NUMERIC,
    unit VARCHAR(40),
    route VARCHAR(80),
    frequency VARCHAR(120),
    duration VARCHAR(120),
    priority VARCHAR(24),
    source_text TEXT NOT NULL,
    confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    status VARCHAR(24) NOT NULL CHECK (status IN (
        'DETECTED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CREATED', 'REJECTED', 'FAILED'
    )),
    confirmed_by INTEGER NULL REFERENCES users(id) ON DELETE RESTRICT,
    confirmed_at TIMESTAMPTZ,
    target_module VARCHAR(80),
    target_record_id VARCHAR(160),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT soap_clinical_actions_note_key_unique UNIQUE (soap_note_id, action_key),
    CONSTRAINT soap_clinical_actions_confirmation_check CHECK (
        (confirmed_by IS NULL AND confirmed_at IS NULL)
        OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_soap_clinical_actions_note
    ON soap_clinical_actions(soap_note_id, created_at);
CREATE INDEX IF NOT EXISTS idx_soap_clinical_actions_patient_visit
    ON soap_clinical_actions(patient_id, visit_id);
CREATE INDEX IF NOT EXISTS idx_soap_clinical_actions_status
    ON soap_clinical_actions(status);
CREATE INDEX IF NOT EXISTS idx_soap_clinical_actions_target
    ON soap_clinical_actions(target_module, target_record_id);

CREATE TABLE IF NOT EXISTS soap_clinical_action_events (
    event_id BIGSERIAL PRIMARY KEY,
    action_id UUID NOT NULL REFERENCES soap_clinical_actions(action_id) ON DELETE RESTRICT,
    old_status VARCHAR(24),
    new_status VARCHAR(24) NOT NULL,
    changed_by INTEGER NULL REFERENCES users(id) ON DELETE RESTRICT,
    old_values JSONB,
    new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE soap_clinical_action_events ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE soap_clinical_action_events ADD COLUMN IF NOT EXISTS new_values JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_soap_clinical_action_events_action
    ON soap_clinical_action_events(action_id, created_at, event_id);

CREATE OR REPLACE FUNCTION record_soap_clinical_action_state()
RETURNS TRIGGER AS $$
DECLARE actor_setting TEXT;
BEGIN
    actor_setting := NULLIF(current_setting('app.user_id', true), '');
    IF actor_setting !~ '^[0-9]+$' THEN actor_setting := NULL; END IF;
    IF TG_OP = 'INSERT' THEN
        INSERT INTO soap_clinical_action_events(action_id, new_status, changed_by, new_values, event_data)
        VALUES (NEW.action_id, NEW.status, actor_setting::integer, to_jsonb(NEW),
                jsonb_build_object('action_type', NEW.action_type, 'intent', NEW.intent));
        RETURN NEW;
    END IF;
    IF (to_jsonb(OLD) - 'updated_at') IS DISTINCT FROM (to_jsonb(NEW) - 'updated_at') THEN
        INSERT INTO soap_clinical_action_events(action_id, old_status, new_status, changed_by, old_values, new_values, event_data)
        VALUES (NEW.action_id, OLD.status, NEW.status, actor_setting::integer, to_jsonb(OLD), to_jsonb(NEW),
                jsonb_build_object('target_module', NEW.target_module,
                                   'target_record_id', NEW.target_record_id,
                                   'error_message', NEW.error_message));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_soap_clinical_action_context()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM soap_notes n
        WHERE n.soap_note_id = NEW.soap_note_id
          AND n.patient_id = NEW.patient_id
          AND n.visit_id = NEW.visit_id
          AND n.admission_id IS NOT DISTINCT FROM NEW.admission_id
    ) THEN
        RAISE EXCEPTION 'SOAP action context must match its SOAP note';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_soap_clinical_action_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SOAP clinical action history is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_soap_clinical_action_context ON soap_clinical_actions;
CREATE TRIGGER trg_soap_clinical_action_context
BEFORE INSERT OR UPDATE OF soap_note_id, patient_id, visit_id, admission_id
ON soap_clinical_actions FOR EACH ROW EXECUTE FUNCTION validate_soap_clinical_action_context();

DROP TRIGGER IF EXISTS trg_soap_clinical_action_state ON soap_clinical_actions;
CREATE TRIGGER trg_soap_clinical_action_state
AFTER INSERT OR UPDATE ON soap_clinical_actions
FOR EACH ROW EXECUTE FUNCTION record_soap_clinical_action_state();

DROP TRIGGER IF EXISTS trg_soap_clinical_action_event_immutable ON soap_clinical_action_events;
CREATE TRIGGER trg_soap_clinical_action_event_immutable
BEFORE UPDATE OR DELETE ON soap_clinical_action_events
FOR EACH ROW EXECUTE FUNCTION prevent_soap_clinical_action_event_mutation();

CREATE OR REPLACE FUNCTION prevent_soap_clinical_action_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SOAP clinical actions are retained for provenance and idempotency';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_soap_clinical_action_immutable_delete ON soap_clinical_actions;
CREATE TRIGGER trg_soap_clinical_action_immutable_delete
BEFORE DELETE ON soap_clinical_actions
FOR EACH ROW EXECUTE FUNCTION prevent_soap_clinical_action_delete();
