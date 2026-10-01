"""
Database Migration: Setup Data for [AG-04] Employee Service Agent (பணியாளர் சேவை முகவர்)
Path: backend/alter_db/setup_employee_service_agent_data.py

Creates tables and seeds data for:
1. `staff_rosters`: Real shift rosters across wards (Today, Tomorrow, Upcoming week)
2. `employee_leave_balances`: Comp-off, casual, sick, and earned leave balances
3. `employee_leave_requests`: Leave application workflow and supervisor routing
4. `knowledge_documents`: HR Leave & Attendance Policy v5.0
5. Seeds Nurse Priya Narayanan (nurse.priya) on Day Shift (07:00 AM - 03:00 PM) in Ward 3B tomorrow with 2 Comp-Offs.
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

# HR Leave Policy v5.0 Text
HR_POLICY_V5_TEXT = """
MERIDIAN HEALTHCARE SYSTEM - HR LEAVE & ATTENDANCE POLICY
Document Code: HR-POL-2026-V5.0 | Effective: 01 January 2026 | Version: 5.0
Governing Authority: Department of Human Resources & Medical Directorate

§1. COMPENSATORY OFF (COMP-OFF) RULES & ENTITLEMENT
1.1 Entitlement Criteria: Hospital staff (nurses, technicians, support staff, and resident medical officers) who work on gazetted public holidays, perform emergency patient coverage, or work unscheduled overtime exceeding 6 hours are eligible for Compensatory Off (Comp-Off).
1.2 Accrual & Balance: Comp-off credits are verified and credited within 24 hours of supervisor roster sign-off. Staff can accumulate a maximum of 3 comp-offs per quarter.
1.3 Validity: Comp-off must be availed within 60 calendar days of accrual. Unused comp-offs lapse and cannot be encashed.
1.4 Application Notice: Staff should submit comp-off requests through the Employee Service Agent or intranet portal at least 24 hours prior to the requested shift date, subject to ward staffing coverage.

§2. SHIFT STRUCTURE & ROSTER TIMINGS
2.1 Standard 3-Tier Clinical Shifts:
    - Day Shift: 07:00 AM - 03:00 PM (07:00 - 15:00)
    - Evening Shift: 03:00 PM - 11:00 PM (15:00 - 23:00)
    - Night Shift: 11:00 PM - 07:00 AM (23:00 - 07:00)
2.2 Handover Buffer: Clinical nursing and emergency staff must participate in a 15-minute SBAR bedside handover before clocking out.

§3. CASUAL LEAVE (CL) & SICK LEAVE (SL)
3.1 Casual Leave: Every full-time employee is entitled to 12 days of Casual Leave per calendar year (credited 1 day per month). Maximum 3 consecutive casual leave days allowed.
3.2 Sick Leave: 10 days of paid Sick Leave per annum. Absences exceeding 2 consecutive days require a medical fitness certificate from a hospital physician.
3.3 Earned Leave (EL): 15 days of Earned / Privilege Leave per annum, eligible for encashment as per hospital standing orders.

§7. NIGHT SHIFT ALLOWANCE & FATIGUE MANAGEMENT
7.1 Night Shift Allowance: Staff assigned to the Night Shift (23:00 - 07:00) receive an allowance of ₹350 per night for nursing staff and ₹250 per night for support / allied health staff, credited in monthly payroll.
7.2 Consecutive Night Limit: No clinical employee shall be scheduled for more than 7 consecutive night shifts. A mandatory 48-hour rest period (2 rest days) must follow any 7-night block.
7.3 Back-to-Back Warning: An Evening Shift immediately followed by a Day Shift (less than 8 hours rest) triggers an automated fatigue rule exception in the rostering system.

