import React, { useState } from "react";

export default function DoctorEscalationInboxView({ onNavigate }) {
  const [escalations, setEscalations] = useState([
    { id: "e1", patient_name: "Karthik Raja", phone: "+91 98100 12345", reason: "Patient reported acute post-op chest pain following discharge instructions inquiry", priority: "URGENT", status: "OPEN", time: "10 mins ago" },
    { id: "e2", patient_name: "Anand Sundaram", phone: "+91 98100 11223", reason: "Allergic reaction query regarding prescribed antibiotic dosage", priority: "HIGH", status: "OPEN", time: "25 mins ago" },
  ]);
  const [replyText, setReplyText] = useState({});

  const handleResolve = (id) => {
    setEscalations(prev => prev.map(e => e.id === id ? { ...e, status: "RESOLVED" } : e));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a9096", marginBottom: "4px" }}>
            <span onClick={() => onNavigate && onNavigate("command")} style={{ cursor: "pointer", color: "oklch(0.5 0.1 200)" }}>{"\u2190 Back"}</span>
            {" \u00b7 "}<span>Clinical</span>{" \u00b7 "}<span>AI Escalations</span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600 }}>Doctor AI Escalations Inbox</div>
          <div style={{ color: "#8a9096", fontSize: "11.5px", marginTop: "2px" }}>
            High-priority clinical queries escalated by WhatsApp AI Patient Desk requiring direct doctor intervention
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {escalations.map((e) => {
          const isUrgent = e.priority === "URGENT";
          const isResolved = e.status === "RESOLVED";
          return (
            <div key={e.id} style={{ background: "#fff", border: "1px solid #e3e6e8", borderRadius: "8px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: "14px", color: "#15181b" }}>{e.patient_name}</span>
                  <span style={{ color: "#8a9096", fontSize: "12px" }}>({e.phone})</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 700,
                    background: isUrgent ? "oklch(0.96 0.03 25)" : "oklch(0.96 0.05 80)",
                    color: isUrgent ? "oklch(0.45 0.17 25)" : "oklch(0.5 0.13 70)"
                  }}>
                    {e.priority}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#8a9096" }}>{e.time}</span>
              </div>

              <div style={{ fontSize: "12.5px", color: "#52585e", background: "#f9fafa", padding: "10px 12px", borderRadius: "6px", border: "1px solid #eef0f1" }}>
                <strong>Escalation Reason:</strong> {e.reason}
              </div>

              {!isResolved ? (
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <input
                    value={replyText[e.id] || ""}
                    onChange={ev => setReplyText({ ...replyText, [e.id]: ev.target.value })}
                    placeholder="Type clinical guidance reply to send back to patient's WhatsApp…"
                    style={{ flex: 1, height: "32px", border: "1px solid #e3e6e8", borderRadius: "6px", padding: "0 10px", fontSize: "12px", outline: "none" }}
                  />
                  <button type="button" onClick={() => handleResolve(e.id)}
                    style={{ height: "32px", padding: "0 14px", borderRadius: "6px", border: 0, background: "oklch(0.5 0.1 200)", color: "#fff", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                    Dispatch WhatsApp Reply
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: "11.5px", color: "oklch(0.4 0.12 150)", fontWeight: 600 }}>
                  ✓ Resolved by Doctor · Reply sent to patient
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
