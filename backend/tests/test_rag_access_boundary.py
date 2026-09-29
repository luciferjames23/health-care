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


if __name__ == "__main__":
    unittest.main()
