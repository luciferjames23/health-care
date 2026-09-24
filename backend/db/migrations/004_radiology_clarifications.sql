BEGIN;
CREATE TABLE IF NOT EXISTS radiology_clarifications (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES radiology_orders(order_id),
    subject TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('Routine', 'Urgent')),
    created_by BIGINT NOT NULL REFERENCES users(id),
    assigned_to BIGINT REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Responded', 'Resolved')),
    report_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS radiology_clarifications_order_idx ON radiology_clarifications(order_id, updated_at);
CREATE TABLE IF NOT EXISTS radiology_clarification_messages (
    id UUID PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES radiology_clarifications(id),
    sender_id BIGINT NOT NULL REFERENCES users(id),
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 8000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS radiology_clarification_messages_thread_idx ON radiology_clarification_messages(thread_id, created_at);
CREATE TABLE IF NOT EXISTS radiology_clarification_reads (
    message_id UUID NOT NULL REFERENCES radiology_clarification_messages(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(message_id, user_id)
);
CREATE TABLE IF NOT EXISTS radiology_clarification_events (
    id BIGSERIAL PRIMARY KEY,
    thread_id UUID NOT NULL REFERENCES radiology_clarifications(id),
    actor_id BIGINT NOT NULL REFERENCES users(id),
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMIT;
