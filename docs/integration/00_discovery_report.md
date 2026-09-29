# Phase 0 Discovery Report: System Stack & Architecture Audit

**Document Version:** 1.0.0  
**Date:** 2026-09-16  
**Status:** Completed (Phase 0 Discovery)  
**Target Repository:** `health-care`

---

## 1. Executive Summary

This Discovery Report documents the authoritative architectural baseline of the canonical Hospital Management Platform (`backend/` and `frontend/`) and compares it against the reference Proof-of-Concept (`healthcare-poc/`).

Per the core integration principles:
- **`backend/` and `frontend/` are the architectural source of truth.**
- **`healthcare-poc/` is purely a reference source for missing functionality, AI logic, and seeded records.**

---

## 2. Master System Architecture (`backend/` and `frontend/`)

### 2.1 Backend Stack (`backend/`)
- **Language & Framework**: Python 3.10+ using **FastAPI (v0.100+)** running with `uvicorn`.
- **Database Engine & Persistence**:
  - Primary Query Engine: **Databricks SQL Connector (`databricks-sql-connector >= 3.0.0`)** querying Databricks Delta Lakehouse tables in catalog `health_care` across schemas `health_care.gold.*` and `health_care.bronze.*`.
  - Resilience & Fallback: `main.py` and `databricks_connector.py` implement an automated fallback engine for offline or quota-limited Databricks environments.
- **API Endpoint Structure & Routers**:
  - `routers/gold.py`: Queries gold dimensional tables (`dim_admission_llm_inputs`, `dim_revenue_predictions`, `generated_discharge_summaries`, `bed_management`).
  - `routers/bronze.py`: Queries raw operational tables (`wards`, `beds`, `rooms`, `doctors`, `patients`).
  - `routers/notebook.py` & `routers/jobrun.py`: Databricks job and notebook orchestration endpoints.
  - `routers/discharge_agent.py` & `routers/discharge_summary_llm.py`: Automated Llama 3.3 70B LLM discharge summary generation pipeline.
  - `routers/radiology.py`: AI Radiology DICOM report and triage endpoints.
- **Authentication & Security**:
  - Role-based routing configured in frontend (`ROLE_PAGE_ACCESS`). CORS middleware enabled globally (`allow_origins=["*"]`).

### 2.2 Frontend Stack (`frontend/`)
- **Build Tool & Framework**: **React 19.2.8** bundled with **Vite 8.2.2** and `@vitejs/plugin-react` (with React Compiler).
- **Styling System & Visual Language**:
  - **Vanilla CSS / Custom Tokens** combined with TailwindCSS v4 (`@tailwindcss/vite`).
  - Strict color system using `oklch()` colors, clean neutral background (`#fbfbfc`), subtle borders (`#e3e6e8`), dark slate text (`#15181b`), crisp typography, and compact layout spacing.
  - Iconography provided by `lucide-react`.
- **Navigation & Layout Architecture**:
  - Single-page application using active tab state (`activePage`) managed in `App.jsx`.
  - Sidebar layout configured in `AppSidebar.jsx` organized into 6 distinct navigation groups (`FRONT OFFICE & PATIENTS`, `CLINICAL`, `DIAGNOSTICS · LIS & IMAGING`, `FINANCIAL & REVENUE`, `AI PLATFORM`, `DATA`).
  - Dynamic role filtering controlled via `TopHeader.jsx` with active user persona (`meera.iyer` / Hospital Management).
- **Data Fetching & Cache Strategy**:
  - `apiService` in `src/services/api.js` implements a Stale-While-Revalidate (SWR) cache layer (`apiCache` map + `CustomEvent('hc_api_updated')`) for instant tab switches and real-time state synchronization.

---

## 3. Reference System Architecture (`healthcare-poc/`)

### 3.1 Backend Architecture (`healthcare-poc/backend/`)
- **Framework**: Python FastAPI with Uvicorn.
- **Database Engine**: **SQLite (`hospital.db`) / PostgreSQL (SQLAlchemy ORM + Alembic migrations)**.
- **WhatsApp & AI Agent Subsystem**:
  - Protected AI Agent stack under `agent/`: `agent_service.py`, `llm_intent_router.py`, `intent_detector.py`, `entity_extractor.py`, `grounding_validator.py`, `language_service.py` (STT/TTS multilingual), `state_manager.py`, `message_aggregator.py`.
  - Router endpoints under `api/`: `whatsapp_routes.py` (`/api/whatsapp/webhook`), `agent_routes.py`, `dashboard_routes.py`, `auth_routes.py`.
  - Domain Services: `appointment_service.py` (dynamic 30-min slot generation, schedule validation), `preadmission_service.py` (pre-admission surgical triage and estimation).

### 3.2 Frontend Architecture (`healthcare-poc/frontend/`)
- **Framework**: React with TypeScript and Vite.
- **Styling**: TailwindCSS with distinct POC color scheme and custom card layout. *Note: As per spec directive, this UI styling will NOT be used.*

---

## 4. Key Architectural Alignment Findings

1. **Database Schema Harmonization Needed**:
   - The master system currently relies on Databricks Gold/Bronze schemas (`dim_admission_llm_inputs`, etc.) or simulated in-memory endpoints.
   - To integrate the WhatsApp AI agent, RCM claims, pre-admissions, and interactive appointment bookings, a unified relational database layer (PostgreSQL / SQLite fallback) must be connected to the master FastAPI backend, hosting tables defined in `sdd_integration_plan.md` Section 4 (`patients`, `doctors`, `appointments`, `pre_admissions`, `conversations`, `messages`, `escalations`, `knowledge_documents`, `knowledge_chunks`).

2. **Backend Router Merging**:
   - The master `backend/main.py` will include the protected WhatsApp routes (`whatsapp_routes.py`), AI desk agent routes (`agent_routes.py`), and unified CRUD services without touching the core WhatsApp agent logic (`agent/*`).

3. **Frontend Integration Strategy**:
   - New screens (AI Patient Desk, Pre-Admissions, Knowledge Base Admin, Doctor AI Escalation Inbox) will be built as standard React components inside `frontend/src/components/`, strictly inheriting the master portal's CSS tokens, `AppSidebar` nav groups, and `App.jsx` page switcher.

---

## 5. Verification Checklist & Next Steps
- [x] Confirmed backend language (Python / FastAPI) & DB query layer (Databricks + API endpoints).
- [x] Confirmed frontend stack (React 19 / Vite / Tailwind v4 / OKLCH design system).
- [x] Confirmed WhatsApp AI agent subsystems in `healthcare-poc/backend/agent/*`.
- [next] Proceed to Phase 1: Module Mapping Table.
