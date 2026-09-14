import React from "react";

export default function Disclaimer({ text }) {
  return (
    <div className="disclaimer">
      <p className="disclaimer__title">AI-ASSISTED TRIAGE ONLY</p>
      <p className="disclaimer__body">{text}</p>
    </div>
  );
}
