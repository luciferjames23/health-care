import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.clinical_operations import get_all_patients_directory

def test():
    print("Testing get_all_patients_directory with doctor_id=1018 (Dr. Moorthy D)...")
    res_op = get_all_patients_directory(category="OP", doctor_id=1018)
    print(f"Total OP Patients returned for doctor_id=1018: {len(res_op)}")
    for p in res_op:
        print("  - Patient ID:", p["patient_id"], "| Name:", p["patient_name"], "| Doctor:", p["doctor"], "| Status:", p["status"])

    assert len(res_op) >= 3, f"Expected at least 3 OP patients for Dr. Moorthy D, got {len(res_op)}"
    print("SUCCESS: Doctor ID 1018 correctly returns all appointment-linked patients!")

if __name__ == "__main__":
    test()
