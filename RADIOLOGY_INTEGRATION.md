# Live Radiology PoC integration

This branch preserves the existing healthcare application and adds three non-duplicating views over one live Radiology PoC result source.

- Results & Critical Values: attention/notification view only (HIGH PRIORITY + REVIEW FLAG). It does not run AI.
- Diagnostics: cross-diagnostic imaging status/overview. It does not run AI.
- Radiology / PACS: full live PoC workflow: worklist, manual DICOM analysis, PACS studies, detailed DenseNet/YOLO result and OHIF viewer.

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

The original locked Radiology PoC backend was copied unchanged, including model files, thresholds, inference, decision logic, Orthanc watcher, worklist/viewed behavior and tests. The new healthcare screens only consume its existing API.
