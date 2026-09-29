# Phase 1 Module Mapping & Categorization Table

**Document Version:** 1.0.0  
**Date:** 2026-09-16  
**Status:** Pending User Approval  
**Target Repository:** `health-care`

---

## 1. Categorization Rules Summary

Every component and feature across `healthcare-poc/` and `frontend/` / `backend/` is classified into one of four strict integration categories:

- **Category A (Same Module + Same Functionality)**: Retain friend's master UI/workflow; map POC database records into friend's existing implementation.
- **Category B (Same Module + Partially Different Functionality)**: Retain friend's UI/functionality; add ONLY missing backend logic or data fields without altering existing visual styling or navigation.
- **Category C (POC-Exclusive Functionality)**: Build missing POC features into friend's portal as new modules, inheriting friend's exact CSS tokens, layout wrappers, and navigation hierarchy.
- **Category D (Friend Portal-Exclusive Functionality)**: Retain friend's existing code completely unmodified.

---

## 2. Admin & Front Office Portal Mapping Table

| Module ID | Module Name | Meridian POC Feature Set | Friend Master Portal Feature Set | Category | Integration & Mapping Action Plan | Review / Decision Flag |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `patients` | **Patient Management** | Multi-patient linkage per WhatsApp #, Dependents, WhatsApp ID tracking, Full Patient Profiles. | Master Patient List (`PatientsView.jsx`), Patient 360 (`Patient360View.jsx`), Search, Drawer. | **Category A** | **Preserve Master UI.** Extend database queries to display both walk-in and WhatsApp-registered patients. Expose dependent relationships and WhatsApp phone numbers in master patient modal. | Standard merge into master UI. |
| `schedules` | **Doctor & Schedule Management** | Doctor directory, Specializations, Dynamic 30-min time slot generation, Date-wise schedule rules. | Consultant Schedules (`SchedulesView.jsx`), Doctor list in Clinical Workspace. | **Category B** | **Preserve Master UI.** Add Meridian's dynamic slot generation algorithm (`appointment_service.py`) behind the master schedule setup form. | Standard backend integration. |
| `appointments` | **Appointment Management** | Dynamic booking, status states (`booked`, `confirmed`, `paid`, `rescheduled`, `cancelled_by_patient`), mock payment sync. | Appointments View (`AppointmentsView.jsx` placeholder in `DummyDomainViews.jsx`). | **Category B** | **Preserve Master Styling.** Replace dummy placeholder with full interactive data table matching master design system. Connect to unified backend API for real-time status updates and WhatsApp notification triggers. | **Human Review**: Elevate placeholder to full master-styled component. |
| `ai-patient-desk` | **AI Patient Desk & Human Handoff** | Live WhatsApp conversation stream, Bot takeover toggle, Direct staff chat dispatch, Escalation triggers. | *None* | **Category C** | **Add New Module into Master Navigation** under `AI PLATFORM` (`id: 'ai-patient-desk'`, label: `'AI Patient Desk'`). Styled strictly using Master OKLCH colors, card layout, and buttons. | **Human Review**: Confirm location in AI PLATFORM nav group. |
| `preadmissions` | **Pre-Admission Triage** | Emergency surgical pre-admission forms, Guardian consent, Estimated Cost breakdown. | Admissions View (`AdmissionsView.jsx`). | **Category C** | **Add "Pre-Admission Triage" View** into Master Navigation under `FRONT OFFICE & PATIENTS` (`id: 'preadmissions'`, label: `'Pre-Admissions'`). Uses Master table and modal components. | **Human Review**: Confirm location in FRONT OFFICE nav group. |
| `knowledge` | **AI Knowledge Base & RAG Admin** | Hospital FAQs, Department contacts, RAG vector chunking, Grounding document management. | Knowledge Base (`GovernedKnowledgeView.jsx`) and System Settings (`SettingsView.jsx`). | **Category C** | **Enhance Master Knowledge Base UI.** Add RAG grounding document and FAQ chunk management tabs to master `GovernedKnowledgeView.jsx`. | Merge into existing Master Knowledge View. |
| `analytics` | **Reports & Analytics** | AI resolution metrics, WhatsApp vs Voice channel split, Language distribution, Payment conversions. | Analytics View (`AnalyticsView.jsx`), Command Centre (`CommandCentreView.jsx`). | **Category B** | **Preserve Master Dashboard UI.** Add an "AI Desk Analytics" summary widget set into `AnalyticsView.jsx` matching master styling tokens. | Standard UI extension. |
| `revenue` / `claims` | **RCM Claims & Bed Allocation** | *None (Mock data only)* | Full Revenue View (`RevenueView.jsx`), Bed Demand Forecast (`BedDemandView.jsx`), Claims (`ClaimsView.jsx`). | **Category D** | **Preserve Master Implementation Unmodified.** Retain all existing financial, bed allocation, and claims pages and services 100% intact. | No changes. |

