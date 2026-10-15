"""Read-only AG-21 executive aggregation over existing persisted workflows."""
from datetime import datetime, timezone
from typing import Any

import psycopg2.extras

import db_config


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else value


def _latest_timestamp(rows, *fields):
    values = [r.get(field) for r in rows for field in fields if r.get(field) is not None]
    return _iso(max(values)) if values else None


def _provenance(module, tables, fields, rule, rows, now, *, timestamp_fields=()):
    return {"source_module":module,"source_tables":tables,"fields":fields,"filter_description":rule,
            "record_count":len(rows),"latest_source_timestamp":_latest_timestamp(rows,*timestamp_fields),
            "calculated_at":now.isoformat(),"data_status":"AVAILABLE","data_origin":"PERSISTED_DATABASE",
            "synthetic_values_used":False}


def _run_section(fn):
    try:
        return fn()
    except Exception:
        return {"data_status": "UNAVAILABLE", "reason": "Source data unavailable"}


def _query(sql: str, params=None):
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            return [dict(row) for row in cur.fetchall()]


def queue_summary(now: datetime):
    rows = _query("""
        SELECT qs.id AS session_id, qs.department_id, qs.status AS session_status,
               qe.id AS entry_id, qe.queue_status, qe.checked_in_at,
               qe.called_at, qe.consultation_started_at, qe.consultation_completed_at
        FROM queue_sessions qs
        LEFT JOIN queue_entries qe ON qe.queue_session_id = qs.id
        WHERE qs.queue_date = CURRENT_DATE
        ORDER BY qs.id, qe.checked_in_at NULLS LAST
    """)
    metrics = {key: 0 for key in ("waiting", "next", "called", "in_consultation", "completed", "cancelled", "no_show")}
    session_states = {}
    dept = {}
    candidates = []
    for row in rows:
        session_states[row["session_id"]] = row["session_status"]
        status = row.get("queue_status")
        if status:
            field = {"WAITING":"waiting", "NEXT":"next", "CALLED":"called", "IN_CONSULTATION":"in_consultation", "COMPLETED":"completed", "CANCELLED":"cancelled", "NO_SHOW":"no_show"}.get(status)
            if field:
                metrics[field] += 1
                did = row.get("department_id")
                if did is not None:
                    item = dept.setdefault(str(did), {"department_id": did, "waiting": 0, "next": 0, "called": 0, "in_consultation": 0})
                    if field in item:
                        item[field] += 1
            if status in {"WAITING", "NEXT", "CALLED"} and row.get("checked_in_at"):
                checked = row["checked_in_at"]
                if checked.tzinfo is None:
                    checked = checked.replace(tzinfo=timezone.utc)
                candidates.append({"entry_id": row["entry_id"], "department_id": row["department_id"], "checked_in_at": checked,
                                   "age_minutes": max(0, round((now - checked).total_seconds()/60, 1)), "status": status})
    oldest = max(candidates, key=lambda x: x["age_minutes"], default=None)
    if oldest:
        oldest["checked_in_at"] = _iso(oldest["checked_in_at"])
    waiting_rows = [r for r in rows if r.get("queue_status") == "WAITING"]
    metrics["waiting_provenance"] = _provenance("AG-06 Queue", ["queue_sessions","queue_entries"], ["queue_date","queue_status"],
        "queue_sessions.queue_date = current date AND persisted queue_entries.queue_status = WAITING; checked_in_at is not required", waiting_rows, now, timestamp_fields=("checked_in_at",))
    return {"data_status":"AVAILABLE", "as_of":now.isoformat(), "source":{"module":"AG-06 Queue", "tables":["queue_sessions","queue_entries"]},
            "metrics":{**metrics, "active_sessions":sum(1 for x in session_states.values() if x == "ACTIVE"),
                       "paused_sessions":sum(1 for x in session_states.values() if x == "PAUSED"),
                       "longest_current_wait":oldest, "department_counts":list(dept.values())}}


