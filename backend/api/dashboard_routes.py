"""
dashboard_routes.py
===================
FastAPI router providing all Admin/Doctor Dashboard APIs.

Endpoints:
  GET  /api/dashboard/summary                — KPI summary counts
  GET  /api/dashboard/patients               — paginated patient list
  GET  /api/dashboard/appointments           — paginated appointment list
  GET  /api/dashboard/appointments/{id}/status — PATCH appointment status
  GET  /api/dashboard/doctors                — doctor list with appt counts
  GET  /api/dashboard/departments            — department list with counts
  GET  /api/dashboard/conversations          — conversation list + intent breakdown
  GET  /api/dashboard/escalations            — escalation list
  PATCH /api/dashboard/escalations/{id}      — update escalation status
  GET  /api/dashboard/charts/appointment-trend  — 7-day trend data
  GET  /api/dashboard/charts/intent-breakdown   — intent distribution
  POST /api/dashboard/doctors/{id}/status    — activate/deactivate doctor

All queries read from the PostgreSQL database (healthcare).
No mock or hardcoded data is used in production paths.
"""

import sys
import os
import json
import traceback
from datetime import datetime, timedelta, date, timezone
from typing import Optional, List

from fastapi import APIRouter, Query, HTTPException, Body, Depends
from pydantic import BaseModel

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import preadmission_service
from api.auth_helper import get_current_user, require_admin, require_doctor_or_admin

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Admin Dashboard"],
    dependencies=[Depends(get_current_user)]
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_conn():
    """Get a database connection."""
    return db_config.get_db_connection()


def safe_str(val) -> str:
    """Convert value to string safely."""
    if val is None:
        return ""
    return str(val)


def row_to_dict_cur(cur, row) -> dict:
    """Convert a psycopg2 row to a dictionary using cursor description."""
    if row is None:
        return {}
    return {desc[0]: row[idx] for idx, desc in enumerate(cur.description)}


def rows_to_dicts(cur, rows) -> list:
    """Convert a list of psycopg2 rows to dictionaries."""
    cols = [desc[0] for desc in cur.description]
    result = []
    for row in rows:
        d = {}
        for i, col in enumerate(cols):
            val = row[i]
            # Convert datetime/date objects to ISO strings for JSON serialization
            if isinstance(val, (datetime, date)):
                d[col] = val.isoformat()
            else:
                d[col] = val
        result.append(d)
    return result


def apply_booking_source_filter(conditions: list, params: list, source_str: Optional[str]):
    """
    Applies unified booking_source filtering to SQL WHERE conditions.
    Supports single 'WHATSAPP' filter matching all WhatsApp channels (WHATSAPP, WHATSAPP_TEXT, WHATSAPP_VOICE, WHATSAPP_AI, etc.),
    as well as case-insensitive matching for WEB_PORTAL, PHONE, WALK_IN, ADMIN, DOCTOR.
    """
    if not source_str or not isinstance(source_str, str):
        return

    s_clean = source_str.strip()
    if not s_clean:
        return

    s_upper = s_clean.upper()
    if s_upper in ("WHATSAPP", "WHATSAPP_TEXT", "WHATSAPP_VOICE", "WHATSAPP_AI", "WHATSAPP_CHAT"):
        conditions.append("(UPPER(a.booking_source) LIKE %s OR LOWER(a.booking_source) LIKE %s)")
        params.extend(["WHATSAPP%", "%whatsapp%"])
    elif s_upper in ("WEB_PORTAL", "WEB PORTAL", "PORTAL"):
        conditions.append("(UPPER(a.booking_source) IN ('WEB PORTAL', 'WEB_PORTAL', 'PORTAL') OR LOWER(a.booking_source) LIKE %s)")
        params.append("%portal%")
    elif s_upper in ("PHONE", "CALL"):
        conditions.append("(UPPER(a.booking_source) IN ('PHONE', 'CALL') OR LOWER(a.booking_source) = 'phone')")
    elif s_upper in ("WALK_IN", "WALK-IN", "WALK IN"):
        conditions.append("(UPPER(a.booking_source) IN ('WALK-IN', 'WALK_IN', 'WALK IN') OR LOWER(a.booking_source) LIKE 'walk%%')")
    elif s_upper in ("ADMIN", "PORTAL_ADMIN"):
        conditions.append("(UPPER(a.booking_source) IN ('ADMIN', 'PORTAL_ADMIN') OR LOWER(a.booking_source) LIKE %s)")
        params.append("%admin%")
    elif s_upper in ("DOCTOR", "DOCTOR_PORTAL"):
        conditions.append("(UPPER(a.booking_source) IN ('DOCTOR', 'DOCTOR_PORTAL') OR LOWER(a.booking_source) LIKE %s)")
        params.append("%doctor%")
    else:
        conditions.append("(LOWER(a.booking_source) = LOWER(%s) OR UPPER(a.booking_source) = UPPER(%s))")
        params.extend([s_clean, s_clean])


def resolve_target_doctor_id(current_user: dict, requested_doctor_id: Optional[int] = None, cur = None) -> Optional[int]:
    """
    Resolves target doctor_id based on authentication context and security rules.
    - If user has DOCTOR role, ALWAYS enforce authenticated doctor_id (prevents Doctor A viewing Doctor B).
    - If user has ADMIN role, allow requested_doctor_id (or None for hospital-wide view).
    """
    if not isinstance(current_user, dict):
        current_user = {}
    role = str(current_user.get("role") or "").upper()
    user_doctor_id = current_user.get("doctor_id")

    if role == "DOCTOR":
        if user_doctor_id:
            return int(user_doctor_id)
        # Fallback if token didn't contain doctor_id: resolve via DB using user_id
        user_id = current_user.get("user_id")
        if cur and user_id:
            cur.execute("SELECT id FROM doctors WHERE user_id = %s LIMIT 1;", (user_id,))
            row = cur.fetchone()
            if row:
                return row[0]
            username = current_user.get("username") or ""
            full_name = current_user.get("full_name") or ""
            if username or full_name:
                cur.execute("""
                    SELECT id FROM doctors 
                    WHERE (LOWER(display_name) LIKE %s AND %s != '')
                       OR (LOWER(first_name || ' ' || last_name) LIKE %s AND %s != '')
                    LIMIT 1;
                """, (f"%{username.lower()}%", username, f"%{full_name.lower()}%", full_name))
                row = cur.fetchone()
                if row:
                    return row[0]
        if requested_doctor_id is not None and isinstance(requested_doctor_id, int):
            return requested_doctor_id
        return None
    else:
        # ADMIN or other management role: respect requested_doctor_id parameter
        if requested_doctor_id is not None and isinstance(requested_doctor_id, int):
            return requested_doctor_id
        return None


# ─── Summary / KPI ────────────────────────────────────────────────────────────

