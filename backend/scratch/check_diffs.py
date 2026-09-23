import difflib

def compare_files(f1, f2, label1, label2):
    with open(f1, 'r', encoding='utf-8', errors='ignore') as file1:
        lines1 = file1.readlines()
    with open(f2, 'r', encoding='utf-8', errors='ignore') as file2:
        lines2 = file2.readlines()
        
    diff = list(difflib.unified_diff(lines1, lines2, fromfile=label1, tofile=label2))
    print(f"\n--- DIFF FOR {label1} vs {label2} --- (total diff lines: {len(diff)})")
    for line in diff[:100]: # show first 100 diff lines
        print(line, end='')

proto_main = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\Healthcare-Prototype\backend\main.py"
main_main = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend\main.py"

compare_files(proto_main, main_main, "Proto main.py", "Main main.py")

proto_wa = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\Healthcare-Prototype\backend\voice\whatsapp_client.py"
main_wa = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend\voice\whatsapp_client.py"

compare_files(proto_wa, main_wa, "Proto whatsapp_client.py", "Main whatsapp_client.py")
