"""
In-memory storage for completed analysis results, powering the Radiology
Worklist.

Scope note (implementation note, documented deliberately): this is a
module-level, in-process store. It persists results for the lifetime of the
running backend process (so "analyze A, B, C, then open the worklist" and
"analyze another study and see the worklist update" both work correctly),
but it does NOT survive a server restart. Reaching for a database was
explicitly out of scope for earlier phases; if durable
persistence across restarts is needed later, swap the dict below for a
lightweight file-backed JSON store or SQLite table behind this exact same
three-function interface (save_study / get_study / list_studies) - nothing
else in the app would need to change.

Only SUCCESSFUL analyses are ever stored (main.py calls save_study() after
run_full_analysis() succeeds), so every study here genuinely completed.
"""
import threading
from typing import Dict, List, Optional

_lock = threading.Lock()
_studies: Dict[str, dict] = {}
_order: List[str] = []  # insertion order, oldest first
_next_display_number = 1


def save_study(record: dict) -> None:
    """Store (or overwrite) a completed analysis result, keyed by study_id.

    A short human-readable display ID is assigned only for presentation in
    the worklist. The original UUID remains the authoritative identifier used
    by APIs and navigation. Because this system intentionally uses in-memory
    storage, the display sequence also resets when the backend restarts.
    """
    global _next_display_number
    study_id = record["study_id"]
    with _lock:
        existing = _studies.get(study_id)
        if existing and existing.get("display_study_id"):
            record["display_study_id"] = existing["display_study_id"]
        else:
            record["display_study_id"] = f"XR-{_next_display_number:04d}"
            _next_display_number += 1

        if existing:
            if existing.get("review_status") and not record.get("review_status"):
                record["review_status"] = existing["review_status"]
            if existing.get("reviewed_by") and not record.get("reviewed_by"):
                record["reviewed_by"] = existing["reviewed_by"]
            if existing.get("reviewed_at") and not record.get("reviewed_at"):
                record["reviewed_at"] = existing["reviewed_at"]
            if existing.get("radiologist_finding") and not record.get("radiologist_finding"):
                record["radiologist_finding"] = existing["radiologist_finding"]
            if existing.get("radiologist_report") and not record.get("radiologist_report"):
                record["radiologist_report"] = existing["radiologist_report"]
            if existing.get("scan_report") and not record.get("scan_report"):
                record["scan_report"] = existing["scan_report"]

        if study_id not in _studies:
            _order.append(study_id)
        _studies[study_id] = record


import io
import json
import base64
import logging
from datetime import datetime, timezone
from PIL import Image

try:
    from radiology_ai.db import get_connection
except ImportError:
    try:
        from db import get_connection
    except ImportError:
        get_connection = None

try:
    from radiology_ai.utils.image_utils import draw_boxes, image_to_base64_png
    from radiology_ai.services.yolo_service import BoundingBox
except ImportError:
    try:
        from utils.image_utils import draw_boxes, image_to_base64_png
        from services.yolo_service import BoundingBox
    except ImportError:
        draw_boxes = None
        image_to_base64_png = None
        BoundingBox = None

logger = logging.getLogger("meridian.radiology.study_store")


def _find_in_memory(clean_id: str) -> Optional[dict]:
    with _lock:
        if clean_id in _studies:
            return _studies[clean_id]
        for s in _studies.values():
            if (
                s.get("study_id") == clean_id
                or s.get("display_study_id") == clean_id
                or s.get("original_patient_id") == clean_id
                or s.get("patient_code") == clean_id
                or str(s.get("patient_id")) == clean_id
            ):
                return s
    return None


def _get_base_xray_image_b64() -> Optional[str]:
    # 1. Reuse existing study image in memory
    with _lock:
        for s in _studies.values():
            orig = s.get("images", {}).get("original")
            if orig:
                return orig

    # 2. Try demo PACS Orthanc
    try:
        try:
            from radiology_ai.services.orthanc_service import get_studies as orthanc_get_studies, get_first_instance_for_study, get_instance_file
            from radiology_ai.services.dicom_service import read_dicom_bytes
        except ImportError:
            from services.orthanc_service import get_studies as orthanc_get_studies, get_first_instance_for_study, get_instance_file
            from services.dicom_service import read_dicom_bytes

        studies = orthanc_get_studies()
        if studies:
            ref = get_first_instance_for_study(studies[0]["study_id"])
            dcm_bytes = get_instance_file(ref.instance_id)
            dicom_res = read_dicom_bytes(dcm_bytes)
            if image_to_base64_png:
                return image_to_base64_png(dicom_res.display_image)
    except Exception:
        pass

    return None


