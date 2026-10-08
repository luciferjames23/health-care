-- Mark PoC-generated laboratory results and extend the audit allow-list safely.
ALTER TABLE lab_results
    ADD COLUMN IF NOT EXISTS result_source VARCHAR(32);

DO $$
DECLARE
    existing_expression TEXT;
    existing_definition TEXT;
    lab_actions TEXT[] := ARRAY[
        'LAB_DEMO_RESULT_GENERATED',
        'LAB_ORDER_COMPLETED'
    ];
BEGIN
    SELECT pg_get_expr(conbin, conrelid), pg_get_constraintdef(oid)
      INTO existing_expression, existing_definition
      FROM pg_constraint
     WHERE conrelid = 'audit_logs'::regclass
       AND conname = 'audit_logs_action_check'
       AND contype = 'c';

    IF existing_expression IS NULL THEN
        RAISE EXCEPTION 'audit_logs_action_check was not found; refusing to replace an unknown audit allow-list';
    END IF;

    IF NOT (SELECT bool_and(position(quote_literal(action) IN existing_definition) > 0)
              FROM unnest(lab_actions) AS action) THEN
        ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check;
        EXECUTE format(
            'ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK ((%s) OR (action IN (%s))) NOT VALID',
            existing_expression,
            (SELECT string_agg(quote_literal(action), ', ')
               FROM unnest(lab_actions) AS action)
        );
    END IF;
END $$;
