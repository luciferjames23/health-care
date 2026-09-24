import sys, os, time, traceback
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath("."))
import db_config
from agent import agent_service

phone2 = f"91998{int(time.time())%1000000:06d}"
session2 = f"WA_{phone2}"
r1 = agent_service.process_agent_message(session2, None, "First-time visitor", interactive_id="btn_first_time")
print("R1:", repr(r1.get("response")))
r2 = agent_service.process_agent_message(session2, None, "QA TestUser")
print("R2:", repr(r2.get("response")))
r3 = agent_service.process_agent_message(session2, None, "15 May 1995")
print("R3:", repr(r3.get("response")))
r4 = agent_service.process_agent_message(session2, None, "Male", interactive_id="btn_g_male")
print("R4:", repr(r4.get("response")))

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT id, patient_code, first_name, last_name, date_of_birth, gender FROM patients WHERE whatsapp_number LIKE %s ORDER BY id DESC LIMIT 1;", (f"%{phone2[-10:]}",))
p_row = cur.fetchone()
print("DB Row:", p_row)
cur.close()
conn.close()
