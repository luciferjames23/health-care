import requests, os, json, time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
HOSTNAME  = os.getenv("DATABRICKS_SERVER_HOSTNAME")
TOKEN     = os.getenv("DATABRICKS_ACCESS_TOKEN")
HEADERS   = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
BASE_URL  = f"https://{HOSTNAME}"

NOTEBOOK_PATH = "/Users/gaberieljayaraj05@gmail.com/POC/Health-care/code/Discharge_summary/Discharge Summary LLM Generation"
PATIENT_ID    = "87227"
TIMEOUT_SEC   = 300

print(f"\n{'='*60}")
print(f"  Databricks Notebook Real Run Test")
print(f"  Path      : {NOTEBOOK_PATH}")
print(f"  patient_id: {PATIENT_ID}")
print(f"{'='*60}\n")

# Submit with serverless (no cluster spec = serverless)
payload = {
    "run_name": f"API Run - patient_id={PATIENT_ID}",
    "tasks": [{
        "task_key": "discharge_summary_task",
        "notebook_task": {
            "notebook_path": NOTEBOOK_PATH,
            "base_parameters": {"patient_id": PATIENT_ID}
        }
    }]
}

print("Submitting run...")
r = requests.post(f"{BASE_URL}/api/2.1/jobs/runs/submit", headers=HEADERS, json=payload, timeout=30)
print(f"  Status : {r.status_code}")
print(f"  Response: {r.text}")

if r.status_code != 200:
    print("\nSubmit FAILED.")
    exit(1)

run_id = r.json()["run_id"]
print(f"\n  run_id = {run_id}")
print(f"  URL    = https://{HOSTNAME}/#job/runs/{run_id}")

# Poll
print(f"\nPolling (max {TIMEOUT_SEC}s)...")
start = time.time()
final_state = "RUNNING"

while time.time() - start < TIMEOUT_SEC:
    elapsed = int(time.time() - start)
    pr = requests.get(f"{BASE_URL}/api/2.1/jobs/runs/get", headers=HEADERS, params={"run_id": run_id}, timeout=15)
    if pr.status_code == 200:
        pj = pr.json()
        state = pj.get("state", {})
        lc = state.get("life_cycle_state", "UNKNOWN")
        rs = state.get("result_state", "")
        sm = state.get("state_message", "")
        print(f"  [{elapsed:3d}s] {lc:20} result={rs:10} msg={sm[:60]}")
        if lc in ["TERMINATED", "SKIPPED", "INTERNAL_ERROR"]:
            final_state = rs or lc
            # print full state for debug
            print(f"\n  Full state: {json.dumps(state, indent=2)}")
            break
    else:
        print(f"  [{elapsed:3d}s] Poll error: {pr.status_code} {pr.text[:100]}")
    time.sleep(5)

print(f"\n  Final state: {final_state}")

# Get task-level run output
print("\nFetching task run output...")
# Get individual task run IDs
full_run = requests.get(f"{BASE_URL}/api/2.1/jobs/runs/get", headers=HEADERS, params={"run_id": run_id}, timeout=15)
if full_run.status_code == 200:
    tasks = full_run.json().get("tasks", [])
    print(f"  Tasks: {len(tasks)}")
    for task in tasks:
        task_run_id = task.get("run_id")
        task_key    = task.get("task_key")
        task_state  = task.get("state", {})
        print(f"\n  Task: {task_key}  run_id={task_run_id}  state={task_state}")
        
        if task_run_id:
            out = requests.get(f"{BASE_URL}/api/2.1/jobs/runs/get-output",
                               headers=HEADERS, params={"run_id": task_run_id}, timeout=15)
            print(f"  Output status: {out.status_code}")
            if out.status_code == 200:
                oj = out.json()
                nb_out = oj.get("notebook_output", {})
                print(f"  Notebook result: {nb_out.get('result', '(none)')}")
                err = oj.get("error", "")
                if err:
                    print(f"  Error: {err[:300]}")
                err_trace = oj.get("error_trace", "")
                if err_trace:
                    print(f"  Trace:\n{err_trace[:800]}")
            else:
                print(f"  Output error: {out.text[:200]}")

print(f"\n{'='*60}")
print(f"  Done. run_id={run_id}, final={final_state}")
print(f"  Databricks UI: https://{HOSTNAME}/#job/runs/{run_id}")
print(f"{'='*60}\n")