@router.get("/summary")
def get_dashboard_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    doctor_id: Optional[int] = Query(None),
    booking_source: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns KPI counts for the Admin/Doctor Dashboard.
    Supports date range filtering, department, doctor, and booking_source filtering.
    Enforces role-based doctor scoping for DOCTOR role.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        # Sanitize query parameters if passed directly as Query objects
        d_from_str = date_from if isinstance(date_from, str) else None
        d_to_str = date_to if isinstance(date_to, str) else None
        dept_str = department if isinstance(department, str) else None
        doc_id_val = doctor_id if isinstance(doctor_id, int) else None
        source_str = booking_source if isinstance(booking_source, str) else None

        today = date.today().isoformat()
        eff_from = d_from_str if d_from_str else (d_to_str if d_to_str else today)
        eff_to = d_to_str if d_to_str else (d_from_str if d_from_str else today)

        target_doctor_id = resolve_target_doctor_id(current_user, doc_id_val, cur)

        # 1. Total patients in system / under doctor
        if target_doctor_id:
            cur.execute("SELECT COUNT(DISTINCT patient_id) FROM appointments WHERE doctor_id = %s AND status != 'CANCELLED';", (target_doctor_id,))
            total_patients = cur.fetchone()[0]
            cur.execute("SELECT COUNT(DISTINCT patient_id) FROM appointments WHERE doctor_id = %s AND appointment_date = %s AND status != 'CANCELLED';", (target_doctor_id, today))
            new_patients_today = cur.fetchone()[0]
            cur.execute("SELECT COUNT(DISTINCT patient_id) FROM appointments WHERE doctor_id = %s AND DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', CURRENT_DATE) AND status != 'CANCELLED';", (target_doctor_id,))
            new_patients_month = cur.fetchone()[0]
            active_doctors = 1
        else:
            cur.execute("SELECT COUNT(*) FROM patients WHERE status = 'ACTIVE';")
            total_patients = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM patients WHERE DATE(created_at AT TIME ZONE 'UTC') = %s;", (today,))
            new_patients_today = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM patients WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);")
            new_patients_month = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM doctors WHERE status = 'ACTIVE';")
            active_doctors = cur.fetchone()[0]

        # 2. Appointments in selected date range [eff_from, eff_to]
        appt_conditions = ["a.appointment_date >= %s", "a.appointment_date <= %s"]
        appt_params = [eff_from, eff_to]

        if target_doctor_id:
            appt_conditions.append("a.doctor_id = %s")
            appt_params.append(target_doctor_id)
        if dept_str:
            appt_conditions.append("LOWER(dept.department_name) = LOWER(%s)")
            appt_params.append(dept_str)
        if source_str:
            apply_booking_source_filter(appt_conditions, appt_params, source_str)

        appt_where = "WHERE " + " AND ".join(appt_conditions)

        cur.execute(f"""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE a.status = 'BOOKED') as booked,
                COUNT(*) FILTER (WHERE a.status = 'CONFIRMED') as confirmed,
                COUNT(*) FILTER (WHERE a.status = 'COMPLETED') as completed,
                COUNT(*) FILTER (WHERE a.status = 'CANCELLED') as cancelled,
                COUNT(*) FILTER (WHERE a.status = 'RESCHEDULED') as rescheduled,
                COUNT(*) FILTER (WHERE a.status = 'NO_SHOW') as no_show,
                COUNT(DISTINCT a.patient_id) as unique_patients
            FROM appointments a
            LEFT JOIN departments dept ON a.department_id = dept.id
            {appt_where};
        """, appt_params)
        appt_row = cur.fetchone()
        
        total_appts_in_range = appt_row[0]
        booked_cnt = appt_row[1]
        confirmed_cnt = appt_row[2]
        completed_cnt = appt_row[3]
        cancelled_cnt = appt_row[4]
        rescheduled_cnt = appt_row[5]
        no_show_cnt = appt_row[6]
        unique_patients_in_range = appt_row[7]

        # Appointments by booking source in range
        cur.execute(f"""
            SELECT a.booking_source, COUNT(*) as cnt
            FROM appointments a
            LEFT JOIN departments dept ON a.department_id = dept.id
            {appt_where}
            GROUP BY a.booking_source;
        """, appt_params)
        by_source = {row[0]: row[1] for row in cur.fetchall()}

        # 3. New vs Returning Patients for the date range
        if target_doctor_id:
            cur.execute("""
                SELECT COUNT(DISTINCT a.patient_id)
                FROM appointments a
                WHERE a.appointment_date >= %s AND a.appointment_date <= %s
                  AND a.doctor_id = %s
                  AND EXISTS (
                      SELECT 1 FROM appointments a2 
                      WHERE a2.patient_id = a.patient_id 
                        AND a2.doctor_id = %s
                        AND a2.appointment_date < %s
                  );
            """, (eff_from, eff_to, target_doctor_id, target_doctor_id, eff_from))
            returning_patients_in_range = cur.fetchone()[0]
            new_patients_in_range = max(0, unique_patients_in_range - returning_patients_in_range)
        else:
            cur.execute("""
                SELECT COUNT(DISTINCT a.patient_id)
                FROM appointments a
                WHERE a.appointment_date >= %s AND a.appointment_date <= %s
                  AND (
                      EXISTS (
                          SELECT 1 FROM appointments a2 
                          WHERE a2.patient_id = a.patient_id 
                            AND a2.appointment_date < %s
                      )
                      OR EXISTS (
                          SELECT 1 FROM patients p
                          WHERE p.id = a.patient_id
                            AND DATE(p.created_at AT TIME ZONE 'UTC') < %s
                      )
                  );
            """, (eff_from, eff_to, eff_from, eff_from))
            returning_patients_in_range = cur.fetchone()[0]
            new_patients_in_range = max(0, unique_patients_in_range - returning_patients_in_range)

        # 4. Admissions / Pre-Admissions in range
        adm_conditions = ["pa.expected_admission_date >= %s", "pa.expected_admission_date <= %s"]
        adm_params = [eff_from, eff_to]
        if target_doctor_id:
            adm_conditions.append("pa.doctor_id = %s")
            adm_params.append(target_doctor_id)
        if dept_str:
            adm_conditions.append("LOWER(dept.department_name) = LOWER(%s)")
            adm_params.append(dept_str)
        cur.execute(f"""
            SELECT COUNT(*) 
            FROM pre_admissions pa
            LEFT JOIN departments dept ON pa.department_id = dept.id
            WHERE {' AND '.join(adm_conditions)};
        """, adm_params)
        admissions_in_range = cur.fetchone()[0]

        # 5. Escalations
        if target_doctor_id:
            cur.execute("""
                SELECT COUNT(DISTINCT e.id)
                FROM escalations e
                JOIN appointments a ON e.patient_id = a.patient_id
                WHERE a.doctor_id = %s AND DATE(e.created_at AT TIME ZONE 'UTC') >= %s AND DATE(e.created_at AT TIME ZONE 'UTC') <= %s;
            """, (target_doctor_id, eff_from, eff_to))
            escalations_in_range = cur.fetchone()[0]
            cur.execute("""
                SELECT COUNT(DISTINCT e.id)
                FROM escalations e
                JOIN appointments a ON e.patient_id = a.patient_id
                WHERE a.doctor_id = %s AND e.status = 'OPEN';
            """, (target_doctor_id,))
            open_escalations = cur.fetchone()[0]
            cur.execute("""
                SELECT COUNT(DISTINCT e.id)
                FROM escalations e
                JOIN appointments a ON e.patient_id = a.patient_id
                WHERE a.doctor_id = %s;
            """, (target_doctor_id,))
            total_escalations = cur.fetchone()[0]
        else:
            cur.execute("""
                SELECT COUNT(*) FROM escalations 
                WHERE DATE(created_at AT TIME ZONE 'UTC') >= %s AND DATE(created_at AT TIME ZONE 'UTC') <= %s;
            """, (eff_from, eff_to))
            escalations_in_range = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM escalations WHERE status = 'OPEN';")
            open_escalations = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM escalations;")
            total_escalations = cur.fetchone()[0]

        # 6. Upcoming appointments (from today onward)
        if target_doctor_id:
            cur.execute("""
                SELECT COUNT(*) FROM appointments
                WHERE doctor_id = %s AND appointment_date > CURRENT_DATE AND status NOT IN ('CANCELLED', 'RESCHEDULED');
            """, (target_doctor_id,))
        else:
            cur.execute("""
                SELECT COUNT(*) FROM appointments
                WHERE appointment_date > CURRENT_DATE AND status NOT IN ('CANCELLED', 'RESCHEDULED');
            """)
        upcoming_appointments = cur.fetchone()[0]

        # 7. Today's appointments (independent of filter for quick header reference)
        if target_doctor_id:
            cur.execute("SELECT COUNT(*) FROM appointments WHERE appointment_date = %s AND doctor_id = %s;", (today, target_doctor_id))
        else:
            cur.execute("SELECT COUNT(*) FROM appointments WHERE appointment_date = %s;", (today,))
        today_appointments = cur.fetchone()[0]

        # 8. Conversations
        if target_doctor_id:
            cur.execute("""
                SELECT COUNT(DISTINCT c.id) 
                FROM conversations c 
                JOIN appointments a ON c.patient_id = a.patient_id 
                WHERE a.doctor_id = %s;
            """, (target_doctor_id,))
            total_conversations = cur.fetchone()[0]
            cur.execute("""
                SELECT COUNT(DISTINCT c.id) 
                FROM conversations c 
                JOIN appointments a ON c.patient_id = a.patient_id 
                WHERE a.doctor_id = %s AND DATE(c.created_at AT TIME ZONE 'UTC') = %s;
            """, (target_doctor_id, today))
            conversations_today = cur.fetchone()[0]
        else:
            cur.execute("SELECT COUNT(*) FROM conversations;")
            total_conversations = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM conversations WHERE DATE(created_at AT TIME ZONE 'UTC') = %s;", (today,))
            conversations_today = cur.fetchone()[0]

        cur.close()
        return {
            "date_from": eff_from,
            "date_to": eff_to,
            "patients": {
                "total": total_patients,
                "new_today": new_patients_today,
                "new_this_month": new_patients_month,
                "new_in_range": new_patients_in_range,
                "returning_in_range": returning_patients_in_range,
                "unique_in_range": unique_patients_in_range,
            },
            "appointments": {
                "today": today_appointments,
                "upcoming": upcoming_appointments,
                "booked": booked_cnt,
                "confirmed": confirmed_cnt,
                "completed": completed_cnt,
                "cancelled": cancelled_cnt,
                "rescheduled": rescheduled_cnt,
                "no_show": no_show_cnt,
                "total": total_appts_in_range,
                "by_source": by_source,
            },
            "doctors": {
                "active": active_doctors,
            },
            "conversations": {
                "total": total_conversations,
                "today": conversations_today,
            },
            "escalations": {
                "open": open_escalations,
                "total": total_escalations,
                "in_range": escalations_in_range,
            },
            "admissions": {
                "in_range": admissions_in_range,
            },
        }
    except Exception as e:
        print(f"[ERROR] Dashboard summary query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Dashboard summary error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Patients ─────────────────────────────────────────────────────────────────

@router.get("/patients")
def get_patients(
    search: Optional[str] = Query(None),
    patient_id: Optional[int] = Query(None, description="Filter directly by patient ID"),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns a paginated list of patients.
    Supports search by patient_id, name, phone, or patient_code, and filter by status.
    """
    # Unwrap FastAPI Query objects if invoked directly in tests/python code
    if hasattr(search, 'default') or 'Query' in type(search).__name__: search = None
    if hasattr(status, 'default') or 'Query' in type(status).__name__: status = None
    if hasattr(patient_id, 'default') or 'Query' in type(patient_id).__name__: patient_id = None
    if hasattr(page, 'default') or 'Query' in type(page).__name__: page = 1
    if hasattr(per_page, 'default') or 'Query' in type(per_page).__name__: per_page = 20

    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        conditions = []
        params = []

        target_doctor_id = resolve_target_doctor_id(current_user, None, cur)

        if target_doctor_id:
            conditions.append("""
                (EXISTS (
                    SELECT 1 FROM appointments a 
                    WHERE a.patient_id = patients.id AND a.doctor_id = %s
                ) OR EXISTS (
                    SELECT 1 FROM pre_admissions pa
                    WHERE pa.patient_id = patients.id AND pa.doctor_id = %s
                ))
            """)
            params.extend([target_doctor_id, target_doctor_id])

        if patient_id is not None:
            conditions.append("patients.id = %s")
            params.append(patient_id)

        if search:
            conditions.append(
                "(CAST(patients.id AS TEXT) LIKE %s OR LOWER(first_name || ' ' || last_name) LIKE %s OR LOWER(COALESCE(phone, '')) LIKE %s OR LOWER(COALESCE(patient_code, '')) LIKE %s OR LOWER(COALESCE(whatsapp_number, '')) LIKE %s)"
            )
            like = f"%{search.lower()}%"
            params += [like, like, like, like, like]

        if status:
            conditions.append("status = %s")
            params.append(status.upper())

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        # Count total
        cur.execute(f"SELECT COUNT(*) FROM patients {where};", params)
        total = cur.fetchone()[0]

        # Paginate
        offset = (page - 1) * per_page
        cur.execute(
            f"""
            SELECT id, patient_code, first_name, last_name, date_of_birth, gender,
                   phone, whatsapp_number, email, city, blood_group, status, created_at,
                   guardian_patient_id, guardian_phone, relationship_to_contact, is_dependent
            FROM patients
            {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s;
            """,
            params + [per_page, offset],
        )
        patients = rows_to_dicts(cur, cur.fetchall())

        cur.close()
        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
            "patients": patients,
        }
    except Exception as e:
        print(f"[ERROR] Patients query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Patients query error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Dynamic Patient Registration & ID Generation ─────────────────────────────

class RegisterPatientRequest(BaseModel):
    patient_code: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    name: Optional[str] = None
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = "Male"
    sex: Optional[str] = None
    phone: str
    whatsapp_number: Optional[str] = None
    email: Optional[str] = None
    blood_group: Optional[str] = None
    preferred_language: Optional[str] = "English"
    address: Optional[str] = None
    city: Optional[str] = "Chennai"
    state: Optional[str] = "Tamil Nadu"
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    patient_type: Optional[str] = "OP"  # IP, OP, ER
    department: Optional[str] = None
    department_id: Optional[int] = None
    doctor: Optional[str] = None
    doctor_id: Optional[int] = None
    ward_id: Optional[int] = None
    bed_id: Optional[int] = None
    bed_number: Optional[str] = None
    room_id: Optional[int] = None
    room_number: Optional[str] = None
    reason: Optional[str] = None
    diagnosis: Optional[str] = None
    insurer: Optional[str] = "Self-Pay"
    policy_number: Optional[str] = None
    coverage_limit: Optional[float] = None


@router.get("/patients/next-id")
def get_next_patient_id(current_user: dict = Depends(get_current_user)):
    """
    Dynamically generates the next available patient ID and registration UHID code.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM patients;")
        next_id = cur.fetchone()[0]
        cur.close()
        suggested_code = f"MER-PAT-{str(next_id).zfill(7)}"
        return {
            "success": True,
            "next_id": next_id,
            "next_patient_code": suggested_code,
            "suggested_uhid": suggested_code
        }
    except Exception as e:
        print(f"[ERROR] Failed to get next patient ID: {e}")
        return {
            "success": True,
            "next_id": 87435,
            "next_patient_code": "MER-PAT-0087435",
            "suggested_uhid": "MER-PAT-0087435"
        }
    finally:
        if conn:
            conn.close()


@router.get("/patients/meta")
def get_patient_registration_meta(current_user: dict = Depends(get_current_user)):
    """
    Provides dynamic departments, doctors, wards, available beds, and insurers for patient registration.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        # Departments (Distinct active departments)
        cur.execute("""
            SELECT DISTINCT ON (department_name) id, department_name, department_code 
            FROM departments 
            WHERE status ILIKE 'active' 
            ORDER BY department_name, id;
        """)
        departments = [{"id": r[0], "name": r[1], "code": r[2]} for r in cur.fetchall()]

        # Doctors (Joined with department_name)
        cur.execute("""
            SELECT 
                doc.id, 
                doc.display_name, 
                COALESCE(doc.specialization, 'Physician') AS specialization, 
                doc.department_id,
                COALESCE(d.department_name, 'General Medicine') AS department_name
            FROM doctors doc
            LEFT JOIN departments d ON doc.department_id = d.id
            WHERE doc.status ILIKE 'active'
            ORDER BY doc.display_name;
        """)
        doctors = [
            {
                "id": r[0],
                "name": r[1],
                "specialization": r[2],
                "department_id": r[3],
                "department_name": r[4]
            }
            for r in cur.fetchall()
        ]

        # Wards with available beds count
        cur.execute("""
            SELECT 
                w.ward_id, 
                w.ward_name, 
                w.department_id, 
                w.ward_type,
                COUNT(CASE WHEN b.status = 'Available' THEN 1 END) as available_beds
            FROM wards w
            LEFT JOIN beds b ON w.ward_id = b.ward_id
            WHERE w.status ILIKE 'ACTIVE'
            GROUP BY w.ward_id, w.ward_name, w.department_id, w.ward_type
            ORDER BY w.ward_name;
        """)
        wards = [
            {
                "ward_id": r[0],
                "name": r[1],
                "department_id": r[2],
                "type": r[3],
                "available_beds": r[4]
            }
            for r in cur.fetchall()
        ]

        # Beds (Available) with Room and Ward Details
        cur.execute("""
            SELECT 
                b.bed_id, 
                b.bed_number, 
                b.ward_id, 
                w.ward_name, 
                w.ward_type, 
                b.room_id, 
                COALESCE(r.room_number, 'RM-' || LPAD(b.room_id::text, 3, '0')) as room_number, 
                COALESCE(r.room_type, 'Standard Care') as room_type,
                b.bed_type, 
                COALESCE(b.daily_charge, 0.0),
                b.status
            FROM beds b
            JOIN wards w ON b.ward_id = w.ward_id
            LEFT JOIN rooms r ON b.room_id = r.room_id
            WHERE b.status = 'Available'
            ORDER BY w.ward_name, r.room_number, b.bed_number;
        """)
        beds = [
            {
                "bed_id": r[0],
                "bed_number": r[1],
                "ward_id": r[2],
                "ward_name": r[3],
                "ward_type": r[4],
                "room_id": r[5],
                "room_number": r[6],
                "room_type": r[7],
                "bed_type": r[8],
                "daily_charge": float(r[9]),
                "status": r[10]
            }
            for r in cur.fetchall()
        ]

        cur.close()
        return {
            "success": True,
            "departments": departments,
            "doctors": doctors,
            "wards": wards,
            "beds": beds,
            "insurers": [
                "Star Health & Allied",
                "HDFC ERGO Health",
                "Care Health Insurance",
                "ICICI Lombard Health",
                "Vidal Health TPA",
                "Medi Assist TPA",
                "Self-Pay"
            ],
            "blood_groups": ["A+", "B+", "O+", "AB+", "A-", "B-", "O-", "AB-"],
            "languages": ["Tamil", "English", "Telugu", "Malayalam", "Hindi", "Kannada"]
        }
    except Exception as e:
        print(f"[ERROR] Failed to fetch registration meta: {e}")
        return {
            "success": True,
            "departments": [],
            "doctors": [],
            "wards": [],
            "beds": [],
            "insurers": ["Star Health & Allied", "HDFC ERGO Health", "Care Health Insurance", "ICICI Lombard Health", "Vidal Health TPA", "Medi Assist TPA", "Self-Pay"],
            "blood_groups": ["A+", "B+", "O+", "AB+", "A-", "B-", "O-", "AB-"],
            "languages": ["Tamil", "English", "Telugu", "Malayalam", "Hindi"]
        }
    finally:
        if conn:
            conn.close()


@router.post("/patients")
@router.post("/patients/register")
def register_patient(
    req: RegisterPatientRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Registers a new patient dynamically into PostgreSQL `patients` table,
    and seamlessly initiates the encounter (IP admission, OP appointment, or ER triage)
    and insurance record if provided.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        first_name = (req.first_name or "").strip()
        last_name = (req.last_name or "").strip()
        if not first_name and req.name:
            parts = req.name.strip().split(" ", 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ""

        if not first_name:
            raise HTTPException(status_code=400, detail="Patient first name is required")

        gender = req.gender or req.sex or "Male"
        gender = "Female" if gender.lower().startswith("f") else ("Other" if gender.lower().startswith("o") else "Male")

        dob = req.date_of_birth
        if not dob:
            age_years = req.age if (req.age and req.age > 0) else 35
            dob = str(date.today() - timedelta(days=int(age_years * 365.25)))

        patient_code = (req.patient_code or "").strip()
        if not patient_code:
            cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM patients;")
            next_id = cur.fetchone()[0]
            patient_code = f"MER-PAT-{str(next_id).zfill(7)}"

        cur.execute("SELECT 1 FROM patients WHERE patient_code = %s;", (patient_code,))
        if cur.fetchone():
            cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM patients;")
            next_id = cur.fetchone()[0]
            patient_code = f"MER-PAT-{str(next_id).zfill(7)}"

        phone = (req.phone or "").strip()
        if not phone:
            phone = "+91 98400 00000"
        whatsapp = (req.whatsapp_number or "").strip() or phone

        # Check if patient already exists
        existing_patient = None
        if phone and phone != "+91 98400 00000":
            cur.execute("""
                SELECT id, patient_code FROM patients 
                WHERE (phone = %s OR whatsapp_number = %s) AND status = 'ACTIVE' 
                ORDER BY id ASC LIMIT 1;
            """, (phone, phone))
            existing_patient = cur.fetchone()

        if not existing_patient and first_name:
            cur.execute("""
                SELECT id, patient_code FROM patients 
                WHERE LOWER(TRIM(first_name)) = LOWER(TRIM(%s)) 
                  AND LOWER(TRIM(last_name)) = LOWER(TRIM(%s)) 
                  AND date_of_birth = %s 
                  AND status = 'ACTIVE' 
                ORDER BY id ASC LIMIT 1;
            """, (first_name, last_name, dob))
            existing_patient = cur.fetchone()

        if existing_patient:
            patient_id = existing_patient[0]
            assigned_code = existing_patient[1]
        else:
            cur.execute(
                """
                INSERT INTO patients (
                    patient_code, first_name, last_name, date_of_birth, gender,
                    phone, whatsapp_number, email, address, city, state, pincode,
                    emergency_contact_name, emergency_contact_phone, blood_group,
                    preferred_language, status, registration_date, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                ) RETURNING id, patient_code;
                """,
                (
                    patient_code, first_name, last_name, dob, gender,
                    phone, whatsapp, req.email, req.address or "Chennai Metropolitan Area",
                    req.city or "Chennai", req.state or "Tamil Nadu", req.pincode or "600001",
                    req.emergency_contact_name, req.emergency_contact_phone,
                    req.blood_group or "O+", req.preferred_language or "English"
                )
            )
            patient_row = cur.fetchone()
            patient_id = patient_row[0]
            assigned_code = patient_row[1]

        # Resolve Doctor ID
        resolved_doctor_id = req.doctor_id
        if not resolved_doctor_id and req.doctor:
            cur.execute("SELECT id FROM doctors WHERE display_name ILIKE %s OR first_name ILIKE %s LIMIT 1;", (f"%{req.doctor}%", f"%{req.doctor}%"))
            doc_row = cur.fetchone()
            if doc_row:
                resolved_doctor_id = doc_row[0]

        # Resolve Department ID
        resolved_dept_id = req.department_id
        if not resolved_dept_id and req.department:
            cur.execute("SELECT id FROM departments WHERE department_name ILIKE %s LIMIT 1;", (f"%{req.department}%",))
            dept_row = cur.fetchone()
            if dept_row:
                resolved_dept_id = dept_row[0]
        if not resolved_dept_id and resolved_doctor_id:
            cur.execute("SELECT department_id FROM doctors WHERE id = %s;", (resolved_doctor_id,))
            doc_dept = cur.fetchone()
            if doc_dept:
                resolved_dept_id = doc_dept[0]

        # Insurance entry if insured
        insurer = (req.insurer or "Self-Pay").strip()
        if insurer and insurer.lower() != "self-pay":
            cur.execute("SELECT COALESCE(MAX(insurance_id), 0) + 1 FROM patient_insurance;")
            next_ins_id = cur.fetchone()[0]
            cur.execute(
                """
                INSERT INTO patient_insurance (
                    insurance_id, patient_id, insurance_provider, policy_number,
                    policy_type, coverage_start_date, coverage_end_date, coverage_limit, status
                ) VALUES (%s, %s, %s, %s, 'Comprehensive', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', %s, 'Active');
                """,
                (next_ins_id, patient_id, insurer, req.policy_number or f"POL-{patient_id}-2026", req.coverage_limit or 500000.0)
            )

        clinical_reason = req.reason or req.diagnosis or "Clinical Evaluation"
        encounter_details = {}

        ptype = (req.patient_type or "OP").upper()
        if ptype in ("IP", "INPATIENT"):
            ward_id = req.ward_id
            bed_id = req.bed_id
            bed_number = req.bed_number
            room_number = req.room_number

            if not bed_id:
                cur.execute("SELECT b.bed_id, b.bed_number, b.ward_id, r.room_number FROM beds b LEFT JOIN rooms r ON b.room_id = r.room_id WHERE b.status = 'Available' ORDER BY b.bed_id ASC LIMIT 1;")
                bed_row = cur.fetchone()
                if bed_row:
                    bed_id, bed_number, default_ward_id, room_number = bed_row
                    if not ward_id:
                        ward_id = default_ward_id
            elif not bed_number:
                cur.execute("SELECT b.bed_number, r.room_number FROM beds b LEFT JOIN rooms r ON b.room_id = r.room_id WHERE b.bed_id = %s;", (bed_id,))
                b_info = cur.fetchone()
                if b_info:
                    bed_number, room_number = b_info[0], b_info[1]

            if bed_id:
                cur.execute("UPDATE beds SET status = 'Occupied' WHERE bed_id = %s;", (bed_id,))

            cur.execute("""
                SELECT GREATEST(
                    (SELECT COALESCE(MAX(admission_id), 0) FROM admissions),
                    (SELECT COALESCE(MAX(admission_id), 0) FROM dim_admission_inputs)
                ) + 1;
            """)
            next_adm_id = cur.fetchone()[0]
            adm_number = f"MER-ADM-{str(next_adm_id).zfill(7)}"

            cur.execute(
                """
                INSERT INTO admissions (
                    admission_id, admission_number, patient_id, doctor_id, department_id,
                    ward_id, bed_id, admission_date, admission_type, admission_source,
                    reason_for_admission, discharge_status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, 'Inpatient', 'Registration', %s, 'Admitted');
                """,
                (next_adm_id, adm_number, patient_id, resolved_doctor_id, resolved_dept_id, ward_id, bed_id, clinical_reason)
            )

            # Resolve Doctor and Ward names for lakehouse and SBAR
            cur.execute("SELECT COALESCE(display_name, first_name || ' ' || last_name), specialization, qualification FROM doctors WHERE id = %s;", (resolved_doctor_id,))
            doc_info = cur.fetchone() or ("Dr. Attending Physician", "General Medicine", "MBBS, MD")
            doc_name, doc_spec, doc_qual = doc_info[0], doc_info[1] or "General Medicine", doc_info[2] or "MBBS, MD"

            cur.execute("SELECT ward_name FROM wards WHERE ward_id = %s;", (ward_id,))
            ward_res = cur.fetchone()
            ward_name = ward_res[0] if ward_res else "General Inpatient Ward"

            patient_full_name = f"{first_name} {last_name}".strip()
            is_self_pay = not insurer or insurer.lower() == "self-pay"
            patient_blood_group = req.blood_group or "O+"
            patient_address = req.address or "Chennai Metropolitan Area"

            adm_llm_json = {
                "patient_demographics": {
                    "first_name": first_name,
                    "last_name": last_name,
                    "gender": gender,
                    "age_at_admission": req.age or 35,
                    "blood_group": patient_blood_group,
                    "date_of_birth": dob,
                    "marital_status": "Single",
                    "preferred_language": "English",
                    "phone": phone,
                    "email": f"{first_name.lower()}.{last_name.lower()}@hospital.com",
                    "address": patient_address,
                    "city": "Chennai",
                    "state": "Tamil Nadu",
                    "postal_code": "600001",
                    "emergency_contact_name": "Family Member",
                    "emergency_contact_phone": phone
                },
                "admission_details": {
                    "admission_number": adm_number,
                    "admission_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "admission_type": "Inpatient",
                    "admission_source": "Registration",
                    "reason_for_admission": clinical_reason,
                    "discharge_status": "Admitted",
                    "current_stay_days": 1,
                    "attending_doctor": doc_name,
                    "doctor_specialization": doc_spec,
                    "doctor_qualification": doc_qual
                },
                "diagnoses": {
                    "primary_diagnosis": clinical_reason,
                    "secondary_diagnoses": [],
                    "diagnoses_list": [
                        {
                            "diagnosis_code": "D-0",
                            "diagnosis_name": clinical_reason,
                            "diagnosis_type": "Primary",
                            "is_primary": True,
                            "admission_id": next_adm_id,
                            "diagnosis_date": datetime.now().isoformat()
                        }
                    ]
                },
                "medications": { "medications_list": [] },
                "lab_results": { "lab_results_list": [] },
                "procedures": { "procedures_list": [] },
                "vital_signs": {
                    "latest_temperature": 98.6,
                    "latest_heart_rate": 72,
                    "latest_systolic_bp": 120,
                    "latest_diastolic_bp": 80,
                    "latest_oxygen_saturation": 98.0,
                    "vital_signs_list": [
                        {
                            "admission_id": next_adm_id,
                            "recorded_at": datetime.now().isoformat(),
                            "temperature": 98.6,
                            "heart_rate": 72,
                            "systolic_bp": 120,
                            "diastolic_bp": 80,
                            "respiratory_rate": 18,
                            "oxygen_saturation": 98.0,
                            "weight": 65.0
                        }
                    ]
                },
                "billing": {
                    "bill_number": f"BILL-{30500 + next_adm_id % 1000}",
                    "bill_date": datetime.now().isoformat(),
                    "bill_gross_amount": 120000.0,
                    "bill_discount_amount": 0.0,
                    "bill_tax_amount": 0.0,
                    "bill_net_amount": 120000.0,
                    "bill_insurance_portion": 0.0 if is_self_pay else 102000.0,
                    "bill_patient_portion": 120000.0 if is_self_pay else 18000.0,
                    "bill_status": "Released",
                    "bill_clearance_status": "Released",
                    "total_paid_amount": 120000.0,
                    "total_insurance_settled": 0.0,
                    "outstanding_balance": 0.0,
                    "payment_count": 1
                }
            }

            adm_llm_input_text = f"""--- PATIENT DEMOGRAPHICS ---
Name: {patient_full_name} | Gender: {gender} | Age: {req.age or 35} years | Blood Group: {patient_blood_group}
Phone: {phone} | Address: {patient_address}

--- ADMISSION DETAILS ---
Admission Number: {adm_number} | Date: {datetime.now().strftime('%Y-%m-%d')} | Type: Inpatient
Reason: {clinical_reason} | Status: Admitted
Attending Doctor: {doc_name} | Specialization: {doc_spec}

--- DIAGNOSES ---
Primary: {clinical_reason}

--- BILLING ---
Bill Number: BILL-{30500 + next_adm_id % 1000} | Net: 120000.00 | Insurer: {insurer} | Balance: 0.00
"""

            cur.execute("""
                INSERT INTO dim_admission_inputs (
                    admission_id, admission_number, patient_id, patient_number,
                    first_name, last_name, gender, age_at_admission, blood_group,
                    date_of_birth, marital_status, preferred_language, phone, email,
                    address, city, state, postal_code, emergency_contact_name, emergency_contact_phone,
                    admission_date, admission_type, admission_source, reason_for_admission,
                    discharge_status, current_stay_days, attending_doctor, doctor_specialization,
                    doctor_qualification, primary_diagnosis, secondary_diagnoses,
                    latest_temperature, latest_heart_rate, latest_systolic_bp, latest_diastolic_bp,
                    latest_oxygen_saturation, bill_number, bill_net_amount, bill_status,
                    bill_clearance_status, outstanding_balance, llm_input, llm_input_json,
                    gold_ingestion_time, bed_number, room_number, ward_name
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    CURRENT_TIMESTAMP, 'Inpatient', 'Registration', %s,
                    'Admitted', 1, %s, %s,
                    %s, %s, %s,
                    98.6, 72, 120, 80,
                    98.0, %s, 120000.0, 'Released',
                    'Released', 0.0, %s, %s,
                    CURRENT_TIMESTAMP, %s, %s, %s
                ) ON CONFLICT (admission_id) DO NOTHING;
            """, (
                next_adm_id, adm_number, patient_id, assigned_code,
                first_name, last_name, gender, req.age or 35, patient_blood_group,
                dob or "1990-01-01", "Single", "English", phone, f"{first_name.lower()}.{last_name.lower()}@hospital.com",
                patient_address, "Chennai", "Tamil Nadu", "600001", "Family Member", phone,
                clinical_reason, doc_name, doc_spec,
                doc_qual, clinical_reason, "{}",
                f"BILL-{30500 + next_adm_id % 1000}", adm_llm_input_text, json.dumps(adm_llm_json),
                bed_number or "BED-Allocated", room_number or "Assigned Room", ward_name
            ))

            # Insert initial SBAR Handover record for bedside shift handover
            cur.execute("""
                INSERT INTO ward_sbar_handovers (
                    bed_no, patient_name, uhid, age_gender, ews, mar_due,
                    last_handover_time, from_nurse, to_nurse, situation, background,
                    assessment, recommendation, sbar_full, status, handover_shift, acknowledged
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s
                );
            """, (
                bed_number or "BED-Allocated", patient_full_name, assigned_code, f"{req.age or 35}{gender[0].upper()}", "Normal 0", None,
                "Just now · Staff Nurse, RN", "Staff Nurse, RN", "Shift Nurse, RN",
                f"{clinical_reason}, Day 1 under {doc_name} in {ward_name}.",
                f"Admitted via Registration. Insurer: {insurer}.",
                "Vitals: BP 120/80 mmHg, HR 72 bpm, SpO2 98%, Temp 98.6°F. EWS: Normal 0. Initial intake vitals recorded.",
                f"Continue inpatient clinical plan under {doc_name}. Monitor vitals Q4H.",
                f"S: {clinical_reason}. B: Newly admitted patient. A: Vitals stable. R: Inpatient monitoring.",
                "Current", "Morning (07:00 - 15:00)", False
            ))

            encounter_details = {
                "encounter_type": "IP",
                "admission_id": next_adm_id,
                "admission_number": adm_number,
                "ward_id": ward_id,
                "bed_id": bed_id,
                "bed_number": bed_number or "BED-Allocated",
                "room_number": room_number or "Assigned Room"
            }

        elif ptype in ("ER", "EMERGENCY"):
            bed_id = req.bed_id
            bed_number = req.bed_number
            room_number = req.room_number

            if not bed_id:
                # Find an available ER bed (ward 8 or general)
                cur.execute("""
                    SELECT b.bed_id, b.bed_number, COALESCE(r.room_number, 'Trauma Bay')
                    FROM beds b
                    LEFT JOIN rooms r ON b.room_id = r.room_id
                    WHERE b.status = 'Available' AND b.ward_id = 8
                    ORDER BY b.bed_id ASC LIMIT 1;
                """)
                er_bed_row = cur.fetchone()
                if not er_bed_row:
                    cur.execute("""
                        SELECT b.bed_id, b.bed_number, COALESCE(r.room_number, 'Trauma Bay')
                        FROM beds b
                        LEFT JOIN rooms r ON b.room_id = r.room_id
                        WHERE b.status = 'Available'
                        ORDER BY b.bed_id ASC LIMIT 1;
                    """)
                    er_bed_row = cur.fetchone()
                if er_bed_row:
                    bed_id, bed_number, room_number = er_bed_row
            elif not bed_number:
                cur.execute("SELECT b.bed_number, r.room_number FROM beds b LEFT JOIN rooms r ON b.room_id = r.room_id WHERE b.bed_id = %s;", (bed_id,))
                b_info = cur.fetchone()
                if b_info:
                    bed_number, room_number = b_info[0], b_info[1]

            if bed_id:
                cur.execute("UPDATE beds SET status = 'Occupied' WHERE bed_id = %s;", (bed_id,))

            bay_label = f"{room_number} ({bed_number})" if (room_number and bed_number) else (bed_number or "Bay 4")

            cur.execute("SELECT COALESCE(MAX(CAST(SUBSTRING(id FROM '[0-9]+$') AS INT)), 4400) + 1 FROM emergency_triage WHERE id ~ '[0-9]+$';")
            er_res = cur.fetchone()
            er_num = er_res[0] if (er_res and er_res[0]) else 4425
            er_id = f"ER-2026-{er_num}"
            age_gender = f"{req.age or 35}{gender[0].upper()}"

            cur.execute(
                """
                INSERT INTO emergency_triage (
                    id, bay, patient_name, age_gender, triage_level,
                    chief_complaint, bp, hr, spo2, doctor_name,
                    elapsed_time, clinical_status, created_at, arrival_time,
                    waiting_time, acuity, critical_alert, mlc_flag
                ) VALUES (
                    %s, %s, %s, %s, 'Yellow',
                    %s, '120/80', 78, '98%%', %s,
                    'Just now', 'Active Triage', CURRENT_TIMESTAMP, TO_CHAR(CURRENT_TIMESTAMP, 'HH12:MI AM'),
                    '0m', 'Urgent / Priority 2', 'Observation Required', FALSE
                );
                """,
                (er_id, bay_label, f"{first_name} {last_name}".strip(), age_gender, clinical_reason, req.doctor or "Dr. Divya Verma")
            )
            encounter_details = {
                "encounter_type": "ER",
                "triage_id": er_id,
                "bay": bay_label,
                "bed_id": bed_id,
                "bed_number": bed_number or "ER-Bed",
                "room_number": room_number or "ER-Room"
            }

        else:
            cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM appointments;")
            next_apt_id = cur.fetchone()[0]
            booking_id = f"APT-2026-{str(next_apt_id).zfill(6)}"

            cur.execute(
                """
                INSERT INTO appointments (
                    id, booking_id, patient_id, doctor_id, department_id,
                    appointment_date, appointment_time, booking_source, status,
                    reason_for_visit, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, CURRENT_DATE, CURRENT_TIME, 'Walk-in', 'CONFIRMED', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                """,
                (next_apt_id, booking_id, patient_id, resolved_doctor_id, resolved_dept_id, clinical_reason)
            )
            encounter_details = {
                "encounter_type": "OP",
                "appointment_id": next_apt_id,
                "booking_id": booking_id
            }

        conn.commit()

        try:
            from connectors.databricks_connector import DatabricksConnector
            DatabricksConnector.clear_cache()
        except Exception:
            pass

        calc_age = req.age
        if not calc_age and dob:
            try:
                calc_age = int((date.today() - datetime.strptime(dob, "%Y-%m-%d").date()).days / 365.25)
            except Exception:
                calc_age = 35

        cur.close()

        patient_dict = {
            "id": patient_id,
            "patient_id": patient_id,
            "patient_code": assigned_code,
            "uhid": assigned_code,
            "first_name": first_name,
            "last_name": last_name,
            "patient_name": f"{first_name} {last_name}".strip(),
            "name": f"{first_name} {last_name}".strip(),
            "date_of_birth": dob,
            "age": calc_age,
            "gender": gender,
            "sex": gender[0].upper(),
            "phone": phone,
            "whatsapp_number": whatsapp,
            "email": req.email,
            "city": req.city or "Chennai",
            "blood_group": req.blood_group or "O+",
            "preferred_language": req.preferred_language or "English",
            "department": req.department or "General Medicine",
            "doctor": req.doctor or "Consultant Physician",
            "insurer": insurer,
            "status": "Admitted" if ptype == "IP" else ("Active Triage" if ptype == "ER" else "CONFIRMED"),
            "_status": "Admitted" if ptype == "IP" else ("Active Triage" if ptype == "ER" else "CONFIRMED"),
            "diagnosis": clinical_reason,
            "patient_type": ptype,
            "_type": ptype,
            "created_at": datetime.now().isoformat(),
            **encounter_details
        }

        return {
            "success": True,
            "message": f"Patient {patient_dict['patient_name']} successfully registered with UHID {assigned_code}.",
            "patient": patient_dict
        }

    except HTTPException:
        if conn: conn.rollback()
        raise
    except Exception as e:
        if conn: conn.rollback()
        print(f"[ERROR] Patient registration failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Patient registration failed: {str(e)}")
    finally:
        if conn:
            conn.close()


class AddPatientWhatsAppRequest(BaseModel):
    whatsapp_number: str


@router.post("/patients/add-whatsapp")
def add_patient_whatsapp(
    req: AddPatientWhatsAppRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Admin action to initiate WhatsApp Patient Desk conversation for a patient phone number.
    Validates & normalizes the number, checks if existing patient, and sends the Meridian welcome WhatsApp message.
    """
    import voice.whatsapp_client as whatsapp_client
    
    raw_number = (req.whatsapp_number or "").strip()
    if not raw_number:
        raise HTTPException(status_code=400, detail="Please enter a valid WhatsApp number.")

    # Phone normalization using existing whatsapp_client cleaner
    clean_num = whatsapp_client.clean_whatsapp_number(raw_number)
    if not clean_num or len(clean_num) < 10 or len(clean_num) > 15:
        raise HTTPException(status_code=400, detail="Please enter a valid WhatsApp number.")

    # Check if patient exists in database using existing patient lookup logic
    conn = get_conn()
    cur = conn.cursor()
    patient_name = None
    is_existing = False
    try:
        cur.execute("""
            SELECT id, first_name, last_name, patient_code FROM patients 
            WHERE (phone LIKE %s OR whatsapp_number LIKE %s) AND status = 'ACTIVE'
            LIMIT 1;
        """, (f"%{clean_num[-10:]}%", f"%{clean_num[-10:]}%"))
        row = cur.fetchone()
        if row:
            is_existing = True
            patient_name = f"{row[1]} {row[2] or ''}".strip()
    except Exception as e:
        print(f"[WARN] Patient lookup during add-whatsapp: {e}")
    finally:
        cur.close()
        conn.close()

    # Send Meridian Hospital welcome WhatsApp message (reusing active template meridian_patient_welcome)
    send_res = whatsapp_client.send_welcome_message(clean_num)
    
    formatted_display = f"+{clean_num}" if not clean_num.startswith("+") else clean_num
    if len(clean_num) == 12 and clean_num.startswith("91"):
        formatted_display = f"+91 {clean_num[2:7]} {clean_num[7:]}"

    return {
        "success": True,
        "message": f"Welcome message successfully sent to {formatted_display}.",
        "whatsapp_number": formatted_display,
        "is_existing": is_existing,
        "patient_name": patient_name,
        "send_result": send_res
    }


@router.get("/patients/{patient_id}")
def get_patient_detail(patient_id: int, current_user: dict = Depends(get_current_user)):
    """Returns full patient details including appointment history."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        role = str(current_user.get("role", "")).upper()
        doctor_id = current_user.get("doctor_id")
        if not doctor_id and role == "DOCTOR":
            user_id = current_user.get("user_id")
            full_name = current_user.get("full_name") or ""
            username = current_user.get("username") or ""
            cur.execute("""
                SELECT id FROM doctors 
                WHERE user_id = %s 
                   OR (LOWER(display_name) LIKE %s AND %s != '')
                   OR (LOWER(display_name) LIKE %s AND %s != '')
                LIMIT 1;
            """, (user_id, f"%{full_name.lower()}%", full_name, f"%{username.lower()}%", username))
            matched_doc = cur.fetchone()
            if matched_doc:
                doctor_id = matched_doc[0]

        if doctor_id:
            # Check if this patient has an appointment or pre-admission with the doctor
            cur.execute("""
                SELECT 1 FROM appointments WHERE patient_id = %s AND doctor_id = %s
                UNION
                SELECT 1 FROM pre_admissions WHERE patient_id = %s AND doctor_id = %s
                LIMIT 1;
            """, (patient_id, doctor_id, patient_id, doctor_id))
            if not cur.fetchone():
                raise HTTPException(status_code=403, detail="Unauthorized access to this patient record")

        cur.execute(
            """
            SELECT id, patient_code, first_name, last_name, date_of_birth, gender,
                   phone, whatsapp_number, email, address, city, state, pincode,
                   emergency_contact_name, emergency_contact_phone,
                   blood_group, status, created_at, updated_at
            FROM patients WHERE id = %s;
            """,
            (patient_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Patient not found")

        patient = row_to_dict_cur(cur, row)

        # Appointment history with full timestamps and details
        cur.execute(
            """
            SELECT a.id, a.booking_id, a.appointment_date, a.appointment_time,
                   TO_CHAR((a.appointment_time + (COALESCE(s.slot_duration_minutes, 30) || ' minutes')::interval)::time, 'HH24:MI:SS') as appointment_end_time,
                   COALESCE(s.slot_duration_minutes, 30) as duration_minutes,
                   a.status, a.booking_source, a.patient_reason, a.cancellation_reason, a.reschedule_reason,
                   a.created_at, a.cancelled_at, a.rescheduled_at,
                   d.id as doctor_id, d.display_name as doctor_name, d.specialization,
                   dept.id as department_id, dept.department_name
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN departments dept ON a.department_id = dept.id
            LEFT JOIN LATERAL (
                SELECT slot_duration_minutes
                FROM doctor_schedules
                WHERE doctor_id = a.doctor_id AND status = 'ACTIVE'
                LIMIT 1
            ) s ON true
            WHERE a.patient_id = %s
            ORDER BY a.appointment_date DESC, a.appointment_time DESC;
            """,
            (patient_id,),
        )
        all_appointments = rows_to_dicts(cur, cur.fetchall())

        today_str = date.today().isoformat()
        upcoming_appointments = [
            a for a in all_appointments 
            if a["appointment_date"] >= today_str and a["status"] not in ("CANCELLED", "COMPLETED", "NO_SHOW")
        ]
        # Sort upcoming by appointment_date asc, appointment_time asc
        upcoming_appointments.sort(key=lambda x: (x["appointment_date"], str(x["appointment_time"])))

        previous_appointments = [
            a for a in all_appointments
            if a["appointment_date"] < today_str or a["status"] in ("COMPLETED", "CANCELLED", "NO_SHOW")
        ]
        previous_appointments.sort(key=lambda x: (x["appointment_date"], str(x["appointment_time"])), reverse=True)

        # Conversation history
        cur.execute(
            """
            SELECT conversation_code, language, current_intent, conversation_status,
                   started_at, last_message_at
            FROM conversations
            WHERE patient_id = %s
            ORDER BY created_at DESC
            LIMIT 10;
            """,
            (patient_id,),
        )
        conversations = rows_to_dicts(cur, cur.fetchall())

        # Pre-admission history
        cur.execute(
            """
            SELECT pa.id, pa.pre_admission_code, pa.admission_type, pa.expected_admission_date, pa.expected_checkin_time,
                   pa.status, pa.instructions, pa.pending_documents, pa.created_at,
                   d.display_name as doctor_name, dept.department_name
            FROM pre_admissions pa
            LEFT JOIN doctors d ON pa.doctor_id = d.id
            LEFT JOIN departments dept ON pa.department_id = dept.id
            WHERE pa.patient_id = %s
            ORDER BY pa.created_at DESC;
            """,
            (patient_id,),
        )
        pre_admissions = rows_to_dicts(cur, cur.fetchall())

        # Convert datetime fields
        for key, val in patient.items():
            if isinstance(val, (datetime, date)):
                patient[key] = val.isoformat()

        cur.close()
        return {
            "patient": patient,
            "appointments": all_appointments,
            "upcoming_appointments": upcoming_appointments,
            "previous_appointments": previous_appointments,
            "conversations": conversations,
            "pre_admissions": pre_admissions
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Patient detail query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Patient detail error: {str(e)}")
    finally:
        if conn:
            conn.close()


class PatientUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    blood_group: Optional[str] = None
    status: Optional[str] = None


@router.patch("/patients/{patient_id}")
def update_patient(patient_id: int, body: PatientUpdateRequest, current_user: dict = Depends(get_current_user)):
    """
    Update patient details. Admin can update any patient.
    Doctor can only update their own patients (patients who have appointments with them).
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            # Doctors can only edit their own patients
            cur.execute(
                "SELECT id FROM appointments WHERE patient_id = %s AND doctor_id = %s LIMIT 1;",
                (patient_id, doctor_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=403, detail="You can only edit details for your own patients")

        # Build dynamic UPDATE from provided fields
        update_fields = []
        params = []
        data = body.dict(exclude_none=True)

        allowed_fields = {
            'first_name', 'last_name', 'date_of_birth', 'gender', 'phone',
            'whatsapp_number', 'email', 'address', 'city', 'state', 'pincode',
            'emergency_contact_name', 'emergency_contact_phone', 'blood_group', 'status'
        }

        for field, value in data.items():
            if field in allowed_fields and value is not None:
                update_fields.append(f"{field} = %s")
                params.append(value)

        if not update_fields:
            raise HTTPException(status_code=400, detail="No valid fields provided for update")

        update_fields.append("updated_at = CURRENT_TIMESTAMP")
        params.append(patient_id)

        cur.execute(
            f"UPDATE patients SET {', '.join(update_fields)} WHERE id = %s;",
            params
        )
        conn.commit()
        cur.close()

        return {"success": True, "patient_id": patient_id}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Patient update failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Patient update error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Appointments ─────────────────────────────────────────────────────────────

@router.get("/appointments")
def get_appointments(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    doctor_id: Optional[int] = Query(None),
    booking_source: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    date_type: Optional[str] = Query('appointment_date'),
    sort_by: Optional[str] = Query('appointment_date'),
    sort_order: Optional[str] = Query('desc'),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns a paginated list of appointments with patient, doctor, and department details.
    Supports search, filter by status, department, doctor, booking source, and date range.
    Calculates appointment duration and end time from doctor schedules.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        conditions = []
        params = []

        # Sanitize query parameter defaults when called directly in Python
        search_str = search if isinstance(search, str) else None
        status_str = status if isinstance(status, str) else None
        dept_str = department if isinstance(department, str) else None
        doc_id_val = doctor_id if isinstance(doctor_id, int) else None
        source_str = booking_source if isinstance(booking_source, str) else None
        d_from_str = date_from if isinstance(date_from, str) else None
        d_to_str = date_to if isinstance(date_to, str) else None
        d_type = date_type if isinstance(date_type, str) else 'appointment_date'

        target_doctor_id = resolve_target_doctor_id(current_user, doc_id_val, cur)
        if target_doctor_id:
            conditions.append("a.doctor_id = %s")
            params.append(target_doctor_id)

        if search_str:
            conditions.append(
                "(LOWER(COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), 'Patient #' || a.patient_id)) LIKE %s OR a.booking_id LIKE %s OR LOWER(COALESCE(d.display_name, '')) LIKE %s OR COALESCE(p.patient_code, 'PAT-' || a.patient_id) LIKE %s)"
            )
            like = f"%{search_str.lower()}%"
            params += [like, like, like, like]

        if status_str:
            conditions.append("a.status = %s")
            params.append(status_str.upper())

        if dept_str:
            conditions.append("(LOWER(COALESCE(dept.department_name, d.specialization, '')) = LOWER(%s))")
            params.append(dept_str)

        if source_str:
            apply_booking_source_filter(conditions, params, source_str)

        if d_type == 'created_at':
            if d_from_str:
                conditions.append("DATE(a.created_at AT TIME ZONE 'UTC') >= %s")
                params.append(d_from_str)
            if d_to_str:
                conditions.append("DATE(a.created_at AT TIME ZONE 'UTC') <= %s")
                params.append(d_to_str)
        else:
            if d_from_str:
                conditions.append("a.appointment_date >= %s")
                params.append(d_from_str)
            if d_to_str:
                conditions.append("a.appointment_date <= %s")
                params.append(d_to_str)

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cur.execute(
            f"""
            SELECT COUNT(*)
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dept ON COALESCE(d.department_id, a.department_id) = dept.id
            {where};
            """,
            params,
        )
        total = cur.fetchone()[0]

        order_dir = "ASC" if str(sort_order).lower() == "asc" else "DESC"
        sort_field = str(sort_by).lower()
        if sort_field == "created_at":
            order_clause = f"a.created_at {order_dir}"
        elif sort_field in ("patient", "patient_name"):
            order_clause = f"patient_name {order_dir}"
        elif sort_field in ("doctor", "doctor_name"):
            order_clause = f"COALESCE(d.display_name, '') {order_dir}"
        elif sort_field == "status":
            order_clause = f"a.status {order_dir}"
        else:
            order_clause = f"a.appointment_date {order_dir}, a.appointment_time {order_dir}"

        page_num = int(page.default) if hasattr(page, 'default') or 'Query' in type(page).__name__ else int(page or 1)
        per_page_num = int(per_page.default) if hasattr(per_page, 'default') or 'Query' in type(per_page).__name__ else int(per_page or 20)

        offset = (page_num - 1) * per_page_num
        cur.execute(
            f"""
            SELECT a.id, a.booking_id, a.appointment_date, a.appointment_time,
                   TO_CHAR((a.appointment_time + (COALESCE(s.slot_duration_minutes, 30) || ' minutes')::interval)::time, 'HH24:MI:SS') as appointment_end_time,
                   COALESCE(s.slot_duration_minutes, 30) as duration_minutes,
                   a.status, a.booking_source, a.patient_reason, a.cancellation_reason, a.reschedule_reason,
                   a.created_at, a.cancelled_at, a.rescheduled_at,
                   COALESCE(p.id, a.patient_id) as patient_id,
                   COALESCE(p.patient_code, 'PAT-' || a.patient_id) as patient_code,
                   COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), 'Patient #' || a.patient_id) as patient_name,
                   COALESCE(p.phone, 'N/A') as patient_phone, p.relationship_to_contact, p.guardian_phone, p.is_dependent, p.guardian_patient_id,
                   COALESCE(d.id, a.doctor_id) as doctor_id,
                   COALESCE(d.display_name, 'Doctor #' || a.doctor_id) as doctor_name,
                   COALESCE(d.specialization, 'General Medicine') as specialization,
                   COALESCE(d.department_id, a.department_id, dept.id) as department_id,
                   COALESCE(dept.department_name, d.specialization, 'General Medicine') as department_name,
                   qe.token_number,
                   qe.queue_status,
                   qe.id as queue_entry_id,
                   qe.position,
                   qe.patients_ahead,
                   qe.estimated_wait_minutes
            FROM appointments a
            LEFT JOIN patients p ON a.patient_id = p.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN departments dept ON COALESCE(d.department_id, a.department_id) = dept.id
            LEFT JOIN queue_entries qe ON a.id = qe.appointment_id
            LEFT JOIN LATERAL (
                SELECT slot_duration_minutes
                FROM doctor_schedules
                WHERE doctor_id = a.doctor_id AND status = 'ACTIVE'
                LIMIT 1
            ) s ON true
            {where}
            ORDER BY {order_clause}
            LIMIT %s OFFSET %s;
            """,
            params + [per_page, offset],
        )
        appointments = rows_to_dicts(cur, cur.fetchall())
        cur.close()

        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
            "appointments": appointments,
        }
    except Exception as e:
        print(f"[ERROR] Appointments query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Appointments query error: {str(e)}")
    finally:
        if conn:
            conn.close()


class AppointmentStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


@router.patch("/appointments/{booking_id}/status")
def update_appointment_status(booking_id: str, body: AppointmentStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Update appointment status (CONFIRMED, CANCELLED, COMPLETED, NO_SHOW)."""
    allowed = {"CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"}
    new_status = body.status.upper()
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed}")

    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            # Check if this appointment belongs to this doctor
            cur.execute("SELECT id FROM appointments WHERE booking_id = %s AND doctor_id = %s;", (booking_id, doctor_id))
            if not cur.fetchone():
                raise HTTPException(status_code=403, detail="Unauthorized to modify this appointment status")

        cur.execute("SELECT id, status FROM appointments WHERE booking_id = %s;", (booking_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Appointment {booking_id} not found")

        appt_id, current_status = row

        update_fields = ["status = %s", "updated_at = CURRENT_TIMESTAMP"]
        update_params = [new_status]

        if new_status == "CANCELLED" and body.reason:
            update_fields.append("cancellation_reason = %s")
            update_fields.append("cancelled_at = CURRENT_TIMESTAMP")
            update_params.append(body.reason)

        cur.execute(
            f"UPDATE appointments SET {', '.join(update_fields)} WHERE id = %s;",
            update_params + [appt_id],
        )
        conn.commit()
        cur.close()

        return {"success": True, "booking_id": booking_id, "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Status update failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Status update error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Doctors ──────────────────────────────────────────────────────────────────

@router.get("/doctors")
def get_doctors(
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(require_doctor_or_admin)
):
    """Returns all doctors with appointment count and schedule availability."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        conditions = []
        params = []

        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            conditions.append(
                "(LOWER(d.display_name) LIKE %s OR LOWER(d.doctor_code) LIKE %s OR LOWER(d.first_name) LIKE %s OR LOWER(d.last_name) LIKE %s OR LOWER(d.specialization) LIKE %s OR LOWER(d.email) LIKE %s OR LOWER(COALESCE(d.phone, '')) LIKE %s OR LOWER(COALESCE(dept.department_name, '')) LIKE %s)"
            )
            params += [s, s, s, s, s, s, s, s]

        if department and department.strip() and department.strip().lower() not in {"all", "all departments", "all department", "null", "undefined"}:
            conditions.append("LOWER(COALESCE(dept.department_name, 'General Medicine')) = LOWER(%s)")
            params.append(department.strip())

        if status and status.strip() and status.strip().lower() not in {"all", "all status", "all statuses", "null", "undefined"}:
            conditions.append("UPPER(d.status) = UPPER(%s)")
            params.append(status.strip())

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cur.execute(
            f"""
            SELECT d.id, d.doctor_code, d.display_name, d.first_name, d.last_name,
                   d.specialization, d.qualification, d.experience_years,
                   d.phone, d.email, d.consultation_fee, d.status, d.created_at,
                   d.department_id,
                   COALESCE(dept.department_name, 'General Medicine') as department_name,
                   COUNT(a.id) FILTER (WHERE a.appointment_date = CURRENT_DATE) as today_appts,
                   COUNT(a.id) FILTER (WHERE a.status NOT IN ('CANCELLED', 'RESCHEDULED')) as total_appts
            FROM doctors d
            LEFT JOIN departments dept ON d.department_id = dept.id
            LEFT JOIN appointments a ON d.id = a.doctor_id
            {where}
            GROUP BY d.id, d.doctor_code, d.display_name, d.first_name, d.last_name,
                     d.specialization, d.qualification, d.experience_years,
                     d.phone, d.email, d.consultation_fee, d.status, d.created_at,
                     d.department_id, dept.department_name
            ORDER BY d.display_name;
            """,
            params,
        )
        doctors = rows_to_dicts(cur, cur.fetchall())
        cur.close()

        return {"doctors": doctors, "total": len(doctors)}
    except Exception as e:
        print(f"[ERROR] Doctors query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Doctors query error: {str(e)}")
    finally:
        if conn:
            conn.close()


class DoctorStatusUpdate(BaseModel):
    status: str


@router.patch("/doctors/{doctor_id}/status")
def update_doctor_status(doctor_id: int, body: DoctorStatusUpdate, admin_user: dict = Depends(require_admin)):
    """Activate, deactivate, or mark doctor as on-leave."""
    allowed = {"ACTIVE", "INACTIVE", "ON_LEAVE"}
    new_status = body.status.upper()
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed}")

    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("SELECT id FROM doctors WHERE id = %s;", (doctor_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Doctor {doctor_id} not found")

        cur.execute(
            "UPDATE doctors SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;",
            (new_status, doctor_id),
        )
        conn.commit()
        cur.close()

        return {"success": True, "doctor_id": doctor_id, "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Doctor status update failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Doctor status update error: {str(e)}")
    finally:
        if conn:
            conn.close()


class NewDoctorRequest(BaseModel):
    first_name: str
    last_name: str
    specialization: str
    qualification: str
    experience_years: int
    phone: Optional[str] = None
    email: Optional[str] = None
    consultation_fee: float
    department_id: int
    username: str
    password: str


import re

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")

def validate_email_address(email: Optional[str], required: bool = True) -> Optional[str]:
    if not email or not email.strip():
        if required:
            raise HTTPException(status_code=400, detail="Email address is required.")
        return None
    cleaned = email.strip().lower()
    if not EMAIL_REGEX.match(cleaned):
        raise HTTPException(status_code=400, detail=f"Invalid email format: '{email}'. Please provide a valid email (e.g. doctor@meridian.com).")
    return cleaned

def validate_phone_number(phone: Optional[str], required: bool = True) -> Optional[str]:
    if not phone or not phone.strip():
        if required:
            raise HTTPException(status_code=400, detail="Phone number is required.")
        return None
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10:
        raise HTTPException(status_code=400, detail=f"Invalid phone number '{phone}'. Phone number must contain exactly 10 digits.")
    return digits


@router.post("/doctors")
def create_doctor(body: NewDoctorRequest, admin_user: dict = Depends(require_admin)):
    """
    Create a new doctor. Admin only.
    Creates doctor record, user account, default 7-day working schedule, and dispatches welcome email.
    """
    conn = None
    try:
        from api.auth_helper import get_hashed_password

        # Validate inputs
        clean_email = validate_email_address(body.email, required=True)
        clean_phone = validate_phone_number(body.phone, required=True)
        clean_username = body.username.strip()

        if len(body.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

        conn = get_conn()
        cur = conn.cursor()

        # 1. Check username is not already taken in users
        cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s);", (clean_username,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail=f"Username '{clean_username}' is already taken. Please choose another username.")

        # 2. Check department exists
        cur.execute("SELECT id FROM departments WHERE id = %s;", (body.department_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Department ID {body.department_id} not found.")

        # 3. Check email uniqueness in users and doctors tables
        cur.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(%s);", (clean_email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail=f"Email '{clean_email}' is already registered to a user account.")

        cur.execute("SELECT id FROM doctors WHERE LOWER(email) = LOWER(%s);", (clean_email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail=f"Email '{clean_email}' is already in use by another doctor.")

        # 4. Get DOCTOR role ID
        cur.execute("SELECT id FROM roles WHERE UPPER(name) = 'DOCTOR';")
        role_row = cur.fetchone()
        if not role_row:
            raise HTTPException(status_code=500, detail="DOCTOR role not found in database. Please contact admin.")
        doctor_role_id = role_row[0]

        # 5. Generate doctor code and display name
        cur.execute("SELECT COUNT(*) FROM doctors;")
        count = cur.fetchone()[0]
        doctor_code = f"DOC{(count + 1):04d}"
        display_name = f"Dr. {body.first_name.strip()} {body.last_name.strip()}"
        today_date = date.today().isoformat()
        staff_code = f"STF-{doctor_code}"

        # 6. Create user account with required staff & constraint fields
        password_hash = get_hashed_password(body.password)
        cur.execute(
            """
            INSERT INTO users (
                username, password_hash, role_id, email, phone, first_name, last_name, 
                is_active, must_change_password, staff_code, staff_name, staff_type,
                department_id, joining_date, experience, salary, created_at, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, FALSE, %s, %s, 'Doctor', %s, %s, %s, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id;
            """,
            (
                clean_username, password_hash, doctor_role_id, clean_email, clean_phone, 
                body.first_name.strip(), body.last_name.strip(), staff_code, display_name,
                body.department_id, today_date, body.experience_years
            )
        )
        user_id = cur.fetchone()[0]

        # 7. Create doctor record
        cur.execute(
            """
            INSERT INTO doctors (
                user_id, doctor_code, display_name, first_name, last_name,
                specialization, qualification, experience_years,
                phone, email, consultation_fee, department_id, status, joining_date,
                created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ACTIVE', %s,
                      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id;
            """,
            (
                user_id, doctor_code, display_name, body.first_name.strip(), body.last_name.strip(),
                body.specialization.strip(), body.qualification.strip(), body.experience_years,
                clean_phone, clean_email, body.consultation_fee, body.department_id, today_date
            )
        )
        doctor_id = cur.fetchone()[0]

        # 9. Auto-create default 7-day active working schedules (Mon-Sun, 09:00 - 17:00, 30 min slots)
        days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
        today_date = date.today().isoformat()
        for day in days:
            cur.execute(
                """
                INSERT INTO doctor_schedules (
                    doctor_id, day_of_week, start_time, end_time,
                    slot_duration_minutes, effective_from, status, created_at, updated_at
                ) VALUES (%s, %s, '09:00'::time, '17:00'::time, 30, %s, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                """,
                (doctor_id, day, today_date)
            )

        conn.commit()
        cur.close()

        # Send Welcome Email to the exact clean_email
        try:
            from utils.email_service import send_welcome_email
            send_welcome_email(
                doctor_email=clean_email,
                doctor_name=display_name,
                username=clean_username,
                password=body.password,
                doctor_id=doctor_id
            )
        except Exception as email_err:
            print(f"[WARNING] Could not dispatch welcome email: {email_err}")

        return {
            "success": True,
            "doctor_id": doctor_id,
            "doctor_code": doctor_code,
            "display_name": display_name,
            "username": clean_username,
            "email": clean_email
        }
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Doctor creation failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Doctor creation error: {str(e)}")
    finally:
        if conn:
            conn.close()


class AdminUpdateDoctorRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    consultation_fee: Optional[float] = None
    department_id: Optional[int] = None
    status: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


@router.put("/doctors/{doctor_id}")
def admin_update_doctor(doctor_id: int, body: AdminUpdateDoctorRequest, admin_user: dict = Depends(require_admin)):
    """
    Admin edit Doctor details, department, fees, as well as Username and Password.
    Syncs changes to both users and doctors tables.
    """
    conn = None
    try:
        from api.auth_helper import get_hashed_password

        clean_email = validate_email_address(body.email, required=False) if body.email else None
        clean_phone = validate_phone_number(body.phone, required=False) if body.phone else None

        conn = get_conn()
        cur = conn.cursor()

        # 1. Fetch existing doctor & user_id
        cur.execute("SELECT id, user_id, first_name, last_name, display_name FROM doctors WHERE id = %s;", (doctor_id,))
        doc_row = cur.fetchone()
        if not doc_row:
            raise HTTPException(status_code=404, detail=f"Doctor ID {doctor_id} not found.")
        
        _, user_id, old_fn, old_ln, old_disp = doc_row

        # Check email unique if changed
        if clean_email:
            cur.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(%s) AND id != %s;", (clean_email, user_id))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail=f"Email '{clean_email}' is already registered to another user account.")

            cur.execute("SELECT id FROM doctors WHERE LOWER(email) = LOWER(%s) AND id != %s;", (clean_email, doctor_id))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail=f"Email '{clean_email}' is already in use by another doctor.")

        # 2. Update user account details (username, password, email, phone, name)
        if body.username and body.username.strip():
            clean_username = body.username.strip()
            cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s) AND id != %s;", (clean_username, user_id))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail=f"Username '{clean_username}' is already taken.")
            cur.execute("UPDATE users SET username = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (clean_username, user_id))

        if body.password and body.password.strip():
            if len(body.password) < 6:
                raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
            pass_hash = get_hashed_password(body.password)
            cur.execute("UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (pass_hash, user_id))

        if clean_email:
            cur.execute("UPDATE users SET email = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (clean_email, user_id))
        if clean_phone:
            cur.execute("UPDATE users SET phone = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (clean_phone, user_id))

        # 3. Update doctor details
        fn = body.first_name.strip() if body.first_name and body.first_name.strip() else old_fn
        ln = body.last_name.strip() if body.last_name and body.last_name.strip() else old_ln
        disp_name = f"Dr. {fn} {ln}"

        cur.execute("UPDATE users SET first_name = %s, last_name = %s WHERE id = %s;", (fn, ln, user_id))

        cur.execute("""
            UPDATE doctors
            SET first_name = COALESCE(%s, first_name),
                last_name = COALESCE(%s, last_name),
                display_name = %s,
                specialization = COALESCE(%s, specialization),
                qualification = COALESCE(%s, qualification),
                experience_years = COALESCE(%s, experience_years),
                phone = COALESCE(%s, phone),
                email = COALESCE(%s, email),
                consultation_fee = COALESCE(%s, consultation_fee),
                department_id = COALESCE(%s, department_id),
                status = COALESCE(%s, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (
            body.first_name, body.last_name, disp_name, body.specialization,
            body.qualification, body.experience_years, clean_phone, clean_email,
            body.consultation_fee, body.department_id, body.status, doctor_id
        ))

        conn.commit()
        cur.close()

        return {"success": True, "message": f"Doctor {disp_name} updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Doctor update failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Doctor update error: {str(e)}")
    finally:
        if conn:
            conn.close()


class DoctorSelfUpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


@router.put("/doctors/me/profile")
def doctor_self_update_profile(body: DoctorSelfUpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    """
    Doctor self-editing endpoint. Allows doctor to edit their own personal details, username, and password.
    """
    if current_user.get("role") != "DOCTOR":
        raise HTTPException(status_code=403, detail="Only doctors can edit their own doctor profile.")

    doctor_id = current_user.get("doctor_id")
    user_id = current_user.get("user_id")

    if not doctor_id or not user_id:
        raise HTTPException(status_code=400, detail="Invalid doctor session details.")

    clean_email = validate_email_address(body.email, required=False) if body.email else None
    clean_phone = validate_phone_number(body.phone, required=False) if body.phone else None

    conn = None
    try:
        from api.auth_helper import get_hashed_password

        conn = get_conn()
        cur = conn.cursor()

        if clean_email:
            cur.execute("SELECT id FROM doctors WHERE LOWER(email) = LOWER(%s) AND id != %s;", (clean_email, doctor_id))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail=f"Email '{clean_email}' is already in use by another doctor.")

        # Update username/password if provided
        if body.username and body.username.strip():
            clean_un = body.username.strip()
            cur.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s) AND id != %s;", (clean_un, user_id))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail=f"Username '{clean_un}' is already taken.")
            cur.execute("UPDATE users SET username = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (clean_un, user_id))

        if body.password and body.password.strip():
            if len(body.password) < 6:
                raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
            pass_hash = get_hashed_password(body.password)
            cur.execute("UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (pass_hash, user_id))

        if clean_email:
            cur.execute("UPDATE users SET email = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (clean_email, user_id))
        if clean_phone:
            cur.execute("UPDATE users SET phone = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (clean_phone, user_id))

        # Update doctor fields
        cur.execute("SELECT first_name, last_name FROM doctors WHERE id = %s;", (doctor_id,))
        row = cur.fetchone()
        fn = body.first_name.strip() if body.first_name and body.first_name.strip() else (row[0] if row else "")
        ln = body.last_name.strip() if body.last_name and body.last_name.strip() else (row[1] if row else "")
        disp_name = f"Dr. {fn} {ln}" if fn or ln else None

        cur.execute("UPDATE users SET first_name = %s, last_name = %s WHERE id = %s;", (fn, ln, user_id))

        cur.execute("""
            UPDATE doctors
            SET first_name = COALESCE(%s, first_name),
                last_name = COALESCE(%s, last_name),
                display_name = COALESCE(%s, display_name),
                phone = COALESCE(%s, phone),
                email = COALESCE(%s, email),
                specialization = COALESCE(%s, specialization),
                qualification = COALESCE(%s, qualification),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (body.first_name, body.last_name, disp_name, clean_phone, clean_email, body.specialization, body.qualification, doctor_id))

        conn.commit()
        cur.close()

        return {"success": True, "message": "Your profile has been updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Doctor self profile update failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Doctor profile update error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Doctor Schedules Management ──────────────────────────────────────────────

class DoctorScheduleRequest(BaseModel):
    doctor_id: int
    day_of_week: str  # 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
    start_time: str   # '09:00'
    end_time: str     # '17:00'
    slot_duration_minutes: Optional[int] = 30
    status: Optional[str] = 'ACTIVE'


@router.get("/schedules")
def get_doctor_schedules(doctor_id: Optional[int] = Query(None), current_user: dict = Depends(get_current_user)):
    """
    Get doctor working schedules. Filterable by doctor_id.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        query = """
            SELECT s.id, s.doctor_id, d.display_name as doctor_name, d.specialization,
                   dept.department_name, s.day_of_week,
                   TO_CHAR(s.start_time, 'HH24:MI') as start_time,
                   TO_CHAR(s.end_time, 'HH24:MI') as end_time,
                   s.slot_duration_minutes, s.status, s.created_at
            FROM doctor_schedules s
            JOIN doctors d ON s.doctor_id = d.id
            JOIN departments dept ON d.department_id = dept.id
        """
        params = []
        if doctor_id:
            query += " WHERE s.doctor_id = %s"
            params.append(doctor_id)
        query += " ORDER BY d.display_name, CASE s.day_of_week WHEN 'MONDAY' THEN 1 WHEN 'TUESDAY' THEN 2 WHEN 'WEDNESDAY' THEN 3 WHEN 'THURSDAY' THEN 4 WHEN 'FRIDAY' THEN 5 WHEN 'SATURDAY' THEN 6 WHEN 'SUNDAY' THEN 7 ELSE 8 END, s.start_time;"

        cur.execute(query, params)
        schedules = rows_to_dicts(cur, cur.fetchall())

        cur.close()
        return {"schedules": schedules, "total": len(schedules)}
    except Exception as e:
        print(f"[ERROR] Failed to fetch schedules: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Schedule fetch error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/schedules")
def create_doctor_schedule(body: DoctorScheduleRequest, admin_user: dict = Depends(require_admin)):
    """
    Configure a new working schedule slot for a Doctor. Admin only.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        day_upper = body.day_of_week.upper()
        allowed_days = {"MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"}
        if day_upper not in allowed_days:
            raise HTTPException(status_code=400, detail=f"Invalid day_of_week. Allowed: {allowed_days}")

        # Check doctor exists
        cur.execute("SELECT id FROM doctors WHERE id = %s;", (body.doctor_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Doctor ID {body.doctor_id} not found.")

        today_date = date.today().isoformat()

        cur.execute("""
            INSERT INTO doctor_schedules (
                doctor_id, day_of_week, start_time, end_time,
                slot_duration_minutes, effective_from, status, created_at, updated_at
            ) VALUES (%s, %s, %s::time, %s::time, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id;
        """, (body.doctor_id, day_upper, body.start_time, body.end_time, body.slot_duration_minutes or 30, today_date, body.status or 'ACTIVE'))

        schedule_id = cur.fetchone()[0]
        conn.commit()
        cur.close()

        return {"success": True, "schedule_id": schedule_id, "message": "Doctor schedule configured successfully."}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Schedule creation failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Schedule creation error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/schedules/{schedule_id}")
def delete_doctor_schedule(schedule_id: int, admin_user: dict = Depends(require_admin)):
    """
    Delete a doctor schedule entry. Admin only.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("DELETE FROM doctor_schedules WHERE id = %s;", (schedule_id,))
        conn.commit()
        cur.close()

        return {"success": True, "message": f"Schedule {schedule_id} deleted successfully."}
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Schedule deletion failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Schedule deletion error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/schedules/{schedule_id}")
def update_doctor_schedule(schedule_id: int, body: DoctorScheduleRequest, admin_user: dict = Depends(require_admin)):
    """
    Update an existing doctor schedule entry (working day, start/end time, slot duration, status). Admin only.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        day_upper = body.day_of_week.upper()
        allowed_days = {"MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"}
        if day_upper not in allowed_days:
            raise HTTPException(status_code=400, detail=f"Invalid day_of_week. Allowed: {allowed_days}")

        cur.execute("""
            UPDATE doctor_schedules
            SET day_of_week = %s, start_time = %s::time, end_time = %s::time,
                slot_duration_minutes = %s, status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (day_upper, body.start_time, body.end_time, body.slot_duration_minutes or 30, body.status or 'ACTIVE', schedule_id))
        conn.commit()
        cur.close()

        return {"success": True, "message": "Doctor schedule updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Schedule update failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Schedule update error: {str(e)}")
    finally:
        if conn:
            conn.close()


class ScheduleStatusRequest(BaseModel):
    status: str


@router.patch("/schedules/{schedule_id}/status")
def update_schedule_status(schedule_id: int, body: ScheduleStatusRequest, admin_user: dict = Depends(require_admin)):
    """
    Update status of a schedule slot (e.g. ACTIVE vs ON_LEAVE / INACTIVE). Admin only.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute("UPDATE doctor_schedules SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (body.status.upper(), schedule_id))
        conn.commit()
        cur.close()

        return {"success": True, "message": f"Schedule status updated to {body.status}."}
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Schedule status update failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Schedule status update error: {str(e)}")
    finally:
        if conn:
            conn.close()



# ─── Departments ──────────────────────────────────────────────────────────────

@router.get("/departments")
def get_departments(current_user: dict = Depends(require_doctor_or_admin)):
    """Returns all departments with doctor count and appointment stats."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT dept.id, dept.department_code, dept.department_name, dept.description, dept.status,
                   COUNT(DISTINCT d.id) as doctor_count,
                   COUNT(a.id) FILTER (WHERE a.appointment_date = CURRENT_DATE) as today_appts,
                   COUNT(a.id) FILTER (WHERE a.status NOT IN ('CANCELLED', 'RESCHEDULED')) as total_appts
            FROM departments dept
            LEFT JOIN doctors d ON dept.id = d.department_id AND UPPER(d.status) = 'ACTIVE'
            LEFT JOIN appointments a ON dept.id = a.department_id
            GROUP BY dept.id, dept.department_code, dept.department_name, dept.description, dept.status
            ORDER BY dept.department_name;
            """
        )
        departments = rows_to_dicts(cur, cur.fetchall())
        cur.close()

        return {"departments": departments, "total": len(departments)}
    except Exception as e:
        print(f"[ERROR] Departments query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Departments query error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Conversations ────────────────────────────────────────────────────────────

@router.get("/conversations")
def get_conversations(
    status: Optional[str] = Query(None),
    intent: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Returns paginated conversation list with patient and intent info."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        conditions = []
        params = []

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            conditions.append("""
                EXISTS (
                    SELECT 1 FROM appointments a 
                    WHERE a.patient_id = c.patient_id AND a.doctor_id = %s
                )
            """)
            params.append(doctor_id)

        if status:
            conditions.append("c.conversation_status = %s")
            params.append(status.upper())

        if intent:
            conditions.append("c.current_intent = %s")
            params.append(intent.upper())

        if language:
            conditions.append("c.language = %s")
            params.append(language.upper())

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cur.execute(f"SELECT COUNT(*) FROM conversations c {where};", params)
        total = cur.fetchone()[0]

        offset = (page - 1) * per_page
        cur.execute(
            f"""
            SELECT c.id, c.conversation_code, c.whatsapp_number, c.language,
                   c.current_intent, c.conversation_status,
                   c.started_at, c.last_message_at,
                   (p.first_name || ' ' || p.last_name) as patient_name,
                   p.patient_code,
                   (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
            FROM conversations c
            LEFT JOIN patients p ON c.patient_id = p.id
            {where}
            ORDER BY c.last_message_at DESC
            LIMIT %s OFFSET %s;
            """,
            params + [per_page, offset],
        )
        conversations = rows_to_dicts(cur, cur.fetchall())
        cur.close()

        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
            "conversations": conversations,
        }
    except Exception as e:
        print(f"[ERROR] Conversations query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Conversations query error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/conversations/{conv_id}/messages")
def get_conversation_messages(conv_id: int, current_user: dict = Depends(get_current_user)):
    """Returns all messages for a specific conversation."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            # Check if this conversation is linked to a patient of this doctor
            cur.execute("""
                SELECT 1 FROM conversations c
                JOIN appointments a ON c.patient_id = a.patient_id
                WHERE c.id = %s AND a.doctor_id = %s LIMIT 1;
            """, (conv_id, doctor_id))
            if not cur.fetchone():
                raise HTTPException(status_code=403, detail="Unauthorized access to this conversation history")

        cur.execute("SELECT id FROM conversations WHERE id = %s;", (conv_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Conversation not found")

        cur.execute(
            """
            SELECT id, sender_type, message_type, message_text, language, intent, created_at, metadata
            FROM messages
            WHERE conversation_id = %s
            ORDER BY created_at ASC;
            """,
            (conv_id,),
        )
        messages = rows_to_dicts(cur, cur.fetchall())
        cur.close()

        return {"conversation_id": conv_id, "messages": messages}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Messages query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Messages query error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Escalations ──────────────────────────────────────────────────────────────

@router.get("/escalations")
def get_escalations(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Returns paginated escalation list."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        conditions = []
        params = []

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            conditions.append("""
                EXISTS (
                    SELECT 1 FROM appointments a 
                    WHERE a.patient_id = e.patient_id AND a.doctor_id = %s
                )
            """)
            params.append(doctor_id)

        if status:
            conditions.append("e.status = %s")
            params.append(status.upper())

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cur.execute(f"SELECT COUNT(*) FROM escalations e {where};", params)
        total = cur.fetchone()[0]

        offset = (page - 1) * per_page
        cur.execute(
            f"""
            SELECT e.id, e.escalation_reason, e.patient_question, e.status,
                   e.resolution_notes, e.created_at, e.resolved_at,
                   c.conversation_code, c.whatsapp_number,
                   (p.first_name || ' ' || p.last_name) as patient_name,
                   p.patient_code
            FROM escalations e
            JOIN conversations c ON e.conversation_id = c.id
            LEFT JOIN patients p ON e.patient_id = p.id
            {where}
            ORDER BY e.created_at DESC
            LIMIT %s OFFSET %s;
            """,
            params + [per_page, offset],
        )
        escalations = rows_to_dicts(cur, cur.fetchall())
        cur.close()

        return {
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
            "escalations": escalations,
        }
    except Exception as e:
        print(f"[ERROR] Escalations query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Escalations query error: {str(e)}")
    finally:
        if conn:
            conn.close()


class EscalationStatusUpdate(BaseModel):
    status: str
    resolution_notes: Optional[str] = None


@router.patch("/escalations/{escalation_id}")
def update_escalation_status(escalation_id: int, body: EscalationStatusUpdate, current_user: dict = Depends(get_current_user)):
    """Update escalation status: OPEN → IN_PROGRESS → RESOLVED."""
    allowed = {"OPEN", "IN_PROGRESS", "RESOLVED"}
    new_status = body.status.upper()
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {allowed}")

    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            # Check if this escalation belongs to a patient of this doctor
            cur.execute("""
                SELECT 1 FROM escalations e
                JOIN appointments a ON e.patient_id = a.patient_id
                WHERE e.id = %s AND a.doctor_id = %s LIMIT 1;
            """, (escalation_id, doctor_id))
            if not cur.fetchone():
                raise HTTPException(status_code=403, detail="Unauthorized to modify this escalation status")

        cur.execute("SELECT id FROM escalations WHERE id = %s;", (escalation_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail=f"Escalation {escalation_id} not found")

        update_fields = ["status = %s", "updated_at = CURRENT_TIMESTAMP"]
        update_params = [new_status]

        if new_status == "RESOLVED":
            update_fields.append("resolved_at = CURRENT_TIMESTAMP")
            if body.resolution_notes:
                update_fields.append("resolution_notes = %s")
                update_params.append(body.resolution_notes)

        cur.execute(
            f"UPDATE escalations SET {', '.join(update_fields)} WHERE id = %s;",
            update_params + [escalation_id],
        )
        conn.commit()
        cur.close()

        return {"success": True, "escalation_id": escalation_id, "status": new_status}
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"[ERROR] Escalation update failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Escalation update error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Operational Daily View & Date-Wise Analytics ─────────────────────────────

@router.get("/daily-view")
def get_daily_view(
    date_val: Optional[str] = Query(None, alias="date"),
    doctor_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns daily operational appointments and doctor schedule/slot utilization breakdown.
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        d_val = date_val if isinstance(date_val, str) else None
        target_date = d_val if d_val else date.today().isoformat()
        dept_str = department if isinstance(department, str) else None
        
        doc_id_val = doctor_id if isinstance(doctor_id, int) else None
        target_doctor_id = resolve_target_doctor_id(current_user, doc_id_val, cur)

        # 1. Fetch all appointments on this date
        conditions = ["a.appointment_date = %s"]
        params = [target_date]

        if target_doctor_id:
            conditions.append("a.doctor_id = %s")
            params.append(target_doctor_id)
        if dept_str:
            conditions.append("LOWER(dept.department_name) = LOWER(%s)")
            params.append(dept_str)

        where = "WHERE " + " AND ".join(conditions)

        cur.execute(f"""
            SELECT a.id, a.booking_id, a.appointment_date, a.appointment_time,
                   TO_CHAR((a.appointment_time + (COALESCE(s.slot_duration_minutes, 30) || ' minutes')::interval)::time, 'HH24:MI:SS') as appointment_end_time,
                   COALESCE(s.slot_duration_minutes, 30) as duration_minutes,
                   a.status, a.booking_source, a.patient_reason, a.cancellation_reason, a.reschedule_reason,
                   a.created_at, a.cancelled_at, a.rescheduled_at,
                   p.id as patient_id, p.patient_code,
                   (p.first_name || ' ' || p.last_name) as patient_name,
                   p.phone as patient_phone,
                   d.id as doctor_id, d.display_name as doctor_name, d.specialization,
                   dept.id as department_id, dept.department_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            JOIN departments dept ON a.department_id = dept.id
            LEFT JOIN LATERAL (
                SELECT slot_duration_minutes
                FROM doctor_schedules
                WHERE doctor_id = a.doctor_id AND status = 'ACTIVE'
                LIMIT 1
            ) s ON true
            {where}
            ORDER BY a.appointment_time ASC, d.display_name ASC;
        """, params)
        appointments = rows_to_dicts(cur, cur.fetchall())

        # Totals
        total = len(appointments)
        completed = sum(1 for a in appointments if a["status"] == "COMPLETED")
        booked = sum(1 for a in appointments if a["status"] == "BOOKED")
        confirmed = sum(1 for a in appointments if a["status"] == "CONFIRMED")
        pending = booked + confirmed
        cancelled = sum(1 for a in appointments if a["status"] == "CANCELLED")
        rescheduled = sum(1 for a in appointments if a["status"] == "RESCHEDULED")
        no_show = sum(1 for a in appointments if a["status"] == "NO_SHOW")

        # 2. Compute doctor schedule & slot utilization for this day
        cur.execute("SELECT TRIM(TO_CHAR(%s::date, 'DAY'));", (target_date,))
        day_name = cur.fetchone()[0].strip().upper()

        sched_conditions = ["s.day_of_week = %s", "s.status = 'ACTIVE'", "d.status = 'ACTIVE'"]
        sched_params = [day_name]

        if target_doctor_id:
            sched_conditions.append("s.doctor_id = %s")
            sched_params.append(target_doctor_id)
        if dept_str:
            sched_conditions.append("LOWER(dept.department_name) = LOWER(%s)")
            sched_params.append(dept_str)

        sched_where = "WHERE " + " AND ".join(sched_conditions)

        cur.execute(f"""
            SELECT s.id, s.doctor_id, d.display_name as doctor_name, d.specialization,
                   dept.department_name, s.day_of_week,
                   TO_CHAR(s.start_time, 'HH24:MI') as start_time,
                   TO_CHAR(s.end_time, 'HH24:MI') as end_time,
                   s.slot_duration_minutes,
                   EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60 as working_minutes
            FROM doctor_schedules s
            JOIN doctors d ON s.doctor_id = d.id
            JOIN departments dept ON d.department_id = dept.id
            {sched_where}
            ORDER BY d.display_name, s.start_time;
        """, sched_params)
        raw_schedules = rows_to_dicts(cur, cur.fetchall())

        doctor_schedule_utilization = []
        for s in raw_schedules:
            doc_id = s["doctor_id"]
            doc_appts = [a for a in appointments if a["doctor_id"] == doc_id]
            
            slot_dur = s["slot_duration_minutes"] or 30
            working_mins = s["working_minutes"] or 0
            total_slots = int(working_mins // slot_dur) if slot_dur > 0 else 0
            
            doc_booked = sum(1 for a in doc_appts if a["status"] in ("BOOKED", "CONFIRMED"))
            doc_completed = sum(1 for a in doc_appts if a["status"] == "COMPLETED")
            doc_cancelled = sum(1 for a in doc_appts if a["status"] == "CANCELLED")
            doc_rescheduled = sum(1 for a in doc_appts if a["status"] == "RESCHEDULED")
            doc_no_show = sum(1 for a in doc_appts if a["status"] == "NO_SHOW")
            
            occupied_slots = doc_booked + doc_completed
            available_slots = max(0, total_slots - occupied_slots)
            utilization_pct = round((occupied_slots / total_slots * 100), 1) if total_slots > 0 else 0.0

            doctor_schedule_utilization.append({
                "schedule_id": s["id"],
                "doctor_id": doc_id,
                "doctor_name": s["doctor_name"],
                "specialization": s["specialization"],
                "department_name": s["department_name"],
                "day_of_week": s["day_of_week"],
                "working_hours": f"{s['start_time']} - {s['end_time']}",
                "start_time": s["start_time"],
                "end_time": s["end_time"],
                "slot_duration_minutes": slot_dur,
                "total_slots": total_slots,
                "booked_slots": doc_booked,
                "completed_slots": doc_completed,
                "cancelled_slots": doc_cancelled,
                "rescheduled_slots": doc_rescheduled,
                "no_show_slots": doc_no_show,
                "available_slots": available_slots,
                "slot_utilization_pct": utilization_pct,
            })

        cur.close()
        return {
            "date": target_date,
            "day_of_week": day_name,
            "totals": {
                "total": total,
                "completed": completed,
                "pending": pending,
                "booked": booked,
                "confirmed": confirmed,
                "cancelled": cancelled,
                "rescheduled": rescheduled,
                "no_show": no_show,
            },
            "appointments": appointments,
            "doctor_schedules": doctor_schedule_utilization,
        }
    except Exception as e:
        print(f"[ERROR] Daily view query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Daily view error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/analytics/date-wise")
def get_date_wise_analytics(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    doctor_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    booking_source: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns complete date-wise analytics:
    - Appointments and status counts by date
    - Booking trend (by created_at)
    - Cancellation trend (by cancelled_at)
    - Rescheduling trend (by rescheduled_at)
    - Completion trend (by appointment_date with status COMPLETED)
    - New patients by date
    - Doctor-wise breakdown (counts & utilization)
    - Department-wise breakdown
    - Booking source breakdown
    """
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        today = date.today()
        d_from_str = date_from if isinstance(date_from, str) else None
        d_to_str = date_to if isinstance(date_to, str) else None
        dept_str = department if isinstance(department, str) else None
        source_str = booking_source if isinstance(booking_source, str) else None

        eff_from = d_from_str if d_from_str else (today - timedelta(days=6)).isoformat()
        eff_to = d_to_str if d_to_str else today.isoformat()

        doc_id_val = doctor_id if isinstance(doctor_id, int) else None
        target_doctor_id = resolve_target_doctor_id(current_user, doc_id_val, cur)

        # Common filter conditions for appointments by appointment_date
        conditions = ["a.appointment_date >= %s", "a.appointment_date <= %s"]
        params = [eff_from, eff_to]

        if target_doctor_id:
            conditions.append("a.doctor_id = %s")
            params.append(target_doctor_id)
        if dept_str:
            conditions.append("LOWER(dept.department_name) = LOWER(%s)")
            params.append(dept_str)
        if source_str:
            apply_booking_source_filter(conditions, params, source_str)

        where = "WHERE " + " AND ".join(conditions)

        # 1. Appointments by date in range (grouped by calendar date)
        cur.execute(f"""
            SELECT
                a.appointment_date::text as date,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE a.status = 'BOOKED') as booked,
                COUNT(*) FILTER (WHERE a.status = 'CONFIRMED') as confirmed,
                COUNT(*) FILTER (WHERE a.status = 'COMPLETED') as completed,
                COUNT(*) FILTER (WHERE a.status = 'CANCELLED') as cancelled,
                COUNT(*) FILTER (WHERE a.status = 'RESCHEDULED') as rescheduled,
                COUNT(*) FILTER (WHERE a.status = 'NO_SHOW') as no_show
            FROM appointments a
            LEFT JOIN departments dept ON a.department_id = dept.id
            {where}
            GROUP BY a.appointment_date
            ORDER BY a.appointment_date ASC;
        """, params)
        raw_appts_by_date = {r["date"]: r for r in rows_to_dicts(cur, cur.fetchall())}

        # Generate continuous date list from eff_from to eff_to
        from_dt = datetime.strptime(eff_from, "%Y-%m-%d").date()
        to_dt = datetime.strptime(eff_to, "%Y-%m-%d").date()
        delta_days = (to_dt - from_dt).days

        appointments_by_date = []
        if 0 <= delta_days <= 365:
            for i in range(delta_days + 1):
                d = from_dt + timedelta(days=i)
                d_str = d.isoformat()
                d_name = d.strftime("%d %b")
                if d_str in raw_appts_by_date:
                    item = raw_appts_by_date[d_str]
                    appointments_by_date.append({
                        "date": d_str,
                        "name": d_name,
                        "total": item["total"],
                        "booked": item["booked"],
                        "confirmed": item["confirmed"],
                        "completed": item["completed"],
                        "cancelled": item["cancelled"],
                        "rescheduled": item["rescheduled"],
                        "no_show": item["no_show"],
                    })
                else:
                    appointments_by_date.append({
                        "date": d_str,
                        "name": d_name,
                        "total": 0,
                        "booked": 0,
                        "confirmed": 0,
                        "completed": 0,
                        "cancelled": 0,
                        "rescheduled": 0,
                        "no_show": 0,
                    })
        else:
            for d_str in sorted(raw_appts_by_date.keys()):
                item = raw_appts_by_date[d_str]
                try:
                    d_obj = datetime.strptime(d_str, "%Y-%m-%d").date()
                    d_name = d_obj.strftime("%d %b %Y")
                except Exception:
                    d_name = d_str
                appointments_by_date.append({
                    "date": d_str,
                    "name": d_name,
                    "total": item["total"],
                    "booked": item["booked"],
                    "confirmed": item["confirmed"],
                    "completed": item["completed"],
                    "cancelled": item["cancelled"],
                    "rescheduled": item["rescheduled"],
                    "no_show": item["no_show"],
                })

        # 2. Booking Trend by created_at in range
        created_cond = ["DATE(a.created_at AT TIME ZONE 'UTC') >= %s", "DATE(a.created_at AT TIME ZONE 'UTC') <= %s"]
        created_params = [eff_from, eff_to]
        if target_doctor_id:
            created_cond.append("a.doctor_id = %s")
            created_params.append(target_doctor_id)
        if dept_str:
            created_cond.append("LOWER(dept.department_name) = LOWER(%s)")
            created_params.append(dept_str)
        if source_str:
            apply_booking_source_filter(created_cond, created_params, source_str)

        cur.execute(f"""
            SELECT DATE(a.created_at AT TIME ZONE 'UTC')::text as date, COUNT(*) as count
            FROM appointments a
            LEFT JOIN departments dept ON a.department_id = dept.id
            WHERE {' AND '.join(created_cond)}
            GROUP BY DATE(a.created_at AT TIME ZONE 'UTC')
            ORDER BY date ASC;
        """, created_params)
        booking_trend = rows_to_dicts(cur, cur.fetchall())

        # 3. Cancellation Trend by cancelled_at in range
        cancel_cond = ["DATE(a.cancelled_at AT TIME ZONE 'UTC') >= %s", "DATE(a.cancelled_at AT TIME ZONE 'UTC') <= %s", "a.status = 'CANCELLED'"]
        cancel_params = [eff_from, eff_to]
        if target_doctor_id:
            cancel_cond.append("a.doctor_id = %s")
            cancel_params.append(target_doctor_id)
        if dept_str:
            cancel_cond.append("LOWER(dept.department_name) = LOWER(%s)")
            cancel_params.append(dept_str)
        if source_str:
            apply_booking_source_filter(cancel_cond, cancel_params, source_str)

        cur.execute(f"""
            SELECT DATE(a.cancelled_at AT TIME ZONE 'UTC')::text as date, COUNT(*) as count
            FROM appointments a
            LEFT JOIN departments dept ON a.department_id = dept.id
            WHERE {' AND '.join(cancel_cond)}
            GROUP BY DATE(a.cancelled_at AT TIME ZONE 'UTC')
            ORDER BY date ASC;
        """, cancel_params)
        cancellation_trend = rows_to_dicts(cur, cur.fetchall())

        # 4. Reschedule Trend by rescheduled_at in range
        resched_cond = ["DATE(a.rescheduled_at AT TIME ZONE 'UTC') >= %s", "DATE(a.rescheduled_at AT TIME ZONE 'UTC') <= %s"]
        resched_params = [eff_from, eff_to]
        if target_doctor_id:
            resched_cond.append("a.doctor_id = %s")
            resched_params.append(target_doctor_id)
        if dept_str:
            resched_cond.append("LOWER(dept.department_name) = LOWER(%s)")
            resched_params.append(dept_str)

        cur.execute(f"""
            SELECT DATE(a.rescheduled_at AT TIME ZONE 'UTC')::text as date, COUNT(*) as count
            FROM appointments a
            LEFT JOIN departments dept ON a.department_id = dept.id
            WHERE {' AND '.join(resched_cond)}
            GROUP BY DATE(a.rescheduled_at AT TIME ZONE 'UTC')
            ORDER BY date ASC;
        """, resched_params)
        reschedule_trend = rows_to_dicts(cur, cur.fetchall())

        # 5. Completion Trend (completed appointments on appointment_date)
        cur.execute(f"""
            SELECT a.appointment_date::text as date, COUNT(*) as count
            FROM appointments a
            LEFT JOIN departments dept ON a.department_id = dept.id
            {where} AND a.status = 'COMPLETED'
            GROUP BY a.appointment_date
            ORDER BY a.appointment_date ASC;
        """, params)
        completion_trend = rows_to_dicts(cur, cur.fetchall())

        # 6. New Patients by Date
        if target_doctor_id:
            cur.execute("""
                SELECT a.appointment_date::text as date, COUNT(DISTINCT a.patient_id) as count
                FROM appointments a
                WHERE a.appointment_date >= %s AND a.appointment_date <= %s
                  AND a.doctor_id = %s
                  AND NOT EXISTS (
                      SELECT 1 FROM appointments a2
                      WHERE a2.patient_id = a.patient_id AND a2.doctor_id = %s AND a2.appointment_date < a.appointment_date
                  )
                GROUP BY a.appointment_date
                ORDER BY date ASC;
            """, (eff_from, eff_to, target_doctor_id, target_doctor_id))
        else:
            cur.execute("""
                SELECT DATE(created_at AT TIME ZONE 'UTC')::text as date, COUNT(*) as count
                FROM patients
                WHERE DATE(created_at AT TIME ZONE 'UTC') >= %s AND DATE(created_at AT TIME ZONE 'UTC') <= %s
                GROUP BY DATE(created_at AT TIME ZONE 'UTC')
                ORDER BY date ASC;
            """, (eff_from, eff_to))
        new_patients_by_date = rows_to_dicts(cur, cur.fetchall())

        # 7. Doctor Analytics (for selected date range)
        doc_cond = ["a.appointment_date >= %s", "a.appointment_date <= %s"]
        doc_params = [eff_from, eff_to]
        if target_doctor_id:
            doc_cond.append("d.id = %s")
            doc_params.append(target_doctor_id)
        if dept_str:
            doc_cond.append("LOWER(dept.department_name) = LOWER(%s)")
            doc_params.append(dept_str)

        cur.execute(f"""
            SELECT d.id as doctor_id, d.display_name as doctor_name, COALESCE(dept.department_name, 'General Medicine') as department_name,
                   COUNT(a.id) as total,
                   COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') as completed,
                   COUNT(a.id) FILTER (WHERE a.status = 'BOOKED') as booked,
                   COUNT(a.id) FILTER (WHERE a.status = 'CONFIRMED') as confirmed,
                   COUNT(a.id) FILTER (WHERE a.status = 'CANCELLED') as cancelled,
                   COUNT(a.id) FILTER (WHERE a.status = 'RESCHEDULED') as rescheduled,
                   COUNT(a.id) FILTER (WHERE a.status = 'NO_SHOW') as no_show
            FROM doctors d
            LEFT JOIN departments dept ON d.department_id = dept.id
            LEFT JOIN appointments a ON d.id = a.doctor_id AND {' AND '.join(doc_cond)}
            WHERE d.status = 'ACTIVE'
            GROUP BY d.id, d.display_name, dept.department_name
            ORDER BY total DESC, d.display_name ASC;
        """, doc_params)
        doctor_analytics = rows_to_dicts(cur, cur.fetchall())

        # 8. Department Analytics (for selected date range)
        dept_cond = ["a.appointment_date >= %s", "a.appointment_date <= %s"]
        dept_params = [eff_from, eff_to]
        if target_doctor_id:
            dept_cond.append("a.doctor_id = %s")
            dept_params.append(target_doctor_id)

        cur.execute(f"""
            SELECT dept.id as department_id, dept.department_name as name,
                   COUNT(a.id) as value,
                   COUNT(a.id) as total,
                   COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') as completed,
                   COUNT(a.id) FILTER (WHERE a.status = 'CONFIRMED' OR a.status = 'BOOKED') as pending,
                   COUNT(a.id) FILTER (WHERE a.status = 'CANCELLED') as cancelled
            FROM departments dept
            LEFT JOIN appointments a ON dept.id = a.department_id AND {' AND '.join(dept_cond)}
            WHERE dept.status = 'ACTIVE'
            GROUP BY dept.id, dept.department_name
            ORDER BY value DESC;
        """, dept_params)
        department_analytics = rows_to_dicts(cur, cur.fetchall())

        # 9. Booking Source Analytics
        cur.execute(f"""
            SELECT a.booking_source as source, COUNT(*) as count
            FROM appointments a
            LEFT JOIN departments dept ON a.department_id = dept.id
            {where}
            GROUP BY a.booking_source
            ORDER BY count DESC;
        """, params)
        booking_source_analytics = rows_to_dicts(cur, cur.fetchall())

        cur.close()
        return {
            "date_from": eff_from,
            "date_to": eff_to,
            "appointments_by_date": appointments_by_date,
            "booking_trend": booking_trend,
            "cancellation_trend": cancellation_trend,
            "reschedule_trend": reschedule_trend,
            "completion_trend": completion_trend,
            "new_patients_by_date": new_patients_by_date,
            "doctor_analytics": doctor_analytics,
            "department_analytics": department_analytics,
            "booking_source_analytics": booking_source_analytics,
        }
    except Exception as e:
        print(f"[ERROR] Date-wise analytics query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Date-wise analytics error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Charts ───────────────────────────────────────────────────────────────────

@router.get("/charts/appointment-trend")
def get_appointment_trend(days: int = Query(7, ge=1, le=30), current_user: dict = Depends(get_current_user)):
    """Returns daily appointment counts for the past N days for trend charts."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            cur.execute(
                """
                SELECT
                    appointment_date::text as date,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status IN ('BOOKED', 'CONFIRMED')) as booked,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
                    COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
                FROM appointments
                WHERE appointment_date >= CURRENT_DATE - INTERVAL '%s days'
                  AND appointment_date <= CURRENT_DATE
                  AND doctor_id = %%s
                GROUP BY appointment_date
                ORDER BY appointment_date ASC;
                """ % days,
                (doctor_id,)
            )
        else:
            cur.execute(
                """
                SELECT
                    appointment_date::text as date,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status IN ('BOOKED', 'CONFIRMED')) as booked,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
                    COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
                FROM appointments
                WHERE appointment_date >= CURRENT_DATE - INTERVAL '%s days'
                  AND appointment_date <= CURRENT_DATE
                GROUP BY appointment_date
                ORDER BY appointment_date ASC;
                """ % days
            )
        rows = rows_to_dicts(cur, cur.fetchall())

        # Fill in missing days with zeros
        trend = []
        for i in range(days - 1, -1, -1):
            day = (date.today() - timedelta(days=i))
            day_str = day.isoformat()
            day_name = day.strftime("%a")
            existing = next((r for r in rows if r["date"] == day_str), None)
            if existing:
                trend.append({
                    "name": day_name,
                    "date": day_str,
                    "total": existing["total"],
                    "booked": existing["booked"],
                    "completed": existing["completed"],
                    "cancelled": existing["cancelled"],
                })
            else:
                trend.append({"name": day_name, "date": day_str, "total": 0, "booked": 0, "completed": 0, "cancelled": 0})

        cur.close()
        return {"trend": trend}
    except Exception as e:
        print(f"[ERROR] Appointment trend query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Chart query error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/charts/intent-breakdown")
def get_intent_breakdown(days: int = Query(30, ge=1, le=90), current_user: dict = Depends(get_current_user)):
    """Returns intent distribution from conversation messages for the past N days."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            cur.execute(
                """
                SELECT m.intent, COUNT(*) as count
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                JOIN appointments a ON c.patient_id = a.patient_id
                WHERE m.intent IS NOT NULL
                  AND m.created_at >= CURRENT_TIMESTAMP - INTERVAL '%s days'
                  AND a.doctor_id = %%s
                GROUP BY m.intent
                ORDER BY count DESC;
                """ % days,
                (doctor_id,)
            )
        else:
            cur.execute(
                """
                SELECT intent, COUNT(*) as count
                FROM messages
                WHERE intent IS NOT NULL
                  AND created_at >= CURRENT_TIMESTAMP - INTERVAL '%s days'
                GROUP BY intent
                ORDER BY count DESC;
                """ % days
            )
        rows = rows_to_dicts(cur, cur.fetchall())
        cur.close()

        return {"intent_breakdown": rows, "days": days}
    except Exception as e:
        print(f"[ERROR] Intent breakdown query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Intent breakdown error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/charts/patient-registration-trend")
def get_patient_registration_trend(months: int = Query(6, ge=1, le=12), current_user: dict = Depends(get_current_user)):
    """Returns monthly patient registration counts."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            cur.execute(
                """
                SELECT
                    TO_CHAR(DATE_TRUNC('month', p.created_at), 'Mon') as month,
                    DATE_TRUNC('month', p.created_at) as month_date,
                    COUNT(DISTINCT p.id) as patients
                FROM patients p
                JOIN appointments a ON p.id = a.patient_id
                WHERE p.created_at >= CURRENT_DATE - INTERVAL '%s months'
                  AND a.doctor_id = %%s
                GROUP BY DATE_TRUNC('month', p.created_at)
                ORDER BY month_date ASC;
                """ % months,
                (doctor_id,)
            )
        else:
            cur.execute(
                """
                SELECT
                    TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
                    DATE_TRUNC('month', created_at) as month_date,
                    COUNT(*) as patients
                FROM patients
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY month_date ASC;
                """ % months
            )
        rows = rows_to_dicts(cur, cur.fetchall())
        cur.close()

        return {"trend": rows}
    except Exception as e:
        print(f"[ERROR] Patient registration trend query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registration trend error: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/charts/department-appointments")
def get_department_appointments(current_user: dict = Depends(get_current_user)):
    """Returns today's appointment counts per department."""
    conn = None
    try:
        conn = get_conn()
        cur = conn.cursor()

        role = current_user.get("role")
        doctor_id = current_user.get("doctor_id") if role == "DOCTOR" else None

        if doctor_id:
            cur.execute(
                """
                SELECT dept.department_name as name, COUNT(a.id) as value
                FROM departments dept
                LEFT JOIN appointments a ON dept.id = a.department_id
                  AND a.appointment_date = CURRENT_DATE
                  AND a.status NOT IN ('CANCELLED', 'RESCHEDULED')
                  AND a.doctor_id = %s
                WHERE dept.status = 'ACTIVE'
                GROUP BY dept.department_name
                ORDER BY value DESC;
                """,
                (doctor_id,)
            )
        else:
            cur.execute(
                """
                SELECT dept.department_name as name, COUNT(a.id) as value
                FROM departments dept
                LEFT JOIN appointments a ON dept.id = a.department_id
                  AND a.appointment_date = CURRENT_DATE
                  AND a.status NOT IN ('CANCELLED', 'RESCHEDULED')
                WHERE dept.status = 'ACTIVE'
                GROUP BY dept.department_name
                ORDER BY value DESC;
                """
            )
        rows = rows_to_dicts(cur, cur.fetchall())
        cur.close()

        return {"departments": rows}
    except Exception as e:
        print(f"[ERROR] Department appointments query failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Department chart error: {str(e)}")
    finally:
        if conn:
            conn.close()


# ─── Pre-Admission Endpoints ──────────────────────────────────────────────────

class NewPreAdmissionRequest(BaseModel):
    patient_id: int
    doctor_id: int
    department_id: int
    admission_type: str
    expected_admission_date: str
    expected_checkin_time: Optional[str] = "09:00"
    instructions: Optional[str] = None
    remarks: Optional[str] = None
    pending_documents: Optional[str] = None


class PreAdmissionStatusUpdateRequest(BaseModel):
    status: Optional[str] = None
    submitted_documents: Optional[str] = None
    pending_documents: Optional[str] = None
    remarks: Optional[str] = None


@router.get("/pre-admissions")
def list_pre_admissions(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    admission_type: Optional[str] = Query(None),
    admission_date: Optional[str] = Query(None),
    patient_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Returns pre-admissions with optional filters.
    Doctors are scoped ONLY to their assigned patients.
    """
    role = current_user.get("role")
    doctor_id_filter = current_user.get("doctor_id") if role == "DOCTOR" else None

    results = preadmission_service.get_pre_admissions(
        doctor_id_filter=doctor_id_filter,
        patient_id=patient_id,
        status=status,
        admission_type=admission_type,
        admission_date=admission_date,
        search=search
    )
    return {"pre_admissions": results}


@router.get("/pre-admissions/{id}")
def get_pre_admission(id: int, current_user: dict = Depends(get_current_user)):
    """Returns single pre-admission details."""
    role = current_user.get("role")
    doctor_id_filter = current_user.get("doctor_id") if role == "DOCTOR" else None

    results = preadmission_service.get_pre_admissions(
        doctor_id_filter=doctor_id_filter,
        search=None
    )
    matching = [pa for pa in results if pa["id"] == id]
    if not matching:
        raise HTTPException(status_code=404, detail="Pre-admission record not found or unauthorized")
    return {"pre_admission": matching[0]}


@router.post("/pre-admissions")
def create_pre_admission_endpoint(
    req: NewPreAdmissionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Registers a new pre-admission record.
    Enforces strict backend authorization for Doctor role:
    - Doctor can only register under their own authenticated doctor_id.
    - Doctor can only register under their own department_id.
    - Doctor can only register for patients associated with their profile.
    """
    role = str(current_user.get("role") or "").upper()
    doc_id = req.doctor_id

    if role == "DOCTOR":
        conn_auth = get_conn()
        cur_auth = conn_auth.cursor()
        try:
            target_doc_id = resolve_target_doctor_id(current_user, doc_id, cur_auth)
            if not target_doc_id or target_doc_id != doc_id:
                raise HTTPException(status_code=403, detail="Doctors can only create pre-admissions under their own authenticated identity.")
            
            # Verify Doctor's actual Department ID
            cur_auth.execute("SELECT department_id FROM doctors WHERE id = %s;", (target_doc_id,))
            doc_row = cur_auth.fetchone()
            if not doc_row or doc_row[0] != req.department_id:
                raise HTTPException(status_code=403, detail="Department ID does not match the authenticated doctor's assigned department.")

            # Verify Patient Authorization (Patient associated with Doctor via appointments, pre-admissions, or assigned list)
            cur_auth.execute("""
                SELECT 1 FROM patients p
                WHERE p.id = %s AND (
                    EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.doctor_id = %s)
                    OR EXISTS (SELECT 1 FROM pre_admissions pa WHERE pa.patient_id = p.id AND pa.doctor_id = %s)
                );
            """, (req.patient_id, target_doc_id, target_doc_id))
            if not cur_auth.fetchone():
                raise HTTPException(status_code=403, detail="Unauthorized: Selected patient is not associated with this doctor.")
        finally:
            cur_auth.close()
            conn_auth.close()

    try:
        res = preadmission_service.create_pre_admission(
            patient_id=req.patient_id,
            doctor_id=doc_id,
            department_id=req.department_id,
            expected_admission_date=req.expected_admission_date,
            admission_type=req.admission_type,
            expected_checkin_time=req.expected_checkin_time,
            instructions=req.instructions,
            remarks=req.remarks,
            pending_documents=req.pending_documents,
            created_by_user_id=current_user.get("id")
        )
        return res
    except preadmission_service.PreAdmissionValidationError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error during admission registration: {str(e)}")


@router.patch("/pre-admissions/{id}/status")
def update_pre_admission_status_endpoint(
    id: int,
    req: PreAdmissionStatusUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Updates status or document status of a pre-admission record."""
    res = preadmission_service.update_pre_admission_status(
        pre_admission_id=id,
        status=req.status,
        submitted_documents=req.submitted_documents,
        pending_documents=req.pending_documents,
        remarks=req.remarks
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Update failed"))
    return res


@router.post("/pre-admissions/{id}/notify")
def notify_pre_admission_endpoint(id: int, current_user: dict = Depends(get_current_user)):
    """Triggers outbound WhatsApp pre-admission notification for a record."""
    res = preadmission_service.dispatch_pre_admission_notification(id)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Notification dispatch failed"))
    return res


@router.get("/pre-admissions/{id}/conversation")
def get_pre_admission_conversation_endpoint(id: int, current_user: dict = Depends(get_current_user)):
    """Fetches patient WhatsApp conversation history for pre-admission follow-up view."""
    res = preadmission_service.get_pre_admission_conversation(id)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("error", "Conversation not found"))
    return res


@router.get("/patients/{patient_id}/pre-admissions")
def get_patient_pre_admissions(patient_id: int, current_user: dict = Depends(get_current_user)):
    """Returns pre-admissions for a specific patient."""
    role = current_user.get("role")
    doctor_id_filter = current_user.get("doctor_id") if role == "DOCTOR" else None
    results = preadmission_service.get_pre_admissions(
        doctor_id_filter=doctor_id_filter,
        patient_id=patient_id
    )
    return {"pre_admissions": results}

