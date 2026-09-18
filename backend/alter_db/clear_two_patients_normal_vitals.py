#!/usr/bin/env python3
"""
Alter DB Script: Clear Bills with Normal Vitals for 2 Admitted Patients
Folder: backend/alter_db/clear_two_patients_normal_vitals.py

Action:
- Selects 2 admitted patients (default: 87231 and 87232, or passed via CLI).
- Clears their billing status:
    * bill_status = 'Paid'
    * bill_clearance_status = 'Cleared'
    * outstanding_balance = 0.00
- Sets Normal Stable Vital Signs:
    * latest_temperature = 98.6°F
    * latest_heart_rate = 74 bpm
    * latest_systolic_bp = 120 mmHg
    * latest_diastolic_bp = 80 mmHg
    * latest_oxygen_saturation = 98.5%
- Result: These 2 patients will pass Step 1 (Bill Cleared) AND pass Step 2 (Vitals Stability)
  and appear as ELIGIBLE FOR DISCHARGE in the Discharge Agent Pipeline.
"""

import sys
import os
from pathlib import Path

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from connectors.databricks_connector import DatabricksConnector


def clear_two_patients_normal_vitals(patient_ids=None):
    connector = DatabricksConnector()
    conn = connector.get_connection()
    cur = conn.cursor()

    try:
        # Fetch all patient IDs that already have a Signed Off / Approved discharge summary
        cur.execute("""
            SELECT DISTINCT patient_id 
            FROM dim_generated_discharge_summaries 
            WHERE LOWER(TRIM(approval_status)) IN ('approved', 'signed', 'signed off', 'completed');
        """)
        signed_off_pids = {r[0] for r in cur.fetchall() if r[0] is not None}

        # If not provided, select 2 candidate patients who currently have pending bills and ARE NOT SIGNED OFF
        if not patient_ids or len(patient_ids) < 2:
            cur.execute("""
                SELECT patient_id, first_name, last_name, admission_id
                FROM dim_admission_inputs
                WHERE (bill_status != 'Paid' OR outstanding_balance > 0)
                  AND discharge_status = 'Admitted'
                  AND patient_id NOT IN (
                      SELECT DISTINCT patient_id 
                      FROM dim_generated_discharge_summaries 
                      WHERE LOWER(TRIM(approval_status)) IN ('approved', 'signed', 'signed off', 'completed')
                  )
                ORDER BY patient_id ASC
                LIMIT 2;
            """)
            rows = cur.fetchall()
            if len(rows) >= 2:
                target_ids = [rows[0][0], rows[1][0]]
            else:
                # Fallback to predefined IDs (ensuring they are not signed off)
                fallback_candidates = [87231, 87232]
                target_ids = [pid for pid in fallback_candidates if pid not in signed_off_pids]
        else:
            target_ids = [int(patient_ids[0]), int(patient_ids[1])]
            # HARD GUARD: Verify neither requested patient is signed off
            conflicts = [pid for pid in target_ids if pid in signed_off_pids]
            if conflicts:
                print(f"[ERROR] Patient ID(s) {conflicts} are already SIGNED OFF / APPROVED.")
                print("ABORTING: Cannot alter or overwrite records of signed-off patients.")
                return

        print("=" * 80)
        print("CLINICAL DATABASE ALTERATION: 2 PATIENTS CLEARED WITH NORMAL VITALS")
        print("SAFETY GUARD: Signed off / approved patient records are 100% PROTECTED")
        print("=" * 80)

        updated_info = []
        for pid in target_ids:
            # 1. Update dim_admission_inputs with Paid bill & Normal vitals
            cur.execute("""
                UPDATE dim_admission_inputs
                SET 
                    bill_status = 'Paid',
                    bill_clearance_status = 'Cleared',
                    outstanding_balance = 0.00,
                    discharge_status = 'Admitted',
                    latest_temperature = 98.60,
                    latest_heart_rate = 74,
                    latest_systolic_bp = 120,
                    latest_diastolic_bp = 80,
                    latest_oxygen_saturation = 98.50
                WHERE patient_id = %s
                RETURNING patient_id, first_name, last_name, admission_id, primary_diagnosis;
            """, (pid,))
            res = cur.fetchone()

            if res:
                # 2. Also ensure admissions table is Admitted
                cur.execute("""
                    UPDATE admissions
                    SET discharge_status = 'Admitted'
                    WHERE patient_id = %s;
                """, (pid,))

                # 3. Clean any existing non-approved discharge summary for fresh evaluation
                # HARD SAFETY GUARD: NEVER delete any summary that is Approved / Signed Off!
                cur.execute("""
                    DELETE FROM dim_generated_discharge_summaries
                    WHERE patient_id = %s
                      AND LOWER(TRIM(approval_status)) NOT IN ('approved', 'signed', 'signed off', 'completed');
                """, (pid,))

                updated_info.append({
                    "patient_id": res[0],
                    "name": f"{res[1]} {res[2]}",
                    "admission_id": res[3],
                    "diagnosis": res[4]
                })

        # Query and audit signed-off summaries to ensure they remain intact
        cur.execute("""
            SELECT summary_id, patient_id, approval_status 
            FROM dim_generated_discharge_summaries 
            WHERE LOWER(TRIM(approval_status)) IN ('approved', 'signed', 'signed off', 'completed')
            ORDER BY summary_id ASC;
        """)
        protected_signed_off = cur.fetchall()

        conn.commit()
        DatabricksConnector.clear_cache()

        for idx, info in enumerate(updated_info, 1):
            print(f"\n[Patient {idx}] ID: #{info['patient_id']} - {info['name']} (Admission #{info['admission_id']})")
            print(f"  * Diagnosis    : {info['diagnosis']}")
            print(f"  * Step 1 (Bill): Status = Paid, Clearance = Cleared, Outstanding = Rs. 0.00")
            print(f"  * Step 2 (Vitals): Temp = 98.6 F | HR = 74 bpm | BP = 120/80 mmHg | SpO2 = 98.5% (STABLE)")
            print(f"  * Status       : ELIGIBLE FOR DISCHARGE (Passes Bill & Vitals Gates)")

        print("\n" + "=" * 80)
        print(f"Successfully updated {len(updated_info)} admitted patients to: Cleared Bill + Normal Vitals.")
        print("-" * 80)
        print(f"[PROTECTION AUDIT] Signed Off Discharge Summaries: {len(protected_signed_off)} records preserved (UNTOUCHED)")
        for s in protected_signed_off:
            print(f"  - Summary #{s[0]}: Patient #{s[1]} | Status: {s[2]} [VERIFIED INTACT]")
        print("Refresh the Discharge Agent Pipeline to see the updated Eligible for Discharge count!")
        print("=" * 80)

    except Exception as e:
        conn.rollback()
        print(f"Error updating patients: {e}", file=sys.stderr)
        raise e
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    p_ids = sys.argv[1:3] if len(sys.argv) >= 3 else None
    clear_two_patients_normal_vitals(p_ids)
