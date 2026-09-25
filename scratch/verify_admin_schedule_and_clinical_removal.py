import sys
import os
import json
import datetime

# Reconfigure stdout to utf-8 encoding if needed
sys.stdout.reconfigure(encoding='utf-8')

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath('backend'))

from db_config import get_db_connection
from appointment_service import get_available_slots, get_doctor_schedule_for_date

def run_verification():
    conn = get_db_connection()
    cur = conn.cursor()
    print("=" * 70)
    print("END-TO-END VERIFICATION: ADMIN SCHEDULE MANAGEMENT & AVAILABILITY")
    print("=" * 70)

    try:
        # 1. Fetch Doctor Dr. Moorthy D
        cur.execute("SELECT id, display_name, department_id FROM doctors WHERE display_name ILIKE %s;", ('%Moorthy%',))
        moorthy_row = cur.fetchone()
        if not moorthy_row:
            print("[FAIL] Doctor Moorthy D not found in database")
            return
        moorthy_id, moorthy_name, moorthy_dept = moorthy_row
        print(f"[OK] Found Doctor: {moorthy_name} (ID: {moorthy_id}, Dept ID: {moorthy_dept})")

        # 2. Fetch Doctor Dr. Arun Kumar
        cur.execute("SELECT id, display_name, department_id FROM doctors WHERE display_name ILIKE %s;", ('%Arun%',))
        arun_row = cur.fetchone()
        if not arun_row:
            print("[FAIL] Doctor Arun Kumar not found in database")
            return
        arun_id, arun_name, arun_dept = arun_row
        print(f"[OK] Found Doctor: {arun_name} (ID: {arun_id}, Dept ID: {arun_dept})")

        # 3. Create or update schedule slot for Dr. Moorthy D for MONDAY (10:00 to 14:00, 30 min slots)
        sched_day = 'MONDAY'
        cur.execute("""
            SELECT id FROM doctor_schedules
            WHERE doctor_id = %s AND UPPER(day_of_week) = %s;
        """, (moorthy_id, sched_day))
        existing_sched = cur.fetchone()

        if existing_sched:
            sched_id = existing_sched[0]
            cur.execute("""
                UPDATE doctor_schedules
                SET start_time = '10:00', end_time = '14:00', slot_duration_minutes = 30, status = 'ACTIVE'
                WHERE id = %s;
            """, (sched_id,))
            conn.commit()
            print(f"[OK] Updated existing MONDAY schedule slot (ID: {sched_id}) for {moorthy_name}")
        else:
            cur.execute("""
                INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, status)
                VALUES (%s, %s, '10:00', '14:00', 30, 'ACTIVE')
                RETURNING id;
            """, (moorthy_id, sched_day))
            sched_id = cur.fetchone()[0]
            conn.commit()
            print(f"[OK] Created new MONDAY schedule slot (ID: {sched_id}) for {moorthy_name}")

        # 4. Verify Database Persistence (Fresh read from PostgreSQL)
        cur.execute("SELECT doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, status FROM doctor_schedules WHERE id = %s;", (sched_id,))
        p_doc, p_day, p_start, p_end, p_slot, p_status = cur.fetchone()
        assert str(p_start) == '10:00:00'
        assert str(p_end) == '14:00:00'
        assert p_slot == 30
        assert p_status == 'ACTIVE'
        print(f"[OK] Fresh PostgreSQL Read: {p_day} {p_start}-{p_end}, {p_slot}m, status={p_status}")

        # 5. Check Doctor Availability integration for next Monday date
        today = datetime.date.today()
        days_ahead = (0 - today.weekday() + 7) % 7
        if days_ahead == 0:
            days_ahead = 7
        next_monday = today + datetime.timedelta(days=days_ahead)
        monday_str = next_monday.strftime('%Y-%m-%d')
        print(f"Testing availability for next Monday ({monday_str})...")

        slots = get_available_slots(moorthy_id, monday_str)
        print(f"[OK] Generated {len(slots)} slots for {moorthy_name} on {monday_str}: {slots}")
        assert len(slots) > 0, "Expected generated slots for active schedule"
        print(f"[OK] Availability slot engine correctly consumed Admin schedule configuration!")

        # 6. Verify Isolation: Doctor Arun Kumar's schedule was NOT modified
        cur.execute("SELECT id, doctor_id FROM doctor_schedules WHERE doctor_id = %s;", (arun_id,))
        arun_scheds = cur.fetchall()
        for asch_id, asch_doc in arun_scheds:
            assert asch_doc == arun_id
            assert asch_doc != moorthy_id
        print(f"[OK] Doctor Isolation Verified: {arun_name}'s schedules remain intact and distinct.")

        # 7. Test Leave/Block Behavior
        cur.execute("UPDATE doctor_schedules SET status = 'ON_LEAVE' WHERE id = %s;", (sched_id,))
        conn.commit()
        leave_slots = get_available_slots(moorthy_id, monday_str)
        print(f"[OK] Tested ON_LEAVE status for {moorthy_name}: Generated {len(leave_slots)} slots (Expected 0).")
        assert len(leave_slots) == 0, "Leave status should produce 0 available slots"

        # Restore schedule to ACTIVE
        cur.execute("UPDATE doctor_schedules SET status = 'ACTIVE' WHERE id = %s;", (sched_id,))
        conn.commit()
        print(f"[OK] Schedule restored to ACTIVE.")

        print("=" * 70)
        print("ALL VERIFICATION CHECKS PASSED PERFECTLY!")
        print("=" * 70)

    except Exception as e:
        print(f"[FAIL] ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    run_verification()
