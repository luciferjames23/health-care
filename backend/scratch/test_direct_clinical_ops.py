import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.clinical_operations import get_all_patients_directory

def main():
    res = get_all_patients_directory(category="OP")
    print("Type of res:", type(res))
    if isinstance(res, dict):
        print("Keys of res:", res.keys())
        pats = res.get("data") or res.get("patients") or []
        print(f"Total OP patients in dict: {len(pats)}")
        for p in pats:
            print(" ", p)
    elif isinstance(res, list):
        print(f"Total OP patients in list: {len(res)}")
        for p in res:
            print(" ", p)

if __name__ == "__main__":
    main()
