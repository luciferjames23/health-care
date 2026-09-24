"""
FastAPI Router for Clinical Operations & Front-Office Modules:
- Emergency & Trauma Board
- Consultant Schedules & Rotas
- Inpatient Nursing Tasks
- Medication Administration (eMAR)
- OT & Surgery Suites
- Blood Bank Component Inventory
- Medico-Legal Cases (MLC)
- Statutory Death Registry
- Ward Clinical Handover (SBAR)
- OT Scheduling & Slots
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import psycopg2.extras
from db.postgres_connector import PostgresConnector

router = APIRouter(
    prefix="/api/v1/clinical-ops",
    tags=["Clinical Operations & Front-Office APIs"]
)

db_connector = PostgresConnector()

# ---------------------------------------------------------------------------
# 1. EMERGENCY & TRAUMA BOARD
# ---------------------------------------------------------------------------
class EmergencyTriageCreate(BaseModel):
    id: Optional[str] = None
    bay: Optional[str] = "Bay 01"
    patient_name: str
    age_gender: Optional[str] = None
    triage_level: Optional[str] = "Yellow"
    chief_complaint: str
    bp: Optional[str] = None
    hr: Optional[int] = None
    spo2: Optional[str] = None
    doctor_name: Optional[str] = None
    elapsed_time: Optional[str] = "Just Arrived"
    clinical_status: Optional[str] = "Awaiting triage"
    arrival_time: Optional[str] = None
    waiting_time: Optional[str] = None
    acuity: Optional[str] = "Not triaged"
    critical_alert: Optional[str] = None
    mlc_flag: Optional[bool] = False

class EmergencyTriageUpdate(BaseModel):
    bay: Optional[str] = None
    triage_level: Optional[str] = None
    clinical_status: Optional[str] = None
    doctor_name: Optional[str] = None
    bp: Optional[str] = None
    hr: Optional[int] = None
    spo2: Optional[str] = None
    acuity: Optional[str] = None
    critical_alert: Optional[str] = None
    waiting_time: Optional[str] = None
    arrival_time: Optional[str] = None

@router.get("/emergency", summary="List Emergency & Trauma Cases")
def get_emergency_cases():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT * FROM emergency_triage 
            ORDER BY 
                CASE 
                    WHEN acuity = 'Not triaged' OR acuity IS NULL THEN 0
                    WHEN acuity LIKE '%ESI-1%' THEN 1
                    WHEN acuity LIKE '%ESI-2%' THEN 2
                    WHEN acuity LIKE '%ESI-3%' THEN 3
                    WHEN acuity LIKE '%ESI-4%' THEN 4
                    WHEN acuity LIKE '%ESI-5%' THEN 5
                    ELSE 6
                END,
                id ASC;
        """)
        rows = cur.fetchall()
        return {
            "success": True,
            "count": len(rows),
            "data": rows
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/emergency", summary="Create / Admit Emergency Patient")
def create_emergency_case(body: EmergencyTriageCreate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        if not body.id:
            cur.execute("SELECT COUNT(*) FROM emergency_triage;")
            c = cur.fetchone()[0] + 401
            case_id = f"ER-{c}"
        else:
            case_id = body.id

        cur.execute("""
            INSERT INTO emergency_triage (id, bay, patient_name, age_gender, triage_level, chief_complaint, bp, hr, spo2, doctor_name, elapsed_time, clinical_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                bay = EXCLUDED.bay,
                triage_level = EXCLUDED.triage_level,
                clinical_status = EXCLUDED.clinical_status;
        """, (case_id, body.bay, body.patient_name, body.age_gender, body.triage_level, body.chief_complaint, body.bp, body.hr, body.spo2, body.doctor_name, body.elapsed_time, body.clinical_status))
        conn.commit()
        return {"success": True, "id": case_id, "message": "Emergency case registered"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.patch("/emergency/{case_id}", summary="Update Emergency Patient Status/Vitals")
def update_emergency_case(case_id: str, body: EmergencyTriageUpdate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        fields = []
        vals = []
        for k, v in body.dict(exclude_unset=True).items():
            fields.append(f"{k} = %s")
            vals.append(v)
        if not fields:
            return {"success": True, "message": "No updates provided"}
        vals.append(case_id)
        cur.execute(f"UPDATE emergency_triage SET {', '.join(fields)} WHERE id = %s;", vals)
        conn.commit()
        return {"success": True, "message": f"Case {case_id} updated"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 2. CONSULTANT SCHEDULES
# ---------------------------------------------------------------------------
class ScheduleCreate(BaseModel):
    doctor_name: str
    specialty: str
    opd_hours: str
    clinic_days: str
    room_no: str
    on_call_assignment: Optional[str] = None
    status: Optional[str] = "Active"
    slot_duration_mins: Optional[int] = 15
    booked_today_count: Optional[int] = 0
    total_today_slots: Optional[int] = 16
    tomorrow_schedule: Optional[str] = "Not consulting"
    is_consulting_today: Optional[bool] = True

class ScheduleUpdate(BaseModel):
    opd_hours: Optional[str] = None
    clinic_days: Optional[str] = None
    room_no: Optional[str] = None
    on_call_assignment: Optional[str] = None
    status: Optional[str] = None
    slot_duration_mins: Optional[int] = None
    booked_today_count: Optional[int] = None
    total_today_slots: Optional[int] = None
    tomorrow_schedule: Optional[str] = None
    is_consulting_today: Optional[bool] = None

@router.get("/schedules", summary="List Consultant Rosters & Schedules")
def get_consultant_schedules():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT * FROM consultant_schedules ORDER BY id ASC;")
        rows = cur.fetchall()
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/schedules", summary="Add Consultant Schedule")
def create_consultant_schedule(body: ScheduleCreate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO consultant_schedules (doctor_name, specialty, opd_hours, clinic_days, room_no, on_call_assignment, status, slot_duration_mins, booked_today_count, total_today_slots, tomorrow_schedule, is_consulting_today)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (body.doctor_name, body.specialty, body.opd_hours, body.clinic_days, body.room_no, body.on_call_assignment, body.status, body.slot_duration_mins, body.booked_today_count, body.total_today_slots, body.tomorrow_schedule, body.is_consulting_today))
        new_id = cur.fetchone()[0]
        conn.commit()
        return {"success": True, "id": new_id, "message": "Schedule created"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.patch("/schedules/{schedule_id}", summary="Update Consultant Schedule")
def update_consultant_schedule(schedule_id: int, body: ScheduleUpdate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        fields = []
        vals = []
        for k, v in body.dict(exclude_unset=True).items():
            fields.append(f"{k} = %s")
            vals.append(v)
        if not fields:
            return {"success": True, "message": "No updates"}
        fields.append("updated_at = CURRENT_TIMESTAMP")
        vals.append(schedule_id)
        cur.execute(f"UPDATE consultant_schedules SET {', '.join(fields)} WHERE id = %s;", vals)
        conn.commit()
        return {"success": True, "message": f"Schedule {schedule_id} updated"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


class NursingTaskCreate(BaseModel):
    bed_no: str
    patient_name: str
    uhid: Optional[str] = None
    task_description: str
    status: Optional[str] = "Due Now"
    assigned_nurse: Optional[str] = None
    clinical_notes: Optional[str] = None
    last_vitals_time: Optional[str] = None
    hr: Optional[int] = None
    bp: Optional[str] = None
    spo2: Optional[str] = None
    temp: Optional[float] = None
    rr: Optional[int] = None
    pain_score: Optional[int] = None
    ews_score: Optional[int] = 0
    fall_risk: Optional[str] = "Low / Low"
    diet_type: Optional[str] = "Standard"
    overdue_meds: Optional[str] = "—"
    flag_status: Optional[str] = "Normal"
    ward_name: Optional[str] = "Cardiac & Medical Wards"

class NursingTaskUpdate(BaseModel):
    status: Optional[str] = None
    assigned_nurse: Optional[str] = None
    clinical_notes: Optional[str] = None
    hr: Optional[int] = None
    bp: Optional[str] = None
    spo2: Optional[str] = None
    temp: Optional[float] = None
    rr: Optional[int] = None
    pain_score: Optional[int] = None
    ews_score: Optional[int] = None
    fall_risk: Optional[str] = None
    diet_type: Optional[str] = None
    overdue_meds: Optional[str] = None
    flag_status: Optional[str] = None

@router.get("/nursing", summary="List Inpatient Nursing Tasks")
def get_nursing_tasks():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT * FROM nursing_tasks 
            ORDER BY 
                CASE 
                    WHEN flag_status LIKE '%Critical%' OR flag_status LIKE '%escalate%' THEN 0
                    WHEN flag_status LIKE '%watch%' OR flag_status LIKE '%Pending%' THEN 1
                    ELSE 2
                END,
                ews_score DESC,
                id ASC;
        """)
        rows = cur.fetchall()
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/nursing", summary="Create Inpatient Nursing Task")
def create_nursing_task(body: NursingTaskCreate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO nursing_tasks (bed_no, patient_name, uhid, task_description, status, assigned_nurse, clinical_notes, last_vitals_time, hr, bp, spo2, temp, rr, pain_score, ews_score, fall_risk, diet_type, overdue_meds, flag_status, ward_name)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (body.bed_no, body.patient_name, body.uhid, body.task_description, body.status, body.assigned_nurse, body.clinical_notes, body.last_vitals_time, body.hr, body.bp, body.spo2, body.temp, body.rr, body.pain_score, body.ews_score, body.fall_risk, body.diet_type, body.overdue_meds, body.flag_status, body.ward_name))
        new_id = cur.fetchone()[0]
        conn.commit()
        return {"success": True, "id": new_id, "message": "Nursing task logged"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.patch("/nursing/{task_id}", summary="Update Nursing Task Status / Sign-off")
def update_nursing_task(task_id: int, body: NursingTaskUpdate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        fields = []
        vals = []
        for k, v in body.dict(exclude_unset=True).items():
            fields.append(f"{k} = %s")
            vals.append(v)
            if k == 'status' and v == 'Completed':
                fields.append("completed_at = CURRENT_TIMESTAMP")
        if not fields:
            return {"success": True, "message": "No updates"}
        vals.append(task_id)
        cur.execute(f"UPDATE nursing_tasks SET {', '.join(fields)} WHERE id = %s;", vals)
        conn.commit()
        return {"success": True, "message": f"Task {task_id} updated"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 4. MEDICATION ADMINISTRATION (eMAR)
# ---------------------------------------------------------------------------
class EmarCreate(BaseModel):
    scheduled_time: str
    patient_name: str
    bed_no: str
    medication_name: str
    dosage_route: str
    status: Optional[str] = "Scheduled"
    stage: Optional[str] = "Scheduled"
    is_high_alert: Optional[bool] = False
    is_overdue: Optional[bool] = False
    prescribed_by: Optional[str] = None
    verification_status: Optional[str] = "Verified"
    administered_by: Optional[str] = None
    signed_at: Optional[str] = None

class EmarSignOff(BaseModel):
    status: Optional[str] = "Given"
    stage: Optional[str] = "Completed"
    administered_by: Optional[str] = "Anitha Kumar, RN"
    signed_at: Optional[str] = None

@router.get("/emar", summary="List eMAR Medication Rounds")
def get_emar_records():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT * FROM emar_records ORDER BY id ASC;")
        rows = cur.fetchall()
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/emar", summary="Schedule Medication Dose")
def create_emar_record(body: EmarCreate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO emar_records (scheduled_time, patient_name, bed_no, medication_name, dosage_route, status, stage, is_high_alert, is_overdue, prescribed_by, verification_status, administered_by, signed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (body.scheduled_time, body.patient_name, body.bed_no, body.medication_name, body.dosage_route, body.status, body.stage, body.is_high_alert, body.is_overdue, body.prescribed_by, body.verification_status, body.administered_by, body.signed_at))
        new_id = cur.fetchone()[0]
        conn.commit()
        return {"success": True, "id": new_id, "message": "eMAR entry added"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.patch("/emar/{record_id}", summary="Sign-off Barcode Drug Administration")
def update_emar_record(record_id: int, body: EmarSignOff):
    conn = db_connector.get_connection()
    try:
        import datetime
        cur = conn.cursor()
        sign_time = body.signed_at or datetime.datetime.now().strftime("%I:%M %p")
        cur.execute("""
            UPDATE emar_records
            SET status = %s, stage = %s, administered_by = %s, signed_at = %s
            WHERE id = %s;
        """, (body.status, body.stage, body.administered_by, sign_time, record_id))
        conn.commit()
        return {"success": True, "message": f"Medication record {record_id} marked as {body.status}"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 5. OT & SURGERY SUITE
# ---------------------------------------------------------------------------
class SurgeryCreate(BaseModel):
    case_number: Optional[str] = None
    ot_suite: str
    patient_name: str
    procedure_name: str
    lead_surgeon: str
    anesthetist: Optional[str] = None
    intraop_stage: Optional[str] = "Pre-op Anesthesia Induction"
    stage: Optional[str] = "Scheduled"
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[str] = "Active"
    consent_status: Optional[str] = "Obtained"
    is_emergency: Optional[bool] = False
    is_delayed: Optional[bool] = False
    blood_reserved: Optional[str] = "2 PRBC Reserved"
    sterile_set_verified: Optional[bool] = True
    pacu_bed: Optional[str] = None

class SurgeryUpdate(BaseModel):
    intraop_stage: Optional[str] = None
    stage: Optional[str] = None
    status: Optional[str] = None
    end_time: Optional[str] = None
    consent_status: Optional[str] = None
    pacu_bed: Optional[str] = None

@router.get("/surgery", summary="List Active Surgery Cases")
def get_surgery_cases():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT * FROM ot_surgeries ORDER BY id ASC;")
        rows = cur.fetchall()
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/surgery", summary="Schedule OT Surgery Case")
def create_surgery_case(body: SurgeryCreate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        case_num = body.case_number or f"SUR-2026-{420 + cur.execute('SELECT COUNT(*) FROM ot_surgeries') or 1}"
        cur.execute("""
            INSERT INTO ot_surgeries (case_number, ot_suite, patient_name, procedure_name, lead_surgeon, anesthetist, intraop_stage, stage, start_time, end_time, status, consent_status, is_emergency, is_delayed, blood_reserved, sterile_set_verified, pacu_bed)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (case_num, body.ot_suite, body.patient_name, body.procedure_name, body.lead_surgeon, body.anesthetist, body.intraop_stage, body.stage, body.start_time, body.end_time, body.status, body.consent_status, body.is_emergency, body.is_delayed, body.blood_reserved, body.sterile_set_verified, body.pacu_bed))
        new_id = cur.fetchone()[0]
        conn.commit()
        return {"success": True, "id": new_id, "message": "Surgery case scheduled"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.patch("/surgery/{case_id}", summary="Update Intra-Op Stage / PACU")
def update_surgery_case(case_id: int, body: SurgeryUpdate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        fields = []
        vals = []
        for k, v in body.dict(exclude_unset=True).items():
            fields.append(f"{k} = %s")
            vals.append(v)
        if not fields:
            return {"success": True, "message": "No updates"}
        vals.append(case_id)
        cur.execute(f"UPDATE ot_surgeries SET {', '.join(fields)} WHERE id = %s;", vals)
        conn.commit()
        return {"success": True, "message": f"Surgery {case_id} updated"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 6. BLOOD BANK INVENTORY
# ---------------------------------------------------------------------------
class BloodStockUpdate(BaseModel):
    prbc_units: Optional[int] = None
    ffp_units: Optional[int] = None
    platelet_bags: Optional[int] = None
    reserved_units: Optional[int] = None
    stock_status: Optional[str] = None

class BloodUnitUpdate(BaseModel):
    status: Optional[str] = None
    reserved_for: Optional[str] = None
    storage_location: Optional[str] = None

@router.get("/bloodbank/units", summary="List All Blood Bank Units and Requests")
def get_blood_units():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT * FROM blood_bank_units 
            ORDER BY 
                CASE 
                    WHEN unit_id LIKE 'BR-%' THEN 0 
                    ELSE 1 
                END, 
                id ASC;
        """)
        rows = cur.fetchall()
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.patch("/bloodbank/units/{unit_id}", summary="Update Blood Unit Status / Reserve")
def update_blood_unit(unit_id: str, body: BloodUnitUpdate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        fields = []
        vals = []
        for k, v in body.dict(exclude_unset=True).items():
            fields.append(f"{k} = %s")
            vals.append(v)
        if not fields:
            return {"success": True, "message": "No updates"}
        vals.append(unit_id)
        cur.execute(f"UPDATE blood_bank_units SET {', '.join(fields)} WHERE unit_id = %s;", vals)
        conn.commit()
        return {"success": True, "message": f"Unit {unit_id} updated"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 7. MEDICO-LEGAL CASES (MLC)
# ---------------------------------------------------------------------------
class MlcCreate(BaseModel):
    mlc_number: Optional[str] = None
    registration_date: Optional[str] = None
    patient_name: str
    age_gender: Optional[str] = None
    incident_type: str
    police_station: str
    investigating_officer: str
    injury_report: str
    status: Optional[str] = "Police Intimated & Acknowledged"

@router.get("/mlc", summary="List Medico-Legal Cases")
def get_mlc_records():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT * FROM mlc_records ORDER BY created_at DESC;")
        rows = cur.fetchall()
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/mlc", summary="Register Medico-Legal Case")
def create_mlc_record(body: MlcCreate):
    conn = db_connector.get_connection()
    try:
        import datetime
        cur = conn.cursor()
        if not body.mlc_number:
            cur.execute("SELECT COUNT(*) FROM mlc_records;")
            c = cur.fetchone()[0] + 43
            mlc_no = f"MLC-2026-{c:03d}"
        else:
            mlc_no = body.mlc_number

        reg_date = body.registration_date or datetime.datetime.now().strftime("%d %b %Y")

        cur.execute("""
            INSERT INTO mlc_records (mlc_number, registration_date, patient_name, age_gender, incident_type, police_station, investigating_officer, injury_report, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (mlc_number) DO UPDATE SET status = EXCLUDED.status;
        """, (mlc_no, reg_date, body.patient_name, body.age_gender, body.incident_type, body.police_station, body.investigating_officer, body.injury_report, body.status))
        conn.commit()
        return {"success": True, "mlc_number": mlc_no, "message": "MLC record registered"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 8. STATUTORY DEATH REGISTRY
# ---------------------------------------------------------------------------
class DeathRecordCreate(BaseModel):
    death_reg_no: Optional[str] = None
    patient_name: str
    uhid: Optional[str] = None
    age_gender: Optional[str] = None
    date_time_of_death: str
    primary_cause_of_death: str
    secondary_cause: Optional[str] = None
    certifying_doctor: str
    mccd_status: Optional[str] = "Form 4 Issued"
    mortuary_bay: Optional[str] = "Bay 01 (Refrigerated)"
    body_handed_over_to: Optional[str] = None
    department: Optional[str] = "Emergency"
    is_mlc: Optional[bool] = False
    mlc_details: Optional[str] = None
    bill_status: Optional[str] = "Compassionate Review · Closed"

@router.get("/death-registry", summary="List Death & Mortuary Registry Records")
def get_death_records():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT * FROM death_registry ORDER BY created_at DESC;")
        rows = cur.fetchall()
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/death-registry", summary="Register Deceased Patient & Issue MCCD")
def create_death_record(body: DeathRecordCreate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        if not body.death_reg_no:
            cur.execute("SELECT COUNT(*) FROM death_registry;")
            c = cur.fetchone()[0] + 1
            reg_no = f"DR-2026-{c:03d}"
        else:
            reg_no = body.death_reg_no

        cur.execute("""
            INSERT INTO death_registry (death_reg_no, patient_name, uhid, age_gender, date_time_of_death, primary_cause_of_death, secondary_cause, certifying_doctor, mccd_status, mortuary_bay, body_handed_over_to, department, is_mlc, mlc_details, bill_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (death_reg_no) DO UPDATE SET mccd_status = EXCLUDED.mccd_status;
        """, (reg_no, body.patient_name, body.uhid, body.age_gender, body.date_time_of_death, body.primary_cause_of_death, body.secondary_cause, body.certifying_doctor, body.mccd_status, body.mortuary_bay, body.body_handed_over_to, body.department, body.is_mlc, body.mlc_details, body.bill_status))
        conn.commit()
        return {"success": True, "death_reg_no": reg_no, "message": "Death record registered and MCCD generated"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 9. WARD HANDOVER (SBAR)
# ---------------------------------------------------------------------------
class SbarCreate(BaseModel):
    bed_no: Optional[str] = None
    patient_name: str
    uhid: Optional[str] = None
    age_gender: Optional[str] = None
    ews: Optional[str] = None
    mar_due: Optional[str] = None
    last_handover_time: Optional[str] = None
    from_nurse: Optional[str] = None
    to_nurse: Optional[str] = None
    situation: Optional[str] = None
    background: Optional[str] = None
    assessment: Optional[str] = None
    recommendation: Optional[str] = None
    sbar_full: Optional[str] = None
    status: Optional[str] = 'Stale'
    handover_shift: Optional[str] = 'Morning (07:00 - 15:00)'
    acknowledged: Optional[bool] = False

class SbarUpdate(BaseModel):
    bed_no: Optional[str] = None
    situation: Optional[str] = None
    background: Optional[str] = None
    assessment: Optional[str] = None
    recommendation: Optional[str] = None
    sbar_full: Optional[str] = None
    from_nurse: Optional[str] = None
    to_nurse: Optional[str] = None
    last_handover_time: Optional[str] = None
    status: Optional[str] = None
    acknowledged: Optional[bool] = None

@router.get("/sbar", summary="List Ward SBAR Handover Cards")
def get_sbar_handovers():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT * FROM ward_sbar_handovers ORDER BY id ASC;")
        rows = cur.fetchall()
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/sbar", summary="Create SBAR Shift Handover Card")
def create_sbar_handover(body: SbarCreate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        sbar_full = body.sbar_full or f"S: {body.situation or ''}. B: {body.background or ''}. A: {body.assessment or ''}. R: {body.recommendation or ''}."
        cur.execute("""
            INSERT INTO ward_sbar_handovers (
                bed_no, patient_name, uhid, age_gender, ews, mar_due, last_handover_time,
                from_nurse, to_nurse, situation, background, assessment, recommendation,
                sbar_full, status, handover_shift, acknowledged
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
        """, (
            body.bed_no, body.patient_name, body.uhid, body.age_gender, body.ews, body.mar_due,
            body.last_handover_time, body.from_nurse, body.to_nurse, body.situation, body.background,
            body.assessment, body.recommendation, sbar_full, body.status or 'Stale',
            body.handover_shift or 'Morning (07:00 - 15:00)', body.acknowledged or False
        ))
        new_id = cur.fetchone()[0]
        conn.commit()
        return {"success": True, "id": new_id, "message": "SBAR handover logged"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.patch("/sbar/{handover_id}", summary="Update SBAR Handover Record")
def update_sbar_handover(handover_id: int, body: SbarUpdate):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        updates = []
        params = []
        if body.bed_no is not None:
            updates.append("bed_no = %s")
            params.append(body.bed_no)
        if body.situation is not None:
            updates.append("situation = %s")
            params.append(body.situation)
        if body.background is not None:
            updates.append("background = %s")
            params.append(body.background)
        if body.assessment is not None:
            updates.append("assessment = %s")
            params.append(body.assessment)
        if body.recommendation is not None:
            updates.append("recommendation = %s")
            params.append(body.recommendation)
        if body.sbar_full is not None:
            updates.append("sbar_full = %s")
            params.append(body.sbar_full)
        if body.from_nurse is not None:
            updates.append("from_nurse = %s")
            params.append(body.from_nurse)
        if body.to_nurse is not None:
            updates.append("to_nurse = %s")
            params.append(body.to_nurse)
        if body.last_handover_time is not None:
            updates.append("last_handover_time = %s")
            params.append(body.last_handover_time)
        if body.status is not None:
            updates.append("status = %s")
            params.append(body.status)
        if body.acknowledged is not None:
            updates.append("acknowledged = %s")
            params.append(body.acknowledged)
            if body.acknowledged:
                updates.append("acknowledged_at = CURRENT_TIMESTAMP")
        
        if updates:
            params.append(handover_id)
            cur.execute(f"UPDATE ward_sbar_handovers SET {', '.join(updates)} WHERE id = %s;", tuple(params))
            conn.commit()
        return {"success": True, "message": f"SBAR record {handover_id} updated"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.patch("/sbar/{handover_id}/acknowledge", summary="Acknowledge Shift Handover")
def acknowledge_sbar_handover(handover_id: int):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE ward_sbar_handovers
            SET acknowledged = TRUE, acknowledged_at = CURRENT_TIMESTAMP, status = 'Current'
            WHERE id = %s;
        """, (handover_id,))
        conn.commit()
        return {"success": True, "message": f"Handover {handover_id} acknowledged"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# 10. OT SCHEDULES & TIMELINE
# ---------------------------------------------------------------------------
class OtSlotBooking(BaseModel):
    ot_suite: str
    time_slot: str
    patient_name: str
    procedure_name: str
    lead_surgeon: str
    anesthetist: Optional[str] = None
    duration_minutes: Optional[int] = 90
    booking_status: Optional[str] = "Booked"

@router.get("/otschedule", summary="List OT Schedule Slots")
def get_ot_schedules():
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT * FROM ot_schedules ORDER BY id ASC;")
        rows = cur.fetchall()
        return {"success": True, "count": len(rows), "data": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/otschedule", summary="Book OT Suite Time Slot")
def book_ot_slot(body: OtSlotBooking):
    conn = db_connector.get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO ot_schedules (ot_suite, time_slot, patient_name, procedure_name, lead_surgeon, anesthetist, duration_minutes, booking_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (body.ot_suite, body.time_slot, body.patient_name, body.procedure_name, body.lead_surgeon, body.anesthetist, body.duration_minutes, body.booking_status))
        new_id = cur.fetchone()[0]
        conn.commit()
        return {"success": True, "id": new_id, "message": "OT slot booked"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
