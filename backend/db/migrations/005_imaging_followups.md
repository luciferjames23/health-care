# Clinical problem and follow-up X-ray history

Apply `005_imaging_followups.sql` before deploying the new API. The migration is rerunnable and adds linkage metadata and an audit table. Every existing order remains an independent V1 baseline until a treating doctor explicitly links it. No images, study UIDs, reports, clarification threads, or existing patient assignments are modified by the migration.

## Workflow

1. In Patient360 → X-Ray, choose **New problem / new baseline** or a **Follow-up** of an existing order. A new baseline may have a problem name; otherwise its clinical indication supplies the label.
2. A follow-up inherits the baseline's problem and receives the next study number. Each request still has a separate accession, upload, PACS study, radiologist review, and discussion.
3. Diagnoses groups order cards by clinical problem. **History / compare** shows all authorized linked examinations, with selectors for an earlier and later study, image previews, reports, review state, dates, and original OHIF links. Different projections are identified. No automated claim of improvement or deterioration is made.
4. Existing independent orders can be linked using **History / compare → Link this existing examination to an earlier study**. Link oldest to newest; provide a reason confirming the same clinical problem. Matching exam names or indication text never automatically group orders.
5. A doctor can separate the latest follow-up if linked incorrectly, with an audited reason. Separate later follow-ups first. The study remains intact as an independent baseline.

V1/V2 are clinical-history study numbers, not DICOM object versions or report revisions. DICOM studies retain separate identities (see https://dicom.nema.org/medical/dicom/2023b/output/chtml/part05/chapter_9.html). This is an application-level clinical grouping, not a claim of FHIR conformance.

## API and safeguards

- Existing POST `/api/imaging-orders` accepts optional `follow_up_of` and `clinical_problem`; older clients can omit both.
- GET `/{order_id}/history` and GET `/{order_id}/comparison?prior_order_id=...` use active, authenticated doctor/radiologist sessions and patient/order access checks. Comparisons require the same patient and root clinical problem and an earlier prior study.
- POST `/{order_id}/follow-up` links independent existing orders; POST `/{order_id}/separate-problem` corrects a latest follow-up link. These writes are doctor-only and audit the actor, prior reference, reason, and database time.
- A patient-scoped transaction advisory lock serializes creation and relinking. An episode/version unique index prevents duplicate numbering. Retries preserve existing orders instead of allocating another study number.

## Verification

Run `python -m unittest tests.test_imaging_history.ImagingHistoryTests tests.test_radiology_clarifications tests.test_radiology_access -v` from `backend`. New tests use a uniquely named PostgreSQL schema and roll all fixtures back. The existing `tests.test_imaging_orders.DatabaseOrderFlowTests` can be enabled with `RUN_DB_INTEGRATION=1` to exercise request, upload, analysis persistence, review, and retry using rollback-only tables and a mocked PACS.
