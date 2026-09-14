import React from "react";

export default function XrayViewer({
  originalImageB64,
  annotatedImageB64,
  viewMode,
  onViewModeChange,
  isLoading,
}) {
  const activeImage = viewMode === "original" ? originalImageB64 : annotatedImageB64;

  return (
    <div className="card xray-card">
      <div className="xray-card__header">
        <span className="xray-card__title">Chest X-Ray Image</span>
      </div>

      <div className="xray-viewer">
        {isLoading && (
          <div className="xray-viewer__loading">
            <div className="spinner" />
            <p>Analyzing chest X-ray...</p>
          </div>
        )}

        {!isLoading && activeImage && (
          <div className="xray-viewer__image-wrap">
            <img
              src={`data:image/png;base64,${activeImage}`}
              alt={viewMode === "original" ? "Original chest X-ray" : "AI localization overlay"}
            />
          </div>
        )}

        {!isLoading && !activeImage && (
          <div className="xray-viewer__placeholder">
            <p>No X-ray loaded yet</p>
          </div>
        )}
      </div>

      {!isLoading && activeImage && (
        <div className="xray-viewer__toggle">
          <button
            type="button"
            className={viewMode === "original" ? "toggle-btn toggle-btn--active" : "toggle-btn"}
            onClick={() => onViewModeChange("original")}
          >
            Original Image
          </button>
          <button
            type="button"
            className={viewMode === "localization" ? "toggle-btn toggle-btn--active" : "toggle-btn"}
            onClick={() => onViewModeChange("localization")}
          >
            AI Detection Overlay
          </button>
        </div>
      )}
    </div>
  );
}
