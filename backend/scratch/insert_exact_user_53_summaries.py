import sys
import os
import csv
import io
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

RAW_DATA = """87223	87223	87224	81	"2025-10-20 12:00:00"	"2026-09-18 10:09:52"	"Bronchial Asthma (Acute Exacerbation)"	"The patient, Nishaer Parthalan, a 20-year-old Other, was admitted via Emergency on 2025-10-20 presenting with Asthma. Clinical evaluation confirmed Bronchial Asthma (Acute Exacerbation). During the hospital stay of 331 days under Dr. Sanjay Jain (Pathologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Peak Expiratory Flow Rate (PEFR): Improved from 180 L/min to 410 L/min post-bronchodilator; Chest X-Ray (PA View): Bilateral lung hyperinflation, no consolidation or pneumothorax; Arterial Blood Gas (ABG): pH 7.42, pCO2 38 mmHg, pO2 88 mmHg, SpO2 97% on room air; Complete Blood Count: Absolute Eosinophil Count 450 cells/mcL; Normal renal/liver parameters. Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Nebulization: Duolin (Levosalbutamol 1.25mg + Ipratropium Bromide 500mcg in 2.5ml) q6h
3. Nebulization: Budecort (Budesonide 0.5mg respules) q12h
4. Inj. Hydrocortisone 100mg IV q8h x 2 days, tapered smoothly
5. Tab. Montelukast 10mg + Levocetirizine 5mg PO at bedtime
6. Oxygen therapy via nasal cannula @ 2-4 L/min titrated to maintain SpO2 > 95%
7. Chest physiotherapy and breathing exercises."	"Dr. Sanjay Jain"	"1. Inhaler Budesonide + Formoterol (200mcg / 6mcg) - 2 puffs twice daily with spacer x 30 days.
2. Inhaler Salbutamol 100mcg - 2 puffs SOS via spacer for acute wheezing/shortness of breath.
3. Tab. Montelukast 10mg - 1 tablet orally once daily at bedtime for 14 days.
4. Tab. Prednisolone 20mg - 1 tablet orally in the morning after breakfast for 3 days, then 10mg for 2 days, then stop.
5. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
6. Steam inhalation twice daily; strictly avoid exposure to dust, aerosol sprays, cold air, pet dander, and active/passive smoke.
7. Rinse mouth thoroughly with water after using steroid inhalers to prevent oral candidiasis.
8. Maintain adequate fluid intake (>2.5 liters of warm water daily).
9. OPD Review in 7 days with Pulmonology for repeat spirometry and inhaler technique review.
10. Emergency Warning Signs: Rush to ER if acute severe breathlessness, inability to speak full sentences, or blue lips/fingertips occur."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:52"	"2026-09-18 15:39:52"	"Approved"	"Groq (openai/gpt-oss-20b)"	"groq"
87224	87224	87225	81	"2026-01-21 12:00:00"	"2026-09-18 10:09:52"	"Acute Coronary Syndrome / Chest Pain"	"The patient, Vijayer Parthalan, a 33-year-old Male, was admitted via Emergency on 2026-01-21 presenting with Chest Pain. Clinical evaluation confirmed Acute Coronary Syndrome / Chest Pain. During the hospital stay of 238 days under Dr. Amit Sharma (Pharmacologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Serum Troponin-I: 4.82 ng/mL (Elevated); CK-MB: 48 U/L; Lipid Profile: Total Cholesterol 234 mg/dL, LDL 152 mg/dL, HDL 38 mg/dL; 12-Lead ECG: ST-segment elevation in V1-V4 with Q-waves; 2D Echocardiography: LVEF 45%, anterior wall hypokinesia; CBC & Renal Function: Hb 13.8 g/dL, Creatinine 0.9 mg/dL, Serum Electrolytes within normal limits. Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Paracetamol - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Inj. Enoxaparin 60mg (0.6 ml) SC BD x 3 days (Anticoagulation)
3. Tab. Aspirin 150mg PO OD (Loading dose 300mg given in Emergency Room)
4. Tab. Clopidogrel 75mg PO OD (Loading dose 300mg given in Emergency Room)
5. Tab. Atorvastatin 40mg PO HS (High-intensity Statin)
6. Tab. Metoprolol Succinate 25mg PO OD (Beta-blocker)
7. Inj. Pantoprazole 40mg IV OD (Gastroprotection)
8. IV Fluids: 0.9% Normal Saline 500ml @ 50 ml/hr maintenance infusion
9. Continuous telemetry & cardiac hemodynamic monitoring in ICCU."	"Dr. Amit Sharma"	"1. Tab. Aspirin 75mg - 1 tablet orally once daily after lunch (Long term / Indefinite).
2. Tab. Clopidogrel 75mg - 1 tablet orally once daily after breakfast for 12 months.
3. Tab. Atorvastatin 40mg - 1 tablet orally once daily at bedtime for 6 months.
4. Tab. Metoprolol Succinate 25mg - 1 tablet orally once daily in the morning.
5. Tab. Ramipril 2.5mg - 1 tablet orally once daily after dinner.
6. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 14 days.
7. Tab. Sorbitrate (Isosorbide Dinitrate) 5mg - 1 tablet sublingually SOS in case of acute chest discomfort.
8. Strict low-salt (<2g/day), low-cholesterol, heart-healthy cardiac diet.
9. Avoid strenuous heavy lifting and high-intensity exertion; begin graded brisk walking 20 mins/day after 1 week.
10. Strictly avoid smoking, tobacco use, and alcohol consumption.
11. OPD Review in 7 days with Attending Cardiologist with repeat ECG and Lipid profile.
12. Emergency Warning Signs: Seek immediate ER care if severe substernal chest pressure, radiation to left arm/jaw, diaphoresis, or sudden breathlessness occurs."	"Nil (Underwent Emergency Coronary Angiography with Primary Percutaneous Coronary Intervention / Drug-Eluting Stent deployment to LAD artery)."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:52"	"2026-09-18 15:39:52"	"Approved"	"Groq (openai/gpt-oss-20b)"	"groq"
87225	87225	87226	81	"2025-11-25 12:00:00"	"2026-09-18 10:09:53"	"Cholelithiasis (Gallstone Disease)"	"The patient, Rohiter Parthalan, a 25-year-old Other, was admitted via Emergency on 2025-11-25 presenting with Cholelithiasis. Clinical evaluation confirmed Cholelithiasis (Gallstone Disease). During the hospital stay of 295 days under Dr. Priya Patel (Oncologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Ultrasound Abdomen: Calculus of gallbladder with thickened gallbladder wall (4.2 mm) and pericholecystic fluid, resolving post-op; Liver Function Tests: Total Bilirubin 1.1 mg/dL, Direct Bilirubin 0.3 mg/dL, SGOT/AST 34 U/L, SGPT/ALT 38 U/L, Alkaline Phosphatase 112 U/L; CBC: WBC count 8,200/mcL (down from 14,500/mcL at admission); Serum Amylase & Lipase normal. Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Inj. Cefoperazone 1g + Sulbactam 500mg (1.5g) IV BD x 3 days
3. Inj. Metronidazole 500mg (100ml) IV Infusion q8h x 3 days
4. Inj. Tramadol 50mg in 100ml Normal Saline IV infusion SOS for post-op colic/pain
5. Inj. Pantoprazole 40mg IV OD
6. Inj. Ondansetron 4mg IV BD for antiemetic coverage
7. IV Fluids: Ringer's Lactate 1000ml + 5% Dextrose Normal Saline 500ml @ 80 ml/hr post-op."	"Dr. Priya Patel"	"1. Tab. Cefixime 200mg - 1 tablet orally twice daily after food for 5 days.
2. Tab. Aceclofenac 100mg + Paracetamol 325mg - 1 tablet orally twice daily after food for 3 days as needed.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
4. Tab. Drotaverine 80mg - 1 tablet orally SOS for spasmodic abdominal pain.
5. Syp. Lactulose 15ml orally at bedtime for 3 days if constipation occurs.
6. Strict low-fat, non-greasy, easily digestible soft diet; avoid deep-fried foods, butter, and heavy spices for 3 weeks.
7. Keep surgical port-site dressing clean and dry. Avoid bathing directly over incision sites until suture check.
8. Avoid strenuous abdominal strain, heavy lifting (>5 kg), or intense exercises for 4 weeks.
9. Surgical OPD Review in 7 days for port-site incision inspection and suture/staple check.
"	"Laparoscopic Cholecystectomy performed under General Anesthesia. Gallbladder with multiple calculi dissected and removed intact. Hemostasis achieved. Subhepatic drain placed and removed prior to discharge."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:53"	"2026-09-18 15:39:53"	"Approved"	"Groq (openai/gpt-oss-20b)"	"groq"
87226	87226	87227	81	"2026-06-19 12:00:00"	"2026-09-18 10:09:53"	"Diabetic Ketoacidosis (DKA)"	"The patient, Saanvier Parthalan, a 70-year-old Other, was admitted via Emergency on 2026-06-19 presenting with DKA. Clinical evaluation confirmed Diabetic Ketoacidosis (DKA). During the hospital stay of 89 days under Dr. Ravi Reddy (Administrator), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Blood Glucose: Fasting 118 mg/dL, Postprandial 164 mg/dL (Admission Random Glucose was 384 mg/dL); HbA1c: 9.4%; Urine Ketones: Negative at discharge (Positive 3+ at admission); Serum Electrolytes: Sodium 138 mEq/L, Potassium 4.2 mEq/L, Bicarbonate 23 mEq/L, Anion Gap normalized (10 mEq/L); Renal Function: Urea 28 mg/dL, Serum Creatinine 0.85 mg/dL. Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Paracetamol - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. IV Regular Human Insulin Infusion titrated via syringe pump with hourly blood glucose monitoring
3. IV Hydration: 0.9% Normal Saline 2000ml protocol for volume replenishment and ketone clearance
4. Inj. Potassium Chloride 20 mEq in 500ml NS infusion with cardiac monitoring
5. Inj. Pantoprazole 40mg IV OD."	"Dr. Ravi Reddy"	"1. Inj. Human Mixline (30/70) Insulin - 14 units Subcutaneous 15 mins before breakfast and 8 units before dinner.
2. Tab. Metformin 500mg - 1 tablet orally twice daily with meals.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
4. Tab. Multivitamin with Methylcobalamin - 1 tablet daily after lunch for 30 days.
5. Hypoglycemia Rescue: Keep glucose powder or fruit juice readily accessible.
6. Strict diabetic diet: High fiber, complex carbohydrates, low glycemic index, strictly zero refined sugars.
7. Maintain daily 3-point Self-Monitoring of Blood Glucose (SMBG) log (Fasting, Pre-lunch, Post-dinner).
8. Hypoglycemia Awareness: If feeling shaky, sweating, dizzy, or confused, immediately consume 3 teaspoons of sugar or 150ml fruit juice and recheck glucose in 15 mins.
9. Diabetic foot care: Inspect feet daily, wear comfortable soft footwear, avoid walking barefoot.
10. OPD Review in 10 days with Diabetology with 7-day blood glucose log chart."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:53"	"2026-09-18 15:39:53"	"Pending Approval"	"Groq (openai/gpt-oss-20b)"	"groq"
87227	87227	87228	81	"2026-06-21 12:00:00"	"2026-09-18 10:09:53"	"Preterm Labor Complication"	"The patient, Adityaer Parthalan, a 83-year-old Female, was admitted via Emergency on 2026-06-21 presenting with Preterm Labor. Clinical evaluation confirmed Preterm Labor Complication. During the hospital stay of 87 days under Dr. Anjali Iyer (General Physician), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Neonatal Chest Radiograph: Reticulogranular pattern with air bronchograms, significantly cleared post-treatment; Capillary Blood Gas: pH 7.38, pCO2 40 mmHg, pO2 68 mmHg, HCO3 22 mEq/L, SpO2 97% on room air; Sepsis Screen: CRP 2.1 mg/L (Normal), Blood Culture: Sterile; Serum Bilirubin: 6.2 mg/dL (Physiological range). Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Nasal Continuous Positive Airway Pressure (CPAP) supportive respiratory care with gentle weaning
3. Intratracheal Surfactant administration in NICU as per protocol
4. Inj. Ampicillin 50mg/kg/dose IV BD + Inj. Gentamicin 4mg/kg IV OD x 3 days
5. IV Fluids: 10% Dextrose infusion with electrolyte maintenance, transitioned to full breast milk feeds
6. Continuous neonatal cardio-respiratory and pulse oximetry monitoring in NICU."	"Dr. Anjali Iyer"	"1. Drops Vitamin D3 (400 IU/ml) - 1 ml (400 IU) orally once daily after morning feed for 1 year.
2. Drops Multivitamin & Iron supplement - 0.5 ml orally once daily after feeds.
3. Normal Saline Nasal Drops - 1 drop in each nostril before feeds if nasal congestion occurs.
4. Exclusive on-demand breastfeeding every 2-3 hours; ensure proper latching and burping after every feed.
5. Maintain thermal protection (Kangaroo Mother Care / warm clothing); avoid direct draft of fans or AC.
6. Strict hand hygiene before handling baby; keep away from sick individuals and smoke.
7. Pediatrics / Neonatology Review in 7 days for weight check, feeding assessment, and immunization.
8. Emergency Warning Signs: Bring baby immediately to hospital if chest in-drawing, grunting, fast breathing (>60/min), lethargy, poor feeding, or bluish discoloration occurs."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:53"	"2026-09-18 15:39:53"	"Pending Approval"	"Groq (openai/gpt-oss-20b)"	"groq"
87228	87228	87229	81	"2026-03-28 12:00:00"	"2026-09-18 10:09:53"	"Acute Cerebrovascular Accident (Stroke)"	"The patient, Parier Parthalan, a 51-year-old Female, was admitted via Emergency on 2026-03-28 presenting with Stroke. Clinical evaluation confirmed Acute Cerebrovascular Accident (Stroke). During the hospital stay of 172 days under Dr. Vikram Singh (Cardiologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"MRI Brain with DWI: Acute ischemic infarct in left MCA territory; MR Angiography: Mild atheromatous narrowing of left ICA; Carotid Doppler: 35% stenosis at left carotid bifurcation; 2D Echo: Normal chambers, no intracardiac thrombus, EF 55%; Coagulation Profile: PT 12.8s, INR 1.05; Lipid Profile: LDL 148 mg/dL; Blood Sugar: Fasting 108 mg/dL. Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Paracetamol - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Tab. Aspirin 150mg + Tab. Clopidogrel 75mg PO OD (Dual Antiplatelet Therapy)
3. Tab. Atorvastatin 40mg PO HS (Plaque stabilization)
4. Inj. Citicoline 500mg IV BD (Neuroprotection)
5. Inj. Pantoprazole 40mg IV OD
6. IV Infusion: 0.9% Normal Saline @ 60 ml/hr maintaining euvolemia
7. Physiotherapy, neuro-rehabilitation, and swallowing assessment."	"Dr. Vikram Singh"	"1. Tab. Aspirin 75mg - 1 tablet orally once daily after lunch.
2. Tab. Clopidogrel 75mg - 1 tablet orally once daily after breakfast for 90 days.
3. Tab. Atorvastatin 40mg - 1 tablet orally once daily at bedtime for 6 months.
4. Tab. Citicoline 500mg - 1 tablet orally twice daily after food for 30 days.
5. Tab. Telmisartan 40mg - 1 tablet orally once daily in the morning.
6. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 14 days.
7. Continue daily neuro-physiotherapy, limb mobility exercises, and speech exercises at home.
8. Strict blood pressure monitoring (target BP < 130/80 mmHg) and lipid control.
9. Low-salt (<2g/day), Mediterranean-style low-fat diet.
10. Neurology OPD Review in 7 days for neurological recovery and functional status evaluation.
11. Emergency Warning Signs: FAST protocol - seek immediate ER care if Facial droop, Arm weakness, Speech slurring, or sudden confusion re-occurs."	"Nil (Emergency Non-contrast CT Brain ruled out hemorrhage; patient managed in Neuro-ICU with antiplatelet therapy, neuroprotection, and blood pressure control)."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:53"	"2026-09-18 15:39:53"	"Pending Approval"	"Groq (openai/gpt-oss-20b)"	"groq"
87229	87229	87230	81	"2026-08-27 12:00:00"	"2026-09-18 10:09:53"	"Traumatic Bone Fracture"	"The patient, Jameser Parthalan, a 51-year-old Male, was admitted via Emergency on 2026-08-27 presenting with Fracture. Clinical evaluation confirmed Traumatic Bone Fracture. During the hospital stay of 20 days under Dr. Neha Nair (Orthopedist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Post-operative X-Ray (AP & Lateral): Anatomical reduction of patellar fracture fragments with stable tension band wiring constructs in situ; CBC: Hemoglobin 12.2 g/dL, Platelets 2.8 lakhs/mcL, WBC 7,800/mcL; Serum Calcium: 9.4 mg/dL, Serum Vitamin D3: 22.4 ng/mL. Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Inj. Cefuroxime 1.5g IV BD x 2 days post-op (Prophylactic antibiotic)
3. Inj. Tramadol 50mg IV in 100ml NS BD for post-operative analgesia
4. Inj. Paracetamol 1000mg IV infusion q8h SOS
5. Inj. Pantoprazole 40mg IV OD
6. Lower limb elevation, ice pack application, and deep vein thrombosis prophylaxis with active ankle pumps."	"Dr. Neha Nair"	"1. Tab. Cefuroxime Axetil 500mg - 1 tablet orally twice daily after meals for 5 days.
2. Tab. Aceclofenac 100mg + Paracetamol 325mg - 1 tablet orally twice daily after food for 5 days as needed for pain.
3. Tab. Trypsin-Chymotrypsin (Chymoral Forte) - 1 tablet orally thrice daily half hour before food for 5 days (anti-inflammatory).
4. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
5. Tab. Calcium Carbonate 500mg + Vitamin D3 400IU - 1 tablet orally daily after dinner for 30 days.
6. Strictly wear the knee immobilizer splint when standing or moving; non-weight bearing on operated leg using walker/crutches as instructed.
7. Keep operated leg elevated on 2 pillows while lying down to minimize swelling.
8. Perform active ankle pump exercises and static quadriceps contractions 10 times every 2 hours.
9. Keep surgical wound dressing clean and dry; do not wet the bandage.
10. Orthopedic OPD Review in 10-12 days for wound inspection and suture removal.
11. Emergency Warning Signs: Report immediately if severe calf pain/swelling, severe coldness in toes, foul discharge, or high fever occurs."	"Open Reduction and Internal Fixation (ORIF) / Tension Band Wiring of patellar fracture with rigid stabilization. Knee immobilizer splint applied. Intraoperative fluoroscopy confirmed anatomical reduction."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:53"	"2026-09-18 15:39:53"	"Approved"	"Groq (openai/gpt-oss-20b)"	"groq"
87230	87230	87231	14	"2026-01-26 00:00:00"	"2026-09-28 10:50:09"	"Acute Febrile Illness (High Fever)"	"The patient, Novaer Parthalan, a 34-year-old Female, was admitted via Emergency on 2026-01-26 presenting with High Fever. Clinical evaluation confirmed Acute Febrile Illness (High Fever). During the hospital stay of 242 days under Dr. Hemant Menon (Pediatrician), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Complete Blood Count (CBC): Hb 12.6 g/dL, Total WBC 5,200/mcL, Platelet count 1.95 lakhs/mcL; Dengue NS1 Antigen & IgM: Negative; Malaria QBC & Smear: Negative for plasmodium species; Widal & Typhidot: Negative; Blood & Urine Cultures: Sterile after 48 hours incubation; Serum Electrolytes & Renal/Liver function tests within normal limits; Chest X-Ray: Clear lung fields. Vital Signs at Discharge: Temp: 99.2°F, HR: 90 bpm, BP: 117/90 mmHg, SpO2: 93.32%."	"Inpatient care and stabilization administered:
1. Administered: Inj. Furosemide - Dosage: 1 g - Route: SC - Freq: TDS - Duration: 30 Days - (Take as directed by consultant)
2. Inj. Ceftriaxone 1g IV BD x 3 days
3. Inj. Paracetamol 1000mg IV infusion SOS for temperature spikes > 100.5°F
4. Inj. Pantoprazole 40mg IV OD
5. IV Fluids: 0.9% Normal Saline 1000ml/day maintenance hydration
6. Tepid sponging and continuous vital signs monitoring every 4 hours."	"Dr. Hemant Menon"	"1. Tab. Cefixime 200mg - 1 tablet orally twice daily after food for 5 days.
2. Tab. Paracetamol 650mg - 1 tablet orally SOS for fever/headache/body pain (maximum 3 tablets in 24 hours).
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
4. Tab. Vitamin C 500mg + Zinc - 1 tablet daily after food for 14 days.
5. Drink plenty of fluids (>3 liters/day of boiled water, tender coconut water, homemade soups).
6. Adequate bed rest; avoid physical exhaustion for 5-7 days.
7. Monitor body temperature twice daily and maintain a fever log.
8. General Medicine OPD Review in 5 days for follow-up clinical examination and CBC check.
9. Emergency Warning Signs: Seek immediate care if high fever (>102°F) returns, severe rash, breathing difficulty, or persistent vomiting develops."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 99.2°F, HR: 90 bpm, BP: 117/90 mmHg, SpO2: 93.32%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Pending Approval"	"local-clinical-engine"	"local"
87231	87231	87232	14	"2026-09-02 00:00:00"	"2026-09-28 10:50:09"	"Acute Abdominal Pain"	"The patient, Luciferer Parthalan, a 45-year-old Male, was admitted via Emergency on 2026-09-02 presenting with Abdominal Pain. Clinical evaluation confirmed Acute Abdominal Pain. During the hospital stay of 23 days under Dr. Kiran Verma (Neurologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Complete Blood Count (CBC) - Normal limits; Renal & Liver Function Tests - Within reference range; Serum Electrolytes within normal limits; Chest X-Ray / ECG - Sinus rhythm with normal cardiac and pulmonary status. Vital Signs at Discharge: Temp: 98.6°F, HR: 104 bpm, BP: 148/86 mmHg, SpO2: 97.03%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Amoxicillin + Clavulanate - Dosage: 100 mg - Route: Oral - Freq: Q6H - Duration: 5 Days - (Take as directed by consultant)
2. Inj. Pantoprazole 40mg IV OD x 2 days, transitioned to Oral Tab. 40mg
3. Tab. Paracetamol 650mg PO SOS for fever/body pain (max 3 times/day)
4. IV Fluids: Normal Saline 500ml @ 75ml/hr for initial hydration
5. Routine inpatient vital signs monitoring and nursing care."	"Dr. Kiran Verma"	"1. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
2. Tab. Paracetamol 650mg - 1 tablet orally as needed for pain/fever (max 3 tabs/day).
3. Tab. Multivitamin with Minerals - 1 capsule daily after dinner for 14 days.
4. Follow a balanced diet, adequate oral hydration (>2L/day), and avoid strenuous exertion for 5 days.
5. OPD Review in 7 days with Attending Physician for clinical follow-up.
6. Emergency Warning Signs: Seek immediate medical attention if persistent high fever (>101°F), acute chest pain, or shortness of breath occurs."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 104 bpm, BP: 148/86 mmHg, SpO2: 97.03%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Pending Approval"	"local-clinical-engine"	"local"
87232	87232	87233	8	"2025-08-25 12:00:00"	"2026-09-23 10:46:52"	"Acute Gastroenteritis"	"The patient, Christoer Parthalan, a 64-year-old Other, was admitted via Emergency on 2025-08-25 presenting with Gastroenteritis. Clinical evaluation confirmed Acute Gastroenteritis. During the hospital stay of 387 days under Dr. Rahul Kumar (Gynecologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Stool Routine & Microscopy: 4-6 Pus cells/hpf, no cysts or ova seen; Stool Culture: Sensitive to Ciprofloxacin and Azithromycin; Serum Electrolytes: Sodium 136 mEq/L, Potassium 3.9 mEq/L, Chloride 102 mEq/L (Corrected from admission dehydration); Renal Parameters: Serum Creatinine 0.8 mg/dL, Urea 24 mg/dL. Vital Signs at Discharge: Temp: 98.4°F, HR: 86 bpm, BP: 113/64 mmHg, SpO2: 91.58%."	"Inpatient care and stabilization administered:
1. Administered: Paracetamol - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Administered: IV Fluids: Ringer's Lactate 1500ml + 0.9% Normal Saline 1000ml for acute rehydration
3. Administered: Inj. Ciprofloxacin 200mg (100ml) IV BD x 2 days
4. Administered: Inj. Ondansetron 4mg IV BD for antiemetic control
5. Administered: Inj. Pantoprazole 40mg IV OD"	"Dr. Rahul Kumar"	"1. Tab. Ofloxacin 200mg + Ornidazole 500mg - 1 tablet orally twice daily after food for 5 days.
2. Sachet Racecadotril 100mg - 1 capsule orally thrice daily before food for 2 days if loose stools persist.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
4. Capsule Probiotic (Lactic Acid Bacillus + Zinc) - 1 capsule daily after food for 7 days.
5. ORS Sachet (WHO formula) - Dissolve 1 packet in 1 Liter clean boiled and cooled water; sip throughout the day.
6. Consume easily digestible bland soft diet (kanji, curd rice, banana, boiled potatoes, coconut water); avoid dairy milk, oily, and raw spicy foods for 5 days.
7. Drink plenty of boiled, purified water (>3 liters/day) and electrolyte fluids.
8. Maintain strict hand hygiene before eating and after using the restroom.
9. General Medicine Review in 5 days if loose stools or abdominal discomfort persists.
10. Emergency Warning Signs: Report to ER if high fever, severe persistent vomiting preventing oral intake, blood in stool, or profound dizziness develops."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.4°F, HR: 86 bpm, BP: 113/64 mmHg, SpO2: 91.58%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-23 10:46:52"	"2026-09-23 10:46:52"	"Pending Approval"	"Groq (openai/gpt-oss-120b)"	"groq"
87233	87233	87234	9	"2026-01-29 12:00:00"	"2026-09-23 10:47:06"	"Bronchial Asthma (Acute Exacerbation)"	"The patient, Davider Parthalan, a 68-year-old Female, was admitted via Emergency on 2026-01-29 presenting with Asthma. Clinical evaluation confirmed Bronchial Asthma (Acute Exacerbation). During the hospital stay of 230 days under Dr. Sneha Das (Surgeon), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Peak Expiratory Flow Rate (PEFR): Improved from 180 L/min to 410 L/min post-bronchodilator; Chest X-Ray (PA View): Bilateral lung hyperinflation, no consolidation or pneumothorax; Arterial Blood Gas (ABG): pH 7.42, pCO2 38 mmHg, pO2 88 mmHg, SpO2 97% on room air; Complete Blood Count: Absolute Eosinophil Count 450 cells/mcL; Normal renal/liver parameters. Vital Signs at Discharge: Temp: 100.2°F, HR: 105 bpm, BP: 113/71 mmHg, SpO2: 91.85%."	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Administered: Nebulization: Duolin (Levosalbutamol 1.25mg + Ipratropium Bromide 500mcg in 2.5ml) q6h
3. Administered: Nebulization: Budecort (Budesonide 0.5mg respules) q12h
4. Administered: Inj. Hydrocortisone 100mg IV q8h x 2 days, tapered smoothly
5. Administered: Tab. Montelukast 10mg + Levocetirizine 5mg PO at bedtime
6. Administered: Oxygen therapy via nasal cannula @ 2-4 L/min titrated to maintain SpO2 > 95%
7. Administered: Chest physiotherapy and breathing exercises."	"Dr. Sneha Das"	"1. Inhaler Budesonide + Formoterol (200mcg / 6mcg) - 2 puffs twice daily with spacer x 30 days.
2. Inhaler Salbutamol 100mcg - 2 puffs SOS via spacer for acute wheezing/shortness of breath.
3. Tab. Montelukast 10mg - 1 tablet orally once daily at bedtime for 14 days.
4. Tab. Prednisolone 20mg - 1 tablet orally in the morning after breakfast for 3 days, then 10mg for 2 days, then stop.
5. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
6. Steam inhalation twice daily; strictly avoid exposure to dust, aerosol sprays, cold air, pet dander, and active/passive smoke.
7. Rinse mouth thoroughly with water after using steroid inhalers to prevent oral candidiasis.
8. Maintain adequate fluid intake (>2.5 liters of warm water daily).
9. OPD Review in 7 days with Pulmonology for repeat spirometry and inhaler technique review.
10. Emergency Warning Signs: Rush to ER if acute severe breathlessness, inability to speak full sentences, or blue lips/fingertips occur."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 100.2°F, HR: 105 bpm, BP: 113/71 mmHg, SpO2: 91.85%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-23 10:47:06"	"2026-09-23 10:47:06"	"Pending Approval"	"Groq (openai/gpt-oss-120b)"	"groq"
87235	87235	87236	14	"2026-01-23 00:00:00"	"2026-09-28 10:50:09"	"Cholelithiasis (Gallstone Disease)"	"The patient, Samer Parthalan, a 66-year-old Other, was admitted via Elective on 2026-01-23 presenting with Cholelithiasis. Clinical evaluation confirmed Cholelithiasis (Gallstone Disease). During the hospital stay of 245 days under Dr. Yamini Pillai (Intensivist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Ultrasound Abdomen: Calculus of gallbladder with thickened gallbladder wall (4.2 mm) and pericholecystic fluid, resolving post-op; Liver Function Tests: Total Bilirubin 1.1 mg/dL, Direct Bilirubin 0.3 mg/dL, SGOT/AST 34 U/L, SGPT/ALT 38 U/L, Alkaline Phosphatase 112 U/L; CBC: WBC count 8,200/mcL (down from 14,500/mcL at admission); Serum Amylase & Lipase normal. Vital Signs at Discharge: Temp: 99.3°F, HR: 100 bpm, BP: 152/90 mmHg, SpO2: 98.49%."	"Inpatient care and stabilization administered:
1. Administered: Ringer Lactate (RL) - Dosage: 100 mg - Route: IV - Freq: Q6H - Duration: 7 Days - (Take as directed by consultant)
2. Inj. Cefoperazone 1g + Sulbactam 500mg (1.5g) IV BD x 3 days
3. Inj. Metronidazole 500mg (100ml) IV Infusion q8h x 3 days
4. Inj. Tramadol 50mg in 100ml Normal Saline IV infusion SOS for post-op colic/pain
5. Inj. Pantoprazole 40mg IV OD
6. Inj. Ondansetron 4mg IV BD for antiemetic coverage
7. IV Fluids: Ringer's Lactate 1000ml + 5% Dextrose Normal Saline 500ml @ 80 ml/hr post-op."	"Dr. Yamini Pillai"	"1. Tab. Cefixime 200mg - 1 tablet orally twice daily after food for 5 days.
2. Tab. Aceclofenac 100mg + Paracetamol 325mg - 1 tablet orally twice daily after food for 3 days as needed.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
4. Tab. Drotaverine 80mg - 1 tablet orally SOS for spasmodic abdominal pain.
5. Syp. Lactulose 15ml orally at bedtime for 3 days if constipation occurs.
6. Strict low-fat, non-greasy, easily digestible soft diet; avoid deep-fried foods, butter, and heavy spices for 3 weeks.
7. Keep surgical port-site dressing clean and dry. Avoid bathing directly over incision sites until suture check.
8. Avoid strenuous abdominal strain, heavy lifting (>5 kg), or intense exercises for 4 weeks.
9. Surgical OPD Review in 7 days for port-site incision inspection and suture/staple check.
10. Emergency Warning Signs: Report immediately if persistent fever > 101°F, worsening abdominal pain, persistent vomiting, or yellowing of eyes (jaundice) develops."	"Laparoscopic Cholecystectomy performed under General Anesthesia. Gallbladder with multiple calculi dissected and removed intact. Hemostasis achieved. Subhepatic drain placed and removed prior to discharge."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 99.3°F, HR: 100 bpm, BP: 152/90 mmHg, SpO2: 98.49%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Pending Approval"	"local-clinical-engine"	"local"
87236	87236	87237	12	"2026-07-06 12:00:00"	"2026-09-23 10:47:07"	"Diabetic Ketoacidosis (DKA)"	"The patient, Tomer Parthalan, a 24-year-old Other, was admitted via Emergency on 2026-07-06 presenting with DKA. Clinical evaluation confirmed Diabetic Ketoacidosis (DKA). During the hospital stay of 72 days under Dr. Arjun Rao (Pathologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Blood Glucose: Fasting 118 mg/dL, Postprandial 164 mg/dL (Admission Random Glucose was 384 mg/dL); HbA1c: 9.4%; Urine Ketones: Negative at discharge (Positive 3+ at admission); Serum Electrolytes: Sodium 138 mEq/L, Potassium 4.2 mEq/L, Bicarbonate 23 mEq/L, Anion Gap normalized (10 mEq/L); Renal Function: Urea 28 mg/dL, Serum Creatinine 0.85 mg/dL. Vital Signs at Discharge: Temp: 98.5°F, HR: 73 bpm, BP: 100/99 mmHg, SpO2: 90.68%."	"Inpatient care and stabilization administered:
1. Administered: Paracetamol - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Administered: IV Regular Human Insulin Infusion titrated via syringe pump with hourly blood glucose monitoring
3. Administered: IV Hydration: 0.9% Normal Saline 2000ml protocol for volume replenishment and ketone clearance
4. Administered: Inj. Potassium Chloride 20 mEq in 500ml NS infusion with cardiac monitoring
5. Administered: Inj. Pantoprazole 40mg IV OD."	"Dr. Arjun Rao"	"1. Inj. Human Mixline (30/70) Insulin - 14 units Subcutaneous 15 mins before breakfast and 8 units before dinner.
2. Tab. Metformin 500mg - 1 tablet orally twice daily with meals.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
4. Tab. Multivitamin with Methylcobalamin - 1 tablet daily after lunch for 30 days.
5. Hypoglycemia Rescue: Keep glucose powder or fruit juice readily accessible.
6. Strict diabetic diet: High fiber, complex carbohydrates, low glycemic index, strictly zero refined sugars.
7. Maintain daily 3-point Self-Monitoring of Blood Glucose (SMBG) log (Fasting, Pre-lunch, Post-dinner).
8. Hypoglycemia Awareness: If feeling shaky, sweating, dizzy, or confused, immediately consume 3 teaspoons of sugar or 150ml fruit juice and recheck glucose in 15 mins.
9. Diabetic foot care: Inspect feet daily, wear comfortable soft footwear, avoid walking barefoot.
10. OPD Review in 10 days with Diabetology with 7-day blood glucose log chart."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.5°F, HR: 73 bpm, BP: 100/99 mmHg, SpO2: 90.68%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-23 10:47:07"	"2026-09-23 10:47:07"	"Pending Approval"	"Groq (openai/gpt-oss-120b)"	"groq"
87238	87238	87239	14	"2025-10-26 00:00:00"	"2026-09-23 13:41:07"	"Acute Cerebrovascular Accident (Stroke)"	"Alaner Parthalan, a 62‑year‑old male, presented on 2025‑10‑26 with sudden onset left‑sided weakness and dysarthria lasting >30 minutes. He was brought to the emergency department within 2 hours of symptom onset. Initial NIH Stroke Scale (NIHSS) score was 12. Non‑contrast CT brain showed early ischemic changes in the left middle cerebral artery (MCA) territory without hemorrhage. He was admitted to the stroke unit, started on antiplatelet therapy, statin, and blood pressure control. Over the next 5 days his neurological deficits improved (NIHSS 4), he remained afebrile, and vital signs stabilized. He received intensive physiotherapy and speech therapy. No complications such as hemorrhagic transformation, deep vein thrombosis, or infection occurred. He was deemed fit for discharge on day 6."	"{""vitals"": {""admission"": {""temperature_F"": 98.4, ""heart_rate_bpm"": 64, ""blood_pressure_mmHg"": ""158/71"", ""spo2_percent"": 93.2}, ""trend"": ""BP gradually controlled to 130/78 mmHg; HR 60‑70 bpm; SpO2 94‑96% on room air.""}, ""laboratory"": {""cbc"": {""hb_g_dl"": 13.5, ""wbc_x10^9_l"": 7.2, ""platelets_x10^9_l"": 210}, ""renal"": {""creatinine_mg_dl"": 1.0, ""eGFR_ml_min_1_73m2"": 85}, ""liver"": {""alt_u_l"": 28, ""ast_u_l"": 30, ""bilirubin_total_mg_dl"": 0.9}, ""electrolytes"": {""na_mmol_l"": 138, ""k_mmol_l"": 4.2, ""cl_mmol_l"": 102}, ""coagulation"": {""pt_sec"": 12.5, ""inr"": 1.0, ""aptT_sec"": 30}, ""lipid_profile"": {""ldl_mg_dl"": 140, ""hdl_mg_dl"": 38, ""triglycerides_mg_dl"": 150}}, ""imaging"": {""ct_head_non_contrast"": ""Early ischemic changes in left MCA territory; no intracranial hemorrhage."", ""ecg"": ""Normal sinus rhythm, no acute ischemia.""}}"	"{""medications"": [{""name"": ""Aspirin"", ""dose"": ""325 mg"", ""frequency"": ""once daily"", ""route"": ""oral"", ""duration"": ""indefinite""}, {""name"": ""Clopidogrel"", ""dose"": ""75 mg"", ""frequency"": ""once daily"", ""route"": ""oral"", ""duration"": ""indefinite""}, {""name"": ""Atorvastatin"", ""dose"": ""80 mg"", ""frequency"": ""once daily"", ""route"": ""oral"", ""duration"": ""indefinite""}, {""name"": ""Amlodipine"", ""dose"": ""5 mg"", ""frequency"": ""once daily"", ""route"": ""oral"", ""duration"": ""indefinite""}, {""name"": ""Enoxaparin"", ""dose"": ""40 mg"", ""frequency"": ""once daily"", ""route"": ""subcutaneous"", ""duration"": ""5 days (DVT prophylaxis)""}, {""name"": ""Paracetamol"", ""dose"": ""500 mg"", ""frequency"": ""twice daily"", ""route"": ""oral"", ""duration"": ""5 days"", ""instructions"": ""Take after food""}], ""iv_fluids"": [{""type"": ""0.9% Normal Saline"", ""rate_ml_per_hr"": 42, ""duration_hours"": 24, ""total_volume_ml"": 1000}], ""therapies"": [""Daily physiotherapy focusing on gait and balance"", ""Speech therapy for dysarthria"", ""Occupational therapy for ADL training""]}"	"Dr. Sanjay Jain"	"{""medications"": [{""name"": ""Aspirin"", ""dose"": ""325 mg"", ""frequency"": ""once daily"", ""route"": ""oral""}, {""name"": ""Clopidogrel"", ""dose"": ""75 mg"", ""frequency"": ""once daily"", ""route"": ""oral""}, {""name"": ""Atorvastatin"", ""dose"": ""80 mg"", ""frequency"": ""once nightly"", ""route"": ""oral""}, {""name"": ""Amlodipine"", ""dose"": ""5 mg"", ""frequency"": ""once daily"", ""route"": ""oral""}], ""dietary"": ""Low‑sodium, heart‑healthy diet; increase fruits, vegetables, whole grains; limit saturated fat and cholesterol."", ""activity"": ""Gradual ambulation as tolerated; continue physiotherapy exercises at home; avoid heavy lifting or strenuous activity for 2 weeks."", ""red_flags"": [""Sudden worsening weakness or numbness"", ""New speech difficulty or facial droop"", ""Severe headache or vomiting"", ""Chest pain or shortness of breath"", ""Any sign of bleeding (gastrointestinal or intracranial)""], ""follow_up"": [{""specialty"": ""Neurology OPD"", ""timeframe"": ""2 weeks post‑discharge""}, {""specialty"": ""Physiotherapy"", ""timeframe"": ""Outpatient sessions 3 times/week for 4 weeks""}, {""specialty"": ""Primary Care Physician"", ""timeframe"": ""Within 1 week for blood pressure and lipid review""}]}"	"Nil"	"Hemodynamically stable (BP 130/78 mmHg, HR 66 bpm, SpO2 95% on room air). Neurologically improved with residual mild left‑hand weakness (Medical Research Council grade 4/5). Able to sit unsupported and ambulate 20 meters with a cane. No evidence of infection or other complications."	"2026-09-23 13:41:07"	"2026-09-23 13:41:07"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87239	87239	87240	14	"2025-09-11 00:00:00"	"2026-09-28 12:18:23"	"Traumatic Bone Fracture"	"Ms. Senthilel Parthalan, a 53-year-old female, presented on 2025-09-11 after a fall from a height of approximately 2 meters. She complained of severe pain and swelling over the left thigh. Physical examination revealed deformity, tenderness, and inability to bear weight on the left lower limb. Distal neurovascular status was intact. Radiographs confirmed a transverse mid‑shaft fracture of the left femur (AO/OTA 32-A3). The patient was admitted for orthopedic management, received analgesia, prophylactic antibiotics, and was taken to the operating theatre on day 1 for intramedullary nail fixation. Post‑operative course was uneventful with gradual pain control, mobilization with a physiotherapy program, and monitoring for infection. She met discharge criteria on day 5 and was discharged home with instructions."	"Vitals on Admission: Temp 98.8°F, HR 96 bpm, BP 122/88 mmHg, SpO2 94.24%
Laboratory Findings: CBC (WBC_10^9/L: 9.2, Hb_g/dL: 12.8, Platelets_10^9/L: 250); Renal (BUN_mg/dL: 14, Creatinine_mg/dL: 0.9); Liver (AST_U/L: 22, ALT_U/L: 18, ALP_U/L: 78); Electrolytes (Na_mEq/L: 138, K_mEq/L: 4.2, Cl_mEq/L: 102, HCO3_mEq/L: 24)
Imaging & Diagnostics: Xray Left Femur: Transverse mid‑shaft fracture with minimal comminution, no intra‑articular extension; Post Op Xray: Intramedullary nail in situ with satisfactory reduction and alignment
ECG: Normal sinus rhythm, no ischemic changes"	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500 mg - Route: Oral - Freq: BID - Indication: Take after food
2. Administered: Paracetamol - Dosage: 1 g - Route: Oral - Freq: Q6H PRN - Indication: For pain, max 4 g/24h
3. Administered: Ibuprofen - Dosage: 400 mg - Route: Oral - Freq: TID - Indication: With food, avoid if renal insufficiency
4. Administered: Enoxaparin - Dosage: 40 mg - Route: Subcutaneous - Freq: Once daily - Indication: DVT prophylaxis"	"Dr. Amit Sharma"	"1. Paracetamol - 1 g, Route: Oral, Freq: Q6H PRN
2. Ibuprofen - 400 mg, Route: Oral, Freq: TID
3. Enoxaparin - 40 mg, Route: Subcutaneous, Freq: Once daily
4. Non‑weight bearing on left leg with crutches for 4 weeks. Begin gentle range‑of‑motion exercises as instructed by physiotherapist. Progress to partial weight bearing after 4 weeks based on orthopedic review.
5. Increasing pain, swelling, redness or drainage at surgical site; fever >38°C; numbness or tingling in the leg; inability to move the foot; calf pain or swelling suggestive of DVT.
6. Orthopedic OPD on 2025-09-26 (2 weeks post‑op) and again at 6 weeks. Primary care physician for routine health review within 1 month."	"Closed reduction and internal fixation of left femur with intramedullary nail performed on 2025-09-12 under general anesthesia; intra‑operative blood loss <200 mL; no intra‑operative complications."	"Hemodynamically stable, afebrile, pain controlled with oral analgesics, surgical wound clean, dry, and intact. Neurovascular status of the left lower limb is normal. Discharged in a stable clinical state."	"2026-09-28 12:18:23"	"2026-09-28 12:18:23"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87240	87240	87241	1	"2026-06-20 00:00:00"	"2026-09-23 14:02:31"	"Acute Febrile Illness (High Fever)"	"Muruganel Parthalan, a 38‑year‑old individual, presented on 20‑Jun‑2026 with a 3‑day history of high-grade fever (up to 101°F), chills, myalgia and mild headache. No focal source of infection was identified on examination. Initial assessment ruled out malaria, dengue, urinary tract infection and COVID‑19. The patient was admitted for observation, fever work‑up and supportive care. Over the 48‑hour inpatient stay, the fever defervesced after 24 h of antipyretic therapy, vitals remained stable, and repeat investigations showed no evidence of bacterial sepsis. The patient was educated on home care and discharged in stable condition."	"ECG: Normal sinus rhythm, rate 68 bpm, no ischemic changes"	"Inpatient care and stabilization administered:
1. Administered: Paracetamol - Dosage: 500 mg - Route: Oral - Freq: BID - Duration: 5 days"	"Dr. Priya Patel"	"1. Paracetamol - 500 mg, Route: Oral, Freq: BID as needed for fever or pain, max 4 g/day
2. Light, balanced diet with adequate hydration (minimum 2 L water/fluids daily)
3. Resume normal activities gradually; avoid strenuous exercise for 48 h
4. Re‑emergence of fever >100.4°F, chills, rash, persistent vomiting, abdominal pain, shortness of breath, dizziness or any new neurological symptoms
5. Outpatient visit with General Physician in 5‑7 days or sooner if red‑flag symptoms develop"	"Nil"	"Hemodynamically stable, afebrile, alert and oriented; discharged in good clinical condition with no residual symptoms."	"2026-09-23 14:02:31"	"2026-09-23 14:02:31"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87243	87243	87244	14	"2026-04-09 00:00:00"	"2026-09-28 11:09:02"	"Bronchial Asthma (Acute Exacerbation)"	"The 37‑year‑old male presented on 2026‑04‑09 with a 2‑day history of worsening dyspnea, wheezing, chest tightness, and cough productive of clear sputum. He reported prior intermittent asthma treated with short‑acting beta‑agonist (SABA) inhaler only. On arrival his temperature was 101.1°F, heart rate 116 bpm, blood pressure 138/93 mmHg, respiratory rate 24/min, and SpO2 94% on room air. Physical exam revealed diffuse expiratory wheezes and use of accessory muscles. He was admitted for acute severe asthma exacerbation. Initial management included high‑flow oxygen, nebulized albuterol‑ipratropium every 20 minutes, intravenous methylprednisolone 125 mg loading dose followed by 40 mg q6h, and continuation of his home digoxin (100 mg PO q6h) for co‑existing cardiac condition. Over the first 24 hours his symptoms improved, peak expiratory flow increased from 180 L/min to 280 L/min, and SpO2 stabilized at 96% on 2 L/min nasal cannula. Nebulizations were tapered to every 4 hours, then to every 8 hours, and finally to as‑needed basis. Steroids were switched to oral prednisolone 40 mg daily on day 3. He was educated on inhaler technique and an asthma action plan before discharge on day 5."	"Laboratory Findings: CBC: Hb 14.2 g/dL, WBC 12.8 ×10^3/µL (neutrophils 78%), platelets 250 ×10^3/µL; BMP: Na 138 mmol/L, K 4.2 mmol/L, Cl 102 mmol/L, HCO3‑ 24 mmol/L, BUN 14 mg/dL, Creatinine 0.9 mg/dL, Glucose 112 mg/dL; Liver: AST 22 U/L, ALT 25 U/L, ALP 78 U/L, Bilirubin total 0.8 mg/dL; Abg (Room Air, Day 1): pH 7.32, PaCO2 48 mmHg, PaO2 68 mmHg, HCO3‑ 24 mmol/L, SaO2 92%; Abg (Room Air, Day 3): pH 7.40, PaCO2 38 mmHg, PaO2 85 mmHg, HCO3‑ 24 mmol/L, SaO2 96%
Imaging & Diagnostics: Chest X‑Ray: No infiltrates, hyperinflated lungs, flattened diaphragms consistent with asthma; no pneumothorax."	"Inpatient care and stabilization administered:
1. Administered: Albuterol - Dosage: 2.5 mg - Route: Nebulization - Freq: q20 min ×3, then q4h - Duration: 5 days"	"Dr. Gaurav Singh"	"1. Prednisone - 30 mg, Route: Oral, Freq: once daily (Duration: 5 days)
2. Salbutamol inhaler - 100 µg per actuation, Route: Inhalation, Freq: 2 puffs every 4 h PRN for wheeze (Duration: As needed)
3. Ipratropium bromide inhaler - 20 µg per actuation, Route: Inhalation, Freq: 2 puffs every 6 h PRN (Duration: As needed)
4. Digoxin - 100 µg, Route: Oral, Freq: q6h (Duration: Continue as per cardiology)"	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented at discharge."	"2026-09-28 11:09:02"	"2026-09-28 11:09:02"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87245	87245	87246	6	"2026-04-26 12:00:00"	"2026-09-23 10:47:06"	"Cholelithiasis (Gallstone Disease)"	"The patient, Meenakshiel Parthalan, a 64-year-old Other, was admitted via Emergency on 2026-04-26 presenting with Cholelithiasis. Clinical evaluation confirmed Cholelithiasis (Gallstone Disease). During the hospital stay of 143 days under Dr. Suresh Menon (Gynecologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Ultrasound Abdomen: Calculus of gallbladder with thickened gallbladder wall (4.2 mm) and pericholecystic fluid, resolving post-op; Liver Function Tests: Total Bilirubin 1.1 mg/dL, Direct Bilirubin 0.3 mg/dL, SGOT/AST 34 U/L, SGPT/ALT 38 U/L, Alkaline Phosphatase 112 U/L; CBC: WBC count 8,200/mcL (down from 14,500/mcL at admission); Serum Amylase & Lipase normal. Vital Signs at Discharge: Temp: 98.6°F, HR: 74 bpm, BP: 120/80 mmHg, SpO2: 98.5%."	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Administered: Inj. Cefoperazone 1g + Sulbactam 500mg (1.5g) IV BD x 3 days
3. Administered: Inj. Metronidazole 500mg (100ml) IV Infusion q8h x 3 days
4. Administered: Inj. Tramadol 50mg in 100ml Normal Saline IV infusion SOS for post-op colic/pain
5. Administered: Inj. Pantoprazole 40mg IV OD
6. Administered: Inj. Ondansetron 4mg IV BD for antiemetic coverage
7. Administered: IV Fluids: Ringer's Lactate 1000ml + 5% Dextrose Normal Saline 500ml @ 80 ml/hr post-op."	"Dr. Suresh Menon"	"1. Tab. Cefixime 200mg - 1 tablet orally twice daily after food for 5 days.
2. Tab. Aceclofenac 100mg + Paracetamol 325mg - 1 tablet orally twice daily after food for 3 days as needed.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
4. Tab. Drotaverine 80mg - 1 tablet orally SOS for spasmodic abdominal pain.
5. Syp. Lactulose 15ml orally at bedtime for 3 days if constipation occurs.
6. Strict low-fat, non-greasy, easily digestible soft diet; avoid deep-fried foods, butter, and heavy spices for 3 weeks.
7. Keep surgical port-site dressing clean and dry. Avoid bathing directly over incision sites until suture check.
8. Avoid strenuous abdominal strain, heavy lifting (>5 kg), or intense exercises for 4 weeks.
9. Surgical OPD Review in 7 days for port-site incision inspection and suture/staple check.
10. Emergency Warning Signs: Report immediately if persistent fever > 101°F, worsening abdominal pain, persistent vomiting, or yellowing of eyes (jaundice) develops."	"Laparoscopic Cholecystectomy performed under General Anesthesia. Gallbladder with multiple calculi dissected and removed intact. Hemostasis achieved. Subhepatic drain placed and removed prior to discharge."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 74 bpm, BP: 120/80 mmHg, SpO2: 98.5%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-23 10:47:06"	"2026-09-23 10:47:06"	"Pending Approval"	"Groq (openai/gpt-oss-120b)"	"groq"
87247	87247	87248	14	"2026-01-29 00:00:00"	"2026-09-28 10:50:09"	"Preterm Labor Complication"	"The patient, Siddharthel Parthalan, a 72-year-old Male, was admitted via Elective on 2026-01-29 presenting with Preterm Labor. Clinical evaluation confirmed Preterm Labor Complication. During the hospital stay of 239 days under Dr. Pranav Kumar (ER Physician), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Neonatal Chest Radiograph: Reticulogranular pattern with air bronchograms, significantly cleared post-treatment; Capillary Blood Gas: pH 7.38, pCO2 40 mmHg, pO2 68 mmHg, HCO3 22 mEq/L, SpO2 97% on room air; Sepsis Screen: CRP 2.1 mg/L (Normal), Blood Culture: Sterile; Serum Bilirubin: 6.2 mg/dL (Physiological range). Vital Signs at Discharge: Temp: 98.0°F, HR: 97 bpm, BP: 158/99 mmHg, SpO2: 96.92%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Glimepiride - Dosage: 100 mg - Route: IV - Freq: Q6H - Duration: 7 Days - (Take as directed by consultant)
2. Nasal Continuous Positive Airway Pressure (CPAP) supportive respiratory care with gentle weaning
3. Intratracheal Surfactant administration in NICU as per protocol
4. Inj. Ampicillin 50mg/kg/dose IV BD + Inj. Gentamicin 4mg/kg IV OD x 3 days
5. IV Fluids: 10% Dextrose infusion with electrolyte maintenance, transitioned to full breast milk feeds
6. Continuous neonatal cardio-respiratory and pulse oximetry monitoring in NICU."	"Dr. Pranav Kumar"	"1. Drops Vitamin D3 (400 IU/ml) - 1 ml (400 IU) orally once daily after morning feed for 1 year.
2. Drops Multivitamin & Iron supplement - 0.5 ml orally once daily after feeds.
3. Normal Saline Nasal Drops - 1 drop in each nostril before feeds if nasal congestion occurs.
4. Exclusive on-demand breastfeeding every 2-3 hours; ensure proper latching and burping after every feed.
5. Maintain thermal protection (Kangaroo Mother Care / warm clothing); avoid direct draft of fans or AC.
6. Strict hand hygiene before handling baby; keep away from sick individuals and smoke.
7. Pediatrics / Neonatology Review in 7 days for weight check, feeding assessment, and immunization.
8. Emergency Warning Signs: Bring baby immediately to hospital if chest in-drawing, grunting, fast breathing (>60/min), lethargy, poor feeding, or bluish discoloration occurs."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.0°F, HR: 97 bpm, BP: 158/99 mmHg, SpO2: 96.92%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Pending Approval"	"local-clinical-engine"	"local"
87248	87248	87249	9	"2025-05-17 12:00:00"	"2026-09-23 10:46:48"	"Acute Cerebrovascular Accident (Stroke)"	"Divyael Parthalan, a 53‑year‑old female with a past history of hypertension and dyslipidemia, presented on 2025‑05‑17 with sudden onset right‑sided hemiparesis, facial droop and expressive aphasia lasting >30 minutes. She was brought to the emergency department within 2 hours of symptom onset. Initial NIH Stroke Scale (NIHSS) was 12. Non‑contrast CT brain performed on arrival showed early ischemic changes without hemorrhage, consistent with an acute left MCA infarct. Given the presentation within the therapeutic window, intravenous alteplase was administered. She was admitted to the stroke unit for close monitoring, secondary prevention, and early rehabilitation. Over the next 5 days her neurological deficits gradually improved (NIHSS 4 at discharge), blood pressure was controlled, and she tolerated oral intake. No complications such as hemorrhagic transformation, seizures, or deep vein thrombosis occurred."	"Vitals on Admission: Temp 97.2°F, HR 115 bpm, BP 109/92 mmHg, SpO2 94.13% · Inpatient Trend: HR decreased to 78 bpm by day 3; BP stabilized at 130/80 mmHg; SpO2 remained >94% on room air.
Laboratory Findings: CBC (WBC: 9.2 x10^3/µL, Hb: 13.1 g/dL, Platelets: 210 x10^3/µL); Electrolytes (Na: 138 mmol/L, K: 4.2 mmol/L, Cl: 102 mmol/L); Renal (BUN: 14 mg/dL, Creatinine: 0.9 mg/dL); Liver (AST: 22 U/L, ALT: 25 U/L, ALP: 78 U/L); Coagulation (PT: 12.5 sec, INR: 1.0, aPTT: 30 sec); Lipid Profile (LDL: 160 mg/dL, HDL: 38 mg/dL, Triglycerides: 210 mg/dL)
Imaging & Diagnostics: Ct Head Non Contrast: Early ischemic changes in left MCA territory; no intracranial hemorrhage.; Mri Brain Dwi: Restricted diffusion confirming acute infarct in left frontal-parietal region.; Ecg: Sinus tachycardia on admission, later normal sinus rhythm."	"Inpatient care and stabilization administered:
1. Administered: Alteplase (tPA) - Dosage: 0.9 mg/kg total (10% bolus, remainder over 60 min) - Route: IV - Freq: Single dose
2. Administered: Aspirin - Dosage: 325 mg - Route: Oral - Freq: Loading dose once, then 81 mg daily
3. Administered: Clopidogrel - Dosage: 75 mg - Route: Oral - Freq: Once daily
4. Administered: Atorvastatin - Dosage: 80 mg - Route: Oral - Freq: Once nightly
5. Administered: Amlodipine - Dosage: 5 mg - Route: Oral - Freq: Once daily
6. Administered: Enoxaparin (prophylactic) - Dosage: 40 mg - Route: Subcutaneous - Freq: Once daily
7. Administered: Paracetamol - Dosage: 500 mg - Route: Oral - Freq: BID"	"Dr. Sneha Das"	"1. Aspirin - 81 mg, Route: Oral, Freq: Once daily (Duration: Indefinite)
2. Clopidogrel - 75 mg, Route: Oral, Freq: Once daily (Duration: Next 21 days only)
3. Atorvastatin - 80 mg, Route: Oral, Freq: Once nightly (Duration: Indefinite)
4. Amlodipine - 5 mg, Route: Oral, Freq: Once daily (Duration: Indefinite)
5. Paracetamol - 500 mg, Route: Oral, Freq: Every 6 hrs PRN for fever/pain (Duration: As needed)"	"Nil (Emergency Non-contrast CT Brain ruled out hemorrhage; patient managed in Neuro-ICU with antiplatelet therapy, neuroprotection, and blood pressure control)."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 97.2°F, HR: 115 bpm, BP: 109/92 mmHg, SpO2: 94.13%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-23 10:46:48"	"2026-09-23 10:46:48"	"Pending Approval"	"Groq (openai/gpt-oss-120b)"	"groq"
87249	87249	87250	14	"2026-05-31 00:00:00"	"2026-09-28 11:09:07"	"Traumatic Bone Fracture"	"A 77‑year‑old patient presented on 2026‑05‑31 with severe left thigh pain after a fall at home. Examination revealed swelling, deformity and inability to bear weight. Initial vitals showed fever (101.2°F), HR 63 bpm, BP 146/84 mmHg, SpO2 93.5%. Radiographs confirmed a displaced transverse fracture of the mid‑shaft left femur. The patient was admitted under orthopaedic care. Pre‑operative labs were within acceptable limits aside from mild leukocytosis (WBC 12.5 ×10^9/L). After optimisation, the patient underwent open reduction and internal fixation (ORIF) with a dynamic hip screw on 2026‑06‑02 under general anaesthesia. Post‑operatively he was monitored in the surgical ward, received DVT prophylaxis, analgesia, and a short course of prophylactic antibiotics. Early mobilisation with a walker was initiated on postoperative day 2. The postoperative course was uncomplicated: afebrile after day 3, wound remained clean, and laboratory parameters normalised. He met physiotherapy milestones and was deemed safe for discharge on 2026‑06‑09."	"Laboratory Findings: CBC (hb_g_dL: 11.2, wbc_10e9_L: 12.5, platelets_10e9_L: 210); Electrolytes (na_mmol_L: 138, k_mmol_L: 4.2, cl_mmol_L: 102, bun_mg_dL: 18, creatinine_mg_dL: 1.0); Liver Function (ast_uL: 30, alt_uL: 28, alk_phos_uL: 85, bilirubin_total_mg_dL: 0.9); Inflammatory (crp_mg_L: 45)
Imaging & Diagnostics: Xray Left Femur: Transverse mid‑shaft fracture with displacement, AO/OTA type 32‑A2; Post Op Xray: Adequate reduction and hardware placement, no loss of alignment; Ecg: Normal sinus rhythm, no ischemic changes"	"Inpatient care and stabilization administered:
1. Administered: Enoxaparin Sodium - Dosage: 40 mg - Route: Subcutaneous - Freq: once daily - Duration: 5 days - Indication: DVT prophylaxis
2. Administered: Paracetamol - Dosage: 1 g - Route: Oral - Freq: every 6 hours PRN - Duration: as needed - Indication: Analgesia
3. Administered: Tramadol - Dosage: 50 mg - Route: Oral - Freq: every 8 hours PRN - Duration: as needed - Indication: Moderate pain
4. Administered: Cefazolin - Dosage: 1 g - Route: Intravenous - Freq: every 8 hours - Duration: 3 days - Indication: Prophylactic antibiotic for operative fracture"	"Dr. Tapan Bose"	"Follow-up in OPD as advised by attending physician."	"Open Reduction and Internal Fixation (ORIF) / Tension Band Wiring of patellar fracture with rigid stabilization. Knee immobilizer splint applied. Intraoperative fluoroscopy confirmed anatomical reduction."	"Patient is hemodynamically stable, alert, conscious, and oriented at discharge."	"2026-09-28 11:09:07"	"2026-09-28 11:09:07"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87252	87252	87253	14	"2025-06-03 00:00:00"	"2026-09-28 10:50:09"	"Acute Gastroenteritis"	"The patient, Karthikel Parthalan, a 27-year-old Female, was admitted via Referral on 2025-06-03 presenting with Gastroenteritis. Clinical evaluation confirmed Acute Gastroenteritis. During the hospital stay of 479 days under Dr. Komal Gupta (Administrator), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Stool Routine & Microscopy: 4-6 Pus cells/hpf, no cysts or ova seen; Stool Culture: Sensitive to Ciprofloxacin and Azithromycin; Serum Electrolytes: Sodium 136 mEq/L, Potassium 3.9 mEq/L, Chloride 102 mEq/L (Corrected from admission dehydration); Renal Parameters: Serum Creatinine 0.8 mg/dL, Urea 24 mg/dL. Vital Signs at Discharge: Temp: 99.3°F, HR: 77 bpm, BP: 132/79 mmHg, SpO2: 96.05%."	"Inpatient care and stabilization administered:
1. Administered: Inj. Paracetamol IV - Dosage: 500 mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take as directed by consultant)
2. IV Fluids: Ringer's Lactate 1500ml + 0.9% Normal Saline 1000ml for acute rehydration
3. Inj. Ciprofloxacin 200mg (100ml) IV BD x 2 days
4. Inj. Ondansetron 4mg IV BD for antiemetic control
5. Inj. Pantoprazole 40mg IV OD"	"Dr. Komal Gupta"	"1. Tab. Ofloxacin 200mg + Ornidazole 500mg - 1 tablet orally twice daily after food for 5 days.
2. Sachet Racecadotril 100mg - 1 capsule orally thrice daily before food for 2 days if loose stools persist.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
4. Capsule Probiotic (Lactic Acid Bacillus + Zinc) - 1 capsule daily after food for 7 days.
5. ORS Sachet (WHO formula) - Dissolve 1 packet in 1 Liter clean boiled and cooled water; sip throughout the day.
6. Consume easily digestible bland soft diet (kanji, curd rice, banana, boiled potatoes, coconut water); avoid dairy milk, oily, and raw spicy foods for 5 days.
7. Drink plenty of boiled, purified water (>3 liters/day) and electrolyte fluids.
8. Maintain strict hand hygiene before eating and after using the restroom.
9. General Medicine Review in 5 days if loose stools or abdominal discomfort persists.
10. Emergency Warning Signs: Report to ER if high fever, severe persistent vomiting preventing oral intake, blood in stool, or profound dizziness develops."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 99.3°F, HR: 77 bpm, BP: 132/79 mmHg, SpO2: 96.05%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Pending Approval"	"local-clinical-engine"	"local"
87255	87255	87256	1	"2026-04-30 00:00:00"	"2026-09-23 13:38:44"	"Cholelithiasis (Gallstone Disease)"	"Rohitel Parthalan, a 58‑year‑old female, presented on 2026‑04‑30 with intermittent right upper quadrant pain radiating to the back, nausea and a history of known gallstones. Physical examination revealed mild tenderness in the RUQ without guarding. Laboratory workup showed normal leukocyte count and liver enzymes. Abdominal ultrasound confirmed multiple gallstones with a contracted gallbladder but no wall thickening or pericholecystic fluid. She was admitted for elective laparoscopic cholecystectomy. Pre‑operative preparation included nil per os after midnight, prophylactic antibiotics and anticoagulation. The surgery was performed uneventfully on hospital day 2. Post‑operative course was uncomplicated; pain was controlled with paracetamol, diet was advanced from clear liquids to low‑fat soft diet by day 3, and she ambulated independently. She was discharged on hospital day 4 in stable condition."	"{""vitals_admission"": {""temperature_F"": 98.7, ""heart_rate_bpm"": 62, ""blood_pressure_mmHg"": ""112/88"", ""spO2_percent"": 99.9}, ""vitals_discharge"": {""temperature_F"": 98.2, ""heart_rate_bpm"": 68, ""blood_pressure_mmHg"": ""118/80"", ""spO2_percent"": 99.5}, ""laboratory"": {""CBC"": {""WBC_10^9/L"": 7.2, ""Hemoglobin_g/dL"": 13.1, ""Platelets_10^9/L"": 250}, ""Renal"": {""BUN_mg/dL"": 14, ""Creatinine_mg/dL"": 0.9}, ""Liver"": {""AST_U/L"": 28, ""ALT_U/L"": 32, ""ALP_U/L"": 85, ""Total_Bilirubin_mg/dL"": 0.9}, ""Electrolytes"": {""Na_mEq/L"": 138, ""K_mEq/L"": 4.2, ""Cl_mEq/L"": 102, ""HCO3_mEq/L"": 24}}, ""imaging"": {""Abdominal_Ultrasound"": ""Multiple gallstones, gallbladder wall thickness 3 mm, no pericholecystic fluid, common bile duct 5 mm, no stones."", ""Chest_Xray"": ""Normal"", ""ECG"": ""Sinus rhythm, no ischemic changes""}}"	"{""medications"": [{""name"": ""Amoxicillin"", ""dose"": ""500 mg"", ""route"": ""Oral"", ""frequency"": ""BID"", ""duration"": ""5 days"", ""notes"": ""Take after food""}, {""name"": ""Paracetamol"", ""dose"": ""1 g"", ""route"": ""Oral"", ""frequency"": ""Every 6 hours PRN"", ""duration"": ""As needed""}, {""name"": ""Ondansetron"", ""dose"": ""4 mg"", ""route"": ""IV"", ""frequency"": ""Every 8 hours PRN for nausea"", ""duration"": ""Until nausea resolved""}, {""name"": ""Enoxaparin"", ""dose"": ""40 mg"", ""route"": ""Subcutaneous"", ""frequency"": ""Once daily"", ""duration"": ""3 days (DVT prophylaxis)""}], ""IV_fluids"": [{""type"": ""Ringer's Lactate"", ""volume_ml"": 1000, ""duration_hours"": 24}, {""type"": ""Normal Saline"", ""volume_ml"": 500, ""duration_hours"": 12}], ""procedures"": [{""name"": ""Laparoscopic Cholecystectomy"", ""date"": ""2026-05-01"", ""details"": ""Four‑port technique, operative time 75 minutes, minimal blood loss (<50 mL), intra‑operative cholangiogram negative for stones.""}]}"	"Dr. Priya Patel"	"{""medications"": [{""name"": ""Amoxicillin"", ""dose"": ""500 mg"", ""route"": ""Oral"", ""frequency"": ""BID"", ""duration"": ""Complete remaining 2 days""}, {""name"": ""Paracetamol"", ""dose"": ""1 g"", ""route"": ""Oral"", ""frequency"": ""Every 6–8 hours PRN"", ""max_per_day"": ""4 g""}], ""diet"": ""Low‑fat, soft diet for 3 days, then advance to regular balanced diet as tolerated."", ""activity"": ""Light activities and ambulation as tolerated; avoid heavy lifting >5 kg for 2 weeks."", ""red_flags"": [""Fever >100.4°F (38°C)"", ""Severe abdominal pain or increasing tenderness"", ""Persistent vomiting"", ""Yellowing of skin or eyes"", ""Swelling, redness, or pain in the legs""], ""follow_up"": ""Surgical OPD visit with Dr. Priya Patel on 2026‑05‑15 (approximately 2 weeks post‑op).""}"	"Laparoscopic cholecystectomy performed on 2026‑05‑01; uneventful, no intra‑operative complications, specimen sent for histopathology (report pending)."	"Hemodynamically stable, afebrile, tolerating oral intake, pain controlled with oral analgesics, wound clean and dry, no signs of infection."	"2026-09-23 13:38:44"	"2026-09-23 13:38:44"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87263	87263	87264	14	"2024-04-13 00:00:00"	"2026-09-29 11:30:38"	"Bronchial Asthma (Acute Exacerbation)"	"The patient, a 61‑year‑old female, presented on 13‑Apr‑2024 with worsening dyspnea, wheezing and chest tightness consistent with an acute asthma exacerbation. On arrival she was tachypneic with a respiratory rate of 22/min, SpO2 99% on room air, BP 153/92 mmHg and HR 95 bpm. She reported recent exposure to cold air and a viral upper‑respiratory infection. Initial management in the emergency department included high‑flow oxygen, nebulised short‑acting bronchodilators and systemic steroids. She was admitted for close monitoring, optimisation of inhaled therapy, and a short course of antibiotics for possible bacterial superinfection. Over the 4‑day inpatient stay her symptoms improved, wheeze resolved, and she was weaned off supplemental oxygen. She was educated on inhaler technique and trigger avoidance before discharge."	"Vitals on Admission: Temp 97.5°F, HR 95 bpm, BP 153/92 mmHg, SpO2 99.04%
Laboratory Findings: CBC (WBC_x10^9/L: 12.3, Neutrophils_%: 68, Lymphocytes_%: 22, Eosinophils_%: 5, Hemoglobin_g/dL: 13.2, Platelets_x10^9/L: 250); Renal (BUN_mg/dL: 18, Creatinine_mg/dL: 0.9); Liver (AST_U/L: 24, ALT_U/L: 28, ALP_U/L: 78); Electrolytes (Na_mEq/L: 138, K_mEq/L: 4.2, Cl_mEq/L: 102, Bicarbonate_mEq/L: 24)
ECG: Normal sinus rhythm, rate 95 bpm, no ischemic changes"	"Inpatient care and stabilization administered:
1. Administered: Salbutamol Nebulisation - Dosage: 2.5 mg - Route: Inhalation - Freq: q4h PRN
2. Administered: Ipratropium Bromide Nebulisation - Dosage: 0.5 mg - Route: Inhalation - Freq: q4h PRN
3. Administered: Prednisone - Dosage: 40 mg - Route: Oral - Freq: once daily
4. Administered: Amoxicillin - Dosage: 500 mg - Route: Oral - Freq: BID - Duration: 5 days
5. Administered: Formoterol/Budesonide Inhaler - Dosage: 12/200 µg - Route: Inhalation - Freq: twice daily
6. Administered: Amlodipine - Dosage: 5 mg - Route: Oral - Freq: once daily"	"Dr. Sneha Das"	"Follow-up in OPD as advised by attending physician."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented at discharge."	"2026-09-29 11:30:38"	"2026-09-29 11:30:38"	"Approved"	"openai/gpt-oss-120b"	"groq"
87268	87268	87269	14	"2026-01-08 00:00:00"	"2026-09-28 10:50:09"	"Acute Cerebrovascular Accident (Stroke)"	"The patient, Alanel Parthalan, a 54-year-old Other, was admitted via Emergency on 2026-01-08 presenting with Stroke. Clinical evaluation confirmed Acute Cerebrovascular Accident (Stroke). During the hospital stay of 260 days under Dr. Bharat Jain (Orthopedist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"MRI Brain with DWI: Acute ischemic infarct in left MCA territory; MR Angiography: Mild atheromatous narrowing of left ICA; Carotid Doppler: 35% stenosis at left carotid bifurcation; 2D Echo: Normal chambers, no intracardiac thrombus, EF 55%; Coagulation Profile: PT 12.8s, INR 1.05; Lipid Profile: LDL 148 mg/dL; Blood Sugar: Fasting 108 mg/dL. Vital Signs at Discharge: Temp: 97.7°F, HR: 63 bpm, BP: 136/95 mmHg, SpO2: 95.87%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Metoprolol Tartrate - Dosage: 500 mg - Route: IV - Freq: BD - Duration: 7 Days - (Take as directed by consultant)
2. Tab. Aspirin 150mg + Tab. Clopidogrel 75mg PO OD (Dual Antiplatelet Therapy)
3. Tab. Atorvastatin 40mg PO HS (Plaque stabilization)
4. Inj. Citicoline 500mg IV BD (Neuroprotection)
5. Inj. Pantoprazole 40mg IV OD
6. IV Infusion: 0.9% Normal Saline @ 60 ml/hr maintaining euvolemia
7. Physiotherapy, neuro-rehabilitation, and swallowing assessment."	"Dr. Bharat Jain"	"1. Tab. Aspirin 75mg - 1 tablet orally once daily after lunch.
2. Tab. Clopidogrel 75mg - 1 tablet orally once daily after breakfast for 90 days.
3. Tab. Atorvastatin 40mg - 1 tablet orally once daily at bedtime for 6 months.
4. Tab. Citicoline 500mg - 1 tablet orally twice daily after food for 30 days.
5. Tab. Telmisartan 40mg - 1 tablet orally once daily in the morning.
6. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 14 days.
7. Continue daily neuro-physiotherapy, limb mobility exercises, and speech exercises at home.
8. Strict blood pressure monitoring (target BP < 130/80 mmHg) and lipid control.
9. Low-salt (<2g/day), Mediterranean-style low-fat diet.
10. Neurology OPD Review in 7 days for neurological recovery and functional status evaluation.
11. Emergency Warning Signs: FAST protocol - seek immediate ER care if Facial droop, Arm weakness, Speech slurring, or sudden confusion re-occurs."	"Nil (Emergency Non-contrast CT Brain ruled out hemorrhage; patient managed in Neuro-ICU with antiplatelet therapy, neuroprotection, and blood pressure control)."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 97.7°F, HR: 63 bpm, BP: 136/95 mmHg, SpO2: 95.87%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Pending Approval"	"local-clinical-engine"	"local"
87272	87272	87273	14	"2026-03-14 00:00:00"	"2026-09-28 10:50:09"	"Acute Gastroenteritis"	"The patient, Poojaal Parthalan, a 16-year-old Other, was admitted via Referral on 2026-03-14 presenting with Gastroenteritis. Clinical evaluation confirmed Acute Gastroenteritis. During the hospital stay of 195 days under Dr. Bhavani Iyer (Surgeon), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Stool Routine & Microscopy: 4-6 Pus cells/hpf, no cysts or ova seen; Stool Culture: Sensitive to Ciprofloxacin and Azithromycin; Serum Electrolytes: Sodium 136 mEq/L, Potassium 3.9 mEq/L, Chloride 102 mEq/L (Corrected from admission dehydration); Renal Parameters: Serum Creatinine 0.8 mg/dL, Urea 24 mg/dL. Vital Signs at Discharge: Temp: 97.3°F, HR: 109 bpm, BP: 122/95 mmHg, SpO2: 96.71%."	"Inpatient care and stabilization administered:
1. Administered: Inj. Ondansetron - Dosage: 500 mg - Route: SC - Freq: BD - Duration: 30 Days - (Take as directed by consultant)
2. IV Fluids: Ringer's Lactate 1500ml + 0.9% Normal Saline 1000ml for acute rehydration
3. Inj. Ciprofloxacin 200mg (100ml) IV BD x 2 days
4. Inj. Pantoprazole 40mg IV OD"	"Dr. Bhavani Iyer"	"1. Tab. Ofloxacin 200mg + Ornidazole 500mg - 1 tablet orally twice daily after food for 5 days.
2. Sachet Racecadotril 100mg - 1 capsule orally thrice daily before food for 2 days if loose stools persist.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
4. Capsule Probiotic (Lactic Acid Bacillus + Zinc) - 1 capsule daily after food for 7 days.
5. ORS Sachet (WHO formula) - Dissolve 1 packet in 1 Liter clean boiled and cooled water; sip throughout the day.
6. Consume easily digestible bland soft diet (kanji, curd rice, banana, boiled potatoes, coconut water); avoid dairy milk, oily, and raw spicy foods for 5 days.
7. Drink plenty of boiled, purified water (>3 liters/day) and electrolyte fluids.
8. Maintain strict hand hygiene before eating and after using the restroom.
9. General Medicine Review in 5 days if loose stools or abdominal discomfort persists.
10. Emergency Warning Signs: Report to ER if high fever, severe persistent vomiting preventing oral intake, blood in stool, or profound dizziness develops."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 97.3°F, HR: 109 bpm, BP: 122/95 mmHg, SpO2: 96.71%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Pending Approval"	"local-clinical-engine"	"local"
87276	87276	87277	14	"2026-04-30 00:00:00"	"2026-09-28 11:09:20"	"Diabetic Ketoacidosis (DKA)"	"The patient, Lakshmial Parthalan, a 25-year-old Other, was admitted via Emergency on 2026-04-30 presenting with DKA. Clinical evaluation confirmed Diabetic Ketoacidosis (DKA). During the hospital stay of 148 days under Dr. Savita Verma (Pharmacologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Blood Glucose: Fasting 118 mg/dL, Postprandial 164 mg/dL (Admission Random Glucose was 384 mg/dL); HbA1c: 9.4%; Urine Ketones: Negative at discharge (Positive 3+ at admission); Serum Electrolytes: Sodium 138 mEq/L, Potassium 4.2 mEq/L, Bicarbonate 23 mEq/L, Anion Gap normalized (10 mEq/L); Renal Function: Urea 28 mg/dL, Serum Creatinine 0.85 mg/dL. Vital Signs at Discharge: Temp: 100.0°F, HR: 114 bpm, BP: 117/66 mmHg, SpO2: 90.74%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Amoxicillin + Clavulanate - Dosage: 500 mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take as directed by consultant)
2. IV Regular Human Insulin Infusion titrated via syringe pump with hourly blood glucose monitoring
3. IV Hydration: 0.9% Normal Saline 2000ml protocol for volume replenishment and ketone clearance
4. Inj. Potassium Chloride 20 mEq in 500ml NS infusion with cardiac monitoring
5. Inj. Pantoprazole 40mg IV OD."	"Dr. Savita Verma"	"1. Inj. Human Mixline (30/70) Insulin - 14 units Subcutaneous 15 mins before breakfast and 8 units before dinner.
2. Tab. Metformin 500mg - 1 tablet orally twice daily with meals.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
4. Tab. Multivitamin with Methylcobalamin - 1 tablet daily after lunch for 30 days.
5. Hypoglycemia Rescue: Keep glucose powder or fruit juice readily accessible.
6. Strict diabetic diet: High fiber, complex carbohydrates, low glycemic index, strictly zero refined sugars.
7. Maintain daily 3-point Self-Monitoring of Blood Glucose (SMBG) log (Fasting, Pre-lunch, Post-dinner).
8. Hypoglycemia Awareness: If feeling shaky, sweating, dizzy, or confused, immediately consume 3 teaspoons of sugar or 150ml fruit juice and recheck glucose in 15 mins.
9. Diabetic foot care: Inspect feet daily, wear comfortable soft footwear, avoid walking barefoot.
10. OPD Review in 10 days with Diabetology with 7-day blood glucose log chart."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 100.0°F, HR: 114 bpm, BP: 117/66 mmHg, SpO2: 90.74%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 11:09:20"	"2026-09-28 11:09:20"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87281	87281	87282	14	"2026-08-31 00:00:00"	"2026-09-28 11:09:21"	"Acute Abdominal Pain"	"The patient, Gitaal Parthalan, a 32-year-old Female, was admitted via Emergency on 2026-08-31 presenting with Abdominal Pain. Clinical evaluation confirmed Acute Abdominal Pain. During the hospital stay of 25 days under Dr. Gopal Rao (Orthopedist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Complete Blood Count (CBC) - Normal limits; Renal & Liver Function Tests - Within reference range; Serum Electrolytes within normal limits; Chest X-Ray / ECG - Sinus rhythm with normal cardiac and pulmonary status. Vital Signs at Discharge: Temp: 100.8°F, HR: 102 bpm, BP: 156/67 mmHg, SpO2: 90.69%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Clopidogrel - Dosage: 40 mg - Route: SC - Freq: OD - Duration: 30 Days - (Take as directed by consultant)
2. Inj. Pantoprazole 40mg IV OD x 2 days, transitioned to Oral Tab. 40mg
3. Tab. Paracetamol 650mg PO SOS for fever/body pain (max 3 times/day)
4. IV Fluids: Normal Saline 500ml @ 75ml/hr for initial hydration
5. Routine inpatient vital signs monitoring and nursing care."	"Dr. Gopal Rao"	"1. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
2. Tab. Paracetamol 650mg - 1 tablet orally as needed for pain/fever (max 3 tabs/day).
3. Tab. Multivitamin with Minerals - 1 capsule daily after dinner for 14 days.
4. Follow a balanced diet, adequate oral hydration (>2L/day), and avoid strenuous exertion for 5 days.
5. OPD Review in 7 days with Attending Physician for clinical follow-up.
6. Emergency Warning Signs: Seek immediate medical attention if persistent high fever (>101°F), acute chest pain, or shortness of breath occurs."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 100.8°F, HR: 102 bpm, BP: 156/67 mmHg, SpO2: 90.69%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 11:09:21"	"2026-09-28 11:09:21"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87286	87286	87287	14	"2024-09-04 00:00:00"	"2026-09-29 11:58:39"	"Diabetic Ketoacidosis (DKA)"	"Saanvial Parthalan, a 44‑year‑old female with known type 2 diabetes mellitus, presented on 2024‑09‑04 to the Emergency Department with a 2‑day history of polyuria, polydipsia, nausea, vomiting and generalized weakness. On arrival she was febrile (100.0°F), mildly tachypneic (respirations 22/min) and complained of abdominal discomfort. Initial finger‑stick glucose was 540 mg/dL. Venous blood gas showed pH 7.12, bicarbonate 12 mmol/L, anion gap 22 mmol/L. Urine dipstick was strongly positive for ketones. A diagnosis of DKA was made and she was admitted to the ICU for aggressive fluid resuscitation, insulin therapy and electrolyte replacement. Over the next 48 hours her glucose fell to <200 mg/dL, acidosis resolved (pH 7.36, bicarbonate 22 mmol/L), and serum potassium normalized. She tolerated transition from IV insulin to a basal‑bolus subcutaneous regimen, tolerated oral intake, and remained hemodynamically stable. She was transferred to the general ward on day 3 and discharged home on day 5 in good condition."	"Imaging: Chest X‑ray: Clear lung fields, no infiltrates or effusion.
ECG: Normal sinus rhythm, rate 60 bpm, no ischemic changes."	"Inpatient care and stabilization administered:
1. Administered: Regular Insulin (IV) - Dosage: 0.1 U/kg/hr - Route: Intravenous - Freq: Continuous infusion - Indication: DKA resolution
2. Administered: Potassium Chloride - Dosage: 20 mEq/L added to IV fluids - Route: Intravenous - Freq: Adjusted per serum K⁺ - Indication: Prevent hypokalemia
3. Administered: Paracetamol - Dosage: 500 mg - Route: Oral - Freq: Twice daily - Duration: 5 days - Indication: Fever & mild pain
4. Administered: Ondansetron - Dosage: 4 mg - Route: IV - Freq: Every 8 h PRN - Indication: Nausea/Vomiting"	"Dr. Ravi Reddy"	"1. Insulin Glargine - 20 U, Route: Subcutaneous, Freq: Once nightly
2. Insulin Lispro - 5 U, Route: Subcutaneous, Freq: Before each main meal
3. Metformin - 500 mg, Route: Oral, Freq: Twice daily with meals
4. Paracetamol - 500 mg, Route: Oral, Freq: Every 6 h PRN for fever/pain"	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented at discharge."	"2026-09-29 11:58:39"	"2026-09-29 11:58:39"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87288	87288	87289	81	"2025-04-03 12:00:00"	"2026-09-18 10:09:53"	"Acute Cerebrovascular Accident (Stroke)"	"The patient, Parial Parthalan, a 68-year-old Male, was admitted via Emergency on 2025-04-03 presenting with Stroke. Clinical evaluation confirmed Acute Cerebrovascular Accident (Stroke). During the hospital stay of 531 days under Dr. Vikram Singh (Pathologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"MRI Brain with DWI: Acute ischemic infarct in left MCA territory; MR Angiography: Mild atheromatous narrowing of left ICA; Carotid Doppler: 35% stenosis at left carotid bifurcation; 2D Echo: Normal chambers, no intracardiac thrombus, EF 55%; Coagulation Profile: PT 12.8s, INR 1.05; Lipid Profile: LDL 148 mg/dL; Blood Sugar: Fasting 108 mg/dL. Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Paracetamol - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Tab. Aspirin 150mg + Tab. Clopidogrel 75mg PO OD (Dual Antiplatelet Therapy)
3. Tab. Atorvastatin 40mg PO HS (Plaque stabilization)
4. Inj. Citicoline 500mg IV BD (Neuroprotection)
5. Inj. Pantoprazole 40mg IV OD
6. IV Infusion: 0.9% Normal Saline @ 60 ml/hr maintaining euvolemia
7. Physiotherapy, neuro-rehabilitation, and swallowing assessment."	"Dr. Vikram Singh"	"1. Tab. Aspirin 75mg - 1 tablet orally once daily after lunch.
2. Tab. Clopidogrel 75mg - 1 tablet orally once daily after breakfast for 90 days.
3. Tab. Atorvastatin 40mg - 1 tablet orally once daily at bedtime for 6 months.
4. Tab. Citicoline 500mg - 1 tablet orally twice daily after food for 30 days.
5. Tab. Telmisartan 40mg - 1 tablet orally once daily in the morning.
6. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 14 days.
7. Continue daily neuro-physiotherapy, limb mobility exercises, and speech exercises at home.
8. Strict blood pressure monitoring (target BP < 130/80 mmHg) and lipid control.
9. Low-salt (<2g/day), Mediterranean-style low-fat diet.
10. Neurology OPD Review in 7 days for neurological recovery and functional status evaluation.
11. Emergency Warning Signs: FAST protocol - seek immediate ER care if Facial droop, Arm weakness, Speech slurring, or sudden confusion re-occurs."	"Nil (Emergency Non-contrast CT Brain ruled out hemorrhage; patient managed in Neuro-ICU with antiplatelet therapy, neuroprotection, and blood pressure control)."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:53"	"2026-09-18 15:39:53"	"Pending Approval"	"Groq (openai/gpt-oss-20b)"	"groq"
87299	87299	87300	14	"2026-06-05 00:00:00"	"2026-09-28 11:09:21"	"Traumatic Bone Fracture"	"Mrs. Senthilya Parthalan, a 77‑year‑old female, presented to the Emergency Department on 2026‑06‑05 with severe left hip pain after a fall at home. On arrival she was febrile (100.9°F) with HR 99 bpm, BP 115/97 mmHg and SpO2 90.4%. Physical examination revealed a shortened, externally rotated left lower limb with marked tenderness over the groin. Initial radiographs demonstrated a displaced intracapsular fracture of the left femoral neck. Given her age and fracture pattern, she was admitted for operative management. Pre‑operative work‑up included CBC, renal and liver panels, electrolytes, coagulation profile, ECG and a CT scan of the pelvis to assess fracture displacement. She underwent an uncomplicated closed reduction and internal fixation (CRIF) with three cannulated screws under spinal anesthesia on hospital day 2. Post‑operatively she was monitored in the orthopaedic ward, received analgesia, prophylactic antibiotics, DVT prophylaxis and osteoporosis supplementation. She progressed to sitting on the edge of the bed on day 3, ambulated with a walker on day 5, and was discharged on day 7 in stable condition."	"Laboratory Findings: CBC (WBC_10^9/L: 11.2, Hb_g/dL: 11.8, Platelets_10^9/L: 210); Renal (BUN_mg/dL: 18, Creatinine_mg/dL: 0.9); Liver (AST_U/L: 22, ALT_U/L: 24, ALP_U/L: 78); Electrolytes (Na_mEq/L: 138, K_mEq/L: 4.2, Cl_mEq/L: 102); Coagulation (PT_sec: 12.4, INR: 1.0, aPTT_sec: 30)
Imaging & Diagnostics: Xray Left Hip: Displaced intracapsular fracture of femoral neck (Garden III).; Ct Pelvis: Confirmed fracture pattern, no acetabular involvement.
ECG: Normal sinus rhythm, no ischemic changes."	"Inpatient care and stabilization administered:
1. Administered: Paracetamol - Dosage: 1 g - Route: IV - Freq: q6h - Duration: 5 days
2. Administered: Morphine PCA - Dosage: 1 mg bolus - Route: IV - Freq: as needed - Duration: 48 h
3. Administered: Cefazolin - Dosage: 1 g - Route: IV - Freq: q8h - Duration: 24 h (pre‑op prophylaxis)
4. Administered: Enoxaparin - Dosage: 40 mg - Route: SC - Freq: once daily - Duration: 7 days
5. Administered: Calcium carbonate - Dosage: 500 mg - Route: PO - Freq: BID - Duration: 30 days
6. Administered: Vitamin D3 (cholecalciferol) - Dosage: 800 IU - Route: PO - Freq: once daily - Duration: 30 days
7. Administered: Doxofylline - Dosage: 100 mg - Route: SC - Freq: q6h - Duration: 30 days
8. Administered: Amlodipine - Dosage: 5 mg - Route: PO - Freq: once daily - Duration: ongoing
9. Administered: Lisinopril - Dosage: 10 mg - Route: PO - Freq: once daily - Duration: ongoing"	"Dr. Dev Sharma"	"1. Paracetamol - 500 mg, Route: PO, Freq: q6h PRN (Duration: as needed for pain)
2. Enoxaparin - 40 mg, Route: SC, Freq: once daily (Duration: 14 days total (5 days inpatient + 9 days outpatient))
3. Calcium carbonate - 500 mg, Route: PO, Freq: BID (Duration: 30 days)
4. Vitamin D3 - 800 IU, Route: PO, Freq: once daily (Duration: 30 days)
5. Doxofylline - 100 mg, Route: SC, Freq: q6h (Duration: 30 days)
6. Amlodipine - 5 mg, Route: PO, Freq: once daily (Duration: ongoing)
7. Lisinopril - 10 mg, Route: PO, Freq: once daily (Duration: ongoing)"	"Open Reduction and Internal Fixation (ORIF) / Tension Band Wiring of patellar fracture with rigid stabilization. Knee immobilizer splint applied. Intraoperative fluoroscopy confirmed anatomical reduction."	"Patient is hemodynamically stable, alert, conscious, and oriented at discharge."	"2026-09-28 11:09:21"	"2026-09-28 11:09:21"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87307	87307	87308	14	"2026-04-01 00:00:00"	"2026-09-28 11:09:26"	"Preterm Labor Complication"	"The patient, Siddharthya Parthalan, a 71-year-old Other, was admitted via Elective on 2026-04-01 presenting with Preterm Labor. Clinical evaluation confirmed Preterm Labor Complication. During the hospital stay of 177 days under Dr. Rahul Kumar (Intensivist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Neonatal Chest Radiograph: Reticulogranular pattern with air bronchograms, significantly cleared post-treatment; Capillary Blood Gas: pH 7.38, pCO2 40 mmHg, pO2 68 mmHg, HCO3 22 mEq/L, SpO2 97% on room air; Sepsis Screen: CRP 2.1 mg/L (Normal), Blood Culture: Sterile; Serum Bilirubin: 6.2 mg/dL (Physiological range). Vital Signs at Discharge: Temp: 97.2°F, HR: 84 bpm, BP: 132/86 mmHg, SpO2: 91.64%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Enalapril Maleate - Dosage: 100 mg - Route: IV - Freq: Q6H - Duration: 7 Days - (Take as directed by consultant)
2. Nasal Continuous Positive Airway Pressure (CPAP) supportive respiratory care with gentle weaning
3. Intratracheal Surfactant administration in NICU as per protocol
4. Inj. Ampicillin 50mg/kg/dose IV BD + Inj. Gentamicin 4mg/kg IV OD x 3 days
5. IV Fluids: 10% Dextrose infusion with electrolyte maintenance, transitioned to full breast milk feeds
6. Continuous neonatal cardio-respiratory and pulse oximetry monitoring in NICU."	"Dr. Rahul Kumar"	"1. Drops Vitamin D3 (400 IU/ml) - 1 ml (400 IU) orally once daily after morning feed for 1 year.
2. Drops Multivitamin & Iron supplement - 0.5 ml orally once daily after feeds.
3. Normal Saline Nasal Drops - 1 drop in each nostril before feeds if nasal congestion occurs.
4. Exclusive on-demand breastfeeding every 2-3 hours; ensure proper latching and burping after every feed.
5. Maintain thermal protection (Kangaroo Mother Care / warm clothing); avoid direct draft of fans or AC.
6. Strict hand hygiene before handling baby; keep away from sick individuals and smoke.
7. Pediatrics / Neonatology Review in 7 days for weight check, feeding assessment, and immunization.
8. Emergency Warning Signs: Bring baby immediately to hospital if chest in-drawing, grunting, fast breathing (>60/min), lethargy, poor feeding, or bluish discoloration occurs."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 97.2°F, HR: 84 bpm, BP: 132/86 mmHg, SpO2: 91.64%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 11:09:26"	"2026-09-28 11:09:26"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87313	87313	87314	81	"2025-12-24 12:00:00"	"2026-09-18 10:09:53"	"Bronchial Asthma (Acute Exacerbation)"	"The patient, Nishaya Parthalan, a 34-year-old Female, was admitted via Emergency on 2025-12-24 presenting with Asthma. Clinical evaluation confirmed Bronchial Asthma (Acute Exacerbation). During the hospital stay of 266 days under Dr. Sanjay Jain (Cardiologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Peak Expiratory Flow Rate (PEFR): Improved from 180 L/min to 410 L/min post-bronchodilator; Chest X-Ray (PA View): Bilateral lung hyperinflation, no consolidation or pneumothorax; Arterial Blood Gas (ABG): pH 7.42, pCO2 38 mmHg, pO2 88 mmHg, SpO2 97% on room air; Complete Blood Count: Absolute Eosinophil Count 450 cells/mcL; Normal renal/liver parameters. Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Nebulization: Duolin (Levosalbutamol 1.25mg + Ipratropium Bromide 500mcg in 2.5ml) q6h
3. Nebulization: Budecort (Budesonide 0.5mg respules) q12h
4. Inj. Hydrocortisone 100mg IV q8h x 2 days, tapered smoothly
5. Tab. Montelukast 10mg + Levocetirizine 5mg PO at bedtime
6. Oxygen therapy via nasal cannula @ 2-4 L/min titrated to maintain SpO2 > 95%
7. Chest physiotherapy and breathing exercises."	"Dr. Sanjay Jain"	"1. Inhaler Budesonide + Formoterol (200mcg / 6mcg) - 2 puffs twice daily with spacer x 30 days.
2. Inhaler Salbutamol 100mcg - 2 puffs SOS via spacer for acute wheezing/shortness of breath.
3. Tab. Montelukast 10mg - 1 tablet orally once daily at bedtime for 14 days.
4. Tab. Prednisolone 20mg - 1 tablet orally in the morning after breakfast for 3 days, then 10mg for 2 days, then stop.
5. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
6. Steam inhalation twice daily; strictly avoid exposure to dust, aerosol sprays, cold air, pet dander, and active/passive smoke.
7. Rinse mouth thoroughly with water after using steroid inhalers to prevent oral candidiasis.
8. Maintain adequate fluid intake (>2.5 liters of warm water daily).
9. OPD Review in 7 days with Pulmonology for repeat spirometry and inhaler technique review.
10. Emergency Warning Signs: Rush to ER if acute severe breathlessness, inability to speak full sentences, or blue lips/fingertips occur."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:53"	"2026-09-18 15:39:53"	"Pending Approval"	"Groq (openai/gpt-oss-20b)"	"groq"
87315	87315	87316	81	"2025-12-10 12:00:00"	"2026-09-18 10:09:54"	"Cholelithiasis (Gallstone Disease)"	"The patient, Rohitya Parthalan, a 71-year-old Female, was admitted via Emergency on 2025-12-10 presenting with Cholelithiasis. Clinical evaluation confirmed Cholelithiasis (Gallstone Disease). During the hospital stay of 280 days under Dr. Priya Patel (Pediatrician), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Ultrasound Abdomen: Calculus of gallbladder with thickened gallbladder wall (4.2 mm) and pericholecystic fluid, resolving post-op; Liver Function Tests: Total Bilirubin 1.1 mg/dL, Direct Bilirubin 0.3 mg/dL, SGOT/AST 34 U/L, SGPT/ALT 38 U/L, Alkaline Phosphatase 112 U/L; CBC: WBC count 8,200/mcL (down from 14,500/mcL at admission); Serum Amylase & Lipase normal. Vital Signs at Discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%."	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Inj. Cefoperazone 1g + Sulbactam 500mg (1.5g) IV BD x 3 days
3. Inj. Metronidazole 500mg (100ml) IV Infusion q8h x 3 days
4. Inj. Tramadol 50mg in 100ml Normal Saline IV infusion SOS for post-op colic/pain
5. Inj. Pantoprazole 40mg IV OD
6. Inj. Ondansetron 4mg IV BD for antiemetic coverage
7. IV Fluids: Ringer's Lactate 1000ml + 5% Dextrose Normal Saline 500ml @ 80 ml/hr post-op."	"Dr. Priya Patel"	"1. Tab. Cefixime 200mg - 1 tablet orally twice daily after food for 5 days.
2. Tab. Aceclofenac 100mg + Paracetamol 325mg - 1 tablet orally twice daily after food for 3 days as needed.
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
4. Tab. Drotaverine 80mg - 1 tablet orally SOS for spasmodic abdominal pain.
5. Syp. Lactulose 15ml orally at bedtime for 3 days if constipation occurs.
6. Strict low-fat, non-greasy, easily digestible soft diet; avoid deep-fried foods, butter, and heavy spices for 3 weeks.
7. Keep surgical port-site dressing clean and dry. Avoid bathing directly over incision sites until suture check.
8. Avoid strenuous abdominal strain, heavy lifting (>5 kg), or intense exercises for 4 weeks.
9. Surgical OPD Review in 7 days for port-site incision inspection and suture/staple check.
10. Emergency Warning Signs: Report immediately if persistent fever > 101°F, worsening abdominal pain, persistent vomiting, or yellowing of eyes (jaundice) develops."	"Laparoscopic Cholecystectomy performed under General Anesthesia. Gallbladder with multiple calculi dissected and removed intact. Hemostasis achieved. Subhepatic drain placed and removed prior to discharge."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 72 bpm, BP: 120/78 mmHg, SpO2: 98.8%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-18 10:09:54"	"2026-09-18 15:39:54"	"Pending Approval"	"Groq (openai/gpt-oss-20b)"	"groq"
87316	87316	87317	14	"2026-07-15 00:00:00"	"2026-09-29 12:15:20"	"Diabetic Ketoacidosis (DKA)"	"Saanviya Parthalan, an 83‑year‑old female with known type 2 diabetes mellitus, presented on 2026‑07-15 with polyuria, polydipsia, nausea, and vomiting for 2 days. On arrival she was alert, afebrile, with vitals: Temp 98.6°F, HR 72 bpm, BP 120/80 mmHg, SpO2 98.5%. Laboratory workup revealed hyperglycemia (glucose 540 mg/dL), metabolic acidosis (pH 7.12, HCO3‑ 12 mEq/L), serum bicarbonate <15, anion gap >20, and positive serum/urine ketones. Serum electrolytes showed Na 132 mEq/L, K 5.2 mEq/L, Cl 98 mEq/L, creatinine 1.6 mg/dL (baseline 1.0 mg/dL). The patient was diagnosed with DKA secondary to infection (urinary tract infection confirmed on urinalysis). She was admitted to the high‑dependency unit for aggressive fluid resuscitation, insulin therapy, electrolyte replacement, and treatment of the underlying infection. Over the next 48 hours, anion gap closed, glucose normalized, and renal function returned toward baseline. She was transitioned from IV insulin to a basal‑bolus subcutaneous regimen and educated on sick‑day rules. No surgical interventions were required."	"ECG: Sinus rhythm, normal intervals, no hyper‑K changes"	"Inpatient care and stabilization administered:
1. Administered: {'IV_fluids': ['0.9% Normal Saline 1 L bolus over 1 hour, then 250 mL/hr maintenance adjusted for urine output', '5% Dextrose in 0.45% NaCl added when glucose <250 mg/dL'], 'insulin': ['Regular insulin IV bolus 0.1 unit/kg (6 units) then continuous infusion 0.1 unit/kg/hr, titrated to maintain glucose 150‑200 mg/dL', 'Transition to subcutaneous insulin on hospital day 3: Glargine 12 units nightly + Lispro 4 units before meals'], 'electrolyte_management': ['Potassium replacement IV 20 mEq/L of fluid until K >4.0 mEq/L, then oral KCl 20 mEq TID as needed'], 'antibiotics': ['Ceftriaxone 1 g IV q24h for presumed urinary tract infection, completed 7 days'], 'other_medications': ['Paracetamol 500 mg PO BID after food for analgesia (5 days total)', 'Multivitamin PO daily'], 'monitoring': ['Hourly glucose checks, serum electrolytes q4‑6h until stable', 'Strict input/output charting, target urine output >0.5 mL/kg/hr']}"	"Dr. Ravi Reddy"	"1. Insulin Glargine 12 units subcutaneously at bedtime
2. Insulin Lispro 4 units subcutaneously before each main meal (adjust based on glucose monitoring)
3. Metformin 500 mg PO BID with meals (if renal function remains stable)
4. Cefdinir 300 mg PO BID for 5 more days (to complete 7‑day course)
5. Paracetamol 500 mg PO BID PRN for pain/fever
6. Light ambulation as tolerated; avoid strenuous activity for 1 week; gradual increase as strength improves.
7. Persistent vomiting or inability to keep fluids down
8. Polyuria >3 L/day, polydipsia, or thirst
9. Blood glucose >250 mg/dL on two consecutive readings
10. Fever >100.4°F (38°C) or chills
11. Chest pain, shortness of breath, or palpitations
12. Outpatient Diabetes Clinic with Dr. Ravi Reddy on 2026‑08‑05; repeat basic metabolic panel and HbA1c in 2 weeks; urology follow‑up if urinary symptoms recur."	"Nil"	"Hemodynamically stable, afebrile, normotensive, heart rate 68 bpm, oxygen saturation 98% on room air. Metabolic parameters normalized, anion gap closed, renal function returned to baseline. Patient alert, oriented, and able to ambulate with assistance. Discharged in stable condition."	"2026-09-29 12:15:20"	"2026-09-29 12:15:20"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87317	87317	87318	14	"2026-01-16 00:00:00"	"2026-09-29 11:56:53"	"Preterm Labor Complication"	"The patient, a 61‑year‑old female, presented on 2026‑01‑16 with complaints of regular uterine contractions and mild lower abdominal discomfort. On examination she was afebrile, with a blood pressure of 153/62 mmHg and heart rate 93 bpm. Obstetric ultrasound confirmed a singleton pregnancy at 28 weeks gestation with a cervical length of 2.5 cm and a reassuring biophysical profile. Given the gestational age and active contractions, a diagnosis of preterm labor complication was made. The patient was admitted to the obstetric high‑dependency unit for tocolysis, fetal lung maturation, and maternal blood pressure control. She received a loading dose of magnesium sulfate, nifedipine for uterine relaxation, betamethasone for fetal lung maturity, and a course of oral amoxicillin for prophylaxis. Blood pressure was managed with labetalol. Over the next 48 hours uterine activity subsided, cervical status remained unchanged, and fetal monitoring remained reassuring. The patient remained hemodynamically stable throughout the stay and was discharged after 5 days of observation with a plan for close outpatient follow‑up."	"Vitals on Admission: Temp 99.5°F, HR 93 bpm, BP 153/62 mmHg
Laboratory Findings: CBC (hemoglobin_g_dL: 12.5, wbc_x10^9_per_L: 8.2, platelets_x10^9_per_L: 250); Renal (bun_mg_dL: 14, creatinine_mg_dL: 0.9); Liver (ast_U_L: 22, alt_U_L: 18)"	"Inpatient care and stabilization administered as per protocol."	"Dr. Anjali Iyer"	"Follow-up in OPD as advised by attending physician."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented at discharge."	"2026-09-29 11:56:53"	"2026-09-29 11:56:53"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87327	87327	87328	13	"2026-08-24 12:00:00"	"2026-09-23 10:47:06"	"Preterm Labor Complication"	"The patient, Victorya Parthalan, a 21-year-old Female, was admitted via Emergency on 2026-08-24 presenting with Preterm Labor. Clinical evaluation confirmed Preterm Labor Complication. During the hospital stay of 23 days under Dr. Meenakshi Gupta (Orthopedist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Neonatal Chest Radiograph: Reticulogranular pattern with air bronchograms, significantly cleared post-treatment; Capillary Blood Gas: pH 7.38, pCO2 40 mmHg, pO2 68 mmHg, HCO3 22 mEq/L, SpO2 97% on room air; Sepsis Screen: CRP 2.1 mg/L (Normal), Blood Culture: Sterile; Serum Bilirubin: 6.2 mg/dL (Physiological range). Vital Signs at Discharge: Temp: 99.4°F, HR: 84 bpm, BP: 133/86 mmHg, SpO2: 95.35%."	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take after food)
2. Administered: Nasal Continuous Positive Airway Pressure (CPAP) supportive respiratory care with gentle weaning
3. Administered: Intratracheal Surfactant administration in NICU as per protocol
4. Administered: Inj. Ampicillin 50mg/kg/dose IV BD + Inj. Gentamicin 4mg/kg IV OD x 3 days
5. Administered: IV Fluids: 10% Dextrose infusion with electrolyte maintenance, transitioned to full breast milk feeds
6. Administered: Continuous neonatal cardio-respiratory and pulse oximetry monitoring in NICU."	"Dr. Meenakshi Gupta"	"1. Drops Vitamin D3 (400 IU/ml) - 1 ml (400 IU) orally once daily after morning feed for 1 year.
2. Drops Multivitamin & Iron supplement - 0.5 ml orally once daily after feeds.
3. Normal Saline Nasal Drops - 1 drop in each nostril before feeds if nasal congestion occurs.
4. Exclusive on-demand breastfeeding every 2-3 hours; ensure proper latching and burping after every feed.
5. Maintain thermal protection (Kangaroo Mother Care / warm clothing); avoid direct draft of fans or AC.
6. Strict hand hygiene before handling baby; keep away from sick individuals and smoke.
7. Pediatrics / Neonatology Review in 7 days for weight check, feeding assessment, and immunization.
8. Emergency Warning Signs: Bring baby immediately to hospital if chest in-drawing, grunting, fast breathing (>60/min), lethargy, poor feeding, or bluish discoloration occurs."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 99.4°F, HR: 84 bpm, BP: 133/86 mmHg, SpO2: 95.35%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-23 10:47:06"	"2026-09-23 10:47:06"	"Pending Approval"	"Groq (openai/gpt-oss-120b)"	"groq"
87332	87332	87333	3	"2025-12-24 00:00:00"	"2026-09-23 13:38:53"	"Acute Gastroenteritis"	"71‑year‑old female presented on 2025‑12‑24 with 2‑day history of watery diarrhea (~8 stools/day), nausea, occasional vomiting, low‑grade fever (100.1°F) and mild abdominal cramping. On exam she was mildly dehydrated (dry mucous membranes, decreased skin turgor) but alert. Vitals: HR 62 bpm, BP 133/80 mmHg, SpO2 93%, Temp 100.1°F. She was admitted for volume resuscitation, electrolyte monitoring and symptomatic care. Initial labs showed mild leukocytosis (WBC 11.2 ×10⁹/L), Hb 12.8 g/dL, Na 132 mmol/L, K 3.8 mmol/L, creatinine 1.1 mg/dL. Stool PCR was sent and later returned negative for bacterial pathogens; viral etiology presumed. She received IV normal saline bolus followed by maintenance fluids, ondansetron for nausea, and paracetamol for fever/pain. Oral rehydration solution was introduced once vomiting subsided. Diarrhea decreased to <2 stools/day by day 3, vitals normalized, and she tolerated a soft diet. She was discharged on day 5 in stable condition."	"CBC: WBC 11.2 ×10⁹/L, Hb 12.8 g/dL, Platelets 210 ×10⁹/L; Electrolytes: Na 132 mmol/L, K 3.8 mmol/L, Cl 98 mmol/L, HCO₃⁻ 22 mmol/L; Renal: Creatinine 1.1 mg/dL, BUN 14 mg/dL; Liver: AST 22 U/L, ALT 25 U/L, ALP 78 U/L, Bilirubin total 0.8 mg/dL; CRP 12 mg/L; Stool PCR panel negative for bacterial pathogens; Urinalysis normal; ECG sinus rhythm, no ischemia; Chest X‑ray clear."	"IV Fluids: 0.9% Normal Saline 1000 mL bolus over 1 h, then 125 mL/hr maintenance for 48 h; Oral Rehydration Solution 500 mL q6h as tolerated; Medications: Paracetamol 500 mg PO BID after food for 5 days (as ordered), Ondansetron 4 mg PO q8h PRN nausea, Zinc sulfate 20 mg PO daily for 7 days, Probiotic (Lactobacillus rhamnosus GG) 1 ×10⁹ CFU PO daily for 5 days."	"Dr. Anjali Iyer"	"Medications: Continue Paracetamol 500 mg PO BID after meals for 3 more days if needed for fever/pain; Zinc 20 mg PO daily for 7 days; Probiotic daily for 5 days. Diet: Start with clear fluids progressing to BRAT diet (Bananas, Rice, Applesauce, Toast) then regular soft diet as tolerated; avoid dairy, caffeine, spicy and fatty foods for 48h. Activity: Light activity, avoid strenuous exertion for 2 days. Hydration: Continue oral rehydration solution 500 mL every 6 h for 2 days, then increase water intake to ≥2 L/day. Red‑flag signs: Persistent vomiting, >3 watery stools in 24 h, blood/mucus in stool, fever >38.5°C, dizziness, decreased urine output, worsening abdominal pain. Follow‑up: Return to OPD Gastroenterology clinic in 3 days (2025‑12‑30) or sooner if red‑flag symptoms develop."	"Nil"	"Hemodynamically stable, afebrile, tolerating oral diet, no active vomiting or diarrhea, electrolytes normalized."	"2026-09-23 13:38:53"	"2026-09-23 13:38:53"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87333	87333	87334	14	"2026-08-24 00:00:00"	"2026-09-28 11:09:25"	"Bronchial Asthma (Acute Exacerbation)"	"The patient, Anandia Parthalan, a 23-year-old Other, was admitted via Referral on 2026-08-24 presenting with Asthma. Clinical evaluation confirmed Bronchial Asthma (Acute Exacerbation). During the hospital stay of 32 days under Dr. Deepak Singh (Intensivist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Peak Expiratory Flow Rate (PEFR): Improved from 180 L/min to 410 L/min post-bronchodilator; Chest X-Ray (PA View): Bilateral lung hyperinflation, no consolidation or pneumothorax; Arterial Blood Gas (ABG): pH 7.42, pCO2 38 mmHg, pO2 88 mmHg, SpO2 97% on room air; Complete Blood Count: Absolute Eosinophil Count 450 cells/mcL; Normal renal/liver parameters. Vital Signs at Discharge: Temp: 99.3°F, HR: 66 bpm, BP: 128/81 mmHg, SpO2: 91.38%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Digoxin - Dosage: 40 mg - Route: Oral - Freq: OD - Duration: 5 Days - (Take as directed by consultant)
2. Nebulization: Duolin (Levosalbutamol 1.25mg + Ipratropium Bromide 500mcg in 2.5ml) q6h
3. Nebulization: Budecort (Budesonide 0.5mg respules) q12h
4. Inj. Hydrocortisone 100mg IV q8h x 2 days, tapered smoothly
5. Tab. Montelukast 10mg + Levocetirizine 5mg PO at bedtime
6. Oxygen therapy via nasal cannula @ 2-4 L/min titrated to maintain SpO2 > 95%
7. Chest physiotherapy and breathing exercises."	"Dr. Deepak Singh"	"1. Inhaler Budesonide + Formoterol (200mcg / 6mcg) - 2 puffs twice daily with spacer x 30 days.
2. Inhaler Salbutamol 100mcg - 2 puffs SOS via spacer for acute wheezing/shortness of breath.
3. Tab. Montelukast 10mg - 1 tablet orally once daily at bedtime for 14 days.
4. Tab. Prednisolone 20mg - 1 tablet orally in the morning after breakfast for 3 days, then 10mg for 2 days, then stop.
5. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
6. Steam inhalation twice daily; strictly avoid exposure to dust, aerosol sprays, cold air, pet dander, and active/passive smoke.
7. Rinse mouth thoroughly with water after using steroid inhalers to prevent oral candidiasis.
8. Maintain adequate fluid intake (>2.5 liters of warm water daily).
9. OPD Review in 7 days with Pulmonology for repeat spirometry and inhaler technique review.
10. Emergency Warning Signs: Rush to ER if acute severe breathlessness, inability to speak full sentences, or blue lips/fingertips occur."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 99.3°F, HR: 66 bpm, BP: 128/81 mmHg, SpO2: 91.38%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 11:09:25"	"2026-09-28 11:09:25"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87360	87360	87361	61	"2024-09-21 00:00:00"	"2026-09-25 11:12:42"	"Acute Febrile Illness (High Fever)"	"The patient, Murugan Ranganlan, a 51-year-old Female, was admitted via Emergency on 2024-09-21 presenting with High Fever. Clinical evaluation confirmed Acute Febrile Illness (High Fever). During the hospital stay of 734 days under Dr. Ishita Patel (Pathologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Complete Blood Count (CBC): Hb 12.6 g/dL, Total WBC 5,200/mcL, Platelet count 1.95 lakhs/mcL; Dengue NS1 Antigen & IgM: Negative; Malaria QBC & Smear: Negative for plasmodium species; Widal & Typhidot: Negative; Blood & Urine Cultures: Sterile after 48 hours incubation; Serum Electrolytes & Renal/Liver function tests within normal limits; Chest X-Ray: Clear lung fields. Vital Signs at Discharge: Temp: 98.9°F, HR: 94 bpm, BP: 139/76 mmHg, SpO2: 93.37%."	"Inpatient care and stabilization administered:
1. Administered: Inj. Cefuroxime - Dosage: 500 mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take as directed by consultant)
2. Inj. Ceftriaxone 1g IV BD x 3 days
3. Inj. Paracetamol 1000mg IV infusion SOS for temperature spikes > 100.5°F
4. Inj. Pantoprazole 40mg IV OD
5. IV Fluids: 0.9% Normal Saline 1000ml/day maintenance hydration
6. Tepid sponging and continuous vital signs monitoring every 4 hours."	"Dr. Ishita Patel"	"1. Tab. Cefixime 200mg - 1 tablet orally twice daily after food for 5 days.
2. Tab. Paracetamol 650mg - 1 tablet orally SOS for fever/headache/body pain (maximum 3 tablets in 24 hours).
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
4. Tab. Vitamin C 500mg + Zinc - 1 tablet daily after food for 14 days.
5. Drink plenty of fluids (>3 liters/day of boiled water, tender coconut water, homemade soups).
6. Adequate bed rest; avoid physical exhaustion for 5-7 days.
7. Monitor body temperature twice daily and maintain a fever log.
8. General Medicine OPD Review in 5 days for follow-up clinical examination and CBC check.
9. Emergency Warning Signs: Seek immediate care if high fever (>102°F) returns, severe rash, breathing difficulty, or persistent vomiting develops."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.9°F, HR: 94 bpm, BP: 139/76 mmHg, SpO2: 93.37%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-25 11:12:42"	"2026-09-25 11:12:42"	"Pending Approval"	"local-clinical-engine"	"local"
87369	87369	87370	14	"2025-09-23 00:00:00"	"2026-09-28 11:09:25"	"Traumatic Bone Fracture"	"The patient, Aarav Ranganlan, a 66-year-old Male, was admitted via Elective on 2025-09-23 presenting with Fracture. Clinical evaluation confirmed Traumatic Bone Fracture. During the hospital stay of 367 days under Dr. Aniket Bose (Gynecologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Post-operative X-Ray (AP & Lateral): Anatomical reduction of patellar fracture fragments with stable tension band wiring constructs in situ; CBC: Hemoglobin 12.2 g/dL, Platelets 2.8 lakhs/mcL, WBC 7,800/mcL; Serum Calcium: 9.4 mg/dL, Serum Vitamin D3: 22.4 ng/mL. Vital Signs at Discharge: Temp: 99.2°F, HR: 114 bpm, BP: 125/67 mmHg, SpO2: 90.41%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Metformin HCl - Dosage: 40 mg - Route: Oral - Freq: OD - Duration: 5 Days - (Take as directed by consultant)
2. Inj. Cefuroxime 1.5g IV BD x 2 days post-op (Prophylactic antibiotic)
3. Inj. Tramadol 50mg IV in 100ml NS BD for post-operative analgesia
4. Inj. Paracetamol 1000mg IV infusion q8h SOS
5. Inj. Pantoprazole 40mg IV OD
6. Lower limb elevation, ice pack application, and deep vein thrombosis prophylaxis with active ankle pumps."	"Dr. Aniket Bose"	"1. Tab. Cefuroxime Axetil 500mg - 1 tablet orally twice daily after meals for 5 days.
2. Tab. Aceclofenac 100mg + Paracetamol 325mg - 1 tablet orally twice daily after food for 5 days as needed for pain.
3. Tab. Trypsin-Chymotrypsin (Chymoral Forte) - 1 tablet orally thrice daily half hour before food for 5 days (anti-inflammatory).
4. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
5. Tab. Calcium Carbonate 500mg + Vitamin D3 400IU - 1 tablet orally daily after dinner for 30 days.
6. Strictly wear the knee immobilizer splint when standing or moving; non-weight bearing on operated leg using walker/crutches as instructed.
7. Keep operated leg elevated on 2 pillows while lying down to minimize swelling.
8. Perform active ankle pump exercises and static quadriceps contractions 10 times every 2 hours.
9. Keep surgical wound dressing clean and dry; do not wet the bandage.
10. Orthopedic OPD Review in 10-12 days for wound inspection and suture removal.
11. Emergency Warning Signs: Report immediately if severe calf pain/swelling, severe coldness in toes, foul discharge, or high fever occurs."	"Open Reduction and Internal Fixation (ORIF) / Tension Band Wiring of patellar fracture with rigid stabilization. Knee immobilizer splint applied. Intraoperative fluoroscopy confirmed anatomical reduction."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 99.2°F, HR: 114 bpm, BP: 125/67 mmHg, SpO2: 90.41%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 11:09:25"	"2026-09-28 11:09:25"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87387	87387	87388	14	"2026-07-31 00:00:00"	"2026-09-28 11:09:26"	"Preterm Labor Complication"	"The patient, Victor Ranganlan, a 71-year-old Other, was admitted via Elective on 2026-07-31 presenting with Preterm Labor. Clinical evaluation confirmed Preterm Labor Complication. During the hospital stay of 56 days under Dr. Himani Gupta (Pharmacologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Neonatal Chest Radiograph: Reticulogranular pattern with air bronchograms, significantly cleared post-treatment; Capillary Blood Gas: pH 7.38, pCO2 40 mmHg, pO2 68 mmHg, HCO3 22 mEq/L, SpO2 97% on room air; Sepsis Screen: CRP 2.1 mg/L (Normal), Blood Culture: Sterile; Serum Bilirubin: 6.2 mg/dL (Physiological range). Vital Signs at Discharge: Temp: 100.7°F, HR: 114 bpm, BP: 105/76 mmHg, SpO2: 93.11%."	"Inpatient care and stabilization administered:
1. Administered: Inj. Paracetamol IV - Dosage: 100 mg - Route: Oral - Freq: Q6H - Duration: 5 Days - (Take as directed by consultant)
2. Nasal Continuous Positive Airway Pressure (CPAP) supportive respiratory care with gentle weaning
3. Intratracheal Surfactant administration in NICU as per protocol
4. Inj. Ampicillin 50mg/kg/dose IV BD + Inj. Gentamicin 4mg/kg IV OD x 3 days
5. IV Fluids: 10% Dextrose infusion with electrolyte maintenance, transitioned to full breast milk feeds
6. Continuous neonatal cardio-respiratory and pulse oximetry monitoring in NICU."	"Dr. Himani Gupta"	"1. Drops Vitamin D3 (400 IU/ml) - 1 ml (400 IU) orally once daily after morning feed for 1 year.
2. Drops Multivitamin & Iron supplement - 0.5 ml orally once daily after feeds.
3. Normal Saline Nasal Drops - 1 drop in each nostril before feeds if nasal congestion occurs.
4. Exclusive on-demand breastfeeding every 2-3 hours; ensure proper latching and burping after every feed.
5. Maintain thermal protection (Kangaroo Mother Care / warm clothing); avoid direct draft of fans or AC.
6. Strict hand hygiene before handling baby; keep away from sick individuals and smoke.
7. Pediatrics / Neonatology Review in 7 days for weight check, feeding assessment, and immunization.
8. Emergency Warning Signs: Bring baby immediately to hospital if chest in-drawing, grunting, fast breathing (>60/min), lethargy, poor feeding, or bluish discoloration occurs."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 100.7°F, HR: 114 bpm, BP: 105/76 mmHg, SpO2: 93.11%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 11:09:26"	"2026-09-28 11:09:26"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87400	87400	87401	14	"2026-03-19 00:00:00"	"2026-09-28 10:50:09"	"Acute Febrile Illness (High Fever)"	"The patient, Rahula Ranganlan, a 45-year-old Male, was admitted via Emergency on 2026-03-19 presenting with High Fever. Clinical evaluation confirmed Acute Febrile Illness (High Fever). During the hospital stay of 190 days under Dr. Archana Pillai (Pharmacologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Complete Blood Count (CBC): Hb 12.6 g/dL, Total WBC 5,200/mcL, Platelet count 1.95 lakhs/mcL; Dengue NS1 Antigen & IgM: Negative; Malaria QBC & Smear: Negative for plasmodium species; Widal & Typhidot: Negative; Blood & Urine Cultures: Sterile after 48 hours incubation; Serum Electrolytes & Renal/Liver function tests within normal limits; Chest X-Ray: Clear lung fields. Vital Signs at Discharge: Temp: 98.1°F, HR: 79 bpm, BP: 153/91 mmHg, SpO2: 98.99%."	"Inpatient care and stabilization administered:
1. Administered: Inj. Diclofenac Sodium - Dosage: 500 mg - Route: IV - Freq: BD - Duration: 7 Days - (Take as directed by consultant)
2. Inj. Ceftriaxone 1g IV BD x 3 days
3. Inj. Paracetamol 1000mg IV infusion SOS for temperature spikes > 100.5°F
4. Inj. Pantoprazole 40mg IV OD
5. IV Fluids: 0.9% Normal Saline 1000ml/day maintenance hydration
6. Tepid sponging and continuous vital signs monitoring every 4 hours."	"Dr. Archana Pillai"	"1. Tab. Cefixime 200mg - 1 tablet orally twice daily after food for 5 days.
2. Tab. Paracetamol 650mg - 1 tablet orally SOS for fever/headache/body pain (maximum 3 tablets in 24 hours).
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
4. Tab. Vitamin C 500mg + Zinc - 1 tablet daily after food for 14 days.
5. Drink plenty of fluids (>3 liters/day of boiled water, tender coconut water, homemade soups).
6. Adequate bed rest; avoid physical exhaustion for 5-7 days.
7. Monitor body temperature twice daily and maintain a fever log.
8. General Medicine OPD Review in 5 days for follow-up clinical examination and CBC check.
9. Emergency Warning Signs: Seek immediate care if high fever (>102°F) returns, severe rash, breathing difficulty, or persistent vomiting develops."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.1°F, HR: 79 bpm, BP: 153/91 mmHg, SpO2: 98.99%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Pending Approval"	"local-clinical-engine"	"local"
87407	87407	87408	3	"2026-05-25 12:00:00"	"2026-09-23 10:46:57"	"Preterm Labor Complication"	"Adityaa Ranganlan, a 73‑year‑old male, was admitted on 2026‑05‑25 with a fever of 100.9°F, mild tachypnea and a blood pressure of 130/93 mmHg. The admission note listed a working diagnosis of preterm labor complication, which was re‑evaluated by the multidisciplinary team. Initial assessment focused on ruling out infection and any obstetric‑related pathology. The patient was started on empirical oral amoxicillin 500 mg twice daily and supportive intravenous fluids. Over the next 48 hours his temperature normalized, vital signs stabilized, and laboratory parameters improved. No obstetric or neurologic emergencies were identified. He remained clinically stable throughout the stay and was deemed fit for discharge after completing five days of antibiotic therapy."	"Vitals on Admission: Temp 100.9°F, HR 87 bpm, BP 130/93 mmHg
Laboratory Findings: CBC (wbc_10e9_per_l: 12.3, hemoglobin_g_dl: 13.5, platelets_10e9_per_l: 250); Renal (creatinine_mg_dl: 1.0, bun_mg_dl: 14); Liver (ast_u_l: 22, alt_u_l: 24, alk_phos_u_l: 78); Electrolytes (sodium_mmol_l: 138, potassium_mmol_l: 4.2, chloride_mmol_l: 102, bicarbonate_mmol_l: 24); Inflammatory Markers (crp_mg_l: 18, esr_mm_hr: 30)"	"Inpatient care and stabilization administered:
1. Administered: Amoxicillin - Dosage: 500 mg - Route: Oral - Freq: BID
2. Administered: Paracetamol - Dosage: 500 mg - Route: Oral - Freq: Every 6 hours PRN for fever"	"Dr. Anjali Iyer"	"1. Amoxicillin - 500 mg, Route: Oral, Freq: BID (Duration: Complete the 5‑day course)
2. Paracetamol - 500 mg, Route: Oral, Freq: Every 6 hrs PRN for fever or pain (Duration: As needed)
3. Light activity as tolerated; avoid heavy lifting or strenuous exercise for 1 week.
4. Fever > 101°F (38.3°C) persisting > 24 hrs
5. New chest pain or shortness of breath
6. Sudden worsening abdominal pain
7. Bleeding or unexpected bruising
8. clinic: General Medicine OPD, date: 2026-06-05, time: 09:30 AM
9. clinic: Obstetrics/ Gynecology OPD (if applicable), date: 2026-06-07, time: 10:00 AM"	"Nil"	"Hemodynamically stable, afebrile, oxygen saturation 96% on room air, mild residual fatigue but otherwise well."	"2026-09-23 10:46:57"	"2026-09-23 10:46:57"	"Pending Approval"	"Groq (openai/gpt-oss-120b)"	"groq"
87410	87410	87411	14	"2026-01-06 00:00:00"	"2026-09-28 10:50:09"	"Acute Febrile Illness (High Fever)"	"The patient, Novaa Ranganlan, a 39-year-old Female, was admitted via Emergency on 2026-01-06 presenting with High Fever. Clinical evaluation confirmed Acute Febrile Illness (High Fever). During the hospital stay of 262 days under Dr. Kishore Menon (ER Physician), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Complete Blood Count (CBC): Hb 12.6 g/dL, Total WBC 5,200/mcL, Platelet count 1.95 lakhs/mcL; Dengue NS1 Antigen & IgM: Negative; Malaria QBC & Smear: Negative for plasmodium species; Widal & Typhidot: Negative; Blood & Urine Cultures: Sterile after 48 hours incubation; Serum Electrolytes & Renal/Liver function tests within normal limits; Chest X-Ray: Clear lung fields. Vital Signs at Discharge: Temp: 99.2°F, HR: 105 bpm, BP: 131/75 mmHg, SpO2: 99.83%."	"Inpatient care and stabilization administered:
1. Administered: Inj. Furosemide - Dosage: 1 g - Route: SC - Freq: TDS - Duration: 30 Days - (Take as directed by consultant)
2. Inj. Ceftriaxone 1g IV BD x 3 days
3. Inj. Paracetamol 1000mg IV infusion SOS for temperature spikes > 100.5°F
4. Inj. Pantoprazole 40mg IV OD
5. IV Fluids: 0.9% Normal Saline 1000ml/day maintenance hydration
6. Tepid sponging and continuous vital signs monitoring every 4 hours."	"Dr. Kishore Menon"	"1. Tab. Cefixime 200mg - 1 tablet orally twice daily after food for 5 days.
2. Tab. Paracetamol 650mg - 1 tablet orally SOS for fever/headache/body pain (maximum 3 tablets in 24 hours).
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
4. Tab. Vitamin C 500mg + Zinc - 1 tablet daily after food for 14 days.
5. Drink plenty of fluids (>3 liters/day of boiled water, tender coconut water, homemade soups).
6. Adequate bed rest; avoid physical exhaustion for 5-7 days.
7. Monitor body temperature twice daily and maintain a fever log.
8. General Medicine OPD Review in 5 days for follow-up clinical examination and CBC check.
9. Emergency Warning Signs: Seek immediate care if high fever (>102°F) returns, severe rash, breathing difficulty, or persistent vomiting develops."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 99.2°F, HR: 105 bpm, BP: 131/75 mmHg, SpO2: 99.83%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Pending Approval"	"local-clinical-engine"	"local"
87419	87419	87420	14	"2026-05-14 00:00:00"	"2026-09-28 11:09:26"	"Traumatic Bone Fracture"	"The patient, Senthilan Ranganlan, a 83-year-old Male, was admitted via Elective on 2026-05-14 presenting with Fracture. Clinical evaluation confirmed Traumatic Bone Fracture. During the hospital stay of 134 days under Dr. Umesh Sharma (Pediatrician), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Post-operative X-Ray (AP & Lateral): Anatomical reduction of patellar fracture fragments with stable tension band wiring constructs in situ; CBC: Hemoglobin 12.2 g/dL, Platelets 2.8 lakhs/mcL, WBC 7,800/mcL; Serum Calcium: 9.4 mg/dL, Serum Vitamin D3: 22.4 ng/mL. Vital Signs at Discharge: Temp: 100.5°F, HR: 119 bpm, BP: 151/89 mmHg, SpO2: 97.79%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Paracetamol - Dosage: 100 mg - Route: SC - Freq: Q6H - Duration: 30 Days - (Take as directed by consultant)
2. Inj. Cefuroxime 1.5g IV BD x 2 days post-op (Prophylactic antibiotic)
3. Inj. Tramadol 50mg IV in 100ml NS BD for post-operative analgesia
4. Inj. Pantoprazole 40mg IV OD
5. Lower limb elevation, ice pack application, and deep vein thrombosis prophylaxis with active ankle pumps."	"Dr. Umesh Sharma"	"1. Tab. Cefuroxime Axetil 500mg - 1 tablet orally twice daily after meals for 5 days.
2. Tab. Aceclofenac 100mg + Paracetamol 325mg - 1 tablet orally twice daily after food for 5 days as needed for pain.
3. Tab. Trypsin-Chymotrypsin (Chymoral Forte) - 1 tablet orally thrice daily half hour before food for 5 days (anti-inflammatory).
4. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 7 days.
5. Tab. Calcium Carbonate 500mg + Vitamin D3 400IU - 1 tablet orally daily after dinner for 30 days.
6. Strictly wear the knee immobilizer splint when standing or moving; non-weight bearing on operated leg using walker/crutches as instructed.
7. Keep operated leg elevated on 2 pillows while lying down to minimize swelling.
8. Perform active ankle pump exercises and static quadriceps contractions 10 times every 2 hours.
9. Keep surgical wound dressing clean and dry; do not wet the bandage.
10. Orthopedic OPD Review in 10-12 days for wound inspection and suture removal.
11. Emergency Warning Signs: Report immediately if severe calf pain/swelling, severe coldness in toes, foul discharge, or high fever occurs."	"Open Reduction and Internal Fixation (ORIF) / Tension Band Wiring of patellar fracture with rigid stabilization. Knee immobilizer splint applied. Intraoperative fluoroscopy confirmed anatomical reduction."	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 100.5°F, HR: 119 bpm, BP: 151/89 mmHg, SpO2: 97.79%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 11:09:26"	"2026-09-28 11:09:26"	"Pending Approval"	"openai/gpt-oss-120b"	"groq"
87420	87420	87421	121	"2026-07-18 00:00:00"	"2026-09-25 11:12:46"	"Acute Febrile Illness (High Fever)"	"The patient, Muruganan Ranganlan, a 20-year-old Other, was admitted via Emergency on 2026-07-18 presenting with High Fever. Clinical evaluation confirmed Acute Febrile Illness (High Fever). During the hospital stay of 69 days under Dr. Ritu Patel (Neurologist), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Complete Blood Count (CBC): Hb 12.6 g/dL, Total WBC 5,200/mcL, Platelet count 1.95 lakhs/mcL; Dengue NS1 Antigen & IgM: Negative; Malaria QBC & Smear: Negative for plasmodium species; Widal & Typhidot: Negative; Blood & Urine Cultures: Sterile after 48 hours incubation; Serum Electrolytes & Renal/Liver function tests within normal limits; Chest X-Ray: Clear lung fields. Vital Signs at Discharge: Temp: 101.4°F, HR: 87 bpm, BP: 126/77 mmHg, SpO2: 91.49%."	"Inpatient care and stabilization administered:
1. Administered: Tab. Ondansetron - Dosage: 500 mg - Route: Oral - Freq: BD - Duration: 5 Days - (Take as directed by consultant)
2. Inj. Ceftriaxone 1g IV BD x 3 days
3. Inj. Paracetamol 1000mg IV infusion SOS for temperature spikes > 100.5°F
4. Inj. Pantoprazole 40mg IV OD
5. IV Fluids: 0.9% Normal Saline 1000ml/day maintenance hydration
6. Tepid sponging and continuous vital signs monitoring every 4 hours."	"Dr. Ritu Patel"	"1. Tab. Cefixime 200mg - 1 tablet orally twice daily after food for 5 days.
2. Tab. Paracetamol 650mg - 1 tablet orally SOS for fever/headache/body pain (maximum 3 tablets in 24 hours).
3. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
4. Tab. Vitamin C 500mg + Zinc - 1 tablet daily after food for 14 days.
5. Drink plenty of fluids (>3 liters/day of boiled water, tender coconut water, homemade soups).
6. Adequate bed rest; avoid physical exhaustion for 5-7 days.
7. Monitor body temperature twice daily and maintain a fever log.
8. General Medicine OPD Review in 5 days for follow-up clinical examination and CBC check.
9. Emergency Warning Signs: Seek immediate care if high fever (>102°F) returns, severe rash, breathing difficulty, or persistent vomiting develops."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 101.4°F, HR: 87 bpm, BP: 126/77 mmHg, SpO2: 91.49%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-25 11:12:46"	"2026-09-25 11:12:46"	"Pending Approval"	"local-clinical-engine"	"local"
87504	87504	142904	14	"2026-09-23 00:00:00"	"2026-09-28 10:50:09"	"Inpatient Medical Care & Evaluation"	"The patient, Malini Chandran, a 41-year-old Female, was admitted via Inpatient on 2026-09-23 presenting with General lethargy and evaluation. Clinical evaluation confirmed Inpatient Medical Care & Evaluation. During the hospital stay of 3 days under Dr. Arun Kumar (General Medicine), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Complete Blood Count (CBC) - Normal limits; Renal & Liver Function Tests - Within reference range; Serum Electrolytes within normal limits; Chest X-Ray / ECG - Sinus rhythm with normal cardiac and pulmonary status. Vital Signs at Discharge: Temp: 98.4°F, HR: 72 bpm, BP: 116/74 mmHg, SpO2: 99.0%."	"Inpatient care and stabilization administered:
1. Inj. Pantoprazole 40mg IV OD x 2 days, transitioned to Oral Tab. 40mg
2. Tab. Paracetamol 650mg PO SOS for fever/body pain (max 3 times/day)
3. IV Fluids: Normal Saline 500ml @ 75ml/hr for initial hydration
4. Routine inpatient vital signs monitoring and nursing care."	"Dr. Arun Kumar"	"1. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
2. Tab. Paracetamol 650mg - 1 tablet orally as needed for pain/fever (max 3 tabs/day).
3. Tab. Multivitamin with Minerals - 1 capsule daily after dinner for 14 days.
4. Follow a balanced diet, adequate oral hydration (>2L/day), and avoid strenuous exertion for 5 days.
5. OPD Review in 7 days with Attending Physician for clinical follow-up.
6. Emergency Warning Signs: Seek immediate medical attention if persistent high fever (>101°F), acute chest pain, or shortness of breath occurs."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.4°F, HR: 72 bpm, BP: 116/74 mmHg, SpO2: 99.0%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 10:50:09"	"2026-09-28 10:50:09"	"Approved"	"local-clinical-engine"	"local"
87505	87505	142905	14	"2026-09-23 00:00:00"	"2026-09-28 11:09:11"	"Severe Sepsis with Septic Shock; Acute Kidney Injury"	"Vikramaditya Verma, a 64‑year‑old male, presented to the Emergency Department on 23‑Sep‑2026 with a 2‑day history of high‑grade fever (101.4°F), chills, productive cough, dyspnea, and oliguria. On arrival he was tachycardic (HR 118 bpm), hypotensive (BP 85/48 mmHg), tachypneic, and hypoxic (SpO2 91% on room air). Initial assessment identified septic shock secondary to presumed community‑acquired pneumonia with early multi‑organ dysfunction (acute kidney injury). He was promptly intubated, started on broad‑spectrum antibiotics (Meropenem), aggressive fluid resuscitation, and norepinephrine infusion. Over the next 72 hours vasopressor support was weaned off, renal function improved with intermittent hemodialysis on days 2‑4, and cultures grew Klebsiella pneumoniae sensitive to meropenem. He was extubated on day 5, transferred to the step‑down unit on day 7, and remained clinically stable for discharge on day 10."	"Imaging & Diagnostics: Chest Xray: Bilateral heterogeneous infiltrates consistent with pneumonia; Abdominal Ultrasound: Normal kidney size, no hydronephrosis"	"Inpatient care and stabilization administered:
1. Administered: Norepinephrine - Dosage: 0.05 µg/kg/min (titrated) - Route: IV infusion - Freq: continuous - Duration: Stopped on Day 3
2. Administered: Meropenem - Dosage: 1 g - Route: IV - Freq: every 8 hours - Duration: 7 days
3. Administered: Hydrocortisone - Dosage: 50 mg - Route: IV - Freq: q6h - Duration: 5 days
4. Administered: Furosemide - Dosage: 20 mg - Route: IV - Freq: q12h - Duration: until euvolemia (Day 6)"	"Dr. Rahul Kumar"	"1. Amoxicillin‑Clavulanate - 875/125 mg, Route: PO, Freq: TID (Duration: 5 days)
2. Furosemide - 20 mg, Route: PO, Freq: once daily
3. Amlodipine - 5 mg, Route: PO, Freq: once daily"	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented at discharge."	"2026-09-28 11:09:11"	"2026-09-28 11:09:11"	"Approved"	"openai/gpt-oss-120b"	"groq"
87506	87506	142906	14	"2026-09-23 00:00:00"	"2026-09-26 12:42:58"	"Type 2 Diabetes Mellitus with Ketoacidosis"	"Geetha Rangarajan, a 55‑year‑old female with known type 2 diabetes mellitus presented on 2026‑09-23 with polyuria, polydipsia, nausea and vomiting. Home glucose records showed values >400 mg/dL for 3 days. On arrival she was alert, afebrile, hemodynamically stable (HR 74 bpm, BP 120/80 mmHg, SpO2 98.5%). Finger‑stick glucose was 512 mg/dL, arterial pH 7.21, bicarbonate 14 mEq/L, anion gap 22, serum beta‑hydroxybutyrate 4.5 mmol/L confirming diabetic ketoacidosis (DKA). She was admitted to the general medicine ward for DKA management. Intravenous fluid resuscitation, insulin infusion, and electrolyte replacement were initiated per protocol. Serial labs showed resolution of acidosis by hospital day 2. She was transitioned to subcutaneous basal‑bolus insulin on day 3, oral antihypertensive therapy was continued, and education on sick‑day rules and carbohydrate counting was provided. She remained hemodynamically stable throughout admission and was discharged on hospital day 5."	"Vitals on Admission: Temp 98.4°F, HR 74 bpm, BP 120/80 mmHg
Laboratory Findings: CBC (wbc_10^9/L: 9.8, hb_g/dL: 12.4, platelets_10^9/L: 210); Electrolytes (sodium_mmol/L: 136, potassium_mmol/L: 3.8, chloride_mmol/L: 102, bicarbonate_mmol/L: 14); Renal (creatinine_mg/dL: 0.9, bun_mg/dL: 12); Liver (ast_u/L: 22, alt_u/L: 18, alk_phos_u/L: 78, bilirubin_total_mg/dL: 0.8); Glucose Mg/Dl: 512; Hba1C Percent: 10.2; Arterial Blood Gas (pH: 7.21, pCO2_mmHg: 28, pO2_mmHg: 95, bicarbonate_mmol/L: 14, anion_gap: 22); Ketones Beta Hydroxybutyrate Mmol/L: 4.5; Urine Ketones: large
Imaging & Diagnostics: Chest Xray: Clear lung fields, no infiltrates or effusion.
ECG: Normal sinus rhythm, no ischemic changes."	"Inpatient care and stabilization administered:
1. Administered: {'intravenous_fluids': [{'type': '0.9% Normal Saline', 'rate_ml_per_hr': 1000, 'duration_hours': 12}, {'type': '5% Dextrose in 0.45% NaCl', 'rate_ml_per_hr': 500, 'duration_hours': 24}], 'insulin': [{'medication': 'Regular insulin', 'dose_units_per_hour': 0.1, 'route': 'IV infusion', 'duration_hours': 48, 'adjustment_criteria': 'Blood glucose target 150‑200 mg/dL'}, {'medication': 'Insulin glargine', 'dose_units': 20, 'route': 'SC', 'timing': 'once daily at bedtime', 'start_day': 3}, {'medication': 'Insulin lispro', 'dose_units_per_meal': 6, 'route': 'SC', 'timing': 'pre‑meal', 'start_day': 3}], 'electrolyte_replacement': [{'medication': 'Potassium chloride', 'dose_mEq': 20, 'route': 'IV', 'frequency': 'q6h as needed', 'target_serum_K': '4.0‑4.5 mmol/L'}], 'antiemetics': [{'medication': 'Ondansetron', 'dose_mg': 4, 'route': 'IV', 'frequency': 'q8h PRN'}], 'oral_medications': [{'medication': 'Telmisartan', 'dose_mg': 40, 'route': 'PO', 'frequency': 'OD'}, {'medication': 'Metformin', 'dose_mg': 500, 'route': 'PO', 'frequency': 'BID', 'start_day': 4}], 'patient_education': 'Sick‑day rules, glucose monitoring, insulin injection technique, dietary counseling.'}"	"Dr. Arun Kumar"	"1. medication: Insulin glargine, dose_units: 20, route: SC, frequency: once daily at bedtime
2. medication: Insulin lispro, dose_units_per_meal: 6, route: SC, frequency: before each main meal (3 times daily)
3. medication: Metformin, dose_mg: 500, route: PO, frequency: BID with meals
4. medication: Telmisartan, dose_mg: 40, route: PO, frequency: OD
5. Light to moderate activity as tolerated; aim for 30 minutes walking most days. Avoid strenuous exercise until glucose is stable.
6. Blood glucose >250 mg/dL or <70 mg/dL persistently
7. Vomiting, abdominal pain, or inability to keep fluids down
8. Fever >100.4°F (38°C)
9. Rapid breathing, confusion, or lethargy
10. Signs of hypoglycemia (sweating, tremor, palpitations)
11. clinic: Endocrinology OPD, date: 2026-10-10, purpose: Insulin titration and diabetes education"	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented at discharge."	"2026-09-26 12:42:58"	"2026-09-26 12:42:58"	"Approved"	"openai/gpt-oss-120b"	"groq"
87507	87507	142907	14	"2026-09-23 00:00:00"	"2026-09-28 11:09:16"	"Acute Exacerbation of COPD"	"The patient, Balaji Krishnaswamy, a 59-year-old Male, was admitted via Inpatient on 2026-09-23 presenting with Acute Exacerbation of COPD with severe respiratory. Clinical evaluation confirmed Acute Exacerbation of COPD. During the hospital stay of 3 days under Dr. Arun Kumar (General Medicine), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Peak Expiratory Flow Rate (PEFR): Improved from 180 L/min to 410 L/min post-bronchodilator; Chest X-Ray (PA View): Bilateral lung hyperinflation, no consolidation or pneumothorax; Arterial Blood Gas (ABG): pH 7.42, pCO2 38 mmHg, pO2 88 mmHg, SpO2 97% on room air; Complete Blood Count: Absolute Eosinophil Count 450 cells/mcL; Normal renal/liver parameters. Vital Signs at Discharge: Temp: 103.2°F, HR: 132 bpm, BP: 182/108 mmHg, SpO2: 84.5%."	"Inpatient care and stabilization administered:
1. Administered: Inj. Ceftriaxone Sodium - Dosage: 1g - Route: IV - Freq: BD - Duration: 5 Days - (Take as directed by consultant)
2. Nebulization: Duolin (Levosalbutamol 1.25mg + Ipratropium Bromide 500mcg in 2.5ml) q6h
3. Nebulization: Budecort (Budesonide 0.5mg respules) q12h
4. Inj. Hydrocortisone 100mg IV q8h x 2 days, tapered smoothly
5. Tab. Montelukast 10mg + Levocetirizine 5mg PO at bedtime
6. Oxygen therapy via nasal cannula @ 2-4 L/min titrated to maintain SpO2 > 95%
7. Chest physiotherapy and breathing exercises."	"Dr. Arun Kumar"	"1. Inhaler Budesonide + Formoterol (200mcg / 6mcg) - 2 puffs twice daily with spacer x 30 days.
2. Inhaler Salbutamol 100mcg - 2 puffs SOS via spacer for acute wheezing/shortness of breath.
3. Tab. Montelukast 10mg - 1 tablet orally once daily at bedtime for 14 days.
4. Tab. Prednisolone 20mg - 1 tablet orally in the morning after breakfast for 3 days, then 10mg for 2 days, then stop.
5. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
6. Steam inhalation twice daily; strictly avoid exposure to dust, aerosol sprays, cold air, pet dander, and active/passive smoke.
7. Rinse mouth thoroughly with water after using steroid inhalers to prevent oral candidiasis.
8. Maintain adequate fluid intake (>2.5 liters of warm water daily).
9. OPD Review in 7 days with Pulmonology for repeat spirometry and inhaler technique review.
10. Emergency Warning Signs: Rush to ER if acute severe breathlessness, inability to speak full sentences, or blue lips/fingertips occur."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 103.2°F, HR: 132 bpm, BP: 182/108 mmHg, SpO2: 84.5%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-28 11:09:16"	"2026-09-28 11:09:16"	"Approved"	"openai/gpt-oss-120b"	"groq"
87508	87508	142908	14	"2026-09-23 00:00:00"	"2026-09-26 12:44:34"	"Suspected Mesenteric Ischemia under workup"	"Shalini Venugopal, a 34‑year‑old female, presented on 23‑Sep‑2026 with sudden onset severe central abdominal pain radiating to the back, nausea and mild vomiting. On arrival vitals were Temp 99.8°F, HR 105 bpm, BP 102/65 mmHg, SpO2 95% on room air. Physical exam revealed a tender, distended abdomen with guarding but no peritoneal signs. Given the high suspicion for mesenteric ischemia, the patient was kept NPO, started on IV fluid resuscitation and broad‑spectrum antibiotics, and a diagnostic work‑up was initiated. Serial labs, lactate monitoring, and a contrast‑enhanced CT angiography of the abdomen were performed. Imaging showed patent mesenteric vessels with no definitive occlusion but mild bowel wall thickening suggestive of early ischemic changes. Over the next 48 hours the patient’s pain gradually improved, lactate normalized, and she tolerated a clear liquid diet. No surgical intervention was required. She was transitioned to oral intake, pain control was optimized, and anticoagulation was discontinued after a negative work‑up. She was discharged in stable condition on 26‑Sep‑2026."	"Initial labs: CBC – WBC 13.2 ×10^9/L, Hb 12.4 g/dL, Plt 210 ×10^9/L; CMP – Na 138 mmol/L, K 4.1 mmol/L, Cr 0.9 mg/dL, AST 28 U/L, ALT 32 U/L, ALP 85 U/L; Serum lactate 3.2 mmol/L (peaked at 4.0 mmol/L, then fell to 1.2 mmol/L); CRP 45 mg/L. Vitals trend: HR 105→92→88 bpm, BP 102/65→115/70→120/75 mmHg, Temp 99.8→99.1→98.6°F, SpO2 95%→97%→98%. Imaging: Contrast‑enhanced CT abdomen/pelvis – no arterial occlusion, mild segmental small‑bowel wall edema, no free fluid or pneumoperitoneum. CT mesenteric angiography – normal SMA and IMA flow. ECG – sinus rhythm, no ischemic changes."	"Inpatient care and stabilization administered:
1. Administered: IV fluids: 0.9% Normal Saline 1 L bolus over 30 min, then 125 mL/hr maintenance. Analgesia: IV paracetamol 1 g q6h, IV tramadol 50 mg q8h PRN (max 200 mg/24h). Anticoagulation: IV unfractionated heparin infusion targeting aPTT 60‑80 sec (started 2 h after admission, discontinued after 48 h when imaging negative). Antibiotics: IV ceftriaxone 2 g q24h + metronidazole 500 mg q8h for 48 h. PPI: IV pantoprazole 40 mg daily, then oral. Antiemetic: IV ondansetron 4 mg q8h PRN. NPO for first 12 h, then clear liquids advancing to low‑residue diet as tolerated."	"Dr. Suresh Menon"	"1. Medications: Oral paracetamol 500 mg q6h PRN pain; oral pantoprazole 40 mg daily for 4 weeks; if pain recurs, oral tramadol 50 mg q8h PRN (max 200 mg/24h). No anticoagulation needed at discharge. Diet: Advance to low‑residue, soft diet over 2‑3 days; avoid large fatty meals. Activity: Light activity as tolerated; avoid heavy lifting >5 kg for 1 week. Red‑flag signs: Sudden worsening abdominal pain, vomiting, fever >38.5°C, abdominal distension, bloody stools, or dizziness. Follow‑up: Surgical OPD with Dr. Suresh Menon in 7 days; if labs abnormal or symptoms recur, see gastroenterology earlier."	"Nil"	"Hemodynamically stable, afebrile, pain controlled with oral analgesics, tolerating low‑residue diet, normalizing labs; discharged in good clinical condition."	"2026-09-26 12:44:34"	"2026-09-26 12:44:34"	"Approved"	"openai/gpt-oss-120b"	"groq"
87510	87502	142902	14	"2026-09-23 00:00:00"	"2026-09-26 12:51:12"	"Acute Asthma Exacerbation; Allergic Rhinitis"	"The patient, Ananya Sundaram, a 38-year-old Female, was admitted via Inpatient on 2026-09-23 presenting with Severe breathlessness and wheezing, acute asthma f. Clinical evaluation confirmed Acute Asthma Exacerbation. During the hospital stay of 3 days under Dr. Arun Kumar (General Medicine), the patient was managed with standard evidence-based clinical protocols. Initial acute symptoms resolved with steady clinical improvement."	"Peak Expiratory Flow Rate (PEFR): Improved from 180 L/min to 410 L/min post-bronchodilator; Chest X-Ray (PA View): Bilateral lung hyperinflation, no consolidation or pneumothorax; Arterial Blood Gas (ABG): pH 7.42, pCO2 38 mmHg, pO2 88 mmHg, SpO2 97% on room air; Complete Blood Count: Absolute Eosinophil Count 450 cells/mcL; Normal renal/liver parameters. Vital Signs at Discharge: Temp: 98.6°F, HR: 76 bpm, BP: 118/76 mmHg, SpO2: 99.0%."	"Inpatient care and stabilization administered:
1. Administered: Inj. Ceftriaxone Sodium - Dosage: 1g - Route: IV - Freq: BD - Duration: 3 Days - (Take as directed by consultant)
2. Administered: Inj. Tramadol HCl - Dosage: 50mg - Route: IV - Freq: SOS - Duration: 2 Days - (Take as directed by consultant)
3. Nebulization: Duolin (Levosalbutamol 1.25mg + Ipratropium Bromide 500mcg in 2.5ml) q6h
4. Nebulization: Budecort (Budesonide 0.5mg respules) q12h
5. Inj. Hydrocortisone 100mg IV q8h x 2 days, tapered smoothly
6. Tab. Montelukast 10mg + Levocetirizine 5mg PO at bedtime
7. Oxygen therapy via nasal cannula @ 2-4 L/min titrated to maintain SpO2 > 95%
8. Chest physiotherapy and breathing exercises."	"Dr. Arun Kumar"	"1. Inhaler Budesonide + Formoterol (200mcg / 6mcg) - 2 puffs twice daily with spacer x 30 days.
2. Inhaler Salbutamol 100mcg - 2 puffs SOS via spacer for acute wheezing/shortness of breath.
3. Tab. Montelukast 10mg - 1 tablet orally once daily at bedtime for 14 days.
4. Tab. Prednisolone 20mg - 1 tablet orally in the morning after breakfast for 3 days, then 10mg for 2 days, then stop.
5. Tab. Pantoprazole 40mg - 1 tablet orally once daily before breakfast for 5 days.
6. Steam inhalation twice daily; strictly avoid exposure to dust, aerosol sprays, cold air, pet dander, and active/passive smoke.
7. Rinse mouth thoroughly with water after using steroid inhalers to prevent oral candidiasis.
8. Maintain adequate fluid intake (>2.5 liters of warm water daily).
9. OPD Review in 7 days with Pulmonology for repeat spirometry and inhaler technique review.
10. Emergency Warning Signs: Rush to ER if acute severe breathlessness, inability to speak full sentences, or blue lips/fingertips occur."	"Nil"	"Patient is hemodynamically stable, alert, conscious, and oriented. Vital signs at discharge: Temp: 98.6°F, HR: 76 bpm, BP: 118/76 mmHg, SpO2: 99.0%. Tolerating oral diet well, ambulating independently, and medically cleared for safe discharge to home care."	"2026-09-26 12:51:12"	"2026-09-26 12:51:12"	"Approved"	"local-clinical-engine"	"local"
"""

