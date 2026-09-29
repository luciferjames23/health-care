#!/usr/bin/env python3
"""
reset_db.py — Restore the database to the exact state saved by take_snapshot.py.

What this does:
  1. Deletes ALL rows added beyond the snapshot watermarks (new patients, new admissions, etc.)
  2. FULLY RESTORES small/critical tables (admissions, dim tables, SBAR, beds)
     by truncating and re-inserting exact snapshot rows.
  3. RESTORES status columns on large tables (bills, vital_signs) so any
     status changes you made during testing are undone.

Example:
  - You added a new patient and moved them to 'Discharged'  → patient deleted, status gone
  - You changed an existing patient's status to 'Discharged' → status reverted to snapshot value
  - You generated new discharge summaries                    → excess deleted, others restored

REQUIRES: backend/alter_db/snapshot_data.json (run take_snapshot.py first)
"""

import sys
import os
import json
import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import db_config

SNAPSHOT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshot_data.json")


def separator(label=""):
    print(f"\n{'─' * 60}")
    if label:
        print(f"  {label}")
        print(f"{'─' * 60}")


def restore_table_full(cur, table, id_col, rows):
    """Truncate + re-insert all snapshot rows for a small/critical table."""
    if not rows:
        print(f"  [SKIP] {table}: no snapshot rows")
        return

    cur.execute(f"DELETE FROM {table};")
    print(f"  [CLR]  {table}: cleared {cur.rowcount} current rows")

    col_names = list(rows[0].keys())
    placeholders = ", ".join(["%s"] * len(col_names))
    cols_sql = ", ".join(col_names)
    insert_sql = f"INSERT INTO {table} ({cols_sql}) VALUES ({placeholders}) ON CONFLICT DO NOTHING;"

    inserted = 0
    for row in rows:
        values = [row[c] for c in col_names]
        try:
            cur.execute(insert_sql, values)
            inserted += cur.rowcount
        except Exception as e:
            print(f"  [WARN] {table} row insert failed: {e}")

    print(f"  [OK]   {table}: restored {inserted}/{len(rows)} rows")


def restore_status_columns(cur, table, id_col, status_cols, rows):
    """UPDATE only status columns for existing rows — doesn't touch new/deleted rows."""
    if not rows:
        return

    updated = 0
    set_clause = ", ".join([f"{col} = %s" for col in status_cols])
    update_sql = f"UPDATE {table} SET {set_clause} WHERE {id_col} = %s;"

    for row in rows:
        values = [row[col] for col in status_cols] + [row[id_col]]
        try:
            cur.execute(update_sql, values)
            updated += cur.rowcount
        except Exception as e:
            pass  # Row may have been deleted — skip

    print(f"  [OK]   {table}: reverted {updated} rows to snapshot status values")


