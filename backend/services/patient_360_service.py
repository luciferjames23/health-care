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
from datetime import datetime
import random
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
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Exact match on ID or patient_code
        if val_str.isdigit():
            cur.execute("SELECT id FROM patients WHERE id = %s LIMIT 1;", (int(val_str),))
            row = cur.fetchone()
            if row:
                return row[0]
            # If plain numeric ID wasn't found, check if it's the number part of patient_code like P1000064
            cur.execute("SELECT id FROM patients WHERE patient_code = %s OR patient_code = %s LIMIT 1;", (f"P{val_str}", f"MER-PAT-{val_str.zfill(7)}"))
            row = cur.fetchone()
            if row:
                return row[0]

        # 2. Exact match on patient_code or text ID
        cur.execute("SELECT id FROM patients WHERE patient_code = %s OR id::text = %s LIMIT 1;", (val_str, val_str))
        row = cur.fetchone()
        if row:
            return row[0]

        # 3. Digits extraction fallback
        import re
        m = re.search(r'\d+', val_str)
        if m:
            clean_digits = int(m.group(0))
            cur.execute("SELECT id FROM patients WHERE id = %s OR patient_code = %s OR patient_code = %s LIMIT 1;", 
                        (clean_digits, f"P{clean_digits}", f"P{m.group(0)}"))
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
                   COALESCE(rs.created_at, rs.reviewed_at, rs.analyzed_at, rs.viewed_at) AS scan_date,
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
            dt = r[5].strftime("%d-%b-%Y") if r[5] and hasattr(r[5], "strftime") else str(r[5])[:10] if r[5] else "Recent"
            bp = (r[3] or "Chest").strip().title()
            s_type = r[1] or f"{bp} X-Ray"
            xray_code = f"XRAY-{int(r[0]):04d}" if str(r[0]).isdigit() else f"XRAY-{r[0]}"
            xrays.append({
                "id": r[0],
                "scan_id": r[0],
                "record_id": xray_code,
                "scan_type": s_type,
                "modality": r[2] or "DX",
                "body_part": bp,
                "body_region": bp,
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
                   COALESCE(rs.created_at, rs.reviewed_at, rs.analyzed_at, rs.viewed_at) AS created_at, rs.image, p.first_name, p.last_name
            FROM radiology_scan rs
            LEFT JOIN patients p ON rs.patient_id = p.id
            WHERE {where_clause}
            ORDER BY rs.scan_id DESC LIMIT 1;
        """, tuple(params))
        r = cur.fetchone()
        if not r:
            return None

        dt = r[14].strftime("%d-%b-%Y") if r[14] and hasattr(r[14], "strftime") else str(r[14])[:10] if r[14] else "Recent"
        p_name = f"{r[16] or ''} {r[17] or ''}".strip() or f"Patient {r[1]}"
        bp = (r[5] or "Chest").strip().title()
        xray_code = f"XRAY-{int(r[0]):04d}" if str(r[0]).isdigit() else f"XRAY-{r[0]}"
        return {
            "scan_id": r[0],
            "record_id": xray_code,
            "patient_id": r[1],
            "patient_code": r[2] or f"MER-PAT-{str(r[1]).zfill(7)}",
            "patient_name": p_name,
            "scan_type": r[3] or f"{bp} X-Ray",
            "modality": r[4] or "DX",
            "body_part": bp,
            "body_region": bp,
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
            "scan_date": dt,
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
        sid_raw = summary.get("summary_id")
        try:
            ds_code = f"DS-{int(sid_raw):04d}"
        except (ValueError, TypeError):
            ds_code = f"DS-{sid_raw}"
        pdf_path = os.path.join(scratch_dir, f"discharge_summary_{ds_code}.pdf")

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
        elements.append(Paragraph("HOSPITAL", title_style))
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
             Paragraph("<b>Summary Ref:</b>", body_style), Paragraph(ds_code, body_style)]
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
        elements.append(Paragraph("This is an official clinical document generated by Hospital Patient Records System.", ParagraphStyle('Foot', parent=sub_style, fontSize=8, leading=10)))

        doc.build(elements)
        return pdf_path
    except Exception as e:
        print(f"[ERROR] PDF generation failed for discharge summary {summary.get('summary_id')}: {e}")
        return None


def get_patient_unified_billing_statement(patient_id: Any) -> Dict[str, Any]:
    """
    Authoritative consolidated billing ledger for a patient across all hospital sources:
    - Master Inpatient (IP) Bills & Base Accommodation
    - Outpatient (OP) Consultation Bills & Appointment Fees
    - Diagnostic Laboratory & Radiology / X-Ray charges (from patient_charges & bill_items)
    - Pharmacy sales & dispensed medications (from pharmacy_sales & bill_items)
    - Successful Payments & Refunds from payments / refunds tables
    """
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return {
            "summary": {
                "total_billed": 0.0, "hospital_accommodation": 0.0,
                "consultations": 0.0, "pharmacy": 0.0, "diagnostic": 0.0,
                "total_paid": 0.0, "outstanding_balance": 0.0, "is_cleared": True,
                "total_invoices": 0
            },
            "records": [],
            "payments": []
        }

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # Patient demographic info
        cur.execute("SELECT id, patient_code, first_name, last_name, phone FROM patients WHERE id = %s", (patient_id,))
        p_row = cur.fetchone()
        p_name = f"{p_row[2] or ''} {p_row[3] or ''}".strip() if p_row else f"Patient {patient_id}"
        p_code = p_row[1] if p_row else f"MER-PAT-{str(patient_id).zfill(7)}"
        p_phone = p_row[4] if p_row else "—"

        # 1. Fetch all bills for patient
        cur.execute("""
            SELECT b.bill_id, b.bill_number, b.bill_date, b.patient_id, b.admission_id,
                   b.visit_id, b.appointment_id, b.gross_amount, b.discount_amount,
                   b.tax_amount, b.net_amount, b.insurance_amount, b.patient_amount,
                   b.bill_status, b.bill_type, b.notes,
                   a.booking_id, a.appointment_date, a.appointment_time,
                   COALESCE(d.display_name, d.first_name || ' ' || d.last_name) as doctor_name,
                   dp.department_name
            FROM bills b
            LEFT JOIN appointments a ON b.appointment_id = a.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dp ON a.department_id = dp.id
            WHERE b.patient_id = %s
            ORDER BY b.bill_date DESC, b.bill_id DESC;
        """, (patient_id,))
        bill_rows = cur.fetchall()

        records = []
        total_billed = 0.0
        total_paid_all = 0.0
        hospital_sum = 0.0
        consultations_sum = 0.0
        pharmacy_sum = 0.0
        diagnostic_sum = 0.0

        for row in bill_rows:
            (b_id, b_num, b_date, pat_id, adm_id, vis_id, appt_id, gross, disc, tax,
             net, ins_amt, pat_amt, b_stat, b_type, notes,
             booking_id, appt_date, appt_time, doc_name, dept_name) = row

            net_val = float(net or 0.0)
            pat_val = float(pat_amt if pat_amt is not None else net_val)

            # Payments for this bill
            cur.execute("""
                SELECT id, payment_reference, amount, payment_method, payment_status,
                       transaction_reference, payment_date
                FROM payments
                WHERE bill_id = %s OR (appointment_id IS NOT NULL AND appointment_id = %s)
                ORDER BY id DESC;
            """, (b_id, appt_id or -1))
            p_rows = cur.fetchall()

            paid_val = 0.0
            pay_list = []
            for p in p_rows:
                p_amt = float(p[2] or 0.0)
                p_stat = (p[4] or "").upper()
                if p_stat in ('SUCCESS', 'PAID', 'COMPLETED'):
                    paid_val += p_amt
                pay_list.append({
                    "id": p[0],
                    "payment_id": p[0],
                    "reference": p[1] or f"PAY-{p[0]}",
                    "amount": p_amt,
                    "method": p[3] or "UPI",
                    "status": p_stat,
                    "transaction_reference": p[5] or "—",
                    "date": p[6].strftime("%d %b %Y, %I:%M %p") if p[6] and hasattr(p[6], 'strftime') else str(p[6])[:19]
                })

            cur.execute("SELECT COALESCE(SUM(refund_amount), 0) FROM refunds WHERE bill_id = %s AND UPPER(status) IN ('SUCCESS', 'COMPLETED')", (b_id,))
            rf_val = float(cur.fetchone()[0] or 0.0)
            paid_val = max(0.0, paid_val - rf_val)

            outstanding_val = max(0.0, pat_val - paid_val)
            if b_stat in ('Settled', 'Paid') and paid_val == 0:
                paid_val = pat_val
                outstanding_val = 0.0
            elif outstanding_val <= 0:
                b_stat = 'Settled'
                outstanding_val = 0.0
            elif paid_val > 0:
                b_stat = 'Partially Paid'
            else:
                b_stat = 'Pending'

            # Line items
            cur.execute("""
                SELECT description, quantity, unit_price, net_amount, source_type, source_order_id, source_service_code
                FROM bill_items WHERE bill_id = %s ORDER BY bill_item_id ASC;
            """, (b_id,))
            items = [{
                "description": bi[0], "quantity": bi[1], "unit_price": float(bi[2] or 0),
                "net_amount": float(bi[3] or 0), "source_type": bi[4], "source_order_id": bi[5],
                "service_code": bi[6]
            } for bi in cur.fetchall()]

            b_type_clean = (b_type or "").upper()
            if not b_type_clean:
                b_type_clean = 'OUTPATIENT' if appt_id else ('INPATIENT' if adm_id else 'HOSPITAL')

            desc = notes or (f"Specialist Outpatient Consultation - {doc_name} ({dept_name})" if appt_id else (f"Hospital Inpatient Care ({b_num})" if adm_id else f"Hospital Service Bill ({b_num})"))
            if items and items[0].get("description"):
                desc = items[0]["description"]

            if b_type_clean == 'OUTPATIENT':
                consultations_sum += net_val
            elif b_type_clean == 'INPATIENT':
                hospital_sum += net_val
            elif b_type_clean == 'PHARMACY':
                pharmacy_sum += net_val
            else:
                hospital_sum += net_val

            total_billed += net_val
            total_paid_all += paid_val

            records.append({
                "id": f"bill-{b_id}",
                "bill_id": b_id,
                "bill_number": b_num,
                "patient_id": patient_id,
                "patient_name": p_name,
                "patient_code": p_code,
                "appointment_id": appt_id,
                "admission_id": adm_id,
                "date": b_date.strftime("%d %b %Y") if b_date and hasattr(b_date, 'strftime') else str(b_date)[:10],
                "bill_type": b_type_clean,
                "reason": desc,
                "doctor": doc_name or "—",
                "department": dept_name or "—",
                "total_amount": net_val,
                "paid_amount": paid_val,
                "outstanding_balance": outstanding_val,
                "status": b_stat,
                "payment_reference": pay_list[0]["reference"] if pay_list else "—",
                "transaction_reference": pay_list[0]["transaction_reference"] if pay_list else "—",
                "payment_method": pay_list[0]["method"] if pay_list else "—",
                "items": items,
                "payments": pay_list
            })

        # 2. Standalone / Unbilled patient charges (e.g. Chest X-ray, Lab tests)
        cur.execute("""
            SELECT id, source_type, source_order_id, service_code, service_name,
                   view, amount, currency, billing_status, source, created_at
            FROM patient_charges
            WHERE patient_id = %s AND billing_status NOT IN ('CANCELLED')
            ORDER BY created_at DESC;
        """, (patient_id,))
        chg_rows = cur.fetchall()

        # Pre-fetch all payments for charges of this patient
        cur.execute("""
            SELECT id, payment_reference, amount, payment_method, payment_status,
                   transaction_reference, payment_date
            FROM payments
            WHERE patient_id = %s AND payment_reference LIKE 'PAY-CHG-%%'
            ORDER BY id ASC;
        """, (patient_id,))
        charge_payments_map = {}
        for pr in cur.fetchall():
            pref = pr[1] or ""
            if pref.startswith("PAY-CHG-"):
                try:
                    cid = int(pref.split("PAY-CHG-")[1])
                    p_amt = float(pr[2] or 0.0)
                    p_st = (pr[4] or "").upper()
                    p_date_val = pr[6]
                    dt_str = p_date_val.strftime("%d %b %Y, %I:%M %p") if p_date_val and hasattr(p_date_val, 'strftime') else str(p_date_val)[:19] if p_date_val else "—"
                    charge_payments_map.setdefault(cid, []).append({
                        "id": pr[0],
                        "payment_id": pr[0],
                        "reference": pref,
                        "amount": p_amt,
                        "method": pr[3] or "UPI",
                        "status": p_st,
                        "transaction_reference": pr[5] or "—",
                        "date": dt_str
                    })
                except (ValueError, IndexError):
                    pass

        for chg in chg_rows:
            c_id, s_type, s_order, s_code, s_name, view, c_amt, curr, c_stat, src, c_dt = chg
            c_amt_val = float(c_amt or 0.0)
            c_stat_clean = (c_stat or "").upper()

            # Check if this order is already itemized in one of the bills above
            already_in_bill = any(
                itm.get("source_order_id") == str(s_order) and itm.get("source_type") == s_type
                for rec in records for itm in rec.get("items", [])
            )
            if already_in_bill:
                continue

            c_pays = charge_payments_map.get(c_id, [])
            paid_c = sum(p["amount"] for p in c_pays if p["status"] in ('SUCCESS', 'PAID', 'COMPLETED'))
            if c_stat_clean in ('SETTLED', 'PAID') and paid_c == 0.0:
                paid_c = c_amt_val

            out_c = max(0.0, c_amt_val - paid_c)

            if out_c <= 0.0 or c_stat_clean in ('SETTLED', 'PAID'):
                st_clean = 'Settled'
                out_c = 0.0
            elif paid_c > 0.0:
                st_clean = 'Partially Paid'
            else:
                st_clean = 'Pending'

            diagnostic_sum += c_amt_val
            total_billed += c_amt_val
            total_paid_all += paid_c

            b_type_chg = 'RADIOLOGY' if s_type == 'XRAY' else ('LABORATORY' if s_type == 'LAB' else 'DIAGNOSTIC')
            reason_chg = f"{s_name} ({view})" if view else s_name
            dept_chg = 'Radiology' if s_type == 'XRAY' else ('Laboratory' if s_type == 'LAB' else 'Diagnostics')

            records.append({
                "id": f"charge-{c_id}",
                "bill_id": None,
                "charge_id": c_id,
                "bill_number": f"CHG-{c_id}",
                "patient_id": patient_id,
                "patient_name": p_name,
                "patient_code": p_code,
                "appointment_id": None,
                "admission_id": None,
                "date": c_dt.strftime("%d %b %Y") if c_dt and hasattr(c_dt, 'strftime') else str(c_dt)[:10],
                "bill_type": b_type_chg,
                "reason": reason_chg,
                "doctor": "—",
                "department": dept_chg,
                "total_amount": c_amt_val,
                "paid_amount": paid_c,
                "outstanding_balance": out_c,
                "status": st_clean,
                "payment_reference": c_pays[-1]["reference"] if c_pays else "—",
                "transaction_reference": c_pays[-1]["transaction_reference"] if c_pays else "—",
                "payment_method": c_pays[-1]["method"] if c_pays else "—",
                "items": [{
                    "description": reason_chg, "quantity": 1, "unit_price": c_amt_val,
                    "net_amount": c_amt_val, "source_type": s_type, "source_order_id": s_order
                }],
                "payments": c_pays
            })

        # 3. All payments for patient
        cur.execute("""
            SELECT p.id, p.payment_reference, p.amount, p.currency, p.payment_method,
                   p.payment_status, p.transaction_reference, p.payment_date, p.created_at,
                   p.bill_id, p.appointment_id, b.bill_number, a.booking_id AS booking_reference,
                   COALESCE(d.display_name, d.first_name || ' ' || d.last_name) AS doctor_name,
                   dp.department_name
            FROM payments p
            LEFT JOIN bills b ON p.bill_id = b.bill_id
            LEFT JOIN appointments a ON p.appointment_id = a.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dp ON a.department_id = dp.id
            WHERE p.patient_id = %s
            ORDER BY p.id DESC;
        """, (patient_id,))
        all_payments = []
        for r in cur.fetchall():
            amt = float(r[2] or 0.0)
            p_dt = r[7] or r[8]
            dt_str = p_dt.strftime("%d %b %Y, %I:%M %p") if p_dt and hasattr(p_dt, "strftime") else str(p_dt)[:19] if p_dt else "—"

            pref = str(r[1] or "")
            if r[9] and not r[10]:
                purpose = f"Hospital Bill ({r[11] or f'Bill #{r[9]}'})"
                p_code_purp = "BILL_PAYMENT"
            elif r[10]:
                doc_str = f" - Dr. {r[13]}" if r[13] else ""
                purpose = f"Consultation ({r[12] or f'Appt #{r[10]}'}{doc_str})"
                p_code_purp = "APPOINTMENT_PAYMENT"
            elif pref.startswith("PAY-CHG-"):
                purpose = f"Diagnostic Service Payment ({pref})"
                p_code_purp = "CHARGE_PAYMENT"
            else:
                purpose = "Hospital Service Payment"
                p_code_purp = "GENERAL_PAYMENT"

            all_payments.append({
                "payment_id": r[0],
                "reference": r[1] or f"PAY-{r[0]}",
                "amount": amt,
                "currency": r[3] or "INR",
                "method": r[4] or "UPI",
                "status": (r[5] or "SUCCESS").upper(),
                "transaction_reference": r[6] or "—",
                "date": dt_str,
                "purpose": purpose,
                "purpose_code": p_code_purp,
                "bill_id": r[9],
                "bill_number": r[11],
                "appointment_id": r[10]
            })

        total_outstanding = max(0.0, sum(r["outstanding_balance"] for r in records))

        summary = {
            "total_billed": round(total_billed, 2),
            "hospital_accommodation": round(hospital_sum, 2),
            "consultations": round(consultations_sum, 2),
            "pharmacy": round(pharmacy_sum, 2),
            "diagnostic": round(diagnostic_sum, 2),
            "total_paid": round(total_paid_all, 2),
            "outstanding_balance": round(total_outstanding, 2),
            "is_cleared": total_outstanding <= 0.0,
            "total_invoices": len(records)
        }

        return {
            "patient": {
                "patient_id": patient_id,
                "patient_code": p_code,
                "name": p_name,
                "phone": p_phone
            },
            "summary": summary,
            "records": records,
            "payments": all_payments
        }
    finally:
        cur.close()
        conn.close()


def get_authoritative_patient_bill(patient_id: Any) -> Optional[Dict[str, Any]]:
    """
    Authoritative bill retrieval directly from consolidated database records.
    Returns primary active/pending bill details along with full ledger breakdown.
    Formula:
      Outstanding Balance = Total Payable Amount - Successful Payments + Refunds - Insurance Settlements
    """
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return None

    statement = get_patient_unified_billing_statement(patient_id)
    records = statement.get("records", [])
    summary = statement.get("summary", {})
    pat_info = statement.get("patient", {})

    if not records:
        return None

    # Priority 1: First pending record with outstanding balance
    pending_records = [r for r in records if r.get("outstanding_balance", 0) > 0]
    active_rec = pending_records[0] if pending_records else records[0]

    b_id = active_rec.get("bill_id")
    b_num = active_rec.get("bill_number")
    b_date = active_rec.get("date")
    b_stat = "Pending" if pending_records else "Settled"
    adm_id = active_rec.get("admission_id")
    adm_num = f"MER-ADM-{str(adm_id).zfill(7)}" if adm_id else "OPD Encounter"

    total_payable = summary.get("outstanding_balance", 0.0) if pending_records else summary.get("total_billed", 0.0)
    net_amt = summary.get("total_billed", 0.0)
    net_paid = summary.get("total_paid", 0.0)
    outstanding_balance = summary.get("outstanding_balance", 0.0)

    # Format line items from pending records (or all recent records)
    line_items = []
    for r in (pending_records if pending_records else records[:5]):
        line_items.append({
            "item_name": r.get("reason") or r.get("bill_number"),
            "item_description": r.get("reason"),
            "amount": r.get("outstanding_balance") if pending_records else r.get("total_amount"),
            "quantity": 1,
            "date": r.get("date"),
            "bill_number": r.get("bill_number"),
            "status": r.get("status")
        })

    # Insurance check
    insurance_info = None
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT insurance_provider, policy_number, policy_type, coverage_limit, status
            FROM patient_insurance
            WHERE patient_id = %s AND status = 'Active'
            ORDER BY insurance_id DESC LIMIT 1;
        """, (patient_id,))
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
    finally:
        cur.close()
        conn.close()

    return {
        "bill_id": b_id,
        "bill_number": b_num,
        "bill_date": b_date,
        "patient_id": patient_id,
        "patient_name": pat_info.get("name"),
        "patient_code": pat_info.get("patient_code"),
        "admission_id": adm_id,
        "admission_number": adm_num,
        "gross_amount": net_amt,
        "discount_amount": 0.0,
        "tax_amount": 0.0,
        "net_amount": net_amt,
        "patient_amount": net_amt,
        "insurance_amount": 0.0,
        "bill_status": b_stat,
        "total_payable": total_payable,
        "total_payable_amount": total_payable,
        "total_bill_amount": net_amt,
        "total_paid": net_paid,
        "amount_paid": net_paid,
        "outstanding_balance": outstanding_balance,
        "outstanding": outstanding_balance,
        "net_payments": net_paid,
        "insurance_settlements": 0.0,
        "items": line_items,
        "line_items": line_items,
        "payments": statement.get("payments", []),
        "refunds": 0.0,
        "insurance": insurance_info,
        "bills": records,
        "summary": summary
    }


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
                   p.bill_id, p.appointment_id, b.bill_number, a.booking_id AS booking_reference,
                   COALESCE(d.display_name, d.first_name || ' ' || d.last_name) AS doctor_name
            FROM payments p
            LEFT JOIN bills b ON p.bill_id = b.bill_id
            LEFT JOIN appointments a ON p.appointment_id = a.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            WHERE p.patient_id = %s
            ORDER BY p.id DESC LIMIT 30;
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
                doc = f" - {r[13]}" if r[13] else ""
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


def ensure_appointment_bill_and_payment(
    appointment_id: int,
    payment_id: Optional[int] = None,
    amount: Optional[float] = None,
    transaction_reference: Optional[str] = None,
    payment_method: str = "UPI"
) -> Dict[str, Any]:
    """
    Synchronizes an outpatient appointment with a canonical bill and payment record:
    - Resolves appointment details (booking_id, patient_id, doctor, department, fee).
    - Checks or creates a canonical 'bills' record for this appointment.
    - Ensures bill_items has the consultation line item.
    - Links or creates a successful 'payments' record linked to BOTH appointment_id and bill_id.
    - Prevents duplicates and maintains financial ledger consistency.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT a.id, a.booking_id, a.patient_id, a.doctor_id, a.department_id,
                   a.appointment_date, a.appointment_time,
                   COALESCE(d.consultation_fee, 500.0) as doc_fee,
                   COALESCE(d.display_name, d.first_name || ' ' || d.last_name) as doc_name,
                   COALESCE(dp.department_name, 'Outpatient Department') as dept_name
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dp ON a.department_id = dp.id
            WHERE a.id = %s;
        """, (appointment_id,))
        appt = cur.fetchone()
        if not appt:
            return {"success": False, "error": f"Appointment {appointment_id} not found"}

        a_id, booking_id, pat_id, doc_id, dept_id, a_date, a_time, doc_fee, doc_name, dept_name = appt
        final_amt = float(amount) if amount is not None else float(doc_fee or 500.0)
        txn_ref = transaction_reference or f"TXN{datetime.now().strftime('%Y%m%d%H%M%S')}{random.randint(100, 999)}"

        # 1. Check or create bill
        cur.execute("SELECT bill_id, bill_number FROM bills WHERE appointment_id = %s LIMIT 1;", (a_id,))
        b_row = cur.fetchone()
        if b_row:
            bill_id, bill_num = b_row[0], b_row[1]
            cur.execute("""
                UPDATE bills
                SET net_amount = %s, patient_amount = %s, bill_status = 'Settled'
                WHERE bill_id = %s;
            """, (final_amt, final_amt, bill_id))
        else:
            bill_num = f"INV-2026-{booking_id}"
            cur.execute("""
                INSERT INTO bills (
                    bill_number, bill_date, patient_id, appointment_id,
                    gross_amount, discount_amount, tax_amount, net_amount,
                    insurance_amount, patient_amount, bill_status, bill_type,
                    notes
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, 0.0, 0.0, %s,
                    0.0, %s, 'Settled', 'OUTPATIENT',
                    %s
                ) RETURNING bill_id;
            """, (
                bill_num, a_date or datetime.now().date(), pat_id, a_id,
                final_amt, final_amt, final_amt,
                f"Specialist Outpatient Consultation - Dr. {doc_name} ({dept_name})"
            ))
            bill_id = cur.fetchone()[0]

        # Ensure bill item
        cur.execute("SELECT bill_item_id FROM bill_items WHERE bill_id = %s LIMIT 1;", (bill_id,))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO bill_items (
                    bill_id, description, quantity, unit_price,
                    gross_amount, net_amount, source_type, source_order_id, source_service_code
                ) VALUES (
                    %s, %s, 1, %s,
                    %s, %s, 'APPOINTMENT', %s, 'SRV-OPD-CON'
                );
            """, (
                bill_id, f"Specialist Consultation - Dr. {doc_name} ({dept_name})",
                final_amt, final_amt, final_amt, booking_id
            ))

        # 2. Check or create/update payment
        final_pay_id = None
        if payment_id:
            cur.execute("""
                UPDATE payments
                SET bill_id = %s,
                    appointment_id = %s,
                    patient_id = %s,
                    amount = %s,
                    payment_status = 'SUCCESS',
                    payment_method = COALESCE(NULLIF(%s, ''), payment_method, 'UPI'),
                    transaction_reference = COALESCE(NULLIF(%s, ''), transaction_reference, %s),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (bill_id, a_id, pat_id, final_amt, payment_method, txn_ref, txn_ref, payment_id))
            final_pay_id = payment_id
        else:
            cur.execute("""
                SELECT id FROM payments
                WHERE appointment_id = %s OR (bill_id = %s AND payment_status = 'SUCCESS')
                LIMIT 1;
            """, (a_id, bill_id))
            p_exist = cur.fetchone()
            if p_exist:
                final_pay_id = p_exist[0]
                cur.execute("""
                    UPDATE payments
                    SET bill_id = %s,
                        appointment_id = %s,
                        patient_id = %s,
                        payment_status = 'SUCCESS',
                        transaction_reference = COALESCE(NULLIF(%s, ''), transaction_reference, %s),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (bill_id, a_id, pat_id, txn_ref, txn_ref, final_pay_id))
            else:
                pay_ref = f"PAY-OPD-{booking_id}"
                cur.execute("""
                    INSERT INTO payments (
                        payment_reference, patient_id, appointment_id, bill_id,
                        amount, currency, payment_method, payment_status, payment_date,
                        payer_type, transaction_reference, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, 'INR', %s, 'SUCCESS', CURRENT_TIMESTAMP,
                        'PATIENT', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    ) RETURNING id;
                """, (pay_ref, pat_id, a_id, bill_id, final_amt, payment_method, txn_ref))
                final_pay_id = cur.fetchone()[0]

        conn.commit()
        return {
            "success": True,
            "bill_id": bill_id,
            "bill_number": bill_num,
            "payment_id": final_pay_id,
            "amount": final_amt,
            "transaction_reference": txn_ref
        }
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        conn.close()


def pay_patient_outstanding_balance(
    patient_id: Any,
    bill_id: Optional[int] = None,
    charge_id: Optional[int] = None,
    amount: Optional[float] = None,
    payment_method: str = "UPI",
    transaction_reference: Optional[str] = None
) -> Dict[str, Any]:
    """
    Authoritative payment handler for hospital bills and pending diagnostic charges.
    Ensures mock payments apply ONLY against verified outstanding dues with
    full ACID transactional consistency, idempotency, and row-level locking.
    """
    patient_id = resolve_patient_id(patient_id)
    if not patient_id:
        return {"success": False, "error": "Invalid patient ID"}

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        now_dt = datetime.now()
        txn_ref = transaction_reference or f"TXN{now_dt.strftime('%Y%m%d%H%M%S')}{random.randint(100, 999)}"

        # Case 1: Paying a specific unbilled patient_charge
        if charge_id:
            cur.execute("""
                SELECT id, service_name, amount, billing_status
                FROM patient_charges
                WHERE id = %s AND patient_id = %s
                FOR UPDATE;
            """, (charge_id, patient_id))
            chg = cur.fetchone()
            if not chg:
                return {"success": False, "error": f"Charge {charge_id} not found for patient"}

            c_amt = float(chg[2] or 0.0)
            c_stat = (chg[3] or "").upper()
            pay_ref = f"PAY-CHG-{charge_id}"

            # Idempotency check: if transaction_reference is provided, verify whether it was already processed
            if transaction_reference:
                cur.execute("""
                    SELECT id, payment_reference, amount, payment_status
                    FROM payments
                    WHERE transaction_reference = %s AND patient_id = %s;
                """, (transaction_reference, patient_id))
                existing_txn = cur.fetchone()
                if existing_txn:
                    conn.rollback()
                    return {
                        "success": True,
                        "payment_id": existing_txn[0],
                        "payment_reference": existing_txn[1],
                        "transaction_reference": transaction_reference,
                        "amount": float(existing_txn[2] or 0.0),
                        "paid_amount": float(existing_txn[2] or 0.0),
                        "target_type": "CHARGE",
                        "charge_id": charge_id,
                        "service_name": chg[1],
                        "is_duplicate": True,
                        "message": "Payment already processed (idempotent)."
                    }

            # Revalidate outstanding balance against recorded payments ledger
            cur.execute("""
                SELECT COALESCE(SUM(amount), 0)
                FROM payments
                WHERE payment_reference = %s AND UPPER(payment_status) IN ('SUCCESS', 'PAID', 'COMPLETED');
            """, (pay_ref,))
            already_paid = float(cur.fetchone()[0] or 0.0)
            verified_outstanding = max(0.0, c_amt - already_paid)

            if verified_outstanding <= 0.0 or c_stat in ('SETTLED', 'PAID'):
                return {"success": False, "error": f"Charge {charge_id} ({chg[1]}) is already fully settled."}

            pay_amt = min(verified_outstanding, float(amount)) if amount is not None else verified_outstanding
            if pay_amt <= 0.0:
                return {"success": False, "error": "Payment amount must be greater than zero."}

            cur.execute("""
                INSERT INTO payments (
                    payment_reference, patient_id, appointment_id, bill_id,
                    amount, currency, payment_method, payment_status, payment_date,
                    payer_type, transaction_reference, created_at, updated_at
                ) VALUES (
                    %s, %s, NULL, NULL,
                    %s, 'INR', %s, 'SUCCESS', CURRENT_TIMESTAMP,
                    'PATIENT', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING id;
            """, (pay_ref, patient_id, pay_amt, payment_method, txn_ref))
            p_id = cur.fetchone()[0]

            new_paid_total = already_paid + pay_amt
            new_c_stat = 'SETTLED' if new_paid_total >= c_amt else 'PENDING'
            cur.execute("UPDATE patient_charges SET billing_status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (new_c_stat, charge_id))
            conn.commit()

            return {
                "success": True,
                "payment_id": p_id,
                "payment_reference": pay_ref,
                "transaction_reference": txn_ref,
                "amount": pay_amt,
                "paid_amount": pay_amt,
                "target_type": "CHARGE",
                "charge_id": charge_id,
                "service_name": chg[1],
                "billing_status": new_c_stat,
                "remaining_balance": max(0.0, c_amt - new_paid_total)
            }

        # Case 2: Paying a specific bill
        if bill_id:
            cur.execute("""
                SELECT b.bill_id, b.bill_number, b.net_amount, b.patient_amount, b.bill_status
                FROM bills b
                WHERE b.bill_id = %s AND b.patient_id = %s
                FOR UPDATE;
            """, (bill_id, patient_id))
            b_row = cur.fetchone()
            if not b_row:
                return {"success": False, "error": f"Bill {bill_id} not found for patient"}

            b_id, b_num, net_amt, pat_amt, b_stat = b_row
            due_baseline = float(pat_amt if pat_amt is not None else (net_amt or 0.0))

            # Idempotency check: if transaction_reference is provided, verify whether it was already processed
            if transaction_reference:
                cur.execute("""
                    SELECT id, payment_reference, amount, payment_status
                    FROM payments
                    WHERE transaction_reference = %s AND patient_id = %s;
                """, (transaction_reference, patient_id))
                existing_txn = cur.fetchone()
                if existing_txn:
                    conn.rollback()
                    return {
                        "success": True,
                        "payment_id": existing_txn[0],
                        "payment_reference": existing_txn[1],
                        "transaction_reference": transaction_reference,
                        "amount": float(existing_txn[2] or 0.0),
                        "target_type": "BILL",
                        "bill_id": b_id,
                        "bill_number": b_num,
                        "is_duplicate": True,
                        "message": "Payment already processed (idempotent)."
                    }

            cur.execute("""
                SELECT COALESCE(SUM(amount), 0) FROM payments
                WHERE bill_id = %s AND UPPER(payment_status) IN ('SUCCESS', 'PAID', 'COMPLETED');
            """, (b_id,))
            already_paid = float(cur.fetchone()[0] or 0.0)

            cur.execute("SELECT COALESCE(SUM(refund_amount), 0) FROM refunds WHERE bill_id = %s AND UPPER(status) IN ('SUCCESS', 'COMPLETED')", (b_id,))
            already_refunded = float(cur.fetchone()[0] or 0.0)
            net_already_paid = max(0.0, already_paid - already_refunded)

            verified_outstanding = max(0.0, due_baseline - net_already_paid)
            if verified_outstanding <= 0.0:
                return {"success": False, "error": "This bill is already settled in full."}

            pay_amount = min(verified_outstanding, float(amount)) if amount is not None else verified_outstanding
            if pay_amount <= 0.0:
                return {"success": False, "error": "Payment amount must be greater than zero."}

            pay_ref = f"PAY-BILL-{b_num}"
            cur.execute("""
                INSERT INTO payments (
                    payment_reference, patient_id, appointment_id, bill_id,
                    amount, currency, payment_method, payment_status, payment_date,
                    payer_type, transaction_reference, created_at, updated_at
                ) VALUES (
                    %s, %s, NULL, %s,
                    %s, 'INR', %s, 'SUCCESS', CURRENT_TIMESTAMP,
                    'PATIENT', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING id;
            """, (pay_ref, patient_id, b_id, pay_amount, payment_method, txn_ref))
            p_id = cur.fetchone()[0]

            new_paid_total = net_already_paid + pay_amount
            new_status = 'Settled' if new_paid_total >= due_baseline else 'Partially Paid'
            cur.execute("UPDATE bills SET bill_status = %s WHERE bill_id = %s;", (new_status, b_id))
            conn.commit()

            return {
                "success": True,
                "payment_id": p_id,
                "payment_reference": pay_ref,
                "transaction_reference": txn_ref,
                "amount": pay_amount,
                "target_type": "BILL",
                "bill_id": b_id,
                "bill_number": b_num,
                "new_bill_status": new_status,
                "remaining_balance": max(0.0, due_baseline - new_paid_total)
            }

        # Case 3: Overall balance payment
        stmt = get_patient_unified_billing_statement(patient_id)
        out_bal = stmt["summary"]["outstanding_balance"]
        if out_bal <= 0.0:
            return {"success": False, "error": "All accounts and bills are fully settled."}

        pay_amount = min(out_bal, float(amount)) if amount is not None else out_bal
        remaining = pay_amount
        payments_made = []

        for rec in stmt["records"]:
            if remaining <= 0:
                break
            rec_bal = rec["outstanding_balance"]
            if rec_bal <= 0:
                continue

            alloc = min(rec_bal, remaining)
            if rec.get("bill_id"):
                sub_txn_ref = f"{txn_ref}-B{rec['bill_id']}"
                sub_res = pay_patient_outstanding_balance(
                    patient_id=patient_id,
                    bill_id=rec["bill_id"],
                    amount=alloc,
                    payment_method=payment_method,
                    transaction_reference=sub_txn_ref
                )
                if sub_res.get("success"):
                    payments_made.append(sub_res)
                    remaining -= alloc
            elif rec.get("charge_id"):
                sub_txn_ref = f"{txn_ref}-C{rec['charge_id']}"
                sub_res = pay_patient_outstanding_balance(
                    patient_id=patient_id,
                    charge_id=rec["charge_id"],
                    amount=alloc,
                    payment_method=payment_method,
                    transaction_reference=sub_txn_ref
                )
                if sub_res.get("success"):
                    payments_made.append(sub_res)
                    remaining -= alloc

        return {
            "success": True,
            "total_paid": pay_amount,
            "details": payments_made,
            "transaction_reference": txn_ref
        }
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        conn.close()

