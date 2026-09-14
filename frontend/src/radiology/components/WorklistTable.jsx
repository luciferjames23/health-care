import React from "react";
import { DETECTED_CLASS_LABEL } from "../constants";
import StatusBadge from "./StatusBadge";

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatPercent(value) {
  return `${(value * 100).toFixed(0)}%`;
}

export default function WorklistTable({ items = [], onViewStudy, onOpenOhif }) {
  if (items.length === 0) {
    return (
      <div className="card worklist-table__empty">
        <p>No analysed studies match the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="card worklist-table-card">
      <div className="worklist-table-scroll">
        <table className="worklist-table">
          <thead>
            <tr>
              <th>#</th>
              <th>X-Ray</th>
              <th>Study ID</th>
              <th>Analysis Time</th>
              <th>DenseNet<br />Probability</th>
              <th>YOLO<br />Localization</th>
              <th>
                <span className="worklist-table__agreement-heading">
                  Model Agreement
                  <span
                    className="worklist-table__info"
                    title="Agreement means DenseNet classification and YOLO localization give consistent positive/negative signals. Disagreement means only one model produced a positive signal."
                    aria-label="About model agreement"
                  >
                    i
                  </span>
                </span>
              </th>
              <th>Triage Status</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const densenetPositive = item.combined_assessment?.densenet_positive;
              const yoloPositive = item.combined_assessment?.yolo_positive;
              const probabilityPct = Math.round((item.triage?.probability || 0) * 100);
              const highestYoloConfidence = item.localization_summary?.highest_confidence;

              return (
                <tr key={item.study_id} className={item.viewed ? "worklist-table__row--viewed" : undefined}>
                  <td className="worklist-table__rank mono">{idx + 1}</td>
                  <td>
                    {item.thumbnail ? (
                      <img
                        className="worklist-table__thumbnail"
                        src={`data:image/png;base64,${item.thumbnail}`}
                        alt={`Thumbnail for study ${item.study_id}`}
                      />
                    ) : (
                      <div className="worklist-table__thumbnail" style={{ background: '#333' }} />
                    )}
                  </td>
                  <td
                    className="mono worklist-table__study-id"
                    title={`Internal study UUID: ${item.study_id}`}
                    aria-label={`Study ID ${item.display_study_id ?? item.study_id}`}
                  >
                    <strong className="worklist-table__display-id">
                      {item.display_study_id ?? item.study_id}
                    </strong>
                    {item.source_filename && (
                      <span className="worklist-table__sub worklist-table__filename" title={item.source_filename}>
                        {item.source_filename}
                      </span>
                    )}
                  </td>
                  <td className="worklist-table__nowrap">{formatDateTime(item.analyzed_at)}</td>
                  <td className="worklist-table__densenet">
                    <div className="worklist-table__densenet-topline">
                      <span className={densenetPositive ? "inline-signal inline-signal--positive" : "inline-signal inline-signal--negative"}>
                        {densenetPositive ? "Positive" : "Negative"}
                      </span>
                      <strong className="worklist-table__probability">{probabilityPct}%</strong>
                    </div>
                    <div
                      className="worklist-table__probability-track"
                      role="progressbar"
                      aria-label={`DenseNet abnormality probability ${probabilityPct}%`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={probabilityPct}
                    >
                      <span style={{ width: `${probabilityPct}%` }} />
                    </div>
                  </td>
                  <td>
                    <span className={yoloPositive ? "inline-signal inline-signal--positive" : "inline-signal inline-signal--negative"}>
                      {(item.localization_summary?.number_of_regions || 0) > 0
                        ? `${item.localization_summary.number_of_regions} region${item.localization_summary.number_of_regions > 1 ? "s" : ""}`
                        : "No qualifying region"}
                    </span>
                    {(item.localization_summary?.number_of_regions || 0) > 0 && (
                      <span className="worklist-table__sub">
                        {DETECTED_CLASS_LABEL}
                        {highestYoloConfidence != null ? ` • ${formatPercent(highestYoloConfidence)} max conf.` : ""}
                      </span>
                    )}
                  </td>
                  <td>
                    {item.combined_assessment?.agreement ? (
                      <span className="model-agreement model-agreement--agree">Agreement</span>
                    ) : (
                      <span className="model-agreement model-agreement--disagree">Disagreement</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={item.combined_assessment?.status || "ROUTINE"} />
                  </td>
                  <td>
                    <div className="worklist-table__review-cell">
                      {item.viewed && (
                        <span
                          className="worklist-table__viewed-badge"
                          title={item.viewed_at ? `Viewed at ${formatDateTime(item.viewed_at)}` : "Viewed"}
                        >
                          Viewed
                        </span>
                      )}
                      <button className="worklist-table__view-btn" onClick={() => onViewStudy(item.study_id)}>
                        View Analysis
                      </button>
                      {item.source?.study_instance_uid && (
                        <button
                          type="button"
                          className="worklist-table__ohif-btn"
                          onClick={() => onOpenOhif({ studyInstanceUID: item.source.study_instance_uid, studyId: item.display_study_id ?? item.study_id })}
                          title="Open the original DICOM study in the OHIF medical image viewer"
                        >
                          Open in OHIF
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
