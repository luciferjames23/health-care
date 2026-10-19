-- Additive service billing for Lab and X-ray orders. Historical orders are not backfilled.
CREATE TABLE IF NOT EXISTS service_price_master (
    id BIGSERIAL PRIMARY KEY,
    service_code VARCHAR(80) NOT NULL UNIQUE,
    service_name VARCHAR(200) NOT NULL,
    department VARCHAR(80) NOT NULL,
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('LAB','XRAY')),
    view VARCHAR(10),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((service_type='LAB' AND view IS NULL) OR (service_type='XRAY' AND view IN ('PA','AP')))
);

CREATE TABLE IF NOT EXISTS patient_charges (
    id BIGSERIAL PRIMARY KEY,
    patient_id INT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    visit_id BIGINT,
    admission_id BIGINT,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('LAB','XRAY')),
    source_order_id VARCHAR(100) NOT NULL,
    service_code VARCHAR(80) NOT NULL REFERENCES service_price_master(service_code) ON DELETE RESTRICT,
    service_name VARCHAR(200) NOT NULL,
    view VARCHAR(10),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    billing_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
      CHECK (billing_status IN ('PENDING','BILLED','CANCELLED','WAIVED')),
    source VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_type, source_order_id, service_code)
);
CREATE INDEX IF NOT EXISTS idx_patient_charges_patient_date ON patient_charges(patient_id, created_at DESC);

-- Initial configurable PoC price list. Administrators can update amounts in this master.
INSERT INTO service_price_master(service_code,service_name,department,service_type,view,amount,currency)
VALUES
 ('LAB-CBC','Complete Blood Count','Laboratory','LAB',NULL,450,'INR'),
 ('XR-CHEST-PA','Chest X-ray','Radiology','XRAY','PA',500,'INR'),
 ('XR-CHEST-AP','Chest X-ray','Radiology','XRAY','AP',500,'INR')
ON CONFLICT(service_code) DO NOTHING;

DROP TRIGGER IF EXISTS update_service_price_master_modtime ON service_price_master;
CREATE TRIGGER update_service_price_master_modtime BEFORE UPDATE ON service_price_master
FOR EACH ROW EXECUTE FUNCTION update_modified_column();
DROP TRIGGER IF EXISTS update_patient_charges_modtime ON patient_charges;
CREATE TRIGGER update_patient_charges_modtime BEFORE UPDATE ON patient_charges
FOR EACH ROW EXECUTE FUNCTION update_modified_column();
