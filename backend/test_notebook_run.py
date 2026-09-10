"""
Databricks Notebook Test Script
Notebook ID : 3655906645282312
Workspace ID: 7474654249850686 (from ?o= in the URL — this is the ORG id, not notebook id)
Patient ID  : 87227

Steps:
  1. Resolve notebook path via Workspace API
  2. Submit Jobs/runs/submit with patient_id=87227
  3. Poll for completion
  4. Print output
"""

import sys, os, json, time, requests

# ── Load config from .env ─────────────────────────────────────────────────────
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

HOSTNAME  = os.getenv("DATABRICKS_SERVER_HOSTNAME", "")
TOKEN     = os.getenv("DATABRICKS_ACCESS_TOKEN", "")

NOTEBOOK_ID  = "3655906645282312"   # from the URL path /editor/notebooks/<id>
PATIENT_ID   = "87227"
TIMEOUT_SEC  = 300                   # 5 minutes max

if not HOSTNAME or not TOKEN:
    print("ERROR: DATABRICKS_SERVER_HOSTNAME or DATABRICKS_ACCESS_TOKEN not set in .env")
    sys.exit(1)

BASE_URL = f"https://{HOSTNAME}"
HEADERS  = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

print(f"\n{'='*60}")
print(f"  Databricks Notebook Test")
print(f"  Host      : {HOSTNAME}")
print(f"  Notebook  : {NOTEBOOK_ID}")
print(f"  patient_id: {PATIENT_ID}")
print(f"{'='*60}\n")

# ── Step 1: Resolve Notebook Path via Workspace API ───────────────────────────
print("Step 1: Resolving notebook path from object ID...")
try:
    ws_url = f"{BASE_URL}/api/2.0/workspace/get-status"
    # Try direct object ID lookup
    r = requests.get(ws_url, headers=HEADERS, params={"object_id": NOTEBOOK_ID}, timeout=15)
    print(f"  Workspace API status: {r.status_code}")
    if r.status_code == 200:
        ws_info = r.json()
        print(f"  Workspace object info: {json.dumps(ws_info, indent=2)}")
        nb_path = ws_info.get("path")
        print(f"  Resolved path: {nb_path}")
    else:
        print(f"  Response: {r.text}")
        nb_path = None
except Exception as e:
    print(f"  Exception: {e}")
    nb_path = None

if not nb_path:
    print("\n  Could not resolve notebook path via object ID.")
    print("  Will try direct path: /Workspace/...")
    # Fallback: list root workspace to find the notebook
    try:
        list_r = requests.get(f"{BASE_URL}/api/2.0/workspace/list", headers=HEADERS, params={"path": "/"}, timeout=15)
        print(f"  Workspace root listing status: {list_r.status_code}")
        if list_r.status_code == 200:
            items = list_r.json().get("objects", [])
            for item in items:
                print(f"    {item.get('object_type'):12} {item.get('path')} (id={item.get('object_id')})")
    except Exception as e2:
        print(f"  Listing exception: {e2}")

# ── Step 2: Submit Notebook Run ───────────────────────────────────────────────
print(f"\nStep 2: Submitting notebook run with patient_id={PATIENT_ID}...")

# Use the resolved path or construct from known info
task_notebook = {}
if nb_path:
    task_notebook = {"notebook_path": nb_path, "base_parameters": {"patient_id": PATIENT_ID}}
else:
    # Try with object ID directly in the existing_cluster_id form — some APIs accept notebook_id
    # Use path fallback based on workspace root exploration
    task_notebook = {
        "notebook_path": f"/Notebooks/{NOTEBOOK_ID}",
        "base_parameters": {"patient_id": PATIENT_ID}
    }

payload = {
    "run_name": f"API Test - patient_id={PATIENT_ID}",
    "tasks": [{
        "task_key": "notebook_task",
        "notebook_task": task_notebook,
        # Use a new cluster for isolation
        "new_cluster": {
            "spark_version": "15.4.x-scala2.12",
            "node_type_id": "i3.xlarge",
            "num_workers": 1
        }
    }]
}

