import React, { useState } from 'react';

const INITIAL_APPROVALS = [
  {
    id: 'AP-0001',
    type: 'Discharge summary',
    patientId: 'MER-2026-008421',
    patient: 'Kavitha Raman',
    agentId: 'AG-19',
    agent: 'Discharge Summary Agent',
    action: 'Sign PTCA discharge summary v2',
    risk: 'High',
    reason: 'AI draft · procedure note, meds & follow-up verified',
    created: '11:05',
    sla: 120,
    owner: 'Doctor',
    status: 'Pending',
    detail: 'Patient underwent PTCA + DES (3.0x18 mm) on 12 Sep 2026. LVEF 55%, hemodynamically stable. Dual antiplatelet therapy prescribed.'
  },
  {
    id: 'AP-0002',
    type: 'Preauth submission',
    patientId: 'MER-2026-008421',
    patient: 'Kavitha Raman',
    agentId: 'AG-07',
    agent: 'Insurance Preauth Agent',
    action: 'Submit enhancement request for ₹73,450',
    risk: 'Medium',
    reason: 'Star Health cashless enhancement · initial ₹1,95,000 sanctioned',
    created: '10:55',
    sla: 60,
    owner: 'Insurance',
    status: 'Pending',
    detail: 'Second balloon required during cath-lab angioplasty + 1 additional night observation. Total running bill ₹2,68,450.'
  },
  {
    id: 'AP-0003',
    type: 'Billing release',
    patientId: 'MER-2026-008421',
    patient: 'Kavitha Raman',
    agentId: 'AG-14',
    agent: 'Billing Transparency Agent',
    action: 'Release final bill & clearance certificate',
    risk: 'Medium',
    reason: 'Estimate variance explained · co-pay collected',
    created: '11:12',
    sla: 45,
    owner: 'Billing',
    status: 'Pending',
    detail: 'Final audited bill amount ₹2,68,450. Insurer share ₹1,95,000. Patient balance ₹0 after UPI settlement.'
  },
  {
    id: 'AP-0004',
    type: 'Discharge summary',
    patientId: 'MER-2026-005098',
    patient: 'Meenakshi Sundaram',
    agentId: 'AG-19',
    agent: 'Discharge Summary Agent',
    action: 'Sign discharge summary v2',
    risk: 'High',
    reason: 'AI draft · chemotherapy cycle 4',
    created: '11:07',
    sla: 120,
    owner: 'Doctor',
    status: 'Pending',
    detail: 'Day-care chemotherapy protocol Oxaliplatin + Capecitabine completed without adverse reaction. CBC normal.'
  },
  {
    id: 'AP-0005',
    type: 'Discharge summary',
    patientId: 'MER-2026-007733',
    patient: 'Murugan Selvam',
    agentId: 'AG-19',
    agent: 'Discharge Summary Agent',
    action: 'Sign CABG discharge summary v1',
    risk: 'High',
    reason: 'AI draft · surgeon review required',
    created: '10:42',
    sla: 120,
    owner: 'Doctor',
    status: 'Pending',
    detail: 'Triple vessel coronary artery bypass grafting on CPB. Graft patency verified, chest drains removed, sternum stable.'
  },
  {
    id: 'AP-0006',
    type: 'Claim appeal',
    patientId: 'MER-2026-007733',
    patient: 'Murugan Selvam',
    agentId: 'AG-20',
    agent: 'Claim Denial Agent',
    action: 'Submit appeal for ₹55,000 shortfall',
    risk: 'Medium',
    reason: 'Partial approval · appeal packet ready with EMR justification',
    created: '10:20',
    sla: 240,
    owner: 'Insurance',
    status: 'Pending',
    detail: 'Insurer query on ICU length of stay. Post-op telemetry proof and intensivist notes attached to justify 48h ICU monitoring.'
  }
];

export default function ApprovalsView({ onNavigate, userRole = 'Doctor' }) {
  const [approvals, setApprovals] = useState(INITIAL_APPROVALS);
  const [filter, setFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState(null);

  const handleAction = (id, newStatus, reason = '') => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    alert(`${id} ${newStatus.toUpperCase()}! Recorded under ${userRole} in the immutable audit trail.`);
  };

  const filteredApprovals = approvals.filter(a => {
    if (filter === 'All') return true;
    return a.status === filter;
  });

  const pendingCount = approvals.filter(a => a.status === 'Pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Hospital AI Platform</span> › <span>HUMAN-IN-THE-LOOP APPROVALS</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            Human Approval Centre (HITL)
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '12px', background: 'oklch(0.96 0.03 25)', color: 'oklch(0.45 0.17 25)' }}>
              {pendingCount} Pending Gateways
            </span>
          </div>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            High-risk autonomous agent drafts require authorized human sign-off before committing to the EMR, LIS, or Insurer portals.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['All', 'Pending', 'Approved', 'Rejected'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                height: '28px', padding: '0 12px', borderRadius: '14px',
                border: '1px solid #e3e6e8', fontSize: '11.5px', fontWeight: filter === f ? 600 : 400,
                background: filter === f ? 'oklch(0.5 0.1 200)' : '#fff',
                color: filter === f ? '#fff' : '#52585e', cursor: 'pointer'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Approvals List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredApprovals.map(ap => {
          const isPending = ap.status === 'Pending';
          const isApproved = ap.status === 'Approved';
          const riskColor = ap.risk === 'High' ? 'oklch(0.45 0.17 25)' : 'oklch(0.5 0.13 70)';

          return (
            <div
              key={ap.id}
              style={{
                background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px',
                padding: '14px 18px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: '12px', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13.5px' }}>{ap.type}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                    background: isPending ? 'oklch(0.96 0.05 80)' : isApproved ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.03 25)',
                    color: isPending ? 'oklch(0.5 0.13 70)' : isApproved ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.17 25)'
                  }}>
                    {ap.status}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: riskColor }}>
                    Risk: {ap.risk}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#8a9096' }}>
                    {ap.id} · Created {ap.created} · SLA: {ap.sla}m
                  </span>
                </div>

                <div style={{ fontWeight: 600, fontSize: '13px', color: '#15181b', marginTop: '2px' }}>
                  {ap.action}
                </div>

                <div style={{ color: '#52585e', fontSize: '12px', marginTop: '4px', lineHeight: 1.4 }}>
                  Patient: <strong style={{ color: '#15181b' }}>{ap.patient}</strong> ({ap.patientId}) · Agent: <strong style={{ color: '#15181b' }}>{ap.agent}</strong> · Required Role: <strong>{ap.owner}</strong>
                </div>

                <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '4px' }}>
                  {ap.detail}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => onNavigate('runs')}
                  style={{
                    height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8',
                    background: '#fff', fontSize: '11.5px', cursor: 'pointer'
                  }}
                >
                  View Execution Trace
                </button>

                {isPending && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAction(ap.id, 'Changes Requested')}
                      style={{
                        height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8',
                        background: '#fff', fontSize: '11.5px', cursor: 'pointer'
                      }}
                    >
                      Request Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(ap.id, 'Rejected')}
                      style={{
                        height: '30px', padding: '0 12px', borderRadius: '6px', border: '1px solid oklch(0.88 0.06 25)',
                        background: '#fff', color: 'oklch(0.45 0.17 25)', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(ap.id, 'Approved')}
                      style={{
                        height: '30px', padding: '0 16px', borderRadius: '6px', border: 0,
                        background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      Approve & Sign
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