def follow_up_summary(now: datetime):
    tasks = _query("""
        SELECT id, plan_id, patient_id, due_date, status, followup_day,
               sent_at, delivered_at, completed_at, created_at
        FROM ag11_followup_tasks
    """)
    today = now.date()
    task_counts = {k:0 for k in ("due_today","overdue","completed","pending","failed")}
    for r in tasks:
        st = str(r["status"] or "").upper()
        due = r.get("due_date")
        if due and due.date() == today and st not in {"COMPLETED","CANCELLED"}: task_counts["due_today"] += 1
        if due and due < now and st not in {"COMPLETED","CANCELLED"}: task_counts["overdue"] += 1
        if st == "COMPLETED": task_counts["completed"] += 1
        if st in {"SCHEDULED","SENT","DELIVERED"}: task_counts["pending"] += 1
        if st == "FAILED": task_counts["failed"] += 1
    callbacks = _query("SELECT id, priority, status, created_at, acknowledged_at, completed_at FROM ag11_callbacks")
    pending_callbacks = [r for r in callbacks if str(r["status"]).upper() in {"PENDING","IN_PROGRESS"}]
    callback_priority = {}
    for r in pending_callbacks:
        key = str(r.get("priority") or "UNKNOWN")
        callback_priority[key] = callback_priority.get(key, 0) + 1
    callback_provenance = _provenance("AG-11 Follow-up", ["ag11_callbacks"], ["status", "priority"],
        "status IN (PENDING, IN_PROGRESS)", pending_callbacks, now, timestamp_fields=("created_at",))
    urgent_callbacks = [r for r in pending_callbacks if str(r.get("priority") or "").strip().upper() == "URGENT"]
    urgent_callback_provenance = _provenance("AG-11 Follow-up", ["ag11_callbacks"], ["status", "priority"],
        "status IN (PENDING, IN_PROGRESS) AND persisted priority = URGENT (case-insensitive comparison)", urgent_callbacks, now, timestamp_fields=("created_at",))
    escalations = _query("SELECT id, severity, status, created_at, acknowledged_at, resolved_at FROM ag11_clinical_escalations")
    opened = [r for r in escalations if str(r["status"]).upper() in {"OPEN","ACKNOWLEDGED"}]
    severity = {}
    for r in opened:
        key = str(r.get("severity") or "UNKNOWN")
        severity[key] = severity.get(key, 0) + 1
    overdue_rows = [r for r in tasks if r.get("due_date") and r["due_date"] < now and str(r.get("status") or "").upper() not in {"COMPLETED","CANCELLED"}]
    escalation_rows = [r for r in escalations if str(r.get("status") or "").upper() in {"OPEN","ACKNOWLEDGED"}]
    task_counts["overdue_provenance"] = _provenance("AG-11 Follow-up", ["ag11_followup_tasks"], ["due_date","status"],
        "due_date < calculation time AND status NOT IN (COMPLETED, CANCELLED)", overdue_rows, now, timestamp_fields=("due_date",))
    escalation_provenance = _provenance("AG-11 Clinical Escalations", ["ag11_clinical_escalations"], ["status"],
        "status IN (OPEN, ACKNOWLEDGED)", escalation_rows, now, timestamp_fields=("created_at",))
    return {"data_status":"AVAILABLE", "as_of":now.isoformat(), "source":{"module":"AG-11 Follow-up", "tables":["ag11_followup_tasks","ag11_callbacks","ag11_clinical_escalations"]},
            "metrics":{**task_counts,"pending_callbacks":len(pending_callbacks),"callbacks_by_priority":callback_priority,
                       "pending_callbacks_provenance":callback_provenance,
                       "urgent_pending_callbacks":len(urgent_callbacks),"urgent_pending_callbacks_provenance":urgent_callback_provenance,
                       "open_clinical_escalations":len(opened),"open_clinical_escalations_provenance":escalation_provenance,"escalations_by_severity":severity}}


def feedback_summary(now: datetime):
    rows = _query("""
        SELECT id, rating, sentiment, requires_action, severity, status, created_at, resolved_at, updated_at
        FROM patient_feedback
    """)
    ratings = [float(r["rating"]) for r in rows if r.get("rating") is not None]
    statuses = [str(r.get("status") or "").upper() for r in rows]
    sentiments = [str(r.get("sentiment") or "").upper() for r in rows]
    high = [r for r in rows if str(r.get("severity") or "").upper() in {"HIGH","CRITICAL"}]
    unresolved_high = [r for r in high if str(r.get("status") or "").upper() not in {"RESOLVED","CLOSED"}]
    actionable = [r for r in rows if r.get("requires_action") and str(r.get("status") or "").upper() in {"OPEN","IN_PROGRESS"}]
    action_provenance = _provenance("Feedback / Service Recovery", ["patient_feedback"], ["requires_action","status"],
        "requires_action = true AND status IN (OPEN, IN_PROGRESS); resolved/closed records excluded", actionable, now, timestamp_fields=("created_at","updated_at"))
    return {"data_status":"AVAILABLE", "as_of":now.isoformat(), "sentiment_note":"Sentiment is the stored system/AI classification.",
            "source":{"module":"Feedback / Service Recovery", "table":"patient_feedback"},
            "metrics":{"total_feedback":len(rows),"average_recorded_rating":round(sum(ratings)/len(ratings),2) if ratings else None,
                       "positive":sentiments.count("POSITIVE"),"neutral":sentiments.count("NEUTRAL"),"negative":sentiments.count("NEGATIVE"),
                       "requiring_action":len(actionable),"requiring_action_provenance":action_provenance,"open":statuses.count("OPEN"),
                       "in_progress":statuses.count("IN_PROGRESS"),"resolved":statuses.count("RESOLVED"),
                       "high_severity":len(high),"unresolved_high_severity":len(unresolved_high)}}


