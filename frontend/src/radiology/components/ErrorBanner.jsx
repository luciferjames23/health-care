import React from "react";

export default function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="error-banner">
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss error">
        ×
      </button>
    </div>
  );
}
