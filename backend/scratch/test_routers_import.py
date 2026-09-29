import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

routers = [
    ("gold", "routers.gold"),
    ("bronze", "routers.bronze"),
    ("notebook", "routers.notebook"),
    ("jobrun", "routers.jobrun"),
    ("discharge_agent", "routers.discharge_agent"),
    ("discharge_summary_llm", "routers.discharge_summary_llm"),
    ("radiology", "routers.radiology"),
    ("agent", "agent.router"),
    ("financial_revenue", "routers.financial_revenue"),
    ("clinical_operations", "routers.clinical_operations"),
    ("appointments_proto", "routers.appointments_proto"),
    ("rcm_beds", "routers.rcm_beds"),
    ("agent_routes", "api.agent_routes"),
    ("whatsapp_routes", "api.whatsapp_routes"),
    ("dashboard_routes", "api.dashboard_routes"),
    ("auth_routes", "api.auth_routes"),
]

print("--- ROUTER IMPORT TEST ---")
for name, mod_path in routers:
    try:
        mod = __import__(mod_path, fromlist=['router'])
        print(f"[OK] {name} ({mod_path})")
    except Exception as e:
        import traceback
        print(f"[FAIL] {name} ({mod_path}): {e}")
        traceback.print_exc()
