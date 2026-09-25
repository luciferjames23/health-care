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
# Safely import and mount available routers
routers_to_mount = []

try:
    from routers.gold import router as gold_router
    routers_to_mount.append(gold_router)
except Exception as e:
    print(f"Failed to load gold router: {e}")

try:
    from routers.bronze import router as bronze_router
    routers_to_mount.append(bronze_router)
except Exception as e:
    print(f"Failed to load bronze router: {e}")

try:
    from routers.notebook import router as router_notebook
    routers_to_mount.append(router_notebook)
except Exception as e:
    print(f"Failed to load notebook router: {e}")

try:
    from routers.jobrun import router as jobrun_router
    routers_to_mount.append(jobrun_router)
except Exception as e:
    print(f"Failed to load jobrun router: {e}")

try:
    from routers.discharge_agent import router as discharge_agent_router
    routers_to_mount.append(discharge_agent_router)
except Exception as e:
    print(f"Failed to load discharge_agent router: {e}")

try:
    from routers.discharge_summary_llm import router as discharge_summary_llm_router
    routers_to_mount.append(discharge_summary_llm_router)
except Exception as e:
    print(f"Failed to load discharge_summary_llm router: {e}")

try:
    from routers.radiology import router as radiology_router, pacs_router, scans_router
    routers_to_mount.extend([radiology_router, pacs_router, scans_router])
except ModuleNotFoundError as e:
    if e.name in ("torch", "torchvision", "torchaudio"):
        print("[INFO] Radiology router skipped (PyTorch optional module not installed)")
    else:
        print(f"Radiology router unavailable: {e}")
except Exception as e:
    print(f"Radiology router unavailable: {e}")

try:
    from agent.router import router as agent_router
    routers_to_mount.append(agent_router)
except Exception as e:
    print(f"Failed to load agent router: {e}")

try:
    from routers.financial_revenue import router as finance_router
    routers_to_mount.append(finance_router)
except Exception as e:
    print(f"Failed to load finance router: {e}")

try:
    from routers.clinical_operations import router as clinical_ops_router
    routers_to_mount.append(clinical_ops_router)
except Exception as e:
    print(f"Failed to load clinical operations router: {e}")

try:
    from routers.pharmacy_supply import router as pharmacy_supply_router
    routers_to_mount.append(pharmacy_supply_router)
except Exception as e:
    print(f"Failed to load pharmacy supply router: {e}")

try:
    from routers.admin_system import router as admin_system_router
    routers_to_mount.append(admin_system_router)
except Exception as e:
    print(f"Failed to load admin system router: {e}")

app = FastAPI(
    title="Healthcare Clinical Intelligence API",
    description="REST API service querying Healthcare clinical tables and AI clinical models",
    version="2.1.0"
)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    traceback.print_exc()
    origin = request.headers.get("origin") or "http://localhost:5173"
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )

for r in routers_to_mount:
    app.include_router(r)


# --- Prototype AI Patient Desk, Appointments & Operational Routers ---
import api.agent_routes as proto_agent_routes
import api.whatsapp_routes as proto_whatsapp_routes
import api.dashboard_routes as proto_dashboard_routes
import api.auth_routes as proto_auth_routes
from routers.appointments_proto import router as proto_appointments_router
from routers.rcm_beds import router as rcm_beds_router
from appointment_service import AppointmentError, EntityNotFoundError

@app.exception_handler(EntityNotFoundError)
def entity_not_found_handler(request, exc: EntityNotFoundError):
    return JSONResponse(
        status_code=404,
        content={"success": False, "error_code": exc.error_code, "message": exc.message}
    )

@app.exception_handler(AppointmentError)
def appointment_error_handler(request, exc: AppointmentError):
    return JSONResponse(
        status_code=400,
        content={"success": False, "error_code": exc.error_code, "message": exc.message}
    )

app.include_router(proto_agent_routes.router)
app.include_router(proto_agent_routes.knowledge_router)
app.include_router(proto_whatsapp_routes.router)
app.include_router(proto_dashboard_routes.router)
app.include_router(proto_auth_routes.router)
app.include_router(proto_appointments_router)
app.include_router(rcm_beds_router)

@app.on_event("startup")
def on_startup():
    try:
        from routers.radiology import initialize_radiology
        initialize_radiology()
    except ModuleNotFoundError as e:
        import logging
        if e.name in ("torch", "torchvision", "torchaudio"):
            logging.getLogger("uvicorn").info("Radiology auto-init skipped (PyTorch optional module not installed)")
        else:
            logging.getLogger("uvicorn").warning("Radiology auto-init on startup: %s", e)
    except Exception as e:
        import logging
        logging.getLogger("uvicorn").warning("Radiology auto-init on startup: %s", e)

    try:
        from db.init_clinical_tables import init_clinical_tables
        init_clinical_tables()
    except Exception as e:
        import logging
        logging.getLogger("uvicorn").warning("Clinical tables auto-init on startup: %s", e)

@app.get("/health")
def health_alias():
    return {"status": "ok", "service": "Healthcare Unified Platform API"}

db_connector = DatabricksConnector()

@app.get("/")
def read_root():
    return {
        "service": "Healthcare Clinical Intelligence API",
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

from routers.imaging_orders import router as imaging_orders_router
app.include_router(imaging_orders_router)
from routers.radiology_clarifications import router as clarification_router
app.include_router(clarification_router)
from routers.imaging_history import router as imaging_history_router
app.include_router(imaging_history_router)
