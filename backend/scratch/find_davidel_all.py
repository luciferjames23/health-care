import sys
sys.path.append('backend')
from routers.clinical_operations import get_all_patients_directory
from routers.gold import get_dim_admission_inputs, get_dim_generated_discharge_summaries
import json

print("--- 1. get_dim_admission_inputs ---")
adm_res = get_dim_admission_inputs(discharge_status='all')
for p in adm_res.get('data', []):
    if 'Davidel' in str(p.get('first_name')) or str(p.get('patient_id')) == '87264':
        print("Admission record:", {k: p[k] for k in ['patient_id', 'first_name', 'last_name', 'age_at_admission', 'gender', 'attending_doctor', 'department', 'discharge_status', 'admission_type'] if k in p})

print("\n--- 2. get_dim_generated_discharge_summaries ---")
ds_res = get_dim_generated_discharge_summaries()
for p in ds_res.get('data', []):
    if 'Davidel' in str(p.get('patient_name')) or str(p.get('patient_id')) == '87264':
        print("Discharge Summary record:", {k: p[k] for k in ['summary_id', 'patient_id', 'patient_name', 'age', 'gender', 'primary_consultant', 'doctor_name', 'approval_status', 'discharge_status'] if k in p})

print("\n--- 3. get_all_patients_directory(category='ER') ---")
er_res = get_all_patients_directory(category='ER')
for p in er_res.get('data', []):
    if 'Davidel' in str(p.get('patient_name')) or str(p.get('patient_id')) == '87264' or '87264' in str(p.get('patient_code')):
        print("ER API record:", {k: p[k] for k in ['patient_id', 'patient_code', 'patient_name', 'age', 'gender', 'doctor', 'department', 'status', 'patient_type'] if k in p})

print("\n--- 4. get_all_patients_directory(category='OP') ---")
op_res = get_all_patients_directory(category='OP')
for p in op_res.get('data', []):
    if 'Davidel' in str(p.get('patient_name')) or str(p.get('patient_id')) == '87264' or '87264' in str(p.get('patient_code')):
        print("OP API record:", {k: p[k] for k in ['patient_id', 'patient_code', 'patient_name', 'age', 'gender', 'doctor', 'department', 'status', 'patient_type'] if k in p})

print("\n--- 5. get_all_patients_directory(category='All') ---")
all_res = get_all_patients_directory(category='All', search='Davidel')
for p in all_res.get('data', []):
    print("All API record:", {k: p[k] for k in ['patient_id', 'patient_code', 'patient_name', 'age', 'gender', 'doctor', 'department', 'status', 'patient_type'] if k in p})
