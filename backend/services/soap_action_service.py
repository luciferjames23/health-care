"""Transcript-grounded, rule-based extraction of reviewable SOAP actions.

This phase deliberately extracts only typed suggestions. It does not persist,
confirm, or dispatch orders, and SOAP Plan text cannot create an order by itself.
"""
import hashlib
import json
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ActionType = Literal[
    "MEDICATION_ORDER", "LAB_ORDER", "DIAGNOSTIC_ORDER", "IMAGING_ORDER",
    "DIAGNOSIS_CANDIDATE", "CLINICAL_FINDING", "FOLLOW_UP", "REFERRAL",
]
ActionIntent = Literal["CREATE_ORDER", "DOCUMENT_FINDING", "DOCUMENT_HISTORY", "CONSIDER", "FOLLOW_UP"]
ActionStatus = Literal["DETECTED", "PENDING_CONFIRMATION", "CONFIRMED", "CREATED", "REJECTED", "FAILED"]
Priority = Literal["ROUTINE", "URGENT", "STAT"]


class SoapClinicalAction(BaseModel):
    """Strict action representation shared by extraction and future persistence."""
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    action_key: str = Field(min_length=64, max_length=64)
    action_type: ActionType
    intent: ActionIntent
    name: str = Field(min_length=1, max_length=240)
    code: str | None = Field(default=None, max_length=80)
    dose: float | None = None
    unit: str | None = Field(default=None, max_length=40)
    route: str | None = Field(default=None, max_length=80)
    frequency: str | None = Field(default=None, max_length=120)
    duration: str | None = Field(default=None, max_length=120)
    priority: Priority | None = None
    projection: Literal["PA", "AP"] | None = None
    clinical_indication: str | None = Field(default=None, max_length=500)
    finding_type: Literal["TEMPERATURE", "BLOOD_PRESSURE", "PULSE", "SPO2"] | None = None
    value: float | None = None
    systolic: int | None = None
    diastolic: int | None = None
    source_text: str = Field(min_length=1, max_length=2000)
    confidence: float = Field(ge=0, le=1)
    status: ActionStatus


class SoapActionExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actions: list[SoapClinicalAction]


LAB_TESTS = (
    ("complete blood count", "Complete Blood Count", "CBC"),
    ("cbc", "Complete Blood Count", "CBC"),
    ("comprehensive metabolic panel", "Comprehensive Metabolic Panel", "CMP"),
    ("cmp", "Comprehensive Metabolic Panel", "CMP"),
    ("basic metabolic panel", "Basic Metabolic Panel", "BMP"),
    ("bmp", "Basic Metabolic Panel", "BMP"),
    ("hemoglobin a1c", "Hemoglobin A1c", "HBA1C"),
    ("hba1c", "Hemoglobin A1c", "HBA1C"),
    ("lipid panel", "Lipid Panel", "LIPID"),
    ("lipid profile", "Lipid Panel", "LIPID"),
    ("liver function test", "Liver Function Tests", "LFT"),
    ("lfts", "Liver Function Tests", "LFT"),
    ("renal function test", "Renal Function Tests", "RFT"),
    ("troponin", "Troponin", "TROPONIN"),
)
MEDICATION_NAMES = (
    "acetaminophen", "paracetamol", "atorvastatin", "rosuvastatin", "simvastatin",
    "pravastatin", "aspirin", "ibuprofen", "naproxen", "metformin", "insulin",
    "glipizide", "empagliflozin", "losartan", "lisinopril", "amlodipine",
    "metoprolol", "carvedilol", "propranolol", "furosemide", "hydrochlorothiazide",
    "spironolactone", "warfarin", "apixaban", "rivaroxaban", "clopidogrel",
    "heparin", "amoxicillin", "azithromycin", "ceftriaxone", "cephalexin",
    "ciprofloxacin", "doxycycline", "prednisone", "dexamethasone", "pantoprazole",
    "omeprazole", "ondansetron", "morphine", "tramadol", "oxycodone", "gabapentin",
    "levothyroxine", "albuterol", "salbutamol", "nitroglycerin",
)
UNIT_RE = r"(?:micrograms?|mcg|μg|ug|milligrams?|mg|grams?|g|milliliters?|ml|liters?|l|units?|iu|meq|mmol)"
NUMBER_WORD_RE = r"(?:one\s+hundred(?:\s+(?:and\s+)?(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine))?)?|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine))?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)"
NUMBER_RE = rf"(?:\d+(?:\.\d+)?|{NUMBER_WORD_RE})"
_NUMBERS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30,
    "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}
