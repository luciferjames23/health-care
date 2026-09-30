# Radiology Triage System: Business Context, Full Flow, and Comparison

**Product:** Meridian Healthcare Platform — chest X-ray radiology triage

**Review date:** 29 September 2026  
**Purpose:** Describe the business workflow implemented in this repository from request through follow-up, compare it with the supplied *Radiology Imaging Module: Business Context Document*, and identify the boundaries between implemented capability, code-level risk, and unverified operational claims.

## 1. Executive position

The system is a **chest X-ray triage and review workflow**, not an autonomous diagnostic service. It is designed to give an admitted patient one traceable imaging journey: a doctor requests a PA, AP, or paired PA+AP examination; a radiologist verifies and uploads the DICOM image; the system stores it in Orthanc, runs two AI components when available, and puts the result in a review worklist. A radiologist records the clinical review. The treating doctor can then see the patient-linked result, compare related studies, and ask the radiology team a question through an in-system discussion.

This conclusion is aligned with the supplied business-context document. The workflow has meaningful identity and traceability controls, but it must **not be represented as ready for unrestricted clinical production use** until formal clinical governance, security, and operational validation is complete. No live database, PACS, viewer, model inference, security test, or clinical validation was run for this document.

## 2. What is in scope

| Included now | Not evidenced or not included now |
|---|---|
| Chest X-rays: PA, AP, and one PA+AP order with two required studies | CT, MRI, ultrasound, or other modalities |
| Doctor order, radiologist upload, PACS storage, AI triage, radiologist review | AI diagnosis, autonomous reporting, or clinical emergency escalation |
| Patient/order/accession/view matching before upload | Pager, email, SMS, or patient-facing result notification |
| Radiology worklist, Patient 360/result views, and OHIF links | Billing integration for the radiology request |
| Follow-up grouping, comparison, and clarification discussions | Formal signed-report addenda/version history |

The intended patient cohort is admitted patients, as stated in the supplied document and reflected by the clinical data joins. The ordering route itself checks that the patient exists; it does not independently prove an active admission during order creation. Therefore, “admitted patients only” should be treated as the intended operating scope, not an enforced rule proven here.

## 3. Business problem addressed

| Operational problem | Implemented response | Business value |
|---|---|---|
| A request, image, and report can become disconnected | One order ID and accession number connect request, uploaded study, result, and review | A traceable examination record |
| A DICOM image can be filed against the wrong patient or request | Upload checks patient identity, accession, requested view, DICOM identifiers, and duplicate study reuse | Reduces wrong-patient/wrong-examination risk before analysis |
| Urgent-looking studies can wait in arrival order | AI assigns HIGH PRIORITY, REVIEW FLAG, or ROUTINE and the worklist sorts accordingly | Supports radiologist attention management; it does not change clinical responsibility |
| Doctors must chase answers outside the record | Clarification threads are attached to a report snapshot and retain events/read status | A visible, auditable doctor–radiologist communication channel |
| Follow-up X-rays are hard to assemble | Baseline/follow-up links and a comparison endpoint preserve study lineage | Enables comparison without the system making an improvement/deterioration judgement |

## 4. People, accountability, and system boundaries

| Participant | Business responsibility | System behavior observed in source |
|---|---|---|
| Treating doctor | Request the examination, give indication and urgency, consume the result, compare history, request/resolve clarification | Only the `doctor` role can create an imaging order; doctor access is scoped in several result/history/clarification routes |
| Radiologist | Verify the DICOM-to-patient match, upload the image, review AI output and issue clinical review | Radiologist-only upload and review dependencies; reviewer name and review timestamp are stored |
| Radiology team | Manage unassigned questions and worklist workload | Clarifications without a reporting radiologist are available for radiologist ownership |
| System | Enforce request linkage, store workflow state, calculate screening category, retain selected audit events | Does not diagnose or autonomously notify/escalate a patient condition |
| IT/security and clinical governance | Secure the deployment, control access, validate models locally, set turnaround procedures | These controls are necessary but are not established by repository code alone |

## 5. End-to-end business flow

```text
Doctor selects patient and requests chest X-ray
          ↓
System creates one accession and one or two requested study slots
          ↓
Radiologist receives the order, verifies DICOM identity and uploads
          ↓
Orthanc confirms storage; the order becomes uploaded when all requested views arrive
          ↓
Watcher accepts only order-linked PACS studies and runs AI when models are available
          ↓
AI result is stored and worklist is ranked; radiologist reviews and records report
          ↓
Treating doctor sees patient-linked result, compares related studies, or asks a question
```

### 5.1 Request: doctor starts a controlled examination

From Patient 360/X-ray Orders, the doctor selects the patient, examination (`Chest X-ray PA`, `Chest X-ray AP`, or `Chest X-ray PA + AP`), clinical indication, routine/urgent priority, and optionally a follow-up relationship or clinical problem.

The request carries a client-generated request ID. The backend derives an accession number from it and treats a repeat submission with the same substantive details as a safe retry rather than a duplicate. If that ID is reused with different patient, examination, indication, priority, or follow-up details, the request is rejected.

