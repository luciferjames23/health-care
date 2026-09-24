from db.postgres_connector import PostgresConnector

def run_migration():
    conn = PostgresConnector().get_connection()
    cur = conn.cursor()

    cur.execute("""
        DROP TABLE IF EXISTS ward_sbar_handovers CASCADE;
        CREATE TABLE ward_sbar_handovers (
            id SERIAL PRIMARY KEY,
            bed_no VARCHAR(50),
            patient_name VARCHAR(150) NOT NULL,
            uhid VARCHAR(50),
            age_gender VARCHAR(20),
            ews VARCHAR(50),
            mar_due VARCHAR(50),
            last_handover_time VARCHAR(50),
            from_nurse VARCHAR(150),
            to_nurse VARCHAR(150),
            situation TEXT,
            background TEXT,
            assessment TEXT,
            recommendation TEXT,
            sbar_full TEXT,
            status VARCHAR(50) DEFAULT 'Stale',
            handover_shift VARCHAR(100) DEFAULT 'Morning (07:00 - 15:00)',
            acknowledged BOOLEAN DEFAULT FALSE,
            acknowledged_at TIMESTAMP WITHOUT TIME ZONE,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    seed_data = [
        (
            'C-412', 'Kavitha Raman', 'MER-PAT-0087101', '58F', 'Normal 0', None, '07:00 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'PTCA with single drug-eluting stent, day 1.',
            'Non-ST elevation myocardial infarction.',
            'stable, EWS 0–1, pain controlled.',
            'continue plan, watch access site, review labs at 14:00.',
            'S: PTCA with single drug-eluting stent, day 1. B: Non-ST elevation myocardial infarction. A: stable, EWS 0–1, pain controlled. R: continue plan, watch access site, review labs at 14:00.',
            'Stale', False
        ),
        (
            'C-02', 'Oviya Moorthy', 'MER-PAT-0087102', '34F', 'Normal 1', None, '07:01 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'Elective surgery, day 2.',
            'Illness, unspecified.',
            'stable, EWS 0–1, pain controlled.',
            'continue plan, watch access site, review labs at 14:00.',
            'S: Elective surgery, day 2. B: Illness, unspecified. A: stable, EWS 0–1, pain controlled. R: continue plan, watch access site, review labs at 14:00.',
            'Stale', False
        ),
        (
            None, 'Uma Nair', 'MER-PAT-0087103', '45F', None, None, None, None, None,
            None, None, None, None,
            'No handover recorded',
            'Missing', False
        ),
        (
            None, 'Loganathan Nadar', 'MER-PAT-0087104', '62M', None, None, None, None, None,
            None, None, None, None,
            'No handover recorded',
            'Missing', False
        ),
        (
            None, 'Rani Menon', 'MER-PAT-0087105', '51F', None, None, None, None, None,
            None, None, None, None,
            'No handover recorded',
            'Missing', False
        ),
        (
            'C-05', 'Karthikeyan Antony', 'MER-PAT-0087106', '41M', None, None, '07:02 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'IV antibiotics, day 3.',
            'Sepsis, unspecified organism.',
            'stable, EWS 0–1, pain controlled.',
            'continue plan, watch access site, review labs at 14:00.',
            'S: IV antibiotics, day 3. B: Sepsis, unspecified organism. A: stable, EWS 0–1, pain controlled. R: continue plan, watch access site, review labs at 14:00.',
            'Stale', False
        ),
        (
            'C-06', 'Sathish Devi', 'MER-PAT-0087107', '29F', None, None, '07:03 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'Post-operative care, day 1.',
            'Illness, unspecified.',
            'stable, EWS 0–1, pain controlled.',
            'continue plan, watch access site, review labs at 14:00.',
            'S: Post-operative care, day 1. B: Illness, unspecified. A: stable, EWS 0–1, pain controlled. R: continue plan, watch access site, review labs at 14:00.',
            'Stale', False
        ),
        (
            'C-07', 'Ananya Sundaram', 'MER-PAT-0087108', '47F', 'Normal 0', None, '07:04 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'Observation post endoscopic biopsy.',
            'Gastric ulcer investigation.',
            'hemodynamically normal, no active bleeding.',
            'soft diet, discharge plan post-rounds.',
            'S: Observation post endoscopic biopsy. B: Gastric ulcer investigation. A: hemodynamically normal, no active bleeding. R: soft diet, discharge plan post-rounds.',
            'Stale', False
        ),
        (
            'ICU-03', 'Rajeshwari Iyer', 'MER-PAT-0087109', '66F', 'Normal 1', '1 overdue', '07:05 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'Post-CABG day 3 step-down.',
            'Triple vessel coronary artery bypass grafting.',
            'sinus rhythm, chest drains removed.',
            'mobilize with physio, administer scheduled beta-blocker.',
            'S: Post-CABG day 3 step-down. B: Triple vessel coronary artery bypass grafting. A: sinus rhythm, chest drains removed. R: mobilize with physio, administer scheduled beta-blocker.',
            'Stale', False
        ),
        (
            'D-201', 'Venkatesh Rao', 'MER-PAT-0087110', '54M', 'Normal 0', None, '07:06 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'Cellulitis left lower limb, day 4.',
            'Diabetes mellitus type 2.',
            'erythema regressing, afebrile.',
            'complete IV vancomycin course, wound care daily.',
            'S: Cellulitis left lower limb, day 4. B: Diabetes mellitus type 2. A: erythema regressing, afebrile. R: complete IV vancomycin course, wound care daily.',
            'Stale', False
        ),
        (
            'D-204', 'Farhan Ahmed', 'MER-PAT-0087111', '38M', 'Normal 0', None, '07:07 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'Acute gastroenteritis, rehydrated.',
            'Dehydration secondary to foodborne illness.',
            'vitals normalized, tolerating oral fluids.',
            'finalize discharge summary, counsel on hydration.',
            'S: Acute gastroenteritis, rehydrated. B: Dehydration secondary to foodborne illness. A: vitals normalized, tolerating oral fluids. R: finalize discharge summary, counsel on hydration.',
            'Stale', False
        ),
        (
            'B-102', 'Meenakshi Sundaram', 'MER-PAT-0087112', '71F', 'Normal 1', None, '07:08 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'Total knee replacement day 2.',
            'Severe bilateral osteoarthritis.',
            'CPM machine tolerated, surgical site intact.',
            'advance physical therapy, PCA pump wean.',
            'S: Total knee replacement day 2. B: Severe bilateral osteoarthritis. A: CPM machine tolerated, surgical site intact. R: advance physical therapy, PCA pump wean.',
            'Stale', False
        ),
        (
            'B-105', 'Gopalakrishnan S.', 'MER-PAT-0087113', '63M', 'Normal 0', None, '07:09 \u00b7 Sheela J', 'Sheela J', 'Anitha Kumar',
            'Syncope under investigation, telemetry clear.',
            'Hypertensive heart disease.',
            '24h Holter negative for arrhythmias.',
            'cardiology review, echo report confirmation.',
            'S: Syncope under investigation, telemetry clear. B: Hypertensive heart disease. A: 24h Holter negative for arrhythmias. R: cardiology review, echo report confirmation.',
            'Stale', False
        )
    ]

    cur.executemany("""
        INSERT INTO ward_sbar_handovers (
            bed_no, patient_name, uhid, age_gender, ews, mar_due, last_handover_time, from_nurse, to_nurse,
            situation, background, assessment, recommendation, sbar_full, status, acknowledged
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, seed_data)

    conn.commit()
    cur.close()
    conn.close()
    print("Successfully migrated and seeded ward_sbar_handovers with 13 records!")

if __name__ == '__main__':
    run_migration()
