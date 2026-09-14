import sys
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from contextlib import asynccontextmanager
from config.config import Config
from connectors.databricks_connector import DatabricksConnector
from routers.gold import router as gold_router
from routers.bronze import router as bronze_router
from routers.notebook import router as notebook_router
from routers.jobrun import router as jobrun_router
from routers.radiology import router as radiology_router, init_radiology_models, shutdown_radiology_models

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_radiology_models()
    yield
    shutdown_radiology_models()

app = FastAPI(
    title="Healthcare Lakehouse & AI Radiology API",
    description="Unified REST API service for Healthcare Clinical Lakehouse and AI Radiology Diagnostics",
    version="2.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gold_router)
app.include_router(bronze_router)
app.include_router(notebook_router)
app.include_router(jobrun_router)
app.include_router(radiology_router)

db_connector = DatabricksConnector()

@app.get("/")
def read_root():
    return {
        "service": "Healthcare Prototype Databricks Gold API",
        "status": "online",
        "catalog": Config.DATABRICKS_CATALOG,
        "schema": Config.DATABRICKS_SCHEMA,
        "docs": "/docs"
    }

@app.get("/api/v1/health")
def health_check():
    try:
        conn = db_connector.get_connection()
        conn.close()
        return {
            "status": "healthy",
            "databricks_connected": True,
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": Config.DATABRICKS_SCHEMA
        }
    except Exception as e:
        return {
            "status": "healthy",
            "databricks_connected": False,
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": Config.DATABRICKS_SCHEMA,
            "mode": "Fallback Engine Active",
            "notice": f"Databricks offline or quota reached ({str(e)})"
        }

@app.get("/api/v1/config")
def get_config():
    return {
        "databricks": {
            "hostname": Config.DATABRICKS_SERVER_HOSTNAME,
            "http_path": Config.DATABRICKS_HTTP_PATH,
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": Config.DATABRICKS_SCHEMA
        }
    }

@app.get("/api/v1/gold/tables")
def list_gold_tables(schema: Optional[str] = None):
    try:
        target_schema = schema or Config.DATABRICKS_SCHEMA
        tables = db_connector.list_tables(schema=target_schema)
        return {
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": target_schema,
            "count": len(tables),
            "tables": tables
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch gold tables: {str(e)}")

@app.get("/api/v1/gold/tables/{table_name}/schema")
def get_table_schema(table_name: str, schema: Optional[str] = None):
    try:
        target_schema = schema or Config.DATABRICKS_SCHEMA
        columns = db_connector.get_table_schema(table_name=table_name, schema=target_schema)
        if not columns:
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found or has no columns in schema '{target_schema}'")
        return {
            "table_name": table_name,
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": target_schema,
            "column_count": len(columns),
            "columns": columns
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch schema for table '{table_name}': {str(e)}")

@app.get("/api/v1/gold/tables/{table_name}/data")
def query_table_data(
    table_name: str,
    limit: Optional[int] = Query(None, ge=1, description="Max rows to return. Omit for full data."),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    schema: Optional[str] = None
):
    try:
        target_schema = schema or Config.DATABRICKS_SCHEMA
        result = db_connector.query_table(table_name=table_name, limit=limit, offset=offset, schema=target_schema)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query table '{table_name}': {str(e)}")

@app.get("/api/v1/gold/summary")
def get_gold_summary():
    try:
        tables = db_connector.list_tables(schema=Config.DATABRICKS_SCHEMA)
        total_rows = sum(t["row_count"] for t in tables)
        return {
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": Config.DATABRICKS_SCHEMA,
            "total_tables": len(tables),
            "total_records": total_rows,
            "tables": tables
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute gold summary: {str(e)}")
