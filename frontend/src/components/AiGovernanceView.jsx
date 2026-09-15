import React, { useState } from 'react';

const RISKS = [
  { risk: 'Wrong patient context injection', severity: 'High', owner: 'CIO & CISO', mitigation: 'UHID + relationship verify on every conversational turn', residual: 'Low' },
  { risk: 'Hallucination in patient-facing answers', severity: 'High', owner: 'Knowledge Manager', mitigation: 'Citations required; refusal below 70%; groundedness monitor', residual: 'Medium' },
  { risk: 'Outdated clinical SOP retrieved', severity: 'Medium', owner: 'Quality Head', mitigation: 'Expiry enforcement; conflict detection algorithm', residual: 'Medium' },
  { risk: 'Unauthorised access via agent prompt', severity: 'High', owner: 'CISO', mitigation: 'Policy gateway + tool gateway; strict RBAC regression suite', residual: 'Low' },
  { risk: 'Incorrect Tamil vernacular translation', severity: 'Medium', owner: 'Patient Experience', mitigation: 'Bilingual output; nurse/staff verification before teaching', residual: 'Low' },
  { risk: 'Autonomous agent tool misuse', severity: 'High', owner: 'AI Programme Lead', mitigation: 'Allow-listed tools; mandatory human approval tier for state writes', residual: 'Low' },
  { risk: 'Model drift or quality degradation', severity: 'Medium', owner: 'AI Engineering', mitigation: 'Nightly synthetic eval suites; pinned foundation model versions', residual: 'Low' },
  { risk: 'Integration failure (LIS, RIS, TPA)', severity: 'Medium', owner: 'Integration Lead', mitigation: 'Manual fallback with SLA timers and phone verification', residual: 'Medium' }
];

