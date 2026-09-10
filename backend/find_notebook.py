import requests, os, json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
HOSTNAME = os.getenv("DATABRICKS_SERVER_HOSTNAME")
TOKEN    = os.getenv("DATABRICKS_ACCESS_TOKEN")
HEADERS  = {"Authorization": f"Bearer {TOKEN}"}
BASE_URL = f"https://{HOSTNAME}"
TARGET   = "2865138219507461"

def walk(path, depth=0):
    r = requests.get(f"{BASE_URL}/api/2.0/workspace/list",
                     headers=HEADERS, params={"path": path}, timeout=15)
    if r.status_code != 200:
        return None
    for obj in r.json().get("objects", []):
        oid  = str(obj.get("object_id",""))
        otype = obj.get("object_type","")
        opath = obj.get("path","")
        if oid == TARGET:
            print(f"FOUND: {opath} (id={oid})")
            return opath
        if otype == "DIRECTORY" and depth < 6:
            found = walk(opath, depth+1)
            if found:
                return found
    return None

print(f"Searching for notebook id={TARGET} ...")
for root in ["/Users", "/Shared", "/Repos"]:
    r = walk(root)
    if r:
        break
else:
    print("Not found in workspace.")
