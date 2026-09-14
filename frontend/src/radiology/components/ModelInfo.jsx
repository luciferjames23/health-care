import React from "react";

export default function ModelInfo({ modelInfo }) {
  if (!modelInfo) return null;

  return (
    <div className="card">
      <div className="card__label">MODEL INFORMATION (PoC)</div>
      <dl className="kv-grid">
        <dt>Triage model</dt>
        <dd>{modelInfo.densenet_model_name}</dd>

        <dt>Localization model</dt>
        <dd>{modelInfo.yolo_model_name}</dd>

        <dt>Classification threshold</dt>
        <dd>{(modelInfo.classification_threshold * 100).toFixed(0)}%</dd>

        <dt>Localization threshold</dt>
        <dd>{(modelInfo.localization_threshold * 100).toFixed(0)}%</dd>

        <dt>PoC version</dt>
        <dd>{modelInfo.poc_version}</dd>
      </dl>
      {modelInfo.densenet_preprocessing_confirmed ? (
        <p className="model-info-card__confirmed">
          ✓ Triage model preprocessing confirmed against the original training notebook.
        </p>
      ) : (
        <p className="model-info-card__warning">
          Triage model preprocessing is not yet confirmed against the original
          training notebook — probabilities are unvalidated for this PoC.
        </p>
      )}
    </div>
  );
}
