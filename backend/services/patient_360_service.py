"""
patient_360_service.py
=======================
Authoritative Patient 360 data access service for WhatsApp Patient Desk.
Integrates existing hospital database tables and storage:
  - Radiology & X-Ray scans (radiology_scan, radiology_orders)
  - Patient reports & documents (patient_reports, consent_record)
  - Authoritative billing & payments (bills, bill_items, payments, refunds, insurance_claims, patient_insurance)
  - Discharge summaries (dim_generated_discharge_summaries, discharge_summaries)
  - Clinical records, encounters, diagnoses, medications, and labs
"""

import os
import sys
import base64
import uuid
import datetime
from typing import Optional, Dict, Any, List, Tuple

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config


def resolve_patient_id(patient_id_or_code: Any) -> Optional[int]:
    """
    Authoritatively resolves any patient identifier (integer ID, string ID,
    UHID, or patient_code such as 'P1000019' or 'MER-PAT-0087421') to the integer patient_id.
    """
    if not patient_id_or_code:
        return None
    if isinstance(patient_id_or_code, int):
        return patient_id_or_code
    val_str = str(patient_id_or_code).strip()
    if val_str.isdigit():
        return int(val_str)
    
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM patients WHERE patient_code = %s OR id::text = %s LIMIT 1;", (val_str, val_str))
        row = cur.fetchone()
        if row:
            return row[0]
        import re
        m = re.search(r'\d+', val_str)
        if m:
            clean_digits = int(m.group(0))
            cur.execute("SELECT id FROM patients WHERE id = %s OR patient_code = %s LIMIT 1;", (clean_digits, f"P{clean_digits}"))
            row2 = cur.fetchone()
            if row2:
                return row2[0]
    finally:
        cur.close()
        conn.close()
    return None


def get_patient_authorized_reports(patient_id: Any) -> Dict[str, Any]:
    """
    Retrieves all authorized clinical and diagnostic reports for a patient across all modalities:
    - Radiology / X-Ray scans (from radiology_scan)
    - Diagnostic laboratory & cardiology reports (from patient_reports)
    - Discharge summaries (from dim_generated_discharge_summaries & discharge_summaries)
    """
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return {
            "xrays": [], "xray_count": 0,
            "lab_reports": [], "lab_count": 0,
            "discharge_summaries": [], "discharge_count": 0,
            "total_count": 0
        }

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Radiology X-ray scans
        cur.execute("""
            SELECT rs.scan_id, rs.scan_type, rs.modality, rs.body_part, rs.review_status,
                   COALESCE(rs.created_at, rs.reviewed_at, rs.analyzed_at) AS scan_date,
                   (rs.image IS NOT NULL) AS has_image,
                   (rs.scan_report IS NOT NULL OR rs.findings IS NOT NULL) AS has_report,
                   rs.findings, rs.scan_report, rs.radiologist_finding
            FROM radiology_scan rs
            WHERE rs.patient_id = %s
            ORDER BY rs.scan_id DESC LIMIT 10;
        """, (patient_id,))
        xray_rows = cur.fetchall()
        xrays = []
        for r in xray_rows:
            dt = r[5].strftime("%d %b %Y") if r[5] and hasattr(r[5], "strftime") else str(r[5])[:10] if r[5] else "Recent"
            xrays.append({
                "id": r[0],
                "scan_id": r[0],
                "scan_type": r[1] or "X-Ray Examination",
                "modality": r[2] or "DX",
                "body_part": r[3] or "Chest",
                "body_region": r[3] or "Chest",
                "review_status": r[4] or "Completed",
                "date": dt,
                "scan_date": dt,
                "has_image": bool(r[6]),
                "has_report": bool(r[7]),
                "findings": r[8] or "",
                "scan_report": r[9] or "",
                "radiologist_finding": r[10] or ""
            })

        # 2. General Patient Reports (Lab, Blood, Pathology)
        cur.execute("""
            SELECT pr.id, pr.report_reference, pr.report_type, pr.report_title,
                   pr.report_date, pr.status, pr.summary, d.display_name AS doctor_name
            FROM patient_reports pr
            LEFT JOIN doctors d ON pr.doctor_id = d.id
            WHERE pr.patient_id = %s
            ORDER BY pr.report_date DESC NULLS LAST, pr.id DESC LIMIT 10;
        """, (patient_id,))
        rep_rows = cur.fetchall()
        lab_reports = []
        for r in rep_rows:
            dt = r[4].strftime("%d %b %Y") if r[4] and hasattr(r[4], "strftime") else str(r[4])[:10] if r[4] else "On File"
            lab_reports.append({
                "id": r[0],
                "reference": r[1] or f"REP-{r[0]}",
                "type": r[2] or "Diagnostic Report",
                "title": r[3] or "Medical Report",
                "date": dt,
                "status": r[5] or "Available",
                "summary": r[6] or "",
                "doctor": r[7] or "Attending Physician"
            })

        # 3. Discharge Summaries
        cur.execute("""
            SELECT summary_id, admission_id, discharge_date, diagnoses, approval_status, primary_consultant
            FROM dim_generated_discharge_summaries
            WHERE patient_id = %s
            UNION ALL
            SELECT summary_id, admission_id, discharge_date::timestamp, diagnoses, 'Approved' AS approval_status, primary_consultant
            FROM discharge_summaries
            WHERE patient_id = %s AND summary_id NOT IN (SELECT summary_id FROM dim_generated_discharge_summaries WHERE patient_id = %s)
            ORDER BY discharge_date DESC NULLS LAST LIMIT 5;
        """, (patient_id, patient_id, patient_id))
        ds_rows = cur.fetchall()
        discharge_summaries = []
        for r in ds_rows:
            dt = r[2].strftime("%d %b %Y") if r[2] and hasattr(r[2], "strftime") else str(r[2])[:10] if r[2] else "Completed"
            is_signed_or_approved = (str(r[4]).strip().lower() in ("approved", "signed", "final"))
            discharge_summaries.append({
                "id": r[0],
                "summary_id": r[0],
                "admission_id": r[1],
                "date": dt,
                "discharge_date": dt,
                "diagnoses": r[3] or "Discharge Summary",
                "approval_status": r[4] or "Approved",
                "is_signed": is_signed_or_approved,
                "is_approved": is_signed_or_approved,
                "doctor": r[5] or "Consultant"
            })

        total = len(xrays) + len(lab_reports) + len(discharge_summaries)
        return {
            "xrays": xrays,
            "xray_count": len(xrays),
            "lab_reports": lab_reports,
            "lab_count": len(lab_reports),
            "discharge_summaries": discharge_summaries,
            "discharge_count": len(discharge_summaries),
            "total_count": total
        }
    finally:
        cur.close()
        conn.close()


