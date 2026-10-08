"""AG-17 SOAP note APIs."""
import os
import tempfile
import audioop
import wave
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID

from api.auth_helper import get_current_user
from services import soap_note_service as service
from services import soap_action_workflow_service as action_service
from services import soap_action_dispatch_service as dispatch_service

router = APIRouter(prefix="/api/v1/soap/notes", tags=["AG-17 SOAP Notes"])
actions_router = APIRouter(prefix="/api/v1/soap/actions", tags=["AG-17 SOAP Actions"])


def is_silent_pcm_wav(file_path: str) -> bool:
    """Detect zero/near-zero amplitude in PCM16 WAV recordings before STT."""
    try:
        with wave.open(file_path, "rb") as audio:
            if audio.getsampwidth() != 2:
                return False
            frames = audio.readframes(audio.getnframes())
        return not frames or audioop.rms(frames, 2) < 100
    except (wave.Error, EOFError, OSError):
        return False


class NoteCreate(BaseModel):
    patient_id: int
    visit_id: int
    admission_id: int | None = None
    dictation_language: str | None = None
    raw_transcript: str | None = None
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""
    ai_generated: bool = False
    ai_model: str | None = None
    source: str = "VOICE"


class NoteUpdate(BaseModel):
    dictation_language: str | None = None
    raw_transcript: str | None = None
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None
    ai_generated: bool | None = None
    ai_draft: dict | None = None
    ai_model: str | None = None
    source: str | None = None


class ClinicalValidationRequest(BaseModel):
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""


class SoapActionPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(default=None, min_length=1, max_length=240)
    code: str | None = Field(default=None, max_length=80)
    dose: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=40)
    route: str | None = Field(default=None, max_length=80)
    frequency: str | None = Field(default=None, max_length=120)
    duration: str | None = Field(default=None, max_length=120)
    priority: str | None = Field(default=None, pattern="^(ROUTINE|URGENT|STAT)$")
    projection: str | None = Field(default=None, pattern="^(PA|AP)$")
    clinical_indication: str | None = Field(default=None, max_length=500)
    finding_type: str | None = Field(default=None, pattern="^(TEMPERATURE|BLOOD_PRESSURE|PULSE|SPO2)$")
    value: float | None = None
    systolic: int | None = Field(default=None, ge=0, le=300)
    diastolic: int | None = Field(default=None, ge=0, le=300)


