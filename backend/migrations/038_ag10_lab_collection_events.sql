CREATE TABLE IF NOT EXISTS lab_specimen_collection_events (
    event_id BIGSERIAL PRIMARY KEY,
    lab_order_id BIGINT NOT NULL REFERENCES lab_orders(lab_order_id) ON DELETE RESTRICT,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    collection_state VARCHAR(32) NOT NULL CHECK (
        collection_state IN ('COLLECTED', 'NOT_COLLECTED', 'UNABLE_TO_COLLECT')
    ),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_role VARCHAR(50) NOT NULL CHECK (LOWER(actor_role) = 'laboratory'),
    actor_name VARCHAR(150) NOT NULL,
    source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('MANUAL_LAB_ENTRY'))
);

CREATE INDEX IF NOT EXISTS idx_lab_specimen_collection_latest
    ON lab_specimen_collection_events(lab_order_id, recorded_at DESC, event_id DESC);

CREATE OR REPLACE FUNCTION prevent_lab_specimen_collection_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Lab specimen collection events are append-only; record a correction as a new event.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lab_specimen_collection_events_immutable
    ON lab_specimen_collection_events;
CREATE TRIGGER trg_lab_specimen_collection_events_immutable
BEFORE UPDATE OR DELETE ON lab_specimen_collection_events
FOR EACH ROW EXECUTE FUNCTION prevent_lab_specimen_collection_event_mutation();

DROP TRIGGER IF EXISTS trg_lab_specimen_collection_events_no_truncate
    ON lab_specimen_collection_events;
CREATE TRIGGER trg_lab_specimen_collection_events_no_truncate
BEFORE TRUNCATE ON lab_specimen_collection_events
FOR EACH STATEMENT EXECUTE FUNCTION prevent_lab_specimen_collection_event_mutation();
