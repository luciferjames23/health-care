import re

filepath = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend\agent\entity_extractor.py"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

new_rules_code = '''        # 3. CARDIOLOGY — before General Medicine (chest-related)
        (
            r"(?:\\b(chest|chest\\s*pain|chest\\s*hurts|chest\\s*hurting|chest\\s*ache|heart|cardio|cardiac|palpitations|breathing|breath|breathlessness|"
            r"breathing\\s*difficulty|shortness\\s*of\\s*breath|chest\\s*tightness|blood\\s*pressure|hypertension|cardiologist|cardiology)\\b|"
            r"நெஞ்சு|நெஞ்சு\\s*வலி|இதயம்|மாரடைப்பு|மூச்சு|மூச்சுதிணறல்|सीना|छाती|सीने\\s*में\\s*दर्द|छाती\\s*में\\s*दर्द|दिल|सांस|साँस|ఛాతీ|గుండె|ശവാസം|നെഞ്ചുവേദന|ഹൃദയം|എದೆ)",
            "Cardiology"
        ),
        # 4. ENT — before General Medicine (ear/nose/throat)
        (
            r"(?:\\b(ear|earache|ear\\s*pain|eare|hearing|sinus|sinus\\s*infection|nasal|nasel|nose|nos|nos\\s*pain|"
            r"throat|thorat|tonsil|snoring|teeth|tooth|toothache|dental|otitis|rhinitis|ent|ent\\s*specialist)\\b|"
            r"காது|மூக்கு|தொண்டை|பல்|கான்|कान|नाक|गला|दांत|दाँत|చెవి|ముక్కు|గొంతు|పన్ను|ചെവി|മൂക്ക്|തൊണ്ട|പല്ല്|ಕಿವಿ|മൂഗു|ಗಂಟಲು)",
            "ENT"
        ),
        # 5. ORTHOPEDICS — before General Medicine (knee/bone/joint/back)
        (
            r"(?:\\b(knee|knne|knee\\s*pain|knne\\s*pain|kneepain|back|back\\s*pain|bakk\\s*pain|backache|joint|joint\\s*pain|joiont\\s*pain|bone|bone\\s*pain|"
            r"spine|fracture|shoulder|shoulder\\s*pain|neck|neck\\s*pain|hip|leg|leg\\s*pain|arthritis|sprain|"
            r"ligament|orthopedic|orthopedics|orthopedist)\\b|"
            r"முழங்கால்|எலும்பு|மூட்டு|முதுகு|கால்|घुटना|घुटने|हड्डी|जोड़|पीठ|कमर|కీలు|ఎముక|మోకాలు|മുട്ട്|അസ്ഥി|മൂട്ടു|ಮಂಡಿ|ಮೂಳೆ)",
            "Orthopedics"
        ),
        # 6. NEUROLOGY — before General Medicine (brain/nerve)
        (
            r"(?:\\b(head|headache|migraine|neurological|vertigo|seizure|numbness|paralysis|"
            r"nerve|nerve\\s*pain|brain|head\\s*injury|neurologist|neurology)\\b|"
            r"தலை|தலைவலி|நரம்பு|மண்டை|सिर|सिरदर्द|नस|दिमाग|నరం|తల|തല|തലവേദന|തಲೆ|ತಲೆನೋವು)",
            "Neurology"
        ),
        # 7. GYNECOLOGY — women-specific
        (
            r"(?:\\b(pregnancy|pregnant|period|menstrual|menstruation|pelvic\\s*pain|"
            r"uterine|ovary|women\\s*health|reproductive|gynecologist|gynecology)\\b|"
            r"கர்ப்பம்|மாதவிடாய்|गर्भावस्था|मासिक\\s*धर्म|గర్భం|ഗർഭം|ഗർഭിണി)",
            "Gynecology"
        ),
        # 8. GENERAL MEDICINE — LAST (most generic)
        (
            r"(?:\\b(fever|fevr|fevar|feveer|feverr|cold|cld|cough|couggh|stomach|stomach\\s*pain|stomach\\s*ache|flu|nausea|vomiting|diarrhea|fatigue|"
            r"weakness|body\\s*pain|feverish|pain|payn|payning|infection|ailment|sick|illness|"
            r"corona|coronavirus|corona\\s*virus|covid|covid-19|general\\s*checkup|runny\\s*nose|sneezing|sore\\s*throat)\\b|"
            r"காய்ச்சல்|வயிற்று\\s*வலி|இருமல்|சளி|வயிறு|கொரோனா|बुखार|खांसी|सर्दी|पेट|पेट\\s*दर्द|कोरोना|ज्वर|ज्वार|జ్వరం|దగ్గు|నొప్పి|പനി|ചുമ|വയറു|ജ്ವರ|കെമ്മു)",
            "General Medicine"
        ),'''

# Find Cardiology comment to line 461
pattern = r"        # 3\. CARDIOLOGY.*?General Medicine\"\n        \),"
match = re.search(pattern, content, re.DOTALL)
if match:
    updated = content[:match.start()] + new_rules_code + content[match.end():]
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(updated)
    print("SUCCESSFULLY UPDATED entity_extractor.py!")
else:
    print("MATCH NOT FOUND!")
