import React from "react";

export default function RecommendationCard({ interpretation }) {
  if (!interpretation) return null;

  return (
    <div className="card recommendation-card">
      <div className="card__label">RECOMMENDATION</div>
      <p className="recommendation-card__action">{interpretation.recommended_action}</p>
      <p className="recommendation-card__note">
        AI-assisted finding — not a final diagnosis. Radiologist / clinical
        review required.
      </p>
    </div>
  );
}
