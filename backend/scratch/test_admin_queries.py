import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. DEPARTMENTS ===")
cur.execute("""
    SELECT d.id, d.name, d.code, d.floor, d.description,
           COUNT(DISTINCT doc.id) as doctor_count,
           COUNT(DISTINCT w.ward_id) as ward_count
    FROM departments d
    LEFT JOIN doctors doc ON d.id = doc.department_id
    LEFT JOIN wards w ON d.id = w.department_id
    GROUP BY d.id, d.name, d.code, d.floor, d.description
    ORDER BY d.id;
""")
for r in cur.fetchall():
    print("  Dept:", dict(r))

print("\n=== 2. USERS (Sample 5) ===")
cur.execute("""
    SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.staff_code, u.staff_type,
           r.name as role_name, d.name as department_name, u.is_active, u.created_at
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON u.department_id = d.id
    ORDER BY u.id ASC
    LIMIT 5;
""")
for r in cur.fetchall():
    print("  User:", dict(r))

print("\n=== 3. ROLES ===")
cur.execute("""
    SELECT r.id, r.name, r.description, COUNT(u.id) as user_count
    FROM roles r
    LEFT JOIN users u ON r.id = u.role_id
    GROUP BY r.id, r.name, r.description
    ORDER BY r.id ASC;
""")
for r in cur.fetchall():
    print("  Role:", dict(r))

print("\n=== 4. SERVICES ===")
cur.execute("""
    SELECT bs.billing_service_id, bs.service_code, bs.service_name, bs.service_category,
           bs.standard_charge, bs.status, d.name as department_name
    FROM billing_services bs
    LEFT JOIN departments d ON bs.department_id = d.id
    ORDER BY bs.billing_service_id ASC;
""")
for r in cur.fetchall():
    print("  Service:", dict(r))

print("\n=== 5. INSURERS (from insurance_claims) ===")
cur.execute("""
    SELECT insurance_provider, COUNT(*) as claim_count,
           COALESCE(SUM(claimed_amount), 0) as total_claimed,
           COALESCE(SUM(approved_amount), 0) as total_approved,
           COUNT(CASE WHEN claim_status = 'Settled Cashless' THEN 1 END) as settled_count
    FROM insurance_claims
    GROUP BY insurance_provider
    ORDER BY claim_count DESC;
""")
for r in cur.fetchall():
    print("  Insurer:", dict(r))

print("\n=== 6. PAYMENT METHODS (from payments) ===")
cur.execute("""
    SELECT payment_method, COUNT(*) as txn_count,
           COALESCE(SUM(amount), 0) as total_collected,
           COUNT(CASE WHEN payment_status = 'SUCCESS' THEN 1 END) as success_count
    FROM payments
    GROUP BY payment_method
    ORDER BY txn_count DESC;
""")
for r in cur.fetchall():
    print("  Payment Method:", dict(r))

print("\n=== 7. FACILITIES (Wards & Beds) ===")
cur.execute("""
    SELECT w.ward_id, w.ward_name, w.ward_type, w.floor_number,
           COUNT(DISTINCT r.room_id) as room_count,
           COUNT(DISTINCT b.bed_id) as bed_count
    FROM wards w
    LEFT JOIN rooms r ON w.ward_id = r.ward_id
    LEFT JOIN beds b ON w.ward_id = b.ward_id
    GROUP BY w.ward_id, w.ward_name, w.ward_type, w.floor_number
    ORDER BY w.ward_id ASC;
""")
for r in cur.fetchall():
    print("  Ward:", dict(r))

conn.close()
