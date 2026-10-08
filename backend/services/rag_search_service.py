"""Authorization-first retrieval with deterministic operational query planning."""
import json, os, re, sys
from typing import Any, Dict, List, Optional, Set, Tuple
import psycopg2.extras

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path: sys.path.insert(0, BASE_DIR)
import db_config
from services.rag_access_control import ACCESS_DENIED, AccessContext, DOCUMENT_MODULE, build_access_context
from services.rag_embedding_service import embedding_service
from services.rag_query_understanding import query_understanding_service


def _normalized(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()
    corrections = {
        "urget": "urgent", "urgnt": "urgent",
        "requsts": "requests", "requset": "request", "reqest": "request", "reqsts": "requests",
        "pateint": "patient", "patinet": "patient", "patint": "patient",
        "discharget": "discharged", "dischrge": "discharge",
        "clarfication": "clarification", "clarifcation": "clarification",
        "clarificationi": "clarification", "clarificationsi": "clarifications", "clarificaiton": "clarification",
        "calrification": "clarification", "calrifications": "clarifications",
        "clarifacation": "clarification", "clarifaction": "clarification",
        "xrqy": "xray",
        "routin": "routine", "routne": "routine",
        "admisssion": "admission", "admisson": "admission",
    }
    return " ".join(corrections.get(token, token) for token in value.split())


def _has(text: str, phrases) -> bool:
    padded = f" {text} "
    return any(f" {phrase} " in padded for phrase in phrases)


class RagSearchService:
    def __init__(self):
        self.embedding_service = embedding_service

    def build_access_context(self, user: Dict[str, Any]) -> AccessContext:
        conn = db_config.get_db_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                return build_access_context(user, cur)
        finally: conn.close()

    def understand_query(self, query: str, context: AccessContext, conversation_patient_id=None,
                         explicit_patient_id=None, conversation_collection=None):
        conn = db_config.get_db_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                return query_understanding_service.understand(
                    query, context, cur, conversation_patient_id=conversation_patient_id,
                    explicit_patient_id=explicit_patient_id,
                    conversation_collection=conversation_collection,
                )
        finally:
            conn.close()

    def search(self, query: str, area: str, user: Dict[str, Any], expanded_phrases=None,
               patient_id=None, admission_id=None, order_id=None, accession_number=None,
               status_filter=None, limit=10, access_context=None, conversation_history=None,
               query_plan=None):
        context = access_context or self.build_access_context(user)
        return self._secure_search(query, area, context, patient_id, admission_id, order_id,
                                   accession_number, status_filter, limit, expanded_phrases,
                                   conversation_history, query_plan)

    def _check_cross_doctor_access(self, cur, context, query: str):
        if context.is_admin or context.role != "doctor" or not context.doctor_id:
            return
        try:
            cur.execute("SELECT id, display_name, first_name, last_name FROM doctors")
            all_docs = cur.fetchall() or []
        except Exception:
            return

        current_doc = next((d for d in all_docs if isinstance(d, dict) and d.get("id") == context.doctor_id), None)
        c_fn = (current_doc.get("first_name") or "").strip().lower() if current_doc else ""
        c_ln = (current_doc.get("last_name") or "").strip().lower() if current_doc else ""
        c_full = f"{c_fn} {c_ln}".strip()

        # Handle queries mentioning doctors like Dr. Ravi Reddy, Doctor Ravi, Dr.ravi reddy, etc.
        q_norm = re.sub(r"\bdr\.", "dr ", query, flags=re.I)
        matches = re.finditer(r"\b(?:dr|doctor)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)", q_norm, re.I)
        stop_words = {"op", "ip", "patient", "patients", "order", "orders", "list", "worklist", "task", "tasks", "ward", "under", "for", "rounds", "round", "notes", "note", "advice", "summary"}

        for m in matches:
            candidate = m.group(1).lower().strip()
            cand_words = [w for w in candidate.split() if w not in stop_words]
            if not cand_words:
                continue
            cand_name = " ".join(cand_words)

            # If candidate refers to current doctor themselves, allowed
            if cand_name == c_full or cand_name == c_fn or (cand_name == c_ln and len(c_ln) > 2):
                continue

            for d in all_docs:
                if not isinstance(d, dict) or d.get("id") == context.doctor_id:
                    continue
                fn = (d.get("first_name") or "").strip().lower()
                ln = (d.get("last_name") or "").strip().lower()
                full = f"{fn} {ln}".strip()
                if cand_name == full:
                    raise PermissionError(ACCESS_DENIED)
                if len(cand_words) == 1:
                    if cand_words[0] == fn and len(fn) > 2:
                        raise PermissionError(ACCESS_DENIED)
                    if cand_words[0] == ln and len(ln) > 2 and cand_words[0] != c_ln:
                        raise PermissionError(ACCESS_DENIED)
                elif len(cand_words) >= 2:
                    if cand_words[0] == fn and cand_words[1] == ln:
                        raise PermissionError(ACCESS_DENIED)
                    if fn in cand_words and ln in cand_words:
                        raise PermissionError(ACCESS_DENIED)

        # Also check if any other doctor's full name (e.g. 'Ravi Reddy', 'Suresh Menon') is explicitly in query
        q_clean = " " + re.sub(r"[^a-zA-Z0-9\s]", " ", query.lower()) + " "
        for d in all_docs:
            if not isinstance(d, dict) or d.get("id") == context.doctor_id:
                continue
            fn = (d.get("first_name") or "").strip().lower()
            ln = (d.get("last_name") or "").strip().lower()
            full = f"{fn} {ln}".strip()
            if full and len(fn) > 2 and len(ln) > 2 and f" {full} " in q_clean:
                raise PermissionError(ACCESS_DENIED)

    def _secure_search(self, query, area, context, patient_id, admission_id, order_id,
                       accession_number, status_filter, limit, expanded_phrases=None,
                       conversation_history=None, query_plan=None):
        conn = db_config.get_db_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if query_plan is None:
                    query_plan = self.understand_query(query, context)
                effective_patient_id = patient_id if patient_id is not None else ((query_plan or {}).get("patient_id"))
                if context.role == "doctor" and effective_patient_id is not None and effective_patient_id not in (context.allowed_patient_ids or frozenset()):
                    raise PermissionError(ACCESS_DENIED)
                self._check_cross_doctor_access(cur, context, query)
                kind, dimensions = self._plan(query, area, context.role, patient_id=effective_patient_id,
                                              conversation_history=conversation_history, query_plan=query_plan)
                if kind in ("doctor_clarifications", "radiology_clarifications"):
                    return self._doctor_clarifications(cur, context, dimensions, effective_patient_id)
                if effective_patient_id is None:
                    if kind == "doctor_flow": return self._doctor_flow(cur, context, dimensions)
                    if kind == "doctor_patient_list": return self._doctor_patient_list(cur, context, dimensions)
                    if kind == "doctor_discharged_list": return self._doctor_discharged_list(cur, context, dimensions)
                    if kind == "doctor_op_list": return self._doctor_op_list(cur, context, dimensions)
                    if kind == "doctor_radiology_worklist": return self._doctor_radiology_worklist(cur, context, dimensions)
                    if kind == "doctor_ward_tasks": return self._doctor_ward_tasks(cur, context)
                if kind == "radiology_aggregate":
                    return self._radiology_aggregate(cur, context, dimensions, effective_patient_id, order_id, accession_number)
                if kind == "radiology_list":
                    return self._radiology_list(cur, context, dimensions, effective_patient_id, query)
                if (effective_patient_id is None and query_plan and query_plan.get("collection_request") and query_plan.get("intent") != "count"
                        and context.role in {"doctor", "admin", "hospital management"}):
                    return self._patient_collection(cur, context, query_plan)
                return self._documents(cur, query, area, context, effective_patient_id, admission_id, order_id,
                                       accession_number, status_filter, limit, expanded_phrases, query_plan)
        finally: conn.close()

    def _plan(self, query: str, area: str, role: str, patient_id: Optional[int] = None,
              conversation_history: Optional[List[Dict[str, Any]]] = None,
              query_plan: Optional[Dict[str, Any]] = None):
        q = _normalized(query)
        count = _has(q, {"how many", "count", "counts", "total", "number of"})
        categorize = _has(q, {"categorize", "categorise", "category", "breakdown", "group", "break down"})
        is_clarification = (
            _has(q, {"clarification", "clarifications", "calrification", "calrifications", "clarification request", "clarification requests", "clarification message", "clarification messages"})
            or (
                _has(q, {"clarification", "clarifications", "calrification", "calrifications"})
                and _has(q, {"message", "messages", "asked", "received", "pending", "urgent", "resolved", "show", "list", "any", "do i have", "what", "which", "how many", "count"})
            )
        )
        is_list = _has(q, {"list", "which patients", "which of my patients", "which of the patients", "who are", "who is", "show patients", "show my patients", "patient list", "my patients"}) or " names " in f" {q} " or (_has(q, {"which", "who", "show", "list"}) and _has(q, {"patient", "patients"}))
        if role == "doctor":
            if not patient_id:
                blocked = _has(q, {"blocked from discharge", "discharge blocked", "blocked discharge", "pending discharge", "discharge clearance blocked"})
                if blocked and (is_list or "which" in q or "who" in q or "blocked" in q):
                    dims = {"ip", "blocked_discharge", "names"}
                    if _has(q, {"why", "reason", "balance", "clearance"}): dims.add("why")
                    return "doctor_patient_list", dims

                # Check if conversation history has an active radiology topic
                recent_rad = False
                if conversation_history:
                    for turn in reversed(conversation_history[-3:]):
                        c = (turn.get("content") or "").lower()
                        if any(w in c for w in ("xray", "xrays", "x ray", "x rays", "radiology", "radiologist", "radiology_order", "x-ray")):
                            recent_rad = True
                            break

                # Radiology clarifications raised by or involving the doctor
                if is_clarification:
                    dims = set()
                    if count: dims.add("count")
                    if is_list or _has(q, {"show", "list", "any", "do i have", "what", "which", "view", "details", "asked", "received", "message", "messages"}) or not count:
                        dims.add("list")
                    if _has(q, {"urgent", "priority"}): dims.add("urgent")
                    if _has(q, {"resolved", "pending", "open", "closed"}): dims.add("status")
                    return "doctor_clarifications", dims

                # Radiology orders / reports for my patients (urgent, routine, breakdown, status, or all worklist)
                has_rad_topic = _has(q, {"xray", "xrays", "x ray", "x rays", "radiology", "scan", "scans", "imaging"}) or (
                    recent_rad and (_has(q, {"urgent", "routine", "pending", "uploaded", "requested", "reviewed", "order", "orders", "request", "requests"}) or categorize or count)
                ) or _has(q, {"urgent order", "urgent orders", "urgent request", "urgent requests", "how many urgent", "how many urget", "urgent xray", "urgent xrays", "any urgent"}) or (
                    _has(q, {"urgent", "routine"}) and _has(q, {"order", "orders", "request", "requests"})
                )

                is_rad_worklist = has_rad_topic and not _has(q, {"clarification", "clarifications"}) and (
                    _has(q, {"worklist", "work list", "urgent", "routine", "high priority", "priority", "stat", "pending", "order", "orders", "request", "requests", "uploaded", "requested", "reviewed"})
                    or is_list
                    or categorize
                    or count
                    or _has(q, {"my xray", "my xrays", "my scans", "my imaging", "my radiology", "all xray", "all xrays", "all scans"})
                )
                if is_rad_worklist:
                    dims = set()
                    has_urgent = _has(q, {"urgent", "high priority", "priority", "stat"})
                    has_routine = _has(q, {"routine"})
                    if (has_urgent and has_routine) or (has_urgent and _has(q, {"breakdown", "break down", "categorize", "categorise", "category", "and"})):
                        dims.add("breakdown")
                    elif has_urgent:
                        dims.add("urgent")
                    elif has_routine:
                        dims.add("routine")

                    if _has(q, {"uploaded"}):
                        dims.add("uploaded")
                    elif _has(q, {"requested"}):
                        dims.add("requested")
                    if count:
                        dims.add("count")
                    if categorize or _has(q, {"breakdown", "break down", "group", "category"}):
                        dims.add("categorize")
                    return "doctor_radiology_worklist", dims

                # Clinical tasks / doctor tasks / ward rounds
                if _has(q, {"ward round", "ward rounds", "doctor tasks", "doctor task", "pending orders", "clinical orders", "clinical tasks", "rounds"}):
                    return "doctor_ward_tasks", set()

                # Abnormal / critical lab values or abnormal vitals
                if (is_list or _has(q, {"which", "who", "show"})) and (_has(q, {"abnormal", "critical", "out of range"}) and _has(q, {"lab", "labs", "value", "values", "vital", "vitals", "result", "results"})):
                    return "doctor_patient_list", {"ip", "names", "abnormal", "location"}

                # Discharged patients list
                is_discharged = _has(q, {"discharged", "discharge"}) and not blocked and not _has(q, {"clearance", "pending discharge", "summary", "draft", "readiness", "process"})
                if is_discharged and not count and (
                    is_list
                    or _has(q, {"patient", "patients", "under me", "my", "who", "which", "show", "list", "names"})
                    or q.strip() in {"discharged", "discharged patients", "discharged patient list", "discharged patient"}
                ):
                    dims = {"discharged", "names"}
                    if _has(q, {"basic details", "details", "patient details"}): dims.add("basic")
                    return "doctor_discharged_list", dims

                # Outpatient (OP) list
                is_op = _has(q, {"op", "opd", "outpatient", "outpatients"}) and not count and not _has(q, {"ip", "inpatient", "inpatients"})
                if is_op and (
                    is_list
                    or _has(q, {"patient", "patients", "under me", "my", "who", "which", "show", "list", "any", "names"})
                    or q.strip() in {"op", "opd", "outpatient", "outpatients", "any op", "op patients", "op patients under me"}
                ):
                    dims = {"op", "names"}
                    if _has(q, {"basic details", "details", "patient details"}): dims.add("basic")
                    return "doctor_op_list", dims

                if is_list and not is_op and not is_discharged and _has(q, {"ip", "inpatient", "inpatients", "patient", "patients"}):
                    dims = {"ip", "names"}
                    if _has(q, {"basic details", "details", "patient details"}): dims.add("basic")
                    if _has(q, {"bed", "beds", "ward", "wards", "room", "rooms", "bed number", "bed numbers", "location"}): dims.add("location")
                    if _has(q, {"admission date", "admitted date", "date of admission", "when admitted", "admission dates"}): dims.add("admission_date")
                    if _has(q, {"reason", "reasons", "reason for admission", "admission reason", "why admitted"}): dims.add("reason")
                    if _has(q, {"diagnosis", "diagnoses", "condition", "clinical problem", "problem", "clinical diagnosis"}): dims.add("diagnosis")
                    return "doctor_patient_list", dims
        if role == "doctor" and area == "doctor_workspace" and not patient_id:
            dims = set()
            if _has(q, {"ip", "inpatient", "inpatients", "admitted patient", "admitted patients"}): dims.add("ip")
            if _has(q, {"op", "outpatient", "outpatients", "opd"}): dims.add("op")
            if _has(q, {"discharged", "discharge count"}): dims.add("discharged")
            if _has(q, {"er", "emergency", "emergency patients"}): dims.add("er")
            if count and dims: return "doctor_flow", dims
            if count and _has(q, {"patients", "patient flow", "my patients"}):
                return "doctor_flow", {"ip", "op", "discharged", "er"}
        if area == "radiology" or role == "radiologist":
            if is_clarification:
                dims = set()
                if count: dims.add("count")
                if is_list or _has(q, {"show", "list", "any", "do i have", "what", "which", "view", "details", "asked", "received", "message", "messages"}) or not count:
                    dims.add("list")
                if _has(q, {"urgent", "priority"}): dims.add("urgent")
                if _has(q, {"resolved", "pending", "open", "closed"}): dims.add("status")
                # Unread clarification check
                if _has(q, {"unread", "not read", "unseen", "new message", "new messages"}):
                    dims.add("unread")
                    dims.discard("list")  # unread check overrides full list
                return "radiology_clarifications", dims

            # ── Clinical findings queries — always route to documents, never aggregate ─
            # These are patient-level AI screening / radiologist finding queries
            is_clinical_finding = _has(q, {"lung opacity", "opacity", "consolidation", "pleural effusion",
                                           "cardiomegaly", "pneumonia", "pneumothorax", "fracture",
                                           "detected", "abnormal", "normal",
                                           "review flag", "confirmed study", "pending review study"})
            # Always send clinical finding queries to documents (not aggregate)
            if is_clinical_finding:
                return "documents", set()

            # ── Detect specific examination type filters (PA, AP, PA+AP) ─────────
            exam_type_filter = None
            if _has(q, {"pa ap", "pa and ap", "pa + ap", "pa+ap"}):
                exam_type_filter = "pa_and_ap"
            elif _has(q, {"pa xray", "pa x ray", "pa request", "pa requests", "pa order", "pa orders",
                          "chest pa", "pa view", "pa views", "pa study", "pa studies",
                          "how many pa", "count pa", "pa scan", "chest x-ray pa"}):
                exam_type_filter = "pa"
            elif _has(q, {"ap xray", "ap x ray", "ap request", "ap requests", "ap order", "ap orders",
                          "chest ap", "ap view", "ap views", "ap study", "ap studies",
                          "how many ap", "count ap", "ap scan", "chest x-ray ap"}):
                exam_type_filter = "ap"

            # ── Study analysed/analyzed/reviewed count (from AI worklist) ────────
            is_study_analyzed = _has(q, {"study analysed", "study analyzed", "study reviewed",
                                         "studies analysed", "studies analyzed", "studies reviewed",
                                         "how many study", "how many studies", "study completed",
                                         "studies completed", "how may study", "how may studies",
                                         "analysed study", "analyzed study", "reviewed study",
                                         "high priority study", "high priority studies",
                                         "how many high priority"})

            # ── Date filter: today / recent requests ─────────────────────────
            is_today = _has(q, {"today", "received today", "today request", "today requests",
                                "this day", "current day"})
            is_recent = _has(q, {"this week", "recent", "recently", "last 7 days", "past week",
                                 "last week", "this month"})

            # ── List route: list all requests / list the N requests / who raised / list high priority ──
            order_topic = _has(q, {"request", "requests", "requested", "order", "orders", "ordered", "xray", "x ray", "x-ray", "worklist", "study", "studies", "scan", "scans", "indication", "category"})
            is_investigative = _has(q, {"why", "conclude", "conclusion", "report"})
            is_who_raised = _has(q, {"who raised", "who are all raised", "who all raised", "who ordered", "who requested",
                                     "who requested the", "who ordered the", "who raised the", "who are all requested", "who all requested",
                                     "who are all ordered", "who all ordered", "who asked", "who asked the",
                                     "raised by", "ordered by", "requested by", "which doctor",
                                     "which doctors", "under which category", "with what indication",
                                     "to which patient", "which patient raised", "priya patel requested",
                                     "doctor requested", "requests by", "orders by"})
            is_list_priority = (is_list or _has(q, {"show", "list", "view", "get", "display"})) and _has(q, {"high priority", "urgent", "review flag", "routine"}) and not count
            is_list_request = (is_list or is_who_raised or is_list_priority) and (order_topic or is_who_raised or is_list_priority) and not is_investigative and not count

            if is_list_request:
                dims = set()
                if exam_type_filter: dims.add(exam_type_filter)
                if is_who_raised: dims.add("requested_by")
                if _has(q, {"high priority", "urgent"}): dims.add("urgent")
                elif _has(q, {"routine"}): dims.add("routine")
                if _has(q, {"uploaded"}): dims.add("uploaded")
                elif _has(q, {"status requested", "requested status", "status is requested"}) or (_has(q, {"requested"}) and not is_who_raised and not _has(q, {"patel", "priya", "doctor", "dr"})): dims.add("requested")
                if is_today: dims.add("today")
                elif is_recent: dims.add("recent")
                return "radiology_list", dims

            # Today/recent requests (count or show)
            if (is_today or is_recent) and order_topic:
                dims = {"today"} if is_today else {"recent"}
                if count: dims.add("count")
                return "radiology_list", dims

            dims = set()
            if _has(q, {"urgent", "routine", "priority", "priorities"}): dims.add("priority")
            if _has(q, {"department", "departments", "which department", "what department"}): dims.add("department")
            if _has(q, {"status", "pending", "requested", "uploaded", "reviewed"}): dims.add("status")
            categorize = _has(q, {"categorize", "categorise", "category", "breakdown", "group"})
            is_breakdown = _has(q, {"which department", "what department", "from which department", "raised from", "by department", "breakdown by"})
            if is_study_analyzed:
                dims.add("total")
                dims.add("study_analyzed")
                # If priority also asked (e.g., "high priority analyzed")
                if _has(q, {"high priority", "urgent", "priority"}): dims.add("priority")
                return "radiology_aggregate", dims
            if exam_type_filter:
                dims.add("total")
                dims.add(exam_type_filter)
                return "radiology_aggregate", dims
            if count or categorize: dims.add("total")
            if categorize and not ({"department", "status"} & dims): dims.add("priority")
            if dims and (count or categorize or is_breakdown) and not (is_investigative and not (count or categorize)):
                return "radiology_aggregate", dims
        return "documents", set()

    @staticmethod
    def _source(context, title, content, doc_type, module, table, record_id, metadata, patient_id=None):
        return {"id":0, "document_type":doc_type, "module":module, "source_table":table,
                "source_record_id":record_id, "patient_id":patient_id, "admission_id":None,
                "doctor_id":context.doctor_id, "order_id":None, "accession_number":None,
                "study_instance_uid":None, "title":title, "content":content, "metadata":metadata,
                "review_status":"Current", "is_verified":True, "relevance_score":1.0,
                "keyword_score":1.0, "similarity_score":1.0}

    def _doctor_flow(self, cur, context, dimensions: Set[str]):
        cur.execute("SELECT display_name FROM doctors WHERE id=%s LIMIT 1", (context.doctor_id,))
        name = (cur.fetchone() or {}).get("display_name")
        if not name: raise PermissionError(ACCESS_DENIED)
        counts = {}
        if "ip" in dimensions:
            cur.execute("""SELECT COUNT(DISTINCT patient_id) total FROM dim_admission_inputs
                WHERE (attending_doctor ILIKE %s OR admission_id IN
                (SELECT admission_id FROM admissions WHERE doctor_id=%s))
                AND LOWER(COALESCE(discharge_status,'')) <> 'discharged'""", (f"%{name}%", context.doctor_id))
            counts["ip"] = int((cur.fetchone() or {}).get("total") or 0)
        if "op" in dimensions:
            cur.execute("""
                SELECT COUNT(*) total FROM (
                    SELECT DISTINCT ON (apt.patient_id)
                        apt.patient_id,
                        apt.doctor_id,
                        COALESCE(d.display_name, 'Consultant Doctor') AS doctor
                    FROM appointments apt
                    JOIN patients p ON p.id = apt.patient_id
                    LEFT JOIN doctors d ON d.id = apt.doctor_id
                    WHERE (apt.booking_source IN ('OPD_DESK', 'Walk-in', 'Phone', 'Web Portal', 'ADMIN', 'DOCTOR') OR apt.booking_id LIKE 'APT-%%')
                    ORDER BY apt.patient_id, apt.appointment_date DESC, apt.id DESC
                    LIMIT 100
                ) sub
                WHERE sub.doctor_id IN (%s, %s) OR sub.doctor ILIKE %s
            """, (context.doctor_id, context.user_id, f"%{name}%"))
            counts["op"] = int((cur.fetchone() or {}).get("total") or 0)
        if "discharged" in dimensions:
            cur.execute("""SELECT COUNT(DISTINCT patient_id) total FROM dim_admission_inputs
                WHERE (attending_doctor ILIKE %s OR admission_id IN
                (SELECT admission_id FROM admissions WHERE doctor_id=%s))
                AND LOWER(COALESCE(discharge_status,''))='discharged'""", (f"%{name}%", context.doctor_id))
            counts["discharged"] = int((cur.fetchone() or {}).get("total") or 0)
        if "er" in dimensions:
            cur.execute("SELECT COUNT(*) total FROM emergency_triage WHERE doctor_name ILIKE %s", (f"%{name}%",))
            counts["er"] = int((cur.fetchone() or {}).get("total") or 0)
        labels = {"ip":"IP", "op":"OP", "discharged":"Discharged", "er":"ER"}
        content = "Current authorized patient counts: " + "; ".join(f"{labels[k]}: {counts[k]} patients" for k in ("ip","op","discharged","er") if k in counts) + "."
        return [self._source(context, "Authorized Patient Flow Counts", content, "patient_flow_summary", "ip",
                "dim_admission_inputs,appointments,emergency_triage", "authorized_patient_flow_count",
                {"module":"ip", "record_id":"authorized_patient_flow_count", **counts})], "authorized_sql_aggregate"

    def _doctor_discharged_list(self, cur, context, dimensions: Set[str]):
        if not context.doctor_id and not context.is_admin:
            raise PermissionError(ACCESS_DENIED)
        name = None
        if context.doctor_id:
            cur.execute("SELECT display_name FROM doctors WHERE id=%s LIMIT 1", (context.doctor_id,))
            doctor = cur.fetchone() or {}
            name = doctor.get("display_name") if isinstance(doctor, dict) else doctor[0]
            if not name: raise PermissionError(ACCESS_DENIED)

        scope_clause = "(dai.attending_doctor ILIKE %s OR dai.admission_id IN (SELECT admission_id FROM admissions WHERE doctor_id=%s))" if name else "TRUE"
        params = [f"%{name}%", context.doctor_id] if name else []

        cur.execute(f"""
            SELECT DISTINCT ON (dai.patient_id) dai.patient_id, dai.patient_number AS patient_code,
                   dai.first_name, dai.last_name, dai.gender, dai.date_of_birth,
                   dai.admission_number, dai.admission_date, dai.reason_for_admission,
                   dai.bed_number, dai.room_number, dai.ward_name, dai.primary_diagnosis,
                   dai.secondary_diagnoses, dai.bill_number, dai.bill_status,
                   dai.bill_clearance_status, dai.outstanding_balance, dai.discharge_status
            FROM dim_admission_inputs dai
            WHERE {scope_clause}
              AND LOWER(COALESCE(dai.discharge_status,'')) = 'discharged'
            ORDER BY dai.patient_id, dai.admission_date DESC
        """, params)
        rows = [dict(row) for row in cur.fetchall()]
        if not rows:
            content = "No discharged patients found under your care."
            return [self._source(context, "Discharged patients", content, "patient_admission_summary", "ip",
                                 "dim_admission_inputs", "authorized_doctor_discharged_list",
                                 {"module": "ip", "count": 0, "cohort": "discharged"})], "authorized_sql_list"
        lines = []
        patient_ids = []
        for row in rows:
            name_str = f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip()
            values = [name_str]
            if "basic" in dimensions or "details" in dimensions:
                values += [f"ID …{str(row.get('patient_code') or row['patient_id'])[-4:]}", f"gender {row.get('gender') or 'not recorded'}"]
            if row.get("primary_diagnosis"):
                values.append(f"clinical problem: {row['primary_diagnosis']}")
            bal_str = f"Rs {row['outstanding_balance']}" if row.get('outstanding_balance') is not None else "not recorded"
            values.append(f"discharge: {row.get('discharge_status') or 'Discharged'}; clearance: {row.get('bill_clearance_status') or 'not recorded'}; outstanding balance: {bal_str}")
            lines.append(" — ".join(values))
            patient_ids.append(int(row["patient_id"]))
        content = f"Discharged patients ({len(rows)}):\n" + "\n".join(f"{i}. {line}" for i, line in enumerate(lines, 1))
        metadata = {
            "module": "ip",
            "record_id": "authorized_doctor_discharged_list",
            "count": len(rows),
            "patient_ids": patient_ids,
            "cohort": "discharged",
            "requested_fields": sorted(dimensions)
        }
        return [self._source(context, "Discharged patients", content, "patient_admission_summary", "ip",
                             "admissions,patients,dim_admission_inputs", "authorized_doctor_discharged_list", metadata)], "authorized_sql_list"

    def _doctor_op_list(self, cur, context, dimensions: Set[str]):
        if not context.doctor_id and not context.is_admin:
            raise PermissionError(ACCESS_DENIED)
        name = ""
        if context.doctor_id:
            cur.execute("SELECT display_name FROM doctors WHERE id=%s LIMIT 1", (context.doctor_id,))
            doctor = cur.fetchone() or {}
            name = doctor.get("display_name") if isinstance(doctor, dict) else doctor[0]
            if not name: raise PermissionError(ACCESS_DENIED)

        cur.execute("""
            SELECT
                sub.patient_id,
                p.patient_code,
                p.first_name,
                p.last_name,
                p.gender,
                sub.appointment_date,
                sub.appointment_time,
                sub.status,
                sub.booking_id,
                COALESCE(sub.reason_for_visit, sub.patient_reason, 'Outpatient Consultation') AS reason
            FROM (
                SELECT DISTINCT ON (apt.patient_id)
                    apt.patient_id,
                    apt.doctor_id,
                    apt.appointment_date,
                    apt.appointment_time,
                    apt.status,
                    apt.booking_id,
                    apt.reason_for_visit,
                    apt.patient_reason,
                    COALESCE(d.display_name, 'Consultant Doctor') AS doctor
                FROM appointments apt
                JOIN patients p ON p.id = apt.patient_id
                LEFT JOIN doctors d ON d.id = apt.doctor_id
                WHERE (apt.booking_source IN ('OPD_DESK', 'Walk-in', 'Phone', 'Web Portal', 'ADMIN', 'DOCTOR') OR apt.booking_id LIKE 'APT-%%')
                ORDER BY apt.patient_id, apt.appointment_date DESC, apt.id DESC
                LIMIT 100
            ) sub
            JOIN patients p ON p.id = sub.patient_id
            WHERE sub.doctor_id IN (%s, %s) OR sub.doctor ILIKE %s
            ORDER BY sub.appointment_date DESC, sub.appointment_time DESC
        """, (context.doctor_id, context.user_id, f"%{name}%"))
        rows = [dict(r) for r in cur.fetchall()]
        if not rows:
            content = "No outpatient (OP) patients found under your care."
            return [self._source(context, "Outpatient (OP) patients", content, "appointment_summary", "op",
                                 "appointments,patients", "authorized_doctor_op_list",
                                 {"module": "op", "count": 0, "cohort": "op"})], "authorized_sql_list"
        lines = []
        patient_ids = []
        for i, row in enumerate(rows, 1):
            name_str = f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip()
            values = [name_str]
            id_str = str(row.get('patient_code') or row['patient_id'])[-4:]
            values.append(f"ID …{id_str}")
            if "basic" in dimensions and row.get("gender"):
                values.append(f"gender {row['gender']}")
            if row.get("appointment_date"):
                time_str = f" {str(row['appointment_time'])[:5]}" if row.get("appointment_time") else ""
                values.append(f"appointment: {row['appointment_date']}{time_str}")
            if row.get("reason"):
                values.append(f"reason: {row['reason']}")
            if row.get("status"):
                values.append(f"status: {row['status']}")
            lines.append(" — ".join(values))
            patient_ids.append(int(row["patient_id"]))
        content = f"Outpatient (OP) patients ({len(rows)}):\n" + "\n".join(f"{i}. {line}" for i, line in enumerate(lines, 1))
        metadata = {
            "module": "op",
            "record_id": "authorized_doctor_op_list",
            "count": len(rows),
            "patient_ids": patient_ids,
            "cohort": "op",
            "requested_fields": sorted(dimensions)
        }
        return [self._source(context, "Outpatient (OP) patients", content, "appointment_summary", "op",
                             "appointments,patients", "authorized_doctor_op_list", metadata)], "authorized_sql_list"

    def _doctor_patient_list(self, cur, context, dimensions: Set[str]):
        fields = {"name"}
        if "basic" in dimensions: fields |= {"basic", "location"}
        if "location" in dimensions: fields.add("location")
        if "admission_date" in dimensions: fields.add("admission_date")
        if "reason" in dimensions: fields.add("reason")
        if "admission" in dimensions: fields.add("admission")
        if "diagnosis" in dimensions: fields.add("diagnosis")
        if "blocked_discharge" in dimensions or "why" in dimensions: fields.add("discharge")
        if "abnormal" in dimensions: fields |= {"abnormal", "vitals", "diagnosis", "location"}
        return self._patient_collection(cur, context, {
            "requested_fields": sorted(fields), "collection_patient_ids": [],
            "blocked_discharge": "blocked_discharge" in dimensions,
            "abnormal": "abnormal" in dimensions,
        })

    def _patient_collection(self, cur, context, plan):
        """Field-driven, structured collection retrieval inside one authorization scope."""
        norm_q = plan.get("normalized_query", "")
        dims = set(plan.get("dimensions") or ())
        if (
            plan.get("cohort") == "op"
            or "op" in dims
            or _has(norm_q, {"outpatient", "opd"})
            or "op" in norm_q.split()
            or "any op" in norm_q
        ):
            return self._doctor_op_list(cur, context, {"op", "names"})
        if (
            plan.get("cohort") == "discharged"
            or "discharged" in dims
            or ("discharged" in norm_q.split() and not _has(norm_q, {"clearance", "pending discharge", "summary", "draft"}))
        ):
            return self._doctor_discharged_list(cur, context, {"discharged", "names"})

        fields = set(plan.get("requested_fields") or ()) or {"name"}
        prior_ids = sorted({int(value) for value in plan.get("collection_patient_ids") or ()})
        blocked = bool(plan.get("blocked_discharge")) or "blocked_discharge" in set(plan.get("dimensions") or ())
        abnormal = bool(plan.get("abnormal")) or "abnormal" in fields
        if not context.doctor_id:
            if not context.is_admin:
                raise PermissionError(ACCESS_DENIED)
            doctor_name = None
        else:
            cur.execute("SELECT display_name FROM doctors WHERE id=%s LIMIT 1", (context.doctor_id,))
            doctor = cur.fetchone() or {}
            doctor_name = doctor.get("display_name") if isinstance(doctor, dict) else doctor[0]
            if not doctor_name: raise PermissionError(ACCESS_DENIED)
        blocked_clause = ""
        if blocked or ("discharge" in fields and plan.get("normalized_query", "").find("blocked") >= 0):
            blocked_clause = """
                AND EXISTS (
                    SELECT 1 FROM bills b
                    WHERE b.patient_id=dai.patient_id AND b.admission_id=dai.admission_id
                      AND COALESCE(b.bill_status,'') NOT IN ('Settled','Paid','Cleared')
                      AND (COALESCE(b.patient_amount,b.net_amount,0) - COALESCE((
                          SELECT SUM(pay.amount) FROM payments pay
                          WHERE pay.bill_id=b.bill_id AND pay.payment_status='Success'
                      ),0)) > 0.01
                )
            """
        abnormal_clause = ""
        if abnormal:
            abnormal_clause = """
                AND (dai.latest_temperature >= 100.4 OR dai.latest_heart_rate >= 100 OR dai.latest_heart_rate < 60
                     OR dai.latest_systolic_bp >= 140 OR dai.latest_systolic_bp < 90
                     OR dai.latest_oxygen_saturation < 95.0)
            """
        scope_clauses, params = [], []
        if context.role == "doctor":
            scope_clauses.append("(dai.attending_doctor ILIKE %s OR dai.admission_id IN (SELECT admission_id FROM admissions WHERE doctor_id=%s))")
            params.extend([f"%{doctor_name}%", context.doctor_id])
        if prior_ids:
            scope_clauses.append("dai.patient_id=ANY(%s)"); params.append(prior_ids)
        scope_sql = " AND ".join(scope_clauses) if scope_clauses else "TRUE"
        cur.execute(f"""
            SELECT DISTINCT ON (dai.patient_id) dai.patient_id, dai.patient_number AS patient_code,
                   dai.first_name, dai.last_name, dai.gender, dai.date_of_birth,
                   dai.admission_number, dai.admission_date, dai.reason_for_admission,
                   dai.bed_number, dai.room_number, dai.ward_name, dai.primary_diagnosis,
                   dai.secondary_diagnoses, dai.latest_temperature, dai.latest_heart_rate,
                   dai.latest_systolic_bp, dai.latest_diastolic_bp, dai.latest_oxygen_saturation,
                   dai.bill_number, dai.bill_net_amount, dai.bill_status,
                   dai.bill_clearance_status, dai.outstanding_balance, dai.discharge_status
            FROM dim_admission_inputs dai
            WHERE {scope_sql}
              AND LOWER(COALESCE(dai.discharge_status,'')) <> 'discharged'
              {blocked_clause}
              {abnormal_clause}
            ORDER BY dai.patient_id, dai.admission_date DESC
        """, params)
        rows = [dict(row) for row in cur.fetchall()]
        if not rows:
            return [], "authorized_sql_list"
        lines, patient_ids = [], [int(row["patient_id"]) for row in rows]
        for row in rows:
            name = f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip()
            values = [name]
            if "basic" in fields:
                values += [f"ID …{str(row.get('patient_code') or row['patient_id'])[-4:]}", f"gender {row.get('gender') or 'not recorded'}"]
            if "diagnosis" in fields:
                values.append(f"clinical problem: {row.get('primary_diagnosis') or 'not recorded'}")
            if "location" in fields:
                values.append(f"bed {row.get('bed_number') or 'not assigned'}, room {row.get('room_number') or 'not assigned'}, ward {row.get('ward_name') or 'not assigned'}")
            if "admission_date" in fields:
                adm_date = str(row.get('admission_date'))[:10] if row.get('admission_date') else "not recorded"
                values.append(f"admission date: {adm_date}")
            if "reason" in fields:
                values.append(f"reason: {row.get('reason_for_admission') or 'not recorded'}")
            if "admission" in fields and "admission_date" not in fields and "reason" not in fields:
                adm_date = str(row.get('admission_date'))[:10] if row.get('admission_date') else None
                adm_parts = []
                if adm_date: adm_parts.append(f"admission date: {adm_date}")
                if row.get('reason_for_admission'): adm_parts.append(f"reason: {row.get('reason_for_admission')}")
                values.append(", ".join(adm_parts) if adm_parts else "admission: not recorded")
            if "vitals" in fields:
                bp = f"{row.get('latest_systolic_bp')}/{row.get('latest_diastolic_bp')}" if row.get('latest_systolic_bp') is not None else "not recorded"
                values.append(f"latest vitals: BP {bp}, HR {row.get('latest_heart_rate') or 'not recorded'}, SpO2 {row.get('latest_oxygen_saturation') or 'not recorded'}, Temp {row.get('latest_temperature') or 'not recorded'}")
            if "billing" in fields:
                values.append(f"bill {row.get('bill_number') or 'not recorded'}; status {row.get('bill_status') or 'not recorded'}; outstanding {row.get('outstanding_balance') if row.get('outstanding_balance') is not None else 'not recorded'}")
            if "discharge" in fields:
                bal_str = f"Rs {row['outstanding_balance']}" if row.get('outstanding_balance') is not None else "not recorded"
                values.append(f"discharge: {row.get('discharge_status') or 'not recorded'}; clearance: {row.get('bill_clearance_status') or 'not recorded'}; outstanding balance: {bal_str}")
            lines.append(" — ".join(values))
        if abnormal:
            label = "Patients with abnormal/critical values"
        elif blocked:
            label = "Discharge-blocked patients"
        else:
            label = "Current IP patients"
        content = f"{label} ({len(rows)}):\n" + "\n".join(f"{i}. {line}" for i, line in enumerate(lines, 1))
        metadata = {"module":"ip", "record_id":"authorized_doctor_patient_list",
                    "count":len(rows), "patient_ids":patient_ids,
                    "requested_fields":sorted(fields), "blocked_discharge":blocked,
                    "abnormal":abnormal}
        return [self._source(context, label, content, "patient_admission_summary", "ip",
                "admissions,patients", "authorized_doctor_patient_list", metadata)], "authorized_sql_list"

    def _doctor_radiology_worklist(self, cur, context, dimensions: Set[str]):
        allowed = sorted(context.allowed_patient_ids or ())
        if not allowed:
            return [], "empty_authorized_scope"
        clauses = ["ro.patient_id = ANY(%s)"]
        params = [allowed]
        if "breakdown" in dimensions or ("urgent" in dimensions and "routine" in dimensions):
            # Breakdown across priorities, fetch all active orders
            pass
        elif "urgent" in dimensions:
            clauses.append("LOWER(ro.priority) IN ('urgent', 'stat', 'high', 'emergency')")
            clauses.append("LOWER(COALESCE(ro.status, '')) NOT IN ('finalized', 'completed', 'reviewed')")
        elif "routine" in dimensions:
            clauses.append("LOWER(ro.priority) NOT IN ('urgent', 'stat', 'high', 'emergency')")
            clauses.append("LOWER(COALESCE(ro.status, '')) NOT IN ('finalized', 'completed', 'reviewed')")
        elif "uploaded" in dimensions:
            clauses.append("LOWER(COALESCE(ro.status, '')) = 'uploaded'")
        elif "requested" in dimensions:
            clauses.append("LOWER(COALESCE(ro.status, '')) = 'requested'")
        where = " AND ".join(clauses)
        cur.execute(f"""
            SELECT ro.order_id, ro.accession_number, ro.patient_id, ro.examination, ro.priority, ro.status,
                   p.first_name, p.last_name, p.patient_code
            FROM radiology_orders ro
            JOIN patients p ON p.id = ro.patient_id
            WHERE {where}
            ORDER BY ro.created_at DESC
        """, params)
        rows = [dict(r) for r in cur.fetchall()]
        if not rows:
            if "urgent" in dimensions:
                content = "No pending urgent or high-priority X-ray orders found for your admitted patients."
            elif "routine" in dimensions:
                content = "No routine X-ray orders found for your admitted patients."
            elif "uploaded" in dimensions:
                content = "No uploaded X-ray orders found for your admitted patients."
            else:
                content = "No X-ray orders or reports found for your admitted patients."
            return [self._source(context, "Doctor Radiology Worklist", content, "xray_order", "radiology_order",
                                 "radiology_orders", "authorized_doctor_radiology_worklist",
                                 {"module": "radiology_order", "count": 0})], "authorized_sql_list"

        if "breakdown" in dimensions or ("urgent" in dimensions and "routine" in dimensions):
            urgent_rows = [r for r in rows if str(r.get("priority", "")).strip().lower() in ("urgent", "stat", "high", "emergency")]
            routine_rows = [r for r in rows if str(r.get("priority", "")).strip().lower() not in ("urgent", "stat", "high", "emergency")]
            if "count" in dimensions and "categorize" not in dimensions:
                content = f"Authorized X-ray order priority counts: Urgent: {len(urgent_rows)} orders; Routine: {len(routine_rows)} orders (Total: {len(rows)} orders)."
                label = "Authorized X-ray Order Counts"
                return [self._source(context, label, content, "xray_order", "radiology_order",
                                     "radiology_orders", "authorized_doctor_radiology_worklist",
                                     {"module": "radiology_order", "count": len(rows), "urgent_count": len(urgent_rows), "routine_count": len(routine_rows)})], "authorized_sql_aggregate"

            lines = []
            if urgent_rows:
                lines.append(f"• Urgent Priority ({len(urgent_rows)} orders):")
                for i, r in enumerate(urgent_rows, 1):
                    name = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip()
                    lines.append(f"  {i}. {name} (ID …{str(r.get('patient_code') or r['patient_id'])[-4:]}): {r.get('examination')} — Priority: {r.get('priority')}, Status: {r.get('status')}, Acc: #{r.get('accession_number')}")
            if routine_rows:
                if lines: lines.append("")
                lines.append(f"• Routine Priority ({len(routine_rows)} orders):")
                for i, r in enumerate(routine_rows, 1):
                    name = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip()
                    lines.append(f"  {i}. {name} (ID …{str(r.get('patient_code') or r['patient_id'])[-4:]}): {r.get('examination')} — Priority: {r.get('priority')}, Status: {r.get('status')}, Acc: #{r.get('accession_number')}")

            label = "Categorized X-ray Orders by Priority"
            content = f"Categorized X-ray Orders ({len(rows)} orders: {len(urgent_rows)} Urgent, {len(routine_rows)} Routine):\n" + "\n".join(lines)
            return [self._source(context, label, content, "xray_order", "radiology_order",
                                 "radiology_orders", "authorized_doctor_radiology_worklist",
                                 {"module": "radiology_order", "count": len(rows), "patient_ids": [r["patient_id"] for r in rows], "urgent_count": len(urgent_rows), "routine_count": len(routine_rows)})], "authorized_sql_list"

        if "categorize" in dimensions:
            urgent_rows = [r for r in rows if str(r.get("priority", "")).strip().lower() in ("urgent", "stat", "high", "emergency")]
            routine_rows = [r for r in rows if str(r.get("priority", "")).strip().lower() not in ("urgent", "stat", "high", "emergency")]
            lines = []
            if urgent_rows:
                lines.append(f"• Urgent Priority ({len(urgent_rows)} orders):")
                for i, r in enumerate(urgent_rows, 1):
                    name = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip()
                    lines.append(f"  {i}. {name} (ID …{str(r.get('patient_code') or r['patient_id'])[-4:]}): {r.get('examination')} — Priority: {r.get('priority')}, Status: {r.get('status')}, Acc: #{r.get('accession_number')}")
            if routine_rows:
                if lines: lines.append("")
                lines.append(f"• Routine Priority ({len(routine_rows)} orders):")
                for i, r in enumerate(routine_rows, 1):
                    name = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip()
                    lines.append(f"  {i}. {name} (ID …{str(r.get('patient_code') or r['patient_id'])[-4:]}): {r.get('examination')} — Priority: {r.get('priority')}, Status: {r.get('status')}, Acc: #{r.get('accession_number')}")

            label = "Categorized X-ray Orders by Priority"
            content = f"Categorized X-ray Orders ({len(rows)} orders: {len(urgent_rows)} Urgent, {len(routine_rows)} Routine):\n" + "\n".join(lines)
            return [self._source(context, label, content, "xray_order", "radiology_order",
                                 "radiology_orders", "authorized_doctor_radiology_worklist",
                                 {"module": "radiology_order", "count": len(rows), "patient_ids": [r["patient_id"] for r in rows], "urgent_count": len(urgent_rows), "routine_count": len(routine_rows)})], "authorized_sql_list"

        lines = []
        patient_ids = []
        for i, r in enumerate(rows, 1):
            name = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip()
            lines.append(f"{i}. {name} (ID …{str(r.get('patient_code') or r['patient_id'])[-4:]}): {r.get('examination')} — Priority: {r.get('priority')}, Status: {r.get('status')}, Acc: #{r.get('accession_number')}")
            patient_ids.append(r["patient_id"])

        if "urgent" in dimensions:
            label = "Patients with Pending Urgent/Priority X-rays"
        elif "routine" in dimensions:
            label = "Patients with Routine X-rays"
        elif "uploaded" in dimensions:
            label = "Patients with Uploaded X-rays"
        elif "requested" in dimensions:
            label = "Patients with Requested X-rays"
        else:
            label = "Patients with X-ray Orders / Reports"

        content = f"{label} ({len(rows)} orders):\n" + "\n".join(lines)
        return [self._source(context, label, content, "xray_order", "radiology_order",
                             "radiology_orders", "authorized_doctor_radiology_worklist",
                             {"module": "radiology_order", "count": len(rows), "patient_ids": patient_ids})], "authorized_sql_list"

    def _doctor_clarifications(self, cur, context, dimensions: Set[str], patient_id: Optional[int] = None):
        if not context.doctor_id and not context.user_id:
            raise PermissionError(ACCESS_DENIED)
        allowed = sorted(context.allowed_patient_ids or ())
        clauses = []
        params = []
        if patient_id is not None:
            clauses.append("ro.patient_id = %s")
            params.append(patient_id)
        elif context.role == "radiologist":
            clauses.append("(rc.assigned_to = %s OR rc.created_by = %s OR rc.assigned_to IS NULL)")
            params.extend([context.user_id, context.user_id])
        elif context.is_admin:
            pass
        else:
            clauses.append("(rc.created_by IN (%s, %s)" + (" OR ro.patient_id = ANY(%s))" if allowed else ")"))
            params.extend([context.user_id, context.doctor_id])
            if allowed:
                params.append(allowed)

        if "urgent" in dimensions:
            clauses.append("LOWER(rc.priority) IN ('urgent', 'stat', 'high')")
        if "status" in dimensions:
            if "resolved" in dimensions or "closed" in dimensions:
                clauses.append("LOWER(rc.status) = 'resolved'")
            elif "pending" in dimensions or "open" in dimensions:
                clauses.append("LOWER(rc.status) <> 'resolved'")

        where = " AND ".join(clauses) if clauses else "1=1"

        # ── Unread clarification check ───────────────────────────────────
        if "unread" in dimensions:
            viewer_id = context.user_id
            cur.execute(f"""
                SELECT rc.id, rc.subject, rc.status, rc.priority, rc.created_at,
                       ro.accession_number, ro.examination,
                       p.first_name, p.last_name, p.patient_code,
                       (SELECT COUNT(*) FROM radiology_clarification_messages m
                        WHERE m.thread_id = rc.id
                          AND m.sender_id <> %s
                          AND NOT EXISTS (
                            SELECT 1 FROM radiology_clarification_reads r
                            JOIN users u ON u.id = r.user_id
                            WHERE r.message_id = m.id
                              AND (r.user_id = %s OR u.staff_name = (SELECT staff_name FROM users WHERE id = %s))
                          )
                       ) AS unread_cnt
                FROM radiology_clarifications rc
                JOIN radiology_orders ro ON ro.order_id = rc.order_id
                JOIN patients p ON p.id = ro.patient_id
                WHERE {where} AND LOWER(rc.status) <> 'resolved'
                ORDER BY rc.created_at DESC
            """, [viewer_id or 0, viewer_id or 0, viewer_id or 0] + params)
            rows = [dict(r) for r in cur.fetchall()]
            unread_rows = [r for r in rows if int(r.get('unread_cnt', 0)) > 0]
            if not unread_rows:
                content = "No unread clarification messages. All radiology clarifications have been read and resolved."
                label = "Clarification Unread Status"
            else:
                lines = []
                for i, r in enumerate(unread_rows, 1):
                    pname = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip()
                    lines.append(f"{i}. Patient: {pname} | Subject: \"{r.get('subject')}\" | "
                                 f"Acc: #{r.get('accession_number')} | Unread: {r.get('unread_cnt')} message(s) | "
                                 f"Status: {r.get('status')}")
                content = f"Unread clarifications ({len(unread_rows)}):\n" + "\n".join(lines)
                label = f"Unread Radiology Clarifications ({len(unread_rows)})"
            return [self._source(context, label, content, "radiology_clarification",
                                 "radiology_clarification", "radiology_clarifications",
                                 "authorized_doctor_clarifications",
                                 {"module": "radiology_clarification", "count": len(unread_rows),
                                  "unread_count": len(unread_rows)})], "authorized_sql_list"

        cur.execute(f"""
            SELECT rc.id, rc.order_id, rc.subject, rc.priority, rc.status, rc.created_at, rc.resolved_at,
                   ro.accession_number, ro.examination,
                   p.first_name, p.last_name, p.patient_code, p.id AS patient_id
            FROM radiology_clarifications rc
            JOIN radiology_orders ro ON ro.order_id = rc.order_id
            JOIN patients p ON p.id = ro.patient_id
            WHERE {where}
            ORDER BY rc.created_at DESC
        """, params)
        rows = [dict(r) for r in cur.fetchall()]
        if not rows:
            content = "No clarification messages are recorded in the provided radiology records."
            return [self._source(context, "Radiology Clarifications", content, "radiology_clarification", "radiology_clarification",
                                 "radiology_clarifications", "authorized_doctor_clarifications",
                                 {"module": "radiology_clarification", "count": 0})], "authorized_sql_list"

        urgent_count = sum(1 for r in rows if str(r.get("priority", "")).lower() in ("urgent", "stat", "high"))
        routine_count = len(rows) - urgent_count
        resolved_count = sum(1 for r in rows if str(r.get("status", "")).lower() == "resolved")
        pending_count = len(rows) - resolved_count

        if "count" in dimensions and "list" not in dimensions:
            content = f"Authorized radiology clarifications: {len(rows)} clarifications recorded ({urgent_count} Urgent, {routine_count} Routine; {resolved_count} Resolved, {pending_count} Pending)."
            label = "Authorized Radiology Clarification Counts"
            return [self._source(context, label, content, "radiology_clarification", "radiology_clarification",
                                 "radiology_clarifications", "authorized_doctor_clarifications",
                                 {"module": "radiology_clarification", "count": len(rows), "urgent_count": urgent_count, "routine_count": routine_count, "resolved_count": resolved_count, "pending_count": pending_count})], "authorized_sql_aggregate"

        # Get messages with sender info for all threads
        thread_ids = [str(r["id"]) for r in rows]
        cur.execute("""
            SELECT rcm.thread_id, rcm.sender_name, rcm.sender_role, rcm.body, rcm.created_at
            FROM radiology_clarification_messages rcm
            WHERE rcm.thread_id = ANY(%s::uuid[])
            ORDER BY rcm.created_at ASC
        """, (thread_ids,))
        all_messages = {}
        for msg in cur.fetchall():
            tid = str(msg['thread_id'])
            if tid not in all_messages:
                all_messages[tid] = []
            all_messages[tid].append(dict(msg))

        # Always build a structured list (ignore rag_documents for list queries)
        lines = []
        for i, r in enumerate(rows, 1):
            pname = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip()
            tid = str(r['id'])
            msgs = all_messages.get(tid, [])
            # Raised by = first sender (doctor)
            raised_by = msgs[0]['sender_name'] if msgs else "Unknown"
            first_msg_body = msgs[0]['body'] if msgs else "(no message)"
            line = (f"{i}. Patient: {pname} (Acc: #{r.get('accession_number')}) | "
                    f"Subject: \"{r.get('subject')}\" | Raised By: {raised_by} | "
                    f"Clarification: \"{first_msg_body[:80]}\" | "
                    f"Status: {r.get('status')} | Priority: {r.get('priority')}")
            lines.append(line)

        raised_by_names = list(dict.fromkeys(msgs[0]['sender_name'] for r in rows if (msgs := all_messages.get(str(r['id']), []))))
        doc_summary = f" raised by {', '.join(raised_by_names)}" if raised_by_names else ""
        label = f"Radiology Clarifications ({len(rows)})"
        content = (f"Radiology clarifications ({len(rows)} total{doc_summary}: {urgent_count} Urgent, {routine_count} Routine; "
                   f"{resolved_count} Resolved, {pending_count} Pending):\n" + "\n".join(lines))
        return [self._source(context, label, content, "radiology_clarification", "radiology_clarification",
                             "radiology_clarifications", "authorized_doctor_clarifications",
                             {"module": "radiology_clarification", "count": len(rows), "patient_ids": [r["patient_id"] for r in rows], "urgent_count": urgent_count, "routine_count": routine_count})], "authorized_sql_list"

    def _doctor_ward_tasks(self, cur, context):
        if not context.doctor_id:
            raise PermissionError(ACCESS_DENIED)
        cur.execute("SELECT display_name FROM doctors WHERE id=%s LIMIT 1", (context.doctor_id,))
        doc = cur.fetchone() or {}
        doctor_name = doc.get("display_name") if isinstance(doc, dict) else (doc[0] if doc else "")
        if not doctor_name:
            raise PermissionError(ACCESS_DENIED)
        cur.execute("""
            SELECT nt.id, nt.bed_no, nt.patient_name, nt.uhid, nt.task_description, nt.status,
                   nt.flag_status, nt.ward_name, nt.ews_score, nt.hr, nt.bp, nt.spo2, nt.temp
            FROM nursing_tasks nt
            WHERE nt.clinical_notes ILIKE %s AND nt.status IN ('Active', 'In Progress')
            ORDER BY CASE WHEN nt.flag_status ILIKE '%%critical%%' THEN 1 ELSE 2 END, nt.id
        """, (f"%{doctor_name}%",))
        rows = [dict(r) for r in cur.fetchall()]
        if not rows:
            content = f"No active ward tasks or pending clinical orders for patients under {doctor_name}."
            return [self._source(context, "Ward Rounds Clinical Task Summary", content, "patient_admission_summary", "ip",
                                 "nursing_tasks", "authorized_doctor_ward_tasks",
                                 {"module": "ip", "count": 0})], "authorized_sql_list"
        lines = []
        for i, r in enumerate(rows, 1):
            pname = r.get("patient_name") or "Patient"
            bed = r.get("bed_no") or "Bed"
            ward = r.get("ward_name") or "Ward"
            tdesc = r.get("task_description") or "Task"
            flag = r.get("flag_status") or "Normal"
            ews = r.get("ews_score")
            ews_str = f", EWS: {ews}" if ews is not None else ""
            lines.append(f"{i}. {pname} ({bed}, {ward}): {tdesc} [Flag: {flag}{ews_str}]")
        label = "Pending Clinical Orders & Ward Tasks"
        content = f"{label} ({len(rows)} tasks):\n" + "\n".join(lines)
        return [self._source(context, label, content, "patient_admission_summary", "ip",
                             "nursing_tasks", "authorized_doctor_ward_tasks",
                             {"module": "ip", "count": len(rows)})], "authorized_sql_list"

    def _radiology_aggregate(self, cur, context, dimensions, patient_id, order_id, accession_number):
        clauses, params = ["1=1"], []
        if context.role == "doctor":
            allowed = sorted(context.allowed_patient_ids or ())
            if not allowed: return [], "empty_authorized_scope"
            clauses.append("o.patient_id=ANY(%s)"); params.append(allowed)
        elif context.role == "radiologist":
            pass
        if patient_id is not None: clauses.append("o.patient_id=%s"); params.append(patient_id)
        if order_id: clauses.append("o.order_id=%s"); params.append(str(order_id))
        if accession_number: clauses.append("o.accession_number=%s"); params.append(accession_number)

        # Examination type filter (PA / AP / PA+AP)
        exam_label = None
        if "pa_and_ap" in dimensions:
            clauses.append("LOWER(o.examination) ILIKE %s"); params.append("%pa%ap%")
            exam_label = "Chest X-ray PA + AP"
        elif "pa" in dimensions:
            clauses.append("LOWER(o.examination) ILIKE %s AND LOWER(o.examination) NOT ILIKE %s")
            params.extend(["%pa%", "%pa%ap%"])
            exam_label = "Chest X-ray PA"
        elif "ap" in dimensions:
            # AP-only: matches 'Chest X-ray AP' but NOT 'PA + AP'
            clauses.append("(LOWER(o.examination) ILIKE %s AND LOWER(o.examination) NOT ILIKE %s)")
            params.extend(["%ap%", "%pa%ap%"])
            exam_label = "Chest X-ray AP"

        where = " AND ".join(clauses)

        # Study analyzed: count active order scans (AI worklist)
        if "study_analyzed" in dimensions:
            scan_clauses = ["1=1"]
            scan_params = []
            if context.role == "doctor":
                allowed = sorted(context.allowed_patient_ids or ())
                if not allowed: return [], "empty_authorized_scope"
                scan_clauses.append("o.patient_id=ANY(%s)"); scan_params.append(allowed)
            scan_where = " AND ".join(scan_clauses)

            cur.execute(f"SELECT COUNT(*) total FROM radiology_orders o WHERE {scan_where.replace('s.patient_id', 'o.patient_id')}", scan_params)
            total_all_orders = int((cur.fetchone() or {}).get("total") or 0)

            cur.execute(f"""
                SELECT
                    COUNT(DISTINCT o.order_id) AS total_orders,
                    COUNT(DISTINCT s.scan_id) AS total_scans,
                    COUNT(DISTINCT CASE WHEN LOWER(COALESCE(s.review_status,'')) = 'confirmed' THEN s.scan_id END) AS confirmed,
                    COUNT(DISTINCT CASE WHEN LOWER(COALESCE(s.review_status,'')) = 'pending review' THEN s.scan_id END) AS pending_review,
                    COUNT(DISTINCT CASE WHEN s.combined_status = 'HIGH PRIORITY' THEN s.scan_id END) AS high_priority,
                    COUNT(DISTINCT CASE WHEN s.combined_status = 'REVIEW FLAG' THEN s.scan_id END) AS review_flag,
                    COUNT(DISTINCT CASE WHEN s.combined_status = 'ROUTINE' THEN s.scan_id END) AS routine
                FROM radiology_scan s
                JOIN radiology_order_studies ros ON ros.study_key = s.order_study_id
                JOIN radiology_orders o ON o.order_id = ros.order_id
                WHERE {scan_where}
            """, scan_params)
            stat = dict(cur.fetchone() or {})
            total_orders = int(stat.get('total_orders') or 0)
            total_scans = int(stat.get('total_scans') or 0)
            confirmed = int(stat.get('confirmed') or 0)
            pending_rev = int(stat.get('pending_review') or 0)
            high_p = int(stat.get('high_priority') or 0)
            rev_flag = int(stat.get('review_flag') or 0)
            routine = int(stat.get('routine') or 0)

            content = (f"Studies analyzed by AI worklist: {total_orders} out of {total_all_orders} total order requests ({total_scans} scan images). "
                       f"Confirmed: {confirmed}, Pending Review: {pending_rev}. "
                       f"Triage assessment breakdown: High Priority: {high_p}, Review Flag: {rev_flag}, Routine: {routine}.")
            meta = {"module": "radiology_order", "record_id": "authorized_radiology_aggregate",
                    "total": total_all_orders, "analyzed_orders": total_orders, "analyzed_scans": total_scans,
                    "confirmed": confirmed, "pending_review": pending_rev, "high_priority": high_p,
                    "review_flag": rev_flag, "routine": routine, "department": "radiology"}
            return [self._source(context, "Authorized Radiology Study Analysis Count", content, "xray_order",
                    "radiology_order", "radiology_scan", "authorized_radiology_aggregate", meta, patient_id)], "authorized_sql_aggregate"

        cur.execute(f"SELECT COUNT(*) total FROM radiology_orders o WHERE {where}", params)
        total = int((cur.fetchone() or {}).get("total") or 0)
        meta = {"module":"radiology_order", "record_id":"authorized_radiology_aggregate", "total":total, "department":"radiology"}
        if exam_label:
            sections = [f"Total {exam_label} requests: {total}"]
        else:
            sections = [f"Total X-ray requests: {total}"]
        for dim, expr in (("priority", "COALESCE(NULLIF(TRIM(o.priority),''),'Unassigned')"),
                          ("status", "COALESCE(NULLIF(TRIM(o.status),''),'Unassigned')")):
            if dim not in dimensions: continue
            cur.execute(f"SELECT {expr} label,COUNT(*) total FROM radiology_orders o WHERE {where} GROUP BY {expr} ORDER BY total DESC,label", params)
            rows = [{"label":r["label"], "total":int(r["total"])} for r in cur.fetchall()]
            meta[dim] = rows; sections.append(dim.title()+": "+", ".join(f"{r['label']}: {r['total']}" for r in rows))
        if "department" in dimensions:
            cur.execute(f"""SELECT COALESCE(dep.department_name,'Unassigned') label,COUNT(*) total
                FROM radiology_orders o LEFT JOIN users u ON u.id=o.requested_by
                LEFT JOIN doctors d ON d.user_id=u.id LEFT JOIN departments dep ON dep.id=COALESCE(d.department_id,u.department_id)
                WHERE {where} GROUP BY COALESCE(dep.department_name,'Unassigned') ORDER BY total DESC,label""", params)
            rows = [{"label":r["label"], "total":int(r["total"])} for r in cur.fetchall()]
            meta["department"] = rows; sections.append("Department: "+", ".join(f"{r['label']}: {r['total']}" for r in rows))
        return [self._source(context, "Authorized Radiology Request Aggregate", ". ".join(sections)+".", "xray_order",
                "radiology_order", "radiology_orders", "authorized_radiology_aggregate", meta, patient_id)], "authorized_sql_aggregate"

    def _radiology_list(self, cur, context, dimensions: Set[str], patient_id: Optional[int] = None, query: str = ""):
        """Return a full ordered list of radiology requests visible to this radiologist."""
        clauses, params = ["1=1"], []
        if context.role == "doctor":
            allowed = sorted(context.allowed_patient_ids or ())
            if not allowed: return [], "empty_authorized_scope"
            clauses.append("o.patient_id=ANY(%s)"); params.append(allowed)
        # radiologist sees all orders (scoped by department if needed)
        if patient_id is not None:
            clauses.append("o.patient_id=%s"); params.append(patient_id)

        # Check if doctor name is mentioned in query (e.g. "priya patel", "priya", "dr priya")
        matched_doc_name = None
        if query:
            cur.execute("""
                SELECT staff_name, first_name, last_name 
                FROM users 
                WHERE staff_name IS NOT NULL OR first_name IS NOT NULL
            """)
            for urow in cur.fetchall() or []:
                s_name = (urow.get("staff_name") or "").strip()
                f_name = (urow.get("first_name") or "").strip()
                l_name = (urow.get("last_name") or "").strip()
                full = f"{f_name} {l_name}".strip()
                for cand in (full, s_name, f_name, l_name):
                    if len(cand) >= 3 and cand.lower() in query.lower():
                        matched_doc_name = s_name or (f"Dr. {full}" if full else cand)
                        clauses.append("(LOWER(COALESCE(u.staff_name,'')) ILIKE %s OR LOWER(COALESCE(u.first_name,'')) ILIKE %s OR LOWER(COALESCE(u.last_name,'')) ILIKE %s)")
                        params.extend([f"%{cand}%", f"%{cand}%", f"%{cand}%"])
                        break
                if matched_doc_name:
                    break

        # Examination type filter
        if "pa_and_ap" in dimensions:
            clauses.append("LOWER(o.examination) ILIKE %s"); params.append("%pa%ap%")
        elif "pa" in dimensions:
            clauses.append("LOWER(o.examination) ILIKE %s AND LOWER(o.examination) NOT ILIKE %s")
            params.extend(["%pa%", "%pa%ap%"])
        elif "ap" in dimensions:
            clauses.append("(LOWER(o.examination) ILIKE %s AND LOWER(o.examination) NOT ILIKE %s)")
            params.extend(["%ap%", "%pa%ap%"])

        # Priority/status filter
        if "urgent" in dimensions:
            clauses.append("(LOWER(o.priority) IN ('urgent','stat','high','emergency') OR LOWER(COALESCE(s.combined_status,'')) IN ('high priority', 'review flag'))")
        elif "routine" in dimensions:
            clauses.append("LOWER(o.priority) NOT IN ('urgent','stat','high','emergency')")
        if "uploaded" in dimensions:
            clauses.append("LOWER(COALESCE(o.status,'')) = 'uploaded'")
        elif "requested" in dimensions:
            clauses.append("LOWER(COALESCE(o.status,'')) = 'requested'")

        # Date filter
        from datetime import date, timedelta
        if "today" in dimensions:
            clauses.append("DATE(o.created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE")
        elif "recent" in dimensions:
            clauses.append("o.created_at AT TIME ZONE 'Asia/Kolkata' >= NOW() AT TIME ZONE 'Asia/Kolkata' - INTERVAL '7 days'")

        where = " AND ".join(clauses)
        show_doctor = "requested_by" in dimensions or matched_doc_name is not None

        cur.execute(f"""
            SELECT DISTINCT ON (o.order_id)
                   o.order_id, o.accession_number, o.patient_id, o.examination, o.indication,
                   o.priority, o.status, o.created_at,
                   p.first_name AS p_first, p.last_name AS p_last, p.patient_code,
                   u.first_name AS d_first, u.last_name AS d_last, u.staff_name,
                   s.combined_status
            FROM radiology_orders o
            JOIN patients p ON p.id = o.patient_id
            LEFT JOIN users u ON u.id = o.requested_by
            LEFT JOIN radiology_order_studies ros ON ros.order_id = o.order_id
            LEFT JOIN radiology_scan s ON s.order_study_id = ros.study_key
            WHERE {where}
            ORDER BY o.order_id, o.created_at DESC
        """, params)

        rows = [dict(r) for r in cur.fetchall()]

        # Date filter: if "today" and no rows, give informative message
        if not rows:
            if matched_doc_name:
                content = f"No X-ray requests found for {matched_doc_name}."
            elif "today" in dimensions:
                content = "No X-ray requests received today."
            elif "recent" in dimensions:
                content = "No X-ray requests received in the last 7 days."
            else:
                content = "No X-ray requests found matching the specified criteria."
            return [self._source(context, "Radiology Request List", content, "xray_order",
                                 "radiology_order", "radiology_orders", "authorized_radiology_list",
                                 {"module": "radiology_order", "count": 0}, patient_id)], "authorized_sql_list"

        # If count-only requested
        if "count" in dimensions and not ("list" in dimensions or show_doctor):
            date_label = "today" if "today" in dimensions else ("this week" if "recent" in dimensions else "total")
            uploaded_cnt = sum(1 for r in rows if (r.get("status") or "").lower() == "uploaded")
            requested_cnt = sum(1 for r in rows if (r.get("status") or "").lower() == "requested")
            doc_str = f" requested by {matched_doc_name}" if matched_doc_name else ""
            content = f"Total X-ray requests{doc_str}: {len(rows)}. Status: Uploaded: {uploaded_cnt}, Requested: {requested_cnt}."
            return [self._source(context, "Radiology Request Count", content, "xray_order",
                                 "radiology_order", "radiology_orders", "authorized_radiology_list",
                                 {"module": "radiology_order", "count": len(rows)}, patient_id)], "authorized_sql_aggregate"

        lines = []
        for i, r in enumerate(rows, 1):
            pname = f"{r.get('p_first') or ''} {r.get('p_last') or ''}".strip() or "Unknown Patient"
            acc = r.get("accession_number") or "N/A"
            exam = r.get("examination") or "X-ray"
            priority = r.get("priority") or "Routine"
            indication = (r.get("indication") or "").strip()
            comb_status = r.get("combined_status")
            if comb_status and comb_status.upper() != priority.upper():
                priority_str = f"{priority} (AI Assessment: {comb_status})"
            else:
                priority_str = priority
            status = r.get("status") or "Unknown"
            created = ""
            if r.get("created_at"):
                try: created = f" | Ordered: {r['created_at'].strftime('%Y-%m-%d %H:%M')}"
                except Exception: pass
            
            ind_str = f" | Indication: {indication}" if indication and indication.lower() not in ("n/a", "none", "unknown", "null") else ""
            line = f"{i}. Patient: {pname} | Examination: {exam} | Priority: {priority_str} | Status: {status}{ind_str} | Acc: #{acc}{created}"
            if show_doctor:
                s_name = r.get("staff_name")
                d_first = r.get("d_first") or ""
                d_last = r.get("d_last") or ""
                dname = s_name or f"Dr. {d_first} {d_last}".strip()
                if dname and dname != "Dr.":
                    if not dname.startswith("Dr."):
                        dname = f"Dr. {dname}"
                    line += f" | Requested By: {dname}"
            lines.append(line)

        # Determine label based on filters
        exam_label = ""
        if "pa_and_ap" in dimensions: exam_label = "PA+AP "
        elif "pa" in dimensions: exam_label = "PA "
        elif "ap" in dimensions: exam_label = "AP "
        date_label = " (Today)" if "today" in dimensions else (" (Last 7 Days)" if "recent" in dimensions else "")
        if matched_doc_name:
            label = f"X-ray Requests requested by {matched_doc_name}{date_label} ({len(rows)} total)"
        else:
            label = f"All {exam_label}X-ray Requests{date_label} ({len(rows)} total)"

        # Group summary by doctor to simplify readability
        doc_counts = {}
        for r in rows:
            s_name = r.get("staff_name")
            d_first = r.get("d_first") or ""
            d_last = r.get("d_last") or ""
            dname = s_name or f"Dr. {d_first} {d_last}".strip()
            if not dname or dname == "Dr.":
                dname = "Unknown Clinician"
            elif not dname.startswith("Dr."):
                dname = f"Dr. {dname}"
            doc_counts[dname] = doc_counts.get(dname, 0) + 1

        summary_parts = [f"• {doc} requested {cnt} order{'s' if cnt != 1 else ''}" for doc, cnt in doc_counts.items()]
        summary_header = "\n".join(summary_parts)

        if (show_doctor or matched_doc_name) and summary_header:
            content = f"{label}:\n{summary_header}\n\n" + "\n".join(lines)
        else:
            content = f"{label}:\n" + "\n".join(lines)
        return [self._source(context, label, content, "xray_order",
                             "radiology_order", "radiology_orders", "authorized_radiology_list",
                             {"module": "radiology_order", "count": len(rows),
                              "patient_ids": [r["patient_id"] for r in rows]}, patient_id)], "authorized_sql_list"

    def _documents(self, cur, query, area, context, patient_id, admission_id, order_id, accession_number, status_filter, limit, expanded_phrases=None, query_plan=None):
        # is_active is the backwards-compatible tombstone. Migration 024 adds a
        # dedicated is_deleted column; ingestion mirrors deletion into is_active.
        clauses, params = ["is_active=TRUE"], []
        if context.role == "doctor":
            allowed = sorted(context.allowed_patient_ids or ())
            if not allowed: return [], "empty_authorized_scope"
            clauses.append("patient_id=ANY(%s)"); params.append(allowed)
        elif context.role == "radiologist":
            types = [k for k,v in DOCUMENT_MODULE.items() if v in context.allowed_modules]
            clauses.append("document_type=ANY(%s)"); params.append(types)
            if context.department:
                clauses.append("(metadata->>'department' IS NULL OR LOWER(metadata->>'department') = LOWER(%s))")
                params.append(context.department)
        is_patient_wide_query = (
            patient_id is not None
            and (
                area == "patient360"
                or _has(_normalized(query), {
                    "diagnosis", "diagnoses", "all diagnosis", "all diagnoses", "diagnosis list", "dx",
                    "result", "results", "investigation", "investigations", "workup", "lab", "labs",
                    "xray", "x ray", "radiology", "scan", "imaging", "all records", "everything",
                    "history", "all", "condition", "conditions", "test", "tests"
                })
            )
            and not _has(_normalized(query), {"this admission", "admission id", "current stay", "why admitted", "still admitted"})
        )
        effective_admission_id = None if is_patient_wide_query else admission_id
        for clause, value in (("patient_id=%s",patient_id),("order_id=%s",str(order_id) if order_id else None),("accession_number=%s",accession_number)):
            if value is not None: clauses.append(clause); params.append(value)
        if effective_admission_id is not None:
            clauses.append("(admission_id=%s OR admission_id IS NULL)")
            params.append(effective_admission_id)
        modules = {"radiology":{"radiology_order","radiology_ai","radiology_report","radiology_clarification"},
                   "discharge":{"ip","diagnosis","vitals","medications","lab","procedures","bill","radiology_report","discharge"}}.get(area)
        if modules:
            clauses.append("document_type=ANY(%s)"); params.append([k for k,v in DOCUMENT_MODULE.items() if v in modules])
        if status_filter:
            if status_filter.strip().lower() == "verified":
                clauses.append("(is_verified=TRUE OR review_status ILIKE %s)")
                params.append(f"%{status_filter}%")
            else:
                clauses.append("review_status ILIKE %s")
                params.append(f"%{status_filter}%")
        comprehensive = patient_id is not None and _has(_normalized(query), {"everything","complete overview","full overview","360","all records"})
        fetch = max(limit*8,80) if comprehensive else max(limit*4,40)
        retrieval_query = " ".join(dict.fromkeys([query] + list(expanded_phrases or [])))[:4000]
        cur.execute(f"""SELECT id,document_type,source_table,source_record_id,patient_id,admission_id,doctor_id,
            order_id,accession_number,study_instance_uid,title,content,metadata,review_status,is_verified,embedding,
            ts_rank_cd(COALESCE(search_vector,tsv),plainto_tsquery('english',%s)) kw_score
            FROM rag_documents WHERE {' AND '.join(clauses)} ORDER BY kw_score DESC,is_verified DESC,updated_at DESC LIMIT %s""",
            [retrieval_query]+params+[fetch])
        rows = cur.fetchall()

        if not rows and patient_id is not None:
            from services.rag_ingestion_service import ingestion_service
            try:
                ingestion_service.reindex_patient(patient_id)
                cur.execute(f"""SELECT id,document_type,source_table,source_record_id,patient_id,admission_id,doctor_id,
                    order_id,accession_number,study_instance_uid,title,content,metadata,review_status,is_verified,embedding,
                    ts_rank_cd(COALESCE(search_vector,tsv),plainto_tsquery('english',%s)) kw_score
                    FROM rag_documents WHERE {' AND '.join(clauses)} ORDER BY kw_score DESC,is_verified DESC,updated_at DESC LIMIT %s""",
                    [retrieval_query]+params+[fetch])
                rows = cur.fetchall()
            except Exception:
                pass

        # ── Staleness check: if live clinical data is newer than RAG index, trigger background reindex ──
        # This ensures the RAG always reflects current vitals, labs, etc. without waiting for a full reindex.
        if rows and patient_id is not None:
            try:
                cur.execute("""
                    SELECT MAX(rag_updated) AS rag_ts, MAX(live_updated) AS live_ts FROM (
                        SELECT MAX(updated_at) AS rag_updated, NULL::timestamptz AS live_updated
                        FROM rag_documents WHERE patient_id = %s AND is_active = TRUE
                        UNION ALL
                        SELECT NULL, MAX(recorded_at)
                        FROM vital_signs WHERE patient_id = %s
                        UNION ALL
                        SELECT NULL, MAX(result_date)
                        FROM lab_results WHERE patient_id = %s
                    ) t
                """, (patient_id, patient_id, patient_id))
                ts_row = cur.fetchone()
                rag_ts = ts_row.get("rag_ts") if ts_row else None
                live_ts = ts_row.get("live_ts") if ts_row else None
                if rag_ts and live_ts and live_ts > rag_ts:
                    # Live data is newer — fire background reindex so the NEXT query is fresh
                    import threading
                    from services.rag_ingestion_service import ingestion_service as _ing
                    def _bg_reindex(pid):
                        try:
                            _ing.reindex_patient(pid)
                        except Exception:
                            pass
                    threading.Thread(target=_bg_reindex, args=(patient_id,), daemon=True).start()
            except Exception:
                pass

        # Supplement admission/discharge records if missing or if query relates to admission/discharge
        if patient_id is not None:
            has_admission_or_dc = any(
                (r.get("document_type") in ("patient_admission_summary", "verified_discharge_summary"))
                for r in rows
            )
            is_adm_or_dc_q = any(w in _normalized(query) for w in [
                "admit", "admitted", "admission", "discharg", "stay", "inpatient", "status", "leave", "released"
            ])
            if is_adm_or_dc_q or not has_admission_or_dc:
                try:
                    cur.execute("""
                        SELECT id,document_type,source_table,source_record_id,patient_id,admission_id,doctor_id,
                               order_id,accession_number,study_instance_uid,title,content,metadata,review_status,is_verified,embedding,
                               0.95 as kw_score
                        FROM rag_documents
                        WHERE patient_id = %s
                          AND document_type IN ('patient_admission_summary', 'verified_discharge_summary')
                          AND is_active = TRUE
                        ORDER BY document_type DESC, updated_at DESC LIMIT 3
                    """, (patient_id,))
                    extra_adm_rows = cur.fetchall()
                    if extra_adm_rows:
                        existing_ids = {r.get("id") for r in rows}
                        for er in extra_adm_rows:
                            if er.get("id") not in existing_ids:
                                rows.append(er)
                                existing_ids.add(er.get("id"))
                except Exception:
                    pass

        if not rows and patient_id is not None:
            cur.execute("""
                SELECT dai.*, p.patient_code, p.first_name, p.last_name, p.gender, p.blood_group, p.date_of_birth
                FROM dim_admission_inputs dai
                JOIN patients p ON p.id = dai.patient_id
                WHERE dai.patient_id = %s
                ORDER BY dai.admission_date DESC LIMIT 1
            """, (patient_id,))
            adm = cur.fetchone()
            if adm:
                adm = dict(adm)
                pname = f"{adm.get('first_name') or ''} {adm.get('last_name') or ''}".strip()
                title = f"Inpatient Admission Summary - ADM #{adm.get('admission_number') or adm.get('admission_id')} ({pname})"
                content = (
                    f"Patient: {pname} (ID: {adm.get('patient_code') or patient_id}, Gender: {adm.get('gender') or 'N/A'})\n"
                    f"Admission Reason: {adm.get('reason_for_admission') or 'Medical admission'}\n"
                    f"Primary Diagnosis: {adm.get('primary_diagnosis') or 'Clinical evaluation'}\n"
                    f"Attending Doctor: {adm.get('attending_doctor') or 'Assigned Physician'}\n"
                    f"Location: Bed {adm.get('bed_number') or 'Unassigned'}, Room {adm.get('room_number') or 'Unassigned'}, Ward {adm.get('ward_name') or 'General'}\n"
                    f"Vitals: BP {adm.get('latest_systolic_bp')}/{adm.get('latest_diastolic_bp')}, HR {adm.get('latest_heart_rate')}, SpO2 {adm.get('latest_oxygen_saturation')}%, Temp {adm.get('latest_temperature')}F\n"
                    f"Discharge Status: {adm.get('discharge_status') or 'Admitted'}, Balance: Rs {adm.get('outstanding_balance') or 0}"
                )
                return [self._source(context, title, content, "patient_admission_summary", "ip",
                                     "dim_admission_inputs", str(adm.get("admission_id") or patient_id),
                                     {"module": "ip", "patient_id": patient_id}, patient_id)], "authorized_direct_summary"

        qemb = self.embedding_service.generate_embedding(retrieval_query)
        results = []
        target_modules = set((query_plan or {}).get("modules") or [])
        if area == "radiology" or target_modules & {"radiology_report", "radiology_order", "radiology_ai", "radiology_clarification", "radiology"} or _has(_normalized(query), {"xray", "x ray", "radiology", "scan", "scans"}):
            target_modules |= {"radiology_report", "radiology_order", "radiology_ai", "radiology_clarification"}
        for row in rows:
            emb = row.get("embedding")
            if isinstance(emb,str):
                try: emb=json.loads(emb)
                except Exception: emb=None
            vec = self.embedding_service.cosine_similarity(qemb,emb) if qemb and isinstance(emb,list) else 0.0
            kw=float(row.get("kw_score") or 0); item=dict(row); item.pop("embedding",None)
            item["order_id"]=str(item["order_id"]) if item.get("order_id") else None
            item["metadata"]=item.get("metadata") if isinstance(item.get("metadata"),dict) else {}
            item["module"]=item["metadata"].get("module") or DOCUMENT_MODULE.get(item["document_type"])
            boost = 0.25 if (target_modules and item["module"] in target_modules) else 0.0
            if item.get("document_type") == "radiologist_final_report" and _has(_normalized(query), {"result", "results", "report", "reports", "finding", "findings", "impression", "conclude", "conclusion", "final report"}):
                boost += 0.1
            if _has(_normalized(query), {"priority", "urgent", "high priority", "triage"}):
                if any(p in str(item.get("content", "")).lower() for p in ["priority: urgent", "priority level: high priority", "high priority", "urgent"]):
                    boost += 0.15
            if _has(_normalized(query), {"indication", "clinical indication"}):
                if "clinical indication:" in str(item.get("content", "")).lower() or "indication:" in str(item.get("content", "")).lower():
                    boost += 0.1
            if item.get("document_type") == "radiology_clarification":
                if _has(_normalized(query), {"clarification", "clarifications", "calrification", "calrifications", "thread", "threads", "message", "messages", "discuss", "chat"}):
                    boost += 0.35
                else:
                    boost -= 0.15
            if admission_id is not None:
                item_adm = item.get("admission_id") or item["metadata"].get("admission_id")
                if item_adm == admission_id or str(admission_id) in str(item.get("content", "")):
                    boost += 0.15
            score = round(min(1.0, 0.45*kw + 0.55*vec + (0.1 if item.get("is_verified") else 0) + boost), 4)
            item.update(relevance_score=score, keyword_score=round(kw, 4), similarity_score=round(vec, 4))
            results.append(item)
        results.sort(key=lambda x:x["relevance_score"],reverse=True)
        is_multi_domain = patient_id is not None and (
            comprehensive
            or _has(_normalized(query), {
                "why is this patient still admitted", "why still admitted", "why admitted", "reason for admission",
                "current condition", "summarize condition", "summarize this patient",
                "ready to discharge", "pending discharge", "discharge readiness"
            })
        )
        if is_multi_domain:
            selected=[]; seen=set()
            for item in results:
                if item["module"] not in seen: selected.append(item); seen.add(item["module"])
            ids={x["id"] for x in selected}; selected.extend(x for x in results if x["id"] not in ids)
            return selected[:max(limit,len(seen))], "authorized_module_balanced_hybrid"
        return results[:limit], "authorized_hybrid" if qemb else "authorized_keyword"


search_service = RagSearchService()
