import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, hex_color):
    """Set the background color of a table cell."""
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    tc_pr.append(shd)

def set_cell_margins(cell, top=140, bottom=140, left=200, right=200):
    """Set cell margins in twips."""
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tc_pr.append(tc_mar)

def set_cell_borders(cell, top=None, bottom=None, left=None, right=None):
    """Configure cell borders."""
    tc_pr = cell._tc.get_or_add_tcPr()
    borders_elm = OxmlElement('w:tcBorders')
    
    border_defs = {'top': top, 'bottom': bottom, 'left': left, 'right': right}
    for side, border in border_defs.items():
        if border:
            val = border.get('val', 'single')
            sz = str(border.get('sz', 4))
            space = str(border.get('space', 0))
            color = border.get('color', 'auto')
            b_elm = parse_xml(f'<w:{side} {nsdecls("w")} w:val="{val}" w:sz="{sz}" w:space="{space}" w:color="{color}"/>')
            borders_elm.append(b_elm)
        else:
            b_elm = parse_xml(f'<w:{side} {nsdecls("w")} w:val="none"/>')
            borders_elm.append(b_elm)
            
    tc_pr.append(borders_elm)

def create_document(output_path):
    doc = docx.Document()

    # Page Margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)

    # Palette
    COLOR_PRIMARY = RGBColor(26, 54, 93)     # Deep Navy #1A365D
    COLOR_SECONDARY = RGBColor(13, 148, 136) # Medical Teal #0D9488
    COLOR_TEXT = RGBColor(30, 41, 59)        # Slate Dark #1E293B
    COLOR_MUTED = RGBColor(100, 116, 139)    # Muted Gray #64748B
    HEX_PRIMARY = "1A365D"
    HEX_TEAL = "0D9488"
    HEX_LIGHT_BG = "F8FAFC"
    HEX_BORDER = "CBD5E1"
    HEX_CALLOUT_BG = "F0FDFA"
    HEX_WARM_GRAY = "F1F5F9"

    # Header & Footer setup
    header = sections[0].header
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hrun = hp.add_run("Hospital Care Solutions | Discharge Summary Assistant")
    hrun.font.name = "Arial"
    hrun.font.size = Pt(8.5)
    hrun.font.color.rgb = COLOR_MUTED

    footer = sections[0].footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    frun = fp.add_run("Confidential – Prepared for Hospital Leadership & Clinical Teams")
    frun.font.name = "Arial"
    frun.font.size = Pt(8.5)
    frun.font.color.rgb = COLOR_MUTED

    # ------------------ TITLE SECTION ------------------
    # Category tag
    p_tag = doc.add_paragraph()
    p_tag.paragraph_format.space_before = Pt(0)
    p_tag.paragraph_format.space_after = Pt(4)
    run_tag = p_tag.add_run("HEALTHCARE OPERATIONS & PATIENT EXPERIENCE")
    run_tag.font.name = "Arial"
    run_tag.font.size = Pt(9.5)
    run_tag.font.bold = True
    run_tag.font.color.rgb = COLOR_SECONDARY

    # Main Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(4)
    run_title = p_title.add_run("Discharge Summary Assistant")
    run_title.font.name = "Arial"
    run_title.font.size = Pt(24)
    run_title.font.bold = True
    run_title.font.color.rgb = COLOR_PRIMARY

    # Subtitle
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(16)
    run_sub = p_sub.add_run("Transforming patient discharge into a fast, accurate, and stress-free care transition")
    run_sub.font.name = "Arial"
    run_sub.font.size = Pt(12)
    run_sub.font.color.rgb = COLOR_MUTED

    # Summary Callout Banner
    tbl_exec = doc.add_table(rows=1, cols=1)
    tbl_exec.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell_exec = tbl_exec.cell(0, 0)
    set_cell_background(cell_exec, HEX_CALLOUT_BG)
    set_cell_margins(cell_exec, top=160, bottom=160, left=240, right=200)
    set_cell_borders(cell_exec, left={'val': 'single', 'sz': 24, 'color': HEX_TEAL},
                                top={'val': 'single', 'sz': 4, 'color': HEX_BORDER},
                                bottom={'val': 'single', 'sz': 4, 'color': HEX_BORDER},
                                right={'val': 'single', 'sz': 4, 'color': HEX_BORDER})

    p_exec = cell_exec.paragraphs[0]
    p_exec.paragraph_format.space_after = Pt(4)
    run_exec_title = p_exec.add_run("Executive Overview\n")
    run_exec_title.font.name = "Arial"
    run_exec_title.font.size = Pt(11)
    run_exec_title.font.bold = True
    run_exec_title.font.color.rgb = COLOR_SECONDARY

    run_exec_body = p_exec.add_run(
        "Discharging a patient should be a moment of relief and recovery. In practice, traditional discharge "
        "is bogged down by hours of manual paperwork, doctor typing, and delayed communication. "
        "The Discharge Summary Assistant is an intelligent care partner that automatically drafts comprehensive, "
        "doctor-ready discharge papers in seconds—saving clinical hours, eliminating patient waiting rooms delays, "
        "and safeguarding care instructions after patients go home."
    )
    run_exec_body.font.name = "Arial"
    run_exec_body.font.size = Pt(10)
    run_exec_body.font.color.rgb = COLOR_TEXT

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    def add_section_header(title, number=""):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.keep_with_next = True
        
        # Accent bar & title
        run_num = p.add_run(f"{number}. " if number else "")
        run_num.font.name = "Arial"
        run_num.font.size = Pt(15)
        run_num.font.bold = True
        run_num.font.color.rgb = COLOR_SECONDARY

        run_txt = p.add_run(title)
        run_txt.font.name = "Arial"
        run_txt.font.size = Pt(15)
        run_txt.font.bold = True
        run_txt.font.color.rgb = COLOR_PRIMARY

        # Thin rule under header
        p_line = doc.add_paragraph()
        p_line.paragraph_format.space_before = Pt(0)
        p_line.paragraph_format.space_after = Pt(10)
        p_line.paragraph_format.keep_with_next = True
        run_line = p_line.add_run("―" * 55)
        run_line.font.name = "Arial"
        run_line.font.size = Pt(8)
        run_line.font.color.rgb = RGBColor(203, 213, 225)

    def add_bullet_point(title, text):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(4)
        run_b_title = p.add_run(f"{title}: ")
        run_b_title.font.name = "Arial"
        run_b_title.font.size = Pt(10)
        run_b_title.font.bold = True
        run_b_title.font.color.rgb = COLOR_PRIMARY
        
        run_b_text = p.add_run(text)
        run_b_text.font.name = "Arial"
        run_b_text.font.size = Pt(10)
        run_b_text.font.color.rgb = COLOR_TEXT

    # ------------------ 1. PROBLEM ------------------
    add_section_header("The Problem", "1")

    p_prob_intro = doc.add_paragraph()
    p_prob_intro.paragraph_format.space_after = Pt(6)
    run_pi = p_prob_intro.add_run(
        "Discharge day is frequently the most stressful and slow part of a hospital stay. "
        "Even after a doctor tells a patient they are healthy enough to leave, the patient remains trapped in their hospital room "
        "for half the day while paperwork slowly crawls through multiple offices."
    )
    run_pi.font.name = "Arial"
    run_pi.font.size = Pt(10.5)
    run_pi.font.color.rgb = COLOR_TEXT

    add_bullet_point(
        "Exhausting Waits for Patients & Families",
        "Patients sit packed and ready in their room for 4 to 8 hours just waiting for discharge paperwork. "
        "Families grow frustrated, worried, and tired, turning what should be a happy departure into a painful experience."
    )
    add_bullet_point(
        "Doctors Trapped in Clerical Paperwork",
        "Physicians must manually dig through piles of charts, nursing notes, lab sheets, and prescription lists to write a summary from scratch. "
        "This takes 30 to 60 minutes per patient, robbing doctors of valuable time they need to spend caring for critically ill patients."
    )
    add_bullet_point(
        "Hospital Bed Gridlock & Lost Admissions",
        "Because discharged patients cannot leave their rooms until paperwork is signed, nursing cannot clean beds. "
        "New incoming patients and emergency room arrivals face hours of delays in the waiting room waiting for open rooms."
    )
    add_bullet_point(
        "Risk of Misunderstood Care at Home",
        "When doctors are hurried and exhausted, hand-drafted summaries can be hard for patients to read or understand. "
        "Patients go home confused about how and when to take their medications, what symptoms are dangerous, or when to come back for a check-up."
    )

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # ------------------ 2. SOLUTION ------------------
    add_section_header("The Solution", "2")

    p_sol_intro = doc.add_paragraph()
    p_sol_intro.paragraph_format.space_after = Pt(6)
    run_si = p_sol_intro.add_run(
        "The Discharge Summary Assistant acts as a smart, dedicated clinical helper that automatically compiles "
        "the patient’s entire hospital journey into a clear, complete, and doctor-ready discharge document in seconds."
    )
    run_si.font.name = "Arial"
    run_si.font.size = Pt(10.5)
    run_si.font.color.rgb = COLOR_TEXT

    add_bullet_point(
        "Instant Document Assembly",
        "The moment a doctor decides a patient is ready for discharge, the assistant instantly brings together all hospital records—admission reasons, daily doctor updates, vital sign charts, lab and scan findings, treatments given, and home medications—into a clean, professional summary."
    )
    add_bullet_point(
        "Doctor Always in Total Control",
        "The doctor never has to write a summary from a blank page. The assistant presents a complete, neatly organized draft. The physician reviews the information on screen, makes any desired personalized notes or adjustments, and gives final approval with a single click."
    )
    add_bullet_point(
        "Easy-to-Understand Patient Guidance",
        "The assistant translates confusing medical jargon into simple, patient-friendly instructions. It clearly lists what medications to take, at what times, what foods to eat or avoid, warning signs that require immediate attention, and the exact date for the follow-up visit."
    )
    add_bullet_point(
        "Rapid Multi-Channel Delivery",
        "Once approved by the doctor, the summary is instantly available to print at the nursing station or send directly to the patient's phone (via WhatsApp or text). Patients can head home without unnecessary hallway waits."
    )

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # Comparison Table
    tbl_comp = doc.add_table(rows=5, cols=3)
    tbl_comp.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_comp.autofit = False

    col_widths = [Inches(1.8), Inches(2.5), Inches(2.5)]
    headers = ["Aspect", "Traditional Hospital Discharge", "With Discharge Summary Assistant"]
    
    # Header Row
    hdr_cells = tbl_comp.rows[0].cells
    for i, h_text in enumerate(headers):
        hdr_cells[i].width = col_widths[i]
        set_cell_background(hdr_cells[i], HEX_PRIMARY)
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=140, right=140)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        run = p.add_run(h_text)
        run.font.name = "Arial"
        run.font.size = Pt(9.5)
        run.font.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)

    comp_data = [
        ("Discharge Waiting Time", "4 to 8 hours waiting in room after clearance", "20 to 30 minutes total time to departure"),
        ("Doctor Writing Burden", "30 to 60 minutes manual typing per patient", "Under 2 minutes to review and approve draft"),
        ("Patient Care Guidance", "Dense clinical jargon, hard for families to follow", "Clear, simple instructions for home recovery"),
        ("Bed Turnover & Readiness", "Beds blocked for hours, delaying incoming admissions", "Beds promptly freed up and cleaned for new patients")
    ]

    for row_idx, data in enumerate(comp_data, start=1):
        row_cells = tbl_comp.rows[row_idx].cells
        bg_col = HEX_LIGHT_BG if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text in enumerate(data):
            row_cells[col_idx].width = col_widths[col_idx]
            set_cell_background(row_cells[col_idx], bg_col)
            set_cell_margins(row_cells[col_idx], top=100, bottom=100, left=140, right=140)
            set_cell_borders(row_cells[col_idx],
                             top={'val': 'single', 'sz': 4, 'color': HEX_BORDER},
                             bottom={'val': 'single', 'sz': 4, 'color': HEX_BORDER},
                             left={'val': 'none'}, right={'val': 'none'})
            p = row_cells[col_idx].paragraphs[0]
            run = p.add_run(text)
            run.font.name = "Arial"
            run.font.size = Pt(9)
            if col_idx == 0:
                run.font.bold = True
                run.font.color.rgb = COLOR_PRIMARY
            elif col_idx == 1:
                run.font.color.rgb = COLOR_MUTED
            else:
                run.font.bold = True
                run.font.color.rgb = COLOR_SECONDARY

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # ------------------ 3. PLATFORM ------------------
    add_section_header("The Platform", "3")

    p_plat_intro = doc.add_paragraph()
    p_plat_intro.paragraph_format.space_after = Pt(6)
    run_pli = p_plat_intro.add_run(
        "The platform provides a simple, clean, and intuitive digital workspace designed for doctors, "
        "nurses, and hospital administrators. It connects all hospital departments so everyone stays on the exact same page."
    )
    run_pli.font.name = "Arial"
    run_pli.font.size = Pt(10.5)
    run_pli.font.color.rgb = COLOR_TEXT

    add_bullet_point(
        "Doctor's Central Care Dashboard",
        "Doctors see all their active patients in one easy-to-read view. Colored status tags clearly show who is in recovery, who is medically cleared, and whose discharge summary is ready for sign-off."
    )
    add_bullet_point(
        "Connected Department Teamwork",
        "Connects the four core hospital teams effortlessly:\n"
        "  • Doctors: Review and approve summaries with complete clinical freedom.\n"
        "  • Nursing Stations: Get instant notification when a summary is signed so they can prepare the patient for departure.\n"
        "  • Hospital Pharmacy: Receives final medication orders early to dispense take-home medicines ahead of time.\n"
        "  • Billing Desk: Synchronizes discharge clearance smoothly without holding up patient care."
    )
    add_bullet_point(
        "Accessible Anywhere in the Hospital",
        "Whether doctors are at their ward desk, rounding with a bedside tablet, or checking between consultations on their mobile device, the platform is always accessible with secure sign-in."
    )
    add_bullet_point(
        "Built-in Clinical Safety Checklist",
        "Before any summary is finalized, the platform automatically checks for completeness—confirming all critical safety details such as allergy warnings, follow-up dates, emergency contact phone numbers, and essential medicines."
    )

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # ------------------ 4. IMPACT ------------------
    add_section_header("The Impact", "4")

    p_imp_intro = doc.add_paragraph()
    p_imp_intro.paragraph_format.space_after = Pt(6)
    run_ii = p_imp_intro.add_run(
        "By replacing slow manual paperwork with instant, guided assistance, the platform delivers significant, "
        "measurable improvements across the entire hospital community."
    )
    run_ii.font.name = "Arial"
    run_ii.font.size = Pt(10.5)
    run_ii.font.color.rgb = COLOR_TEXT

    # 3-Pillar Impact Cards (Table with 3 columns)
    tbl_impact = doc.add_table(rows=1, cols=3)
    tbl_impact.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_impact.autofit = False
    card_widths = [Inches(2.26), Inches(2.26), Inches(2.26)]

    impact_cards_content = [
        ("For Patients & Families", [
            ("80% Faster Discharge", "Departure time drops from 4–8 hours to under 30 minutes."),
            ("Zero Medication Confusion", "Clear schedules and plain-language home recovery advice."),
            ("Dignified Care Experience", "Patients leave smiling, rested, and confident instead of frustrated.")
        ]),
        ("For Doctors & Care Teams", [
            ("Hours Saved Daily", "Eliminates up to 45 minutes of tedious typing per patient."),
            ("Drastically Reduced Burnout", "Relieves doctors from late-night clerical backlog."),
            ("More Time at the Bedside", "Clinicians refocus their energy on listening to and treating patients.")
        ]),
        ("For Hospital Leadership", [
            ("Faster Bed Availability", "Rooms vacate hours earlier, opening beds for waiting admissions."),
            ("Lower Readmission Rates", "Patients take medicines correctly, avoiding preventable return visits."),
            ("Stronger Hospital Reputation", "Families remember smooth, compassionate departures and recommend the hospital.")
        ])
    ]

    for col_idx, (card_title, items) in enumerate(impact_cards_content):
        cell = tbl_impact.cell(0, col_idx)
        cell.width = card_widths[col_idx]
        set_cell_background(cell, HEX_WARM_GRAY)
        set_cell_margins(cell, top=140, bottom=140, left=140, right=140)
        set_cell_borders(cell,
                         top={'val': 'single', 'sz': 16, 'color': HEX_PRIMARY if col_idx != 1 else HEX_TEAL},
                         bottom={'val': 'single', 'sz': 4, 'color': HEX_BORDER},
                         left={'val': 'single', 'sz': 4, 'color': HEX_BORDER},
                         right={'val': 'single', 'sz': 4, 'color': HEX_BORDER})
        
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(8)
        run_ct = p.add_run(card_title)
        run_ct.font.name = "Arial"
        run_ct.font.size = Pt(10.5)
        run_ct.font.bold = True
        run_ct.font.color.rgb = COLOR_PRIMARY if col_idx != 1 else COLOR_SECONDARY

        for item_title, item_desc in items:
            p_item = cell.add_paragraph()
            p_item.paragraph_format.space_before = Pt(4)
            p_item.paragraph_format.space_after = Pt(4)
            
            run_it = p_item.add_run(f"• {item_title}\n")
            run_it.font.name = "Arial"
            run_it.font.size = Pt(9)
            run_it.font.bold = True
            run_it.font.color.rgb = COLOR_TEXT

            run_id = p_item.add_run(item_desc)
            run_id.font.name = "Arial"
            run_id.font.size = Pt(8.5)
            run_id.font.color.rgb = COLOR_MUTED

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # Closing Callout Box
    tbl_close = doc.add_table(rows=1, cols=1)
    tbl_close.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell_close = tbl_close.cell(0, 0)
    set_cell_background(cell_close, HEX_CALLOUT_BG)
    set_cell_margins(cell_close, top=140, bottom=140, left=200, right=180)
    set_cell_borders(cell_close, left={'val': 'single', 'sz': 20, 'color': HEX_TEAL},
                                 top={'val': 'single', 'sz': 4, 'color': HEX_BORDER},
                                 bottom={'val': 'single', 'sz': 4, 'color': HEX_BORDER},
                                 right={'val': 'single', 'sz': 4, 'color': HEX_BORDER})

    p_close = cell_close.paragraphs[0]
    p_close.paragraph_format.space_after = Pt(2)
    run_close_title = p_close.add_run("Key Takeaway for Hospital Leadership\n")
    run_close_title.font.name = "Arial"
    run_close_title.font.size = Pt(10.5)
    run_close_title.font.bold = True
    run_close_title.font.color.rgb = COLOR_SECONDARY

    run_close_body = p_close.add_run(
        "The Discharge Summary Assistant is not about replacing doctors—it is about empowering them. "
        "By taking away the heavy burden of clerical typing and coordinating all hospital departments in real time, "
        "the hospital turns its most delayed, stressful bottleneck into a fast, professional, and compassionate experience."
    )
    run_close_body.font.name = "Arial"
    run_close_body.font.size = Pt(9.5)
    run_close_body.font.color.rgb = COLOR_TEXT

    # Save
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")

if __name__ == "__main__":
    out_file = r"e:\Bosco-projects\POC\Health-care\code\health-care\Discharge_Summary_Agent_Overview.docx"
    create_document(out_file)
