import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from agent.patient_identification_service import get_all_patients_by_phone
from utils.phone_utils import normalize_phone, get_phone_query_params, get_phone_query_condition

def test_query():
    # Let's test get_phone_query_condition with different DB values and search values
    phone_formats_db = [
        "+1 (555) 669-8871",
        "+15556698871",
        "15556698871",
        "5556698871",
        "+1-555-669-8871",
        "015556698871"
    ]
    search_formats = [
        "+1 (555) 669-8871",
        "+15556698871",
        "15556698871",
        "5556698871",
        "+1-555-669-8871"
    ]
    
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cond = get_phone_query_condition()
        print(f"Condition SQL: {cond}")
        
        for search in search_formats:
            params = get_phone_query_params(search)
            print(f"Search: '{search}' -> Params: {params}")
            for db_val in phone_formats_db:
                # Test against a mock query or temp evaluation
                cur.execute(f"SELECT ({cond}) FROM (SELECT %s::text as phone, %s::text as whatsapp_number) t;",
                            (params[0], params[1], params[2], params[3], db_val, db_val))
                matched = cur.fetchone()[0]
                print(f"  DB Val: '{db_val}' -> Match: {matched}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    test_query()
