import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.auth_routes import login, LoginRequest

req = LoginRequest(username="MD", password="password123", role="doctor")
res = login(req)
print("Login result for MD:")
print(" Token present?", "token" in res)
print(" User payload:", res.get("user"))
