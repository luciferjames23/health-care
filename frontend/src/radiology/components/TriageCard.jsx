import React from "react";

export default function TriageCard({ triage, densenetPositive }) {
  const probabilityPct = (triage.probability * 100).toFixed(0);
  const thresholdPct = (triage.threshold * 100).toFixed(0);

  return (
    <div className={`card model-card ${densenetPositive ? "model-card--positive" : "model-card--negative"}`}>
      <div className="card__label">DENSENET · CLASSIFICATION</div>
      <div className="model-card__signal">{densenetPositive ? "Positive" : "Negative"}</div>
      <p className="model-card__note">AI triage/model output — not a diagnosis probability.</p>

      <div className="model-card__stats">
        <div>
          <span className="model-card__stat-label">Probability</span>
          <span className="model-card__stat-value">{probabilityPct}%</span>
        </div>
        <div>
          <span className="model-card__stat-label">Threshold</span>
          <span className="model-card__stat-value">{thresholdPct}%</span>
        </div>
      </div>

      <div className="model-card__bar">
        <div
          className="model-card__bar-fill"
          style={{ width: `${Math.min(triage.probability * 100, 100)}%` }}
        />
        <div
          className="model-card__bar-threshold"
          style={{ left: `${Math.min(triage.threshold * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
