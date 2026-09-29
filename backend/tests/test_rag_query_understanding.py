from datetime import datetime
from zoneinfo import ZoneInfo
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.rag_access_control import AccessContext, DOCTOR_MODULES
from services.rag_query_understanding import normalize_query, query_understanding_service


class PatientCursor:
    def __init__(self, rows):
        self.rows = rows
        self.sql = ""
        self.params = None

    def execute(self, sql, params):
        self.sql, self.params = sql, params

    def fetchall(self):
        return self.rows


def doctor_context(ids=(10, 11)):
    return AccessContext(7, "doctor", 42, "Cardiology", DOCTOR_MODULES, frozenset(ids))


@pytest.mark.parametrize("raw,expected", [
    ("ravi bp yesterday", "ravi blood pressure yesterday"),
    ("wat is his CBC pls", "what is his complete blood count please"),
    ("dischrge summry", "discharge summary"),
    ("SpO2 and HR", "oxygen saturation and heart rate"),
    ("LFT RFT HbA1c", "liver function test renal function test glycated hemoglobin"),
])
def test_normalization(raw, expected):
    assert normalize_query(raw) == expected


def test_pronoun_uses_only_existing_authorized_session_patient():
    cursor = PatientCursor([])
    result = query_understanding_service.understand("ok and his xray?", doctor_context(), cursor, 10)
    assert result["patient_id"] == 10
    denied = query_understanding_service.understand("ok and his xray?", doctor_context(), cursor, 99)
    assert denied["patient_id"] is None


def test_explicit_out_of_scope_id_is_indistinguishable_not_found():
    result = query_understanding_service.understand("show patient 999 labs", doctor_context(), PatientCursor([]))
    assert result["resolution_status"] == "not_found"
    assert result["candidates"] == []


def test_patient_fuzzy_candidates_are_sql_prefiltered_to_scope():
    cursor = PatientCursor([{
        "id": 10, "patient_code": "MER-PAT-0010", "first_name": "Ravi", "last_name": "Kumar",
        "date_of_birth": None, "latest_visit_date": None,
    }])
    result = query_understanding_service.understand("ravi kumr bp", doctor_context((10,)), cursor)
    assert "p.id = ANY(%s)" in cursor.sql
    assert cursor.params == [[10]]
    assert result["patient_id"] == 10


def test_relative_dates_use_hospital_timezone():
    now = datetime(2026, 9, 28, 12, tzinfo=ZoneInfo("Asia/Kolkata"))
    result = query_understanding_service.understand("bp yesterday", doctor_context(), PatientCursor([]), now=now)
    assert result["date_range"]["start"].startswith("2026-09-27T00:00:00")
    assert result["date_range"]["end"].startswith("2026-09-27T23:59:59")


@pytest.mark.parametrize("query", [
    "Which patients are blocked from discharge?",
    "list the IP patient list",
    "list patient basic details",
    "list IP patient names",
    "list IP patients name alone",
])
def test_collection_queries_do_not_trigger_patient_disambiguation(query):
    cursor = PatientCursor([])
    result = query_understanding_service.understand(query, doctor_context(), cursor)
    assert result["resolution_status"] == "resolved"
    assert result["candidates"] == []
    assert cursor.sql == ""


def test_collection_planner_extracts_multiple_requested_fields():
    result = query_understanding_service.understand(
        "list IP patients with disease, bed, latest vitals and pending bill",
        doctor_context(), PatientCursor([]),
    )
    assert result["collection_request"] is True
    assert {"diagnosis", "location", "vitals", "billing"}.issubset(result["requested_fields"])


def test_collection_followup_reuses_only_scoped_prior_result_ids():
    prior = {"patient_ids": [10, 11], "last_query_plan": {"intent": "list"}}
    result = query_understanding_service.understand(
        "with their clinical problems", doctor_context(), PatientCursor([]),
        conversation_collection=prior,
    )
    assert result["collection_request"] is True
    assert result["collection_followup"] is True
    assert result["collection_patient_ids"] == [10, 11]
    assert "diagnosis" in result["requested_fields"]


def test_messy_query_eval_corpus_has_at_least_200_cases():
    names = ["ravi", "rajesh", "meena", "kumar", "anitha"]
    clinical = ["bp", "cbc", "hb", "xray", "suger", "dischrge summry", "meds", "bill"]
    dates = ["today", "yesterday", "last week", "latest", ""]
    corpus = [f"{name} {term} {date}".strip() for name in names for term in clinical for date in dates]
    assert len(corpus) >= 200
    for query in corpus:
        normalized = normalize_query(query)
        assert normalized
        assert "dischrge" not in normalized
        assert "suger" not in normalized
