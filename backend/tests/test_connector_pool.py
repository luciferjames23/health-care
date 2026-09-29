import unittest
from unittest.mock import MagicMock, patch
from psycopg2.pool import PoolError
from connectors.databricks_connector import DatabricksConnector

class ConnectorPoolTests(unittest.TestCase):
    def setUp(self):
        self.connector = DatabricksConnector()
        self.connector.clear_cache()
        self.connector.mark_connection_healthy()

    def test_paginated_query_borrows_only_once(self):
        connection = MagicMock()
        cursor = connection.__enter__.return_value.cursor.return_value
        cursor.fetchone.return_value = (1,)
        cursor.description = [('id',)]
        cursor.fetchall.return_value = [(123,)]
        with patch.object(self.connector, 'get_connection', return_value=connection) as borrow:
            result = self.connector.query_table('patients', limit=1)
        borrow.assert_called_once()
        connection.__exit__.assert_called_once()
        self.assertEqual(result['total_rows'], 1)
        self.assertEqual(result['data'][0]['patient_id'], 123)

    def test_query_error_releases_connection(self):
        connection = MagicMock()
        connection.__enter__.return_value.cursor.return_value.execute.side_effect = ValueError('bad query')
        with patch.object(self.connector, 'get_connection', return_value=connection), self.assertRaises(ValueError):
            self.connector.query_gold_table('patients')
        connection.__exit__.assert_called_once()

    def test_busy_pool_does_not_mark_database_down(self):
        with patch.object(self.connector.pg_connector, 'get_connection', side_effect=PoolError('busy')), self.assertRaises(PoolError):
            self.connector.get_connection()
        self.assertTrue(self.connector.is_connection_available())


class AdmissionSerializationTests(unittest.TestCase):
    def test_imported_python_text_preserves_original_demographics(self):
        demographic = {'first_name': "O'Neil", 'last_name': 'Parthalan', 'age_at_admission': 34, 'gender': 'Female'}
        payload = {'patient_demographics': demographic, 'diagnoses': {'active': True, 'extra': None}}
        for value in (repr(payload), __import__('json').dumps(payload), payload):
            row = {'patient_id': 87256, 'llm_input_json': value}
            result = DatabricksConnector._post_process_row('dim_admission_inputs', row)
            self.assertEqual(result['llm_input_json'], payload)
            self.assertEqual(result['patient_id'], 87256)

    def test_invalid_text_does_not_execute_or_break_response(self):
        for value in ('not JSON', "__import__('os').getcwd()", '[]'):
            row = {'llm_input_json': value, 'first_name': 'Original'}
            self.assertEqual(DatabricksConnector._post_process_row('dim_admission_inputs', row), row)
