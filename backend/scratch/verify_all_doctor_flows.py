import os, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config, psycopg2.extras
from services.rag_search_service import search_service
from services.rag_generation_service import generation_service

def verify():
    print("=" * 80)
    print("STEP 1: PATIENT 360 CLINICAL DOMAIN TEST FOR DR. PRIYA PATEL")
    print("=" * 80)
    user_priya = {"user_id": 1, "role": "doctor", "name": "Dr. Priya Patel"}
    patient_id_priya = 87241
    admission_id_priya = 87240

    p360_queries = [
        # 1. Clinical Overview & Daily Progression
        "Summarize this patient’s current condition.",
        "Why is this patient still admitted?",
        "What changed since yesterday?",
        "What was the primary reason for admission, and what has progressed since admission date?",
        "Give me a quick 30-second handover summary for rounds.",
        # 2. Vitals & Hemodynamic Trends
        "What are the latest abnormal vital signs?",
        "Show blood pressure and heart rate trends over the last 24 hours.",
        "Has the patient had any episodes of desaturation (SpO2 < 92%) or tachycardia?",
        "What was the patient's temperature trend since morning?",
        # 3. Medications & Orders
        "What medicines is this patient currently receiving?",
        "Are there any active antiplatelet or anticoagulant prescriptions (e.g., Aspirin, Clopidogrel, Heparin)?",
        "What is the current dosage and frequency of their antihypertensive drugs?",
        "Were there any medication changes or held doses in the last 48 hours?",
        # 4. Diagnostic & Lab Results
        "What are the latest lab results?",
        "Show the latest cardiac markers (Troponin I/T, CK-MB) and trend.",
        "Are there any critical lab flags in the complete blood count (CBC) or renal function test (RFT/Creatinine)?",
        "What is the patient’s latest serum potassium and electrolyte status?",
        "What were the HbA1c and lipid profile values on admission?",
        # 5. Radiology & Imaging
        "What did the latest chest X-ray show?",
        "What was the radiologist's final verified conclusion versus the AI preliminary finding?",
        "Is the urgent chest X-ray report ready or still pending radiologist sign-off?",
        "Show the clinical indication for the ordered echocardiogram/CT scan.",
        # 6. Discharge Readiness & Blockers
        "What is pending before this patient can be safely discharged?",
        "Are there any outstanding diagnostic tests, pending consultant notes, or medication reconciliations?",
        "Draft a discharge summary based on verified records.",
        "What discharge instructions and follow-up timeline are recommended for this patient?",
        # 7. Billing & Financial Clearance
        "What is the billing clearance status for this admission?",
        "Is there an outstanding patient balance or pending insurance pre-authorization that blocks discharge?",
        "Has the pharmacy bill and diagnostic package been settled?"
    ]

    for q in p360_queries:
        sources, strat = search_service.search(query=q, area="patient360", user=user_priya,
                                              patient_id=patient_id_priya, admission_id=admission_id_priya)
        top = sources[0] if sources else None
        top_title = top["title"] if top else "NO SOURCE FOUND"
        top_type = top["document_type"] if top else "NONE"
        score = top["relevance_score"] if top else 0.0
        assert len(sources) > 0, f"Query failed to find sources: {q}"
        print(f"✓ P360 [{top_type:24}] (score {score:.2f}) {q[:50]:<50} -> {top_title[:45]}")

    print("\n" + "=" * 80)
    print("STEP 2: DOCTOR WORKSPACE COHORT QUERIES FOR MULTIPLE DOCTORS")
    print("=" * 80)
    cohort_queries = [
        "How many IP, OP, and discharged patients do I have right now?",
        "List all my admitted IP patients with their bed numbers and wards.",
        "Which of my patients have pending high-priority or urgent X-rays?",
        "Which patients under my care have abnormal or critical lab values today?",
        "Which of my patients are currently blocked from discharge and why?",
        "Summarize all pending clinical orders and doctor tasks for today's ward rounds."
    ]

    doctors = [
        {"user_id": 1, "role": "doctor", "name": "Dr. Priya Patel"},
        {"user_id": 4, "role": "doctor", "name": "Dr. Vikram Singh"},
        {"user_id": 5, "role": "doctor", "name": "Dr. Neha Nair"}
    ]

    for doc in doctors:
        print(f"\n--- Cohort for {doc['name']} ---")
        for q in cohort_queries:
            sources, strat = search_service.search(query=q, area="doctor_workspace", user=doc)
            assert len(sources) > 0, f"Cohort query returned no source for {doc['name']}: {q}"
            top = sources[0]
            print(f"✓ [{strat:25}] {q[:55]:<55} | Top: {top['title'][:35]}")

    print("\n" + "=" * 80)
    print("STEP 3: ACCESS CONTROL BOUNDARY ENFORCEMENT")
    print("=" * 80)
    # Find a patient belonging to Dr. Vikram Singh (doc 4)
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT DISTINCT dai.patient_id, dai.first_name, dai.last_name
        FROM dim_admission_inputs dai
        WHERE dai.attending_doctor ILIKE '%Vikram%'
        LIMIT 1
    """)
    vikram_patient = cur.fetchone()
    v_pid = vikram_patient["patient_id"]
    print(f"Dr. Vikram Singh's patient: #{v_pid} ({vikram_patient['first_name']} {vikram_patient['last_name']})")

    # Dr. Priya Patel trying to access Dr. Vikram's patient directly
    try:
        search_service.search(query="Summarize patient condition", area="patient360", user=user_priya, patient_id=v_pid)
        assert False, "Security violation: Dr. Priya Patel was able to access Dr. Vikram Singh's patient!"
    except PermissionError as e:
        print(f"✓ PASS: Dr. Priya Patel blocked from accessing Dr. Vikram Singh's patient #{v_pid}: {e}")

    print("\n" + "=" * 80)
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    verify()
