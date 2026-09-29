"""Durable radiology results, keyed by their uploaded X-ray order.

No synthetic images, random patient mappings, or process-local worklist state.
"""
import json
from datetime import datetime
import psycopg2.extras
from fastapi import HTTPException
from radiology_ai.db import get_connection


def _record(row):
    if not row or not row.get('dl_response'):
        return None
    value = row['dl_response']
    record = json.loads(value) if isinstance(value, str) else dict(value)
    record.update(patient_id=row['patient_id'], patient_code=row['patient_code'],
                  patient_name=row['patient_name'], order_id=str(row['order_id']),
                  display_study_id=row['accession_number'], projection=row.get('projection'))
    for key in ('review_status', 'reviewed_by', 'reviewed_at', 'radiologist_finding', 'scan_report', 'viewed', 'viewed_at'):
        if row.get(key) is not None:
            value = row[key]
            record[key] = value.isoformat() if isinstance(value, datetime) else value
    if row.get('scan_report'):
        record['radiologist_report'] = row['scan_report']
    record['requested_by'] = row.get('requested_by')
    record['requested_by_name'] = row.get('requested_by_name')
    record['attending_doctor_name'] = row.get('attending_doctor_name')
    record['doctor_name'] = row.get('attending_doctor_name') or row.get('requested_by_name')
    return record


_SELECT = """SELECT rs.*, acquisition.projection, o.accession_number, concat_ws(' ', p.first_name, p.last_name) AS patient_name,
       o.requested_by,
       COALESCE(d_req.display_name, u_req.staff_name, u_req.username) AS requested_by_name,
       a.doctor_id AS admission_doctor_id,
       COALESCE(split_part(ds.primary_consultant, ',', 1), adm_llm.attending_doctor, d_adm.display_name, d_req.display_name) AS attending_doctor_name
FROM radiology_scan rs
JOIN radiology_orders o ON o.order_id = rs.order_id
JOIN radiology_order_studies acquisition ON acquisition.study_key=rs.order_study_id
JOIN patients p ON p.id = o.patient_id
LEFT JOIN users u_req ON u_req.id = o.requested_by
LEFT JOIN doctors d_req ON d_req.user_id = u_req.id
LEFT JOIN (
    SELECT DISTINCT ON (patient_id) patient_id, doctor_id
    FROM admissions
    ORDER BY patient_id, admission_date DESC NULLS LAST
) a ON a.patient_id = rs.patient_id
LEFT JOIN doctors d_adm ON d_adm.id = a.doctor_id
LEFT JOIN (
    SELECT DISTINCT ON (patient_id) patient_id, primary_consultant
    FROM dim_generated_discharge_summaries
    ORDER BY patient_id, summary_id DESC
) ds ON ds.patient_id = rs.patient_id
LEFT JOIN (
    SELECT DISTINCT ON (patient_id) patient_id, attending_doctor
    FROM dim_admission_inputs
    ORDER BY patient_id, admission_id DESC
) adm_llm ON adm_llm.patient_id = rs.patient_id
WHERE acquisition.status = 'Uploaded'"""

_TABLES_OK = None  # cached: True once radiology_orders is confirmed to exist


def _tables_exist(conn) -> bool:
    """Return True only if radiology_orders table exists in the connected DB."""
    global _TABLES_OK
    if _TABLES_OK is True:
        return True
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='radiology_orders' LIMIT 1"
            )
            _TABLES_OK = cur.fetchone() is not None
        return _TABLES_OK
    except Exception:
        return False


