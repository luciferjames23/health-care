"""Order-scoped clinical discussions. No changes to orders, scans or reports."""
from uuid import UUID
from typing import Literal
import hashlib
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from psycopg2.extras import RealDictCursor, Json
from api.auth_helper import decode_token, security
import db_config

router = APIRouter(prefix='/api/radiology-clarifications', tags=['Radiology clarification'])


def discussion_user(credentials=Depends(security)):
    payload = decode_token(credentials.credentials) if credentials else None
    if not payload or not payload.get('user_id'):
        raise HTTPException(401, 'Sign in to access report discussions.')
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""SELECT u.id AS user_id, lower(r.name) AS role,
            COALESCE(d.display_name,u.staff_name,u.username) AS name
            FROM users u JOIN roles r ON r.id=u.role_id
            LEFT JOIN doctors d ON d.user_id=u.id WHERE u.id=%s AND u.is_active=true""", (payload['user_id'],))
        user = cur.fetchone()
    if not user or user['role'] not in ('doctor', 'radiologist'):
        raise HTTPException(403, 'An active doctor or radiologist account is required.')
    return dict(user)


# Use stable database IDs; names and browser-supplied patient IDs never grant access.
ACCESS = """(o.requested_by=%s OR EXISTS (
    SELECT 1 FROM admissions a JOIN doctors d ON d.id=a.doctor_id
    WHERE a.patient_id=o.patient_id AND d.user_id=%s
    AND a.admission_id=(SELECT a2.admission_id FROM admissions a2 WHERE a2.patient_id=o.patient_id
              ORDER BY a2.admission_date DESC NULLS LAST,a2.admission_id DESC LIMIT 1)))"""


def order_access(cur, order_id, user):
    sql = 'SELECT o.* FROM radiology_orders o WHERE o.order_id=%s'
    params = [str(order_id)]
    if user['role'] == 'doctor':
        sql += ' AND ' + ACCESS
        params.extend([user['user_id']] * 2)
    cur.execute(sql, params)
    order = cur.fetchone()
    if not order:
        raise HTTPException(404, 'Study not found or you do not have access.')
    return order


def thread_access(cur, thread_id, user, lock=False):
    cur.execute('SELECT * FROM radiology_clarifications WHERE id=%s' + (' FOR UPDATE' if lock else ''), (str(thread_id),))
    thread = cur.fetchone()
    if not thread:
        raise HTTPException(404, 'Discussion not found.')
    order_access(cur, thread['order_id'], user)
    return thread


def event(cur, thread_id, user, action):
    cur.execute('INSERT INTO radiology_clarification_events(thread_id,actor_id,actor_name,action) VALUES (%s,%s,%s,%s)',
                (str(thread_id), user['user_id'], user['name'], action))


class Message(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: UUID
    body: str = Field(min_length=1, max_length=8000)

    @field_validator('body')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('Enter a message.')
        return value.strip()


class NewThread(Message):
    order_id: UUID
    subject: str = Field(min_length=3, max_length=200)
    priority: Literal['Routine', 'Urgent'] = 'Routine'
    report_fingerprint: str = Field(min_length=64, max_length=64)

    @field_validator('subject')
    @classmethod
    def subject_nonblank(cls, value):
        if len(value.strip()) < 3:
            raise ValueError('Enter a subject of at least three characters.')
        return value.strip()


def insert_message(cur, thread_id, body, user):
    cur.execute('''INSERT INTO radiology_clarification_messages(id,thread_id,sender_id,sender_name,sender_role,body)
        VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
        (str(body.id), str(thread_id), user['user_id'], user['name'], user['role'], body.body))
    inserted = cur.rowcount == 1
    cur.execute('SELECT * FROM radiology_clarification_messages WHERE id=%s', (str(body.id),))
    existing = cur.fetchone()
    if str(existing['thread_id']) != str(thread_id) or existing['sender_id'] != user['user_id'] or existing['body'] != body.body:
        raise HTTPException(409, 'Message identifier already used. Reload and retry.')
    return inserted


def report_fingerprint(scan):
    values = [str(scan.get(key) or '') for key in ('scan_report', 'reviewed_by', 'reviewed_at')]
    return hashlib.sha256(json.dumps(values).encode()).hexdigest()


@router.get('')
def list_threads(order_id: UUID | None = None, user=Depends(discussion_user)):
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        context = None
        if order_id:
            order_access(cur, order_id, user)
            cur.execute('''SELECT o.order_id,o.accession_number,o.examination,o.created_at,o.patient_id,
                p.patient_code,concat_ws(' ',p.first_name,p.last_name) AS patient_name,
                s.reviewed_by,s.reviewed_at,s.scan_report
                FROM radiology_orders o JOIN patients p ON p.id=o.patient_id
                LEFT JOIN radiology_scan s ON s.order_id=o.order_id WHERE o.order_id=%s''', (str(order_id),))
            context = cur.fetchone()
            context['report_fingerprint'] = report_fingerprint(context)
        clauses, params = [], [user['user_id'], user['user_id']]
        if order_id:
            clauses.append('t.order_id=%s')
            params.append(str(order_id))
        if user['role'] == 'doctor':
            clauses.append(ACCESS)
            params.extend([user['user_id']] * 2)
        cur.execute("""SELECT t.*, o.patient_id,o.accession_number,o.examination,o.study_instance_uid,
            p.patient_code,concat_ws(' ',p.first_name,p.last_name) AS patient_name,
            COALESCE(u.staff_name,u.username) AS assigned_name,
            (SELECT count(*) FROM radiology_clarification_messages m
             WHERE m.thread_id=t.id AND m.sender_id<>%s AND NOT EXISTS
             (SELECT 1 FROM radiology_clarification_reads r WHERE r.message_id=m.id AND r.user_id=%s)) AS unread
            FROM radiology_clarifications t JOIN radiology_orders o ON o.order_id=t.order_id
            JOIN patients p ON p.id=o.patient_id LEFT JOIN users u ON u.id=t.assigned_to"""
            + (' WHERE ' + ' AND '.join(clauses) if clauses else '') + ' ORDER BY t.updated_at DESC', params)
        return {'threads': cur.fetchall(), 'user': user, 'context': context}


@router.post('', status_code=201)
def create_thread(body: NewThread, user=Depends(discussion_user)):
    if user['role'] != 'doctor':
        raise HTTPException(403, 'Only a doctor can request clarification.')
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        order_access(cur, body.order_id, user)
        cur.execute('SELECT * FROM radiology_scan WHERE order_id=%s FOR SHARE', (str(body.order_id),))
        scan = cur.fetchone()
        if not scan or not scan.get('scan_report') or not scan.get('reviewed_at'):
            raise HTTPException(409, 'A radiologist-reviewed report is required before requesting clarification.')
        cur.execute('SELECT id FROM radiology_clarifications WHERE id=%s', (str(body.id),))
        if not cur.fetchone() and body.report_fingerprint != report_fingerprint(scan):
            raise HTTPException(409, 'The report has changed. Close this draft, refresh, and request clarification against the current report.')
        # Capture exactly what the doctor questioned, even if the live report later changes.
        snapshot = {key: str(scan[key]) if scan.get(key) is not None else None
                    for key in ('scan_id', 'scan_report', 'review_status', 'reviewed_by', 'reviewed_at')}
        # Legacy reports store reviewer names only. Ambiguous names go to the shared queue.
        cur.execute("""SELECT DISTINCT u.id FROM users u JOIN roles r ON r.id=u.role_id
            LEFT JOIN doctors d ON d.user_id=u.id WHERE u.is_active=true AND lower(r.name)='radiologist'
            AND %s IN (u.staff_name,u.username,d.display_name)""", (scan.get('reviewed_by'),))
        reviewers = cur.fetchall()
        assignee = reviewers[0]['id'] if len(reviewers) == 1 else None
        cur.execute('''INSERT INTO radiology_clarifications(id,order_id,subject,priority,created_by,assigned_to,report_snapshot)
            VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
            (str(body.id), str(body.order_id), body.subject, body.priority, user['user_id'], assignee, Json(snapshot)))
        inserted = cur.rowcount == 1
        thread = thread_access(cur, body.id, user, lock=True)
        if str(thread['order_id']) != str(body.order_id) or thread['created_by'] != user['user_id'] or thread['subject'] != body.subject or thread['priority'] != body.priority:
            raise HTTPException(409, 'Request identifier already used.')
        insert_message(cur, body.id, body, user)
        if inserted:
            event(cur, body.id, user, 'Requested clarification' + ('; assigned to reporting radiologist' if assignee else '; sent to shared radiology queue'))
        conn.commit()
        return {'id': str(body.id)}


@router.get('/{thread_id}')
def detail(thread_id: UUID, user=Depends(discussion_user)):
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        thread = thread_access(cur, thread_id, user)
        cur.execute('SELECT * FROM radiology_clarification_messages WHERE thread_id=%s ORDER BY created_at,id', (str(thread_id),))
        messages = cur.fetchall()
        cur.execute('''SELECT r.*, COALESCE(u.staff_name,u.username) AS reader_name FROM radiology_clarification_reads r
            JOIN users u ON u.id=r.user_id JOIN radiology_clarification_messages m ON m.id=r.message_id
            WHERE m.thread_id=%s ORDER BY r.read_at''', (str(thread_id),))
        reads = cur.fetchall()
        cur.execute('SELECT * FROM radiology_clarification_events WHERE thread_id=%s ORDER BY created_at,id', (str(thread_id),))
        return {'thread': thread, 'messages': messages, 'reads': reads, 'events': cur.fetchall(), 'user': user}


@router.post('/{thread_id}/messages', status_code=201)
def reply(thread_id: UUID, body: Message, user=Depends(discussion_user)):
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        thread = thread_access(cur, thread_id, user, lock=True)
        # Allow an exact retry even after the discussion was resolved.
        cur.execute('SELECT id FROM radiology_clarification_messages WHERE id=%s', (str(body.id),))
        retry = cur.fetchone()
        if not retry:
            if thread['status'] == 'Resolved':
                raise HTTPException(409, 'Reopen this discussion before replying.')
            if user['role'] == 'radiologist' and thread['assigned_to'] not in (None, user['user_id']):
                raise HTTPException(409, 'Take over this discussion before replying.')
        if insert_message(cur, thread_id, body, user):
            if user['role'] == 'radiologist' and thread['assigned_to'] is None:
                cur.execute('UPDATE radiology_clarifications SET assigned_to=%s WHERE id=%s', (user['user_id'], str(thread_id)))
                event(cur, thread_id, user, 'Claimed discussion')
            cur.execute('UPDATE radiology_clarifications SET status=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s',
                        ('Responded' if user['role'] == 'radiologist' else 'Open', str(thread_id)))
        conn.commit()
        return {'id': str(body.id)}


class ReadMessages(BaseModel):
    model_config = ConfigDict(extra='forbid')
    message_ids: list[UUID] = Field(max_length=500)


@router.post('/{thread_id}/read')
def mark_read(thread_id: UUID, body: ReadMessages, user=Depends(discussion_user)):
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        thread_access(cur, thread_id, user)
        for message_id in body.message_ids:
            cur.execute('''INSERT INTO radiology_clarification_reads(message_id,user_id)
                SELECT id,%s FROM radiology_clarification_messages WHERE id=%s AND thread_id=%s AND sender_id<>%s
                ON CONFLICT DO NOTHING''', (user['user_id'], str(message_id), str(thread_id), user['user_id']))
        conn.commit()
        return {'ok': True}


class Action(BaseModel):
    model_config = ConfigDict(extra='forbid')
    action: Literal['resolve', 'reopen', 'claim']


@router.post('/{thread_id}/actions')
def act(thread_id: UUID, body: Action, user=Depends(discussion_user)):
    with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        thread = thread_access(cur, thread_id, user, lock=True)
        if body.action == 'claim':
            if user['role'] != 'radiologist':
                raise HTTPException(403, 'Only radiologists can take ownership.')
            if thread['assigned_to'] != user['user_id']:
                cur.execute('UPDATE radiology_clarifications SET assigned_to=%s,updated_at=CURRENT_TIMESTAMP WHERE id=%s', (user['user_id'], str(thread_id)))
                event(cur, thread_id, user, f"Took ownership (previous assignee ID: {thread['assigned_to'] or 'unassigned'})")
        else:
            if user['role'] != 'doctor':
                raise HTTPException(403, 'The treating doctor resolves or reopens clarification requests.')
            status = 'Resolved' if body.action == 'resolve' else 'Open'
            if thread['status'] != status:
                cur.execute('''UPDATE radiology_clarifications SET status=%s,updated_at=CURRENT_TIMESTAMP,
                    resolved_at=CASE WHEN %s='Resolved' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=%s''', (status, status, str(thread_id)))
                event(cur, thread_id, user, 'Resolved discussion' if status == 'Resolved' else 'Reopened discussion')
        conn.commit()
        return {'ok': True}
