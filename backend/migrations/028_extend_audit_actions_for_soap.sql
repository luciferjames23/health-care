-- Extend the deployed action constraint without replacing its existing allow-list.
-- The original predicate is read from PostgreSQL and retained verbatim, then SOAP
-- actions are added. NOT VALID preserves the current constraint's validation state
-- while still enforcing the expanded predicate on new/updated rows.
DO $$
DECLARE
    existing_expression TEXT;
    existing_definition TEXT;
    soap_actions TEXT[] := ARRAY[
        'SOAP_CREATED',
        'SOAP_TRANSCRIPTION_CREATED',
        'SOAP_AI_DRAFT_GENERATED',
        'SOAP_DRAFT_SAVED',
        'SOAP_DRAFT_UPDATED',
        'SOAP_LOADED_FOR_REVIEW',
        'SOAP_SIGNED',
        'SOAP_AMENDED'
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
              FROM unnest(soap_actions) AS action) THEN
        ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check;
        EXECUTE format(
            'ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK ((%s) OR (action IN (%s))) NOT VALID',
            existing_expression,
            (SELECT string_agg(quote_literal(action), ', ')
               FROM unnest(soap_actions) AS action)
        );
    END IF;
END $$;
