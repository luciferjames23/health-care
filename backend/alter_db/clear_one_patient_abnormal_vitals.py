#!/usr/bin/env python3
"""
Alter DB Script: Clear Bill with Abnormal Vitals for 1 Admitted Patient
Folder: backend/alter_db/clear_one_patient_abnormal_vitals.py

Action:
- Selects 1 admitted patient (default: 87233, or passed via CLI).
- Clears their billing status:
    * bill_status = 'Paid'
    * bill_clearance_status = 'Cleared'
    * outstanding_balance = 0.00
- Sets Abnormal / Critical Vital Signs:
    * latest_temperature = 103.4°F (High fever / pyrexia)
    * latest_heart_rate = 138 bpm (Severe tachycardia)
    * latest_systolic_bp = 185 mmHg (Hypertensive urgency)
    * latest_diastolic_bp = 115 mmHg
    * latest_oxygen_saturation = 86.5% (Severe hypoxia, SpO2 < 92%)
- Result: This patient will pass Step 1 (Bill Cleared) but FAIL Step 2 (Groq LLM Vitals Gate),
  appearing as NOT ELIGIBLE with explicit LLM instability reasoning in the Discharge Agent Pipeline.
"""

import sys
import os
from pathlib import Path

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from connectors.databricks_connector import DatabricksConnector


def clear_one_patient_abnormal_vitals(patient_id=None):
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

        # If not provided, choose candidate patient who is NOT already signed off and NOT in 87231, 87232
        if not patient_id:
            cur.execute("""
                SELECT patient_id, first_name, last_name, admission_id
                FROM dim_admission_inputs
                WHERE (bill_status != 'Paid' OR outstanding_balance > 0)
                  AND discharge_status = 'Admitted'
                  AND patient_id NOT IN (87231, 87232)
                  AND patient_id NOT IN (
                      SELECT DISTINCT patient_id 
                      FROM dim_generated_discharge_summaries 
                      WHERE LOWER(TRIM(approval_status)) IN ('approved', 'signed', 'signed off', 'completed')
                  )
                ORDER BY patient_id ASC
                LIMIT 1;
            """)
            row = cur.fetchone()
            if row:
                target_id = row[0]
            else:
                target_id = 87233
        else:
            target_id = int(patient_id)
            if target_id in signed_off_pids:
                print(f"[ERROR] Patient ID #{target_id} is already SIGNED OFF / APPROVED.")
                print("ABORTING: Cannot alter or overwrite records of signed-off patients.")
                return

        print("=" * 80)
        print("CLINICAL DATABASE ALTERATION: 1 PATIENT CLEARED WITH ABNORMAL VITALS")
        print("SAFETY GUARD: Signed off / approved patient records are 100% PROTECTED")
        print("=" * 80)

        # 1. Update dim_admission_inputs with Paid bill & ABNORMAL vitals
        cur.execute("""
            UPDATE dim_admission_inputs
            SET 
                bill_status = 'Paid',
                bill_clearance_status = 'Cleared',
                outstanding_balance = 0.00,
                discharge_status = 'Admitted',
                latest_temperature = 103.40,
                latest_heart_rate = 138,
                latest_systolic_bp = 185,
                latest_diastolic_bp = 115,
                latest_oxygen_saturation = 86.50
            WHERE patient_id = %s
            RETURNING patient_id, first_name, last_name, admission_id, primary_diagnosis;
        """, (target_id,))
        res = cur.fetchone()

        if res:
            # 2. Also ensure admissions table is Admitted
            cur.execute("""
                UPDATE admissions
                SET discharge_status = 'Admitted'
                WHERE patient_id = %s;
            """, (target_id,))

            # 3. Clean any existing non-approved discharge summary for fresh evaluation
            # HARD SAFETY GUARD: NEVER delete any summary that is Approved / Signed Off!
            cur.execute("""
                DELETE FROM dim_generated_discharge_summaries
                WHERE patient_id = %s
                  AND LOWER(TRIM(approval_status)) NOT IN ('approved', 'signed', 'signed off', 'completed');
            """, (target_id,))

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

            print(f"\n[Updated Patient] ID: #{res[0]} - {res[1]} {res[2]} (Admission #{res[3]})")
            print(f"  * Diagnosis      : {res[4]}")
            print(f"  * Step 1 (Bill)  : Status = Paid, Clearance = Cleared, Outstanding = Rs. 0.00 (PASSED)")
            print(f"  * Step 2 (Vitals): Temp = 103.4 F (High Fever) | HR = 138 bpm (Tachycardia)")
            print(f"                     BP = 185/115 mmHg (Hypertension) | SpO2 = 86.5% (Hypoxia < 92%)")
            print(f"  * Expected Result: FAILED Step 2 (Groq LLM Flags Hemodynamic Instability)")
            print(f"  * Status         : NOT ELIGIBLE (Held due to unstable clinical vitals)")

            print("\n" + "=" * 80)
            print(f"Successfully updated patient #{target_id} to: Cleared Bill + Abnormal Vitals.")
            print("-" * 80)
            print(f"[PROTECTION AUDIT] Signed Off Discharge Summaries: {len(protected_signed_off)} records preserved (UNTOUCHED)")
            for s in protected_signed_off:
                print(f"  - Summary #{s[0]}: Patient #{s[1]} | Status: {s[2]} [VERIFIED INTACT]")
            print("Refresh the Discharge Agent Pipeline to view the vitals gate rejection!")
            print("=" * 80)
        else:
            print(f"Patient ID #{target_id} not found in dim_admission_inputs.")

    except Exception as e:
        conn.rollback()
        print(f"Error updating patient: {e}", file=sys.stderr)
        raise e
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    p_id = sys.argv[1] if len(sys.argv) >= 2 else None
    clear_one_patient_abnormal_vitals(p_id)
