import React from "react";

export default function InterpretationCard({ interpretation }) {
  if (!interpretation) return null;

  return (
    <div className="card interpretation-card">
      <div className="card__label">AI INTERPRETATION</div>
      <p className="interpretation-card__finding">{interpretation.finding}</p>

      <ul className="interpretation-card__list">
        <li>{interpretation.summary}</li>
        <li>{interpretation.assessment}</li>
      </ul>
    </div>
  );
}