For PA+AP, the system creates one order/accession and two separate study slots, one for PA and one for AP. This is a two-view examination; it is not a conversion of a single DICOM study into two views.

### 5.2 Queue: radiology receives pending work

Orders have a business state of `Requested` until all required views are uploaded, and `Uploaded` when the examination’s acquisition requirement is met. The radiology screen refreshes its order list every ten seconds. It presents order/patient/requesting-doctor/accession/indication/priority/status information.

The intended business policy is that a doctor sees their own orders and a radiologist sees the departmental queue. This policy should be confirmed during deployment access-control validation.

### 5.3 Upload and identity verification: radiologist connects the acquired image

Only a signed-in radiologist can use the order-upload route. The route accepts one DICOM file up to 30 MB and verifies the following before the study is linked:

- It is a readable CR or DX DICOM image with pixel data and required DICOM UIDs.
- The DICOM accession is blank or matches the order accession. The stored copy receives the order accession.
- The DICOM patient ID matches the patient’s numeric ID or patient code, or an existing unambiguous verified mapping.
- An unfamiliar DICOM patient ID cannot proceed unless the radiologist explicitly confirms it. The mapping stores the reviewer, order, file SHA-256, and selected DICOM demographics.
- A PA/AP view matches the requested slot. PA+AP orders require a DICOM view position.
- The SOP instance and study UID are not already associated with another accession/order.

If Orthanc does not confirm the upload, the acquisition state is reset so that the same file can be retried. A successfully attached image cannot be replaced by a different image through this normal upload flow.

### 5.4 PACS storage and analysis: only linked images enter the patient workflow

Orthanc is the configured demonstration PACS. The background watcher polls it, but first checks whether each PACS study matches an `Uploaded` order-study record. A study placed directly in Orthanc with no qualifying order link is not accepted as a Meridian patient result.

For each eligible uploaded study, the watcher obtains the DICOM, runs the analysis pipeline if both models are available, and saves a durable result against the individual study slot. Failed analysis is recorded as failed and remains retryable; a completed sibling view is not re-analysed merely because another view failed.

For a PA+AP examination, the result worklist is ready only when both uploaded study slots have a result. Each view remains identifiable and reviewable independently.

### 5.5 AI triage: prioritisation, not diagnosis

Two model outputs are combined by a fixed rule:

| DenseNet screening signal | YOLO qualifying highlighted region | Worklist category | Business interpretation |
|---|---|---|---|
| Positive | Present | HIGH PRIORITY | Read first / prompt radiologist review recommended |
| Positive | Absent | REVIEW FLAG | Review recommended |
| Absent | Present | REVIEW FLAG | Review recommended |
| Absent | Absent | ROUTINE | Routine radiologist interpretation is still required |

DenseNet provides a lung-opacity screening probability and YOLO identifies candidate regions. The category and explanatory text are deterministic code, not generated by a language model. The displayed disclaimer states that the result is AI-assisted triage/screening only and that final clinical interpretation belongs to a qualified radiologist.

The configured repository metrics are developer evaluation metrics, not evidence of local clinical performance. The configuration records a YOLO normal-image false-alert figure of 54/200 (27%) in its stated test set. That should inform workload planning only; it is not a claim about this hospital’s patients or operating performance.

### 5.6 Worklist and clinical review: radiologist owns the final result

Results are represented as preliminary while pending review. The radiology worklist sorts category/priority and exposes source image, annotated image, AI finding/summary, patient/order context, and OHIF viewing for PACS studies. The radiologist chooses an allowed review status and can retain or replace the supplied report/finding. The backend stores review status, reviewer name, and timestamp.

### 5.7 Result access: treating-doctor use and cross-module views

The design uses the same result store for the radiology worklist, Diagnostics, Results & Critical Values, and patient-facing clinical workspace views. The latter two are intended as presentation/attention views; they do not independently run AI. A treating doctor should see patient-linked results and individual PA/AP status, then open the image or OHIF viewer where authorised.

The result-access flow describes the intended business operating model. Its deployment must be subject to formal access-control and privacy validation before clinical use.

### 5.8 Follow-up and comparison: preserve clinical context without declaring a result

An order can be created as a follow-up to a prior order for the same patient. The system assigns a root order and sequential study version, retains the clinical problem, and records a follow-up event. It prevents cross-patient links, cycles, out-of-order linkage, and removal of a study that already has later linked studies.

The comparison/history route returns prior/current orders, views, images, reports, dates, and review status. The system does not automatically state that a disease is better or worse. A doctor can correct an incorrect link by separating the order, with the stated reason retained as an event.

### 5.9 Clarification: report questions are a separate auditable conversation

After a reviewed report exists, a treating doctor can open a clarification thread. The thread stores the report snapshot and a fingerprint so a question cannot silently be attached to a changed report. It goes to the reporting radiologist where available, otherwise to the shared radiology queue. Radiologists can claim/answer it; the treating doctor resolves or reopens it. Messages, reads, assignment events, and status changes are retained.

