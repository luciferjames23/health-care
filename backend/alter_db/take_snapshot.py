#!/usr/bin/env python3
"""
take_snapshot.py — Capture the current DB state as a snapshot file.

Run this ONCE to lock in the current state. After this, running reset_db.py
will bring the database back to exactly this state — including undoing status
changes on existing rows (e.g. a patient you moved to Discharged will go back
to Admitted).

Snapshot file: backend/alter_db/snapshot_data.json
"""

import sys
import os
import json
import datetime
from decimal import Decimal

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import db_config

SNAPSHOT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshot_data.json")


def json_serializer(obj):
    if isinstance(obj, (datetime.datetime, datetime.date, datetime.time)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


def fetch_table(cur, table, id_col, columns="*", order_col=None):
    order = order_col or id_col
    cur.execute(f"SELECT {columns} FROM {table} ORDER BY {order} ASC")
    col_names = [desc[0] for desc in cur.description]
    rows = [dict(zip(col_names, row)) for row in cur.fetchall()]
    return rows


def take_snapshot():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    snapshot = {
        "_meta": {
            "created_at": datetime.datetime.now().isoformat(),
            "description": "Full DB snapshot for reset_db.py restore"
        }
    }

    print("=" * 60)
    print("  TAKING DATABASE SNAPSHOT")
    print(f"  Time: {snapshot['_meta']['created_at']}")
    print("=" * 60)

    # ── 1. Watermarks for LARGE tables (only delete excess rows on reset) ────
    # We don't snapshot full data for these — just the max ID.
    large_tables = {
        "patients"         : "id",
        "appointments"     : "id",
        "vital_signs"      : "vital_id",
        "diagnoses"        : "diagnosis_id",
        "bills"            : "bill_id",
        "lab_orders"       : "lab_order_id",
        "lab_results"      : "lab_result_id",
        "prescriptions"    : "prescription_id",
        "pharmacy_sales"   : "sale_id",
        "patient_visits"   : "visit_id",
        "insurance_claims" : "claim_id",
        "discharge_summaries" : "summary_id",
        "bed_assignments"  : "assignment_id",
        "payments"         : "id",
    }

    watermarks = {}
    for table, id_col in large_tables.items():
        try:
            cur.execute(f"SELECT COALESCE(MAX({id_col}), 0), COUNT(*) FROM {table}")
            max_id, count = cur.fetchone()
            watermarks[table] = {"id_col": id_col, "max_id": int(max_id), "count": int(count)}
            print(f"  [WM]   {table}: max_id={max_id}, count={count}")
        except Exception as e:
            print(f"  [ERR]  {table}: {e}")
            conn.rollback()

    snapshot["watermarks"] = watermarks

    # ── 2. Full data snapshot for SMALL / CRITICAL tables ───────────────────
    # These are fully restored (TRUNCATE + INSERT) on reset.
    small_tables = {
        "admissions": {
            "id_col": "admission_id",
            "columns": "admission_id, admission_number, patient_id, visit_id, doctor_id, "
                       "department_id, ward_id, bed_id, admission_date, admission_type, "
                       "admission_source, reason_for_admission, discharge_date, discharge_status"
        },
        "dim_generated_discharge_summaries": {
            "id_col": "summary_id",
            "columns": "*"
        },
        "dim_admission_inputs": {
            "id_col": "admission_id",
            "columns": "*"
        },
        "ward_sbar_handovers": {
            "id_col": "id",
            "columns": "*"
        },
        "beds": {
            "id_col": "bed_id",
            "columns": "*"
        },
    }

    full_data = {}
    for table, cfg in small_tables.items():
        try:
            rows = fetch_table(cur, table, cfg["id_col"], cfg["columns"])
            full_data[table] = {
                "id_col": cfg["id_col"],
                "rows": rows,
                "count": len(rows)
            }
            print(f"  [SNAP] {table}: {len(rows)} rows captured")
        except Exception as e:
            print(f"  [ERR]  {table}: {e}")
            conn.rollback()

    snapshot["full_data"] = full_data

    # ── 3. Status-only snapshots for large tables that have mutable statuses ─
    # We capture JUST the ID + status columns for existing rows.
    # On reset we UPDATE only these columns (don't delete/re-insert).
    status_snapshots = {}

    # bills — capture mutable status columns
    try:
        cur.execute("""
            SELECT bill_id, bill_status
            FROM bills ORDER BY bill_id
        """)
        cols = [d[0] for d in cur.description]
        status_snapshots["bills"] = {
            "id_col": "bill_id",
            "status_cols": ["bill_status"],
            "rows": [dict(zip(cols, r)) for r in cur.fetchall()]
        }
        print(f"  [STAT] bills: {len(status_snapshots['bills']['rows'])} status rows captured")
    except Exception as e:
        print(f"  [ERR]  bills status: {e}")
        conn.rollback()

    # vital_signs — capture current values for existing rows
    try:
        cur.execute("""
            SELECT vital_id, temperature, heart_rate, systolic_bp, diastolic_bp,
                   oxygen_saturation, respiratory_rate
            FROM vital_signs ORDER BY vital_id
        """)
        cols = [d[0] for d in cur.description]
        status_snapshots["vital_signs"] = {
            "id_col": "vital_id",
            "status_cols": ["temperature", "heart_rate", "systolic_bp", "diastolic_bp",
                            "oxygen_saturation", "respiratory_rate"],
            "rows": [dict(zip(cols, r)) for r in cur.fetchall()]
        }
        print(f"  [STAT] vital_signs: {len(status_snapshots['vital_signs']['rows'])} rows captured")
    except Exception as e:
        print(f"  [ERR]  vital_signs status: {e}")
        conn.rollback()

    snapshot["status_snapshots"] = status_snapshots

    conn.close()

    # ── Write snapshot to file ───────────────────────────────────────────────
    with open(SNAPSHOT_FILE, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, default=json_serializer, indent=2)

    size_kb = os.path.getsize(SNAPSHOT_FILE) / 1024
    print("\n  Snapshot saved -> " + SNAPSHOT_FILE)
    print(f"  File size: {size_kb:.1f} KB")
    print("=" * 60)
    print("  SNAPSHOT COMPLETE - run reset_db.py to restore this state")
    print("=" * 60)
    print()


if __name__ == "__main__":
    take_snapshot()
