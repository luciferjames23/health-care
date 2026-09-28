with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Let's search where pAgent or agent view template is defined in HTML
pos = 0
while True:
    idx = content.find('pAgent', pos)
    if idx == -1:
        break
    print(f"=== pAgent found at {idx} ===")
    st = max(0, idx - 100)
    en = min(len(content), idx + 800)
    print(content[st:en].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("="*60)
    pos = idx + 6
