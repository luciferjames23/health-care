import unittest
from unittest.mock import MagicMock, patch
import bcrypt
from fastapi import HTTPException
from starlette.requests import Request
from api.auth_helper import decode_token
from api.auth_routes import login, LoginRequest, select_account, AccountSelectionRequest


class DoctorLoginTests(unittest.TestCase):
    def setUp(self):
        self.conn = MagicMock()
        self.cursor = self.conn.cursor.return_value
        self.password = 'test-only-doctor-password'
        self.password_hash = bcrypt.hashpw(self.password.encode(), bcrypt.gensalt(rounds=4)).decode()
        self.cursor.fetchone.side_effect = [
            (42, 'test_doctor', self.password_hash, True, 'Doctor', None, None),
            (12, 'Test Doctor', 'General Medicine'),
        ]
        patcher = patch('api.auth_routes.db_config.get_db_connection', return_value=self.conn)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_verified_password_creates_order_eligible_session(self):
        result = login(LoginRequest(username='test_doctor', password=self.password, role='Radiologist'))
        payload = decode_token(result['token'])
        self.assertEqual(payload['auth_method'], 'password')
        self.assertEqual(payload['user_id'], 42)
        self.assertEqual(payload['role'], 'DOCTOR')
        self.assertFalse(result['user']['canAccessRadiology'])
        self.conn.commit.assert_called_once()

    def test_wrong_password_is_rejected(self):
        with self.assertRaises(HTTPException) as error:
            login(LoginRequest(username='test_doctor', password='wrong-password'))
        self.assertEqual(error.exception.status_code, 401)
        self.conn.commit.assert_not_called()

    def test_doctor_can_use_local_account_selection(self):
        self.conn.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value = (
            42, 'test_doctor', 'Doctor', 'Test Doctor', 'General Medicine', 12, 'Physician')
        result = select_account(AccountSelectionRequest(username='test_doctor'), Request({'type':'http','client':('127.0.0.1',123)}))
        payload = decode_token(result['token'])
        self.assertEqual(payload['auth_method'], 'account_selection')
        self.assertEqual(payload['user_id'], 42)
        self.assertEqual(payload['role'], 'Doctor')
        self.assertFalse(result['user']['canAccessRadiology'])



if __name__ == '__main__': unittest.main()
