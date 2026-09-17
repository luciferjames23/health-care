import React, { useState, useEffect } from "react";
import { apiService } from "../services/api";

export default function AiPatientDeskView({ onNavigate }) {
  const [conversations, setConversations] = useState([
    { id: "1", conversation_code: "WA_919810012345", phone: "+91 98100 12345", patient_name: "Karthik Raja", last_message: "Can I book a cardiology slot for tomorrow morning?", intent: "APPOINTMENT_BOOKING", human_takeover: false, last_active: "2 mins ago", language: "English" },
    { id: "2", conversation_code: "WA_919810067890", phone: "+91 98100 67890", patient_name: "Priya Sharma", last_message: "My doctor advised pre-admission form for surgery.", intent: "PRE_ADMISSION", human_takeover: true, last_active: "8 mins ago", language: "Tamil" },
    { id: "3", conversation_code: "WA_919810011223", phone: "+91 98100 11223", patient_name: "Anand Sundaram", last_message: "What are the visiting hours for ICU?", intent: "GENERAL_INQUIRY", human_takeover: false, last_active: "15 mins ago", language: "English" },
  ]);
  const [selectedConv, setSelectedConv] = useState(conversations[0]);
  const [replyText, setReplyText] = useState("");
  const [messages, setMessages] = useState([
    { id: "m1", sender: "USER", text: "Hello, I want to see Dr. Meera Iyer for heart checkup.", time: "11:15 AM" },
    { id: "m2", sender: "AI_AGENT", text: "Hello Karthik! Dr. Meera Iyer (Cardiology) is available tomorrow. Would you like a 10:30 AM or 02:00 PM slot?", time: "11:15 AM" },
    { id: "m3", sender: "USER", text: "Can I book a cardiology slot for tomorrow morning?", time: "11:18 AM" },
  ]);

  const toggleTakeover = (convId) => {
    setConversations(prev => prev.map(c => {
      if (c.id === convId) {
        const updated = !c.human_takeover;
        if (selectedConv?.id === convId) {
          setSelectedConv(sc => ({ ...sc, human_takeover: updated }));
        }
        return { ...c, human_takeover: updated };
      }
      return c;
    }));
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedConv) return;
    const newMsg = {
      id: `m_${Date.now()}`,
      sender: "HUMAN_STAFF",
      text: replyText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMsg]);
    setReplyText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a9096", marginBottom: "4px" }}>
            <span onClick={() => onNavigate && onNavigate("command")} style={{ cursor: "pointer", color: "oklch(0.5 0.1 200)" }}>{"\u2190 Back"}</span>
            {" \u00b7 "}<span>AI Platform</span>{" \u00b7 "}<span>AI Patient Desk</span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600 }}>AI Patient Desk & WhatsApp Handoff</div>
          <div style={{ color: "#8a9096", fontSize: "11.5px", marginTop: "2px" }}>
            Live WhatsApp conversation streams, Gemini AI intent telemetry & staff takeover toggle
          </div>
        </div>
      </div>

      {/* Main split view container */}
      <div style={{ display: "flex", flex: 1, gap: "12px", background: "#fff", border: "1px solid #e3e6e8", borderRadius: "8px", overflow: "hidden" }}>
        
        {/* Left: Active conversations list */}
        <div style={{ width: "320px", borderRight: "1px solid #eef0f1", display: "flex", flexDirection: "column", background: "#f9fafa" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #eef0f1", fontSize: "11px", fontWeight: 700, color: "#15181b", textTransform: "uppercase", letterSpacing: ".05em" }}>
            Active WhatsApp Chats ({conversations.length})
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversations.map(c => {
              const isSelected = selectedConv?.id === c.id;
              return (
                <div key={c.id}
                  onClick={() => setSelectedConv(c)}
                  style={{
                    padding: "12px 14px", borderBottom: "1px solid #eef0f1", cursor: "pointer",
                    background: isSelected ? "oklch(0.95 0.04 185)" : "transparent",
                    transition: "background 0.1s"
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600, fontSize: "12.5px", color: "#15181b" }}>{c.patient_name}</span>
                    <span style={{ fontSize: "10.5px", color: "#8a9096" }}>{c.last_active}</span>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#52585e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "6px" }}>
                    {c.last_message}
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ fontSize: "9.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "oklch(0.96 0.03 200)", color: "oklch(0.4 0.1 200)" }}>
                      {c.intent}
                    </span>
                    {c.human_takeover && (
                      <span style={{ fontSize: "9.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "oklch(0.96 0.03 25)", color: "oklch(0.45 0.17 25)" }}>
                        HUMAN TAKEOVER
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Active chat details & reply pane */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {selectedConv ? (
            <>
              {/* Chat Top Banner */}
              <div style={{ padding: "12px 18px", borderBottom: "1px solid #eef0f1", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#15181b" }}>{selectedConv.patient_name} · <span style={{ color: "#8a9096", fontSize: "12px", fontWeight: 400 }}>{selectedConv.phone}</span></div>
                  <div style={{ fontSize: "11px", color: "#8a9096", marginTop: "2px" }}>
                    Language: {selectedConv.language} · Intent: <strong style={{ color: "#15181b" }}>{selectedConv.intent}</strong>
                  </div>
                </div>
                <button type="button" onClick={() => toggleTakeover(selectedConv.id)}
                  style={{
                    height: "32px", padding: "0 14px", borderRadius: "6px", border: 0,
                    background: selectedConv.human_takeover ? "oklch(0.96 0.03 25)" : "oklch(0.5 0.1 200)",
                    color: selectedConv.human_takeover ? "oklch(0.45 0.17 25)" : "#fff",
                    fontWeight: 600, fontSize: "12px", cursor: "pointer"
                  }}>
                  {selectedConv.human_takeover ? "Return to Bot (AI Active)" : "Takeover Chat (Staff Mode)"}
                </button>
              </div>

              {/* Message Feed */}
              <div style={{ flex: 1, padding: "18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", background: "#fbfbfc" }}>
                {messages.map((m) => {
                  const isUser = m.sender === "USER";
                  const isStaff = m.sender === "HUMAN_STAFF";
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: isUser ? "flex-start" : "flex-end" }}>
                      <div style={{
                        maxWidth: "70%", padding: "10px 14px", borderRadius: "8px", fontSize: "12.5px", lineHeight: "1.4",
                        background: isUser ? "#fff" : isStaff ? "oklch(0.95 0.04 185)" : "oklch(0.96 0.03 200)",
                        color: "#15181b", border: "1px solid #e3e6e8"
                      }}>
                        <div style={{ fontSize: "10px", fontWeight: 700, color: "#8a9096", marginBottom: "4px" }}>
                          {isUser ? "Patient" : isStaff ? "Staff Agent (You)" : "Gemini AI Bot"} · {m.time}
                        </div>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <div style={{ padding: "12px 18px", borderTop: "1px solid #eef0f1", display: "flex", gap: "8px", background: "#fff" }}>
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                  placeholder={selectedConv.human_takeover ? "Type a direct reply to dispatch via WhatsApp…" : "Enable Staff Takeover above to send custom replies"}
                  disabled={!selectedConv.human_takeover}
                  style={{ flex: 1, height: "36px", border: "1px solid #e3e6e8", borderRadius: "6px", padding: "0 12px", fontSize: "12.5px", outline: "none" }}
                />
                <button type="button" onClick={handleSendReply} disabled={!selectedConv.human_takeover || !replyText.trim()}
                  style={{
                    height: "36px", padding: "0 16px", borderRadius: "6px", border: 0,
                    background: selectedConv.human_takeover && replyText.trim() ? "oklch(0.5 0.1 200)" : "#eef0f1",
                    color: selectedConv.human_takeover && replyText.trim() ? "#fff" : "#8a9096",
                    fontWeight: 600, fontSize: "12px", cursor: selectedConv.human_takeover ? "pointer" : "default"
                  }}>
                  Send WhatsApp
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#8a9096" }}>Select a conversation from the left</div>
          )}
        </div>

      </div>
    </div>
  );
}
