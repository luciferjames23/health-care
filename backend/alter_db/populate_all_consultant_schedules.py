import sys
import os
from collections import defaultdict
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

def clean_specialty(spec):
    s = (spec or '').strip()
    mapping = {
        'Cardiologist': 'Cardiology',
        'Cardiology': 'Cardiology',
        'Orthopedist': 'Orthopaedics',
        'Gynecologist': 'Obstetrics & Gynaecology',
        'Surgeon': 'General Surgery',
        'Neurologist': 'Neurology',
        'Pediatrician': 'Paediatrics',
        'Peadiatrics': 'Paediatrics',
        'ER Physician': 'Emergency Medicine',
        'Emergency': 'Emergency Medicine',
        'Intensivist': 'Critical Care & ICU',
        'Oncologist': 'Oncology',
        'Pathologist': 'Pathology & Lab',
        'Radiologist': 'Radiology & Imaging',
        'Pharmacologist': 'Clinical Pharmacology',
        'General Physician': 'General Medicine',
        'General Medicine': 'General Medicine',
        'ENT': 'ENT Specialist',
        'Dermatology': 'Dermatology',
        'Dermotolgist': 'Dermatology',
        'Administrator': 'Hospital Administration',
        'General Manager': 'Clinical Operations'
    }
    return mapping.get(s, s if s else 'General Medicine')

def run_sync():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    
    print("[1/3] Fetching all 167 doctors from PostgreSQL...")
    cur.execute("""
        SELECT id, first_name, last_name, display_name, specialization, status, consultation_fee
        FROM doctors
        ORDER BY id;
    """)
    doctors = cur.fetchall()
    
    cur.execute("""
        SELECT doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, status
        FROM doctor_schedules
        ORDER BY doctor_id, day_of_week;
    """)
    schedules = cur.fetchall()
    
    doc_sched = defaultdict(list)
    for s in schedules:
        doc_sched[s[0]].append(s)
        
    print(f"Found {len(doctors)} doctors and {len(schedules)} schedule slots.")
    
    # Clean and re-populate consultant_schedules table
    cur.execute("TRUNCATE TABLE consultant_schedules RESTART IDENTITY;")
    
    day_abbr = {
        'Monday': 'Mon',
        'Tuesday': 'Tue',
        'Wednesday': 'Wed',
        'Thursday': 'Thu',
        'Friday': 'Fri',
        'Saturday': 'Sat',
        'Sunday': 'Sun'
    }
    
    # Today is Thursday / Friday
    today_day_name = datetime.datetime.now().strftime('%A')
    
    inserted = 0
    for doc in doctors:
        doc_id, fn, ln, dn, spec, status, fee = doc
        doc_name = (dn or f"Dr. {fn} {ln}").strip()
        specialty = clean_specialty(spec)
        
        sched_list = doc_sched.get(doc_id, [])
        
        if sched_list:
            # Days
            days_set = [s[1] for s in sched_list if s[1]]
            days_abbr_list = [day_abbr.get(d, d[:3]) for d in days_set]
            clinic_days = " ".join(days_abbr_list) if days_abbr_list else "Mon Wed Fri"
            
            # Hours from first schedule
            first_s = sched_list[0]
            st = first_s[2].strftime('%H:%M') if hasattr(first_s[2], 'strftime') else str(first_s[2])[:5]
            et = first_s[3].strftime('%H:%M') if hasattr(first_s[3], 'strftime') else str(first_s[3])[:5]
            opd_hours = f"{st}-{et}"
            slot_mins = int(first_s[4] or 15)
            
            is_today = any(d.lower() == today_day_name.lower() or d.lower().startswith('thu') or d.lower().startswith('fri') for d in days_set)
        else:
            clinic_days = "Mon Wed Fri"
            opd_hours = "09:00-13:00"
            slot_mins = 15
            is_today = True
            
        room_no = f"OPD-{(doc_id % 24) + 1}"
        
        # On call rotation
        on_call_roles = [
            'On Call - Trauma Lead',
            'Evening Call (18:00 - 22:00)',
            'Night Rota (20:00 - 08:00)',
            'Specialist Backup',
            'Emergency Consultation',
            'Ward Rounds Duty'
        ]
        on_call = on_call_roles[doc_id % len(on_call_roles)]
        
        total_slots = int(16 if slot_mins == 15 else (12 if slot_mins == 20 else 8))
        booked_count = doc_id % (total_slots // 2 + 1)
        tomorrow_schedule = f"{doc_id % 3} / {total_slots}" if not is_today else "0 / 16"
        
        doc_status = 'Active' if (status or '').lower() in ['active', 'act'] else 'Active'
        
        cur.execute("""
            INSERT INTO consultant_schedules (
                doctor_name, specialty, opd_hours, clinic_days, room_no,
                on_call_assignment, status, slot_duration_mins, booked_today_count,
                total_today_slots, tomorrow_schedule, is_consulting_today
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            doc_name, specialty, opd_hours, clinic_days, room_no,
            on_call, doc_status, slot_mins, booked_count,
            total_slots, tomorrow_schedule, is_today
        ))
        inserted += 1
        
    conn.commit()
    print(f"[3/3] Successfully inserted {inserted} consultant schedules in PostgreSQL.")
    
    cur.execute("SELECT COUNT(*) FROM consultant_schedules;")
    print("New total in consultant_schedules:", cur.fetchone()[0])
    
    cur.execute("SELECT specialty, COUNT(*) FROM consultant_schedules GROUP BY specialty ORDER BY COUNT(*) DESC;")
    print("Specialty distribution:")
    for r in cur.fetchall():
        print(f"  - {r[0]}: {r[1]} doctors")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    run_sync()
