ALTER TABLE soap_clinical_actions
    ADD COLUMN IF NOT EXISTS transcript_fingerprint VARCHAR(64);

ALTER TABLE soap_clinical_action_events
    ADD COLUMN IF NOT EXISTS event_type VARCHAR(24) NOT NULL DEFAULT 'UPDATED';

UPDATE soap_clinical_action_events
SET event_type = CASE
    WHEN old_status IS NULL THEN 'DETECTED'
    WHEN new_status = 'CONFIRMED' AND old_status IS DISTINCT FROM new_status THEN 'CONFIRMED'
    WHEN new_status = 'REJECTED' AND old_status IS DISTINCT FROM new_status THEN 'REJECTED'
    ELSE 'UPDATED'
END
WHERE event_type = 'UPDATED';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'soap_clinical_action_events'::regclass
          AND conname = 'soap_clinical_action_events_type_check'
    ) THEN
        ALTER TABLE soap_clinical_action_events
            ADD CONSTRAINT soap_clinical_action_events_type_check
            CHECK (event_type IN ('DETECTED', 'UPDATED', 'CONFIRMED', 'REJECTED'));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION record_soap_clinical_action_state()
RETURNS TRIGGER AS $$
DECLARE actor_setting TEXT;
DECLARE action_event_type TEXT;
BEGIN
    actor_setting := NULLIF(current_setting('app.user_id', true), '');
    IF actor_setting !~ '^[0-9]+$' THEN actor_setting := NULL; END IF;
    IF TG_OP = 'INSERT' THEN
        INSERT INTO soap_clinical_action_events(
            action_id, event_type, new_status, changed_by, new_values, event_data
        ) VALUES (
            NEW.action_id, 'DETECTED', NEW.status, actor_setting::integer, to_jsonb(NEW),
            jsonb_build_object('action_type', NEW.action_type, 'intent', NEW.intent)
        );
        RETURN NEW;
    END IF;
    IF (to_jsonb(OLD) - 'updated_at') IS DISTINCT FROM (to_jsonb(NEW) - 'updated_at') THEN
        action_event_type := CASE
            WHEN NEW.status = 'CONFIRMED' AND OLD.status IS DISTINCT FROM NEW.status THEN 'CONFIRMED'
            WHEN NEW.status = 'REJECTED' AND OLD.status IS DISTINCT FROM NEW.status THEN 'REJECTED'
            ELSE 'UPDATED'
        END;
        INSERT INTO soap_clinical_action_events(
            action_id, event_type, old_status, new_status, changed_by, old_values, new_values, event_data
        ) VALUES (
            NEW.action_id, action_event_type, OLD.status, NEW.status, actor_setting::integer,
            to_jsonb(OLD), to_jsonb(NEW),
            jsonb_build_object('target_module', NEW.target_module,
                               'target_record_id', NEW.target_record_id,
                               'error_message', NEW.error_message)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