§9. LEAVE APPROVAL HIERARCHY & WORKFLOW
9.1 First-Line Supervisor: Ward Head Nurse / Nursing Supervisor / Unit In-Charge approves shifts and comp-off requests for clinical wards.
9.2 Escalation: Requests not acted upon within 12 hours escalate automatically to the HR Manager (L. Revathi) or Medical Superintendent.
9.3 Emergency Replacement: If an employee calls in sick or requests sudden emergency leave, the Employee Service Agent checks eligible off-duty staff on that unit for automated substitution.
"""

def setup_employee_service_agent():
    print("=" * 80)
    print("[+] SETTING UP [AG-04] EMPLOYEE SERVICE AGENT DATA")
    print("=" * 80)

    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # ── 1. Create Required Tables ───────────────────────────────────────
        print("\n[Step 1/5] Creating Database Tables for Rosters & Leave Management...")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS staff_rosters (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                staff_code VARCHAR(50),
                staff_name VARCHAR(100) NOT NULL,
                role VARCHAR(50) NOT NULL,
                department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
                ward_id INTEGER,
                ward_name VARCHAR(100) NOT NULL,
                shift_date DATE NOT NULL,
                shift_name VARCHAR(50) NOT NULL,
                shift_timing VARCHAR(50) NOT NULL,
                is_incharge BOOLEAN DEFAULT FALSE,
                status VARCHAR(50) DEFAULT 'Scheduled',
                notes TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS employee_leave_balances (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
                staff_name VARCHAR(100) NOT NULL,
                comp_off_balance NUMERIC(4,1) DEFAULT 2.0,
                casual_leave_balance NUMERIC(4,1) DEFAULT 4.0,
                sick_leave_balance NUMERIC(4,1) DEFAULT 6.0,
                earned_leave_balance NUMERIC(4,1) DEFAULT 12.0,
                policy_version VARCHAR(20) DEFAULT 'v5.0',
                year INTEGER DEFAULT 2026,
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS employee_leave_requests (
                id SERIAL PRIMARY KEY,
                request_code VARCHAR(50) UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                staff_name VARCHAR(100) NOT NULL,
                leave_type VARCHAR(50) NOT NULL,
                from_date DATE NOT NULL,
                to_date DATE NOT NULL,
                days_count NUMERIC(4,1) NOT NULL DEFAULT 1.0,
                reason TEXT,
                supervisor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                supervisor_name VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Pending',
                applied_via VARCHAR(50) DEFAULT 'Chatbot',
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                approved_at TIMESTAMP WITHOUT TIME ZONE
            );
        """)
        print("  ✓ Tables verified: staff_rosters, employee_leave_balances, employee_leave_requests")

        # ── 2. Ensure Ward 3B Exists ────────────────────────────────────────
        print("\n[Step 2/5] Ensuring 'Ward 3B' Exists in Wards...")
        cur.execute("SELECT ward_id FROM wards WHERE ward_name ILIKE '%3B%' OR ward_name ILIKE '%Ward 3B%' LIMIT 1;")
        w_row = cur.fetchone()
        if not w_row:
            cur.execute("""
                INSERT INTO wards (ward_id, ward_name, department_id, ward_type, floor_number, status)
                VALUES (9, 'Ward 3B (Medical Inpatient)', 1, 'Inpatient General & Step-Down', 3, 'Active')
                ON CONFLICT (ward_id) DO UPDATE SET ward_name = EXCLUDED.ward_name;
            """)
            print("  ✓ Inserted Ward 3B (Medical Inpatient, Floor 3)")
        else:
            print(f"  ✓ Ward 3B already exists (ID: {w_row[0]})")

        # ── 3. Ensure Nurse Priya Narayanan Exists in Users ──────────────────
        print("\n[Step 3/5] Ensuring Nurse Priya Narayanan Exists in users...")
        cur.execute("SELECT id FROM roles WHERE LOWER(name) = 'nurse' LIMIT 1;")
        nurse_role_id = cur.fetchone()[0]

        cur.execute("SELECT id FROM departments WHERE department_code = 'MER-NURS' OR department_name ILIKE '%Nursing%' LIMIT 1;")
        nurs_dept_id = cur.fetchone()[0]

        hashed_pwd = hash_password(DEFAULT_PASSWORD)

        cur.execute("""
            SELECT id FROM users WHERE LOWER(username) IN ('nurse.priya', 'priya.nurse', 'priya.narayanan') LIMIT 1;
        """)
        priya_user = cur.fetchone()
        if priya_user:
            priya_user_id = priya_user[0]
            cur.execute("""
                UPDATE users
                SET staff_name = 'Nurse Priya Narayanan',
                    first_name = 'Priya',
                    last_name = 'Narayanan',
                    role_id = %s,
                    department_id = %s,
                    staff_code = 'STF-NURS-088',
                    staff_type = 'Staff Nurse · Inpatient Wards',
                    phone = '9840100109',
                    email = 'nurse.priya@meridian.com',
                    is_active = true,
                    password_hash = %s,
                    updated_at = NOW()
                WHERE id = %s;
            """, (nurse_role_id, nurs_dept_id, hashed_pwd, priya_user_id))
            print(f"  ✓ Updated Nurse Priya (User ID: {priya_user_id}, Username: nurse.priya)")
        else:
            cur.execute("""
                INSERT INTO users (
                    username, email, password_hash, role_id, first_name, last_name,
                    phone, is_active, must_change_password, staff_code, staff_name,
                    staff_type, department_id, joining_date, experience, salary, created_at, updated_at
                )
                VALUES (
                    'nurse.priya', 'nurse.priya@meridian.com', %s, %s, 'Priya', 'Narayanan',
                    '9840100109', true, false, 'STF-NURS-088', 'Nurse Priya Narayanan',
                    'Staff Nurse · Inpatient Wards', %s, '2023-04-10', 4, 42000, NOW(), NOW()
                )
                RETURNING id;
            """, (hashed_pwd, nurse_role_id, nurs_dept_id))
            priya_user_id = cur.fetchone()[0]
            print(f"  ✓ Created Nurse Priya (User ID: {priya_user_id}, Username: nurse.priya)")

        # Fetch Supervisor: Head Nurse Anitha Kumar
        cur.execute("SELECT id, staff_name FROM users WHERE LOWER(username) = 'anitha.kumar' LIMIT 1;")
        supervisor_row = cur.fetchone()
        if supervisor_row:
            supervisor_id, supervisor_name = supervisor_row
        else:
            supervisor_id, supervisor_name = priya_user_id, "Nurse In-Charge"

        # ── 4. Seed Shift Rosters for Today, Tomorrow & Next 7 Days ─────────
        print("\n[Step 4/5] Seeding Shift Rosters & Leave Balances...")
        
        # Clear old mock roster records to ensure pristine data
        cur.execute("DELETE FROM staff_rosters WHERE staff_name ILIKE '%Priya%' OR staff_name ILIKE '%Anitha%' OR staff_name ILIKE '%Selvi%';")

        today = datetime.date.today()
        tomorrow = today + datetime.timedelta(days=1)
        day_after = today + datetime.timedelta(days=2)
        friday = today + datetime.timedelta(days=(4 - today.weekday()) % 7 if (4 - today.weekday()) % 7 != 0 else 7)

        # Ensure Nurse Priya is explicitly on Day Shift (07:00 AM - 03:00 PM) in Ward 3B tomorrow!
        rosters_to_insert = [
            # Nurse Priya Narayanan
            (priya_user_id, 'STF-NURS-088', 'Nurse Priya Narayanan', 'Nurse', nurs_dept_id, 9, 'Ward 3B', today, 'Day Shift', '07:00 AM - 03:00 PM', False, 'Completed', 'Assigned to Ward 3B General & Step-Down'),
            (priya_user_id, 'STF-NURS-088', 'Nurse Priya Narayanan', 'Nurse', nurs_dept_id, 9, 'Ward 3B', tomorrow, 'Day Shift', '07:00 AM - 03:00 PM', False, 'Scheduled', 'Primary floor nurse · Inpatient Ward 3B'),
            (priya_user_id, 'STF-NURS-088', 'Nurse Priya Narayanan', 'Nurse', nurs_dept_id, 9, 'Ward 3B', day_after, 'Day Shift', '07:00 AM - 03:00 PM', False, 'Scheduled', 'Ward 3B Medical Inpatient'),
            (priya_user_id, 'STF-NURS-088', 'Nurse Priya Narayanan', 'Nurse', nurs_dept_id, 9, 'Ward 3B', friday, 'Day Shift', '07:00 AM - 03:00 PM', False, 'Scheduled', 'Tentative schedule · comp-off candidate'),
        ]

        # Also roster Nurse Anitha Kumar (Head Nurse / Incharge)
        if supervisor_row:
            rosters_to_insert.extend([
                (supervisor_id, 'STF-NURS-100', 'Nurse Anitha Kumar', 'Nurse', nurs_dept_id, 9, 'Ward 3B', today, 'Day Shift', '07:00 AM - 03:00 PM', True, 'Completed', 'Ward In-Charge Supervisor'),
                (supervisor_id, 'STF-NURS-100', 'Nurse Anitha Kumar', 'Nurse', nurs_dept_id, 9, 'Ward 3B', tomorrow, 'Day Shift', '07:00 AM - 03:00 PM', True, 'Scheduled', 'Ward In-Charge Supervisor'),
            ])

        # Also roster other nurses across shifts
        cur.execute("SELECT id, username, staff_name, staff_code FROM users WHERE role_id = %s AND id NOT IN (%s, %s) LIMIT 4;", (nurse_role_id, priya_user_id, supervisor_id))
        other_nurses = cur.fetchall()
        shift_cycles = [
            ('Evening Shift', '03:00 PM - 11:00 PM', 'Ward 3B'),
            ('Night Shift', '11:00 PM - 07:00 AM', 'Ward 3B'),
            ('Day Shift', '07:00 AM - 03:00 PM', 'ICU - Step Down'),
            ('Evening Shift', '03:00 PM - 11:00 PM', 'Emergency Bay')
        ]
        for idx, onurse in enumerate(other_nurses):
            sh_name, sh_time, wname = shift_cycles[idx % len(shift_cycles)]
            rosters_to_insert.append(
                (onurse[0], onurse[3] or f'STF-NURS-{onurse[0]}', onurse[2], 'Nurse', nurs_dept_id, 9, wname, tomorrow, sh_name, sh_time, False, 'Scheduled', 'Regular unit assignment')
            )

        for r in rosters_to_insert:
            cur.execute("""
                INSERT INTO staff_rosters (
                    user_id, staff_code, staff_name, role, department_id, ward_id, ward_name,
                    shift_date, shift_name, shift_timing, is_incharge, status, notes
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, r)
        print(f"  ✓ Inserted {len(rosters_to_insert)} staff roster shifts (Priya scheduled for Day Shift tomorrow in Ward 3B)")

        # Seed leave balances (Ensure Nurse Priya has exactly 2 Comp-Offs as requested!)
        cur.execute("""
            INSERT INTO employee_leave_balances (
                user_id, staff_name, comp_off_balance, casual_leave_balance, sick_leave_balance, earned_leave_balance, policy_version, year
            )
            VALUES (%s, 'Nurse Priya Narayanan', 2.0, 4.0, 6.0, 12.0, 'v5.0', 2026)
            ON CONFLICT (user_id) DO UPDATE SET
                comp_off_balance = 2.0,
                casual_leave_balance = 4.0,
                sick_leave_balance = 6.0,
                policy_version = 'v5.0',
                updated_at = NOW();
        """, (priya_user_id,))

        # Balances for supervisor and other staff
        if supervisor_row:
            cur.execute("""
                INSERT INTO employee_leave_balances (
                    user_id, staff_name, comp_off_balance, casual_leave_balance, sick_leave_balance, earned_leave_balance, policy_version, year
                )
                VALUES (%s, %s, 1.0, 5.0, 8.0, 15.0, 'v5.0', 2026)
                ON CONFLICT (user_id) DO NOTHING;
            """, (supervisor_id, supervisor_name))

        for onurse in other_nurses:
            cur.execute("""
                INSERT INTO employee_leave_balances (
                    user_id, staff_name, comp_off_balance, casual_leave_balance, sick_leave_balance, earned_leave_balance, policy_version, year
                )
                VALUES (%s, %s, 1.5, 3.0, 5.0, 10.0, 'v5.0', 2026)
                ON CONFLICT (user_id) DO NOTHING;
            """, (onurse[0], onurse[2]))
        print("  ✓ Seeded employee_leave_balances (Nurse Priya has 2.0 Comp-Offs, 4.0 Casual Leaves)")

        # ── 5. Ingest HR Leave Policy v5.0 into Knowledge Base ──────────────
        print("\n[Step 5/5] Ingesting HR Leave Policy v5.0 into Knowledge Base...")
        cur.execute("""
            SELECT id FROM knowledge_documents WHERE document_code = 'HR-POL-V5.0' LIMIT 1;
        """)
        k_row = cur.fetchone()
        if k_row:
            cur.execute("""
                UPDATE knowledge_documents 
                SET title = 'HR Leave & Attendance Policy v5.0',
                    content = %s,
                    document_type = 'HR_POLICY',
                    version = '5.0',
                    updated_at = NOW()
                WHERE id = %s;
            """, (HR_POLICY_V5_TEXT, k_row[0]))
            print(f"  ✓ Updated HR Leave Policy v5.0 in knowledge_documents (ID: {k_row[0]})")
        else:
            cur.execute("""
                INSERT INTO knowledge_documents (
                    document_code, title, document_type, source, content, language, version, status, created_at, updated_at
                )
                VALUES (
                    'HR-POL-V5.0', 'HR Leave & Attendance Policy v5.0', 'HR_POLICY', 'Department of Human Resources',
                    %s, 'en', '5.0', 'Active', NOW(), NOW()
                );
            """, (HR_POLICY_V5_TEXT,))
            print("  ✓ Inserted HR Leave Policy v5.0 in knowledge_documents")

        # Also ingest into rag_documents for high-speed vector / keyword retrieval
        import hashlib
        c_hash = hashlib.sha256(HR_POLICY_V5_TEXT.strip().encode('utf-8')).hexdigest()

        cur.execute("""
            SELECT id FROM rag_documents WHERE document_type = 'HR_POLICY' AND title = 'HR Leave & Attendance Policy v5.0' LIMIT 1;
        """)
        rag_row = cur.fetchone()
        if rag_row:
            cur.execute("""
                UPDATE rag_documents
                SET content = %s,
                    content_hash = %s,
                    updated_at = NOW()
                WHERE id = %s;
            """, (HR_POLICY_V5_TEXT, c_hash, rag_row[0]))
            print(f"  ✓ Updated HR Policy in rag_documents (ID: {rag_row[0]})")
        else:
            cur.execute("""
                INSERT INTO rag_documents (
                    document_type, source_table, source_record_id, title, content,
                    content_hash, is_verified, is_active, created_at, updated_at
                )
                VALUES (
                    'HR_POLICY', 'knowledge_documents', 'HR-POL-V5.0', 'HR Leave & Attendance Policy v5.0', %s,
                    %s, true, true, NOW(), NOW()
                );
            """, (HR_POLICY_V5_TEXT, c_hash))
            print("  ✓ Ingested HR Policy in rag_documents (auto-generated tsvector)")

        conn.commit()

        print("\n" + "=" * 80)
        print("[SUCCESS] [AG-04] EMPLOYEE SERVICE AGENT DATA FULLY INITIALIZED")
        print(f"  • Nurse Priya Username: nurse.priya | Password: {DEFAULT_PASSWORD}")
        print(f"  • Tomorrow's Shift: Day Shift (07:00 AM - 03:00 PM) in Ward 3B")
        print(f"  • Comp-Off Available: 2 Compensatory Offs (Under HR Policy v5.0)")
        print(f"  • Supervisor: {supervisor_name}")
        print("=" * 80 + "\n")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Setup failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    setup_employee_service_agent()
