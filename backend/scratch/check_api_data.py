import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.clinical_operations import get_all_patients_directory
from routers.gold import get_dim_admission_inputs, get_dim_generated_discharge_summaries

print("--- 1. get_dim_admission_inputs(discharge_status='all') ---")
ar = get_dim_admission_inputs(discharge_status='all')
ar_data = ar.get('data', [])
dc_in_ar = [r for r in ar_data if str(r.get('discharge_status') or r.get('admission_status') or '').lower() == 'discharged']
print(f"Total ar_data: {len(ar_data)}, Discharged in ar: {len(dc_in_ar)}")
for r in dc_in_ar:
    print(" ", r.get('patient_id'), r.get('patient_name'), r.get('discharge_status'))

print("\n--- 2. get_all_patients_directory(category='ALL') ---")
dir_all = get_all_patients_directory(category='ALL')
dir_data = dir_all.get('data', [])
dc_in_dir = [r for r in dir_data if str(r.get('discharge_status') or r.get('status') or r.get('patient_type') or '').lower() == 'discharged']
print(f"Total dir_data: {len(dir_data)}, Discharged in dir: {len(dc_in_dir)}")
for r in dc_in_dir:
    print(" ", r.get('patient_id'), r.get('patient_name'), r.get('patient_type'), r.get('status'), r.get('discharge_status'))
