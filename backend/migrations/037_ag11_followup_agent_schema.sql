-- Migration 037: AG-11 Follow-up Agent Schema
-- Supports durable follow-up plans, Day 3/7/14 scheduled check-ins, patient responses,
-- clinical escalations, callbacks, and consent management.

-- 1. Follow-up Plans linked to Patient and Discharge Summary
CREATE TABLE IF NOT EXISTS ag11_followup_plans (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    discharge_summary_id BIGINT REFERENCES dim_generated_discharge_summaries(summary_id) ON DELETE SET NULL,
    admission_id BIGINT,
    procedure_name VARCHAR(255),
    discharge_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'PAUSED', 'READMITTED')),
    care_plan_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_ag11_plan_patient_summary UNIQUE (patient_id, discharge_summary_id)
);

CREATE INDEX IF NOT EXISTS idx_ag11_plans_patient ON ag11_followup_plans(patient_id);
CREATE INDEX IF NOT EXISTS idx_ag11_plans_status ON ag11_followup_plans(status);
CREATE INDEX IF NOT EXISTS idx_ag11_plans_discharge_date ON ag11_followup_plans(discharge_date);

-- 2. Scheduled Follow-up Tasks (Day 3, Day 7, Day 14)
CREATE TABLE IF NOT EXISTS ag11_followup_tasks (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES ag11_followup_plans(id) ON DELETE CASCADE,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    followup_day INT NOT NULL CHECK (followup_day IN (3, 7, 14)),
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'SENT', 'DELIVERED', 'COMPLETED', 'FAILED', 'OVERDUE', 'CANCELLED')),
    idempotency_key VARCHAR(255) UNIQUE,
    outbound_wamid VARCHAR(255),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    retry_count INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ag11_tasks_plan ON ag11_followup_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_ag11_tasks_patient ON ag11_followup_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_ag11_tasks_due_status ON ag11_followup_tasks(due_date, status);
CREATE INDEX IF NOT EXISTS idx_ag11_tasks_idempotency ON ag11_followup_tasks(idempotency_key);

-- 3. Patient Responses
CREATE TABLE IF NOT EXISTS ag11_patient_responses (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT REFERENCES ag11_followup_tasks(id) ON DELETE CASCADE,
    plan_id BIGINT REFERENCES ag11_followup_plans(id) ON DELETE CASCADE,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL,
    inbound_wamid VARCHAR(255),
    response_type VARCHAR(50) NOT NULL CHECK (response_type IN ('ROUTINE_OK', 'CONCERNING_SYMPTOMS', 'CALLBACK_REQUESTED', 'APPOINTMENT_QUERY', 'MEDICATION_ISSUE', 'AMBIGUOUS', 'NO_RESPONSE')),
    raw_text TEXT,
    structured_answers JSONB DEFAULT '{}'::jsonb,
    ai_classification VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ag11_responses_task ON ag11_patient_responses(task_id);
CREATE INDEX IF NOT EXISTS idx_ag11_responses_patient ON ag11_patient_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_ag11_responses_type ON ag11_patient_responses(response_type);

-- 4. Callback Tasks
CREATE TABLE IF NOT EXISTS ag11_callbacks (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT REFERENCES ag11_followup_plans(id) ON DELETE CASCADE,
    task_id BIGINT REFERENCES ag11_followup_tasks(id) ON DELETE SET NULL,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE SET NULL,
    requested_reason TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    assigned_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    outcome_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ag11_callbacks_patient ON ag11_callbacks(patient_id);
CREATE INDEX IF NOT EXISTS idx_ag11_callbacks_status ON ag11_callbacks(status);
CREATE INDEX IF NOT EXISTS idx_ag11_callbacks_priority ON ag11_callbacks(priority);

-- 5. AG-11 Clinical Escalations (Linked to Central Escalations table)
CREATE TABLE IF NOT EXISTS ag11_clinical_escalations (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT REFERENCES ag11_followup_plans(id) ON DELETE CASCADE,
    task_id BIGINT REFERENCES ag11_followup_tasks(id) ON DELETE SET NULL,
    patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    escalation_id BIGINT REFERENCES escalations(id) ON DELETE SET NULL,
    symptom_summary TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'HIGH' CHECK (severity IN ('MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
    assigned_team VARCHAR(100) DEFAULT 'Nursing & Clinical Desk',
    assigned_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    disposition_notes TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ag11_escalations_patient ON ag11_clinical_escalations(patient_id);
CREATE INDEX IF NOT EXISTS idx_ag11_escalations_status ON ag11_clinical_escalations(status);
CREATE INDEX IF NOT EXISTS idx_ag11_escalations_severity ON ag11_clinical_escalations(severity);

-- 6. Communication Consent & Preferences
CREATE TABLE IF NOT EXISTS ag11_communication_consent (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT UNIQUE NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    consent_given BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_language VARCHAR(20) NOT NULL DEFAULT 'ENGLISH' CHECK (preferred_language IN ('ENGLISH', 'TAMIL', 'HINDI', 'TELUGU', 'MALAYALAM', 'KANNADA', 'URDU')),
    opted_out_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ag11_consent_patient ON ag11_communication_consent(patient_id);

-- 7. Remove restrictive check constraint on notifications table to support all system notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
