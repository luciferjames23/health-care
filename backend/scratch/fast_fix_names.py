import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection
from connectors.databricks_connector import DatabricksConnector
import psycopg2.extras

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

# Update specific patient 111116 first
fn_111116 = FIRST_NAMES_MALE[111116 % len(FIRST_NAMES_MALE)]
ln_111116 = LAST_NAMES[(111116 // 7) % len(LAST_NAMES)]
full_111116 = f"{fn_111116} {ln_111116}"
cur.execute("UPDATE patients SET first_name = %s, last_name = %s, gender = 'Male' WHERE id = 111116;", (fn_111116, ln_111116))
print(f"Updated Patient 111116 -> {full_111116}")

# Update notifications referencing 111116
cur.execute("""
    UPDATE notifications 
    SET message = REPLACE(message, 'Patient #111116', %s) 
    WHERE patient_id = 111116;
""", (full_111116,))
print("Updated notifications for 111116.")

# Update any notifications with 'Patient #...' for patients that have appointments
cur.execute("""
    SELECT DISTINCT patient_id 
    FROM notifications 
    WHERE patient_id IS NOT NULL;
""")
notif_pids = [r[0] for r in cur.fetchall()]

# Update those active notification patients to real names
cur.execute("SELECT id, gender FROM patients WHERE id = ANY(%s) AND (first_name ILIKE 'Patient' OR last_name LIKE '%%#');", (notif_pids,))
active_placeholder = cur.fetchall()
print(f"Active notification placeholder patients: {len(active_placeholder)}")

if active_placeholder:
    batch = []
    for pid, g in active_placeholder:
        is_female = (pid % 2 == 1)
        fn = FIRST_NAMES_FEMALE[pid % len(FIRST_NAMES_FEMALE)] if is_female else FIRST_NAMES_MALE[pid % len(FIRST_NAMES_MALE)]
        ln = LAST_NAMES[(pid // 7) % len(LAST_NAMES)]
        gen = 'Female' if is_female else 'Male'
        batch.append((pid, fn, ln, gen))
    
    psycopg2.extras.execute_values(
        cur,
        """
        UPDATE patients AS p
        SET first_name = v.first_name,
            last_name = v.last_name,
            gender = v.gender
        FROM (VALUES %s) AS v(id, first_name, last_name, gender)
        WHERE p.id = v.id;
        """,
        batch
    )
    print(f"Updated {len(batch)} active patients via execute_values.")

    # Update messages in notifications table
    for pid, fn, ln, gen in batch:
        cur.execute("""
            UPDATE notifications 
            SET message = REPLACE(REPLACE(message, %s, %s), %s, %s)
            WHERE patient_id = %s;
        """, (f"Patient #{pid}", f"{fn} {ln}", f"Patient {pid}", f"{fn} {ln}", pid))

conn.commit()
DatabricksConnector.clear_cache()
print("Commit complete and cache cleared.")

# Verify patient 111116
cur.execute("SELECT id, patient_code, first_name, last_name, gender, phone FROM patients WHERE id = 111116;")
print("Verification 111116:", cur.fetchone())

# Verify notifications for 111116
cur.execute("SELECT id, patient_id, notification_type, message FROM notifications WHERE patient_id = 111116 LIMIT 3;")
print("Verification notifications 111116:")
for r in cur.fetchall():
    print(r)

conn.close()
