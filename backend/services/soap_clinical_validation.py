"""Structured, conservative entity checks for high-risk SOAP content."""
import hashlib
import json
import re


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
UNIT_PATTERN = r"(?:micrograms?|mcg|μg|ug|milligrams?|mg|grams?|g|milliliters?|ml|liters?|l|units?|iu|meq|mmol)"
WORD_NUMBER = r"(?:one\s+hundred(?:\s+(?:and\s+)?(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine))?)?|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(?:one|two|three|four|five|six|seven|eight|nine))?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)"
NUMBER_TOKEN = rf"(?:\d+(?:\.\d+)?|{WORD_NUMBER})"
NUMBER_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11,
    "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
    "eighty": 80, "ninety": 90,
}
MEDICATION_RE = re.compile(r"\b(" + "|".join(sorted(MEDICATION_NAMES, key=len, reverse=True)) + r")\b", re.I)
DOSE_AFTER_MED_RE = re.compile(r"\b(" + "|".join(sorted(MEDICATION_NAMES, key=len, reverse=True)) + rf")\b\s*(?:at\s+)?({NUMBER_TOKEN})\s*({UNIT_PATTERN})\b", re.I)
MEDICATION_CANDIDATE_RE = re.compile(rf"\b([a-z][a-z-]{{2,}})\s+(?:in\s+|of\s+|at\s+)?(?={NUMBER_TOKEN}\s*{UNIT_PATTERN}\b)", re.I)
DOSE_RE = re.compile(rf"({NUMBER_TOKEN})\s*({UNIT_PATTERN})\b", re.I)
DURATION_RE = re.compile(rf"\b({NUMBER_TOKEN})\s*(hours?|hrs?|days?|weeks?|months?|years?)\b", re.I)
VITAL_PATTERNS = {
    "blood_pressure": re.compile(r"\b(?:blood\s+pressure|bp)\s*(?:is|of|:)?\s*(" + NUMBER_TOKEN + r")\s*(?:/|over)\s*(" + NUMBER_TOKEN + r")\s*(mm\s*hg)?", re.I),
    "heart_rate": re.compile(r"\b(?:heart\s+rate|pulse|hr)\s*(?:is|of|:)?\s*(\d{2,3})\s*(bpm|beats?\s+per\s+minute|per\s+minute)?", re.I),
    "temperature": re.compile(r"\b(?:temperature|temp)\s*(?:is|of|:)?\s*(\d{2,3}(?:\.\d+)?)\s*(degrees?\s*(?:fahrenheit|celsius|[cf])|\u00b0\s*[cf]|[cf])?", re.I),
    "oxygen_saturation": re.compile(r"\b(?:oxygen\s+saturation|spo\s*2|spo2|o2\s+sat)\s*(?:is|of|:)?\s*(\d{1,3}(?:\.\d+)?)\s*(%|percent)?", re.I),
    "respiratory_rate": re.compile(r"\b(?:respiratory\s+rate|respirations?|rr)\s*(?:is|of|:)?\s*(\d{1,2})\s*(breaths?\s*/\s*min)?", re.I),
}
FINDINGS = {
    "t_wave_inversion": re.compile(r"\b(?P<neg>no\s+|without\s+)?t\s*[- ]?\s*wave\s+inversions?\b", re.I),
    "st_elevation": re.compile(r"\b(?P<neg>no\s+|without\s+)?st\s+(?:segment\s+)?elevation\b", re.I),
    "st_depression": re.compile(r"\b(?P<neg>no\s+|without\s+)?st\s+(?:segment\s+)?depression\b", re.I),
    "qt_prolongation": re.compile(r"\b(?P<neg>no\s+|without\s+)?qt\s+prolongation\b", re.I),
    "atrial_fibrillation": re.compile(r"\batrial fibrillation\b", re.I),
    "ventricular_tachycardia": re.compile(r"\bventricular tachycardia\b", re.I),
    "sinus_rhythm": re.compile(r"\bsinus rhythm\b", re.I),
    "heart_block": re.compile(r"\bheart block\b", re.I),
}
TEST_RESULT_RE = re.compile(r"\b(?:ecg|ekg|x\s*[- ]?ray|chest\s+x\s*[- ]?ray|ct|mri|ultrasound|troponin|test\s+result)\s+(?:shows?|reveals?|demonstrates?|indicates?|is|are|result(?:s)?(?:\s+is)?|:)\s*([^.;,\n]+)", re.I)
ACTION_BOUNDARY_RE = re.compile(r"\b(?:start(?:ed)?|take|taking|prescribe(?:d)?|continue|administer(?:ed)?|give|review|recommend|plan)\b", re.I)


