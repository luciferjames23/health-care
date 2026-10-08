import ast

with open(r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend\agent\agent_service.py", "r", encoding="utf-8") as f:
    tree = ast.parse(f.read())

funcs = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
print("Top-level functions:")
for f in tree.body:
    if isinstance(f, ast.FunctionDef):
        print(" -", f.name)
