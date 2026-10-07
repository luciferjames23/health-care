-- Migration 027: Create queue management tables for AG-06 Queue / Flow Agent
-- Supports: queue sessions, queue entries, queue notifications
-- Integrates with existing: patients, doctors, departments, appointments, notifications

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: queue_sessions
-- One session per doctor per date. Tracks the overall queue state.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_sessions (
    id                      BIGSERIAL PRIMARY KEY,
    doctor_id               BIGINT NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    department_id           BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    queue_date              DATE NOT NULL,
    room_number             VARCHAR(50),
    status                  VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                                CHECK (status IN ('OPEN', 'ACTIVE', 'PAUSED', 'CLOSED', 'CANCELLED')),
    current_token_number    INTEGER NOT NULL DEFAULT 0,
    started_at              TIMESTAMP WITH TIME ZONE,
    closed_at               TIMESTAMP WITH TIME ZONE,
    paused_at               TIMESTAMP WITH TIME ZONE,
    paused_reason           TEXT,
    created_by_user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate sessions for the same doctor on the same date
    CONSTRAINT uq_queue_session_doctor_date UNIQUE (doctor_id, queue_date)
);

CREATE INDEX IF NOT EXISTS idx_queue_sessions_doctor_id    ON queue_sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_queue_sessions_department_id ON queue_sessions(department_id);
CREATE INDEX IF NOT EXISTS idx_queue_sessions_queue_date   ON queue_sessions(queue_date);
CREATE INDEX IF NOT EXISTS idx_queue_sessions_status       ON queue_sessions(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: queue_entries
-- One entry per patient appointment in a queue session.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_entries (
    id                          BIGSERIAL PRIMARY KEY,
    queue_session_id            BIGINT NOT NULL REFERENCES queue_sessions(id) ON DELETE RESTRICT,
    appointment_id              BIGINT NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
    patient_id                  BIGINT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    doctor_id                   BIGINT NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    department_id               BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,

    -- Deterministic token number — assigned at check-in, never changes
    token_number                INTEGER NOT NULL,

    -- Queue flow status
    queue_status                VARCHAR(20) NOT NULL DEFAULT 'WAITING'
                                    CHECK (queue_status IN (
                                        'WAITING', 'CALLED', 'NEXT', 'IN_CONSULTATION',
                                        'COMPLETED', 'CANCELLED', 'NO_SHOW'
                                    )),

    -- Calculated fields (updated on queue recalculation)
    position                    INTEGER,           -- 1-based position (1 = next after current)
    patients_ahead              INTEGER,           -- count of patients still waiting before this one
    estimated_wait_minutes      INTEGER,           -- calculated ETA in minutes

    -- Event timestamps
    checked_in_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    called_at                   TIMESTAMP WITH TIME ZONE,
    consultation_started_at     TIMESTAMP WITH TIME ZONE,
    consultation_completed_at   TIMESTAMP WITH TIME ZONE,
    cancelled_at                TIMESTAMP WITH TIME ZONE,

    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Prevent duplicate check-in for the same appointment
    CONSTRAINT uq_queue_entry_appointment UNIQUE (appointment_id),

    -- Prevent duplicate tokens in the same session
    CONSTRAINT uq_queue_entry_token UNIQUE (queue_session_id, token_number)
);

CREATE INDEX IF NOT EXISTS idx_queue_entries_session_id    ON queue_entries(queue_session_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_appointment_id ON queue_entries(appointment_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_patient_id    ON queue_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_doctor_id     ON queue_entries(doctor_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_queue_status  ON queue_entries(queue_status);
CREATE INDEX IF NOT EXISTS idx_queue_entries_token_number  ON queue_entries(queue_session_id, token_number);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: queue_notifications
-- Track every WhatsApp notification sent for queue events.
-- Provides idempotency: one row per (queue_entry_id, notification_type, idempotency_key).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_notifications (
    id                      BIGSERIAL PRIMARY KEY,
    queue_entry_id          BIGINT NOT NULL REFERENCES queue_entries(id) ON DELETE CASCADE,
    patient_id              BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id          BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,

    -- Notification type — what triggered this message
    notification_type       VARCHAR(50) NOT NULL
                                CHECK (notification_type IN (
                                    'TOKEN_ASSIGNED',
                                    'QUEUE_POSITION_UPDATED',
                                    'WAIT_TIME_UPDATED',
                                    'DOCTOR_DELAY',
                                    'YOU_ARE_NEXT',
                                    'PROCEED_TO_ROOM',
                                    'CONSULTATION_STARTED',
                                    'QUEUE_PAUSED',
                                    'QUEUE_RESUMED',
                                    'QUEUE_CANCELLED'
                                )),

    -- Idempotency key: prevents re-sending the same event for same queue state
    -- Example: "TOKEN_ASSIGNED:entry_42" or "YOU_ARE_NEXT:entry_42:position_1"
    idempotency_key         VARCHAR(255) NOT NULL,

    -- Message content sent
    message_content         TEXT NOT NULL,
    language                VARCHAR(20) NOT NULL DEFAULT 'ENGLISH',

    -- WhatsApp delivery tracking
    whatsapp_number         VARCHAR(30) NOT NULL,
    whatsapp_message_id     VARCHAR(255),          -- returned by Meta API

    -- Delivery status (mirrors existing Meta webhook pattern)
    status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED')),

    -- Retry tracking
    attempt_count           INTEGER NOT NULL DEFAULT 0,
    last_error              TEXT,

    -- Timestamps
    sent_at                 TIMESTAMP WITH TIME ZONE,
    delivered_at            TIMESTAMP WITH TIME ZONE,
    read_at                 TIMESTAMP WITH TIME ZONE,
    failed_at               TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Idempotency constraint: same event never sent twice for same queue state
    CONSTRAINT uq_queue_notification_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_queue_notifs_entry_id       ON queue_notifications(queue_entry_id);
CREATE INDEX IF NOT EXISTS idx_queue_notifs_patient_id     ON queue_notifications(patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_notifs_notif_type     ON queue_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_queue_notifs_status         ON queue_notifications(status);
CREATE INDEX IF NOT EXISTS idx_queue_notifs_idempotency    ON queue_notifications(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_queue_notifs_created_at     ON queue_notifications(created_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- Extend existing notifications table to support queue notification types.
-- Uses ALTER + DO block for idempotency (safe to re-run).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    BEGIN
        ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_notification_type_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER TABLE notifications
            ADD CONSTRAINT notifications_notification_type_check
            CHECK (notification_type IN (
                'APPOINTMENT_CONFIRMED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_RESCHEDULED',
                'APPOINTMENT_REMINDER', 'ADMISSION_REMINDER', 'DOCUMENT_REMINDER',
                'POST_DISCHARGE_FEEDBACK',
                'QUEUE_TOKEN_ASSIGNED', 'QUEUE_POSITION_UPDATED', 'QUEUE_YOU_ARE_NEXT',
                'QUEUE_PROCEED_TO_ROOM', 'QUEUE_CONSULTATION_STARTED',
                'QUEUE_PAUSED', 'QUEUE_RESUMED', 'QUEUE_CANCELLED'
            )) NOT VALID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Extend audit_logs to support queue actions.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    BEGIN
        ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER TABLE audit_logs
            ADD CONSTRAINT audit_logs_action_check
            CHECK (action IN (
                'CREATE_PATIENT', 'UPDATE_PATIENT', 'CREATE_DOCTOR', 'UPDATE_DOCTOR',
                'CREATE_APPOINTMENT', 'CANCEL_APPOINTMENT', 'RESCHEDULE_APPOINTMENT',
                'UPDATE_SCHEDULE', 'CHANGE_PASSWORD',
                'QUEUE_CREATED', 'QUEUE_SESSION_STARTED', 'QUEUE_SESSION_PAUSED',
                'QUEUE_SESSION_RESUMED', 'QUEUE_SESSION_CLOSED', 'QUEUE_SESSION_CANCELLED',
                'TOKEN_ASSIGNED', 'PATIENT_CALLED', 'CONSULTATION_STARTED',
                'CONSULTATION_COMPLETED', 'QUEUE_ENTRY_CANCELLED', 'QUEUE_NO_SHOW',
                'QUEUE_NOTIFICATION_SENT'
            )) NOT VALID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Extend agent_action_logs to support queue agent actions.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    BEGIN
        ALTER TABLE agent_action_logs DROP CONSTRAINT IF EXISTS agent_action_logs_action_name_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
        ALTER TABLE agent_action_logs
            ADD CONSTRAINT agent_action_logs_action_name_check
            CHECK (action_name IN (
                'SEARCH_HOSPITAL_KNOWLEDGE', 'GET_DOCTOR_AVAILABILITY', 'GET_AVAILABLE_SLOTS',
                'BOOK_APPOINTMENT', 'GET_APPOINTMENT_STATUS', 'CANCEL_APPOINTMENT',
                'RESCHEDULE_APPOINTMENT', 'GET_PATIENT', 'GET_PRE_ADMISSION_STATUS',
                'CREATE_ESCALATION',
                'QUEUE_CHECK_IN', 'QUEUE_SEND_TOKEN_NOTIFICATION', 'QUEUE_SEND_POSITION_UPDATE',
                'QUEUE_SEND_YOU_ARE_NEXT', 'QUEUE_SEND_PROCEED_TO_ROOM',
                'QUEUE_SEND_CONSULTATION_STARTED', 'QUEUE_SEND_PAUSED_NOTIFICATION',
                'QUEUE_SEND_CANCELLED_NOTIFICATION'
            )) NOT VALID;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;