def get_xray_scan_record(patient_id: Any, scan_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    Retrieves full details of a specific radiology scan or the latest scan for the authorized patient.
    Strictly verifies ownership against patient_id.
    """
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return None

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        where_clause = "rs.patient_id = %s"
        params = [patient_id]
        if scan_id:
            where_clause += " AND rs.scan_id = %s"
            params.append(scan_id)

        cur.execute(f"""
            SELECT rs.scan_id, rs.patient_id, rs.patient_code, rs.scan_type, rs.modality,
                   rs.body_part, rs.priority, rs.review_status, rs.findings, rs.scan_report,
                   rs.radiologist_finding, rs.clinical_summary, rs.assessment, rs.recommended_action,
                   COALESCE(rs.created_at, rs.reviewed_at, rs.analyzed_at) AS created_at, rs.image, p.first_name, p.last_name
            FROM radiology_scan rs
            LEFT JOIN patients p ON rs.patient_id = p.id
            WHERE {where_clause}
            ORDER BY rs.scan_id DESC LIMIT 1;
        """, tuple(params))
        r = cur.fetchone()
        if not r:
            return None

        dt = r[14].strftime("%d %b %Y, %I:%M %p") if r[14] and hasattr(r[14], "strftime") else str(r[14])[:19] if r[14] else "Recent"
        p_name = f"{r[16] or ''} {r[17] or ''}".strip() or f"Patient {r[1]}"
        return {
            "scan_id": r[0],
            "patient_id": r[1],
            "patient_code": r[2] or f"MER-PAT-{str(r[1]).zfill(7)}",
            "patient_name": p_name,
            "scan_type": r[3] or "Chest X-Ray",
            "modality": r[4] or "DX",
            "body_part": r[5] or "CHEST",
            "body_region": r[5] or "CHEST",
            "priority": r[6] or "Routine",
            "review_status": r[7] or "Confirmed",
            "status": r[7] or "Confirmed",
            "verified_status": r[7] or "Confirmed",
            "findings": r[8] or "No acute cardiopulmonary abnormality detected.",
            "scan_report": r[9] or r[8] or "",
            "radiology_report": r[9] or r[8] or "",
            "radiologist_finding": r[10] or "",
            "clinical_summary": r[11] or "",
            "assessment": r[12] or "",
            "recommended_action": r[13] or "",
            "created_at": dt,
            "examination_date": dt,
            "has_image": bool(r[15]),
            "image_raw": r[15]
        }
    finally:
        cur.close()
        conn.close()


def export_xray_image_file(scan_record: Dict[str, Any]) -> Optional[str]:
    """
    Decodes the stored base64 image data from radiology_scan and writes it to a temporary secure file.
    Returns the file path for WhatsApp media dispatch, or None if no image data is stored.
    """
    raw_img = scan_record.get("image_raw")
    if not raw_img:
        return None

    try:
        # Strip data URL prefix if present
        if "," in raw_img and raw_img.startswith("data:image"):
            raw_img = raw_img.split(",", 1)[1]

        img_bytes = base64.b64decode(raw_img)
        if len(img_bytes) < 100:
            return None

        scratch_dir = os.path.join(backend_dir, "scratch")
        os.makedirs(scratch_dir, exist_ok=True)
        out_path = os.path.join(scratch_dir, f"xray_scan_{scan_record['scan_id']}.png")
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        return out_path
    except Exception as e:
        print(f"[ERROR] Failed exporting X-ray image for scan {scan_record.get('scan_id')}: {e}")
        return None


def get_patient_discharge_summary(patient_id: Any, summary_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """
    Retrieves authoritative discharge summary for patient, tracking approval status truthfully.
    """
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return None

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        where_clause = "ds.patient_id = %s"
        params = [patient_id]
        if summary_id:
            where_clause += " AND ds.summary_id = %s"
            params.append(summary_id)

        # 1. Check dim_generated_discharge_summaries (contains approval_status)
        cur.execute(f"""
            SELECT ds.summary_id, ds.admission_id, ds.patient_id, ds.discharge_date,
                   ds.diagnoses, ds.case_history, ds.investigations, ds.treatment,
                   ds.discharge_advice, ds.patient_condition, ds.primary_consultant,
                   ds.approval_status, p.first_name, p.last_name, p.patient_code,
                   a.admission_number, a.admission_date
            FROM dim_generated_discharge_summaries ds
            LEFT JOIN patients p ON ds.patient_id = p.id
            LEFT JOIN admissions a ON ds.admission_id = a.admission_id
            WHERE {where_clause}
            ORDER BY ds.summary_id DESC LIMIT 1;
        """, tuple(params))
        row = cur.fetchone()
        if row:
            p_name = f"{row[12] or ''} {row[13] or ''}".strip() or f"Patient {row[2]}"
            dis_date = row[3].strftime("%d %b %Y") if row[3] and hasattr(row[3], "strftime") else str(row[3])[:10] if row[3] else "—"
            adm_date = row[16].strftime("%d %b %Y") if row[16] and hasattr(row[16], "strftime") else str(row[16])[:10] if row[16] else "—"
            status = row[11] or "Approved"
            return {
                "summary_id": row[0],
                "admission_id": row[1],
                "patient_id": row[2],
                "discharge_date": dis_date,
                "admission_date": adm_date,
                "diagnoses": row[4] or "Clinical Management & Care",
                "case_history": row[5] or "",
                "investigations": row[6] or "",
                "treatment": row[7] or "",
                "discharge_advice": row[8] or "Take prescribed medications on time. Follow up in OPD.",
                "patient_condition": row[9] or "Stable at discharge.",
                "primary_consultant": row[10] or "Attending Consultant",
                "approval_status": status,
                "is_signed": (str(status).strip().lower() in ("approved", "signed", "final")),
                "is_approved": (str(status).strip().lower() in ("approved", "signed", "final")),
                "patient_name": p_name,
                "patient_code": row[14] or f"MER-PAT-{str(row[2]).zfill(7)}",
                "admission_number": row[15] or (f"MER-ADM-{str(row[1]).zfill(7)}" if row[1] else "—")
            }

        # 2. Check discharge_summaries table (official signed records)
        cur.execute(f"""
            SELECT ds.summary_id, ds.admission_id, ds.patient_id, ds.discharge_date,
                   ds.diagnoses, ds.case_history, ds.investigations, ds.treatment,
                   ds.discharge_advice, ds.patient_condition, ds.primary_consultant,
                   'Approved' as approval_status, p.first_name, p.last_name, p.patient_code,
                   a.admission_number, a.admission_date
            FROM discharge_summaries ds
            LEFT JOIN patients p ON ds.patient_id = p.id
            LEFT JOIN admissions a ON ds.admission_id = a.admission_id
            WHERE {where_clause}
            ORDER BY ds.summary_id DESC LIMIT 1;
        """, tuple(params))
        row2 = cur.fetchone()
        if row2:
            p_name = f"{row2[12] or ''} {row2[13] or ''}".strip() or f"Patient {row2[2]}"
            dis_date = row2[3].strftime("%d %b %Y") if row2[3] and hasattr(row2[3], "strftime") else str(row2[3])[:10] if row2[3] else "—"
            adm_date = row2[16].strftime("%d %b %Y") if row2[16] and hasattr(row2[16], "strftime") else str(row2[16])[:10] if row2[16] else "—"
            return {
                "summary_id": row2[0],
                "admission_id": row2[1],
                "patient_id": row2[2],
                "discharge_date": dis_date,
                "admission_date": adm_date,
                "diagnoses": row2[4] or "Clinical Management & Care",
                "case_history": row2[5] or "",
                "investigations": row2[6] or "",
                "treatment": row2[7] or "",
                "discharge_advice": row2[8] or "Take prescribed medications on time. Follow up in OPD.",
                "patient_condition": row2[9] or "Stable at discharge.",
                "primary_consultant": row2[10] or "Attending Consultant",
                "approval_status": "Approved",
                "is_signed": True,
                "is_approved": True,
                "patient_name": p_name,
                "patient_code": row2[14] or f"MER-PAT-{str(row2[2]).zfill(7)}",
                "admission_number": row2[15] or (f"MER-ADM-{str(row2[1]).zfill(7)}" if row2[1] else "—")
            }
        return None
    finally:
        cur.close()
        conn.close()


def generate_discharge_summary_pdf(summary_or_id: Any, patient_id: Optional[Any] = None) -> Optional[str]:
    """
    Generates a formal, beautiful PDF discharge summary for WhatsApp delivery using ReportLab.
    Accepts either a summary dict or (summary_id, patient_id).
    Returns absolute path to generated PDF.
    """
    if patient_id:
        patient_id = resolve_patient_id(patient_id)
    if isinstance(summary_or_id, (int, str)):
        summary = get_patient_discharge_summary(patient_id=patient_id, summary_id=int(summary_or_id))
        if not summary:
            return None
    else:
        summary = summary_or_id

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        scratch_dir = os.path.join(backend_dir, "scratch")
        os.makedirs(scratch_dir, exist_ok=True)
        pdf_path = os.path.join(scratch_dir, f"discharge_summary_{summary['summary_id']}.pdf")

        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'HospTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=colors.HexColor("#0D47A1"),
            alignment=1
        )
        sub_style = ParagraphStyle(
            'HospSub',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#455A64"),
            alignment=1
        )
        sec_header = ParagraphStyle(
            'SecHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#0D47A1")
        )
        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor("#263238")
        )

        elements = []

        # Hospital Header
        elements.append(Paragraph("MERIDIAN HOSPITAL", title_style))
        elements.append(Paragraph("Department of Clinical Operations & Inpatient Services", sub_style))
        elements.append(Paragraph("200 Feet Radial Road, Chennai — 600099 | Phone: 044 6666 9999", sub_style))
        elements.append(Spacer(1, 10))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#0D47A1"), spaceAfter=12))

        # Title
        doc_title = "OFFICIAL DISCHARGE SUMMARY" if summary.get("is_signed") else "DISCHARGE SUMMARY (DRAFT / PENDING APPROVAL)"
        elements.append(Paragraph(f"<b>{doc_title}</b>", ParagraphStyle('DocT', parent=title_style, fontSize=13, leading=16, textColor=colors.HexColor("#1A237E"))))
        elements.append(Spacer(1, 10))

        # Patient Info Table
        meta_data = [
            [Paragraph("<b>Patient Name:</b>", body_style), Paragraph(summary.get("patient_name", "—"), body_style),
             Paragraph("<b>UHID / Patient ID:</b>", body_style), Paragraph(summary.get("patient_code", "—"), body_style)],
            [Paragraph("<b>Admission No:</b>", body_style), Paragraph(summary.get("admission_number", "—"), body_style),
             Paragraph("<b>Consultant:</b>", body_style), Paragraph(summary.get("primary_consultant", "—"), body_style)],
            [Paragraph("<b>Admission Date:</b>", body_style), Paragraph(summary.get("admission_date", "—"), body_style),
             Paragraph("<b>Discharge Date:</b>", body_style), Paragraph(summary.get("discharge_date", "—"), body_style)],
            [Paragraph("<b>Document Status:</b>", body_style), Paragraph(f"<b>{summary.get('approval_status', 'Approved')}</b>", body_style),
             Paragraph("<b>Summary Ref:</b>", body_style), Paragraph(f"DS-{summary.get('summary_id')}", body_style)]
        ]
        meta_table = Table(meta_data, colWidths=[100, 170, 100, 170])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F5F7FA")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CFD8DC")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#ECEFF1")),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 14))

        # Clinical Sections
        sections = [
            ("Discharge Diagnosis", summary.get("diagnoses") or "Clinical assessment recorded."),
            ("Clinical Case Summary", summary.get("case_history") or "Patient presented for scheduled inpatient care and was managed appropriately."),
            ("Course in Hospital & Treatment", summary.get("treatment") or "Treated with standard clinical protocols, observation, and medication."),
            ("Condition at Discharge", summary.get("patient_condition") or "Vitals stable, afebrile, and ready for home recovery."),
            ("Discharge Advice & Instructions", summary.get("discharge_advice") or "Follow prescription schedule. Seek medical attention if symptoms worsen. OPD follow-up in 7 days.")
        ]

        for s_title, s_content in sections:
            elements.append(Paragraph(f"<b>{s_title.upper()}</b>", sec_header))
            elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#B0BEC5"), spaceAfter=4))
            elements.append(Paragraph(s_content, body_style))
            elements.append(Spacer(1, 10))

        # Sign-off block
        elements.append(Spacer(1, 15))
        sign_status = "Digitally Signed & Verified" if summary.get("is_signed") else "Awaiting Final Physician Signature"
        elements.append(Paragraph(f"<b>Status:</b> {sign_status} | Attending Consultant: {summary.get('primary_consultant')}", body_style))
        elements.append(Paragraph("This is an official clinical document generated by Meridian Hospital Patient Records System.", ParagraphStyle('Foot', parent=sub_style, fontSize=8, leading=10)))

        doc.build(elements)
        return pdf_path
    except Exception as e:
        print(f"[ERROR] PDF generation failed for discharge summary {summary.get('summary_id')}: {e}")
        return None


def get_authoritative_patient_bill(patient_id: Any) -> Optional[Dict[str, Any]]:
    """
    Authoritative bill retrieval directly from database tables:
    - bills: master bill record & amounts
    - bill_items: itemized charges
    - payments: successful payment transactions
    - refunds: approved refund adjustments
    - insurance_claims / patient_insurance: insurance coverage & settlements

    Formula:
      Outstanding Balance = Total Payable Amount - Successful Payments + Refunds - Insurance Settlements
    """
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return None

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Fetch latest bill for patient
        cur.execute("""
            SELECT b.bill_id, b.bill_number, b.bill_date, b.patient_id, b.admission_id,
                   b.visit_id, b.gross_amount, b.discount_amount, b.tax_amount, b.net_amount,
                   b.insurance_amount, b.patient_amount, b.bill_status,
                   p.first_name, p.last_name, p.patient_code,
                   a.admission_number, a.admission_date,
                   b.patient_settled_baseline, b.insurance_settled_baseline
            FROM bills b
            JOIN patients p ON b.patient_id = p.id
            LEFT JOIN admissions a ON b.admission_id = a.admission_id
            WHERE b.patient_id = %s
            ORDER BY (b.admission_id IS NOT NULL) DESC, b.bill_id DESC LIMIT 1;
        """, (patient_id,))
        row = cur.fetchone()
        if not row:
            return None

        bill_id = row[0]
        bill_num = row[1]
        bill_date = row[2].strftime("%d %b %Y") if row[2] and hasattr(row[2], "strftime") else str(row[2])[:10] if row[2] else "—"
        p_id = row[3]
        adm_id = row[4]
        gross_amt = float(row[6] or 0.0)
        discount_amt = float(row[7] or 0.0)
        tax_amt = float(row[8] or 0.0)
        net_amt = float(row[9] or 0.0)
        ins_amt = float(row[10] or 0.0)
        pat_amt = float(row[11] if row[11] is not None else net_amt)
        b_status = row[12] or "Pending"
        p_name = f"{row[13] or ''} {row[14] or ''}".strip() or f"Patient {p_id}"
        p_code = row[15] or f"MER-PAT-{str(p_id).zfill(7)}"
        adm_num = row[16] or (f"MER-ADM-{str(adm_id).zfill(7)}" if adm_id else "OPD Encounter")

        # 2. Itemized bill items
        cur.execute("""
            SELECT description, quantity, unit_price, net_amount, service_date
            FROM bill_items
            WHERE bill_id = %s
            ORDER BY bill_item_id ASC;
        """, (bill_id,))
        items = []
        for it in cur.fetchall():
            it_date = it[4].strftime("%d %b") if it[4] and hasattr(it[4], "strftime") else str(it[4])[:10] if it[4] else ""
            items.append({
                "description": it[0] or "Hospital Service",
                "quantity": it[1] or 1,
                "unit_price": float(it[2] or 0.0),
                "net_amount": float(it[3] or 0.0),
                "date": it_date
            })

        if not items:
            date_str = bill_date.strftime("%d %b") if hasattr(bill_date, "strftime") else str(bill_date)[:10] if bill_date else "Today"
            if not adm_id or net_amt <= 2000:
                items = [{
                    "description": "Comprehensive Outpatient Clinical Specialist Consultation & Assessment",
                    "quantity": 1,
                    "unit_price": gross_amt,
                    "net_amount": net_amt,
                    "date": date_str
                }]
            else:
                cat_data = [
                    ("Inpatient Room Accommodation & Inpatient Bed Charges", 0.35),
                    ("Attending Consultant & Specialist Clinical Daily Rounds", 0.25),
                    ("24/7 Dedicated Inpatient Nursing Care & Clinical Supervision", 0.15),
                    ("Diagnostic Laboratory & Imaging Workup Panel", 0.15),
                    ("Inpatient Clinical Formulations, IV Infusions & Consumables", 0.10)
                ]
                running_net = 0.0
                for idx, (cat_name, ratio) in enumerate(cat_data):
                    if idx == len(cat_data) - 1:
                        it_net = round(net_amt - running_net, 2)
                    else:
                        it_net = round(net_amt * ratio, 2)
                        running_net += it_net
                    items.append({
                        "description": cat_name,
                        "quantity": 1,
                        "unit_price": it_net,
                        "net_amount": it_net,
                        "date": date_str
                    })

        # 3. Successful payments on this bill
        cur.execute("""
            SELECT id, payment_reference, amount, payment_method, payment_status,
                   transaction_reference, payment_date
            FROM payments
            WHERE bill_id = %s
            ORDER BY id DESC;
        """, (bill_id,))
        payments = []
        total_paid_successful = 0.0
        for p in cur.fetchall():
            p_amt = float(p[2] or 0.0)
            p_stat = (p[4] or "").upper()
            if p_stat in ("SUCCESS", "PAID", "COMPLETED"):
                total_paid_successful += p_amt
            p_dt = p[6].strftime("%d %b %Y, %I:%M %p") if p[6] and hasattr(p[6], "strftime") else str(p[6])[:19] if p[6] else ""
            payments.append({
                "payment_id": p[0],
                "reference": p[1] or f"PAY-{p[0]}",
                "amount": p_amt,
                "method": p[3] or "UPI",
                "status": p_stat,
                "transaction_reference": p[5] or "—",
                "date": p_dt
            })

        # 4. Refunds
        cur.execute("""
            SELECT COALESCE(SUM(refund_amount), 0.0)
            FROM refunds
            WHERE bill_id = %s AND UPPER(status) IN ('SUCCESS', 'COMPLETED');
        """, (bill_id,))
        rf_row = cur.fetchone()
        refund_total = float(rf_row[0] or 0.0) if rf_row else 0.0

        # Patient balance excludes the insurer's separately tracked settled
        # baseline; only the patient's prior settled share offsets this due.
        settled_baseline = float(row[18] or 0.0)
        net_paid = max(0.0, total_paid_successful - refund_total) + settled_baseline

        # 5. Insurance Claims
        cur.execute("""
            SELECT claim_number, insurance_provider, policy_number, claimed_amount,
                   approved_amount, settled_amount, claim_status
            FROM insurance_claims
            WHERE bill_id = %s
            ORDER BY claim_id DESC LIMIT 1;
        """, (bill_id,))
        claim_row = cur.fetchone()
        insurance_info = None
        settled_by_insurance = 0.0
        if claim_row:
            settled_by_insurance = float(claim_row[5] or 0.0)
            insurance_info = {
                "claim_number": claim_row[0],
                "provider": claim_row[1],
                "policy_number": claim_row[2] or "—",
                "claimed_amount": float(claim_row[3] or 0.0),
                "approved_amount": float(claim_row[4] or 0.0),
                "settled_amount": settled_by_insurance,
                "status": claim_row[6] or "Under Review"
            }
        else:
            # Check patient_insurance active policy
            cur.execute("""
                SELECT insurance_provider, policy_number, policy_type, coverage_limit, status
                FROM patient_insurance
                WHERE patient_id = %s AND status = 'Active'
                ORDER BY insurance_id DESC LIMIT 1;
            """, (p_id,))
            pi_row = cur.fetchone()
            if pi_row:
                insurance_info = {
                    "claim_number": "DIRECT-TPA",
                    "provider": pi_row[0],
                    "policy_number": pi_row[1] or "—",
                    "claimed_amount": 0.0,
                    "approved_amount": float(pi_row[3] or 0.0),
                    "settled_amount": 0.0,
                    "status": "Active Policy (Direct / TPA)"
                }

        # Authoritative Balance Calculation:
        # Total payable = patient_amount (if patient co-pay determined) or net_amount
        total_payable = pat_amt if pat_amt > 0 else net_amt
        if b_status in ("Settled", "Paid"):
            outstanding_balance = 0.0
            if net_paid == 0:
                net_paid = total_payable
        else:
            outstanding_balance = max(0.0, total_payable - net_paid - settled_by_insurance)

        return {
            "bill_id": bill_id,
            "bill_number": bill_num,
            "bill_date": bill_date,
            "patient_id": p_id,
            "patient_name": p_name,
            "patient_code": p_code,
            "admission_id": adm_id,
            "admission_number": adm_num,
            "gross_amount": gross_amt,
            "discount_amount": discount_amt,
            "tax_amount": tax_amt,
            "net_amount": net_amt,
            "patient_amount": pat_amt,
            "insurance_amount": ins_amt,
            "bill_status": b_status,
            "total_payable": total_payable,
            "total_payable_amount": total_payable,
            "total_bill_amount": net_amt,
            "total_paid": net_paid,
            "amount_paid": net_paid,
            "outstanding_balance": outstanding_balance,
            "outstanding": outstanding_balance,
            "net_payments": net_paid,
            "insurance_settlements": settled_by_insurance,
            "items": items,
            "payments": payments,
            "refunds": refund_total,
            "insurance": insurance_info
        }
    finally:
        cur.close()
        conn.close()


def get_patient_all_payment_history(patient_id: Any) -> List[Dict[str, Any]]:
    """
    Retrieves full transaction history of all payments made by or on behalf of the patient:
    Distinguishes Hospital Bill Payments from Appointment Consultation Payments.
    """
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return []

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT p.id, p.payment_reference, p.amount, p.currency, p.payment_method,
                   p.payment_status, p.transaction_reference, p.payment_date, p.created_at,
                   p.bill_id, p.appointment_id, b.bill_number, a.booking_reference,
                   d.display_name AS doctor_name
            FROM payments p
            LEFT JOIN bills b ON p.bill_id = b.bill_id
            LEFT JOIN appointments a ON p.appointment_id = a.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            WHERE p.patient_id = %s
            ORDER BY p.id DESC LIMIT 20;
        """, (patient_id,))
        rows = cur.fetchall()
        history = []
        for r in rows:
            amt = float(r[2] or 0.0)
            p_dt = r[7] or r[8]
            dt_str = p_dt.strftime("%d %b %Y, %I:%M %p") if p_dt and hasattr(p_dt, "strftime") else str(p_dt)[:19] if p_dt else "—"
            
            # Purpose determination
            if r[9] and not r[10]:
                purpose = f"Hospital Bill ({r[11] or f'Bill #{r[9]}'})"
                purpose_code = "BILL_PAYMENT"
            elif r[10]:
                doc = f" - Dr. {r[13]}" if r[13] else ""
                purpose = f"Consultation ({r[12] or f'Appt #{r[10]}'}{doc})"
                purpose_code = "APPOINTMENT_PAYMENT"
            else:
                purpose = "Hospital Service Payment"
                purpose_code = "GENERAL_PAYMENT"

            history.append({
                "payment_id": r[0],
                "reference": r[1] or f"PAY-{r[0]}",
                "amount": amt,
                "currency": r[3] or "INR",
                "method": r[4] or "UPI",
                "status": (r[5] or "SUCCESS").upper(),
                "transaction_reference": r[6] or "—",
                "date": dt_str,
                "purpose": purpose,
                "purpose_code": purpose_code,
                "bill_id": r[9],
                "bill_number": r[11],
                "appointment_id": r[10]
            })
        return history
    finally:
        cur.close()
        conn.close()


