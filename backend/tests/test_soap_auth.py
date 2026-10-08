import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.auth_helper import encode_token
from routers import soap_notes


class SoapHistoryAuthenticationTests(unittest.TestCase):
    def test_history_requires_auth_and_uses_identity_from_current_bearer_token(self):
        app = FastAPI()
        app.include_router(soap_notes.router)
        token = encode_token({
            "user_id": 42,
            "username": "doctor_6",
            "role": "DOCTOR",
            "auth_method": "account_selection",
        })
        with patch.dict(os.environ, {"RAG_DEV_MODE": "0"}), patch.object(
            soap_notes.service, "list_notes", return_value=[]
        ) as list_notes:
            client = TestClient(app)
            anonymous = client.get("/api/v1/soap/notes?patient_id=142908")
            self.assertEqual(anonymous.status_code, 401)

            authorized = client.get(
                "/api/v1/soap/notes?patient_id=142908",
                headers={"Authorization": f"Bearer {token}"},
            )
            self.assertEqual(authorized.status_code, 200)
            self.assertEqual(authorized.json(), {"notes": []})
            authenticated_user = list_notes.call_args.args[0]
            self.assertEqual(authenticated_user["user_id"], 42)
            self.assertEqual(authenticated_user["username"], "doctor_6")
            self.assertEqual(authenticated_user["auth_method"], "account_selection")


if __name__ == "__main__":
    unittest.main()
