import sys
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.path.insert(0, r'e:\Bosco-projects\POC\Health-care\code\health-care\backend')
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

print("=== NOTIFICATIONS COUNT ===")
cur.execute("SELECT COUNT(*) FROM notifications")
print("Total:", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM notifications WHERE status != 'READ'")
print("Unread (not READ):", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM notifications WHERE status IN ('PENDING','SENT','UNREAD')")
print("Unread (PENDING/SENT/UNREAD):", cur.fetchone()[0])
cur.execute("SELECT DISTINCT status FROM notifications")
print("Distinct statuses:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT DISTINCT notification_type FROM notifications")
print("Distinct notification_types:", [r[0] for r in cur.fetchall()])

print("\n=== ESCALATIONS COUNT ===")
cur.execute("SELECT COUNT(*) FROM escalations")
print("Total escalations:", cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM escalations WHERE status != 'RESOLVED'")
print("Active escalations:", cur.fetchone()[0])

print("\n=== USERS TABLE COLUMNS ===")
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='users' 
    ORDER BY ordinal_position
""")
print("Users columns:", [r[0] for r in cur.fetchall()])

print("\n=== NOTIFICATIONS TABLE - check for role columns ===")
cur.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='notifications'
    ORDER BY ordinal_position
""")
print("Notification columns:", [r[0] for r in cur.fetchall()])

print("\n=== CHECK NOTIFICATIONS STATUS VALUES vs MARK READ ===")
# The backend does: UPDATE notifications SET status = 'READ' WHERE id = %s
# But status field has values: FAILED, DELIVERED, PENDING, SENT
# The unread check in backend is: status NOT IN ('READ') - but no rows have 'READ'!
cur.execute("SELECT status, COUNT(*) FROM notifications GROUP BY status ORDER BY status")
print("Notification status distribution:")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")

print("\n=== CHECK count endpoint logic ===")
# Backend uses: SELECT COUNT(*) FROM notifications WHERE status != 'READ';
# Since no notifications have status='READ', ALL 386 will show as unread
cur.execute("SELECT COUNT(*) FROM notifications WHERE status != 'READ'")
print("Count (status != 'READ'):", cur.fetchone()[0])
# App.jsx reads: countData.unread (but API returns unread_count not unread!)
print("NOTE: API returns 'unread_count' but App.jsx reads 'countData.unread'")
print("This means alertsCount will always be 0!")

print("\n=== CHECK if app.jsx auth state has role ===")
# Check if there's role column in users
cur.execute("""
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name='users' AND column_name IN ('role','username','id','email')
    ORDER BY ordinal_position
""")
print("Relevant users columns:", cur.fetchall())

cur.close()
conn.close()
print("\nDone.")