def diagnostics_summary(now: datetime):
    orders = _query("""
        SELECT order_id, accession_number, patient_id, examination, priority, status, created_at
        FROM radiology_orders
        WHERE examination ILIKE 'Chest X-ray%%'
    """)
    studies = _query("""
        SELECT a.study_key, a.order_id, a.projection, a.status, a.upload_started_at, a.uploaded_at,
               o.priority, o.created_at AS order_created_at
        FROM radiology_order_studies a JOIN radiology_orders o ON o.order_id=a.order_id
        WHERE o.examination ILIKE 'Chest X-ray%%'
    """)
    pending = [r for r in studies if r.get("status") == "Requested"]
    oldest = min(pending, key=lambda r:r.get("order_created_at") or now, default=None)
    requested_orders = [r for r in orders if r.get("status") == "Requested"]
    return {"data_status":"AVAILABLE","as_of":now.isoformat(),"label":"X-ray workflow",
            "source":{"module":"AG-10 / Radiology","tables":["radiology_orders","radiology_order_studies"]},
            "metrics":{"total_xray_orders":len(orders),"requested_orders":len(requested_orders),
                       "requested_orders_provenance":_provenance("AG-10 / Radiology", ["radiology_orders"], ["examination","status"],
                           "examination ILIKE 'Chest X-ray%' AND exact persisted order status = Requested; order-level count", requested_orders, now, timestamp_fields=("created_at",)),
                       "uploading_orders":sum(1 for r in orders if r.get("status")=="Uploading"),"uploaded_orders":sum(1 for r in orders if r.get("status")=="Uploaded"),
                       "routine_orders":sum(1 for r in orders if r.get("priority")=="Routine"),"urgent_orders":sum(1 for r in orders if r.get("priority")=="Urgent"),
                       "projection_count":len(studies),"pending_acquisition_projections":sum(1 for r in studies if r.get("status")=="Requested"),
                       "uploading_projections":sum(1 for r in studies if r.get("status")=="Uploading"),
                       "oldest_requested":{"order_id":str(oldest["order_id"]),"study_key":str(oldest["study_key"]),"projection":oldest["projection"],"created_at":_iso(oldest["order_created_at"])} if oldest else None}}


def radiology_summary(now: datetime):
    rows = _query("""
        SELECT rs.scan_id, rs.order_id, rs.order_study_id, o.priority,
               rs.review_status, rs.reviewed_at, rs.created_at
        FROM radiology_scan rs
        JOIN radiology_orders o ON o.order_id=rs.order_id
        WHERE rs.order_id IS NOT NULL
    """)
    # Only order-linked studies are included. A persisted review timestamp is authoritative completion evidence.
    awaiting = [r for r in rows if not r.get("reviewed_at")]
    reviewed = [r for r in rows if r.get("reviewed_at")]
    distribution = {}
    for r in rows:
        key = str(r.get("review_status") or "UNKNOWN")
        distribution[key] = distribution.get(key,0)+1
    oldest = min(awaiting,key=lambda r:r.get("created_at") or now,default=None)
    return {"data_status":"AVAILABLE","as_of":now.isoformat(),"source":{"module":"Radiology","table":"radiology_scan"},
            "metrics":{"studies_awaiting_review":len(awaiting),"studies_awaiting_review_provenance":_provenance("Radiology", ["radiology_scan","radiology_orders"], ["reviewed_at","order_id"],
                           "radiology_scan joined to linked radiology_orders where reviewed_at IS NULL", awaiting, now, timestamp_fields=("created_at",)),"reviewed_studies":len(reviewed),"review_status_distribution":distribution,
                       "priority_breakdown":{p:sum(1 for r in rows if r.get("priority")==p) for p in ("Routine","Urgent")},
                       "oldest_awaiting_review":{"scan_id":oldest["scan_id"],"order_id":str(oldest["order_id"]),"order_study_id":str(oldest["order_study_id"]),"created_at":_iso(oldest["created_at"])} if oldest else None}}


