import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.auth_routes import get_auth_users

def test():
    users_res = get_auth_users()
    users = users_res.get("users", [])
    print(f"Total users in /api/auth/users: {len(users)}")
    for u in users:
        if u.get("role") in ["Admin", "Doctor", "Hospital Management"]:
            print(f"  User: id={u.get('id')}, username={u.get('username')}, role={u.get('role')}, name={u.get('name')}")

if __name__ == '__main__':
    test()