def save_study(record):
    from routers.imaging_orders import patient_for_ordered_study
    uid = (record.get('source') or {}).get('study_instance_uid')
    order = patient_for_ordered_study(uid) if uid else None
    if not order:
        raise HTTPException(409, 'Upload this study against an X-ray order before analyzing it.')
    record.update(study_id=str(order['study_key']), order_id=str(order['order_id']),
                  display_study_id=order['accession_number'], patient_id=order['patient_id'],
                  patient_code=order['patient_code'], patient_name=order['patient_name'], original_patient_id=uid)
    record['projection'] = order['projection']
    record.setdefault('metadata', {})['view_position'] = order['projection']
    record.setdefault('metadata', {})['accession_number'] = order['accession_number']
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""INSERT INTO radiology_scan
                (order_study_id,order_id,patient_id,patient_code,original_patient_id,study_id,display_study_id,dl_response,review_status,target)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'Pending Review',%s)
                ON CONFLICT (order_study_id) DO NOTHING""",
                (str(order['study_key']),str(order['order_id']),order['patient_id'],order['patient_code'],uid,record['study_id'],
                 order['accession_number'],json.dumps(record),int(record['localization']['opacity_detected'])))
            if cur.rowcount == 0:
                record.update(get_study(record['study_id']) or {})
                return
            triage = record.get('triage', {})
            interpretation = record.get('interpretation', {})
            cur.execute("""UPDATE radiology_scan SET probability=%s,priority=%s,opacity_detected=%s,
                combined_status=%s,image=%s,annotated_image=%s,clinical_summary=%s,assessment=%s,
                recommended_action=%s,findings=%s,scan_report=COALESCE(scan_report,%s),
                radiologist_finding=COALESCE(radiologist_finding,%s) WHERE order_study_id=%s""",
                (triage.get('probability'),triage.get('priority'),record['localization']['opacity_detected'],
                 record.get('combined_assessment',{}).get('status'),record.get('images',{}).get('original'),
                 record.get('images',{}).get('annotated'),interpretation.get('summary'),interpretation.get('assessment'),
                 interpretation.get('recommended_action'),interpretation.get('finding'),interpretation.get('summary'),
                 interpretation.get('finding'),str(order['study_key'])))
        conn.commit()
    record.update(get_study(record['study_id']))


def get_study(study_id):
    try:
        with get_connection() as conn:
            if not _tables_exist(conn):
                return None
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(_SELECT + """ AND (rs.study_id=%s OR (o.examination<>'Chest X-ray PA + AP' AND (rs.order_id::text=%s OR o.accession_number=%s))
                    OR acquisition.orthanc_study_id=%s OR acquisition.study_instance_uid=%s)""", (str(study_id),)*5)
                rows = cur.fetchall()
                return _record(rows[0]) if len(rows) == 1 else None
    except Exception:
        return None


def list_studies(doctor_user_id=None, doctor_id=None, doctor_name=None):
    try:
        with get_connection() as conn:
            if not _tables_exist(conn):
                return []
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                ready_select = _SELECT + """ AND NOT EXISTS (
                    SELECT 1 FROM radiology_order_studies pending
                    LEFT JOIN radiology_scan result ON result.order_study_id=pending.study_key
                    WHERE pending.order_id=o.order_id AND (pending.status<>'Uploaded' OR result.scan_id IS NULL))"""
                if doctor_user_id or doctor_id or doctor_name:
                    name_clean = f"%{doctor_name.replace('Dr.', '').replace('Dr', '').strip()}%" if doctor_name else ""
                    sql = ready_select + """ AND (
                        o.requested_by = %s
                        OR rs.patient_id IN (
                            SELECT patient_id FROM dim_admission_inputs WHERE %s <> '' AND attending_doctor ILIKE %s
                            UNION
                            SELECT patient_id FROM dim_generated_discharge_summaries WHERE %s <> '' AND primary_consultant ILIKE %s
                            UNION
                            SELECT a.patient_id FROM admissions a
                            WHERE (a.doctor_id = %s OR a.doctor_id = %s)
                              AND a.patient_id NOT IN (SELECT patient_id FROM dim_admission_inputs)
                              AND a.patient_id NOT IN (SELECT patient_id FROM dim_generated_discharge_summaries)
                            UNION
                            SELECT patient_id FROM appointments WHERE doctor_id = %s OR doctor_id = %s
                            UNION
                            SELECT patient_id FROM pre_admissions WHERE doctor_id = %s OR doctor_id = %s
                        )
                    ) ORDER BY rs.scan_id"""
                    cur.execute(sql, (
                        doctor_user_id or 0,
                        name_clean, name_clean,
                        name_clean, name_clean,
                        doctor_id or 0, doctor_user_id or 0,
                        doctor_id or 0, doctor_user_id or 0,
                        doctor_id or 0, doctor_user_id or 0
                    ))
                else:
                    cur.execute(ready_select + ' ORDER BY rs.scan_id')
                return [record for row in cur.fetchall() if (record := _record(row))]
    except Exception:
        return []

def mark_study_viewed(study_id, viewed_at):
    record = get_study(study_id)
    if record is None:
        return None
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('UPDATE radiology_scan SET viewed=true,viewed_at=COALESCE(viewed_at,%s) WHERE order_study_id=%s',
                        (viewed_at,record['study_id']))
        conn.commit()
    return get_study(study_id)


def update_review_status(study_id, review_status, reviewed_at, reviewed_by=None, report=None, finding=None):
    record = get_study(study_id)
    if record is None:
        return None
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""UPDATE radiology_scan SET review_status=%s,reviewed_at=%s,reviewed_by=%s,
                scan_report=COALESCE(%s,scan_report),radiologist_finding=COALESCE(%s,radiologist_finding)
                WHERE order_study_id=%s""",(review_status,reviewed_at,reviewed_by,report,finding,record['study_id']))
        conn.commit()
    return get_study(study_id)
