-- Migration 026: Create patient_feedback table
-- Stores patient feedback, AI sentiment/category analysis, and links to patient & escalation records.

CREATE TABLE IF NOT EXISTS patient_feedback (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL,
    whatsapp_message_id VARCHAR(255),
    source VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP_TEXT',
    rating INT CHECK (rating IS NULL OR (rating >= 1 AND rating <= 10)),
    original_feedback TEXT NOT NULL,
    sentiment VARCHAR(20) NOT NULL DEFAULT 'NEUTRAL' CHECK (sentiment IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL', 'MIXED')),
    categories JSONB DEFAULT '[]'::jsonb,
    issues JSONB DEFAULT '[]'::jsonb,
    ai_summary TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    requires_action BOOLEAN DEFAULT FALSE,
    recommended_action TEXT,
    confidence NUMERIC(4,3) DEFAULT 1.000,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    assigned_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    resolved_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_feedback_patient_id ON patient_feedback(patient_id);
CREATE INDEX IF NOT EXISTS idx_feedback_conv_id ON patient_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON patient_feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON patient_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_severity ON patient_feedback(severity);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON patient_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_wamid ON patient_feedback(whatsapp_message_id);
