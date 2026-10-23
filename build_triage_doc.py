from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.section import WD_SECTION

OUT = r"D:\POC\health-care\AI_Radiology_Triage_System_Clinical_Platform_Brief.docx"

doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.27)
sec.page_height = Inches(11.69)
sec.top_margin = Inches(0.72)
sec.bottom_margin = Inches(0.72)
sec.left_margin = Inches(0.78)
sec.right_margin = Inches(0.78)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Times New Roman"
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
normal.font.size = Pt(10.5)
normal.font.color.rgb = RGBColor(0, 0, 0)
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.line_spacing = 1.04

for name, size in (("Title", 17), ("Heading 1", 14), ("Heading 2", 11)):
    st = styles[name]
    st.font.name = "Times New Roman"
    st._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    st.font.size = Pt(size)
    st.font.bold = True
    st.font.color.rgb = RGBColor(0, 0, 0)
    st.paragraph_format.keep_with_next = True
    st.paragraph_format.space_before = Pt(8 if name != "Title" else 0)
    st.paragraph_format.space_after = Pt(4)
    rfonts = st._element.rPr.rFonts
    for attr in ("ascii", "hAnsi", "cs", "eastAsia"):
        rfonts.set(qn("w:" + attr), "Times New Roman")

# Word's built-in Title style carries a theme border in some installations.
# Remove it so the title matches the plain, black reference document.
title_style = styles["Title"]._element
title_ppr = title_style.find(qn("w:pPr"))
if title_ppr is not None:
    border = title_ppr.find(qn("w:pBdr"))
    if border is not None:
        title_ppr.remove(border)

def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = tcPr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tcPr.append(shd)
    shd.set(qn("w:fill"), fill)

def cell_margins(cell, top=90, start=110, bottom=90, end=110):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    mar = tcPr.first_child_found_in("w:tcMar")
    if mar is None:
        mar = OxmlElement("w:tcMar")
        tcPr.append(mar)
    for side, val in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = mar.find(qn("w:" + side))
        if node is None:
            node = OxmlElement("w:" + side)
            mar.append(node)
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")

def set_borders(table):
    tblPr = table._tbl.tblPr
    borders = tblPr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tblPr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "5")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), "B7C1CB")

def repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    h = OxmlElement("w:tblHeader")
    h.set(qn("w:val"), "true")
    trPr.append(h)

