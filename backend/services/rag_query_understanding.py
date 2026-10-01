"""Deterministic, authorization-first understanding for clinical RAG queries.

Patient resolution is deliberately performed only after an AccessContext exists and
only over the patient IDs in that context.  This module never performs an unscoped
"did you mean" lookup for a non-admin user.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, asdict
from datetime import datetime, time, timedelta
from difflib import SequenceMatcher
from typing import Any, Dict, Iterable, List, Optional
from zoneinfo import ZoneInfo

from services.rag_access_control import AccessContext


ABBREVIATIONS = {
    "bp": "blood pressure", "hr": "heart rate", "spo2": "oxygen saturation",
    "hb": "hemoglobin", "cbc": "complete blood count", "lft": "liver function test",
    "rft": "renal function test", "hba1c": "glycated hemoglobin", "ip": "inpatient",
    "op": "outpatient", "opd": "outpatient", "dc": "discharge", "uhid": "patient identifier",
    "mrn": "medical record number", "usg": "ultrasound", "ct": "computed tomography",
    "mri": "magnetic resonance imaging", "ecg": "electrocardiogram",
}

SPELLING = {
    "wat": "what", "dischrge": "discharge", "summry": "summary", "pls": "please",
    "pateint": "patient", "patinet": "patient", "patint": "patient", "partient": "patient",
    "urget": "urgent", "urgnt": "urgent",
    "requsts": "requests", "requset": "request", "reqest": "request", "reqsts": "requests",
    "suger": "sugar", "haemoglobin": "hemoglobin",
    "clarfication": "clarification", "clarifcation": "clarification",
    "clarificationi": "clarification", "clarificationsi": "clarifications", "clarificaiton": "clarification",
    "calrification": "clarification", "calrifications": "clarifications",
    "clarifacation": "clarification", "clarifaction": "clarification",
    "clarificarification": "clarification",
    "analysed": "analyzed",
    "xrqy": "xray",
    "routin": "routine", "routne": "routine",
    "admisssion": "admission", "admisson": "admission",
}

MODULE_TERMS = {
    "vitals": {"blood pressure", "heart rate", "oxygen saturation", "temperature", "vitals", "abnormal vitals", "abnormal vital signs", "critical vitals", "desaturation", "tachycardia", "bradycardia", "hypertension", "fever"},
    "lab": {"lab", "labs", "complete blood count", "hemoglobin", "sugar", "glucose", "liver function test", "renal function test", "glycated hemoglobin", "troponin", "ck-mb", "cardiac markers", "potassium", "electrolyte", "electrolytes", "lipid", "creatinine", "abnormal lab", "critical lab", "result", "results", "investigation", "investigations", "workup", "crp", "cbc", "diagnostic orders"},
    "radiology_report": {"xray", "x ray", "radiology", "computed tomography", "magnetic resonance imaging", "ultrasound", "scan", "chest xray", "chest x-ray", "echo", "echocardiogram", "radiologist report", "ai preliminary", "ai screening", "imaging", "imaging orders"},
    "radiology_clarification": {"clarification", "clarifications", "thread", "threads", "radiology clarification", "clarification message", "clarification messages"},
    "bill": {"bill", "billing", "payment", "balance", "amount", "clearance", "financial clearance"},
    "discharge": {"discharge", "discharge summary", "readiness", "handover", "clearance", "pending discharge", "blocked discharge"},
    "medications": {"medicine", "medicines", "medication", "medications", "drug", "drugs", "dose", "dosage", "prescription", "prescriptions", "antiplatelet", "anticoagulant", "aspirin", "clopidogrel", "heparin", "antihypertensive"},
    "diagnosis": {"diagnosis", "diagnoses", "all diagnoses", "diagnosis list", "diagnosed", "primary diagnosis", "dx", "condition", "problem", "progression", "reason for admission"},
}

# Canonical information model used by the planner. New synonyms map to stable
# fields; retrieval code consumes fields rather than matching whole questions.
FIELD_TERMS = {
    "name": {"name", "names", "patient", "patients"},
    "basic": {"basic", "details", "demographics", "age", "gender", "identifier"},
    "diagnosis": {"diagnosis", "diagnoses", "all diagnoses", "diagnosis list", "dx", "disease", "diseases", "clinical problem", "clinical problems", "problem", "problems", "condition"},
    "admission_date": {"admission date", "admitted date", "date of admission", "when admitted", "admission dates"},
    "reason": {"admission reason", "reason for admission", "why admitted", "clinical indication"},
    "admission": {"admission date", "admission reason", "date of admission", "reason for admission", "admission details", "when admitted"},
    "location": {"bed", "beds", "room", "rooms", "ward", "wards", "location", "unit"},
    "vitals": {"vitals", "blood pressure", "heart rate", "oxygen saturation", "temperature", "abnormal vitals", "abnormal", "critical"},
    "labs": {"lab", "labs", "complete blood count", "hemoglobin", "glucose", "sugar", "test results", "abnormal lab", "critical lab", "result", "results", "investigation", "investigations", "workup", "crp", "cbc"},
    "medications": {"medicine", "medicines", "medication", "medications", "drug", "drugs", "prescription", "prescriptions", "dose"},
    "billing": {"bill", "billing", "balance", "payment", "clearance", "outstanding"},
    "radiology": {"xray", "x ray", "radiology", "scan", "final report", "imaging", "urgent xray", "pending xray"},
    "clarification": {"clarification", "clarifications", "message", "messages", "thread", "threads"},
    "discharge": {"discharge", "discharge status", "discharge summary", "blocked", "clearance"},
}

PRONOUNS = {"him", "her", "his", "their", "that patient", "this patient", "same patient"}
COLLECTION_PHRASES = {
    "patient list", "patients list", "list patients", "list the patients", "list all patients", "list my patients",
    "list ip", "list op", "list patient", "which patients", "which of my patients", "how many", "count", "all patients",
    "patients name", "patients names", "patient names", "under me", "my patients",
    "has anyone", "does anyone", "is there anyone", "anyone have", "anyone has", "anyone", "anybody",
    "any patient", "any patients", "has any patient", "does any patient", "who has", "who have", "someone", "everyone",
    "any op", "any ip", "op patients", "ip patients", "discharged patients", "discharged patient", "discharged list",
    "discharged patient list", "outpatient patients", "outpatient list", "my op patients", "my discharged patients",
}

STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having", "do", "does", "did",
    "can", "could", "will", "would", "shall", "should", "may", "might", "must",
    "any", "anyone", "anybody", "anything", "someone", "somebody", "something",
    "everyone", "everybody", "everything", "no one", "nobody", "nothing",
    "each", "every", "all", "both", "either", "neither", "some", "none",
    "who", "whom", "whose", "which", "what", "where", "when", "why", "how",
    "there", "here", "this", "that", "these", "those",
    "in", "on", "at", "to", "for", "with", "by", "from", "about", "into", "through",
    "during", "before", "after", "above", "below", "under", "between",
    "and", "but", "or", "nor", "so", "yet", "if", "because", "as", "until", "while",
    "tell", "show", "give", "list", "check", "find", "get", "see", "view", "know",
    "patient", "patients", "record", "records", "report", "reports", "order", "orders",
    "test", "tests", "result", "results", "case", "history", "status", "data", "info",
    "information", "please", "pls", "details", "detail", "summary", "summarize",
    "today", "yesterday", "tomorrow", "now", "recent", "latest", "past", "last",
    "ok", "okay", "yes", "no", "not"
}


@dataclass(frozen=True)
class PatientCandidate:
    patient_id: int
    name: str
    age: Optional[int]
    identifier_last4: str
    latest_visit_date: Optional[str]
    score: float


def _tokens(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def normalize_query(query: str) -> str:
    cleaned = re.sub(r"\bhow\s+may\b", "how many", query or "", flags=re.I)
    words = [SPELLING.get(word, word) for word in _tokens(cleaned)]
    expanded: List[str] = []
    for word in words:
        expanded.extend(ABBREVIATIONS.get(word, word).split())
    return " ".join(expanded)


def _contains_phrase(text: str, phrases: Iterable[str]) -> bool:
    return any(phrase in text for phrase in phrases)


def _date_range(text: str, now: datetime) -> Optional[Dict[str, str]]:
    start = end = None
    if "yesterday" in text:
        day = (now - timedelta(days=1)).date(); start = datetime.combine(day, time.min, now.tzinfo); end = datetime.combine(day, time.max, now.tzinfo)
    elif "today" in text:
        day = now.date(); start = datetime.combine(day, time.min, now.tzinfo); end = datetime.combine(day, time.max, now.tzinfo)
    elif "last week" in text:
        end = datetime.combine(now.date(), time.max, now.tzinfo); start = end - timedelta(days=7)
    else:
        match = re.search(r"last\s+(\d+)\s+days?", text)
        if match:
            end = datetime.combine(now.date(), time.max, now.tzinfo); start = end - timedelta(days=int(match.group(1)))
        elif "since monday" in text:
            start = datetime.combine((now - timedelta(days=now.weekday())).date(), time.min, now.tzinfo); end = now
    if not start:
        return None
    return {"start": start.isoformat(), "end": end.isoformat()}


class RagQueryUnderstandingService:
    def understand(
        self,
        query: str,
        context: AccessContext,
        cur,
        conversation_patient_id: Optional[int] = None,
        explicit_patient_id: Optional[int] = None,
        conversation_collection: Optional[Dict[str, Any]] = None,
        now: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        normalized = normalize_query(query[:1500])
        timezone = ZoneInfo(os.getenv("HOSPITAL_TIMEZONE", "Asia/Kolkata"))
        now = now or datetime.now(timezone)
        modules = [module for module, terms in MODULE_TERMS.items() if _contains_phrase(normalized, terms)]
        if re.search(r'\b(d\s*\d+|icd)\b', normalized, re.I) and "diagnosis" not in modules:
            modules.append("diagnosis")
        intent = self._intent(normalized)
        requested_fields = [field for field, terms in FIELD_TERMS.items() if _contains_phrase(normalized, terms)]
        collection_request = self._is_collection_request(normalized, intent, conversation_collection)
        collection_patient_ids = []
        if collection_request and conversation_collection and self._is_collection_followup(normalized):
            collection_patient_ids = [int(value) for value in conversation_collection.get("patient_ids", [])]
        patient_id = None
        candidates: List[PatientCandidate] = []

        if explicit_patient_id is not None:
            # allowed_patient_ids=None means unrestricted (e.g. radiologist role)
            if context.is_admin or context.allowed_patient_ids is None or explicit_patient_id in (context.allowed_patient_ids or frozenset()):
                patient_id = explicit_patient_id
            else:
                return self._result(query, normalized, intent, modules, None, [], _date_range(normalized, now), "not_found")

        if conversation_patient_id is not None and _contains_phrase(normalized, PRONOUNS):
            if context.is_admin or context.allowed_patient_ids is None or conversation_patient_id in (context.allowed_patient_ids or frozenset()):
                patient_id = conversation_patient_id

        explicit = re.search(r"\b(?:mer pat|pat|uhid|mrn|patient)\s*[-#:]?\s*(\d{3,10})\b", normalized)
        if explicit:
            requested = int(explicit.group(1))
            if context.is_admin or context.allowed_patient_ids is None or requested in (context.allowed_patient_ids or frozenset()):
                patient_id = requested
            else:
                return self._result(query, normalized, intent, modules, None, [], _date_range(normalized, now), "not_found")

        # Strip clinician references (e.g. "requested by priya patel", "dr priya patel") so doctors are not falsely resolved as patients
        cleaned_for_patients = re.sub(
            r"\b(?:requested by|ordered by|raised by|asked by|created by|dr\.?|doctor)\s+[a-z]+(?:\s+[a-z]+)?\b",
            " ",
            normalized,
            flags=re.I
        )
        cleaned_for_patients = re.sub(
            r"\b[a-z]+(?:\s+[a-z]+)?\s+(?:requested|ordered|raised)\b",
            " ",
            cleaned_for_patients,
            flags=re.I
        )

        if patient_id is None and not collection_request and self._may_contain_name(cleaned_for_patients):
            candidates = self._scoped_patient_candidates(cur, context, cleaned_for_patients)
            if candidates and candidates[0].score >= 0.99:
                patient_id = candidates[0].patient_id
            elif len(candidates) == 1 and candidates[0].score >= 0.72:
                patient_id = candidates[0].patient_id
            elif len(candidates) > 1 and candidates[0].score - candidates[1].score >= 0.18 and candidates[0].score >= 0.82:
                patient_id = candidates[0].patient_id
            elif candidates:
                result = self._result(query, normalized, intent, modules, None, candidates[:5], _date_range(normalized, now), "ambiguous")
                result.update(requested_fields=requested_fields, collection_request=False, collection_patient_ids=[])
                return result

        if patient_id is not None:
            collection_request = False
            collection_patient_ids = []

        cohort = None
        if _contains_phrase(normalized, {"discharged", "discharge"}):
            if not _contains_phrase(normalized, {"clearance", "pending discharge", "summary", "draft", "readiness", "process"}):
                cohort = "discharged"
        elif _contains_phrase(normalized, {"outpatient", "op", "opd"}):
            cohort = "op"
        elif _contains_phrase(normalized, {"inpatient", "ip"}):
            cohort = "ip"

        result = self._result(query, normalized, intent, modules, patient_id, [], _date_range(normalized, now), "resolved")
        result.update(requested_fields=requested_fields, collection_request=collection_request,
                      collection_patient_ids=collection_patient_ids, cohort=cohort,
                      collection_followup=self._is_collection_followup(normalized) if not patient_id else False)
        return result

    @staticmethod
    def _intent(text: str) -> str:
        if _contains_phrase(text, {"how many", "count", "total"}): return "count"
        if _contains_phrase(text, {"compare", "versus", " vs "}): return "comparison"
        if _contains_phrase(text, {"trend", "over time", "last 3"}): return "trend"
        if _contains_phrase(text, {"latest", "last", "recent", "current"}): return "latest"
        if _contains_phrase(text, {"everything", "complete overview", "360", "summary"}): return "summary"
        if _contains_phrase(text, {"list", "show all"}): return "list"
        return "lookup"

    @staticmethod
    def _clinical_words() -> set[str]:
        words = set()
        for term in set().union(*MODULE_TERMS.values()):
            words.update(term.split())
        for term in set().union(*FIELD_TERMS.values()):
            words.update(term.split())
        return words

    @classmethod
    def _may_contain_name(cls, text: str) -> bool:
        if (
            _contains_phrase(text, COLLECTION_PHRASES)
            or "patients" in text.split()
            or text.strip() in {"op", "outpatient", "discharged", "any op", "any ip", "any outpatient"}
        ):
            return False
        excluded = set(ABBREVIATIONS.values()) | set(SPELLING.values()) | STOP_WORDS | cls._clinical_words()
        return any(len(token) >= 3 and token not in excluded for token in text.split())

    @staticmethod
    def _is_collection_followup(text: str) -> bool:
        return _contains_phrase(text, {"their", "them", "those", "these", "the patients", "each patient"})

    @classmethod
    def _is_collection_request(cls, text: str, intent: str, previous: Optional[Dict[str, Any]]) -> bool:
        explicit = (
            _contains_phrase(text, COLLECTION_PHRASES)
            or "patients" in text.split()
            or _contains_phrase(text, {"each patient", "which ones", "who are", "anyone", "anybody"})
            or text.strip() in {"op", "outpatient", "discharged", "discharged patients", "op patients", "any op"}
        )
        return explicit or bool(previous and cls._is_collection_followup(text)) or intent == "count"

    @classmethod
    def _scoped_patient_candidates(cls, cur, context: AccessContext, normalized: str) -> List[PatientCandidate]:
        params: List[Any] = []
        where = "UPPER(COALESCE(p.status, '')) = 'ACTIVE'"
        if not context.is_admin and context.allowed_patient_ids is not None:
            ids = sorted(context.allowed_patient_ids or ())
            if not ids:
                return []
            where += " AND p.id = ANY(%s)"; params.append(ids)
        cur.execute(f"""
            SELECT p.id, p.patient_code, p.first_name, p.last_name, p.date_of_birth,
                   MAX(a.appointment_date) AS latest_visit_date
            FROM patients p LEFT JOIN appointments a ON a.patient_id=p.id
            WHERE {where}
            GROUP BY p.id, p.patient_code, p.first_name, p.last_name, p.date_of_birth
        """, params)
        excluded = STOP_WORDS | cls._clinical_words() | set(ABBREVIATIONS.keys()) | set(ABBREVIATIONS.values())
        cleaned = re.sub(
            r"\b(?:requested by|ordered by|raised by|asked by|created by|dr\.?|doctor)\s+[a-z]+(?:\s+[a-z]+)?\b",
            " ",
            normalized,
            flags=re.I
        )
        cleaned = re.sub(
            r"\b[a-z]+(?:\s+[a-z]+)?\s+(?:requested|ordered|raised)\b",
            " ",
            cleaned,
            flags=re.I
        )
        query_tokens = set(cleaned.split()) - excluded
        if not query_tokens:
            return []
        results: List[PatientCandidate] = []
        today = datetime.now().date()
        for row in cur.fetchall():
            row = dict(row)
            name = f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip()
            name_norm = normalize_query(name)
            name_tokens = set(name_norm.split())
            overlap = len(name_tokens & query_tokens) / max(1, len(name_tokens))
            token_fuzzy = sum(
                1.0 if name_token in query_tokens else max(
                    (SequenceMatcher(None, name_token, query_token).ratio() for query_token in query_tokens if len(query_token) >= 4 or query_token == name_token),
                    default=0.0
                )
                for name_token in name_tokens
            ) / max(1, len(name_tokens))
            score = max(overlap, token_fuzzy)
            if score < 0.65 or (overlap == 0 and score < 0.80):
                continue
            dob = row.get("date_of_birth")
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day)) if dob else None
            visit = row.get("latest_visit_date")
            results.append(PatientCandidate(int(row["id"]), name, age, str(row.get("patient_code") or row["id"])[-4:], visit.isoformat() if visit else None, round(score, 4)))
        return sorted(results, key=lambda item: (-item.score, item.name, item.patient_id))

    @staticmethod
    def _result(original, normalized, intent, modules, patient_id, candidates, dates, status):
        ret_queries = [normalized] + [f"{normalized} {module}" for module in modules]
        icd_match = re.search(r'\b([dD]-\d+)\b', original or "")
        if icd_match:
            code_val = icd_match.group(1).upper()
            ret_queries.extend([f"ICD Code: {code_val}", f"Clinical Diagnosis {code_val}", f"Code: {code_val}"])
        return {
            "original_query": original, "normalized_query": normalized, "intent": intent,
            "modules": modules, "patient_id": patient_id,
            "candidates": [asdict(candidate) for candidate in candidates],
            "date_range": dates, "resolution_status": status,
            "retrieval_queries": ret_queries,
        }


query_understanding_service = RagQueryUnderstandingService()
