-- Make service_price_master the canonical tariff source for Lab and X-ray lines.
-- Existing Lab catalog tariffs seed missing service master rows; existing prices are retained.
CREATE TABLE IF NOT EXISTS service_billing_migration_state (
    migration_key VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO service_price_master(service_code,service_name,department,service_type,view,amount,currency,active)
SELECT mapped.service_code, mapped.test_name, 'Laboratory', 'LAB', NULL,
       mapped.amount, 'INR', TRUE
FROM (
    SELECT DISTINCT ON (service_code) service_code, test_name, amount
    FROM (
        SELECT CASE
                 WHEN upper(test_code) IN ('CBC','CBC-01','LAB-01')
                   OR lower(trim(test_name)) IN ('cbc','complete blood count','complete blood count (cbc)')
                   THEN 'LAB-CBC'
                 WHEN upper(test_code) LIKE 'LAB-%' THEN upper(test_code)
                 ELSE 'LAB-' || upper(test_code)
               END AS service_code,
               test_name, standard_charge AS amount, lab_test_id
        FROM lab_tests
        WHERE lower(COALESCE(status,'active'))='active'
          AND standard_charge IS NOT NULL AND standard_charge >= 0
          AND NULLIF(trim(test_code),'') IS NOT NULL
    ) candidates
    ORDER BY service_code,lab_test_id
) mapped
ON CONFLICT(service_code) DO NOTHING;

-- The old Lab tariff for both CBC catalog aliases is ₹450. Promote that existing
-- configured tariff once, while allowing future master changes to remain effective.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM service_billing_migration_state WHERE migration_key='043_cbc_tariff_promoted') THEN
        UPDATE service_price_master
           SET amount=(SELECT MAX(standard_charge) FROM lab_tests
                        WHERE upper(test_code) IN ('LAB-01','LAB-CBC')
                           OR lower(trim(test_name)) IN ('cbc','complete blood count','complete blood count (cbc)')),
               updated_at=CURRENT_TIMESTAMP
         WHERE service_code='LAB-CBC'
           AND EXISTS (SELECT 1 FROM lab_tests WHERE standard_charge IS NOT NULL AND
                       (upper(test_code) IN ('LAB-01','LAB-CBC') OR lower(trim(test_name)) IN ('cbc','complete blood count','complete blood count (cbc)')));
        UPDATE patient_charges pc
           SET amount=spm.amount,updated_at=CURRENT_TIMESTAMP
          FROM service_price_master spm
         WHERE pc.service_code='LAB-CBC' AND pc.billing_status='PENDING'
           AND spm.service_code=pc.service_code AND pc.amount<>spm.amount;
        INSERT INTO service_billing_migration_state(migration_key) VALUES ('043_cbc_tariff_promoted');
    END IF;
END $$;