def discharge_summary(now: datetime):
    # Use persisted generated summaries only: the discharge candidate endpoint enriches missing values with defaults.
    rows = _query("""
        SELECT summary_id, admission_id, patient_id, approval_status
        FROM dim_generated_discharge_summaries
        WHERE approval_status IS NOT NULL
    """)
    statuses = [str(r.get("approval_status") or "").strip().upper() for r in rows]
    eligible = sum(1 for s in statuses if s in {"APPROVED","READY","ELIGIBLE"})
    blocked = sum(1 for s in statuses if s in {"PENDING APPROVAL","PENDING","BLOCKED","NOT ELIGIBLE"})
    return {"data_status":"PARTIAL","as_of":now.isoformat(),"mode":"current persisted summary state only",
            "source":{"module":"AG-09 Discharge","table":"dim_generated_discharge_summaries"},
            "metrics":{"summaries_evaluated":len(rows),"eligible_current_status":eligible,"blocked_current_status":blocked,
                       "summaries_evaluated_provenance":_provenance("AG-09 Discharge", ["dim_generated_discharge_summaries"], ["approval_status"],
                           "approval_status IS NOT NULL; counts persisted generated discharge-summary rows only", rows, now),
                       "eligible_current_status_provenance":_provenance("AG-09 Discharge", ["dim_generated_discharge_summaries"], ["approval_status"],
                           "approval_status IN (APPROVED, READY, ELIGIBLE) among rows where approval_status IS NOT NULL", [r for r in rows if str(r.get("approval_status") or "").strip().upper() in {"APPROVED","READY","ELIGIBLE"}], now),
                       "blocked_current_status_provenance":_provenance("AG-09 Discharge", ["dim_generated_discharge_summaries"], ["approval_status"],
                           "approval_status IN (PENDING APPROVAL, PENDING, BLOCKED, NOT ELIGIBLE) among rows where approval_status IS NOT NULL", [r for r in rows if str(r.get("approval_status") or "").strip().upper() in {"PENDING APPROVAL","PENDING","BLOCKED","NOT ELIGIBLE"}], now),
                       "gate_failure_categories":None},
            "limitations":["This is a count of persisted generated summaries, not all active admissions.","No discharge delay or ready-since duration is inferred."]}


def executive_summary():
    now = datetime.now(timezone.utc)
    sections = {"queue":queue_summary,"follow_up":follow_up_summary,"feedback":feedback_summary,
                "diagnostics":diagnostics_summary,"radiology":radiology_summary,"discharge":discharge_summary}
    result = {name:_run_section(lambda fn=fn: fn(now)) for name,fn in sections.items()}
    statuses = [section.get("data_status") for section in result.values()]
    result["generated_at"] = now.isoformat()
    result["data_status"] = "UNAVAILABLE" if all(s == "UNAVAILABLE" for s in statuses) else ("PARTIAL" if any(s != "AVAILABLE" for s in statuses) else "AVAILABLE")
    return result


def _age_minutes(now: datetime, timestamp):
    if timestamp is None:
        return None
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return max(0, round((now - timestamp).total_seconds() / 60, 1))


def _bottleneck(source_agent, category, title, record_id, source_table, timestamp,
                now, summary, *, source_status=None, source_priority=None, display_rank=4, evidence=None, age_anchor=None):
    observed = _iso(timestamp)
    age = _age_minutes(now, age_anchor if age_anchor is not None else timestamp)
    return {
        "bottleneck_id": f"AG21-{category}-{record_id}",
        "source_agent": source_agent,
        "category": category,
        "title": title,
        "source_status": source_status,
        "feed_state": "ACTIVE",
        "source_priority": source_priority,
        "display_rank": display_rank,
        "age_minutes": age,
        "summary": summary,
        "source_record_id": str(record_id),
        "source_timestamp": observed,
        "observed_at": now.isoformat(),
        "evidence": {
            "source_agent": source_agent,
            "source_table": source_table,
            "source_record_id": str(record_id),
            "source_status": source_status,
            "source_priority": source_priority,
            "source_timestamp": observed,
            "timestamp_used_for_age": _iso(age_anchor if age_anchor is not None else timestamp),
            "feed_state": "ACTIVE",
            "bottleneck_id": f"AG21-{category}-{record_id}",
            "category": category,
            "source_status": source_status,
            "source_priority": source_priority,
            "display_rank": display_rank,
            "age_minutes": age,
            "observed_at": now.isoformat(),
            "calculation": {"QUEUE":"now - checked_in_at", "FOLLOWUP":"now - due_date"}.get(category, "now - source_timestamp"),
            **(evidence or {}),
        },
    }


def _source_result(fn):
    try:
        return "AVAILABLE", fn()
    except Exception:
        return "UNAVAILABLE", []


