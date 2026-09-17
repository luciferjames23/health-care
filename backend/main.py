import sys
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config.config import Config
from connectors.databricks_connector import DatabricksConnector
from routers.gold import router as gold_router
from routers.bronze import router as bronze_router
from routers.notebook import router as notebook_router
from routers.jobrun import router as jobrun_router
from routers.discharge_agent import router as discharge_agent_router
from routers.discharge_summary_llm import router as discharge_summary_llm_router
from routers.radiology import router as radiology_router, pacs_router
from agent.router import router as agent_router

app = FastAPI(
    title="Healthcare PostgreSQL Lakehouse API",
    description="REST API service querying Healthcare clinical tables and AI Lakehouse in PostgreSQL (`rv_pbpkghvg` at `rivesca.eu.db.rivestack.io`)",
    version="2.1.0"
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
app.include_router(discharge_agent_router)
app.include_router(discharge_summary_llm_router)
app.include_router(radiology_router)
app.include_router(pacs_router)
app.include_router(agent_router)

db_connector = DatabricksConnector()

@app.get("/")
def read_root():
    return {
        "service": "Healthcare PostgreSQL Lakehouse API",
        "status": "online",
        "database": Config.POSTGRES_DB,
        "host": Config.POSTGRES_HOST,
        "schema": "public",
        "docs": "/docs"
    }

@app.get("/api/v1/health")
def health_check():
    try:
        conn = db_connector.get_connection()
        conn.close()
        return {
            "status": "healthy",
            "postgres_connected": True,
            "databricks_connected": True,  # Backward compatibility for frontend health indicator
            "database": Config.POSTGRES_DB,
            "host": Config.POSTGRES_HOST,
            "schema": "public"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "postgres_connected": False,
            "databricks_connected": False,
            "database": Config.POSTGRES_DB,
            "host": Config.POSTGRES_HOST,
            "notice": f"Database offline or connecting issue ({str(e)})"
        }

@app.get("/api/v1/config")
def get_config():
    return {
        "database": {
            "type": "PostgreSQL",
            "hostname": Config.POSTGRES_HOST,
            "port": Config.POSTGRES_PORT,
            "database": Config.POSTGRES_DB,
            "schema": "public"
        },
        "databricks": {
            "hostname": Config.DATABRICKS_SERVER_HOSTNAME,
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
