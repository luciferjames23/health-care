# Phase 3 Backend Integration & REST API Services

**Document Version:** 1.0.0  
**Date:** 2026-09-16  
**Status:** Executed & Verified  
**Target Repository:** `health-care`

---

## 1. Registered FastAPI Routers in `backend/main.py`

| Router File | Prefix | Responsibilities | Status |
| :--- | :--- | :--- | :---: |
| `routers/gold.py` | `/api/v1/gold` | Databricks Gold schema tables query endpoints | Existing |
| `routers/bronze.py` | `/api/v1/bronze` | Databricks Bronze schema tables query endpoints | Existing |
| `routers/discharge_agent.py` | `/api/v1/discharge-agent` | Llama 3.3 70B discharge orchestration endpoints | Existing |
| `api/whatsapp_routes.py` | `/api/whatsapp` | Meta WhatsApp Cloud API webhook receiver & verification | **Mounted** |
| `api/agent_routes.py` | `/api/agent` | AI Patient Desk agent control, intent testing, human handoff | **Mounted** |
| `api/dashboard_routes.py` | `/api/dashboard` | Unified appointment, patient, doctor, and analytics REST endpoints | **Mounted** |
| `api/auth_routes.py` | `/api/auth` | User auth verification and token management | **Mounted** |

---

## 2. Shared Data Services

- `backend/appointment_service.py`: Dynamic 30-min time slot generation, schedule validation, appointment booking, payment reference updates.
- `backend/preadmission_service.py`: Pre-admission surgical triage processing, document uploads, cost estimations.
