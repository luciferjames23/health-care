# Phase 7 & 8 Cutover Procedure & Cleanup Plan

**Document Version:** 1.0.0  
**Date:** 2026-09-16  
**Status:** Pending User Approval for Phase 8 Cleanup  
**Target Repository:** `health-care`

---

## 1. Production Cutover Procedure (Phase 7)

1. **Backend Service Launch**:
   - Run backend FastAPI master server:
     ```bash
     cd backend
     python -m uvicorn main:app --reload --port 8000
     ```
2. **Frontend Application Launch**:
   - Run Vite development/production server:
     ```bash
     cd frontend
     npm run dev
     ```
3. **Database Migration Execution**:
   - Run PostgreSQL database migration & seeding script:
     ```bash
     cd backend
     python run_migrations.py
     python seed_pg_data.py
     ```

---

## 2. Phase 8 Final Cleanup Request

> [!IMPORTANT]
> **Human Approval Required for Phase 8 Cleanup**:
> The `healthcare-poc/` reference directory remains 100% intact and untouched.
> Once you confirm that all integrated modules (`Appointments`, `Pre-Admissions`, `AI Patient Desk`, `AI Escalations`, WhatsApp AI subsystem) are working to your satisfaction, grant permission to perform Phase 8 final removal of `healthcare-poc/`.
