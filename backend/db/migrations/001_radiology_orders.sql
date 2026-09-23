CREATE TABLE IF NOT EXISTS radiology_orders (
    order_id UUID PRIMARY KEY,
    accession_number VARCHAR(16) NOT NULL UNIQUE,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    requested_by BIGINT NOT NULL REFERENCES users(id),
    examination VARCHAR(120) NOT NULL,
    indication TEXT NOT NULL,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('Routine', 'Urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'Requested'
        CHECK (status IN ('Requested', 'Uploading', 'Uploaded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    upload_started_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ,
    uploaded_by BIGINT REFERENCES users(id),
    upload_sha256 VARCHAR(64),
    orthanc_instance_id TEXT,
    orthanc_study_id TEXT UNIQUE,
    study_instance_uid TEXT
);
CREATE INDEX IF NOT EXISTS radiology_orders_queue_idx ON radiology_orders(status, created_at);
CREATE INDEX IF NOT EXISTS radiology_orders_doctor_patient_idx ON radiology_orders(requested_by, patient_id);

CREATE UNIQUE INDEX IF NOT EXISTS radiology_orders_study_uid_idx ON radiology_orders(study_instance_uid) WHERE study_instance_uid IS NOT NULL;
