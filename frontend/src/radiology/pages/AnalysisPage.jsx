import React, { useEffect, useState } from "react";
import UploadPanel from "../components/UploadPanel";
import PacsStudyPanel from "../components/PacsStudyPanel";
import XrayViewer from "../components/XrayViewer";
import CombinedAssessmentCard from "../components/CombinedAssessmentCard";
import TriageCard from "../components/TriageCard";
import LocalizationCard from "../components/LocalizationCard";
import InterpretationCard from "../components/InterpretationCard";
import RecommendationCard from "../components/RecommendationCard";
import DetectedRegionsTable from "../components/DetectedRegionsTable";
import ImageInfoCard from "../components/ImageInfoCard";
import ModelInfo from "../components/ModelInfo";
import Disclaimer from "../components/Disclaimer";
import ErrorBanner from "../components/ErrorBanner";
import OhifViewerModal from "../components/OhifViewerModal";
import { analyzeXray, getModelInfo } from "../services/radiologyApi";

export default function AnalysisPage({ modelInfo: propModelInfo, initialResult = null, onResultStateChange }) {
  const [modelInfo, setModelInfo] = useState(propModelInfo || null);
  const [result, setResult] = useState(initialResult);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("original");
  const [studySource, setStudySource] = useState("upload");
  const [showOhif, setShowOhif] = useState(false);

  useEffect(() => {
    if (!modelInfo) {
      getModelInfo().then(setModelInfo).catch(() => {});
    }
  }, [modelInfo]);

  useEffect(() => {
    if (initialResult) {
      setResult(initialResult);
      setViewMode(initialResult.localization?.opacity_detected ? "localization" : "original");
    }
  }, [initialResult]);

  const handleFileSelected = async (file) => {
    setError(null);
    setResult(null);
    setIsLoading(true);
    setViewMode("original");
    try {
      const data = await analyzeXray(file);
      setResult(data);
      setViewMode(data.localization?.opacity_detected ? "localization" : "original");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to process this X-ray.");
    } finally {
      setIsLoading(false);
    }
  };

  const showResult = Boolean(result);

  useEffect(() => {
    onResultStateChange?.(showResult);
    return () => onResultStateChange?.(false);
  }, [showResult, onResultStateChange]);

  const resetAnalysis = () => {
    setResult(null);
    setError(null);
    setViewMode("original");
  };

  return (
    <>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className={`clinical-workspace ${showResult ? "clinical-workspace--result" : "clinical-workspace--empty"}`}>
        <div className="workspace__xray-area">
          {!result && !isLoading ? (
            <div className="study-source-shell">
              <div className="study-source-selector card">
                <span className="study-source-selector__label">STUDY SOURCE</span>
                <div className="study-source-selector__buttons">
                  <button
                    type="button"
                    className={`source-btn ${studySource === "upload" ? "source-btn--active" : ""}`}
                    onClick={() => setStudySource("upload")}
                  >
                    Upload DICOM
                  </button>
                  <button
                    type="button"
                    className={`source-btn ${studySource === "pacs" ? "source-btn--active" : ""}`}
                    onClick={() => setStudySource("pacs")}
                  >
                    Demo PACS
                  </button>
                </div>
              </div>
              {studySource === "upload" ? (
                <UploadPanel onFileSelected={handleFileSelected} isLoading={isLoading} />
              ) : (
                <PacsStudyPanel />
              )}
            </div>
          ) : (
            <>
              <div className="study-viewer-tools" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  {result?.source?.study_instance_uid && (
                    <button
                      type="button"
                      className="ohif-open-btn"
                      onClick={() => setShowOhif(true)}
                      title="Open this DICOM study in the OHIF medical image viewer"
                    >
                      Open in OHIF Viewer
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="new-upload-btn"
                  onClick={resetAnalysis}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  New Analysis / Upload
                </button>
              </div>

              <XrayViewer
                originalImageB64={result?.images?.original ?? null}
                annotatedImageB64={result?.images?.annotated ?? null}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                isLoading={isLoading}
              />
              {result && (
                <div className="study-id" title={`Internal study UUID: ${result.study_id}`}>
                  Study ID: {result.display_study_id ? result.display_study_id : result.study_id}
                </div>
              )}
            </>
          )}
        </div>

        {result ? (
          <>
            <div className="workspace__combined-area">
              <CombinedAssessmentCard combined={result.combined_assessment} />
            </div>
            <div className="workspace__models-area">
              <TriageCard triage={result.triage} densenetPositive={result.combined_assessment?.densenet_positive} />
              <LocalizationCard localization={result.localization} />
            </div>
            <div className="workspace__interpretation-area">
              <InterpretationCard interpretation={result.interpretation} />
            </div>
            <div className="workspace__recommendation-area">
              <RecommendationCard interpretation={result.interpretation} />
            </div>
          </>
        ) : (
          <div className="workspace__placeholder-area">
            <div className="card app__results-placeholder">
              <p>Upload a chest X-ray DICOM for immediate analysis, or use Demo PACS to watch incoming studies being analyzed automatically and added to the Radiology Worklist.</p>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className="secondary-section">
          <span className="secondary-section__heading">TECHNICAL &amp; MODEL DETAILS</span>
          <DetectedRegionsTable regions={result.localization?.regions || []} />
          <ImageInfoCard studyId={result.study_id} metadata={result.metadata || {}} />
          <ModelInfo modelInfo={modelInfo} />
        </div>
      )}

      <OhifViewerModal
        studyInstanceUID={showOhif ? result?.source?.study_instance_uid ?? null : null}
        studyId={result ? (result.display_study_id ? result.display_study_id : result.study_id) : undefined}
        onClose={() => setShowOhif(false)}
      />

      <Disclaimer
        text={
          result?.disclaimer ??
          "AI-assisted triage only. This proof-of-concept is not a diagnostic system. Final clinical interpretation must be performed by a qualified radiologist."
        }
      />
    </>
  );
}
