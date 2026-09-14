import React from "react";
import { DETECTED_CLASS_LABEL } from "../constants";

export default function DetectedRegionsTable({ regions = [] }) {
  return (
    <div className="card">
      <div className="card__label">DETECTED REGIONS (YOLO)</div>

      {regions.length === 0 ? (
        <p className="info-table__empty">No qualifying regions were localized for this study.</p>
      ) : (
        <table className="info-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Class</th>
              <th>Confidence</th>
              <th>Bounding box (px)</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((region, idx) => (
              <tr key={idx}>
                <td>{idx + 1}</td>
                <td>{DETECTED_CLASS_LABEL}</td>
                <td className="mono">{(region.confidence * 100).toFixed(0)}%</td>
                <td className="mono">
                  ({region.x1.toFixed(0)}, {region.y1.toFixed(0)}) – ({region.x2.toFixed(0)}, {region.y2.toFixed(0)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
