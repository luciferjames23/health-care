import requests, os, json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
HOSTNAME = os.getenv("DATABRICKS_SERVER_HOSTNAME")
TOKEN    = os.getenv("DATABRICKS_ACCESS_TOKEN")
HEADERS  = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
BASE_URL = f"https://{HOSTNAME}"
TARGET_ID = "3655906645282312"

def search_dir(path, depth=0, max_depth=5):
    if depth > max_depth:
        return
    try:
        r = requests.get(f"{BASE_URL}/api/2.0/workspace/list",
                         headers=HEADERS, params={"path": path}, timeout=15)
        if r.status_code != 200:
            return
        for obj in r.json().get("objects", []):
            obj_id  = str(obj.get("object_id", ""))
            obj_type = obj.get("object_type", "")
            obj_path = obj.get("path", "")
            print(f"{'  '*depth}{obj_type:15} {obj_path}  (id={obj_id})")
            if obj_id == TARGET_ID:
                print(f"\n{'='*50}")
                print(f"  FOUND NOTEBOOK!")
                print(f"  Path: {obj_path}")
                print(f"  ID  : {obj_id}")
                print(f"{'='*50}\n")
            if obj_type == "DIRECTORY":
                search_dir(obj_path, depth+1, max_depth)
    except Exception as e:
        print(f"{'  '*depth}Error listing {path}: {e}")

print(f"Searching for notebook {TARGET_ID}...\n")
for root in ["/Users", "/Shared", "/Repos"]:
    print(f"\n--- {root} ---")
    search_dir(root, 0, 3)
