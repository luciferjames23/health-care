export const DETECTED_CLASS_LABEL = "Lung Opacity";

export const STATUS_BADGE_CLASS = {
  "HIGH PRIORITY": "status-badge--high",
  "REVIEW FLAG": "status-badge--review",
  "ROUTINE": "status-badge--routine",
};

export const OHIF_BASE_URL = "http://localhost:3000";

export function buildOhifStudyUrl(studyInstanceUid) {
  return `${OHIF_BASE_URL}/viewer?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}`;
}
