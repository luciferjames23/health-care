import sys
sys.path.append('backend')
from routers.clinical_operations import get_all_patients_directory
from routers.gold import get_dim_admission_inputs, get_dim_generated_discharge_summaries
import json

er = get_all_patients_directory(category='ER')
print("ER count:", len(er.get('data', [])))
for p in er.get('data', []):
    print("ER item:", p.get('patient_id'), p.get('patient_code'), p.get('patient_name'), p.get('doctor'), p.get('department'), p.get('status'))

print("\n--- Discharged patients from dim_generated_discharge_summaries ---")
ds = get_dim_generated_discharge_summaries()
for p in ds.get('data', []):
    if p.get('approval_status') == 'Approved' or p.get('patient_id') == 87264:
        print("DS item:", p.get('patient_id'), p.get('patient_name'), p.get('primary_consultant'), p.get('doctor_name'), p.get('department'), p.get('approval_status'), p.get('age'), p.get('gender'))

print("\n--- Inpatient admissions from dim_admission_inputs ---")
adm = get_dim_admission_inputs(discharge_status='all')
for p in adm.get('data', []):
    if p.get('patient_id') == 87264:
        print("ADM item:", p.get('patient_id'), p.get('first_name'), p.get('last_name'), p.get('attending_doctor'), p.get('department'), p.get('discharge_status'), p.get('age_at_admission'), p.get('gender'))
