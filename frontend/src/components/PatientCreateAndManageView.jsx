import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api, apiService } from '../services/api';

// ============================================================================
// CLINICAL MASTER REFERENCE DATABASE (DIAGNOSIS → MEDS → LABS → SPECIALTY)
// ============================================================================
const CLINICAL_REFERENCE_DATABASE = [
  {
    id: 'resp-pneumonia',
    domain: 'Pulmonology & Respiratory',
    diagnosis_name: 'Severe Community-Acquired Pneumonia with Hypoxemic Failure',
    diagnosis_code: 'J18.9',
    department_name: 'Pulmonology & Critical Care',
    doctor_name: 'Dr. Ravi Reddy',
    consultation_reason: 'Severe Dyspnea, Productive Cough with Rust Sputum and High Fever',
    reason_for_admission: 'Acute Respiratory Distress with Left Lower Lobe Consolidation and Hypoxemia',
    medications: [
      { medication_name: 'Ceftriaxone IV', dosage: '1g', frequency: 'BD', route: 'IV', duration: '5 Days', instructions: 'Infuse in 100ml NS over 30 mins' },
      { medication_name: 'Azithromycin', dosage: '500mg', frequency: 'OD', route: 'Oral', duration: '5 Days', instructions: 'Take 1 hour before or 2 hours after meals' },
      { medication_name: 'N-Acetylcysteine', dosage: '600mg', frequency: 'TDS', route: 'Oral', duration: '5 Days', instructions: 'Effervescent tablet in water for mucus clearance' },
      { medication_name: 'Paracetamol IV', dosage: '1g', frequency: 'TDS (SOS)', route: 'IV', duration: '3 Days', instructions: 'For body temperature > 100.4°F' }
    ],
    lab_orders: [
      { test_name: 'Complete Blood Count (CBC)', test_code: 'CBC-01', priority: 'Urgent' },
      { test_name: 'Chest X-Ray (PA View)', test_code: 'RAD-CXR-PA', priority: 'STAT' },
      { test_name: 'Arterial Blood Gas (ABG)', test_code: 'ABG-STAT', priority: 'Emergency' },
      { test_name: 'Sputum Gram Stain & Culture', test_code: 'MIC-SPUT-01', priority: 'Routine' }
    ],
    bill_items: [
      { item_name: 'Emergency Pulmonology Consultation', unit_price: 2500, quantity: 1, item_type: 'Consultation' },
      { item_name: 'High Flow Oxygen Therapy (3 Days)', unit_price: 1500, quantity: 3, item_type: 'Procedure' },
      { item_name: 'Nebulization & Chest Physiotherapy', unit_price: 600, quantity: 3, item_type: 'Nursing' }
    ]
  },
  {
    id: 'cardio-stemi',
    domain: 'Cardiology & CCU',
    diagnosis_name: 'Acute ST-Elevation Myocardial Infarction (STEMI) Anterolateral',
    diagnosis_code: 'I21.0',
    department_name: 'Interventional Cardiology',
    doctor_name: 'Dr. Amit Sharma',
    consultation_reason: 'Crushing Retro-Sternal Chest Pain radiating to Left Arm with Diaphoresis',
    reason_for_admission: 'Acute Coronary Syndrome with ST-Elevations on Lead V1-V4 for Primary Angiography',
    medications: [
      { medication_name: 'Aspirin (Soluble)', dosage: '150mg', frequency: 'OD', route: 'Oral', duration: '30 Days', instructions: 'Take with or after breakfast' },
      { medication_name: 'Ticagrelor', dosage: '90mg', frequency: 'BD', route: 'Oral', duration: '30 Days', instructions: 'Dual antiplatelet therapy; do not skip' },
      { medication_name: 'Atorvastatin', dosage: '80mg', frequency: 'HS', route: 'Oral', duration: '30 Days', instructions: 'High-intensity statin taken at bedtime' },
      { medication_name: 'Enoxaparin Sodium', dosage: '60mg', frequency: 'BD', route: 'Subcutaneous', duration: '3 Days', instructions: 'Inject in anterolateral abdominal wall' }
    ],
    lab_orders: [
      { test_name: 'High Sensitivity Troponin-I (STAT)', test_code: 'CARD-TROP-I', priority: 'STAT' },
      { test_name: '12-Lead Electrocardiogram (ECG)', test_code: 'CARD-ECG-12', priority: 'STAT' },
      { test_name: 'Lipid Profile & CK-MB', test_code: 'CARD-LIPID', priority: 'Urgent' },
      { test_name: 'Serum Electrolytes & Renal Panel', test_code: 'BIO-RFT-ELEC', priority: 'Urgent' }
    ],
    bill_items: [
      { item_name: 'Emergency Cardiology Consultation', unit_price: 3000, quantity: 1, item_type: 'Consultation' },
      { item_name: 'Coronary Angiogram & Cath-Lab Facility', unit_price: 18000, quantity: 1, item_type: 'Procedure' },
      { item_name: 'Continuous CCU Multipara Monitoring (3 Days)', unit_price: 2500, quantity: 3, item_type: 'Nursing' }
    ]
  },
  {
    id: 'endo-dka',
    domain: 'Endocrinology & Diabetology',
    diagnosis_name: 'Type 2 Diabetes Mellitus with Diabetic Ketoacidosis (DKA)',
    diagnosis_code: 'E11.10',
    department_name: 'Endocrinology & Internal Medicine',
    doctor_name: 'Dr. Priya Patel',
    consultation_reason: 'Severe Hyperglycemia, Intractable Vomiting, Polydipsia and Confusion',
    reason_for_admission: 'Severe DKA with Blood Glucose 480 mg/dL, High Anion Gap Metabolic Acidosis',
    medications: [
      { medication_name: 'Human Regular Insulin Infusion', dosage: '0.1 units/kg/hr', frequency: 'Continuous', route: 'IV', duration: '2 Days', instructions: 'Titrate infusion rate per hourly capillary blood glucose' },
      { medication_name: 'Normal Saline 0.9% IV', dosage: '1000ml', frequency: 'Q4H', route: 'IV', duration: '2 Days', instructions: 'Fluid resuscitation protocol for DKA' },
      { medication_name: 'Potassium Chloride (KCl)', dosage: '20 mEq', frequency: 'BD', route: 'IV Infusion', duration: '2 Days', instructions: 'Mix in 500ml NS; monitor serum K+ levels' },
      { medication_name: 'Metformin Hydrochloride', dosage: '500mg', frequency: 'BD', route: 'Oral', duration: '30 Days', instructions: 'Resume oral antidiabetic post-acidosis recovery' }
    ],
    lab_orders: [
      { test_name: 'Plasma Glucose (RBS / FBS)', test_code: 'BIO-GLU-STAT', priority: 'Emergency' },
      { test_name: 'Serum Beta-Hydroxybutyrate (Ketones)', test_code: 'BIO-KET-STAT', priority: 'STAT' },
      { test_name: 'Arterial Blood Gas (ABG)', test_code: 'ABG-STAT', priority: 'Emergency' },
      { test_name: 'HbA1c Glycated Hemoglobin', test_code: 'BIO-HBA1C', priority: 'Routine' }
    ],
    bill_items: [
      { item_name: 'Endocrine Specialist Inpatient Evaluation', unit_price: 2200, quantity: 1, item_type: 'Consultation' },
      { item_name: 'Hourly Point-of-Care Glucose Telemetry', unit_price: 1200, quantity: 2, item_type: 'Procedure' },
      { item_name: 'Micro-Infusion Syringe Pump Setup & Care', unit_price: 800, quantity: 3, item_type: 'Nursing' }
    ]
  },
  {
    id: 'crit-sepsis',
    domain: 'Critical Care & Infectious Diseases',
    diagnosis_name: 'Severe Sepsis Secondary to Urosepsis with Hypotension',
    diagnosis_code: 'A41.9',
    department_name: 'Critical Care Medicine (ICU)',
    doctor_name: 'Dr. Sneha Das',
    consultation_reason: 'High-Grade Spiking Fevers with Rigors, Flank Pain, Oliguria and Delirium',
    reason_for_admission: 'Urosepsis with Systemic Inflammatory Response (SIRS) and Mean Arterial Pressure < 65',
    medications: [
      { medication_name: 'Piperacillin-Tazobactam IV', dosage: '4.5g', frequency: 'Q8H', route: 'IV', duration: '7 Days', instructions: 'Extended infusion over 3 hours for bacteremia' },
      { medication_name: 'Vancomycin Hydrochloride', dosage: '1g', frequency: 'BD', route: 'IV', duration: '7 Days', instructions: 'Infuse over 60 mins; monitor serum trough levels' },
      { medication_name: 'Noradrenaline Infusion', dosage: '0.05 mcg/kg/min', frequency: 'Continuous', route: 'IV', duration: '2 Days', instructions: 'Central line titration to maintain MAP > 65 mmHg' },
      { medication_name: 'Pantoprazole IV', dosage: '40mg', frequency: 'OD', route: 'IV', duration: '5 Days', instructions: 'Stress ulcer prophylaxis' }
    ],
    lab_orders: [
      { test_name: 'Blood Culture & Antimicrobial Sensitivity (2 Sets)', test_code: 'MIC-BLD-CULT', priority: 'STAT' },
      { test_name: 'Serum Lactate (STAT)', test_code: 'BIO-LACT-STAT', priority: 'Emergency' },
      { test_name: 'Procalcitonin (Quantitative)', test_code: 'BIO-PCT-QUAN', priority: 'Urgent' },
      { test_name: 'Urine Routine & Microscopic Culture', test_code: 'MIC-URI-CULT', priority: 'Urgent' }
    ],
    bill_items: [
      { item_name: 'Intensivist Level-3 Bedside Resuscitation', unit_price: 4500, quantity: 1, item_type: 'Consultation' },
      { item_name: 'Triple Lumen Central Venous Line Placement', unit_price: 6500, quantity: 1, item_type: 'Procedure' },
      { item_name: 'Invasive Arterial Line Pressure Monitoring', unit_price: 1800, quantity: 3, item_type: 'Nursing' }
    ]
  },
  {
    id: 'neuro-stroke',
    domain: 'Neurology & Stroke Unit',
    diagnosis_name: 'Acute Ischemic Stroke in Middle Cerebral Artery Territory',
    diagnosis_code: 'I63.9',
    department_name: 'Neurology & Stroke Medicine',
    doctor_name: 'Dr. Arun Sundaram',
    consultation_reason: 'Sudden Onset Right-Sided Hemiplegia, Facial Asymmetry and Expressive Aphasia',
    reason_for_admission: 'Acute Ischemic Infarct in Left MCA distribution presenting within 3 hours',
    medications: [
      { medication_name: 'Citicoline Sodium IV', dosage: '1000mg', frequency: 'BD', route: 'IV', duration: '5 Days', instructions: 'Neuroprotective agent infused in 100ml Saline' },
      { medication_name: 'Aspirin (Dispersible)', dosage: '150mg', frequency: 'OD', route: 'Oral / Ryle Tube', duration: '30 Days', instructions: 'Administer after dysphagia / swallowing screen' },
      { medication_name: 'Atorvastatin', dosage: '40mg', frequency: 'HS', route: 'Oral', duration: '30 Days', instructions: 'Plaque stabilization therapy' },
      { medication_name: 'Mannitol 20% Infusion', dosage: '100ml', frequency: 'Q8H', route: 'IV', duration: '3 Days', instructions: 'Infuse over 20 mins for cerebral edema reduction' }
    ],
    lab_orders: [
      { test_name: 'Non-Contrast CT Brain / MRI Stroke Protocol', test_code: 'RAD-CT-BRAIN', priority: 'STAT' },
      { test_name: 'Coagulation Screen (PT / INR / aPTT)', test_code: 'HEM-COAG-01', priority: 'Emergency' },
      { test_name: 'Carotid & Vertebral Doppler Ultrasound', test_code: 'RAD-USG-CARO', priority: 'Urgent' },
      { test_name: 'Random Blood Glucose (STAT)', test_code: 'BIO-GLU-STAT', priority: 'STAT' }
    ],
    bill_items: [
      { item_name: 'Emergency Neurologist Stroke Consultation', unit_price: 3500, quantity: 1, item_type: 'Consultation' },
      { item_name: 'Neuro-Intensive Stroke Care & Thrombolysis Prep', unit_price: 5000, quantity: 1, item_type: 'Procedure' },
      { item_name: 'Specialized Neuro-Nursing & Dysphagia Care', unit_price: 1500, quantity: 3, item_type: 'Nursing' }
    ]
  },
  {
    id: 'gastro-pancreatitis',
    domain: 'Gastroenterology & GI Surgery',
    diagnosis_name: 'Acute Necrotizing Pancreatitis with Biliary Sludge',
    diagnosis_code: 'K85.1',
    department_name: 'Medical & Surgical Gastroenterology',
    doctor_name: 'Dr. Rajesh Iyer',
    consultation_reason: 'Severe Epigastric Pain Radiating to Back with Persistent Intractable Vomiting',
    reason_for_admission: 'Acute Biliary Pancreatitis with Serum Lipase > 1200 U/L and Abdominal Distension',
    medications: [
      { medication_name: 'Pantoprazole IV', dosage: '40mg', frequency: 'BD', route: 'IV', duration: '5 Days', instructions: 'IV Push in morning and evening' },
      { medication_name: 'Tramadol Hydrochloride', dosage: '50mg', frequency: 'TDS', route: 'IV', duration: '3 Days', instructions: 'Dilute in 100ml NS for severe visceral pain' },
      { medication_name: 'Octreotide Acetate', dosage: '100mcg', frequency: 'TID', route: 'Subcutaneous', duration: '5 Days', instructions: 'Pancreatic exocrine secretion suppression' },
      { medication_name: 'Meropenem Trihydrate', dosage: '1g', frequency: 'TDS', route: 'IV', duration: '7 Days', instructions: 'Broad spectrum coverage for infected necrosis' }
    ],
    lab_orders: [
      { test_name: 'Serum Amylase & Lipase (STAT)', test_code: 'BIO-LIP-AMY', priority: 'Emergency' },
      { test_name: 'Contrast-Enhanced CT Abdomen (CECT)', test_code: 'RAD-CT-ABDOM', priority: 'Urgent' },
      { test_name: 'Liver Function Panel (LFT & Bilirubin)', test_code: 'BIO-LFT-01', priority: 'Urgent' },
      { test_name: 'Serum Calcium & Triglycerides', test_code: 'BIO-CA-TRIG', priority: 'Routine' }
    ],
    bill_items: [
      { item_name: 'Gastroenterology Emergency Assessment', unit_price: 2500, quantity: 1, item_type: 'Consultation' },
      { item_name: 'Ultrasound Guided Abdominal Mapping & Paracentesis', unit_price: 4200, quantity: 1, item_type: 'Procedure' },
      { item_name: 'Nasogastric Decompression & Ryle Tube Care', unit_price: 900, quantity: 3, item_type: 'Nursing' }
    ]
  },
  {
    id: 'ortho-trauma',
    domain: 'Orthopedics & Trauma Surgery',
    diagnosis_name: 'Compound Fracture Distal Third Right Femur with Soft Tissue Injury',
    diagnosis_code: 'S72.301A',
    department_name: 'Orthopedics & Polytrauma',
    doctor_name: 'Dr. Vikram Malhotra',
    consultation_reason: 'High-Impact Road Traffic Accident with Right Thigh Deformity and Open Wound',
    reason_for_admission: 'Grade-II Open Femur Fracture for Emergency Wound Debridement & Skeletal Traction',
    medications: [
      { medication_name: 'Cefuroxime Axetil IV', dosage: '1.5g', frequency: 'BD', route: 'IV', duration: '5 Days', instructions: 'First-line surgical prophylaxis' },
      { medication_name: 'Amikacin Sulfate', dosage: '500mg', frequency: 'BD', route: 'IV', duration: '3 Days', instructions: 'Gram-negative trauma wound coverage' },
      { medication_name: 'Tramadol + Paracetamol', dosage: '37.5mg/325mg', frequency: 'BD', route: 'Oral', duration: '5 Days', instructions: 'Analgesic after food' },
      { medication_name: 'Tetanus Toxoid (TT)', dosage: '0.5ml', frequency: 'STAT', route: 'IM', duration: '1 Dose', instructions: 'Deep intramuscular injection in deltoid' }
    ],
    lab_orders: [
      { test_name: 'Digital X-Ray Right Thigh AP & Lateral', test_code: 'RAD-XR-FEMUR', priority: 'STAT' },
      { test_name: 'Hemoglobin & Hematocrit STAT', test_code: 'HEM-HB-STAT', priority: 'Emergency' },
      { test_name: 'Pre-Op Coagulation Screen & Blood Crossmatch (2 Units PRBC)', test_code: 'BB-CROSS-02', priority: 'Emergency' },
      { test_name: 'Wound Swab for Aerobic Culture', test_code: 'MIC-WND-SWAB', priority: 'Routine' }
    ],
    bill_items: [
      { item_name: 'Orthopedic Trauma Surgeon Emergency Consult', unit_price: 3000, quantity: 1, item_type: 'Consultation' },
      { item_name: 'Emergency Wound Debridement & Distal Femoral Pin Traction', unit_price: 12000, quantity: 1, item_type: 'Procedure' },
      { item_name: 'Immobilization Splinting & Specialized Ortho Dressing', unit_price: 1200, quantity: 3, item_type: 'Nursing' }
    ]
  },
  {
    id: 'nephro-aki',
    domain: 'Nephrology & Renal Sciences',
    diagnosis_name: 'Acute on Chronic Kidney Disease Stage-IV with Uremic Encephalopathy',
    diagnosis_code: 'N18.4',
    department_name: 'Nephrology & Dialysis Unit',
    doctor_name: 'Dr. Deepa Nair',
    consultation_reason: 'Worsening Oliguria, Generalized Anasarca, Nausea and Drowsiness',
    reason_for_admission: 'Uremic State with Serum Creatinine 7.2 mg/dL and Severe Hyperkalemia (K+ 6.4 mEq/L)',
    medications: [
      { medication_name: 'Furosemide (High Dose IV)', dosage: '80mg', frequency: 'BD', route: 'IV', duration: '3 Days', instructions: 'Slow IV injection over 5 mins' },
      { medication_name: 'Calcium Gluconate 10%', dosage: '10ml', frequency: 'STAT', route: 'IV', duration: '1 Dose', instructions: 'Cardioprotection for hyperkalemia over 10 mins' },
      { medication_name: 'Sodium Bicarbonate Tablets', dosage: '500mg', frequency: 'TDS', route: 'Oral', duration: '14 Days', instructions: 'Correction of metabolic acidosis' },
      { medication_name: 'Calcium Acetate', dosage: '667mg', frequency: 'TDS', route: 'Oral', duration: '30 Days', instructions: 'Phosphate binder taken with meals' }
    ],
    lab_orders: [
      { test_name: 'Renal Function Panel (Urea / Creatinine / Uric Acid)', test_code: 'BIO-RFT-FULL', priority: 'STAT' },
      { test_name: 'Serum Electrolytes (Na+, K+, Cl-, HCO3-)', test_code: 'BIO-ELEC-STAT', priority: 'Emergency' },
      { test_name: 'Arterial Blood Gas (ABG)', test_code: 'ABG-STAT', priority: 'Emergency' },
      { test_name: 'Ultrasound Kidneys, Ureters & Bladder (KUB)', test_code: 'RAD-USG-KUB', priority: 'Urgent' }
    ],
    bill_items: [
      { item_name: 'Nephrology Specialist Consult & Dialysis Evaluation', unit_price: 2500, quantity: 1, item_type: 'Consultation' },
      { item_name: 'Emergency Hemodialysis Session (3 Hours)', unit_price: 4500, quantity: 1, item_type: 'Procedure' },
      { item_name: 'Temporary Dual-Lumen Dialysis Catheter Insertion', unit_price: 5500, quantity: 1, item_type: 'Procedure' }
    ]
  }
];

