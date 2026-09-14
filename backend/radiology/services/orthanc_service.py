"""Orthanc demo PACS integration.

This module ONLY retrieves DICOM studies/instances from the simulated Orthanc
server. It never performs AI inference; PACS and manual-upload paths converge
into the same run_full_analysis() pipeline in main.py.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
import requests

from .. import config


class OrthancError(Exception):
    """User-safe Orthanc/PACS integration error."""


@dataclass
class OrthancInstanceRef:
    study_id: str
    series_id: str
    instance_id: str


def _request(method: str, path: str, *, timeout: int = 15) -> requests.Response:
    url = f"{config.ORTHANC_URL.rstrip('/')}{path}"
    try:
        response = requests.request(
            method,
            url,
            auth=(config.ORTHANC_USERNAME, config.ORTHANC_PASSWORD),
            timeout=timeout,
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


def get_first_instance_for_study(study_id: str) -> OrthancInstanceRef:
    study = get_study(study_id)
    series_ids = study.get("Series") or []
    if not series_ids:
        raise OrthancError("No series were found for this PACS study.")

    series_id = series_ids[0]
    series = get_series(series_id)
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
