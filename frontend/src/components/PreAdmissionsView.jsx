import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";

const GRID = "140px minmax(140px,1fr) 140px 140px 120px 120px 110px";

export default function PreAdmissionsView({ onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [preAdmissions, setPreAdmissions] = useState([
    { id: "pa1", code: "PRE-2026-001", patient_name: "Karthik Raja", guardian_name: "Raja M (Father)", procedure: "Coronary Angioplasty", department: "Cardiology", proposed_date: "2026-09-20", cost: "₹1,85,000", status: "PENDING" },
    { id: "pa2", code: "PRE-2026-002", patient_name: "Priya Sharma", guardian_name: "Self", procedure: "Total Knee Replacement", department: "Orthopedics", proposed_date: "2026-09-22", cost: "₹2,40,000", status: "APPROVED" },
    { id: "pa3", code: "PRE-2026-003", patient_name: "Anand Sundaram", guardian_name: "Lakshmi S (Wife)", procedure: "Laparoscopic Cholecystectomy", department: "General Surgery", proposed_date: "2026-09-25", cost: "₹95,000", status: "APPROVED" },
  ]);

  const updateStatus = (id, newStatus) => {
    setPreAdmissions(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a9096", marginBottom: "4px" }}>
            <span onClick={() => onNavigate && onNavigate("command")} style={{ cursor: "pointer", color: "oklch(0.5 0.1 200)" }}>{"\u2190 Back"}</span>
            {" \u00b7 "}<span>Front Office</span>{" \u00b7 "}<span>Pre-Admissions</span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600 }}>Pre-Admission Triage & Surgical Approvals</div>
          <div style={{ color: "#8a9096", fontSize: "11.5px", marginTop: "2px" }}>
            Pre-admission registration requests submitted via WhatsApp AI Patient Desk & Web Portal
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e3e6e8", borderRadius: "8px", overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: "8px", padding: "8px 12px",
          color: "#8a9096", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: ".04em",
          borderBottom: "1px solid #eef0f1", minWidth: "900px" }}>
          {["PRE-ADM ID", "PATIENT / GUARDIAN", "PROCEDURE", "DEPARTMENT", "PROPOSED DATE", "EST. COST", "ACTION / STATUS"].map(h => <span key={h}>{h}</span>)}
        </div>

        {preAdmissions.map((p) => {
          const isPending = p.status === "PENDING";
          const isApproved = p.status === "APPROVED";
          return (
            <div key={p.id}
              style={{ display: "grid", gridTemplateColumns: GRID, gap: "8px", padding: "12px",
                borderBottom: "1px solid #f2f3f4", alignItems: "center", fontSize: "12px", minWidth: "900px" }}>
              <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: "11px", color: "#8a9096" }}>{p.code}</span>
              <div>
                <div style={{ fontWeight: 600, color: "#15181b" }}>{p.patient_name}</div>
                <div style={{ fontSize: "10.5px", color: "#8a9096" }}>Guardian: {p.guardian_name}</div>
              </div>
              <span style={{ fontWeight: 500, color: "#15181b" }}>{p.procedure}</span>
              <span style={{ color: "#52585e" }}>{p.department}</span>
              <span style={{ color: "#52585e" }}>{p.proposed_date}</span>
              <span style={{ fontWeight: 600, color: "#15181b" }}>{p.cost}</span>
              <div>
                {isPending ? (
                  <button type="button" onClick={() => updateStatus(p.id, "APPROVED")}
                    style={{ height: "26px", padding: "0 10px", borderRadius: "5px", border: 0, background: "oklch(0.5 0.1 200)", color: "#fff", fontWeight: 600, fontSize: "11px", cursor: "pointer" }}>
                    Approve Triage
                  </button>
                ) : (
                  <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600,
                    background: isApproved ? "oklch(0.95 0.04 150)" : "#f2f3f4",
                    color: isApproved ? "oklch(0.4 0.12 150)" : "#52585e" }}>
                    {p.status}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