print(f"  Payload: {json.dumps(payload, indent=2)}")

try:
    submit_r = requests.post(f"{BASE_URL}/api/2.1/jobs/runs/submit", headers=HEADERS, json=payload, timeout=30)
    print(f"\n  Submit status: {submit_r.status_code}")
    print(f"  Submit response: {submit_r.text}")

    if submit_r.status_code != 200:
        print("\nSubmit FAILED. Attempting with existing cluster...")
        # Remove new_cluster and try with serverless or different cluster type
        payload2 = {
            "run_name": f"API Test (serverless) - patient_id={PATIENT_ID}",
            "tasks": [{
                "task_key": "notebook_task",
                "notebook_task": task_notebook,
            }]
        }
        print(f"  Payload (no cluster): {json.dumps(payload2, indent=2)}")
        submit_r2 = requests.post(f"{BASE_URL}/api/2.1/jobs/runs/submit", headers=HEADERS, json=payload2, timeout=30)
        print(f"  Submit2 status: {submit_r2.status_code}")
        print(f"  Submit2 response: {submit_r2.text}")
        if submit_r2.status_code == 200:
            submit_r = submit_r2
        else:
            print("\nBoth submit attempts failed. See errors above.")
            sys.exit(1)

    run_id = submit_r.json().get("run_id")
    print(f"\n  Run submitted! run_id = {run_id}")

except Exception as e:
    print(f"\n  Submit exception: {e}")
    sys.exit(1)

# ── Step 3: Poll for Completion ───────────────────────────────────────────────
print(f"\nStep 3: Polling for completion (timeout={TIMEOUT_SEC}s)...")
start = time.time()
final_state = None

while time.time() - start < TIMEOUT_SEC:
    elapsed = int(time.time() - start)
    try:
        poll_r = requests.get(f"{BASE_URL}/api/2.1/jobs/runs/get", headers=HEADERS, params={"run_id": run_id}, timeout=15)
        if poll_r.status_code == 200:
            state = poll_r.json().get("state", {})
            lc    = state.get("life_cycle_state", "UNKNOWN")
            rs    = state.get("result_state", "")
            print(f"  [{elapsed:3d}s] life_cycle={lc}  result={rs}")
            if lc in ["TERMINATED", "SKIPPED", "INTERNAL_ERROR"]:
                final_state = rs or lc
                break
        else:
            print(f"  [{elapsed:3d}s] Poll error {poll_r.status_code}: {poll_r.text}")
    except Exception as e:
        print(f"  [{elapsed:3d}s] Poll exception: {e}")
    time.sleep(5)

print(f"\n  Final state: {final_state}")

# ── Step 4: Get Output ────────────────────────────────────────────────────────
print(f"\nStep 4: Fetching run output...")
try:
    out_r = requests.get(f"{BASE_URL}/api/2.1/jobs/runs/get-output", headers=HEADERS, params={"run_id": run_id}, timeout=15)
    print(f"  Output status: {out_r.status_code}")
    if out_r.status_code == 200:
        out_json = out_r.json()
        nb_output = out_json.get("notebook_output", {})
        print(f"\n  ── Notebook Output ──────────────────")
        print(f"  Result: {nb_output.get('result', '(no result)')}")
        error = out_json.get("error")
        if error:
            print(f"  Error : {error}")
        error_trace = out_json.get("error_trace", "")
        if error_trace:
            print(f"  Trace : {error_trace[:500]}")
    else:
        print(f"  Response: {out_r.text}")
except Exception as e:
    print(f"  Output exception: {e}")

print(f"\n{'='*60}")
print(f"  Test complete. Run ID: {run_id}  Final state: {final_state}")
print(f"  Databricks Run URL:")
print(f"  https://{HOSTNAME}/#job/runs/{run_id}")
print(f"{'='*60}\n")
