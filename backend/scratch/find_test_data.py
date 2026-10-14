import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

def find_test_data():
    conn = get_db_connection()
    cur = conn.cursor()

    print("=== 1. Phone numbers with multiple patients ===")
    cur.execute("""
        SELECT phone, COUNT(*) as c, array_agg(id) as ids, array_agg(first_name || ' ' || last_name) as names
        FROM patients
        WHERE phone IS NOT NULL AND status = 'ACTIVE'
        GROUP BY phone
        HAVING COUNT(*) > 1
        LIMIT 5;
    """)
    for r in cur.fetchall():
        print(f"  Phone: {r[0]} | Count: {r[1]} | IDs: {r[2]} | Names: {r[3]}")

    print("\n=== 2. Phone numbers with single patient ===")
    cur.execute("""
        SELECT phone, id, first_name || ' ' || last_name as name, patient_code
        FROM patients
        WHERE phone IS NOT NULL AND status = 'ACTIVE'
        LIMIT 5;
    """)
    for r in cur.fetchall():
        print(f"  Phone: {r[0]} | ID: {r[1]} | Name: {r[2]} | Code: {r[3]}")

    print("\n=== 3. Patients with X-Ray scans (with image) ===")
    cur.execute("""
        SELECT rs.patient_id, p.first_name || ' ' || p.last_name, p.phone, rs.scan_id, rs.scan_type, rs.review_status, length(rs.image)
        FROM radiology_scan rs
        JOIN patients p ON rs.patient_id = p.id
        WHERE rs.image IS NOT NULL
        LIMIT 5;
    """)
    for r in cur.fetchall():
        print(f"  Patient ID: {r[0]} | Name: {r[1]} | Phone: {r[2]} | Scan ID: {r[3]} | Type: {r[4]} | Status: {r[5]} | ImgLen: {r[6]}")

    print("\n=== 4. Patients with X-Ray scans (report only, no image) ===")
    cur.execute("""
        SELECT rs.patient_id, p.first_name || ' ' || p.last_name, p.phone, rs.scan_id, rs.scan_type, rs.review_status
        FROM radiology_scan rs
        JOIN patients p ON rs.patient_id = p.id
        WHERE rs.image IS NULL AND (rs.scan_report IS NOT NULL OR rs.findings IS NOT NULL)
        LIMIT 5;
    """)
    for r in cur.fetchall():
        print(f"  Patient ID: {r[0]} | Name: {r[1]} | Phone: {r[2]} | Scan ID: {r[3]} | Type: {r[4]} | Status: {r[5]}")

    print("\n=== 5. Patients with Discharge Summaries (Approved / Signed) ===")
    cur.execute("""
        SELECT ds.patient_id, p.first_name || ' ' || p.last_name, p.phone, ds.summary_id, ds.approval_status, ds.discharge_date
        FROM dim_generated_discharge_summaries ds
        JOIN patients p ON ds.patient_id = p.id
        WHERE ds.approval_status = 'Approved'
        LIMIT 5;
    """)
    for r in cur.fetchall():
        print(f"  Patient ID: {r[0]} | Name: {r[1]} | Phone: {r[2]} | Summary ID: {r[3]} | Status: {r[4]} | Date: {r[5]}")

    print("\n=== 6. Patients with Discharge Summaries (Pending Approval) ===")
    cur.execute("""
        SELECT ds.patient_id, p.first_name || ' ' || p.last_name, p.phone, ds.summary_id, ds.approval_status, ds.discharge_date
        FROM dim_generated_discharge_summaries ds
        JOIN patients p ON ds.patient_id = p.id
        WHERE ds.approval_status = 'Pending Approval'
        LIMIT 5;
    """)
    for r in cur.fetchall():
        print(f"  Patient ID: {r[0]} | Name: {r[1]} | Phone: {r[2]} | Summary ID: {r[3]} | Status: {r[4]} | Date: {r[5]}")

    print("\n=== 7. Patients with Bills, Payments, and Balances ===")
    cur.execute("""
        SELECT b.patient_id, p.first_name || ' ' || p.last_name, p.phone, b.bill_id, b.bill_number, b.net_amount, b.patient_amount, b.bill_status
        FROM bills b
        JOIN patients p ON b.patient_id = p.id
        WHERE b.bill_status NOT IN ('Settled', 'Paid')
        ORDER BY b.bill_id DESC
        LIMIT 5;
    """)
    for r in cur.fetchall():
        print(f"  Patient ID: {r[0]} | Name: {r[1]} | Phone: {r[2]} | Bill ID: {r[3]} | Number: {r[4]} | Net: {r[5]} | PatAmt: {r[6]} | Status: {r[7]}")

    conn.close()

if __name__ == '__main__':
    find_test_data()
