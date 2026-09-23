"""Compatibility connector using the application's shared PostgreSQL pool."""
import psycopg2.extras


class PostgresConnector:
    """Borrow connections lazily from the shared, bounded application pool."""

    def get_connection(self):
        from db_config import get_db_connection
        return get_db_connection()

    def get_dict_cursor(self, conn):
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