def _queue_bottlenecks(now):
    rows = _query("""
        SELECT qe.id AS entry_id, qe.patient_id, qe.department_id, qe.doctor_id,
               qe.queue_status, qe.checked_in_at
        FROM queue_entries qe
        JOIN queue_sessions qs ON qs.id=qe.queue_session_id
        WHERE qs.queue_date=CURRENT_DATE
          AND qe.queue_status IN ('WAITING','NEXT','CALLED')
        ORDER BY qe.checked_in_at ASC NULLS FIRST
    """)
    items = []
    for row in rows:
        checked = row.get("checked_in_at")
        if checked is None:
            continue
        age = _age_minutes(now, checked)
        items.append(_bottleneck(
            "AG-06", "QUEUE", "Queue item waiting", row["entry_id"], "queue_entries", checked, now,
            f"This queue entry has been waiting for {age:g} minutes since recorded check-in.",
            source_status=row.get("queue_status"), display_rank=4, age_anchor=checked,
            evidence={"department_id":row.get("department_id"),"doctor_id":row.get("doctor_id"),
                      "queue_status":row.get("queue_status"),"checked_in_at":_iso(checked)},
        ))
        items[-1]["evidence"]["patient_id"] = row.get("patient_id")
    return items


def queue_waiting_details(now: datetime, *, department=None, doctor=None, limit=10):
    """Read privacy-minimized details for current WAITING queue entries."""
    rows = _query("""
        SELECT qe.id AS entry_id, qe.patient_id, qe.token_number, qe.queue_status,
               qe.checked_in_at, qe.called_at, qe.consultation_started_at,
               qe.department_id, dep.department_name,
               qe.doctor_id, doc.display_name AS doctor_name,
               p.first_name, p.last_name
        FROM queue_entries qe
        JOIN queue_sessions qs ON qs.id = qe.queue_session_id
        LEFT JOIN patients p ON p.id = qe.patient_id
        LEFT JOIN doctors doc ON doc.id = qe.doctor_id
        LEFT JOIN departments dep ON dep.id = qe.department_id
        WHERE qs.queue_date = CURRENT_DATE
          AND qe.queue_status = 'WAITING'
          AND (%s IS NULL OR dep.department_name ILIKE %s)
          AND (%s IS NULL OR doc.display_name ILIKE %s)
        ORDER BY qe.checked_in_at ASC NULLS LAST, qe.id ASC
        LIMIT %s
    """, (department, f"%{department}%" if department else None,
          doctor, f"%{doctor}%" if doctor else None, max(1, min(int(limit), 10))))
    results = []
    for row in rows:
        checked = row.get("checked_in_at")
        if checked and checked.tzinfo is None:
            checked = checked.replace(tzinfo=timezone.utc)
        first, last = row.get("first_name"), row.get("last_name")
        patient = f"{first} {last[0]}." if first and last else None
        age = max(0, round((now - checked).total_seconds() / 60)) if checked else None
        results.append({
            "source_record_id": str(row["entry_id"]),
            "patient_display": patient or "Unavailable",
            "department": row.get("department_name") or "Unavailable",
            "doctor": row.get("doctor_name") or ("Not assigned" if row.get("doctor_id") is None else "Unavailable"),
            "token": f"Q-{row['token_number']:03d}" if row.get("token_number") is not None else "Unavailable",
            "source_status": row.get("queue_status") or "Unavailable",
            "checked_in_at": _iso(checked),
            "called_at": _iso(row.get("called_at")),
            "consultation_started_at": _iso(row.get("consultation_started_at")),
            "age_minutes": age,
            "source_module": "AG-06",
            "source_table": "queue_entries",
            "source_timestamp": _iso(checked),
            "evidence": {"department": row.get("department_name") or "Unavailable",
                         "doctor": row.get("doctor_name") or ("Not assigned" if row.get("doctor_id") is None else "Unavailable"),
                         "token": f"Q-{row['token_number']:03d}" if row.get("token_number") is not None else "Unavailable",
                         "queue_status": row.get("queue_status"), "checked_in_at": _iso(checked),
                         "called_at": _iso(row.get("called_at")),
                         "consultation_started_at": _iso(row.get("consultation_started_at")),
                         "source_table": "queue_entries"},
        })
    return results


