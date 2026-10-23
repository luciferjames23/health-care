"""
reconcile_patient_feedback_links.py
===================================
Deterministic reconciliation script for patient_feedback and escalations records.
Finds orphaned records with patient_id IS NULL and assigns them to the canonical patient
record IF AND ONLY IF the conversation's phone number maps to EXACTLY ONE patient in patients.
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db_config


def run_reconciliation():
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("[RECONCILIATION] Starting deterministic patient_id reconciliation...")

        # 1. Map unambiguous 10-digit phone -> single patient_id
        cur.execute("""
            SELECT RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) AS clean_phone, MAX(id) AS patient_id
            FROM patients
            WHERE phone IS NOT NULL AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10
            GROUP BY clean_phone
            HAVING COUNT(*) = 1;
        """)
        unique_phones = dict(cur.fetchall())
        print(f"[RECONCILIATION] Found {len(unique_phones)} unique phone-to-patient mappings.")

        # 2. Reconcile patient_feedback
        cur.execute("""
            SELECT f.id, c.whatsapp_number
            FROM patient_feedback f
            JOIN conversations c ON f.conversation_id = c.id
            WHERE f.patient_id IS NULL AND c.whatsapp_number IS NOT NULL;
        """)
        fb_orphans = cur.fetchall()
        fb_updated = 0

        for fb_id, wa_num in fb_orphans:
            clean = wa_num[-10:] if len(wa_num) >= 10 else wa_num
            target_pid = unique_phones.get(clean)
            if target_pid:
                cur.execute("""
                    UPDATE patient_feedback 
                    SET patient_id = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s AND patient_id IS NULL;
                """, (target_pid, fb_id))
                fb_updated += 1

        print(f"[RECONCILIATION] Updated {fb_updated} / {len(fb_orphans)} patient_feedback records.")

        # 3. Reconcile escalations
        cur.execute("""
            SELECT e.id, c.whatsapp_number
            FROM escalations e
            JOIN conversations c ON e.conversation_id = c.id
            WHERE e.patient_id IS NULL AND c.whatsapp_number IS NOT NULL;
        """)
        esc_orphans = cur.fetchall()
        esc_updated = 0

        for esc_id, wa_num in esc_orphans:
            clean = wa_num[-10:] if len(wa_num) >= 10 else wa_num
            target_pid = unique_phones.get(clean)
            if target_pid:
                cur.execute("""
                    UPDATE escalations 
                    SET patient_id = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s AND patient_id IS NULL;
                """, (target_pid, esc_id))
                esc_updated += 1

        print(f"[RECONCILIATION] Updated {esc_updated} / {len(esc_orphans)} escalations records.")

        conn.commit()
        print("[RECONCILIATION] Successfully completed and committed!")
        return {
            "success": True,
            "patient_feedback_updated": fb_updated,
            "escalations_updated": esc_updated
        }
    except Exception as e:
        conn.rollback()
        print(f"[RECONCILIATION_ERROR] {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    run_reconciliation()
