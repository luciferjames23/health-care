"""Create one AG-17 laboratory request using the existing lab test catalog."""
from services.soap_action_workflow_service import _row


LAB_ALIASES = {
    "CBC": {"cbc", "complete blood count"},
    "CMP": {"cmp", "comprehensive metabolic panel"},
    "BMP": {"bmp", "basic metabolic panel"},
    "HBA1C": {"hba1c", "hemoglobin a1c"},
    "LIPID": {"lipid panel", "lipid profile"},
    "LFT": {"lft", "lfts", "liver function test", "liver function tests"},
    "RFT": {"rft", "renal function test", "renal function tests"},
    "TROPONIN": {"troponin"},
}


def resolve_lab_test(cur, action):
    code = str(action.get("code") or "").strip().upper()
    name = str(action.get("name") or "").strip().casefold()
    aliases = set(LAB_ALIASES.get(code, set()))
    for values in LAB_ALIASES.values():
        if name in values:
            aliases.update(values)
    aliases.add(name)
    if code:
        aliases.add(code.casefold())
    aliases = {value for value in aliases if value}
    placeholders = ",".join(["%s"] * len(aliases))
    cur.execute(f"""SELECT lab_test_id,test_code,test_name FROM lab_tests
                    WHERE lower(COALESCE(status,'active'))='active'
                      AND (lower(trim(COALESCE(test_name,''))) IN ({placeholders})
                           OR lower(trim(COALESCE(test_code,''))) IN ({placeholders}))
                    ORDER BY lab_test_id""", (*sorted(aliases), *sorted(aliases)))
    rows = [_row(cur, row) for row in cur.fetchall()]
    unique = {row["lab_test_id"]: row for row in rows}
    return next(iter(unique.values())) if len(unique) == 1 else None


def _next_id(cur):
    cur.execute("LOCK TABLE lab_orders IN EXCLUSIVE MODE")
    cur.execute("SELECT setval(pg_get_serial_sequence(%s,%s),GREATEST(COALESCE(MAX(lab_order_id),1),1),MAX(lab_order_id) IS NOT NULL) FROM lab_orders",
                ("lab_orders", "lab_order_id"))
    cur.execute("SELECT nextval(pg_get_serial_sequence(%s,%s))", ("lab_orders", "lab_order_id"))
    return int(cur.fetchone()[0])


def _existing_lab_order(cur, action_id):
    cur.execute("SELECT * FROM lab_orders WHERE source_action_id=%s", (str(action_id),))
    return _row(cur, cur.fetchone())


def create_lab_order(cur, note, action, doctor_id):
    """Insert a Pending request only; it creates no lab_results row."""
    existing = _existing_lab_order(cur, action["action_id"])
    if existing:
        return existing, True
    test = resolve_lab_test(cur, action)
    if not test:
        raise ValueError("Laboratory test could not be resolved.")
    if doctor_id is None:
        raise ValueError("Ordering clinician could not be resolved.")
    lab_order_id = _next_id(cur)
    priority = {"ROUTINE": "Routine", "URGENT": "Urgent", "STAT": "Stat"}.get(action.get("priority"), "Routine")
    cur.execute("""INSERT INTO lab_orders
                   (lab_order_id,patient_id,doctor_id,visit_id,admission_id,lab_test_id,ordered_date,priority,status,
                    source,source_soap_note_id,source_action_id)
                   VALUES (%s,%s,%s,%s,%s,%s,CURRENT_TIMESTAMP,%s,'Pending','AG17',%s,%s)
                   RETURNING lab_order_id""",
                (lab_order_id, note["patient_id"], doctor_id, note["visit_id"], note.get("admission_id"),
                 test["lab_test_id"], priority, note["soap_note_id"], str(action["action_id"])))
    lab_order_id = int(cur.fetchone()[0])
    return ({"lab_order_id": lab_order_id, "patient_id": note["patient_id"], "visit_id": note["visit_id"],
             "doctor_id": doctor_id, "lab_test_id": test["lab_test_id"], "status": "Pending",
             "source": "AG17", "source_action_id": action["action_id"]}, False)
