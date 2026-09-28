import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Let's search for "class Api" or "function Api" or where api is defined
matches = list(re.finditer(r'class Api|function Api|const api\s*=|let api\s*=|new Api|class Hospital', content))
print(f"API class matches: {len(matches)}")
for m in matches:
    print(f"Match at {m.start()}:")
    st = m.start()
    print(content[st:st+400].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("="*60)
