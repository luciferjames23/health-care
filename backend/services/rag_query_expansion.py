"""
rag_query_expansion.py
======================
Context-aware query understanding and expansion layer for Meridian Hospital AI Hybrid RAG.

Key design principles:
- Expands medical abbreviations and clinical terminology.
- Preserves exact identifiers (patient_id, admission_id, accession_number, order_id, study_uid).
- Never leaks or hallucinates records outside permitted role or patient boundaries.
- Uses LLM when configured, with robust rule-based fallback when offline or unavailable.
- Protection against prompt injection: treats user query as untrusted text.
"""

import os
import re
import json
import urllib.request
from typing import Dict, Any, List, Optional

# Medical synonym dictionary for rule-based expansion and LLM seeding
MEDICAL_SYNONYMS = {
    # Radiology
    "cxr": ["chest x-ray", "chest radiograph", "x-ray chest", "pa view", "ap view"],
    "x-ray": ["radiograph", "radiology study", "imaging order", "cxr", "scan report"],
    "xray": ["radiograph", "radiology study", "imaging order", "cxr", "scan report"],
    "imaging": ["radiology scan", "x-ray", "dicom study", "radiologist report"],
    "radiology": ["x-ray order", "imaging study", "radiologist report", "ai triage findings"],
    "opacity": ["consolidation", "infiltrate", "hazy density", "lung opacity"],
    "cardiomegaly": ["enlarged cardiac silhouette", "heart enlargement", "cardiac size"],

    # Discharge & Clearance
    "discharge blocked": ["discharge pending", "clearance pending", "billing hold", "outstanding balance", "discharge readiness"],
    "clearance": ["financial clearance", "discharge clearance", "bill settled", "billing clearance"],
    "pending discharge": ["discharge readiness", "pending clearance", "discharge summary draft", "unsettled bill"],
    "why admitted": ["reason for admission", "admission diagnosis", "chief complaint", "inpatient stay reason"],

    # Labs & Vitals
    "abnormal labs": ["critical values", "out-of-range results", "abnormal flag", "elevated", "low reference"],
    "critical values": ["abnormal lab result", "panic value", "urgent alert", "out of reference range"],
    "vitals": ["vital signs", "blood pressure", "heart rate", "pulse", "spo2", "temperature", "abnormal vitals"],
    "fever": ["elevated temperature", "pyrexia", "hyperthermia", "temp"],
    "bp": ["blood pressure", "systolic bp", "diastolic bp", "hypertension", "hypotension"],

    # Medications
    "medicines": ["medications", "prescription items", "administered drugs", "dosage", "emar"],
    "meds": ["medications", "prescribed drugs", "dosage", "route", "frequency"],

    # Multilingual Synonyms (Hindi, Tamil, Telugu, Spanish, Hinglish)
    "मरीज": ["patient", "inpatient", "admission status", "patient clinical details"],
    "मरीजों": ["patients", "inpatients", "doctor patient roster", "admitted patients"],
    "नोयाளி": ["patient", "inpatient", "admission status", "patient clinical details"],
    "நோயாளிகள்": ["patients", "inpatients", "doctor patient roster", "admitted patients"],
    "ரோగి": ["patient", "inpatient", "admission status", "patient clinical details"],
    "paciente": ["patient", "inpatient", "admission status"],
    "pacientes": ["patients", "inpatients", "doctor patient roster"],
    "वाइटल्स": ["vital signs", "blood pressure", "heart rate", "temperature", "abnormal vitals"],
    "वाइटल": ["vital signs", "blood pressure", "heart rate", "pulse", "abnormal vitals"],
    "வைட்டல்ஸ்": ["vital signs", "blood pressure", "heart rate", "temperature", "abnormal vitals"],
    "வைட்டல்": ["vital signs", "blood pressure", "heart rate", "abnormal vitals"],
    "వైటల్స్": ["vital signs", "blood pressure", "heart rate", "abnormal vitals"],
    "দवा": ["medications", "prescriptions", "administered drugs"],
    "दवाइयां": ["medications", "prescriptions", "active medications"],
    "மருந்து": ["medications", "prescriptions", "prescribed drugs"],
    "மருந்துகள்": ["medications", "prescriptions", "active medications"],
    "एक्स-रे": ["chest x-ray", "radiograph", "radiology study", "imaging order"],
    "एक्सरे": ["chest x-ray", "radiograph", "radiology study", "imaging order"],
    "எக்ஸ்ரே": ["chest x-ray", "radiograph", "radiology study", "imaging order"],
    "எக்ஸ்-ரே": ["chest x-ray", "radiograph", "radiology study", "imaging order"],
    "डिस्चार्ज": ["discharge pending", "clearance pending", "billing hold", "discharge summary"],
    "டிஸ்சார்ஜ்": ["discharge pending", "clearance pending", "billing hold", "discharge summary"],
    "बिल": ["billing clearance", "outstanding balance", "pending payment bill", "financial clearance"],
    "பில்": ["billing clearance", "outstanding balance", "pending payment bill", "financial clearance"]
}

