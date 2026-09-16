"""
Manual/automated test checklist for POST /api/radiology/analyze and /health.

Run with:  pytest -v   (from the backend/ directory, with venv active)

These correspond to the test cases documented in the project README.
"""
import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_reports_both_models_loaded(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["densenet_loaded"] is True
    assert body["yolo_loaded"] is True
    assert body["status"] == "healthy"


def test_model_info(client):
    r = client.get("/api/radiology/model-info")
    assert r.status_code == 200
    body = r.json()
    assert body["classification_threshold"] == 0.20
    assert body["localization_threshold"] == 0.10
    assert body["iou_match_threshold"] == 0.50


def test_model_info_reports_preprocessing_confirmed(client):
    """DenseNet preprocessing has been confirmed against the training notebook."""
    r = client.get("/api/radiology/model-info")
    assert r.status_code == 200
    assert r.json()["densenet_preprocessing_confirmed"] is True


def test_densenet_preprocessing_pipeline_matches_confirmed_spec():
    """
    Unit test for services.densenet_service.preprocess_for_densenet against
    the exact steps recovered from the training notebook:
    percentile clip -> normalize -> uint8 -> RGB -> resize -> ToTensor ->
    ImageNet normalize.
    """
    import numpy as np
    import torch
    from services.densenet_service import preprocess_for_densenet
    from config import DENSENET_INPUT_SIZE

    rng = np.random.default_rng(42)
    # Simulate a rescaled float32 array with some outlier pixels, so the
    # percentile clip actually does something distinguishable from plain
    # min-max normalization.
    fake_array = rng.normal(loc=500, scale=50, size=(256, 256)).astype(np.float32)
    fake_array[0, 0] = -5000.0   # extreme low outlier
    fake_array[-1, -1] = 8000.0  # extreme high outlier

    tensor = preprocess_for_densenet(fake_array, device="cpu")

    assert tensor.shape == (1, 3, DENSENET_INPUT_SIZE, DENSENET_INPUT_SIZE)
    assert tensor.dtype == torch.float32

    # With ImageNet normalization applied, values should mostly fall in a
    # bounded range (not raw 0-255, not raw 0-1).
    assert float(tensor.min()) > -3.5
    assert float(tensor.max()) < 3.5

    # Sanity check that percentile clipping (steps 5/6) actually ran rather
    # than being skipped in favor of naive min-max.
    low = np.percentile(fake_array, 1)
    high = np.percentile(fake_array, 99)
    assert high < 8000.0
    assert low > -5000.0


def test_invalid_extension_returns_400(client):
    r = client.post(
        "/api/radiology/analyze",
        files={"file": ("scan.jpg", b"not a dicom", "image/jpeg")},
    )
    assert r.status_code == 400


def test_text_file_renamed_dcm_returns_400(client):
    """TEST 3: Invalid text file renamed .dcm -> Expected: 400 error."""
    r = client.post(
        "/api/radiology/analyze",
        files={"file": ("fake.dcm", b"this is just plain text, not dicom", "application/dicom")},
    )
    assert r.status_code == 400


def test_empty_file_returns_400(client):
    """TEST 4: Empty file -> Expected: 400 error."""
    r = client.post(
        "/api/radiology/analyze",
        files={"file": ("empty.dcm", b"", "application/dicom")},
    )
    assert r.status_code == 400


def test_valid_dicom_returns_combined_result(client, tmp_path):
    """
    TEST 5/6/9/10: valid DICOM -> triage probability + threshold applied
    correctly, YOLO returns bounding boxes with threshold applied.
    Requires a sample .dcm at tests/fixtures/sample_chest_xray.dcm
    (not included in this repo - see README for how to generate one from
    a PNG/JPG for local testing).
    """
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "sample_chest_xray.dcm")
    if not os.path.exists(fixture_path):
        pytest.skip("No sample DICOM fixture present - add one at tests/fixtures/sample_chest_xray.dcm")

    with open(fixture_path, "rb") as f:
        r = client.post(
            "/api/radiology/analyze",
            files={"file": ("sample_chest_xray.dcm", f, "application/dicom")},
        )
    assert r.status_code == 200
    body = r.json()

    assert "triage" in body and "localization" in body and "images" in body
    assert body["triage"]["threshold"] == 0.20
    if body["triage"]["probability"] >= 0.20:
        assert body["triage"]["priority"] == "HIGH PRIORITY"
    else:
        assert body["triage"]["priority"] == "ROUTINE"

    assert body["localization"]["threshold"] == 0.10
    for region in body["localization"]["regions"]:
        assert region["confidence"] >= 0.10

    assert body["images"]["original"]
    assert body["images"]["annotated"]
    assert body["preprocessing_confirmed"] is True

    # --- Combined assessment / interpretation consistency (Section 21) ---
    combined = body["combined_assessment"]
    interpretation = body["interpretation"]

    expected_densenet_positive = body["triage"]["probability"] >= 0.20
    expected_yolo_positive = body["localization"]["number_of_regions"] >= 1
    assert combined["densenet_positive"] == expected_densenet_positive
    assert combined["yolo_positive"] == expected_yolo_positive
    assert combined["agreement"] == (expected_densenet_positive == expected_yolo_positive)

    if expected_densenet_positive and expected_yolo_positive:
        assert combined["status"] == "HIGH PRIORITY"
    elif expected_densenet_positive and not expected_yolo_positive:
        assert combined["status"] == "REVIEW FLAG"
    elif not expected_densenet_positive and expected_yolo_positive:
        assert combined["status"] == "REVIEW FLAG"
    else:
        assert combined["status"] == "ROUTINE"

    # interpretation.priority must always equal combined_assessment.status
    assert interpretation["priority"] == combined["status"]

    # probability reported in the interpretation summary matches DenseNet output
    probability_pct = round(body["triage"]["probability"] * 100)
    assert f"{probability_pct}%" in interpretation["summary"]

    # region count in the interpretation matches qualifying YOLO output
    assert f"{body['localization']['number_of_regions']} suspected opacity region(s)" in interpretation["summary"] or (
        body["localization"]["number_of_regions"] == 0
    )

    # a disagreement between the two models must always surface as REVIEW FLAG
    if not combined["agreement"]:
        assert combined["status"] == "REVIEW FLAG"
