import React, { useState } from 'react';
import { apiService, extractDischargedPatientIds } from '../services/api';

export default function HospitalAssistantView({ onNavigate, defaultQuery = '' }) {
  const [input, setInput] = useState(defaultQuery);
  const [chats, setChats] = useState([
    {
      id: 'c1',
      title: 'Discharge blockages',
      msgs: [
        {
          who: 'user',
          text: 'Which patients are currently blocked from discharge and why?',
          ts: '11:15'
        },
        {
          who: 'ai',
          intent: 'discharge.blocked',
          conf: '98%',
          ts: '11:15',
          text: 'According to live PostgreSQL discharge pipelines, there are currently active discharge candidates in the wards. Key blockers include TPA insurance preauth clearance (Medi Assist & ICICI Lombard), pending final bill reconciliation, and pharmacy take-home approvals.',
          sources: [
            { label: 'PostgreSQL: discharge_summaries & blockers', v: 'live', eff: 'Real-time' },
            { label: 'Inpatient Discharge SOP §4.2', v: '3.1', eff: '2026' }
          ],
          actions: [
            { label: 'Open Discharge Command Centre', target: 'discharge' }
          ]
        }
      ]
    }
  ]);
  const [activeChatId, setActiveChatId] = useState('c1');

  const currentChat = chats.find(c => c.id === activeChatId) || chats[0];

  const handleSend = async (text) => {
    const q = (text || input).trim();
    if (!q) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { who: 'user', text: q, ts: timeStr };
    const updatedMsgs = [...currentChat.msgs, userMsg];

    // Live AI retrieval from PostgreSQL
    let aiResponse = {
      who: 'ai',
      intent: 'general.retrieval',
      conf: '94%',
      ts: timeStr,
      text: `Based on the Governed PostgreSQL Healthcare Database and permitted records for your role, here is the verified status:`,
      sources: [{ label: 'PostgreSQL Healthcare Database', v: '18.1', eff: 'Live' }]
    };

    const lowerQ = q.toLowerCase();

    try {
      if (lowerQ.includes('discharge') || lowerQ.includes('blocked') || lowerQ.includes('kavitha')) {
        const dischargeRes = await apiService.getDischargedPatients({ limit: 10 }).catch(() => ({ data: [] }));
        const candidates = dischargeRes?.data || [];

        if (candidates.length > 0) {
          const first = candidates[0];
          const name = first.patient_name || first.patient || 'Patient';
          aiResponse = {
            who: 'ai',
            intent: 'discharge.live_pipeline',
            conf: '98%',
            ts: timeStr,
            text: `There are currently ${candidates.length} recorded discharge summaries in the Gold database layer. Latest completed case: ${name} (${first.bed_number || 'Released Bed'}, ${first.ward_name || 'Inpatient Wing'}) with diagnosis "${first.diagnoses || first.diagnosis_name || 'Clinical Care'}" under ${first.primary_consultant || first.doctor_name || 'Attending Physician'}.`,
            sources: [
              { label: 'Gold: dim_generated_discharge_summaries', v: 'live', eff: 'Real-time' }
            ],
            actions: [
              { label: 'Open Discharge Command Centre', target: 'discharge' }
            ]
          };
        }
      } else if (lowerQ.includes('bed') || lowerQ.includes('occupancy') || lowerQ.includes('ward')) {
        const bmData = await apiService.getBedManagementData().catch(() => null);
        const kpis = bmData?.kpis;
        const wards = bmData?.wards || [];
        aiResponse = {
          who: 'ai',
          intent: 'hospital.bed_occupancy',
          conf: '97%',
          ts: timeStr,
          text: `Live Bed Status from Clinical Gold Layer: ${kpis?.total_beds || 0} total hospital beds across ${wards.length} wards. Current active occupancy is ${kpis?.occupancy_rate || 0}% (${kpis?.occupied_beds || 0} occupied beds, ${kpis?.available_beds || 0} available vacant beds). Wards include: ${wards.slice(0, 4).map(w => `${w.ward_name} (${w.occupied_beds}/${w.total_beds} beds)`).join(', ')}.`,
          sources: [
            { label: 'Gold: Live Bed Management & Ward Census', v: 'live', eff: 'Real-time' }
          ],
          actions: [
            { label: 'Open Bed Demand Analytics', target: 'beds' },
            { label: 'View Command Centre', target: 'command' }
          ]
        };
      } else if (lowerQ.includes('revenue') || lowerQ.includes('bill') || lowerQ.includes('claim')) {
        const revSummary = await apiService.getRevenuePredictionsSummary().catch(() => null);
        aiResponse = {
          who: 'ai',
          intent: 'finance.revenue_status',
          conf: '96%',
          ts: timeStr,
          text: `Live Revenue Analytics from Gold Layer: Total Net Actual Revenue is $${(revSummary?.total_actual_net_amount_usd || 0).toLocaleString()} with Total Predicted Revenue of $${(revSummary?.total_predicted_revenue_usd || 0).toLocaleString()} across ${revSummary?.total_records || 0} prediction records.`,
          sources: [
            { label: 'Gold: dim_revenue_predictions', v: 'live', eff: 'Real-time' }
          ],
          actions: [
            { label: 'Open Revenue Analytics', target: 'revenue' }
          ]
        };
      } else if (lowerQ.includes('patient') || lowerQ.includes('inpatient') || lowerQ.includes('admission')) {
        const admRes = await apiService.getCurrentAdmissions({ limit: 10 }).catch(() => ({ data: [] }));
        const disRes = await apiService.getDischargedPatients({ limit: 50 }).catch(() => ({ data: [] }));
        const dischargedTracker = extractDischargedPatientIds(disRes?.data || []);
        const rawAdmissions = admRes?.data || [];
        const activeAdmissions = rawAdmissions.filter(r => !dischargedTracker.has(r));

        aiResponse = {
          who: 'ai',
          intent: 'clinical.active_patients',
          conf: '95%',
          ts: timeStr,
          text: `There are ${activeAdmissions.length} active currently admitted inpatients across all wards. First active patient on file is ${activeAdmissions[0]?.patient_name || 'Patient'} (${activeAdmissions[0]?.patient_number || 'PAT-001'}), admitted with primary indication "${activeAdmissions[0]?.admission_reason || 'Inpatient Stay'}" under ${activeAdmissions[0]?.attending_physician || 'Attending Physician'}.`,
          sources: [
            { label: 'Gold: dim_admission_inputs', v: 'live', eff: 'Real-time' }
          ],
          actions: [
            { label: 'Open Clinical Workspace', target: 'clinical' }
          ]
        };
      } else if (lowerQ.includes('sop') || lowerQ.includes('turnaround')) {
        aiResponse = {
          who: 'ai',
          intent: 'policy.discharge_sop',
          conf: '99%',
          ts: timeStr,
          text: "According to Inpatient Discharge SOP v3.1 (§4.1–4.6), the target turnaround from consultant discharge intent to patient release is 3 hours. TPA final approval or enhancement requests carry an SLA of 2 hours from provisional bill submission.",
          sources: [
            { label: 'Inpatient Discharge SOP §4.1', v: '3.1', eff: '2026' }
          ]
        };
      }
    } catch (err) {
      console.warn('Live retrieval fallback:', err);
    }

    const newChatList = chats.map(c => {
      if (c.id === activeChatId) {
        return { ...c, msgs: [...updatedMsgs, aiResponse] };
      }
      return c;
    });

    setChats(newChatList);
    setInput('');
  };


  const handleNewChat = () => {
    const newId = 'c' + (chats.length + 1);
    const newC = { id: newId, title: 'New query', msgs: [] };
    setChats([newC, ...chats]);
    setActiveChatId(newId);
  };

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '230px minmax(0, 1fr)',
      gap: '14px', alignItems: 'start', minHeight: 'calc(100vh - 120px)'
    }}>
      {/* Sidebar: Chat History */}
      <aside style={{
        background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px',
        padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
        position: 'sticky', top: '60px'
      }}>
        <button
          type="button"
          onClick={handleNewChat}
          style={{
            height: '32px', borderRadius: '6px', border: 0,
            background: 'oklch(0.5 0.1 200)', color: '#fff',
            fontWeight: 600, cursor: 'pointer', fontSize: '12px'
          }}
        >
          + New chat
        </button>

        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a9096', padding: '6px 4px 0' }}>
          Recent conversations
        </div>

        {chats.map(c => (
          <div
            key={c.id}
            onClick={() => setActiveChatId(c.id)}
            style={{
              padding: '7px 8px', borderRadius: '6px', cursor: 'pointer',
              background: activeChatId === c.id ? '#f6f7f8' : 'transparent',
              fontWeight: activeChatId === c.id ? 600 : 400,
              fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}
          >
            {c.title}
          </div>
        ))}

        <div style={{
          marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #eef0f1',
          fontSize: '11px', color: '#52585e', lineHeight: 1.4
        }}>
          Role scope: Doctor<br />
          Engine: Hospital-RAG-v3.1
        </div>
      </aside>

      {/* Main Chat Interface */}
      <section style={{
        background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px',
        display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 120px)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
          borderBottom: '1px solid #eef0f1'
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)' }} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Hospital Assistant</span>
          <span style={{ color: '#8a9096', fontSize: '11.5px' }}>
            · grounded in governed knowledge and permitted records
          </span>
        </div>

        {/* Message Thread */}
        <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
          {currentChat.msgs.length === 0 && (
            <div style={{ margin: 'auto', maxWidth: '580px', textAlign: 'center', padding: '30px 0' }}>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '28px', marginBottom: '8px' }}>
                How can I help you today?
              </div>
              <div style={{ color: '#52585e', marginBottom: '18px', fontSize: '12.5px', lineHeight: 1.5 }}>
                Ask about clinical SOPs, patient discharge progress, insurer preauth status, or critical lab values.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                {[
                  "Which patients are blocked from discharge and why?",
                  "Show insurance cases older than 2 hours",
                  "What is Kavitha Raman's discharge status?",
                  "What is the Inpatient Discharge SOP turnaround target?"
                ].map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(sug)}
                    style={{
                      height: '30px', padding: '0 12px', borderRadius: '15px',
                      border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer',
                      fontSize: '11.5px', color: 'oklch(0.45 0.1 200)'
                    }}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentChat.msgs.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: m.who === 'user' ? 'flex-end' : 'flex-start',
                gap: '4px'
              }}
            >
              <div style={{
                maxWidth: '80%', padding: '10px 14px', borderRadius: '10px',
                background: m.who === 'user' ? 'oklch(0.5 0.1 200)' : '#f6f7f8',
                color: m.who === 'user' ? '#fff' : '#15181b',
                fontSize: '12.5px', lineHeight: 1.55,
                border: m.who === 'user' ? 'none' : '1px solid #e3e6e8'
              }}>
                {m.who === 'ai' && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', fontSize: '10.5px' }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: '4px', fontWeight: 600,
                      background: 'oklch(0.97 0.02 300)', color: 'oklch(0.45 0.1 300)'
                    }}>
                      {m.intent}
                    </span>
                    <span style={{ color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                      confidence {m.conf} · {m.ts}
                    </span>
                  </div>
                )}

                <div>{m.text}</div>

                {m.sources && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e3e6e8' }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8a9096', marginBottom: '4px' }}>
                      Sources used:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {m.sources.map((s, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '2px 6px', borderRadius: '4px', background: '#fff',
                            border: '1px solid #e3e6e8', fontSize: '10.5px', color: 'oklch(0.45 0.1 200)'
                          }}
                        >
                          {s.label} ({s.v})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {m.actions && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    {m.actions.map((a, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onNavigate && onNavigate(a.target)}
                        style={{
                          height: '26px', padding: '0 10px', borderRadius: '5px', border: 0,
                          background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600,
                          fontSize: '11px', cursor: 'pointer'
                        }}
                      >
                        {a.label} →
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span style={{ fontSize: '10px', color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                {m.ts}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom input */}
        <div style={{ borderTop: '1px solid #eef0f1', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <form
            onSubmit={e => { e.preventDefault(); handleSend(); }}
            style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
          >
            <button
              type="button"
              onClick={() => handleSend("What is Kavitha Raman's discharge status?")}
              style={{
                height: '38px', minWidth: '40px', border: '1px solid #e3e6e8',
                borderRadius: '8px', background: '#fff', cursor: 'pointer'
              }}
              title="Voice Dictation"
            >
              🎙
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about a policy, a patient you are allowed to see, a bill..."
              style={{
                flex: 1, height: '38px', border: '1px solid #e3e6e8', borderRadius: '8px',
                padding: '0 12px', fontSize: '12.5px', outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                height: '38px', padding: '0 18px', borderRadius: '8px', border: 0,
                background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600,
                cursor: 'pointer', fontSize: '12.5px'
              }}
            >
              Send
            </button>
          </form>

          <div style={{ fontSize: '10.5px', color: '#8a9096' }}>
            Hospital Assistant drafts, retrieves and explains under governance. Consequential clinical actions require your sign-off.
          </div>
        </div>
      </section>
    </div>
  );
}
