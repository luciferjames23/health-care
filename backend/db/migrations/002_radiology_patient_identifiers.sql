CREATE TABLE IF NOT EXISTS radiology_patient_identifiers (
    dicom_patient_id TEXT PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    verified_by BIGINT NOT NULL REFERENCES users(id),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    order_id UUID NOT NULL REFERENCES radiology_orders(order_id),
    upload_sha256 VARCHAR(64) NOT NULL,
    dicom_patient_name TEXT,
    dicom_patient_birth_date TEXT
);
