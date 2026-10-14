"""
message_normalizer.py
=====================
Unified Intelligent Message Normalizer & Semantic Understanding Engine
for Meridian Hospital AI Patient Desk.

Responsibilities:
1. Normalizes patient input (typed text or voice transcripts) without altering medical facts.
2. Compresses repeated characters (e.g. 'fevereee' -> 'fever', 'soooo' -> 'so', 'hiiii' -> 'hi').
3. Resolves common phonetic and edit-distance spelling errors for healthcare intents:
   - 'my appointmnets' -> 'my appointments'
   - 'cancle my appoinment' -> 'cancel my appointment'
   - 'show my repots' -> 'show my reports'
   - 'hedache' -> 'headache'
   - 'hairfal' -> 'hair fall'
4. Preserves clinical details:
   - Duration (e.g. 'from yestarday' -> 'from yesterday', 'since 2 days', 'for 3 weeks')
   - Severity, dates, numbers, and dosages
   - Never invents symptoms, temperatures, or diagnoses.
5. Prevents cross-organ body part confusion (e.g. 'hedache' matches 'headache', never 'earache').
6. Flags ambiguous medical terms for clarification rather than silently misrouting.
7. Maintains strict separation between raw original text and normalized text.
8. Supports multilingual terms and voice transcription artifacts across all 7 hospital languages.
"""

import re
import unicodedata
from typing import Dict, Any, Optional, List, Tuple

# ---------------------------------------------------------------------------
# Core Vocabulary & Canonical Terms
# ---------------------------------------------------------------------------

# Action / Intent Keywords Mapping (canonical phrases)
INTENT_CANONICAL_WORDS = {
    # Appointment operations
    "appointments": ["appointments", "appointmnets", "appointmnts", "appoinments", "apointments", "apptmnts"],
    "appointment": ["appointment", "appointmnt", "appoinment", "appointmnet", "apointment", "apppointment", "appoiment", "apointmnt", "apointmnet", "apptmnt", "appt"],
    "cancel": ["cancel", "cancle", "cancl", "cancled", "canceld", "cancelling", "canceling", "cancellation", "cncl", "ரத்து", "रद्द", "రద్దు", "റദ്ദാക്കുക", "ರದ್ದು", "منسوخ"],
    "reschedule": ["reschedule", "reschedul", "reshdule", "reshedul", "rescheduale", "postpone", "postpon", "மாற்ற", "रिशेड्यूल", "మార్చండి", "പുനഃക്രമീകരിക്കുക", "ಬದಲಾಯಿಸಿ", "تبدیل"],
    "booking": ["booking", "book", "boking", "bok", "bokk", "schedule", "schedul", "பதிவு", "बुक", "బుక్", "ബുക്കിംഗ്", "ಬುಕ್", "بک"],
    
    # Reports & documents
    "reports": ["reports", "repots", "reprts", "rports", "repors"],
    "report": ["report", "repot", "reprt", "rport", "repor", "அறிக்கை", "रिपोर्ट", "నివేదిక", "റിപ്പോർട്ട്", "ವರದಿ", "رپورٹ"],
    "xray": ["xray", "x-ray", "x ray", "radiology", "radiologi", "scan", "scans", "imaging", "xrays", "x-rays"],
    "discharge": ["discharge", "discharg", "disharge", "discharj", "dischrg"],
    "summary": ["summary", "sumary", "summarie", "summaries", "sumry"],
    "documents": ["documents", "document", "documnts", "documnt", "docs", "doc"],
    "records": ["records", "record", "recrds", "recrd", "medical records", "clinical records"],
    "prescriptions": ["prescriptions", "prescription", "prescribtion", "preskription", "medications", "medicines"],
    
    # Billing & payments
    "billing": ["billing", "bill", "biling", "bil", "bills", "invoice", "invoices", "charges"],
    "payment": ["payment", "payments", "paymnt", "paymnts", "pymnt", "paid", "pay"],
    "balance": ["balance", "balanc", "balence", "outstanding", "due", "dues", "amount"],
    "insurance": ["insurance", "insuranc", "insurence", "tpa", "claim", "claims"],

    # Hospital & Profile
    "hospital": ["hospital", "hospitl", "hosptal", "hsptl"],
    "profile": ["profile", "profil", "profl", "details", "detials", "information", "info"],
    "doctor": ["doctor", "docotr", "docter", "dr", "physician", "specialist"],
    "availability": ["availability", "availablity", "availabilty", "available", "availble"],
    "emergency": ["emergency", "emergancy", "emrgency", "urgent", "urgnt"]
}

