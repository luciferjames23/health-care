# OHIF Viewer - Meridian Demo

This folder adds OHIF as a **demo medical image viewer** for the existing Orthanc Demo PACS. It does not replace the Meridian React AI application and does not change DenseNet/YOLO inference.

## Prerequisites

1. Docker Desktop is running.
2. The existing Orthanc Demo PACS is running on `http://localhost:8042`.
3. Orthanc uses the demo credentials `orthanc / orthanc`.
4. The `jodogne/orthanc-plugins` image is used so the DICOMweb plugin is available at `/dicom-web/`.

## Start OHIF

From this folder:

```powershell
docker compose up -d
```

Then open:

`http://localhost:3000`

The nginx gateway serves OHIF and proxies `/dicom-web` to the existing Orthanc container through `host.docker.internal`, injecting the demo Basic Authentication header. This keeps browser DICOMweb requests same-origin and avoids CORS changes to Orthanc.

## Open a study from Meridian AI

For PACS-origin studies, the Meridian Radiology Worklist and Analysis screen display **Open in OHIF**. The link uses the real DICOM `StudyInstanceUID`:

`http://localhost:3000/viewer?StudyInstanceUIDs=<UID>`

Manual-upload-only studies do not show the OHIF button because they are not necessarily present in Orthanc.

## Stop / restart

```powershell
docker compose stop
docker compose start
```

Do not stop the existing Orthanc container while using OHIF because OHIF reads its images from Orthanc.
