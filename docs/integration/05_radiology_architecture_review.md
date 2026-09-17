# Phase 5 Radiology & PACS Architecture Review

**Document Version:** 1.0.0  
**Date:** 2026-09-16  
**Status:** Completed Investigation  
**Target Repository:** `health-care`

---

## 1. Comparative System Analysis

| System Dimension | Meridian POC Radiology (`healthcare-poc/`) | Master App Radiology (`radiology_backend/` + `ohif-demo`) |
| :--- | :--- | :--- |
| **Backend Engine** | Simple mock Pydantic models (`RadiologyStudyModel`) returning simulated static JSON scores. | **Standalone FastAPI PACS Service (`radiology_backend/`)** running on port 8001 with DenseNet/YOLO AI model inference, Orthanc DICOM watcher, and PACS DICOM webstore integration. |
| **DICOM Viewer** | Static SVG heatmap overlay in web browser. | **Full OHIF Medical DICOM Viewer (`ohif-demo`, `radiology_ohif_demo`)** running via Docker Compose (`VITE_OHIF_URL=http://localhost:3000`). |
| **Frontend Master Views** | Basic radiology triage card. | **Three Master Integrated Views**: `RadiologyView.jsx` (Live PACS worklist + viewer), `DiagnosticsView.jsx` (Cross-imaging overview), `ResultsCriticalValuesView.jsx` (Critical value alerts). |

---

## 2. Recommendation & Strategic Integration Plan

> [!IMPORTANT]
> **Architectural Recommendation**:
> Retain the existing **Master Radiology & PACS Architecture (`radiology_backend/`, `ohif-demo`, `RadiologyView.jsx`) 100% intact**. 
> The Meridian POC mock radiology endpoint is completely superseded by the live PACS and OHIF viewer integration. No POC mock radiology code should be merged into the production backend.

---

## 3. Configuration Contract
- **Radiology AI Backend API**: `http://localhost:8001` (Configured via `VITE_RADIOLOGY_API_URL`)
- **OHIF DICOM Viewer URL**: `http://localhost:3000` (Configured via `VITE_OHIF_URL`)
