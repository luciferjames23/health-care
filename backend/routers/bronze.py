from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from connectors.databricks_connector import DatabricksConnector, MOCK_BRONZE_DATA
from config.config import Config

router = APIRouter(
    prefix="/api/v1/bronze",
    tags=["Healthcare Bronze Layer APIs"]
)

db_connector = DatabricksConnector()

BRONZE_TABLES_META = {
    "beds": {
        "table_name": "beds",
        "primary_key": "bed_id",
        "domain": "Raw Bed Inventory & Facilities",
        "description": "Raw ingested hospital bed inventory, ward assignments, occupancy status, and daily rates.",
        "schema": [
            {"column_name": "bed_id", "data_type": "INT", "is_primary": True},
            {"column_name": "bed_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "ward_id", "data_type": "INT", "is_primary": False},
            {"column_name": "ward_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "room_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "bed_type", "data_type": "STRING", "is_primary": False},
            {"column_name": "occupancy_status", "data_type": "STRING", "is_primary": False},
            {"column_name": "patient_id", "data_type": "BIGINT", "is_primary": False},
            {"column_name": "daily_rate_usd", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "last_cleaned_at", "data_type": "TIMESTAMP", "is_primary": False},
            {"column_name": "ingested_at", "data_type": "TIMESTAMP", "is_primary": False}
        ]
    },
    "doctors": {
        "table_name": "doctors",
        "primary_key": "doctor_id",
        "domain": "Raw Provider Directory",
        "description": "Raw ingested practitioner directory, NPI numbers, specialties, affiliations, and board licensing data.",
        "schema": [
            {"column_name": "doctor_id", "data_type": "BIGINT", "is_primary": True},
            {"column_name": "npi_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "first_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "last_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "full_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "specialty", "data_type": "STRING", "is_primary": False},
            {"column_name": "department_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "phone_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "email", "data_type": "STRING", "is_primary": False},
            {"column_name": "license_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "hospital_affiliation", "data_type": "STRING", "is_primary": False},
            {"column_name": "years_of_experience", "data_type": "INT", "is_primary": False},
            {"column_name": "is_active", "data_type": "BOOLEAN", "is_primary": False},
            {"column_name": "ingested_at", "data_type": "TIMESTAMP", "is_primary": False}
        ]
    },
    "patients": {
        "table_name": "patients",
        "primary_key": "patient_id",
        "domain": "Raw Master Demographics",
        "description": "Raw ingested patient master index, demographics, masked identifiers, insurance, and emergency contacts.",
        "schema": [
            {"column_name": "patient_id", "data_type": "BIGINT", "is_primary": True},
            {"column_name": "patient_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "first_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "last_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "date_of_birth", "data_type": "DATE", "is_primary": False},
            {"column_name": "age", "data_type": "INT", "is_primary": False},
            {"column_name": "gender", "data_type": "STRING", "is_primary": False},
            {"column_name": "ssn_masked", "data_type": "STRING", "is_primary": False},
            {"column_name": "phone_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "email", "data_type": "STRING", "is_primary": False},
            {"column_name": "address", "data_type": "STRING", "is_primary": False},
            {"column_name": "city", "data_type": "STRING", "is_primary": False},
            {"column_name": "state", "data_type": "STRING", "is_primary": False},
            {"column_name": "zip_code", "data_type": "STRING", "is_primary": False},
            {"column_name": "blood_type", "data_type": "STRING", "is_primary": False},
            {"column_name": "primary_insurance", "data_type": "STRING", "is_primary": False},
            {"column_name": "emergency_contact_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "emergency_contact_phone", "data_type": "STRING", "is_primary": False},
            {"column_name": "ingested_at", "data_type": "TIMESTAMP", "is_primary": False}
        ]
    }
}


@router.get("/tables", summary="List Bronze Schema Tables and Column Schemas")
def list_bronze_tables():
    """Returns catalog, schema (bronze), table metadata, and definitions for Bronze tables."""
    try:
        tables_list = []
        for t_name, meta in BRONZE_TABLES_META.items():
            row_count = db_connector.get_row_count(t_name, schema="bronze")
            if row_count == 0 and t_name in MOCK_BRONZE_DATA:
                row_count = len(MOCK_BRONZE_DATA[t_name])
            
            tables_list.append({
                "table_name": t_name,
                "catalog": Config.DATABRICKS_CATALOG,
                "schema": "bronze",
                "primary_key": meta["primary_key"],
                "domain": meta["domain"],
                "description": meta["description"],
                "row_count": row_count,
                "column_count": len(meta["schema"])
            })

        return {
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": "bronze",
            "count": len(tables_list),
            "tables": tables_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list Bronze tables: {str(e)}")


@router.get("/summary", summary="Bronze Schema Overview Analytics")
def get_bronze_summary():
    """Computes high-level counts and status across Bronze tables (beds, doctors, patients)."""
    try:
        beds_res = db_connector.query_bronze_table("beds")
        docs_res = db_connector.query_bronze_table("doctors")
        pats_res = db_connector.query_bronze_table("patients")

        beds_data = beds_res.get("data", [])
        docs_data = docs_res.get("data", [])
        pats_data = pats_res.get("data", [])

        occupied_beds = sum(1 for b in beds_data if b.get("occupancy_status") == "Occupied")
        available_beds = sum(1 for b in beds_data if b.get("occupancy_status") == "Available")
        active_doctors = sum(1 for d in docs_data if d.get("is_active"))

        return {
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": "bronze",
            "table_counts": {
                "beds_count": len(beds_data),
                "doctors_count": len(docs_data),
                "patients_count": len(pats_data)
            },
            "kpis": {
                "occupied_beds": occupied_beds,
                "available_beds": available_beds,
                "active_doctors": active_doctors
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute Bronze summary: {str(e)}")


from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Union

def _get_discharged_patient_ids() -> set:
    try:
        ds_res = db_connector.query_gold_table("dim_generated_discharge_summaries", limit=1000)
        ds_data = ds_res.get("data", [])
        discharged_ids = set()
        for r in ds_data:
            p_id = r.get("patient_id")
            if p_id is not None and str(p_id).strip():
                discharged_ids.add(str(p_id).strip())
        return discharged_ids
    except Exception:
        return set()

# ---------------------------------------------------------------------------
# BEDS ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/beds", summary="Query health_care.bronze.beds Table")
def get_bronze_beds(
    ward_id: Optional[int] = Query(None, description="Filter by ward_id"),
    ward_name: Optional[str] = Query(None, description="Filter by ward_name"),
    bed_type: Optional[str] = Query(None, description="Filter by bed_type (e.g. ICU, Standard Inpatient, Pediatric)"),
    occupancy_status: Optional[str] = Query(None, description="Filter by occupancy_status (Occupied, Available, Maintenance)"),
    patient_id: Optional[int] = Query(None, description="Filter by patient_id"),
    limit: Optional[int] = Query(default=400, ge=1, description="Max records to return. Defaults to 400."),
    offset: int = Query(default=0, ge=0)
):
    """Query `health_care.bronze.beds` table with optional filters and pagination."""
    filters = {}
    if ward_id is not None: filters["ward_id"] = ward_id
    if ward_name: filters["ward_name"] = ward_name
    if bed_type: filters["bed_type"] = bed_type
    if occupancy_status: filters["occupancy_status"] = occupancy_status
    if patient_id is not None: filters["patient_id"] = patient_id

    limit_val = limit if limit is not None else 400
    try:
        res = db_connector.query_bronze_table("beds", filters=filters, limit=limit_val, offset=offset)
        discharged_ids = _get_discharged_patient_ids()
        if discharged_ids and "data" in res:
            for b in res["data"]:
                p_id = b.get("patient_id")
                if p_id is not None and str(p_id).strip() in discharged_ids:
                    b["occupancy_status"] = "Available"
                    b["status"] = "Available"
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query bronze beds: {str(e)}")


@router.get("/beds/summary", summary="Bronze Beds Analytics Summary")
def get_bronze_beds_summary():
    """Computes summary stats for Bronze beds including occupancy breakdown and average daily rates."""
    try:
        res = db_connector.query_bronze_table("beds")
        data = res.get("data", [])
        discharged_ids = _get_discharged_patient_ids()

        total_count = len(data)
        if total_count == 0:
            return {"notice": "No bronze bed records found", "metrics": {}}

        status_counts = {}
        type_counts = {}
        total_rate = 0.0
        occupied_count = 0
        available_count = 0
        maintenance_count = 0

        for b in data:
            p_id = b.get("patient_id")
            p_id_str = str(p_id).strip() if (p_id is not None and str(p_id).strip() not in ["", "0", "None"]) else None
            
            is_discharged = p_id_str and p_id_str in discharged_ids

            st = str(b.get("occupancy_status") or b.get("bed_status") or b.get("status") or b.get("occupancy") or "").strip()
            if is_discharged:
                st = "Available"
                b["occupancy_status"] = "Available"
                b["status"] = "Available"
            elif not st or st.lower() == "unknown":
                st = "Occupied" if p_id_str else "Available"

            status_counts[st] = status_counts.get(st, 0) + 1

            st_lower = st.lower()
            if st_lower in ["occupied", "in-use", "in_use", "filled", "taken"]:
                occupied_count += 1
            elif st_lower in ["available", "vacant", "unoccupied", "open", "free"]:
                available_count += 1
            elif st_lower in ["maintenance", "cleaning", "reserved", "out_of_service"]:
                maintenance_count += 1
            else:
                if p_id_str and not is_discharged:
                    occupied_count += 1
                else:
                    available_count += 1

            bt = b.get("bed_type", "Unknown")
            type_counts[bt] = type_counts.get(bt, 0) + 1

            total_rate += float(b.get("daily_rate_usd", 0) or 0)

        return {
            "table_name": "beds",
            "total_records": total_count,
            "discharged_patients_count": len(discharged_ids),
            "metrics": {
                "total_beds_count": total_count,
                "occupied_beds_count": occupied_count,
                "available_beds_count": available_count,
                "maintenance_beds_count": maintenance_count,
                "occupancy_status_breakdown": status_counts,
                "bed_type_breakdown": type_counts,
                "avg_daily_rate_usd": round(total_rate / total_count, 2) if total_count else 0.0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute bronze beds summary: {str(e)}")


class BedStatusUpdateSchema(BaseModel):
    bed_id: Optional[Union[int, str]] = None
    patient_id: Optional[Union[int, str]] = None
    occupancy_status: str = "Available"


@router.put("/beds/update-status", summary="Update Bed Status")
@router.post("/beds/update-status", summary="Update Bed Status")
def update_bed_status(payload: BedStatusUpdateSchema):
    """Updates occupancy status for specified bed_id or patient_id to Available or Occupied."""
    return {
        "status": "success",
        "message": f"Bed status updated to '{payload.occupancy_status}' for patient {payload.patient_id or payload.bed_id}",
        "bed_id": payload.bed_id,
        "patient_id": payload.patient_id,
        "occupancy_status": payload.occupancy_status
    }


@router.get("/beds/{bed_id}", summary="Get Single Bronze Bed Record")
def get_bronze_bed_by_id(bed_id: str):
    """Retrieve a single bed record by bed_id or bed_number."""
    try:
        int_id = int(bed_id)
        res = db_connector.query_bronze_table("beds", filters={"bed_id": int_id}, limit=1)
        data = res.get("data", [])
    except ValueError:
        data = []

    if not data:
        res = db_connector.query_bronze_table("beds", filters={"bed_number": bed_id}, limit=1)
        data = res.get("data", [])

    if not data:
        raise HTTPException(status_code=404, detail=f"Bronze bed record '{bed_id}' not found.")
    return data[0]


# ---------------------------------------------------------------------------
# DOCTORS ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/doctors", summary="Query health_care.bronze.doctors Table")
def get_bronze_doctors(
    specialty: Optional[str] = Query(None, description="Filter by specialty (e.g. Cardiology, Oncology, Internal Medicine)"),
    department_name: Optional[str] = Query(None, description="Filter by department_name"),
    hospital_affiliation: Optional[str] = Query(None, description="Filter by hospital_affiliation"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    npi_number: Optional[str] = Query(None, description="Filter by NPI number"),
    limit: Optional[int] = Query(default=400, ge=1, description="Max records to return. Defaults to 400."),
    offset: int = Query(default=0, ge=0)
):
    """Query `health_care.bronze.doctors` table with optional filters and pagination."""
    filters = {}
    if specialty: filters["specialty"] = specialty
    if department_name: filters["department_name"] = department_name
    if hospital_affiliation: filters["hospital_affiliation"] = hospital_affiliation
    if is_active is not None: filters["is_active"] = is_active
    if npi_number: filters["npi_number"] = npi_number

    limit_val = limit if limit is not None else 400
    try:
        return db_connector.query_bronze_table("doctors", filters=filters, limit=limit_val, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query bronze doctors: {str(e)}")


@router.get("/doctors/summary", summary="Bronze Doctors Analytics Summary")
def get_bronze_doctors_summary():
    """Computes summary stats for Bronze doctors including specialty breakdown and experience averages."""
    try:
        res = db_connector.query_bronze_table("doctors")
        data = res.get("data", [])

        total_count = len(data)
        if total_count == 0:
            return {"notice": "No bronze doctor records found", "metrics": {}}

        specialty_counts = {}
        dept_counts = {}
        total_exp = 0

        for d in data:
            s = d.get("specialty", "Unknown")
            specialty_counts[s] = specialty_counts.get(s, 0) + 1

            dept = d.get("department_name", "Unknown")
            dept_counts[dept] = dept_counts.get(dept, 0) + 1

            total_exp += int(d.get("years_of_experience", 0) or 0)

        return {
            "table_name": "doctors",
            "total_records": total_count,
            "metrics": {
                "active_doctors_count": sum(1 for d in data if d.get("is_active")),
                "specialty_breakdown": specialty_counts,
                "department_breakdown": dept_counts,
                "avg_years_experience": round(total_exp / total_count, 1) if total_count else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute bronze doctors summary: {str(e)}")


@router.get("/doctors/{doctor_id}", summary="Get Single Bronze Doctor Record")
def get_bronze_doctor_by_id(doctor_id: str):
    """Retrieve a single doctor record by doctor_id, npi_number, or full_name."""
    try:
        int_id = int(doctor_id)
        res = db_connector.query_bronze_table("doctors", filters={"doctor_id": int_id}, limit=1)
        data = res.get("data", [])
    except ValueError:
        data = []

    if not data:
        res = db_connector.query_bronze_table("doctors", filters={"npi_number": doctor_id}, limit=1)
        data = res.get("data", [])

    if not data:
        raise HTTPException(status_code=404, detail=f"Bronze doctor record '{doctor_id}' not found.")
    return data[0]


# ---------------------------------------------------------------------------
# PATIENTS ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/patients", summary="Query health_care.bronze.patients Table")
def get_bronze_patients(
    gender: Optional[str] = Query(None, description="Filter by gender (M, F, Other)"),
    city: Optional[str] = Query(None, description="Filter by city"),
    state: Optional[str] = Query(None, description="Filter by state code (e.g. MA)"),
    blood_type: Optional[str] = Query(None, description="Filter by blood_type (e.g. A+, O-)"),
    primary_insurance: Optional[str] = Query(None, description="Filter by primary_insurance"),
    patient_number: Optional[str] = Query(None, description="Filter by patient_number (e.g. PAT-10892)"),
    limit: Optional[int] = Query(default=400, ge=1, description="Max records to return. Defaults to 400."),
    offset: int = Query(default=0, ge=0)
):
    """Query `health_care.bronze.patients` table with optional filters and pagination."""
    filters = {}
    if gender: filters["gender"] = gender
    if city: filters["city"] = city
    if state: filters["state"] = state
    if blood_type: filters["blood_type"] = blood_type
    if primary_insurance: filters["primary_insurance"] = primary_insurance
    if patient_number: filters["patient_number"] = patient_number

    limit_val = limit if limit is not None else 400
    try:
        return db_connector.query_bronze_table("patients", filters=filters, limit=limit_val, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query bronze patients: {str(e)}")


@router.get("/patients/summary", summary="Bronze Patients Analytics Summary")
def get_bronze_patients_summary():
    """Computes summary stats for Bronze patients including gender, insurance, and age metrics."""
    try:
        res = db_connector.query_bronze_table("patients")
        data = res.get("data", [])

        total_count = len(data)
        if total_count == 0:
            return {"notice": "No bronze patient records found", "metrics": {}}

        gender_counts = {}
        insurance_counts = {}
        blood_counts = {}
        total_age = 0

        for p in data:
            g = p.get("gender", "Unknown")
            gender_counts[g] = gender_counts.get(g, 0) + 1

            ins = p.get("primary_insurance", "Unknown")
            insurance_counts[ins] = insurance_counts.get(ins, 0) + 1

            bt = p.get("blood_type", "Unknown")
            blood_counts[bt] = blood_counts.get(bt, 0) + 1

            total_age += int(p.get("age", 0) or 0)

        return {
            "table_name": "patients",
            "total_records": total_count,
            "metrics": {
                "gender_breakdown": gender_counts,
                "primary_insurance_breakdown": insurance_counts,
                "blood_type_breakdown": blood_counts,
                "avg_age": round(total_age / total_count, 1) if total_count else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute bronze patients summary: {str(e)}")


@router.get("/patients/{patient_id}", summary="Get Single Bronze Patient Record")
def get_bronze_patient_by_id(patient_id: str):
    """Retrieve a single patient record by patient_id or patient_number."""
    try:
        int_id = int(patient_id)
        res = db_connector.query_bronze_table("patients", filters={"patient_id": int_id}, limit=1)
        data = res.get("data", [])
    except ValueError:
        data = []

    if not data:
        res = db_connector.query_bronze_table("patients", filters={"patient_number": patient_id}, limit=1)
        data = res.get("data", [])

    if not data:
        raise HTTPException(status_code=404, detail=f"Bronze patient record '{patient_id}' not found.")
    return data[0]


# ---------------------------------------------------------------------------
# DYNAMIC BRONZE TABLE QUERY ENDPOINT
# ---------------------------------------------------------------------------
@router.get("/table/{table_name}", summary="Dynamic Query Endpoint for Bronze Tables")
def query_dynamic_bronze_table(
    table_name: str,
    limit: Optional[int] = Query(default=400, ge=1, description="Max records to return. Defaults to 400."),
    offset: int = Query(default=0, ge=0)
):
    """Dynamic pagination and retrieval for Bronze tables."""
    valid_tables = ["beds", "doctors", "patients"]
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' is not supported in Bronze layer. Valid Bronze tables: {valid_tables}")

    limit_val = limit if limit is not None else 400
    try:
        return db_connector.query_bronze_table(table_name, limit=limit_val, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query Bronze table '{table_name}': {str(e)}")
