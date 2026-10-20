import db_config
conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM dim_generated_discharge_summaries WHERE primary_consultant ILIKE '%Himani%';")
print("dim_gen for Himani:", cur.fetchone()[0])
