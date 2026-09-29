import difflib, os

proto_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\Healthcare-Prototype\backend"
main_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"

files_to_compare = [
    r"api\whatsapp_routes.py",
    r"api\agent_routes.py",
    r"agent\llm_service.py",
    r"agent\llm_intent_router.py",
    r"agent\patient_identification_service.py",
    r"agent\state_manager.py",
    r"agent\intent_detector.py",
    r"agent\intent_router.py",
]

for rel in files_to_compare:
    f1 = os.path.join(proto_dir, rel)
    f2 = os.path.join(main_dir, rel)
    if os.path.exists(f1) and os.path.exists(f2):
        with open(f1, 'r', encoding='utf-8', errors='ignore') as file1:
            l1 = file1.readlines()
        with open(f2, 'r', encoding='utf-8', errors='ignore') as file2:
            l2 = file2.readlines()
        diff = list(difflib.unified_diff(l1, l2, fromfile=f"Proto {rel}", tofile=f"Main {rel}"))
        print(f"\n==================================================")
        print(f"DIFF FOR {rel} (Total diff lines: {len(diff)})")
        print(f"==================================================")
        for line in diff[:60]:
            print(line, end='')
