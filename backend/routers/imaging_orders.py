"""Patient-linked X-ray requests and radiologist PACS ingestion."""
import hashlib
import io
import uuid
from typing import Annotated, Literal

import psycopg2.extras
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field, ConfigDict
from api.auth_helper import decode_token, security, require_radiologist
from fastapi.security import HTTPAuthorizationCredentials
import db_config
from radiology_ai.services.orthanc_service import _request, OrthancError

router = APIRouter(prefix='/api/imaging-orders', tags=['X-ray orders'])


def order_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials) if credentials else None
    if not payload or not payload.get('user_id'):
        raise HTTPException(401, 'Sign in to access X-ray orders.')
    with db_config.get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT u.id, r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=%s AND u.is_active=true', (payload['user_id'],))
            row = cur.fetchone()
    if not row:
        raise HTTPException(403, 'No access. Account not found or inactive.')
    role = row[1].lower()
    return {'user_id': row[0], 'role': role}


class NewOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patient_id: int = Field(gt=0)
    examination: Literal['Chest X-ray PA', 'Chest X-ray AP', 'Chest X-ray PA + AP']
    indication: str = Field(min_length=3, max_length=2000)
    priority: Literal['Routine', 'Urgent'] = 'Routine'
    request_id: uuid.UUID
    follow_up_of: uuid.UUID | None = None
    clinical_problem: str | None = Field(default=None, min_length=3, max_length=2000)


ORDER_SELECT = """
SELECT o.*, COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'study_key',a.study_key,'projection',a.projection,'status',a.status,
           'study_instance_uid',a.study_instance_uid,'study_id',rs.study_id,
           'review_status',rs.review_status,'analyzed',rs.scan_id IS NOT NULL) ORDER BY a.projection DESC)
           FROM radiology_order_studies a LEFT JOIN radiology_scan rs ON rs.order_study_id=a.study_key
           WHERE a.order_id=o.order_id),'[]'::jsonb) AS studies, p.patient_code, concat_ws(' ',p.first_name,p.last_name) AS patient_name,
       COALESCE(d.display_name,u.staff_name,u.username) AS requested_by_name,
       prior.accession_number AS follow_up_accession,prior.study_version AS follow_up_version
FROM radiology_orders o JOIN patients p ON p.id=o.patient_id
JOIN users u ON u.id=o.requested_by LEFT JOIN doctors d ON d.user_id=u.id
LEFT JOIN radiology_orders prior ON prior.order_id=o.follow_up_of
"""


@router.get('')
def list_orders(patient_id: int | None = Query(None, gt=0), user=Depends(order_user)):
    clauses, params = [], []
    if user['role'] == 'doctor' and not patient_id:
        clauses.append('o.requested_by=%s')
        params.append(user['user_id'])
    if patient_id:
        clauses.append('o.patient_id=%s')
        params.append(patient_id)
    where = (' WHERE ' + ' AND '.join(clauses)) if clauses else ''
    try:
        with db_config.get_db_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Guard: table may not exist in this environment
                cur.execute("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='radiology_orders' LIMIT 1")
                if not cur.fetchone():
                    return {'orders': []}
                cur.execute(ORDER_SELECT + where + " ORDER BY CASE WHEN o.status='Uploaded' THEN 1 ELSE 0 END, CASE WHEN o.priority='Urgent' THEN 0 ELSE 1 END, o.created_at DESC LIMIT 200", params)
                return {'orders': [dict(row) for row in cur.fetchall()]}
    except Exception as exc:
        raise HTTPException(503, f'X-ray order service unavailable: {exc}')