// Sample Demographics Pool for Dynamic Generation
const SAMPLE_DEMOGRAPHICS = [
  { first_name: 'Vikram', last_name: 'Rathore', gender: 'Male', age: 44, blood_group: 'O+', phone: '+91 98765 43210', email: 'vikram.rathore@example.com', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', emergency_contact: 'Ananya Rathore', emergency_phone: '+91 98765 43211', address: 'Flat 402, Green Valley Apartments, Outer Ring Road' },
  { first_name: 'Ananya', last_name: 'Deshmukh', gender: 'Female', age: 38, blood_group: 'B+', phone: '+91 98220 11223', email: 'ananya.deshmukh@example.com', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', emergency_contact: 'Rohit Deshmukh', emergency_phone: '+91 98220 11224', address: 'B-1204, Sea Breeze Towers, Worli Sea Face' },
  { first_name: 'Karthik', last_name: 'Sundaram', gender: 'Male', age: 52, blood_group: 'A+', phone: '+91 98401 55667', email: 'karthik.sundaram@example.com', city: 'Chennai', state: 'Tamil Nadu', pincode: '600018', emergency_contact: 'Lakshmi Sundaram', emergency_phone: '+91 98401 55668', address: 'Plot 15, 3rd Main Road, Anna Nagar West' },
  { first_name: 'Sneha', last_name: 'Mukherjee', gender: 'Female', age: 29, blood_group: 'AB+', phone: '+91 98300 77889', email: 'sneha.m@example.com', city: 'Kolkata', state: 'West Bengal', pincode: '700029', emergency_contact: 'Debashis Mukherjee', emergency_phone: '+91 98300 77890', address: 'Flat 3B, Southern Avenue Heritage Residency' },
  { first_name: 'Rajesh', last_name: 'Verma', gender: 'Male', age: 61, blood_group: 'O-', phone: '+91 98110 33445', email: 'rajesh.verma@example.com', city: 'New Delhi', state: 'Delhi', pincode: '110001', emergency_contact: 'Sunita Verma', emergency_phone: '+91 98110 33446', address: 'C-48, Hauz Khas Enclave, Aurobindo Marg' },
  { first_name: 'Pooja', last_name: 'Hegde', gender: 'Female', age: 34, blood_group: 'A-', phone: '+91 98860 99887', email: 'pooja.hegde@example.com', city: 'Mangaluru', state: 'Karnataka', pincode: '575001', emergency_contact: 'Suresh Hegde', emergency_phone: '+91 98860 99888', address: '12-4, Kadri Hills View Villa' },
  { first_name: 'Arjun', last_name: 'Menon', gender: 'Male', age: 48, blood_group: 'B-', phone: '+91 98470 66554', email: 'arjun.menon@example.com', city: 'Kochi', state: 'Kerala', pincode: '682001', emergency_contact: 'Divya Menon', emergency_phone: '+91 98470 66555', address: 'Villa 8, Palm Meadows, Marine Drive' }
];

// Helper to generate dynamic vitals based on condition and diagnosis
function generateDynamicVitals(vitalStatus = 'Normal', diagnosisId = 'resp-pneumonia') {
  const isAbnormal = vitalStatus === 'Abnormal';

  if (!isAbnormal) {
    // Physiologically normal ranges with randomized clinical variance
    const hr = Math.floor(68 + Math.random() * 10); // 68 - 77 bpm
    const sys = Math.floor(116 + Math.random() * 8); // 116 - 123 mmHg
    const dia = Math.floor(76 + Math.random() * 6); // 76 - 81 mmHg
    const temp = (98.2 + Math.random() * 0.4).toFixed(1); // 98.2 - 98.6 F (36.8 C)
    const spo2 = (98.0 + Math.random() * 1.5).toFixed(1); // 98.0 - 99.5 %
    const rr = Math.floor(14 + Math.random() * 4); // 14 - 17 /min
    const pain = Math.floor(Math.random() * 2); // 0 - 1

    return {
      heart_rate: hr,
      systolic_bp: sys,
      diastolic_bp: dia,
      temperature: parseFloat(temp),
      oxygen_saturation: parseFloat(spo2),
      respiratory_rate: rr,
      pain_scale: pain,
      weight: Math.floor(62 + Math.random() * 18)
    };
  }

  // Abnormal: Realistic disease-specific deviations
  switch (diagnosisId) {
    case 'resp-pneumonia':
      return {
        heart_rate: Math.floor(108 + Math.random() * 16), // 108 - 123 bpm (Tachycardia)
        systolic_bp: Math.floor(132 + Math.random() * 14), // 132 - 145 mmHg
        diastolic_bp: Math.floor(84 + Math.random() * 10), // 84 - 93 mmHg
        temperature: parseFloat((101.8 + Math.random() * 1.6).toFixed(1)), // 101.8 - 103.4 F (High fever)
        oxygen_saturation: parseFloat((88.0 + Math.random() * 3.5).toFixed(1)), // 88.0 - 91.5 % (Hypoxemia)
        respiratory_rate: Math.floor(26 + Math.random() * 6), // 26 - 31 /min (Tachypnea)
        pain_scale: 6,
        weight: Math.floor(65 + Math.random() * 15)
      };
    case 'cardio-stemi':
      return {
        heart_rate: Math.floor(114 + Math.random() * 18), // 114 - 131 bpm
        systolic_bp: Math.floor(88 + Math.random() * 10), // 88 - 97 mmHg (Cardiogenic hypotension)
        diastolic_bp: Math.floor(58 + Math.random() * 8), // 58 - 65 mmHg
        temperature: parseFloat((98.6 + Math.random() * 0.6).toFixed(1)),
        oxygen_saturation: parseFloat((91.0 + Math.random() * 2.5).toFixed(1)), // 91.0 - 93.5 %
        respiratory_rate: Math.floor(22 + Math.random() * 4),
        pain_scale: 9, // Severe chest pain
        weight: Math.floor(70 + Math.random() * 15)
      };
    case 'endo-dka':
      return {
        heart_rate: Math.floor(118 + Math.random() * 14), // 118 - 131 bpm
        systolic_bp: Math.floor(104 + Math.random() * 12),
        diastolic_bp: Math.floor(66 + Math.random() * 8),
        temperature: parseFloat((98.8 + Math.random() * 0.8).toFixed(1)),
        oxygen_saturation: parseFloat((96.0 + Math.random() * 2.0).toFixed(1)),
        respiratory_rate: Math.floor(28 + Math.random() * 6), // Kussmaul deep rapid breathing
        pain_scale: 5,
        weight: Math.floor(60 + Math.random() * 15)
      };
    case 'crit-sepsis':
      return {
        heart_rate: Math.floor(124 + Math.random() * 16), // 124 - 139 bpm (Severe SIRS)
        systolic_bp: Math.floor(82 + Math.random() * 10), // 82 - 91 mmHg (Septic Shock)
        diastolic_bp: Math.floor(52 + Math.random() * 8), // 52 - 59 mmHg
        temperature: parseFloat((102.6 + Math.random() * 1.5).toFixed(1)), // 102.6 - 104.1 F
        oxygen_saturation: parseFloat((89.5 + Math.random() * 3.0).toFixed(1)),
        respiratory_rate: Math.floor(28 + Math.random() * 6),
        pain_scale: 7,
        weight: Math.floor(64 + Math.random() * 16)
      };
    case 'neuro-stroke':
      return {
        heart_rate: Math.floor(92 + Math.random() * 14),
        systolic_bp: Math.floor(178 + Math.random() * 18), // 178 - 195 mmHg (Severe stroke hypertension)
        diastolic_bp: Math.floor(104 + Math.random() * 12), // 104 - 115 mmHg
        temperature: parseFloat((98.8 + Math.random() * 0.6).toFixed(1)),
        oxygen_saturation: parseFloat((94.0 + Math.random() * 2.5).toFixed(1)),
        respiratory_rate: Math.floor(18 + Math.random() * 4),
        pain_scale: 4,
        weight: Math.floor(68 + Math.random() * 14)
      };
    default:
      return {
        heart_rate: Math.floor(112 + Math.random() * 16),
        systolic_bp: Math.floor(90 + Math.random() * 12),
        diastolic_bp: Math.floor(60 + Math.random() * 8),
        temperature: parseFloat((101.5 + Math.random() * 1.5).toFixed(1)),
        oxygen_saturation: parseFloat((89.0 + Math.random() * 3.0).toFixed(1)),
        respiratory_rate: Math.floor(24 + Math.random() * 6),
        pain_scale: 6,
        weight: Math.floor(66 + Math.random() * 14)
      };
  }
}

export default function PatientCreateAndManageView({ onNavigate, currentUser }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'manage' | 'beds'
  
  // Available beds state
  const [availableBeds, setAvailableBeds] = useState([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState(null);

  // Clinical Reference State
  const [selectedDiagnosisId, setSelectedDiagnosisId] = useState('resp-pneumonia');
  const [vitalStatus, setVitalStatus] = useState('Abnormal'); // 'Normal' | 'Abnormal'

  // Preset Insurance Limits
  const PRESET_LIMITS = [
    { label: '₹5 Lakh', value: 500000 },
    { label: '₹10 Lakh', value: 1000000 },
    { label: '₹25 Lakh', value: 2500000 },
    { label: '₹45 Lakh', value: 4500000 },
    { label: '₹50 Lakh', value: 5000000 },
    { label: '₹1 Crore', value: 10000000 }
  ];

  const INSURANCE_PROVIDERS = [
    'Star Health & Allied Insurance',
    'HDFC ERGO General Insurance',
    'Care Health Insurance',
    'ICICI Lombard Health Insurance',
    'Bajaj Allianz General Insurance',
    'Max Bupa / Niva Bupa Health Insurance',
    'United India Insurance',
    'The New India Assurance',
    'National Insurance Company',
    'The Oriental Insurance Company',
    'Tata AIG General Insurance',
    'Aditya Birla Health Insurance',
    'Medi Assist Insurance TPA',
    'Vidal Health TPA',
    'Family Health Plan Insurance TPA (FHPL)',
    'MDIndia Health Insurance TPA',
    'Paramount Health Services TPA',
    'Heritage Health TPA'
  ];

  // Core Form State
  const [formData, setFormData] = useState(() => {
    const initRef = CLINICAL_REFERENCE_DATABASE[0];
    const initVitals = generateDynamicVitals('Abnormal', initRef.id);
    const initDemo = SAMPLE_DEMOGRAPHICS[0];

    return {
      // Encounter & Care Mode
      patient_type: 'IP', // 'IP' or 'OP'
      admission_days: 3,
      admission_type: 'Emergency',
      admission_source: 'Emergency Department',
      reason_for_admission: initRef.reason_for_admission,

      // Insurance Config
      is_insured: true,
      insurance_amount: 4500000.0, // Configurable sum insured
      insurance_provider: 'Star Health & Allied Insurance',
      policy_number: `STAR-POL-${Math.floor(100000 + Math.random() * 900000)}`,
      insurance_plan_name: 'Super Surplus Floater Gold',
      insurance_status: 'Active',
      co_pay_percentage: 10,
      deductible_amount: 25000,

      // Demographics
      first_name: initDemo.first_name,
      last_name: initDemo.last_name,
      gender: initDemo.gender,
      date_of_birth: '1982-05-14',
      age: initDemo.age,
      blood_group: initDemo.blood_group,
      phone: initDemo.phone,
      email: initDemo.email,
      address: initDemo.address,
      city: initDemo.city,
      state: initDemo.state,
      pincode: initDemo.pincode,
      emergency_contact_name: initDemo.emergency_contact,
      emergency_contact_phone: initDemo.emergency_phone,
      marital_status: 'Married',
      preferred_language: 'English',

      // Clinical & Attending
      doctor_name: initRef.doctor_name,
      department_name: initRef.department_name,
      consultation_reason: initRef.consultation_reason,
      primary_diagnosis: initRef.diagnosis_name,
      primary_diag_code: initRef.diagnosis_code,

      // Vitals
      ...initVitals,

      // Medications
      medications: [...initRef.medications],

      // Lab Orders
      lab_orders: [...initRef.lab_orders],

      // Bill Line Items
      bill_items: [...initRef.bill_items]
    };
  });

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [creationResult, setCreationResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Manage / Delete search state
  const [searchIdentifier, setSearchIdentifier] = useState('');
  const [patientDetails, setPatientDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletionResult, setDeletionResult] = useState(null);

  // Fetch available beds on mount and tab switch
  const fetchBeds = useCallback(async () => {
    setLoadingBeds(true);
    try {
      const res = await api.getAvailableBeds();
      const bedsList = Array.isArray(res)
        ? res
        : (res?.available_beds || res?.beds || res?.data || []);
      setAvailableBeds(bedsList);
      if (bedsList.length > 0) {
        setSelectedBedId(prev => prev || bedsList[0].bed_id);
      }
    } catch (e) {
      console.error('Failed to load beds:', e);
    } finally {
      setLoadingBeds(false);
    }
  }, []);

  useEffect(() => {
    fetchBeds();
  }, [fetchBeds]);

  // Handler: Switch Diagnosis Reference
  const handleSelectDiagnosisReference = (diagId) => {
    setSelectedDiagnosisId(diagId);
    const selectedRef = CLINICAL_REFERENCE_DATABASE.find(d => d.id === diagId) || CLINICAL_REFERENCE_DATABASE[0];
    const newVitals = generateDynamicVitals(vitalStatus, diagId);

    setFormData(prev => ({
      ...prev,
      primary_diagnosis: selectedRef.diagnosis_name,
      primary_diag_code: selectedRef.diagnosis_code,
      department_name: selectedRef.department_name,
      doctor_name: selectedRef.doctor_name,
      consultation_reason: selectedRef.consultation_reason,
      reason_for_admission: selectedRef.reason_for_admission,
      ...newVitals,
      medications: JSON.parse(JSON.stringify(selectedRef.medications)),
      lab_orders: JSON.parse(JSON.stringify(selectedRef.lab_orders)),
      bill_items: JSON.parse(JSON.stringify(selectedRef.bill_items))
    }));
  };

  // Handler: Toggle Vital Status (Normal vs Abnormal)
  const handleVitalStatusChange = (newStatus) => {
    setVitalStatus(newStatus);
    const newVitals = generateDynamicVitals(newStatus, selectedDiagnosisId);
    setFormData(prev => ({
      ...prev,
      ...newVitals
    }));
  };

  // Handler: Randomize Patient Demographics
  const handleRandomizeDemographics = () => {
    const randomIndex = Math.floor(Math.random() * SAMPLE_DEMOGRAPHICS.length);
    const randomDemo = SAMPLE_DEMOGRAPHICS[randomIndex];
    const calcYear = new Date().getFullYear() - randomDemo.age;
    const randomDob = `${calcYear}-${String(Math.floor(1 + Math.random() * 12)).padStart(2, '0')}-${String(Math.floor(1 + Math.random() * 28)).padStart(2, '0')}`;
    const randomPolicy = `POL-${Math.floor(100000 + Math.random() * 900000)}-${new Date().getFullYear()}`;

    setFormData(prev => ({
      ...prev,
      first_name: randomDemo.first_name,
      last_name: randomDemo.last_name,
      gender: randomDemo.gender,
      age: randomDemo.age,
      date_of_birth: randomDob,
      blood_group: randomDemo.blood_group,
      phone: randomDemo.phone,
      email: randomDemo.email,
      address: randomDemo.address,
      city: randomDemo.city,
      state: randomDemo.state,
      pincode: randomDemo.pincode,
      emergency_contact_name: randomDemo.emergency_contact,
      emergency_contact_phone: randomDemo.emergency_phone,
      policy_number: randomPolicy
    }));
  };

  // Handler: Pick Random Clinical Reference Case
  const handleRandomizeClinicalCase = () => {
    const randomIdx = Math.floor(Math.random() * CLINICAL_REFERENCE_DATABASE.length);
    const randomCase = CLINICAL_REFERENCE_DATABASE[randomIdx];
    handleSelectDiagnosisReference(randomCase.id);
  };

  // Selected bed object
  const currentSelectedBed = useMemo(() => {
    return availableBeds.find(b => b.bed_id === selectedBedId) || availableBeds[0] || null;
  }, [availableBeds, selectedBedId]);

  // Real-time Bill calculation
  const billSummary = useMemo(() => {
    let gross = 0;
    const items = [...formData.bill_items];

    // Include bed charge if IP
    if (formData.patient_type === 'IP' && currentSelectedBed) {
      const bedRate = Number(currentSelectedBed.daily_charge || 1500);
      const days = Number(formData.admission_days || 1);
      gross += bedRate * days;
    }

    items.forEach(it => {
      gross += (Number(it.unit_price) || 0) * (Number(it.quantity) || 1);
    });

    const net = gross;
    let insPortion = 0;
    let patPortion = net;

    if (formData.is_insured) {
      const coverage = Number(formData.insurance_amount) || 500000;
      insPortion = Math.min(net, coverage);
      patPortion = Math.max(0, net - insPortion);
    }

    return {
      gross,
      net,
      insurancePortion: insPortion,
      patientPortion: patPortion
    };
  }, [formData, currentSelectedBed]);

  // Handle Form Change with bidirectional Age <-> Date of Birth synchronization
  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };

      if (field === 'age') {
        const numAge = Number(value);
        if (!isNaN(numAge) && numAge >= 0) {
          const currentYear = new Date().getFullYear();
          const birthYear = currentYear - numAge;
          let monthDay = '05-15';
          if (prev.date_of_birth && prev.date_of_birth.includes('-') && prev.date_of_birth.length >= 10) {
            monthDay = prev.date_of_birth.substring(5);
          }
          updated.date_of_birth = `${birthYear}-${monthDay}`;
        }
      } else if (field === 'date_of_birth') {
        if (value && value.includes('-')) {
          const parts = value.split('-');
          const birthYear = Number(parts[0]);
          const currentYear = new Date().getFullYear();
          if (!isNaN(birthYear) && birthYear > 1900 && birthYear <= currentYear) {
            updated.age = currentYear - birthYear;
          }
        }
      }

      return updated;
    });
  };

  // Add/Remove Medication
  const handleAddMed = () => {
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, { medication_name: '', dosage: '500mg', frequency: 'BD', route: 'Oral', duration: '5 Days', instructions: 'Take after food' }]
    }));
  };
  const handleRemoveMed = (idx) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== idx)
    }));
  };
  const handleMedChange = (idx, key, val) => {
    setFormData(prev => {
      const copy = [...prev.medications];
      copy[idx] = { ...copy[idx], [key]: val };
      return { ...prev, medications: copy };
    });
  };

  // Add/Remove Lab Order
  const handleAddLab = () => {
    setFormData(prev => ({
      ...prev,
      lab_orders: [...prev.lab_orders, { test_name: '', test_code: 'LAB-NEW', priority: 'Routine' }]
    }));
  };
  const handleRemoveLab = (idx) => {
    setFormData(prev => ({
      ...prev,
      lab_orders: prev.lab_orders.filter((_, i) => i !== idx)
    }));
  };
  const handleLabChange = (idx, key, val) => {
    setFormData(prev => {
      const copy = [...prev.lab_orders];
      copy[idx] = { ...copy[idx], [key]: val };
      return { ...prev, lab_orders: copy };
    });
  };

  // Submit Patient Creation
  const handleSubmitPatient = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setCreationResult(null);

    try {
      const payload = {
        patient_type: formData.patient_type,
        is_insured: Boolean(formData.is_insured),
        insurance_amount: formData.is_insured ? Number(formData.insurance_amount) : null,
        insurance_provider: formData.is_insured ? formData.insurance_provider : null,
        policy_number: formData.is_insured ? formData.policy_number : null,
        insurance_plan_name: formData.is_insured ? formData.insurance_plan_name : null,
        insurance_status: formData.is_insured ? formData.insurance_status : null,
        co_pay_percentage: formData.is_insured ? Number(formData.co_pay_percentage) : null,
        deductible_amount: formData.is_insured ? Number(formData.deductible_amount) : null,

        first_name: formData.first_name,
        last_name: formData.last_name,
        gender: formData.gender,
        date_of_birth: formData.date_of_birth,
        age: Number(formData.age),
        blood_group: formData.blood_group,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
        marital_status: formData.marital_status,
        preferred_language: formData.preferred_language,
        allow_duplicate: true, // Allow fresh test creations cleanly

        // Bed & Inpatient parameters
        bed_id: formData.patient_type === 'IP' && currentSelectedBed ? currentSelectedBed.bed_id : null,
        bed_number: formData.patient_type === 'IP' && currentSelectedBed ? currentSelectedBed.bed_number : null,
        ward_id: formData.patient_type === 'IP' && currentSelectedBed ? currentSelectedBed.ward_id : null,
        ward_name: formData.patient_type === 'IP' && currentSelectedBed ? currentSelectedBed.ward_name : null,
        admission_days: Number(formData.admission_days || 1),
        admission_type: formData.admission_type,
        admission_source: formData.admission_source,
        reason_for_admission: formData.reason_for_admission,

        // Clinical
        consultation_reason: formData.consultation_reason,
        primary_diagnosis: formData.primary_diagnosis,
        diagnoses: [
          { diagnosis_code: formData.primary_diag_code || 'D-101', diagnosis_name: formData.primary_diagnosis, is_primary: true, diagnosis_type: 'Primary' }
        ],

        // Attending Doctor & Department
        visit: {
          doctor_name: formData.doctor_name,
          department_name: formData.department_name,
          chief_complaint: formData.consultation_reason,
          visit_type: formData.patient_type === 'IP' ? 'Inpatient' : 'Outpatient'
        },

        // Vitals
        vitals: {
          temperature: Number(formData.temperature),
          heart_rate: Number(formData.heart_rate),
          systolic_bp: Number(formData.systolic_bp),
          diastolic_bp: Number(formData.diastolic_bp),
          respiratory_rate: Number(formData.respiratory_rate),
          oxygen_saturation: Number(formData.oxygen_saturation),
          weight: Number(formData.weight)
        },

        // Medications & Labs
        medications: formData.medications.filter(m => m.medication_name && m.medication_name.trim()),
        lab_orders: formData.lab_orders.filter(l => l.test_name && l.test_name.trim()),

        // Billing
        bill_items: formData.bill_items.map(it => ({
          item_name: it.item_name,
          description: it.item_name,
          item_type: it.item_type,
          unit_price: Number(it.unit_price),
          quantity: Number(it.quantity)
        }))
      };

      const res = await api.createFullPatient(payload);
      setCreationResult(res);
      fetchBeds();
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to create patient record.');
    } finally {
      setSubmitting(false);
    }
  };

  // Search and fetch 360 patient details
  const handleSearchPatient = async (e) => {
    if (e) e.preventDefault();
    if (!searchIdentifier.trim()) return;

    setLoadingDetails(true);
    setPatientDetails(null);
    setDeletionResult(null);
    setErrorMessage(null);

    try {
      const res = await api.getPatientFullDetails(searchIdentifier.trim());
      setPatientDetails(res);
    } catch (err) {
      setErrorMessage(err.message || `Patient '${searchIdentifier}' not found.`);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Execute full atomic deletion
  const handleDeletePatient = async () => {
    if (!patientDetails?.patient?.id) return;
    setDeleting(true);
    setErrorMessage(null);
    try {
      const targetId = patientDetails.patient.id;
      const res = await api.deleteFullPatient(targetId);
      setDeletionResult(res);
      setDeleteModalOpen(false);
      setPatientDetails(null);
      fetchBeds();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete patient record.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: '#0a0e17',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '24px 32px 64px'
    }}>
      {/* ── Top Header & Focused Navbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '16px 24px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        marginBottom: '28px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('command') : window.history.back()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#38bdf8',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#0284c7'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#38bdf8'; }}
          >
            ← Back to Dashboard
          </button>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.3px' }}>
                🏥 Patient Onboarding & Clinical Lifecycle Engine
              </h1>
              <span style={{ background: '#0284c7', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                PostgreSQL Live Hub
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Diagnosis-Aware Pharmacology · Physiological Vital Matrix · Dynamic Bed & Insurance Allocation
            </p>
          </div>
        </div>

        {/* Action Tabs Navigation */}
        <div style={{ display: 'flex', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '10px', border: '1px solid #1e293b' }}>
          <button
            onClick={() => { setActiveTab('create'); setCreationResult(null); setErrorMessage(null); }}
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'create' ? '#0284c7' : 'transparent',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>➕</span> New Patient Registration
          </button>
          <button
            onClick={() => { setActiveTab('manage'); setErrorMessage(null); }}
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'manage' ? '#0284c7' : 'transparent',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🔍</span> 360° Explorer & Deep Delete
          </button>
          <button
            onClick={() => { setActiveTab('beds'); fetchBeds(); }}
            style={{
              padding: '8px 16px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'beds' ? '#0284c7' : 'transparent',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🛏️</span> Available Beds ({availableBeds.length})
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '12px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13.5px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>
      )}

      {/* ── TAB 1: NEW PATIENT REGISTRATION WORKFLOW ── */}
      {activeTab === 'create' && (
        <>
          {creationResult ? (
            /* Success Summary View */
            <div style={{
              background: '#0f172a',
              borderRadius: '16px',
              padding: '36px',
              border: '1px solid #10b981',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              textAlign: 'center',
              maxWidth: '900px',
              margin: '0 auto'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#10b981',
                color: '#fff',
                fontSize: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                ✓
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', margin: '0 0 6px 0' }}>
                Patient Successfully Registered in Database!
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '28px' }}>
                All relational child records (Demographics, Clinical Visit, Admission, Diagnoses, Vitals, Medications, Labs, Invoices, and Insurance) have been transactionally committed.
              </p>

              {/* Crucial Identifiers Card */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                marginBottom: '28px',
                textAlign: 'left'
              }}>
                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #10b981' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Patient Full Name</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                    {`${creationResult.patient?.first_name || ''} ${creationResult.patient?.last_name || ''}`.trim() || `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'Registered Patient'}
                  </div>
                </div>

                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #38bdf8' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Official Patient Code</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                    {creationResult.patient?.patient_code}
                  </div>
                </div>

                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Database Patient ID</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                    #{creationResult.patient?.id}
                  </div>
                </div>

                <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Encounter Mode</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: creationResult.encounter_type === 'IP' ? '#4ade80' : '#38bdf8', marginTop: '4px' }}>
                    {creationResult.encounter_type === 'IP' ? 'Inpatient (IP)' : 'Outpatient (OP)'}
                  </div>
                </div>

                {/* Insurance Details Card */}
                {(() => {
                  const ins = creationResult.insurance || {};
                  const isInsured = Boolean(
                    creationResult.patient?.is_insured || 
                    formData.is_insured || 
                    creationResult.insurance || 
                    (formData.insurer && formData.insurer !== 'Self-Pay')
                  );
                  const provider = ins.insurance_provider || formData.insurance_provider || formData.insurer || (isInsured ? 'Star Health & Allied Insurance' : 'Self-Pay');
                  const policyNo = ins.policy_number || formData.policy_number || 'N/A';
                  const limit = ins.coverage_limit || formData.insurance_amount || 500000;

                  return (
                    <div style={{
                      background: '#1e293b',
                      padding: '16px',
                      borderRadius: '12px',
                      border: isInsured ? '1px solid #a855f7' : '1px solid #475569',
                      gridColumn: 'span 2'
                    }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>🛡️ Insurance Coverage Details</span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isInsured ? 'rgba(168, 85, 247, 0.25)' : 'rgba(100, 116, 139, 0.25)',
                          color: isInsured ? '#d8b4fe' : '#94a3b8',
                          border: isInsured ? '1px solid #a855f7' : '1px solid #475569'
                        }}>
                          {isInsured ? '✓ Insured' : 'Self-Pay (Non-Insured)'}
                        </span>
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        {isInsured ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#c084fc' }}>
                              {provider}
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                              <span>Policy No: <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>{policyNo}</strong></span>
                              <span>•</span>
                              <span>Coverage Limit: <strong style={{ color: '#4ade80' }}>₹{Number(limit).toLocaleString('en-IN')}</strong></span>
                              <span>•</span>
                              <span style={{ color: '#93c5fd' }}>Cashless Ready</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600 }}>
                            Self-Pay / Direct Patient Billing (No Active Insurance Claim)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {creationResult.bed && (
                  <div style={{ background: '#1e293b', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Assigned Bed</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>
                      {creationResult.bed?.bed_number} ({creationResult.bed?.ward_name})
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  onClick={() => {
                    setSearchIdentifier(String(creationResult.patient?.id || ''));
                    setActiveTab('manage');
                    handleSearchPatient();
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  🔍 Inspect 360° Profile & Invoices
                </button>
                <button
                  onClick={() => {
                    setCreationResult(null);
                    handleRandomizeDemographics();
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#f8fafc',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Register Another Patient
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form Layout */
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(340px, 1fr)', gap: '28px', alignItems: 'start' }}>
              
              {/* Left Column: Clinical & Registration Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                
                {/* ── STEP 1: PATIENT DEMOGRAPHICS & PROFILE ── */}
                <div style={{ background: '#0f172a', borderRadius: '14px', padding: '22px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>1</span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Patient Demographics & Personal Details</h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleRandomizeDemographics}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        background: '#1e293b',
                        color: '#38bdf8',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>🎲</span> Generate Realistic Patient
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>First Name *</label>
                      <input
                        type="text"
                        value={formData.first_name}
                        onChange={e => handleChange('first_name', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Last Name *</label>
                      <input
                        type="text"
                        value={formData.last_name}
                        onChange={e => handleChange('last_name', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Gender</label>
                      <select
                        value={formData.gender}
                        onChange={e => handleChange('gender', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Blood Group</label>
                      <select
                        value={formData.blood_group}
                        onChange={e => handleChange('blood_group', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      >
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Age (Years) *</label>
                      <input
                        type="number"
                        min="0"
                        max="125"
                        value={formData.age}
                        onChange={e => handleChange('age', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Date of Birth (YYYY-MM-DD)</label>
                      <input
                        type="date"
                        value={formData.date_of_birth}
                        onChange={e => handleChange('date_of_birth', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Phone Number *</label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={e => handleChange('phone', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => handleChange('email', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Residential Address</label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={e => handleChange('address', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>City & State</label>
                      <input
                        type="text"
                        value={`${formData.city}, ${formData.state}`}
                        onChange={e => {
                          const parts = e.target.value.split(',');
                          handleChange('city', parts[0] ? parts[0].trim() : '');
                          if (parts[1]) handleChange('state', parts[1].trim());
                        }}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Emergency Contact Phone</label>
                      <input
                        type="text"
                        value={formData.emergency_contact_phone}
                        onChange={e => handleChange('emergency_contact_phone', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── STEP 2: ENCOUNTER & CARE MODE (IP vs OP) ── */}
                <div style={{ background: '#0f172a', borderRadius: '14px', padding: '22px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>2</span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Encounter & Admission Mode</h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                    <div
                      onClick={() => handleChange('patient_type', 'IP')}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: formData.patient_type === 'IP' ? '2px solid #10b981' : '1px solid #334155',
                        background: formData.patient_type === 'IP' ? 'rgba(16, 185, 129, 0.1)' : '#1e293b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: formData.patient_type === 'IP' ? '#4ade80' : '#f8fafc' }}>
                        <span>🛏️</span> Inpatient (IP) Admission
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                        Assigns hospital bed, ward, and auto-calculates daily bed rate in bill.
                      </p>
                    </div>

                    <div
                      onClick={() => handleChange('patient_type', 'OP')}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        border: formData.patient_type === 'OP' ? '2px solid #0284c7' : '1px solid #334155',
                        background: formData.patient_type === 'OP' ? 'rgba(2, 132, 199, 0.1)' : '#1e293b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: formData.patient_type === 'OP' ? '#38bdf8' : '#f8fafc' }}>
                        <span>🩺</span> Outpatient (OP) Consultation
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                        Consultation, pharmacy & labs with zero bed allocation or charges.
                      </p>
                    </div>
                  </div>

                  {formData.patient_type === 'IP' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px', background: '#1e293b', padding: '16px', borderRadius: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                          Select Available Inpatient Bed ({availableBeds.length} Available)
                        </label>
                        <select
                          value={selectedBedId || ''}
                          onChange={e => setSelectedBedId(Number(e.target.value))}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '12.5px' }}
                        >
                          {availableBeds.map(b => (
                            <option key={b.bed_id} value={b.bed_id}>
                              {b.bed_number} — {b.ward_name} ({b.bed_type}) — ₹{b.daily_charge?.toLocaleString()}/day
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Estimated Stay (Days)</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={formData.admission_days}
                          onChange={e => handleChange('admission_days', Math.max(1, Number(e.target.value)))}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Admission Type</label>
                        <select
                          value={formData.admission_type}
                          onChange={e => handleChange('admission_type', e.target.value)}
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                        >
                          <option value="Emergency">Emergency</option>
                          <option value="Elective">Elective</option>
                          <option value="Urgent">Urgent Transfer</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── STEP 3: INSURANCE COVERAGE CONFIGURATION ── */}
                <div style={{ background: '#0f172a', borderRadius: '14px', padding: '22px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>3</span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Insurance Status & Coverage Limit</h3>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleChange('is_insured', true)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          background: formData.is_insured ? '#10b981' : '#1e293b',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Insured
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('is_insured', false)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          background: !formData.is_insured ? '#ef4444' : '#1e293b',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Not Insured (Self-Pay)
                      </button>
                    </div>
                  </div>

                  {formData.is_insured && (
                    <>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                          Configurable Sum Insured (User-Defined Coverage Limit):
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                          {PRESET_LIMITS.map(limit => (
                            <button
                              key={limit.value}
                              type="button"
                              onClick={() => handleChange('insurance_amount', limit.value)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: formData.insurance_amount === limit.value ? '2px solid #10b981' : '1px solid #334155',
                                background: formData.insurance_amount === limit.value ? '#10b981' : '#1e293b',
                                color: '#fff',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {limit.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                        <div>
                          <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Custom Coverage Amount (₹)</label>
                          <input
                            type="number"
                            value={formData.insurance_amount}
                            onChange={e => handleChange('insurance_amount', Number(e.target.value))}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Insurance Provider / TPA</label>
                          <select
                            value={formData.insurance_provider || 'Star Health & Allied Insurance'}
                            onChange={e => handleChange('insurance_provider', e.target.value)}
                            style={{ 
                              width: '100%', 
                              padding: '9px 12px', 
                              borderRadius: '7px', 
                              background: '#1e293b', 
                              border: '1px solid #334155', 
                              color: '#f8fafc', 
                              fontSize: '13px',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {INSURANCE_PROVIDERS.map(prov => (
                              <option key={prov} value={prov} style={{ background: '#0f172a', color: '#f8fafc' }}>
                                {prov}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Policy Number</label>
                          <input
                            type="text"
                            value={formData.policy_number}
                            onChange={e => handleChange('policy_number', e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ── STEP 4: DIAGNOSIS REFERENCE & CLINICAL DOMAIN ── */}
                <div style={{ background: '#0f172a', borderRadius: '14px', padding: '22px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>4</span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Diagnosis Reference & Clinical Case</h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleRandomizeClinicalCase}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        background: '#1e293b',
                        color: '#38bdf8',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <span>🎲</span> Randomize Case
                    </button>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                      Select Clinical Reference Scenario (Auto-selects ICD-10, Doctor & Case Reason):
                    </label>
                    <select
                      value={selectedDiagnosisId}
                      onChange={e => handleSelectDiagnosisReference(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: '#1e293b', border: '1px solid #0284c7', color: '#f8fafc', fontSize: '13px', fontWeight: 600 }}
                    >
                      {CLINICAL_REFERENCE_DATABASE.map(cr => (
                        <option key={cr.id} value={cr.id}>
                          [{cr.domain}] — {cr.diagnosis_name} (ICD: {cr.diagnosis_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Primary Clinical Diagnosis</label>
                      <input
                        type="text"
                        value={formData.primary_diagnosis}
                        onChange={e => handleChange('primary_diagnosis', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>ICD-10 Code</label>
                      <input
                        type="text"
                        value={formData.primary_diag_code}
                        onChange={e => handleChange('primary_diag_code', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Attending Specialist</label>
                      <input
                        type="text"
                        value={formData.doctor_name}
                        onChange={e => handleChange('doctor_name', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11.5px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Clinical Department</label>
                      <input
                        type="text"
                        value={formData.department_name}
                        onChange={e => handleChange('department_name', e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── STEP 5: VITAL SELECTION & DYNAMIC PHYSIOLOGY MATRIX ── */}
                <div style={{ background: '#0f172a', borderRadius: '14px', padding: '22px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>5</span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Vital Signs Physiological State</h3>
                    </div>

                    {/* Normal vs Abnormal Dynamic Selector */}
                    <div style={{ display: 'flex', gap: '8px', background: '#1e293b', padding: '4px', borderRadius: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleVitalStatusChange('Normal')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          background: vitalStatus === 'Normal' ? '#10b981' : 'transparent',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>🟢</span> Normal Vitals
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVitalStatusChange('Abnormal')}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          background: vitalStatus === 'Abnormal' ? '#ef4444' : 'transparent',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>🔴</span> Abnormal Vitals
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: vitalStatus === 'Normal' ? '#4ade80' : '#f87171' }}>
                    {vitalStatus === 'Normal'
                      ? '✓ Generating physiologically stable vital telemetry within standard human clinical reference limits.'
                      : '⚡ Dynamically applying realistic pathological vitals matching the selected diagnosis presentation.'}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Heart Rate</label>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '4px 0' }}>
                        {formData.heart_rate} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>bpm</span>
                      </div>
                      <input
                        type="number"
                        value={formData.heart_rate}
                        onChange={e => handleChange('heart_rate', Number(e.target.value))}
                        style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                      />
                    </div>

                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Blood Pressure</label>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '4px 0' }}>
                        {formData.systolic_bp}/{formData.diastolic_bp} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>mmHg</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="number"
                          value={formData.systolic_bp}
                          onChange={e => handleChange('systolic_bp', Number(e.target.value))}
                          style={{ width: '50%', padding: '4px 6px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                        />
                        <input
                          type="number"
                          value={formData.diastolic_bp}
                          onChange={e => handleChange('diastolic_bp', Number(e.target.value))}
                          style={{ width: '50%', padding: '4px 6px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                        />
                      </div>
                    </div>

                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>SpO₂ Level</label>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: formData.oxygen_saturation < 92 ? '#f87171' : '#4ade80', margin: '4px 0' }}>
                        {formData.oxygen_saturation}%
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.oxygen_saturation}
                        onChange={e => handleChange('oxygen_saturation', Number(e.target.value))}
                        style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                      />
                    </div>

                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Body Temp (°F)</label>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: formData.temperature > 100.4 ? '#f87171' : '#f8fafc', margin: '4px 0' }}>
                        {formData.temperature}°F
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.temperature}
                        onChange={e => handleChange('temperature', Number(e.target.value))}
                        style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                      />
                    </div>

                    <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Resp Rate</label>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '4px 0' }}>
                        {formData.respiratory_rate} <span style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>/min</span>
                      </div>
                      <input
                        type="number"
                        value={formData.respiratory_rate}
                        onChange={e => handleChange('respiratory_rate', Number(e.target.value))}
                        style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── STEP 6: DIAGNOSIS-AWARE MEDICATIONS & LAB ORDERS ── */}
                <div style={{ background: '#0f172a', borderRadius: '14px', padding: '22px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>6</span>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Diagnosis-Aware Medications & Diagnostics</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleAddMed}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Add Drug
                      </button>
                      <button
                        type="button"
                        onClick={handleAddLab}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        + Add Lab
                      </button>
                    </div>
                  </div>

                  {/* Medications List */}
                  <div style={{ marginBottom: '18px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💊</span> Clinically Matched Hospital Formularies ({formData.medications.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {formData.medications.map((med, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 28px', gap: '8px', alignItems: 'center', background: '#1e293b', padding: '8px 12px', borderRadius: '8px' }}>
                          <input
                            type="text"
                            placeholder="Medication Name"
                            value={med.medication_name}
                            onChange={e => handleMedChange(idx, 'medication_name', e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '5px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12.5px' }}
                          />
                          <input
                            type="text"
                            placeholder="Dosage"
                            value={med.dosage}
                            onChange={e => handleMedChange(idx, 'dosage', e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '5px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12.5px' }}
                          />
                          <input
                            type="text"
                            placeholder="Frequency"
                            value={med.frequency}
                            onChange={e => handleMedChange(idx, 'frequency', e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '5px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12.5px' }}
                          />
                          <input
                            type="text"
                            placeholder="Duration"
                            value={med.duration}
                            onChange={e => handleMedChange(idx, 'duration', e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '5px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12.5px' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveMed(idx)}
                            style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', height: '28px', cursor: 'pointer', fontWeight: 700 }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lab Orders List */}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🧪</span> Diagnostic & Laboratory Orders ({formData.lab_orders.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {formData.lab_orders.map((lab, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '3fr 1.5fr 1fr 28px', gap: '8px', alignItems: 'center', background: '#1e293b', padding: '8px 12px', borderRadius: '8px' }}>
                          <input
                            type="text"
                            placeholder="Test Name"
                            value={lab.test_name}
                            onChange={e => handleLabChange(idx, 'test_name', e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '5px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12.5px' }}
                          />
                          <input
                            type="text"
                            placeholder="Code"
                            value={lab.test_code}
                            onChange={e => handleLabChange(idx, 'test_code', e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '5px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12.5px' }}
                          />
                          <select
                            value={lab.priority}
                            onChange={e => handleLabChange(idx, 'priority', e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '5px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '12px' }}
                          >
                            <option value="STAT">STAT</option>
                            <option value="Emergency">Emergency</option>
                            <option value="Urgent">Urgent</option>
                            <option value="Routine">Routine</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveLab(idx)}
                            style={{ background: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', height: '28px', cursor: 'pointer', fontWeight: 700 }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Billing, Summary & Submit */}
              <div style={{ position: 'sticky', top: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Live Invoice Breakdown Card */}
                <div style={{ background: '#0f172a', borderRadius: '14px', padding: '22px', border: '1px solid #1e293b', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
                    <span style={{ fontSize: '18px' }}>🧾</span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>Live Itemized Invoice</h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {formData.patient_type === 'IP' && currentSelectedBed && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <div>
                          <div style={{ color: '#fbbf24', fontWeight: 600 }}>{currentSelectedBed.bed_number} ({currentSelectedBed.ward_name})</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>₹{currentSelectedBed.daily_charge?.toLocaleString()} × {formData.admission_days} Days</div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                          ₹{(Number(currentSelectedBed.daily_charge || 1500) * Number(formData.admission_days || 1)).toLocaleString()}
                        </div>
                      </div>
                    )}

                    {formData.bill_items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <div>
                          <div style={{ color: '#f8fafc' }}>{item.item_name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.item_type} · Qty {item.quantity}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                          ₹{(Number(item.unit_price) * Number(item.quantity)).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid #334155', paddingTop: '14px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>Gross Total:</span>
                      <span style={{ fontWeight: 800, color: '#f8fafc' }}>₹{billSummary.gross.toLocaleString()}</span>
                    </div>

                    {formData.is_insured ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', color: '#38bdf8' }}>
                          <span>Insurance Covered (Limit: ₹{formData.insurance_amount?.toLocaleString()}):</span>
                          <span style={{ fontWeight: 700 }}>₹{billSummary.insurancePortion.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800, color: '#4ade80' }}>
                          <span>Patient Co-Pay Due:</span>
                          <span>₹{billSummary.patientPortion.toLocaleString()}</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800, color: '#f87171' }}>
                        <span>Self-Pay Due:</span>
                        <span>₹{billSummary.net.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Main Create Action Button */}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitPatient}
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      borderRadius: '10px',
                      border: 'none',
                      background: submitting ? '#334155' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      fontSize: '15px',
                      fontWeight: 800,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {submitting ? '⏳ Creating Record in PostgreSQL...' : '🚀 Create Patient & Generate Relational DB Data'}
                  </button>
                </div>

                {/* Quick Helper Reference */}
                <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', padding: '16px', border: '1px solid #1e293b', fontSize: '12px', color: '#94a3b8' }}>
                  <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>🛡️ Enterprise Lifecycle Guarantees:</div>
                  <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.6 }}>
                    <li>Patient ID & Code are fetched from real PostgreSQL sequences.</li>
                    <li>Occupied beds are locked and released atomically upon deletion.</li>
                    <li>Medications are strictly verified against clinical diagnosis.</li>
                  </ul>
                </div>

              </div>

            </div>
          )}
        </>
      )}

      {/* ── TAB 2: 360° EXPLORER & SAFE DEEP DELETION ── */}
      {activeTab === 'manage' && (
        <div style={{ background: '#0f172a', borderRadius: '16px', padding: '28px', border: '1px solid #1e293b' }}>
          <div style={{ maxWidth: '700px', margin: '0 auto 28px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
              🔍 360° Patient Explorer & Cascade Purge Inspector
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 18px 0' }}>
              Search by live <strong>Patient Code</strong> (e.g. <code>MER-PAT-1004426</code>) or <strong>Database ID</strong> (e.g. <code>1004426</code>).
            </p>

            <form onSubmit={handleSearchPatient} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Enter Patient Code (MER-PAT-XXXX) or Database ID..."
                value={searchIdentifier}
                onChange={e => setSearchIdentifier(e.target.value)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '14px' }}
              />
              <button
                type="submit"
                disabled={loadingDetails}
                style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                {loadingDetails ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>

          {deletionResult && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#6ee7b7', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '4px' }}>✓ Patient Purge Completed Successfully</div>
              <div style={{ fontSize: '13px' }}>{deletionResult.message}</div>
            </div>
          )}

          {patientDetails?.patient && (
            <div style={{ background: '#1e293b', borderRadius: '14px', padding: '24px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                      {patientDetails.patient?.first_name} {patientDetails.patient?.last_name}
                    </h3>
                    <span style={{ background: '#0284c7', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                      {patientDetails.patient?.patient_code}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                      (ID: #{patientDetails.patient?.id})
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
                    {patientDetails.patient?.gender} · Age {patientDetails.patient?.age || 40} · Blood Group: {patientDetails.patient?.blood_group} · Phone: {patientDetails.patient?.phone}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(true)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#f87171',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Safe Cascade Delete Patient
                </button>
              </div>

              {/* Relational Summary Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <div style={{ background: '#0f172a', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>ADMISSIONS & BEDS</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>
                    {patientDetails.admissions?.length || 0} Admission(s)
                  </div>
                </div>
                <div style={{ background: '#0f172a', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>DIAGNOSES & VITALS</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                    {patientDetails.diagnoses?.length || 0} Diagnoses
                  </div>
                </div>
                <div style={{ background: '#0f172a', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>MEDICATIONS & LABS</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#a78bfa', marginTop: '4px' }}>
                    {patientDetails.prescriptions?.length || 0} Meds · {patientDetails.lab_orders?.length || 0} Labs
                  </div>
                </div>
                <div style={{ background: '#0f172a', padding: '14px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>BILLS & INSURANCE</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#4ade80', marginTop: '4px' }}>
                    {patientDetails.bills?.length || 0} Invoices ({patientDetails.is_insured ? 'Insured' : 'Self-Pay'})
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: REAL-TIME AVAILABLE BEDS ── */}
      {activeTab === 'beds' && (
        <div style={{ background: '#0f172a', borderRadius: '16px', padding: '24px', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Live Available Hospital Beds ({availableBeds.length} Total)
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '12.5px', margin: '2px 0 0' }}>
                All available beds loaded directly from PostgreSQL with daily room charge rates.
              </p>
            </div>
            <button
              onClick={fetchBeds}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#38bdf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              🔄 Refresh Beds
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {availableBeds.map(b => (
              <div key={b.bed_id} style={{ background: '#1e293b', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 800, fontSize: '15px', color: '#38bdf8' }}>{b.bed_number}</span>
                  <span style={{ background: '#10b981', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                    AVAILABLE
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#f8fafc', fontWeight: 600 }}>{b.ward_name}</div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>{b.bed_type} · Room {b.room_number}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#4ade80', marginTop: '8px' }}>
                  ₹{b.daily_charge?.toLocaleString()} / day
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DANGER CONFIRMATION MODAL FOR DEEP PURGE ── */}
      {deleteModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #ef4444',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ef4444', margin: '0 0 10px 0' }}>
              ⚠️ Confirm Safe Cascaded Patient Deletion
            </h3>
            <p style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 18px 0' }}>
              Are you sure you want to completely purge <strong>{patientDetails?.patient?.first_name} {patientDetails?.patient?.last_name}</strong> (Code: <code>{patientDetails?.patient?.patient_code}</code>, ID: <code>{patientDetails?.patient?.id}</code>)?
            </p>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 24px 0' }}>
              This will safely release occupied beds, remove associated visits, admissions, invoices, prescriptions, labs, and insurance records atomically with zero orphan keys.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                style={{ padding: '9px 18px', borderRadius: '7px', border: '1px solid #334155', background: '#1e293b', color: '#fff', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeletePatient}
                style={{ padding: '9px 18px', borderRadius: '7px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                {deleting ? 'Purging Records...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