# Identifier regex patterns
PATIENT_ID_PATTERN = re.compile(r'\b(?:MER-PAT-|PAT-)?([0-9]{3,8})\b', re.IGNORECASE)
ADMISSION_ID_PATTERN = re.compile(r'\b(?:MER-ADM-|ADM-)?([0-9]{3,8})\b', re.IGNORECASE)
ACCESSION_PATTERN = re.compile(r'\b(ACC-[0-9A-Z]{4,16})\b', re.IGNORECASE)
UUID_PATTERN = re.compile(r'\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b', re.IGNORECASE)


class RagQueryExpansionService:
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.llm_model = os.getenv("DISCHARGE_LLM_MODEL", "llama-3.3-70b-versatile")

    def expand_query(
        self,
        query: str,
        area: str,
        role: str,
        patient_id: Optional[int] = None,
        admission_id: Optional[int] = None,
        order_id: Optional[str] = None,
        accession_number: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Understands intent, extracts entities, preserves exact IDs, and expands medical query terms.
        Uses LLM if available; always ensures reliable rule-based fallback.
        """
        sanitized_query = query.strip()[:1000]

        # Extract explicit identifiers present in query text
        detected_patient_id = None
        detected_admission_id = None
        detected_accession = None
        detected_uuid = None

        m_acc = ACCESSION_PATTERN.search(sanitized_query)
        if m_acc:
            detected_accession = m_acc.group(1).upper()

        m_uuid = UUID_PATTERN.search(sanitized_query)
        if m_uuid:
            detected_uuid = m_uuid.group(1).lower()

        # Rule-based expansion pass
        rule_variants = self._rule_based_expansion(sanitized_query, area)

        # Attempt LLM expansion if key is present
        llm_result = None
        if self.groq_api_key or self.openai_api_key:
            llm_result = self._expand_with_llm(
                query=sanitized_query,
                area=area,
                role=role,
                patient_id=patient_id,
                admission_id=admission_id,
                order_id=order_id,
                accession_number=accession_number,
                conversation_history=conversation_history
            )

        if llm_result:
            # Combine variants safely
            search_phrases = list(set([sanitized_query] + llm_result.get("search_phrases", []) + rule_variants[:3]))
            intent = llm_result.get("intent", "GENERAL_CLINICAL_QUERY")
            entities = llm_result.get("entities", {})
            status_filter = llm_result.get("status_filter")
        else:
            search_phrases = list(set([sanitized_query] + rule_variants))
            intent = self._infer_intent_rule_based(sanitized_query, area)
            entities = {}
            status_filter = self._infer_status_filter(sanitized_query)

        # Always preserve explicit context identifiers
        effective_patient_id = patient_id
        effective_admission_id = admission_id
        effective_order_id = order_id or detected_uuid
        effective_accession = accession_number or detected_accession

        return {
            "original_query": sanitized_query,
            "intent": intent,
            "search_phrases": search_phrases[:6],
            "entities": entities,
            "status_filter": status_filter,
            "patient_id": effective_patient_id,
            "admission_id": effective_admission_id,
            "order_id": effective_order_id,
            "accession_number": effective_accession
        }

    def _rule_based_expansion(self, query: str, area: str) -> List[str]:
        """Expands synonyms and contextual phrases via dictionary matching."""
        lower_q = query.lower()
        variants = []

        for term, syns in MEDICAL_SYNONYMS.items():
            if term in lower_q:
                for s in syns[:3]:
                    variants.append(lower_q.replace(term, s))

        # Area-specific default search variants
        if area == "radiology" and not any(k in lower_q for k in ("x-ray", "cxr", "scan", "study")):
            variants.append(f"{lower_q} x-ray imaging findings")
            variants.append(f"{lower_q} radiologist review report")
        elif area == "discharge" and not any(k in lower_q for k in ("discharge", "clearance", "billing")):
            variants.append(f"{lower_q} discharge readiness pending clearance")
            variants.append(f"{lower_q} verified discharge summary")
        elif area == "patient360" and any(k in lower_q for k in ("why", "still here", "status")):
            variants.append("admission diagnosis chief complaint current stay")
            variants.append("pending discharge clearance active orders")

        return variants[:4]

    def _infer_intent_rule_based(self, query: str, area: str) -> str:
        """Determines clinical intent when LLM is unavailable, supporting multilingual queries."""
        q = query.lower()
        if any(w in q for w in ("vital", "bp", "heart rate", "pulse", "temp", "spo2", "वाइटल", "रक्तचाप", "तापमान", "வைட்டல்", "వైటల్స్", "signos vitales")):
            return "VITAL_SIGNS_QUERY"
        if any(w in q for w in ("medicine", "medication", "drug", "dose", "tablet", "injection", "prescript", "दवा", "औषधि", "மருந்து", "మందులు", "medicamento")):
            return "MEDICATIONS_QUERY"
        if any(w in q for w in ("lab", "blood", "test", "hemoglobin", "potassium", "creatinine", "troponin", "जांच", "रक्त", "ஆய்வகம்", "పరీక్ష")):
            return "LAB_RESULTS_QUERY"
        if any(w in q for w in ("x-ray", "radiolog", "cxr", "imaging", "dicom", "finding", "orthanc", "एक्स", "रेडियोलॉजी", "ரேடியாலஜி", "எக்ஸ்ரே", "రేడియోలజీ", "radiografía", "rayos x")):
            return "RADIOLOGY_QUERY"
        if any(w in q for w in ("discharge", "leave", "clearance", "bill", "summary", "draft", "blocked", "डिस्चार्ज", "बिल", "டிஸ்சார்ஜ்", "பில்", "డిశ్చార్జ్", "బిల్లు", "alta", "factura")):
            return "DISCHARGE_READINESS_QUERY"
        if any(w in q for w in ("why", "admitted", "stay", "reason", "condition", "diagnosis", "मरीज", "स्थिति", "हालत", "நோயாளி", "நிலைமை", "ரோగి", "paciente", "estado")):
            return "PATIENT_ADMISSION_STATUS"
        return "GENERAL_CLINICAL_QUERY"

    def _infer_status_filter(self, query: str) -> Optional[str]:
        q = query.lower()
        if any(w in q for w in ("abnormal", "critical", "elevated", "असामान्य", "गंभीर", "அசாதாரண", "తీవ్రమైన", "anormal", "crítico")):
            return "Abnormal"
        if any(w in q for w in ("pending", "blocked", "लंबित", "अटका", "நிலுவை", "పెండింగ్", "pendiente", "bloqueado")):
            return "Pending"
        if any(w in q for w in ("verified", "confirmed", "सत्यापित", "पुष्ट", "சரிபார்க்கப்பட்டது", "ధృవీకరించబడింది", "verificado")):
            return "Verified"
        return None

    def _expand_with_llm(
        self,
        query: str,
        area: str,
        role: str,
        patient_id: Optional[int],
        admission_id: Optional[int],
        order_id: Optional[str],
        accession_number: Optional[str],
        conversation_history: Optional[List[Dict[str, str]]]
    ) -> Optional[Dict[str, Any]]:
        """Invokes Groq or OpenAI API for query expansion without giving DB access."""
        recent_convo = ""
        if conversation_history:
            turns = conversation_history[-3:]
            recent_convo = "\n".join([f"{t.get('role', 'user')}: {t.get('content', '')}" for t in turns])

        system_prompt = (
            "You are a Clinical Query Understanding Engine for a Hospital AI System.\n"
            "Analyze the medical user question and output a strictly valid JSON object with:\n"
            "- 'intent': String identifying clinical intent (e.g. ABNORMAL_VITALS, DISCHARGE_READINESS, RADIOLOGY_FINDINGS, CURRENT_MEDICATIONS, PATIENT_STATUS, LAB_RESULTS)\n"
            "- 'search_phrases': Array of 2-4 expanded medical search variants using standard medical synonyms (CXR, chest x-ray, critical values, clearance pending, etc.)\n"
            "- 'entities': Object with extracted clinical entities (medications, conditions, parameters)\n"
            "- 'status_filter': String if user is asking for specific statuses ('Abnormal', 'Pending', 'Verified'), or null\n"
            "RULES:\n"
            "1. NEVER invent clinical facts or imaginary patients.\n"
            "2. Preserve any exact ID, accession number, or study UID mentioned.\n"
            "3. Return ONLY valid JSON, no markdown formatting."
        )

        user_content = (
            f"User Role: {role} | Area: {area}\n"
            f"Current Context: Patient ID={patient_id or 'N/A'}, Admission ID={admission_id or 'N/A'}, Order ID={order_id or 'N/A'}, Accession={accession_number or 'N/A'}\n"
            f"Recent Conversation:\n{recent_convo or 'None'}\n\n"
            f"Question: {query}"
        )

        # 1. Try Groq
        if self.groq_api_key:
            try:
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                    "max_tokens": 400
                }
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {self.groq_api_key.strip()}",
                        "Content-Type": "application/json"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    content = res_data["choices"][0]["message"]["content"]
                    return json.loads(content)
            except Exception:
                pass

        # 2. Try OpenAI
        if self.openai_api_key:
            try:
                payload = {
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                    "max_tokens": 400
                }
                req = urllib.request.Request(
                    "https://api.openai.com/v1/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {self.openai_api_key.strip()}",
                        "Content-Type": "application/json"
                    },
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    content = res_data["choices"][0]["message"]["content"]
                    return json.loads(content)
            except Exception:
                pass

        return None


# Global singleton instance
query_expansion_service = RagQueryExpansionService()
