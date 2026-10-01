"""
Database Fix Script: Fix Doctor Logins & Passwords
Path: backend/alter_db/fix_doctor_logins.py

1. Updates all doctor users (doctor_1 to doctor_150, doc1, doc2, AK, etc.) in the PostgreSQL `users` table
   to have a valid bcrypt hashed password for 'Hospital@2026'.
2. Seeds / Ensures Dr. Arjun Menon (arjun.menon) and Dr. Priya Narayanan (priya.narayanan) exist in `users` and `doctors`.
3. Ensures all doctors have is_active = true and must_change_password = false.
"""

import sys
import os
from pathlib import Path
import datetime
import bcrypt

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import db_config

DEFAULT_PASSWORD = "Hospital@2026"

def hash_password(plain_password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode('utf-8'), salt).decode('utf-8')

DEMO_DOCTORS = [
    {
        "username": "arjun.menon",
        "email": "arjun.menon@meridian.com",
        "first_name": "Arjun",
        "last_name": "Menon",
        "display_name": "Dr. Arjun Menon",
        "phone": "9840200001",
        "specialization": "Cardiology",
        "qualification": "MBBS, MD, DM (Cardiology)",
        "dept_code": "MER-CARD",
        "doctor_code": "DOC-ARJUN"
    },
    {
        "username": "priya.narayanan",
        "email": "priya.narayanan@meridian.com",
        "first_name": "Priya",
        "last_name": "Narayanan",
        "display_name": "Dr. Priya Narayanan",
        "phone": "9840200002",
        "specialization": "Internal Medicine",
        "qualification": "MBBS, MD (General Medicine)",
        "dept_code": "MER-GMED",
        "doctor_code": "DOC-PRIYA"
    },
    {
        "username": "doc1",
        "email": "arun.kumar@meridian.com",
        "first_name": "Arun",
        "last_name": "Kumar",
        "display_name": "Dr. Arun Kumar",
        "phone": "9888888881",
        "specialization": "General Medicine",
        "qualification": "MBBS, MD",
        "dept_code": "MER-GMED",
        "doctor_code": "DR001"
    },
    {
        "username": "doc2",
        "email": "priya.ramesh@meridian.com",
        "first_name": "Priya",
        "last_name": "Ramesh",
        "display_name": "Dr. Priya Ramesh",
        "phone": "9888888882",
        "specialization": "Cardiology",
        "qualification": "MBBS, MD, DM (Cardiology)",
        "dept_code": "MER-CARD",
        "doctor_code": "DR002"
    }
]

