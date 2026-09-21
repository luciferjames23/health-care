import os
import sys
import threading
from pathlib import Path
import psycopg2
import psycopg2.pool

# Load backend directory into sys.path if not present
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

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

# Import existing centralized Config
try:
    from config.config import Config
    DEFAULT_HOST = Config.POSTGRES_HOST
    DEFAULT_PORT = str(Config.POSTGRES_PORT)
    DEFAULT_NAME = Config.POSTGRES_DB
    DEFAULT_USER = Config.POSTGRES_USER
    DEFAULT_PASSWORD = Config.POSTGRES_PASSWORD
except Exception:
    DEFAULT_HOST = "rivesca.eu.db.rivestack.io"
    DEFAULT_PORT = "5432"
    DEFAULT_NAME = "rv_pbpkghvg"
    DEFAULT_USER = "rv_pbpkghvg"
    DEFAULT_PASSWORD = "d_3zzwU0qzrtkujXG6YVBGlXGx9-kxp05cfBMiHqQ48="

# Database Config Defaults linked to our shared PostgreSQL Lakehouse
DB_HOST = os.getenv("DATABASE_HOST", os.getenv("POSTGRES_HOST", DEFAULT_HOST))
DB_PORT = os.getenv("DATABASE_PORT", os.getenv("POSTGRES_PORT", DEFAULT_PORT))
DB_NAME = os.getenv("DATABASE_NAME", os.getenv("POSTGRES_DB", DEFAULT_NAME))
DB_USER = os.getenv("DATABASE_USER", os.getenv("POSTGRES_USER", DEFAULT_USER))
DB_PASSWORD = os.getenv("DATABASE_PASSWORD", os.getenv("POSTGRES_PASSWORD", DEFAULT_PASSWORD))
DB_SSLMODE = os.getenv("DATABASE_SSLMODE", os.getenv("PGSSLMODE", "require"))

# Connection Pooling
_pool_lock = threading.Lock()
_connection_pool = None  # Lazy-initialized on first call

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

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    @property
    def autocommit(self):
        return self._conn.autocommit

    @autocommit.setter
    def autocommit(self, value):
        self._conn.autocommit = value

    def close(self):
        """Return the connection to the pool instead of destroying it."""
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
    """Lazily initializes and returns the ThreadedConnectionPool singleton."""
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
                sslmode=DB_SSLMODE,
                connect_timeout=10,
            )
            print(f"[PERF] Shared PostgreSQL connection pool initialized (min={_POOL_MIN}, max={_POOL_MAX})")
        except Exception as exc:
            print(f"[PERF] Connection pool init warning: {exc}, falling back to direct connections")
            _connection_pool = None
        return _connection_pool


def get_db_connection(database_name=None):
    """
    Returns a database connection pointing to our PostgreSQL database.
    Uses connection pooling when available, falling back to direct connection.
    """
    dbname = database_name or DB_NAME
    try:
        pool = _get_pool(database_name)
        if pool is not None:
            try:
                raw_conn = pool.getconn()
                if raw_conn and not raw_conn.closed:
                    return _PooledConnection(raw_conn, pool)
            except Exception:
                pass  # Pool busy/exhausted — fall through to direct connection
    except Exception:
        pass

    # Direct connection fallback
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=dbname,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode=DB_SSLMODE,
        connect_timeout=10
    )


def get_db_connection_string(database_name=None):
    """Returns the PostgreSQL connection DSN string."""
    dbname = database_name or DB_NAME
    return f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{dbname}?sslmode={DB_SSLMODE}"
