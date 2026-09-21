"""
Fix duplicate doctor names by replacing A., B., C. etc. suffixed names
with completely different real first names.
Updates: doctors.first_name, doctors.display_name, users.first_name, users.staff_name
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import db_config

# Map: (original_first_name, last_name) -> { suffix_letter: new_first_name }
# Each suffix (A, B, C, D, E, F, G, H, K) gets a completely new, unique first name.
NAME_REPLACEMENTS = {
    # Patel group (original: Priya)
    ("Priya", "Patel"): {
        "A": "Kavita",
        "B": "Rashmi",
        "C": "Tanvi",
        "D": "Ishita",
        "E": "Manisha",
        "F": "Shruti",
        "G": "Nandini",
        "H": "Ritu",
        "K": "Pallavi",
    },
    # Reddy group (original: Ravi)
    ("Ravi", "Reddy"): {
        "A": "Harish",
        "B": "Venkat",
        "C": "Mahesh",
        "D": "Dinesh",
        "E": "Mohan",
        "F": "Ganesh",
        "G": "Ramesh",
        "H": "Naresh",
        "K": "Sunil",
    },
    # Iyer group (original: Anjali)
    ("Anjali", "Iyer"): {
        "A": "Lakshmi",
        "B": "Revathi",
        "C": "Padmini",
        "D": "Savitri",
        "E": "Vasanthi",
        "F": "Gayathri",
        "G": "Janani",
        "H": "Bhavani",
        "K": "Kamala",
    },
    # Singh group (original: Vikram)
    ("Vikram", "Singh"): {
        "A": "Rajesh",
        "B": "Deepak",
        "C": "Manish",
        "D": "Ashok",
        "E": "Nikhil",
        "F": "Gaurav",
        "G": "Tarun",
        "H": "Pawan",
        "K": "Varun",
    },
    # Nair group (original: Neha)
    ("Neha", "Nair"): {
        "A": "Swathi",
        "B": "Anitha",
        "C": "Deepa",
        "D": "Smitha",
        "E": "Rekha",
        "F": "Latha",
        "G": "Vimala",
        "H": "Geeta",
        "K": "Sarala",
    },
    # Menon group (original: Suresh)
    ("Suresh", "Menon"): {
        "A": "Arun",
        "B": "Brijesh",
        "C": "Chandan",
        "D": "Girish",
        "E": "Hemant",
        "F": "Jagdish",
        "G": "Kishore",
        "H": "Manoj",
        "K": "Pramod",
    },
    # Verma group (original: Divya)
    ("Divya", "Verma"): {
        "A": "Sunita",
        "B": "Asha",
        "C": "Usha",
        "D": "Suman",
        "E": "Kiran",
        "F": "Seema",
        "G": "Jyoti",
        "H": "Savita",
        "K": "Shobha",
    },
    # Kumar group (original: Rahul)
    ("Rahul", "Kumar"): {
        "A": "Vijay",
        "B": "Anil",
        "C": "Sathish",
        "D": "Mukesh",
        "E": "Naveen",
        "F": "Pranav",
        "G": "Rohit",
        "H": "Sandeep",
        "K": "Tushar",
    },
    # Das group (original: Sneha)
    ("Sneha", "Das"): {
        "A": "Mitali",
        "B": "Arpita",
        "C": "Ritika",
        "D": "Debika",
        "E": "Tithi",
        "F": "Madhuri",
        "G": "Nilima",
        "H": "Chandana",
        "K": "Kakoli",
    },
    # Bose group (original: Karthik)
    ("Karthik", "Bose"): {
        "A": "Sourav",
        "B": "Partha",
        "C": "Debashish",
        "D": "Aniket",
        "E": "Subhash",
        "F": "Tapan",
        "G": "Biswajit",
        "H": "Chiranjit",
        "K": "Dipankar",
    },
    # Pillai group (original: Pooja)
    ("Pooja", "Pillai"): {
        "A": "Meera",
        "B": "Radha",
        "C": "Shalini",
        "D": "Varsha",
        "E": "Yamini",
        "F": "Archana",
        "G": "Bhavana",
        "H": "Chitra",
        "K": "Devi",
    },
    # Rao group (original: Arjun)
    ("Arjun", "Rao"): {
        "A": "Krishna",
        "B": "Prasad",
        "C": "Srinivas",
        "D": "Raghav",
        "E": "Shankar",
        "F": "Balaji",
        "G": "Nagesh",
        "H": "Gopal",
        "K": "Sekhar",
    },
    # Gupta group (original: Meenakshi)
    ("Meenakshi", "Gupta"): {
        "A": "Aditi",
        "B": "Bhawna",
        "C": "Chhavi",
        "D": "Garima",
        "E": "Himani",
        "F": "Komal",
        "G": "Namrata",
        "H": "Payal",
        "K": "Sakshi",
    },
    # Jain group (original: Sanjay)
    ("Sanjay", "Jain"): {
        "A": "Nitin",
        "B": "Hitesh",
        "C": "Lalit",
        "D": "Vivek",
        "E": "Yogesh",
        "F": "Kamal",
        "G": "Bharat",
        "H": "Dheeraj",
        "K": "Gaurang",
    },
    # Sharma group (original: Amit)
    ("Amit", "Sharma"): {
        "A": "Harsh",
        "B": "Kartik",
        "C": "Lokesh",
        "D": "Neeraj",
        "E": "Pankaj",
        "F": "Sachin",
        "G": "Umesh",
        "H": "Ajay",
        "K": "Dev",
    },
}

conn = db_config.get_db_connection()
cur = conn.cursor()

updated = 0
errors = []

# Fetch all doctors with letter-suffix names
cur.execute("""
    SELECT d.id, d.user_id, d.first_name, d.last_name
    FROM doctors d
    WHERE d.first_name ~ '^[A-Z][a-z]+ [A-Z]\.$'
    ORDER BY d.id;