def queue_waiting_count(*, department=None, doctor=None):
    rows = _query("""
        SELECT COUNT(*) AS waiting_count
        FROM queue_entries qe
        JOIN queue_sessions qs ON qs.id = qe.queue_session_id
        LEFT JOIN doctors doc ON doc.id = qe.doctor_id
        LEFT JOIN departments dep ON dep.id = qe.department_id
        WHERE qs.queue_date = CURRENT_DATE
          AND qe.queue_status = 'WAITING'
          AND (%s IS NULL OR dep.department_name ILIKE %s)
          AND (%s IS NULL OR doc.display_name ILIKE %s)
    """, (department, f"%{department}%" if department else None,
          doctor, f"%{doctor}%" if doctor else None))
    return int(rows[0]["waiting_count"]) if rows else 0


def queue_department_waiting_counts():
    return _query("""
        SELECT dep.department_name, COUNT(*) AS waiting
        FROM queue_entries qe
        JOIN queue_sessions qs ON qs.id = qe.queue_session_id
        LEFT JOIN departments dep ON dep.id = qe.department_id
        WHERE qs.queue_date = CURRENT_DATE AND qe.queue_status = 'WAITING'
        GROUP BY dep.department_name
        ORDER BY waiting DESC, dep.department_name ASC
    """)


def _followup_bottlenecks(now):
    rows = _query("""
        SELECT id, plan_id, patient_id, due_date, status, followup_day
        FROM ag11_followup_tasks
        WHERE due_date < %s AND status NOT IN ('COMPLETED','CANCELLED')
        ORDER BY due_date ASC
    """, (now,))
    items = []
    for row in rows:
        due = row.get("due_date")
        age = _age_minutes(now, due)
        item = _bottleneck("AG-11", "FOLLOWUP", "Follow-up task overdue", row["id"],
                           "ag11_followup_tasks", due, now,
                           f"This follow-up task is {age:g} minutes past its recorded due time.",
                           source_status=row.get("status"), display_rank=4, age_anchor=due,
                           evidence={"plan_id":row.get("plan_id"),"patient_id":row.get("patient_id"),
                                     "status":row.get("status"),"followup_day":row.get("followup_day"),
                                     "due_date":_iso(due)})
        items.append(item)
    return items


def _severity_rank(value):
    return {"CRITICAL":1,"HIGH":2}.get(str(value or "").upper(),4)


def _classify_xray_origin(study_key, order_id, projection):
    # The legacy backfill generated MD5(order_id || ':' || projection) UUID keys for PA/AP rows.
    # Any nonmatching key is still not sufficient proof of a source acquisition event.
    import hashlib
    from uuid import UUID
    try:
        expected = UUID(hashlib.md5(f"{order_id}:{projection}".encode()).hexdigest())
        if str(study_key) == str(expected):
            return "MIGRATION_OR_BACKFILL"
    except (TypeError, ValueError):
        pass
    return "ORIGIN_UNKNOWN"


def _escalation_bottlenecks(now):
    rows = _query("""
        SELECT id, patient_id, severity, status, assigned_team, assigned_to_user_id,
               created_at, acknowledged_at
        FROM ag11_clinical_escalations
        WHERE status IN ('OPEN','ACKNOWLEDGED')
        ORDER BY created_at ASC
    """)
    items = []
    for row in rows:
        created = row.get("created_at")
        severity = row.get("severity")
        item = _bottleneck("AG-11", "ESCALATION", "Clinical escalation open", row["id"],
                           "ag11_clinical_escalations", created, now,
                           f"A clinical escalation remains {str(row.get('status') or '').lower()}.",
                           source_status=row.get("status"), source_priority=severity, display_rank=_severity_rank(severity),
                           evidence={"patient_id":row.get("patient_id"),"severity":severity,"status":row.get("status"),
                                     "assigned_team":row.get("assigned_team"),"assigned_to_user_id":row.get("assigned_to_user_id"),
                                     "acknowledged_at":_iso(row.get("acknowledged_at"))})
        items.append(item)
    return items


def _callback_bottlenecks(now):
    rows = _query("""
        SELECT id, patient_id, priority, status, assigned_to_user_id,
               created_at, acknowledged_at, completed_at
        FROM ag11_callbacks
        WHERE status IN ('PENDING','IN_PROGRESS')
        ORDER BY created_at ASC
    """)
    items = []
    for row in rows:
        created = row.get("created_at")
        priority = row.get("priority")
        item = _bottleneck("AG-11", "CALLBACK", "Callback pending", row["id"],
                           "ag11_callbacks", created, now,
                           f"This callback remains {str(row.get('status') or '').lower()}.",
                           source_status=row.get("status"), source_priority=priority,
                           display_rank=3 if str(priority or "").upper() == "URGENT" else 4,
                           evidence={"patient_id":row.get("patient_id"),"priority":priority,"status":row.get("status"),
                                     "assigned_to_user_id":row.get("assigned_to_user_id"),
                                     "acknowledged_at":_iso(row.get("acknowledged_at")),
                                     "completed_at":_iso(row.get("completed_at"))})
        items.append(item)
    return items


