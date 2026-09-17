from typing import List, Optional, Any
from pydantic import BaseModel


class TriageResponse(BaseModel):
    probability: float
    threshold: float
    priority: str


class RegionResponse(BaseModel):
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float


class LocalizationResponse(BaseModel):
    opacity_detected: bool
    threshold: float
    number_of_regions: int
    regions: List[RegionResponse]


class ImagesResponse(BaseModel):
    original: str   # base64 PNG (no data: prefix)
    annotated: str  # base64 PNG (no data: prefix)


class CombinedAssessmentResponse(BaseModel):
    status: str
    densenet_positive: bool
    yolo_positive: bool
    agreement: bool
    reason: str


class InterpretationResponse(BaseModel):
    finding: str
    summary: str
    assessment: str
    priority: str
    recommended_action: str
    disclaimer: str


class SourceMetadataResponse(BaseModel):
    type: str
    system: str
    study_id: Optional[str] = None
    series_id: Optional[str] = None
    instance_id: Optional[str] = None
    study_instance_uid: Optional[str] = None


class AnalyzeResponse(BaseModel):
    study_id: str
    source: Optional[SourceMetadataResponse] = None
    metadata: dict
    triage: TriageResponse
    localization: LocalizationResponse
    combined_assessment: CombinedAssessmentResponse
    interpretation: InterpretationResponse
    images: ImagesResponse
    disclaimer: str
    preprocessing_confirmed: bool


class HealthResponse(BaseModel):
    status: str
    densenet_loaded: bool
    yolo_loaded: bool


class ModelInfoResponse(BaseModel):
    densenet_model_name: str
    yolo_model_name: str
    classification_threshold: float
    localization_threshold: float
    iou_match_threshold: float
    poc_version: str
    densenet_preprocessing_confirmed: bool
    disclaimer: str


class PacsHealthResponse(BaseModel):
    status: str
    source: str
    orthanc_name: Optional[str] = None


class PacsStudyResponse(BaseModel):
    study_id: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    patient_sex: Optional[str] = None
    study_date: Optional[str] = None
    study_instance_uid: Optional[str] = None
    modality: Optional[str] = None
    body_part: Optional[str] = None
    series_description: Optional[str] = None
    series_count: int = 0
    ingested_at: Optional[str] = None
    analysis_status: str = "PENDING"
    analysis_error: Optional[str] = None
    analyzed_at: Optional[str] = None


class PacsStudiesResponse(BaseModel):
    source: str
    studies: List[PacsStudyResponse]


class ErrorResponse(BaseModel):
    detail: str


# ---------------------------------------------------------------------------
# Radiology Worklist - purely additive. Consumes the same fields already
# produced by the existing DenseNet/YOLO/combined-assessment pipeline; no
# new inference, no new probability, no new decision logic.
# ---------------------------------------------------------------------------

class LocalizationSummaryResponse(BaseModel):
    opacity_detected: bool
    threshold: float
    number_of_regions: int
    highest_confidence: Optional[float] = None


class WorklistItemResponse(BaseModel):
    study_id: str
    display_study_id: Optional[str] = None
    patient_id: Optional[Any] = None
    patient_code: Optional[str] = None
    original_patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    source: Optional[SourceMetadataResponse] = None
    analyzed_at: str
    viewed: bool = False
    viewed_at: Optional[str] = None
    review_status: Optional[str] = "Unread"
    reviewed_at: Optional[str] = None
    source_filename: Optional[str] = None
    metadata: dict
    triage: TriageResponse
    localization_summary: LocalizationSummaryResponse
    combined_assessment: CombinedAssessmentResponse
    thumbnail: str  # base64 PNG, reuses the existing original display image


class WorklistCountsResponse(BaseModel):
    total: int
    high_priority: int
    review_flag: int
    routine: int


class WorklistResponse(BaseModel):
    studies: List[WorklistItemResponse]
    counts: WorklistCountsResponse


class ReviewStatusRequest(BaseModel):
    review_status: str


class StudyDetailResponse(AnalyzeResponse):
    """Same shape as AnalyzeResponse (so the existing Analysis screen can
    render it unmodified) plus worklist-only fields recorded at save time."""
    analyzed_at: str
    source_filename: Optional[str] = None
    display_study_id: Optional[str] = None
    patient_id: Optional[Any] = None
    patient_code: Optional[str] = None
    original_patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    viewed: bool = False
    viewed_at: Optional[str] = None
    review_status: Optional[str] = "Unread"
    reviewed_at: Optional[str] = None


class ViewedStatusResponse(BaseModel):
    study_id: str
    viewed: bool
    viewed_at: Optional[str] = None
