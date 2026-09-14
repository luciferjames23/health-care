import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export default function DischargeCommandCentre({ onSelectPatient, onOpenSoap }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [simState, setSimState] = useState({});
  const [loading, setLoading] = useState(false);

  const initialMockCases = [
    {
      id: 'DC-01', patient: 'Kavitha Raman', bed: 'C-412', doctor: 'Dr. Arjun Menon',
      insurer: 'Star Health', intent: '09:02', eta: '4:20 PM',
      cp: 'billing → insurance → transport', pending: 5,
      owner: 'Insurance desk · R. Sundar', age: '2 h 20 m',
      status: 'Blocked · insurance', statusType: 'red',
      deps: [
        { label: 'Doctor intent', note: 'Consultant recorded intent in EMR', status: 'Done', at: '09:02', done: true },
        { label: 'Pending investigations', note: 'ECHO & Blood cultures reported normal', status: 'Done', at: '09:45', done: true },
        { label: 'Pharmacy clearance', note: 'Discharge kit & inhalers verified', status: 'Done', at: '10:15', done: true },
        { label: 'Insurance preauth enhancement', note: 'Provisional bill ₹1,42,000 submitted; awaiting Star Health approval', status: 'In Query', at: '10:30', done: false, active: true },
        { label: 'Billing finalisation', note: 'Patient liability calculation pending TPA response', status: 'Pending', at: '—', done: false },
        { label: 'Discharge summary signature', note: 'AI draft composed; awaiting Dr. Arjun Menon sign-off', status: 'Pending sign', at: '—', done: false },
        { label: 'Ward release & housekeeping', note: 'Bed C-412 clean notification scheduled', status: 'Pending', at: '—', done: false },
      ]
    }
  ];

  const [liveCases, setLiveCases] = useState([]);

  useEffect(() => {
    async function loadDischargeCandidates() {
      setLoading(true);
      try {
        const res = await apiService.getDischargeCandidates({ limit: 100 });
        const list = res?.candidates || res?.data || [];
        if (list.length > 0) {
          const mapped = list.map((c) => {
            const hasPending = (c.pending_dependencies_count || 0) > 0;
            const liveDeps = (c.dependencies && Array.isArray(c.dependencies) && c.dependencies.length > 0)
              ? c.dependencies
              : [
                  { label: 'Consultant Discharge Summary', note: c.diagnoses || 'Summary generated', status: 'Done', at: '09:00', done: true },
                  { label: 'Patient Condition', note: c.patient_condition || 'Clinically stable for discharge', status: 'Done', at: '10:00', done: true },
                  { label: 'Department Clearances', note: `${c.pending_dependencies_count || 0} items pending clearance`, status: hasPending ? 'Pending' : 'Done', at: '10:30', done: !hasPending, active: hasPending }
                ];

            return {
              id: `DC-${String(c.summary_id).padStart(2, '0')}`,
              summary_id: c.summary_id,
              patient_id: c.patient_id,
              patient: c.patient_name,
              bed: c.bed_number || 'OP',
              doctor: c.doctor_name || c.primary_consultant || 'Dr. Arjun Menon',
              insurer: c.insurance_provider || c.insurer || 'Comprehensive Cashless Mediclaim',
              policyNumber: c.policy_number,
              intent: c.admission_date ? new Date(c.admission_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent',
              eta: c.discharge_date ? new Date(c.discharge_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today',
              cp: hasPending ? 'clearance → pharmacy' : 'Clear',
              pending: c.pending_dependencies_count || 0,
              owner: c.primary_consultant || 'Consultant',
              age: '1 h 15 m',
              status: hasPending ? 'Blocked · clearance' : 'Ready',
              statusType: hasPending ? 'amber' : 'green',
              diagnoses: c.diagnoses,
              condition: c.patient_condition,
              deps: liveDeps
            };
          });
          setLiveCases(mapped);
        }
      } catch (err) {
        console.warn("Using default discharge cases:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDischargeCandidates();
  }, []);

  const filtered = liveCases.filter(c => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return c.patient.toLowerCase().includes(s) ||
           c.bed.toLowerCase().includes(s) ||
           c.doctor.toLowerCase().includes(s) ||
           c.insurer.toLowerCase().includes(s) ||
           c.status.toLowerCase().includes(s);
  });

  const handleSimApprove = (cId) => {
    setSimState(prev => ({ ...prev, [cId]: 'approved' }));
    alert('Simulated TPA Webhook: Star Health approval granted for ₹1,35,000. Final bill cleared.');
  };

  const handleSimReject = (cId) => {
    setSimState(prev => ({ ...prev, [cId]: 'rejected' }));
    alert('Simulated TPA Webhook: Enhancement query sent by Star Health: "Provide ICU stay clinical justification". Exception created in Exception Centre.');
  };

  const handleReleaseBed = (cId) => {
    setSimState(prev => ({ ...prev, [cId]: 'released' }));
    alert('Patient successfully discharged! Bed released and notification sent to Housekeeping.');
    setSelectedCase(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
          <span>Clinical Workspace</span> › <span>Discharge</span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 600 }}>
          Discharge command centre
        </div>
        <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
          25 active cases · dependency graph, predicted ready time and critical path by Discharge Orchestration Agent v3.0.2
        </div>
      </div>

      {/* KPI Stats */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Total Inpatient Cases</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#15181b' }}>{liveCases.length || 250}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Ready for Discharge</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.4 0.12 150)' }}>
            {liveCases.filter(c => c.statusType === 'green').length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Clearance Pending</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.13 70)' }}>
            {liveCases.filter(c => c.statusType === 'amber' || c.pending > 0).length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Insurer Preauth Active</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.1 200)' }}>
            {liveCases.filter(c => c.insurer && c.insurer !== 'Self-pay').length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Discharged Today</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.4 0.12 150)' }}>
            {Object.values(simState).filter(s => s === 'released').length + 3}
          </div>
        </div>
      </div>

      {/* Controls: Mode Switcher & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', border: '1px solid #e3e6e8', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              height: '28px', padding: '0 12px', border: 0,
              background: viewMode === 'table' ? '#15181b' : '#fff',
              color: viewMode === 'table' ? '#fff' : '#15181b',
              fontWeight: 600, fontSize: '11.5px', cursor: 'pointer'
            }}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            style={{
              height: '28px', padding: '0 12px', border: 0, borderLeft: '1px solid #e3e6e8',
              background: viewMode === 'kanban' ? '#15181b' : '#fff',
              color: viewMode === 'kanban' ? '#fff' : '#15181b',
              fontWeight: 600, fontSize: '11.5px', cursor: 'pointer'
            }}
          >
            Kanban
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            style={{
              height: '30px', width: '220px', border: '1px solid #e3e6e8',
              borderRadius: '6px', padding: '0 10px', background: '#fff', fontSize: '12px', outline: 'none'
            }}
          />
          <button
            type="button"
            onClick={() => alert('Exported discharge report as CSV')}
            style={{
              height: '30px', padding: '0 10px', borderRadius: '6px',
              border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '12px'
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table Mode */}
      {viewMode === 'table' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <th style={{ padding: '8px 12px', minWidth: '160px' }}>Patient · Bed</th>
                <th style={{ padding: '8px 12px', minWidth: '130px' }}>Doctor</th>
                <th style={{ padding: '8px 12px', width: '110px' }}>Insurer</th>
                <th style={{ padding: '8px 12px', width: '70px' }}>Intent</th>
                <th style={{ padding: '8px 12px', width: '110px' }}>Predicted Ready</th>
                <th style={{ padding: '8px 12px', minWidth: '180px' }}>Critical Path</th>
                <th style={{ padding: '8px 12px', width: '60px' }}>Pending</th>
                <th style={{ padding: '8px 12px', minWidth: '130px' }}>Owner</th>
                <th style={{ padding: '8px 12px', width: '70px' }}>Age</th>
                <th style={{ padding: '8px 12px', width: '160px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isApproved = simState[c.id] === 'approved';
                const isReleased = simState[c.id] === 'released';
                const currentStatus = isReleased ? 'Discharged · bed released' : isApproved ? 'Ready · insurer approved' : c.status;
                const currentType = isReleased ? 'green' : isApproved ? 'green' : c.statusType;

                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    style={{ borderBottom: '1px solid #f2f3f4', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>
                      {c.patient} · <span style={{ color: '#52585e' }}>{c.bed}</span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#15181b' }}>{c.doctor}</td>
                    <td style={{ padding: '9px 12px', color: '#52585e' }}>{c.insurer}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px' }}>{c.intent}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', fontWeight: 600 }}>
                      {isReleased ? 'Done' : isApproved ? '11:45 AM' : c.eta}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#52585e', fontSize: '11.5px' }}>{c.cp}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600 }}>{isReleased ? 0 : isApproved ? 1 : c.pending}</td>
                    <td style={{ padding: '9px 12px', color: '#52585e' }}>{c.owner}</td>
                    <td style={{ padding: '9px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px' }}>{c.age}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        background: currentType === 'red' ? 'oklch(0.96 0.03 25)' : currentType === 'green' ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 80)',
                        color: currentType === 'red' ? 'oklch(0.45 0.17 25)' : currentType === 'green' ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.13 70)'
                      }}>
                        {currentStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Kanban Mode */}
      {viewMode === 'kanban' && (
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
          {['Blocked', 'Approval required', 'In progress', 'Ready'].map((col) => {
            const colCases = filtered.filter(c => c.status.toLowerCase().includes(col.toLowerCase()));
            return (
              <div key={col} style={{ flex: '0 0 260px', background: '#f3f4f5', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>{col}</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#52585e' }}>{colCases.length}</span>
                </div>
                {colCases.map(c => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    style={{
                      background: '#fff', border: '1px solid #e3e6e8', borderRadius: '6px',
                      padding: '10px', cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>{c.patient} · {c.bed}</div>
                    <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '2px' }}>{c.doctor}</div>
                    <div style={{ color: '#8a9096', fontSize: '10.5px', marginTop: '4px' }}>ETA: {c.eta} · {c.insurer}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Case Details Drawer / Modal */}
      {selectedCase && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', justifyContent: 'flex-end', zIndex: 100
        }}>
          <div style={{
            width: 'min(560px, 100%)', height: '100%', background: '#fff',
            display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '24px', gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{selectedCase.patient}</div>
                <div style={{ color: '#8a9096', fontSize: '12px' }}>
                  Bed {selectedCase.bed} · {selectedCase.doctor} · {selectedCase.insurer}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                style={{
                  height: '28px', width: '28px', border: '1px solid #e3e6e8',
                  borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '13px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Status & ETA */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
              padding: '10px', borderRadius: '6px', background: '#f6f7f8', fontSize: '11.5px'
            }}>
              <div>
                <div style={{ color: '#8a9096' }}>Intent</div>
                <div style={{ fontWeight: 600 }}>{selectedCase.intent}</div>
              </div>
              <div>
                <div style={{ color: '#8a9096' }}>Age</div>
                <div style={{ fontWeight: 600 }}>{selectedCase.age}</div>
              </div>
              <div>
                <div style={{ color: '#8a9096' }}>Owner</div>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCase.owner}</div>
              </div>
              <div>
                <div style={{ color: '#8a9096' }}>Predicted Ready</div>
                <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '16px', fontWeight: 600, color: 'oklch(0.5 0.1 200)' }}>
                  {simState[selectedCase.id] === 'approved' ? '11:45 AM' : selectedCase.eta}
                </div>
              </div>
            </div>

            {/* Dependency Graph */}
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>
                Dependency graph · Multi-department workflow
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedCase.deps.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) auto',
                      gap: '10px', alignItems: 'center', padding: '7px 10px', borderRadius: '6px',
                      background: d.done ? '#fbfbfc' : d.active ? 'oklch(0.96 0.05 80)' : '#fff',
                      border: '1px solid #eef0f1'
                    }}
                  >
                    <span style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: d.done ? 'oklch(0.95 0.04 150)' : d.active ? 'oklch(0.5 0.18 25)' : '#eef0f1',
                      color: d.done ? 'oklch(0.4 0.12 150)' : '#fff',
                      fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
                    }}>
                      {d.done ? '✓' : '!'}
                    </span>
                    <div style={{ fontSize: '11.5px' }}>
                      <span style={{ fontWeight: 600 }}>{d.label}</span>
                      <span style={{ color: '#52585e' }}> · {d.note}</span>
                    </div>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10.5px', color: '#8a9096' }}>
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* WhatsApp Family preview */}
            <div style={{ background: '#f6f7f8', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em', color: '#8a9096', marginBottom: '4px' }}>
                Family status update · WhatsApp notification draft
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#15181b' }}>
                “Dear family of {selectedCase.patient}, your discharge process is in step 4 of 6 (TPA final enhancement). Expected release time is {simState[selectedCase.id] === 'approved' ? '11:45 AM' : selectedCase.eta}. Please meet the discharge desk once the nurse hands over take-home medications.”
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
              <button
                type="button"
                onClick={() => {
                  if (onSelectPatient) {
                    onSelectPatient({
                      patient_id: selectedCase.patient_id,
                      id: String(selectedCase.patient_id),
                      name: selectedCase.patient,
                      bed: selectedCase.bed,
                      doctor: selectedCase.doctor,
                      insurer: selectedCase.insurer
                    });
                  }
                }}
                style={{
                  height: '34px', borderRadius: '6px', border: '1px solid oklch(0.5 0.1 200)',
                  background: '#fff', color: 'oklch(0.4 0.1 200)',
                  fontWeight: 600, fontSize: '12px', cursor: 'pointer'
                }}
              >
                Open Patient 360 Dossier →
              </button>

              <button
                type="button"
                onClick={() => handleReleaseBed(selectedCase.id)}
                style={{
                  height: '36px', borderRadius: '6px', border: 0,
                  background: 'oklch(0.5 0.1 200)', color: '#fff',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer'
                }}
              >
                Discharge patient · release bed
              </button>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleSimApprove(selectedCase.id)}
                  style={{
                    flex: 1, height: '30px', border: '1px solid #e3e6e8',
                    borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '11.5px'
                  }}
                >
                  Simulate insurer: approve
                </button>
                <button
                  type="button"
                  onClick={() => handleSimReject(selectedCase.id)}
                  style={{
                    flex: 1, height: '30px', border: '1px solid #e3e6e8',
                    borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '11.5px'
                  }}
                >
                  Simulate insurer: query
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
