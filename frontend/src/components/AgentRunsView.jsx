import React, { useState } from 'react';

const RUNS_DATA = [
  {
    id: 'EXE-2026-118204',
    agent: 'Discharge Summary Agent',
    agentId: 'AG-19',
    version: '1.1.0',
    patient: 'Kavitha Raman',
    patientId: 'MER-2026-008421',
    ts: '11:05',
    steps: 6,
    tools: 3,
    latency: '1.8 s',
    cost: '₹0.38',
    status: 'Waiting',
    reason: 'Awaiting Dr. Arjun Menon electronic sign-off'
  },
  {
    id: 'EXE-2026-118203',
    agent: 'Insurance Preauthorisation Assembly Agent',
    agentId: 'AG-07',
    version: '2.0.4',
    patient: 'Kavitha Raman',
    patientId: 'MER-2026-008421',
    ts: '10:55',
    steps: 5,
    tools: 2,
    latency: '2.4 s',
    cost: '₹0.52',
    status: 'Waiting',
    reason: 'Enhancement packet ready for Insurance Executive submit'
  },
  {
    id: 'EXE-2026-118202',
    agent: 'Discharge Orchestration Agent',
    agentId: 'AG-09',
    version: '3.0.2',
    patient: 'Kavitha Raman',
    patientId: 'MER-2026-008421',
    ts: '10:52',
    steps: 8,
    tools: 4,
    latency: '1.2 s',
    cost: '₹0.24',
    status: 'Running',
    reason: 'Tracking 3 active dependencies: Summary, TPA Enhancement, Pharmacy'
  },
  {
    id: 'EXE-2026-118201',
    agent: 'Diagnostic Coordination Agent',
    agentId: 'AG-10',
    version: '1.5.0',
    patient: 'Ganesan T',
    patientId: 'MER-2026-009661',
    ts: '10:48',
    steps: 4,
    tools: 2,
    latency: '0.9 s',
    cost: '₹0.18',
    status: 'Completed',
    reason: 'MRI Spine prep instructions sent via WhatsApp in Tamil'
  },
  {
    id: 'EXE-2026-118200',
    agent: 'Appointment Booking Agent',
    agentId: 'AG-01',
    version: '2.4.1',
    patient: 'Anbu Selvam',
    patientId: 'MER-2026-003412',
    ts: '10:45',
    steps: 5,
    tools: 3,
    latency: '1.1 s',
    cost: '₹0.22',
    status: 'Completed',
    reason: 'Confirmed slot with Dr. Suresh Babu (Ortho) for tomorrow 10:30 AM'
  },
  {
    id: 'EXE-2026-118199',
    agent: 'Claim Denial & Appeal Agent',
    agentId: 'AG-20',
    version: '1.0.2',
    patient: 'Murugan Selvam',
    patientId: 'MER-2026-007733',
    ts: '10:20',
    steps: 7,
    tools: 3,
    latency: '3.2 s',
    cost: '₹0.64',
    status: 'Waiting',
    reason: 'Appeal packet for ₹55,000 shortfall submitted to approval centre'
  }
];

export default function AgentRunsView({ onNavigate }) {
  const [runs] = useState(RUNS_DATA);
  const [selectedRun, setSelectedRun] = useState(RUNS_DATA[0]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Hospital AI Platform</span> › <span>AGENT RUNS & TELEMETRY</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>
            Agent Execution Traces & Real-Time Telemetry
          </div>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            Comprehensive observability into every step, tool invocation, LLM latency, token cost, and policy check.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onNavigate('agents')}
            style={{
              height: '32px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e3e6e8',
              background: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Agent Studio →
          </button>
        </div>
      </div>

      {/* Main Grid: Run Table + Execution Details Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 380px', gap: '16px', alignItems: 'start' }}>
        
        {/* Runs Table */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #eef0f1', fontWeight: 700, fontSize: '13px' }}>
            Live Executions ({runs.length})
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#fafbfc', borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Execution ID</th>
                <th style={{ padding: '10px 14px' }}>Agent</th>
                <th style={{ padding: '10px 14px' }}>Patient</th>
                <th style={{ padding: '10px 14px' }}>Started</th>
                <th style={{ padding: '10px 14px' }}>Latency</th>
                <th style={{ padding: '10px 14px' }}>Cost</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const isSelected = selectedRun.id === r.id;
                const statusBg = r.status === 'Completed' ? 'oklch(0.95 0.04 150)' : r.status === 'Waiting' ? 'oklch(0.96 0.05 80)' : 'oklch(0.95 0.03 200)';
                const statusFg = r.status === 'Completed' ? 'oklch(0.4 0.12 150)' : r.status === 'Waiting' ? 'oklch(0.5 0.13 70)' : 'oklch(0.4 0.1 200)';

                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedRun(r)}
                    style={{
                      borderBottom: '1px solid #f2f3f4', cursor: 'pointer',
                      background: isSelected ? 'oklch(0.96 0.04 200)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: 'oklch(0.4 0.1 200)' }}>
                      {r.id}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                      <div>{r.agent}</div>
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#8a9096' }}>{r.agentId} · v{r.version}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#15181b' }}>{r.patient}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#8a9096' }}>{r.ts}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.latency}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.cost}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600, background: statusBg, color: statusFg }}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selected Trace Details Drawer */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700 }}>{selectedRun.agent}</span>
            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600, background: selectedRun.status === 'Completed' ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 80)', color: selectedRun.status === 'Completed' ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.13 70)' }}>
              {selectedRun.status}
            </span>
          </div>

          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#8a9096', marginBottom: '14px' }}>
            {selectedRun.id} · v{selectedRun.version} · {selectedRun.patient} ({selectedRun.patientId})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', borderRadius: '6px', background: '#f8fafc', fontSize: '11.5px', marginBottom: '14px' }}>
            <div>Latency: <strong>{selectedRun.latency}</strong></div>
            <div>Cost: <strong>{selectedRun.cost}</strong></div>
            <div>Steps Executed: <strong>{selectedRun.steps}</strong></div>
            <div>Tools Invoked: <strong>{selectedRun.tools}</strong></div>
          </div>

          <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>Current Lifecycle Status</div>
          <div style={{ background: '#fafbfc', border: '1px solid #eef0f1', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: '#15181b', lineHeight: 1.5, marginBottom: '16px' }}>
            {selectedRun.reason}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onNavigate('agents')}
              style={{ flex: 1, height: '30px', borderRadius: '6px', border: '1px solid #e3e6e8', background: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
            >
              Open in Studio
            </button>
            {selectedRun.status === 'Waiting' && (
              <button
                type="button"
                onClick={() => onNavigate('approvals')}
                style={{ flex: 1, height: '30px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Go to Approval Gate →
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
