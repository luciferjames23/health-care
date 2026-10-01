import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

tables = [
    ('patients', 'id'),
    ('admissions', 'admission_id'),
    ('vital_signs', 'vital_id'),
    ('diagnoses', 'diagnosis_id'),
    ('bills', 'bill_id'),
    ('lab_orders', 'lab_order_id'),
    ('lab_results', 'lab_result_id'),
    ('prescriptions', 'prescription_id'),
    ('pharmacy_sales', 'sale_id'),
    ('appointments', 'id'),
    ('patient_visits', 'visit_id'),
    ('dim_generated_discharge_summaries', 'summary_id'),
    ('dim_admission_inputs', 'admission_id'),
    ('ward_sbar_handovers', 'id'),
    ('insurance_claims', 'claim_id'),
    ('payments', 'id'),
    ('beds', 'bed_id'),
    ('bed_assignments', 'assignment_id'),
    ('patient_procedures', 'id'),
    ('patient_insurance', 'id'),
    ('consent_record', 'consent_id'),
    ('notifications', 'notification_id'),
    ('discharge_summaries', 'summary_id'),
]

print('Table | Count | Max ID')
print('-' * 60)
for table, id_col in tables:
    try:
        cur.execute(f'SELECT COUNT(*), MAX({id_col}) FROM {table}')
        count, max_id = cur.fetchone()
        print(f'{table} | {count} | {max_id}')
    except Exception as e:
        print(f'{table} | ERROR: {e}')
        conn.rollback()

# dim_generated_discharge_summaries breakdown
try:
    cur.execute("SELECT approval_status, COUNT(*) FROM dim_generated_discharge_summaries GROUP BY approval_status")
    print('\ndim_generated_discharge_summaries by approval_status:')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]}')
except Exception as e:
    print(f'ERROR: {e}')
    conn.rollback()

# admissions discharge_status breakdown
try:
    cur.execute("SELECT discharge_status, COUNT(*) FROM admissions GROUP BY discharge_status")
    print('\nadmissions by discharge_status:')
    for row in cur.fetchall():
        print(f'  {row[0]}: {row[1]}')
except Exception as e:
    print(f'ERROR: {e}')
    conn.rollback()

conn.close()
