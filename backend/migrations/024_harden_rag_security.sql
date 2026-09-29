-- Additive production hardening for authorization metadata and audit integrity.
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS department VARCHAR(128);
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS module VARCHAR(64);
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS record_version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS source_timestamp TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rag_authorized_scope
    ON rag_documents(module, department, patient_id, doctor_id, is_active, is_deleted);
CREATE INDEX IF NOT EXISTS idx_rag_current_record
    ON rag_documents(source_table, source_record_id, record_version DESC)
    WHERE is_active=TRUE AND is_deleted=FALSE;

ALTER TABLE rag_conversations ADD COLUMN IF NOT EXISTS scope_hash VARCHAR(64);
ALTER TABLE rag_conversations ADD COLUMN IF NOT EXISTS permission_version VARCHAR(64) DEFAULT 'v1';

ALTER TABLE rag_query_audit ADD COLUMN IF NOT EXISTS scope_hash VARCHAR(64);
ALTER TABLE rag_query_audit ADD COLUMN IF NOT EXISTS guardrail_result VARCHAR(64);
ALTER TABLE rag_query_audit ADD COLUMN IF NOT EXISTS source_record_ids JSONB DEFAULT '[]'::jsonb;

-- Database-level append-only protection. The application role may insert/read but
-- cannot mutate history after the row exists.
CREATE OR REPLACE FUNCTION prevent_rag_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'rag_query_audit is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rag_audit_no_update ON rag_query_audit;
CREATE TRIGGER trg_rag_audit_no_update BEFORE UPDATE OR DELETE ON rag_query_audit
FOR EACH ROW EXECUTE FUNCTION prevent_rag_audit_mutation();
