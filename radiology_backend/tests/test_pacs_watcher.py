import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.pacs_watcher_service as watcher


def _reset_states():
    with watcher._lock:
        watcher._states.clear()


def test_new_pacs_study_is_analyzed_once_and_marked_analyzed(monkeypatch):
    _reset_states()
    monkeypatch.setattr(watcher, "get_studies", lambda: [{
        "study_id": "orthanc-study-1",
        "ingested_at": "2026-09-11T05:11:08+00:00",
    }])

    calls = []

    def analyze(study_id, ingested_at):
        calls.append((study_id, ingested_at))

    watcher.scan_once(analyze)
    watcher.scan_once(analyze)

    assert calls == [("orthanc-study-1", "2026-09-11T05:11:08+00:00")]
    status = watcher.get_status("orthanc-study-1")
    assert status["analysis_status"] == "ANALYZED"
    assert status["analysis_error"] is None
    assert status["analyzed_at"] is not None


def test_failed_analysis_is_visible_in_pacs_status(monkeypatch):
    _reset_states()
    monkeypatch.setattr(watcher, "get_studies", lambda: [{
        "study_id": "orthanc-study-bad",
        "ingested_at": "2026-09-11T05:20:00+00:00",
    }])

    def analyze(_study_id, _ingested_at):
        raise RuntimeError("synthetic inference failure")

    watcher.scan_once(analyze)

    status = watcher.get_status("orthanc-study-bad")
    assert status["analysis_status"] == "FAILED"
    assert "synthetic inference failure" in status["analysis_error"]


def test_ingestion_timestamp_falls_back_to_first_seen_time(monkeypatch):
    _reset_states()
    monkeypatch.setattr(watcher, "get_studies", lambda: [{
        "study_id": "orthanc-study-no-time",
        "ingested_at": None,
    }])

    watcher.scan_once(lambda *_: None)
    status = watcher.get_status("orthanc-study-no-time")
    assert status["ingested_at"] is not None
    assert status["analysis_status"] == "ANALYZED"
