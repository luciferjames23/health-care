import React from "react";

export default function WorklistSummaryCards({ counts = { total: 0, high_priority: 0, review_flag: 0, routine: 0 } }) {
  const cards = [
    { label: "Total Analysed", value: counts.total || 0, cls: "summary-card--total" },
    { label: "High Priority", value: counts.high_priority || 0, cls: "summary-card--high" },
    { label: "Review Flag", value: counts.review_flag || 0, cls: "summary-card--review" },
    { label: "Routine", value: counts.routine || 0, cls: "summary-card--routine" },
  ];

  return (
    <div className="summary-cards">
      {cards.map((card) => (
        <div key={card.label} className={`card summary-card ${card.cls}`}>
          <span className="summary-card__label">{card.label}</span>
          <span className="summary-card__value">{card.value}</span>
        </div>
      ))}
    </div>
  );
}
