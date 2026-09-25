import sys
import os
import datetime

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import db_config
from api import dashboard_routes

def test_filter_pipeline():
    print("=" * 80)
    print("TESTING DOCTOR PORTAL FILTER & DATA PIPELINE")
    print("=" * 80)

    conn = db_config.get_db_connection()
    cur = conn.cursor()

    # 1. Fetch doctors and their appointment counts across database
    cur.execute("""
        SELECT d.id, d.display_name, dept.department_name, COUNT(a.id) as appt_count
        FROM doctors d
        LEFT JOIN departments dept ON d.department_id = dept.id
        LEFT JOIN appointments a ON d.id = a.doctor_id
        GROUP BY d.id, d.display_name, dept.department_name
        ORDER BY appt_count DESC;
    """)
    doc_rows = cur.fetchall()

    print(f"Found {len(doc_rows)} doctors in database:")
    for d in doc_rows:
        print(f"  Doctor ID {d[0]}: {d[1]} (Dept: {d[2]}, Total Appts: {d[3]})")

    if not doc_rows:
        print("ERROR: No doctors found.")
        sys.exit(1)

    # Pick top doctor (with appointments)
    test_doc = doc_rows[0]
    test_doc_id = test_doc[0]
    print(f"\nTesting with Doctor: {test_doc[1]} (ID: {test_doc_id})")

    # Fetch min and max appointment_date for this doctor
    cur.execute("""
        SELECT MIN(appointment_date), MAX(appointment_date), COUNT(*)
        FROM appointments
        WHERE doctor_id = %s;
    """, (test_doc_id,))
    min_d, max_d, cnt = cur.fetchone()
    print(f"Doctor's Appointment Date Range in DB: {min_d} to {max_d} (Count: {cnt})")

    cur.close()
    conn.close()

    # Simulate Doctor user context (role: DOCTOR or ADMIN)
    fake_user_doctor = {"role": "DOCTOR", "doctor_id": test_doc_id, "username": "doc_test"}
    fake_user_admin = {"role": "ADMIN", "username": "admin_test"}

    # Define test date ranges
    today = datetime.date.today()
    
    # Last Week calculation (Monday to Sunday of previous week)
    idx = today.weekday()
    last_week_end = today - datetime.timedelta(days=idx+1)
    last_week_start = last_week_end - datetime.timedelta(days=6)

    # This Month calculation
    this_month_start = today.replace(day=1)
    if today.month == 12:
        next_m = today.replace(year=today.year+1, month=1, day=1)
    else:
        next_m = today.replace(month=today.month+1, day=1)
    this_month_end = next_m - datetime.timedelta(days=1)

    ranges_to_test = [
        ("Last Week", last_week_start.isoformat(), last_week_end.isoformat()),
        ("This Month", this_month_start.isoformat(), this_month_end.isoformat()),
        ("Full Range (Min to Max)", str(min_d), str(max_d)) if min_d else ("Full Range", "2026-01-01", "2026-12-31"),
    ]

    for label, d_from, d_to in ranges_to_test:
        print(f"\n--- Testing Filter: {label} ({d_from} to {d_to}) ---")

        # 1. Test /summary
        sum_res = dashboard_routes.get_dashboard_summary(
            date_from=d_from,
            date_to=d_to,
            doctor_id=test_doc_id,
            current_user=fake_user_doctor
        )
        summary_total = sum_res["appointments"]["total"]
        print(f"1. /summary -> Total: {summary_total}, Booked: {sum_res['appointments']['booked']}, Confirmed: {sum_res['appointments']['confirmed']}, Completed: {sum_res['appointments']['completed']}")

        # 2. Test /analytics/date-wise
        ana_res = dashboard_routes.get_date_wise_analytics(
            date_from=d_from,
            date_to=d_to,
            doctor_id=test_doc_id,
            current_user=fake_user_doctor
        )
        by_date = ana_res.get("appointments_by_date", [])
        analytics_sum = sum(item["total"] for item in by_date)
        print(f"2. /analytics/date-wise -> Sum of appointments_by_date: {analytics_sum}")

        # 3. Test /appointments
        appts_res = dashboard_routes.get_appointments(
            date_from=d_from,
            date_to=d_to,
            doctor_id=test_doc_id,
            per_page=200,
            current_user=fake_user_doctor
        )
        appts_list = appts_res.get("appointments", [])
        appts_total = appts_res.get("total", 0)
        print(f"3. /appointments -> Total: {appts_total}, List Length: {len(appts_list)}")

        # Check for inconsistencies
        if summary_total != appts_total or summary_total != analytics_sum:
            print(f"❌ INCONSISTENCY DETECTED! Summary={summary_total}, Analytics={analytics_sum}, AppointmentsList={appts_total}")
        else:
            print(f"✅ RECONCILED MATCH: Summary = Analytics = AppointmentsList = {summary_total}")

if __name__ == "__main__":
    test_filter_pipeline()