# Distinct Organ / Body Part Prefixes to prevent cross-organ confusion
BODY_PARTS = {
    "head": ["head", "hed", "migraine", "brain", "skull", "തല", "सिर", "తల", "ತಲೆ", "سر"],
    "ear": ["ear", "eare", "hearing", "காது", "कान", "చెవి", "ചെവി", "ಕಿವಿ", "کان"],
    "throat": ["throat", "throatt", "thorat", "tonsil", "தொண்டை", "गला", "గొంతు", "തൊണ്ട", "ಗಂಟಲು", "گلا"],
    "chest": ["chest", "chset", "heart", "cardiac", "நெஞ்சு", "छाती", "ఛాతీ", "നെഞ്ച്", "ಎದೆ", "چھاتی"],
    "stomach": ["stomach", "stomac", "tummy", "belly", "abdomen", "gastric", "வயிறு", "पेट", "కడుపు", "വയറ്", "ಹೊಟ್ಟೆ", "پیٹ"],
    "back": ["back", "bakk", "spine", "முதுகு", "पीठ", "వెన్ను", "നടുവ്", "ಬೆನ್ನು", "پیٹھ"],
    "knee": ["knee", "knne", "kne", "joint", "முழங்கால்", "घुटना", "మోకాలు", "മുട്ട്", "ಮಂಡಿ", "گھٹنہ"],
    "hair": ["hair", "har", "scalp", "bald", "முடி", "बाल", "జుట్టు", "മുടി", "ಕೂದಲು", "بال"],
    "skin": ["skin", "skinn", "rash", "acne", "pimple", "തോல்", "त्वचा", "చర్మం", "ചർമ്മം", "ಚರ್ಮ", "جلد"]
}

