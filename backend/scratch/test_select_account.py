import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.auth_routes import select_account, AccountSelectionRequest
from fastapi import Request

def test_select():
    # Let's test with test accounts
    class DummyRequest:
        client = type("Client", (), {"host": "127.0.0.1"})()
        headers = {}
        scope = {}
    
    for username in ["meera.iyer", "arjun.menon", "priya.narayanan", "admin", "doctor_1"]:
        try:
            res = select_account(AccountSelectionRequest(username=username), DummyRequest())
            print(f"SUCCESS select_account({username}):")
            print("  token user:", res.get("user"))
        except Exception as e:
            print(f"FAILED select_account({username}): {type(e).__name__}: {e}")

if __name__ == '__main__':
    test_select()
