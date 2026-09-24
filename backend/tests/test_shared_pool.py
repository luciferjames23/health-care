import unittest
from unittest.mock import MagicMock, patch

import db_config
from db.postgres_connector import PostgresConnector
from radiology_ai.db import get_connection as radiology_connection


class SharedPoolTests(unittest.TestCase):
    def setUp(self):
        self.pool = MagicMock()
        self.raw = self.pool.getconn.return_value
        self.raw.closed = False
        self.patches = [
            patch.object(db_config, '_get_pool', return_value=self.pool),
            patch.object(db_config.psycopg2, 'connect'),
        ]
        self.mocks = [p.start() for p in self.patches]
        self.addCleanup(patch.stopall)

    def test_close_returns_connection_and_slot_once(self):
        conn = db_config.get_db_connection()
        conn.close()
        conn.close()
        self.pool.putconn.assert_called_once_with(self.raw)

    def test_failed_checkout_does_not_open_unbounded_connection(self):
        self.pool.getconn.side_effect = Exception('pool error')
        db_config.get_db_connection()
        self.mocks[1].assert_called_once()

    def test_context_returns_connection_on_query_failure(self):
        with self.assertRaises(ValueError):
            with db_config.get_db_connection():
                raise ValueError('query failed')
        self.pool.putconn.assert_called_once_with(self.raw)

    def test_all_integrated_connectors_share_pool(self):
        connector = PostgresConnector()
        self.pool.getconn.assert_not_called()
        connector.get_connection().close()
        radiology_connection().close()
        self.assertEqual(self.pool.getconn.call_count, 2)
        self.mocks[1].assert_not_called()


if __name__ == '__main__':
    unittest.main()

