import os
import re

dirpath = 'scratch/extracted_manifest'
for filename in sorted(os.listdir(dirpath)):
    filepath = os.path.join(dirpath, filename)
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # check for agents list or config
    pos = content.find('const agents = [')
    if pos != -1:
        print(f"=== Found 'const agents = [' in {filename} ===")
        # find end of array
        end_pos = content.find('];', pos)
        if end_pos != -1:
            print(content[pos:end_pos+2])
        else:
            print(content[pos:pos+3000])

    # Also search for AG-01 config or full agent config definitions
    for m in re.finditer(r'agentConfig|agentDetails|ALL_AGENTS|agentsData', content, re.I):
        print(f"Keyword in {filename} at {m.start()}: {repr(content[m.start()-50:m.start()+250])}")
