import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import psycopg2.extras

def main():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        print("=== DOCTOR_SCHEDULES TABLE COLUMNS ===")
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'doctor_schedules'
            ORDER BY ordinal_position;
        """)
        cols = cur.fetchall()
        for c in cols:
            print(f"  {c['column_name']:<25} | {c['data_type']:<20} | Nullable: {c['is_nullable']}")

        print("\n=== SAMPLE DOCTOR_SCHEDULES ROWS ===")
        cur.execute("""
            SELECT ds.id, ds.doctor_id, d.display_name, ds.day_of_week, ds.start_time, ds.end_time, ds.slot_duration_minutes, ds.status
            FROM doctor_schedules ds
            JOIN doctors d ON ds.doctor_id = d.id
            ORDER BY ds.doctor_id, ds.id
            LIMIT 15;
        """)
        rows = cur.fetchall()
        for r in rows:
            print(dict(r))

    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
