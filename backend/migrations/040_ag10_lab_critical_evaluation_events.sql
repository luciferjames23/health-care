-- AG-10 evaluator persistence and explicit range operators.
-- Does not update lab_results/lab_orders or create alerts/notifications.

ALTER TABLE lab_critical_rules
    ALTER COLUMN operator TYPE VARCHAR(16);

ALTER TABLE lab_critical_rules
    DROP CONSTRAINT IF EXISTS lab_critical_rules_operator_bounds_ck;
ALTER TABLE lab_critical_rules
    DROP CONSTRAINT IF EXISTS lab_critical_rules_operator_check;

-- NOT VALID preserves any legacy BETWEEN drafts without converting them.
-- The constraint is enforced for every new or updated row. Such drafts must
-- be superseded by a new version using an explicit range operator.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid='lab_critical_rules'::regclass
           AND conname='lab_critical_rules_operator_bounds_v2_ck'
    ) THEN
        ALTER TABLE lab_critical_rules
            ADD CONSTRAINT lab_critical_rules_operator_bounds_v2_ck CHECK (
                (operator IN ('LT','LTE','GT','GTE','EQ')
                    AND threshold_value IS NOT NULL
                    AND lower_critical_bound IS NULL AND upper_critical_bound IS NULL)
                OR
                (operator IN ('INSIDE_RANGE','OUTSIDE_RANGE')
                    AND threshold_value IS NULL
                    AND lower_critical_bound IS NOT NULL AND upper_critical_bound IS NOT NULL
                    AND lower_critical_bound <= upper_critical_bound)
            ) NOT VALID;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS lab_critical_evaluation_events (
    evaluation_event_id BIGSERIAL PRIMARY KEY,
    lab_result_id INTEGER NOT NULL REFERENCES lab_results(lab_result_id) ON DELETE RESTRICT,
    rule_id BIGINT REFERENCES lab_critical_rules(rule_id) ON DELETE RESTRICT,
    rule_version INTEGER,
    candidate_rules JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(candidate_rules)='array'),
    parameter_name VARCHAR(255),
    test_identifier VARCHAR(100),
    result_value_text TEXT,
    unit VARCHAR(64),
    numeric_value NUMERIC,
    outcome VARCHAR(24) NOT NULL CHECK (outcome IN (
        'NO_CONFIGURED_RULE','AMBIGUOUS_RULE','NOT_EVALUABLE','NOT_CRITICAL','CRITICAL_MATCH'
    )),
    reason_code VARCHAR(64) NOT NULL,
    original_result_timestamp TIMESTAMP WITHOUT TIME ZONE,
    normalized_result_instant TIMESTAMPTZ,
    timezone_used VARCHAR(64) NOT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    result_fingerprint CHAR(64) NOT NULL,
    rule_set_fingerprint CHAR(64) NOT NULL,
    evaluator_version VARCHAR(40) NOT NULL,
    provenance JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(provenance)='object'),
    idempotency_key CHAR(64) NOT NULL UNIQUE,
    CONSTRAINT lab_critical_eval_rule_version_pair_ck
        CHECK ((rule_id IS NULL AND rule_version IS NULL) OR (rule_id IS NOT NULL AND rule_version IS NOT NULL)),
    CONSTRAINT lab_critical_eval_numeric_finite_ck
        CHECK (numeric_value IS NULL OR numeric_value::TEXT NOT IN ('NaN','Infinity','-Infinity')),
    CONSTRAINT lab_critical_eval_idempotency_uq
        UNIQUE (lab_result_id, result_fingerprint, rule_set_fingerprint, evaluator_version)
);

CREATE INDEX IF NOT EXISTS idx_lab_critical_eval_result_time
    ON lab_critical_evaluation_events (lab_result_id, evaluated_at DESC, evaluation_event_id DESC);
CREATE INDEX IF NOT EXISTS idx_lab_critical_eval_outcome_time
    ON lab_critical_evaluation_events (outcome, evaluated_at DESC);

CREATE OR REPLACE FUNCTION prevent_lab_critical_evaluation_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Lab critical evaluation events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lab_critical_eval_no_update_delete ON lab_critical_evaluation_events;
CREATE TRIGGER trg_lab_critical_eval_no_update_delete
BEFORE UPDATE OR DELETE ON lab_critical_evaluation_events
FOR EACH ROW EXECUTE FUNCTION prevent_lab_critical_evaluation_event_mutation();

DROP TRIGGER IF EXISTS trg_lab_critical_eval_no_truncate ON lab_critical_evaluation_events;
CREATE TRIGGER trg_lab_critical_eval_no_truncate
BEFORE TRUNCATE ON lab_critical_evaluation_events
FOR EACH STATEMENT EXECUTE FUNCTION prevent_lab_critical_evaluation_event_mutation();

CREATE TABLE IF NOT EXISTS lab_critical_evaluator_state (
    state_id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (state_id=1),
    poll_cursor BIGINT NOT NULL DEFAULT 0 CHECK (poll_cursor >= 0),
    reconcile_cursor BIGINT NOT NULL DEFAULT 0 CHECK (reconcile_cursor >= 0),
    last_reconciled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO lab_critical_evaluator_state (state_id) VALUES (1) ON CONFLICT (state_id) DO NOTHING;

