"""Explicit clinical episode linkage; every acquired study remains a separate order."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from psycopg2.extras import RealDictCursor
import db_config
from routers.radiology_clarifications import discussion_user, order_access, ACCESS

router = APIRouter(prefix='/api/imaging-orders', tags=['Imaging follow-ups'])


def lock_patient(cur, patient_id):
    # Also serializes legacy linking with new requests, preventing duplicate versions.
    cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", ('imaging-followups:' + str(patient_id),))


def followup_fields(cur, parent_id, patient_id, user, created_at=None):
    parent = order_access(cur, parent_id, user)
    if parent['patient_id'] != patient_id:
        raise HTTPException(422, 'Follow-up studies must belong to the same patient.')
    root_id = parent.get('root_order_id') or parent['order_id']
    root = order_access(cur, root_id, user)
    cur.execute('''SELECT COALESCE(max(study_version),1) AS version,max(created_at) AS last_ordered
        FROM radiology_orders WHERE COALESCE(root_order_id,order_id)=%s''', (str(root_id),))
    latest = cur.fetchone()
    if created_at is not None and created_at < latest['last_ordered']:
        raise HTTPException(409, 'Link older studies first: this order predates the latest study in that history.')
    return str(root_id), latest['version'] + 1, root.get('clinical_problem') or root['indication']


def audit_link(cur, order_id, parent_id, user, action, reason):
    cur.execute('''INSERT INTO radiology_followup_events(order_id,previous_order_id,actor_id,action,reason)
        VALUES (%s,%s,%s,%s,%s)''', (str(order_id), str(parent_id) if parent_id else None, user['user_id'], action, reason))


class LinkRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    prior_order_id: UUID
    reason: str = Field(min_length=3, max_length=2000)

    @field_validator('reason')
    @classmethod
    def reason_not_blank(cls, value):
        if len(value.strip()) < 3:
            raise ValueError('Explain why these studies concern the same clinical problem.')
        return value.strip()


@router.post('/{order_id}/follow-up')
def link_existing(order_id: UUID, body: LinkRequest, user=Depends(discussion_user)):
    if user['role'] != 'doctor':
        raise HTTPException(403, 'Only the treating doctor can link clinical problems.')
    if order_id == body.prior_order_id:
        raise HTTPException(422, 'Choose a different prior study.')
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        source = order_access(cur, order_id, user)
        lock_patient(cur, source['patient_id'])
        source = order_access(cur, order_id, user)
        if str(source.get('follow_up_of')) == str(body.prior_order_id):
            return {'ok': True}  # Retry of the same link.
        cur.execute('SELECT 1 FROM radiology_orders WHERE root_order_id=%s LIMIT 1', (str(order_id),))
        if source.get('root_order_id') or cur.fetchone():
            raise HTTPException(409, 'This study already belongs to a linked history. Remove its follow-up link first; histories with later studies cannot be moved.')
        root_id, version, problem = followup_fields(cur, body.prior_order_id, source['patient_id'], user, source['created_at'])
        if root_id == str(order_id):
            raise HTTPException(409, 'A study cannot be linked to its own history.')
        cur.execute('''UPDATE radiology_orders SET root_order_id=%s,follow_up_of=%s,study_version=%s,clinical_problem=%s
            WHERE order_id=%s''', (root_id, str(body.prior_order_id), version, problem, str(order_id)))
        audit_link(cur, order_id, body.prior_order_id, user, 'Linked existing study', body.reason)
        conn.commit()
        return {'ok': True, 'study_version': version}


class UnlinkRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reason: str = Field(min_length=3, max_length=2000)


@router.post('/{order_id}/separate-problem')
def unlink(order_id: UUID, body: UnlinkRequest, user=Depends(discussion_user)):
    if user['role'] != 'doctor':
        raise HTTPException(403, 'Only the treating doctor can change clinical problem links.')
    if len(body.reason.strip()) < 3:
        raise HTTPException(422, 'Enter the reason for separating this study.')
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        source = order_access(cur, order_id, user)
        lock_patient(cur, source['patient_id'])
        source = order_access(cur, order_id, user)
        if not source.get('root_order_id'):
            return {'ok': True}
        cur.execute('SELECT 1 FROM radiology_orders WHERE root_order_id=%s AND study_version>%s LIMIT 1', (str(source['root_order_id']), source['study_version']))
        if cur.fetchone():
            raise HTTPException(409, 'Separate later follow-ups first to preserve the remaining study history.')
        cur.execute('UPDATE radiology_orders SET root_order_id=NULL,follow_up_of=NULL,study_version=1,clinical_problem=indication WHERE order_id=%s', (str(order_id),))
        audit_link(cur, order_id, source['follow_up_of'], user, 'Separated clinical problem', body.reason.strip())
        conn.commit()
        return {'ok': True}


SUMMARY = '''SELECT o.order_id,o.patient_id,o.accession_number,o.examination,o.indication,o.status,
    o.created_at,o.uploaded_at,o.study_instance_uid,o.root_order_id,o.follow_up_of,o.study_version,
    COALESCE(o.clinical_problem,o.indication) AS clinical_problem,
    p.patient_code,concat_ws(' ',p.first_name,p.last_name) AS patient_name,
    s.scan_id,s.scan_report,s.reviewed_by,s.reviewed_at,s.review_status,s.radiologist_finding
    FROM radiology_orders o JOIN patients p ON p.id=o.patient_id
    LEFT JOIN radiology_scan s ON s.order_id=o.order_id'''


@router.get('/{order_id}/history')
def history(order_id: UUID, user=Depends(discussion_user)):
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        source = order_access(cur, order_id, user)
        root_id = source.get('root_order_id') or source['order_id']
        params = [str(root_id)]
        where = ' WHERE COALESCE(o.root_order_id,o.order_id)=%s'
        if user['role'] == 'doctor':
            where += ' AND ' + ACCESS
            params.extend([user['user_id']] * 2)
        cur.execute(SUMMARY + where + ' ORDER BY o.study_version', params)
        studies = cur.fetchall()
        cur.execute('''SELECT e.*,COALESCE(u.staff_name,u.username) AS actor_name
            FROM radiology_followup_events e JOIN users u ON u.id=e.actor_id
            WHERE e.order_id=%s ORDER BY e.created_at,e.id''', (str(order_id),))
        return {'studies': studies, 'events': cur.fetchall(), 'user': user}


@router.get('/{order_id}/comparison')
def compare(order_id: UUID, prior_order_id: UUID, user=Depends(discussion_user)):
    if order_id == prior_order_id:
        raise HTTPException(422, 'Select two different studies.')
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        current = order_access(cur, order_id, user)
        prior = order_access(cur, prior_order_id, user)
        if current['patient_id'] != prior['patient_id'] or str(current.get('root_order_id') or current['order_id']) != str(prior.get('root_order_id') or prior['order_id']):
            raise HTTPException(422, 'Compare studies linked to the same patient and clinical problem.')
        if prior['study_version'] >= current['study_version']:
            raise HTTPException(422, 'Select an earlier study as the prior examination.')
        rows = []
        for oid in (prior_order_id, order_id):
            cur.execute(SUMMARY.replace('SELECT o.order_id', 'SELECT s.image,o.order_id') + ' WHERE o.order_id=%s', (str(oid),))
            rows.append(cur.fetchone())
        return {'prior': rows[0], 'current': rows[1]}
