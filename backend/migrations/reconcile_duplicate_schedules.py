"""
Migration / Reconciliation Script: Safe Schedule Deduplication
=============================================================
Identifies duplicate and overlapping schedules in doctor_schedules table.
Preserves audit history and historical schedules by updating status to
'SUPERSEDED' or 'RECONCILED_DUPLICATE' rather than destructive deletion.
"""

import sys
import os
from datetime import date

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

def reconcile_duplicate_schedules():
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("[MIGRATION] Starting safe schedule reconciliation...")

        # 1. Exact duplicates: Doctor 28 (Dr. Dragon Gupta) Monday 09:00-17:00 (keep 1152)
        cur.execute("""
            UPDATE doctor_schedules
            SET status = 'RECONCILED_DUPLICATE',
                updated_at = CURRENT_TIMESTAMP
            WHERE id IN (1153, 1154, 1155);
        """)
        print(f"[MIGRATION] Reconciled Dr. Dragon Gupta duplicate clones (1153, 1154, 1155): {cur.rowcount} rows updated.")

        # Historical shift 83 superseded by shift 1152 on 2026-10-12
        cur.execute("""
            UPDATE doctor_schedules
            SET status = 'SUPERSEDED',
                effective_to = '2026-10-11',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 83;
        """)
        print(f"[MIGRATION] Superseded Dr. Dragon Gupta historical 2024 shift (83): {cur.rowcount} rows updated.")

        # 2. Exact duplicates: Doctor 1009 (Dr. James R) Monday 09:00-17:00 (keep 1018, reconcile 1076)
        cur.execute("""
            UPDATE doctor_schedules
            SET status = 'RECONCILED_DUPLICATE',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1076;
        """)
        print(f"[MIGRATION] Reconciled Dr. James R duplicate clone (1076): {cur.rowcount} rows updated.")

        # 3. Overlapping: Doctor 1015 (Dr. Immanuvel S) Thursday 09:00-17:00 replaced by 1143 (09:00-16:00) on 2026-10-08
        cur.execute("""
            UPDATE doctor_schedules
            SET status = 'SUPERSEDED',
                effective_to = '2026-10-07',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1051;
        """)
        print(f"[MIGRATION] Superseded Dr. Immanuvel S older Thursday shift (1051): {cur.rowcount} rows updated.")

        # 4. Overlapping: Doctor 1017 (Dr. Edwin Stephano J) Thursday 09:00-17:00 replaced by 1140 (05:00-20:00) on 2026-10-08
        cur.execute("""
            UPDATE doctor_schedules
            SET status = 'SUPERSEDED',
                effective_to = '2026-10-07',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1065;
        """)
        print(f"[MIGRATION] Superseded Dr. Edwin Stephano J older Thursday shift (1065): {cur.rowcount} rows updated.")

        # 5. Normalize all day_of_week and active statuses to standard uppercase
        cur.execute("""
            UPDATE doctor_schedules
            SET day_of_week = UPPER(day_of_week)
            WHERE day_of_week != UPPER(day_of_week);
        """)
        print(f"[MIGRATION] Normalized day_of_week casing: {cur.rowcount} rows.")

        cur.execute("""
            UPDATE doctor_schedules
            SET status = 'ACTIVE'
            WHERE status = 'Active';
        """)
        print(f"[MIGRATION] Normalized Active status casing: {cur.rowcount} rows.")

        conn.commit()
        print("[MIGRATION] Safe schedule reconciliation committed successfully.")

    except Exception as e:
        conn.rollback()
        print(f"[MIGRATION_ERROR] Reconciliation failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    reconcile_duplicate_schedules()