def _feedback_bottlenecks(now):
    rows = _query("""
        SELECT id, rating, sentiment, categories, issues, severity, status,
               original_feedback, ai_summary, resolution_notes, resolved_at,
               assigned_to_user_id, created_at, updated_at
        FROM patient_feedback
        WHERE requires_action=TRUE AND status IN ('OPEN','IN_PROGRESS')
        ORDER BY created_at ASC
    """)
    items = []
    for row in rows:
        created = row.get("created_at")
        severity = row.get("severity")
        item = _bottleneck("Feedback", "FEEDBACK", "Feedback requires action", row["id"],
                           "patient_feedback", created, now,
                           "This feedback record requires action and remains unresolved.",
                           source_status=row.get("status"), source_priority=severity, display_rank=_severity_rank(severity),
                           evidence={"severity":severity,"status":row.get("status"),"rating":row.get("rating"),
                                     "sentiment":row.get("sentiment"),"categories":row.get("categories"),
                                     "original_feedback":row.get("original_feedback"),"ai_summary":row.get("ai_summary"),
                                     "issues":row.get("issues"),"resolution_notes":row.get("resolution_notes"),
                                     "created_at":_iso(row.get("created_at")),
                                     "resolved_at":_iso(row.get("resolved_at")),
                                     "assigned_to_user_id":row.get("assigned_to_user_id"),
                                     "updated_at":_iso(row.get("updated_at"))})
        items.append(item)
    return items


def _xray_bottlenecks(now):
    rows = _query("""
        SELECT a.study_key, a.order_id, a.projection, a.status AS projection_status,
               a.upload_started_at, a.uploaded_at, o.accession_number, o.patient_id,
               o.examination, o.priority, o.status AS order_status, o.created_at
        FROM radiology_order_studies a
        JOIN radiology_orders o ON o.order_id=a.order_id
        WHERE o.examination ILIKE 'Chest X-ray%%'
          AND a.status IN ('Requested','Uploading')
        ORDER BY CASE WHEN o.priority='Urgent' THEN 0 ELSE 1 END, o.created_at ASC
    """)
    items = []
    for row in rows:
        created = row.get("upload_started_at") if row.get("projection_status") == "Uploading" else row.get("created_at")
        priority = row.get("priority")
        title = "Urgent X-ray acquisition pending" if priority == "Urgent" else "X-ray acquisition pending"
        age = _age_minutes(now, created)
        item = _bottleneck("AG-10", "XRAY", title, row["study_key"],
                           "radiology_order_studies", created, now,
                           f"This X-ray projection remains {str(row.get('projection_status')).lower()}.",
                           source_status=row.get("projection_status"), source_priority=priority, display_rank=3 if priority == "Urgent" else 4,
                           age_anchor=created,
                           evidence={"order_id":str(row.get("order_id")),"study_key":str(row.get("study_key")),
                                     "accession_number":row.get("accession_number"),"patient_id":row.get("patient_id"),
                                     "examination":row.get("examination"),"priority":priority,
                                     "order_status":row.get("order_status"),"projection":row.get("projection"),
                                     "projection_status":row.get("projection_status"),
                                     "created_at":_iso(row.get("created_at")),
                                     "upload_started_at":_iso(row.get("upload_started_at")),
                                     "source_origin":_classify_xray_origin(row.get("study_key"), row.get("order_id"), row.get("projection"))})
        items.append(item)
    return items


def _radiology_review_bottlenecks(now):
    rows = _query("""
        SELECT rs.scan_id, rs.study_id, rs.order_id, rs.order_study_id,
               rs.review_status, rs.reviewed_at, rs.created_at,
               o.accession_number, o.patient_id, o.priority
        FROM radiology_scan rs
        JOIN radiology_orders o ON o.order_id=rs.order_id
        WHERE rs.order_id IS NOT NULL
          AND COALESCE(rs.review_status,'') NOT IN
               ('Reviewed','Confirmed','No acute finding','Finding not confirmed','Finding Not Confirmed',
                'Confirmed (Finding Revised)','Confirm AI Finding')
        ORDER BY rs.created_at ASC
    """)
    items = []
    for row in rows:
        created = row.get("created_at")
        priority = row.get("priority")
        study_id = row.get("study_id") or row.get("order_study_id") or row.get("scan_id")
        item = _bottleneck("Radiology", "RADIOLOGY_REVIEW", "X-ray study awaiting radiologist review",
                           study_id, "radiology_scan", created, now,
                           "This analyzed X-ray study has not reached a persisted completed review state.",
                           source_status=row.get("review_status"), source_priority=priority, display_rank=3 if priority == "Urgent" else 4,
                           evidence={"scan_id":row.get("scan_id"),"order_id":str(row.get("order_id")),
                                     "order_study_id":str(row.get("order_study_id")),
                                     "accession_number":row.get("accession_number"),"patient_id":row.get("patient_id"),
                                     "review_status":row.get("review_status"),"priority":priority,
                                     "reviewed_at":_iso(row.get("reviewed_at"))})
        items.append(item)
    return items


