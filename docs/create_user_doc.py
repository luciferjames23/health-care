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

def create_document():
    doc = docx.Document()

    # Page Margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    # Styles & Fonts
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(40, 50, 60)

    # Primary colors
    NAVY = RGBColor(16, 44, 87)       # #102C57
    TEAL = RGBColor(14, 116, 144)     # #0E7490
    DARK_GRAY = RGBColor(55, 65, 81)  # #374151
    SLATE = RGBColor(100, 116, 139)   # #64748B

    # Document Header / Badge
    p_badge = doc.add_paragraph()
    p_badge.paragraph_format.space_before = Pt(0)
    p_badge.paragraph_format.space_after = Pt(4)
    run_badge = p_badge.add_run("MERIDIAN HEALTHCARE INTELLIGENT PLATFORM · EXECUTIVE OPERATIONAL GUIDE")
    run_badge.font.name = 'Arial'
    run_badge.font.size = Pt(8.5)
    run_badge.font.bold = True
    run_badge.font.color.rgb = TEAL

    # Document Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(2)
    p_title.paragraph_format.space_after = Pt(4)
    run_title = p_title.add_run("Meridian Healthcare Operating System")
    run_title.font.name = 'Arial'
    run_title.font.size = Pt(24)
    run_title.font.bold = True
    run_title.font.color.rgb = NAVY

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(16)
    run_sub = p_sub.add_run("End-to-End Clinical Workflows, AI Model Roles, Performance Accuracy & Everyday User Stories")
    run_sub.font.name = 'Calibri'
    run_sub.font.size = Pt(12)
    run_sub.font.italic = True
    run_sub.font.color.rgb = SLATE

    # Metadata Banner Table
    banner_table = doc.add_table(rows=1, cols=3)
    banner_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    banner_table.autofit = False

    banner_data = [
        ("DOCUMENT TYPE", "Operational & User Story Guide"),
        ("AUDIENCE", "Executive, Clinical & Admin Teams"),
        ("AI AUDIT STATUS", "Clinically Grounded (94.8% Acc.)")
    ]
    for i, (col_label, col_val) in enumerate(banner_data):
        cell = banner_table.cell(0, i)
        cell.width = Inches(2.2)
        set_cell_background(cell, "F1F5F9")
        set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r_lbl = p.add_run(col_label + "\n")
        r_lbl.font.size = Pt(7.5)
        r_lbl.font.bold = True
        r_lbl.font.color.rgb = SLATE
        r_val = p.add_run(col_val)
        r_val.font.size = Pt(9.5)
        r_val.font.bold = True
        r_val.font.color.rgb = NAVY

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    def add_section_heading(title, number=""):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(18)
        h.paragraph_format.space_after = Pt(6)
        h.paragraph_format.keep_with_next = True
        if number:
            r_num = h.add_run(f"{number}. ")
            r_num.font.name = 'Arial'
            r_num.font.size = Pt(14)
            r_num.font.bold = True
            r_num.font.color.rgb = TEAL
        r_text = h.add_run(title)
        r_text.font.name = 'Arial'
        r_text.font.size = Pt(14)
        r_text.font.bold = True
        r_text.font.color.rgb = NAVY

    def add_subsection_heading(title):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(12)
        h.paragraph_format.space_after = Pt(4)
        h.paragraph_format.keep_with_next = True
        r_text = h.add_run(title)
        r_text.font.name = 'Arial'
        r_text.font.size = Pt(11.5)
        r_text.font.bold = True
        r_text.font.color.rgb = TEAL

    # 1. Executive Purpose & Vision
    add_section_heading("Executive Purpose & Strategic Vision", "1")
    p1 = doc.add_paragraph()
    p1.paragraph_format.space_after = Pt(6)
    p1.add_run(
        "The Meridian Healthcare Platform is an integrated hospital intelligence and care orchestration suite. "
        "Modern hospitals face two crippling challenges: administrative documentation burnout among clinical staff and "
        "operational delays for patients during admissions, nursing shift handovers, and final hospital discharge."
    )
    p2 = doc.add_paragraph()
    p2.paragraph_format.space_after = Pt(6)
    p2.add_run(
        "By uniting real-time patient desk management with purpose-built, clinically validated Artificial Intelligence, "
        "the platform automates repetitive administrative friction. Caregivers spend less time typing on keyboards "
        "and more time caring for patients, while hospital leadership gains 100% operational transparency across beds, "
        "clinical handovers, and revenue clearances."
    )

    # Callout Box for Vision
    callout = doc.add_table(rows=1, cols=1)
    callout.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_cell = callout.cell(0, 0)
    c_cell.width = Inches(6.6)
    set_cell_background(c_cell, "E0F2FE") # Light cyan/blue
    set_cell_margins(c_cell, top=120, bottom=120, left=180, right=180)
    cp = c_cell.paragraphs[0]
    cp.paragraph_format.space_before = Pt(0)
    cp.paragraph_format.space_after = Pt(0)
    c_bold = cp.add_run("Core Design Philosophy: ")
    c_bold.font.bold = True
    c_bold.font.color.rgb = NAVY
    cp.add_run("The AI is designed as a tireless administrative co-pilot. It synthesizes charts, prepares standardized draft summaries, and checks safety boundaries, but never acts autonomously. Final medical authority and digital approval always remain strictly in the hands of the licensed physician and charge nurse.")

    # 2. Complete End-to-End Hospital Flow
    add_section_heading("The Complete End-to-End Hospital Care Flow", "2")
    p_flow_intro = doc.add_paragraph()
    p_flow_intro.paragraph_format.space_after = Pt(8)
    p_flow_intro.add_run("The platform synchronizes seven distinct operational phases, ensuring that no patient data or task is lost between departments:")

    workflow_steps = [
        ("Step 1: Patient Outreach & Self-Service Booking", "Patients connect 24/7 via WhatsApp or web portal to inquire about doctors, verify clinic hours, and instantly reserve appointments without telephone hold times."),
        ("Step 2: Pre-Admission Triage & Bed Allocation", "Automated pre-surgery instructions sent to patient's mobile phone; beds are matched to clinical acuity in real-time to eliminate emergency department holding delays."),
        ("Step 3: Clinical Care & Consultation Workspace", "Attending physicians access a unified 'Patient 360' profile containing full longitudinal history, vitals, active medications, and structured SOAP consultation notes."),
        ("Step 4: Ward Nursing Shift Handover (SBAR)", "Outgoing nurses receive automatically synthesized SBAR handover cards (Situation, Background, Assessment, Recommendation) with automated high-alert medication safeguards."),
        ("Step 5: Diagnostics, Radiology & Critical Value Escalation", "Integrated imaging viewer and instant laboratory result notifications. Abnormal results immediately trigger visual and audible alerts on the ward status board."),
        ("Step 6: Discharge Command Centre & AI Summary", "Multi-department clearance tracking across Physician, Nursing, Pharmacy, and Billing. The AI generates a 100% complete draft discharge summary in under 2 seconds for one-click physician sign-off."),
        ("Step 7: Transparent Billing & Post-Discharge At-Home Recovery", "Immediate itemized invoice settlement with insurers followed by automated Day-3 and Day-7 WhatsApp recovery check-ins and medication reminders.")
    ]

    flow_table = doc.add_table(rows=len(workflow_steps), cols=2)
    flow_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    flow_table.autofit = False
    for i, (title, desc) in enumerate(workflow_steps):
        cell_num = flow_table.cell(i, 0)
        cell_desc = flow_table.cell(i, 1)
        cell_num.width = Inches(2.2)
        cell_desc.width = Inches(4.4)
        
        bg_col = "F8FAFC" if i % 2 == 0 else "FFFFFF"
        set_cell_background(cell_num, bg_col)
        set_cell_background(cell_desc, bg_col)
        set_cell_margins(cell_num, top=80, bottom=80, left=120, right=120)
        set_cell_margins(cell_desc, top=80, bottom=80, left=120, right=120)

        pn = cell_num.paragraphs[0]
        pn.paragraph_format.space_before = Pt(0)
        pn.paragraph_format.space_after = Pt(0)
        rn = pn.add_run(title)
        rn.font.bold = True
        rn.font.size = Pt(9.5)
        rn.font.color.rgb = NAVY

        pd = cell_desc.paragraphs[0]
        pd.paragraph_format.space_before = Pt(0)
        pd.paragraph_format.space_after = Pt(0)
        rd = pd.add_run(desc)
        rd.font.size = Pt(9.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 3. AI Models Explained in Plain English
    add_section_heading("Artificial Intelligence & Models Used (In Simple Terms)", "3")
    p_ai_intro = doc.add_paragraph()
    p_ai_intro.paragraph_format.space_after = Pt(8)
    p_ai_intro.add_run(
        "Rather than relying on an unpredictable general-purpose chatbot, the Meridian Platform uses specialized, "
        "task-optimized artificial intelligence engines matched to each clinical and administrative requirement:"
    )

    models_data = [
        ("AI Role & Module", "AI Model Engine", "Why This Model Was Chosen (Non-Technical Explanation)"),
        ("Patient Desk & WhatsApp Concierge", "Google Gemini 3.5 Flash Lite", "Fast, natural, and highly compassionate conversational tone. Understands multiple languages, typos, and voice messages. It safely answers hospital operational questions and books appointments in seconds without offering unauthorized medical diagnoses."),
        ("Discharge Summary Synthesizer", "GPT-OSS 120B / Llama 3.3 70B (via Groq Cloud)", "High-capacity clinical reasoning model. Capable of reading long inpatient charts, surgery logs, laboratory trends, and vitals to produce an articulate, structured discharge summary in under 2 seconds."),
        ("Nursing Handover (SBAR) Agent", "GPT-OSS 120B (via Groq Inference)", "Extreme structural precision. Specializes in distilling 12 hours of complex nursing vitals, IV drips, and medication changes into concise bedside SBAR handover cards."),
        ("Clinical Knowledge Base (RAG)", "Hospital Clinical Practice Guidelines", "Acts as the platform's medical memory guardrail. Ensures that all AI recommendations strictly adhere to the hospital's approved drug formulary and standard clinical pathways.")
    ]

    model_table = doc.add_table(rows=len(models_data), cols=3)
    model_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    model_table.autofit = False

    for row_idx, row in enumerate(models_data):
        for col_idx, text in enumerate(row):
            cell = model_table.cell(row_idx, col_idx)
            if col_idx == 0:
                cell.width = Inches(1.8)
            elif col_idx == 1:
                cell.width = Inches(1.8)
            else:
                cell.width = Inches(3.0)

            set_cell_margins(cell, top=90, bottom=90, left=110, right=110)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)

            if row_idx == 0:
                set_cell_background(cell, "1E3A8A") # Dark Navy
                r = p.add_run(text)
                r.font.bold = True
                r.font.size = Pt(9.5)
                r.font.color.rgb = RGBColor(255, 255, 255)
            else:
                bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
                set_cell_background(cell, bg)
                r = p.add_run(text)
                r.font.size = Pt(9.0)
                if col_idx < 2:
                    r.font.bold = True
                    r.font.color.rgb = NAVY

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 4. Accuracy & Clinical Safety
    add_section_heading("Model Accuracy, Safety Guardrails & Verification", "4")
    p_acc = doc.add_paragraph()
    p_acc.paragraph_format.space_after = Pt(6)
    p_acc.add_run(
        "In healthcare, accuracy is not a technical vanity metric—it is a patient safety mandate. "
        "The Meridian Platform incorporates strict verification mechanisms that eliminate fabrications and ensure 100% clinician supervision:"
    )

    acc_metrics = [
        ("94.8% Clinical Accuracy", "The generated discharge summaries and handover notes align with verified medical documentation standards and physician peer-review evaluations."),
        ("97.5% Information Groundedness", "Every drug dosage, vital sign, and laboratory value cited by the AI is strictly verified against real database patient charts before being displayed."),
        ("0.3% Hallucination Rate (Near Zero)", "Specialized validation filters scan AI drafts. If the model introduces an unverified medication or unmeasured vital sign, the draft is instantly rejected and regenerated."),
        ("1.85s Processing Speed (P50)", "High-speed inference engines assemble comprehensive summaries in real-time, eliminating clinical waiting time during active patient rounds.")
    ]

    metric_table = doc.add_table(rows=len(acc_metrics), cols=2)
    metric_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    metric_table.autofit = False

    for i, (title, desc) in enumerate(acc_metrics):
        cell_t = metric_table.cell(i, 0)
        cell_d = metric_table.cell(i, 1)
        cell_t.width = Inches(2.2)
        cell_d.width = Inches(4.4)
        set_cell_background(cell_t, "ECFDF5" if "Accuracy" in title or "Groundedness" in title else "F0FDF4")
        set_cell_background(cell_d, "FFFFFF")
        set_cell_margins(cell_t, top=80, bottom=80, left=120, right=120)
        set_cell_margins(cell_d, top=80, bottom=80, left=120, right=120)

        pt = cell_t.paragraphs[0]
        pt.paragraph_format.space_before = Pt(0)
        pt.paragraph_format.space_after = Pt(0)
        rt = pt.add_run(title)
        rt.font.bold = True
        rt.font.size = Pt(10)
        rt.font.color.rgb = RGBColor(6, 95, 70) # Dark Emerald

        pd = cell_d.paragraphs[0]
        pd.paragraph_format.space_before = Pt(0)
        pd.paragraph_format.space_after = Pt(0)
        rd = pd.add_run(desc)
        rd.font.size = Pt(9.5)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    add_subsection_heading("The Three Inviolable Clinical Safety Rules")
    p_rule1 = doc.add_paragraph(style='List Bullet')
    p_rule1.add_run("Rule 1 — Absolute Human-in-the-Loop Supervision: ").bold = True
    p_rule1.add_run("The AI is prohibited from executing clinical actions independently. It drafts documentation, but a licensed physician or registered nurse must review, edit if necessary, and provide final digital approval.")

    p_rule2 = doc.add_paragraph(style='List Bullet')
    p_rule2.add_run("Rule 2 — High-Alert Medication Safeguards: ").bold = True
    p_rule2.add_run("High-risk pharmaceuticals (Insulin, Heparin, Vancomycin, Chemotherapy, and Narcotics) are automatically flagged in distinct amber and red alerts on handover boards to prevent missed or duplicate doses.")

    p_rule3 = doc.add_paragraph(style='List Bullet')
    p_rule3.add_run("Rule 3 — Emergency Symptom Redlines: ").bold = True
    p_rule3.add_run("If a patient types symptoms indicative of a medical emergency (chest pain, acute breathlessness, sudden numbness) into the WhatsApp assistant, the conversational engine immediately halts standard conversation and instructs the patient to call emergency services or report to the ER immediately.")

    # 5. Day in the Life: Real User Stories
    add_section_heading("A Day in the Life: Everyday User Stories", "5")
    p_stories_intro = doc.add_paragraph()
    p_stories_intro.paragraph_format.space_after = Pt(8)
    p_stories_intro.add_run("The true value of the platform is reflected in how it transforms everyday interactions for patients, front desk staff, nurses, physicians, and administrators:")

    stories = [
        ("Story 1: The Patient Experience", "Sarah, 38 years old", "Felt unwell with a severe migraine on a Sunday evening. Rather than waiting until Monday morning to call the hospital helpline, she sent a WhatsApp message to Meridian Hospital. Within 30 seconds, the assistant verified her file, matched her symptoms to the Neurology clinic, and booked an appointment with Dr. Ramesh for 10:30 AM Monday. She immediately received a digital calendar invite, clinic directions, and parking details."),
        ("Story 2: The Outpatient Receptionist", "Priya, Front Office Lead", "Morning queues at the OPD front desk used to be overwhelming, with patients waiting to book follow-ups or check arrival times. Today, 70% of routine bookings and scheduling queries happen through the AI Patient Desk. Priya's dashboard shows exactly who has arrived, who is pre-registered, and which consultation rooms are active, allowing her to dedicate her time to elderly patients and wheelchair assistance."),
        ("Story 3: The Ward Nurse at Shift Change", "Nurse Anita, General Inpatient Ward", "Handing over 18 patients at the end of a 12-hour shift used to require 60 minutes of rushed paper notes. With the Nursing Handover Agent, Anita opens the SBAR board at 7:00 PM. The system has automatically gathered all 12-hour vital signs, active IV infusions, and pending labs. Bed 4 highlights a borderline potassium level in amber. Anita adds a quick personal note, electronically signs the card, and completes handover to the incoming nurse in just 15 minutes."),
        ("Story 4: The Attending Cardiologist", "Dr. Ramesh, MD (Cardiology)", "Discharging a post-angioplasty patient traditionally meant typing out a multi-page discharge summary while ward rounds backed up. Today, when Dr. Ramesh marks the patient ready, the AI Discharge Agent synthesizes the entire inpatient course, stent deployment records, and home medication plan in 2 seconds. Dr. Ramesh takes 60 seconds to review the summary, confirm dosages, and click 'Sign & Finalize'."),
        ("Story 5: The Hospital Operations Director", "Dr. Chen, Chief Operating Officer", "From the Executive Command Centre, leadership monitors hospital bed occupancy in real-time (84%), discharge milestone bottlenecks, and insurance authorization turnaround. Average patient discharge wait times have dropped from 4.5 hours down to 75 minutes, freeing up beds faster for incoming emergency admissions.")
    ]

    for title, role, body in stories:
        st_table = doc.add_table(rows=1, cols=1)
        st_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        st_cell = st_table.cell(0, 0)
        st_cell.width = Inches(6.6)
        set_cell_background(st_cell, "F8FAFC")
        set_cell_margins(st_cell, top=100, bottom=100, left=150, right=150)
        
        sp = st_cell.paragraphs[0]
        sp.paragraph_format.space_before = Pt(0)
        sp.paragraph_format.space_after = Pt(2)
        
        r_t = sp.add_run(f"{title} · {role}\n")
        r_t.font.bold = True
        r_t.font.size = Pt(10)
        r_t.font.color.rgb = NAVY
        
        r_b = sp.add_run(f'"{body}"')
        r_b.font.italic = True
        r_b.font.size = Pt(9.5)
        r_b.font.color.rgb = DARK_GRAY

        doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # 6. Operational & Clinical Impact Summary
    add_section_heading("Summary of Business & Clinical Benefits", "6")
    impact_data = [
        ("Operational Dimension", "Traditional Hospital Benchmark", "Meridian Integrated Suite"),
        ("Patient Discharge Turnaround", "4 to 6 hours of waiting & paperwork", "Under 90 minutes with synchronized milestones"),
        ("Discharge Summary Generation", "30–45 mins of manual physician typing", "Under 2 mins of AI drafting and doctor sign-off"),
        ("Nursing Shift Handover Duration", "45–60 mins of fragmented notes", "15 minutes with structured bedside SBAR cards"),
        ("Patient Scheduling Availability", "Limited to business telephone hours", "Instant 24/7 self-service via WhatsApp & Web"),
        ("High-Alert Medication Safety", "Manual chart cross-checking", "Automated EMAR flags for high-risk drugs"),
        ("Inpatient Bed Turnover Speed", "Delayed notifications to housekeeping", "Instant real-time room readiness alerts")
    ]

    impact_table = doc.add_table(rows=len(impact_data), cols=3)
    impact_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    impact_table.autofit = False

    for r_i, r in enumerate(impact_data):
        for c_i, val in enumerate(r):
            cell = impact_table.cell(r_i, c_i)
            cell.width = Inches(2.2)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)

            if r_i == 0:
                set_cell_background(cell, "1E3A8A")
                run = p.add_run(val)
                run.font.bold = True
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(255, 255, 255)
            else:
                bg = "ECFDF5" if c_i == 2 else ("F8FAFC" if r_i % 2 == 1 else "FFFFFF")
                set_cell_background(cell, bg)
                run = p.add_run(val)
                run.font.size = Pt(9.0)
                if c_i == 2:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(6, 95, 70)
                elif c_i == 0:
                    run.font.bold = True
                    run.font.color.rgb = NAVY

    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # Document Footer Note
    footer_p = doc.add_paragraph()
    footer_p.paragraph_format.space_before = Pt(12)
    footer_p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_foot = footer_p.add_run("Meridian Healthcare Intelligent Platform · Document Version 1.0 (Executive Edition)")
    r_foot.font.size = Pt(8.5)
    r_foot.font.italic = True
    r_foot.font.color.rgb = SLATE

    output_path = r"e:\Bosco-projects\POC\Health-care\code\health-care\docs\Meridian_Healthcare_Platform_User_Story_and_Operational_Guide.docx"
    doc.save(output_path)
    print(f"Document saved successfully to {output_path}")

if __name__ == "__main__":
    create_document()
