import os
import filecmp

proto_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\Healthcare-Prototype\backend"
main_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"

print(f"Comparing {proto_dir} vs {main_dir}:\n")

def compare_dirs(d1, d2, rel=""):
    for item in os.listdir(os.path.join(d1, rel)):
        if item in [".git", "__pycache__", "hospital.db", "node_modules", "scratch"]:
            continue
        p1 = os.path.join(d1, rel, item)
        p2 = os.path.join(d2, rel, item)
        rel_path = os.path.join(rel, item)
        if os.path.isdir(p1):
            if os.path.exists(p2):
                compare_dirs(d1, d2, rel_path)
            else:
                print(f"[ONLY IN PROTO] {rel_path}")
        else:
            if not os.path.exists(p2):
                print(f"[ONLY IN PROTO] {rel_path}")
            else:
                size1 = os.path.getsize(p1)
                size2 = os.path.getsize(p2)
                same = filecmp.cmp(p1, p2, shallow=False)
                if not same:
                    print(f"[DIFF] {rel_path:40s} | Proto: {size1:7d} B | Main: {size2:7d} B")

compare_dirs(proto_dir, main_dir)
