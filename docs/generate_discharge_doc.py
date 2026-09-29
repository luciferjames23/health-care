import os
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

def set_cell_margins(cell, top=140, bottom=140, left=180, right=180):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_callout(doc, text, title=None, border_color="0E7490", bg_color="F0F9FF"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=160, bottom=160, left=200, right=200)
    
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>\n'
        f'  <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>\n'
        f'  <w:top w:val="none"/>\n'
        f'  <w:right w:val="none"/>\n'
        f'  <w:bottom w:val="none"/>\n'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    if title:
        run_t = p.add_run(title + "\n")
        run_t.font.name = 'Calibri'
        run_t.font.size = Pt(11)
        run_t.font.bold = True
        run_t.font.color.rgb = RGBColor(14, 116, 144)
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(10.5)
    run.font.color.rgb = RGBColor(30, 41, 59)
    run.font.italic = True
    
    p_spacer = doc.add_paragraph()
    p_spacer.paragraph_format.space_before = Pt(2)
    p_spacer.paragraph_format.space_after = Pt(4)

def build_discharge_summary_context_doc():
    doc = docx.Document()
    
    # Page setup
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)
        
        # Header / Footer
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("Use Case Context Document | Smart Discharge Summary Assistant")
        hrun.font.name = 'Calibri'
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(148, 163, 184)
        
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        frun = fp.add_run("Hospital Operations & Clinical Excellence · Confidential & For Internal Use")
        frun.font.name = 'Calibri'
        frun.font.size = Pt(8.5)
        frun.font.color.rgb = RGBColor(148, 163, 184)

    # Base typography
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(30, 41, 59)

    # Color Palette (Hospital Navy, Medical Teal, Dark Slate, Soft Alert)
    NAVY = RGBColor(16, 44, 87)       # #102C57
    TEAL = RGBColor(14, 116, 144)     # #0E7490
    DARK_TEXT = RGBColor(30, 41, 59)  # #1E293B
    MUTED = RGBColor(100, 116, 139)   # #64748B

    # Helper function for headings
    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(16)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = 'Arial'
        run.font.size = Pt(15)
        run.font.bold = True
        run.font.color.rgb = NAVY
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(text)
        run.font.name = 'Arial'
        run.font.size = Pt(12)
        run.font.bold = True
        run.font.color.rgb = TEAL
        return p

    def add_para(text, bold_prefix=None, space_after=6):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.18
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.font.name = 'Calibri'
            r_bold.font.size = Pt(10.5)
            r_bold.font.bold = True
            r_bold.font.color.rgb = DARK_TEXT
        run = p.add_run(text)
        run.font.name = 'Calibri'
        run.font.size = Pt(10.5)
        run.font.color.rgb = DARK_TEXT
        return p

    def add_bullet(text, bold_prefix=None):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_bold = p.add_run(bold_prefix)
            r_bold.font.name = 'Calibri'
            r_bold.font.size = Pt(10.5)
            r_bold.font.bold = True
            r_bold.font.color.rgb = DARK_TEXT
        run = p.add_run(text)
        run.font.name = 'Calibri'
        run.font.size = Pt(10.5)
        run.font.color.rgb = DARK_TEXT
        return p

    # ==========================
    # COVER / HEADER
    # ==========================
    p_badge = doc.add_paragraph()
    p_badge.paragraph_format.space_before = Pt(0)
    p_badge.paragraph_format.space_after = Pt(4)
    run_badge = p_badge.add_run("HOSPITAL OPERATIONS & CLINICAL EXCELLENCE BRIEFING")
    run_badge.font.name = 'Arial'
    run_badge.font.size = Pt(9)
    run_badge.font.bold = True
    run_badge.font.color.rgb = TEAL

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(2)
    p_title.paragraph_format.space_after = Pt(4)
    run_title = p_title.add_run("Smart Discharge Summary Assistant")
    run_title.font.name = 'Arial'
    run_title.font.size = Pt(22)
    run_title.font.bold = True
    run_title.font.color.rgb = NAVY

    p_subtitle = doc.add_paragraph()
    p_subtitle.paragraph_format.space_before = Pt(0)
    p_subtitle.paragraph_format.space_after = Pt(14)
    run_sub = p_subtitle.add_run("Business Context, Clinical Workflow, and Operational Value Document")
    run_sub.font.name = 'Calibri'
    run_sub.font.size = Pt(12)
    run_sub.font.italic = True
    run_sub.font.color.rgb = MUTED

    # Meta Table
    meta_table = doc.add_table(rows=2, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        [("Document Purpose:", " Clinical & Operational Context (Non-Technical)"),
         ("Target Audience:", " Hospital Leadership, Medical Directors, Doctors, Nurses, Hospital Operations")],
        [("Clinical Scope:", " Inpatient Discharge, Transition of Care, Bed Turnover"),
         ("Version & Status:", " Operational Release v2.1 · Approved for Clinical Operations")]
    ]
    for r_idx, row in enumerate(meta_data):
        for c_idx, (k, v) in enumerate(row):
            cell = meta_table.cell(r_idx, c_idx)
            set_cell_background(cell, "F8FAFC")
            set_cell_margins(cell, top=80, bottom=80, left=120, right=120)
            p_cell = cell.paragraphs[0]
            p_cell.paragraph_format.space_before = Pt(0)
            p_cell.paragraph_format.space_after = Pt(0)
            rk = p_cell.add_run(k)
            rk.font.name = 'Calibri'
            rk.font.size = Pt(9.5)
            rk.font.bold = True
            rk.font.color.rgb = TEAL
            rv = p_cell.add_run(v)
            rv.font.name = 'Calibri'
            rv.font.size = Pt(9.5)
            rv.font.color.rgb = DARK_TEXT

    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_before = Pt(8)
    p_div.paragraph_format.space_after = Pt(12)

    # ==========================
    # SECTION 1: EXECUTIVE SUMMARY
    # ==========================
    add_h1("1. Executive Summary")
    add_para(
        "In modern healthcare facilities, the day of discharge is one of the most critical moments in a patient's medical journey. "
        "It represents the delicate transition of clinical responsibility from the inpatient hospital team directly to the patient, "
        "their family, and outpatient primary care physicians. However, in traditional hospital practice, discharge is also the single "
        "largest administrative bottleneck, causing doctor burnout, delayed bed turnaround, and substantial anxiety for patients."
    )
    add_para(
        "The Smart Discharge Summary Assistant is an intelligent, workflow-integrated clinical co-pilot designed to streamline this process. "
        "Instead of forcing overburdened doctors to spend 45 minutes manually searching through physical charts, laboratory reports, "
        "and nursing logs to type out a multi-page document, the assistant instantly compiles the patient's entire hospital stay into a "
        "coherent, structured, and clinically rigorous draft. The doctor retains full medical authority, reviewing and signing the summary "
        "in less than two minutes. This eliminates discharge delays, improves bed turnover, ensures medication safety, and allows patients "
        "to return home on time with complete peace of mind."
    )

    add_callout(
        doc,
        "\"The purpose of the Smart Discharge Summary Assistant is not to replace the doctor's clinical judgment, but to free the doctor from repetitive clerical typing so they can focus on patient healing, clear communication, and safe transitions of care.\"",
        "Core Philosophy: Human-in-the-Loop Clinical Excellence"
    )

    # ==========================
    # SECTION 2: THE CURRENT PROBLEM
    # ==========================
    add_h1("2. The Problem: Why Hospital Discharge is Broken Today")
    add_para(
        "Hospital discharges across medical centers worldwide face recurring operational challenges that impact staff morale, "
        "hospital capacity, and patient recovery outcomes. These challenges fall into four critical areas:"
    )

    add_h2("A. Severe Physician Burden and Documentation Fatigue")
    add_bullet(
        "Attending physicians and resident doctors must manually locate information across admission records, daily progress notes, "
        "consultant reports, lab results, surgical notes, and medication administration records.",
        "Scattered Information: "
    )
    add_bullet(
        "Typing a legally sound, medically complete discharge summary takes an average of 30 to 45 minutes per inpatient. "
        "For a physician managing 15 to 20 patients, documentation consumes 4 to 5 hours of each working day.",
        "Exhausting Time Demand: "
    )
    add_bullet(
        "Doctors are frequently pulled between bedside emergencies and typing paperwork, resulting in discharge summaries being delayed "
        "until the end of the shift or completed with rushed, abbreviated notes.",
        "Divided Attention: "
    )

    add_h2("B. Patient and Family Frustration")
    add_bullet(
        "Patients are routinely told during morning rounds, 'You are medically cleared to go home today.' Yet they remain waiting in their "
        "hospital room or the discharge lounge until late afternoon or evening waiting for typed paperwork.",
        "The Long Waiting Ordeal: "
    )
    add_bullet(
        "Families take time off work and arrange transportation expecting a morning release, only to face hours of uncertainty, repeatedly "
        "asking nursing staff for updates.",
        "Emotional & Financial Strain: "
    )

    add_h2("C. Hospital Bed Blockages and Capacity Crises")
    add_bullet(
        "Because morning discharges are delayed until mid-afternoon, inpatient beds remain occupied by patients who are clinically ready to leave.",
        "Bed Turnaround Bottleneck: "
    )
    add_bullet(
        "Patients requiring emergency admission from the Emergency Department or post-anesthesia care units cannot be transferred to inpatient "
        "wards because clean beds are not yet available.",
        "Emergency Department Overcrowding: "
    )

    add_h2("D. Post-Discharge Readmission & Medication Errors")
    add_bullet(
        "Rushed, handwritten, or poorly formatted discharge sheets often lack clear instructions regarding which pre-admission medicines "
        "to continue, modify, or discontinue.",
        "Medication Confusion: "
    )
    add_bullet(
        "Patients often leave without clear explanations of warning symptoms ('red flags') that require immediate medical attention, "
        "leading to preventable emergency visits and 30-day hospital readmissions.",
        "Ambiguous Self-Care Guidance: "
    )

    # ==========================
    # SECTION 3: THE SOLUTION
    # ==========================
    add_h1("3. The Solution: What is the Smart Discharge Summary Assistant?")
    add_para(
        "The Smart Discharge Summary Assistant is a dedicated digital partner embedded directly within the hospital's clinical workstation. "
        "It acts as an intelligent medical scribe and care coordinator that monitors each patient's hospitalization from admission to departure."
    )
    add_para(
        "Rather than requiring human staff to manually piece together clinical puzzle pieces, the assistant automatically collects and "
        "harmonizes all relevant health events: the initial complaint, emergency findings, inpatient treatments, vital sign trends, "
        "diagnostic results, and medication modifications."
    )

    # Table of Core Capabilities
    tbl_cap = doc.add_table(rows=5, cols=2)
    tbl_cap.alignment = WD_TABLE_ALIGNMENT.CENTER
    caps = [
        ("Instant Synthesis of Clinical Stay", "Transforms days or weeks of fragmented inpatient progress notes, nursing assessments, and lab reports into a crisp, chronological medical summary in seconds."),
        ("Multi-Department Synchronization", "Connects doctor clearance, nursing verification, pharmacy medication checks, and billing closure into a single transparent checklist."),
        ("Patient-Centric Medication Schedules", "Organizes take-home prescriptions into an easy-to-read schedule detailing exact times of day, relation to meals, dosage, and purpose."),
        ("Actionable Home Care & Warning Signs", "Generates clear, patient-friendly guidance on wound dressing, dietary precautions, activity limits, and specific danger signs that warrant urgent care."),
        ("Guaranteed Physician Governance", "Maintains absolute clinical safety: no document is finalized, printed, or filed without the attending physician reviewing, editing, and digitally signing off.")
    ]
    for idx, (head, desc) in enumerate(caps):
        cell_h = tbl_cap.cell(idx, 0)
        cell_d = tbl_cap.cell(idx, 1)
        cell_h.width = Inches(2.2)
        cell_d.width = Inches(4.5)
        set_cell_background(cell_h, "F1F5F9")
        set_cell_background(cell_d, "FFFFFF")
        set_cell_margins(cell_h, top=100, bottom=100, left=140, right=140)
        set_cell_margins(cell_d, top=100, bottom=100, left=140, right=140)
        
        ph = cell_h.paragraphs[0]
        ph.paragraph_format.space_before = Pt(0)
        ph.paragraph_format.space_after = Pt(0)
        rh = ph.add_run(head)
        rh.font.name = 'Calibri'
        rh.font.size = Pt(10)
        rh.font.bold = True
        rh.font.color.rgb = TEAL

        pd = cell_d.paragraphs[0]
        pd.paragraph_format.space_before = Pt(0)
        pd.paragraph_format.space_after = Pt(0)
        pd.paragraph_format.line_spacing = 1.15
        rd = pd.add_run(desc)
        rd.font.name = 'Calibri'
        rd.font.size = Pt(10)
        rd.font.color.rgb = DARK_TEXT

    p_div2 = doc.add_paragraph()
    p_div2.paragraph_format.space_before = Pt(8)
    p_div2.paragraph_format.space_after = Pt(10)

    # ==========================
    # SECTION 4: THE HOSPITAL WORKFLOW
    # ==========================
    add_h1("4. The Day-in-the-Life Hospital Workflow")
    add_para(
        "Here is how the Smart Discharge Summary Assistant operates during routine hospital care, from morning rounds to patient farewell:"
    )

    steps = [
        ("Step 1: Clinical Readiness Assessment", "During morning ward rounds, the attending physician examines the patient, checks the latest vital signs and lab results, and determines that the patient is medically fit for discharge. The doctor marks the patient as 'Ready for Discharge' on the ward board."),
        ("Step 2: Instant Background Compilation", "The moment the discharge flag is triggered, the assistant compiles all medical notes, vital trend graphs, nursing logs, pharmacy records, and diagnostic tests from the stay into a complete, structured discharge draft."),
        ("Step 3: Multi-Disciplinary Clearance Tracking", "The system displays live clearance status for the patient across five hospital departments: Clinical Clearance (Doctor), Nursing Clearance (Vitals & lines removed), Pharmacy Clearance (Take-home medication ready), Billing Clearance (Final bill reconciled), and Housekeeping (Bed preparation queued)."),
        ("Step 4: Physician 60-Second Review & Sign-Off", "The attending doctor opens the prepared summary. Every section—reason for admission, treatments performed, progress made, discharge medications, and follow-up plan—is already written in clear clinical language. The doctor modifies any specific advice if desired and signs the document with a single confirmation."),
        ("Step 5: Patient Counseling and Departure", "The ward nurse prints the finalized discharge summary. The nurse reviews the easy-to-follow medication timetable and warning symptoms with the patient and family. The patient leaves comfortably before lunch, and housekeeping is immediately notified to sanitize the bed for the next admission.")
    ]

    for title, desc in steps:
        add_para(desc, bold_prefix=title + ": ", space_after=5)

    # ==========================
    # SECTION 5: ANATOMY OF THE DISCHARGE SUMMARY
    # ==========================
    add_h1("5. Anatomy of the Smart Discharge Summary")
    add_para(
        "The generated summary is structured into clear, standardized sections that comply with international hospital accreditation "
        "and medical documentation guidelines:"
    )

    sections_data = [
        ("1. Patient Demographics & Stay Overview", "Patient name, medical record number, age, gender, admission date, discharge date, attending consultant, and hospital department."),
        ("2. Final Diagnoses & Clinical Presentation", "Primary reason for admission, confirmed final diagnoses, and any active underlying chronic conditions (e.g., Hypertension, Diabetes)."),
        ("3. Hospital Course & Treatments Provided", "Chronological narrative of the inpatient stay, surgeries or interventional procedures performed, supportive care, and clinical improvement achieved."),
        ("4. Vital Signs & Diagnostic Trajectory", "Admission baseline vitals compared against discharge vitals (Blood Pressure, Heart Rate, Oxygen Saturation, Temperature) confirming clinical stability."),
        ("5. Reconciled Home Medication Regimen", "Table of prescribed medicines specifying drug name, precise strength, dosage timing (morning, afternoon, night), meal relationship, and duration."),
        ("6. Dietary, Wound & Activity Instructions", "Clear guidance on daily physical activity, wound care or dressing changes, dietary restrictions (e.g., low salt, diabetic friendly), and bathing safety."),
        ("7. Red Flag Warning Symptoms", "Specific danger signs requiring urgent hospital contact (e.g., fever above 101°F, sudden shortness of breath, chest discomfort, unusual swelling)."),
        ("8. Follow-Up Appointments & Diagnostic Tests", "Explicit appointment date, consulting doctor's name, clinic department, and any blood tests or scans required prior to the visit.")
    ]

    for s_title, s_desc in sections_data:
        add_bullet(s_desc, bold_prefix=s_title + ": ")

    # ==========================
    # SECTION 6: WHO BENEFITS
    # ==========================
    add_h1("6. Key Stakeholders: Who Benefits and How")
    add_para("The assistant creates immediate, positive impacts across every tier of the hospital organization:")

    stakeholders = [
        ("Attending Physicians & Specialists", "Saves 35+ minutes of clerical typing per patient. Restores joy in practice by letting doctors focus on bedside medicine instead of administrative documentation."),
        ("Ward Nurses & Nurse Supervisors", "Eliminates frantic telephone calls to track down doctors for signatures. Provides instant visibility into discharge readiness and ensures consistent patient discharge education."),
        ("Hospital Pharmacists", "Receives clear, reconciled medication plans with zero ambiguities in dosage or frequency, drastically cutting prescription clarifications."),
        ("Hospital Administrators & Bed Managers", "Accelerates bed turnaround by several hours each morning. Enables faster admissions from the Emergency Department, increases patient throughput, and maximizes bed utilization."),
        ("Patients and Family Caregivers", "Replaces exhausting 6-hour waits in hospital chairs with an orderly morning discharge. Patients go home with clear, legible guidance they can easily follow.")
    ]

    for role, benefit in stakeholders:
        add_bullet(benefit, bold_prefix=role + " — ")

    # ==========================
    # SECTION 7: BEFORE AND AFTER COMPARISON
    # ==========================
    add_h1("7. Operational Impact: Before vs. After")
    add_para(
        "The following table highlights the tangible operational contrast between the traditional manual discharge process "
        "and the modernized workflow powered by the Smart Discharge Summary Assistant:"
    )

    table_comp = doc.add_table(rows=7, cols=3)
    table_comp.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    headers = ["Operational Dimension", "Traditional Manual Process", "With Smart Discharge Assistant"]
    for c_idx, h_text in enumerate(headers):
        cell = table_comp.cell(0, c_idx)
        set_cell_background(cell, "102C57")
        set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h_text)
        r.font.name = 'Arial'
        r.font.size = Pt(10)
        r.font.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255)

    comp_rows = [
        ("Physician Documentation Time", "30 to 45 minutes of manual typing per patient", "Under 2 minutes for comprehensive review and sign-off"),
        ("Discharge Lounge Wait Time", "4 to 6 hours after morning doctor visit", "Under 45 minutes from clinical clearance to departure"),
        ("Bed Availability for New Patients", "Beds vacated late afternoon (3:00 PM – 6:00 PM)", "Beds cleaned and available before noon (11:30 AM)"),
        ("Medication Reconciliation Errors", "Frequent omissions due to handwritten or rushed notes", "Zero omissions; fully aligned with hospital pharmacy"),
        ("Emergency Department Bottleneck", "Admitted patients stuck on stretchers in hallways", "Steady bed flow eliminates boarding backlogs"),
        ("Patient Caregiver Experience", "Stressful, confusing, and filled with prolonged waiting", "Smooth, dignified, and clearly explained transition home")
    ]

    for r_idx, row in enumerate(comp_rows):
        bg = "F8FAFC" if r_idx % 2 == 0 else "FFFFFF"
        for c_idx, text in enumerate(row):
            cell = table_comp.cell(r_idx + 1, c_idx)
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            r = p.add_run(text)
            r.font.name = 'Calibri'
            r.font.size = Pt(9.5)
            if c_idx == 0:
                r.font.bold = True
                r.font.color.rgb = TEAL
            elif c_idx == 1:
                r.font.color.rgb = RGBColor(120, 53, 15)  # Muted brown/red
            else:
                r.font.bold = True
                r.font.color.rgb = RGBColor(4, 120, 87)    # Green

    p_div3 = doc.add_paragraph()
    p_div3.paragraph_format.space_before = Pt(10)
    p_div3.paragraph_format.space_after = Pt(10)

    # ==========================
    # SECTION 8: REAL-WORLD PATIENT JOURNEY
    # ==========================
    add_h1("8. Real-World Case Example: A Day-in-the-Life Story")
    add_para(
        "To appreciate the human impact of this solution, consider the experience of Mr. Arthur, a 64-year-old patient admitted "
        "for pneumonia and cardiac observation, under both the old and new systems:"
    )

    add_callout(
        doc,
        "Scenario: Morning Rounds at 8:30 AM\n\n"
        "• Under the Old System: Dr. Sharma tells Mr. Arthur he can go home. But Dr. Sharma must immediately rush to examine critical ICU patients and conduct clinic appointments. The discharge summary paperwork sits unwritten until 2:30 PM. Mr. Arthur and his daughter wait anxiously in the room, missing work, skipping lunch, and feeling abandoned. When paperwork finally arrives at 4:15 PM, instructions are hurriedly explained, and Mr. Arthur leaves exhausted with an illegible prescription.\n\n"
        "• With the Smart Discharge Assistant: At 8:30 AM, Dr. Sharma confirms Mr. Arthur is ready. The assistant immediately drafts the full hospital narrative, recording his five-day antibiotic course, oxygen recovery milestones, and current stable vitals. Between patients at 8:45 AM, Dr. Sharma takes 75 seconds to review the summary on a tablet, verifies the home inhaler schedule, and signs off. By 9:30 AM, pharmacy medications are delivered, the ward nurse reviews the printed warning signs with Arthur's daughter, and by 10:15 AM, Arthur is happily in his family's car heading home. His bed is cleaned and assigned to a newly arrived patient by 11:00 AM.",
        "Clinical Vignette: Transforming Mr. Arthur's Discharge"
    )

    # ==========================
    # SECTION 9: PATIENT SAFETY & QUALITY STANDARDS
    # ==========================
    add_h1("9. Patient Safety and Clinical Governance")
    add_para(
        "A common concern with automation in healthcare is whether clinical accuracy or patient safety is compromised. "
        "The Smart Discharge Summary Assistant is built from the ground up on three immutable principles of medical governance:"
    )

    add_bullet(
        "The assistant is an assistive scribe, never an autonomous decision-maker. It never discharges a patient or prescribes medication independently. Every document requires explicit physician review and digital authorization.",
        "1. Complete Physician Oversight: "
    )
    add_bullet(
        "Every sentence in the generated summary is drawn exclusively from verified hospital records (physician notes, nursing observations, lab reports, and medication charts). No speculative or outside medical assertions are permitted.",
        "2. Strict Record Traceability: "
    )
    add_bullet(
        "The summary formats adhere strictly to standardized healthcare documentation frameworks, ensuring seamless legal compliance and smooth communication with family practitioners and outside specialists.",
        "3. Standardized Medical Formatting: "
    )

    # ==========================
    # SECTION 10: SUMMARY & CONCLUSION
    # ==========================
    add_h1("10. Conclusion")
    add_para(
        "The Smart Discharge Summary Assistant transforms hospital discharge from an administrative bottleneck into an exemplar "
        "of clinical coordination, patient safety, and compassionate care. By freeing doctors from hours of clerical paperwork, "
        "accelerating bed turnover for waiting emergency patients, and providing families with crystal-clear home recovery guidance, "
        "it delivers immense, immediate value to healthcare providers, staff, and patients alike."
    )

    output_dir = r"e:\Bosco-projects\POC\Health-care\code\health-care\docs"
    output_filename = "Discharge_Summary_Agent_Use_Case_Context_Document.docx"
    output_path = os.path.join(output_dir, output_filename)
    
    doc.save(output_path)
    print(f"Document saved successfully at: {output_path}")
    
    # Also save a copy at root for immediate convenience
    root_path = r"e:\Bosco-projects\POC\Health-care\Discharge_Summary_Agent_Use_Case_Context_Document.docx"
    doc.save(root_path)
    print(f"Root copy saved successfully at: {root_path}")

if __name__ == "__main__":
    build_discharge_summary_context_doc()