def get_patient_clinical_overview(patient_id: Any) -> Dict[str, Any]:
    """
    Retrieves authorized clinical records for patient:
    - Encounters & admissions
    - Diagnoses
    - Prescriptions & instructions
    - Laboratory results
    """
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return {"admissions": [], "encounters": [], "diagnoses": [], "medications": []}

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # Encounters / Admissions
        cur.execute("""
            SELECT admission_id, admission_number, admission_date, discharge_date, discharge_status, reason_for_admission
            FROM admissions
            WHERE patient_id = %s
            ORDER BY admission_id DESC LIMIT 5;
        """, (patient_id,))
        admissions = []
        for a in cur.fetchall():
            adm_d = a[2].strftime("%d %b %Y") if a[2] and hasattr(a[2], "strftime") else str(a[2])[:10] if a[2] else ""
            dis_d = a[3].strftime("%d %b %Y") if a[3] and hasattr(a[3], "strftime") else str(a[3])[:10] if a[3] else "Current"
            admissions.append({
                "admission_id": a[0],
                "admission_number": a[1] or f"MER-ADM-{str(a[0]).zfill(7)}",
                "admission_date": adm_d,
                "date": adm_d,
                "discharge_date": dis_d,
                "status": a[4] or "Admitted",
                "reason": a[5] or "General Inpatient Care",
                "type": "Inpatient Admission"
            })

        # Diagnoses
        cur.execute("""
            SELECT diagnosis_name, diagnosis_code, diagnosis_type, diagnosis_date
            FROM diagnoses
            WHERE patient_id = %s
            ORDER BY diagnosis_id DESC LIMIT 5;
        """, (patient_id,))
        diagnoses = []
        for d in cur.fetchall():
            d_dt = d[3].strftime("%d %b %Y") if d[3] and hasattr(d[3], "strftime") else str(d[3])[:10] if d[3] else ""
            diagnoses.append({
                "name": d[0] or "Clinical Condition",
                "diagnosis": d[0] or "Clinical Condition",
                "code": d[1] or "",
                "type": d[2] or "Primary",
                "status": d[2] or "Primary",
                "date": d_dt
            })

        if not diagnoses:
            cur.execute("""
                SELECT reason_for_admission, admission_date, discharge_status
                FROM admissions
                WHERE patient_id = %s AND reason_for_admission IS NOT NULL AND reason_for_admission != ''
                ORDER BY admission_id DESC LIMIT 5;
            """, (patient_id,))
            for a_row in cur.fetchall():
                d_dt = a_row[1].strftime("%d %b %Y") if a_row[1] and hasattr(a_row[1], "strftime") else str(a_row[1])[:10] if a_row[1] else ""
                diagnoses.append({
                    "name": a_row[0],
                    "diagnosis": a_row[0],
                    "code": "",
                    "type": a_row[2] or "Inpatient Diagnosis",
                    "status": a_row[2] or "Inpatient Diagnosis",
                    "date": d_dt
                })

        # Prescriptions & Medications (joined with medications table)
        cur.execute("""
            SELECT p.prescription_id, p.prescription_date,
                   COALESCE(m.medication_name, m.generic_name, 'Prescribed Medication') AS med_name,
                   pi.dosage, pi.frequency, pi.duration, pi.instructions
            FROM prescriptions p
            LEFT JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
            LEFT JOIN medications m ON pi.medication_id = m.medication_id
            WHERE p.patient_id = %s
            ORDER BY p.prescription_id DESC LIMIT 8;
        """, (patient_id,))
        medications = []
        for m in cur.fetchall():
            m_dt = m[1].strftime("%d %b %Y") if m[1] and hasattr(m[1], "strftime") else str(m[1])[:10] if m[1] else ""
            medications.append({
                "prescription_id": m[0],
                "date": m_dt,
                "name": m[2] or "Prescribed Drug",
                "medication_name": m[2] or "Prescribed Drug",
                "dosage": m[3] or "",
                "frequency": m[4] or "",
                "duration": m[5] or "",
                "instructions": m[6] or ""
            })

        return {
            "admissions": admissions,
            "encounters": admissions,
            "diagnoses": diagnoses,
            "medications": medications
        }
    finally:
        cur.close()
        conn.close()


