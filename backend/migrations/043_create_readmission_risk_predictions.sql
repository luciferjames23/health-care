-- Migration 043: Create table for Readmission Risk Predictions (7-day, 14-day, 30-day)
CREATE TABLE IF NOT EXISTS patient_readmission_risk_predictions (
    prediction_id SERIAL PRIMARY KEY,
    patient_id INT NOT NULL,
    admission_id INT,
    risk_score_7day NUMERIC(5, 2) NOT NULL,
    risk_tier_7day VARCHAR(20) NOT NULL,
    risk_score_14day NUMERIC(5, 2) NOT NULL,
    risk_tier_14day VARCHAR(20) NOT NULL,
    risk_score_30day NUMERIC(5, 2) NOT NULL,
    risk_tier_30day VARCHAR(20) NOT NULL,
    lace_score INT DEFAULT 0,
    charlson_score INT DEFAULT 0,
    primary_risk_factors JSONB DEFAULT '[]'::jsonb,
    modifiable_factors JSONB DEFAULT '[]'::jsonb,
    mitigation_plan JSONB DEFAULT '[]'::jsonb,
    clinical_rationale TEXT,
    evidence_data JSONB DEFAULT '{}'::jsonb,
    model_name VARCHAR(100) DEFAULT 'hybrid-clinical-rules',
    clinician_status VARCHAR(50) DEFAULT 'Pending Review',
    clinician_notes TEXT,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    predicted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_readm_risk_pid ON patient_readmission_risk_predictions(patient_id);
CREATE INDEX IF NOT EXISTS idx_readm_risk_aid ON patient_readmission_risk_predictions(admission_id);
CREATE INDEX IF NOT EXISTS idx_readm_risk_date ON patient_readmission_risk_predictions(predicted_at DESC);
