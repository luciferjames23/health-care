import sys, os
sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import db_config
from services.rag_search_service import search_service
from services.rag_generation_service import generation_service

user_priya = {"user_id": 1, "role": "doctor", "name": "Dr. Priya Patel"}
queries = [
    "how many ip ,op discharget",
    "all patient conditions",
    "bill ststus",
    "xray ststus whos xrqy if high priority",
    "one patient vitel",
    "Muruganya vitals"
]

for q in queries:
    print("=" * 60)
    print("QUERY:", q)
    sources, strat = search_service.search(query=q, area="doctor_workspace", user=user_priya)
    print(f"Retrieved {len(sources)} sources (strategy: {strat})")
    if sources:
        top = sources[0]
        print(f"Top source: #{top['id']} [{top['source_record_id']}] - {top['title'][:80]} (score: {top['relevance_score']})")
    ans = generation_service.generate_answer(question=q, area="doctor_workspace", role="doctor", sources=sources)
    print("ANSWER:\n", ans["answer"][:400] if ans.get("answer") else "None")

user_ravi = {"user_id": 2, "role": "doctor", "name": "Dr. Ravi Reddy"}
print("\n" + "#" * 60)
print("TESTING DYNAMIC SCOPING FOR DR. RAVI REDDY")
print("#" * 60)
for q in ["how many ip, op, discharged", "all patient conditions", "bill status", "xray status"]:
    print("=" * 60)
    print("QUERY:", q)
    sources, strat = search_service.search(query=q, area="doctor_workspace", user=user_ravi)
    if sources:
        top = sources[0]
        print(f"Top source: #{top['id']} [{top['source_record_id']}] - {top['title'][:80]}")
    ans = generation_service.generate_answer(question=q, area="doctor_workspace", role="doctor", sources=sources)
    print("ANSWER:\n", ans["answer"][:300] if ans.get("answer") else "None")