def prevent_row_split(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:cantSplit")
    trPr.append(el)

def add_table(headers, rows, widths, font_size=9.4):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    set_borders(t)
    repeat_header(t.rows[0])
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        c.width = Inches(widths[i])
        c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        shade(c, "E6EDF3")
        cell_margins(c)
        p = c.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        run = p.add_run(h)
        run.bold = True
        run.font.name = "Times New Roman"
        run.font.size = Pt(font_size)
    for vals in rows:
        cells = t.add_row().cells
        prevent_row_split(t.rows[-1])
        for i, val in enumerate(vals):
            c = cells[i]
            c.width = Inches(widths[i])
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cell_margins(c)
            p = c.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.0
            r = p.add_run(val)
            r.font.name = "Times New Roman"
            r.font.size = Pt(font_size)
    after = doc.add_paragraph()
    after.paragraph_format.space_after = Pt(0)
    after.paragraph_format.space_before = Pt(0)
    return t

def heading(text):
    p = doc.add_paragraph(style="Heading 1")
    r = p.add_run(text)
    r.font.name = "Times New Roman"
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = RGBColor(0, 0, 0)
    return p

def body(text, bold_lead=None):
    p = doc.add_paragraph()
    if bold_lead and text.startswith(bold_lead):
        p.add_run(bold_lead).bold = True
        p.add_run(text[len(bold_lead):])
    else:
        p.add_run(text)
    return p

title = doc.add_paragraph(style="Title")
title.paragraph_format.space_after = Pt(4)
title_run = title.add_run("AI Radiology Triage System")
title_run.font.name = "Times New Roman"
title_run.font.size = Pt(17)
title_run.font.bold = True
title_run.font.color.rgb = RGBColor(0, 0, 0)
subtitle = doc.add_paragraph()
subtitle.paragraph_format.space_after = Pt(12)
subtitle.paragraph_format.line_spacing = 1.0
r = subtitle.add_run("A clinical workflow platform that helps radiologists identify potentially urgent chest X-rays earlier while keeping interpretation and care decisions with the radiologist.")
r.italic = True

heading("1. Problem")
body("Radiology teams manage high volumes of chest X-rays. Potentially urgent studies can wait behind routine cases when all examinations enter a standard queue. Orders, images, AI findings and radiologist reviews may also pass through separate workflow stages, making it harder to track each case from acquisition to final report.")
body("Urgent studies in routine queues: A standard queue may not make potentially urgent examinations visible early enough for review.", "Urgent studies in routine queues:")
body("Fragmented workflow: Imaging orders, DICOM images, screening results and radiologist reviews can be spread across different systems or stages.", "Fragmented workflow:")
body("Limited visual guidance: Radiologists may need to locate candidate suspicious regions themselves while reviewing each image.", "Limited visual guidance:")
body("Coordination burden: Teams need a traceable link between the order, image, prioritisation result and final interpretation.", "Coordination burden:")

heading("2. Solution")
body("The system screens supported chest X-rays, assigns a priority level and highlights candidate suspicious regions to help radiologists decide which studies to review sooner. It brings the order, DICOM image, AI result, worklist status and final review into one traceable workflow.")
body("The system is designed to work alongside existing diagnostics, RIS/PACS and clinical systems. It supports PA, AP and PA + AP chest X-ray workflows. Clinical responsibility remains with the radiologist: the AI supports prioritisation and does not make the diagnosis.")

doc.add_page_break()
heading("3. Platform Features")
body("The platform combines image screening, worklist prioritisation and review tools in one radiology workflow.")
add_table(
    ["Feature", "What it offers"],
    [
        ("Chest X-ray screening", "Screens supported PA, AP and PA + AP studies using the configured AI pipeline."),
        ("Priority assignment", "Assigns a priority level so studies that may need earlier attention can be surfaced in the worklist."),
        ("Candidate-region highlighting", "Marks candidate suspicious regions on the image to guide the radiologist’s review."),
        ("Radiologist worklist", "Organises studies by priority to support review order and team coordination."),
        ("Traceable case workflow", "Links the imaging order, DICOM image, AI output, radiologist review and final report."),
        ("Clinical oversight", "Keeps final image interpretation and reporting with the radiologist."),
    ],
    [2.0, 4.85], 9.2
)
body("Together, these features make potentially urgent studies easier to identify and follow through the review process.")
add_table(
    ["Area", "Capability", "Expected benefit"],
    [
        ("Image analysis", "DenseNet121 screening and YOLO11n candidate-region detection", "Provides a priority signal and visual cues for radiologist review."),
        ("Image workflow", "DICOM support with Orthanc storage and imaging services", "Keeps medical images available within the connected workflow."),
        ("Image review", "OHIF medical image viewer", "Allows radiologists to inspect studies and AI highlights."),
        ("Application", "React.js interface with FastAPI / Python workflow services", "Presents worklists and coordinates screening and review steps."),
        ("System integration", "Designed to work alongside diagnostics, RIS/PACS and clinical systems", "Supports coordination with existing care and imaging operations."),
    ],
    [1.25, 2.75, 2.85], 8.7
)

heading("4. Intended Impact")
body("The system is intended to support faster attention to potentially urgent studies, improve worklist prioritisation, reduce the chance that important cases remain in routine queues, and improve coordination among doctors, diagnostics teams and radiologists. By connecting each order, image, AI result and final review, it also supports end-to-end traceability and more focused use of specialist time.")

doc.add_page_break()
heading("5. How the System Works")
body("A chest X-ray moves through the following workflow from order to final report:")
add_table(
    ["Stage", "Activity", "Workflow output"],
    [
        ("1. X-ray order", "A chest X-ray is requested in the clinical workflow.", "An order is available for imaging."),
        ("2. Image acquisition", "The supported chest X-ray view or views are acquired (PA, AP or PA + AP).", "A study is created."),
        ("3. DICOM storage", "The image is stored and made available through the imaging service.", "The DICOM study is ready for screening and review."),
        ("4. AI screening", "The configured screening and candidate-region models process the study.", "A priority level and candidate-region output are returned."),
        ("5. Priority assignment", "The study is placed in the radiologist worklist according to priority.", "The worklist supports review sequencing."),
        ("6. Radiologist review", "The radiologist opens the image, considers the AI output and performs the clinical interpretation.", "The radiologist determines the findings."),
        ("7. Final report", "The final interpretation is recorded and linked to the study workflow.", "The order-to-report path remains traceable."),
    ],
    [1.25, 3.15, 2.45], 9.0
)
body("AI prioritises. The radiologist decides.", "AI prioritises. The radiologist decides.")

heading("6. Technology Foundation and Integration")
body("The platform is described as a custom AI-enabled radiology application. Its user interface is built with React.js, while FastAPI and Python provide backend and workflow services. PostgreSQL is the database. DenseNet121 supports chest X-ray screening, and YOLO11n identifies candidate regions. Orthanc provides DICOM image storage and imaging services, and OHIF provides medical image viewing.")
body("DICOM is used for medical imaging exchange, and the solution is designed to work alongside existing diagnostics, RIS/PACS and clinical systems.")

doc.add_page_break()
heading("7. Model Details and ROC-AUC")
body("The system uses an image classification model and an object detection model for different tasks. Their outputs are supporting signals for the radiologist’s review.")
add_table(
    ["Model", "Task", "Description", "Output in the workflow"],
    [
        ("DenseNet121", "Image classification", "A 121-layer convolutional neural network. Dense connections pass feature maps between layers so later layers can reuse earlier image features. In this system it screens the complete chest X-ray.", "Image-level class prediction or score used by the screening workflow."),
        ("YOLO11n", "Object detection", "The nano-sized YOLO11 model variant configured to detect and locate candidate regions in an image. It processes the radiograph for localized visual findings.", "Candidate bounding boxes with predicted class and confidence, displayed as review aids."),
    ],
    [1.0, 1.12, 3.0, 1.73], 8.8
)
body("A detection box marks a model-identified candidate region; it does not confirm a clinical finding. The radiologist reviews the full study and decides whether the highlighted region is relevant.")

heading("What ROC-AUC means")
body("The receiver operating characteristic (ROC) curve plots the true positive rate (sensitivity) against the false positive rate (1 minus specificity) as the decision threshold changes. The area under that curve, or ROC-AUC, summarizes how well a model ranks positive cases above negative cases across thresholds. A value of 0.5 represents chance-level ranking, while 1.0 represents perfect separation on the evaluated data.")
add_table(
    ["Measure", "Definition", "Why it matters for triage"],
    [
        ("Sensitivity", "True positives divided by all actual positives.", "Shows how many urgent cases the chosen threshold detects."),
        ("Specificity", "True negatives divided by all actual negatives.", "Shows how many non-urgent cases remain unflagged."),
        ("ROC-AUC", "Area under the sensitivity-versus-false-positive-rate curve across thresholds.", "Summarizes ranking performance; it does not select the operating threshold."),
    ],
    [1.1, 2.65, 3.1], 8.8
)
body("ROC-AUC is not the same as accuracy, a confidence calibration measure or a clinical outcome. For a meaningful report, calculate it on an independent, representative test set and state the target label and evaluation method. Also report sensitivity, specificity and workload at the threshold selected for the clinical workflow. A model name alone does not establish a numerical ROC-AUC result.")

heading("Technical References")
refs = doc.add_paragraph()
refs.paragraph_format.space_after = Pt(2)
refs.paragraph_format.line_spacing = 1.0
rr = refs.add_run("DenseNet: Huang et al., CVPR 2017, Densely Connected Convolutional Networks, https://openaccess.thecvf.com/content_cvpr_2017/html/Huang_Densely_Connected_Convolutional_CVPR_2017_paper.html\n")
rr.font.size = Pt(8.2)
rr = refs.add_run("YOLO11: Ultralytics model documentation, https://docs.ultralytics.com/models/yolo11/\n")
rr.font.size = Pt(8.2)
rr = refs.add_run("ROC-AUC: scikit-learn metric documentation, https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_auc_score.html")
rr.font.size = Pt(8.2)

# Keep heading and following content together, and ensure tables use the same compact typography.
for p in doc.paragraphs:
    if p.style.name.startswith("Heading"):
        p.paragraph_format.keep_with_next = True

doc.core_properties.title = "AI Radiology Triage System"
doc.core_properties.subject = "Clinical platform brief for chest X-ray triage"
doc.core_properties.author = ""
doc.save(OUT)
print(OUT)
