import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

def get_cols(table):
    cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")
    return [r[0] for r in cur.fetchall()]

print('prescriptions cols:', get_cols('prescriptions'))
print('prescription_items cols:', get_cols('prescription_items'))
print('bills cols:', get_cols('bills'))
print('bill_items cols:', get_cols('bill_items'))
print('appointments cols:', get_cols('appointments'))
print('pharmacy_sales cols:', get_cols('pharmacy_sales'))
print('pharmacy_sale_items cols:', get_cols('pharmacy_sale_items'))

pid = 1004429
print(f'\n=== ALL DATA FOR PATIENT {pid} (Hinata Mephisto) ===')

cur.execute("SELECT * FROM patients WHERE id = %s", (pid,))
print('Patient:', cur.fetchone())

cur.execute("SELECT * FROM dim_admission_inputs WHERE patient_id = %s", (pid,))
print('dim_admission_inputs:', cur.fetchall())

cur.execute("SELECT * FROM patient_visits WHERE patient_id = %s", (pid,))
print('patient_visits:', cur.fetchall())

cur.execute("SELECT * FROM prescriptions WHERE patient_id = %s", (pid,))
rxs = cur.fetchall()
print('prescriptions:', rxs)
for rx in rxs:
    rx_id = rx[0]
    cur.execute("SELECT * FROM prescription_items WHERE prescription_id = %s", (rx_id,))
    print('  prescription_items:', cur.fetchall())

cur.execute("SELECT * FROM bills WHERE patient_id = %s", (pid,))
bills = cur.fetchall()
print('bills:', bills)
for b in bills:
    b_id = b[0]
    cur.execute("SELECT * FROM bill_items WHERE bill_id = %s", (b_id,))
    print('  bill_items:', cur.fetchall())

cur.execute("SELECT * FROM appointments WHERE patient_id = %s", (pid,))
print('appointments:', cur.fetchall())

cur.execute("SELECT * FROM pharmacy_sales WHERE patient_id = %s OR admission_id IN (SELECT admission_id FROM dim_admission_inputs WHERE patient_id = %s)", (pid, pid))
sales = cur.fetchall()
print('pharmacy_sales:', sales)
for s in sales:
    s_id = s[0]
    cur.execute("SELECT * FROM pharmacy_sale_items WHERE sale_id = %s", (s_id,))
    print('  pharmacy_sale_items:', cur.fetchall())

conn.close()
