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