@router.post('', status_code=201)
def create_order(body: NewOrder, user=Depends(order_user)):
    if user['role'] != 'doctor':
        raise HTTPException(403, 'Only a signed-in doctor can request an X-ray.')
    if len(body.indication.strip()) < 3:
        raise HTTPException(422, 'Enter a clinical indication.')
    if body.clinical_problem is not None and len(body.clinical_problem.strip()) < 3:
        raise HTTPException(422, 'Enter a clinical problem of at least three characters.')
    if body.follow_up_of and body.clinical_problem:
        raise HTTPException(422, 'A follow-up inherits its clinical problem from the prior study.')
    order_id = str(body.request_id)
    accession = 'XR' + body.request_id.hex[:14].upper()
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Guard: table may not exist in this environment
            cur.execute("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='radiology_orders' LIMIT 1")
            if not cur.fetchone():
                raise HTTPException(503, 'X-ray ordering is not set up in this database. Run the database migration scripts first.')
            cur.execute('SELECT id FROM patients WHERE id=%s', (body.patient_id,))
            if not cur.fetchone():
                raise HTTPException(404, 'Patient not found.')
            from routers.imaging_history import lock_patient, followup_fields, audit_link
            lock_patient(cur, body.patient_id)
            cur.execute(ORDER_SELECT + ' WHERE o.order_id=%s', (order_id,))
            existing = cur.fetchone()
            root_id, version = None, 1
            problem = (body.clinical_problem or body.indication).strip()
            if not existing:
                if body.follow_up_of:
                    root_id, version, problem = followup_fields(cur, body.follow_up_of, body.patient_id, user)
                cur.execute('''INSERT INTO radiology_orders(order_id,accession_number,patient_id,requested_by,examination,indication,priority,
                    root_order_id,follow_up_of,study_version,clinical_problem)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (order_id) DO NOTHING''',
                    (order_id, accession, body.patient_id, user['user_id'], body.examination, body.indication.strip(), body.priority,
                     root_id,str(body.follow_up_of) if body.follow_up_of else None,version,problem))
                if cur.rowcount == 1 and body.follow_up_of:
                    audit_link(cur, order_id, body.follow_up_of, user, 'Requested follow-up study', body.indication.strip())
            cur.execute(ORDER_SELECT + ' WHERE o.order_id=%s', (order_id,))
            row = dict(cur.fetchone())
            if row['requested_by'] != user['user_id'] or row['patient_id'] != body.patient_id or row['examination'] != body.examination or row['indication'] != body.indication.strip() or row['priority'] != body.priority:
                raise HTTPException(409, 'This request identifier is already used. Start a new order.')
            if str(row.get('follow_up_of')) != str(body.follow_up_of) or (not body.follow_up_of and (row.get('clinical_problem') or row['indication']) != problem):
                raise HTTPException(409, 'This request identifier has different clinical problem details. Start a new order.')
            projections = ['PA', 'AP'] if body.examination == 'Chest X-ray PA + AP' else [body.examination.rsplit(' ', 1)[-1]]
            for projection in projections:
                key = order_id if len(projections) == 1 else str(uuid.uuid5(body.request_id, projection))
                cur.execute('''INSERT INTO radiology_order_studies(study_key,order_id,projection)
                    VALUES (%s,%s,%s) ON CONFLICT (order_id,projection) DO NOTHING''', (key,order_id,projection))
            cur.execute(ORDER_SELECT + ' WHERE o.order_id=%s', (order_id,))
            row = dict(cur.fetchone())
            conn.commit()
            return row


PATIENT_MAPPING_SQL = """SELECT DISTINCT p.id,p.patient_code FROM patients p
JOIN radiology_patient_identifiers identifiers ON identifiers.patient_id=p.id
WHERE identifiers.dicom_patient_id=%s OR identifiers.dicom_patient_id=%s"""


def validate_dicom_patient(dicom_id: str, order: dict, confirmed: bool = False, cursor=None) -> None:
    """Accept hospital identifiers or an unambiguous existing radiology mapping."""
    expected = str(order['patient_id'])
    if dicom_id and dicom_id in {expected, str(order.get('patient_code') or '')}:
        return
    if not dicom_id:
        raise HTTPException(422, 'DICOM has no PatientID; patient identity cannot be verified.')
    try:
        if cursor is not None:
            cursor.execute(PATIENT_MAPPING_SQL, (dicom_id, dicom_id))
            matches = cursor.fetchall()
        else:
            with db_config.get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(PATIENT_MAPPING_SQL, (dicom_id, dicom_id))
                    matches = cur.fetchall()
    except Exception as exc:
        raise HTTPException(503, 'Patient mapping could not be verified. Please retry.') from exc
    if len(matches) == 1 and str(matches[0][0]) == expected:
        return
    if len(matches) == 1:
        raise HTTPException(422, f'DICOM PatientID {dicom_id} maps to patient {matches[0][0]} ({matches[0][1]}), but this order is for patient {expected} ({order.get("patient_code")}). Select the matching patient order or upload the correct image.')
    if len(matches) > 1:
        raise HTTPException(422, 'This DICOM PatientID maps to multiple patients. Correct the patient mapping before uploading.')
    if confirmed:
        return
    raise HTTPException(422, {
        'code': 'patient_mapping_required',
        'message': 'This DICOM PatientID is not registered. Review the image patient details and confirm the patient before uploading.',
        'dicom_patient_id': dicom_id,
    })


