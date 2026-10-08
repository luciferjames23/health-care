import sys
import os

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import agent.entity_extractor as entity_extractor

words = [
    "Knee", "Chest", "Breathing", "Ear", "Skin", "Eye", "Back", "Head", "Stomach", "Teeth", "Heart", "Fever", "Corona virus",
    "Knee pain", "Chest pain", "Breathing difficulty", "Ear pain", "Skin rash", "Eye pain", "Back pain", "Headache", "Stomach pain", "Toothache"
]

print("TESTING MAP_SYMPTOM_TO_DEPARTMENT_NAME:")
print("-" * 60)
for w in words:
    dept = entity_extractor.map_symptom_to_department_name(w)
    print(f"Input: {w:25s} -> Department: {dept}")
