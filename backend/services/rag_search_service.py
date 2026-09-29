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
    corrections = {"urget":"urgent", "requsts":"requests", "requset":"request", "pateint":"patient", "patinet":"patient", "discharget":"discharged"}
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

    def _secure_search(self, query, area, context, patient_id, admission_id, order_id,
                       accession_number, status_filter, limit, expanded_phrases=None,
                       conversation_history=None, query_plan=None):
        if context.role == "doctor" and patient_id is not None and patient_id not in (context.allowed_patient_ids or frozenset()):
            raise PermissionError(ACCESS_DENIED)
        conn = db_config.get_db_connection()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                kind, dimensions = self._plan(query, area, context.role)
                if kind == "doctor_flow": return self._doctor_flow(cur, context, dimensions)
                if kind == "doctor_patient_list": return self._doctor_patient_list(cur, context, dimensions)
                if kind == "doctor_radiology_worklist": return self._doctor_radiology_worklist(cur, context, dimensions)
                if kind == "doctor_ward_tasks": return self._doctor_ward_tasks(cur, context)
                if kind == "radiology_aggregate":
                    return self._radiology_aggregate(cur, context, dimensions, patient_id, order_id, accession_number)
                if (query_plan and query_plan.get("collection_request") and query_plan.get("intent") != "count"
                        and context.role in {"doctor", "admin", "hospital management"}):
                    return self._patient_collection(cur, context, query_plan)
                return self._documents(cur, query, area, context, patient_id, admission_id, order_id,
                                       accession_number, status_filter, limit, expanded_phrases, query_plan)
        finally: conn.close()

    def _plan(self, query: str, area: str, role: str):
        q = _normalized(query)
        count = _has(q, {"how many", "count", "counts", "total", "number of"})
        if role == "doctor":
            is_list = _has(q, {"list", "which patients", "which of my patients", "which of the patients", "who are", "who is", "show patients", "show my patients", "patient list", "my patients"}) or " names " in f" {q} " or (_has(q, {"which", "who", "show", "list"}) and _has(q, {"patient", "patients"}))
            blocked = _has(q, {"blocked from discharge", "discharge blocked", "blocked discharge", "pending discharge", "discharge clearance blocked"})
            if blocked and (is_list or "which" in q or "who" in q or "blocked" in q):
                dims = {"ip", "blocked_discharge", "names"}
                if _has(q, {"why", "reason", "balance", "clearance"}): dims.add("why")
                return "doctor_patient_list", dims

            # Radiology orders / reports for my patients (urgent or all)
            if _has(q, {"xray", "xrays", "x ray", "x rays", "radiology", "scan", "scans", "imaging"}):
                dims = set()
                if _has(q, {"urgent", "high priority", "priority", "stat"}):
                    dims.add("urgent")
                return "doctor_radiology_worklist", dims

            # Clinical tasks / doctor tasks / ward rounds
            if _has(q, {"ward round", "ward rounds", "doctor tasks", "doctor task", "pending orders", "clinical orders", "clinical tasks", "rounds"}):
                return "doctor_ward_tasks", set()

            # Abnormal / critical lab values or abnormal vitals
            if (is_list or _has(q, {"which", "who", "show"})) and (_has(q, {"abnormal", "critical", "out of range"}) and _has(q, {"lab", "labs", "value", "values", "vital", "vitals", "result", "results"})):
                return "doctor_patient_list", {"ip", "names", "abnormal", "location"}

            if is_list and _has(q, {"ip", "inpatient", "inpatients", "patient", "patients"}):
                dims = {"ip", "names"}
                if _has(q, {"basic details", "details", "patient details"}): dims.add("basic")
                if _has(q, {"bed", "beds", "ward", "wards", "room", "rooms", "location"}): dims.add("location")
                return "doctor_patient_list", dims
        if role == "doctor" and area == "doctor_workspace":
            dims = set()
            if _has(q, {"ip", "inpatient", "inpatients", "admitted patient", "admitted patients"}): dims.add("ip")
            if _has(q, {"op", "outpatient", "outpatients", "opd"}): dims.add("op")
            if _has(q, {"discharged", "discharge count"}): dims.add("discharged")
            if _has(q, {"er", "emergency", "emergency patients"}): dims.add("er")
            if count and dims: return "doctor_flow", dims
            if count and _has(q, {"patients", "patient flow", "my patients"}):
                return "doctor_flow", {"ip", "op", "discharged", "er"}
        if area == "radiology":
            dims = set()
            if _has(q, {"urgent", "routine", "priority", "priorities"}): dims.add("priority")
            if _has(q, {"department", "departments", "which department", "what department"}): dims.add("department")
            if _has(q, {"status", "pending", "requested", "uploaded", "reviewed"}): dims.add("status")
            categorize = _has(q, {"categorize", "categorise", "category", "breakdown", "group"})
            order_topic = _has(q, {"request", "requests", "order", "orders", "xray", "x ray", "worklist"})
            if count or categorize: dims.add("total")
            if categorize and not ({"department", "status"} & dims): dims.add("priority")
            if dims and (order_topic or categorize or "priority" in dims or "department" in dims):
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
            cur.execute("""SELECT COUNT(DISTINCT patient_id) total FROM appointments
                WHERE doctor_id IN (%s,%s) AND (booking_source='OPD_DESK' OR booking_id LIKE 'APT-2026-%%')""",
                (context.doctor_id, context.user_id))
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

    def _doctor_patient_list(self, cur, context, dimensions: Set[str]):
        fields = {"name"}
        if "basic" in dimensions: fields |= {"basic", "location"}
        if "location" in dimensions: fields.add("location")
        if "blocked_discharge" in dimensions or "why" in dimensions: fields.add("discharge")
        if "abnormal" in dimensions: fields |= {"abnormal", "vitals", "diagnosis", "location"}
        return self._patient_collection(cur, context, {
            "requested_fields": sorted(fields), "collection_patient_ids": [],
            "blocked_discharge": "blocked_discharge" in dimensions,
            "abnormal": "abnormal" in dimensions,
        })

    def _patient_collection(self, cur, context, plan):
        """Field-driven, structured collection retrieval inside one authorization scope."""
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
            if "admission" in fields:
                values.append(f"admission reason: {row.get('reason_for_admission') or 'not recorded'}")
            if "location" in fields:
                values.append(f"bed {row.get('bed_number') or 'not assigned'}, room {row.get('room_number') or 'not assigned'}, ward {row.get('ward_name') or 'not assigned'}")
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
        if "urgent" in dimensions:
            clauses.append("LOWER(ro.priority) IN ('urgent', 'stat', 'high', 'emergency')")
            clauses.append("LOWER(COALESCE(ro.status, '')) NOT IN ('finalized', 'completed', 'reviewed')")
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
            content = "No pending urgent or high-priority X-ray orders found for your admitted patients." if "urgent" in dimensions else "No X-ray orders or reports found for your admitted patients."
            return [self._source(context, "Doctor Radiology Worklist", content, "xray_order", "radiology_order",
                                 "radiology_orders", "authorized_doctor_radiology_worklist",
                                 {"module": "radiology_order", "count": 0})], "authorized_sql_list"
        lines = []
        patient_ids = []
        for i, r in enumerate(rows, 1):
            name = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip()
            lines.append(f"{i}. {name} (ID …{str(r.get('patient_code') or r['patient_id'])[-4:]}): {r.get('examination')} — Priority: {r.get('priority')}, Status: {r.get('status')}, Acc: #{r.get('accession_number')}")
            patient_ids.append(r["patient_id"])
        label = "Patients with Pending Urgent/Priority X-rays" if "urgent" in dimensions else "Patients with X-ray Orders / Reports"
        content = f"{label} ({len(rows)} orders):\n" + "\n".join(lines)
        return [self._source(context, label, content, "xray_order", "radiology_order",
                             "radiology_orders", "authorized_doctor_radiology_worklist",
                             {"module": "radiology_order", "count": len(rows), "patient_ids": patient_ids})], "authorized_sql_list"

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
        # The current HMS schema has no radiologist-to-order assignment table. A
        # global aggregate would leak workload and patient existence, so this path
        # remains closed until that authoritative ownership mapping is supplied.
        if context.role == "radiologist":
            return [], "empty_authorized_scope"
        clauses, params = ["1=1"], []
        if context.role == "doctor":
            allowed = sorted(context.allowed_patient_ids or ())
            if not allowed: return [], "empty_authorized_scope"
            clauses.append("o.patient_id=ANY(%s)"); params.append(allowed)
        if patient_id is not None: clauses.append("o.patient_id=%s"); params.append(patient_id)
        if order_id: clauses.append("o.order_id=%s"); params.append(str(order_id))
        if accession_number: clauses.append("o.accession_number=%s"); params.append(accession_number)
        where = " AND ".join(clauses)
        cur.execute(f"SELECT COUNT(*) total FROM radiology_orders o WHERE {where}", params)
        total = int((cur.fetchone() or {}).get("total") or 0)
        meta = {"module":"radiology_order", "record_id":"authorized_radiology_aggregate", "total":total}
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
            clauses.append("LOWER(COALESCE(metadata->>'department',''))=LOWER(%s)"); params.append(context.department)
        for clause, value in (("patient_id=%s",patient_id),("admission_id=%s",admission_id),("order_id=%s",str(order_id) if order_id else None),("accession_number=%s",accession_number)):
            if value is not None: clauses.append(clause); params.append(value)
        modules = {"radiology":{"radiology_order","radiology_ai","radiology_report","radiology_clarification"},
                   "discharge":{"ip","diagnosis","vitals","medications","lab","procedures","bill","radiology_report","discharge"}}.get(area)
        if modules:
            clauses.append("document_type=ANY(%s)"); params.append([k for k,v in DOCUMENT_MODULE.items() if v in modules])
        if status_filter: clauses.append("review_status ILIKE %s"); params.append(f"%{status_filter}%")
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
            score = round(min(1.0, 0.45*kw + 0.55*vec + (0.1 if item.get("is_verified") else 0) + boost), 4)
            item.update(relevance_score=score, keyword_score=round(kw, 4), similarity_score=round(vec, 4))
            results.append(item)
        results.sort(key=lambda x:x["relevance_score"],reverse=True)
        if comprehensive:
            selected=[]; seen=set()
            for item in results:
                if item["module"] not in seen: selected.append(item); seen.add(item["module"])
            ids={x["id"] for x in selected}; selected.extend(x for x in results if x["id"] not in ids)
            return selected[:max(limit,len(seen))], "authorized_module_balanced_hybrid"
        return results[:limit], "authorized_hybrid" if qemb else "authorized_keyword"


search_service = RagSearchService()
