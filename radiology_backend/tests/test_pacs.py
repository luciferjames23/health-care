import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
import main
from main import app
from services.orthanc_service import OrthancError, OrthancInstanceRef


@pytest.fixture
def client(monkeypatch):
    # Avoid loading actual model weights for PACS route unit tests.
    monkeypatch.setattr(main, "load_densenet_model", lambda device: object())
    monkeypatch.setattr(main, "load_yolo_model", lambda device: object())
    # The background watcher is tested independently; route tests should not
    # start a real Orthanc polling thread.
    monkeypatch.setattr(main, "start_watcher", lambda *args, **kwargs: None)
    monkeypatch.setattr(main, "stop_watcher", lambda: None)
    with TestClient(app) as c:
        yield c


def test_pacs_health_endpoint(client, monkeypatch):
    monkeypatch.setattr(main, "orthanc_health", lambda: {
        "status": "connected", "source": "Orthanc Demo PACS", "orthanc_name": "Orthanc"
    })
    r = client.get("/api/pacs/health")
    assert r.status_code == 200
    assert r.json()["status"] == "connected"


def test_pacs_study_listing(client, monkeypatch):
    monkeypatch.setattr(main, "orthanc_get_studies", lambda: [{
        "study_id": "study-1",
        "patient_id": "patient-1",
        "patient_name": "patient-1",
        "patient_sex": "M",
        "study_date": "19010101",
        "study_instance_uid": "1.2.3",
        "modality": "CR",
        "body_part": "CHEST",
        "series_description": "view: PA",
        "series_count": 1,
        "ingested_at": "2026-09-11T05:11:08+00:00",
    }])
    monkeypatch.setattr(main, "get_pacs_watcher_status", lambda _: {
        "ingested_at": "2026-09-11T05:11:08+00:00",
        "analysis_status": "ANALYZED",
        "analysis_error": None,
        "analyzed_at": "2026-09-11T05:12:00+00:00",
    })
    r = client.get("/api/pacs/studies")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "Orthanc Demo PACS"
    assert body["studies"][0]["modality"] == "CR"
    assert body["studies"][0]["ingested_at"] == "2026-09-11T05:11:08+00:00"
    assert body["studies"][0]["analysis_status"] == "ANALYZED"


def test_pacs_analyze_reuses_shared_inference(client, monkeypatch):
    ref = OrthancInstanceRef("study-1", "series-1", "instance-1")
    monkeypatch.setattr(main, "get_first_instance_for_study", lambda _: ref)
    monkeypatch.setattr(main, "orthanc_get_study", lambda _: {"MainDicomTags": {"StudyInstanceUID": "1.2.3"}})
    monkeypatch.setattr(main, "get_instance_file", lambda _: b"dicom-bytes")

    calls = {"count": 0}

    def fake_analysis(file_bytes, densenet_model, yolo_model, device):
        calls["count"] += 1
        assert file_bytes == b"dicom-bytes"
        return {
            "study_id": "analysis-1",
            "metadata": {},
            "triage": {"probability": 0.33, "threshold": 0.2, "priority": "HIGH PRIORITY"},
            "localization": {"opacity_detected": True, "threshold": 0.1, "number_of_regions": 1, "regions": []},
            "combined_assessment": {"status": "HIGH PRIORITY", "densenet_positive": True, "yolo_positive": True, "agreement": True, "reason": "test"},
            "interpretation": {"finding": "test", "summary": "test", "assessment": "test", "priority": "HIGH PRIORITY", "recommended_action": "test", "disclaimer": "test"},
            "images": {"original": "abc", "annotated": "abc"},
            "disclaimer": "test",
            "preprocessing_confirmed": True,
        }

    monkeypatch.setattr(main, "run_full_analysis", fake_analysis)
    monkeypatch.setattr(main, "save_study", lambda _: None)

    r = client.post("/api/pacs/analyze/study-1")
    assert r.status_code == 200
    body = r.json()
    assert calls["count"] == 1
    assert body["source"] == {
        "type": "demo_pacs",
        "system": "Orthanc",
        "study_id": "study-1",
        "series_id": "series-1",
        "instance_id": "instance-1",
        "study_instance_uid": "1.2.3",
    }


def test_pacs_unavailable_returns_503(client, monkeypatch):
    def fail():
        raise OrthancError("Demo PACS is unavailable.")
    monkeypatch.setattr(main, "orthanc_health", fail)
    r = client.get("/api/pacs/health")
    assert r.status_code == 503
    assert "unavailable" in r.json()["detail"].lower()


def test_pacs_no_series_returns_error(client, monkeypatch):
    def fail(_):
        raise OrthancError("No series were found for this PACS study.")
    monkeypatch.setattr(main, "get_first_instance_for_study", fail)
    r = client.post("/api/pacs/analyze/study-1")
    assert r.status_code == 502
    assert "no series" in r.json()["detail"].lower()


def test_pacs_no_instances_returns_error(client, monkeypatch):
    def fail(_):
        raise OrthancError("No DICOM instances were found for this PACS study.")
    monkeypatch.setattr(main, "get_first_instance_for_study", fail)
    r = client.post("/api/pacs/analyze/study-1")
    assert r.status_code == 502
    assert "no dicom instances" in r.json()["detail"].lower()
