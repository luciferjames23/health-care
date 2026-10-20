import urllib.request
import json
import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.patient_360_service import db_config

def main():
    # 1. Reset charge 38 to PENDING
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM payments WHERE payment_reference = 'PAY-CHG-38';")
    cur.execute("UPDATE patient_charges SET billing_status = 'PENDING' WHERE id = 38;")
    conn.commit()
    cur.close()
    conn.close()
    print("[RESET] Charge 38 reset to PENDING and previous test payments removed.")

    # 2. Call HTTP POST /api/finance/pay-balance
    payload = json.dumps({
        "patient_id": 1004434,
        "bill_id": None,
        "charge_id": 38,
        "amount": 500,
        "payment_method": "Cash at Desk"
    }).encode("utf-8")

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/finance/pay-balance",
        data=payload,
        headers={"Content-Type": "application/json"}
    )

    try:
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read().decode("utf-8"))
        print("[SUCCESS] HTTP Status:", resp.status)
        print("[SUCCESS] Response Body:", json.dumps(data, indent=2))
    except urllib.error.HTTPError as e:
        print("[FAILED] HTTP Error:", e.code, e.read().decode("utf-8"))
        return False

    # 3. Test Statement Query to verify Live Sync
    req2 = urllib.request.Request("http://127.0.0.1:8000/api/finance/patients/1004434/statement")
    try:
        resp2 = urllib.request.urlopen(req2)
        data2 = json.loads(resp2.read().decode("utf-8"))
        chg_item = next((r for r in data2.get("records", []) if r.get("charge_id") == 38), None)
        print("[STATEMENT] CHG-38 Status:", chg_item.get("status") if chg_item else "NOT FOUND")
        print("[STATEMENT] CHG-38 Paid Amount:", chg_item.get("paid_amount") if chg_item else "NOT FOUND")
        print("[STATEMENT] CHG-38 Outstanding:", chg_item.get("outstanding_balance") if chg_item else "NOT FOUND")
        print("[STATEMENT] CHG-38 Payment Ref:", chg_item.get("payment_reference") if chg_item else "NOT FOUND")
        print("[STATEMENT] Summary Outstanding Balance:", data2.get("summary", {}).get("outstanding_balance"))
        print("[STATEMENT] Summary Total Paid:", data2.get("summary", {}).get("total_paid"))
    except urllib.error.HTTPError as e:
        print("[FAILED] Statement query error:", e.code, e.read().decode("utf-8"))
        return False

    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
