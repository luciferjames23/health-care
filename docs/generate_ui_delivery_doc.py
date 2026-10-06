import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def generate_document():
    doc = docx.Document()

    # Page Margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    # Styles & Fonts
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(40, 50, 60)

    # Colors
    NAVY = RGBColor(30, 58, 138)       # #1E3A8A
    TEAL = RGBColor(13, 148, 136)     # #0D9488
    DARK_SLATE = RGBColor(15, 23, 42) # #0F172A
    SLATE = RGBColor(100, 116, 139)   # #64748B
    RED_BADGE = RGBColor(185, 28, 28) # #B91C1C
    LIGHT_BORDER = RGBColor(226, 232, 240) # #E2E8F0

    # Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)
    r_t1 = p_title.add_run("MERIDIAN HEALTHCARE PLATFORM · USER INTERFACE & DELIVERY GUIDE\n")
    r_t1.font.bold = True
    r_t1.font.size = Pt(16.0)
    r_t1.font.color.rgb = NAVY
    r_t2 = p_title.add_run("How End Users Interact with Our 16 Hospital AI Agents")
    r_t2.font.bold = True
    r_t2.font.size = Pt(16.0)
    r_t2.font.color.rgb = NAVY

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(2)
    p_sub.paragraph_format.space_after = Pt(12)
    r_sub = p_sub.add_run("Clear Breakdown: Conversational Chatbot vs. Embedded Workflow Automation (Like Discharge Summary Agent AG-19) vs. Background Sentinel")
    r_sub.font.size = Pt(11.0)
    r_sub.font.color.rgb = SLATE

    doc.add_paragraph().paragraph_format.space_after = Pt(2)

    # Table 0: Metadata Banner
    t0 = doc.add_table(rows=1, cols=3)
    t0.alignment = WD_TABLE_ALIGNMENT.CENTER
    t0.autofit = False

    banner_data = [
        ("Analyzed Agents", "16 Hospital Agents"),
        ("Excluded (Pre-set)", "5 Standard Flow Agents"),
        ("UI Delivery Paradigms", "Workflows · Chatbots · Sentinels")
    ]
    for i, (col_label, col_val) in enumerate(banner_data):
        cell = t0.cell(0, i)
        cell.width = Inches(2.2)
        set_cell_background(cell, "F1F5F9")
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r_lbl = p.add_run(col_label + "\n")
        r_lbl.font.size = Pt(8.0)
        r_lbl.font.bold = True
        r_lbl.font.color.rgb = SLATE
        r_val = p.add_run(col_val)
        r_val.font.size = Pt(10.0)
        r_val.font.bold = True
        r_val.font.color.rgb = NAVY

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Section 1
    p_s1 = doc.add_paragraph()
    p_s1.paragraph_format.space_before = Pt(12)
    p_s1.paragraph_format.space_after = Pt(4)
    r_s1 = p_s1.add_run("1. Executive Summary & Delivery Archetypes")
    r_s1.font.bold = True
    r_s1.font.size = Pt(15.0)
    r_s1.font.color.rgb = NAVY

    p_body1 = doc.add_paragraph()
    p_body1.paragraph_format.space_after = Pt(10)
    p_body1.add_run("A critical question in hospital AI deployment is: ")
    r_b_bold = p_body1.add_run("Does the end user type into a chatbot, or does the AI run automatically as a workflow automation with structured screens and 1-click buttons (like our Discharge Summary Agent AG-19)?\n\n")
    r_b_bold.font.bold = True
    p_body1.add_run("In healthcare, forcing doctors and nurses to chat with a bot for everything slows them down and causes fatigue. Therefore, our 16 agents are purposefully mapped into 4 distinct user interaction modes based on clinical safety and operational speed:")

    # Table 1: Interaction Modes
    t1_data = [
        ("Interaction Mode", "How End User Experiences It", "Agents in this Category"),
        (
            "Category 1: Workflow Automation (Like AG-19)",
            "Triggered automatically by DB events. Pre-fills cards, tables, and dossiers. User reviews and clicks 'Approve' or 'Submit' in 1 click (NO typing).",
            "AG-07 (Insurance Preauth), AG-08 (Billing Transparency), AG-10 (Diagnostic Coordination), AG-18 (Nursing Handover), AG-19 (Discharge Summary), AG-20 (Claim Denial)"
        ),
        (
            "Category 2: Conversational Chat & Voice AI",
            "Interactive chat box or phone audio stream where the user asks natural questions and the agent replies with answers and links.",
            "AG-04 (Employee HR Chat), AG-12 (Spoken Phone AI), AG-13 (Nursing Protocol Chat), AG-17 (Doctor Voice Scribe)"
        ),
        (
            "Category 3: Background Monitor & Alert Push",
            "Runs 24/7 in the background without user prompt. Updates TV screens, calculates wait times, or sends WhatsApp/SMS alerts directly to users.",
            "AG-05 (Discharge Feedback), AG-06 (Queue / Wait Times), AG-11 (Post-Discharge Recovery), AG-15 (Bed Surge Forecasting)"
        ),
        (
            "Category 4: Hybrid Executive Copilot",
            "Combines an analytical dashboard (live KPI cards and distribution charts) with a natural-language query prompt for hospital directors.",
            "AG-14 (Analytics Agent), AG-21 (Management Copilot)"
        )
    ]

    t1 = doc.add_table(rows=len(t1_data), cols=3)
    t1.alignment = WD_TABLE_ALIGNMENT.CENTER
    t1.autofit = False

    for r_idx, (col0, col1, col2) in enumerate(t1_data):
        for c_idx, val in enumerate([col0, col1, col2]):
            cell = t1.cell(r_idx, c_idx)
            if c_idx == 0:
                cell.width = Inches(1.8)
            elif c_idx == 1:
                cell.width = Inches(2.7)
            else:
                cell.width = Inches(2.3)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            if r_idx == 0:
                set_cell_background(cell, "1E3A8A")
                r = p.add_run(val)
                r.font.bold = True
                r.font.size = Pt(9.5)
                r.font.color.rgb = RGBColor(255, 255, 255)
            else:
                bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
                set_cell_background(cell, bg)
                r = p.add_run(val)
                r.font.size = Pt(9.0)
                if c_idx == 0:
                    r.font.bold = True
                    r.font.color.rgb = NAVY

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Section 2
    p_s2 = doc.add_paragraph()
    p_s2.paragraph_format.space_before = Pt(12)
    p_s2.paragraph_format.space_after = Pt(6)
    r_s2 = p_s2.add_run("2. Master User Interface & Delivery Matrix (16 Agents)")
    r_s2.font.bold = True
    r_s2.font.size = Pt(15.0)
    r_s2.font.color.rgb = NAVY

    # Table 2: Master Matrix
    t2_data = [
        ("ID", "Agent Name", "Delivery Mode", "What the User Sees on Screen", "Primary User", "User Action"),
        ("AG-07", "Insurance Preauth", "Workflow Automation", "Preauth Dossier Card with checklist & denial risk badge", "Insurance Desk", "1-Click 'Submit to TPA'"),
        ("AG-08", "Billing Transparency", "Workflow Automation", "Plain-language charge explanation card & variance flag", "Cashier / Patient", "Review plain breakdown"),
        ("AG-10", "Diagnostic Coordination", "Workflow Automation", "Order status tracker, fasting/prep checklist & critical panic lab alerts", "Lab Tech / Ward Nurse", "1-Click 'Acknowledge Alert'"),
        ("AG-18", "Nursing Handover", "Workflow Automation", "Bedside SBAR handover cards with vitals & EWS scores", "Ward Nurses", "1-Tap 'Acknowledge'"),
        ("AG-19", "Discharge Summary", "Workflow Automation", "Generated 4-page NABH summary draft with allergy audit", "Doctor", "1-Click 'Sign & Finalize'"),
        ("AG-20", "Claim Denial", "Workflow Automation", "Appeal Dossier Drawer with retrieved clinical evidence", "Insurance Desk", "1-Click 'Submit Appeal'"),
        ("AG-04", "Employee Service", "Internal Staff Chat", "Chat widget in staff portal for shift & leave checks", "Staff / Nurses", "Type / Voice question"),
        ("AG-12", "Contact Centre", "Spoken Voice AI", "Zero screen (Telephone call in spoken Tamil/English)", "Calling Patients", "Speaks on phone"),
        ("AG-13", "AI Trainer", "Protocol Chatbot", "Search/Chat panel on nursing computers for clinical SOPs", "Junior Nurses", "Ask drug dilution rule"),
        ("AG-17", "Voice Documentation", "Dictation Scribe", "Microphone button in EMR; auto-fills SOAP note fields", "Doctor", "Tap Record & Speak"),
        ("AG-06", "Queue / Flow", "Background Monitor", "Waiting lobby TV screen & patient SMS token updates", "Waiting Patients", "View live wait time"),
        ("AG-15", "Forecasting", "Background Monitor", "7-Day Bed Demand Forecast card with shortage alerts", "COO / Bed Manager", "Allocate buffer beds"),
        ("AG-05", "Feedback", "Automated SMS/Bot", "WhatsApp survey on patient phone & grievance ticket in UI", "Discharged Patient", "Tap 1-10 NPS rating"),
        ("AG-11", "Follow-up", "Automated SMS/Bot", "Timed WhatsApp check-ins on Day 3, 7, and 14 post-op", "Recovering Patient", "Reply to recovery check"),
        ("AG-14", "Analytics", "Hybrid Dashboard", "KPI cards (Occupancy, Revenue) + Text-to-SQL search bar", "Medical Director", "Type analytical query"),
        ("AG-21", "Management Copilot", "Hybrid Copilot", "Cross-department bottleneck feed + CEO strategy chat", "Hospital CEO", "Ask bottleneck root cause")
    ]

    t2 = doc.add_table(rows=len(t2_data), cols=6)
    t2.alignment = WD_TABLE_ALIGNMENT.CENTER
    t2.autofit = False

    col_widths = [Inches(0.6), Inches(1.3), Inches(1.2), Inches(1.9), Inches(1.0), Inches(1.0)]

    for r_idx, row in enumerate(t2_data):
        for c_idx, val in enumerate(row):
            cell = t2.cell(r_idx, c_idx)
            cell.width = col_widths[c_idx]
            set_cell_margins(cell, top=60, bottom=60, left=60, right=60)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            if r_idx == 0:
                set_cell_background(cell, "1E3A8A")
                r = p.add_run(val)
                r.font.bold = True
                r.font.size = Pt(8.5)
                r.font.color.rgb = RGBColor(255, 255, 255)
            else:
                bg = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
                set_cell_background(cell, bg)
                r = p.add_run(val)
                r.font.size = Pt(8.0)
                if c_idx == 0:
                    r.font.bold = True
                    r.font.color.rgb = NAVY
                elif c_idx == 1:
                    r.font.bold = True

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # Section 3
    p_s3 = doc.add_paragraph()
    p_s3.paragraph_format.space_before = Pt(14)
    p_s3.paragraph_format.space_after = Pt(8)
    r_s3 = p_s3.add_run("3. Detailed UI Breakdown & Real-World Interaction for Each Agent")
    r_s3.font.bold = True
    r_s3.font.size = Pt(16.0)
    r_s3.font.color.rgb = NAVY

    def add_agent_block(
        agent_id,
        name_en,
        name_ta,
        delivery_mode,
        primary_user,
        chatbot_vs_workflow,
        what_user_sees,
        scenario,
        comparison_title,
        comparison_text
    ):
        # Header line
        p_hdr = doc.add_paragraph()
        p_hdr.paragraph_format.space_before = Pt(10)
        p_hdr.paragraph_format.space_after = Pt(2)
        p_hdr.paragraph_format.keep_with_next = True
        r_id = p_hdr.add_run(f"[{agent_id}] {name_en} ")
        r_id.font.bold = True
        r_id.font.size = Pt(13.5)
        r_id.font.color.rgb = NAVY
        r_ta = p_hdr.add_run(f"({name_ta})")
        r_ta.font.size = Pt(11.0)
        r_ta.font.color.rgb = TEAL

        # Sub-header / Badge line
        p_subh = doc.add_paragraph()
        p_subh.paragraph_format.space_before = Pt(0)
        p_subh.paragraph_format.space_after = Pt(4)
        p_subh.paragraph_format.keep_with_next = True
        r_badge = p_subh.add_run(f"DELIVERY MODE: {delivery_mode}  |  PRIMARY USER: {primary_user}")
        r_badge.font.bold = True
        r_badge.font.size = Pt(8.5)
        r_badge.font.color.rgb = RED_BADGE

        # Question 1: Is it a Chatbot or Workflow Automation?
        p_q1 = doc.add_paragraph()
        p_q1.paragraph_format.space_before = Pt(2)
        p_q1.paragraph_format.space_after = Pt(4)
        p_q1.paragraph_format.keep_with_next = True
        r_q1_t = p_q1.add_run("Is it a Chatbot or Workflow Automation?\n")
        r_q1_t.font.bold = True
        r_q1_t.font.size = Pt(9.5)
        r_q1_t.font.color.rgb = NAVY
        r_q1_b = p_q1.add_run(chatbot_vs_workflow)
        r_q1_b.font.size = Pt(9.5)

        # Question 2: What the End User Actually Sees on Screen
        p_q2 = doc.add_paragraph()
        p_q2.paragraph_format.space_before = Pt(2)
        p_q2.paragraph_format.space_after = Pt(4)
        p_q2.paragraph_format.keep_with_next = True
        r_q2_t = p_q2.add_run("What the End User Actually Sees on Screen:\n")
        r_q2_t.font.bold = True
        r_q2_t.font.size = Pt(9.5)
        r_q2_t.font.color.rgb = NAVY
        r_q2_b = p_q2.add_run(what_user_sees)
        r_q2_b.font.size = Pt(9.5)

        # Scenario
        p_sc = doc.add_paragraph()
        p_sc.paragraph_format.space_before = Pt(2)
        p_sc.paragraph_format.space_after = Pt(4)
        p_sc.paragraph_format.keep_with_next = True
        r_sc_t = p_sc.add_run("Real-Life Hospital Interaction Scenario:\n")
        r_sc_t.font.bold = True
        r_sc_t.font.size = Pt(9.5)
        r_sc_t.font.color.rgb = TEAL
        r_sc_b = p_sc.add_run(scenario)
        r_sc_b.font.size = Pt(9.5)

        # Comparison
        p_cmp = doc.add_paragraph()
        p_cmp.paragraph_format.space_before = Pt(2)
        p_cmp.paragraph_format.space_after = Pt(4)
        p_cmp.paragraph_format.keep_with_next = True
        r_cmp_t = p_cmp.add_run(comparison_title)
        r_cmp_t.font.bold = True
        r_cmp_t.font.size = Pt(9.0)
        r_cmp_t.font.color.rgb = DARK_SLATE
        r_cmp_b = p_cmp.add_run(comparison_text)
        r_cmp_b.font.size = Pt(9.0)
        r_cmp_b.font.color.rgb = SLATE

        # Divider line
        p_div = doc.add_paragraph()
        p_div.paragraph_format.space_before = Pt(2)
        p_div.paragraph_format.space_after = Pt(4)
        r_div = p_div.add_run("――――――――――――――――――――――――――――――――――――――――――――――――――――――――――")
        r_div.font.color.rgb = LIGHT_BORDER

    # Agent 1: AG-07 Insurance Preauth
    add_agent_block(
        agent_id="AG-07",
        name_en="Insurance Preauth Agent",
        name_ta="காப்பீட்டு முன்அனுமதி முகவர்",
        delivery_mode="Workflow Automation (Exactly like AG-19)",
        primary_user="Insurance Desk Executives (R. Sundar, L. Fathima)",
        chatbot_vs_workflow="This is NOT a chatbot. The Insurance Desk officer does not type into a chat box. Instead, the agent triggers automatically the moment an insured patient is admitted or an operative procedure is scheduled in the EMR. It runs silently, pulls clinical notes and billing estimates, and prepares a structured dossier for human review.",
        what_user_sees="Inside the Insurance Workspace and Discharge Command Centre, the user sees an interactive 'Preauth Submission Dossier Drawer':\n• Document Checklist: Shows green/red indicators for Doctor Advice (✓), Cost Estimate (✓), Policy ID (✓), Operative Report.\n• Denial-Risk Badge: Displays 'Denial Risk: 9% (Low Risk · Model preauth-denial v0.9)'.\n• Primary Action Button: A prominent blue button labeled '[Submit Preauth Packet to TPA]'. Clicking it sends the dossier in 1 click.",
        scenario="Patient Kavitha is admitted for cardiac stenting. The Preauth Agent automatically aggregates her Star Health policy and ₹2.45L provisional bill estimate. Insurance Officer Sundar opens Kavitha's case, verifies the checklist on screen, attaches the cath lab angiogram report, and clicks '[Submit to Star Health]'. The entire submission takes under 20 seconds with zero manual typing.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="100% Identical Architecture to AG-19: Like the Discharge Summary Agent, AG-07 automatically aggregates multi-source database records into a complete draft document and requires an authorized human click to submit."
    )

    # Agent 2: AG-08 Billing Transparency
    add_agent_block(
        agent_id="AG-08",
        name_en="Billing Transparency Agent",
        name_ta="கட்டண வெளிப்படைத்தன்மை முகவர்",
        delivery_mode="Workflow Automation / Embedded Card",
        primary_user="Hospital Cashier, Ward Nurse, and Patient/Family",
        chatbot_vs_workflow="This is NOT a chatbot. It is an automated financial auditor embedded directly into the Billing Desk interface and patient bill portal. It continuously tracks accumulating charges in the background and only surfaces when an explanation is needed.",
        what_user_sees="On the Billing Desk screen and patient invoice view:\n• Variance Flag: If the running bill exceeds the initial estimate by > 10%, an orange badge appears: '[Estimate Variance > 10%]'.\n• Plain-Language Charge Card: Below the technical consumable line items, an AI card titled 'Plain-Language Bill Breakdown' translates cryptic codes into clear, empathetic Tamil and English paragraphs.\n• Dispute Review Button: For contested lines, an action button labeled '[Investigate Clinical Necessity]' opens a verified clinical proof drawer.",
        scenario="Kavitha's final bill comes to ₹2,68,450—exceeding her ₹2.45L estimate by ₹23,450. Instead of arguing at the cash counter over technical terms like 'NC Balloon Catheter 2.5x15mm', the cashier and family read the clear on-screen note: 'Bill increased by ₹23,450 because a second dilation balloon was required during surgery to ensure safe stent placement, plus 1 additional night of post-stent cardiac observation.' The family understands, settles the balance, and departs peacefully.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Automated Synthesis like AG-19: It translates raw database charges into clear human language without requiring anyone to prompt or chat with it."
    )

    # Agent 3: AG-10 Diagnostic Coordination (NEWLY ADDED)
    add_agent_block(
        agent_id="AG-10",
        name_en="Diagnostic Coordination Agent",
        name_ta="பரிசோதனை ஒருங்கிணைப்பு முகவர்",
        delivery_mode="Workflow Automation (Exactly like AG-19)",
        primary_user="Diagnostic Technicians, Lab Supervisors & Ward Nurses",
        chatbot_vs_workflow="This is NOT a chatbot. Neither lab technicians nor ward nurses have time to chat with an AI when critical blood tests, radiology scans, or biopsies are pending. The agent operates automatically as an intelligent orchestration pipeline connecting the Doctor's EMR orders with the Laboratory Information System (LIS) and Radiology Information System (RIS). It proactively verifies pre-procedure patient preparation (e.g. 8-hour fasting for lipid panels, creatinine clearance for contrast CT), tracks specimen collection SLAs, and flags panic/critical abnormal values directly to the care team.",
        what_user_sees="Inside the DiagnosticsView, Ward Care Board, and Patient 360 profile:\n• Live Diagnostic Tracker Card: Visual multi-step progress bar for every ordered test: 'Ordered → Sample Collected → Lab Processing → Results Verified → Critical Flag'.\n• Pre-Procedure & Fasting Checklist: Real-time patient readiness status badge (e.g. '✓ Fasting 8 hrs Verified · Contrast Renal Clearance: 0.9 mg/dL · Safe for CT').\n• Critical Value Panic Alert Drawer: Immediate high-visibility red banner when life-threatening results arrive (e.g. Potassium > 6.5 mEq/L or Troponin-I > 0.04 ng/mL) featuring a mandatory 1-click action button labeled '[Acknowledge Critical Alert & Notify Attending Physician]'.",
        scenario="Dr. Ramesh orders an emergency Contrast-Enhanced Abdominal CT and Cardiac Enzyme Panel for patient Murugan in Bed 204. The Diagnostic Coordination Agent immediately verifies Murugan's baseline creatinine (0.9 mg/dL) and sends an automated pre-procedure fasting alert to the ward nurse tablet. When the biochemistry lab releases a dangerously elevated Troponin-I result 40 minutes later, the agent instantly sounds a high-priority red alert on Ward 2B's central console and routes an urgent SMS notification to Dr. Ramesh's mobile device, ensuring life-saving intervention within 3 minutes.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="100% Identical Architecture to AG-19: Like AG-19, it functions as an autonomous clinical workflow engine that listens to database and machine events, pre-populates structured UI status boards, and executes 1-click human-approved clinical escalations without conversational typing."
    )

    # Agent 4: AG-18 Nursing Handover
    add_agent_block(
        agent_id="AG-18",
        name_en="Nursing Handover Agent",
        name_ta="செவிலியர் ஒப்படைப்பு முகவர்",
        delivery_mode="Workflow Automation (Exactly like AG-19)",
        primary_user="Ward Staff Nurses & Charge Nurses",
        chatbot_vs_workflow="This is NOT a chatbot. At 07:00 AM, 03:00 PM, and 11:00 PM shift changes, exhausted nurses do not have time to chat with an AI. The agent automatically reads the previous 8 hours of electronic vitals, eMAR drug administrations, and doctor rounds notes, generating standardized bedside handover summaries.",
        what_user_sees="On the Ward Tablet Bed Board, each patient bed features an expandable 'SBAR Handover Card':\n• S (Situation): Inpatient diagnosis, day of stay, primary consultant.\n• B (Background): Admission route, surgical history, known drug allergies.\n• A (Assessment): Last shift vitals (BP, Temp, HR, SpO2), Early Warning Score (EWS), administered medications.\n• R (Recommendation): Pending lab collections, scheduled procedures, special doctor precautions.\n• Verification Button: A green button labeled '[Acknowledge & Accept Handover]' requiring joint sign-off.",
        scenario="Night Nurse Anitha and Morning Nurse Deepa stand at Bed 183. They tap Bed 183 on the ward tablet. The complete SBAR card is already pre-filled. Both nurses review the stable vitals, confirm the morning antibiotic dose due at 08:30 AM, and Deepa taps '[Acknowledge Handover]'. The entire bed handover takes 90 seconds instead of 10 minutes of messy paper scribbling.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="100% Identical Architecture to AG-19: Generates a clinical document draft in the background that requires human clinical verification and sign-off."
    )

    # Agent 5: AG-19 Discharge Summary
    add_agent_block(
        agent_id="AG-19",
        name_en="Discharge Summary Agent",
        name_ta="டிஸ்சார்ஜ் சுருக்க வரைவு முகவர்",
        delivery_mode="Workflow Automation & Clinical Workspace",
        primary_user="Consultant Doctors & Clinicians",
        chatbot_vs_workflow="This is pure Workflow Automation. When a clinician marks a patient as 'Likely Discharge' in the EMR, the agent compiles the entire multi-day inpatient stay (diagnoses, catheterization notes, operative procedures, daily lab trends, and discharge medications) into an official NABH summary draft.",
        what_user_sees="In Doctor Workspace and Discharge Command Centre:\n• Draft Preview Drawer: Doctor clicks '[View Discharge Summary Draft]'. A complete 4-page NABH-formatted summary opens.\n• Safety Audit Banner: Displays 'Medication Reconciliation: 0 Contraindications | Groundedness: 99.4% · Hallucination: 0.1%'.\n• Action Buttons: '[Edit Sections]' and a prominent blue button '[Sign & Finalize Discharge Summary]'.",
        scenario="Dr. Arjun Menon marks patient Murugan for discharge following CABG surgery. The 4-page clinical summary is already fully drafted in 1.18 seconds across all 115 benchmark parameters. Dr. Menon reviews the operative findings and medication advice on his tablet and electronically signs it with 1 click.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="The Benchmark Model: This is the exact reference workflow automation model that AG-07, AG-08, AG-10, AG-18, and AG-20 are patterned after."
    )

    # Agent 6: AG-20 Claim Denial
    add_agent_block(
        agent_id="AG-20",
        name_en="Claim Denial Agent",
        name_ta="காப்பீட்டு மறுப்பு மேல்முறையீட்டு முகவர்",
        delivery_mode="Workflow Automation (Exactly like AG-19)",
        primary_user="Insurance Desk & Revenue Cycle Lead",
        chatbot_vs_workflow="This is NOT a chatbot. When an insurance company or TPA rejects a claim or cuts money (shortfall), the system detects the rejection code in PostgreSQL and automatically creates a formal appeal dossier in the background.",
        what_user_sees="Inside the Claims Manager screen:\n• Rejection Badge: Claims with deductions show a red '[Shortfall Detected]' badge.\n• Appeal Dossier Drawer: Clicking the claim opens an appeal drawer showing: 1. Disputed denial code (e.g. Code 204: No conservative management). 2. Automatically retrieved past EMR records proving medical necessity. 3. Formatted Reconsideration Appeal Letter.\n• Submission Button: A primary button labeled '[Submit Appeal to TPA]'.",
        scenario="ICICI Lombard cuts ₹80,000 from a spinal fusion claim citing lack of conservative therapy. The agent scans patient Murugan's OPD history from 3 months ago, finds Dr. Sundaram's prescription for 8 weeks of failed physiotherapy, drafts an appeal letter with attached clinical evidence, and Officer Sundar submits it with 1 click to recover the ₹80,000.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Identical to AG-19: Instead of drafting a discharge summary, AG-20 drafts an evidence-backed legal/insurance appeal letter ready for 1-click human submission."
    )

    # Agent 7: AG-04 Employee Service
    add_agent_block(
        agent_id="AG-04",
        name_en="Employee Service Agent",
        name_ta="பணியாளர் சேவை முகவர்",
        delivery_mode="Internal Staff Chatbot",
        primary_user="Hospital Staff (Doctors, Nurses, Technicians, Admin)",
        chatbot_vs_workflow="This IS a Conversational Chatbot. It is built specifically for hospital employees who have questions about their shifts, leave balances, overtime rules, and HR policies, providing instant answers without phone calls or tickets.",
        what_user_sees="Embedded as a private chat widget in the Hospital Staff Mobile App & Intranet Portal:\n• Floating Chat Bubble: Displays in the bottom corner of the employee dashboard.\n• Quick Action Buttons: '[My Shift Tomorrow]', '[Check Leave Balance]', '[Apply Comp-Off]'.\n• Interactive Slips: If an employee asks for leave, the bot renders a pre-filled leave slip with an '[Apply Now]' button.",
        scenario="Nurse Priya opens the staff app and asks: 'What is my shift timing tomorrow and do I have comp-off available?'. The bot checks PostgreSQL roster tables and responds: 'You are on Day Shift (07:00 AM - 03:00 PM) in Ward 3B tomorrow. Under HR Policy v5.0, you have 2 compensatory offs available. Would you like to file for Friday?'. Priya taps 'Yes' and the request is routed to her supervisor.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Different from AG-19: While AG-19 is an automated document generator, AG-04 is an interactive conversational Q&A assistant."
    )

    # Agent 8: AG-12 Contact Centre
    add_agent_block(
        agent_id="AG-12",
        name_en="Contact Centre Agent",
        name_ta="தொடர்பு மைய முகவர்",
        delivery_mode="Natural Spoken Voice AI (Phone Helpline)",
        primary_user="Inbound Telephone Callers & Patients",
        chatbot_vs_workflow="This is a Spoken Voice Assistant with ZERO on-screen UI. It lives directly on the hospital's telephone SIP/IVR lines. Callers do not type or download an app; they simply dial the hospital phone number and speak naturally in Tamil or English.",
        what_user_sees="No screen UI for the caller (pure audio telephone call).\nFor Hospital Telephony Administrators: A live dashboard shows active calls, language distribution (Tamil vs. English), call duration, and real-time transcripts.",
        scenario="An elderly villager dials the hospital landline and speaks naturally in Tamil: 'My mother has knee pain, does Dr. Anand have clinic today?'. The voice AI listens, transcribes the Tamil speech, checks Dr. Anand's clinic slots in PostgreSQL, and speaks back in warm Tamil: 'Dr. Anand is consulting today in Room 108 until 01:00 PM. 3 open tokens are available. Shall I reserve a slot for your mother?'.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Complete Opposite of AG-19: AG-19 operates inside the clinical web UI as a visual document; AG-12 operates purely through real-time audio over telephone lines."
    )

    # Agent 9: AG-13 AI Trainer
    add_agent_block(
        agent_id="AG-13",
        name_en="AI Trainer Agent",
        name_ta="பயிற்சி & வழிகாட்டி முகவர்",
        delivery_mode="Clinical Protocol Chatbot & Search Panel",
        primary_user="Junior Nurses, Medical Interns, Resident Doctors",
        chatbot_vs_workflow="This IS a Conversational Chatbot designed for clinical education. It is deployed on nursing station computers and doctor workstations to answer protocol, sterile technique, and drug administration questions based strictly on hospital SOP manuals.",
        what_user_sees="A dedicated 'Protocol Copilot' side-panel on hospital ward computers:\n• Search & Query Bar: 'Ask Hospital Protocol or Drug Dilution SOP...'.\n• Verified Citation Cards: Displays the exact answer with official citations: 'Hospital ICU Protocol v4.2, Section 4.2 (NABH Approved)'.\n• Safety Warnings: High-alert drugs (KCl, Noradrenaline) trigger bold red double-check warnings.",
        scenario="A junior ICU nurse is preparing a Noradrenaline infusion. She types into the ward terminal: 'What is the dilution formula for Noradrenaline?'. The bot responds: 'Standard Hospital Protocol: Dilute 4mg in 50ml D5W. Must be infused via Central Venous Line only. Mandatory two-nurse double-check required on eMAR before starting pump.'.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Conversational Reference vs Drafting: AG-13 answers questions by searching verified hospital SOP manuals, whereas AG-19 synthesizes patient records into summaries."
    )

    # Agent 10: AG-17 Voice Documentation
    add_agent_block(
        agent_id="AG-17",
        name_en="Voice Documentation Agent",
        name_ta="குரல் ஆவணப்படுத்தல் முகவர்",
        delivery_mode="Voice Dictation Scribe Tool",
        primary_user="Consulting Doctors & Outpatient Physicians",
        chatbot_vs_workflow="This is a Speech-to-Document Tool. The doctor does not have a back-and-forth chat. Instead, the physician taps a microphone button, dictates for 30–45 seconds in natural mixed Tamil/English, and the agent transcribes and populates the structured EMR form.",
        what_user_sees="Embedded directly inside the Doctor's Clinical Consultation Workspace:\n• Mic Button: A floating microphone button labeled '[Record Audio Dictation]'.\n• Live Audio Waveform: Displays real-time audio capture status.\n• Auto-Populated SOAP Fields: As soon as dictation finishes, the Subjective, Objective, Assessment (with ICD-10 code), and Plan fields fill in automatically on the doctor's screen.",
        scenario="Dr. Menon examines patient Kavitha, taps '[Record]', and dictates: 'Patient reports chest pain for 3 days, BP 140/90, ECG shows T-inversion, start Aspirin 75mg and Atorvastatin 40mg'. He taps '[Done]'. Within 3 seconds, the SOAP note is perfectly formatted on screen. Dr. Menon reviews and signs with 1 click without typing a single word.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Input vs Output: Both generate clinical documentation, but AG-17 takes spoken voice dictation as input, whereas AG-19 reads multi-day electronic database logs."
    )

    # Agent 11: AG-06 Queue / Flow
    add_agent_block(
        agent_id="AG-06",
        name_en="Queue / Flow Agent",
        name_ta="வரிசை & ஓட்ட மேலாண்மை முகவர்",
        delivery_mode="Background Monitor + TV Screen & SMS Broadcast",
        primary_user="Waiting Outpatients & Operations Managers",
        chatbot_vs_workflow="This is NOT a chatbot. Patients do not type or chat with it. It runs continuously in the background, monitoring doctor consultation pace, calculating dynamic waiting times, updating waiting room TV screens, and sending automated alerts.",
        what_user_sees="Two distinct visual presentations:\n1. Hospital Waiting Lobby TV Screens: Clean, high-contrast digital display showing: 'Consulting: Dr. Arjun Menon (Room 204) · Now Calling: Token #12 · Next: Token #13'.\n2. Patient Phone Screen (SMS/WhatsApp): Clean push messages with live token updates and estimated wait times.",
        scenario="Patient Ramesh holds Token #14 for Cardiology. While sitting in the cafe, he receives an automated text: 'Token #14: You are 2nd in line for Dr. Menon. Estimated wait: ~18 mins. Please proceed to Waiting Lobby 2B'. When Token #13 enters the room, Ramesh gets a buzz: 'You are next! Please proceed to Consultation Room 204.'.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Broadcaster vs Workspace: AG-06 is a background monitoring and notification engine, whereas AG-19 is an interactive clinical documentation workspace."
    )

    # Agent 12: AG-15 Forecasting
    add_agent_block(
        agent_id="AG-15",
        name_en="Forecasting Agent",
        name_ta="முன்கணிப்பு முகவர்",
        delivery_mode="Background Sentinel + Bed Operations Dashboard",
        primary_user="Chief Operating Officer, Bed Managers, Nursing Supervisors",
        chatbot_vs_workflow="This is a Background Predictive Engine. It runs every 60 minutes, analyzing scheduled surgeries, historical admission patterns, and anticipated discharge times to generate 7-day bed occupancy forecasts without user input.",
        what_user_sees="Inside the Bed Management & Command Centre:\n• 7-Day Surge Forecast Card: Displays a visual bar chart predicting bed occupancy per department for each day of the upcoming week.\n• Capacity Alert Banners: Highlights anticipated shortages in red (e.g. 'Cardiology ICU Capacity Alert: 96% projected on Thursday').\n• Actionable Recommendations: Displays suggested step-down bed transfers to prevent emergency room holding delays.",
        scenario="COO logs in on Monday at 08:00 AM and sees a forecasting banner: 'Cardiology will experience a bed deficit of 4 beds on Thursday due to 14 scheduled bypass surgeries. Recommend transferring 5 stable post-op patients to Ward 2B by Wednesday afternoon'. The COO approves the reallocation, preventing an emergency bed crisis.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Predictive vs Retrospective: AG-15 looks forward to predict future bed demand, whereas AG-19 looks back to summarize past hospital stays."
    )

    # Agent 13: AG-05 Feedback
    add_agent_block(
        agent_id="AG-05",
        name_en="Feedback Agent",
        name_ta="கருத்து & அனுபவ முகவர்",
        delivery_mode="Automated WhatsApp Bot + Quality Dashboard",
        primary_user="Discharged Inpatients & Hospital Quality Leads",
        chatbot_vs_workflow="This is an Automated Event-Driven Messenger. It triggers automatically 24 hours post-discharge. It does not require patient app downloads; it interacts directly via interactive WhatsApp survey buttons.",
        what_user_sees="1. On the Patient's Phone: A clean WhatsApp message with 1-to-10 tap buttons to rate their experience, followed by a voice/text option to describe grievances.\n2. On the Hospital Quality Portal: A live grievance board showing incoming NPS scores and flagged complaints with countdown SLA timers.",
        scenario="24 hours after heart surgery, patient Raman receives a WhatsApp check-in. Raman rates the stay 5/10 and types: 'The hospital food was cold and final billing took 3 hours'. The agent classifies the sentiment as 'Negative · Dining/Billing' and immediately creates an urgent Service Recovery Ticket for the Patient Relations Lead.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Post-Discharge Outreach: Triggers after AG-19 finishes. AG-19 completes the medical discharge; AG-05 checks on patient satisfaction 24 hours later."
    )

    # Agent 14: AG-11 Follow-up
    add_agent_block(
        agent_id="AG-11",
        name_en="Follow-up Agent",
        name_ta="தொடர் கவனிப்பு முகவர்",
        delivery_mode="Automated WhatsApp Clinical Recovery Bot",
        primary_user="Discharged Surgical & Medical Patients",
        chatbot_vs_workflow="This is an Automated Clinical Follow-up Engine. It initiates timed clinical check-ins on Day 3, 7, and 14 post-discharge to assess wound healing, monitor drug compliance, and schedule follow-up OPD review visits.",
        what_user_sees="On the Patient's WhatsApp:\n• Simple Interactive Buttons: '[Pain Managed]', '[Taking All Meds]', '[Need Callback]'.\n• Suture Review Card: Displays date and time for stitch removal with an instant '[Confirm Appointment]' button.",
        scenario="Patient Murugan is at home on Day 3 post-hip surgery. He receives an automated check-in in Tamil asking if he is taking his blood thinners. Murugan taps '[Taking Meds]'. If Murugan had tapped '[Wound is red/oozing]', the agent would immediately route an emergency callback to the ward nurse.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Clinical Care Extension: Extends the discharge instructions generated by AG-19 into active monitoring at the patient's home."
    )

    # Agent 15: AG-14 Analytics
    add_agent_block(
        agent_id="AG-14",
        name_en="Analytics Agent",
        name_ta="மருத்துவ பகுப்பாய்வு முகவர்",
        delivery_mode="Executive Hybrid (Visual Dashboard + Natural Query)",
        primary_user="Hospital CEO, CFO, Medical Director",
        chatbot_vs_workflow="This is a Hybrid Executive Interface. It combines rich visual dashboard cards (occupancy, revenue, LOS) with a natural-language query box where executives can ask complex managerial questions and receive instant SQL charts.",
        what_user_sees="Inside the AnalyticsView of the hospital portal:\n• Executive KPI Cards: Displays live Bed Occupancy (66.7%), 6-Month Admission Trend, and ₹12.66 Cr Claims Realization.\n• Natural Query Bar: A prominent top search bar: 'Ask Executive Analytics...'.\n• Dynamic Chart Renderer: Automatically draws bar charts, trend lines, and ICD-10 breakdown tables based on the query.",
        scenario="The Medical Director asks: 'Show me 6-month historical admissions for Cardiology vs Orthopedics'. The agent translates the question into live SQL, queries the admissions lakehouse, and instantly renders an interactive side-by-side comparison chart.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="Managerial vs Clinical: AG-19 handles single-patient clinical summaries; AG-14 handles aggregate hospital-wide performance and financial analytics."
    )

    # Agent 16: AG-21 Management Copilot
    add_agent_block(
        agent_id="AG-21",
        name_en="Management Copilot",
        name_ta="நிர்வாக வழிகாட்டி முகவர்",
        delivery_mode="Executive Strategy Copilot (Bottleneck Feed + CEO Chat)",
        primary_user="Hospital Chief Executive Officer & Board of Directors",
        chatbot_vs_workflow="This is the High-Level Executive Copilot. It continuously listens to events across all 20 hospital agents, synthesizing cross-departmental logjams and allowing the CEO to conduct strategic investigations via natural dialogue.",
        what_user_sees="Inside the Executive Command Center:\n• Live Bottleneck Feed: A real-time card stream showing departmental blockages (e.g. '7 Discharges Blocked by TPA | Ward 3B Cleaning Delayed').\n• CEO Strategy Console: A conversational panel where the CEO can investigate root causes, simulate staffing adjustments, and review compliance.",
        scenario="During a board meeting, the CEO asks: 'Why is our bed turnover delayed today?'. The Copilot synthesizes data from AG-09 (Discharge), AG-07 (Preauth), and Housekeeping, responding: 'Seven discharges are blocked awaiting Star Health preauth approvals, and Ward 3B terminal cleaning is averaging 38 mins. Recommend reassigning 2 cleaners to release 4 surgical beds by 12:30 PM.'.",
        comparison_title="Comparison to Discharge Summary Agent (AG-19): ",
        comparison_text="The Master Supervisor: Sits at the apex of the platform, supervising and correlating outputs from AG-19, AG-07, AG-09, and other workflow agents to give the CEO unified operational control."
    )

    # Section 4
    p_s4 = doc.add_paragraph()
    p_s4.paragraph_format.space_before = Pt(14)
    p_s4.paragraph_format.space_after = Pt(6)
    r_s4 = p_s4.add_run("4. Why This Architecture Makes Staff 10x Faster")
    r_s4.font.bold = True
    r_s4.font.size = Pt(15.0)
    r_s4.font.color.rgb = NAVY

    p_body4 = doc.add_paragraph()
    p_body4.paragraph_format.space_after = Pt(10)
    p_body4.add_run(
        "In healthcare, user experience determines adoption. If a hospital forces a nurse or doctor to open a chat window and type "
        "'Please prepare the discharge summary for bed 104', it fails because doctors have no time to chat. By contrast, when the system uses "
        "Workflow Automation (like AG-19), the summary is already generated before the doctor opens the chart. The doctor only reviews and signs.\n\n"
        "Conversely, for an employee asking about maternity leave rules or a patient calling the phone helpline at night, a Conversational Voice/Chatbot "
        "is the ideal solution because it offers natural, instant human-like dialogue.\n\n"
        "This balanced distribution ensures maximum operational speed, total clinical safety, and effortless user adoption across all departments."
    )

    output_path = r"e:\Bosco-projects\POC\Health-care\code\health-care\docs\Hospital_AI_Agents_UI_Delivery_Modes.docx"
    doc.save(output_path)
    print(f"Document successfully created and saved to {output_path}")

if __name__ == "__main__":
    generate_document()
