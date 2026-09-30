import sys, os, re
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.path.insert(0, r'e:\Bosco-projects\POC\Health-care\code\health-care\backend')
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

print("=== SAMPLE NOTIFICATIONS WITH MESSAGES (to find embedded names) ===")
cur.execute("""
    SELECT n.id, n.patient_id, n.notification_type, n.message,
           p.first_name, p.last_name, p.patient_code
    FROM notifications n
    LEFT JOIN patients p ON n.patient_id = p.id
    WHERE n.message IS NOT NULL
    ORDER BY n.id DESC LIMIT 20
""")
rows = cur.fetchall()
for r in rows:
    pid, fn, ln = r[1], r[4], r[5]
    msg = r[3] or ''
    # Try to extract name from "Dear <Name>,"
    match = re.search(r'Dear\s+([^,]+),', msg)
    extracted = match.group(1).strip() if match else None
    
    full_name = f"{fn or ''} {ln or ''}".strip()
    is_placeholder = fn and fn.lower() == 'patient' and (ln or '').startswith('#')
    
    print(f"  notif_id={r[0]}, patient_id={pid}, db_name='{full_name}', extracted='{extracted}', placeholder={is_placeholder}")

print("\n=== CHECK OTHER PATIENT NAME SOURCES ===")
# admissions table
cur.execute("""SELECT column_name FROM information_schema.columns 
    WHERE table_name='admissions' AND column_name ILIKE '%name%'""")
print("admissions name columns:", [r[0] for r in cur.fetchall()])

# appointments table
cur.execute("""SELECT column_name FROM information_schema.columns 
    WHERE table_name='appointments' AND column_name ILIKE '%name%'""")
print("appointments name columns:", [r[0] for r in cur.fetchall()])

# registrations
cur.execute("""SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' AND table_name ILIKE '%registr%'""")
print("registration tables:", [r[0] for r in cur.fetchall()])

print("\n=== CHECK patients table for additional name fields ===")
cur.execute("""SELECT column_name FROM information_schema.columns 
    WHERE table_name='patients' ORDER BY ordinal_position""")
cols = [r[0] for r in cur.fetchall()]
print("patients columns:", cols)

# Check if there's a full_name or name field
print("\n=== SAMPLE patient 138843 ALL COLUMNS ===")
cur.execute("SELECT * FROM patients WHERE id=138843")
row = cur.fetchone()
if row:
    for col, val in zip(cols, row):
        if val is not None and str(val).strip():
            print(f"  {col}: {val}")

cur.close()
conn.close()
