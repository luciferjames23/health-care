import sys
from datetime import datetime, timedelta
from backend.db_config import get_db_connection

def update_escalations():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 1. Clear old dummy test escalations
    cur.execute("DELETE FROM escalations;")
    
    # Sample realistic clinical escalations
    cases = [
        {
            "id": 1,
            "patient_id": 138842, # Devendra Sundaresan
            "phone": "+91 98401 38842",
            "conv_code": "WA_9840138842_MED_QUERY",
            "reason": "Severe post-discharge medication interaction query",
            "question": "I was discharged yesterday on Warfarin and my doctor also prescribed Ibuprofen. Is it safe to take both together or should I hold the painkiller?",
            "status": "OPEN",
            "hours_ago": 2,
            "resolution": None
        },
        {
            "id": 2,
            "patient_id": 138847, # Sunita Krishnan
            "phone": "+91 98401 38847",
            "conv_code": "WA_9840138847_TPA_AUTH",
            "reason": "Emergency cashless pre-authorization approval delay",
            "question": "My knee arthroscopy is scheduled for tomorrow at 8 AM but Star Health pre-auth status is still pending in TPA portal. Can front desk expedite the authorization letter?",
            "status": "OPEN",
            "hours_ago": 4,
            "resolution": None
        },
        {
            "id": 3,
            "patient_id": 138844, # Rajesh Verma
            "phone": "+91 98401 38844",
            "conv_code": "WA_9840138844_POSTOP_CLIN",
            "reason": "Post-operative fever and wound dressing inquiry",
            "question": "I had laparoscopic appendectomy 3 days ago and running mild fever (100.4°F) with slight redness around the umbilical port. Should I visit the emergency room?",
            "status": "OPEN",
            "hours_ago": 6,
            "resolution": None
        },
        {
            "id": 4,
            "patient_id": 138845, # Bhavani Reddy
            "phone": "+91 98401 38845",
            "conv_code": "WA_9840138845_CARDIO_SLOT",
            "reason": "Urgent cardiology consult slot rescheduling",
            "question": "I need to advance my Holter review appointment with Dr. Aravind Swaminathan to today afternoon due to recurring palpitation episodes.",
            "status": "OPEN",
            "hours_ago": 9,
            "resolution": None
        },
        {
            "id": 5,
            "patient_id": 138843, # Senthil Chawla
            "phone": "+91 98401 38843",
            "conv_code": "WA_9840138843_BILL_RECON",
            "reason": "Discharge pharmacy bill item reconciliation",
            "question": "My invoice shows 5 ampoules of Inj. Vancomycin but nurse mentioned only 3 were administered before discharge. Please verify with IP pharmacy.",
            "status": "IN_PROGRESS",
            "hours_ago": 14,
            "resolution": None
        },
        {
            "id": 6,
            "patient_id": 138848, # Rohan Kumar
            "phone": "+91 98401 38848",
            "conv_code": "WA_9840138848_LAB_CRIT",
            "reason": "Laboratory critical value follow-up guidance",
            "question": "My automated lab SMS showed Serum Potassium 5.8 mEq/L flagged high. Do I need immediate dietary potassium restriction before nephrology review?",
            "status": "IN_PROGRESS",
            "hours_ago": 18,
            "resolution": None
        },
        {
            "id": 7,
            "patient_id": 138849, # Praveen Joshi
            "phone": "+91 98401 38849",
            "conv_code": "WA_9840138849_HOME_CARE",
            "reason": "Home care nursing dressing assistance request",
            "question": "Can the hospital home health team dispatch a registered nurse tomorrow morning for diabetic ulcer sterile vacuum dressing change?",
            "status": "RESOLVED",
            "hours_ago": 26,
            "resolution": "Home nursing team dispatched; visit confirmed for 10:00 AM by Sister Mary (Staff Nurse). Patient notified via WhatsApp."
        },
        {
            "id": 8,
            "patient_id": 138850, # Ashok Krishnan
            "phone": "+91 98401 38850",
            "conv_code": "WA_9840138850_ENDOCRINE",
            "reason": "Insulin titration chart guidance",
            "question": "My fasting blood glucose is 185 mg/dL today. Should I increase Lantus baseline dose from 14 units to 16 units as per sliding scale chart?",
            "status": "RESOLVED",
            "hours_ago": 32,
            "resolution": "Endocrinologist Dr. Priya Sharma reviewed logs and confirmed adjustment to 16 units with 3-day fasting diary protocol."
        }
    ]
    
    now = datetime.now()
    
    for c in cases:
        created_time = now - timedelta(hours=c["hours_ago"])
        resolved_time = (created_time + timedelta(hours=2)) if c["status"] == "RESOLVED" else None
        
        # Check or create conversation
        cur.execute("SELECT id FROM conversations WHERE conversation_code = %s;", (c["conv_code"],))
        conv_row = cur.fetchone()
        if conv_row:
            conv_id = conv_row[0]
            cur.execute("""
                UPDATE conversations
                SET patient_id = %s, whatsapp_number = %s, language = 'ENGLISH', updated_at = %s
                WHERE id = %s;
            """, (c["patient_id"], c["phone"], created_time, conv_id))
        else:
            cur.execute("""
                INSERT INTO conversations (conversation_code, patient_id, whatsapp_number, channel, language, current_intent, conversation_status, started_at, last_message_at, created_at, updated_at)
                VALUES (%s, %s, %s, 'WHATSAPP', 'ENGLISH', 'ESCALATION', 'ACTIVE', %s, %s, %s, %s)
                RETURNING id;
            """, (c["conv_code"], c["patient_id"], c["phone"], created_time, created_time, created_time, created_time))
            conv_id = cur.fetchone()[0]
            
        cur.execute("""
            INSERT INTO escalations (id, conversation_id, patient_id, escalation_reason, patient_question, status, resolution_notes, created_at, updated_at, resolved_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            c["id"],
            conv_id,
            c["patient_id"],
            c["reason"],
            c["question"],
            c["status"],
            c["resolution"],
            created_time,
            created_time,
            resolved_time
        ))
        
    # Reset sequence if exists
    cur.execute("SELECT setval(pg_get_serial_sequence('escalations', 'id'), (SELECT MAX(id) FROM escalations));")
    
    conn.commit()
    print(f"Successfully populated {len(cases)} realistic patient escalations.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    update_escalations()