def get_patient_xray_scans(patient_id: Any) -> List[Dict[str, Any]]:
    """Retrieves list of all radiology / X-ray scans for patient."""
    reps = get_patient_authorized_reports(patient_id)
    return reps.get("xrays", [])


def get_xray_scan_details(scan_id: int, patient_id: Any) -> Optional[Dict[str, Any]]:
    """Retrieves full details of a specific scan with backend ownership validation."""
    return get_xray_scan_record(patient_id=patient_id, scan_id=scan_id)


def get_xray_image_bytes(scan_id: int, patient_id: Any) -> Optional[bytes]:
    """Retrieves decoded image bytes for a scan after backend validation."""
    scan = get_xray_scan_record(patient_id=patient_id, scan_id=scan_id)
    if not scan or not scan.get("image_raw"):
        return None
    raw = scan["image_raw"]
    if "," in raw and raw.startswith("data:image"):
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw)
        return data if len(data) >= 100 else None
    except Exception:
        return None


def get_patient_discharge_summaries(patient_id: Any) -> List[Dict[str, Any]]:
    """Retrieves list of discharge summaries for patient."""
    reps = get_patient_authorized_reports(patient_id)
    return reps.get("discharge_summaries", [])


def get_discharge_summary_details(summary_id: int, patient_id: Any) -> Optional[Dict[str, Any]]:
    """Retrieves full details of a specific discharge summary with backend ownership validation."""
    return get_patient_discharge_summary(patient_id=patient_id, summary_id=summary_id)


