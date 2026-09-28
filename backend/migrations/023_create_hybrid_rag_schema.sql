-- 023_create_hybrid_rag_schema.sql
-- Production-grade Hybrid RAG Schema for Meridian Hospital AI Platform
-- Additive, isolated, idempotent schema creation without altering existing clinical tables.

-- 1. Create RAG Documents Table
CREATE TABLE IF NOT EXISTS rag_documents (
    id BIGSERIAL PRIMARY KEY,
    document_type VARCHAR(64) NOT NULL,
    source_table VARCHAR(64) NOT NULL,
    source_record_id VARCHAR(128) NOT NULL,
    patient_id BIGINT,
    admission_id BIGINT,
    doctor_id BIGINT,
    order_id UUID,
    accession_number VARCHAR(64),
    study_instance_uid TEXT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    review_status VARCHAR(64),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    tsv tsvector,
    search_vector tsvector,
    embedding JSONB,
    embedding_model TEXT,
    embedded_at TIMESTAMPTZ,
    embedding_attempts INT DEFAULT 0,
    embedding_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rag_documents_source UNIQUE (source_table, source_record_id, document_type)
);

-- 2. Create RAG Conversations Table
CREATE TABLE IF NOT EXISTS rag_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    role VARCHAR(64) NOT NULL,
    area VARCHAR(64) NOT NULL,
    patient_id BIGINT,
    admission_id BIGINT,
    doctor_id BIGINT,
    order_id UUID,
    summary TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create RAG Messages Table
CREATE TABLE IF NOT EXISTS rag_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    role VARCHAR(64) NOT NULL,
    message_type VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    source_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create RAG Query Audit Table
CREATE TABLE IF NOT EXISTS rag_query_audit (
    id BIGSERIAL PRIMARY KEY,
    request_id UUID NOT NULL,
    user_id BIGINT,
    role VARCHAR(64),
    area VARCHAR(64),
    patient_id BIGINT,
    admission_id BIGINT,
    order_id UUID,
    query TEXT NOT NULL,
    expanded_query JSONB,
    retrieval_strategy VARCHAR(64),
    result_count INT DEFAULT 0,
    source_ids JSONB DEFAULT '[]'::jsonb,
    response_status INT DEFAULT 200,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for RAG Documents
CREATE INDEX IF NOT EXISTS idx_rag_docs_patient_id ON rag_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_rag_docs_admission_id ON rag_documents(admission_id);
CREATE INDEX IF NOT EXISTS idx_rag_docs_doctor_id ON rag_documents(doctor_id);
CREATE INDEX IF NOT EXISTS idx_rag_docs_order_id ON rag_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_rag_docs_accession ON rag_documents(accession_number);
CREATE INDEX IF NOT EXISTS idx_rag_docs_study_uid ON rag_documents(study_instance_uid);
CREATE INDEX IF NOT EXISTS idx_rag_docs_doc_type ON rag_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_rag_docs_review_status ON rag_documents(review_status);
CREATE INDEX IF NOT EXISTS idx_rag_docs_is_verified ON rag_documents(is_verified);
CREATE INDEX IF NOT EXISTS idx_rag_docs_content_hash ON rag_documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_docs_tsv ON rag_documents USING GIN(tsv);
CREATE INDEX IF NOT EXISTS idx_rag_docs_metadata ON rag_documents USING GIN(metadata);

-- Trigger to maintain search_vector and tsv automatically
CREATE OR REPLACE FUNCTION rag_documents_tsv_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tsv := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, ''));
    NEW.search_vector := NEW.tsv;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rag_documents_tsv ON rag_documents;
CREATE TRIGGER trg_rag_documents_tsv
    BEFORE INSERT OR UPDATE ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION rag_documents_tsv_trigger();

-- Additional performance indexes for multi-tenant / clinical scope filtering
CREATE INDEX IF NOT EXISTS idx_rag_scope ON rag_documents(patient_id, admission_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rag_doctor ON rag_documents(doctor_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rag_order ON rag_documents(order_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rag_accession ON rag_documents(accession_number, is_active);
CREATE INDEX IF NOT EXISTS idx_rag_study ON rag_documents(study_instance_uid, is_active);
CREATE INDEX IF NOT EXISTS idx_rag_type_review ON rag_documents(document_type, review_status, is_verified);
CREATE INDEX IF NOT EXISTS idx_rag_search_fts ON rag_documents USING GIN(search_vector);