_UNIT_ALIASES = {
    "microgram": "mcg", "micrograms": "mcg", "μg": "mcg", "ug": "mcg",
    "milligram": "mg", "milligrams": "mg", "gram": "g", "grams": "g",
    "milliliter": "ml", "milliliters": "ml", "liter": "l", "liters": "l",
    "unit": "unit", "units": "unit", "iu": "iu", "meq": "meq", "mmol": "mmol",
}
_ACTION_VERB_RE = re.compile(r"\b(?:please\s+)?(?:order|request|arrange|send\s+for)\s+", re.I)
_ORDER_TAIL_RE = re.compile(r"\b(?:and\s+)?(?:start|begin|initiate|prescribe|review|follow\s+up|refer)\b", re.I)
_MED_ACTION_RE = re.compile(
    rf"\b(?:start|begin|initiate|prescribe)\s+(?P<name>[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*)?)"
    rf"(?:\s+(?P<dose>{NUMBER_RE})\s*(?P<unit>{UNIT_RE}))?",
    re.I,
)
_MED_HISTORY_RE = re.compile(
    rf"\b(?:patient\s+is\s+)?(?:taking|takes|took|uses|using|previously\s+took)\s+(?P<name>"
    + "|".join(sorted(map(re.escape, MEDICATION_NAMES), key=len, reverse=True))
    + rf")\b(?:\s+(?P<dose>{NUMBER_RE})\s*(?P<unit>{UNIT_RE}))?",
    re.I,
)
_DOSE_RE = re.compile(rf"(?P<dose>{NUMBER_RE})\s*(?P<unit>{UNIT_RE})\b", re.I)
_ROUTE_RE = re.compile(r"\b(oral|po|intravenous|iv|intramuscular|im|subcutaneous|sc|topical)\b", re.I)
_FREQUENCY_RE = re.compile(r"\b(once\s+daily|daily|once\s+daily|twice\s+daily|three\s+times\s+daily|q\d+h|od|bd|bid|tds|tid|qid|prn)\b", re.I)
_DURATION_RE = re.compile(rf"\bfor\s+(?P<amount>{NUMBER_RE})\s*(?P<unit>hours?|days?|weeks?|months?)\b", re.I)
_FOLLOWUP_RE = re.compile(rf"\b(?:review|follow\s*[- ]?up|return|recheck)\s+(?:in|after|within)\s+(?P<amount>{NUMBER_RE})\s*(?P<unit>hours?|days?|weeks?|months?)\b", re.I)
_CONSIDER_RE = re.compile(r"\bconsider\s+(?:ordering\s+)?(?P<term>ecg|ekg|cbc|complete\s+blood\s+count|chest\s+x\s*[- ]?ray|x\s*[- ]?ray)\b", re.I)
_DIAGNOSIS_RE = re.compile(r"\bdiagnosis\s+is\s+(?P<name>[^.;!?\n]+)", re.I)
_REFERRAL_RE = re.compile(r"\b(?:refer|referral)\s+(?:the\s+patient\s+)?(?:to\s+)?(?P<name>[A-Za-z][A-Za-z -]{1,60}?)(?=[.,;!?\n]|$)", re.I)
_FINDING_PATTERNS = (
    ("T-wave inversion", re.compile(r"\bt\s*[- ]?\s*wave\s+inversions?\b", re.I)),
    ("ST elevation", re.compile(r"\bst\s+(?:segment\s+)?elevation\b", re.I)),
    ("ST depression", re.compile(r"\bst\s+(?:segment\s+)?depression\b", re.I)),
    ("QT prolongation", re.compile(r"\bqt\s+prolongation\b", re.I)),
)
_VITAL_PATTERNS = (
    ("BLOOD_PRESSURE", "Blood pressure", re.compile(r"\b(?:blood\s+pressure|bp)\s*(?:is|of|:)?\s*(?P<systolic>\d{2,3})\s*(?:/|over)\s*(?P<diastolic>\d{2,3})\s*(?:mm\s*hg)?", re.I)),
    ("TEMPERATURE", "Temperature", re.compile(r"\b(?:temperature|temp)\s*(?:is|of|:)?\s*(?P<value>\d{2,3}(?:\.\d+)?)\s*(?P<unit>degrees?\s*(?:fahrenheit|celsius|[cf])|°\s*[cf]|[cf])?", re.I)),
    ("PULSE", "Pulse", re.compile(r"\b(?:pulses?|heart\s+rate|hr)\s*(?:is|of|:)?\s*(?P<value>\d{1,3})\s*(?:(?:beats?|times?)\s+)?(?:per\s+minute|/\s*min(?:ute)?|bpm)?\b", re.I)),
    ("SPO2", "Oxygen saturation", re.compile(r"\b(?:oxygen\s+saturation|spo\s*2|spo2)\s*(?:is|of|:)?\s*(?P<value>\d{1,3}(?:\.\d+)?)\s*(?:percent|%)?\b", re.I)),
)
_XRAY_RE = re.compile(r"\b(?:chest\s+)?x\s*[- ]?\s*ray\b", re.I)
_RESULT_CUE_RE = re.compile(r"\b(?:shows?|reveals?|demonstrates?|result(?:s)?|finding(?:s)?)\b", re.I)
_LAB_RESULT_RE = re.compile(r"\b(?P<test>cbc|complete\s+blood\s+count|cmp|comprehensive\s+metabolic\s+panel|bmp|basic\s+metabolic\s+panel)\s+(?:result\s+)?(?:shows?\s+)?(?P<finding>(?:hb|hemoglobin|wbc|white\s+blood\s+cell(?:s)?|platelets?)\s*(?:is|of|:)?\s*\d+(?:\.\d+)?)\b", re.I)


