BEGIN;
LOCK TABLE radiology_orders, radiology_scan IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS radiology_order_studies (
    study_key UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES radiology_orders(order_id),
    projection VARCHAR(2) NOT NULL CHECK (projection IN ('PA','AP')),
    status VARCHAR(20) NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested','Uploading','Uploaded')),
    upload_started_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ,
    uploaded_by BIGINT REFERENCES users(id),
    upload_sha256 VARCHAR(64),
    orthanc_instance_id TEXT UNIQUE,
    orthanc_study_id TEXT UNIQUE,
    study_instance_uid TEXT UNIQUE,
    UNIQUE(order_id, projection)
);
INSERT INTO radiology_order_studies
    (study_key,order_id,projection,status,upload_started_at,uploaded_at,uploaded_by,
     upload_sha256,orthanc_instance_id,orthanc_study_id,study_instance_uid)
SELECT order_id,order_id,CASE WHEN examination='Chest X-ray AP' THEN 'AP'
    WHEN examination IN ('Chest X-ray PA & AP (Both Views)','Chest X-ray PA + AP') THEN
        COALESCE((SELECT NULLIF(s.dl_response::jsonb->'metadata'->>'view_position','')
                  FROM radiology_scan s WHERE s.order_id=radiology_orders.order_id LIMIT 1),'PA')
    ELSE 'PA' END,
    status,upload_started_at,uploaded_at,uploaded_by,upload_sha256,orthanc_instance_id,orthanc_study_id,study_instance_uid
FROM radiology_orders WHERE NOT EXISTS
    (SELECT 1 FROM radiology_order_studies a WHERE a.order_id=radiology_orders.order_id)
ON CONFLICT DO NOTHING;
UPDATE radiology_orders SET examination='Chest X-ray PA + AP'
WHERE examination='Chest X-ray PA & AP (Both Views)';
INSERT INTO radiology_order_studies(study_key,order_id,projection)
SELECT md5(o.order_id::text || ':' || v.projection)::uuid,o.order_id,v.projection
FROM radiology_orders o CROSS JOIN (VALUES ('PA'),('AP')) v(projection)
WHERE o.examination='Chest X-ray PA + AP'
ON CONFLICT (order_id,projection) DO NOTHING;
UPDATE radiology_orders o SET status='Requested'
WHERE o.examination='Chest X-ray PA + AP' AND EXISTS
    (SELECT 1 FROM radiology_order_studies a WHERE a.order_id=o.order_id AND a.status<>'Uploaded');
ALTER TABLE radiology_scan ADD COLUMN IF NOT EXISTS order_study_id UUID REFERENCES radiology_order_studies(study_key);
UPDATE radiology_scan SET order_study_id=order_id WHERE order_study_id IS NULL;
-- Retain unlinked historical scans. All order-linked results require a study.
ALTER TABLE radiology_scan DROP CONSTRAINT IF EXISTS radiology_scan_order_study_required;
ALTER TABLE radiology_scan ADD CONSTRAINT radiology_scan_order_study_required
    CHECK (order_id IS NULL OR order_study_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS radiology_scan_order_study_idx ON radiology_scan(order_study_id);
DROP INDEX IF EXISTS radiology_scan_order_id_idx;
COMMIT;