export default function AiGovernanceView({ initialTab = 'governance' }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const TABS = [
    { id: 'governance', label: 'Governance & Risk Register' },
    { id: 'guardrails', label: 'Safety Guardrails' },
    { id: 'evals', label: 'Evaluations & Benchmarks' },
    { id: 'observability', label: 'AI Observability' },
    { id: 'cost', label: 'Cost & Token Usage' },
    { id: 'incidents', label: 'Incidents & Fallbacks' },
    { id: 'trainer', label: 'AI Trainer & Competency' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Hospital AI Platform</span> › <span>AI GOVERNANCE & RISK</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>
            Enterprise AI Governance & Safety Guardrails
          </div>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            Portfolio oversight, risk tiers, synthetic evaluation suites, incident post-mortems, and compliance guardrails.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid #e3e6e8', paddingBottom: '2px', overflowX: 'auto' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 14px', border: 0, background: 'transparent',
                fontSize: '12px', fontWeight: isActive ? 600 : 500, cursor: 'pointer',
                color: isActive ? 'oklch(0.4 0.1 200)' : '#52585e',
                borderBottom: isActive ? '2px solid oklch(0.5 0.1 200)' : '2px solid transparent',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Governance & Risk Register */}
      {activeTab === 'governance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Governance KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: '#8a9096' }}>Governed Risk Items</div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '2px' }}>8 Active Risks</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: '#8a9096' }}>High-Risk Agents</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.45 0.17 25)', marginTop: '2px' }}>4 (All Gated)</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: '#8a9096' }}>AI Committee Review</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.4 0.12 150)', marginTop: '2px' }}>05 Sep 2026</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: '#8a9096' }}>Audit Completeness</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.4 0.12 150)', marginTop: '2px' }}>100% Traceable</div>
            </div>
          </div>

          {/* Risk Table */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #eef0f1', fontWeight: 700, fontSize: '13.5px' }}>
              AI Clinical & Operational Risk Register
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#fafbfc', borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Risk Description</th>
                  <th style={{ padding: '10px 14px' }}>Severity</th>
                  <th style={{ padding: '10px 14px' }}>Accountable Owner</th>
                  <th style={{ padding: '10px 14px' }}>Mitigation & Safeguard</th>
                  <th style={{ padding: '10px 14px' }}>Residual Risk</th>
                </tr>
              </thead>
              <tbody>
                {RISKS.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f2f3f4' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.risk}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                        background: r.severity === 'High' ? 'oklch(0.96 0.03 25)' : 'oklch(0.96 0.05 80)',
                        color: r.severity === 'High' ? 'oklch(0.45 0.17 25)' : 'oklch(0.5 0.13 70)'
                      }}>
                        {r.severity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#52585e' }}>{r.owner}</td>
                    <td style={{ padding: '10px 14px', color: '#15181b' }}>{r.mitigation}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: r.residual === 'Low' ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.13 70)' }}>
                      {r.residual}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Guardrails */}
      {activeTab === 'guardrails' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#fff', border: '1px solid oklch(0.55 0.13 150 / .5)', borderRadius: '8px', padding: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: 'oklch(0.4 0.12 150)', letterSpacing: '.06em', marginBottom: '8px' }}>
              PERMITTED CAPABILITIES · AI MAY ASSIST
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#15181b', marginBottom: '12px' }}>
              Autonomous and assisted operational tasks that are verified safe under human supervision:
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', lineHeight: 1.8, color: '#52585e' }}>
              <li>Context Retrieval from EMR & Lakehouse Gold layer</li>
              <li>Clinical Discharge Summary Drafting (Doctor Review Mandatory)</li>
              <li>Insurance Preauthorisation Assembly & Denial Risk Scoring</li>
              <li>Discharge Dependency Tracking & Predicted Ready Time (ETA)</li>
              <li>Diagnostic Preparation & Fasting Instructions Delivery in Tamil/English</li>
              <li>Bed Demand & Staffing Capacity Forecasting</li>
              <li>Patient WhatsApp Updates & Appointment Reminders</li>
            </ul>
          </div>

          <div style={{ background: '#fff', border: '1px solid oklch(0.55 0.18 25 / .5)', borderRadius: '8px', padding: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: 'oklch(0.45 0.17 25)', letterSpacing: '.06em', marginBottom: '8px' }}>
              STRICT BOUNDARIES · NEVER AUTOMATED
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#15181b', marginBottom: '12px' }}>
              High-consequence clinical, financial, and legal actions strictly reserved for licensed humans:
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', lineHeight: 1.8, color: '#52585e' }}>
              <li>Medical Diagnosis & Clinical Decision-Making</li>
              <li>Prescribing Medications & Modifying Dosages</li>
              <li>Emergency Triage Acuity Determination</li>
              <li>Discharge Against Medical Advice (LAMA) Approvals</li>
              <li>Final Bill Release & Tariff Dispute Waivers</li>
              <li>End-of-life decisions & Breaking Bad News</li>
              <li>Direct Claim Final Submission without Insurance Executive Review</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab: Evaluations */}
      {activeTab === 'evals' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>Nightly Automated Evaluation Suites</div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginBottom: '14px' }}>
            Synthetic test runs executed on every published agent version across accuracy, groundedness, hallucination, refusal, and escalation metrics.
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#fafbfc', borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px' }}>Eval Run</th>
                <th style={{ padding: '10px 14px' }}>Agent Name</th>
                <th style={{ padding: '10px 14px' }}>Version</th>
                <th style={{ padding: '10px 14px' }}>Test Cases</th>
                <th style={{ padding: '10px 14px' }}>Accuracy</th>
                <th style={{ padding: '10px 14px' }}>Groundedness</th>
                <th style={{ padding: '10px 14px' }}>Hallucination</th>
                <th style={{ padding: '10px 14px' }}>Refusal (&lt;70%)</th>
                <th style={{ padding: '10px 14px' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f2f3f4' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>EV-2026-904</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>Discharge Summary Agent</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>v1.1.0</td>
                <td style={{ padding: '10px 14px' }}>50 cases</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>98.2%</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'oklch(0.4 0.12 150)' }}>99.1%</td>
                <td style={{ padding: '10px 14px', color: 'oklch(0.4 0.12 150)' }}>0.1%</td>
                <td style={{ padding: '10px 14px' }}>100%</td>
                <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: '4px', background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>Pass</span></td>
              </tr>
              <tr style={{ borderBottom: '1px solid #f2f3f4' }}>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>EV-2026-903</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>Insurance Preauth Agent</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>v2.0.4</td>
                <td style={{ padding: '10px 14px' }}>40 cases</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>96.5%</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'oklch(0.4 0.12 150)' }}>97.8%</td>
                <td style={{ padding: '10px 14px', color: 'oklch(0.4 0.12 150)' }}>0.2%</td>
                <td style={{ padding: '10px 14px' }}>98.0%</td>
                <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: '4px', background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>Pass</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Observability & Cost & Trainer */}
      {!['governance', 'guardrails', 'evals'].includes(activeTab) && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}>{activeTab.toUpperCase()} Module</div>
          <div style={{ color: '#52585e', fontSize: '12px', maxWidth: '500px', margin: '0 auto', lineHeight: 1.5 }}>
            Live enterprise telemetry stream connected with Databricks Lakehouse and the AI Governance Audit gateway.
          </div>
        </div>
      )}

    </div>
  );
}
