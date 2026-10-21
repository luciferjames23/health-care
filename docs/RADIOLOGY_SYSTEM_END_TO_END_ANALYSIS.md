# AI Radiology Triage System: End-to-End Analysis

## Executive summary

This repository contains an AI-assisted chest X-ray triage workflow inside a wider hospital application. A doctor places a patient-linked imaging order; a radiologist uploads the requested DICOM; patient, accession, and view checks protect the link; the image is stored in PACS and screened by DenseNet121 and YOLO11n; a combined rule assigns a review priority; and a qualified radiologist records the clinical report. The reviewed result can then be read from the patient workflow.

The AI is a prioritisation aid. It does not make the final diagnosis or replace the radiologist.

## End-to-end flow

```text
Doctor in Patient 360
  └─ Create chest PA/AP order with indication and routine/urgent request priority
       └─ Create accession number and required view records
            └─ Radiologist queue → upload DICOM → verify patient, accession, and view
                 └─ Orthanc PACS stores the source study
                      └─ Inference: DICOM normalization → DenseNet screening + YOLO localization
                           └─ Combined review category → durable radiology result/worklist
                                └─ Radiologist reviews source and overlay, confirms/edits report
                                     └─ Patient-facing clinical workflow shows reviewed result
```

## Components and responsibilities

| Layer | Main implementation | Responsibility |
|---|---|---|
| Clinical UI | React components in `frontend/src/components/` | Patient 360 ordering, X-ray Orders, radiology worklist/analysis, results, diagnostics, history/compare, and report discussions. |
| Hospital API | FastAPI app in `backend/main.py`; `backend/routers/imaging_orders.py` | Authenticated doctor order creation, radiologist upload workflow, order-linked persistence, and mounting radiology/clarification/history APIs. |
| Database | PostgreSQL tables and `backend/migrations/` | Orders, view-level order studies, patient identifiers, scan/result records, and traceable workflow status. |
| Image archive | Orthanc Demo PACS integration | DICOM storage and retrieval; OHIF reads PACS studies through DICOMweb. |
| Inference | `radiology_backend/services/` and integrated copy under `backend/radiology_ai/` | DICOM preprocessing, DenseNet121 screening, YOLO11n opacity localization, overlay generation, and deterministic combined status. |
| Image viewer | OHIF configuration in `radiology_ohif_demo/` | Medical image viewing of PACS-origin studies using the real DICOM Study Instance UID. |

### Two backend paths to be aware of

There are two radiology implementations in the repository. The integrated hospital app mounts radiology routes into the main API (the current app is on port 8000), with order-linked upload behavior in `backend/routers/imaging_orders.py`. There is also a standalone `radiology_backend/` service with its own entrypoint (documented on port 8001). The standalone service is useful for model/API demonstration, but the order lifecycle belongs to the integrated hospital API. Keep this distinction clear in deployment notes and demonstrations; avoid presenting these as two independent clinical result systems.

## Inference and priority logic

1. The DICOM reader applies stored pixel values, rescale slope/intercept, and MONOCHROME1 handling, then produces a display image and the classifier input array.
2. DenseNet121 returns an opacity screening probability. The configured classification threshold is 0.20.
3. YOLO11n localizes candidate regions on the displayed image. The configured localization threshold is 0.10.
4. One deterministic decision function combines those two signals:

| DenseNet signal | YOLO region | Work priority | Meaning |
|---|---|---|---|
| Positive | Present | HIGH PRIORITY | Both signals indicate a finding; rapid radiologist review is recommended. |
| Positive | Absent | REVIEW FLAG | Elevated screening signal; radiologist review is recommended. |
| Negative | Present | REVIEW FLAG | Localized region; radiologist review is recommended. |
| Negative | Absent | ROUTINE | No screening signal detected; routine radiologist interpretation is still required. |

The worklist places unconfirmed studies ahead of confirmed studies, then sorts by triage category and probability. The detail view can show the original image, localized image, model summary, metadata, and review state.

## Safety and workflow controls found in the implementation

- Doctor orders receive an accession and define required projections; PA + AP is represented as one order with separate required views.
- Upload is order-bound and validates DICOM content plus patient and accession consistency. New/unregistered identifiers use an explicit radiologist confirmation path rather than filename inference.
- Upload is considered complete after PACS storage succeeds. Inference is an asynchronous/managed step; an uploaded image is not automatically proof that analysis completed.
- Direct archive-only images do not become patient results without the valid order link.
- Repeated uploads, conflicting patient mappings, and access to order endpoints are guarded in the order workflow.
- The AI priority and localization are kept separate from the radiologist's reviewed report. Final review records reviewer and timestamp.
- Follow-up studies, comparison, and report clarifications have separate traceable flows; clarification does not overwrite the report.
- OHIF visualization is available for PACS-origin studies; a derived localization preview is stored as a separate derived series, not as the source image.

## What the current demo can show

- Doctor/radiologist role separation and a patient-linked order journey.
- DICOM handoff through an Orthanc PACS and access to a PACS study in OHIF.
- Two-model screening, a highlighted localization preview, and a combined review category.
- Priority-ordered radiologist worklist and human report confirmation/editing.
- A shared reviewed result for the clinical workflow, with follow-up and clarification features present in the UI/API.

The live API health endpoints were queried while preparing the video: the main hospital API and the standalone radiology API both responded, and the standalone endpoint reported DenseNet and YOLO loaded. This is a point-in-time local demo observation, not an uptime or deployment guarantee.

## Scope, limits, and readiness notes

- Current documented scope is chest X-ray PA/AP. Do not market this walkthrough as supporting all radiology modalities.
- AI output is triage only. It is not a diagnosis, emergency dispatch, or autonomous report.
- The configuration lists evaluation metrics, including DenseNet ROC AUC 0.85 and YOLO localization results; they are development/evaluation metrics, not claims of clinical validation or sensitivity/specificity. They are intentionally omitted from the short video.
- A production clinical rollout needs local clinical validation, governance-approved thresholds and workflow, model performance monitoring, secure deployment and secrets handling, operational alerting, backup/recovery, and formal sign-off. The repository's demo configuration and local health checks do not establish those controls.
- Documentation describes both the standalone API and the integrated API. Deployment/runbooks should identify the authoritative path and avoid configuration drift between the two copies.

## Short-video creative direction

The accompanying 24-second video uses authentic Hospital UI screenshots embedded in the project radiology case study. It covers the X-ray order queue, PACS studies, AI worklist, review status, and clarification screen. Patient, accession, and staff identifiers are blurred. The source screenshots are static captures, so the video is a motion-edited walkthrough rather than a live browser recording; the interface styling and controls are from the actual application.
