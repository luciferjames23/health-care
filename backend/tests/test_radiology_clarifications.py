"""API integration tests in an isolated PostgreSQL schema, rolled back on exit.

Run: python -m unittest tests.test_radiology_clarifications -v
"""
import unittest
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api.auth_helper import encode_token
from routers.radiology_clarifications import router
import db_config


class BorrowConnection:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def cursor(self, *args, **kwargs):
        return self.connection.cursor(*args, **kwargs)

    def commit(self):
        pass  # All endpoint writes stay inside the test transaction.


class ClarificationTests(unittest.TestCase):
    def setUp(self):
        self.conn = db_config.get_db_connection()
        self.addCleanup(self.conn.close)
        self.addCleanup(self.conn.rollback)
        self.cur = self.conn.cursor()
        schema = 'test_clarifications_' + uuid4().hex
        self.cur.execute(f'CREATE SCHEMA {schema}')
        self.cur.execute(f'SET LOCAL search_path TO {schema}')
        self.cur.execute('''
            CREATE TABLE roles(id bigint PRIMARY KEY,name text);
            CREATE TABLE users(id bigint PRIMARY KEY,role_id bigint,staff_name text,username text,is_active boolean);
            CREATE TABLE doctors(id bigint PRIMARY KEY,user_id bigint,display_name text);
            CREATE TABLE patients(id bigint PRIMARY KEY,patient_code text,first_name text,last_name text);
            CREATE TABLE admissions(admission_id bigint PRIMARY KEY,patient_id bigint,doctor_id bigint,admission_date timestamptz);
            CREATE TABLE radiology_orders(order_id uuid PRIMARY KEY,patient_id bigint,requested_by bigint,accession_number text,examination text,study_instance_uid text,created_at timestamptz DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE radiology_scan(scan_id bigint PRIMARY KEY,order_id uuid,scan_report text,reviewed_by text,reviewed_at timestamptz,review_status text);
            INSERT INTO roles VALUES(1,'Doctor'),(2,'Radiologist'),(3,'Admin');
            INSERT INTO users VALUES(1,1,'Doctor One','doctor1',true),(2,1,'Doctor Two','doctor2',true),
                (3,2,'Reader One','reader1',true),(4,2,'Reader Two','reader2',true),(5,3,'Admin','admin',true),
                (6,1,'Inactive','inactive',false),(7,1,'Treating Doctor','doctor7',true);
            INSERT INTO doctors VALUES(11,1,'Doctor One'),(12,2,'Doctor Two'),(17,7,'Treating Doctor');
            INSERT INTO patients VALUES(100,'PAT100','Test','Patient'),(200,'PAT200','Other','Patient');
            INSERT INTO admissions VALUES(1,100,17,CURRENT_TIMESTAMP);
        ''')
        migration = (Path(__file__).parents[1] / 'db/migrations/004_radiology_clarifications.sql').read_text()
        self.cur.execute(migration.replace('BEGIN;', '').replace('COMMIT;', ''))
        self.order = str(uuid4())
        self.other = str(uuid4())
        for oid, pid, uid, sid in [(self.order, 100, 1, 1), (self.other, 200, 2, 2)]:
            self.cur.execute("INSERT INTO radiology_orders VALUES(%s,%s,%s,%s,'Chest X-ray PA',%s,CURRENT_TIMESTAMP)", (oid, pid, uid, 'XR' + str(sid), str(sid)))
            self.cur.execute("INSERT INTO radiology_scan VALUES(%s,%s,'Original report','Reader One',CURRENT_TIMESTAMP,'Confirmed')", (sid, oid))
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        patcher = patch('routers.radiology_clarifications.db_config.get_db_connection', return_value=BorrowConnection(self.conn))
        patcher.start()
        self.addCleanup(patcher.stop)

    def call(self, method, path='', user=1, **kwargs):
        headers = {'Authorization': 'Bearer ' + encode_token({'user_id': user})} if user else {}
        return self.client.request(method, '/api/radiology-clarifications' + path, headers=headers, **kwargs)

    def create(self, **overrides):
        fingerprint = self.call('GET', '?order_id=' + self.order).json()['context']['report_fingerprint']
        payload = dict(id=str(uuid4()), order_id=self.order, subject='Clarify this report', priority='Routine', body='Which area is described?', report_fingerprint=fingerprint)
        payload.update(overrides)
        result = self.call('POST', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        return payload

    def test_each_view_has_its_own_discussion_and_review_gate(self):
        self.cur.execute("UPDATE radiology_orders SET examination='Chest X-ray PA + AP' WHERE order_id=%s", (self.order,))
        self.cur.execute("INSERT INTO radiology_scan VALUES(3,%s,'AP pending',NULL,NULL,'Pending Review')", (self.order,))
        context = self.call('GET', f'?order_id={self.order}&scan_id=1').json()['context']
        self.assertIsNotNone(context['reviewed_at'])
        payload = dict(id=str(uuid4()), order_id=self.order, scan_id=1, subject='PA question', body='Please clarify PA', report_fingerprint=context['report_fingerprint'])
        self.assertEqual(self.call('POST', json=payload).status_code, 201)
        self.assertEqual(len(self.call('GET', f'?order_id={self.order}&scan_id=1').json()['threads']), 1)
        self.assertEqual(self.call('GET', f'?order_id={self.order}&scan_id=3').json()['threads'], [])
        pending = self.call('GET', f'?order_id={self.order}&scan_id=3').json()['context']
        self.assertIsNone(pending['reviewed_at'])
        self.assertEqual(self.call('POST', json={**payload, 'id': str(uuid4()), 'scan_id': 3, 'report_fingerprint': pending['report_fingerprint']}).status_code, 409)
        self.assertEqual(self.call('GET', f'?order_id={self.order}&scan_id=2').status_code, 404)
        self.assertEqual(self.call('POST', json={**payload, 'scan_id': 2}).status_code, 404)

    def test_strict_identity_and_patient_access(self):
        for user, status in [(None, 401), (5, 403), (6, 403)]:
            self.assertEqual(self.call('GET', user=user).status_code, status)
        self.assertEqual(self.call('GET', '?order_id=' + self.order, user=2).status_code, 404)
        self.assertEqual(self.call('GET', '?order_id=' + self.order, user=7).status_code, 200)
        thread = self.create()['id']
        self.assertEqual(self.call('GET', '/' + thread, user=2).status_code, 404)
        self.assertEqual(self.call('POST', '/' + thread + '/read', user=2, json={'message_ids': [thread]}).status_code, 404)
        self.assertEqual(self.call('POST', '/' + thread + '/actions', user=2, json={'action': 'resolve'}).status_code, 404)
        self.assertEqual(self.call('POST', '/' + thread + '/messages', user=2, json={'id': str(uuid4()), 'body': 'Unauthorized'}).status_code, 404)
        self.assertEqual(self.call('GET', user=2).json()['threads'], [])

    def test_lifecycle_snapshot_identity_receipts_and_retry(self):
        payload = self.create()
        tid = payload['id']
        self.assertEqual(self.call('POST', json=payload).status_code, 201)
        data = self.call('GET', '/' + tid, user=3).json()
        self.assertEqual(len(data['messages']), 1)
        self.assertEqual(data['messages'][0]['sender_id'], 1)
        self.assertEqual(data['thread']['assigned_to'], 3)
        self.assertEqual(self.call('GET', user=3).json()['threads'][0]['unread'], 1)
        # Viewing the inbox/detail does not claim a read; explicitly acknowledge displayed IDs.
        self.assertEqual(data['reads'], [])
        self.call('POST', '/' + tid + '/read', user=3, json={'message_ids': [tid]})
        stamp = self.call('GET', '/' + tid).json()['reads'][0]['read_at']
        self.call('POST', '/' + tid + '/read', user=3, json={'message_ids': [tid]})
        self.assertEqual(self.call('GET', '/' + tid).json()['reads'][0]['read_at'], stamp)
        self.assertEqual(self.call('GET', user=3).json()['threads'][0]['unread'], 0)
        msg = {'id': str(uuid4()), 'body': 'Please see the upper region.'}
        self.assertEqual(self.call('POST', '/' + tid + '/messages', user=4, json=msg).status_code, 409)
        self.assertEqual(self.call('POST', '/' + tid + '/messages', user=3, json=msg).status_code, 201)
        self.assertEqual(self.call('POST', '/' + tid + '/messages', user=3, json=msg).status_code, 201)
        self.assertEqual(self.call('GET', '/' + tid).json()['thread']['status'], 'Responded')
        self.assertEqual(self.call('POST', '/' + tid + '/actions', user=3, json={'action': 'resolve'}).status_code, 403)
        self.call('POST', '/' + tid + '/actions', json={'action': 'resolve'})
        self.assertEqual(self.call('POST', '/' + tid + '/messages', json={'id': str(uuid4()), 'body': 'Follow up'}).status_code, 409)
        self.call('POST', '/' + tid + '/actions', json={'action': 'reopen'})
        self.call('POST', '/' + tid + '/actions', user=4, json={'action': 'claim'})
        self.cur.execute("UPDATE radiology_scan SET scan_report='Changed report' WHERE order_id=%s", (self.order,))
        final = self.call('GET', '/' + tid).json()
        self.assertEqual(final['thread']['report_snapshot']['scan_report'], 'Original report')
        self.assertEqual(final['thread']['assigned_to'], 4)
        self.assertEqual(final['thread']['status'], 'Open')
        self.assertIsNone(final['thread']['resolved_at'])
        self.assertEqual(len(final['messages']), 2)
        self.assertEqual(len(final['events']), 4)
        self.assertEqual(self.call('POST', json={**payload, 'id': str(uuid4())}).status_code, 409)

    def test_validation_and_read_scope(self):
        payload = self.create()
        tid = payload['id']
        for body in [{'id': str(uuid4()), 'body': '   '}, {'id': str(uuid4()), 'body': 'ok', 'sender_id': 3}]:
            self.assertEqual(self.call('POST', '/' + tid + '/messages', json=body).status_code, 422)
        self.assertEqual(self.call('POST', json={**payload, 'body': 'Different'}).status_code, 409)
        self.assertEqual(self.call('POST', json=payload, user=3).status_code, 403)
        self.call('POST', '/' + tid + '/read', user=3, json={'message_ids': [str(uuid4())]})
        self.assertEqual(self.call('GET', '/' + tid).json()['reads'], [])
        self.cur.execute('UPDATE radiology_scan SET reviewed_at=NULL WHERE order_id=%s', (self.order,))
        self.assertEqual(self.call('POST', json={**payload, 'id': str(uuid4())}).status_code, 409)

    def test_shared_queue_assignment_and_latest_admission(self):
        self.cur.execute("UPDATE radiology_scan SET reviewed_by='Legacy reviewer' WHERE order_id=%s", (self.order,))
        tid = self.create()['id']
        self.assertIsNone(self.call('GET', '/' + tid, user=4).json()['thread']['assigned_to'])
        self.call('POST', '/' + tid + '/messages', user=4, json={'id': str(uuid4()), 'body': 'Reviewed the question.'})
        self.assertEqual(self.call('GET', '/' + tid).json()['thread']['assigned_to'], 4)
        # Prior attending access is removed when a newer admission has another doctor.
        self.cur.execute('INSERT INTO admissions VALUES(2,100,12,CURRENT_TIMESTAMP)')
        self.assertEqual(self.call('GET', '/' + tid, user=7).status_code, 404)
        self.assertEqual(self.call('GET', '/' + tid, user=2).status_code, 200)
        # Original ordering doctor retains access independent of admission changes.
        self.assertEqual(self.call('GET', '/' + tid, user=1).status_code, 200)


if __name__ == '__main__':
    unittest.main()
