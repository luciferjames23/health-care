BEGIN;
LOCK TABLE radiology_scan IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS radiology_scan_legacy_archive (
    scan_id INTEGER PRIMARY KEY,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    record JSONB NOT NULL
);
ALTER TABLE radiology_scan ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES radiology_orders(order_id);
UPDATE radiology_scan rs SET order_id=o.order_id,patient_id=o.patient_id,patient_code=p.patient_code
FROM radiology_orders o JOIN patients p ON p.id=o.patient_id
WHERE o.status='Uploaded' AND o.study_instance_uid=rs.original_patient_id;
INSERT INTO radiology_scan_legacy_archive(scan_id,reason,record)
SELECT scan_id,'Legacy test mapping or scan without an uploaded X-ray order',to_jsonb(rs)
FROM radiology_scan rs WHERE order_id IS NULL
ON CONFLICT (scan_id) DO NOTHING;
DELETE FROM radiology_scan WHERE order_id IS NULL;
ALTER TABLE radiology_scan ALTER COLUMN order_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS radiology_scan_order_id_idx ON radiology_scan(order_id);
COMMIT;
