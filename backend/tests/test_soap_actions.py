import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pydantic import ValidationError
from services.soap_action_service import SoapClinicalAction, extract_clinical_actions


class SoapClinicalActionExtractionTests(unittest.TestCase):
    def extract(self, text, draft=None):
        return extract_clinical_actions(text, draft).actions

    def test_reference_dictation_extracts_medication_lab_diagnostic_and_follow_up(self):
        text = (
            "Patient has chest pain for three days. BP is 140 over 90. "
            "Order CBC and ECG. Start Aspirin 75 mg. Review after seven days."
        )
        actions = self.extract(text, {
            "subjective": "Chest pain for 3 days", "objective": "BP 140/90",
            "assessment": "", "plan": "Order CBC. Order ECG. Start Aspirin 75 mg. Review after 7 days.",
        })
        identified = {(item.action_type, item.intent, item.name) for item in actions}
        self.assertIn(("MEDICATION_ORDER", "CREATE_ORDER", "Aspirin"), identified)
        self.assertIn(("LAB_ORDER", "CREATE_ORDER", "Complete Blood Count"), identified)
        self.assertIn(("DIAGNOSTIC_ORDER", "CREATE_ORDER", "ECG"), identified)
        self.assertIn(("FOLLOW_UP", "FOLLOW_UP", "7 days"), identified)
        aspirin = next(item for item in actions if item.action_type == "MEDICATION_ORDER" and item.intent == "CREATE_ORDER")
        self.assertEqual(aspirin.dose, 75)
        self.assertEqual(aspirin.unit, "mg")
        self.assertEqual(aspirin.status, "PENDING_CONFIRMATION")

    def test_finding_is_not_diagnostic_order(self):
        actions = self.extract("ECG shows T-wave inversion.")
        self.assertEqual([(a.action_type, a.intent, a.name) for a in actions], [
            ("CLINICAL_FINDING", "DOCUMENT_FINDING", "T-wave inversion")
        ])

    def test_lab_result_is_not_lab_order(self):
        actions = self.extract("CBC Hb is 9.2.")
        self.assertFalse(any(a.action_type == "LAB_ORDER" for a in actions))
        self.assertTrue(any(a.action_type == "CLINICAL_FINDING" and "Hb 9.2" in a.name for a in actions))

    def test_passive_requested_lab_is_explicit_order_intent(self):
        actions = self.extract("CBC requested.")
        self.assertEqual([(a.action_type, a.intent, a.code) for a in actions], [
            ("LAB_ORDER", "CREATE_ORDER", "CBC")
        ])

    def test_medication_history_is_not_new_prescription(self):
        actions = self.extract("Patient is taking Aspirin 75 mg.")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0].action_type, "MEDICATION_ORDER")
        self.assertEqual(actions[0].intent, "DOCUMENT_HISTORY")
        self.assertNotEqual(actions[0].status, "PENDING_CONFIRMATION")

    def test_consideration_is_not_create_order(self):
        actions = self.extract("Consider ECG if pain continues.")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0].action_type, "DIAGNOSTIC_ORDER")
        self.assertEqual(actions[0].intent, "CONSIDER")
        self.assertEqual(actions[0].status, "DETECTED")

    def test_imaging_request_and_result_are_distinguished(self):
        requested = self.extract("Chest X-ray requested.")
        self.assertEqual([(a.action_type, a.intent) for a in requested], [("IMAGING_ORDER", "CREATE_ORDER")])
        result = self.extract("Chest X-ray shows infiltrate.")
        self.assertFalse(any(a.action_type == "IMAGING_ORDER" for a in result))
        self.assertTrue(any(a.action_type == "CLINICAL_FINDING" for a in result))

    def test_imaging_projection_priority_and_indication_are_structured(self):
        action = next(a for a in self.extract(
            "Patient has persistent cough for 5 days. Order a chest X-ray PA view, priority routine."
        ) if a.action_type == "IMAGING_ORDER")
        self.assertEqual(action.name, "Chest X-ray")
        self.assertEqual(action.projection, "PA")
        self.assertEqual(action.priority, "ROUTINE")
        self.assertEqual(action.clinical_indication, "Persistent cough for 5 days")
        self.assertEqual(action.source_text, "Order a chest X-ray PA view, priority routine")

    def test_imaging_ap_projection_is_extracted_only_when_spoken(self):
        action = next(a for a in self.extract("Order chest X-ray AP view") if a.action_type == "IMAGING_ORDER")
        self.assertEqual(action.projection, "AP")
        missing = next(a for a in self.extract("Order a chest X-ray") if a.action_type == "IMAGING_ORDER")
        self.assertIsNone(missing.projection)

    def test_xray_finding_never_becomes_an_imaging_order(self):
        actions = self.extract("Chest X-ray shows infiltrates")
        self.assertFalse(any(a.action_type == "IMAGING_ORDER" for a in actions))
        self.assertTrue(any(a.action_type == "CLINICAL_FINDING" and a.name == "X-ray: infiltrates" for a in actions))

    def test_all_four_requested_vitals_are_structured_findings_with_evidence(self):
        transcript = (
            "Patient has fever for two days. Temperature is 101 degrees Fahrenheit. "
            "Blood pressure is 130 over 80. Pulse is 96 per minute. "
            "Oxygen saturation is 98 percent."
        )
        actions = [a for a in self.extract(transcript) if a.finding_type]
        self.assertEqual(len(actions), 4)
        by_type = {action.finding_type: action for action in actions}
        self.assertEqual((by_type["TEMPERATURE"].value, by_type["TEMPERATURE"].unit), (101, "F"))
        self.assertEqual((by_type["BLOOD_PRESSURE"].systolic, by_type["BLOOD_PRESSURE"].diastolic,
                          by_type["BLOOD_PRESSURE"].unit), (130, 80, "mmHg"))
        self.assertEqual((by_type["PULSE"].value, by_type["PULSE"].unit), (96, "bpm"))
        self.assertEqual((by_type["SPO2"].value, by_type["SPO2"].unit), (98, "%"))
        self.assertTrue(all(action.source_text in transcript for action in actions))
        self.assertFalse(any(a.action_type == "DIAGNOSIS_CANDIDATE" for a in actions))

    def test_exact_acceptance_sentence_extracts_four_structured_vitals(self):
        transcript = (
            "Patient has fever for two days. Temperature is 101 degrees Fahrenheit, "
            "blood pressure is 130 over 80, pulse is 96 per minute, and oxygen "
            "saturation is 98 percent."
        )
        actions = [a for a in self.extract(transcript) if a.finding_type]
        by_type = {action.finding_type: action for action in actions}
        self.assertEqual(len(actions), 4)
        self.assertEqual((by_type["TEMPERATURE"].value, by_type["TEMPERATURE"].unit), (101, "F"))
        self.assertEqual((by_type["BLOOD_PRESSURE"].systolic, by_type["BLOOD_PRESSURE"].diastolic,
                          by_type["BLOOD_PRESSURE"].unit), (130, 80, "mmHg"))
        self.assertEqual((by_type["PULSE"].value, by_type["PULSE"].unit), (96, "bpm"))
        self.assertEqual((by_type["SPO2"].value, by_type["SPO2"].unit), (98, "%"))

    def test_plural_pulses_is_detected_without_guessing_mistranscribed_temperature(self):
        transcript = (
            "Temperature is not one degrees Fahrenheit, blood pressure is 130 over 80, "
            "pulses 96 per minute and oxygen saturation is 98%."
        )
        findings = [a for a in self.extract(transcript) if a.finding_type]
        by_type = {action.finding_type: action for action in findings}
        self.assertNotIn("TEMPERATURE", by_type)
        self.assertEqual((by_type["PULSE"].value, by_type["PULSE"].unit), (96, "bpm"))
        self.assertEqual((by_type["BLOOD_PRESSURE"].systolic, by_type["BLOOD_PRESSURE"].diastolic), (130, 80))
        self.assertEqual((by_type["SPO2"].value, by_type["SPO2"].unit), (98, "%"))

    def test_combined_vitals_lab_medication_and_imaging_yield_seven_actions(self):
        transcript = (
            "Patient has fever for two days and persistent cough for five days. "
            "Temperature is 101 degrees Fahrenheit, blood pressure is 130 over 80, "
            "pulse is 96 per minute, and oxygen saturation is 98 percent. Order CBC. "
            "Start Dolo 650 milligrams twice daily. Order a chest X-ray PA view, priority routine."
        )
        actions = self.extract(transcript)
        self.assertEqual(len(actions), 7)
        self.assertEqual(sum(a.action_type == "CLINICAL_FINDING" and a.finding_type is not None for a in actions), 4)
        self.assertEqual(sum(a.action_type == "LAB_ORDER" for a in actions), 1)
        self.assertEqual(sum(a.action_type == "MEDICATION_ORDER" for a in actions), 1)
        imaging = [a for a in actions if a.action_type == "IMAGING_ORDER"]
        self.assertEqual(len(imaging), 1)
        self.assertEqual(imaging[0].projection, "PA")

    def test_common_vital_phrases_are_normalized_without_inference(self):
        actions = [a for a in self.extract("Temp 100 C. BP 120/70. Heart rate is 88. SpO2 97%.") if a.finding_type]
        by_type = {action.finding_type: action for action in actions}
        self.assertEqual(by_type["TEMPERATURE"].unit, "C")
        self.assertEqual((by_type["BLOOD_PRESSURE"].systolic, by_type["BLOOD_PRESSURE"].diastolic), (120, 70))
        self.assertEqual(by_type["PULSE"].value, 88)
        self.assertEqual(by_type["SPO2"].value, 97)
        self.assertFalse(any(a.finding_type for a in self.extract("Vitals reviewed.")))
        unstated = next(a for a in self.extract("Temperature is 101.") if a.finding_type == "TEMPERATURE")
        self.assertIsNone(unstated.unit)

    def test_explicit_diagnosis_is_candidate_without_invented_code(self):
        actions = self.extract("Diagnosis is diabetic ketoacidosis.")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0].action_type, "DIAGNOSIS_CANDIDATE")
        self.assertIsNone(actions[0].code)

    def test_plan_text_cannot_create_order_when_transcript_does_not(self):
        actions = self.extract("Patient reports pain.", {"plan": "Order CBC and ECG"})
        self.assertEqual(actions, [])

    def test_unknown_medication_is_preserved_not_substituted(self):
        actions = self.extract("Start Zorvex 20 mg.")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0].name, "Zorvex")
        self.assertEqual(actions[0].dose, 20)
        self.assertEqual(actions[0].unit, "mg")

    def test_strict_action_schema_rejects_unstructured_fields(self):
        with self.assertRaises(ValidationError):
            SoapClinicalAction.model_validate({
                "action_key": "a" * 64, "action_type": "LAB_ORDER", "intent": "CREATE_ORDER",
                "name": "CBC", "source_text": "order CBC", "confidence": 0.95,
                "status": "PENDING_CONFIRMATION", "free_text_dispatch": "create arbitrary record",
            })

    def test_repeated_detection_has_stable_action_identity(self):
        first = self.extract("Order CBC.")[0]
        second = self.extract("Order CBC.")[0]
        self.assertEqual(first.action_key, second.action_key)


if __name__ == "__main__":
    unittest.main()
