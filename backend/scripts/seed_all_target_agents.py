import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config, json

conn = db_config.get_db_connection()
cur = conn.cursor()

TARGET_AGENTS = [
    # ── AG-04  Employee Service Agent ─────────────────────────────────────────
    {
        'agent_id': 'AG-04',
        'name': 'Employee Service Agent',
        'name_ta': 'பணியாளர் சேவை முகவர்',
        'type': 'Internal Staff Chatbot',
        'version': '1.7.0',
        'owner': 'HR Operations & Clinical Directorate',
        'risk_tier': 'Low',
        'status': 'Published',
        'human_approval': 'None',
        'purpose': 'Provide 24/7 conversational assistance to hospital doctors, nurses, technicians, and staff for shift timings, duty rosters, leave & comp-off balance ledger queries, and leave filings with live PostgreSQL grounding.',
        'last_run': '10:20 AM',
        'success_rate': '98.5%',
        'runs': 842,
        'instructions': {
            'objective': 'Automate employee self-service inquiries for shift timing, duty rosters, leave balance tracking, and leave filings with 100% verified PostgreSQL roster grounding.',
            'system': 'You are the Hospital Employee Service Agent (AG-04 · பணியாளர் சேவை முகவர்). Provide conversational HR and roster assistance to hospital staff (doctors, nurses, technicians, admin). Query PostgreSQL tables (staff_rosters, employee_leave_balances, employee_leave_requests) to fetch accurate shift schedules, reconcile leave quotas (Comp-off, Casual, Sick, Earned), apply leaves, and cite authoritative hospital HR policies. Never provide clinical medical advice or diagnose patients.',
            'rules': 'Present duty shifts clearly with date, duty hours (e.g., Morning 07:00 AM - 03:00 PM), department/ward, and on-call status. Display leave balances in itemized format with available quotas. Support bilingual English and Tamil (தமிழ்) responses. Record all leave filings with timestamp and supervisor routing.',
            'safety': 'Strictly restricted to internal hospital employee operations. Refuse patient clinical queries, medication advice, or prescription modifications. Mask employee salaries and confidential HR disciplinary records. Ensure leave filings check ward nursing coverage rules.',
            'escalation': 'Escalate shift clashes, emergency leave rejections, or policy disputes to the HR Operations Head (ext. 4401) and Ward Nursing Supervisor.',
            'refusal': 'I cannot answer medical or patient-care queries. I am your Employee Service Agent for HR and duty schedules. For patient care, please use clinical copilot or consult attending physician.'
        },
        'tools': [
            {'tool': 'PostgreSQL Roster Engine', 'perm': 'Query live duty rosters, shift timings & on-call schedules from staff_rosters', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Leave Balance Ledger', 'perm': 'Fetch employee leave balances (Casual, Sick, Comp-off, Earned)', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Leave Filing Engine', 'perm': 'Create and submit new leave requests into employee_leave_requests', 'read': True, 'write': True, 'appr': 'Supervisor', 'enabled': True},
            {'tool': 'HR Policy v5.0 Knowledge Engine', 'perm': 'Search hospital HR policies, shift allowances & benefits', 'read': True, 'write': False, 'appr': 'None', 'enabled': True}
        ],
        'knowledge': [
            {'t': 'HR Leave & Attendance Policy v5.0', 'v': '5.0', 'eff': '01 Jan 2026', 'status': 'Published'},
            {'t': 'Nursing Shift Allowance & Roster SOP', 'v': '3.2', 'eff': '15 Mar 2026', 'status': 'Published'},
            {'t': 'Employee Health & Dependent Medical Benefit Scheme', 'v': '2.4', 'eff': '01 Jun 2026', 'status': 'Published'}
        ],
        'memory': {'session': 'On · 30 min', 'patient': 'Staff-scoped', 'workflow': 'On', 'retention': '90 days (audit) · 0 days (conversation)', 'sensitive': 'No free-text PHI stored'},
        'access': {'roles': 'HR, Hospital Management, Doctors, Nurses, Technicians, Admin', 'departments': 'All Wards, ICUs, Labs, OT, Admin', 'patients': 'Staff-scoped', 'scopes': 'Operational HR read/write', 'env': 'Production'},
        'model': {'model': 'meridian-llm-large', 'temperature': 0.2, 'tokens': 8000, 'fallback': 'meridian-llm-small', 'latency': '< 1.5 s p50', 'cost': '₹4 / run'},
        'evals': [
            {'id': 'EV-704', 'ver': 'v1.7.0', 'when': 'Today 09:30', 'cases': 180, 'acc': '98.5%', 'ground': '99.2%', 'hall': '0.1%', 'ref': '100%', 'lat': '1.2s', 'res': 'Pass'},
            {'id': 'EV-650', 'ver': 'v1.6.0', 'when': '15 Sep 2026', 'cases': 120, 'acc': '95.8%', 'ground': '97.4%', 'hall': '0.3%', 'ref': '99%', 'lat': '1.4s', 'res': 'Pass'}
        ],
        'versions': [
            {'v': '1.7.0', 'ts': 'Today', 'author': 'AI Engineering', 'changes': 'Added live PostgreSQL staff_rosters sync and bilingual Tamil HR response templates', 'score': '98.5', 'state': 'Published', 'bg': '#dcfce7', 'fg': '#15803d'},
            {'v': '1.6.0', 'ts': '21 days ago', 'author': 'HR Ops', 'changes': 'Added leave balance ledger integration', 'score': '95.8', 'state': 'Archived', 'bg': '#f1f5f9', 'fg': '#475569'}
        ],
        'managed_state': 'Configurable • Dynamic'
    },

    # ── AG-07  Insurance Preauth Agent ────────────────────────────────────────
    {
        'agent_id': 'AG-07',
        'name': 'Insurance Preauth Agent',
        'name_ta': 'காப்பீட்டு முன்அனுமதி முகவர்',
        'type': 'Workflow & Decision Agent',
        'version': '2.4.0',
        'owner': 'Insurance Desk & TPA Liaison',
        'risk_tier': 'High',
        'status': 'Published',
        'human_approval': 'Selective • Insurance Lead',
        'purpose': 'Autonomously assemble structured Pre-Authorization Submission Dossiers with bilingual clinical justifications, package estimates, and denial risk assessments for TPA / Insurer review.',
        'last_run': 'Just now',
        'success_rate': '97.6%',
        'runs': 620,
        'instructions': {
            'objective': 'Autonomously assemble structured Pre-Authorization Submission Dossiers for TPA & insurer review with 100% verified EMR grounding and bilingual justifications.',
            'system': 'You are the Hospital Insurance Preauth Agent (AG-07 / காப்பீட்டு முன்அனுமதி முகவர்). Your duty is to autonomously assemble a complete, structured Preauth Submission Dossier for TPA/Insurance review. You must generate bilingual clinical justifications in English and Tamil (தமிழ்). Keep clinical justifications structured, crisp, and easily readable with clear distinct points (Presentation & Indication, Risk & Monitoring, Medical Necessity & Interventions, Expected Outcomes) separated by line breaks. Calculate checklist verification, medical necessity justification, itemized billing summary, and denial risk breakdown. Output MUST be valid JSON matching the requested structure.',
            'rules': 'Generate bilingual clinical justifications in English and Tamil (தமிழ்). Structure clinical justification points by Indication, Risk, Interventions, and Outcomes. Calculate itemized billing breakdown and denial risk assessment. Strict JSON schema output.',
            'safety': 'Refuse clinical diagnosis changes or unauthorized procedure codes. Ground all medical justifications strictly on attending physician notes. Mask sensitive patient identifiers for external review.',
            'escalation': 'Escalate claims with denial risk > 35% or missing doctor signature to Senior TPA Liaison (L. Fathima) and Attending Physician.',
            'refusal': 'Insufficient clinical EMR evidence to formulate an authorized pre-authorization request safely. Route to Insurance Desk.'
        },
        'tools': [
            {'tool': 'EMR Clinical History & Notes API', 'perm': 'Fetch admission indications, diagnoses & doctor operative orders', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Insurance Policy & Tariff Ledger', 'perm': 'Verify TPA network coverage limits, waiting periods & copay clauses', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Preauth Dossier Generator', 'perm': 'Assemble bilingual justification package & submit to TPA portal', 'read': True, 'write': True, 'appr': 'Selective', 'enabled': True},
            {'tool': 'Denial Risk AI Assessor', 'perm': 'Evaluate 17-criteria statutory checklist & compute denial probability', 'read': True, 'write': False, 'appr': 'None', 'enabled': True}
        ],
        'knowledge': [
            {'t': 'IRDAI Cashless Pre-Authorization Guidelines 2026', 'v': '4.1', 'eff': '01 Jan 2026', 'status': 'Published'},
            {'t': 'TPA Package Rates & Exclusion Schedule FY26-27', 'v': '3.0', 'eff': '01 Apr 2026', 'status': 'Published'},
            {'t': 'Hospital Preauth Clinical Justification SOP v2.8', 'v': '2.8', 'eff': '15 May 2026', 'status': 'Published'}
        ],
        'memory': {'session': 'On · 30 min', 'patient': 'Encounter-scoped', 'workflow': 'On', 'retention': '90 days (audit) · 0 days (conversation)', 'sensitive': 'No free-text PHI stored'},
        'access': {'roles': 'Insurance Desk, TPA Liaison, Hospital Management, Doctors', 'departments': 'All Inpatient Wards, ICUs, OT, Billing', 'patients': 'Care-team relationship required', 'scopes': 'Clinical read + Insurance write', 'env': 'Production'},
        'model': {'model': 'openai/gpt-oss-120b (Groq LPU Inference)', 'temperature': 0.1, 'tokens': 8000, 'fallback': 'gemini-3.5-flash-lite', 'latency': '< 1.8 s p50', 'cost': '₹16 / run'},
        'evals': [
            {'id': 'EV-707', 'ver': 'v2.4.0', 'when': 'Today 10:15', 'cases': 140, 'acc': '97.6%', 'ground': '98.9%', 'hall': '0.1%', 'ref': '100%', 'lat': '1.6s', 'res': 'Pass'}
        ],
        'versions': [
            {'v': '2.4.0', 'ts': 'Today', 'author': 'AI Engineering', 'changes': 'Added bilingual Tamil preauth justification synthesis & 17-criteria statutory audit', 'score': '97.6', 'state': 'Published', 'bg': '#dcfce7', 'fg': '#15803d'}
        ],
        'managed_state': 'Configurable • Dynamic'
    },

    # ── AG-08  Billing Transparency Agent ─────────────────────────────────────
    {
        'agent_id': 'AG-08',
        'name': 'Billing Transparency Agent',
        'name_ta': 'கட்டண வெளிப்படைத்தன்மை முகவர்',
        'type': 'Workflow Agent',
        'version': '2.0.0',
        'owner': 'Finance & Billing',
        'risk_tier': 'High',
        'status': 'Published',
        'human_approval': 'Optional',
        'purpose': 'Assist Billing Desk & Cashier with automated plain-language English & Tamil breakdown of variance items under human oversight.',
        'last_run': '11:24',
        'success_rate': '96.4%',
        'runs': 342,
        'instructions': {
            'objective': 'Translate complex surgical consumable charges, billing variances (>10%), and itemized tariffs into crystal-clear plain English & Tamil explanations grounded in doctor OT notes.',
            'system': 'You are AG-08 Billing Transparency Agent (கட்டண வெளிப்படைத்தன்மை முகவர்) at Meridian Super Speciality Hospital. Your job is to translate technical hospital billing items, consumable codes, and doctor OT notes into crystal clear, empathetic, non-technical explanations in BOTH English and Tamil (தமிழ்). The explanation must be so clear that a hospital cashier can read it to the patient\'s family in 15 seconds, and the family immediately understands why the charge was medically necessary. Respond strictly in valid JSON format.',
            'rules': 'Provide bilingual explanations in English and natural spoken Tamil (தமிழ்). Cite verbatim clinical quotes from doctor intra-operative notes. Itemize top variance drivers with amounts and layman-friendly rationale. Strict valid JSON format.',
            'safety': 'Never alter hospital audited tariffs autonomously. Do not promise discounts without Medical Superintendent / Cashier sign-off. Ensure zero phantom consumable billing.',
            'escalation': 'Escalate variance > 50% or billing disputes without EMR intra-op justification to Chief Financial Officer and Senior Billing Auditor.',
            'refusal': 'Unable to verify billing variance against clinical EMR documentation safely. Route to Financial Counseling Desk.'
        },
        'tools': [
            {'tool': 'Billing Desk API', 'perm': 'Read Itemized Consumable Lines, Unit Prices & Running Totals', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Estimate Ledger', 'perm': 'Compare Charges Against Pre-Admission Estimate (>10% Variance)', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'EMR & OT Notes API', 'perm': 'Extract Intra-Operative Notes & Doctor Clinical Orders', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Document Generator', 'perm': 'Assemble Plain Bilingual Breakdown & Print to Invoice', 'read': True, 'write': True, 'appr': 'Cashier Sign-off', 'enabled': True}
        ],
        'knowledge': [
            {'t': 'Tariff Schedule FY26-27 & Package Exclusions', 'v': '3.4', 'eff': '01 Apr 2026', 'status': 'Published'},
            {'t': 'Clinical Consumables & Implant Nomenclature', 'v': '2.1', 'eff': '01 Jun 2026', 'status': 'Published'},
            {'t': 'Tamil Medical Lexicon & Layman Standards', 'v': '1.8', 'eff': '15 Jul 2026', 'status': 'Published'}
        ],
        'memory': {'session': 'On · 30 min', 'patient': 'Encounter-scoped', 'workflow': 'On', 'retention': '90 days (audit) · 0 days (conversation)', 'sensitive': 'No free-text PHI stored'},
        'access': {'roles': 'Billing Staff, Hospital Cashiers, Ward Administrators, Finance Lead', 'departments': 'All wards', 'patients': 'Care-team relationship required', 'scopes': 'Financial + clinical read (no medical prescription write)', 'env': 'Production'},
        'model': {'model': 'openai/gpt-oss-120b (Groq LPU Inference)', 'temperature': 0.2, 'tokens': 8000, 'fallback': 'gemini-3.5-flash-lite', 'latency': '< 1,500 ms', 'cost': '₹18 / run'},
        'evals': [
            {'id': 'EV-708', 'ver': 'v2.0.0', 'when': 'Today 11:20', 'cases': 120, 'acc': '96.4%', 'ground': '98.2%', 'hall': '0.2%', 'ref': '99%', 'lat': '1.4s', 'res': 'Pass'}
        ],
        'versions': [
            {'v': '2.0.0', 'ts': 'Active Live', 'author': 'AI Engineering', 'changes': 'Groq openai/gpt-oss-120b bilingual English & Tamil synthesis', 'score': '96.4', 'state': 'Published', 'bg': '#dcfce7', 'fg': '#15803d'}
        ],
        'managed_state': 'Configurable • Dynamic'
    },

    # ── AG-18  Nursing Handover Agent ─────────────────────────────────────────
    {
        'agent_id': 'AG-18',
        'name': 'Nursing Handover Agent',
        'name_ta': 'செவிலியர் ஒப்படைப்பு முகவர்',
        'type': 'Clinical Shift Co-Pilot',
        'version': '2.2.0',
        'owner': 'Nursing Directorate & Clinical Quality',
        'risk_tier': 'High',
        'status': 'Published',
        'human_approval': 'Mandatory • Registered Nurse Sign-off',
        'purpose': 'Synthesize patient EMR vitals, MAR medication administration records, and clinical orders into structured SBAR shift handover notes with high-alert medication safety guardrails.',
        'last_run': '07:45 AM',
        'success_rate': '99.1%',
        'runs': 1240,
        'instructions': {
            'objective': 'Synthesize shift EMR data, bedside vitals, and MAR charts into structured SBAR (Situation, Background, Assessment, Recommendation) clinical handovers for ward nurses.',
            'system': 'You are the Meridian Hospital Nursing Handover Agent (AG-18 · செவிலியர் ஒப்படைப்பு முகவர்). You operate with clinical summarisation precision for registered nurses during ward shift changes. Clinical Governance SOPs in effect: Medication Safety — High-alert drugs v4.0 (Mandatory dual-nurse verification on Insulin, Heparin, Vancomycin, Narcotics), Medication Safety — Ward administration v3.2 (5 rights of drug administration & allergy cross-check), Standard SBAR Structure: Situation, Background, Assessment, Recommendation. Generate a structured, professional, concise clinical handover draft. Respond ONLY with a valid JSON object.',
            'rules': 'Strict adherence to 4-part SBAR format. Highlight high-alert medications (Insulin, Heparin, Narcotics) with dual-sign-off warnings. Flag pending lab orders with critical timeline triggers. Output valid structured JSON.',
            'safety': 'Never omit known allergies or abnormal Early Warning Scores (EWS). Require registered nurse sign-off before committing handover to EHR. Refuse alteration of doctor prescription orders.',
            'escalation': 'Trigger immediate red-flag alert to Ward Nursing Supervisor and On-Call Medical Officer for deteriorating vitals (EWS >= 5 or SpO2 < 92%).',
            'refusal': 'Insufficient shift vitals and EMR data to construct a safe SBAR handover note. Route to Ward In-Charge.'
        },
        'tools': [
            {'tool': 'Ward EMR & Bedside Vitals Engine', 'perm': 'Fetch real-time BP, HR, SpO2, Temp, RR & compute MEWS', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'MAR Pharmacy Verification API', 'perm': 'Cross-verify 5 rights of drug administration & dual-sign-off on high-alert meds', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'SBAR Handover Compiler', 'perm': 'Compile and commit structured clinical handover note to inpatient chart', 'read': True, 'write': True, 'appr': 'Nurse Sign-off', 'enabled': True}
        ],
        'knowledge': [
            {'t': 'Nursing Clinical Handover & SBAR SOP v4.2', 'v': '4.2', 'eff': '01 Jan 2026', 'status': 'Published'},
            {'t': 'Medication Safety — High-Alert Drugs SOP v4.0', 'v': '4.0', 'eff': '15 Feb 2026', 'status': 'Published'},
            {'t': 'Modified Early Warning Score (MEWS) Escalation Protocol', 'v': '3.1', 'eff': '01 Jun 2026', 'status': 'Published'}
        ],
        'memory': {'session': 'On · 30 min', 'patient': 'Encounter-scoped', 'workflow': 'On', 'retention': '90 days (audit) · 0 days (conversation)', 'sensitive': 'No free-text PHI stored'},
        'access': {'roles': 'Ward Nurses, Nursing Supervisors, Duty Doctors, Medical Officers', 'departments': 'All Inpatient Wards, ICUs, HDU, Post-Op', 'patients': 'Ward-assigned patients', 'scopes': 'Clinical read + Handover write', 'env': 'Production'},
        'model': {'model': 'openai/gpt-oss-120b (Groq LPU Inference)', 'temperature': 0.2, 'tokens': 8000, 'fallback': 'gemini-3.5-flash-lite', 'latency': '< 1.2 s p50', 'cost': '₹12 / run'},
        'evals': [
            {'id': 'EV-718', 'ver': 'v2.2.0', 'when': 'Today 07:45', 'cases': 210, 'acc': '99.1%', 'ground': '99.6%', 'hall': '0.0%', 'ref': '100%', 'lat': '1.1s', 'res': 'Pass'}
        ],
        'versions': [
            {'v': '2.2.0', 'ts': 'Today', 'author': 'Clinical Quality', 'changes': 'Added high-alert medication safety dual sign-off warnings and MEWS deterioration triggers', 'score': '99.1', 'state': 'Published', 'bg': '#dcfce7', 'fg': '#15803d'}
        ],
        'managed_state': 'Configurable • Dynamic'
    },

    # ── AG-20  Claim Denial Agent ─────────────────────────────────────────────
    {
        'agent_id': 'AG-20',
        'name': 'Claim Denial Agent',
        'name_ta': 'காப்பீட்டு மறுப்பு மேல்முறையீட்டு முகவர்',
        'type': 'Revenue & Legal Appeal Agent',
        'version': '2.1.0',
        'owner': 'Revenue Cycle & TPA Appeals',
        'risk_tier': 'High',
        'status': 'Published',
        'human_approval': 'Mandatory • 1-Click Human Submission',
        'purpose': 'Autonomous detection of claim deductions, EMR clinical proof extraction, IRDAI denial classification, and legal medical appeal dossier generation.',
        'last_run': '11:05 AM',
        'success_rate': '97.2%',
        'runs': 480,
        'instructions': {
            'objective': 'Detect insurance claim shortfalls, extract clinical EMR evidence, classify denial reasons under IRDAI/ICD-10 standards, and generate legally rigorous reconsideration appeal dossiers.',
            'system': 'You are the AG-20 Claim Denial & Shortfall Appeal Agent (காப்பீட்டு மறுப்பு மேல்முறையீட்டு முகவர்) for Meridian Hospital. Your role is to detect claim deductions and shortfalls, extract clinical evidence from patient EMR (operative notes, lab reports, vitals), classify denial codes under IRDAI/ICD-10 standards, and generate formal, legally rigorous medical appeal dossiers for 1-click submission to TPAs and insurers.',
            'rules': 'Cite statutory IRDAI Master Circular clauses, policy terms, and NABH guidelines. Include itemized rejected line-item rebuttals. Generate bilingual summaries for hospital leadership and patients.',
            'safety': 'Strictly prohibit fabrication of non-existent medical notes. Re-submission is strictly gated and blocked if required clinical evidence or doctor certifications are missing.',
            'escalation': 'Escalate full claim rejections > ₹50,000 or contentious policy exclusions to Revenue Cycle Lead (R. Sundar) and TPA Liaison (L. Fathima).',
            'refusal': 'Claim denial categorized as non-payable permanent exclusion under policy terms. Formal appeal not viable without new clinical indication.'
        },
        'tools': [
            {'tool': 'Insurance Claim Deduction Parser', 'perm': 'Detect rejected line items, shortfalls & deduction reason codes', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Clinical EMR Proof Retriever', 'perm': 'Extract intra-op notes, diagnostic findings & conservative therapy timelines', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'IRDAI Statutory Rules Classifier', 'perm': 'Map denial to statutory IRDAI clauses & policy exclusions', 'read': True, 'write': False, 'appr': 'None', 'enabled': True},
            {'tool': 'Appeal Dossier Generator & TPA Dispatch Bus', 'perm': 'Draft formal appeal letters & 1-click submit to TPA portal', 'read': True, 'write': True, 'appr': '1-Click Submission', 'enabled': True}
        ],
        'knowledge': [
            {'t': 'IRDAI Master Circular on Health Insurance Claims 2026', 'v': '5.0', 'eff': '01 Jan 2026', 'status': 'Published'},
            {'t': 'Hospital Medical Appeal Precedents & Legal Rebuttals', 'v': '3.2', 'eff': '15 Mar 2026', 'status': 'Published'},
            {'t': 'ICD-10-CM Medical Necessity Documentation Standard', 'v': '2.6', 'eff': '01 Jun 2026', 'status': 'Published'}
        ],
        'memory': {'session': 'On · 30 min', 'patient': 'Encounter-scoped', 'workflow': 'On', 'retention': '90 days (audit) · 0 days (conversation)', 'sensitive': 'No free-text PHI stored'},
        'access': {'roles': 'Revenue Cycle Lead, TPA Liaison, Hospital Billing, Finance Admin', 'departments': 'All Inpatient Wards, Billing, Legal', 'patients': 'Care-team relationship required', 'scopes': 'Revenue + clinical read + appeal write', 'env': 'Production'},
        'model': {'model': 'openai/gpt-oss-120b (Groq LPU Inference)', 'temperature': 0.1, 'tokens': 8000, 'fallback': 'gemini-3.5-flash-lite', 'latency': '< 1.6 s p50', 'cost': '₹20 / run'},
        'evals': [
            {'id': 'EV-720', 'ver': 'v2.1.0', 'when': 'Today 11:05', 'cases': 160, 'acc': '97.2%', 'ground': '99.0%', 'hall': '0.1%', 'ref': '99%', 'lat': '1.5s', 'res': 'Pass'}
        ],
        'versions': [
            {'v': '2.1.0', 'ts': 'Today', 'author': 'Revenue Engineering', 'changes': 'Added IRDAI 2026 master circular clauses & automatic clinical evidence retrieval', 'score': '97.2', 'state': 'Published', 'bg': '#dcfce7', 'fg': '#15803d'}
        ],
        'managed_state': 'Configurable • Dynamic'
    }
]

for ag in TARGET_AGENTS:
    cur.execute('''
        INSERT INTO agent_configurations (
            agent_id, name, name_ta, type, version, owner, risk_tier, status,
            human_approval, purpose, instructions, tools, knowledge, memory, access,
            model, evals, versions, managed_state, last_run, success_rate, runs
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (agent_id) DO UPDATE SET
            name = EXCLUDED.name,
            name_ta = EXCLUDED.name_ta,
            type = EXCLUDED.type,
            version = EXCLUDED.version,
            owner = EXCLUDED.owner,
            risk_tier = EXCLUDED.risk_tier,
            status = EXCLUDED.status,
            human_approval = EXCLUDED.human_approval,
            purpose = EXCLUDED.purpose,
            instructions = EXCLUDED.instructions,
            tools = EXCLUDED.tools,
            knowledge = EXCLUDED.knowledge,
            memory = EXCLUDED.memory,
            access = EXCLUDED.access,
            model = EXCLUDED.model,
            evals = EXCLUDED.evals,
            versions = EXCLUDED.versions,
            managed_state = EXCLUDED.managed_state,
            last_run = EXCLUDED.last_run,
            success_rate = EXCLUDED.success_rate,
            runs = EXCLUDED.runs,
            updated_at = NOW();
    ''', (
        ag['agent_id'], ag['name'], ag['name_ta'],
        ag['type'], ag['version'], ag['owner'],
        ag['risk_tier'], ag['status'], ag['human_approval'],
        ag['purpose'],
        json.dumps(ag['instructions']), json.dumps(ag['tools']),
        json.dumps(ag['knowledge']), json.dumps(ag['memory']),
        json.dumps(ag['access']), json.dumps(ag['model']),
        json.dumps(ag['evals']), json.dumps(ag['versions']),
        ag['managed_state'],
        ag['last_run'], ag['success_rate'], ag['runs']
    ))
    print(f"Upserted {ag['agent_id']} ({ag['name']}) successfully.")

conn.commit()
cur.close()
conn.close()
print("All 5 target agents successfully synchronized with database.")
