-- Isolated AG-10 critical alert lifecycle. Lab result/order data stays untouched.
CREATE TABLE IF NOT EXISTS lab_critical_alerts (
    alert_id BIGSERIAL PRIMARY KEY,
    evaluation_event_id BIGINT NOT NULL UNIQUE REFERENCES lab_critical_evaluation_events(evaluation_event_id) ON DELETE RESTRICT,
    lab_result_id INTEGER NOT NULL REFERENCES lab_results(lab_result_id) ON DELETE RESTRICT,
    lab_order_id BIGINT NOT NULL REFERENCES lab_orders(lab_order_id) ON DELETE RESTRICT,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    rule_id BIGINT NOT NULL REFERENCES lab_critical_rules(rule_id) ON DELETE RESTRICT,
    rule_version INTEGER NOT NULL CHECK (rule_version > 0),
    parameter_snapshot VARCHAR(255),
    result_value_snapshot TEXT,
    unit_snapshot VARCHAR(64),
    normalized_verified_result_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','CLOSED')),
    recipient_resolution_status VARCHAR(16) NOT NULL CHECK (recipient_resolution_status IN ('RESOLVED','UNRESOLVED'))
);
CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_status_created ON lab_critical_alerts(status, created_at DESC, alert_id DESC);
CREATE INDEX IF NOT EXISTS idx_lab_critical_alerts_patient_created ON lab_critical_alerts(patient_id, created_at DESC, alert_id DESC);

CREATE OR REPLACE FUNCTION validate_lab_critical_alert_source()
RETURNS TRIGGER AS $$
DECLARE
    source_row RECORD;
BEGIN
    SELECT ev.outcome, ev.lab_result_id, ev.rule_id, ev.rule_version,
           ev.parameter_name, ev.result_value_text, ev.unit, ev.normalized_result_instant,
           lr.lab_order_id AS result_order_id, lr.patient_id AS result_patient_id,
           lo.patient_id AS order_patient_id
      INTO source_row
      FROM lab_critical_evaluation_events ev
      JOIN lab_results lr ON lr.lab_result_id=ev.lab_result_id
      JOIN lab_orders lo ON lo.lab_order_id=lr.lab_order_id
      JOIN patients p ON p.id=lr.patient_id
     WHERE ev.evaluation_event_id=NEW.evaluation_event_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'A Lab critical alert requires a valid evaluation event';
    END IF;
    IF source_row.outcome <> 'CRITICAL_MATCH' THEN
        RAISE EXCEPTION 'A Lab critical alert requires a CRITICAL_MATCH evaluation event';
    END IF;
    IF NEW.status <> 'OPEN'
       OR NEW.lab_result_id IS DISTINCT FROM source_row.lab_result_id
       OR NEW.lab_order_id IS DISTINCT FROM source_row.result_order_id
       OR NEW.patient_id IS DISTINCT FROM source_row.result_patient_id
       OR source_row.order_patient_id IS DISTINCT FROM source_row.result_patient_id
       OR NEW.rule_id IS DISTINCT FROM source_row.rule_id
       OR NEW.rule_version IS DISTINCT FROM source_row.rule_version
       OR NEW.parameter_snapshot IS DISTINCT FROM source_row.parameter_name
       OR NEW.result_value_snapshot IS DISTINCT FROM source_row.result_value_text
       OR NEW.unit_snapshot IS DISTINCT FROM source_row.unit
       OR NEW.normalized_verified_result_time IS DISTINCT FROM source_row.normalized_result_instant THEN
        RAISE EXCEPTION 'Lab critical alert linkage or snapshot does not match its source event';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_lab_critical_alert_source ON lab_critical_alerts;
CREATE TRIGGER trg_validate_lab_critical_alert_source
BEFORE INSERT ON lab_critical_alerts
FOR EACH ROW EXECUTE FUNCTION validate_lab_critical_alert_source();

