import React, { useEffect, useState } from "react";
import { getPacsStudies } from "../services/radiologyApi";

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status) {
  if (status === "ANALYZED") return "Analyzed • Added to worklist";
  if (status === "ANALYZING") return "Analyzing…";
  if (status === "FAILED") return "Analysis failed";
  return "Waiting for analysis";
}

export default function PacsStudyPanel() {
  const [studies, setStudies] = useState([]);
  const [error, setError] = useState(null);
  const [loadingStudies, setLoadingStudies] = useState(true);

  const loadStudies = async (showSpinner = true) => {
    if (showSpinner) setLoadingStudies(true);
    setError(null);
    try {
      const data = await getPacsStudies();
      const sortedStudies = [...(data.studies || [])].sort((a, b) => {
        const aTime = a.ingested_at ? Date.parse(a.ingested_at) : 0;
        const bTime = b.ingested_at ? Date.parse(b.ingested_at) : 0;
        return bTime - aTime;
      });
      setStudies(sortedStudies);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo PACS is unavailable.");
    } finally {
      if (showSpinner) setLoadingStudies(false);
    }
  };

  useEffect(() => {
    loadStudies(true);
    const timer = window.setInterval(() => {
      loadStudies(false);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="pacs-panel card">
      <div className="pacs-panel__header">
        <div>
          <p className="pacs-panel__eyebrow">ORTHANC DEMO PACS</p>
          <h3>Available chest X-ray studies</h3>
        </div>
        <button className="new-upload-btn" onClick={() => loadStudies(true)} disabled={loadingStudies}>
          Refresh
        </button>
      </div>

      <p className="pacs-panel__note">
        New DICOM studies are automatically detected, analyzed by the AI pipeline, and added to the Radiology Worklist. This demonstration uses Orthanc as a simulated PACS/DICOM server.
      </p>

      {loadingStudies ? (
        <div className="pacs-panel__empty">Loading studies from Demo PACS...</div>
      ) : error ? (
        <div className="pacs-panel__error">{error}</div>
      ) : studies.length === 0 ? (
        <div className="pacs-panel__empty">No studies are currently available in the Demo PACS.</div>
      ) : (
        <div className="pacs-table-wrap">
          <table className="pacs-table">
            <thead>
              <tr>
                <th>Patient / Study ID</th>
                <th>Modality</th>
                <th>Body Part</th>
                <th>Ingested At</th>
                <th>AI Processing</th>
              </tr>
            </thead>
            <tbody>
              {studies.map((study) => (
                <tr key={study.study_id}>
                  <td>
                    <strong>{study.patient_id || study.patient_name || "Unknown patient"}</strong>
                    <span>{study.study_id}</span>
                  </td>
                  <td>{study.modality || "—"}</td>
                  <td>{study.body_part || "—"}</td>
                  <td className="pacs-table__timestamp">{formatDateTime(study.ingested_at)}</td>
                  <td>
                    <span className={`pacs-status pacs-status--${(study.analysis_status || "pending").toLowerCase()}`}>
                      {statusLabel(study.analysis_status)}
                    </span>
                    {study.analysis_error && (
                      <span className="pacs-table__status-error" title={study.analysis_error}>
                        {study.analysis_error}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
