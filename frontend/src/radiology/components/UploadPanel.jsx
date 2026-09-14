import React, { useCallback, useRef, useState } from "react";

export default function UploadPanel({ onFileSelected, isLoading }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = useCallback(
    (files) => {
      if (!files || files.length === 0) return;
      onFileSelected(files[0]);
    },
    [onFileSelected]
  );

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`upload-panel ${isDragging ? "upload-panel--dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !isLoading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          !isLoading && inputRef.current?.click();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".dcm,.dicom"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="upload-panel__icon">⬆</div>
      <p className="upload-panel__title">Upload Chest X-Ray</p>
      <p className="upload-panel__hint">Drag &amp; drop or click to browse — DICOM (.dcm) supported</p>
    </div>
  );
}