def reset_db(snapshot):
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    start = datetime.datetime.now()
    snap_time = snapshot["_meta"]["created_at"]

    print("=" * 60)
    print("  RESTORING DATABASE TO SNAPSHOT STATE")
    print(f"  Snapshot taken : {snap_time}")
    print(f"  Reset started  : {start.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    try:
        # ── STEP 1: Delete excess rows beyond watermarks ─────────────────────
        separator("STEP 1 — Delete rows added after snapshot")

        watermarks = snapshot.get("watermarks", {})

        # FK-safe deletion order (children before parents)
        delete_order = [
            "lab_results",
            "lab_orders",
            "pharmacy_sales",
            "prescriptions",
            "diagnoses",
            "vital_signs",
            "bills",
            "bed_assignments",
            "discharge_summaries",
            "patient_visits",
            "insurance_claims",
            "payments",
            "appointments",
        ]

        for table in delete_order:
            if table not in watermarks:
                continue
            wm = watermarks[table]
            id_col = wm["id_col"]
            max_id = wm["max_id"]
            try:
                cur.execute(f"DELETE FROM {table} WHERE {id_col} > %s;", (max_id,))
                deleted = cur.rowcount
                msg = f"removed {deleted} rows (>{max_id})" if deleted > 0 else "no excess rows"
                print(f"  {'[DEL]' if deleted > 0 else '[OK] '}  {table}: {msg}")
            except Exception as e:
                print(f"  [ERR]  {table}: {e}")
                conn.rollback()
                conn.autocommit = False

        # ── STEP 2: Fully restore small/critical tables ──────────────────────
        separator("STEP 2 — Full restore of critical tables")

        full_data = snapshot.get("full_data", {})

        # Restore in FK-safe order
        restore_order = ["beds", "admissions", "ward_sbar_handovers",
                         "dim_admission_inputs", "dim_generated_discharge_summaries"]

        for table in restore_order:
            if table not in full_data:
                continue
            data = full_data[table]
            id_col = data["id_col"]
            rows = data["rows"]
            try:
                restore_table_full(cur, table, id_col, rows)
            except Exception as e:
                print(f"  [ERR]  {table}: {e}")
                conn.rollback()
                conn.autocommit = False

        # ── STEP 3: Restore status columns on large tables ───────────────────
        separator("STEP 3 — Restore status columns on large tables")

        status_data = snapshot.get("status_snapshots", {})

        for table, data in status_data.items():
            id_col = data["id_col"]
            status_cols = data["status_cols"]
            rows = data["rows"]
            try:
                restore_status_columns(cur, table, id_col, status_cols, rows)
            except Exception as e:
                print(f"  [ERR]  {table}: {e}")
                conn.rollback()
                conn.autocommit = False

        # ── Delete excess patients + admissions last (they're parents) ───────
        separator("STEP 4 — Delete excess patient / admission rows")

        for table in ["admissions", "patients"]:
            if table not in watermarks:
                continue
            wm = watermarks[table]
            id_col = wm["id_col"]
            max_id = wm["max_id"]

            # admissions were already fully restored in STEP 2, but
            # patients table still needs excess row cleanup
            if table == "patients":
                try:
                    cur.execute(f"DELETE FROM {table} WHERE {id_col} > %s;", (max_id,))
                    deleted = cur.rowcount
                    msg = f"removed {deleted} rows (>{max_id})" if deleted > 0 else "no excess rows"
                    print(f"  {'[DEL]' if deleted > 0 else '[OK] '}  {table}: {msg}")
                except Exception as e:
                    print(f"  [ERR]  {table}: {e}")
                    conn.rollback()
                    conn.autocommit = False

        # ── Commit ────────────────────────────────────────────────────────────
        conn.commit()
        print(f"\n{'=' * 60}")
        print("  ✓ RESTORE COMMITTED")

        # ── Verification ──────────────────────────────────────────────────────
        separator("FINAL STATE VERIFICATION")

        verify = [
            ("patients",                          "id"),
            ("admissions",                        "admission_id"),
            ("vital_signs",                       "vital_id"),
            ("bills",                             "bill_id"),
            ("dim_generated_discharge_summaries", "summary_id"),
            ("dim_admission_inputs",              "admission_id"),
            ("ward_sbar_handovers",               "id"),
            ("discharge_summaries",               "summary_id"),
        ]

        print(f"  {'Table':<42} {'Rows':>8}  {'Max ID':>10}")
        print(f"  {'─'*42} {'─'*8}  {'─'*10}")
        for table, id_col in verify:
            try:
                cur.execute(f"SELECT COUNT(*), MAX({id_col}) FROM {table}")
                count, max_id = cur.fetchone()
                expected_count = (full_data.get(table, {}).get("count") or
                                  watermarks.get(table, {}).get("count") or "?")
                match = "✓" if str(count) == str(expected_count) else "≠"
                print(f"  {match} {table:<40} {count:>8}  {str(max_id):>10}  (expected: {expected_count})")
            except Exception as e:
                print(f"  ? {table:<40} ERROR: {e}")
                conn.rollback()

        # Status breakdown
        try:
            cur.execute("SELECT discharge_status, COUNT(*) FROM admissions GROUP BY discharge_status ORDER BY discharge_status")
            print("\n  admissions.discharge_status:")
            for row in cur.fetchall():
                print(f"    {row[0]}: {row[1]}")
        except Exception as e:
            conn.rollback()

        try:
            cur.execute("SELECT approval_status, COUNT(*) FROM dim_generated_discharge_summaries GROUP BY approval_status ORDER BY approval_status")
            print("\n  dim_generated_discharge_summaries.approval_status:")
            for row in cur.fetchall():
                print(f"    {row[0]}: {row[1]}")
        except Exception as e:
            conn.rollback()

        elapsed = (datetime.datetime.now() - start).total_seconds()
        print(f"\n{'=' * 60}")
        print(f"  Reset completed in {elapsed:.1f}s")
        print(f"  Database is back to snapshot state: {snap_time}")
        print(f"{'=' * 60}\n")

    except Exception as e:
        conn.rollback()
        print(f"\n[FATAL] Reset failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    # ── Load snapshot ────────────────────────────────────────────────────────
    if not os.path.exists(SNAPSHOT_FILE):
        print(f"\n❌ Snapshot file not found: {SNAPSHOT_FILE}")
        print("   Run take_snapshot.py first to capture the current DB state.\n")
        sys.exit(1)

    with open(SNAPSHOT_FILE, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    snap_time = snapshot["_meta"]["created_at"]

    print("\n" + "=" * 60)
    print("  DATABASE RESTORE TOOL")
    print(f"  Snapshot: {snap_time}")
    print("=" * 60)
    print("\n  This will:")
    print("  • Delete all rows added AFTER the snapshot")
    print("  • Restore admissions, discharge summaries, SBAR handovers, beds")
    print("  • Undo status changes on existing bills and vital_signs")
    print()

    confirm = input("  ⚠️  Type 'yes' to confirm reset: ").strip().lower()
    if confirm == "yes":
        reset_db(snapshot)
    else:
        print("\n  Aborted — no changes made.\n")