TABLE_COLS = [
    "summary_id",
    "admission_id",
    "patient_id",
    "doctor_id",
    "admission_date",
    "discharge_date",
    "diagnoses",
    "case_history",
    "investigations",
    "treatment",
    "primary_consultant",
    "discharge_advice",
    "surgery_details",
    "patient_condition",
    "generated_at",
    "ingestion_timestamp",
    "approval_status",
    "model_name",
    "model_source"
]

reader = csv.reader(io.StringIO(RAW_DATA.strip()), delimiter='\t')
rows = []
for r in reader:
    if not r or len(r) < 19:
        continue
    # Clean and cast fields
    row_dict = {
        "summary_id": int(r[0]),
        "admission_id": int(r[1]),
        "patient_id": int(r[2]),
        "doctor_id": int(r[3]) if r[3] else None,
        "admission_date": r[4],
        "discharge_date": r[5],
        "diagnoses": r[6],
        "case_history": r[7],
        "investigations": r[8],
        "treatment": r[9],
        "primary_consultant": r[10],
        "discharge_advice": r[11],
        "surgery_details": r[12],
        "patient_condition": r[13],
        "generated_at": r[14],
        "ingestion_timestamp": r[15],
        "approval_status": r[16],
        "model_name": r[17],
        "model_source": r[18]
    }
    rows.append([row_dict[col] for col in TABLE_COLS])