def _number(value: str):
    normalized = re.sub(r"\band\b", " ", value.casefold()).strip()
    if re.fullmatch(r"\d+(?:\.\d+)?", normalized):
        return float(normalized) if "." in normalized else int(normalized)
    total = 0
    for part in normalized.split():
        if part == "hundred":
            total = max(total, 1) * 100
        else:
            total += _NUMBERS.get(part, 0)
    return total


def _unit(value: str | None):
    if not value:
        return None
    normalized = value.casefold().replace("u g", "ug")
    return _UNIT_ALIASES.get(normalized, normalized)


def _key(action_type, intent, name, code, dose, unit, source_text, projection=None, clinical_indication=None,
         finding_type=None, value=None, systolic=None, diastolic=None):
    canonical = {
        "action_type": action_type, "intent": intent, "name": name.casefold().strip(),
        "code": code.casefold().strip() if code else None, "dose": dose, "unit": unit,
        "source_text": re.sub(r"\s+", " ", source_text.casefold()).strip(),
        "projection": projection,
        "clinical_indication": clinical_indication.casefold().strip() if clinical_indication else None,
        "finding_type": finding_type, "value": value, "systolic": systolic, "diastolic": diastolic,
    }
    return hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _action(action_type: ActionType, intent: ActionIntent, name: str, source_text: str, *,
            code=None, dose=None, unit=None, route=None, frequency=None, duration=None,
            priority=None, projection=None, clinical_indication=None,
            finding_type=None, value=None, systolic=None, diastolic=None,
            confidence=0.96, status: ActionStatus | None = None):
    if status is None:
        status = "PENDING_CONFIRMATION" if intent == "CREATE_ORDER" or action_type in {"DIAGNOSIS_CANDIDATE", "FOLLOW_UP"} else "DETECTED"
    return SoapClinicalAction(
        action_key=_key(action_type, intent, name, code, dose, unit, source_text,
                        projection, clinical_indication, finding_type, value, systolic, diastolic),
        action_type=action_type, intent=intent, name=name, code=code, dose=dose, unit=unit,
        route=route, frequency=frequency, duration=duration, priority=priority,
        projection=projection, clinical_indication=clinical_indication,
        finding_type=finding_type, value=value, systolic=systolic, diastolic=diastolic,
        source_text=source_text.strip(), confidence=confidence, status=status,
    )


