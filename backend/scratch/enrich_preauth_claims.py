import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
from psycopg2.extras import RealDictCursor

def enrich_preauth_claims():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Check current latest 300 claims
    cur.execute("SELECT claim_id FROM insurance_claims ORDER BY claim_id DESC LIMIT 300")
    ids = [r['claim_id'] for r in cur.fetchall()]
    print(f"Found {len(ids)} latest claims (min id: {min(ids)}, max id: {max(ids)})")
    
    # We will distribute realistic statuses across these 300 claims
    # Statuses:
    # 0..120: 'Approved'
    # 121..165: 'Pending'
    # 166..205: 'Submitted · awaiting insurer'
    # 206..235: 'Query Raised'
    # 236..255: 'Missing Documents'
    # 256..275: 'Additional Documents'
    # 276..290: 'High Denial Risk'
    # 291..300: 'Rejected'
    
    cur.execute("""
        UPDATE insurance_claims 
        SET claim_status = 'Approved' 
        WHERE claim_id IN %s
    """, (tuple(ids[0:120]),))
    
    cur.execute("""
        UPDATE insurance_claims 
        SET claim_status = 'Pending', approved_amount = 0 
        WHERE claim_id IN %s
    """, (tuple(ids[120:165]),))
    
    cur.execute("""
        UPDATE insurance_claims 
        SET claim_status = 'Submitted · awaiting insurer', approved_amount = 0 
        WHERE claim_id IN %s
    """, (tuple(ids[165:205]),))
    
    cur.execute("""
        UPDATE insurance_claims 
        SET claim_status = 'Query Raised', approved_amount = 0 
        WHERE claim_id IN %s
    """, (tuple(ids[205:235]),))
    
    cur.execute("""
        UPDATE insurance_claims 
        SET claim_status = 'Missing Documents', approved_amount = 0 
        WHERE claim_id IN %s
    """, (tuple(ids[235:255]),))
    
    cur.execute("""
        UPDATE insurance_claims 
        SET claim_status = 'Additional Documents' 
        WHERE claim_id IN %s
    """, (tuple(ids[255:275]),))
    
    cur.execute("""
        UPDATE insurance_claims 
        SET claim_status = 'High Denial Risk' 
        WHERE claim_id IN %s
    """, (tuple(ids[275:290]),))
    
    cur.execute("""
        UPDATE insurance_claims 
        SET claim_status = 'Rejected', approved_amount = 0, rejected_amount = claimed_amount,
            rejection_reason = 'Pre-existing condition clause exclusion (PED 24-month waiting period)'
        WHERE claim_id IN %s
    """, (tuple(ids[290:300]),))
    
    conn.commit()
    print("Preauth claims distribution updated successfully.")
    
    cur.execute("""
        SELECT claim_status, count(*) 
        FROM insurance_claims 
        WHERE claim_id IN %s 
        GROUP BY claim_status
    """, (tuple(ids),))
    for r in cur.fetchall():
        print(f"  {r['claim_status']}: {r['count']}")
        
    conn.close()

if __name__ == '__main__':
    enrich_preauth_claims()
