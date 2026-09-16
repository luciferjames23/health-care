from services import study_store


def test_mark_viewed_preserves_ai_fields(monkeypatch):
    monkeypatch.setattr(study_store, "_studies", {})
    monkeypatch.setattr(study_store, "_order", [])
    monkeypatch.setattr(study_store, "_next_display_number", 1)

    record = {
        "study_id": "study-1",
        "combined_assessment": {"status": "HIGH PRIORITY"},
        "triage": {"probability": 0.95},
    }
    study_store.save_study(record)

    updated = study_store.mark_study_viewed("study-1", "2026-09-11T12:00:00+00:00")

    assert updated is not None
    assert updated["viewed"] is True
    assert updated["viewed_at"] == "2026-09-11T12:00:00+00:00"
    assert updated["combined_assessment"]["status"] == "HIGH PRIORITY"
    assert updated["triage"]["probability"] == 0.95

    # Reopening does not overwrite the original first-view timestamp.
    updated_again = study_store.mark_study_viewed("study-1", "2026-09-11T12:05:00+00:00")
    assert updated_again["viewed_at"] == "2026-09-11T12:00:00+00:00"
