# Phase 2 Database Schema & Data Layer Integration

**Document Version:** 1.0.0  
**Date:** 2026-09-16  
**Status:** Executed & Verified  
**Target Repository:** `health-care`

---

## 1. Summary of Database Harmonization

The database architecture has been aligned across the unified PostgreSQL relational model and the existing Databricks Lakehouse connectors.

- **Unified Schema Migrations**: Migration scripts `001_create_roles.sql` through `022_cleanup_dummy_departments.sql` have been integrated into `backend/migrations/`.
- **Database Connection Manager**: `backend/db_config.py` provides thread-safe connection pooling (`ThreadedConnectionPool`) and fallback handling for PostgreSQL connection management.
- **Unified Entity Models**:
  - `patients`: Multi-patient linkage per WhatsApp # (`whatsapp_phone`), `patient_code`, guardian linkage (`guardian_id`).
  - `doctors` & `doctor_schedules`: Doctor directory, department FKs, dynamic 30-min schedule rules.
  - `appointments`: Booking status enums (`booked`, `confirmed`, `paid`, `rescheduled`, `cancelled_by_patient`), booking source (`WHATSAPP_AI` / `PORTAL_ADMIN`).
  - `pre_admissions`: Surgical triage, cost breakdown, triage details JSONB.
  - `conversations` & `messages`: WhatsApp session state, message status tracking (`SENT`, `DELIVERED`, `READ`, `FAILED`), human takeover toggle.
  - `escalations`: Clinical escalation inbox for high-priority patient inquiries.
  - `knowledge_documents` & `knowledge_chunks`: Grounding document chunk store for vector retrieval.

---

## 2. Seed Data Execution
- `backend/seed_pg_data.py` seeds initial hospital departments, doctors, schedules, sample patients, pre-admission records, and knowledge base FAQs.
- `backend/run_migrations.py` applies all 22 migration scripts in numerical sequence with transaction rollback safety.
