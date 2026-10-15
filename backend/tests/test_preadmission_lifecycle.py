import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import preadmission_service
from preadmission_service import PreAdmissionValidationError


class PreAdmissionLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.mock_conn = MagicMock()
        self.mock_cur = MagicMock()
        self.mock_conn.cursor.return_value = self.mock_cur
        self.mock_conn.__enter__.return_value = self.mock_conn
        self.mock_cur.__enter__.return_value = self.mock_cur

    @patch('preadmission_service.db_config.get_db_connection')
    def test_confirm_or_link_admission_creates_admission_and_visit(self, mock_get_conn):
        mock_get_conn.return_value = self.mock_conn
        
        # 1. Fetch pre-admission details: (pa_id, pa_code, pat_id, doc_id, dept_id, adm_type, exp_date, instructions, remarks, existing_adm_id, cur_status)
        # 2. Check if admissions row already has pre_admission_id -> None
        # 3. Check for open inpatient visit -> None
        # 4. Fetch patient details for dim_admission_inputs -> ('John Doe', 35, 'Male', 'Cardiology', 'Dr. Smith')
        
        self.mock_cur.fetchone.side_effect = [
            # 1. pa_row (11 fields)
            (10, 'PAD0010', 1, 2, 3, 'Elective', '2026-10-20', 'Notes', 'Remarks', None, 'CONFIRMED'),
            # 2. check existing admission by pre_admission_id
            None,
            # 3. next_adm_id: SELECT GREATEST(...)
            (501,),
            # 4. visit_row: SELECT visit_id FROM patient_visits
            (101,),
            # 5. created_adm_id: INSERT INTO admissions ... RETURNING admission_id
            (501,),
            # 6. p_row: SELECT from patients
            ('PAT-001', 'John', 'Doe', 'Male', '1990-01-01', 'O+', '1234567890', 'john@example.com', '123 Main St'),
            # 7. d_row: SELECT from doctors
            ('Dr. Smith', 'Cardiology', 'MD')
        ]

        res = preadmission_service.confirm_or_link_admission(10, cur=self.mock_cur, conn=self.mock_conn)

        self.assertIsNotNone(res)
        self.assertEqual(res['admission_id'], 501)
        self.assertEqual(res['admission_number'], 'MER-ADM-0000501')
        self.assertEqual(res['newly_created'], True)

        # Verify update on pre_admissions with admission_id
        update_calls = [
            call for call in self.mock_cur.execute.call_args_list 
            if 'UPDATE pre_admissions' in str(call)
        ]
        self.assertTrue(len(update_calls) > 0)
        self.assertIn('admission_id = %s', str(update_calls[0]))

    @patch('preadmission_service.db_config.get_db_connection')
    def test_confirm_or_link_admission_idempotent(self, mock_get_conn):
        mock_get_conn.return_value = self.mock_conn

        # Pre-admission already has an admission_id linked (e.g. 501)
        self.mock_cur.fetchone.side_effect = [
            # pa_row (11 fields) with existing_adm_id = 501
            (10, 'PAD0010', 1, 2, 3, 'Elective', '2026-10-20', 'Notes', 'Remarks', 501, 'CONFIRMED'),
            # existing admission query (6 fields: aid, adm_num, adm_pat_id, disc_st, wid, bid)
            (501, 'ADM-20261015-0501', 1, None, None, None),
            # visit_id check on admission
            (101,),
            # doctor query for dim_admission_inputs
            ('Dr. Smith', 'Cardiology', 'MD')
        ]

        res = preadmission_service.confirm_or_link_admission(10, cur=self.mock_cur, conn=self.mock_conn)

        self.assertEqual(res['admission_id'], 501)
        self.assertEqual(res['admission_number'], 'ADM-20261015-0501')
        self.assertEqual(res['already_linked'], True)

    @patch('preadmission_service.db_config.get_db_connection')
    def test_allocate_bed_success(self, mock_get_conn):
        mock_get_conn.return_value = self.mock_conn

        # 1. Fetch admission: (aid, adm_num, pat_id, doc_id, old_ward_id, old_bed_id, disc_st, pa_st) -> 8 fields
        # 2. Validate bed: (bed_id, bed_number, status, room_id, ward_id, room_number, room_ward_id, ward_name) -> 8 fields
        # 3. Doctor info for dim_admission_inputs
        self.mock_cur.fetchone.side_effect = [
            (501, 'ADM-001', 1, 2, None, None, None, 'CONFIRMED'), # admission row (8 fields)
            (20, 'Bed-01', 'Available', 5, 1, 'Room-101', 1, 'General Ward'), # bed row (8 fields)
            ('Dr. Smith', 'Cardiology') # doc info
        ]

        res = preadmission_service.allocate_bed_for_admission(
            admission_id=501,
            ward_id=1,
            room_id=5,
            bed_id=20
        )

        self.assertTrue(res['success'])
        self.assertEqual(res['bed_number'], 'Bed-01')
        self.assertEqual(res['ward_name'], 'General Ward')

        # Verify bed status updated to 'Occupied'
        bed_update = [
            call for call in self.mock_cur.execute.call_args_list
            if "UPDATE beds SET status = 'Occupied'" in str(call)
        ]
        self.assertTrue(len(bed_update) > 0)

    @patch('preadmission_service.db_config.get_db_connection')
    def test_allocate_bed_rejects_already_occupied_bed(self, mock_get_conn):
        mock_get_conn.return_value = self.mock_conn

        # Bed status is 'Occupied'
        self.mock_cur.fetchone.side_effect = [
            (501, 'ADM-001', 1, 2, None, None, None, 'CONFIRMED'),
            (20, 'Bed-01', 'Occupied', 5, 1, 'Room-101', 1, 'General Ward'),
        ]

        with self.assertRaises(PreAdmissionValidationError) as ctx:
            preadmission_service.allocate_bed_for_admission(
                admission_id=501,
                ward_id=1,
                room_id=5,
                bed_id=20
            )
        self.assertIn("cannot be allocated", str(ctx.exception))

    @patch('preadmission_service.db_config.get_db_connection')
    def test_allocate_bed_rejects_mismatched_ward_or_room(self, mock_get_conn):
        mock_get_conn.return_value = self.mock_conn

        # Bed doesn't match ward/room requested
        self.mock_cur.fetchone.side_effect = [
            (501, 'ADM-001', 1, 2, None, None, None, 'CONFIRMED'),
            (20, 'Bed-01', 'Available', 99, 1, 'Room-999', 1, 'General Ward'), # room_id=99 != 5
        ]

        with self.assertRaises(PreAdmissionValidationError) as ctx:
            preadmission_service.allocate_bed_for_admission(
                admission_id=501,
                ward_id=1,
                room_id=5,
                bed_id=20
            )
        self.assertIn("belongs to room ID", str(ctx.exception))

    @patch('preadmission_service.db_config.get_db_connection')
    def test_allocate_bed_enforces_doctor_authorization(self, mock_get_conn):
        mock_get_conn.return_value = self.mock_conn

        # Admission is assigned to doctor_id=2, but doctor_id_restriction=99 tries to allocate
        self.mock_cur.fetchone.side_effect = [
            (501, 'ADM-001', 1, 2, None, None, None, 'CONFIRMED'), # doc is 2
        ]

        with self.assertRaises(PreAdmissionValidationError) as ctx:
            preadmission_service.allocate_bed_for_admission(
                admission_id=501,
                ward_id=1,
                room_id=5,
                bed_id=20,
                doctor_id_restriction=99
            )
        self.assertIn("Unauthorized", str(ctx.exception))

    @patch('preadmission_service.db_config.get_db_connection')
    def test_allocate_bed_rejects_cancelled_or_completed_pre_admission(self, mock_get_conn):
        mock_get_conn.return_value = self.mock_conn

        # Linked pre-admission has status CANCELLED
        self.mock_cur.fetchone.side_effect = [
            (501, 'ADM-001', 1, 2, None, None, None, 'CANCELLED'),
        ]

        with self.assertRaises(PreAdmissionValidationError) as ctx:
            preadmission_service.allocate_bed_for_admission(
                admission_id=501,
                ward_id=1,
                room_id=5,
                bed_id=20
            )
        self.assertIn("cancelled", str(ctx.exception))

    @patch('preadmission_service.confirm_or_link_admission')
    @patch('preadmission_service.db_config.get_db_connection')
    def test_update_status_to_confirmed_triggers_admission_linking(self, mock_get_conn, mock_confirm):
        mock_get_conn.return_value = self.mock_conn
        # 1. Existing row check: (id, status, admission_id)
        self.mock_cur.fetchone.return_value = (15, 'PENDING', None)
        mock_confirm.return_value = {
            "success": True,
            "admission_id": 888,
            "admission_number": "MER-ADM-0000888",
            "discharge_status": "Admitted"
        }

        res = preadmission_service.update_pre_admission_status(
            pre_admission_id=15,
            status='CONFIRMED',
            remarks='Patient confirmed via phone'
        )

        self.assertTrue(res['success'])
        self.assertEqual(res['admission_id'], 888)
        self.assertEqual(res['admission_number'], "MER-ADM-0000888")
        mock_confirm.assert_called_once_with(15, cur=self.mock_cur, conn=self.mock_conn)

    @patch('preadmission_service.db_config.get_db_connection')
    def test_update_status_to_cancelled_frees_bed(self, mock_get_conn):
        mock_get_conn.return_value = self.mock_conn
        # 1. Existing row check: (id, status, admission_id)
        # 2. Linked admission check: (admission_id,)
        self.mock_cur.fetchone.side_effect = [
            (15, 'CONFIRMED', 501),
            (501,)
        ]

        res = preadmission_service.update_pre_admission_status(
            pre_admission_id=15,
            status='CANCELLED'
        )

        self.assertTrue(res['success'])
        # Check that beds are freed and admissions marked discharged
        exec_calls = [str(c) for c in self.mock_cur.execute.call_args_list]
        self.assertTrue(any("UPDATE beds SET status = 'Available'" in c for c in exec_calls))
        self.assertTrue(any("UPDATE admissions SET discharge_status = 'Discharged'" in c for c in exec_calls))

    @patch('preadmission_service.db_config.get_db_connection')
    def test_get_available_beds_hierarchy(self, mock_get_conn):
        mock_get_conn.return_value = self.mock_conn

        # Mock fetchall returning available beds: (wid, wname, wtype, floor, rid, rnum, rtype, bid, bnum, btype, charge, bstatus)
        self.mock_cur.fetchall.return_value = [
            (1, 'General Ward', 'General', 1, 10, 'Room 101', 'General', 101, 'Bed 1A', 'Standard', 1500.0, 'Available'),
            (1, 'General Ward', 'General', 1, 10, 'Room 101', 'General', 102, 'Bed 1B', 'Standard', 1500.0, 'Available'),
            (2, 'ICU', 'Critical', 2, 20, 'Room 201', 'ICU Room', 201, 'ICU-Bed-1', 'ICU', 5000.0, 'Available')
        ]

        wards = preadmission_service.get_available_beds_hierarchy()

        self.assertEqual(len(wards), 2)
        self.assertEqual(wards[0]['ward_name'], 'General Ward')
        self.assertEqual(len(wards[0]['rooms']), 1)
        self.assertEqual(len(wards[0]['rooms'][0]['beds']), 2)
        self.assertEqual(wards[1]['ward_name'], 'ICU')
        self.assertEqual(len(wards[1]['rooms'][0]['beds']), 1)

    def test_canonical_admission_types_validation(self):
        """Test normalization and canonical mapping for all supported admission types."""
        expected_mappings = {
            "Direct Admission": "Direct Admission",
            "direct admission": "Direct Admission",
            "DIRECT ADMISSION": "Direct Admission",
            "Elective": "Elective",
            "elective": "Elective",
            "Emergency": "Emergency",
            "Urgent": "Urgent",
            "Routine": "Routine",
            "Day Care": "Day Care",
            "day care": "Day Care",
            "DAYCARE": "Day Care",
            "Maternity / Obstetric": "Maternity / Obstetric",
            "Medical": "Medical",
            "Newborn / Neonatal": "Newborn / Neonatal",
            "Observation": "Observation",
            "Psychiatric": "Psychiatric",
            "Readmission": "Readmission",
            "Rehabilitation": "Rehabilitation",
            "Surgical": "Surgical",
            "SURGERY": "Surgical",
            "Transfer In": "Transfer In",
            "Inpatient": "Inpatient",
            "INPATIENT": "Inpatient",
        }

        for input_val, expected in expected_mappings.items():
            result = preadmission_service.normalize_admission_type(input_val)
            self.assertEqual(result, expected, f"Failed for input '{input_val}'")

    def test_direct_admission_not_mapped_to_inpatient(self):
        """Confirm Direct Admission preserves its exact canonical type and is NOT mapped to Inpatient."""
        result = preadmission_service.normalize_admission_type("Direct Admission")
        self.assertEqual(result, "Direct Admission")
        self.assertNotEqual(result, "Inpatient")

    def test_invalid_admission_type_raises_validation_error(self):
        """Confirm invalid and unsupported admission types raise PreAdmissionValidationError with allowed types."""
        invalid_types = ["Direct_Admission", "VIP", "Unknown", "Casualty", ""]
        for inv in invalid_types:
            with self.assertRaises(PreAdmissionValidationError) as ctx:
                preadmission_service.normalize_admission_type(inv)
            self.assertTrue(
                "Invalid admission_type" in str(ctx.exception) or "admission_type is required" in str(ctx.exception),
                f"Unexpected exception message for '{inv}': {ctx.exception}"
            )

    @patch('preadmission_service.db_config.get_db_connection')
    def test_create_pre_admission_with_direct_admission(self, mock_get_conn):
        """Test creating pre-admission with 'Direct Admission' succeeds and inserts 'Direct Admission'."""
        mock_get_conn.return_value = self.mock_conn

        self.mock_cur.fetchone.side_effect = [
            # 1. Patient check: id, patient_code, first_name, last_name, phone, wa, gender, dob, status
            (1, 'PAT001', 'Jane', 'Doe', '9876543210', '9876543210', 'Female', '1995-05-15', 'ACTIVE'),
            # 2. Doctor check: id, display_name, department_id, status
            (2, 'Dr. Edwin', 3, 'ACTIVE'),
            # 3. Department check: id, department_name
            (3, 'Cardiology'),
            # 4. Count for PAD code
            (5,),
            # 5. Insert returning id
            (105,),
            # 6. Notification fetch: pa details & patient info
            (105, 'PAD0006', '2026-10-25', 'Direct Admission', 'Notes', '09:00', 'ID Card',
             1, 'Jane', 'Doe', '9876543210', '9876543210', 'Dr. Edwin', 'Cardiology')
        ]
        self.mock_cur.fetchall.return_value = [] # no active duplicate pre-admissions

        res = preadmission_service.create_pre_admission(
            patient_id=1,
            doctor_id=2,
            department_id=3,
            expected_admission_date="2026-10-25",
            admission_type="Direct Admission",
            expected_checkin_time="09:00"
        )

        self.assertTrue(res['success'])
        self.assertEqual(res['admission_type'], 'Direct Admission')
        self.assertEqual(res['pre_admission_code'], 'PAD0006')

        # Verify that INSERT had 'Direct Admission'
        insert_calls = [
            call for call in self.mock_cur.execute.call_args_list
            if 'INSERT INTO pre_admissions' in str(call)
        ]
        self.assertTrue(len(insert_calls) > 0)
        self.assertIn('Direct Admission', str(insert_calls[0]))


if __name__ == '__main__':
    unittest.main()

