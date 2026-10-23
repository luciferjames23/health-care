"""
feedback_agent.py
=================
Feedback Agent (AG-05) for Meridian Hospital AI Patient Desk.

Provides production-grade semantic feedback understanding, sentiment classification,
category & issue extraction, patient identity verification, rating handling,
and automated PostgreSQL persistence with service recovery escalation support.
"""

import sys
import os
import json
import re
import datetime
import traceback
from typing import Dict, Any, Optional, List, Tuple

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import agent.llm_service as llm_service
import agent.language_service as language_service

# Controlled Taxonomy of Feedback Categories
FEEDBACK_CATEGORIES = [
    "Doctor / Clinical Care",
    "Nursing",
    "Staff / Service",
    "Waiting Time",
    "Appointment",
    "Billing",
    "Insurance",
    "Pharmacy",
    "Laboratory",
    "Radiology",
    "Food / Dining",
    "Cleanliness",
    "Room / Facilities",
    "Emergency",
    "Communication",
    "Hospital Information",
    "Registration",
    "Discharge",
    "Other"
]

# Acute emergency / patient safety key phrases
EMERGENCY_SAFETY_PATTERNS = [
    r"\b(chest\s*pain|severe\s*chest|cannot\s*breathe|can't\s*breathe|not\s*breathing|breathing\s*difficulty|shortness\s*of\s*breath|heart\s*attack|stroke|unconscious|heavy\s*bleed|severe\s*bleeding|trauma|poisoning|overdose|seizure|anaphylaxis)\b",
    r"(நெஞ்சு\s*வலி|சுவாசிக்க\s*முடியவில்லை|அவசர|அதிக\s*ரத்தப்போக்கு)",
    r"(छाती\s*में\s*दर्द|सांस\s*लेने\s*में\s*तकलीफ|आपातकालीन|भारी\s*रक्तस्राव)"
]


def check_emergency_feedback(text: str) -> bool:
    """Checks if feedback contains an acute emergency or immediate patient safety concern."""
    t_lower = (text or "").lower()
    for pat in EMERGENCY_SAFETY_PATTERNS:
        if re.search(pat, t_lower, re.IGNORECASE):
            return True
    return False


def extract_rating_from_text(text: str) -> Optional[int]:
    """Extracts explicit 1-10 numerical rating from natural language text if present."""
    if not text:
        return None
    # Matches "8/10", "8 out of 10", "rated 9", "10 stars", "gives 7", etc.
    m1 = re.search(r"\b([1-9]|10)\s*(?:/|out\s+of)\s*10\b", text, re.IGNORECASE)
    if m1:
        try:
            return int(m1.group(1))
        except ValueError:
            pass
            
    m2 = re.search(r"\b(?:rating|rate|score|give|gave|gives)\s*(?:is|=|:)?\s*([1-9]|10)\b", text, re.IGNORECASE)
    if m2:
        try:
            return int(m2.group(1))
        except ValueError:
            pass

    # Bare single digits 1..10 if message is short
    if text.strip().isdigit():
        val = int(text.strip())
        if 1 <= val <= 10:
            return val
            
    return None


