import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
BASE_DIR = Path(__file__).resolve().parent.parent
env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)

class Config:

    # Databricks Configuration
    DATABRICKS_SERVER_HOSTNAME = os.getenv("DATABRICKS_SERVER_HOSTNAME", "")
    DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")
    DATABRICKS_ACCESS_TOKEN = os.getenv("DATABRICKS_ACCESS_TOKEN", "")
    DATABRICKS_WORKSPACE_ID = os.getenv("DATABRICKS_WORKSPACE_ID", "")
    DATABRICKS_CATALOG = os.getenv("DATABRICKS_CATALOG", "")
    DATABRICKS_SCHEMA = os.getenv("DATABRICKS_SCHEMA", "")

    # PostgreSQL Database Configuration
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "rivesca.eu.db.rivestack.io")
    POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", 5432))
    POSTGRES_DB = os.getenv("POSTGRES_DB", "rv_pbpkghvg")
    POSTGRES_USER = os.getenv("POSTGRES_USER", "rv_pbpkghvg")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "d_3zzwU0qzrtkujXG6YVBGlXGx9-kxp05cfBMiHqQ48=")

