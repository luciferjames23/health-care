import sys
import os
import datetime

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import db_config
from services import queue_service, queue_notification_service

import traceback

def test_full_queue_lifecycle():
    print("============================================================")
    print("AG-06 E2E QUEUE LIFECYCLE TEST")
    print("============================================================")

    conn = db_config.get_db_connection()
    cur = conn.cursor()

    try:
        # STEP 1: Find or create doctor Dr. Immanuel S & confirmed appointments for today
        today = datetime.date.today()
        print(f"\n[STEP 1] Inspecting today's ({today}) appointments for Dr. Immanuel S...")

        cur.execute("""
            SELECT d.id, d.display_name, dept.id, dept.department_name
            FROM doctors d
            JOIN departments dept ON d.department_id = dept.id
            WHERE d.status = 'ACTIVE' AND dept.status = 'ACTIVE'
            LIMIT 1;
        """)
        doc_row = cur.fetchone()
        doctor_id, doctor_name, department_id, dept_name = doc_row[0], doc_row[1], doc_row[2], doc_row[3]
        print(f"Using Doctor: {doctor_name} (ID: {doctor_id}), Department: {dept_name} (ID: {department_id})")

        # Select 2 confirmed appointments for today
        cur.execute("""
            SELECT a.id, a.booking_id, a.patient_id, a.status,
                   COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), 'Patient #' || a.patient_id) as patient_name,
                   p.phone, p.whatsapp_number
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = %s AND a.appointment_date = %s AND a.status = 'CONFIRMED'
            ORDER BY a.id DESC
            LIMIT 2;
        """, (doctor_id, today))
        appts = cur.fetchall()

        if len(appts) >= 2:
            # Clear test queue entries for these 2 test appointments so we can test clean check-in
            appt_ids = [appts[0][0], appts[1][0]]
            cur.execute("DELETE FROM queue_notifications WHERE appointment_id IN (%s, %s);", (appt_ids[0], appt_ids[1]))
            cur.execute("DELETE FROM queue_entries WHERE appointment_id IN (%s, %s);", (appt_ids[0], appt_ids[1]))
            conn.commit()

        # If no appointments today, insert 2 confirmed test appointments for today
        if len(appts) < 2:
            print("Creating 2 confirmed test appointments for today to perform queue test...")
            cur.execute("SELECT id, first_name, last_name, phone, whatsapp_number FROM patients LIMIT 2;")
            pats = cur.fetchall()
            p1_id, p2_id = pats[0][0], pats[1][0]

            # Clear existing queue session/entries for today if any to start clean test
            cur.execute("DELETE FROM queue_notifications WHERE appointment_id IN (SELECT id FROM appointments WHERE doctor_id = %s AND appointment_date = %s);", (doctor_id, today))
            cur.execute("DELETE FROM queue_entries WHERE doctor_id = %s AND appointment_id IN (SELECT id FROM appointments WHERE doctor_id = %s AND appointment_date = %s);", (doctor_id, doctor_id, today))
            cur.execute("DELETE FROM queue_sessions WHERE doctor_id = %s AND queue_date = %s;", (doctor_id, today))

            b1 = f"BK_TST_{int(datetime.datetime.now().timestamp())}_1"
            b2 = f"BK_TST_{int(datetime.datetime.now().timestamp())}_2"

            cur.execute("""
                INSERT INTO appointments (booking_id, patient_id, doctor_id, department_id, appointment_date, appointment_time, status, booking_source, patient_reason)
                VALUES (%s, %s, %s, %s, %s, '18:00:00', 'CONFIRMED', 'WHATSAPP', 'General Checkup')
                RETURNING id;
            """, (b1, p1_id, doctor_id, department_id, today))
            a1_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO appointments (booking_id, patient_id, doctor_id, department_id, appointment_date, appointment_time, status, booking_source, patient_reason)
                VALUES (%s, %s, %s, %s, %s, '18:30:00', 'CONFIRMED', 'WHATSAPP', 'Fever & Cold')
                RETURNING id;
            """, (b2, p2_id, doctor_id, department_id, today))
            a2_id = cur.fetchone()[0]

            conn.commit()

            cur.execute("""
                SELECT a.id, a.booking_id, a.patient_id, a.status,
                       COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), 'Patient #' || a.patient_id) as patient_name,
                       p.phone, p.whatsapp_number
                FROM appointments a
                LEFT JOIN patients p ON a.patient_id = p.id
                WHERE a.id IN (%s, %s)
                ORDER BY a.appointment_time ASC;
            """, (a1_id, a2_id))
            appts = cur.fetchall()

        print(f"Found {len(appts)} appointments for today:")
        for appt in appts:
            print(f" - {appt[1]}: Patient {appt[4]} (ID: {appt[2]}), Status: {appt[3]}")

        a1_id, a1_booking, p1_id, a1_status, p1_name = appts[0][0], appts[0][1], appts[0][2], appts[0][3], appts[0][4]
        a2_id, a2_booking, p2_id, a2_status, p2_name = appts[1][0], appts[1][1], appts[1][2], appts[1][3], appts[1][4]

        # STEP 2: Verify queue status BEFORE check-in
        print("\n[STEP 2] Verifying queue status before check-in...")
        cur.execute("SELECT id FROM queue_entries WHERE appointment_id IN (%s, %s);", (a1_id, a2_id))
        existing_queue = cur.fetchall()
        print(f"Queue entries exist before check-in: {len(existing_queue)} (Expected: 0 if not checked in)")

        # STEP 3: Patient 1 Check-in
        print(f"\n[STEP 3] Checking in Patient 1 ({p1_name}, Appt {a1_id})...")
        res1 = queue_service.patient_check_in(appointment_id=a1_id, room_number="101-A")
        print("Check-in Result Patient 1:", {
            "token_number": res1["token_number"],
            "queue_status": res1["queue_status"],
            "position": res1["position"],
            "patients_ahead": res1["patients_ahead"],
            "estimated_wait_minutes": res1["estimated_wait_minutes"]
        })
        assert res1["token_number"] > 0, f"Expected valid token number, got {res1['token_number']}"
        assert res1["patients_ahead"] == 0, f"Expected 0 patients ahead, got {res1['patients_ahead']}"

        # Dispatch notification
        notif1 = queue_notification_service.process_token_assigned(res1)
        print("Notification 1 Dispatch Result:", notif1)

        # STEP 4: Patient 2 Check-in
        print(f"\n[STEP 4] Checking in Patient 2 ({p2_name}, Appt {a2_id})...")
        res2 = queue_service.patient_check_in(appointment_id=a2_id, room_number="101-A")
        print("Check-in Result Patient 2:", {
            "token_number": res2["token_number"],
            "queue_status": res2["queue_status"],
            "position": res2["position"],
            "patients_ahead": res2["patients_ahead"],
            "estimated_wait_minutes": res2["estimated_wait_minutes"]
        })
        assert res2["token_number"] == res1["token_number"] + 1, f"Expected token {res1['token_number'] + 1}, got {res2['token_number']}"
        assert res2["patients_ahead"] == 1, f"Expected 1 patient ahead, got {res2['patients_ahead']}"

        # STEP 5: Duplicate check-in prevention test
        print(f"\n[STEP 5] Testing duplicate check-in for Patient 1 ({a1_id})...")
        try:
            queue_service.patient_check_in(appointment_id=a1_id)
            print("❌ ERROR: Duplicate check-in was NOT prevented!")
        except queue_service.DuplicateCheckInError as dup_err:
            print("✅ SUCCESS: Duplicate check-in correctly rejected with:", dup_err.message)

        # STEP 6: Doctor Calls Next Patient
        print(f"\n[STEP 6] Doctor calls next patient (Session ID: {res1['queue_session_id']})...")
        call_res = queue_service.call_next_patient(queue_session_id=res1["queue_session_id"])
        print("Call Next Result:", {
            "entry_id": call_res["entry_id"],
            "token_number": call_res["token_number"],
            "patient_name": call_res["patient_name"],
            "queue_status": call_res["queue_status"]
        })
        assert call_res["queue_status"] == "CALLED", f"Expected CALLED status, got {call_res['queue_status']}"
        assert call_res["token_number"] == res1["token_number"], f"Expected Token #{res1['token_number']}, got {call_res['token_number']}"

        # Dispatch PROCEED_TO_ROOM notification
        call_notif = queue_notification_service.process_proceed_to_room(call_res["entry_id"], call_res)
        print("Call Next Notification Result:", call_notif)

        # STEP 7: Doctor Starts Consultation
        print(f"\n[STEP 7] Doctor starts consultation for Token #{call_res['token_number']} (Entry ID: {call_res['entry_id']})...")
        start_res = queue_service.start_consultation(queue_entry_id=call_res["entry_id"])
        print("Start Consultation Result:", start_res)
        assert start_res["queue_status"] == "IN_CONSULTATION", f"Expected IN_CONSULTATION, got {start_res['queue_status']}"

        # STEP 8: Doctor Completes Consultation
        print(f"\n[STEP 8] Doctor completes consultation for Token #{call_res['token_number']}...")
        comp_res = queue_service.complete_consultation(queue_entry_id=call_res["entry_id"])
        print("Complete Consultation Result:", {
            "entry_id": comp_res["entry_id"],
            "queue_status": comp_res["queue_status"],
            "recalculated_entries_count": len(comp_res.get("recalculated_entries", []))
        })
        assert comp_res["queue_status"] == "COMPLETED", f"Expected COMPLETED, got {comp_res['queue_status']}"

        # Verify Patient 2 moved forward to position 1, 0 patients ahead
        recalc_entry2 = next(e for e in comp_res["recalculated_entries"] if e["entry_id"] == res2["entry_id"])
        print("Patient 2 Recalculated Queue State:", recalc_entry2)
        assert recalc_entry2["position"] == 1, f"Expected position 1, got {recalc_entry2['position']}"
        assert recalc_entry2["patients_ahead"] == 0, f"Expected 0 patients ahead, got {recalc_entry2['patients_ahead']}"

        print("\n============================================================")
        print("✅ ALL AG-06 END-TO-END QUEUE TESTS PASSED PERFECTLY!")
        print("============================================================")

    except Exception as e:
        print(f"❌ TEST FAILED WITH EXCEPTION: {e}")
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    test_full_queue_lifecycle()
