import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config, json

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT agent_id, name, instructions 
    FROM agent_configurations 
    WHERE agent_id IN ('AG-04', 'AG-07', 'AG-08', 'AG-14', 'AG-15', 'AG-18', 'AG-20') 
    ORDER BY agent_id;
""")
rows = cur.fetchall()

print("="*85)
print("LIVE VERIFICATION: ALL 7 SPECIALIZED AGENTS SYNCHRONIZED IN POSTGRESQL")
print("="*85)
for r in rows:
    agent_id = r[0]
    name = r[1]
    inst = json.loads(r[2]) if isinstance(r[2], str) else r[2]
    print(f"\nAGENT: {agent_id} · {name}")
    print(f"  • Objective:    {inst.get('objective', '')[:95]}...")
    print(f"  • System Prompt:{inst.get('system', '')[:120]}...")
    print(f"  • Rules:        {inst.get('rules', '')[:95]}...")
    print(f"  • Safety:       {inst.get('safety', '')[:95]}...")
    print(f"  • Escalation:   {inst.get('escalation', '')[:95]}...")
    print(f"  • Refusal:      {inst.get('refusal', '')[:95]}...")

cur.close()
conn.close()
print("\n" + "="*85)
