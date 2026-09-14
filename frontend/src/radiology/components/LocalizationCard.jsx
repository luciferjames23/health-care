import React from "react";
import { DETECTED_CLASS_LABEL } from "../constants";

export default function LocalizationCard({ localization }) {
  const thresholdPct = (localization.threshold * 100).toFixed(0);
  const preview = (localization.regions || []).slice(0, 2);
  const remaining = (localization.regions || []).length - preview.length;

  return (
    <div className={`card model-card ${localization.opacity_detected ? "model-card--positive" : "model-card--negative"}`}>
      <div className="card__label">YOLO · LOCALIZATION</div>

      {localization.opacity_detected ? (
        <span className="model-card__badge model-card__badge--detected">Suspected opacity localized</span>
      ) : (
        <span className="model-card__badge model-card__badge--not-detected">No qualifying opacity localized</span>
      )}

      <div className="model-card__meta">
        <span>Detected class: {DETECTED_CLASS_LABEL}</span>
        <span>Detection threshold: {thresholdPct}%</span>
        <span>Regions detected: {localization.number_of_regions}</span>
      </div>

      {preview.length > 0 && (
        <ul className="model-card__regions-preview">
          {preview.map((region, idx) => (
            <li key={idx}>
              <span>Region {idx + 1}</span>
              <span className="region-confidence">{(region.confidence * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      )}

      {remaining > 0 && (
        <p className="model-card__more">+{remaining} more region(s) — see Detected Regions below</p>
      )}
    </div>
  );
}
