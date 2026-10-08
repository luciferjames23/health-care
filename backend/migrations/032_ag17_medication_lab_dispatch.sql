ALTER TABLE prescriptions
    ADD COLUMN IF NOT EXISTS source VARCHAR(24),
    ADD COLUMN IF NOT EXISTS source_soap_note_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_action_id UUID;

ALTER TABLE lab_orders
    ADD COLUMN IF NOT EXISTS source VARCHAR(24),
    ADD COLUMN IF NOT EXISTS source_soap_note_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_action_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'prescriptions'::regclass AND conname = 'prescriptions_source_soap_note_fk'
    ) THEN
        ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_source_soap_note_fk
            FOREIGN KEY (source_soap_note_id) REFERENCES soap_notes(soap_note_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'prescriptions'::regclass AND conname = 'prescriptions_source_action_fk'
    ) THEN
        ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_source_action_fk
            FOREIGN KEY (source_action_id) REFERENCES soap_clinical_actions(action_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'lab_orders'::regclass AND conname = 'lab_orders_source_soap_note_fk'
    ) THEN
        ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_source_soap_note_fk
            FOREIGN KEY (source_soap_note_id) REFERENCES soap_notes(soap_note_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'lab_orders'::regclass AND conname = 'lab_orders_source_action_fk'
    ) THEN
        ALTER TABLE lab_orders ADD CONSTRAINT lab_orders_source_action_fk
            FOREIGN KEY (source_action_id) REFERENCES soap_clinical_actions(action_id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_prescriptions_source_action
    ON prescriptions(source_action_id) WHERE source_action_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_lab_orders_source_action
    ON lab_orders(source_action_id) WHERE source_action_id IS NOT NULL;

ALTER TABLE soap_clinical_action_events
    DROP CONSTRAINT IF EXISTS soap_clinical_action_events_type_check;
ALTER TABLE soap_clinical_action_events
    ADD CONSTRAINT soap_clinical_action_events_type_check
    CHECK (event_type IN (
        'DETECTED', 'UPDATED', 'CONFIRMED', 'REJECTED',
        'DISPATCH_STARTED', 'CREATED', 'DISPATCH_FAILED', 'RETRY_SUCCEEDED'
    ));

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
            jsonb_build_object('soap_note_id', NEW.soap_note_id,
                               'action_type', NEW.action_type, 'intent', NEW.intent)
        );
        RETURN NEW;
    END IF;
    IF (to_jsonb(OLD) - 'updated_at') IS DISTINCT FROM (to_jsonb(NEW) - 'updated_at') THEN
        action_event_type := CASE
            WHEN NEW.status = 'CONFIRMED' AND OLD.status = 'FAILED' THEN 'UPDATED'
            WHEN NEW.status = 'CONFIRMED' AND OLD.status IS DISTINCT FROM NEW.status THEN 'CONFIRMED'
            WHEN NEW.status = 'REJECTED' AND OLD.status IS DISTINCT FROM NEW.status THEN 'REJECTED'
            WHEN NEW.status = 'FAILED' THEN 'DISPATCH_FAILED'
            WHEN NEW.status = 'CREATED' AND EXISTS (
                SELECT 1 FROM soap_clinical_action_events e
                WHERE e.action_id = OLD.action_id AND e.event_type = 'DISPATCH_FAILED'
            ) THEN 'RETRY_SUCCEEDED'
            WHEN NEW.status = 'CREATED' THEN 'CREATED'
            ELSE 'UPDATED'
        END;
        INSERT INTO soap_clinical_action_events(
            action_id, event_type, old_status, new_status, changed_by,
            old_values, new_values, event_data
        ) VALUES (
            NEW.action_id, action_event_type, OLD.status, NEW.status, actor_setting::integer,
            to_jsonb(OLD), to_jsonb(NEW),
            jsonb_build_object('soap_note_id', NEW.soap_note_id,
                               'target_module', NEW.target_module,
                               'target_record_id', NEW.target_record_id,
                               'error_message', NEW.error_message)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
