"""Orthanc demo PACS integration.

Retrieves original DICOM studies and publishes stored AI localization previews
as derived Secondary Capture series. It never performs AI inference.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
import requests
import hashlib
import threading
import uuid

_localization_lock = threading.Lock()
AI_SERIES_DESCRIPTION = "AI Localization - Derived Preview"

from radiology_ai import config


class OrthancError(Exception):
    """User-safe Orthanc/PACS integration error."""


@dataclass
class OrthancInstanceRef:
    study_id: str
    series_id: str
    instance_id: str


def _request(method: str, path: str, *, timeout: int = 15, json=None, data=None, headers=None) -> requests.Response:
    url = f"{config.ORTHANC_URL.rstrip('/')}{path}"
    try:
        response = requests.request(
            method,
            url,
            auth=(config.ORTHANC_USERNAME, config.ORTHANC_PASSWORD),
            timeout=timeout,
            json=json,
            data=data,
            headers=headers,
        )
    except requests.RequestException as exc:
        raise OrthancError("Demo PACS is unavailable.") from exc

    if response.status_code == 401:
        raise OrthancError("Demo PACS authentication failed.")
    if response.status_code == 404:
        raise OrthancError("The requested Demo PACS resource was not found.")
    if not response.ok:
        raise OrthancError(f"Demo PACS request failed with status {response.status_code}.")
    return response


def health() -> dict[str, Any]:
    system = _request("GET", "/system").json()
    return {
        "status": "connected",
        "source": "Orthanc Demo PACS",
        "orthanc_name": system.get("Name") or system.get("DicomAet") or "Orthanc",
    }


def get_study(study_id: str) -> dict[str, Any]:
    return _request("GET", f"/studies/{study_id}").json()


def get_series(series_id: str) -> dict[str, Any]:
    return _request("GET", f"/series/{series_id}").json()


def get_instance_file(instance_id: str) -> bytes:
    content = _request("GET", f"/instances/{instance_id}/file", timeout=30).content
    if not content:
        raise OrthancError("The selected PACS instance contains no DICOM data.")
    return content


def get_first_instance_for_study(study_id: str, instance_id: str | None = None) -> OrthancInstanceRef:
    if instance_id:
        instance = _request('GET', f'/instances/{instance_id}').json()
        series_id = instance.get('ParentSeries')
        if not series_id or get_series(series_id).get('ParentStudy') != study_id:
            raise OrthancError('The uploaded image does not belong to this PACS study.')
        return OrthancInstanceRef(study_id=study_id, series_id=series_id, instance_id=instance_id)
    study = get_study(study_id)
    series_ids = study.get("Series") or []
    if not series_ids:
        raise OrthancError("No series were found for this PACS study.")

    # Never feed the derived, burned-in AI preview back into inference.
    originals = [(sid, get_series(sid)) for sid in series_ids]
    originals = [(sid, series) for sid, series in originals
                 if (series.get("MainDicomTags") or {}).get("SeriesDescription") != AI_SERIES_DESCRIPTION]
    if not originals:
        raise OrthancError("No original image series were found for this PACS study.")
    series_id, series = originals[0]
    instance_ids = series.get("Instances") or []
    if not instance_ids:
        raise OrthancError("No DICOM instances were found for this PACS study.")

    return OrthancInstanceRef(study_id=study_id, series_id=series_id, instance_id=instance_ids[0])


def _orthanc_timestamp_to_iso(value: str | None) -> str | None:
    """Convert Orthanc LastUpdate (YYYYMMDDTHHMMSS) to ISO-8601 UTC.

    Orthanc's Docker container records LastUpdate in UTC in this demo setup.
    If parsing fails, the raw value is not exposed as a fake date; callers can
    fall back to their own first-seen timestamp.
    """
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
        return parsed.isoformat()
    except (TypeError, ValueError):
        return None


def get_studies() -> list[dict[str, Any]]:
    study_ids = _request("GET", "/studies").json()
    studies: list[dict[str, Any]] = []

    for study_id in study_ids:
        study = get_study(study_id)
        study_tags = study.get("MainDicomTags") or {}
        patient_tags = study.get("PatientMainDicomTags") or {}
        series_ids = study.get("Series") or []

        modality = None
        body_part = None
        series_description = None
        if series_ids:
            try:
                first_series = get_series(series_ids[0])
                series_tags = first_series.get("MainDicomTags") or {}
                modality = series_tags.get("Modality")
                body_part = series_tags.get("BodyPartExamined")
                series_description = series_tags.get("SeriesDescription")
            except OrthancError:
                # A partially malformed study should still be listable.
                pass

        studies.append({
            "study_id": study_id,
            "patient_id": patient_tags.get("PatientID"),
            "patient_name": patient_tags.get("PatientName"),
            "patient_sex": patient_tags.get("PatientSex"),
            "study_date": study_tags.get("StudyDate"),
            "study_instance_uid": study_tags.get("StudyInstanceUID"),
            "ingested_at": _orthanc_timestamp_to_iso(study.get("LastUpdate")),
            "modality": modality,
            "body_part": body_part,
            "series_description": series_description,
            "series_count": len(series_ids),
        })

    return studies


def ensure_localized_series(record: dict) -> dict:
    """Publish the stored overlay as a separate Secondary Capture series."""
    uid = (record.get("source") or {}).get("study_instance_uid") or (record.get("metadata") or {}).get("study_instance_uid")
    image = (record.get("images") or {}).get("annotated")
    if not uid or not image:
        raise OrthancError("This result needs a PACS study and a stored localized image.")
    digest = hashlib.sha256(image.encode("ascii")).hexdigest()
    seed = f"{uid}:{record['study_id']}:{digest}"
    series_uid = "2.25." + str(uuid.uuid5(uuid.NAMESPACE_URL, seed + ":series").int)
    sop_uid = "2.25." + str(uuid.uuid5(uuid.NAMESPACE_URL, seed + ":instance").int)
    with _localization_lock:
        parents = _request("POST", "/tools/find", json={
            "Level": "Study", "Query": {"StudyInstanceUID": uid}
        }).json()
        if len(parents) != 1:
            raise OrthancError("The original study could not be uniquely located in PACS.")
        existing = _request("POST", "/tools/find", json={
            "Level": "Instance", "Query": {"SOPInstanceUID": sop_uid}
        }).json()
        if not existing:
            _request("POST", "/tools/create-dicom", timeout=30, json={
                "Parent": parents[0], "Force": True,
                "Content": image if image.startswith("data:") else "data:image/png;base64," + image,
                "Tags": {
                    "SOPClassUID": "1.2.840.10008.5.1.4.1.1.7",
                    "SeriesInstanceUID": series_uid, "SOPInstanceUID": sop_uid,
                    "SeriesDescription": AI_SERIES_DESCRIPTION,
                    "SeriesNumber": "900", "InstanceNumber": "1", "Modality": "OT",
                    "ImageType": "DERIVED\\SECONDARY",
                    "ConversionType": "WSD", "BurnedInAnnotation": "YES",
                    "DerivationDescription": "Stored AI localization preview with burned-in boxes; not a diagnostic original.",
                },
            })
    return {"study_instance_uid": uid, "series_instance_uid": series_uid}
