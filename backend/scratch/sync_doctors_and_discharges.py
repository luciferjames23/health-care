import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
import re

def sync():
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, doctor_code, first_name, last_name, display_name, specialization FROM doctors ORDER BY id")
    all_docs = cur.fetchall()

    def find_doc(name):
        if not name:
            return None
        clean = name.split(',')[0].replace('Dr.', '').replace('Dr ', '').strip().lower()
        # Direct match
        for d in all_docs:
            dname = f"{d[2]} {d[3]}".strip().lower()
            if dname == clean or d[4].lower().replace('dr.', '').replace('dr ', '').strip() == clean:
                return d
        # Match first name and last name
        parts = clean.split()
        if len(parts) >= 2:
            fn, ln = parts[0], parts[-1]
            for d in all_docs:
                if d[2].lower() == fn and d[3].lower() == ln:
                    return d
        # Match last name and first name starts with
        for d in all_docs:
            if len(parts) >= 2 and d[2].lower().startswith(parts[0][:3]) and d[3].lower() == parts[-1]:
                return d
        return None

    cur.execute("""
        SELECT summary_id, admission_id, patient_id, primary_consultant, approval_status, doctor_id
        FROM dim_generated_discharge_summaries
        ORDER BY summary_id
    """)
    summaries = cur.fetchall()

    print(f"Total summaries: {len(summaries)}")
    updated_summaries = 0
    updated_admissions = 0
    updated_dim_inputs = 0

    for s in summaries:
        sum_id, adm_id, pat_id, consultant, approval, curr_doc_id = s
        matched = find_doc(consultant)
        if not matched:
            print(f"FAILED to match doctor for: {consultant}")
            continue

        real_doc_id = matched[0]
        real_doc_name = matched[4] # e.g. "Dr. Ravi Reddy"

        # 1. Update dim_generated_discharge_summaries
        is_approved = str(approval).strip().lower() in ['approved', 'completed', 'signed', 'signed off']
        cur.execute("""
            UPDATE dim_generated_discharge_summaries
            SET doctor_id = %s
            WHERE summary_id = %s
        """, (real_doc_id, sum_id))
        updated_summaries += 1

        # 2. Update admissions table
        if adm_id:
            new_status = 'Discharged' if is_approved else 'Ready'
            cur.execute("""
                UPDATE admissions
                SET doctor_id = %s,
                    discharge_status = CASE WHEN %s THEN 'Discharged' ELSE discharge_status END
                WHERE admission_id = %s
            """, (real_doc_id, is_approved, adm_id))
            updated_admissions += 1

        # 3. Update dim_admission_inputs table if exists
        try:
            cur.execute("""
                UPDATE dim_admission_inputs
                SET attending_doctor = %s,
                    doctor_specialization = %s,
                    discharge_status = CASE WHEN %s THEN 'Discharged' ELSE discharge_status END
                WHERE admission_id = %s OR patient_id = %s
            """, (real_doc_name, matched[5], is_approved, adm_id, pat_id))
            updated_dim_inputs += 1
        except Exception as e:
            print(f"dim_admission_inputs update error: {e}")

        print(f"Synced Summary {sum_id}: {consultant} -> DocID {real_doc_id} ({real_doc_name}), Adm {adm_id} (Discharge Status: {'Discharged' if is_approved else 'Ready/Pending'})")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nSUCCESS: Synced {updated_summaries} summaries, {updated_admissions} admissions, {updated_dim_inputs} dim_admission_inputs rows.")

if __name__ == "__main__":
    sync()
