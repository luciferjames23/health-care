import React from "react";
import { STATUS_BADGE_CLASS } from "../constants";

export default function StatusBadge({ status }) {
  const cls = STATUS_BADGE_CLASS[status] ?? "status-badge--routine";
  return <span className={`status-badge ${cls}`}>{status}</span>;
}
