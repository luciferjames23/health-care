-- Preserve the deployed audit action predicate and add the two clinical review events.
DO $$
DECLARE
    existing_expression TEXT;
    existing_definition TEXT;
    review_actions TEXT[] := ARRAY[
        'SOAP_CLINICAL_MISMATCH_DETECTED',
        'SOAP_CLINICAL_MISMATCH_RESOLVED'
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
              FROM unnest(review_actions) AS action) THEN
        ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check;
        EXECUTE format(
            'ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK ((%s) OR (action IN (%s))) NOT VALID',
            existing_expression,
            (SELECT string_agg(quote_literal(action), ', ')
               FROM unnest(review_actions) AS action)
        );
    END IF;
END $$;