def fix_doctor_logins():
    print("=" * 80)
    print("[+] MERIDIAN HEALTHCARE: FIXING DOCTOR LOGINS & PASSWORDS")
    print(f"    Setting password to: {DEFAULT_PASSWORD}")
    print("=" * 80)

    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 1. Fetch Doctor Role ID
        cur.execute("SELECT id FROM roles WHERE LOWER(name) = 'doctor' LIMIT 1;")
        doc_role_id = cur.fetchone()[0]

        # 2. Generate valid bcrypt hash for 'Hospital@2026'
        hashed_pwd = hash_password(DEFAULT_PASSWORD)
        print("  ✓ Generated fresh bcrypt hash for 'Hospital@2026'")

        # 3. Update all existing users with Doctor role
        cur.execute("""
            UPDATE users
            SET password_hash = %s,
                is_active = true,
                must_change_password = false,
                updated_at = NOW()
            WHERE role_id = %s;
        """, (hashed_pwd, doc_role_id))
        updated_count = cur.rowcount
        print(f"  ✓ Updated password_hash to '{DEFAULT_PASSWORD}' for {updated_count} existing doctor accounts")

        # 4. Ensure demo doctors exist (arjun.menon, priya.narayanan, doc1, doc2)
        for doc in DEMO_DOCTORS:
            # Get department_id
            cur.execute("""
                SELECT id FROM departments 
                WHERE department_code = %s OR department_name ILIKE %s
                LIMIT 1;
            """, (doc["dept_code"], f"%{doc['specialization']}%"))
            dept_row = cur.fetchone()
            dept_id = dept_row[0] if dept_row else 1

            # Check if user exists
            cur.execute("""
                SELECT id FROM users WHERE LOWER(username) = LOWER(%s) OR LOWER(email) = LOWER(%s) LIMIT 1;
            """, (doc["username"], doc["email"]))
            u_row = cur.fetchone()

            if u_row:
                user_id = u_row[0]
                cur.execute("""
                    UPDATE users
                    SET password_hash = %s,
                        role_id = %s,
                        first_name = %s,
                        last_name = %s,
                        staff_name = %s,
                        staff_type = %s,
                        department_id = %s,
                        phone = %s,
                        is_active = true,
                        must_change_password = false,
                        updated_at = NOW()
                    WHERE id = %s;
                """, (
                    hashed_pwd, doc_role_id, doc["first_name"], doc["last_name"],
                    doc["display_name"], doc["specialization"], dept_id, doc["phone"], user_id
                ))
            else:
                cur.execute("""
                    INSERT INTO users (
                        username, email, password_hash, role_id, first_name, last_name,
                        phone, is_active, must_change_password, staff_code, staff_name,
                        staff_type, department_id, joining_date, experience, salary, created_at, updated_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, true, false, %s, %s,
                        %s, %s, '2023-01-15', 12, 120000, NOW(), NOW()
                    )
                    RETURNING id;
                """, (
                    doc["username"], doc["email"], hashed_pwd, doc_role_id,
                    doc["first_name"], doc["last_name"], doc["phone"],
                    f"STF-{doc['doctor_code']}", doc["display_name"], doc["specialization"],
                    dept_id
                ))
                user_id = cur.fetchone()[0]

            # Upsert into doctors table
            cur.execute("SELECT id FROM doctors WHERE user_id = %s OR doctor_code = %s LIMIT 1;", (user_id, doc["doctor_code"]))
            d_row = cur.fetchone()
            if d_row:
                cur.execute("""
                    UPDATE doctors
                    SET display_name = %s,
                        department_id = %s,
                        specialization = %s,
                        qualification = %s,
                        phone = %s,
                        email = %s,
                        status = 'ACTIVE',
                        user_id = %s,
                        updated_at = NOW()
                    WHERE id = %s;
                """, (
                    doc["display_name"], dept_id, doc["specialization"], doc["qualification"],
                    doc["phone"], doc["email"], user_id, d_row[0]
                ))
            else:
                cur.execute("""
                    INSERT INTO doctors (
                        doctor_code, user_id, department_id, first_name, last_name,
                        display_name, specialization, qualification, experience_years,
                        phone, email, consultation_fee, status, created_at, updated_at, joining_date
                    )
                    VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, 12,
                        %s, %s, 750.00, 'ACTIVE', NOW(), NOW(), '2023-01-15'
                    );
                """, (
                    doc["doctor_code"], user_id, dept_id, doc["first_name"], doc["last_name"],
                    doc["display_name"], doc["specialization"], doc["qualification"],
                    doc["phone"], doc["email"]
                ))
            print(f"  ✓ Configured doctor account: {doc['username']} ({doc['display_name']})")

        conn.commit()
        print("\n" + "=" * 80)
        print("[SUCCESS] ALL DOCTORS CAN NOW LOG IN SUCCESSFULLY")
        print(f"  • Default Password: {DEFAULT_PASSWORD}")
        print("  • Login by Username: doctor_1, doctor_2, arjun.menon, priya.narayanan, doc1, doc2, etc.")
        print("  • Login by Doctor Code: DOC-0001, DOC-0002, DR001, DR002, etc.")
        print("  • Login by Email: dr.priya1@meridian.com, arjun.menon@meridian.com, etc.")
        print("=" * 80 + "\n")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Fix failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    fix_doctor_logins()
