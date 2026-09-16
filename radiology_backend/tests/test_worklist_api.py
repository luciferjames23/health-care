"""
End-to-end tests for the Radiology Worklist API, exercising the real
FastAPI app, real models, and the actual in-memory study store - not
synthetic data. Mirrors the acceptance test in the feature brief:
analyze several X-rays, confirm they appear in the worklist, confirm a
saved study can be reopened without re-running inference, and confirm the
existing /api/radiology/analyze response contract is unchanged.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def sample_dicom_bytes():
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "sample_chest_xray.dcm")
    if not os.path.exists(fixture_path):
        pytest.skip("No sample DICOM fixture present.")
    with open(fixture_path, "rb") as f:
        return f.read()


def _analyze(client, dicom_bytes, filename="sample_chest_xray.dcm"):
    r = client.post(
        "/api/radiology/analyze",
        files={"file": (filename, dicom_bytes, "application/dicom")},
    )
    assert r.status_code == 200
    return r.json()


def test_analyze_response_contract_unchanged_by_worklist_feature(client, sample_dicom_bytes):
    """
    The existing /api/radiology/analyze response must not gain the new
    worklist-only fields (analyzed_at, source_filename) - those are only
    ever added to the STORED copy, as a side effect, not to what the caller
    who triggered the analysis receives.
    """
    body = _analyze(client, sample_dicom_bytes)
    assert "analyzed_at" not in body
    assert "source_filename" not in body
    # Original contract fields still present
    for key in ["study_id", "triage", "localization", "combined_assessment",
                "interpretation", "images", "disclaimer", "preprocessing_confirmed"]:
        assert key in body


def test_analyzed_study_appears_in_worklist(client, sample_dicom_bytes):
    body = _analyze(client, sample_dicom_bytes)
    study_id = body["study_id"]

    r = client.get("/api/radiology/worklist")
    assert r.status_code == 200
    worklist = r.json()

    study_ids = [item["study_id"] for item in worklist["studies"]]
    assert study_id in study_ids
    assert worklist["counts"]["total"] >= 1


def test_worklist_counts_match_studies_breakdown(client, sample_dicom_bytes):
    _analyze(client, sample_dicom_bytes)
    r = client.get("/api/radiology/worklist")
    worklist = r.json()

    recomputed = {"HIGH PRIORITY": 0, "REVIEW FLAG": 0, "ROUTINE": 0}
    for item in worklist["studies"]:
        recomputed[item["combined_assessment"]["status"]] += 1

    assert worklist["counts"]["total"] == len(worklist["studies"])
    assert worklist["counts"]["high_priority"] == recomputed["HIGH PRIORITY"]
    assert worklist["counts"]["review_flag"] == recomputed["REVIEW FLAG"]
    assert worklist["counts"]["routine"] == recomputed["ROUTINE"]


def test_view_analysis_reopens_saved_study_without_rerunning_inference(client, sample_dicom_bytes):
    original = _analyze(client, sample_dicom_bytes)
    study_id = original["study_id"]

    r = client.get(f"/api/radiology/studies/{study_id}")
    assert r.status_code == 200
    reopened = r.json()

    # Same study, same already-computed values - not recalculated
    assert reopened["study_id"] == study_id
    assert reopened["triage"]["probability"] == original["triage"]["probability"]
    assert reopened["localization"]["number_of_regions"] == original["localization"]["number_of_regions"]
    assert reopened["combined_assessment"] == original["combined_assessment"]
    assert reopened["interpretation"] == original["interpretation"]
    assert reopened["images"]["original"] == original["images"]["original"]
    assert reopened["images"]["annotated"] == original["images"]["annotated"]

    # Plus the worklist-only bookkeeping fields
    assert "analyzed_at" in reopened
    assert reopened["source_filename"] == "sample_chest_xray.dcm"


def test_unknown_study_id_returns_404(client):
    r = client.get("/api/radiology/studies/does-not-exist")
    assert r.status_code == 404


def test_worklist_thumbnail_present_and_no_bounding_box_clutter(client, sample_dicom_bytes):
    """Section 10: worklist rows should not be overcrowded with bounding-box coordinates."""
    _analyze(client, sample_dicom_bytes)
    r = client.get("/api/radiology/worklist")
    worklist = r.json()
    item = worklist["studies"][0]

    assert item["thumbnail"]
    assert "regions" not in item["localization_summary"]
    assert "number_of_regions" in item["localization_summary"]
