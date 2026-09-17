from typing import Optional
from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
import appointment_service

router = APIRouter(tags=["Appointments"])

class BookAppointmentRequest(BaseModel):
    patient_id: int
    doctor_id: int
    department_id: int
    appointment_date: str
    appointment_time: str
    patient_reason: Optional[str] = None
    booking_source: Optional[str] = "ADMIN"
    created_by_user_id: Optional[int] = None

class CancelAppointmentRequest(BaseModel):
    reason: str
    cancelled_by_user_id: Optional[int] = None

class RescheduleAppointmentRequest(BaseModel):
    new_date: str
    new_time: str
    reason: str
    rescheduled_by_user_id: Optional[int] = None


@router.get("/api/doctors/{doctor_id}/availability")
def api_get_doctor_availability(doctor_id: int, date: str = Query(..., description="Date in YYYY-MM-DD format")):
    return appointment_service.get_doctor_availability(doctor_id, date)


@router.get("/api/doctors/{doctor_id}/slots")
def api_get_available_slots(doctor_id: int, date: str = Query(..., description="Date in YYYY-MM-DD format")):
    return appointment_service.get_available_slots(doctor_id, date)


@router.post("/api/appointments", status_code=201)
def api_book_appointment(payload: BookAppointmentRequest):
    return appointment_service.book_appointment(
        patient_id=payload.patient_id,
        doctor_id=payload.doctor_id,
        department_id=payload.department_id,
        date_str=payload.appointment_date,
        time_str=payload.appointment_time,
        patient_reason=payload.patient_reason,
        booking_source=payload.booking_source,
        created_by_user_id=payload.created_by_user_id
    )


@router.get("/api/appointments/{booking_id}")
def api_get_appointment(booking_id: str, patient_id: Optional[int] = Query(None)):
    return appointment_service.get_appointment(booking_id, patient_id)


@router.get("/api/patients/{patient_id}/appointments")
def api_get_patient_appointments(patient_id: int):
    return appointment_service.get_patient_appointments(patient_id)


@router.post("/api/appointments/{booking_id}/cancel")
def api_cancel_appointment(booking_id: str, payload: CancelAppointmentRequest):
    return appointment_service.cancel_appointment(
        booking_id=booking_id,
        reason=payload.reason,
        cancelled_by_user_id=payload.cancelled_by_user_id
    )


@router.post("/api/appointments/{booking_id}/reschedule")
def api_reschedule_appointment(booking_id: str, payload: RescheduleAppointmentRequest):
    return appointment_service.reschedule_appointment(
        booking_id=booking_id,
        new_date_str=payload.new_date,
        new_time_str=payload.new_time,
        reason=payload.reason,
        rescheduled_by_user_id=payload.rescheduled_by_user_id
    )
