import os
import psycopg2
import psycopg2.pool
import threading

def load_dotenv(override=True):
    """Lightweight, zero-dependency dotenv loader."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dotenv_paths = [
        os.path.join(base_dir, ".env"),
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.getcwd(), "backend", ".env")
    ]
    for path in dotenv_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip('"').strip("'")
                        if override or key not in os.environ:
                            os.environ[key] = val
            break

load_dotenv()

DB_HOST = os.getenv("DATABASE_HOST", "localhost")
DB_PORT = os.getenv("DATABASE_PORT", "5433")
DB_NAME = os.getenv("DATABASE_NAME", "healthcare")
DB_USER = os.getenv("DATABASE_USER", "postgres")
DB_PASSWORD = os.getenv("DATABASE_PASSWORD", "reji123@")

_pool_lock = threading.Lock()
_connection_pool = None

_POOL_MIN = int(os.getenv("DB_POOL_MIN", "2"))
_POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))


class _PooledConnection:
    """Thin wrapper that returns the real connection to the pool on close()."""

    __slots__ = ("_conn", "_pool", "_closed")

    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
        self._closed = False

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        return self._conn.commit()

    def rollback(self):
        return self._conn.rollback()

    @property
    def autocommit(self):
        return self._conn.autocommit

    @autocommit.setter
    def autocommit(self, value):
        self._conn.autocommit = value

    def close(self):
        if self._closed:
            return
        self._closed = True
        try:
            if not self._conn.closed:
                self._conn.rollback()
            self._pool.putconn(self._conn)
        except Exception:
            try:
                self._conn.close()
            except Exception:
                pass


def _get_pool(database_name=None):
    global _connection_pool
    dbname = database_name or DB_NAME
    if _connection_pool is not None:
        return _connection_pool
    with _pool_lock:
        if _connection_pool is not None:
            return _connection_pool
        try:
            _connection_pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=_POOL_MIN,
                maxconn=_POOL_MAX,
                host=DB_HOST,
                port=DB_PORT,
                database=dbname,
                user=DB_USER,
                password=DB_PASSWORD,
            )
            print(f"[PERF] DB connection pool initialized (min={_POOL_MIN}, max={_POOL_MAX})")
        except Exception as exc:
            print(f"[PERF] Failed to initialize connection pool: {exc}. Falling back to direct connections.")
            _connection_pool = None
        return _connection_pool


def get_db_connection(database_name=None):
    pool = _get_pool(database_name)
    if pool is not None:
        try:
            raw_conn = pool.getconn()
            if raw_conn and not raw_conn.closed:
                return _PooledConnection(raw_conn, pool)
        except Exception:
            pass

    dbname = database_name or DB_NAME
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=dbname,
        user=DB_USER,
        password=DB_PASSWORD
    )

def get_db_connection_string(database_name=None):
    dbname = database_name or DB_NAME
    return f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{dbname}"