def _normalize_text(value):
    value = value.casefold().replace("\u03bc", "u").replace("\u2013", "-")
    value = re.sub(r"[^a-z0-9./% -]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _number(value):
    value = re.sub(r"\band\b", " ", value.casefold()).strip()
    if re.fullmatch(r"\d+(?:\.\d+)?", value):
        return float(value) if "." in value else int(value)
    total = 0
    for part in value.split():
        if part == "hundred":
            total = max(total, 1) * 100
        else:
            total += NUMBER_WORDS.get(part, 0)
    return total if total else None


def _unit(value):
    value = value.casefold().replace("??", "u").replace(" ", "").replace("\u00b0", "")
    aliases = {
        "microgram": "mcg", "micrograms": "mcg", "ug": "mcg", "u g": "mcg",
        "milligram": "mg", "milligrams": "mg", "gram": "g", "grams": "g",
        "milliliter": "ml", "milliliters": "ml", "liter": "l", "liters": "l",
        "unit": "unit", "units": "unit", "iu": "iu", "meq": "meq", "mmol": "mmol",
        "fahrenheit": "f", "degreefahrenheit": "f", "degreesfahrenheit": "f", "?f": "f",
        "celsius": "c", "degreecelsius": "c", "degreescelsius": "c", "?c": "c",
        "bpm": "bpm", "perminute": "bpm", "beatperminute": "bpm", "beatsperminute": "bpm",
        "percent": "%", "%": "%",
    }
    return aliases.get(value, value)


def _duration_context(text, start):
    prefix = text[max(0, start - 70):start].casefold()
    if re.search(r"\b(?:review|follow\s*[- ]?up|return|recheck|see\s+again|appointment)\s+(?:in|after|within|at)\s*$", prefix):
        return "follow_up"
    if re.search(r"\b(?:for|lasting|over\s+the\s+past)\s*$", prefix):
        if re.search(r"\b(?:pain|symptom|fever|cough|nausea|dizziness|shortness\s+of\s+breath)\b", prefix):
            return "symptom_duration"
        return "treatment_duration"
    if re.search(r"\b(?:chest\s+pain|pain|symptom|fever|cough|nausea|dizziness)\b.{0,45}$", prefix):
        return "symptom_duration"
    if re.search(r"\b(?:review|follow\s*[- ]?up|return|recheck)\b.{0,35}$", prefix):
        return "follow_up"
    # An explicit review/follow-up instruction is a separate plan item and
    # cannot change the symptom-duration entity already stated in the source.
    if re.search(r"\b(?:review|follow\s*[- ]?up|return|recheck)\s+(?:in|after|within)\s*$", prefix) or re.search(r"\b(?:review|follow\s*[- ]?up|return|recheck)\s*$", prefix):
        return "follow_up"
    return "treatment_duration"


def extract_entities(text):
    """Extract comparable records, avoiding free text as entity values."""
    text = text or ""
    entities = {"medication": [], "dose": [], "vital": [], "duration": [], "test_finding": []}
    medications = {}
    known_spans = []
    for match in MEDICATION_RE.finditer(text):
        name = match.group(1).casefold()
        known_spans.append(match.span(1))
        medications.setdefault(name, {"name": name, "dose": None, "unit": None})
    for match in DOSE_AFTER_MED_RE.finditer(text):
        name = match.group(1).casefold()
        medications[name] = {"name": name, "dose": _number(match.group(2)), "unit": _unit(match.group(3))}
        known_spans.append(match.span(1))
    stop_words = {"start", "started", "take", "taking", "give", "given", "review", "after", "before", "patient", "weight", "blood", "pressure", "dose", "drug", "medicine", "medication", "the", "and", "then", "with", "for", "daily", "once", "every"}
    stop_words.update(NUMBER_WORDS)
    for match in MEDICATION_CANDIDATE_RE.finditer(text):
        name = match.group(1).casefold()
        if name in stop_words or any(match.start(1) < end and match.end(1) > start for start, end in known_spans):
            continue
        medications.setdefault(name, {"name": name, "dose": None, "unit": None})
        known_spans.append(match.span(1))
    entities["medication"] = sorted(medications.values(), key=lambda item: item["name"])
    entities["dose"] = sorted({f"{_number(m.group(1))} {_unit(m.group(2))}" for m in DOSE_RE.finditer(text)})

    for vital_name, pattern in VITAL_PATTERNS.items():
        for match in pattern.finditer(text):
            if vital_name == "blood_pressure":
                value = f"{_number(match.group(1))}/{_number(match.group(2))}"
                unit = "mmhg"
            else:
                value = str(_number(match.group(1)))
                unit = _unit(match.group(2) or "")
            entities["vital"].append({"type": vital_name, "value": value, "unit": unit})
    entities["vital"] = sorted({json.dumps(x, sort_keys=True) for x in entities["vital"]})

    durations = set()
    for match in DURATION_RE.finditer(text):
        amount = _number(match.group(1))
        unit = match.group(2).casefold()
        unit = "hour" if unit.startswith("h") else unit.rstrip("s")
        durations.add(( _duration_context(text, match.start()), amount, unit))
    entities["duration"] = sorted(durations)

    findings = set()
    for name, pattern in FINDINGS.items():
        for match in pattern.finditer(text):
            findings.add((name, "absent" if match.groupdict().get("neg") else "present"))
    for match in TEST_RESULT_RE.finditer(text):
        result = ACTION_BOUNDARY_RE.split(match.group(1), maxsplit=1)[0]
        # Only retain recognized clinical findings from this short result span.
        for name, pattern in FINDINGS.items():
            for finding in pattern.finditer(result):
                findings.add((name, "absent" if finding.groupdict().get("neg") else "present"))
    entities["test_finding"] = sorted(findings)
    return entities


def _display_entity(entity_type, entity):
    if entity_type == "medication":
        return f"{entity['name']} {entity['dose']} {entity['unit']}" if entity.get("dose") is not None else entity["name"]
    if entity_type == "vital":
        vital = json.loads(entity)
        return f"{vital['type']} {vital['value']} {vital['unit']}".strip()
    if entity_type == "duration":
        context, amount, unit = entity
        labels = {"symptom_duration": "symptom duration", "treatment_duration": "treatment duration", "follow_up": "follow-up"}
        return f"{labels[context]}: {amount} {unit}{'' if amount == 1 else 's'}"
    if entity_type == "test_finding":
        name, status = entity
        label = name.replace("_", " ")
        return f"{label} ({status})"
    return str(entity)


def compare_clinical_entities(transcript, ai_draft, final_record):
    """Compare canonical entities from source, draft, and final record."""
    source = extract_entities(transcript)
    if not (transcript or "").strip():
        return {"has_mismatch": False, "final_has_mismatch": False, "can_resolve": False, "mismatches": [],
                "fingerprint": hashlib.sha256(b"no-transcript").hexdigest()}
    documents = {
        "ai_draft": extract_entities("\n".join(str(v or "") for v in (ai_draft or {}).values())),
        "final_record": extract_entities("\n".join(str(v or "") for v in (final_record or {}).values())),
    }
    mismatches, final_mismatches = [], []
    for document_name, document in documents.items():
        for entity_type in source:
            source_values, document_values = source[entity_type], document[entity_type]
            if entity_type == "medication":
                source_by_name = {item["name"]: item for item in source_values}
                doc_by_name = {item["name"]: item for item in document_values}
                missing_names = set(source_by_name) - set(doc_by_name)
                introduced_names = set(doc_by_name) - set(source_by_name)
                changed_names = {name for name in source_by_name.keys() & doc_by_name.keys()
                                 if source_by_name[name] != doc_by_name[name]}
                if not (missing_names or introduced_names or changed_names):
                    continue
                delta = {
                    "document": document_name, "entity_type": entity_type,
                    "transcript_values": [_display_entity(entity_type, source_by_name[n]) for n in sorted(source_by_name)],
                    "document_values": [_display_entity(entity_type, doc_by_name[n]) for n in sorted(doc_by_name)],
                    "missing": [_display_entity(entity_type, source_by_name[n]) for n in sorted(missing_names | changed_names)],
                    "introduced": [_display_entity(entity_type, doc_by_name[n]) for n in sorted(introduced_names | changed_names)],
                }
            else:
                source_set, document_set = set(source_values), set(document_values)
                if entity_type == "duration":
                    source_contexts = {item[0] for item in source_set}
                    # Clinician-added follow-up timing is supplemental plan
                    # guidance, not a change to source symptom/treatment duration.
                    document_set = {item for item in document_set
                                    if item[0] in source_contexts or item[0] != "follow_up"}
                missing, introduced = sorted(source_set - document_set), sorted(document_set - source_set)
                if not missing and not introduced:
                    continue
                delta = {"document": document_name, "entity_type": entity_type,
                         "transcript_values": [_display_entity(entity_type, value) for value in sorted(source_set)],
                         "document_values": [_display_entity(entity_type, value) for value in sorted(document_set)],
                         "missing": [_display_entity(entity_type, value) for value in missing],
                         "introduced": [_display_entity(entity_type, value) for value in introduced]}
            mismatches.append(delta)
            if document_name == "final_record":
                final_mismatches.append(delta)
    fingerprint = hashlib.sha256(json.dumps(mismatches, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {"has_mismatch": bool(mismatches), "final_has_mismatch": bool(final_mismatches),
            "can_resolve": bool(mismatches) and not final_mismatches, "mismatches": mismatches,
            "fingerprint": fingerprint}


def require_clinical_review(validation, reviewed_fingerprint=None, pending_review=False):
    """Raise until final entities match the transcript and any review is recorded."""
    from fastapi import HTTPException
    if validation["final_has_mismatch"]:
        raise HTTPException(409, detail={"code": "SOAP_CLINICAL_MISMATCH",
            "message": "Clinical review required. Resolve clinical mismatches before signing.", "validation": validation})
    if pending_review or (validation["has_mismatch"] and validation["fingerprint"] != reviewed_fingerprint):
        raise HTTPException(409, detail={"code": "SOAP_CLINICAL_REVIEW_REQUIRED",
            "message": "Clinical review required. Resolve clinical mismatches before signing.", "validation": validation})