def prepare_dicom(content: bytes, order: dict, confirmed: bool = False) -> tuple[bytes, str]:
    """Validate patient identity before linking an uploaded radiograph to an order."""
    import pydicom
    try:
        ds = pydicom.dcmread(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(422, 'Upload a valid DICOM (.dcm) X-ray file.') from exc
    if str(getattr(ds, 'Modality', '')) not in ('CR', 'DX') or 'PixelData' not in ds:
        raise HTTPException(422, 'The file must be a CR or DX X-ray image containing pixel data.')
    for tag in ('StudyInstanceUID', 'SeriesInstanceUID', 'SOPInstanceUID'):
        if not getattr(ds, tag, None):
            raise HTTPException(422, f'DICOM is missing {tag}.')
    accession = str(getattr(ds, 'AccessionNumber', '')).strip()
    if accession and accession != order['accession_number']:
        raise HTTPException(422, 'DICOM accession number belongs to a different order.')
    try:
        validate_dicom_patient(str(getattr(ds, 'PatientID', '')).strip(), order, confirmed)
    except HTTPException as exc:
        if isinstance(exc.detail, dict) and exc.detail.get('code') == 'patient_mapping_required':
            exc.detail.update(dicom_patient_name=str(getattr(ds, 'PatientName', '')),
                              dicom_patient_birth_date=str(getattr(ds, 'PatientBirthDate', '')),
                              dicom_patient_sex=str(getattr(ds, 'PatientSex', '')))
        raise
    expected_projection = order.get('projection')
    actual_projection = str(getattr(ds, 'ViewPosition', '')).strip().upper()
    if expected_projection and actual_projection and actual_projection != expected_projection:
        raise HTTPException(422, f'DICOM view {actual_projection} does not match the selected {expected_projection} study.')
    if order.get('examination') == 'Chest X-ray PA + AP' and not actual_projection:
        raise HTTPException(422, 'Combined orders require DICOM ViewPosition PA or AP to verify each study.')
    ds.AccessionNumber = order['accession_number']
    output = io.BytesIO()
    ds.save_as(output, enforce_file_format=True)
    return output.getvalue(), str(ds.StudyInstanceUID)


@router.post('/{order_id}/upload')
def upload_order(order_id: uuid.UUID, file: UploadFile = File(...), reviewer=Depends(require_radiologist), confirm_patient_match: Annotated[bool, Form()] = False, projection: Annotated[Literal['PA', 'AP'] | None, Form()] = None):
    content = file.file.read(30 * 1024 * 1024 + 1)
    if not content or len(content) > 30 * 1024 * 1024:
        raise HTTPException(413, 'Upload a non-empty DICOM file up to 30 MB.')
    digest = hashlib.sha256(content).hexdigest()
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(ORDER_SELECT + ' WHERE o.order_id=%s', (str(order_id),))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, 'X-ray order not found.')
            order = dict(row)
            if order['examination'] == 'Chest X-ray PA + AP' and not projection:
                raise HTTPException(422, 'Select PA or AP for this combined order.')
            projection = projection or order['examination'].rsplit(' ', 1)[-1]
            cur.execute('SELECT * FROM radiology_order_studies WHERE order_id=%s AND projection=%s', (str(order_id),projection))
            acquisition = cur.fetchone()
            if not acquisition:
                raise HTTPException(422, 'This projection was not requested for this order.')
            study_key = str(acquisition['study_key'])
            order.update(dict(acquisition))
            if order['status'] == 'Uploaded':
                if order['upload_sha256'] == digest:
                    cur.execute(ORDER_SELECT + ' WHERE o.order_id=%s', (str(order_id),))
                    return dict(cur.fetchone())
                raise HTTPException(409, 'An image is already uploaded for this order.')
    payload, study_uid = prepare_dicom(content, order, confirm_patient_match)
    # Do not attach an already-stored image from another examination to this order.
    import pydicom
    ds = pydicom.dcmread(io.BytesIO(payload), stop_before_pixels=True)
    sop_uid = str(ds.SOPInstanceUID)
    dicom_id = str(ds.PatientID).strip()
    try:
        existing = _request('POST', '/tools/find', json={'Level':'Instance', 'Query':{'SOPInstanceUID':sop_uid}}).json()
        for instance_id in existing:
            tags = _request('GET', f'/instances/{instance_id}/simplified-tags').json()
            if tags.get('AccessionNumber') != order['accession_number'] or tags.get('StudyInstanceUID') != study_uid:
                raise HTTPException(409, 'This DICOM image is already in PACS for another accession. Upload the image acquired for this order.')
    except OrthancError as exc:
        raise HTTPException(502, 'PACS is unavailable. Please retry.') from exc
    with db_config.get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute('SELECT order_id FROM radiology_order_studies WHERE study_instance_uid=%s AND study_key<>%s', (study_uid,study_key))
            if cur.fetchone():
                raise HTTPException(409, 'This DICOM study is already linked to another order.')
    with db_config.get_db_connection() as conn:
        with conn.cursor() as cur:
            # One claimant per order. Retrying the same upload is safe after interruption.
            try:
                cur.execute('''UPDATE radiology_order_studies SET status='Uploading',upload_started_at=CURRENT_TIMESTAMP,
                    upload_sha256=%s, study_instance_uid=%s WHERE study_key=%s AND
                    (status='Requested' OR (status='Uploading' AND upload_started_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'))
                    AND (upload_sha256 IS NULL OR upload_sha256=%s) RETURNING order_id''',
                    (digest, study_uid, study_key, digest))
            except psycopg2.errors.UniqueViolation as exc:
                raise HTTPException(409, 'This DICOM study is already linked to another order.') from exc
            if not cur.fetchone():
                raise HTTPException(409, 'An upload is in progress, or this order requires retrying the same file.')
            if confirm_patient_match:
                # Unique identifier registration serializes competing confirmations.
                # It commits with the claim so an interrupted upload can be retried.
                cur.execute("""INSERT INTO radiology_patient_identifiers
                    (dicom_patient_id,patient_id,verified_by,order_id,upload_sha256,dicom_patient_name,dicom_patient_birth_date)
                    VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (dicom_patient_id) DO NOTHING""",
                    (dicom_id, order['patient_id'], reviewer['user_id'], str(order_id), digest,
                     str(getattr(ds, 'PatientName', '')), str(getattr(ds, 'PatientBirthDate', ''))))
                validate_dicom_patient(dicom_id, order, cursor=cur)
            conn.commit()
    try:
        result = _request('POST', '/instances', timeout=45, data=payload, headers={'Content-Type':'application/dicom'}).json()
        if not result.get('ID') or not result.get('ParentStudy'):
            raise OrthancError('PACS did not confirm the stored image.')
    except (OrthancError, ValueError) as exc:
        with db_config.get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE radiology_order_studies SET status='Requested' WHERE study_key=%s AND status='Uploading'", (study_key,))
                conn.commit()
        raise HTTPException(502, 'PACS upload could not be confirmed. Retry the same file.') from exc
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('''UPDATE radiology_order_studies SET status='Uploaded',uploaded_at=CURRENT_TIMESTAMP,
                uploaded_by=%s,orthanc_instance_id=%s,orthanc_study_id=%s WHERE study_key=%s''',
                (reviewer['user_id'], result['ID'], result['ParentStudy'], study_key))
            # Serialize aggregate updates so simultaneous PA/AP completions cannot lose readiness.
            cur.execute('SELECT order_id FROM radiology_orders WHERE order_id=%s FOR UPDATE', (str(order_id),))
            cur.execute('''UPDATE radiology_orders SET status=CASE WHEN NOT EXISTS
                (SELECT 1 FROM radiology_order_studies WHERE order_id=%s AND status<>'Uploaded')
                THEN 'Uploaded' ELSE 'Requested' END, uploaded_at=CURRENT_TIMESTAMP,
                uploaded_by=%s WHERE order_id=%s''', (str(order_id),reviewer['user_id'],str(order_id)))
            if order['examination'] != 'Chest X-ray PA + AP':
                cur.execute('''UPDATE radiology_orders SET study_instance_uid=%s,orthanc_instance_id=%s,
                    orthanc_study_id=%s,upload_sha256=%s WHERE order_id=%s''',
                    (study_uid,result['ID'],result['ParentStudy'],digest,str(order_id)))
            conn.commit()
            cur.execute(ORDER_SELECT + ' WHERE o.order_id=%s', (str(order_id),))
            return dict(cur.fetchone())


def patient_for_ordered_study(study_uid):
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(ORDER_SELECT + " JOIN radiology_order_studies acquisition ON acquisition.order_id=o.order_id WHERE acquisition.study_instance_uid=%s AND acquisition.status='Uploaded'", (study_uid,))
            row = cur.fetchone()
            if not row:
                return None
            order = dict(row)
            cur.execute('SELECT study_key,projection,orthanc_instance_id,orthanc_study_id FROM radiology_order_studies WHERE study_instance_uid=%s', (study_uid,))
            order.update(dict(cur.fetchone()))
            return order