class SoapActionReject(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class SoapActionBatchConfirm(BaseModel):
    action_ids: list[UUID] = Field(min_length=1, max_length=100)


@router.post("")
def create_note(body: NoteCreate, user=Depends(get_current_user)):
    return service.create_note(body.model_dump(), user)


@router.get("")
def list_notes(patient_id: int | None = None, visit_id: int | None = None,
               admission_id: int | None = None, signed_only: bool = False,
               mine: bool = False,
               user=Depends(get_current_user)):
    return {"notes": service.list_notes(user, patient_id, visit_id, admission_id, signed_only, mine)}


@router.get("/{soap_note_id}")
def retrieve_note(soap_note_id: int, user=Depends(get_current_user)):
    return service.retrieve_note(soap_note_id, user)


@router.patch("/{soap_note_id}")
def update_note(soap_note_id: int, body: NoteUpdate, user=Depends(get_current_user)):
    return service.update_draft(soap_note_id, body.model_dump(exclude_none=True), user, audit_action="SOAP_DRAFT_UPDATED")


@router.post("/{soap_note_id}/sign")
def sign_note(soap_note_id: int, user=Depends(get_current_user)):
    return service.sign_note(soap_note_id, user)


@router.post("/{soap_note_id}/clinical-validation")
def clinical_validation(soap_note_id: int, body: ClinicalValidationRequest, user=Depends(get_current_user)):
    return service.validate_clinical_record(soap_note_id, body.model_dump(), user)


@router.post("/{soap_note_id}/clinical-resolution")
def clinical_resolution(soap_note_id: int, body: ClinicalValidationRequest, user=Depends(get_current_user)):
    return service.resolve_clinical_mismatch(soap_note_id, body.model_dump(), user)


@router.post("/{soap_note_id}/amendments")
def amend_note(soap_note_id: int, body: NoteUpdate, user=Depends(get_current_user)):
    return service.amend_note(soap_note_id, body.model_dump(exclude_none=True), user)


@router.post("/{soap_note_id}/transcribe")
async def transcribe(soap_note_id: int, file: UploadFile = File(...), language: str = Query("auto"), user=Depends(get_current_user)):
    note = service.retrieve_note(soap_note_id, user)
    if note["status"] != "DRAFT": raise HTTPException(409, "Only draft notes can receive dictation.")
    suffix = Path(file.filename or "recording.webm").suffix or ".webm"
    temp_path = None
    try:
        contents = await file.read(25 * 1024 * 1024 + 1)
        if not contents: raise HTTPException(400, "Audio recording is empty.")
        if len(contents) > 25 * 1024 * 1024: raise HTTPException(413, "Audio recording exceeds 25 MB.")
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            temp_path = tmp.name
        if suffix.lower() == ".wav" and is_silent_pcm_wav(temp_path):
            raise HTTPException(400, "Audio contains no detectable speech. Please record again.")
        from voice.speech_to_text import GroqWhisperSpeechToTextProvider, GeminiSpeechToTextProvider
        result = GroqWhisperSpeechToTextProvider().transcribe(temp_path, language)
        if not result.get("success"):
            result = GeminiSpeechToTextProvider().transcribe(temp_path, language)
        if not result.get("success") or not str(result.get("text", "")).strip():
            raise HTTPException(502, "Speech transcription failed. Please retry or enter the transcript manually.")
        updated = service.update_draft(soap_note_id, {"raw_transcript": result["text"], "dictation_language": result.get("language")}, user, audit_action="SOAP_TRANSCRIPTION_CREATED")
        return {"transcript": result["text"], "language": result.get("language"), "note": updated}
    finally:
        if temp_path:
            try: os.unlink(temp_path)
            except OSError: pass


@router.post("/{soap_note_id}/generate")
def generate_note(soap_note_id: int, user=Depends(get_current_user)):
    note = service.retrieve_note(soap_note_id, user)
    if note["status"] != "DRAFT": raise HTTPException(409, "Only draft notes can be generated.")
    from services.soap_generation_service import generate_soap
    generated = generate_soap(note.get("raw_transcript") or "")
    updated = service.update_draft(soap_note_id, {"ai_draft": generated["soap"], "ai_generated": True, "ai_model": generated["model"]}, user, audit_action="SOAP_AI_DRAFT_GENERATED")
    return {"soap": generated["soap"], "model": generated["model"], "note": updated}


@router.post("/{soap_note_id}/events/{event_name}")
def note_event(soap_note_id: int, event_name: str, user=Depends(get_current_user)):
    action_map = {"saved": "SOAP_DRAFT_SAVED", "loaded-for-review": "SOAP_LOADED_FOR_REVIEW"}
    if event_name not in action_map: raise HTTPException(400, "Unknown SOAP event.")
    return service.log_event(soap_note_id, action_map[event_name], user)


@router.post("/{soap_note_id}/actions/detect")
def detect_clinical_actions(soap_note_id: int, user=Depends(get_current_user)):
    return action_service.detect_actions(soap_note_id, user)


@router.get("/{soap_note_id}/actions")
def list_clinical_actions(soap_note_id: int, user=Depends(get_current_user)):
    return action_service.list_actions(soap_note_id, user)


@actions_router.patch("/{action_id}")
def update_clinical_action(action_id: UUID, body: SoapActionPatch, user=Depends(get_current_user)):
    return action_service.patch_action(action_id, body.model_dump(exclude_unset=True), user)


@actions_router.post("/{action_id}/confirm")
def confirm_clinical_action(action_id: UUID, user=Depends(get_current_user)):
    return action_service.confirm_action(action_id, user)


@actions_router.post("/{action_id}/reject")
def reject_clinical_action(action_id: UUID, body: SoapActionReject, user=Depends(get_current_user)):
    return action_service.reject_action(action_id, user, body.reason)


@router.post("/{soap_note_id}/actions/confirm-batch")
def confirm_clinical_actions_batch(soap_note_id: int, body: SoapActionBatchConfirm, user=Depends(get_current_user)):
    return action_service.confirm_batch(soap_note_id, body.action_ids, user)


@router.post("/{soap_note_id}/actions/dispatch")
def dispatch_signed_clinical_actions(soap_note_id: int, user=Depends(get_current_user)):
    return dispatch_service.dispatch_confirmed_actions(soap_note_id, user)