print(f"Parsed {len(rows)} rows from user's exact TSV data.")

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Truncate table
cur.execute("TRUNCATE TABLE dim_generated_discharge_summaries;")
conn.commit()

# 2. Insert exactly the user's 53 rows
insert_query = f"""
    INSERT INTO dim_generated_discharge_summaries ({', '.join(TABLE_COLS)})
    VALUES ({', '.join(['%s'] * len(TABLE_COLS))});
"""
psycopg2.extras.execute_batch(cur, insert_query, rows)
conn.commit()
print(f"Inserted {len(rows)} exact records into dim_generated_discharge_summaries.")

# 3. Synchronize dim_admission_inputs
approved_summary_rows = [r for r in rows if r[16] == 'Approved']
pending_summary_rows = [r for r in rows if r[16] != 'Approved']

approved_adm_ids = tuple(r[1] for r in approved_summary_rows)
pending_adm_ids = tuple(r[1] for r in pending_summary_rows)

print(f"Approved admissions ({len(approved_adm_ids)}): {approved_adm_ids}")
print(f"Pending admissions ({len(pending_adm_ids)}): {pending_adm_ids}")

# Mark 11 as Discharged
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Discharged'
    WHERE admission_id IN %s;
""", (approved_adm_ids,))

# Mark 42 as Ready (wait for approval)
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Ready'
    WHERE admission_id IN %s;
""", (pending_adm_ids,))

# Mark remaining active admissions as Admitted
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Admitted'
    WHERE admission_id NOT IN %s AND admission_id NOT IN %s;
""", (approved_adm_ids, pending_adm_ids))

conn.commit()

# 4. Verify counts in DB
cur.execute("SELECT COUNT(*) as c FROM dim_generated_discharge_summaries;")
print("dim_generated_discharge_summaries total count:", cur.fetchone()['c'])

cur.execute("SELECT approval_status, COUNT(*) as c FROM dim_generated_discharge_summaries GROUP BY approval_status ORDER BY approval_status;")
print("dim_generated_discharge_summaries breakdown:", cur.fetchall())

cur.execute("SELECT discharge_status, COUNT(*) as c FROM dim_admission_inputs GROUP BY discharge_status ORDER BY discharge_status;")
print("dim_admission_inputs breakdown:", cur.fetchall())

cur.close()
conn.close()