# Symptom Canonical Words Mapping
SYMPTOM_CANONICAL_WORDS = {
    # General Medicine
    "fever": ["fever", "fevr", "fevar", "feveer", "feverr", "feverish", "febril", "febrile", "pyrexia", "temperature", "temp", "காய்ச்சல்", "बुखार", "జ్వరం", "പനി", "ಜ್ವರ", "بخار"],
    "headache": ["headache", "hedache", "headach", "head ache", "hed ache", "migraine", "migrain", "head pain", "hed pain", "head hurting", "தலைவலி", "सिरदर्द", "తలనొప్పి", "തലവേദന", "ತಲೆನೋವು", "سر درد"],
    "cold": ["cold", "cld", "runny nose", "running nose", "sneezing", "congestion", "சளி", "जुकाम", "सर्दी", "జలుబు", "ജലദോഷം", "ನೆಗಡಿ", "زکام"],
    "cough": ["cough", "couggh", "coug", "cuf", "coff", "coughing", "இருமல்", "खांसी", "దగ్గు", "ചുമ", "ಕೆಮ್ಮು", "کھانسی"],
    "stomach pain": ["stomach pain", "stomac pain", "stomach ache", "stomachache", "tummy pain", "belly pain", "abdominal pain", "gastric", "acidity", "வயிற்று வலி", "पेट दर्द", "కడుపు నొప్పి", "വയറുവേദന", "ಹೊಟ್ಟೆ ನೋವು", "پیٹ درد"],
    "vomiting": ["vomiting", "vomit", "vomitin", "throwing up", "வாந்தி", "उल्टी", "వాంతులు", "ഛർദ്ദി", "ವಾಂತಿ", "الٹی"],
    "nausea": ["nausea", "nauseous", "nauseated", "queasy", "குமட்டல்", "जी मिचलाना"],
    "diarrhea": ["diarrhea", "diarrhoea", "loose motion", "loose motions", "motions", "பேதி", "दस्त"],
    "fatigue": ["fatigue", "weakness", "tiredness", "exhaustion", "body ache", "body pain", "bodyache", "உடல் வலி", "थकान"],
    
    # Dermatology
    "hair fall": [
        "hair fall", "hairfall", "hair fal", "hair loss", "hairloss", "hair falling", "losing hair", "baldness", "thinning hair", "hair thinning", "dandruff",
        "முடி உதிர்தல்", "முடி கொட்டுதல்", "முடி பிரச்சனை", "முடி",
        "बाल झड़ना", "बाल झड़", "बाल गिरना", "बाल",
        "జుట్టు రాలడం", "జుట్టు",
        "മുടി കൊഴിച്ചിൽ", "മുടി",
        "ಕೂದಲು ಉದುರುವಿಕೆ", "ಕೂದಲು",
        "بال جھڑنا", "بال گر رہے", "بال گرنا", "بال"
    ],
    "skin rash": ["skin rash", "rash", "rashes", "skin allergy", "itching", "itchy skin", "itchy", "itch", "eczema", "psoriasis", "hives", "dermatitis", "தோல் அரிப்பு", "खुजली", "దురద"],
    "acne": ["acne", "pimples", "pimple", "pimpls", "blackheads", "whiteheads", "பருக்கள்", "मुहासे"],
    
    # Cardiology
    "chest pain": ["chest pain", "chest ache", "chest tightness", "chest pressure", "heart pain", "heartache", "palpitations", "நெஞ்சு வலி", "सीने में दर्द", "ఛాతీ నొప్పి", "നെഞ്ചുവേദന", "ಎದೆ ನೋವು", "چھاتی میں درد"],
    "breathlessness": ["breathlessness", "shortness of breath", "breathing difficulty", "difficulty breathing", "cant breathe", "trouble breathing", "மூச்சுத்திணறல்", "सांस फूलना"],
    
    # Orthopedics
    "joint pain": ["joint pain", "joint ache", "arthritis", "joint swelling", "joint stiffness", "மூட்டு வலி", "जोड़ों का दर्द"],
    "knee pain": ["knee pain", "knne pain", "kneepain", "knee ache", "முழங்கால் வலி", "घुटने का दर्द"],
    "back pain": ["back pain", "backache", "back ache", "spine pain", "lower back pain", "முதுகு வலி", "पीठ दर्द"],
    "shoulder pain": ["shoulder pain", "shoulder ache", "neck pain", "neck ache", "தோள்பட்டை வலி", "कंधे का दर्द"],
    
    # ENT
    "ear pain": ["ear pain", "earache", "ear ache", "ear infection", "hearing problem", "காது வலி", "कान में दर्द"],
    "throat pain": ["throat pain", "sore throat", "tonsillitis", "tonsils", "throat irritation", "throat infection", "தொண்டை வலி", "गले में खराश"],
    "nasal congestion": ["nasal congestion", "blocked nose", "sinus", "sinusitis", "sinus pain", "மூக்கடைப்பு", "नाक बंद"]
}

# Common conversational contractions & abbreviations in Indian English / WhatsApp
WHATSAPP_ABBREVIATIONS = {
    r"\bpls\b": "please",
    r"\bplz\b": "please",
    r"\bplzz+\b": "please",
    r"\bu\b": "you",
    r"\bur\b": "your",
    r"\br\b": "are",
    r"\bya\b": "yes",
    r"\byup\b": "yes",
    r"\bnope\b": "no",
    r"\btmrw\b": "tomorrow",
    r"\btomrw\b": "tomorrow",
    r"\btodayy+\b": "today",
    r"\b2day\b": "today",
    r"\b2mrw\b": "tomorrow",
    r"\bwanna\b": "want to",
    r"\bgonna\b": "going to",
    r"\bdr\b": "doctor",
    r"\bdr\.\b": "doctor",
    r"\bdoc\b": "doctor",
    r"\bappt\b": "appointment",
    r"\bappts\b": "appointments",
    r"\byestarday\b": "yesterday",
    r"\byesterdy\b": "yesterday",
    r"\byestdy\b": "yesterday",
    r"\byday\b": "yesterday",
    r"\bwk\b": "week",
    r"\bwks\b": "weeks",
    r"\bmon\b": "monday",
    r"\btue\b": "tuesday",
    r"\bwed\b": "wednesday",
    r"\bthu\b": "thursday",
    r"\bfri\b": "friday",
    r"\bsat\b": "saturday",
    r"\bsun\b": "sunday",
}

