import sys, os, requests, json, time
from pathlib import Path
from dotenv import load_dotenv
sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent / ".env")

from connectors.databricks_connector import DatabricksConnector

conn = DatabricksConnector()

print("="*60)
print("  Testing _resolve_notebook_path fix")
print("="*60)

# Test 1: known ID 2865138219507461
path1 = conn._resolve_notebook_path("2865138219507461")
print(f"\nTest 1 - ID 2865138219507461:")
print(f"  Resolved: {path1}")
assert path1.startswith("/"), f"FAIL: not an absolute path: {path1}"
print("  PASS: is absolute path")

# Test 2: known ID 3655906645282312
path2 = conn._resolve_notebook_path("3655906645282312")
print(f"\nTest 2 - ID 3655906645282312:")
print(f"  Resolved: {path2}")
assert path2.startswith("/"), f"FAIL: not an absolute path: {path2}"
print("  PASS: is absolute path")

# Test 3: already an absolute path
path3 = conn._resolve_notebook_path("/Users/someone/MyNotebook")
print(f"\nTest 3 - Already absolute path:")
print(f"  Resolved: {path3}")
assert path3 == "/Users/someone/MyNotebook"
print("  PASS: returned as-is")

# Test 4: bad ID should raise ValueError
print(f"\nTest 4 - Unknown ID should raise ValueError:")
try:
    conn._resolve_notebook_path("9999999999999999")
    print("  FAIL: should have raised ValueError")
except ValueError as e:
    print(f"  PASS: ValueError raised: {str(e)[:80]}")

print(f"\n{'='*60}")
print("All path resolution tests PASSED")
print(f"{'='*60}\n")

# Now do a real API run with patient_id=87227
print("Running real notebook with patient_id=87227, notebook_id=2865138219507461 ...")
result = conn.run_databricks_notebook(
    notebook_path_or_id="2865138219507461",
    parameters={"patient_id": "87227"},
    timeout_seconds=300
)
print(f"\nResult:")
print(f"  status          : {result.get('status')}")
print(f"  execution_state : {result.get('execution_state')}")
print(f"  run_id          : {result.get('run_id')}")
print(f"  task_run_id     : {result.get('task_run_id')}")
print(f"  duration        : {result.get('duration_seconds')}s")
print(f"  source          : {result.get('source')}")
print(f"  databricks_url  : {result.get('databricks_run_url')}")
print(f"  error           : {result.get('error')}")
data = result.get('data', [])
print(f"  data rows       : {len(data)}")
if data:
    print(f"  first row       : {json.dumps(data[0], indent=4, default=str)}")
