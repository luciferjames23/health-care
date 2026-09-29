-- Per-user, per-session authorized entity-set memory for collection follow-ups.
CREATE TABLE IF NOT EXISTS rag_conversation_context (
    conversation_id UUID PRIMARY KEY REFERENCES rag_conversations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    role VARCHAR(64) NOT NULL,
    scope_hash VARCHAR(64) NOT NULL,
    patient_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_query_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rag_conversation_context_owner
    ON rag_conversation_context(user_id, role, scope_hash, expires_at);

REVOKE UPDATE (user_id, role, scope_hash) ON rag_conversation_context FROM PUBLIC;
