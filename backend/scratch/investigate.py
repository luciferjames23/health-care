import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

def investigate():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    
    # 1. Search for Dr. Dragon Gupta or Gupta
    cur.execute("SELECT id, display_name, specialization, department_id, status FROM doctors WHERE display_name ILIKE '%Dragon%' OR display_name ILIKE '%Gupta%';")
    print("Doctor search:", cur.fetchall())

    # 2. Check all duplicate schedules in doctor_schedules
    cur.execute("""
        SELECT doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, COUNT(*) 
        FROM doctor_schedules 
        GROUP BY doctor_id, day_of_week, start_time, end_time, slot_duration_minutes 
        HAVING COUNT(*) > 1;
    """)
    duplicates = cur.fetchall()
    print("Duplicate schedules count:", len(duplicates))
    for d in duplicates[:10]:
        print("Duplicate:", d)

    # 3. Check Dr. Dragon Gupta schedules specifically if found
    cur.execute("SELECT id FROM doctors WHERE display_name ILIKE '%Dragon%';")
    dragon = cur.fetchall()
    for d in dragon:
        doc_id = d[0]
        cur.execute("SELECT id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, status, effective_from, created_at FROM doctor_schedules WHERE doctor_id = %s ORDER BY day_of_week, start_time, id;", (doc_id,))
        scheds = cur.fetchall()
        print(f"Doctor {doc_id} schedules ({len(scheds)}):")
        for s in scheds:
            print("  ", s)

    # 4. Check today's queue sessions and entries
    cur.execute("SELECT id, doctor_id, queue_date, status, current_token_number FROM queue_sessions WHERE queue_date = CURRENT_DATE;")
    today_sessions = cur.fetchall()
    print(f"Today's queue sessions ({len(today_sessions)}):", today_sessions)
    for s in today_sessions:
        cur.execute("SELECT id, token_number, patient_id, queue_status, appointment_id FROM queue_entries WHERE queue_session_id = %s;", (s[0],))
        entries = cur.fetchall()
        print(f"  Session {s[0]} entries ({len(entries)}):", entries)

    # 5. Check appointments for today
    cur.execute("SELECT id, doctor_id, patient_id, appointment_date, appointment_time, status FROM appointments WHERE appointment_date = CURRENT_DATE LIMIT 10;")
    appts = cur.fetchall()
    print(f"Today's appointments sample ({len(appts)}):", appts)

    cur.close()
    conn.close()

if __name__ == '__main__':
    investigate()
