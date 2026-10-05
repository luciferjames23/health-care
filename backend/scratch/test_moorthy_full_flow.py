import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.clinical_operations import get_all_patients_directory
import db_config
from psycopg2.extras import RealDictCursor

def test():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Resolve Dr. Moorthy D doctor record
    cur.execute("SELECT id, user_id, display_name FROM doctors WHERE display_name LIKE '%Moorthy%';")
    doc = cur.fetchone()
    print("Resolved Doctor Record:", doc)
    doc_id = doc['id']
    assert doc_id == 1018, f"Expected doc_id 1018, got {doc_id}"

    # 2. Call get_all_patients_directory for doctor_id 1018
    res = get_all_patients_directory(category="OP", doctor_id=doc_id)
    print("\nAPI Response Structure:")
    print("  Keys:", res.keys() if isinstance(res, dict) else "List")
    patients = res.get("data", []) if isinstance(res, dict) else res
    print(f"Total OP Patients returned for Dr. Moorthy D (doctor_id={doc_id}): {len(patients)}")
    for p in patients:
        print(f"  - Patient ID: {p['patient_id']} | Code: {p['patient_code']} | Name: {p['patient_name']} | Doctor: {p['doctor']} | Status: {p['status']}")

    assert len(patients) >= 3, f"Expected at least 3 patients for Dr. Moorthy D, got {len(patients)}"
    
    # Verify John Peter (patient 1004296) is present
    john_peter = [p for p in patients if "John Peter" in p['patient_name'] or p['patient_id'] == 1004296]
    print(f"\nWhatsApp Patient 'John Peter' present? {len(john_peter) > 0}")
    if john_peter:
        print("  Found:", john_peter[0])
    assert len(john_peter) > 0, "WhatsApp patient John Peter MUST be present for Dr. Moorthy D!"

    conn.close()
    print("\nSUCCESS: All Backend Doctor Portal Patient checks for Dr. Moorthy D PASSED!")

if __name__ == "__main__":
    test()