def analyze_patient_feedback(
    feedback_text: str,
    explicit_rating: Optional[int] = None,
    language: str = "ENGLISH"
) -> Dict[str, Any]:
    """
    Uses semantic AI understanding to analyze patient feedback.
    Classifies sentiment (POSITIVE, NEGATIVE, NEUTRAL, MIXED), categories,
    issues, summary, severity, and recommended action.
    """
    clean_text = (feedback_text or "").strip()
    detected_lang = language_service.detect_language(clean_text) or language or "ENGLISH"
    
    # 1. Emergency safety check
    is_emergency = check_emergency_feedback(clean_text)
    if is_emergency:
        return {
            "sentiment": "NEGATIVE",
            "rating": explicit_rating or 1,
            "categories": ["Emergency", "Doctor / Clinical Care"],
            "issues": ["patient_safety_concern", "acute_symptom_after_discharge"],
            "summary": f"IMMEDIATE SAFETY CONCERN: {clean_text}",
            "severity": "CRITICAL",
            "requires_action": True,
            "recommended_action": "Immediate clinical emergency response / follow-up",
            "language": detected_lang,
            "confidence": 1.0,
            "is_emergency": True
        }

    # Extract or fallback rating
    extracted_r = extract_rating_from_text(clean_text)
    final_rating = explicit_rating if explicit_rating is not None else extracted_r

    # 2. Try LLM semantic understanding first
    system_prompt = (
        "You are an expert healthcare patient experience agent for Meridian Hospital.\n"
        "Analyze the patient feedback carefully. Feedback may be in English, Tamil, Hindi, Tanglish, or other languages.\n"
        "Do NOT perform simple keyword matching. Understand the semantic meaning, spelling errors, and mixed languages.\n\n"
        "You MUST return ONLY a JSON object with this exact structure:\n"
        "{\n"
        '  "sentiment": "POSITIVE | NEGATIVE | NEUTRAL | MIXED",\n'
        '  "categories": ["Category 1", "Category 2"],\n'
        '  "issues": ["issue_1", "issue_2"],\n'
        '  "summary": "Clear, concise 1-2 sentence summary of feedback",\n'
        '  "severity": "LOW | MEDIUM | HIGH | CRITICAL",\n'
        '  "requires_action": true | false,\n'
        '  "recommended_action": "Actionable recommendation for staff",\n'
        '  "confidence": 0.95\n'
        "}\n\n"
        f"Allowed categories list: {json.dumps(FEEDBACK_CATEGORIES)}\n"
    )

    user_prompt = (
        f"Patient Feedback: \"{clean_text}\"\n"
        f"Selected Rating: {final_rating if final_rating is not None else 'Not provided'}\n"
        f"Language context: {detected_lang}"
    )

    try:
        raw_llm = None
        if hasattr(llm_service, '_call_gemini_freetext'):
            raw_llm = llm_service._call_gemini_freetext(user_prompt, system_instruction=system_prompt)
        elif hasattr(llm_service, '_call_gemini_api'):
            raw_llm = llm_service._call_gemini_api(f"{system_prompt}\n\n{user_prompt}")
        elif hasattr(llm_service, '_call_openai_api'):
            raw_llm = llm_service._call_openai_api(f"{system_prompt}\n\n{user_prompt}")

        if raw_llm:
            json_match = re.search(r"\{.*\}", raw_llm, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                # Validate sentiment
                sentiment = str(parsed.get("sentiment", "NEUTRAL")).upper()
                if sentiment not in ["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]:
                    sentiment = "NEUTRAL"

                severity = str(parsed.get("severity", "LOW")).upper()
                if severity not in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
                    severity = "LOW"

                cats = parsed.get("categories", [])
                if not isinstance(cats, list):
                    cats = [str(cats)]

                return {
                    "sentiment": sentiment,
                    "rating": final_rating,
                    "categories": cats or ["Staff / Service"],
                    "issues": parsed.get("issues", []),
                    "summary": str(parsed.get("summary", clean_text)),
                    "severity": severity,
                    "requires_action": bool(parsed.get("requires_action", sentiment in ["NEGATIVE", "MIXED"] and severity in ["HIGH", "CRITICAL"])),
                    "recommended_action": str(parsed.get("recommended_action", "Review patient feedback")),
                    "language": detected_lang,
                    "confidence": float(parsed.get("confidence", 0.95)),
                    "is_emergency": False
                }
    except Exception as e:
        print(f"[FEEDBACK_AGENT_LLM_WARN] Fallback to semantic heuristic rule analyzer: {e}")

    # 3. Robust Fallback Semantic Heuristic Rule Classifier (when LLM unavailable)
    return _rule_based_feedback_analysis(clean_text, final_rating, detected_lang)


def _rule_based_feedback_analysis(text: str, rating: Optional[int], lang: str) -> Dict[str, Any]:
    """Production fallback rule-based semantic analyzer for offline/mock mode."""
    t_lower = (text or "").lower()

    # Positive keywords across languages
    pos_words = [
        "good", "great", "excellent", "loved", "kind", "helpful", "wonderful", "satisfied",
        "nice", "best", "thank", "thanks", "awesome", "fast", "caring", "clear",
        "நல்ல", "சிறந்த", "நன்றி", "அருமை", "நல்லது",
        "अच्छा", "बढ़िया", "उत्कृष्ट", "धन्यवाद", "बहुत अच्छा"
    ]

    # Negative keywords across languages
    neg_words = [
        "cold", "delay", "delayed", "slow", "long", "hours", "late", "bad", "worst", "unhappy",
        "poor", "rude", "dirty", "horrible", "terrible", "waiting", "wait", "charge", "expensive",
        "பசி", "லேட்", "நேரம்", "மோசம்", "கெட்ட",
        "ठंडा", "देरी", "खराब", "गंदा", "शिकायत", "लंबा"
    ]

    pos_count = sum(1 for w in pos_words if w in t_lower)
    neg_count = sum(1 for w in neg_words if w in t_lower)

    strong_neg_words = ["cold", "bad", "worst", "unhappy", "horrible", "terrible", "poor", "dirty", "three hours", "3 hours"]
    has_strong_neg = any(w in t_lower for w in strong_neg_words)
    has_neutral_nav = any(w in t_lower for w in ["counter", "find", "finding", "department", "departments", "many departments"])

    if pos_count > 0 and neg_count > 0:
        sentiment = "MIXED"
    elif has_neutral_nav and not has_strong_neg:
        sentiment = "NEUTRAL"
    elif neg_count > 0:
        sentiment = "NEGATIVE" if has_strong_neg or neg_count >= 2 else "NEUTRAL"
    elif pos_count > 0:
        sentiment = "POSITIVE"
    elif rating is not None:
        if rating >= 8:
            sentiment = "POSITIVE"
        elif rating <= 4:
            sentiment = "NEGATIVE"
        else:
            sentiment = "NEUTRAL"
    else:
        sentiment = "NEUTRAL"

    # Category identification
    categories = []
    issues = []

    if any(w in t_lower for w in ["doctor", "dr.", "dr ", "physician", "consultation", "மருத்துவர்", "डॉक्टर"]):
        categories.append("Doctor / Clinical Care")
        if sentiment in ("NEGATIVE", "MIXED"):
            issues.append("doctor_communication")

    if any(w in t_lower for w in ["nurse", "nurses", "nursing", "செவிலியர்", "नर्स"]):
        categories.append("Nursing")
        if sentiment in ("NEGATIVE", "MIXED"):
            issues.append("nursing_care")

    if any(w in t_lower for w in ["billing", "bill", "payment", "charge", "charges", "cost", "கட்டணம்", "बिल", "बिलिंग"]):
        categories.append("Billing")
        if "time" in t_lower or "hour" in t_lower or "late" in t_lower or "long" in t_lower:
            issues.append("billing_delay")
        if "charge" in t_lower or "explain" in t_lower:
            issues.append("billing_transparency")

    if any(w in t_lower for w in ["food", "meal", "cold", "dining", "canteen", "உணவு", "खाना"]):
        categories.append("Food / Dining")
        if "cold" in t_lower or "bad" in t_lower or "quality" in t_lower:
            issues.append("food_quality")

    if any(w in t_lower for w in ["wait", "waiting", "time", "delay", "delayed", "hours", "காத்திருப்பு", "इंतजार"]):
        categories.append("Waiting Time")
        issues.append("long_waiting_time")

    if any(w in t_lower for w in ["clean", "dirty", "cleanliness", "toilet", "washroom", "சுத்தம்", "सफाई"]):
        categories.append("Cleanliness")
        if sentiment in ("NEGATIVE", "MIXED"):
            issues.append("facility_cleanliness")

    if any(w in t_lower for w in ["counter", "find", "direction", "navigation", "department", "துறை"]):
        categories.append("Hospital Operations / Navigation")
        if sentiment in ("NEUTRAL", "NEGATIVE", "MIXED"):
            issues.append("counter_navigation")

    if not categories:
        categories.append("Staff / Service" if sentiment != "NEUTRAL" else "Hospital Information")

    # Severity & action requirement
    if sentiment == "NEGATIVE":
        severity = "HIGH" if ("hour" in t_lower or "3" in t_lower or "worst" in t_lower) else "MEDIUM"
        requires_action = True
        recommended_action = "Patient Relations follow-up required"
    elif sentiment == "MIXED":
        severity = "MEDIUM"
        requires_action = True
        recommended_action = "Quality team review"
    elif sentiment == "POSITIVE":
        severity = "LOW"
        requires_action = False
        recommended_action = "Record positive feedback"
    else:
        severity = "LOW"
        requires_action = False
        recommended_action = "Log general inquiry / feedback"

    summary = text[:120] if text else "Patient provided feedback rating."

    return {
        "sentiment": sentiment,
        "rating": rating,
        "categories": categories,
        "issues": issues,
        "summary": summary,
        "severity": severity,
        "requires_action": requires_action,
        "recommended_action": recommended_action,
        "language": lang,
        "confidence": 0.88,
        "is_emergency": False
    }


def store_patient_feedback(
    conversation_code: str,
    original_feedback: str,
    explicit_rating: Optional[int] = None,
    source: str = "WHATSAPP_TEXT",
    whatsapp_message_id: Optional[str] = None,
    patient_id: Optional[int] = None,
    analysis_override: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Validates patient identity, computes AI feedback analysis,
    and inserts records into PostgreSQL database using an atomic transaction.
    Also creates an escalation ticket if service recovery is required.
    """
    clean_text = (original_feedback or "").strip()
    if not clean_text and explicit_rating is None:
        clean_text = "Patient rating submitted."

    # 1. Run AI analysis
    analysis = analysis_override or analyze_patient_feedback(clean_text, explicit_rating=explicit_rating)

    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Resolve conversation_id and patient_id
        conversation_id = None
        db_patient_id = patient_id

        if conversation_code:
            cur.execute("""
                SELECT id, patient_id, whatsapp_number 
                FROM conversations 
                WHERE conversation_code = %s 
                LIMIT 1;
            """, (conversation_code,))
            c_row = cur.fetchone()
            if c_row:
                conversation_id = c_row[0]
                if not db_patient_id:
                    db_patient_id = c_row[1]
                if not db_patient_id and c_row[2]:
                    wa_num = c_row[2]
                    clean_p = wa_num[-10:] if len(wa_num) >= 10 else wa_num
                    cur.execute("""
                        SELECT id FROM patients 
                        WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = %s 
                        LIMIT 1;
                    """, (clean_p,))
                    p_match = cur.fetchone()
                    if p_match:
                        db_patient_id = p_match[0]
                        cur.execute("UPDATE conversations SET patient_id = %s WHERE id = %s;", (db_patient_id, conversation_id))
            else:
                cur.execute("""
                    INSERT INTO conversations (
                        conversation_code, patient_id, channel, language, conversation_status
                    ) VALUES (
                        %s, %s, 'WHATSAPP', 'ENGLISH', 'ACTIVE'
                    ) RETURNING id;
                """, (conversation_code, db_patient_id))
                conversation_id = cur.fetchone()[0]

        if not db_patient_id and conversation_code:
            extracted_phone = extract_whatsapp_number(conversation_code)
            if extracted_phone:
                clean_p = extracted_phone[-10:] if len(extracted_phone) >= 10 else extracted_phone
                cur.execute("""
                    SELECT id FROM patients 
                    WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = %s 
                    LIMIT 1;
                """, (clean_p,))
                p_match = cur.fetchone()
                if p_match:
                    db_patient_id = p_match[0]
                    if conversation_id:
                        cur.execute("UPDATE conversations SET patient_id = %s WHERE id = %s;", (db_patient_id, conversation_id))

        # Duplicate submission check via whatsapp_message_id
        if whatsapp_message_id:
            cur.execute("""
                SELECT id, status, created_at 
                FROM patient_feedback 
                WHERE whatsapp_message_id = %s 
                LIMIT 1;
            """, (whatsapp_message_id,))
            existing_fb = cur.fetchone()
            if existing_fb:
                conn.rollback()
                return {
                    "success": True,
                    "feedback_id": existing_fb[0],
                    "status": existing_fb[1],
                    "duplicate": True,
                    "analysis": analysis
                }

        sentiment = analysis.get("sentiment", "NEUTRAL")
        rating = analysis.get("rating")
        categories_json = json.dumps(analysis.get("categories", []))
        issues_json = json.dumps(analysis.get("issues", []))
        summary = analysis.get("summary", clean_text[:120])
        severity = analysis.get("severity", "LOW")
        requires_action = bool(analysis.get("requires_action", False))
        recommended_action = analysis.get("recommended_action", "")
        confidence = float(analysis.get("confidence", 0.95))

        # 2. Insert into patient_feedback table
        cur.execute("""
            INSERT INTO patient_feedback (
                patient_id, conversation_id, whatsapp_message_id, source,
                rating, original_feedback, sentiment, categories, issues,
                ai_summary, severity, requires_action, recommended_action,
                confidence, status, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s::jsonb, %s::jsonb,
                %s, %s, %s, %s,
                %s, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            RETURNING id;
        """, (
            db_patient_id, conversation_id, whatsapp_message_id, source,
            rating, clean_text, sentiment, categories_json, issues_json,
            summary, severity, requires_action, recommended_action,
            confidence
        ))
        
        feedback_id = cur.fetchone()[0]

        # 3. Create Service Recovery Escalation Ticket if required
        escalation_id = None
        if requires_action and conversation_id:
            escalation_reason = f"Feedback Service Recovery ({severity}): {summary[:80]}"
            cur.execute("""
                INSERT INTO escalations (
                    conversation_id, patient_id, escalation_reason, patient_question,
                    status, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s,
                    'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                RETURNING id;
            """, (conversation_id, db_patient_id, escalation_reason, clean_text))
            escalation_id = cur.fetchone()[0]

        conn.commit()
        print(f"[FEEDBACK_STORED] feedback_id={feedback_id}, patient_id={db_patient_id}, sentiment={sentiment}, escalation_id={escalation_id}")

        return {
            "success": True,
            "feedback_id": feedback_id,
            "patient_id": db_patient_id,
            "escalation_id": escalation_id,
            "sentiment": sentiment,
            "rating": rating,
            "analysis": analysis,
            "duplicate": False
        }

    except Exception as e:
        conn.rollback()
        print(f"[FEEDBACK_STORE_ERROR] Failed to store patient feedback: {e}")
        traceback.print_exc()
        raise e
    finally:
        cur.close()
        conn.close()