def _source_text(text, start, end):
    return text[max(0, start):min(len(text), end)].strip(" \t,;.")


def _imaging_projection(text):
    patterns = (
        r"\b(?P<view>PA|AP)\s+(?:view|projection)\b",
        r"\b(?P<view>PA|AP)\s+(?:chest\s+)?x\s*[- ]?\s*ray\b",
        r"\bchest\s+x\s*[- ]?\s*ray\s+(?P<view>PA|AP)\b",
    )
    views = {match.group("view").upper() for pattern in patterns for match in re.finditer(pattern, text, re.I)}
    return next(iter(views)) if len(views) == 1 else None


def _imaging_indication(text, order_start):
    """Return the immediately preceding symptom sentence, when present."""
    boundaries = [index for index, char in enumerate(text[:order_start]) if char in ".!?\n"]
    sentence_start = boundaries[-1] + 1 if boundaries else 0
    candidate = text[sentence_start:order_start].strip(" \t,;.")
    if not candidate and boundaries:
        previous_start = boundaries[-2] + 1 if len(boundaries) > 1 else 0
        candidate = text[previous_start:boundaries[-1]].strip(" \t,;.")
    candidate = re.sub(r"^(?:patient\s+)?(?:reports?|has|presents?\s+with|complains?\s+of)\s+", "", candidate, flags=re.I)
    candidate = candidate[:500].strip()
    return (candidate[:1].upper() + candidate[1:]) if candidate else None


def _extract_orders(text):
    results = []
    for clause in _ACTION_VERB_RE.finditer(text):
        end = re.search(r"[.!?;\n]", text[clause.end():])
        stop = clause.end() + end.start() if end else len(text)
        tail = _ORDER_TAIL_RE.search(text, clause.end(), stop)
        if tail:
            stop = tail.start()
        body = text[clause.end():stop]
        for term, display, code in sorted(LAB_TESTS, key=lambda item: len(item[0]), reverse=True):
            match = re.search(r"\b" + re.escape(term) + r"\b", body, re.I)
            if match:
                absolute_start = clause.end() + match.start()
                absolute_end = clause.end() + match.end()
                source = _source_text(text, clause.start(), stop)
                results.append((absolute_start, _action("LAB_ORDER", "CREATE_ORDER", display, source, code=code, priority="STAT" if re.search(r"\bstat\b", source, re.I) else "URGENT" if re.search(r"\burgent\b", source, re.I) else "ROUTINE")))
        ecg = re.search(r"\b(?:ecg|ekg|electrocardiogram)\b", body, re.I)
        if ecg:
            absolute_start = clause.end() + ecg.start()
            absolute_end = clause.end() + ecg.end()
            results.append((absolute_start, _action("DIAGNOSTIC_ORDER", "CREATE_ORDER", "ECG", _source_text(text, clause.start(), absolute_end))))
        xray = _XRAY_RE.search(body)
        if xray:
            absolute_start = clause.end() + xray.start()
            absolute_end = clause.end() + xray.end()
            supported = bool(re.search(r"\bchest\b", body, re.I))
            projection = _imaging_projection(body) if supported else None
            priority = "URGENT" if re.search(r"\burgent\b", body, re.I) else "ROUTINE" if re.search(r"\broutine\b", body, re.I) else None
            results.append((absolute_start, _action(
                "IMAGING_ORDER", "CREATE_ORDER", "Chest X-ray" if supported else "X-ray",
                _source_text(text, clause.start(), stop), priority=priority,
                projection=projection, clinical_indication=_imaging_indication(text, clause.start()) if supported else None,
            )))
    # Passive clinician requests are also explicit order intent; result verbs
    # are intentionally excluded from this matcher.
    for requested in re.finditer(r"\b(?P<target>(?:chest\s+)?x\s*[- ]?\s*ray|ecg|ekg|electrocardiogram|complete\s+blood\s+count|cbc|comprehensive\s+metabolic\s+panel|cmp|basic\s+metabolic\s+panel|bmp|hba1c|hemoglobin\s+a1c|lipid\s+(?:panel|profile)|troponin)\s+(?:was\s+)?requested\b", text, re.I):
        target = requested.group("target")
        normalized = target.casefold()
        if "ray" in normalized:
            results.append((requested.start(), _action("IMAGING_ORDER", "CREATE_ORDER", "Chest X-ray" if "chest" in normalized else "X-ray", requested.group(0))))
        elif normalized in {"ecg", "ekg", "electrocardiogram"}:
            results.append((requested.start(), _action("DIAGNOSTIC_ORDER", "CREATE_ORDER", "ECG", requested.group(0))))
        else:
            mapped = next(((display, code) for term, display, code in LAB_TESTS if term == normalized), (target.title(), None))
            results.append((requested.start(), _action("LAB_ORDER", "CREATE_ORDER", mapped[0], requested.group(0), code=mapped[1])))
    return results