MANAGEMENT_CATEGORY_BY_SOURCE = {
    "QUEUE": "QUEUE",
    "FOLLOWUP": "FOLLOW_UP",
    "ESCALATION": "ESCALATIONS_CALLBACKS",
    "CALLBACK": "ESCALATIONS_CALLBACKS",
    "FEEDBACK": "FEEDBACK",
    "XRAY": "XRAY_DIAGNOSTICS",
    "RADIOLOGY_REVIEW": "RADIOLOGY_REVIEW",
}


def bottleneck_feed(*, category=None, management_category=None, source_agent=None, priority=None,
                    page=1, page_size=None, limit=None):
    now = datetime.now(timezone.utc)
    sources = {
        "queue":_queue_bottlenecks,
        "follow_up":_followup_bottlenecks,
        "escalations":_escalation_bottlenecks,
        "callbacks":_callback_bottlenecks,
        "feedback":_feedback_bottlenecks,
        "xray":_xray_bottlenecks,
        "radiology":_radiology_review_bottlenecks,
    }
    source_status = {}
    items = []
    for source, fn in sources.items():
        status, source_items = _source_result(lambda fn=fn: fn(now))
        source_status[source] = status
        items.extend(source_items)

    rank_order = {"CRITICAL":1,"HIGH":2,"URGENT":3}
    for item in items:
        raw_priority = str(item.get("source_priority") or "").upper()
        if raw_priority in rank_order:
            item["display_rank"] = rank_order[raw_priority]
        item["management_category"] = MANAGEMENT_CATEGORY_BY_SOURCE.get(item.get("category"), "OTHER")
    total_active = len(items)

    # Keep source_agent and priority filters independent of the selected category so
    # category chips continue to show comparable counts under the active priority.
    if source_agent:
        wanted_agent = source_agent.strip().casefold()
        items = [item for item in items if item["source_agent"].casefold() == wanted_agent]
    available_priorities = sorted({item.get("source_priority") for item in items if item.get("source_priority")})
    if priority:
        wanted_priority = priority.strip().casefold()
        items = [item for item in items if str(item.get("source_priority") or "").casefold() == wanted_priority]

    category_counts = {key: 0 for key in (
        "ALL", "QUEUE", "FOLLOW_UP", "ESCALATIONS_CALLBACKS", "FEEDBACK", "XRAY_DIAGNOSTICS", "RADIOLOGY_REVIEW"
    )}
    for item in items:
        category_counts["ALL"] += 1
        category_counts[item["management_category"]] = category_counts.get(item["management_category"], 0) + 1
    selected_category = management_category or category
    if selected_category:
        wanted = selected_category.strip().upper()
        source_categories = {"FOLLOWUP", "ESCALATION", "CALLBACK", "XRAY", "RADIOLOGY_REVIEW", "FEEDBACK", "QUEUE"}
        if wanted in source_categories:
            items = [item for item in items if item["category"].upper() == wanted]
        else:
            items = [item for item in items if item["management_category"] == wanted]

    items.sort(key=lambda item: (item.get("display_rank",4), -(item.get("age_minutes") if item.get("age_minutes") is not None else -1)))
    filtered_total = len(items)
    requested_page_size = page_size if page_size is not None else (limit if limit is not None else 20)
    page_size = max(1, min(int(requested_page_size), 500))
    total_pages = (filtered_total + page_size - 1) // page_size
    page = max(1, min(int(page), max(1, total_pages)))
    start = (page - 1) * page_size
    items = items[start:start + page_size]
    available = sum(1 for state in source_status.values() if state == "AVAILABLE")
    data_status = "UNAVAILABLE" if available == 0 else ("PARTIAL" if available != len(source_status) else "AVAILABLE")
    return {"generated_at":now.isoformat(),"data_status":data_status,"total_active":total_active,
            "filtered_total":filtered_total,"page":page,"page_size":page_size,"total_pages":total_pages,
            "category_counts":category_counts,"available_priorities":available_priorities,
            "source_status":source_status,"items":items}
