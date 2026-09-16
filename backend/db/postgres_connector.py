import os
import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

class PooledConnWrapper:
    """Wrapper around a psycopg2 connection that returns to pool on .close()."""
    def __init__(self, raw_conn, pool):
        self._conn = raw_conn
        self._pool = pool
        self._closed = False

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def close(self):
        if not self._closed:
            self._closed = True
            try:
                self._conn.rollback()
            except Exception:
                pass
            try:
                self._pool.putconn(self._conn)
            except Exception:
                pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

class PostgresConnector:
    """PostgreSQL Database Connector with Thread-safe Connection Pooling."""
    
    _pool = None

    def __init__(self):
        self.host = os.getenv("POSTGRES_HOST", "rivesca.eu.db.rivestack.io")
        self.port = int(os.getenv("POSTGRES_PORT", 5432))
        self.dbname = os.getenv("POSTGRES_DB", "rv_pbpkghvg")
        self.user = os.getenv("POSTGRES_USER", "rv_pbpkghvg")
        self.password = os.getenv("POSTGRES_PASSWORD", "d_3zzwU0qzrtkujXG6YVBGlXGx9-kxp05cfBMiHqQ48=")
        self._ensure_pool()

    @classmethod
    def _ensure_pool(cls):
        if cls._pool is None:
            host = os.getenv("POSTGRES_HOST", "rivesca.eu.db.rivestack.io")
            port = int(os.getenv("POSTGRES_PORT", 5432))
            dbname = os.getenv("POSTGRES_DB", "rv_pbpkghvg")
            user = os.getenv("POSTGRES_USER", "rv_pbpkghvg")
            password = os.getenv("POSTGRES_PASSWORD", "d_3zzwU0qzrtkujXG6YVBGlXGx9-kxp05cfBMiHqQ48=")
            cls._pool = ThreadedConnectionPool(
                minconn=1,
                maxconn=4,
                host=host,
                port=port,
                dbname=dbname,
                user=user,
                password=password,
                connect_timeout=15
            )

    def get_connection(self):
        """Borrows a connection from the pool and returns a pooled wrapper."""
        self._ensure_pool()
        raw_conn = self._pool.getconn()
        return PooledConnWrapper(raw_conn, self._pool)

    def get_dict_cursor(self, conn):
        return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