def extract_clinical_actions(raw_transcript: str, soap_draft: dict | None = None) -> SoapActionExtraction:
    """Return validated action suggestions; explicit intent must occur in transcript.

    ``soap_draft`` is accepted as required workflow context, but is deliberately
    not a source of order intent: text present only in the model draft is ignored.
    """
    text = (raw_transcript or "").strip()
    if not isinstance(soap_draft, (dict, type(None))):
        raise TypeError("soap_draft must be a mapping or None")
    candidates: list[tuple[int, SoapClinicalAction]] = []

    # Explicit medication order statements only. Exact medication lexemes are
    # retained; an unknown name stays unknown and is never substituted.
    for match in _MED_ACTION_RE.finditer(text):
        name = match.group("name").strip()
        if name.casefold() in {"the patient", "a patient", "medication", "medicine", "drug"}:
            continue
        # Avoid treating a named follow-up action as medication text.
        dose = _number(match.group("dose")) if match.group("dose") else None
        unit = _unit(match.group("unit"))
        suffix = text[match.end():match.end() + 80]
        route_match = _ROUTE_RE.search(suffix)
        frequency_match = _FREQUENCY_RE.search(suffix)
        duration_match = _DURATION_RE.search(suffix)
        candidates.append((match.start(), _action(
            "MEDICATION_ORDER", "CREATE_ORDER", name.title(), match.group(0),
            dose=dose, unit=unit,
            route=route_match.group(1).upper() if route_match else None,
            frequency=frequency_match.group(1).upper() if frequency_match else None,
            duration=(f"{_number(duration_match.group('amount'))} {duration_match.group('unit').rstrip('s')}" if duration_match else None),
        )))

    # Medication history is represented as history, never as a new prescription.
    for match in _MED_HISTORY_RE.finditer(text):
        candidates.append((match.start(), _action(
            "MEDICATION_ORDER", "DOCUMENT_HISTORY", match.group("name").title(), match.group(0),
            dose=_number(match.group("dose")) if match.group("dose") else None,
            unit=_unit(match.group("unit")), confidence=0.94,
        )))

    candidates.extend(_extract_orders(text))

    for match in _CONSIDER_RE.finditer(text):
        term = match.group("term")
        normalized = term.casefold()
        if normalized in {"ecg", "ekg"}:
            action_type, name, code = "DIAGNOSTIC_ORDER", "ECG", None
        elif "x" in normalized or "ray" in normalized:
            action_type, name, code = "IMAGING_ORDER", "Chest X-ray" if "chest" in normalized else "X-ray", None
        else:
            action_type, name, code = "LAB_ORDER", "Complete Blood Count", "CBC"
        candidates.append((match.start(), _action(action_type, "CONSIDER", name, match.group(0), code=code, confidence=0.91, status="DETECTED")))

    for match in _FOLLOWUP_RE.finditer(text):
        amount = _number(match.group("amount"))
        unit = match.group("unit").casefold().rstrip("s")
        candidates.append((match.start(), _action("FOLLOW_UP", "FOLLOW_UP", f"{amount} {unit}{'' if amount == 1 else 's'}", match.group(0), duration=f"{amount} {unit}", confidence=0.98)))

    for match in _DIAGNOSIS_RE.finditer(text):
        name = match.group("name").strip()
        if name:
            candidates.append((match.start(), _action("DIAGNOSIS_CANDIDATE", "DOCUMENT_FINDING", name, match.group(0), confidence=0.90)))

    for match in _REFERRAL_RE.finditer(text):
        specialty = match.group("name").strip()
        if specialty:
            candidates.append((match.start(), _action("REFERRAL", "CREATE_ORDER", specialty, match.group(0), confidence=0.88)))

    # Findings are deliberately concise canonical labels. They never create
    # diagnostic or imaging orders.
    for name, pattern in _FINDING_PATTERNS:
        for match in pattern.finditer(text):
            left = max(0, text.rfind(".", 0, match.start()) + 1)
            cue = _RESULT_CUE_RE.search(text, left, match.start())
            if cue:
                start = left + cue.start()
                candidates.append((match.start(), _action("CLINICAL_FINDING", "DOCUMENT_FINDING", name, _source_text(text, start, match.end()), confidence=0.97)))

    for finding_type, label, pattern in _VITAL_PATTERNS:
        for match in pattern.finditer(text):
            if finding_type == "BLOOD_PRESSURE":
                candidates.append((match.start(), _action(
                    "CLINICAL_FINDING", "DOCUMENT_FINDING", label, match.group(0), confidence=0.96,
                    finding_type=finding_type, systolic=int(match.group("systolic")),
                    diastolic=int(match.group("diastolic")), unit="mmHg",
                )))
            else:
                value = float(match.group("value"))
                if value.is_integer(): value = int(value)
                if finding_type == "TEMPERATURE":
                    raw_unit = (match.groupdict().get("unit") or "").upper()
                    unit = "C" if "CELSIUS" in raw_unit or raw_unit.strip().endswith("C") else "F" if raw_unit else None
                else:
                    unit = "bpm" if finding_type == "PULSE" else "%"
                candidates.append((match.start(), _action(
                    "CLINICAL_FINDING", "DOCUMENT_FINDING", label, match.group(0), confidence=0.96,
                    finding_type=finding_type, value=value, unit=unit,
                )))

    for match in _LAB_RESULT_RE.finditer(text):
        test = "CBC" if match.group("test").casefold() in {"cbc", "complete blood count"} else match.group("test").upper()
        finding = re.sub(r"\b(?:is|of)\b|:", " ", match.group("finding"), flags=re.I)
        finding = re.sub(r"\s+", " ", finding).strip()
        candidates.append((match.start(), _action("CLINICAL_FINDING", "DOCUMENT_FINDING", f"{test}: {finding}", match.group(0), confidence=0.93)))

    # A result/finding statement is not an order. Capture a short finding only.
    xray_result = re.compile(r"\b(?:chest\s+)?x\s*[- ]?\s*ray\s+(?:shows?|reveals?|demonstrates?)\s+(?P<finding>[^.;,\n]+)", re.I)
    for match in xray_result.finditer(text):
        result = match.group("finding").strip()
        candidates.append((match.start(), _action("CLINICAL_FINDING", "DOCUMENT_FINDING", f"X-ray: {result}", match.group(0), confidence=0.94)))

    # Stable de-duplication protects repeated detection of the same source text.
    deduplicated: dict[str, tuple[int, SoapClinicalAction]] = {}
    for start, candidate in candidates:
        deduplicated.setdefault(candidate.action_key, (start, candidate))
    ordered = [action for _, action in sorted(deduplicated.values(), key=lambda item: (item[0], item[1].action_type, item[1].name))]
    return SoapActionExtraction(actions=ordered)


def extract_clinical_actions_json(raw_transcript: str, soap_draft: dict | None = None) -> dict:
    """JSON-safe strict output suitable for an API response or persistence layer."""
    return extract_clinical_actions(raw_transcript, soap_draft).model_dump(mode="json")