---

## 3. Doctor Portal Mapping Table

| Module ID | Module Name | Meridian POC Feature Set | Friend Master Portal Feature Set | Category | Integration & Mapping Action Plan | Review / Decision Flag |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `clinical` | **Doctor Dashboard** | Today's appointment counts, Quick status updates. | Doctor Clinical Workspace (`ClinicalWorkspaceView.jsx`). | **Category A** | **Preserve Master UI.** Feed unified appointment data (combining WhatsApp AI bookings and direct portal walk-ins) into master dashboard cards. | Standard merge. |
| `patient360` / `soap` | **My Patients & Clinical Records** | Patient summary, Past appointments, Pre-consultation AI summary. | Clinical Notes, Soap Note (`SoapNoteView.jsx`), Patient 360 (`Patient360View.jsx`). | **Category B** | **Preserve Master EMR View.** Add a tab/section inside master `Patient360View.jsx` to display WhatsApp AI pre-consultation symptom summaries and pre-uploaded lab/radiology reports. | Standard UI extension. |
| `doctor-escalations` | **Doctor AI Escalation Inbox** | Staff notification for escalated queries, Direct response dispatch back to WhatsApp chat. | *None* | **Category C** | **Add "AI Escalations" View** under `CLINICAL` in Master Navigation (`id: 'doctor-escalations'`, label: `'AI Escalations'`). Allows doctors to reply to patient WhatsApp escalations. | **Human Review**: Confirm location in CLINICAL nav group. |

---

## 4. Protected WhatsApp AI Engine (Category Protection)

| Subsystem Component | File Paths | Protection Level | Action Plan |
| :--- | :--- | :---: | :--- |
| **Meta Webhook Router** | `healthcare-poc/backend/api/whatsapp_routes.py` | **Protected System** | Port to master `backend/routers/whatsapp_routes.py`. Retain `/api/whatsapp/webhook` contract 100%. |
| **LLM Intent Router & Agent** | `healthcare-poc/backend/agent/llm_intent_router.py`, `agent_service.py`, `intent_detector.py`, `entity_extractor.py`, `state_manager.py`, `language_service.py` | **Protected System** | Copy directly to master `backend/agent/`. Zero modifications to prompt engineering, intent detection logic, or state machines. Update DB ORM imports only. |
| **RAG Vector Knowledge Store** | `healthcare-poc/backend/knowledge/*` | **Protected System** | Retain existing chunking and retriever mechanisms. |
| **Voice STT/TTS Pipeline** | `healthcare-poc/backend/voice/*` | **Protected System** | Retain existing audio processing logic and endpoints. |

---

## 5. Items Requiring User Approval Before Proceeding

> [!IMPORTANT]
> **Summary of Items Flagged for User Review:**
> 1. **`appointments` Module**: The master portal currently uses a placeholder view in `DummyDomainViews.jsx`. We propose replacing this placeholder with a fully interactive data table connected to PostgreSQL, styled in master OKLCH design language.
> 2. **`ai-patient-desk` Module (Category C)**: We propose adding this new module into `AppSidebar.jsx` under `AI PLATFORM`.
> 3. **`preadmissions` Module (Category C)**: We propose adding this new module into `AppSidebar.jsx` under `FRONT OFFICE & PATIENTS`.
> 4. **`doctor-escalations` Module (Category C)**: We propose adding this new module into `AppSidebar.jsx` under `CLINICAL`.
> 5. **Radiology Subsystem (Category D)**: As per spec Phase 5, radiology components (`ohif-demo`, `radiology_backend`, `radiology_ohif_demo`, `RadiologyView.jsx`) will remain untouched until Phase 5 investigation.
