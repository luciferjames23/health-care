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
                  display_study_id=row['accession_number'])
    for key in ('review_status', 'reviewed_by', 'reviewed_at', 'radiologist_finding', 'scan_report', 'viewed', 'viewed_at'):
        if row.get(key) is not None:
            value = row[key]
            record[key] = value.isoformat() if isinstance(value, datetime) else value
    if row.get('scan_report'):
        record['radiologist_report'] = row['scan_report']
    return record


_SELECT = """SELECT rs.*,o.accession_number,concat_ws(' ',p.first_name,p.last_name) AS patient_name
FROM radiology_scan rs JOIN radiology_orders o ON o.order_id=rs.order_id
JOIN patients p ON p.id=o.patient_id WHERE o.status='Uploaded'"""


def save_study(record):
    from routers.imaging_orders import patient_for_ordered_study
    uid = (record.get('source') or {}).get('study_instance_uid')
    order = patient_for_ordered_study(uid) if uid else None
    if not order:
        raise HTTPException(409, 'Upload this study against an X-ray order before analyzing it.')
    record.update(study_id=str(order['order_id']), order_id=str(order['order_id']),
                  display_study_id=order['accession_number'], patient_id=order['patient_id'],
                  patient_code=order['patient_code'], patient_name=order['patient_name'], original_patient_id=uid)
    record.setdefault('metadata', {})['accession_number'] = order['accession_number']
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""INSERT INTO radiology_scan
                (order_id,patient_id,patient_code,original_patient_id,study_id,display_study_id,dl_response,review_status,target)
                VALUES (%s,%s,%s,%s,%s,%s,%s,'Pending Review',%s)
                ON CONFLICT (order_id) DO UPDATE SET dl_response=EXCLUDED.dl_response,
                study_id=EXCLUDED.study_id,display_study_id=EXCLUDED.display_study_id""",
                (str(order['order_id']),order['patient_id'],order['patient_code'],uid,record['study_id'],
                 order['accession_number'],json.dumps(record),int(record['localization']['opacity_detected'])))
            triage = record.get('triage', {})
            interpretation = record.get('interpretation', {})
            cur.execute("""UPDATE radiology_scan SET probability=%s,priority=%s,opacity_detected=%s,
                combined_status=%s,image=%s,annotated_image=%s,clinical_summary=%s,assessment=%s,
                recommended_action=%s,findings=%s,scan_report=COALESCE(scan_report,%s),
                radiologist_finding=COALESCE(radiologist_finding,%s) WHERE order_id=%s""",
                (triage.get('probability'),triage.get('priority'),record['localization']['opacity_detected'],
                 record.get('combined_assessment',{}).get('status'),record.get('images',{}).get('original'),
                 record.get('images',{}).get('annotated'),interpretation.get('summary'),interpretation.get('assessment'),
                 interpretation.get('recommended_action'),interpretation.get('finding'),interpretation.get('summary'),
                 interpretation.get('finding'),str(order['order_id'])))
        conn.commit()
    record.update(get_study(record['study_id']))


def get_study(study_id):
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_SELECT + """ AND (rs.study_id=%s OR rs.order_id::text=%s OR o.accession_number=%s
                OR o.orthanc_study_id=%s OR o.study_instance_uid=%s)""", (str(study_id),)*5)
            return _record(cur.fetchone())


def list_studies():
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(_SELECT + ' ORDER BY rs.scan_id')
            return [record for row in cur.fetchall() if (record := _record(row))]


def mark_study_viewed(study_id, viewed_at):
    record = get_study(study_id)
    if record is None:
        return None
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('UPDATE radiology_scan SET viewed=true,viewed_at=COALESCE(viewed_at,%s) WHERE order_id=%s',
                        (viewed_at,record['order_id']))
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
                WHERE order_id=%s""",(review_status,reviewed_at,reviewed_by,report,finding,record['order_id']))
        conn.commit()
    return get_study(study_id)
