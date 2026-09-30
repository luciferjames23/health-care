import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.rag_access_control import (
    ACCESS_DENIED, AccessContext, DOCUMENT_MODULE, RADIOLOGY_MODULES,
    build_access_context, filter_sources,
)
from routers.rag import _guard_generated_answer
from services.rag_search_service import RagSearchService


class FakeCursor:
    def __init__(self, doctor_row=None, patient_rows=()):
        self.doctor_row = doctor_row
        self.patient_rows = list(patient_rows)
        self.last_sql = ""

    def execute(self, sql, params):
        self.last_sql = sql

    def fetchone(self):
        if "FROM users u JOIN roles" in self.last_sql:
            return {"id": 7, "is_active": True, "role": "doctor", "department": "Cardiology", "doctor_id": 42}
        return self.doctor_row

    def fetchall(self):
        return self.patient_rows

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class FakeConnection:
    def __init__(self, cursor):
        self.cursor_value = cursor

    def cursor(self, **kwargs):
        return self.cursor_value

    def close(self):
        pass


class AccessBoundaryTests(unittest.TestCase):
    def test_operational_intent_matrix_is_deterministic(self):
        service = RagSearchService()
        cases = [
            ("how many ip", "doctor_workspace", "doctor", "doctor_flow", {"ip"}),
            ("IP count", "doctor_workspace", "doctor", "doctor_flow", {"ip"}),
            ("how many op", "doctor_workspace", "doctor", "doctor_flow", {"op"}),
            ("how many IP and OP count", "doctor_workspace", "doctor", "doctor_flow", {"ip", "op"}),
            ("total patients", "doctor_workspace", "doctor", "doctor_flow", {"ip", "op", "discharged", "er"}),
            ("list the IP patient list", "doctor_workspace", "doctor", "doctor_patient_list", {"ip", "names"}),
            ("list patient basic details", "doctor_workspace", "doctor", "doctor_patient_list", {"ip", "names", "basic"}),
            ("Which patients are blocked from discharge?", "doctor_workspace", "doctor", "doctor_patient_list", {"ip", "blocked_discharge", "names"}),
            ("any OP", "doctor_workspace", "doctor", "doctor_op_list", {"op", "names"}),
            ("OP patients under me", "doctor_workspace", "doctor", "doctor_op_list", {"op", "names"}),
            ("op", "doctor_workspace", "doctor", "doctor_op_list", {"op", "names"}),
            ("discharged patients", "doctor_workspace", "doctor", "doctor_discharged_list", {"discharged", "names"}),
            ("discharged patient list", "doctor_workspace", "doctor", "doctor_discharged_list", {"discharged", "names"}),
            ("how many requests received", "radiology", "radiologist", "radiology_aggregate", {"total"}),
            ("how many urget and routine", "radiology", "radiologist", "radiology_aggregate", {"total", "priority"}),
            ("categorize the xray request", "radiology", "radiologist", "radiology_aggregate", {"total", "priority"}),
            ("from which department", "radiology", "radiologist", "radiology_aggregate", {"department"}),
            ("requsts was raised from which department", "radiology", "radiologist", "radiology_aggregate", {"department"}),
        ]
        for question, area, role, expected_kind, expected_dimensions in cases:
            with self.subTest(question=question):
                kind, dimensions = service._plan(question, area, role)
                self.assertEqual(kind, expected_kind)
                self.assertEqual(dimensions, expected_dimensions)

    def test_doctor_context_uses_token_doctor_and_assigned_patients(self):
        cur = FakeCursor(patient_rows=[{"patient_id": 10}, {"patient_id": 11}])
        ctx = build_access_context({"user_id": 7, "role": "DOCTOR", "doctor_id": 42}, cur)
        self.assertEqual(ctx.doctor_id, 42)
        self.assertEqual(ctx.allowed_patient_ids, frozenset({10, 11}))
        self.assertIn("WHERE doctor_id = %s", cur.last_sql)

    def test_doctor_guard_rejects_another_doctors_patient(self):
        ctx = AccessContext(7, "doctor", 42, None, frozenset(DOCUMENT_MODULE.values()), frozenset({10}))
        sources = [
            {"document_type": "diagnosis_summary", "patient_id": 10},
            {"document_type": "diagnosis_summary", "patient_id": 99},
        ]
        self.assertEqual([10], [s["patient_id"] for s in filter_sources(ctx, sources)])

    def test_doctor_360_keeps_all_permitted_modules(self):
        ctx = AccessContext(7, "doctor", 42, None, frozenset(DOCUMENT_MODULE.values()), frozenset({10}))
        sources = [{"document_type": kind, "patient_id": 10} for kind in (
            "patient_admission_summary", "vital_trend_summary", "lab_result_summary",
            "diagnosis_summary", "billing_clearance_summary", "verified_discharge_summary",
        )]
        self.assertEqual(len(sources), len(filter_sources(ctx, sources)))

    def test_radiologist_guard_keeps_only_radiology(self):
        ctx = AccessContext(8, "radiologist", None, "radiology", RADIOLOGY_MODULES, None)
        sources = [
            {"document_type": "xray_order", "patient_id": 10, "metadata": {"department": "radiology"}},
            {"document_type": "billing_clearance_summary", "patient_id": 10},
        ]
        self.assertEqual(["xray_order"], [s["document_type"] for s in filter_sources(ctx, sources)])

    def test_admin_keeps_everything(self):
        ctx = AccessContext(1, "admin", None, None, None, None)
        sources = [{"document_type": "billing_clearance_summary", "patient_id": 99}]
        self.assertEqual(sources, filter_sources(ctx, sources))

    def test_other_role_fails_closed_without_permission_matrix(self):
        class BillingCursor(FakeCursor):
            def fetchone(self):
                if "FROM users u JOIN roles" in self.last_sql:
                    return {"id": 9, "is_active": True, "role": "billing", "department": "Finance", "doctor_id": None}
                return None
        with self.assertRaisesRegex(PermissionError, "access"):
            build_access_context({"user_id": 9, "role": "billing"}, BillingCursor())

    def test_output_citation_guard_blocks_unretrieved_record(self):
        self.assertIn("records you have access to", _guard_generated_answer("Secret [Record #99]", [{"id": 1}]))
        self.assertEqual("Allowed [Record #1]", _guard_generated_answer("Allowed [Record #1]", [{"id": 1}]))

    def test_count_query_uses_full_authorized_aggregate_not_top_k(self):
        cursor = FakeCursor(doctor_row={"total": 14, "urgent": 5, "routine": 9})
        context = AccessContext(1, "admin", None, None, None, None)
        with patch("services.rag_search_service.db_config.get_db_connection", return_value=FakeConnection(cursor)):
            sources, strategy = RagSearchService()._secure_search(
                "how many requests received", "radiology", context,
                None, None, None, None, None, 8,
            )
        self.assertEqual(strategy, "authorized_sql_aggregate")
        self.assertEqual(sources[0]["metadata"]["total"], 14)
        self.assertEqual(sources[0]["content"], "Total X-ray requests: 14.")

    def test_priority_breakdown_handles_typo_and_categorize_wording(self):
        context = AccessContext(1, "admin", None, None, None, None)
        for question in ("how many urget and routine", "categorize the xray request"):
            cursor = FakeCursor(
                doctor_row={"total": 14},
                patient_rows=[{"label": "Routine", "total": 9}, {"label": "Urgent", "total": 5}],
            )
            with self.subTest(question=question), patch(
                "services.rag_search_service.db_config.get_db_connection",
                return_value=FakeConnection(cursor),
            ):
                sources, strategy = RagSearchService()._secure_search(
                    question, "radiology", context, None, None, None, None, None, 8,
                )
            self.assertEqual(strategy, "authorized_sql_aggregate")
            self.assertEqual(sources[0]["metadata"]["total"], 14)
            self.assertEqual(sources[0]["metadata"]["priority"], [
                {"label": "Routine", "total": 9}, {"label": "Urgent", "total": 5}
            ])

    def test_radiology_department_followup_uses_full_authorized_aggregate(self):
        cursor = FakeCursor(doctor_row={"total": 14}, patient_rows=[{"label": "Cardiology", "total": 14}])
        context = AccessContext(1, "admin", None, None, None, None)
        with patch("services.rag_search_service.db_config.get_db_connection", return_value=FakeConnection(cursor)):
            sources, strategy = RagSearchService()._secure_search(
                "requsts was raised from which department", "radiology", context,
                None, None, None, None, None, 8,
            )
        self.assertEqual(strategy, "authorized_sql_aggregate")
        self.assertEqual(sources[0]["metadata"]["department"], [
            {"label": "Cardiology", "total": 14}
        ])

    def test_doctor_ip_count_matches_authorized_roster_not_semantic_chunks(self):
        class DoctorCountCursor(FakeCursor):
            def fetchone(self):
                if "SELECT display_name" in self.last_sql:
                    return {"display_name": "Dr. Priya Patel"}
                return {"total": 14}

        cursor = DoctorCountCursor()
        context = AccessContext(1, "doctor", 1, "cardiology", frozenset(DOCUMENT_MODULE.values()), frozenset({10}))
        with patch("services.rag_search_service.db_config.get_db_connection", return_value=FakeConnection(cursor)):
            sources, strategy = RagSearchService()._secure_search(
                "how many IP patient", "doctor_workspace", context,
                None, None, None, None, None, 8,
            )
        self.assertEqual(strategy, "authorized_sql_aggregate")
        self.assertEqual(sources[0]["metadata"]["ip"], 14)
        self.assertEqual(filter_sources(context, sources), sources)

    def test_doctor_op_count_uses_scoped_appointments(self):
        class OpCursor(FakeCursor):
            def fetchone(self):
                if "SELECT display_name" in self.last_sql:
                    return {"display_name": "Dr. Priya Patel"}
                return {"total": 12}
        cursor = OpCursor()
        context = AccessContext(1, "doctor", 1, "cardiology", frozenset(DOCUMENT_MODULE.values()), frozenset({10}))
        with patch("services.rag_search_service.db_config.get_db_connection", return_value=FakeConnection(cursor)):
            sources, strategy = RagSearchService()._secure_search(
                "how many op", "doctor_workspace", context,
                None, None, None, None, None, 8,
            )
        self.assertEqual(strategy, "authorized_sql_aggregate")
        self.assertEqual(sources[0]["metadata"]["op"], 12)
        self.assertEqual(filter_sources(context, sources), sources)

    def test_doctor_combined_ip_op_count_does_not_short_circuit_to_op(self):
        class FlowCursor(FakeCursor):
            def __init__(self):
                super().__init__()
                self.count_query_number = 0

            def fetchone(self):
                if "SELECT display_name" in self.last_sql:
                    return {"display_name": "Dr. Priya Patel"}
                self.count_query_number += 1
                return {"total": 14 if self.count_query_number == 1 else 3}

        cursor = FlowCursor()
        context = AccessContext(1, "doctor", 1, "cardiology", frozenset(DOCUMENT_MODULE.values()), frozenset({10}))
        with patch("services.rag_search_service.db_config.get_db_connection", return_value=FakeConnection(cursor)):
            sources, strategy = RagSearchService()._secure_search(
                "how many IP and OP count", "doctor_workspace", context,
                None, None, None, None, None, 8,
            )
        self.assertEqual(strategy, "authorized_sql_aggregate")
        self.assertEqual(sources[0]["metadata"]["ip"], 14)
        self.assertEqual(sources[0]["metadata"]["op"], 3)
        self.assertIn("IP: 14", sources[0]["content"])
        self.assertIn("OP: 3", sources[0]["content"])


    def test_patient_specific_radiology_query_does_not_route_to_worklist(self):
        service = RagSearchService()
        # With patient_id provided, must not route to multi-patient worklist
        kind, dims = service._plan("is there any radiology is available for Muruganel Parthalan", "doctor_workspace", "doctor", patient_id=87241)
        self.assertEqual(kind, "documents")
        self.assertNotEqual(kind, "doctor_radiology_worklist")
        # Without patient_id, worklist queries still route correctly
        kind, dims = service._plan("urgent xrays", "doctor_workspace", "doctor", patient_id=None)
        self.assertEqual(kind, "doctor_radiology_worklist")
        self.assertIn("urgent", dims)
        kind, dims = service._plan("radiology worklist", "doctor_workspace", "doctor", patient_id=None)
        self.assertEqual(kind, "doctor_radiology_worklist")

    def test_guard_normalizes_cjk_citation_brackets(self):
        sources = [{"id": 59, "patient_id": 87241}]
        answer = "Chest X-ray verified 【Record #59】"
        guarded = _guard_generated_answer(answer, sources)
        self.assertEqual(guarded, "Chest X-ray verified [Record #59]")

    def test_doctor_discharged_patient_list_returns_discharged_cohort(self):
        class DischargedCursor(FakeCursor):
            def fetchone(self):
                return {"display_name": "Dr. Priya Patel"}

            def fetchall(self):
                return [{
                    "patient_id": 87226,
                    "patient_code": "MER-PAT-0087226",
                    "first_name": "Rohiter",
                    "last_name": "Parthalan",
                    "gender": "Male",
                    "primary_diagnosis": "Cholelithiasis",
                    "discharge_status": "Discharged",
                    "bill_clearance_status": "Cleared",
                    "outstanding_balance": 0.0,
                }]

        cursor = DischargedCursor()
        context = AccessContext(1, "doctor", 1, "cardiology", frozenset(DOCUMENT_MODULE.values()), frozenset({87226}))
        with patch("services.rag_search_service.db_config.get_db_connection", return_value=FakeConnection(cursor)):
            sources, strategy = RagSearchService()._secure_search(
                "discharged patients", "doctor_workspace", context,
                None, None, None, None, None, 8,
            )
        self.assertEqual(strategy, "authorized_sql_list")
        self.assertEqual(sources[0]["metadata"]["cohort"], "discharged")
        self.assertIn("Rohiter Parthalan", sources[0]["content"])
        self.assertIn("Discharged patients (1):", sources[0]["content"])

    def test_doctor_op_patient_list_returns_op_cohort(self):
        class OpListCursor(FakeCursor):
            def fetchone(self):
                return {"display_name": "Dr. Priya Patel"}

            def fetchall(self):
                return [{
                    "patient_id": 105453,
                    "patient_code": "PAT-105453",
                    "first_name": "Patient",
                    "last_name": "#105453",
                    "gender": "Female",
                    "appointment_date": "2026-09-16",
                    "appointment_time": "10:00",
                    "status": "Completed",
                    "booking_id": "BKG-105452",
                    "reason": "General Consultation",
                }]

        cursor = OpListCursor()
        context = AccessContext(1, "doctor", 1, "cardiology", frozenset(DOCUMENT_MODULE.values()), frozenset({105453}))
        with patch("services.rag_search_service.db_config.get_db_connection", return_value=FakeConnection(cursor)):
            sources, strategy = RagSearchService()._secure_search(
                "OP patients under me", "doctor_workspace", context,
                None, None, None, None, None, 8,
            )
        self.assertEqual(strategy, "authorized_sql_list")
        self.assertEqual(sources[0]["metadata"]["cohort"], "op")
        self.assertIn("Patient #105453", sources[0]["content"])
        self.assertIn("Outpatient (OP) patients (1):", sources[0]["content"])

    def test_cross_doctor_query_raises_access_denied(self):
        class CrossDoctorCursor(FakeCursor):
            def fetchall(self):
                if "SELECT id, display_name, first_name, last_name FROM doctors" in self.last_sql:
                    return [
                        {"id": 1, "display_name": "Dr. Priya Patel", "first_name": "Priya", "last_name": "Patel"},
                        {"id": 2, "display_name": "Dr. Ravi Reddy", "first_name": "Ravi", "last_name": "Reddy"},
                    ]
                return []

        cursor = CrossDoctorCursor()
        context = AccessContext(1, "doctor", 1, "cardiology", frozenset(DOCUMENT_MODULE.values()), frozenset({10}))
        service = RagSearchService()
        with patch("services.rag_search_service.db_config.get_db_connection", return_value=FakeConnection(cursor)):
            with self.assertRaises(PermissionError) as ctx:
                service._secure_search(
                    "Dr.ravi reddy OP patients", "doctor_workspace", context,
                    None, None, None, None, None, 8
                )
            self.assertEqual(str(ctx.exception), ACCESS_DENIED)

    def test_unavailable_modality_reports_not_available(self):
        from services.rag_generation_service import generation_service
        # Non-radiology sources for a patient
        sources = [
            {"id": 101, "document_type": "diagnosis_summary", "title": "Clinical Diagnosis: Asthma", "content": "Asthma", "is_verified": True, "review_status": "Current", "relevance_score": 0.8},
            {"id": 102, "document_type": "vital_trend_summary", "title": "Vital Signs", "content": "BP: 120/80", "is_verified": True, "review_status": "Current", "relevance_score": 0.7},
        ]
        res = generation_service.generate_answer(
            question="What did the latest chest X-ray show?",
            area="doctor_workspace",
            role="doctor",
            sources=sources,
            patient_context={"patient_id": 94}
        )
        self.assertIn("Chest X-ray records are not available for this patient.", res["answer"])
        self.assertNotIn("Asthma", res["answer"])

    def test_why_still_admitted_synthesizes_clinical_reasons(self):
        from services.rag_generation_service import generation_service
        sources = [
            {"id": 1, "document_type": "patient_admission_summary", "title": "Inpatient Admission Summary", "content": "Reason for Admission: Asthma\nDischarge Status: Admitted\nAdmission Date: 2026-03-16", "is_verified": True, "review_status": "Current", "relevance_score": 0.9},
            {"id": 2, "document_type": "diagnosis_summary", "title": "Clinical Diagnosis: Bronchial Asthma", "content": "Bronchial Asthma", "is_verified": True, "review_status": "Current", "relevance_score": 0.8},
            {"id": 3, "document_type": "vital_trend_summary", "title": "Vital Signs", "content": "Vitals: Temp: 99.44 F, SpO2: 90.48%\nAlert Flags: Low Oxygen Saturation", "is_verified": True, "review_status": "Current", "relevance_score": 0.7},
        ]
        res = generation_service.generate_answer(
            question="Why is this patient still admitted?",
            area="doctor_workspace",
            role="doctor",
            sources=sources,
            patient_context={"patient_id": 94}
        )
        self.assertIn("Clinical Reason & Active Admission Status", res["answer"])
        self.assertIn("Reason for Admission: Asthma", res["answer"])
        self.assertIn("Active Condition", res["answer"])

    def test_discharge_readiness_synthesizes_readiness_status(self):
        from services.rag_generation_service import generation_service
        sources = [
            {"id": 1, "document_type": "verified_discharge_summary", "title": "Verified Discharge Summary", "content": "Admission ID: 93\nDischarge Date: 2026-03-19\nPrimary Attending Consultant: Dr. Vikram Singh\nPatient Condition at Discharge: Stable.", "is_verified": True, "review_status": "Current", "relevance_score": 0.9},
            {"id": 2, "document_type": "billing_clearance_summary", "title": "Billing & Clearance", "content": "Financial Clearance Status: Discharge Cleared (Financial) (Bill Status: Settled)", "is_verified": True, "review_status": "Current", "relevance_score": 0.8},
            {"id": 3, "document_type": "vital_trend_summary", "title": "Vital Signs", "content": "Vitals: Temp: 98.6 F, HR: 80 bpm", "is_verified": True, "review_status": "Current", "relevance_score": 0.7},
        ]
        res = generation_service.generate_answer(
            question="is this patient ready to discharge",
            area="doctor_workspace",
            role="doctor",
            sources=sources,
            patient_context={"patient_id": 94}
        )
        ans_lower = res["answer"].lower()
        self.assertTrue("ready" in ans_lower or "readiness" in ans_lower or "discharge" in ans_lower)
        self.assertTrue("record #1" in ans_lower or "record #2" in ans_lower or "record #3" in ans_lower)

    def test_draft_discharge_summary_synthesizes_draft(self):
        from services.rag_generation_service import generation_service
        sources = [
            {"id": 1, "document_type": "patient_admission_summary", "title": "Inpatient Admission Summary", "content": "Patient: Ananden Narayanan (Code: MER-PAT-0000094, Age: 68, Gender: Male, Blood Group: A+)\nAdmission ID: 93\nAdmission Date: 2026-03-16 12:00:00\nAttending Doctor: Dr. Gaurav Singh\nReason for Admission: Asthma", "is_verified": True, "review_status": "Current", "relevance_score": 0.9},
            {"id": 2, "document_type": "verified_discharge_summary", "title": "Verified Discharge Summary", "content": "Admission ID: 93\nDischarge Date: 2026-03-19\nPatient Condition at Discharge: Vitals at Discharge - HR: 84 bpm, BP: 112/84 mmHg. Condition: Stable.\nFinal Diagnoses: 1. Acute Severe Asthma\nClinical History & Course: Patient presented to ER with severe breathlessness.\nInpatient Treatments Given: Continuous nebulizations and IV corticosteroids.\nDischarge Advice & Follow-up: Avoid dust, smoke, and cold allergens.", "is_verified": True, "review_status": "Current", "relevance_score": 0.85},
            {"id": 3, "document_type": "medication_summary", "title": "Medication Order: Amoxicillin 500mg", "content": "Prescribed Medication: Amoxicillin 500mg", "is_verified": True, "review_status": "Current", "relevance_score": 0.8},
            {"id": 4, "document_type": "billing_clearance_summary", "title": "Billing & Clearance", "content": "Financial Clearance Status: Discharge Cleared (Financial)", "is_verified": True, "review_status": "Current", "relevance_score": 0.75},
        ]
        res = generation_service.generate_answer(
            question="Draft a discharge summary based on verified records.",
            area="discharge",
            role="doctor",
            sources=sources,
            patient_context={"patient_id": 94}
        )
        ans = res["answer"]
        self.assertTrue("draft" in ans.lower())
        self.assertTrue("pending clinician approval" in ans.lower() or "draft discharge summary" in ans.lower())
        self.assertIn("Ananden Narayanan", ans)
        self.assertIn("Asthma", ans)
        self.assertIn("Amoxicillin", ans)
        self.assertTrue("cleared" in ans.lower() or "settled" in ans.lower())

    def test_guard_generated_answer_matches_patient_codes(self):
        from routers.rag import _guard_generated_answer
        sources = [
            {"id": 1, "patient_id": 94, "metadata": {"patient_code": "MER-PAT-0000094"}},
            {"id": 2, "patient_id": 94, "metadata": {"patient_code": "MER-PAT-0000094"}}
        ]
        answer = "Patient: Ananden Narayanan (ID: MER-PAT-0000094) condition is stable. [Record #1]"
        guarded = _guard_generated_answer(answer, sources)
        self.assertEqual(guarded, answer)

    def test_pending_amount_query_does_not_filter_out_bills(self):
        from services.rag_query_expansion import query_expansion_service
        exp = query_expansion_service.expand_query("pending amount", "discharge", "doctor", 94)
        self.assertIsNone(exp.get("status_filter"))
        self.assertEqual(exp.get("intent"), "DISCHARGE_READINESS_QUERY")

    def test_pending_amount_synthesizes_billing_status(self):
        from services.rag_generation_service import generation_service
        sources = [
            {
                "id": 72005,
                "document_type": "billing_clearance_summary",
                "title": "Billing & Clearance: Bill #MER-BIL-0272341 (Discharge Cleared (Financial))",
                "content": "Bill Number: MER-BIL-0272341\nGross: ₹800.00\nNet Amount: ₹800.00\nTotal Paid To Date: ₹0.00 | Outstanding Balance: ₹800.00\nFinancial Clearance Status: Discharge Cleared (Financial)",
                "is_verified": True,
                "review_status": "Cleared",
                "relevance_score": 0.88,
            }
        ]
        res = generation_service.generate_answer(
            question="pending amount",
            area="discharge",
            role="doctor",
            sources=sources,
            patient_context={"patient_id": 94}
        )
        self.assertIn("Billing & Financial Clearance Status", res["answer"])
        self.assertIn("Outstanding Balance: ₹800.00", res["answer"])
        self.assertIn("Record #72005", res["answer"])

    def test_diagnosis_list_synthesizes_all_diagnoses(self):
        from services.rag_generation_service import generation_service
        sources = [
            {
                "id": 71985,
                "document_type": "diagnosis_summary",
                "title": "Clinical Diagnosis: Acute Febrile Illness (High Fever) (Primary Diagnosis) - Murugan Ranganlan",
                "content": "Patient: Murugan Ranganlan\nDiagnosis: Acute Febrile Illness (High Fever) (ICD Code: D-0)\nClassification: Primary Diagnosis (Type: Primary)\nDiagnosis Date: 2024-09-21 10:00:00\nAttending/Diagnosing Physician: Dr. Ishita Patel",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.95,
            },
            {
                "id": 71986,
                "document_type": "diagnosis_summary",
                "title": "Clinical Diagnosis: Preterm Labor Complication (Primary Diagnosis) - Murugan Ranganlan",
                "content": "Patient: Murugan Ranganlan\nDiagnosis: Preterm Labor Complication (ICD Code: D-7)\nClassification: Primary Diagnosis (Type: Primary)\nDiagnosis Date: 2026-07-04 10:00:00\nAttending/Diagnosing Physician: Dr. Namrata Gupta",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.94,
            },
        ]
        res = generation_service.generate_answer(
            question="diagnosis list",
            area="patient360",
            role="doctor",
            sources=sources,
            patient_context={"patient_id": 87361}
        )
        self.assertIn("Clinical Diagnoses", res["answer"])
        self.assertIn("Acute Febrile Illness", res["answer"])
        self.assertIn("Preterm Labor Complication", res["answer"])
        self.assertIn("Record #71985", res["answer"])
        self.assertIn("Record #71986", res["answer"])

    def test_diagnosis_details_with_results_synthesizes_categorized_sections(self):
        from services.rag_generation_service import generation_service
        sources = [
            {
                "id": 71985,
                "document_type": "diagnosis_summary",
                "title": "Clinical Diagnosis: Acute Febrile Illness (High Fever) (Primary Diagnosis)",
                "content": "Diagnosis: Acute Febrile Illness (High Fever) (ICD Code: D-0)\nClassification: Primary Diagnosis\nDiagnosis Date: 2024-09-21 10:00:00\nAttending/Diagnosing Physician: Dr. Ishita Patel",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.95,
            },
            {
                "id": 71986,
                "document_type": "diagnosis_summary",
                "title": "Clinical Diagnosis: Preterm Labor Complication (Primary Diagnosis)",
                "content": "Diagnosis: Preterm Labor Complication (ICD Code: D-7)\nClassification: Primary Diagnosis\nDiagnosis Date: 2026-07-04 10:00:00\nAttending/Diagnosing Physician: Dr. Namrata Gupta",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.94,
            },
            {
                "id": 71991,
                "document_type": "lab_result_summary",
                "title": "Lab Result: Param = 10.5 g/dL (Normal Range)",
                "content": "Test Parameter: Param\nResult Value: 10.5 g/dL (Reference Range: 12-16)",
                "metadata": {"test_parameter": "Param", "result_value": "10.5", "unit": "g/dL", "reference_range": "12-16", "record_id": "142442"},
                "is_verified": True,
                "review_status": "Completed",
                "relevance_score": 0.90,
            },
            {
                "id": 57523,
                "document_type": "radiologist_final_report",
                "title": "Verified Radiologist Final Report: Chest X-ray PA + AP (Acc #XR3D8A53F4E4194B)",
                "content": "Examination: Chest X-ray PA + AP\nRadiologist Conclusion & Diagnostic Findings:\nElevated screening index without focal opacity localization",
                "is_verified": True,
                "review_status": "Confirmed",
                "relevance_score": 0.88,
            }
        ]
        res = generation_service.generate_answer(
            question="details of all the diagnosis to this partient with result",
            area="patient360",
            role="doctor",
            sources=sources,
            patient_context={"patient_id": 87361}
        )
        ans = res["answer"]
        self.assertIn("Clinical Diagnoses & Diagnostic Workup", ans)
        self.assertIn("Clinical Diagnoses", ans)
        self.assertIn("Diagnostic Investigations & Lab Results", ans)
        self.assertIn("Radiology & Imaging Orders / Results", ans)
        self.assertIn("Record #71985", ans)
        self.assertIn("Record #71986", ans)
        self.assertIn("Record #71991", ans)
        self.assertIn("Record #57523", ans)

    def test_particular_diagnosis_synthesizes_specific_details_and_results(self):
        from services.rag_generation_service import generation_service
        sources = [
            {
                "id": 71985,
                "document_type": "diagnosis_summary",
                "title": "Clinical Diagnosis: Acute Febrile Illness (High Fever) (Primary Diagnosis)",
                "content": "Diagnosis: Acute Febrile Illness (High Fever) (ICD Code: D-0)\nClassification: Primary Diagnosis\nDiagnosis Date: 2024-09-21 10:00:00\nAttending/Diagnosing Physician: Dr. Ishita Patel\nAdmission ID: 87360",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.95,
            },
            {
                "id": 71986,
                "document_type": "diagnosis_summary",
                "title": "Clinical Diagnosis: Preterm Labor Complication (Primary Diagnosis)",
                "content": "Diagnosis: Preterm Labor Complication (ICD Code: D-7)\nClassification: Primary Diagnosis\nDiagnosis Date: 2026-07-04 10:00:00\nAttending/Diagnosing Physician: Dr. Namrata Gupta",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.80,
            },
            {
                "id": 71988,
                "document_type": "vital_trend_summary",
                "title": "Vital Signs (Abnormal) - 2024-09-21 10:00:00",
                "content": "Vitals: Temp: 98.91 F, SpO2: 93.37%\nAlert Flags: Low Oxygen Saturation",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.85,
            }
        ]
        res = generation_service.generate_answer(
            question="details of Acute Febrile Illness",
            area="patient360",
            role="doctor",
            sources=sources,
            patient_context={"patient_id": 87361}
        )
        ans = res["answer"]
        self.assertIn("Clinical Diagnosis Details: Acute Febrile Illness", ans)
        self.assertIn("Record #71985", ans)
        self.assertIn("Dr. Ishita Patel", ans)
        self.assertIn("Record #71988", ans)
        self.assertNotIn("Preterm Labor", ans)

    def test_why_still_admitted_synthesizes_inpatient_condition_and_workup(self):
        from services.rag_generation_service import generation_service
        sources = [
            {
                "id": 71984,
                "document_type": "patient_admission_summary",
                "title": "Inpatient Admission Summary - ADM #MER-ADM-0087360",
                "admission_id": 87360,
                "content": "Reason for Admission: High Fever\nAdmission Date: 2024-09-21 12:00:00 | Discharge Status: Admitted",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.95,
            },
            {
                "id": 71985,
                "document_type": "diagnosis_summary",
                "title": "Clinical Diagnosis: Acute Febrile Illness (High Fever) (Primary Diagnosis)",
                "admission_id": 87360,
                "content": "Diagnosis: Acute Febrile Illness (High Fever)\nAdmission ID: 87360",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.90,
            },
            {
                "id": 71986,
                "document_type": "diagnosis_summary",
                "title": "Clinical Diagnosis: Preterm Labor Complication (Primary Diagnosis)",
                "admission_id": None,
                "content": "Diagnosis: Preterm Labor Complication\nAdmission ID: Outpatient/General",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.88,
            },
            {
                "id": 71988,
                "document_type": "vital_trend_summary",
                "title": "Vital Signs (Abnormal) - 2024-09-21 10:00:00",
                "admission_id": 87360,
                "content": "Vitals: Temp: 98.91 F, SpO2: 93.37%\nAlert Flags: Low Oxygen Saturation (93.37%)",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.85,
            },
            {
                "id": 71989,
                "document_type": "medication_summary",
                "title": "Medication Order: Paracetamol 500mg",
                "admission_id": 87360,
                "content": "Paracetamol 500mg oral",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.82,
            },
            {
                "id": 71993,
                "document_type": "billing_clearance_summary",
                "title": "Billing & Clearance: Bill #MER-BIL-0087360 (Discharge Cleared (Financial))",
                "admission_id": 87360,
                "content": "Financial Clearance Status: Discharge Cleared (Financial)",
                "is_verified": True,
                "review_status": "Active",
                "relevance_score": 0.80,
            }
        ]
        res = generation_service.generate_answer(
            question="Why is this patient still admitted?",
            area="patient360",
            role="doctor",
            sources=sources,
            patient_context={"patient_id": 87361, "admission_id": 87360}
        )
        ans = res["answer"]
        self.assertIn("Clinical Reason & Active Admission Status", ans)
        self.assertIn("Reason for Admission: High Fever", ans)
        self.assertIn("Acute Febrile Illness (High Fever)", ans)
        self.assertNotIn("Preterm Labor Complication", ans)
        self.assertIn("Paracetamol 500mg", ans)
        self.assertIn("Low Oxygen Saturation", ans)
        self.assertIn("Discharge Cleared (Financial)", ans)

    def test_radiologist_study_queries_synthesis(self):
        from services.rag_generation_service import generation_service
        sources = [
            {
                "id": 57521,
                "document_type": "xray_order",
                "title": "X-ray Imaging Order: Chest X-ray PA + AP (Acc #XR3D8A53F4E4194B)",
                "content": "Patient: Murugan Ranganlan\nAccession Number: XR3D8A53F4E4194B\nExamination: Chest X-ray PA + AP | Priority: Urgent\nClinical Indication: has hear chest pain for last 4ddays\nOrder / Request Status: Uploaded",
                "is_verified": True,
                "review_status": "Uploaded",
                "relevance_score": 0.95,
            },
            {
                "id": 57522,
                "document_type": "radiology_ai_result",
                "title": "AI Triage & Screening: Chest X-ray PA + AP (Acc #XR3D8A53F4E4194B)",
                "content": "AI Risk Assessment: Elevated screening index with indeterminate localization\nAI Priority Level: HIGH PRIORITY | Anomaly Probability: 20.9%\nAI Detected Findings: Elevated screening index without focal opacity localization",
                "is_verified": False,
                "review_status": "Screened",
                "relevance_score": 0.93,
            },
            {
                "id": 57523,
                "document_type": "radiologist_final_report",
                "title": "Verified Radiologist Final Report: Chest X-ray PA + AP (Acc #XR3D8A53F4E4194B)",
                "content": "Examination: Chest X-ray PA + AP | Indication: has hear chest pain for last 4ddays\nReview Status: Verified Radiologist Report (Confirmed)\nReporting Radiologist: Dr. Vilson M\nReview Timestamp: 2026-09-25 04:42:33.009424\nRadiologist Conclusion & Diagnostic Findings:\nElevated screening index without focal opacity localization",
                "is_verified": True,
                "review_status": "Confirmed",
                "relevance_score": 0.94,
            },
        ]

        # 1. Why is this X-ray high priority?
        res1 = generation_service.generate_answer(
            question="Why is this X-ray high priority?",
            area="radiology",
            role="radiologist",
            sources=sources,
        )
        self.assertTrue("priority" in res1["answer"].lower() or "urgent" in res1["answer"].lower())
        self.assertTrue("57521" in res1["answer"] or "57522" in res1["answer"])

        # 2. Show the clinical indication and final report.
        res2 = generation_service.generate_answer(
            question="Show the clinical indication and final report.",
            area="radiology",
            role="radiologist",
            sources=sources,
        )
        self.assertTrue("indication" in res2["answer"].lower() or "report" in res2["answer"].lower())
        self.assertIn("Record #57523", res2["answer"])

        # 3. What did the radiologist conclude for this X-ray?
        res3 = generation_service.generate_answer(
            question="What did the radiologist conclude for this X-ray?",
            area="radiology",
            role="radiologist",
            sources=sources,
        )
        self.assertTrue("conclusion" in res3["answer"].lower() or "opacity" in res3["answer"].lower() or "screening index" in res3["answer"].lower())
        self.assertIn("Record #57523", res3["answer"])

    def test_radiologist_can_retrieve_request_aggregate(self):
        cursor = FakeCursor(doctor_row={"total": 16})
        context = AccessContext(1032, "radiologist", 1026, "radiology", RADIOLOGY_MODULES, None)
        with patch("services.rag_search_service.db_config.get_db_connection", return_value=FakeConnection(cursor)):
            sources, strategy = RagSearchService()._secure_search(
                "how many request received", "radiology", context,
                None, None, None, None, None, 8,
            )
        self.assertEqual(strategy, "authorized_sql_aggregate")
        self.assertEqual(sources[0]["metadata"]["total"], 16)
        self.assertEqual(sources[0]["content"], "Total X-ray requests: 16.")
        self.assertEqual(len(filter_sources(context, sources)), 1)


if __name__ == "__main__":
    unittest.main()



