import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent.parent / "Bosco-projects" / "POC" / "Health-care" / "code" / "health-care" / "backend"
# Or just backend
sys.path.insert(0, r"e:\Bosco-projects\POC\Health-care\code\health-care\backend")

from db.postgres_connector import PostgresConnector

def sync_and_clean():
    connector = PostgresConnector()
    conn = connector.get_connection()
    cur = connector.get_dict_cursor(conn)

    print("--- 1. Cleaning orphaned nursing_tasks ---")
    cur.execute("""
        DELETE FROM nursing_tasks 
        WHERE NOT EXISTS (
            SELECT 1 FROM dim_admission_inputs dai 
            WHERE dai.patient_number = nursing_tasks.uhid 
            AND LOWER(COALESCE(dai.discharge_status, '')) != 'discharged'
        );
    """)
    print("Cleaned orphaned nursing_tasks:", cur.rowcount)

    print("--- 2. Inserting missing active admitted patients into nursing_tasks ---")
    cur.execute("""
        INSERT INTO nursing_tasks (
            bed_no, patient_name, uhid, task_description, status, 
            assigned_nurse, clinical_notes, last_vitals_time, 
            hr, bp, spo2, temp, rr, pain_score, ews_score, 
            fall_risk, diet_type, overdue_meds, flag_status, ward_name
        )
        SELECT 
            COALESCE(dai.bed_number, 'BED-TBD'),
            TRIM(COALESCE(dai.first_name, '') || ' ' || COALESCE(dai.last_name, '')),
            dai.patient_number,
            'Routine Q4H vitals round, oral medication administration & intake/output chart',
            'Active',
            'Staff Nurse Sneha Rao',
            'Attending: ' || COALESCE(dai.attending_doctor, 'General Medical Consultant') || '. Diagnosis: ' || COALESCE(dai.primary_diagnosis, 'Inpatient Care') || '. Patient resting in bed.',
            '08:00',
            COALESCE(dai.latest_heart_rate, 75),
            COALESCE(dai.latest_systolic_bp || '/' || dai.latest_diastolic_bp, '120/80'),
            COALESCE(dai.latest_oxygen_saturation::text, '98'),
            COALESCE(dai.latest_temperature, 98.6),
            18,
            0,
            0,
            'Low / Low',
            'Standard Hospital Diet',
            '—',
            'Normal',
            COALESCE(dai.ward_name, 'General Multi-Specialty Ward')
        FROM dim_admission_inputs dai
        WHERE LOWER(COALESCE(dai.discharge_status, '')) != 'discharged'
        AND NOT EXISTS (
            SELECT 1 FROM nursing_tasks nt WHERE nt.uhid = dai.patient_number
        );
    """)
    print("Inserted missing active admissions to nursing_tasks:", cur.rowcount)

    print("--- 3. Deduplicating ward_sbar_handovers (keeping newest per bed) ---")
    cur.execute("""
        DELETE FROM ward_sbar_handovers a
        USING ward_sbar_handovers b
        WHERE a.bed_no = b.bed_no AND a.id < b.id;
    """)
    print("Deduped ward_sbar_handovers:", cur.rowcount)

    print("--- 4. Cleaning orphaned ward_sbar_handovers for non-active beds ---")
    cur.execute("""
        DELETE FROM ward_sbar_handovers ws
        WHERE NOT EXISTS (
            SELECT 1 FROM dim_admission_inputs dai 
            WHERE dai.bed_number = ws.bed_no 
            AND LOWER(COALESCE(dai.discharge_status, '')) != 'discharged'
        );
    """)
    print("Cleaned orphaned ward_sbar_handovers:", cur.rowcount)

    conn.commit()

    cur.execute("SELECT count(*) as count FROM nursing_tasks")
    print("Total nursing_tasks count:", cur.fetchone()["count"])

    cur.execute("SELECT count(*) as count FROM ward_sbar_handovers")
    print("Total active ward_sbar_handovers count:", cur.fetchone()["count"])

    cur.execute("SELECT count(*) as count FROM dim_admission_inputs WHERE LOWER(COALESCE(discharge_status, '')) != 'discharged'")
    print("Active admitted patients in dim_admission_inputs:", cur.fetchone()["count"])

    cur.execute("SELECT count(*) as count FROM beds WHERE status = 'Occupied'")
    print("Occupied beds in beds table:", cur.fetchone()["count"])

    conn.close()

if __name__ == "__main__":
    sync_and_clean()
