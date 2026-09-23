# Radiology Integration

This branch preserves the existing healthcare application and adds three non-duplicating views over one Radiology result source.

- Results & Critical Values: attention/notification view only (HIGH PRIORITY + REVIEW FLAG). It does not run AI.
- Diagnostics: cross-diagnostic imaging status/overview. It does not run AI.
- Radiology / PACS: full workflow: worklist, manual DICOM analysis, PACS studies, detailed DenseNet/YOLO result and OHIF viewer.

## Services

Existing healthcare backend remains unchanged and runs as before.

Radiology backend is isolated in `radiology_backend/` to avoid changing the existing Databricks backend logic.

Start it separately on port 8001:

```bash
cd radiology_backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

The frontend defaults to `http://localhost:8001` for Radiology. Override with:

```env
VITE_RADIOLOGY_API_URL=http://localhost:8001
VITE_OHIF_URL=http://localhost:3000
```

For Demo PACS + OHIF, use the included `radiology_ohif_demo/` Docker Compose setup per its README.

## Important

The original locked Radiology backend was copied unchanged, including model files, thresholds, inference, decision logic, Orthanc watcher, worklist/viewed behavior and tests. The new healthcare screens only consume its existing API.

## Doctor X-ray order workflow

1. Click a Doctor account to sign in automatically on this computer. The server issues a signed session using that active account’s database role; no password entry is required.
2. Open a patient from Clinical Workspace or Patients, then use **Patient 360 → Request an X-ray**. Choose chest PA/AP, priority, and a clinical indication.
3. Radiologist sign-in opens **Radiology → X-ray Orders**. The queue refreshes every 10 seconds and shows the patient, requesting doctor, accession, indication, priority, and status.
4. Choose **Upload X-ray**, verify the patient, and upload a CR/DX DICOM file (maximum 30 MB). PatientID must match the patient code or numeric patient ID; AccessionNumber must be blank or match the displayed order accession. The backend adds a blank accession before sending the file to Orthanc, preserving the original patient identity, image pixels, and study identifiers.
5. The order changes to Uploaded only after Orthanc confirms storage. Use **Open in OHIF** on the order. The existing PACS watcher handles analysis when its models are available; successful upload does not itself imply completed AI analysis.

The sidebar modules remain unchanged. Doctors can read their own orders, Radiologists can see the queue and upload, and other roles cannot access these order endpoints. Requests are stored in `radiology_orders`; apply `backend/db/migrations/001_radiology_orders.sql` on any additional deployment database. That migration has been applied to the connected development database.

Validation: `python -m unittest discover -s tests -p test_imaging_orders.py` from `backend`. Set `RUN_DB_INTEGRATION=1` to also run the PostgreSQL workflow test, which uses a temporary order table and rolls back; Orthanc is mocked so this test creates no real clinical orders or PACS images.


### Registering a new DICOM patient identifier

Apply `backend/db/migrations/001_radiology_orders.sql` followed by
`backend/db/migrations/002_radiology_patient_identifiers.sql` to the configured database.
When an order upload contains an unregistered PatientID, the radiologist sees the DICOM
identity beside the order and must verify the source/acquisition record before confirming.
Confirmation registers the identifier with the authenticated reviewer, timestamp, order,
and SHA-256 of the submitted file. The DICOM PatientID and pixels remain unchanged.
Existing mappings to another patient, conflicting accessions, and duplicate studies remain
blocked. Registration commits with the upload claim; a PACS failure permits retrying the
same file without losing the audit record. This does not infer identity from a filename.


### Order-only patient results

Apply migration `003_order_linked_radiology.sql` after migrations 001 and 002.
It archives scans without an uploaded order in `radiology_scan_legacy_archive`,
removes them from the active table, and requires one unique order link per active scan.
The local migration preserved the existing uploaded order and archived 121 legacy rows.

Workflow: doctor requests an X-ray for the selected patient; radiologist selects that
order and uploads the verified DICOM; Orthanc stores it; the watcher analyzes only
studies linked to completed order uploads; the radiologist reviews the durable result.
Worklist, Diagnostics, Results and OHIF share that order's patient and accession.
Unlinked uploads made directly through Orthanc remain in PACS and are not patient
results. Upload through X-ray Orders to establish the requested examination link.
The random population scripts are retired. The optional port-8001 API delegates to
the hospital API so it cannot create an independent set of results.
