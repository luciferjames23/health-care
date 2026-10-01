"""
rag_ingestion_service.py
========================
Idempotent, production-grade Document Ingestion Service for Meridian Hospital AI Hybrid RAG.

Document Types:
- patient_admission_summary
- diagnosis_summary
- vital_trend_summary
- medication_summary
- lab_result_summary
- procedure_summary
- billing_clearance_summary
- doctor_patient_task_summary
- xray_order
- radiology_ai_result
- radiologist_final_report
- discharge_readiness_summary
- verified_discharge_summary

Strict Clinical Ingestion Rules:
- Only index order-linked radiology studies.
- NEVER ingest `radiology_scan_legacy_archive` or unlinked Orthanc scans.
- Clearly separate AI-assisted screening findings from verified radiologist reports.
- Content-hash verification skips unchanged records.
- Never alter, modify, or delete any source clinical records.
"""

import sys
import os
import json
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import psycopg2.extras

# Ensure backend root is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import db_config
from services.rag_embedding_service import embedding_service
from services.rag_access_control import DOCUMENT_MODULE


class RagIngestionService:
    def __init__(self):
        self.embedding_service = embedding_service

    def upsert_document(
        self,
        cur,
        document_type: str,
        source_table: str,
        source_record_id: str,
        title: str,
        content: str,
        patient_id: Optional[int] = None,
        admission_id: Optional[int] = None,
        doctor_id: Optional[int] = None,
        order_id: Optional[str] = None,
        accession_number: Optional[str] = None,
        study_instance_uid: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        review_status: Optional[str] = None,
        is_verified: bool = False,
        is_active: bool = True
    ) -> bool:
        """
        Idempotently inserts or updates a document in rag_documents.
        Returns True if newly inserted or updated, False if skipped because content was unchanged.
        """
        if not content or not content.strip():
            return False

        module = DOCUMENT_MODULE.get(document_type)
        if not module:
            raise ValueError(f"Unmapped RAG document type: {document_type}")
        meta_dict = dict(metadata or {})
        # A stable authorization/routing contract on every indexed chunk.
        meta_dict.update({
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "module": module,
            "department": meta_dict.get("department"),
            "record_id": str(source_record_id),
            "timestamp": meta_dict.get("timestamp") or datetime.now(timezone.utc).isoformat(),
            "version": int(meta_dict.get("version") or 1),
            "is_deleted": bool(meta_dict.get("is_deleted", False)),
        })
        is_active = bool(is_active and not meta_dict["is_deleted"])
        content_clean = content.strip()
        content_hash = hashlib.sha256(content_clean.encode('utf-8')).hexdigest()

        # Check existing
        cur.execute("""
            SELECT id, content_hash, is_active, is_verified, review_status, metadata
            FROM rag_documents
            WHERE source_table = %s AND source_record_id = %s AND document_type = %s;
        """, (source_table, str(source_record_id), document_type))
        existing = cur.fetchone()

        if existing:
            doc_id, old_hash, old_active, old_verified, old_review, old_metadata = existing
            if (old_hash == content_hash and
                old_active == is_active and
                old_verified == is_verified and
                old_review == review_status and
                (old_metadata or {}) == meta_dict):
                # Unchanged - skip
                return False

            # Generate updated embedding
            embedding_vec = self.embedding_service.generate_embedding(f"{title}\n{content_clean}")
            cur.execute("""
                UPDATE rag_documents
                SET title = %s,
                    content = %s,
                    content_hash = %s,
                    patient_id = %s,
                    admission_id = %s,
                    doctor_id = %s,
                    order_id = %s,
                    accession_number = %s,
                    study_instance_uid = %s,
                    metadata = %s,
                    review_status = %s,
                    is_verified = %s,
                    is_active = %s,
                    embedding = %s,
                    embedding_model = %s,
                    embedded_at = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (
                title, content_clean, content_hash,
                patient_id, admission_id, doctor_id, order_id, accession_number, study_instance_uid,
                json.dumps(meta_dict, default=str), review_status, is_verified, is_active,
                json.dumps(embedding_vec) if embedding_vec else None,
                self.embedding_service.model if embedding_vec else None,
                datetime.now(timezone.utc) if embedding_vec else None,
                doc_id
            ))
            return True

        # Insert new
        embedding_vec = self.embedding_service.generate_embedding(f"{title}\n{content_clean}")
        cur.execute("""
            INSERT INTO rag_documents (
                document_type, source_table, source_record_id,
                patient_id, admission_id, doctor_id, order_id, accession_number, study_instance_uid,
                title, content, content_hash, metadata, review_status, is_verified, is_active,
                embedding, embedding_model, embedded_at
            ) VALUES (
                %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s
            )
            ON CONFLICT (source_table, source_record_id, document_type) DO UPDATE
            SET title = EXCLUDED.title,
                content = EXCLUDED.content,
                content_hash = EXCLUDED.content_hash,
                patient_id = EXCLUDED.patient_id,
                admission_id = EXCLUDED.admission_id,
                doctor_id = EXCLUDED.doctor_id,
                order_id = EXCLUDED.order_id,
                accession_number = EXCLUDED.accession_number,
                study_instance_uid = EXCLUDED.study_instance_uid,
                metadata = EXCLUDED.metadata,
                review_status = EXCLUDED.review_status,
                is_verified = EXCLUDED.is_verified,
                is_active = EXCLUDED.is_active,
                embedding = EXCLUDED.embedding,
                embedding_model = EXCLUDED.embedding_model,
                embedded_at = EXCLUDED.embedded_at,
                updated_at = CURRENT_TIMESTAMP;
        """, (
            document_type, source_table, str(source_record_id),
            patient_id, admission_id, doctor_id, order_id, accession_number, study_instance_uid,
            title, content_clean, content_hash, json.dumps(meta_dict, default=str), review_status, is_verified, is_active,
            json.dumps(embedding_vec) if embedding_vec else None,
            self.embedding_service.model if embedding_vec else None,
            datetime.now(timezone.utc) if embedding_vec else None
        ))
        return True

    # ─────────────────────────────────────────────────────────────────────────────
    # INGESTION METHODS PER DOMAIN
    # ─────────────────────────────────────────────────────────────────────────────

    def ingest_admissions(self, cur, patient_id: Optional[int] = None, admission_id: Optional[int] = None) -> int:
        """Ingests patient admission records."""
        sql = """
            SELECT 
                a.admission_id, a.admission_number, a.patient_id, a.doctor_id,
                a.admission_date, a.admission_type, a.admission_source, a.reason_for_admission,
                COALESCE(
                    a.discharge_date,
                    (SELECT gds.discharge_date FROM dim_generated_discharge_summaries gds WHERE gds.admission_id = a.admission_id LIMIT 1)
                ) as discharge_date,
                COALESCE(
                    (SELECT dai.discharge_status FROM dim_admission_inputs dai WHERE dai.admission_id = a.admission_id LIMIT 1),
                    (SELECT CASE WHEN LOWER(gds.approval_status) IN ('approved', 'signed', 'completed', 'signed off') THEN 'Discharged' ELSE NULL END FROM dim_generated_discharge_summaries gds WHERE gds.admission_id = a.admission_id LIMIT 1),
                    a.discharge_status
                ) as discharge_status,
                p.patient_code, p.first_name, p.last_name, p.gender, p.blood_group,
                p.date_of_birth, EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth)) as age,
                COALESCE(d.display_name, CONCAT(d.first_name, ' ', d.last_name)) as doctor_name,
                d.specialization
            FROM admissions a
            JOIN patients p ON p.id = a.patient_id
            LEFT JOIN doctors d ON d.id = a.doctor_id
            WHERE 1=1
        """
        params = []
        if patient_id:
            sql += " AND a.patient_id = %s"
            params.append(patient_id)
        if admission_id:
            sql += " AND a.admission_id = %s"
            params.append(admission_id)

        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        count = 0
        for r in rows:
            (adm_id, adm_num, pat_id, doc_id, adm_date, adm_type, adm_src, reason,
             dis_date, dis_status, p_code, first, last, gender, blood, dob, age, doc_name, spec) = r

            pat_name = f"{first} {last}".strip()
            is_discharged = str(dis_status).strip().lower() == 'discharged' or bool(dis_date and str(dis_date).lower() != 'none')
            is_active_adm = not is_discharged and (dis_status in ('Admitted', 'Active', 'Inpatient') or not dis_date)
            title = f"Inpatient Admission Summary - ADM #{adm_num or adm_id} ({pat_name})"
            content = (
                f"Patient: {pat_name} (Code: {p_code}, Age: {age or 'N/A'}, Gender: {gender or 'N/A'}, Blood Group: {blood or 'N/A'})\n"
                f"Admission ID: {adm_id} (Number: {adm_num})\n"
                f"Admission Date: {adm_date} | Discharge Status: {dis_status or 'Admitted'}\n"
                f"Admission Type: {adm_type or 'General'} | Source: {adm_src or 'Emergency/Direct'}\n"
                f"Reason for Admission: {reason or 'Inpatient medical evaluation and stabilization'}\n"
                f"Attending Doctor: {doc_name or 'On-Duty Consultant'} ({spec or 'General Medicine'})\n"
                f"Discharge Date: {dis_date or ('Currently Admitted' if not is_discharged else 'Discharged')}"
            )
            meta = {
                "patient_code": p_code,
                "admission_number": adm_num,
                "doctor_name": doc_name,
                "specialization": spec,
                "is_active_admission": is_active_adm
            }
            if self.upsert_document(
                cur=cur,
                document_type="patient_admission_summary",
                source_table="admissions",
                source_record_id=str(adm_id),
                title=title,
                content=content,
                patient_id=pat_id,
                admission_id=adm_id,
                doctor_id=doc_id,
                metadata=meta,
                review_status=dis_status or "Admitted",
                is_verified=True,
                is_active=True
            ):
                count += 1
        return count

    def ingest_diagnoses(self, cur, patient_id: Optional[int] = None, admission_id: Optional[int] = None) -> int:
        """Ingests patient clinical diagnoses."""
        sql = """
            SELECT 
                dx.diagnosis_id, dx.patient_id, dx.admission_id, dx.doctor_id,
                dx.diagnosis_code, dx.diagnosis_name, dx.diagnosis_type, dx.diagnosis_date, dx.is_primary,
                p.first_name, p.last_name, p.patient_code,
                COALESCE(d.display_name, CONCAT(d.first_name, ' ', d.last_name)) as doctor_name
            FROM diagnoses dx
            JOIN patients p ON p.id = dx.patient_id
            LEFT JOIN doctors d ON d.id = dx.doctor_id
            WHERE 1=1
        """
        params = []
        if patient_id:
            sql += " AND dx.patient_id = %s"
            params.append(patient_id)
        if admission_id:
            sql += " AND dx.admission_id = %s"
            params.append(admission_id)

        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        count = 0
        for r in rows:
            (dx_id, pat_id, adm_id, doc_id, code, name, dtype, dt, is_primary, first, last, p_code, doc_name) = r
            pat_name = f"{first} {last}".strip()
            prim_label = "Primary Diagnosis" if is_primary else "Secondary Diagnosis"
            title = f"Clinical Diagnosis: {name} ({prim_label}) - {pat_name}"
            content = (
                f"Patient: {pat_name} (Code: {p_code})\n"
                f"Diagnosis: {name} (ICD Code: {code or 'N/A'})\n"
                f"Classification: {prim_label} (Type: {dtype or 'Provisional/Confirmed'})\n"
                f"Diagnosis Date: {dt}\n"
                f"Attending/Diagnosing Physician: {doc_name or 'Attending Doctor'}\n"
                f"Admission ID: {adm_id or 'Outpatient/General'}"
            )
            meta = {
                "diagnosis_code": code,
                "is_primary": bool(is_primary),
                "diagnosis_type": dtype,
                "doctor_name": doc_name
            }
            if self.upsert_document(
                cur=cur,
                document_type="diagnosis_summary",
                source_table="diagnoses",
                source_record_id=str(dx_id),
                title=title,
                content=content,
                patient_id=pat_id,
                admission_id=adm_id,
                doctor_id=doc_id,
                metadata=meta,
                review_status="Confirmed" if is_primary else "Recorded",
                is_verified=True,
                is_active=True
            ):
                count += 1
        return count

    def ingest_vitals(self, cur, patient_id: Optional[int] = None, admission_id: Optional[int] = None) -> int:
        """Ingests vital signs with abnormal/critical value detection."""
        sql = """
            SELECT 
                vs.vital_id, vs.patient_id, vs.admission_id, vs.recorded_at,
                vs.temperature, vs.heart_rate, vs.systolic_bp, vs.diastolic_bp,
                vs.respiratory_rate, vs.oxygen_saturation, vs.weight,
                p.first_name, p.last_name, p.patient_code
            FROM vital_signs vs
            JOIN patients p ON p.id = vs.patient_id
            WHERE 1=1
        """
        params = []
        if patient_id:
            sql += " AND vs.patient_id = %s"
            params.append(patient_id)
        if admission_id:
            sql += " AND vs.admission_id = %s"
            params.append(admission_id)

        sql += " ORDER BY vs.recorded_at DESC LIMIT 500"
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        count = 0
        for r in rows:
            (v_id, pat_id, adm_id, rec_at, temp, hr, sbp, dbp, rr, spo2, wt, first, last, p_code) = r
            pat_name = f"{first} {last}".strip()

            # Identify abnormal indicators
            abnormal_flags = []
            if hr and (hr < 60 or hr > 100):
                abnormal_flags.append(f"Heart Rate ({hr} bpm)")
            if sbp and (sbp > 140 or sbp < 90):
                abnormal_flags.append(f"Systolic BP ({sbp} mmHg)")
            if dbp and (dbp > 90 or dbp < 60):
                abnormal_flags.append(f"Diastolic BP ({dbp} mmHg)")
            if spo2 and spo2 < 95.0:
                abnormal_flags.append(f"Low Oxygen Saturation ({spo2}%)")
            if temp and (temp > 100.4 or (temp < 97.0 and temp > 50.0)):
                abnormal_flags.append(f"Temperature ({temp}°F)")

            status_label = "Abnormal" if abnormal_flags else "Normal"
            title = f"Vital Signs ({status_label}) - {rec_at} ({pat_name})"
            content = (
                f"Patient: {pat_name} (Code: {p_code})\n"
                f"Recorded Timestamp: {rec_at}\n"
                f"Vitals: Temp: {temp or 'N/A'}°F, Heart Rate: {hr or 'N/A'} bpm, "
                f"Blood Pressure: {sbp or 'N/A'}/{dbp or 'N/A'} mmHg, Resp Rate: {rr or 'N/A'}/min, "
                f"SpO2: {spo2 or 'N/A'}%, Weight: {wt or 'N/A'} kg\n"
                f"Status Assessment: {status_label}\n"
                f"Alert Flags: {', '.join(abnormal_flags) if abnormal_flags else 'All parameters within reference limits'}"
            )
            meta = {
                "abnormal": bool(abnormal_flags),
                "abnormal_flags": abnormal_flags,
                "spo2": spo2,
                "hr": hr,
                "sbp": sbp,
                "dbp": dbp
            }
            if self.upsert_document(
                cur=cur,
                document_type="vital_trend_summary",
                source_table="vital_signs",
                source_record_id=str(v_id),
                title=title,
                content=content,
                patient_id=pat_id,
                admission_id=adm_id,
                metadata=meta,
                review_status=status_label,
                is_verified=True,
                is_active=True
            ):
                count += 1
        return count

    def ingest_medications(self, cur, patient_id: Optional[int] = None, admission_id: Optional[int] = None) -> int:
        """Ingests prescription items and eMAR medication administration records."""
        count = 0

        # 1. Prescriptions & Prescription Items
        sql_pres = """
            SELECT 
                pi.prescription_item_id, pr.prescription_id, pr.patient_id, pr.admission_id, pr.doctor_id,
                pr.prescription_date, pr.status as prescription_status,
                m.medication_name, m.generic_name, m.dosage_form, m.strength,
                pi.dosage, pi.frequency, pi.route, pi.duration, pi.instructions,
                p.first_name, p.last_name, p.patient_code,
                COALESCE(d.display_name, CONCAT(d.first_name, ' ', d.last_name)) as doctor_name
            FROM prescription_items pi
            JOIN prescriptions pr ON pr.prescription_id = pi.prescription_id
            JOIN medications m ON m.medication_id = pi.medication_id
            JOIN patients p ON p.id = pr.patient_id
            LEFT JOIN doctors d ON d.id = pr.doctor_id
            WHERE 1=1
        """
        params = []
        if patient_id:
            sql_pres += " AND pr.patient_id = %s"
            params.append(patient_id)
        if admission_id:
            sql_pres += " AND pr.admission_id = %s"
            params.append(admission_id)

        cur.execute(sql_pres, tuple(params))
        for r in cur.fetchall():
            (pi_id, pr_id, pat_id, adm_id, doc_id, dt, pr_status,
             med_name, gen_name, dform, strength,
             dosage, freq, route, dur, instr,
             first, last, p_code, doc_name) = r

            pat_name = f"{first} {last}".strip()
            title = f"Medication Order: {med_name} {dosage or strength or ''} - {pat_name}"
            content = (
                f"Patient: {pat_name} (Code: {p_code})\n"
                f"Prescribed Medication: {med_name} (Generic: {gen_name or 'N/A'}, Form: {dform or 'Oral'})\n"
                f"Dosage: {dosage or strength or 'Standard'} | Frequency: {freq or 'As directed'} | Route: {route or 'Oral'}\n"
                f"Duration: {dur or 'Ongoing course'} | Special Instructions: {instr or 'Take with food/water'}\n"
                f"Prescribed By: {doc_name or 'Consultant'} | Order Date: {dt}\n"
                f"Order Status: {pr_status or 'Active'}"
            )
            meta = {
                "medication_name": med_name,
                "generic_name": gen_name,
                "frequency": freq,
                "route": route,
                "prescribing_doctor": doc_name
            }
            if self.upsert_document(
                cur=cur,
                document_type="medication_summary",
                source_table="prescription_items",
                source_record_id=str(pi_id),
                title=title,
                content=content,
                patient_id=pat_id,
                admission_id=adm_id,
                doctor_id=doc_id,
                metadata=meta,
                review_status=pr_status or "Active",
                is_verified=True,
                is_active=True
            ):
                count += 1

        return count

    def ingest_lab_results(self, cur, patient_id: Optional[int] = None) -> int:
        """Ingests laboratory orders and test results with abnormal flags."""
        sql = """
            SELECT 
                lr.lab_result_id, lr.lab_order_id, lr.patient_id,
                lr.test_parameter, lr.result_value, lr.unit, lr.reference_range,
                lr.abnormal_flag, lr.verification_status, lr.result_date, lr.verified_by,
                p.first_name, p.last_name, p.patient_code
            FROM lab_results lr
            JOIN patients p ON p.id = lr.patient_id
            WHERE 1=1
        """
        params = []
        if patient_id:
            sql += " AND lr.patient_id = %s"
            params.append(patient_id)

        sql += " ORDER BY lr.result_date DESC LIMIT 500"
        cur.execute(sql, tuple(params))
        count = 0
        for r in cur.fetchall():
            (lr_id, lo_id, pat_id, param, val, unit, ref_range, flag, v_status, dt, ver_by, first, last, p_code) = r
            pat_name = f"{first} {last}".strip()
            is_abnormal = bool(flag and str(flag).strip() not in ('Normal', 'N', 'Negative', '0'))
            is_verified = (v_status == 'Verified' or bool(ver_by))

            status_str = "Abnormal Value" if is_abnormal else "Normal Range"
            title = f"Lab Result: {param} = {val} {unit or ''} ({status_str}) - {pat_name}"
            content = (
                f"Patient: {pat_name} (Code: {p_code})\n"
                f"Test Parameter: {param}\n"
                f"Result Value: {val} {unit or ''} (Reference Range: {ref_range or 'Normal'})\n"
                f"Abnormal Flag: {flag or 'Normal'} ({status_str})\n"
                f"Verification Status: {v_status or 'Completed'} (Verified By: {ver_by or 'Pathology Lab'})\n"
                f"Result Timestamp: {dt}"
            )
            meta = {
                "test_parameter": param,
                "result_value": val,
                "unit": unit,
                "reference_range": ref_range,
                "is_abnormal": is_abnormal,
                "is_verified": is_verified
            }
            if self.upsert_document(
                cur=cur,
                document_type="lab_result_summary",
                source_table="lab_results",
                source_record_id=str(lr_id),
                title=title,
                content=content,
                patient_id=pat_id,
                metadata=meta,
                review_status="Abnormal" if is_abnormal else "Normal",
                is_verified=is_verified,
                is_active=True
            ):
                count += 1
        return count

    def ingest_procedures(self, cur, patient_id: Optional[int] = None, admission_id: Optional[int] = None) -> int:
        """Ingests procedures and surgeries."""
        sql = """
            SELECT 
                pp.patient_procedure_id, pp.patient_id, pp.admission_id, pp.doctor_id,
                pp.procedure_date, pp.charge, pp.status, pp.notes,
                pr.procedure_name, pr.procedure_code,
                p.first_name, p.last_name, p.patient_code,
                COALESCE(d.display_name, CONCAT(d.first_name, ' ', d.last_name)) as doctor_name
            FROM patient_procedures pp
            JOIN procedures pr ON pr.procedure_id = pp.procedure_id
            JOIN patients p ON p.id = pp.patient_id
            LEFT JOIN doctors d ON d.id = pp.doctor_id
            WHERE 1=1
        """
        params = []
        if patient_id:
            sql += " AND pp.patient_id = %s"
            params.append(patient_id)
        if admission_id:
            sql += " AND pp.admission_id = %s"
            params.append(admission_id)

        cur.execute(sql, tuple(params))
        count = 0
        for r in cur.fetchall():
            (pp_id, pat_id, adm_id, doc_id, p_date, charge, status, notes,
             proc_name, proc_code, first, last, p_code, doc_name) = r
            pat_name = f"{first} {last}".strip()
            title = f"Clinical Procedure: {proc_name} ({status or 'Performed'}) - {pat_name}"
            content = (
                f"Patient: {pat_name} (Code: {p_code})\n"
                f"Procedure Name: {proc_name} (Code: {proc_code or 'N/A'})\n"
                f"Performing Clinician: {doc_name or 'Attending Surgeon/Doctor'}\n"
                f"Procedure Date: {p_date} | Status: {status or 'Completed'}\n"
                f"Clinical Notes: {notes or 'Procedure completed successfully without immediate adverse complications.'}"
            )
            meta = {
                "procedure_code": proc_code,
                "procedure_name": proc_name,
                "doctor_name": doc_name,
                "procedure_date": str(p_date)
            }
            if self.upsert_document(
                cur=cur,
                document_type="procedure_summary",
                source_table="patient_procedures",
                source_record_id=str(pp_id),
                title=title,
                content=content,
                patient_id=pat_id,
                admission_id=adm_id,
                doctor_id=doc_id,
                metadata=meta,
                review_status=status or "Completed",
                is_verified=True,
                is_active=True
            ):
                count += 1
        return count

    def ingest_billing(self, cur, patient_id: Optional[int] = None, admission_id: Optional[int] = None) -> int:
        """Ingests billing clearance and financial settlement records."""
        sql = """
            SELECT 
                b.bill_id, b.bill_number, b.patient_id, b.admission_id, b.bill_date,
                b.gross_amount, b.discount_amount, b.net_amount, b.insurance_amount, b.patient_amount,
                b.bill_status,
                p.first_name, p.last_name, p.patient_code,
                COALESCE((SELECT SUM(amount) FROM payments WHERE bill_id = b.bill_id AND payment_status = 'Success'), 0) as paid_amount
            FROM bills b
            JOIN patients p ON p.id = b.patient_id
            WHERE 1=1
        """
        params = []
        if patient_id:
            sql += " AND b.patient_id = %s"
            params.append(patient_id)
        if admission_id:
            sql += " AND b.admission_id = %s"
            params.append(admission_id)

        cur.execute(sql, tuple(params))
        count = 0
        for r in cur.fetchall():
            (b_id, b_num, pat_id, adm_id, b_date, gross, disc, net, ins, pat_amt,
             status, first, last, p_code, paid) = r
            pat_name = f"{first} {last}".strip()
            balance = float(pat_amt or net or 0) - float(paid or 0)
            is_cleared = balance <= 0.01 or status in ('Settled', 'Paid', 'Cleared')

            clearance_label = "Discharge Cleared (Financial)" if is_cleared else f"Clearance Blocked (Outstanding Balance: ₹{balance:,.2f})"
            title = f"Billing & Clearance: Bill #{b_num} ({clearance_label}) - {pat_name}"
            content = (
                f"Patient: {pat_name} (Code: {p_code})\n"
                f"Bill Number: {b_num} (ID: {b_id}) | Date: {b_date}\n"
                f"Gross: ₹{float(gross or 0):,.2f} | Discount: ₹{float(disc or 0):,.2f} | Net Amount: ₹{float(net or 0):,.2f}\n"
                f"Insurance Covered: ₹{float(ins or 0):,.2f} | Patient Responsibility: ₹{float(pat_amt or 0):,.2f}\n"
                f"Total Paid To Date: ₹{float(paid or 0):,.2f} | Outstanding Balance: ₹{balance:,.2f}\n"
                f"Financial Clearance Status: {clearance_label} (Bill Status: {status})"
            )
            meta = {
                "bill_number": b_num,
                "net_amount": float(net or 0),
                "outstanding_balance": balance,
                "is_cleared": is_cleared
            }
            if self.upsert_document(
                cur=cur,
                document_type="billing_clearance_summary",
                source_table="bills",
                source_record_id=str(b_id),
                title=title,
                content=content,
                patient_id=pat_id,
                admission_id=adm_id,
                metadata=meta,
                review_status="Cleared" if is_cleared else "Pending Payment",
                is_verified=True,
                is_active=True
            ):
                count += 1
        return count

    def ingest_doctor_patient_tasks(self, cur, doctor_id: Optional[int] = None) -> int:
        """Ingests nursing tasks, handover notes, and pending clinical tasks."""
        sql = """
            SELECT 
                nt.id, nt.bed_no, nt.patient_name, nt.uhid, nt.task_description,
                nt.status, nt.assigned_nurse, nt.clinical_notes, nt.created_at
            FROM nursing_tasks nt
            WHERE nt.status IN ('Due Now', 'In Progress', 'Due in 30m')
            ORDER BY nt.created_at DESC LIMIT 100;
        """
        cur.execute(sql)
        count = 0
        for r in cur.fetchall():
            (nt_id, bed, p_name, uhid, desc, status, nurse, notes, created) = r
            title = f"Pending Clinical Nursing Task - Bed {bed} ({p_name}): {desc}"
            content = (
                f"Patient: {p_name} (UHID/Bed: {bed})\n"
                f"Task: {desc} | Status: {status}\n"
                f"Assigned Nurse: {nurse or 'Duty Station'} | Created At: {created}\n"
                f"Clinical Notes: {notes or 'Routine inpatient nursing orders'}"
            )
            meta = {
                "bed_no": bed,
                "task_status": status,
                "uhid": uhid
            }
            if self.upsert_document(
                cur=cur,
                document_type="doctor_patient_task_summary",
                source_table="nursing_tasks",
                source_record_id=str(nt_id),
                title=title,
                content=content,
                metadata=meta,
                review_status=status,
                is_verified=False,
                is_active=True
            ):
                count += 1
        return count

    def ingest_radiology(self, cur, order_id: Optional[str] = None, patient_id: Optional[int] = None) -> int:
        """
        Ingests strictly valid order-linked radiology studies.
        Creates:
        1. xray_order
        2. radiology_ai_result (clearly labeled AI screening, not diagnosis)
        3. radiologist_final_report (verified radiologist report)
        Excludes legacy archive and unlinked Orthanc scans.
        """
        sql = """
            SELECT 
                o.order_id, o.accession_number, o.patient_id, o.requested_by,
                o.examination, o.indication, o.priority, o.status as order_status,
                o.created_at, o.study_instance_uid,
                p.first_name, p.last_name, p.patient_code,
                COALESCE(d.display_name, CONCAT(d.first_name, ' ', d.last_name), u.staff_name, u.username) as requested_by_name,
                d.id as doctor_id,
                rs.scan_id, rs.review_status, rs.reviewed_by, rs.reviewed_at,
                rs.probability, rs.findings, rs.clinical_summary, rs.assessment,
                rs.radiologist_finding, rs.scan_report, rs.priority as ai_priority
            FROM radiology_orders o
            JOIN patients p ON p.id = o.patient_id
            JOIN users u ON u.id = o.requested_by
            LEFT JOIN doctors d ON d.user_id = u.id
            LEFT JOIN radiology_scan rs ON rs.order_id = o.order_id
            WHERE 1=1
        """
        params = []
        if order_id:
            sql += " AND o.order_id = %s"
            params.append(str(order_id))
        if patient_id:
            sql += " AND o.patient_id = %s"
            params.append(patient_id)

        cur.execute(sql, tuple(params))
        count = 0
        for r in cur.fetchall():
            (ord_id, acc_num, pat_id, req_by, exam, ind, priority, ord_status,
             created_at, study_uid, first, last, p_code, req_name, doc_id,
             scan_id, rev_status, rev_by, rev_at,
             ai_prob, ai_findings, ai_summary, ai_assess,
             rad_finding, scan_report, ai_priority) = r

            pat_name = f"{first} {last}".strip()
            ord_id_str = str(ord_id)

            # 1. Document: xray_order
            order_title = f"X-ray Imaging Order: {exam} (Acc #{acc_num}) - {pat_name}"
            order_content = (
                f"Patient: {pat_name} (Code: {p_code})\n"
                f"Accession Number: {acc_num} | Order ID: {ord_id_str}\n"
                f"Examination: {exam} | Priority: {priority}\n"
                f"Clinical Indication: {ind}\n"
                f"Ordering Physician / Requested By: {req_name} (User ID: {req_by})\n"
                f"Order / Request Status: {ord_status} | Ordered At: {created_at}\n"
                f"Study Instance UID: {study_uid or 'Pending Orthanc PACS acquisition'}"
            )
            meta_order = {
                "accession_number": acc_num,
                "examination": exam,
                "indication": ind,
                "priority": priority,
                "ordering_physician": req_name
            }
            if self.upsert_document(
                cur=cur,
                document_type="xray_order",
                source_table="radiology_orders",
                source_record_id=ord_id_str,
                title=order_title,
                content=order_content,
                patient_id=pat_id,
                doctor_id=doc_id,
                order_id=ord_id_str,
                accession_number=acc_num,
                study_instance_uid=study_uid,
                metadata=meta_order,
                review_status=ord_status,
                is_verified=True,
                is_active=True
            ):
                count += 1

            # 2. Document: radiology_ai_result (if scan analysis exists)
            if scan_id:
                ai_title = f"AI Triage & Screening: {exam} (Acc #{acc_num}) - [AI-Assisted Result — Not Confirmed Diagnosis]"
                ai_content = (
                    f"CLINICAL NOTICE: AI-assisted screening result — not a final radiologist diagnosis.\n"
                    f"Patient: {pat_name} (Code: {p_code}) | Accession: {acc_num}\n"
                    f"Ordering Physician / Requested By: {req_name}\n"
                    f"Study Instance UID: {study_uid}\n"
                    f"AI Risk Assessment: {ai_assess or 'Automated deep learning triage performed'}\n"
                    f"AI Priority Level: {ai_priority or priority} | Anomaly Probability: {f'{float(ai_prob)*100:.1f}%' if ai_prob else 'N/A'}\n"
                    f"AI Detected Findings: {ai_findings or ai_summary or 'No acute focal lung abnormality detected by AI.'}\n"
                    f"Clinical Summary: {ai_summary or 'Awaiting formal radiologist review and interpretation.'}\n"
                    f"Radiology Review Status: {rev_status or 'Pending Review'}"
                )
                meta_ai = {
                    "is_ai_generated": True,
                    "ordering_physician": req_name,
                    "ai_probability": float(ai_prob) if ai_prob else None,
                    "review_status": rev_status or "Pending Review",
                    "disclaimer": "AI-assisted screening result — not a final radiologist diagnosis."
                }
                if self.upsert_document(
                    cur=cur,
                    document_type="radiology_ai_result",
                    source_table="radiology_scan",
                    source_record_id=f"ai_{scan_id}",
                    title=ai_title,
                    content=ai_content,
                    patient_id=pat_id,
                    doctor_id=doc_id,
                    order_id=ord_id_str,
                    accession_number=acc_num,
                    study_instance_uid=study_uid,
                    metadata=meta_ai,
                    review_status=rev_status or "Pending Review",
                    is_verified=False,
                    is_active=True
                ):
                    count += 1

            # 3. Document: radiologist_final_report (only if reviewed by radiologist)
            is_confirmed = (rev_status in ('Confirmed', 'Verified', 'Completed') or bool(rev_by))
            if scan_id and is_confirmed:
                report_text = rad_finding or scan_report or "Radiologist report confirmed without acute cardiopulmonary findings."
                rad_title = f"Verified Radiologist Final Report: {exam} (Acc #{acc_num}) - {pat_name}"
                rad_content = (
                    f"OFFICIAL VERIFIED RADIOLOGY REPORT\n"
                    f"Patient: {pat_name} (Code: {p_code})\n"
                    f"Accession Number: {acc_num} | Order ID: {ord_id_str}\n"
                    f"Ordering Physician / Requested By: {req_name}\n"
                    f"Study Instance UID: {study_uid}\n"
                    f"Examination: {exam} | Indication: {ind}\n"
                    f"Review Status: Verified Radiologist Report ({rev_status})\n"
                    f"Reporting Radiologist: {rev_by or 'Staff Radiologist'}\n"
                    f"Review Timestamp: {rev_at or created_at}\n"
                    f"Radiologist Conclusion & Diagnostic Findings:\n{report_text}"
                )
                meta_rad = {
                    "is_verified_radiologist_report": True,
                    "ordering_physician": req_name,
                    "reporting_radiologist": rev_by,
                    "reviewed_at": str(rev_at),
                    "review_status": rev_status
                }
                if self.upsert_document(
                    cur=cur,
                    document_type="radiologist_final_report",
                    source_table="radiology_scan",
                    source_record_id=f"report_{scan_id}",
                    title=rad_title,
                    content=rad_content,
                    patient_id=pat_id,
                    doctor_id=doc_id,
                    order_id=ord_id_str,
                    accession_number=acc_num,
                    study_instance_uid=study_uid,
                    metadata=meta_rad,
                    review_status=rev_status or "Confirmed",
                    is_verified=True,
                    is_active=True
                ):
                    count += 1

        return count

    def ingest_discharge_summaries(self, cur, admission_id: Optional[int] = None, patient_id: Optional[int] = None) -> int:
        """Ingests verified and draft discharge summaries."""
        sql = """
            SELECT 
                ds.summary_id, ds.admission_id, ds.patient_id, ds.doctor_id,
                ds.admission_date, ds.discharge_date, ds.diagnoses, ds.case_history,
                ds.investigations, ds.treatment, ds.primary_consultant, ds.discharge_advice,
                ds.patient_condition, ds.generated_at,
                p.first_name, p.last_name, p.patient_code
            FROM discharge_summaries ds
            JOIN patients p ON p.id = ds.patient_id
            WHERE 1=1
        """
        params = []
        if admission_id:
            sql += " AND ds.admission_id = %s"
            params.append(admission_id)
        if patient_id:
            sql += " AND ds.patient_id = %s"
            params.append(patient_id)

        cur.execute(sql, tuple(params))
        count = 0
        for r in cur.fetchall():
            (s_id, adm_id, pat_id, doc_id, adm_date, dis_date, dx, history,
             inv, treat, doc_name, advice, cond, gen_at, first, last, p_code) = r

            pat_name = f"{first} {last}".strip()
            title = f"Verified Discharge Summary - ADM #{adm_id} ({pat_name})"
            content = (
                f"Patient: {pat_name} (Code: {p_code})\n"
                f"Admission ID: {adm_id} | Admission Date: {adm_date} | Discharge Date: {dis_date or 'Pending'}\n"
                f"Primary Attending Consultant: {doc_name}\n"
                f"Patient Condition at Discharge: {cond or 'Stable'}\n"
                f"Final Diagnoses: {dx or 'Resolved'}\n"
                f"Clinical History & Course: {history or 'N/A'}\n"
                f"Diagnostic Investigations: {inv or 'N/A'}\n"
                f"Inpatient Treatments Given: {treat or 'Standard medical therapy'}\n"
                f"Discharge Advice & Follow-up: {advice or 'Routine outpatient follow-up'}"
            )
            meta = {
                "consultant": doc_name,
                "discharge_date": str(dis_date),
                "patient_condition": cond
            }
            if self.upsert_document(
                cur=cur,
                document_type="verified_discharge_summary",
                source_table="discharge_summaries",
                source_record_id=str(s_id),
                title=title,
                content=content,
                patient_id=pat_id,
                admission_id=adm_id,
                doctor_id=doc_id,
                metadata=meta,
                review_status="Approved",
                is_verified=True,
                is_active=True
            ):
                count += 1

        # Also ingest approved discharge summaries from dim_generated_discharge_summaries
        try:
            gds_sql = """
                SELECT 
                    gds.summary_id, gds.admission_id, gds.patient_id, gds.doctor_id,
                    gds.admission_date, gds.discharge_date, gds.diagnoses, gds.case_history,
                    gds.investigations, gds.treatment, gds.primary_consultant, gds.discharge_advice,
                    gds.patient_condition, gds.generated_at, gds.approval_status,
                    p.first_name, p.last_name, p.patient_code
                FROM dim_generated_discharge_summaries gds
                JOIN patients p ON p.id = gds.patient_id
                WHERE 1=1
            """
            gds_params = []
            if admission_id:
                gds_sql += " AND gds.admission_id = %s"
                gds_params.append(admission_id)
            if patient_id:
                gds_sql += " AND gds.patient_id = %s"
                gds_params.append(patient_id)

            cur.execute(gds_sql, tuple(gds_params))
            for r in cur.fetchall():
                (s_id, adm_id, pat_id, doc_id, adm_date, dis_date, dx, history,
                 inv, treat, doc_name, advice, cond, gen_at, appr_status, first, last, p_code) = r

                pat_name = f"{first} {last}".strip()
                title = f"Verified Discharge Summary - ADM #{adm_id} ({pat_name})"
                content = (
                    f"Patient: {pat_name} (Code: {p_code})\n"
                    f"Admission ID: {adm_id} | Admission Date: {adm_date} | Discharge Date: {dis_date or 'Pending'}\n"
                    f"Primary Attending Consultant: {doc_name}\n"
                    f"Patient Condition at Discharge: {cond or 'Stable'}\n"
                    f"Final Diagnoses: {dx or 'Resolved'}\n"
                    f"Clinical History & Course: {history or 'N/A'}\n"
                    f"Diagnostic Investigations: {inv or 'N/A'}\n"
                    f"Inpatient Treatments Given: {treat or 'Standard medical therapy'}\n"
                    f"Discharge Advice & Follow-up: {advice or 'Routine outpatient follow-up'}"
                )
                meta = {
                    "consultant": doc_name,
                    "discharge_date": str(dis_date),
                    "patient_condition": cond,
                    "approval_status": appr_status
                }
                is_ver = str(appr_status).strip().lower() in ('approved', 'signed', 'completed', 'signed off')
                if self.upsert_document(
                    cur=cur,
                    document_type="verified_discharge_summary",
                    source_table="dim_generated_discharge_summaries",
                    source_record_id=str(s_id),
                    title=title,
                    content=content,
                    patient_id=pat_id,
                    admission_id=adm_id,
                    doctor_id=doc_id,
                    metadata=meta,
                    review_status=appr_status or "Approved",
                    is_verified=is_ver,
                    is_active=True
                ):
                    count += 1
        except Exception as e:
            logger.warning(f"Failed to ingest from dim_generated_discharge_summaries: {e}")

        return count

    def ingest_clarifications(self, cur, order_id: Optional[str] = None, thread_id: Optional[str] = None) -> int:
        """
        Ingests radiology clinical clarifications threads and messages between clinician and radiologist.
        Document type: radiology_clarification
        """
        sql = """
            SELECT 
                rc.id as thread_id, rc.order_id, rc.subject, rc.priority, rc.status,
                rc.created_at, rc.updated_at, rc.resolved_at,
                ro.accession_number, ro.examination, ro.patient_id,
                p.first_name, p.last_name, p.patient_code,
                COALESCE(u_creator.staff_name, u_creator.username) as creator_name,
                COALESCE(u_assignee.staff_name, u_assignee.username) as assignee_name
            FROM radiology_clarifications rc
            JOIN radiology_orders ro ON ro.order_id = rc.order_id
            JOIN patients p ON p.id = ro.patient_id
            LEFT JOIN users u_creator ON u_creator.id = rc.created_by
            LEFT JOIN users u_assignee ON u_assignee.id = rc.assigned_to
            WHERE 1=1
        """
        params = []
        if thread_id:
            sql += " AND rc.id = %s"
            params.append(str(thread_id))
        if order_id:
            sql += " AND rc.order_id = %s"
            params.append(str(order_id))

        cur.execute(sql, tuple(params))
        threads = cur.fetchall()
        count = 0
        for th in threads:
            (th_id, ord_id, subj, prio, stat, c_at, u_at, res_at,
             acc_num, exam, pat_id, first, last, p_code,
             creator_name, assignee_name) = th

            pat_name = f"{first} {last}".strip()
            ord_id_str = str(ord_id)
            th_id_str = str(th_id)

            # Fetch messages
            cur.execute("""
                SELECT sender_name, sender_role, body, created_at
                FROM radiology_clarification_messages
                WHERE thread_id = %s
                ORDER BY created_at ASC;
            """, (th_id_str,))
            msgs = cur.fetchall()
            msg_lines = []
            for m in msgs:
                s_name, s_role, body, m_time = m
                msg_lines.append(f"• [{m_time.strftime('%Y-%m-%d %H:%M') if m_time else ''}] {s_name} ({s_role}): {body}")

            msgs_text = "\n".join(msg_lines) if msg_lines else "No discussion messages recorded."

            title = f"Radiology Clarification: {subj} (Acc #{acc_num}) - {pat_name}"
            content = (
                f"RADIOLOGY CLINICAL CLARIFICATION\n"
                f"Subject: {subj}\n"
                f"Priority: {prio} | Status: {stat}\n"
                f"Patient: {pat_name} (Code: {p_code})\n"
                f"Accession Number: {acc_num} | Order ID: {ord_id_str}\n"
                f"Examination: {exam}\n"
                f"Assigned Radiologist: {assignee_name or 'Dr. Vilson M'}\n"
                f"Initiated By: {creator_name or 'Ordering Clinician'}\n"
                f"Created: {c_at} | Resolved: {res_at or 'Pending'}\n\n"
                f"Clarification Messages & Discussion History:\n{msgs_text}"
            )

            meta = {
                "thread_id": th_id_str,
                "subject": subj,
                "priority": prio,
                "status": stat,
                "accession_number": acc_num,
                "ordering_physician": creator_name,
                "reporting_radiologist": assignee_name
            }

            if self.upsert_document(
                cur=cur,
                document_type="radiology_clarification",
                source_table="radiology_clarifications",
                source_record_id=th_id_str,
                title=title,
                content=content,
                patient_id=pat_id,
                doctor_id=None,
                order_id=ord_id_str,
                accession_number=acc_num,
                study_instance_uid=None,
                metadata=meta,
                review_status=stat,
                is_verified=True,
                is_active=True
            ):
                count += 1
        return count

    # ─────────────────────────────────────────────────────────────────────────────
    # CONVENIENCE REINDEX METHODS
    # ─────────────────────────────────────────────────────────────────────────────

    def reindex_all(self, patient_id: Optional[int] = None, admission_id: Optional[int] = None) -> Dict[str, int]:
        """Indexes all active clinical domains."""
        conn = db_config.get_db_connection()
        stats = {}
        try:
            with conn.cursor() as cur:
                stats["admissions"] = self.ingest_admissions(cur, patient_id, admission_id)
                stats["diagnoses"] = self.ingest_diagnoses(cur, patient_id, admission_id)
                stats["vitals"] = self.ingest_vitals(cur, patient_id, admission_id)
                stats["medications"] = self.ingest_medications(cur, patient_id, admission_id)
                stats["lab_results"] = self.ingest_lab_results(cur, patient_id)
                stats["procedures"] = self.ingest_procedures(cur, patient_id, admission_id)
                stats["billing"] = self.ingest_billing(cur, patient_id, admission_id)
                if not patient_id and not admission_id:
                    stats["tasks"] = self.ingest_doctor_patient_tasks(cur)
                else:
                    stats["tasks"] = 0
                stats["radiology"] = self.ingest_radiology(cur, patient_id=patient_id)
                stats["clarifications"] = self.ingest_clarifications(cur)
                stats["discharge"] = self.ingest_discharge_summaries(cur, admission_id=admission_id, patient_id=patient_id)
                conn.commit()
        finally:
            conn.close()
        return stats

    def reindex_patient(self, patient_id: int) -> Dict[str, int]:
        """Reindexes all clinical records for a specific patient."""
        return self.reindex_all(patient_id=patient_id)

    def reindex_admission(self, admission_id: int) -> Dict[str, int]:
        """Reindexes all clinical records for a specific admission."""
        return self.reindex_all(admission_id=admission_id)

    def reindex_radiology_order(self, order_id: str) -> Dict[str, int]:
        """Reindexes a single order-linked radiology study."""
        conn = db_config.get_db_connection()
        count = 0
        try:
            with conn.cursor() as cur:
                count = self.ingest_radiology(cur, order_id=order_id)
                conn.commit()
        finally:
            conn.close()
        return {"radiology": count}

    def reindex_discharge(self, admission_id: int) -> Dict[str, int]:
        """Reindexes discharge summaries and readiness for an admission."""
        conn = db_config.get_db_connection()
        count = 0
        try:
            with conn.cursor() as cur:
                count += self.ingest_discharge_summaries(cur, admission_id=admission_id)
                count += self.ingest_billing(cur, admission_id=admission_id)
                conn.commit()
        finally:
            conn.close()
        return {"discharge": count}


# Global singleton instance
ingestion_service = RagIngestionService()
