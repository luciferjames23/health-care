import React, { useState } from 'react';

const PIPELINE_NODES = [
  { id: 1, title: 'Omnichannel Ingestion', short: 'WhatsApp · Web · EMR', detail: 'Ingests voice, chat, EMR events, or HL7 diagnostic feeds and standardizes message format.', status: 'Pass', color: 'oklch(0.4 0.12 150)' },
  { id: 2, title: 'Identity & Consent', short: 'UHID + Consent Verify', detail: 'Validates patient UHID, phone OTP, and verifies channel purpose consent (WhatsApp status, reminders).', status: 'Verified', color: 'oklch(0.4 0.12 150)' },
  { id: 3, title: 'Context Retrieval', short: 'Clinical Records & EMR', detail: 'Retrieves patient longitudinal history, active admission encounter, tariff rules, and clinical SOPs.', status: '12 docs retrieved', color: 'oklch(0.4 0.12 150)' },
  { id: 4, title: 'Policy Gateway', short: 'RBAC & Masking', detail: 'Enforces role-based permissions, care-team masking, and verifies clinical decision boundaries.', status: '12 checks passed', color: 'oklch(0.4 0.12 150)' },
  { id: 5, title: 'Agent Selection', short: 'Intent Dispatch', detail: 'Routes task to specialist agent (e.g. AG-19 Discharge Summary, AG-07 Preauth Assembly).', status: 'AG-19 Selected', color: 'oklch(0.5 0.1 200)' },
  { id: 6, title: 'Tool Execution', short: 'Safe Gateway Calls', detail: 'Executes allowed tool calls against EMR, LIS, RIS, Pharmacy, and Billing systems.', status: '3 tools called', color: 'oklch(0.4 0.12 150)' },
  { id: 7, title: 'Citation & Grounding', short: 'Hallucination Check', detail: 'Checks generated drafts against retrieved knowledge with minimum confidence threshold 70%.', status: 'Score 97.4%', color: 'oklch(0.4 0.12 150)' },
  { id: 8, title: 'Human Approval Gate', short: 'HITL Sign-off', detail: 'High-risk clinical and financial actions are paused for doctor, nurse, or billing sign-off.', status: 'Queued AP-0001', color: 'oklch(0.5 0.13 70)' },
  { id: 9, title: 'System of Record Write', short: 'EMR / LIS Mutation', detail: 'Upon authorized human approval, mutates state in Hospital Operating Platform database.', status: 'Pending signature', color: 'oklch(0.5 0.13 70)' },
  { id: 10, title: 'Multilingual Delivery', short: 'Tamil & English SMS', detail: 'Translates approved home instructions and notifications into preferred patient language.', status: 'Bilingual ready', color: 'oklch(0.4 0.12 150)' },
  { id: 11, title: 'Audit & Telemetry', short: 'Immutable Trace', detail: 'Records complete input prompt, retrieved citations, human signer ID, and latency metrics.', status: 'Logged', color: 'oklch(0.4 0.12 150)' }
];

