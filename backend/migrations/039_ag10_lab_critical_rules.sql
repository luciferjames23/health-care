-- AG-10 critical-result rule catalog. This migration adds configuration only;
-- it does not evaluate Lab results or alter existing Lab data/workflows.

-- The existing roles table does not enforce uniqueness on name, and its
-- description column is limited to 50 characters. Seed only missing roles
-- without changing existing role rows or constraints.
INSERT INTO roles (name, description)
SELECT requested.name, requested.description
FROM (VALUES
    ('LAB RULE AUTHOR', 'Draft and submit Lab rules.'),
    ('LAB RULE APPROVER', 'Approve, reject, and retire Lab rules.')
) AS requested(name, description)
WHERE NOT EXISTS (
    SELECT 1
    FROM roles existing
    WHERE existing.name = requested.name
);

CREATE TABLE IF NOT EXISTS lab_critical_rules (
    rule_id BIGSERIAL PRIMARY KEY,
    parameter_name VARCHAR(255) NOT NULL,
    test_identifier VARCHAR(100),
    unit VARCHAR(64) NOT NULL,
    operator VARCHAR(8) NOT NULL CHECK (operator IN ('LT', 'LTE', 'GT', 'GTE', 'EQ', 'BETWEEN')),
    threshold_value NUMERIC,
    lower_critical_bound NUMERIC,
    upper_critical_bound NUMERIC,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    rule_version INTEGER NOT NULL CHECK (rule_version > 0),
    approval_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT'
        CHECK (approval_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'RETIRED')),
    approved_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ,
    created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_provenance TEXT NOT NULL,
    change_reason TEXT NOT NULL,
    decision_reason TEXT,
    CONSTRAINT lab_critical_rules_effective_range_ck
        CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT lab_critical_rules_operator_bounds_ck CHECK (
        (operator = 'BETWEEN' AND threshold_value IS NULL
            AND lower_critical_bound IS NOT NULL AND upper_critical_bound IS NOT NULL
            AND lower_critical_bound <= upper_critical_bound)
        OR
        (operator <> 'BETWEEN' AND threshold_value IS NOT NULL
            AND lower_critical_bound IS NULL AND upper_critical_bound IS NULL)
    ),
    CONSTRAINT lab_critical_rules_finite_values_ck CHECK (
        (threshold_value IS NULL OR threshold_value::TEXT NOT IN ('NaN', 'Infinity', '-Infinity'))
        AND (lower_critical_bound IS NULL OR lower_critical_bound::TEXT NOT IN ('NaN', 'Infinity', '-Infinity'))
        AND (upper_critical_bound IS NULL OR upper_critical_bound::TEXT NOT IN ('NaN', 'Infinity', '-Infinity'))
    ),
    CONSTRAINT lab_critical_rules_approval_metadata_ck CHECK (
        (approval_status IN ('APPROVED', 'RETIRED') AND approved_by IS NOT NULL AND approved_at IS NOT NULL AND approved_by <> created_by)
        OR (approval_status NOT IN ('APPROVED', 'RETIRED') AND approved_by IS NULL AND approved_at IS NULL)
    ),
    CONSTRAINT lab_critical_rules_version_uq UNIQUE (parameter_name, unit, rule_version)
);

CREATE INDEX IF NOT EXISTS idx_lab_critical_rules_lookup
    ON lab_critical_rules (LOWER(parameter_name), unit, approval_status, is_active, effective_from, effective_to);

CREATE OR REPLACE FUNCTION guard_lab_critical_rule_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Lab critical rule versions cannot be deleted';
    END IF;

    IF OLD.approval_status = 'DRAFT' THEN
        IF NEW.approval_status NOT IN ('DRAFT', 'PENDING_APPROVAL') THEN
            RAISE EXCEPTION 'Draft rules must be submitted before a governance decision';
        END IF;
        IF NEW.approval_status = 'PENDING_APPROVAL'
           AND (to_jsonb(NEW) - ARRAY['approval_status'])
               <> (to_jsonb(OLD) - ARRAY['approval_status']) THEN
            RAISE EXCEPTION 'Rule content cannot change during submission';
        END IF;
    ELSE
        IF OLD.approval_status = 'PENDING_APPROVAL'
           AND NEW.approval_status IN ('APPROVED', 'REJECTED') THEN
            IF (to_jsonb(NEW) - ARRAY['approval_status','approved_by','approved_at','decision_reason'])
               <> (to_jsonb(OLD) - ARRAY['approval_status','approved_by','approved_at','decision_reason']) THEN
                RAISE EXCEPTION 'Submitted Lab critical rule content is immutable';
            END IF;
        ELSIF OLD.approval_status = 'APPROVED' AND NEW.approval_status = 'RETIRED' THEN
            IF NEW.is_active OR (to_jsonb(NEW) - ARRAY['approval_status','is_active'])
               <> (to_jsonb(OLD) - ARRAY['approval_status','is_active']) THEN
                RAISE EXCEPTION 'Approved Lab critical rule content is immutable';
            END IF;
        ELSE
            RAISE EXCEPTION 'Submitted or decided Lab critical rule versions are immutable';
        END IF;
    END IF;

    IF NEW.approval_status = 'APPROVED' THEN
        -- Serialize approvals for a parameter/unit so concurrent approvals
        -- cannot both pass the overlap check.
        PERFORM pg_advisory_xact_lock(hashtext(LOWER(NEW.parameter_name)), hashtext(NEW.unit));
        IF EXISTS (
            SELECT 1
              FROM lab_critical_rules existing
             WHERE existing.rule_id <> NEW.rule_id
               AND existing.approval_status = 'APPROVED'
               AND LOWER(existing.parameter_name) = LOWER(NEW.parameter_name)
               AND existing.unit = NEW.unit
               AND NEW.effective_from < COALESCE(existing.effective_to, 'infinity'::timestamptz)
               AND existing.effective_from < COALESCE(NEW.effective_to, 'infinity'::timestamptz)
        ) THEN
            RAISE EXCEPTION 'An approved Lab critical rule already overlaps this parameter/unit interval';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_lab_critical_rule_mutation ON lab_critical_rules;
CREATE TRIGGER trg_guard_lab_critical_rule_mutation
BEFORE UPDATE OR DELETE ON lab_critical_rules
FOR EACH ROW EXECUTE FUNCTION guard_lab_critical_rule_mutation();
