# PA + AP under one accession

Apply `006_multi_study_orders.sql` after migrations 001–005, before starting the updated backend. Stop older API/watcher workers during deployment: the old one-result-per-order writer is incompatible with the new study key. Start all workers from the same code revision after migration. The local development database has been migrated.

The migration is transactional and rerunnable. It preserves existing scans, reports, study UIDs and accession numbers, including unlinked legacy scans. It adds `radiology_order_studies`, backfills a study slot for each old single-view order, and changes result uniqueness from order to acquired study. Legacy `Chest X-ray PA & AP (Both Views)` requests are normalized; the recorded DICOM view identifies their existing result and the absent view remains pending. Do not roll back to the old writer after combined results have been created.

## Workflow

1. Doctor: Patient → X-ray → Examination → **Chest X-ray PA + AP**. This creates one order, one accession, and PA/AP study slots in one transaction. Existing PA-only and AP-only requests remain available.
2. Radiologist: X-ray Orders → Upload X-ray → choose the pending PA or AP study. Upload one original CR/DX DICOM file per study. Both carry the order accession, with distinct StudyInstanceUIDs and matching ViewPosition tags. This feature models two separate DICOM studies; it does not split two series in a shared DICOM study. Patient identity and accession validation still apply.
3. The watcher analyzes the exact uploaded instance for each study through the existing models. Completed results are durable and immutable on retry. Failed analyses remain retryable without replacing a completed sibling result.
4. The combined order becomes ready in AI Worklist only when both study results exist. Each worklist row identifies its projection and shared accession. View Analysis offers PA/AP selection, separate original and localized images, AI details, reports, confirmation, and original/derived OHIF links. Switching studies resets the report editor.
5. Doctor: the patient’s X-ray order lists each study’s status and **View PA/AP result**, including both images, AI details, report and review metadata, and OHIF links. Patient360 scans also carry the individual projection and DICOM UID. Follow-up comparisons retain both views under one examination version. Order-level clarifications snapshot both reports and require both to be reviewed.

## Verification

From `backend`:

```powershell
$env:RUN_DB_INTEGRATION='1'
.venv/Scripts/python.exe -m unittest tests.test_multi_study_orders tests.test_imaging_orders tests.test_radiology_clarifications tests.test_localized_ohif tests.test_radiology_access -q
```

Tests use isolated PostgreSQL schemas or temporary tables and roll back fixtures. PACS/model failures are mocked; no synthetic clinical results are added to the live database. Coverage includes one-accession creation/retry, separate PA/AP persistence and review, readiness gating, upload validation/retry, failed-analysis retry, migration reruns, report snapshots, history, and the existing single-view flow. Run `npm run build` from `frontend`.

Before production rollout, validate two acquired DICOM studies with the deployed model files and PACS/OHIF environment. Automated workflow tests do not establish clinical model performance or production infrastructure readiness.
