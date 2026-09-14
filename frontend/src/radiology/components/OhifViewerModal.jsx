import React, { useEffect } from "react";
import { buildOhifStudyUrl } from "../constants";

export default function OhifViewerModal({ studyInstanceUID, studyId, onClose }) {
  useEffect(() => {
    if (!studyInstanceUID) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [studyInstanceUID, onClose]);

  if (!studyInstanceUID) return null;

  return (
    <div className="ohif-modal-backdrop" role="dialog" aria-modal="true" aria-label="OHIF DICOM Viewer">
      <div className="ohif-modal-container">
        <div className="ohif-modal-header">
          <div className="ohif-modal-title-section">
            <strong className="ohif-modal-title">DICOM Viewer</strong>
            <span className="ohif-modal-subtitle">
              OHIF Viewer • Orthanc Demo PACS{studyId ? ` • Study: ${studyId}` : ""}
            </span>
          </div>
          <button type="button" className="ohif-modal-close" onClick={onClose} aria-label="Close DICOM viewer" title="Close Viewer">×</button>
        </div>
        <div className="ohif-modal-body">
          <iframe
            src={buildOhifStudyUrl(studyInstanceUID)}
            title="OHIF DICOM Viewer"
            className="ohif-viewer-frame"
            allow="fullscreen"
            allowFullScreen
          />
        </div>
        <div className="ohif-modal-footer">
          <span>Demo DICOM viewer — final clinical interpretation remains with the radiologist.</span>
          <button type="button" className="ohif-footer-close-button" onClick={onClose}>Close Viewer</button>
        </div>
      </div>
    </div>
  );
}
