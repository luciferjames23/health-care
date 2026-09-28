import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Also search for 'Discharge Orchestration Agent' or 'Appointment' or 'Triage'
for name in ['Discharge Orchestration', 'Discharge Summary', 'Appointment', 'Triage', 'Scribe', 'Registration', 'Consultation', 'Agent']:
    pos = 0
    c = 0
    while c < 5:
        idx = content.find(name, pos)
        if idx == -1:
            break
        print(f"Found '{name}' at {idx}:")
        st = max(0, idx - 100)
        en = min(len(content), idx + 300)
        print(content[st:en].encode('ascii', errors='backslashreplace').decode('ascii'))
        print('-'*50)
        pos = idx + len(name) + 1
        c += 1
