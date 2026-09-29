"""
Initialize any missing auxiliary tables in PostgreSQL:
- dim_generated_discharge_summaries
- dim_revenue_predictions
- fact_bed_demand_forecast_7day_detailed
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from db.postgres_connector import PostgresConnector

def init_tables():
    connector = PostgresConnector()
    conn = connector.get_connection()
    cur = conn.cursor()

    # 1. dim_generated_discharge_summaries
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dim_generated_discharge_summaries (
            summary_id BIGSERIAL PRIMARY KEY,
            admission_id BIGINT,
            patient_id BIGINT,
            doctor_id BIGINT,
            admission_date TIMESTAMP WITHOUT TIME ZONE,
            discharge_date TIMESTAMP WITHOUT TIME ZONE,
            diagnoses TEXT,
            case_history TEXT,
            investigations TEXT,
            treatment TEXT,
            primary_consultant VARCHAR(150),
            discharge_advice TEXT,
            surgery_details TEXT,
            patient_condition TEXT,
            generated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            ingestion_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            approval_status VARCHAR(50) DEFAULT 'Draft'
        );
        CREATE INDEX IF NOT EXISTS idx_dgds_adm ON dim_generated_discharge_summaries (admission_id);
        CREATE INDEX IF NOT EXISTS idx_dgds_pat ON dim_generated_discharge_summaries (patient_id);
        CREATE SEQUENCE IF NOT EXISTS dim_generated_discharge_summaries_summary_id_seq START WITH 90000 INCREMENT BY 1;
        ALTER TABLE dim_generated_discharge_summaries ALTER COLUMN summary_id SET DEFAULT nextval('dim_generated_discharge_summaries_summary_id_seq');
    """)

    # 2. dim_revenue_predictions
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dim_revenue_predictions (
            revenue_prediction_id BIGSERIAL PRIMARY KEY,
            bill_number VARCHAR(100),
            patient_id BIGINT,
            patient_number VARCHAR(100),
            patient_name VARCHAR(150),
            bill_date TIMESTAMP WITHOUT TIME ZONE,
            bill_status VARCHAR(50),
            actual_net_amount DOUBLE PRECISION,
            predicted_revenue DOUBLE PRECISION,
            prediction_variance DOUBLE PRECISION,
            model_name VARCHAR(100),
            prediction_date TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 3. fact_bed_demand_forecast_7day_detailed
    cur.execute("""
        CREATE TABLE IF NOT EXISTS fact_bed_demand_forecast_7day_detailed (
            forecast_id BIGSERIAL PRIMARY KEY,
            forecast_date DATE,
            day_of_week INT,
            day_name VARCHAR(20),
            is_weekend INT,
            ward_id INT,
            ward_name VARCHAR(100),
            floor_number INT,
            department_name VARCHAR(100),
            predicted_beds INT,
            predicted_emergency INT,
            predicted_elective INT,
            avg_length_of_stay DOUBLE PRECISION,
            prev_year_occupancy_rate DOUBLE PRECISION,
            predicted_occupancy_rate DOUBLE PRECISION,
            prediction_generated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            model_name VARCHAR(100),
            model_source VARCHAR(100),
            prediction_version VARCHAR(50)
        );
    """)

    conn.commit()
    print("Auxiliary PostgreSQL tables ensured.")
    conn.close()

if __name__ == "__main__":
    init_tables()
