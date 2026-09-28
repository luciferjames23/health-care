import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection
from connectors.databricks_connector import DatabricksConnector

FIRST_NAMES_MALE = [
    "Aarav", "Aditya", "Ajay", "Amit", "Anand", "Anil", "Arjun", "Arun", "Ashok", "Balaji",
    "Deepak", "Dev", "Dinesh", "Ganesh", "Gautam", "Gopal", "Harish", "Hemant", "Karthik", "Kiran",
    "Krishna", "Madhav", "Manish", "Manoj", "Mohan", "Mukesh", "Murugan", "Naveen", "Nikhil", "Prakash",
    "Pranav", "Prashant", "Rahul", "Rajesh", "Rakesh", "Ramesh", "Rohan", "Sachin", "Sameer", "Sanjay",
    "Santosh", "Saravanan", "Senthil", "Siddharth", "Suresh", "Tarun", "Varun", "Venkatesh", "Vijay", "Vikram"
]

FIRST_NAMES_FEMALE = [
    "Aadhya", "Aishwarya", "Ananya", "Anita", "Anjali", "Anushka", "Aparna", "Archana", "Bhavna", "Chitra",
    "Deepa", "Divya", "Geetha", "Indira", "Jyoti", "Kavitha", "Keerthi", "Lakshmi", "Madhavi", "Malini",
    "Meena", "Meenakshi", "Nandini", "Neha", "Nisha", "Pavithra", "Pooja", "Pragya", "Preeti", "Priya",
    "Radha", "Radhika", "Rakhi", "Rashmi", "Rekha", "Renu", "Ritu", "Roshni", "Saanvi", "Sandhya",
    "Sangeetha", "Sapna", "Shalini", "Shilpa", "Shreya", "Sneha", "Sunita", "Swathi", "Vandana", "Vidya"
]

LAST_NAMES = [
    "Agarwal", "Balaji", "Bhat", "Chandran", "Chatterjee", "Chopra", "Deshmukh", "Dutta", "Gupta", "Iyengar",
    "Iyer", "Jain", "Joshi", "Kapoor", "Khan", "Krishnan", "Kumar", "Malhotra", "Mehta", "Menon",
    "Mishra", "Mukherjee", "Nair", "Nambiar", "Pai", "Patel", "Pillai", "Prasad", "Rangan", "Rao",
    "Reddy", "Roy", "Saxena", "Sen", "Sethuraman", "Sharma", "Shetty", "Singh", "Srinivasan", "Subramanian",
    "Sundaram", "Varma", "Venugopal", "Verma", "Vyas", "Yadav"
]

conn = get_db_connection()
cur = conn.cursor()

# Find all patients with placeholder names
cur.execute("SELECT id, gender FROM patients WHERE first_name ILIKE 'Patient' OR last_name LIKE '#%';")
placeholder_patients = cur.fetchall()
print(f"Assigning realistic names to {len(placeholder_patients)} placeholder patients...")

updates = []
for pid, gender in placeholder_patients:
    # Deterministic selection based on pid
    is_female = (pid % 2 == 1) or (str(gender).upper() == 'FEMALE')
    if is_female:
        fn = FIRST_NAMES_FEMALE[pid % len(FIRST_NAMES_FEMALE)]
        actual_gender = 'Female'
    else:
        fn = FIRST_NAMES_MALE[pid % len(FIRST_NAMES_MALE)]
        actual_gender = 'Male'
    
    ln = LAST_NAMES[(pid // 7) % len(LAST_NAMES)]
    updates.append((fn, ln, actual_gender, pid))

# Batch update
cur.executemany("""
    UPDATE patients 
    SET first_name = %s, 
        last_name = %s, 
        gender = COALESCE(NULLIF(gender, 'UNSPECIFIED'), %s)
    WHERE id = %s;
""", updates)
print(f"Updated {len(updates)} patients in database.")

# Verify patient 111116
cur.execute("SELECT id, patient_code, first_name, last_name, gender, phone FROM patients WHERE id = 111116;")
p111116 = cur.fetchone()
print("\nUpdated Patient 111116:")
print(p111116)

# Also check notifications for 111116 and update any 'Patient #111116' in message text
patient_full_name = f"{p111116[2]} {p111116[3]}"
cur.execute("""
    UPDATE notifications
    SET message = REPLACE(message, 'Patient #111116', %s)
    WHERE patient_id = 111116 OR message LIKE '%Patient #111116%';
""", (patient_full_name,))
print(f"Updated {cur.rowcount} notification messages for Patient 111116.")

conn.commit()
DatabricksConnector.clear_cache()
print("Cache cleared.")

conn.close()
