import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

def test_fetch(search_term):
    pat_term = f"%{search_term}%"
    sql = """
        SELECT 
            p.id as patient_id,
            p.patient_code,
            p.first_name,
            p.last_name,
            p.gender,
            p.date_of_birth,
            p.phone,
            p.preferred_language,
            COALESCE(dim_adm.admission_id, a.admission_id, p.id) as admission_id,
            COALESCE(dim_adm.admission_number, a.admission_number, 'ADM-' || p.id::text) as admission_number,
            COALESCE(dim_adm.admission_date::text, a.admission_date::text, CURRENT_DATE::text) as admission_date,
            COALESCE(dim_adm.reason_for_admission, dim_adm.primary_diagnosis, a.reason_for_admission, pv.chief_complaint, 'Clinical Inpatient Care') as reason_for_admission,
            COALESCE(pi.insurance_provider, 'Star Health & Allied Insurance') as insurance_provider,
            COALESCE(pi.policy_number, 'STAR-POL-' || p.id::text) as policy_number,
            COALESCE(pi.policy_type, 'Comprehensive Health Care') as policy_type,
            COALESCE(pi.coverage_limit, 500000.00) as coverage_limit,
            COALESCE(pi.status, 'Active') as policy_status,
            COALESCE(b.bill_id, 101) as bill_id,
            COALESCE(b.bill_number, 'MER-BIL-' || p.id::text) as bill_number,
            COALESCE(b.net_amount, b.gross_amount, 24500.00) as estimated_cost,
            COALESCE(d.doctor_name, dim_adm.attending_doctor, 'Dr. Sneha Das') as doctor_name,
            COALESCE(d.department_name, w.ward_name, dim_adm.ward_name, 'General Medicine') as department_name,
            COALESCE(w.ward_name, dim_adm.ward_name, 'General Care Ward') as ward_name,
            COALESCE(bd.bed_number, dim_adm.bed_number, 'BED-001') as bed_number
        FROM patients p
        LEFT JOIN dim_admission_inputs dim_adm ON p.id = dim_adm.patient_id
        LEFT JOIN admissions a ON p.id = a.patient_id
        LEFT JOIN patient_visits pv ON p.id = pv.patient_id
        LEFT JOIN patient_insurance pi ON p.id = pi.patient_id
        LEFT JOIN bills b ON (p.id = b.patient_id OR a.admission_id = b.admission_id)
        LEFT JOIN (
            SELECT doc.id as doctor_id, COALESCE(doc.display_name, concat(doc.first_name, ' ', doc.last_name)) as doctor_name, dep.department_name 
            FROM doctors doc 
            LEFT JOIN departments dep ON doc.department_id = dep.id
        ) d ON a.doctor_id = d.doctor_id
        LEFT JOIN wards w ON a.ward_id = w.ward_id
        LEFT JOIN beds bd ON a.bed_id = bd.bed_id
        WHERE (p.first_name || ' ' || COALESCE(p.last_name, '')) ILIKE %s OR p.patient_code ILIKE %s OR p.id::text = %s
        ORDER BY p.id DESC
        LIMIT 1;
    """
    cur.execute(sql, (pat_term, pat_term, search_term))
    row = cur.fetchone()
    print("\nFound row for", search_term, ":")
    print(row)

test_fetch('Hinata Mephisto')
test_fetch('1004429')
test_fetch('Aarav Krishnan')
conn.close()