CREATE TABLE IF NOT EXISTS lab_critical_alert_recipients (
    alert_id BIGINT NOT NULL REFERENCES lab_critical_alerts(alert_id) ON DELETE RESTRICT,
    recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role_snapshot VARCHAR(50) NOT NULL,
    recipient_type VARCHAR(32) NOT NULL CHECK (recipient_type IN ('ORDERING_DOCTOR')),
    assignment_source VARCHAR(64) NOT NULL CHECK (assignment_source IN ('LAB_ORDER_DOCTOR_MAPPING')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (alert_id, recipient_user_id, recipient_type)
);
CREATE INDEX IF NOT EXISTS idx_lab_critical_alert_recipients_user ON lab_critical_alert_recipients(recipient_user_id, alert_id);

CREATE TABLE IF NOT EXISTS lab_critical_alert_lifecycle_events (
    lifecycle_event_id BIGSERIAL PRIMARY KEY,
    alert_id BIGINT NOT NULL REFERENCES lab_critical_alerts(alert_id) ON DELETE RESTRICT,
    event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('OPENED','ACKNOWLEDGED','CLOSED')),
    actor_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    actor_role VARCHAR(64) NOT NULL,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closure_reason TEXT,
    CONSTRAINT lab_critical_alert_lifecycle_reason_ck CHECK (
        (event_type='CLOSED' AND closure_reason IS NOT NULL AND LENGTH(BTRIM(closure_reason))>0)
        OR (event_type<>'CLOSED' AND closure_reason IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_lab_critical_alert_events_latest ON lab_critical_alert_lifecycle_events(alert_id, server_timestamp DESC, lifecycle_event_id DESC);

CREATE OR REPLACE FUNCTION prevent_lab_critical_alert_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Lab critical alert history and recipient assignments are append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lab_critical_alert_events_immutable ON lab_critical_alert_lifecycle_events;
CREATE TRIGGER trg_lab_critical_alert_events_immutable BEFORE UPDATE OR DELETE ON lab_critical_alert_lifecycle_events FOR EACH ROW EXECUTE FUNCTION prevent_lab_critical_alert_append_only();
DROP TRIGGER IF EXISTS trg_lab_critical_alert_events_no_truncate ON lab_critical_alert_lifecycle_events;
CREATE TRIGGER trg_lab_critical_alert_events_no_truncate BEFORE TRUNCATE ON lab_critical_alert_lifecycle_events FOR EACH STATEMENT EXECUTE FUNCTION prevent_lab_critical_alert_append_only();
DROP TRIGGER IF EXISTS trg_lab_critical_alert_recipients_immutable ON lab_critical_alert_recipients;
CREATE TRIGGER trg_lab_critical_alert_recipients_immutable BEFORE UPDATE OR DELETE ON lab_critical_alert_recipients FOR EACH ROW EXECUTE FUNCTION prevent_lab_critical_alert_append_only();
DROP TRIGGER IF EXISTS trg_lab_critical_alert_recipients_no_truncate ON lab_critical_alert_recipients;
CREATE TRIGGER trg_lab_critical_alert_recipients_no_truncate BEFORE TRUNCATE ON lab_critical_alert_recipients FOR EACH STATEMENT EXECUTE FUNCTION prevent_lab_critical_alert_append_only();

CREATE OR REPLACE FUNCTION guard_lab_critical_alert_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Lab critical alerts cannot be deleted'; END IF;
    IF (to_jsonb(NEW)-'status') <> (to_jsonb(OLD)-'status') THEN
        RAISE EXCEPTION 'Lab critical alert linkage and snapshots are immutable';
    END IF;
    IF NOT ((OLD.status='OPEN' AND NEW.status='ACKNOWLEDGED') OR (OLD.status='ACKNOWLEDGED' AND NEW.status='CLOSED')) THEN
        RAISE EXCEPTION 'Invalid Lab critical alert state transition';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_lab_critical_alert_transition ON lab_critical_alerts;
CREATE TRIGGER trg_lab_critical_alert_transition BEFORE UPDATE OR DELETE ON lab_critical_alerts FOR EACH ROW EXECUTE FUNCTION guard_lab_critical_alert_transition();
DROP TRIGGER IF EXISTS trg_lab_critical_alert_no_truncate ON lab_critical_alerts;
CREATE TRIGGER trg_lab_critical_alert_no_truncate BEFORE TRUNCATE ON lab_critical_alerts FOR EACH STATEMENT EXECUTE FUNCTION prevent_lab_critical_alert_append_only();
