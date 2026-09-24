import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    import main
    print("SUCCESS: main.py imported without errors")
    print(f"App title: {main.app.title}")
    print(f"Total routes registered: {len(main.app.routes)}")
except Exception as e:
    import traceback
    print("ERROR importing main.py:")
    traceback.print_exc()
