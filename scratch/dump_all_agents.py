filepath = 'scratch/extracted_manifest/8129aa64-6c44-4fa7-8efc-2181b9ff937d.js'
with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

pos1 = content.find('const agents = [')
pos2 = content.find('];', pos1)
agents_str = content[pos1:pos2+2]

pos3 = content.find('const AGENT_EXTRA = [')
pos4 = content.find('];', pos3)
extra_str = content[pos3:pos4+2]

pos5 = content.find('const TYPE_OF =')
pos6 = content.find(';', pos5)
typeof_str = content[pos5:pos6+1]

with open('scratch/all_raw_agents.js', 'w', encoding='utf-8') as out:
    out.write(agents_str + '\n\n' + extra_str + '\n\n' + typeof_str)

print("Wrote scratch/all_raw_agents.js")
