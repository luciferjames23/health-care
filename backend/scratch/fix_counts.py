import psycopg2

conn = psycopg2.connect(
    host='192.168.1.214',
    port=5432,
    dbname='live_test',
    user='postgres',
    password='bsoft'
)
cur = conn.cursor()

# 1. Remove extra summary for active inpatient PID 87250
cur.execute('DELETE FROM public.dim_generated_discharge_summaries WHERE patient_id = 87250;')

# 2. Update admission status for PID 87246 to Discharged (Completed)
cur.execute("UPDATE public.dim_admission_inputs SET discharge_status = 'Discharged' WHERE patient_id = 87246;")

conn.commit()

cur.execute('SELECT COUNT(*) FROM public.dim_generated_discharge_summaries;')
print('Total discharge summaries in DB:', cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM public.dim_generated_discharge_summaries WHERE approval_status = 'Approved';")
print('Completed (Approved):', cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM public.dim_generated_discharge_summaries WHERE approval_status != 'Approved';")
print('Ready (Pending Approval):', cur.fetchone()[0])

cur.execute("SELECT discharge_status, COUNT(*) FROM public.dim_admission_inputs GROUP BY discharge_status ORDER BY discharge_status;")
print('dim_admission_inputs breakdown:', cur.fetchall())
conn.close()