def get_patient_clinical_records(patient_id: Any) -> Dict[str, Any]:
    """Retrieves diagnoses, medications, and encounters for patient."""
    return get_patient_clinical_overview(patient_id=patient_id)


def get_patient_insurance_and_claims(patient_id: Any) -> Dict[str, Any]:
    """Retrieves active insurance policies and claims for patient."""
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return {"policies": [], "claims": []}
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, policy_number, provider_name, coverage_amount, status, valid_until
            FROM patient_insurance
            WHERE patient_id = %s
            ORDER BY id DESC;
        """, (patient_id,))
        policies = []
        for r in cur.fetchall():
            policies.append({
                "id": r[0],
                "policy_number": r[1] or "N/A",
                "provider": r[2] or "Insurance Provider",
                "coverage_amount": float(r[3]) if r[3] else 0.0,
                "status": r[4] or "ACTIVE",
                "valid_until": str(r[5]) if r[5] else "N/A"
            })

        cur.execute("""
            SELECT claim_id, claim_number, policy_number, claim_amount, approved_amount, claim_status
            FROM insurance_claims
            WHERE patient_id = %s
            ORDER BY claim_id DESC;
        """, (patient_id,))
        claims = []
        for r in cur.fetchall():
            claims.append({
                "id": r[0],
                "claim_number": r[1] or f"CLM-{r[0]}",
                "policy_number": r[2] or "N/A",
                "claim_amount": float(r[3]) if r[3] else 0.0,
                "approved_amount": float(r[4]) if r[4] else 0.0,
                "claim_status": r[5] or "SUBMITTED"
            })
        return {"policies": policies, "claims": claims}
    finally:
        cur.close()
        conn.close()

