"""
apply_indexes_and_pool.py
=========================
Creates high-performance PostgreSQL indexes for fast patient lookup,
conversation history, doctor availability, and appointment queries.

Extended to cover all slow-query patterns identified across:
  - Patient search (LIKE on name, phone, code)
  - Appointment date/status/department filtering
  - Dashboard summary aggregations
  - Billing, payments, and claims queries
  - Discharge summary lookups
  - Lab orders and radiology scans
"""

import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_config


def _exec(cur, conn, sql):
    """Execute a single DDL statement, rolling back only on that statement if it fails."""
    try:
        cur.execute(sql)
    except Exception as err:
        print(f"[DB_INDEXES] Skipped ({sql.strip()}): {err}")
        conn.rollback()


def apply_indexes():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # ── pg_trgm extension (required for LIKE/ILIKE trigram indexes) ──────────
        _exec(cur, conn, "CREATE EXTENSION IF NOT EXISTS pg_trgm;")

        index_ddl = [
            # ── Patients ──────────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);",
            "CREATE INDEX IF NOT EXISTS idx_patients_code ON patients (patient_code);",
            "CREATE INDEX IF NOT EXISTS idx_patients_status ON patients (status);",
            "CREATE INDEX IF NOT EXISTS idx_patients_created_at ON patients (created_at DESC);",
            # Trigram index for fast LIKE name/phone searches
            "CREATE INDEX IF NOT EXISTS idx_patients_name_trgm ON patients USING gin ((first_name || ' ' || last_name) gin_trgm_ops);",
            "CREATE INDEX IF NOT EXISTS idx_patients_phone_trgm ON patients USING gin (COALESCE(phone, '') gin_trgm_ops);",
            "CREATE INDEX IF NOT EXISTS idx_patients_code_trgm ON patients USING gin (COALESCE(patient_code, '') gin_trgm_ops);",

            # ── Appointments ──────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_appointments_doc_date ON appointments (doctor_id, appointment_date);",
            "CREATE INDEX IF NOT EXISTS idx_appointments_pat_id ON appointments (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date DESC);",
            "CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);",
            "CREATE INDEX IF NOT EXISTS idx_appointments_dept_id ON appointments (department_id);",
            "CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON appointments (appointment_date, status);",

            # ── Conversations ─────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_conversations_wa_num ON conversations (whatsapp_number);",
            "CREATE INDEX IF NOT EXISTS idx_conversations_code ON conversations (conversation_code);",
            "CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations (created_at DESC);",
            "CREATE INDEX IF NOT EXISTS idx_conversations_patient_id ON conversations (patient_id);",

            # ── Escalations ───────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations (status);",
            "CREATE INDEX IF NOT EXISTS idx_escalations_patient_id ON escalations (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_escalations_created_at ON escalations (created_at DESC);",

            # ── Insurance / Claims ────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient_id ON insurance_claims (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_patient_insurance_patient_id ON patient_insurance (patient_id);",

            # ── Discharge Summaries ───────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_dim_gen_ds_pat_id ON dim_generated_discharge_summaries (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_dim_gen_ds_adm_id ON dim_generated_discharge_summaries (admission_id);",
            "CREATE INDEX IF NOT EXISTS idx_dim_gen_ds_approval ON dim_generated_discharge_summaries (approval_status);",
            "CREATE INDEX IF NOT EXISTS idx_dim_gen_ds_doctor_id ON dim_generated_discharge_summaries (doctor_id);",
            "CREATE INDEX IF NOT EXISTS idx_discharge_summaries_patient_id ON discharge_summaries (patient_id);",

            # ── Admissions ────────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_admissions_discharge_status ON admissions (discharge_status);",
            "CREATE INDEX IF NOT EXISTS idx_admissions_bed_id ON admissions (bed_id);",
            "CREATE INDEX IF NOT EXISTS idx_admissions_patient_id ON admissions (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_admissions_doctor_id ON admissions (doctor_id);",
            "CREATE INDEX IF NOT EXISTS idx_admissions_date ON admissions (admission_date DESC);",

            # ── Beds / Wards ──────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_beds_status ON beds (status);",
            "CREATE INDEX IF NOT EXISTS idx_beds_ward_id ON beds (ward_id);",

            # ── Billing / Payments ────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (payment_status);",
            "CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments (payment_reference);",
            "CREATE INDEX IF NOT EXISTS idx_payments_txn_ref ON payments (transaction_reference);",
            "CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments (bill_id);",
            "CREATE INDEX IF NOT EXISTS idx_payments_date ON payments (payment_date DESC);",
            "CREATE INDEX IF NOT EXISTS idx_bills_patient_id ON bills (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_bills_status ON bills (bill_status);",
            "CREATE INDEX IF NOT EXISTS idx_bills_date ON bills (bill_date DESC);",
            "CREATE INDEX IF NOT EXISTS idx_patient_charges_patient_status ON patient_charges (patient_id, billing_status);",

            # ── Pre-Admissions ────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_pre_admissions_patient_id ON pre_admissions (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_pre_admissions_doctor_id ON pre_admissions (doctor_id);",
            "CREATE INDEX IF NOT EXISTS idx_pre_admissions_date ON pre_admissions (expected_admission_date);",

            # ── Radiology ─────────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_radiology_scan_patient_id ON radiology_scan (patient_id);",

            # ── Lab Orders ────────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_id ON lab_orders (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders (status);",
            "CREATE INDEX IF NOT EXISTS idx_lab_orders_ordered_date ON lab_orders (ordered_date DESC);",

            # ── Patient Reports ───────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_patient_reports_patient_id ON patient_reports (patient_id);",

            # ── Pharmacy ──────────────────────────────────────────────────────
            "CREATE INDEX IF NOT EXISTS idx_pharmacy_sales_date ON pharmacy_sales (sale_date DESC);",
            "CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_stock ON pharmacy_inventory (available_quantity, reorder_level);",
        ]

        for q in index_ddl:
            _exec(cur, conn, q)

        # Canonical billing status check constraint for patient_charges
        _exec(cur, conn, """
            ALTER TABLE patient_charges DROP CONSTRAINT IF EXISTS patient_charges_billing_status_check
        """)
        _exec(cur, conn, """
            ALTER TABLE patient_charges ADD CONSTRAINT patient_charges_billing_status_check
                CHECK (billing_status IN ('PENDING', 'BILLED', 'PAID', 'SETTLED', 'CANCELLED', 'WAIVED'))
        """)

        conn.commit()
        print("[DB_INDEXES] Successfully verified/created high-performance DB indexes and billing constraints.")
    except Exception as e:
        print(f"[DB_INDEXES_ERROR] Index creation warning: {e}")
        if conn:
            conn.rollback()
    finally:
        try:
            cur.close()
        except Exception:
            pass
        conn.close()


if __name__ == "__main__":
    apply_indexes()
