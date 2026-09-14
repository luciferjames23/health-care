import React, { Fragment } from "react";

const FIELD_LABELS = {
  modality: "Modality",
  study_date: "Study date",
  view_position: "View position",
  body_part_examined: "Body part",
  rows: "Rows",
  columns: "Columns",
  photometric_interpretation: "Photometric interpretation",
};

export default function ImageInfoCard({ studyId, metadata = {} }) {
  const entries = Object.entries(metadata).filter(([, value]) => value != null && value !== "");

  return (
    <div className="card">
      <div className="card__label">IMAGE INFORMATION</div>
      <dl className="kv-grid">
        <dt>Study ID</dt>
        <dd>{studyId}</dd>
        {entries.map(([key, value]) => (
          <Fragment key={key}>
            <dt>{FIELD_LABELS[key] ?? key}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
