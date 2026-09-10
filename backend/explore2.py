import requests, os, json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
HOSTNAME = os.getenv("DATABRICKS_SERVER_HOSTNAME")
TOKEN    = os.getenv("DATABRICKS_ACCESS_TOKEN")
HEADERS  = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
BASE_URL = f"https://{HOSTNAME}"
TARGET_ID = "3655906645282312"

def search_dir(path, depth=0, max_depth=8):
    if depth > max_depth:
        return None
    try:
        r = requests.get(f"{BASE_URL}/api/2.0/workspace/list",
                         headers=HEADERS, params={"path": path}, timeout=15)
        if r.status_code != 200:
            return None
        for obj in r.json().get("objects", []):
            obj_id   = str(obj.get("object_id", ""))
            obj_type = obj.get("object_type", "")
            obj_path = obj.get("path", "")
            indent = "  " * depth
            print(f"{indent}{obj_type:15} {obj_path}  (id={obj_id})")
            if obj_id == TARGET_ID:
                print(f"\n{'='*60}")
                print(f"  *** FOUND TARGET NOTEBOOK! ***")
                print(f"  Path: {obj_path}")
                print(f"  ID  : {obj_id}")
                print(f"{'='*60}\n")
                return obj_path
            if obj_type == "DIRECTORY":
                found = search_dir(obj_path, depth+1, max_depth)
                if found:
                    return found
    except Exception as e:
        print(f"{'  '*depth}Error listing {path}: {e}")
    return None

print(f"Deep searching for notebook id={TARGET_ID}...\n")
# Deep search in POC health-care code dir
found_path = search_dir("/Users/gaberieljayaraj05@gmail.com/POC", 0, 8)
if not found_path:
    print("\nNotebook NOT found in POC directory.")
    print("Also checking the editor notebook URL format...")
    # The notebook URL is /editor/notebooks/ID -- this is actually the notebook object directly accessible
    # Try workspace/get-status with path= workaround
    r2 = requests.get(f"{BASE_URL}/api/2.0/workspace/get-status",
                      headers=HEADERS, params={"path": f"/Users/gaberieljayaraj05@gmail.com"}, timeout=15)
    print(f"\nUser dir status: {r2.status_code} -> {r2.text[:300]}")