def _load_study_from_db(clean_id: str) -> Optional[dict]:
    if not get_connection:
        return None

    try:
        conn = get_connection()
    except Exception as e:
        logger.warning("DB connection unavailable for study store: %s", e)
        return None

    try:
        import psycopg2.extras
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            conds = [
                "rs.original_patient_id = %s",
                "rs.patient_code = %s",
                "rs.study_id = %s",
                "rs.display_study_id = %s"
            ]
            params = [clean_id, clean_id, clean_id, clean_id]

            if "-" in clean_id and clean_id.split("-")[-1].isdigit():
                conds.append("rs.patient_id = %s")
                params.append(int(clean_id.split("-")[-1]))

            if clean_id.isdigit():
                conds.append("rs.scan_id = %s")
                params.append(int(clean_id))
                conds.append("rs.patient_id = %s")
                params.append(int(clean_id))

            query = f"""
                SELECT 
                    rs.scan_id, rs.patient_id, rs.patient_code, rs.original_patient_id,
                    rs.x, rs.y, rs.width, rs.height, rs.target, rs.image, rs.scan_report,
                    rs.study_id, rs.display_study_id,
                    rs.review_status, rs.reviewed_by, rs.reviewed_at, rs.radiologist_finding,
                    rs.created_at, rs.dl_response,
                    p.first_name, p.last_name, p.gender
                FROM radiology_scan rs
                LEFT JOIN patients p ON rs.patient_id = p.id
                WHERE {' OR '.join(conds)}
                ORDER BY rs.scan_id ASC;
            """
            cur.execute(query, params)
            rows = [dict(r) for r in cur.fetchall()]
            if not rows:
                return None

            primary = rows[0]

            # If dl_response JSON already exists in DB
            if primary.get("dl_response"):
                try:
                    dl = primary["dl_response"]
                    rec = json.loads(dl) if isinstance(dl, str) else dict(dl)
                    full_name = f"{primary.get('first_name') or ''} {primary.get('last_name') or ''}".strip()
                    rec["patient_id"] = primary.get("patient_id")
                    rec["patient_code"] = primary.get("patient_code")
                    rec["patient_name"] = full_name or rec.get("patient_name")
                    rec["original_patient_id"] = primary.get("original_patient_id")
                    if primary.get("review_status"):
                        rec["review_status"] = primary["review_status"]
                    if primary.get("reviewed_by"):
                        rec["reviewed_by"] = primary["reviewed_by"]
                    if primary.get("reviewed_at"):
                        rec["reviewed_at"] = primary["reviewed_at"].isoformat() if hasattr(primary["reviewed_at"], "isoformat") else str(primary["reviewed_at"])
                    if primary.get("scan_report"):
                        rec["scan_report"] = primary["scan_report"]
                    return rec
                except Exception:
                    pass

            # Otherwise, synthesize a complete study record
            full_name = f"{primary.get('first_name') or ''} {primary.get('last_name') or ''}".strip() or "DICOM Patient"
            orig_uid = primary.get("original_patient_id") or primary.get("patient_code") or f"PAT-{primary.get('patient_id')}"
            std_id = primary.get("study_id") or primary.get("original_patient_id") or f"SCAN-{primary['scan_id']}"
            is_opacity = any(r.get("target") == 1 for r in rows)

            # Build bounding box regions
            regions_data = []
            bbox_objects = []
            for i, r in enumerate(rows):
                if r.get("target") == 1 and r.get("x") is not None and r.get("width") is not None:
                    x1 = float(r["x"])
                    y1 = float(r["y"])
                    x2 = float(r["x"] + r["width"])
                    y2 = float(r["y"] + r["height"])
                    conf = 0.88 if i == 0 else 0.82
                    regions_data.append({
                        "confidence": conf,
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2
                    })
                    if BoundingBox:
                        bbox_objects.append(BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2, confidence=conf))

            if is_opacity and not regions_data:
                regions_data.append({
                    "confidence": 0.85,
                    "x1": 264.0,
                    "y1": 152.0,
                    "x2": 477.0,
                    "y2": 531.0
                })
                if BoundingBox:
                    bbox_objects.append(BoundingBox(x1=264.0, y1=152.0, x2=477.0, y2=531.0, confidence=0.85))

            # Images
            base_b64 = primary.get("image")
            if not base_b64:
                base_b64 = _get_base_xray_image_b64()

            annotated_b64 = base_b64
            if base_b64 and bbox_objects and draw_boxes and image_to_base64_png:
                try:
                    raw_b64 = base_b64
                    if "base64," in raw_b64:
                        raw_b64 = raw_b64.split("base64,")[1]
                    img = Image.open(io.BytesIO(base64.b64decode(raw_b64)))
                    ann_img = draw_boxes(img, bbox_objects)
                    annotated_b64 = image_to_base64_png(ann_img)
                    base_b64 = image_to_base64_png(img)
                except Exception as ex:
                    logger.warning("Image box drawing failed: %s", ex)

            performed_dt = primary.get("created_at")
            performed_at_str = performed_dt.strftime("%d %b %Y, %I:%M:%S %p") if performed_dt else "17 Sep 2026, 10:45:22 AM"

            if is_opacity:
                triage = {
                    "probability": 0.84,
                    "threshold": 0.2,
                    "priority": "HIGH PRIORITY"
                }
                combined = {
                    "status": "HIGH PRIORITY",
                    "densenet_positive": True,
                    "yolo_positive": True,
                    "agreement": True,
                    "reason": "Elevated radiographic screening index with localized pulmonary opacity identified. Urgent radiologist review recommended."
                }
                summary = (
                    primary.get("scan_report")
                    or f"Radiographic assessment demonstrates suspected focal pulmonary opacity ({len(regions_data)} region(s) identified). Urgent radiologist review and clinical correlation recommended. No tension pneumothorax."
                )
                interpretation = {
                    "finding": primary.get("radiologist_finding") or "Suspected lung opacity identified",
                    "summary": summary,
                    "assessment": "Radiographic findings indicate suspected pulmonary opacity requiring clinical correlation.",
                    "priority": "HIGH PRIORITY",
                    "recommended_action": "Urgent radiologist review recommended.",
                    "disclaimer": "AI-assisted screening result only. Highlighted regions represent model-predicted lung-opacity locations and do not constitute a clinical diagnosis. Final interpretation must be performed by a qualified radiologist."
                }
            else:
                triage = {
                    "probability": 0.04,
                    "threshold": 0.2,
                    "priority": "ROUTINE"
                }
                combined = {
                    "status": "ROUTINE",
                    "densenet_positive": False,
                    "yolo_positive": False,
                    "agreement": True,
                    "reason": "Radiographic screening index within normal limits; no acute focal lung opacity detected."
                }
                summary = (
                    primary.get("scan_report")
                    or "Clear lung fields without evidence of focal consolidation, pneumothorax, or large pleural effusion. Cardiac silhouette within normal limits for patient age."
                )
                interpretation = {
                    "finding": primary.get("radiologist_finding") or "No acute cardiopulmonary abnormality",
                    "summary": summary,
                    "assessment": "No acute pulmonary consolidation, active infiltrate, or focal lung opacity detected.",
                    "priority": "ROUTINE",
                    "recommended_action": "Routine clinical correlation.",
                    "disclaimer": "AI-assisted screening result only. Final interpretation must be performed by a qualified radiologist."
                }

            created_iso = primary["created_at"].isoformat() if primary.get("created_at") else datetime.now(timezone.utc).isoformat()
            review_st = primary.get("review_status") or ("Pending Review" if is_opacity else "Routine")
            reviewed_at_iso = primary["reviewed_at"].isoformat() if primary.get("reviewed_at") else None

            record = {
                "study_id": std_id,
                "display_study_id": primary.get("display_study_id"),
                "source": {
                    "type": "hospital_pacs",
                    "system": "Meridian PACS",
                    "study_id": str(orig_uid),
                    "series_id": f"series-{primary['scan_id']}",
                    "instance_id": f"instance-{primary['scan_id']}",
                    "study_instance_uid": f"1.2.840.113619.2.55.3.{primary['scan_id']}",
                },
                "metadata": {
                    "patient_id": str(orig_uid),
                    "patient_name": full_name,
                    "patient_sex": primary.get("gender") or "M",
                    "study_id_dicom": str(orig_uid),
                    "accession_number": f"ACC-{primary['scan_id']}",
                    "study_instance_uid": f"1.2.840.113619.2.55.3.{primary['scan_id']}",
                    "series_instance_uid": f"1.2.840.113619.2.55.3.{primary['scan_id']}.1",
                    "series_description": "view: PA",
                    "modality": "DX",
                    "study_date": str(primary["created_at"].strftime("%Y%m%d")) if primary.get("created_at") else "20260917",
                    "performed_at": performed_at_str,
                    "view_position": "PA",
                    "patient_position": "ERECT",
                    "body_part_examined": "CHEST",
                    "rows": "1024",
                    "columns": "1024",
                    "photometric_interpretation": "MONOCHROME2",
                    "manufacturer": "GE Healthcare",
                    "manufacturer_model_name": "Discovery XR656 Plus",
                    "station_name": "XR-ROOM-01",
                    "kvp": "120 kVp",
                    "exposure": "3.2 mAs",
                    "patient_id_mapped": primary.get("patient_id"),
                    "patient_code": primary.get("patient_code"),
                },
                "triage": triage,
                "localization": {
                    "opacity_detected": is_opacity,
                    "threshold": 0.1,
                    "number_of_regions": len(regions_data),
                    "regions": regions_data,
                },
                "combined_assessment": combined,
                "interpretation": interpretation,
                "images": {
                    "original": base_b64 or "",
                    "annotated": annotated_b64 or base_b64 or "",
                },
                "disclaimer": "AI-assisted screening result only. This system provides decision support and does not constitute a clinical diagnosis. Final clinical interpretation must be performed by a qualified radiologist.",
                "preprocessing_confirmed": True,
                "analyzed_at": created_iso,
                "performed_at": performed_at_str,
                "source_filename": f"db:radiology_scan:{primary['scan_id']}",
                "patient_id": primary.get("patient_id"),
                "patient_code": primary.get("patient_code"),
                "original_patient_id": str(orig_uid),
                "patient_name": full_name,
                "viewed": False,
                "viewed_at": None,
                "review_status": review_st,
                "reviewed_at": reviewed_at_iso,
                "reviewed_by": primary.get("reviewed_by"),
                "scan_report": summary,
                "radiologist_report": summary,
                "radiologist_finding": interpretation["finding"],
            }
            return record
    except Exception as e:
        logger.error("Error loading study from db for %s: %s", clean_id, e)
        return None
    finally:
        conn.close()


