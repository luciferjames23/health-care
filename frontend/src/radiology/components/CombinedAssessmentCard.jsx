import React from "react";

const STATUS_CLASS = {
  "HIGH PRIORITY": "combined-card--high",
  "REVIEW FLAG": "combined-card--review",
  "ROUTINE": "combined-card--routine",
};

export default function CombinedAssessmentCard({ combined }) {
  const statusClass = STATUS_CLASS[combined.status] ?? "combined-card--routine";

  return (
    <div className={`card combined-card ${statusClass}`}>
      <div className="combined-card__eyebrow">AI TRIAGE RESULT</div>
      <div className="combined-card__status">{combined.status}</div>

      {!combined.agreement && (
        <p className="combined-card__disagreement-banner">
          ⚠ Models disagree — radiologist review recommended
        </p>
      )}

      <div className="combined-card__signals">
        <div className="combined-card__signal">
          <span className="combined-card__signal-label">DenseNet signal</span>
          <span className={combined.densenet_positive ? "signal-value signal-value--positive" : "signal-value signal-value--negative"}>
            {combined.densenet_positive ? "Positive" : "Negative"}
          </span>
        </div>
        <div className="combined-card__signal">
          <span className="combined-card__signal-label">YOLO localization signal</span>
          <span className={combined.yolo_positive ? "signal-value signal-value--positive" : "signal-value signal-value--negative"}>
            {combined.yolo_positive ? "Positive" : "Negative"}
          </span>
        </div>
        <div className="combined-card__signal">
          <span className="combined-card__signal-label">Model agreement</span>
          <span className={combined.agreement ? "signal-value signal-value--neutral" : "signal-value signal-value--disagree"}>
            {combined.agreement ? "Agreement" : "Disagreement"}
          </span>
        </div>
      </div>

      <p className="combined-card__reason">{combined.reason}</p>
    </div>
  );
}
