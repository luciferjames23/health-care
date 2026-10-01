import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import psycopg2
from psycopg2.extras import RealDictCursor
import db_config

def test_query():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    doc_id = 1017  # Dr. Edwin Stephano J

    print("--- TESTING OLD OP QUERY (with OPD_DESK filter) ---")
    cur.execute("""
        SELECT DISTINCT ON (apt.patient_id)
            p.id AS patient_id,
            p.patient_code,
            (p.first_name || ' ' || COALESCE(p.last_name, '')) AS patient_name,
            COALESCE(d.display_name, 'Consultant Doctor') AS doctor,
            apt.status AS status,
            apt.booking_source
        FROM appointments apt
        JOIN patients p ON p.id = apt.patient_id
        LEFT JOIN doctors d ON d.id = apt.doctor_id
        WHERE (apt.booking_source = 'OPD_DESK' OR apt.booking_id LIKE 'APT-2026-%')
        ORDER BY apt.patient_id, apt.appointment_date DESC, apt.id DESC;
    """)
    old_rows = cur.fetchall()
    print("Old OP Rows Total:", len(old_rows))
    print("Old OP Rows for Dr. Edwin:", [r for r in old_rows if r['doctor'] == 'Dr. Edwin Stephano J'])

    print("\n--- TESTING FIXED OP QUERY (without OPD_DESK hardcoded filter) ---")
    cur.execute("""
        SELECT DISTINCT ON (apt.patient_id)
            p.id AS patient_id,
            p.patient_code,
            (p.first_name || ' ' || COALESCE(p.last_name, '')) AS patient_name,
            COALESCE(d.display_name, 'Consultant Doctor') AS doctor,
            apt.status AS status,
            apt.booking_source
        FROM appointments apt
        JOIN patients p ON p.id = apt.patient_id
        LEFT JOIN doctors d ON d.id = apt.doctor_id
        WHERE apt.status != 'CANCELLED'
        ORDER BY apt.patient_id, apt.appointment_date DESC, apt.id DESC;
    """)
    fixed_rows = cur.fetchall()
    print("Fixed OP Rows Total:", len(fixed_rows))
    edwin_fixed = [r for r in fixed_rows if r['doctor'] == 'Dr. Edwin Stephano J']
    print("Fixed OP Rows for Dr. Edwin:", edwin_fixed)

    conn.close()

if __name__ == "__main__":
    test_query()
