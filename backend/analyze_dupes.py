from db.postgres_connector import PostgresConnector

db = PostgresConnector()
conn = db.get_connection()
cur = db.get_dict_cursor(conn)

cur.execute("""
    SELECT LOWER(TRIM(first_name)) as fn, LOWER(TRIM(last_name)) as ln, date_of_birth, COUNT(*) as cnt, array_agg(id ORDER BY id ASC) as ids
    FROM patients
    GROUP BY LOWER(TRIM(first_name)), LOWER(TRIM(last_name)), date_of_birth
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC;
""")
dupes = cur.fetchall()
print(f"Found {len(dupes)} duplicate groups:")
for d in dupes:
    print(f"{d['fn']} {d['ln']} (DOB: {d['date_of_birth']}): {d['cnt']} records, IDs: {d['ids']}")
