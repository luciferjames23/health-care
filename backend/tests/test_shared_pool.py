import threading
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
        self.slots = threading.BoundedSemaphore(1)
        self.patches = [
            patch.object(db_config, '_get_pool', return_value=self.pool),
            patch.object(db_config, '_pool_slots', self.slots),
            patch.object(db_config.psycopg2, 'connect'),
        ]
        self.mocks = [p.start() for p in self.patches]
        self.addCleanup(patch.stopall)

    def test_close_returns_connection_and_slot_once(self):
        conn = db_config.get_db_connection()
        self.assertFalse(self.slots.acquire(blocking=False))
        conn.close()
        conn.close()
        self.pool.putconn.assert_called_once_with(self.raw)
        self.assertTrue(self.slots.acquire(blocking=False))
        self.assertFalse(self.slots.acquire(blocking=False))

    def test_failed_checkout_does_not_open_unbounded_connection(self):
        self.pool.getconn.side_effect = db_config.psycopg2.pool.PoolError('full')
        with self.assertRaises(db_config.psycopg2.pool.PoolError):
            db_config.get_db_connection()
        self.mocks[2].assert_not_called()
        self.assertTrue(self.slots.acquire(blocking=False))

    def test_context_returns_connection_on_query_failure(self):
        with self.assertRaises(ValueError):
            with db_config.get_db_connection():
                raise ValueError('query failed')
        self.pool.putconn.assert_called_once_with(self.raw)
        self.assertTrue(self.slots.acquire(blocking=False))

    def test_all_integrated_connectors_share_pool(self):
        connector = PostgresConnector()
        self.pool.getconn.assert_not_called()
        connector.get_connection().close()
        radiology_connection().close()
        self.assertEqual(self.pool.getconn.call_count, 2)
        self.mocks[2].assert_not_called()


if __name__ == '__main__':
    unittest.main()