""")
rows = cur.fetchall()

print(f"Found {len(rows)} doctors to rename.\n")

for doc_id, user_id, first_name, last_name in rows:
    # Parse: "Priya A." -> base_name="Priya", suffix="A"
    parts = first_name.split()
    if len(parts) != 2 or not parts[1].endswith('.'):
        print(f"  SKIP ID={doc_id}: unexpected format '{first_name}'")
        continue
    
    base_name = parts[0]
    suffix = parts[1].rstrip('.')
    
    key = (base_name, last_name)
    if key not in NAME_REPLACEMENTS:
        errors.append(f"  ERROR ID={doc_id}: no mapping for ({base_name}, {last_name})")
        continue
    
    if suffix not in NAME_REPLACEMENTS[key]:
        errors.append(f"  ERROR ID={doc_id}: no mapping for suffix '{suffix}' in ({base_name}, {last_name})")
        continue
    
    new_first = NAME_REPLACEMENTS[key][suffix]
    new_display = f"Dr. {new_first} {last_name}"
    
    # Update doctors table
    cur.execute("""
        UPDATE doctors
        SET first_name = %s, display_name = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s;
    """, (new_first, new_display, doc_id))
    
    # Update users table (if linked)
    if user_id:
        cur.execute("""
            UPDATE users
            SET first_name = %s, staff_name = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (new_first, new_display, user_id))
    
    print(f"  OK ID={doc_id}: '{first_name} {last_name}' -> '{new_first} {last_name}' (display: {new_display})")
    updated += 1

if errors:
    print(f"\nWARNING - Errors:")
    for e in errors:
        print(e)
    conn.rollback()
    print("\nROLLED BACK due to errors.")
else:
    conn.commit()
    print(f"\nSUCCESS: Renamed {updated} doctors. Changes committed.")

cur.close()
conn.close()