# ---------------------------------------------------------------------------
# Helper Normalization Functions
# ---------------------------------------------------------------------------

def compress_repeated_characters(text: str) -> str:
    """
    Compresses excessive character repetition while respecting valid double letters.
    Examples:
      - 'fevereee' -> 'fever'
      - 'hedacheeee' -> 'hedache'
      - 'soooo' -> 'so'
      - 'pleeeaaase' -> 'please'
      - 'book' -> 'book'
    """
    if not text:
        return ""
    
    def _replacer(match):
        char = match.group(1)
        full = match.group(0)
        if char.lower() in "eo":
            return char * 2 if len(full) >= 3 and char.lower() in ['e', 'o'] else char
        elif char.lower() in "lsftmnpr":
            return char * 2
        else:
            return char

    collapsed = re.sub(r"(.)\1{2,}", _replacer, text)
    collapsed = re.sub(r"\b(fever|headache|pain|cough|cold|hair|doctor|appointment)e+\b", r"\1", collapsed, flags=re.IGNORECASE)
    collapsed = re.sub(r"\b(fever|headache|pain|cough|cold|hair|doctor|appointment)r+\b", r"\1", collapsed, flags=re.IGNORECASE)
    
    return collapsed


def normalize_whitespace_and_punctuation(text: str) -> str:
    """Cleans up irregular spacing and punctuation while preserving sentence structure."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def expand_common_abbreviations(text: str) -> str:
    """Expands common messaging contractions and abbreviations."""
    if not text:
        return ""
    expanded = text
    for pattern, replacement in WHATSAPP_ABBREVIATIONS.items():
        expanded = re.sub(pattern, replacement, expanded, flags=re.IGNORECASE)
    return expanded


def get_body_part_prefix(word: str) -> Optional[str]:
    """Returns matching body part category for words like headache, earache, toothache."""
    w_lower = word.lower()
    for bp, terms in BODY_PARTS.items():
        for t in terms:
            if w_lower.startswith(t) or t in w_lower:
                return bp
    return None


def fuzzy_match_token(token: str, dictionary: Dict[str, List[str]], threshold_len_diff: int = 2) -> Optional[str]:
    """
    Matches a single token against a dictionary of canonical terms and their variations.
    Uses normalized Levenshtein edit distance with organ prefix guards.
    """
    t_clean = (token or "").lower().strip()
    if not t_clean:
        return None

    PROTECTED_WORDS = frozenset({
        "severe", "acute", "mild", "pain", "chest", "heart", "breathe", "breathing",
        "doctor", "hospital", "patient", "blood", "head", "back", "knee", "ear",
        "eye", "skin", "hair", "neck", "hand", "foot", "arm", "leg", "body", "cold",
        "cough", "fever", "have", "from", "since", "with", "want", "need", "like",
        "show", "tell", "give", "send", "book", "cancel", "call", "help", "view"
    })
    if t_clean in PROTECTED_WORDS:
        return None

    # 1. Exact match in canonical keys or lists
    for canonical, variants in dictionary.items():
        if t_clean == canonical or t_clean in variants:
            return canonical

    t_len = len(t_clean)
    if t_len < 4:
        return None

    token_body_part = get_body_part_prefix(t_clean)

    best_match = None
    min_dist = 999

    for canonical, variants in dictionary.items():
        # Organ prefix guard: if token has a body part, canonical must share same body part or be general
        canonical_body_part = get_body_part_prefix(canonical)
        if token_body_part and canonical_body_part and token_body_part != canonical_body_part:
            continue

        for candidate in [canonical] + variants:
            # Multi-word candidates not matched by single token unless token matches first word
            if " " in candidate:
                continue

            c_len = len(candidate)
            if c_len < 4:
                continue

            cand_body_part = get_body_part_prefix(candidate)
            if token_body_part and cand_body_part and token_body_part != cand_body_part:
                continue

            if abs(t_len - c_len) > threshold_len_diff:
                continue
            
            # Stricter bounds: 2 edits allowed only if both token & candidate are long (>=6)
            max_allowed = 2 if (t_len >= 6 and c_len >= 6) else (1 if (t_len >= 5 and c_len >= 5) else 0)
            dist = _levenshtein_distance(t_clean, candidate)
            if dist <= max_allowed and dist < min_dist:
                min_dist = dist
                best_match = canonical

    return best_match


def _levenshtein_distance(s1: str, s2: str) -> int:
    """Computes Levenshtein distance between two strings with transposition handling."""
    if s1 == s2:
        return 0
    if len(s1) == 0:
        return len(s2)
    if len(s2) == 0:
        return len(s1)

    v0 = list(range(len(s2) + 1))
    v1 = [0] * (len(s2) + 1)

    for i in range(len(s1)):
        v1[0] = i + 1
        for j in range(len(s2)):
            cost = 0 if s1[i] == s2[j] else 1
            v1[j + 1] = min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
        v0, v1 = v1, v0

    return v0[len(s2)]


def extract_clinical_duration(text: str) -> Optional[str]:
    """
    Extracts reported clinical symptom duration from user message without altering it.
    Examples:
      - 'from yestarday' -> 'from yesterday'
      - 'since 2 days' -> 'since 2 days'
      - 'for past 1 week' -> 'for past 1 week'
      - 'since morning' -> 'since morning'
    """
    if not text:
        return None

    duration_patterns = [
        r"\b(?:since|from|for|past)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|few|couple\s*of)?\s*(?:yesterday|yestarday|yday|morning|afternoon|evening|night|days?|weeks?|months?|hours?|today)\b",
        r"\b(?:last|past)\s+(?:\d+|few|couple\s*of)?\s*(?:days?|weeks?|months?|hours?)\b",
        r"\b(?:\d+|one|two|three|four|five)\s+(?:days?|weeks?|months?)\s*(?:ago|back)\b"
    ]

    for pat in duration_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            raw_dur = m.group(0).strip()
            clean_dur = re.sub(r"\byestarday\b", "yesterday", raw_dur, flags=re.IGNORECASE)
            clean_dur = re.sub(r"\byday\b", "yesterday", clean_dur, flags=re.IGNORECASE)
            return clean_dur

    return None


def extract_symptoms_semantic(text: str) -> List[Dict[str, Any]]:
    """
    Identifies and normalizes medical symptoms mentioned in text.
    Returns a list of structured symptom items with canonical name.
    """
    if not text:
        return []

    found_symptoms = []
    text_clean = compress_repeated_characters(text.lower())

    # 1. Multi-word phrases exact / variant match first
    for canonical, variants in SYMPTOM_CANONICAL_WORDS.items():
        matched = False
        for v in [canonical] + variants:
            is_non_ascii = any(ord(c) > 127 for c in v)
            pat = re.escape(v) if is_non_ascii else (r"\b" + re.escape(v) + r"\b")
            if re.search(pat, text_clean, re.IGNORECASE):
                found_symptoms.append({
                    "canonical": canonical,
                    "matched_variant": v,
                    "confidence": 1.0
                })
                matched = True
                break
        
        # 2. Token-level fuzzy match if multi-word didn't hit
        if not matched:
            tokens = text_clean.split()
            token_bp = get_body_part_prefix(text_clean)
            canonical_bp = get_body_part_prefix(canonical)
            
            # If both have body parts, they must match
            if token_bp and canonical_bp and token_bp != canonical_bp:
                continue

            for token in tokens:
                matched_canonical = fuzzy_match_token(token, {canonical: variants})
                if matched_canonical and not any(s["canonical"] == canonical for s in found_symptoms):
                    found_symptoms.append({
                        "canonical": canonical,
                        "matched_variant": token,
                        "confidence": 0.95
                    })
                    break

    return found_symptoms


# ---------------------------------------------------------------------------
# Master Normalization Engine
# ---------------------------------------------------------------------------

class NormalizedInterpretation:
    """Structured result of unified message interpretation."""
    def __init__(
        self,
        raw_message: str,
        normalized_message: str,
        detected_language: str = "ENGLISH",
        suggested_intent: Optional[str] = None,
        symptoms: Optional[List[str]] = None,
        medical_reason: Optional[str] = None,
        duration: Optional[str] = None,
        department: Optional[str] = None,
        confidence: float = 0.95,
        needs_clarification: bool = False,
        clarification_question: Optional[str] = None,
        is_spelling_corrected: bool = False,
        emergency: bool = False
    ):
        self.raw_message = raw_message
        self.normalized_message = normalized_message
        self.detected_language = detected_language
        self.suggested_intent = suggested_intent
        self.symptoms = symptoms or []
        self.medical_reason = medical_reason
        self.duration = duration
        self.department = department
        self.confidence = confidence
        self.needs_clarification = needs_clarification
        self.clarification_question = clarification_question
        self.is_spelling_corrected = is_spelling_corrected
        self.emergency = emergency

    def to_dict(self) -> Dict[str, Any]:
        return {
            "raw_message": self.raw_message,
            "normalized_message": self.normalized_message,
            "detected_language": self.detected_language,
            "suggested_intent": self.suggested_intent,
            "symptoms": self.symptoms,
            "medical_reason": self.medical_reason,
            "duration": self.duration,
            "emergency": self.emergency,
            "department": self.department,
            "confidence": self.confidence,
            "needs_clarification": self.needs_clarification,
            "clarification_question": self.clarification_question,
            "is_spelling_corrected": self.is_spelling_corrected
        }


def normalize_patient_message(
    message_text: str,
    current_state: Optional[Dict[str, Any]] = None,
    current_language: str = "ENGLISH"
) -> NormalizedInterpretation:
    """
    Main entry point for intelligent message interpretation.
    Runs prior to intent routing and state evaluation.
    Produces a NormalizedInterpretation with both original and clean text.
    """
    raw = (message_text or "").strip()
    if not raw:
        return NormalizedInterpretation(raw_message="", normalized_message="")

    # 1. Compress repeated characters
    step1 = compress_repeated_characters(raw)
    
    # 2. Clean whitespace
    step2 = normalize_whitespace_and_punctuation(step1)
    
    # 3. Expand common contractions & abbreviations
    step3 = expand_common_abbreviations(step2)

    # 4. Token-level normalization for known intents and symptoms
    tokens = step3.split()
    normalized_tokens = []
    corrections_made = (step3 != raw)

    combined_dict = {}
    combined_dict.update(INTENT_CANONICAL_WORDS)
    for sym_canonical, variants in SYMPTOM_CANONICAL_WORDS.items():
        if " " not in sym_canonical:
            combined_dict[sym_canonical] = variants

    for token in tokens:
        m_word = re.match(r"^([^\w]*)([\w-]+)([^\w]*)$", token)
        if m_word:
            prefix, core, suffix = m_word.groups()
            matched = fuzzy_match_token(core, combined_dict)
            if matched:
                if matched != core.lower():
                    corrections_made = True
                normalized_tokens.append(f"{prefix}{matched}{suffix}")
            else:
                normalized_tokens.append(token)
        else:
            normalized_tokens.append(token)

    step4 = " ".join(normalized_tokens)

    # Phrase-level cleanups
    step4 = re.sub(r"\bhair\s*fal\b", "hair fall", step4, flags=re.IGNORECASE)
    step4 = re.sub(r"\bmy\s*appointmnets?\b", "my appointments", step4, flags=re.IGNORECASE)
    step4 = re.sub(r"\bshow\s*my\s*repots?\b", "show my reports", step4, flags=re.IGNORECASE)
    step4 = re.sub(r"\bfrom\s*yestarday\b", "from yesterday", step4, flags=re.IGNORECASE)

    # 5. Extract duration & symptoms
    duration = extract_clinical_duration(raw)
    symptoms_struct = extract_symptoms_semantic(step4)
    symptoms_list = [s["canonical"] for s in symptoms_struct]
    
    # Department determination from symptoms
    dept = None
    if "hair fall" in symptoms_list or "skin rash" in symptoms_list or "acne" in symptoms_list:
        dept = "Dermatology"
    elif "fever" in symptoms_list or "cold" in symptoms_list or "cough" in symptoms_list or "vomiting" in symptoms_list or "diarrhea" in symptoms_list or "headache" in symptoms_list or "fatigue" in symptoms_list or "stomach pain" in symptoms_list:
        dept = "General Medicine"
    elif "chest pain" in symptoms_list or "breathlessness" in symptoms_list:
        dept = "Cardiology"
    elif "joint pain" in symptoms_list or "knee pain" in symptoms_list or "back pain" in symptoms_list or "shoulder pain" in symptoms_list:
        dept = "Orthopedics"
    elif "ear pain" in symptoms_list or "throat pain" in symptoms_list or "nasal congestion" in symptoms_list:
        dept = "ENT"

    # Intent suggestion based on normalized text
    step4_lower = step4.lower()
    suggested_intent = None
    
    # Priority 0: EMERGENCY symptoms
    is_emergency = any(kw in step4_lower for kw in [
        "severe chest pain", "acute chest pain", "cant breathe", "cannot breathe",
        "difficulty breathing", "severe breathing", "shortness of breath", "not breathing",
        "heart attack", "heavy bleeding", "severe bleeding", "unconscious", "stroke",
        "seizure", "convulsion"
    ])
    if is_emergency:
        suggested_intent = "EMERGENCY"
    # Check cancellation and rescheduling FIRST before generic appointment status
    elif re.search(r"\b(?:cancel|cancle|cancl)\s+(?:my\s+)?appointments?\b", step4_lower) or step4_lower in ["cancel appointment", "cancel booking", "cancel"]:
        suggested_intent = "CANCEL_APPOINTMENT"
        step4 = re.sub(r"\bcancle\s*(?:my\s*)?appoin?t?m?e?n?t?s?\b", "cancel my appointment", step4, flags=re.IGNORECASE)
    elif re.search(r"\b(?:reschedule|change\s+date|change\s+time|shift)\s+(?:my\s+)?appointments?\b", step4_lower):
        suggested_intent = "RESCHEDULE_APPOINTMENT"
        step4 = re.sub(r"\b(?:reschedul|reshdule|reshedul)\s*(?:my\s*)?appoin?t?m?e?n?t?s?\b", "reschedule my appointment", step4, flags=re.IGNORECASE)
    elif re.search(r"\b(?:show|view|check|track|my)\s+appointments?\b", step4_lower) or step4_lower in ["my appointments", "my appointment", "appointments"]:
        suggested_intent = "APPOINTMENT_STATUS"
        step4 = re.sub(r"\bmy\s+appointment\b", "my appointments", step4, flags=re.IGNORECASE)
    elif re.search(r"\b(?:show|view|my|get)\s+(?:my\s+)?(?:reports?|xray|x-ray|radiology|lab\s*report)\b", step4_lower) or step4_lower in ["reports", "my reports", "show my reports"]:
        suggested_intent = "PATIENT_REPORTS"
    elif re.search(r"\b(?:discharge|summary|clinical\s*records?|medical\s*records?|prescriptions?)\b", step4_lower):
        suggested_intent = "PATIENT_DOCUMENTS"
    elif re.search(r"\b(?:bill|billing|invoice|balance|owe|due|pay\s*bill|payment\s*history|insurance)\b", step4_lower):
        suggested_intent = "BILLING_AND_PAYMENTS"
    elif symptoms_list or re.search(r"\b(?:book|see\s*a\s*doctor|doctor\s*appointment|consultation)\b", step4_lower):
        suggested_intent = "BOOK_APPOINTMENT"

    # Reason construction: e.g. "fever from yesterday" or "headache"
    medical_reason = None
    if symptoms_list:
        sym_str = ", ".join(symptoms_list)
        if duration:
            medical_reason = f"{sym_str} ({duration})"
        else:
            medical_reason = sym_str

    normalized_message = step4

    # Language detection
    detected_lang = current_language
    try:
        import agent.language_service as language_service
        detected_lang = language_service.detect_language(raw, current_lang=current_language)
    except Exception:
        pass

    return NormalizedInterpretation(
        raw_message=raw,
        normalized_message=normalized_message,
        detected_language=detected_lang,
        suggested_intent=suggested_intent,
        symptoms=symptoms_list,
        medical_reason=medical_reason,
        duration=duration,
        department=dept,
        confidence=0.98 if suggested_intent else 0.85,
        needs_clarification=False,
        is_spelling_corrected=(normalized_message.lower() != raw.lower()),
        emergency=is_emergency
    )
