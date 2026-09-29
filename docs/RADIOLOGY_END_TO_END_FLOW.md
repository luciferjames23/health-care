# Radiology Workflow Overview

**Audience:** Team Leads, Management, and Executive Leadership  
**Purpose:** Explain how an X-ray moves from a doctor’s request to a reviewed result, without technical implementation detail.

## Executive summary

The radiology module provides one controlled journey for chest X-rays. A doctor requests an examination for a named patient; a radiologist verifies and uploads the acquired image; the system stores it in the imaging archive, produces an AI-assisted screening result, and routes it for radiologist review. The treating doctor then sees the final reviewed result in the patient record.

An image is not treated as a patient result simply because it exists in the image archive. It must be linked to a valid doctor request and pass patient and examination checks. This reduces the risk of an image or report being attached to the wrong patient.

AI supports prioritisation; it does not replace the radiologist. Final clinical interpretation remains the responsibility of a qualified radiologist.

## The journey at a glance

```text
Doctor requests X-ray
        ↓
Radiologist receives request and uploads verified image
        ↓
Patient, examination, and image view are checked
        ↓
Image is stored and screened by AI
        ↓
Radiologist reviews images and records the final report
        ↓
Treating doctor sees result in Patient 360
        ↓
Doctor compares prior studies or requests clarification if needed
```

## 1. Doctor request

From the patient record, the doctor selects:

- Examination: PA view, AP view, or both PA and AP views.
- Clinical reason for the X-ray.
- Priority: routine or urgent.
- New clinical problem or follow-up to an earlier examination.

The system creates one traceable request with a unique accession number. This reference follows the examination from the doctor request to image upload, final report, and patient record.

For a PA + AP request, both images belong to one examination but are handled as separate required views. The examination is complete only when both views have been uploaded and analysed.

## 2. Radiologist queue and upload

Radiologists see a dedicated X-ray order queue containing the patient, requesting doctor, clinical indication, urgency, requested view, and current status.

Before the radiologist can upload an image, the system checks that it is a supported X-ray with image data and that it matches the selected patient, requested examination, accession number, and PA/AP view. It also stops an image from being reused for a different patient request.

If the image uses a new patient identifier, the radiologist must explicitly confirm the match. The system records who made that confirmation and when. If image storage fails, the request can be safely retried without creating a duplicate request.

## 3. Image archive and AI-assisted screening

After the image archive confirms storage, the system automatically prepares it for review. AI provides two forms of support:

- An elevated lung-opacity screening signal.
- Highlighted image regions that may need attention.

These signals are combined into one work priority:

| Priority | Meaning |
|---|---|
| High Priority | Both screening signals suggest a possible finding; rapid radiologist review is recommended. |
| Review Flag | One screening signal needs attention; radiologist review is recommended. |
| Routine | No screening signal was detected; routine radiologist interpretation is still required. |

The result includes the original image, a highlighted image, a preliminary AI summary, and suggested next action. It is a triage aid, not a diagnosis.

Images placed directly in the image archive without an approved X-ray request remain archive images only. They do not become patient results in the hospital application.

## 4. Radiologist review and final report

Completed studies appear in the radiology worklist, with higher-priority cases displayed first. The radiologist can inspect the original image, highlighted image, AI screening output, patient/request context, and the full medical image viewer.

The radiologist then records the final review status, findings, and report. The system retains the reviewer identity and review time alongside the result.

The radiologist’s reviewed report is the clinical result available to the care team. The AI result guides attention but is not the final diagnosis.

## 5. Doctor access and operational views

The treating doctor sees the patient’s X-ray requests and completed results in Patient 360. Each requested view shows whether it is uploaded, awaiting analysis, analysed, or radiologist-reviewed. The doctor can open the report and image viewer when authorised.

The hospital also provides:

- A Diagnostics overview for imaging status.
- A priority-focused results view for high-priority and review-flagged studies.
- A radiology worklist for departmental review.

All views use the same underlying result, preventing separate or conflicting versions of the report.

## 6. Follow-up and comparison

Doctors can identify an X-ray as a new baseline or a follow-up for the same clinical problem. A follow-up receives its own request, image, report, and accession, while remaining linked to the baseline for comparison.

The History/Compare view presents relevant earlier and later images, reports, dates, views, and review status. It does not automatically declare that a condition has improved or deteriorated; that remains a clinical judgement.

If an examination has been linked incorrectly, the doctor can separate it, with the change retained in the audit trail.

## 7. Report clarification

Once a report has been reviewed, a treating doctor can open an in-system clarification discussion.

1. The doctor selects the report and enters a question.
2. The system saves a snapshot of the report being questioned.
3. The request goes to the reporting radiologist when known, or the shared radiology queue.
4. A radiologist responds or takes ownership.
5. The doctor can resolve or reopen the discussion.

Messages, read acknowledgements, ownership changes, and resolution actions are retained. The discussion does not overwrite the original report and is not a patient messaging channel.

## 8. Roles and accountability

| Role | Responsibility |
|---|---|
| Treating doctor | Requests imaging, states clinical need/urgency, consumes results, compares history, and asks for clarification. |
| Radiologist | Verifies image-to-patient matching, uploads the correct image, issues the final report, and responds to discussions. |
| Radiology team | Manages the departmental queue and unassigned clarification requests. |
| System | Enforces checks, retains traceability, prioritises AI screening output, and limits access to authorised staff. |
| Management | Monitors workload, turnaround, priority cases, service availability, and adoption. |

## 9. Key patient-safety controls

- Every clinical result must be linked to a named patient and doctor request.
- Patient identity, requested examination, image view, and accession are checked before upload.
- New image identifiers need explicit radiologist confirmation.
- Duplicate or conflicting studies are blocked.
- PA + AP requests are incomplete until both views are available.
- Failed uploads can be retried safely.
- Only authorised doctors and radiologists can access results and discussions.
- Follow-up links and discussions are auditable.
- AI is not a substitute for radiologist judgement.

## 10. What management should monitor

- Requests awaiting image upload, analysis, and radiologist review.
- Turnaround time from request to upload and from upload to review.
- High-priority and review-flagged cases awaiting action.
- PA + AP examinations waiting for a missing view.
- Upload/analysis failures and image-service availability.
- Open clarification discussions and response time.

## Scope and limitations

The current workflow supports chest X-rays using PA and AP views. The priority category is AI-assisted screening, not a diagnosis or formal emergency escalation process. A safe clinical rollout requires radiologist governance, local validation, staff training, agreed turnaround-time procedures, and reliable operation of the database, imaging archive, viewer, and AI service.

## Outcome

The module creates a single, traceable route from a doctor’s request to a reviewed patient result. It improves visibility for doctors, helps radiologists organise their workload, supports safe handling of PA/AP examinations and follow-up studies, and keeps report questions in an auditable clinical workflow.