export default function OrchestratorView({ onNavigate }) {
  const [selectedNodeId, setSelectedNodeId] = useState(8);

  const selectedNode = PIPELINE_NODES.find(n => n.id === selectedNodeId) || PIPELINE_NODES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Hospital AI Platform</span> › <span>AGENT ORCHESTRATOR</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>
            Enterprise Agent Orchestration Architecture
          </div>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            Every clinical and operational request passes through identical governed pipeline stages across all channels.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onNavigate('approvals')}
            style={{
              height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e3e6e8',
              background: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Go to Approvals (6) →
          </button>
        </div>
      </div>

      {/* 11-Stage Pipeline Graph */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px', overflowX: 'auto' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#8a9096', marginBottom: '12px' }}>
          Interactive 11-Stage Governed Execution Pipeline (Click any stage to inspect)
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, minmax(110px, 1fr))', gap: '6px' }}>
          {PIPELINE_NODES.map((n) => {
            const isSelected = n.id === selectedNodeId;
            return (
              <div
                key={n.id}
                onClick={() => setSelectedNodeId(n.id)}
                style={{
                  padding: '10px 8px', borderRadius: '6px', cursor: 'pointer', textAlign: 'center',
                  background: isSelected ? 'oklch(0.96 0.04 200)' : '#f8fafc',
                  border: isSelected ? '2px solid oklch(0.5 0.1 200)' : '1px solid #e2e8f0',
                  boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#8a9096' }}>
                  STEP {n.id}
                </div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, marginTop: '3px', color: '#15181b', minHeight: '30px' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: '10px', color: '#52585e', marginTop: '4px', lineHeight: 1.2 }}>
                  {n.short}
                </div>
                <div style={{
                  marginTop: '8px', padding: '2px 4px', borderRadius: '3px', fontSize: '9.5px', fontWeight: 600,
                  background: isSelected ? 'oklch(0.5 0.1 200)' : '#eef0f1',
                  color: isSelected ? '#fff' : n.color
                }}>
                  {n.status}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspector Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Left: Stage Inspector */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontSize: '10.5px', fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', color: '#8a9096' }}>
            SELECTED STAGE TELEMETRY · STEP {selectedNode.id}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, margin: '6px 0 10px', color: '#15181b' }}>
            {selectedNode.title}
          </div>
          <div style={{ fontSize: '13px', color: '#52585e', lineHeight: 1.6, marginBottom: '14px' }}>
            {selectedNode.detail}
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: '#8a9096' }}>Stage Output Result</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#15181b', marginTop: '2px' }}>
              {selectedNode.status}
            </div>
          </div>

          <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '8px' }}>Active Request Example: Kavitha Raman (MER-2026-008421)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
            <div style={{ padding: '6px 10px', borderRadius: '4px', background: '#fafbfc', border: '1px solid #eef0f1' }}>
              <strong>11:05:01</strong> • Mark Likely Discharge triggered by Dr. Arjun Menon (EMR)
            </div>
            <div style={{ padding: '6px 10px', borderRadius: '4px', background: '#fafbfc', border: '1px solid #eef0f1' }}>
              <strong>11:05:03</strong> • Policy Gateway verified care-team role & consent records
            </div>
            <div style={{ padding: '6px 10px', borderRadius: '4px', background: '#fafbfc', border: '1px solid #eef0f1' }}>
              <strong>11:05:04</strong> • Dispatched AG-19 Discharge Summary Agent (draft generated)
            </div>
            <div style={{ padding: '6px 10px', borderRadius: '4px', background: 'oklch(0.98 0.02 80)', border: '1px solid oklch(0.85 0.08 80)' }}>
              <strong>11:05:06</strong> • Human Gate AP-0001 created: Awaiting Dr. Arjun Menon electronic sign-off
            </div>
          </div>
        </div>

        {/* Right: Cross-Agent Handoff Flow */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '6px' }}>Cross-Agent Workflow Handoffs</div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginBottom: '14px' }}>
            Contextual handoffs between specialized autonomous agents across admission life-cycle.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#fafbfc', border: '1px solid #eef0f1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '12px' }}>
                <span>AG-01 (Booking) → AG-07 (Preauth)</span>
                <span style={{ color: 'oklch(0.4 0.12 150)' }}>Completed</span>
              </div>
              <div style={{ color: '#52585e', fontSize: '11px', marginTop: '2px' }}>
                Admission scheduled → Preauth packet draft assembled for Star Health.
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: '#fafbfc', border: '1px solid #eef0f1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '12px' }}>
                <span>AG-10 (Diagnostic) → AG-18 (SBAR)</span>
                <span style={{ color: 'oklch(0.4 0.12 150)' }}>Completed</span>
              </div>
              <div style={{ color: '#52585e', fontSize: '11px', marginTop: '2px' }}>
                Post-op Troponin & Echo resulted → Synced into Nursing Handover note.
              </div>
            </div>

            <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'oklch(0.98 0.02 80)', border: '1px solid oklch(0.85 0.08 80)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '12px' }}>
                <span>AG-19 (Summary) → AG-09 (Discharge Orchestrator)</span>
                <span style={{ color: 'oklch(0.5 0.13 70)' }}>In Progress</span>
              </div>
              <div style={{ color: '#52585e', fontSize: '11px', marginTop: '2px' }}>
                Draft awaiting doctor signature to clear critical path dependency for pharmacy dispense.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