This is not report versioning and does not amend the signed report. It is a communication record about that report.

## 6. Business controls that are present in code

| Control | Evidence in current system | Boundary |
|---|---|---|
| Order idempotency | Repeated identical request IDs return the existing order | Does not prevent a user from creating a separate new order |
| Accession and study linkage | One order accession; unique uploaded study/order association | Depends on database migration and PACS availability |
| Patient identity protection at upload | Patient ID/mapping, accession, view, UID, and duplicate checks | Radiologist confirmation of a new identifier is still a human decision |
| PA+AP completeness | Two study slots; order/result readiness waits for both | Both source images must be acquired and uploaded |
| Safe upload retry | Failed PACS confirmation resets the claim for same-file retry | Does not resolve a prolonged PACS outage |
| AI result consistency | One decision service calculates category and interpretation consumes it | Model performance is not clinically validated here |
| Review metadata | Reviewer and time fields are persisted | Requires operational validation in the deployed environment |
| Follow-up/clarification audit | Link events and clarification messages/events/reads are persisted | Does not provide signed-report amendment/version history |

## 7. Alignment with the supplied business-context document

The supplied document is a useful business baseline, rather than an instruction set. The current repository aligns with its central business description: a controlled chest-X-ray workflow; PA/AP pair handling; AI-assisted, deterministic prioritisation; radiologist-owned final interpretation; and follow-up/clarification support. The present document has deliberately retained only the workflow and business-context comparison, not an inventory of technical observations.

## 8. Readiness statement

The repository should be treated as a controlled demonstration or technical/internal-pilot implementation until clinical governance, local model validation, security controls, deployment operations, and user procedures have been formally assessed. This is a source-based statement, not a certification, penetration test, clinical trial, or deployment assessment.

## 9. Measures leadership should define and monitor

The code and documents do not establish targets or baselines. Clinical and operational leadership should agree targets before interpreting these measures:

- Request-to-upload time and upload-to-radiologist-review time.
- Waiting HIGH PRIORITY, REVIEW FLAG, and ROUTINE studies, including time to first read.
- Percentage of AI categories confirmed, revised, or not confirmed by the radiologist.
- Number of PA+AP examinations awaiting a missing view or missing analysis.
- Failed uploads, failed analyses, PACS availability, and retry volume.
- Identity-check blocks and new patient-ID confirmations.
- Open clarification threads, response time, ownership, and resolution time.
- Report-save failures and duplicate/retry attempts.

## 10. Dependencies, assumptions, and evidence limits

The workflow depends on PostgreSQL migrations/tables, the hospital backend, Orthanc, OHIF, DICOMweb connectivity, AI model files and compute, and trained doctors/radiologists. The repository contains both an embedded radiology implementation (`backend/radiology_ai` and `backend/routers/radiology.py`) and a standalone `radiology_backend` service. The integration documentation says the front end may be configured to use the standalone API on port 8001, while orders/history run through the hospital backend. A deployment must select and test one coherent API/topology; configuration ambiguity is not a clinical workflow feature.

This review read the supplied document and repository source, including the ordering, radiology, history, clarification, authentication, result-store, frontend API, configuration, migration, and test files. It did **not** connect to the hosted database, upload a DICOM, start Orthanc/OHIF, run model inference, inspect a live deployment, or perform clinical/security validation. Consequently, this document intentionally makes no claim about current data, real turnaround times, archive availability, model accuracy in local use, or regulatory compliance.

## 11. Leadership decisions

1. Whether the next stage is test-data demonstration only or a tightly governed pilot after priorities 1–5 are closed.
2. Who owns clinical governance for model thresholds, local validation, false-alert burden, and worklist use.
3. The turnaround targets for urgent and routine cases, and whether HIGH PRIORITY can reorder a live worklist before local validation.
4. The authorised treating-doctor/patient relationship policy to implement.
5. Whether report addenda/versioning, notifications, additional modalities, and billing are future scope—and their sequence.

## 12. Source locations reviewed

- `backend/routers/imaging_orders.py` — order creation, identity validation, upload and PACS linkage.
- `backend/routers/radiology.py` and `backend/radiology_ai/services/study_store.py` — analysis, worklist, review, and durable results.
- `backend/radiology_ai/services/decision_service.py` — deterministic triage category.
- `backend/radiology_ai/services/pacs_watcher_service.py` — order-linked PACS polling/analysis.
- `backend/routers/imaging_history.py` and `backend/routers/radiology_clarifications.py` — follow-up/history and report questions.
- `backend/api/auth_helper.py`, `backend/routers/gold.py`, and `frontend/src/services/radiologyApi.js` — access-control comparison.
- `backend/db/migrations/001_radiology_orders.sql`, `003_order_linked_radiology.sql`, and `006_multi_study_orders.sql` — persisted workflow design.
- `RADIOLOGY_INTEGRATION.md`, `docs/RADIOLOGY_END_TO_END_FLOW.md`, and the supplied business-context document — existing stated business design.
