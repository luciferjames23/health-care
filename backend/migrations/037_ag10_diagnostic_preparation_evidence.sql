CREATE TABLE IF NOT EXISTS diagnostic_preparation_evidence (
    evidence_id BIGSERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES radiology_orders(order_id) ON DELETE RESTRICT,
    assertion VARCHAR(24) NOT NULL CHECK (
        assertion IN ('CONFIRMED', 'NOT_CONFIRMED', 'UNABLE_TO_CONFIRM')
    ),
    last_meal_at TIMESTAMPTZ,
    fasting_started_at TIMESTAMPTZ,
    source_type VARCHAR(32) NOT NULL CHECK (
        source_type IN ('PATIENT_REPORT', 'CAREGIVER_REPORT', 'CHART_REVIEW', 'OTHER')
    ),
    recorded_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    recorded_by_role VARCHAR(50) NOT NULL,
    recorded_by_name VARCHAR(150) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT diagnostic_preparation_confirmed_time_check CHECK (
        assertion <> 'CONFIRMED' OR last_meal_at IS NOT NULL OR fasting_started_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_preparation_order_latest
    ON diagnostic_preparation_evidence(order_id, recorded_at DESC, evidence_id DESC);

CREATE OR REPLACE FUNCTION prevent_diagnostic_preparation_evidence_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Diagnostic preparation evidence is append-only; record a correction as a new entry.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_diagnostic_preparation_evidence_immutable
    ON diagnostic_preparation_evidence;
CREATE TRIGGER trg_diagnostic_preparation_evidence_immutable
BEFORE UPDATE OR DELETE ON diagnostic_preparation_evidence
FOR EACH ROW EXECUTE FUNCTION prevent_diagnostic_preparation_evidence_mutation();

DROP TRIGGER IF EXISTS trg_diagnostic_preparation_evidence_no_truncate
    ON diagnostic_preparation_evidence;
CREATE TRIGGER trg_diagnostic_preparation_evidence_no_truncate
BEFORE TRUNCATE ON diagnostic_preparation_evidence
FOR EACH STATEMENT EXECUTE FUNCTION prevent_diagnostic_preparation_evidence_mutation();
