import React from 'react';
import { AGENTS_DATA } from './AgentStudioView';

export default function AiCommandCentreView({ onNavigate }) {
  const totalRuns = AGENTS_DATA.reduce((acc, a) => acc + a.runs, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Hospital AI Platform</span> › <span>AI COMMAND CENTRE</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>
            Enterprise AI Command Centre
          </div>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            Execution telemetry across all clinical and administrative agents. Every run is audited, high-risk actions are human-gated.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onNavigate('agents')}
            style={{
              height: '32px', padding: '0 14px', borderRadius: '6px', border: 0,
              background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Launch Agent Studio →
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Executions Today</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#15181b', marginTop: '4px' }}>{totalRuns}</div>
          <div style={{ fontSize: '11px', color: 'oklch(0.4 0.12 150)', marginTop: '2px' }}>+18% vs baseline</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Automation Rate</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(0.4 0.12 150)', marginTop: '4px' }}>88.4%</div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginTop: '2px' }}>High-risk gated</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Agents Active</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#15181b', marginTop: '4px' }}>21 / 21</div>
          <div style={{ fontSize: '11px', color: 'oklch(0.4 0.12 150)', marginTop: '2px' }}>100% online</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px', cursor: 'pointer' }} onClick={() => onNavigate('approvals')}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Approvals Waiting</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(0.5 0.13 70)', marginTop: '4px' }}>6</div>
          <div style={{ fontSize: '11px', color: 'oklch(0.5 0.13 70)', marginTop: '2px' }}>Oldest: 18 min SLA</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px', cursor: 'pointer' }} onClick={() => onNavigate('exceptions')}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Operational Exceptions</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(0.45 0.17 25)', marginTop: '4px' }}>32</div>
          <div style={{ fontSize: '11px', color: 'oklch(0.45 0.17 25)', marginTop: '2px' }}>Workflow & LIS bottlenecks</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>p50 Latency</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#15181b', marginTop: '4px' }}>1.8 s</div>
          <div style={{ fontSize: '11px', color: 'oklch(0.4 0.12 150)', marginTop: '2px' }}>Med-PaLM 2 & Gemini</div>
        </div>
      </div>

      {/* Agents Operational Matrix */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #eef0f1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13.5px' }}>Agent Telemetry & Fleet Status</div>
            <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '2px' }}>
              Click an agent to open its configuration, tools, and playground in Agent Studio.
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#fafbfc', borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Agent Name & ID</th>
                <th style={{ padding: '10px 14px' }}>Type</th>
                <th style={{ padding: '10px 14px' }}>Department</th>
                <th style={{ padding: '10px 14px' }}>Risk Tier</th>
                <th style={{ padding: '10px 14px' }}>Runs Today</th>
                <th style={{ padding: '10px 14px' }}>Success Rate</th>
                <th style={{ padding: '10px 14px' }}>Human Approval</th>
                <th style={{ padding: '10px 14px' }}>Last Run</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {AGENTS_DATA.map((a) => {
                const tierColor = a.tier === 'High' ? 'oklch(0.45 0.17 25)' : a.tier === 'Medium' ? 'oklch(0.5 0.13 70)' : 'oklch(0.4 0.12 150)';
                return (
                  <tr
                    key={a.id}
                    onClick={() => onNavigate('agents')}
                    style={{ borderBottom: '1px solid #f2f3f4', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'oklch(0.4 0.1 200)' }}>{a.name}</div>
                      <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#8a9096' }}>{a.id} · v{a.v}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#52585e' }}>{a.type}</td>
                    <td style={{ padding: '10px 14px', color: '#52585e' }}>{a.owner}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: tierColor }}>
                      {a.tier}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{a.runs}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>{a.success}</td>
                    <td style={{ padding: '10px 14px', color: a.humanApproval !== 'None' ? 'oklch(0.5 0.13 70)' : '#8a9096', fontWeight: a.humanApproval !== 'None' ? 600 : 400 }}>
                      {a.humanApproval}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#8a9096' }}>{a.lastRun}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600, background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)' }}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
