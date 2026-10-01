import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.clinical_operations import get_all_patients_directory

res_op = get_all_patients_directory(category="OP", doctor_id=1018)
print("Type of res_op:", type(res_op))
if isinstance(res_op, dict):
    print("res_op keys:", res_op.keys())
    data = res_op.get("data", [])
    print(f"Data count: {len(data)}")
    for item in data[:3]:
        print(" ", item)
elif isinstance(res_op, list):
    print("res_op length:", len(res_op))
    for item in res_op[:3]:
        print(" ", type(item), item)
