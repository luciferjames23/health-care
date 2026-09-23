import unittest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from starlette.requests import Request
from api.auth_routes import select_account, AccountSelectionRequest

class AccountSelectionTests(unittest.TestCase):
    def test_remote_request_cannot_select_account(self):
        request=Request({'type':'http','client':('192.0.2.1',123)})
        with self.assertRaises(HTTPException) as error:
            select_account(AccountSelectionRequest(username='admin'),request)
        self.assertEqual(error.exception.status_code,403)

    def test_temporary_cloudflare_origin_is_allowed_only_when_enabled(self):
        conn=MagicMock()
        cursor=conn.__enter__.return_value.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value=(7,'radiologist','Radiologist','Dr. Test','Radiology',9,'Radiologist')
        request=Request({
            'type':'http',
            'client':('192.0.2.1',123),
            'headers':[(b'origin',b'https://example.trycloudflare.com')],
        })
        with patch.dict('os.environ',{'ALLOW_TEMPORARY_CLOUDFLARE_LOGIN':'true'}), \
             patch('api.auth_routes.db_config.get_db_connection',return_value=conn):
            result=select_account(AccountSelectionRequest(username='radiologist'),request)
        self.assertTrue(result['success'])
        self.assertTrue(result['user']['canAccessRadiology'])

    def test_similar_untrusted_origin_is_denied(self):
        request=Request({
            'type':'http',
            'client':('192.0.2.1',123),
            'headers':[(b'origin',b'https://trycloudflare.com.example.test')],
        })
        with patch.dict('os.environ',{'ALLOW_TEMPORARY_CLOUDFLARE_LOGIN':'true'}):
            with self.assertRaises(HTTPException) as error:
                select_account(AccountSelectionRequest(username='admin'),request)
        self.assertEqual(error.exception.status_code,403)

    def test_inactive_or_unknown_account_is_denied(self):
        conn=MagicMock()
        conn.__enter__.return_value.cursor.return_value.__enter__.return_value.fetchone.return_value=None
        with patch('api.auth_routes.db_config.get_db_connection',return_value=conn):
            with self.assertRaises(HTTPException) as error:
                select_account(AccountSelectionRequest(username='missing'),Request({'type':'http','client':('127.0.0.1',123)}))
        self.assertEqual(error.exception.status_code,403)

if __name__=='__main__': unittest.main()