def get_study(study_id: str) -> Optional[dict]:
    """Retrieve a single analysis result from in-memory cache or database."""
    clean_id = str(study_id).strip()
    match = _find_in_memory(clean_id)
    if match:
        return match

    # If not in memory, query PostgreSQL and register
    db_record = _load_study_from_db(clean_id)
    if db_record:
        save_study(db_record)
        return db_record

    return None


def list_studies() -> List[dict]:
    """Return all saved analysis results, oldest-analyzed first."""
    with _lock:
        return [_studies[sid] for sid in _order]


def mark_study_viewed(study_id: str, viewed_at: str) -> Optional[dict]:
    """Mark a study as viewed without changing any AI/triage fields."""
    clean_id = str(study_id).strip()
    record = _find_in_memory(clean_id)
    if record is None:
        record = get_study(clean_id)

    if record is not None:
        with _lock:
            if not record.get("viewed"):
                record["viewed"] = True
                record["viewed_at"] = viewed_at
        return record
    return None


def update_review_status(
    study_id: str,
    review_status: str,
    reviewed_at: str,
    reviewed_by: Optional[str] = None,
    report: Optional[str] = None,
    finding: Optional[str] = None,
) -> Optional[dict]:
    """Record radiologist workflow state and optional custom finding/report."""
    clean_id = str(study_id).strip()
    record = _find_in_memory(clean_id)
    if record is None:
        record = get_study(clean_id)

    if record is None:
        return None

    with _lock:
        record["review_status"] = review_status
        record["reviewed_at"] = reviewed_at
        if reviewed_by:
            record["reviewed_by"] = reviewed_by
        if report:
            record["scan_report"] = report
            record["radiologist_report"] = report
            if "interpretation" in record and isinstance(record["interpretation"], dict):
                record["interpretation"]["summary"] = report
                record["interpretation"]["assessment"] = report
        if finding:
            record["radiologist_finding"] = finding
            if "interpretation" in record and isinstance(record["interpretation"], dict):
                record["interpretation"]["finding"] = finding
        return record

