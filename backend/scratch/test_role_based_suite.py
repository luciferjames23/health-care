import sys, os
sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import db_config
from services.rag_search_service import search_service
from services.rag_generation_service import generation_service

def run_query(user, area, q):
    print("=" * 60)
    print(f"[{user['role'].upper()}: {user['name']}] QUERY: {q}")
    try:
        sources, strat = search_service.search(query=q, area=area, user=user)
        print(f"Retrieved {len(sources)} sources (strategy: {strat})")
        if sources:
            top = sources[0]
            print(f"Top source: #{top['id']} [{top['source_record_id']}] - {top['title'][:70]} (score: {top['relevance_score']})")
        ans = generation_service.generate_answer(question=q, area=area, role=user['role'], sources=sources)
        print("ANSWER:\n" + ans["answer"])
    except PermissionError as pe:
        print("RBAC ENFORCED:", pe)
    except Exception as e:
        print("ERROR:", e)

# 1. RADIOLOGIST
user_rad = {"user_id": 1032, "role": "radiologist", "name": "Dr. Vilson M"}
print("\n" + "#" * 60)
print("1. RADIOLOGIST WORKSPACE")
print("#" * 60)
run_query(user_rad, "radiology", "how many clarifications received")
run_query(user_rad, "radiology", "how many high review flag routine")
run_query(user_rad, "radiology", "details for accession XR4B3CAA10CE2346")

# 2. DOCTOR: DR. PRIYA PATEL
user_priya = {"user_id": 1, "role": "doctor", "name": "Dr. Priya Patel"}
print("\n" + "#" * 60)
print("2. DOCTOR WORKSPACE: DR. PRIYA PATEL")
print("#" * 60)
run_query(user_priya, "doctor_workspace", "how many ip, op, discharged")
run_query(user_priya, "doctor_workspace", "What medicines is Muruganya taking?")
run_query(user_priya, "doctor_workspace", "When was Muruganya admitted and what is the bed number?")
run_query(user_priya, "doctor_workspace", "What is the bill status of Muruganya?")
run_query(user_priya, "doctor_workspace", "details for accession XR4B3CAA10CE2346")

# 3. DOCTOR: DR. NEHA NAIR
user_neha = {"user_id": 5, "role": "doctor", "name": "Dr. Neha Nair"}
print("\n" + "#" * 60)
print("3. DOCTOR WORKSPACE: DR. NEHA NAIR")
print("#" * 60)
run_query(user_neha, "doctor_workspace", "all patient conditions")
run_query(user_neha, "doctor_workspace", "vitals for Divyaya Parthalan")

# 4. DOCTOR: DR. DIVYA VERMA
user_divya = {"user_id": 7, "role": "doctor", "name": "Dr. Divya Verma"}
print("\n" + "#" * 60)
print("4. DOCTOR WORKSPACE: DR. DIVYA VERMA")
print("#" * 60)
run_query(user_divya, "doctor_workspace", "how many ip, op, discharged")
run_query(user_divya, "doctor_workspace", "all patient conditions")
run_query(user_divya, "doctor_workspace", "vitals for Lakshmiya Parthalan")
