"""Follow-up integration tests use the rollback-only synthetic schema fixture."""
import unittest
from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api.auth_helper import encode_token
from routers.imaging_orders import router as orders_router
from routers.imaging_history import router as history_router
from tests.test_radiology_clarifications import ClarificationTests


class ImagingHistoryTests(unittest.TestCase):
    def setUp(self):
        ClarificationTests.setUp(self)
        self.cur.execute('''ALTER TABLE radiology_orders ADD COLUMN indication text DEFAULT 'Chest symptoms',
            ADD COLUMN priority text DEFAULT 'Routine',ADD COLUMN status text DEFAULT 'Requested',
            ADD COLUMN uploaded_at timestamptz;
            ALTER TABLE radiology_scan ADD COLUMN image text,ADD COLUMN radiologist_finding text,ADD COLUMN study_id text,ADD COLUMN dl_response jsonb;
            UPDATE radiology_orders SET created_at=CURRENT_TIMESTAMP - INTERVAL '3 days';''')
        migration = (Path(__file__).parents[1] / 'db/migrations/005_imaging_followups.sql').read_text()
        self.cur.execute(migration.replace('BEGIN;', '').replace('COMMIT;', ''))
        self.cur.execute('''ALTER TABLE radiology_orders ADD COLUMN upload_started_at timestamptz,
            ADD COLUMN uploaded_by bigint, ADD COLUMN upload_sha256 text,
            ADD COLUMN orthanc_instance_id text, ADD COLUMN orthanc_study_id text;''')
        migration = (Path(__file__).parents[1] / 'db/migrations/006_multi_study_orders.sql').read_text()
        self.cur.execute(migration.replace('BEGIN;', '').replace('COMMIT;', ''))
        app = FastAPI()
        app.include_router(orders_router)
        app.include_router(history_router)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def call(self, method, path='', user=1, **kwargs):
        headers = {'Authorization': 'Bearer ' + encode_token({'user_id': user})} if user else {}
        return self.client.request(method, '/api/imaging-orders' + path, headers=headers, **kwargs)

    def payload(self, **values):
        return dict(patient_id=100, examination='Chest X-ray PA', indication='Persistent symptoms',
                    request_id=str(uuid4()), **values)

    def create(self, **values):
        payload = self.payload(**values)
        result = self.call('POST', json=payload)
        self.assertEqual(result.status_code, 201, result.text)
        return result.json(), payload

    def test_new_problem_followups_numbering_retry_and_history(self):
        baseline, _ = self.create(clinical_problem='Chest symptom monitoring')
        self.assertEqual(baseline['study_version'], 1)
        self.assertIsNone(baseline['root_order_id'])
        followup, payload = self.create(follow_up_of=baseline['order_id'])
        self.assertEqual(followup['study_version'], 2)
        self.assertEqual(followup['clinical_problem'], 'Chest symptom monitoring')
        retry = self.call('POST', json=payload)
        self.assertEqual(retry.status_code, 201, retry.text)
        self.assertEqual(retry.json()['study_version'], 2)
        third, _ = self.create(follow_up_of=followup['order_id'])
        self.assertEqual(third['root_order_id'], baseline['order_id'])
        self.assertEqual(third['study_version'], 3)
        history = self.call('GET', f"/{third['order_id']}/history").json()
        self.assertEqual([s['study_version'] for s in history['studies']], [1, 2, 3])
        self.assertEqual(len(history['events']), 1)
        self.assertEqual(len(self.call('GET', f'/{self.order}/history').json()['studies']), 1)
        conflict = self.call('POST', json={**payload, 'follow_up_of': self.order})
        self.assertEqual(conflict.status_code, 409)

    def test_compare_requires_same_patient_problem_and_earlier_version(self):
        second, _ = self.create(follow_up_of=self.order)
        sid = second['order_id']
        self.cur.execute("INSERT INTO radiology_scan(scan_id,order_id,order_study_id,scan_report,image,review_status) VALUES(3,%s,%s,'Follow-up report','preview','Pending')", (sid,sid))
        response = self.call('GET', f'/{sid}/comparison?prior_order_id={self.order}', user=3)
        self.assertEqual(response.status_code, 200, response.text)
        pair = response.json()
        self.assertEqual(pair['prior']['order_id'], self.order)
        self.assertEqual(pair['current']['scan_report'], 'Follow-up report')
        self.assertIsNone(pair['current']['reviewed_at'])
        independent, _ = self.create()
        for earlier in [self.other, independent['order_id'], sid]:
            self.assertEqual(self.call('GET', f'/{sid}/comparison?prior_order_id={earlier}', user=3).status_code, 422)
        self.assertEqual(self.call('GET', f'/{self.order}/comparison?prior_order_id={sid}').status_code, 422)
        self.assertEqual(self.call('GET', f'/{sid}/history', user=2).status_code, 404)
        self.assertEqual(self.call('GET', f'/{sid}/history', user=None).status_code, 401)

    def test_explicit_legacy_link_and_audited_correction_preserve_reports(self):
        later, _ = self.create()
        lid = later['order_id']
        link = {'prior_order_id': self.order, 'reason': 'Same ongoing clinical problem'}
        self.assertEqual(self.call('POST', f'/{lid}/follow-up', user=3, json=link).status_code, 403)
        self.assertEqual(self.call('POST', f'/{lid}/follow-up', json=link).status_code, 200)
        self.assertEqual(self.call('POST', f'/{lid}/follow-up', json=link).status_code, 200)
        history = self.call('GET', f'/{lid}/history').json()
        self.assertEqual(len(history['studies']), 2)
        self.assertEqual(history['studies'][0]['scan_report'], 'Original report')
        self.assertEqual(len(history['events']), 1)
        third, _ = self.create(follow_up_of=lid)
        self.assertEqual(self.call('POST', f'/{lid}/separate-problem', json={'reason': 'Wrong episode'}).status_code, 409)
        self.assertEqual(self.call('POST', f'/{third["order_id"]}/separate-problem', json={'reason': 'Different problem'}).status_code, 200)
        self.assertEqual(self.call('POST', f'/{lid}/separate-problem', json={'reason': 'Different problem'}).status_code, 200)
        final = self.call('GET', f'/{lid}/history').json()
        self.assertEqual(len(final['studies']), 1)
        self.assertEqual(final['studies'][0]['study_version'], 1)
        self.assertEqual(len(final['events']), 2)

    def test_link_rejects_patient_mismatch_cycles_and_out_of_order_history(self):
        self.assertEqual(self.call('POST', json=self.payload(follow_up_of=self.other), user=7).status_code, 404)
        link = {'prior_order_id': self.order, 'reason': 'Same symptoms'}
        self.assertEqual(self.call('POST', f'/{self.order}/follow-up', json=link).status_code, 422)
        recent, _ = self.create(follow_up_of=self.order)
        earlier, _ = self.create()
        self.cur.execute("UPDATE radiology_orders SET created_at=CURRENT_TIMESTAMP - INTERVAL '2 days' WHERE order_id=%s", (earlier['order_id'],))
        self.assertEqual(self.call('POST', f'/{earlier["order_id"]}/follow-up', json=link).status_code, 409)
        self.assertEqual(self.call('POST', f'/{self.order}/follow-up', json={**link, 'prior_order_id': recent['order_id']}).status_code, 409)
        self.assertEqual(self.call('POST', json=self.payload(follow_up_of=self.order, clinical_problem='Different condition')).status_code, 422)


if __name__ == '__main__':
    unittest.main()
