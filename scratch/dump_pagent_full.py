with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# pAgent HTML template
pos1 = content.find('<sc-if value="{{ pAgent }}"')
pos2 = content.find('</sc-if>', pos1 + 50)
print("=== pAgent HTML ===")
print(content[pos1:pos2+8].encode('ascii', errors='backslashreplace').decode('ascii'))

# out.pAgent JS logic
pos3 = content.find('if (out.pAgent)')
pos4 = content.find('if (out.pExec)', pos3)
print("\n=== out.pAgent JS ===")
print(content[pos3:pos4].encode('ascii', errors='backslashreplace').decode('ascii'))
