import React, { useState, useEffect } from 'react';
import { apiService, parseDischargeSummaryRecord } from '../services/api';

export default function DischargeCommandCentre({ onSelectPatient, onOpenSoap }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [simState, setSimState] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveCases, setLiveCases] = useState([]);

  useEffect(() => {
    async function loadDischargeCandidates() {
      setLoading(true);
      setError(null);
      try {
        // Fetch real discharged patients from Gold generated-discharge-summaries API
        const res = await apiService.getDischargedPatients();
        const list = res?.data || [];
        if (list.length > 0) {
          const mapped = list.map((c) => {
            const parsed = parseDischargeSummaryRecord(c);
            const liveDeps = [
              { label: 'AI Discharge Summary Generation', note: `Generated via ${parsed.model_name}`, status: 'Completed', at: parsed.intent, done: true },
              { label: 'Clinical Course & Investigations', note: parsed.investigations ? parsed.investigations.slice(0, 60) + '...' : 'Clinical investigations verified', status: 'Completed', at: parsed.intent, done: true },
              { label: 'Attending Physician Approval', note: `Consultant: ${parsed.doctor} · Status: ${parsed.approval_status}`, status: parsed.approval_status, at: parsed.eta, done: parsed.approval_status === 'Approved', active: parsed.approval_status !== 'Approved' },
              { label: 'Discharge Medications & Advice', note: parsed.discharge_advice ? parsed.discharge_advice.slice(0, 60) + '...' : 'Take-home medications documented', status: 'Verified', at: parsed.eta, done: true },
              { label: 'Hospital Bed Release', note: `${parsed.bed} released and cleaned`, status: 'Ready', at: '—', done: true }
            ];

            return {
              ...parsed,
              cp: parsed.approval_status === 'Approved' ? 'Summary Approved → Bed Released' : 'Pending Physician Approval',
              pending: parsed.approval_status === 'Approved' ? 0 : 1,
              owner: parsed.doctor,
              age: 'Clinical Review',
              deps: liveDeps
            };
          });
          setLiveCases(mapped);
        } else {
          setLiveCases([]);
        }
      } catch (err) {
        console.error("Failed to load discharge summaries:", err);
        setError(err.message || 'Failed to connect to Generated Discharge Summaries API');
      } finally {
        setLoading(false);
      }
    }
    loadDischargeCandidates();
  }, []);

  const filtered = liveCases.filter(c => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (c.patient && c.patient.toLowerCase().includes(s)) ||
           (c.bed && c.bed.toLowerCase().includes(s)) ||
           (c.doctor && c.doctor.toLowerCase().includes(s)) ||
           (c.diagnoses && c.diagnoses.toLowerCase().includes(s)) ||
           (c.status && c.status.toLowerCase().includes(s));
  });

  const handleSimApprove = (cId) => {
    setSimState(prev => ({ ...prev, [cId]: 'approved' }));
    alert('Physician Sign-Off: Discharge summary formally approved and finalized.');
  };

  const handleSimReject = (cId) => {
    setSimState(prev => ({ ...prev, [cId]: 'query' }));
    alert('Physician Query: Revision requested for discharge summary.');
  };

  const handleReleaseBed = (cId) => {
    setSimState(prev => ({ ...prev, [cId]: 'released' }));
    alert('Patient successfully cleared! Bed release notification broadcast to Housekeeping.');
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

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#991b1b', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><strong>Unable to load records:</strong> {error}</span>
          <button 
            onClick={() => window.location.reload()}
            style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #f87171', background: '#fff', cursor: 'pointer', fontSize: '11px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Total Discharged Records</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#15181b' }}>
            {loading ? '—' : liveCases.length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Approved Summaries</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.4 0.12 150)' }}>
            {loading ? '—' : liveCases.filter(c => c.approval_status === 'Approved').length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Pending Sign-Off</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.13 70)' }}>
            {loading ? '—' : liveCases.filter(c => c.approval_status !== 'Approved').length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>AI Model Engine</div>
          <div style={{ fontSize: '12px', lineHeight: 1.8, color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}>
            Llama 3.3 70B Instruct
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Live API Source</div>
          <div style={{ fontSize: '12px', lineHeight: 1.8, color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
            Gold / Generated Discharges
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
            placeholder="Search discharged patient, doctor, diagnosis..."
            style={{
              height: '30px', width: '280px', border: '1px solid #e3e6e8',
              borderRadius: '6px', padding: '0 10px', background: '#fff', fontSize: '12px', outline: 'none'
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (!liveCases.length) return alert('No discharged records to export');
              const headers = ['Summary ID', 'Patient Name', 'Attending Physician', 'Discharge Date', 'Diagnoses', 'Condition at Discharge', 'Approval Status'];
              const csvRows = [headers.join(',')];
              liveCases.forEach(c => {
                csvRows.push([
                  `"${c.summary_id || ''}"`,
                  `"${c.patient || ''}"`,
                  `"${c.doctor || ''}"`,
                  `"${c.discharge_date || ''}"`,
                  `"${(c.diagnoses || '').replace(/"/g, '""')}"`,
                  `"${(c.patient_condition || '').replace(/"/g, '""')}"`,
                  `"${c.approval_status || ''}"`
                ].join(','));
              });
              const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.setAttribute('href', url);
              link.setAttribute('download', `discharged_patients_${new Date().toISOString().slice(0,10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
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
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Loading Discharged Patient Summaries...</div>
              <div style={{ fontSize: '12px' }}>Connecting to backend Gold Generated Discharge Summaries API</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No Discharged Patient Records Found</div>
              <div style={{ fontSize: '12px' }}>{search ? `No records matching "${search}"` : 'Zero discharge summary records in the database.'}</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  <th style={{ padding: '8px 12px', minWidth: '160px' }}>Patient</th>
                  <th style={{ padding: '8px 12px', minWidth: '140px' }}>Attending Doctor</th>
                  <th style={{ padding: '8px 12px', minWidth: '220px' }}>Discharge Diagnosis</th>
                  <th style={{ padding: '8px 12px', width: '110px' }}>Discharge Date</th>
                  <th style={{ padding: '8px 12px', minWidth: '180px' }}>Patient Condition</th>
                  <th style={{ padding: '8px 12px', width: '120px' }}>Approval Status</th>
                  <th style={{ padding: '8px 12px', width: '90px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const isApproved = simState[c.id] === 'approved' || c.approval_status === 'Approved';
                  const isReleased = simState[c.id] === 'released';
                  const currentStatus = isReleased ? 'Discharged · Released' : isApproved ? 'Approved' : 'Pending Review';
                  const currentType = isReleased ? 'green' : isApproved ? 'green' : 'amber';

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCase(c)}
                      style={{ borderBottom: '1px solid #f2f3f4', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '9px 12px', fontWeight: 600 }}>
                        <div style={{ color: '#15181b' }}>{c.patient}</div>
                        <div style={{ fontSize: '10.5px', color: '#8a9096', fontWeight: 400 }}>{c.ward || 'Inpatient Wing'} · {c.bed || 'Released Bed'}</div>
                      </td>
                      <td style={{ padding: '9px 12px', color: '#15181b' }}>{c.doctor}</td>
                      <td style={{ padding: '9px 12px', color: '#334155' }}>
                        <span style={{ display: 'inline-block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.diagnoses}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px' }}>
                        {c.eta}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#52585e', fontSize: '11.5px' }}>
                        <span style={{ display: 'inline-block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.patient_condition}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                          background: currentType === 'green' ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 80)',
                          color: currentType === 'green' ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.13 70)'
                        }}>
                          {currentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedCase(c)}
                          style={{
                            height: '24px', padding: '0 8px', borderRadius: '4px',
                            border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                            color: 'oklch(0.4 0.1 200)', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                          }}
                        >
                          View Summary
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Kanban Mode */}
      {viewMode === 'kanban' && (
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
          {['Pending Review', 'Approved'].map((col) => {
            const colCases = filtered.filter(c => {
              if (col === 'Approved') return c.approval_status === 'Approved' || simState[c.id] === 'approved';
              return c.approval_status !== 'Approved' && simState[c.id] !== 'approved';
            });
            return (
              <div key={col} style={{ flex: '0 0 300px', background: '#f3f4f5', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    <div style={{ fontWeight: 600, fontSize: '12px' }}>{c.patient}</div>
                    <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '2px' }}>{c.doctor}</div>
                    <div style={{ color: '#0f172a', fontSize: '11px', marginTop: '4px', fontWeight: 500 }}>{c.diagnoses}</div>
                    <div style={{ color: '#8a9096', fontSize: '10.5px', marginTop: '4px' }}>Discharged: {c.eta}</div>
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

            {/* Clinical Discharge Summary Details */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b', fontWeight: 600 }}>
                Clinical Discharge Summary (Llama 3.3 70B AI Draft)
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Diagnosis:</div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{selectedCase.diagnoses}</div>
              </div>
              {selectedCase.case_history && (
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Case History:</div>
                  <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4 }}>{selectedCase.case_history}</div>
                </div>
              )}
              {selectedCase.investigations && (
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Investigations & Labs:</div>
                  <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4 }}>{selectedCase.investigations}</div>
                </div>
              )}
              {selectedCase.treatment && (
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Treatment & Procedures:</div>
                  <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4 }}>{selectedCase.treatment}</div>
                </div>
              )}
              {selectedCase.discharge_advice && (
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Discharge Advice:</div>
                  <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4 }}>{selectedCase.discharge_advice}</div>
                </div>
              )}
              {selectedCase.patient_condition && (
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Condition at Discharge:</div>
                  <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4, fontWeight: 500 }}>{selectedCase.patient_condition}</div>
                </div>
              )}
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
