from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import psycopg2
import psycopg2.extras
import db_config
from connectors.databricks_connector import DatabricksConnector
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
    },
    "wards": {
        "table_name": "wards",
        "primary_key": "ward_id",
        "domain": "Hospital Facility & Ward Units",
        "description": "Hospital ward facilities, department associations, ward types, and floor allocations.",
        "schema": [
            {"column_name": "ward_id", "data_type": "BIGINT", "is_primary": True},
            {"column_name": "ward_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "department_id", "data_type": "BIGINT", "is_primary": False},
            {"column_name": "ward_type", "data_type": "STRING", "is_primary": False},
            {"column_name": "floor_number", "data_type": "INT", "is_primary": False},
            {"column_name": "status", "data_type": "STRING", "is_primary": False},
            {"column_name": "ingestion_timestamp", "data_type": "TIMESTAMP", "is_primary": False}
        ]
    },
    "rooms": {
        "table_name": "rooms",
        "primary_key": "room_id",
        "domain": "Hospital Room & Cubicle Inventory",
        "description": "Hospital room master records, ward associations, room types, capacities, and daily room charges.",
        "schema": [
            {"column_name": "room_id", "data_type": "BIGINT", "is_primary": True},
            {"column_name": "room_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "ward_id", "data_type": "BIGINT", "is_primary": False},
            {"column_name": "room_type", "data_type": "STRING", "is_primary": False},
            {"column_name": "capacity", "data_type": "INT", "is_primary": False},
            {"column_name": "daily_charge", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "status", "data_type": "STRING", "is_primary": False},
            {"column_name": "ingestion_timestamp", "data_type": "TIMESTAMP", "is_primary": False}
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
    limit: Optional[int] = Query(default=None, ge=1, description="Max records to return. Omit for full data."),
    offset: int = Query(default=0, ge=0)
):
    """Query PostgreSQL `beds` table with live active admissions, occupancy status, and pagination."""
    try:
        conn = db_config.get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT 
                b.bed_id,
                b.bed_number,
                b.room_id,
                r.room_number,
                b.ward_id,
                w.ward_name,
                b.bed_type,
                b.daily_charge,
                b.daily_charge AS daily_rate_usd,
                COALESCE(b.status, 'Available') AS occupancy_status,
                COALESCE(b.status, 'Available') AS status,
                a.patient_id,
                a.admission_id,
                a.admission_number,
                TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS patient_name,
                p.patient_code AS patient_number,
                d.display_name AS attending_doctor,
                a.reason_for_admission AS primary_diagnosis
            FROM beds b
            LEFT JOIN rooms r ON b.room_id = r.room_id
            LEFT JOIN wards w ON b.ward_id = w.ward_id
            LEFT JOIN (
                SELECT DISTINCT ON (bed_id) *
                FROM admissions
                WHERE bed_id IS NOT NULL AND LOWER(COALESCE(discharge_status, '')) != 'discharged'
                ORDER BY bed_id, admission_id DESC
            ) a ON b.bed_id = a.bed_id AND b.status = 'Occupied'
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            ORDER BY b.bed_id ASC;
        """)
        all_beds = cur.fetchall()
        cur.close()
        conn.close()

        filtered = []
        for b in all_beds:
            if isinstance(ward_id, int) and b.get("ward_id") != ward_id:
                continue
            if isinstance(ward_name, str) and ward_name.strip() and ward_name.lower() not in (b.get("ward_name") or "").lower():
                continue
            if isinstance(bed_type, str) and bed_type.strip() and bed_type.lower() not in (b.get("bed_type") or "").lower():
                continue
            if isinstance(occupancy_status, str) and occupancy_status.strip() and (b.get("occupancy_status") or "").lower() != occupancy_status.strip().lower():
                continue
            if isinstance(patient_id, int) and b.get("patient_id") != patient_id:
                continue
            filtered.append(dict(b))

        total_rows = len(filtered)
        offset_val = offset if isinstance(offset, int) else 0
        limit_val = limit if isinstance(limit, int) else None
        paged_data = filtered[offset_val : (offset_val + limit_val) if limit_val else None]
        return {
            "table_name": "beds",
            "count": len(paged_data),
            "total_rows": total_rows,
            "data": paged_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query bronze beds: {str(e)}")


@router.get("/beds/summary", summary="Bronze Beds Analytics Summary")
def get_bronze_beds_summary():
    """Computes live summary stats for beds directly from PostgreSQL."""
    try:
        conn = db_config.get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT 
                b.bed_id,
                b.bed_type,
                b.daily_charge,
                COALESCE(b.status, 'Available') AS occupancy_status
            FROM beds b;
        """)
        beds = cur.fetchall()
        cur.close()
        conn.close()

        total_count = len(beds)
        if total_count == 0:
            return {"notice": "No bed records found", "metrics": {}}

        status_counts = {}
        type_counts = {}
        total_rate = 0.0
        occupied_count = 0
        available_count = 0
        maintenance_count = 0

        for b in beds:
            st = b.get("occupancy_status") or "Available"
            status_counts[st] = status_counts.get(st, 0) + 1

            st_lower = st.lower()
            if "occup" in st_lower or "in-use" in st_lower:
                occupied_count += 1
            elif "maint" in st_lower or "clean" in st_lower or "block" in st_lower:
                maintenance_count += 1
            else:
                available_count += 1

            bt = b.get("bed_type", "Standard Inpatient")
            type_counts[bt] = type_counts.get(bt, 0) + 1
            total_rate += float(b.get("daily_charge") or 0)

        return {
            "table_name": "beds",
            "total_records": total_count,
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
        return {
            "notice": f"Beds summary error: {str(e)}",
            "total_records": 0,
            "metrics": {
                "total_beds_count": 0,
                "available_beds_count": 0,
                "occupied_beds_count": 0,
                "maintenance_beds_count": 0
            }
        }


class BedStatusUpdateSchema(BaseModel):
    bed_id: Optional[Union[int, str]] = None
    patient_id: Optional[Union[int, str]] = None
    occupancy_status: str = "Available"


@router.put("/beds/update-status", summary="Update Bed Status")
@router.post("/beds/update-status", summary="Update Bed Status")
def update_bed_status(payload: BedStatusUpdateSchema):
    """Updates occupancy status for specified bed_id or patient_id in PostgreSQL."""
    try:
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        new_status = payload.occupancy_status or "Available"
        if payload.bed_id:
            cur.execute("UPDATE beds SET status = %s WHERE bed_id = %s;", (new_status, payload.bed_id))
        if payload.patient_id:
            cur.execute("""
                UPDATE beds SET status = %s 
                WHERE bed_id IN (SELECT bed_id FROM admissions WHERE patient_id = %s AND bed_id IS NOT NULL);
            """, (new_status, payload.patient_id))
        conn.commit()
        cur.close()
        conn.close()
        db_connector.clear_cache()
    except Exception as e:
        print(f"[ERROR] Failed to update bed status in DB: {e}")

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
    limit: Optional[int] = Query(default=None, ge=1, description="Max records to return. Omit to fetch full data."),
    offset: int = Query(default=0, ge=0)
):
    """Query `health_care.bronze.doctors` table with optional filters and pagination."""
    filters = {}
    if specialty: filters["specialty"] = specialty
    if department_name: filters["department_name"] = department_name
    if hospital_affiliation: filters["hospital_affiliation"] = hospital_affiliation
    if is_active is not None: filters["is_active"] = is_active
    if npi_number: filters["npi_number"] = npi_number

    try:
        return db_connector.query_bronze_table("doctors", filters=filters, limit=limit, offset=offset)
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
    limit: Optional[int] = Query(default=None, ge=1, description="Max records to return. Omit to fetch full data."),
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

    try:
        return db_connector.query_bronze_table("patients", filters=filters, limit=limit, offset=offset)
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
# WARDS ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/wards", summary="Query health_care.bronze.wards Table")
def get_bronze_wards(
    ward_id: Optional[int] = Query(None, description="Filter by ward_id"),
    ward_name: Optional[str] = Query(None, description="Filter by ward_name"),
    ward_type: Optional[str] = Query(None, description="Filter by ward_type (e.g. Private Deluxe, Single Private)"),
    status: Optional[str] = Query(None, description="Filter by status (Active, Inactive)"),
    limit: Optional[int] = Query(default=None, ge=1, description="Max records to return. Omit to fetch full data."),
    offset: int = Query(default=0, ge=0)
):
    """Query `health_care.bronze.wards` table with optional filters and pagination."""
    filters = {}
    if ward_id is not None: filters["ward_id"] = ward_id
    if ward_name: filters["ward_name"] = ward_name
    if ward_type: filters["ward_type"] = ward_type
    if status: filters["status"] = status

    try:
        return db_connector.query_bronze_table("wards", filters=filters, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query bronze wards: {str(e)}")


@router.get("/wards/{ward_id}", summary="Get Single Bronze Ward Record")
def get_bronze_ward_by_id(ward_id: str):
    """Retrieve a single ward record by ward_id or ward_name."""
    try:
        int_id = int(ward_id)
        res = db_connector.query_bronze_table("wards", filters={"ward_id": int_id}, limit=1)
        data = res.get("data", [])
    except ValueError:
        data = []

    if not data:
        res = db_connector.query_bronze_table("wards", filters={"ward_name": ward_id}, limit=1)
        data = res.get("data", [])

    if not data:
        raise HTTPException(status_code=404, detail=f"Bronze ward record '{ward_id}' not found.")
    return data[0]


# ---------------------------------------------------------------------------
# ROOMS ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/rooms", summary="Query health_care.bronze.rooms Table")
def get_bronze_rooms(
    room_id: Optional[int] = Query(None, description="Filter by room_id"),
    room_number: Optional[str] = Query(None, description="Filter by room_number (e.g. RM-001)"),
    ward_id: Optional[int] = Query(None, description="Filter by ward_id"),
    room_type: Optional[str] = Query(None, description="Filter by room_type"),
    status: Optional[str] = Query(None, description="Filter by status (Available, Occupied, Maintenance)"),
    limit: Optional[int] = Query(default=None, ge=1, description="Max records to return. Omit to fetch full data."),
    offset: int = Query(default=0, ge=0)
):
    """Query `health_care.bronze.rooms` table with optional filters and pagination."""
    filters = {}
    if room_id is not None: filters["room_id"] = room_id
    if room_number: filters["room_number"] = room_number
    if ward_id is not None: filters["ward_id"] = ward_id
    if room_type: filters["room_type"] = room_type
    if status: filters["status"] = status

    try:
        return db_connector.query_bronze_table("rooms", filters=filters, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query bronze rooms: {str(e)}")


@router.get("/rooms/{room_id}", summary="Get Single Bronze Room Record")
def get_bronze_room_by_id(room_id: str):
    """Retrieve a single room record by room_id or room_number."""
    try:
        int_id = int(room_id)
        res = db_connector.query_bronze_table("rooms", filters={"room_id": int_id}, limit=1)
        data = res.get("data", [])
    except ValueError:
        data = []

    if not data:
        res = db_connector.query_bronze_table("rooms", filters={"room_number": room_id}, limit=1)
        data = res.get("data", [])

    if not data:
        raise HTTPException(status_code=404, detail=f"Bronze room record '{room_id}' not found.")
    return data[0]


# ---------------------------------------------------------------------------
# DYNAMIC BRONZE TABLE QUERY ENDPOINT
# ---------------------------------------------------------------------------
@router.get("/table/{table_name}", summary="Dynamic Query Endpoint for Bronze Tables")
def query_dynamic_bronze_table(
    table_name: str,
    limit: Optional[int] = Query(default=None, ge=1, description="Max records to return. Omit to fetch full data."),
    offset: int = Query(default=0, ge=0)
):
    """Dynamic pagination and retrieval for Bronze tables."""
    valid_tables = ["beds", "doctors", "patients", "wards", "rooms"]
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' is not supported in Bronze layer. Valid Bronze tables: {valid_tables}")

    try:
        return db_connector.query_bronze_table(table_name, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query Bronze table '{table_name}': {str(e)}")
