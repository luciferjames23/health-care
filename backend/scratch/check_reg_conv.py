import sys
sys.path.append('.')
import db_config
import json

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT id, current_intent FROM conversations WHERE conversation_code='WA_919999900001_reg_test'")
print("Conv:", cur.fetchone())

cur.execute("""
    SELECT id, sender_type, message_text, intent, metadata 
    FROM messages 
    WHERE conversation_id=(SELECT id FROM conversations WHERE conversation_code='WA_919999900001_reg_test') 
    ORDER BY id DESC LIMIT 5
""")
rows = cur.fetchall()
for r in rows:
    print(r[0], r[1], "| text:", r[2], "| intent:", r[3])
    if r[4]:
        try:
            m = json.loads(r[4])
            print("   metadata intent:", m.get("intent"), "| reg_fields:", m.get("registration_fields"))
        except Exception as e:
            print("   metadata parse error:", e)
conn.close()
