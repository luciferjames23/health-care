import unittest
from unittest.mock import MagicMock, patch
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from api.auth_helper import require_radiologist, encode_token

class RadiologyAccessTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        @app.get('/protected')
        def protected(user=Depends(require_radiologist)):
            return user
        self.client = TestClient(app)
        self.connection = MagicMock()
        self.cursor = self.connection.__enter__.return_value.cursor.return_value.__enter__.return_value
        self.db = patch('api.auth_helper.db_config.get_db_connection', return_value=self.connection).start()
        self.addCleanup(patch.stopall)

    def get(self, payload):
        return self.client.get('/protected', headers={'Authorization': 'Bearer ' + encode_token(payload)})

    def test_missing_or_invalid_session(self):
        self.assertEqual(self.client.get('/protected').status_code, 401)
        self.assertEqual(self.client.get('/protected', headers={'Authorization':'Bearer fake'}).status_code,401)
        self.db.assert_not_called()

    def test_expired_session(self):
        self.assertEqual(self.get({'user_id':1,'exp':1}).status_code,401)

    def test_role_in_token_does_not_override_database(self):
        for role in ('Admin', 'Doctor'):
            self.cursor.fetchone.return_value = (1, 'user', role, True, 'Name')
            self.assertEqual(self.get({'user_id':1,'role':'RADIOLOGIST'}).status_code,403)

    def test_active_radiologist_is_allowed(self):
        self.cursor.fetchone.return_value = (1, 'reader', 'Radiologist', True, 'Dr Reader')
        response = self.get({'user_id':1})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['name'],'Dr Reader')

    def test_deactivated_or_deleted_user(self):
        for row in (None, (1, 'reader', 'Radiologist', False, 'Name')):
            self.cursor.fetchone.return_value = row
            self.assertEqual(self.get({'user_id':1}).status_code,403)

    def test_database_failure_denies_access(self):
        self.db.side_effect = RuntimeError('offline')
        self.assertEqual(self.get({'user_id':1}).status_code,503)

if __name__ == '__main__':
    unittest.main()
