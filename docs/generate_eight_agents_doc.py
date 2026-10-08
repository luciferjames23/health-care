import docx
from docx.shared import Inches, Pt, RGBColor, Cm, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from pathlib import Path


def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)


def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement("w:tcMar")
    for m, val in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
        node = OxmlElement(f"w:{m}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        tcMar.append(node)
    tcPr.append(tcMar)


def shade_row(row, fill_hex):
    for cell in row.cells:
        set_cell_background(cell, fill_hex)


def add_kv_table(doc, rows, col_widths=(2.2, 4.8)):
    table = doc.add_table(rows=len(rows), cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for i, (k, v) in enumerate(rows):
        c0, c1 = table.rows[i].cells
        c0.text = ""
        c1.text = ""
        set_cell_margins(c0)
        set_cell_margins(c1)
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(k)
        r0.bold = True
        r0.font.size = Pt(10)
        r0.font.color.rgb = RGBColor(15, 23, 42)
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(v)
        r1.font.size = Pt(10.5)
        r1.font.color.rgb = RGBColor(40, 50, 60)
        if i % 2 == 0:
            set_cell_background(c0, "F1F5F9")
            set_cell_background(c1, "F8FAFC")
        else:
            set_cell_background(c0, "FFFFFF")
            set_cell_background(c1, "FFFFFF")
        c0.width = Inches(col_widths[0])
        c1.width = Inches(col_widths[1])
    return table


def heading(doc, text, size=14, color=None):
    color = color or RGBColor(30, 58, 138)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(size)
    r.font.color.rgb = color
    return p


def body(doc, text, after=8):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(after)
    r = p.add_run(text)
    r.font.size = Pt(10.5)
    return p


AGENTS = [
    {
        "id": "AG-19",
        "name": "Discharge Summary Agent",
        "tamil": "டிஸ்சார்ஜ் சுருக்க வரைவு முகவர்",
        "mode": "Workflow automation (clinical workspace) — not a chatbot",
        "users": "Consultant doctors, medical records, discharge command centre",
        "owner": "Medical Records",
        "tier": "High (clinical document; doctor must sign)",
        "status": "Published · v1.1.0",
        "purpose": (
            "When a clinician marks a patient as likely discharge, this agent compiles the full inpatient stay "
            "(diagnoses, procedures, labs, vitals, medications, follow-up advice) into a NABH-style discharge "
            "summary draft. It also checks bill clearance and vital-sign stability before a patient is treated as ready."
        ),
        "useful": (
            "Doctors no longer type a 4-page summary from scratch. The draft is already on screen; they review, "
            "edit if needed, and electronically sign. That shortens discharge TAT, keeps documentation complete, "
            "and reduces missed medications or follow-up instructions. Families get a clear bilingual home-care note."
        ),
        "how": (
            "Runs in Doctor Workspace / Discharge Command Centre. Trigger: likely-discharge flag or batch eligibility "
            "run. Pipeline: (1) confirm bill cleared, (2) score vitals stability, (3) generate structured summary, "
            "(4) persist to gold generated-discharge-summaries, (5) doctor clicks Sign & Finalize. "
            "UI: DischargeAgentView, Discharge Summary modal, Patient 360."
        ),
        "llm": (
            "Primary synthesis: openai/gpt-oss-120b on Groq LPU (Agent Studio / live runs). "
            "Summary persist path also supports Meta-Llama-3.3-70B-Instruct. "
            "Vital-stability gate: openai/gpt-oss-20b on Groq (DISCHARGE_LLM_MODEL override). "
            "Fallback: databricks-meta-llama-3-3-70b-instruct / Gemini. Temperature ~0.10–0.30. "
            "Governance: mandatory physician review and digital sign-off. Never auto-discharges the patient."
        ),
        "tools": "EMR Gateway, LIS labs, Pharmacy formulary, Hospital DB, Document Generator, Notification",
        "kb": "NABH Clinical Documentation v5.0, Inpatient Discharge SOP v3.1, High-alert drugs v4.0",
        "bench": "Eval EV-8925: 115 cases, 100% completeness, groundedness 99.4%, hallucination 0.1%, ~1.18s",
        "api": "/api/v1/discharge-agent/*",
    },
    {
        "id": "AG-18",
        "name": "Nursing Handover Agent",
        "tamil": "செவிலியர் ஒப்படைப்பு முகவர்",
        "mode": "Workflow automation — not a chatbot",
        "users": "Ward staff nurses and charge nurses (shift change 07:00 / 15:00 / 23:00)",
        "owner": "Nursing Operations",
        "tier": "Medium (clinical summarisation)",
        "status": "Production-Pilot · v0.8.2",
        "purpose": (
            "At shift change the agent reads the last shift of vitals, eMAR administrations, nursing tasks, and "
            "doctor notes, then pre-drafts a bedside SBAR card (Situation, Background, Assessment, Recommendation) "
            "and flags high-alert drugs (insulin, heparin, vancomycin, narcotics, vasopressors)."
        ),
        "useful": (
            "Night-to-morning handover used to take messy paper notes and 10+ minutes per bed. The SBAR card is "
            "already filled; both nurses review and the incoming RN taps Acknowledge & Accept. Typical bed handover "
            "drops toward ~90 seconds, with overdue high-alert doses and rising EWS scores called out instead of missed."
        ),
        "how": (
            "Ward tablet / Nursing Workspace bed board. Expand SBAR Handover Card per bed. Joint sign-off required. "
            "Writes structured cards to ward_sbar_handovers. Does not change orders without RN confirmation."
        ),
        "llm": (
            "Primary: openai/gpt-oss-120b on Groq LPU (NURSING_AGENT_MODEL). "
            "Fallback: llama-3.3-70b-versatile / gemini-3.5-flash-lite. Temperature ~0.15. p50 latency ~1.85s. "
            "Governance: selective bedside registered-nurse digital sign-off."
        ),
        "tools": "EMR API (vitals, notes), Pharmacy API (high-alert / overdue), Document Generator (SBAR)",
        "kb": "Medication Safety — High-alert drugs v4.0, Ward administration v3.2",
        "bench": "Accuracy 94.8%, groundedness 97.5%, hallucination 0.3%, ~1.85s",
        "api": "/api/v1/nursing-handover/*  (generate SBAR per bed)",
    },
    {
        "id": "AG-04",
        "name": "Employee Service Agent",
        "tamil": "பணியாளர் சேவை முகவர்",
        "mode": "Internal staff chatbot (this one IS conversational)",
        "users": "Doctors, nurses, technicians, admin — any hospital employee",
        "owner": "HR Operations",
        "tier": "Low",
        "status": "Published · v1.7.0 (studio catalog also lists v1.6.0)",
        "purpose": (
            "Answers staff questions about tomorrow’s shift, leave balances (casual, sick, earned, comp-off), "
            "overtime/HR policy, and can file a leave or comp-off request to the supervisor without a phone call or ticket."
        ),
        "useful": (
            "Ward nurses should not wait on HR for ‘what is my shift tomorrow?’ or ‘do I have a comp-off?’. "
            "Instant roster + balance answers from PostgreSQL, grounded in HR Leave Policy v5.0, cut walk-ups and WhatsApp pings to the supervisor."
        ),
        "how": (
            "Chat widget / Employee Agent screen. Quick chips: My Shift Tomorrow, Check Leave Balance, Apply Comp-Off. "
            "Reads staff_rosters, employee_leave_balances; writes employee_leave_requests. Natural language parsed by LLM then executed as tools."
        ),
        "llm": (
            "Runtime: Groq chat completions. If DISCHARGE_LLM_MODEL is a Llama id, code switches to openai/gpt-oss-120b; "
            "otherwise uses DISCHARGE_LLM_MODEL (default llama-3.3-70b-versatile). "
            "Gemini (LLM_API_KEY) is a secondary path. Temperature ~0.20. No clinical write permissions."
        ),
        "tools": "PostgreSQL roster engine, leave ledger, supervisor routing, HR Policy v5.0, LLM leave parser",
        "kb": "HR Leave & Attendance Policy v5.0, Payroll & Shift Allowance FAQ v2.1, Nursing staffing SOP v3.2",
        "bench": "Profile: accuracy 98.5%, groundedness 99.2%",
        "api": "/api/v1/employee-agent/chat, /shift, /leave-balance, /apply-leave",
    },
    {
        "id": "AG-14",
        "name": "Analytics Agent",
        "tamil": "மேம்பட்ட பகுப்பாய்வு முகவர்",
        "mode": "Hybrid executive dashboard + natural-language query (not a ward chatbot)",
        "users": "CEO, CFO, medical director, hospital management",
        "owner": "Management",
        "tier": "Medium",
        "status": "Published · v1.7.0",
        "purpose": (
            "Turns live hospital operational and financial facts into KPI cards and briefings: occupancy, admissions, "
            "emergency load, billed vs paid, insurance claim realisation, department mix, doctor workload, trends."
        ),
        "useful": (
            "Leadership does not wait for a weekly Excel pack. They open Analytics and see live census and revenue, "
            "or ask a question such as ‘Cardiology vs Orthopedics admissions’ and get a chart/brief instead of writing SQL."
        ),
        "how": (
            "AnalyticsView / Agent Studio play. Numbers come from PostgreSQL via GET /api/v1/gold/live-analytics "
            "(patients, dim_admission_inputs, bills, payments, insurance_claims, appointments, doctors). "
            "Agent Studio can wrap those facts into an executive narrative. Read-only; no PHI export as policy."
        ),
        "llm": (
            "Narrative / query layer in Agent Studio: openai/gpt-oss-120b on Groq. Fallback gemini-3.5-flash-lite. "
            "Temperature ~0.10. Core KPIs themselves are deterministic SQL, not generated by the LLM. "
            "Governance: aggregated read-only boundary."
        ),
        "tools": "HMS census & KPIs, Billing revenue/TAT analytics, Document Generator (daily briefing)",
        "kb": "Inpatient Discharge SOP v3.1, Tariff Schedule FY26-27",
        "bench": "Studio eval EV-714: accuracy 93.8%, groundedness 97.0%, hallucination 0.3%",
        "api": "/api/v1/gold/live-analytics  (+ finance claims-analytics for money views)",
    },
    {
        "id": "AG-15",
        "name": "Forecasting Agent",
        "tamil": "கணிப்பு முகவர்",
        "mode": "Background sentinel + bed operations dashboard",
        "users": "COO, bed managers, nursing supervisors",
        "owner": "Operations",
        "tier": "Medium",
        "status": "Published · v1.0.6",
        "purpose": (
            "Projects 7-day inpatient census and ward occupancy from current occupied beds, typical weekday vs weekend "
            "admission/discharge pace, and ward mix. Surfaces capacity warnings (e.g. ICU heading above 85%)."
        ),
        "useful": (
            "Monday morning the COO can see Thursday ICU pressure before it happens and move step-down patients or "
            "add buffer beds, instead of discovering a full ICU at 02:00 from ED. Prevents ER boarding and cancelled electives."
        ),
        "how": (
            "Live Forecasting screen. GET /api/v1/gold/live-forecasting computes T+0…T+6 census, admissions, discharges, "
            "headroom, and ward surge labels from live dim_admission_inputs + beds. Humans still approve reallocations. "
            "UI also labels the predictor as LightGBM + Prophet Inpatient Census Predictor v2.4 for the product story; "
            "the live API currently uses a clinical census predictor on active occupancy."
        ),
        "llm": (
            "Agent Studio narrative overlay: openai/gpt-oss-120b on Groq (LightGBM + Prophet framing). "
            "Fallback gemini-3.5-flash-lite. Temperature ~0.10. "
            "Forecast numbers are computed from census math / ML predictor — the LLM does not invent bed counts. "
            "Governance: capacity decision support; supervisor review for ward moves."
        ),
        "tools": "HMS bed demand & ER flow, Scheduling (nursing shift need)",
        "kb": "Inpatient Discharge SOP v3.1",
        "bench": "Studio eval EV-715: accuracy 94.0%; live summary reports R² ~0.942",
        "api": "/api/v1/gold/live-forecasting",
    },
    {
        "id": "AG-07",
        "name": "Insurance Preauth Agent",
        "tamil": "காப்பீட்டு முன்அனுமதி முகவர்",
        "mode": "Workflow automation (same pattern as discharge summary) — not a chatbot",
        "users": "Insurance desk executives (e.g. R. Sundar, L. Fathima)",
        "owner": "Insurance Desk",
        "tier": "High (financial + operational)",
        "status": "Published · v2.1.0",
        "purpose": (
            "When an insured patient is admitted or a procedure is scheduled, the agent silently builds a cashless "
            "preauth dossier: clinical history, ICD, cost estimate, document checklist, and denial-risk score, "
            "ready for one-click TPA submission after a human reviews it."
        ),
        "useful": (
            "Manual preauth packs take ~45 minutes of hunting notes and estimates. The agent targets ~20 seconds of "
            "officer review. Higher first-pass TPA approval, fewer ‘missing preauth’ denials, and discharges not stuck "
            "waiting for insurance paperwork."
        ),
        "how": (
            "Insurance Workspace / Kanban + Preauth Dossier Drawer. Checklist (doctor advice, cost estimate, policy ID, "
            "operative report). Denial-risk badge. Button: Submit Preauth Packet to TPA. Zero autonomous send."
        ),
        "llm": (
            "Primary: openai/gpt-oss-120b on Groq (DISCHARGE_LLM_MODEL default). Used for dossier synthesis and "
            "two-stage denial-risk scoring (also labelled preauth-denial v0.9 / Policy & Clinical Validation Engine). "
            "Fallback: structured dossier builder without LLM. Temperature low. "
            "Governance: 100% human-authorized TPA submit."
        ),
        "tools": "EMR API, Insurance/TPA API, Billing & tariff API, Document Generator",
        "kb": "IRDAI preauth guidelines 2024, TPA tariff & denial codes, Star Health / ICICI Lombard checklists, SOP v2.4",
        "bench": "Turnaround 20s vs ~45 min manual; profile accuracy 99.1%; first-pass approval 96.4%",
        "api": "/api/v1/preauth-agent/*",
    },
    {
        "id": "AG-20",
        "name": "Claim Denial Agent",
        "tamil": "காப்பீட்டு மறுப்பு மேல்முறையீட்டு முகவர்",
        "mode": "Workflow automation — not a chatbot",
        "users": "Insurance desk and revenue cycle lead",
        "owner": "Insurance Desk",
        "tier": "Medium · selective human-in-the-loop",
        "status": "Published · v1.0.2",
        "purpose": (
            "When a TPA/insurer rejects a claim or cuts a shortfall, the agent detects the denial code, pulls matching "
            "EMR proof (failed conservative therapy, OT notes, admission necessity), and drafts a formal reconsideration "
            "appeal letter plus evidence checklist for 1-click human submit."
        ),
        "useful": (
            "Shortfalls (room-rent cap, missing conservative therapy, consumable cuts) leak revenue if nobody appeals "
            "on time. The officer opens a red Shortfall Detected card and already has the letter and proof. Recovers "
            "money that would otherwise be written off (example: ₹80,000 spinal-fusion cut)."
        ),
        "how": (
            "Claims / denial desk. Appeal dossier: denial code, disputed amount, evidence items, letter. "
            "Persists to claim_appeals. Submit Appeal to TPA is human-gated. Does not diagnose or change the bill."
        ),
        "llm": (
            "Live appeal letters are assembled from grounded templates keyed by denial code (e.g. 204, 402) plus EMR "
            "facts — not a free-form LLM inventing clinical history. Agent Studio catalogs a meridian-llm-large slot "
            "with meridian-llm-small fallback for future/narrative runs. Prefer treating this agent as evidence + "
            "template drafting with insurance-exec approval. Temperature ~0.20 if the LLM path is used."
        ),
        "tools": "TPA rejection parser, EMR clinical retrieval, Appeal dossier assembler",
        "kb": "Insurance Preauth SOP v2.4, IRDAI cashless settlement 2024, Master Circular 2020, tariff FY26-27",
        "bench": "Appeal success rate ~91.0% (profile KPI)",
        "api": "/api/v1/claim-denials/*",
    },
    {
        "id": "AG-08",
        "name": "Billing Transparency Agent (Billing / Revenue Pace)",
        "tamil": "கட்டண வெளிப்படைத்தன்மை முகவர்",
        "mode": "Embedded billing-desk card / workflow automation — not a chatbot",
        "users": "Cashiers, billing desk, ward admin, patient/family at the counter",
        "owner": "Hospital Finance & Billing Desk",
        "tier": "High (financial)",
        "status": "Published · v2.0.0",
        "purpose": (
            "Audits the running bill against the pre-admission estimate. If variance exceeds ~10%, it explains "
            "technical line items and OT notes in plain English and Tamil (why a second balloon, extra ICU night, etc.) "
            "so the family understands the revenue/charge pace of the stay before they pay."
        ),
        "useful": (
            "Discharge counters stall when families fight cryptic codes like ‘NC Balloon Catheter 2.5x15mm’. "
            "A plain-language card plus clinical proof cuts disputes, speeds cash collection, and protects goodwill. "
            "Cashiers do not invent justifications; they show EMR-backed reasons."
        ),
        "how": (
            "Billing desk / invoice / Financial Revenue related screens. Orange Estimate Variance badge. "
            "Plain-Language Bill Breakdown card. Investigate Clinical Necessity drawer. Optional cashier sign-off to print."
        ),
        "llm": (
            "Primary: openai/gpt-oss-120b on Groq (BILLING_AGENT_MODEL / NURSING_AGENT_MODEL). "
            "Fallback: gemini-3.5-flash-lite or rule-based clinical synthesis. Temperature ~0.20. "
            "Protocol: estimate diff → EMR/OT proof → bilingual synthesis. Does not waive charges or change tariff."
        ),
        "tools": "Billing Desk API, Estimate ledger, EMR & OT notes, Bilingual explainer generator",
        "kb": "Tariff FY26-27, consumable/implant nomenclature, Tamil medical lexicon",
        "bench": "EV-708: accuracy 96.4%, groundedness 98.2%, hallucination 0.2%, ~1.4s",
        "api": "/api/v1/billing-transparency-agent/*",
    },
]


def generate_document():
    doc = docx.Document()
    for section in doc.sections:
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.85)
        section.right_margin = Inches(0.85)

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor(40, 50, 60)

    NAVY = RGBColor(30, 58, 138)
    SLATE = RGBColor(100, 116, 139)
    TEAL = RGBColor(13, 148, 136)

    p = doc.add_paragraph()
    r = p.add_run("MERIDIAN HEALTHCARE PLATFORM")
    r.bold = True
    r.font.size = Pt(11)
    r.font.color.rgb = TEAL

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run("Eight Hospital AI Agents — Purpose, Usefulness & LLM Models")
    r.bold = True
    r.font.size = Pt(18)
    r.font.color.rgb = NAVY

    p = doc.add_paragraph()
    r = p.add_run(
        "Internal reference compiled from live backend services, Agent Studio configs, and UI workspaces. "
        "Date: 08 October 2026. This is not a chatbot catalogue — most agents are silent workflow engines "
        "with a human click to sign or submit."
    )
    r.font.size = Pt(10.5)
    r.font.color.rgb = SLATE

    heading(doc, "1. Quick map of the eight agents", 14)
    body(
        doc,
        "You asked for these eight. Official IDs in the product are listed below. "
        "‘Billing revenue pace’ is documented as AG-08 Billing Transparency Agent — the live billing/revenue explainer "
        "tied to estimate vs actual charge pace. Financial Revenue screens consume related finance APIs but AG-08 is the agent.",
    )

    summary = doc.add_table(rows=1, cols=5)
    summary.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = ["ID", "Agent", "How staff use it", "Primary LLM", "Human gate"]
    for i, h in enumerate(hdr):
        cell = summary.rows[0].cells[i]
        cell.text = ""
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell)
        rr = cell.paragraphs[0].add_run(h)
        rr.bold = True
        rr.font.size = Pt(9)
        rr.font.color.rgb = RGBColor(255, 255, 255)

    summary_rows = [
        ("AG-19", "Discharge Summary", "Doctor reviews & signs draft", "Groq openai/gpt-oss-120b (+ gpt-oss-20b vitals)", "Required"),
        ("AG-18", "Nursing Handover", "RN reviews SBAR at bedside", "Groq openai/gpt-oss-120b", "Selective RN sign-off"),
        ("AG-04", "Employee Service", "Staff chat: shift / leave", "Groq openai/gpt-oss-120b (or Llama 3.3 70B)", "None (leave goes to supervisor)"),
        ("AG-14", "Analytics", "KPI dashboard + NL briefing", "SQL facts + Groq openai/gpt-oss-120b narrative", "Read-only"),
        ("AG-15", "Forecasting", "7-day bed/census board", "Census predictor + Groq openai/gpt-oss-120b overlay", "Supervisor for bed moves"),
        ("AG-07", "Insurance Preauth", "Officer submits TPA dossier", "Groq openai/gpt-oss-120b + preauth-denial v0.9", "Required"),
        ("AG-20", "Claim Denial", "Officer submits appeal pack", "Template + EMR proof (studio: meridian-llm-large)", "Selective / required submit"),
        ("AG-08", "Billing Transparency", "Cashier shows plain bill", "Groq openai/gpt-oss-120b bilingual", "Optional cashier print"),
    ]
    for i, row in enumerate(summary_rows):
        cells = summary.add_row().cells
        fill = "F8FAFC" if i % 2 == 0 else "FFFFFF"
        for j, val in enumerate(row):
            cells[j].text = ""
            set_cell_background(cells[j], fill)
            set_cell_margins(cells[j])
            rr = cells[j].paragraphs[0].add_run(val)
            rr.font.size = Pt(9)
            if j == 0:
                rr.bold = True
                rr.font.color.rgb = NAVY

    heading(doc, "2. Shared LLM platform (what “we use” means)", 14)
    body(
        doc,
        "Most clinical/finance workflow agents call Groq’s OpenAI-compatible Chat Completions API "
        "(https://api.groq.com/openai/v1/chat/completions) with GROQ_API_KEY. The default production model id is "
        "openai/gpt-oss-120b. Common fallbacks: llama-3.3-70b-versatile on Groq, Google Gemini (gemini-2.0-flash / "
        "gemini-3.5-flash-lite via LLM_API_KEY), and Databricks Meta-Llama-3.3-70B-Instruct for older discharge evals. "
        "Discharge vital-sign eligibility specifically uses the smaller openai/gpt-oss-20b. "
        "Analytics and forecasting KPIs are calculated in PostgreSQL first; the LLM only writes the human briefing. "
        "No agent autonomously signs a discharge, submits a TPA pack, or waives a bill."
    )

    heading(doc, "3. Agent-by-agent detail", 14)

    for ag in AGENTS:
        heading(doc, f"{ag['id']}  ·  {ag['name']}", 13, TEAL)
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(8)
        r = p.add_run(ag["tamil"])
        r.italic = True
        r.font.size = Pt(10)
        r.font.color.rgb = SLATE

        add_kv_table(
            doc,
            [
                ("Purpose", ag["purpose"]),
                ("Why it is useful", ag["useful"]),
                ("How staff use it", ag["how"]),
                ("Delivery mode", ag["mode"]),
                ("Primary users", ag["users"]),
                ("Owner / tier / status", f"{ag['owner']}  ·  {ag['tier']}  ·  {ag['status']}"),
                ("LLM / models", ag["llm"]),
                ("Tools", ag["tools"]),
                ("Knowledge / SOP", ag["kb"]),
                ("Quality snapshot", ag["bench"]),
                ("Backend API", ag["api"]),
            ],
        )

    heading(doc, "4. Safety rules that apply to all eight", 14)
    body(
        doc,
        "1. Clinical authority stays with the treating doctor or bedside RN. Agents draft; humans sign.\n"
        "2. Insurance money movement (preauth submit, appeal submit) always needs an insurance officer click.\n"
        "3. Billing explanations cite EMR/OT notes; the agent cannot change tariff or waive charges.\n"
        "4. Employee Service must not answer clinical questions or release patient PHI.\n"
        "5. Analytics/Forecasting are decision support. They do not auto-close wards or cancel OT lists.\n"
        "6. Prompts require grounded EMR/SQL facts. If evidence is missing, the agent must refuse and escalate."
    )

    heading(doc, "5. Where to click in the product", 14)
    body(
        doc,
        "AG-19 Discharge — Clinical / Discharge workspace and Patient 360 summary drawer.\n"
        "AG-18 Nursing handover — Nursing workspace bed board SBAR card.\n"
        "AG-04 Employee service — Staff employee-agent chat.\n"
        "AG-14 Analytics — Analytics / AI Analytics page.\n"
        "AG-15 Forecasting — Live Forecasting page.\n"
        "AG-07 Insurance preauth — Insurance Preauth Kanban + dossier drawer.\n"
        "AG-20 Claim denial — Claims denial / appeal drawer.\n"
        "AG-08 Billing transparency — Billing desk + Financial Revenue related bill breakdown cards.\n"
        "All eight also appear in Agent Studio for model, prompt, and run traces."
    )

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    r = p.add_run(
        "Source of truth: backend services (discharge_pipeline, nursing_handover_agent, employee_service_agent, "
        "insurance_preauth_agent, claim_denial_agent, billing_transparency_agent), gold live-analytics / live-forecasting, "
        "and frontend AgentStudioView model defaults. Product copy may still show meridian-llm-large on older catalog cards; "
        "runtime Groq openai/gpt-oss-120b is what the live agents call today unless noted."
    )
    r.font.size = Pt(9)
    r.font.color.rgb = SLATE

    out = Path(__file__).resolve().parent / "Eight_Hospital_AI_Agents_Details.docx"
    doc.save(str(out))
    print(f"Wrote {out}")


if __name__ == "__main__":
    generate_document()
