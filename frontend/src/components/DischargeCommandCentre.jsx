import React, { useState, useEffect } from 'react';
import { apiService, parseDischargeSummaryRecord } from '../services/api';

export default function DischargeCommandCentre({ onSelectPatient, onOpenSoap, onNavigate }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [simState, setSimState] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [liveCases, setLiveCases] = useState([]);

  // Discharge Summary Edit State
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState(null);
  const [editForm, setEditForm] = useState({
    approval_status: 'Approved',
    approved_by: '',
    discharge_diagnosis: '',
    hospital_course_summary: '',
    discharge_medications: '',
    followup_instructions: '',
    patient_condition: ''
  });

  const handleOpenCase = (c) => {
    setSelectedCase(c);
    setIsEditingSummary(false);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
    setEditForm({
      approval_status: c.approval_status || 'Pending Approval',
      approved_by: c.doctor || c.attending_physician || 'Dr. Meenakshi Nair, MBBS, MD (General Physician)',
      discharge_diagnosis: c.diagnoses || c.discharge_diagnosis || '',
      hospital_course_summary: c.case_history || c.hospital_course_summary || '',
      discharge_medications: c.treatment || c.discharge_medications || '',
      followup_instructions: c.discharge_advice || c.followup_instructions || '',
      patient_condition: c.patient_condition || 'Clinically stable at discharge'
    });
  };

  const handleSaveDischargeSummary = async (overrideStatus = null) => {
    if (!selectedCase) return;
    setSavingSummary(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);

    const summaryId = selectedCase.summary_id || (selectedCase.patient_id ? `DS-${selectedCase.patient_id}` : selectedCase.id);
    const targetStatus = overrideStatus || editForm.approval_status || 'Approved';
    const payload = {
      ...editForm,
      approval_status: targetStatus
    };

    try {
      const res = await apiService.updateDischargeSummary(summaryId, payload);
      setSaveSuccessMsg(`✓ Summary ${summaryId} updated successfully (Status: ${targetStatus})`);
      setIsEditingSummary(false);

      // Update selected case in UI
      const updatedCase = {
        ...selectedCase,
        approval_status: targetStatus,
        doctor: payload.approved_by || selectedCase.doctor,
        diagnoses: payload.discharge_diagnosis || selectedCase.diagnoses,
        case_history: payload.hospital_course_summary || selectedCase.case_history,
        treatment: payload.discharge_medications || selectedCase.treatment,
        discharge_advice: payload.followup_instructions || selectedCase.discharge_advice,
        patient_condition: payload.patient_condition || selectedCase.patient_condition
      };
      setSelectedCase(updatedCase);

      // Update in liveCases
      setLiveCases(prev => prev.map(item => (
        item.id === selectedCase.id ||
        item.summary_id === selectedCase.summary_id ||
        String(item.patient_id) === String(selectedCase.patient_id)
      ) ? { ...item, ...updatedCase } : item));
    } catch (err) {
      setSaveErrorMsg(err.message || 'Failed to update discharge summary via API');
    } finally {
      setSavingSummary(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadDischargeCandidates(isSilent = false) {
      if (!isSilent && liveCases.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        // Fetch real discharged patients from Gold generated-discharge-summaries API
        const res = await apiService.getDischargedPatients({}, { forceRefresh: true });
        const list = res?.data || [];
        if (!isMounted) return;

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
        if (isMounted) setError(err.message || 'Failed to connect to Generated Discharge Summaries API');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDischargeCandidates();

    // Auto-refresh periodically to pick up newly inserted DB records immediately
    const timer = setInterval(() => {
      loadDischargeCandidates(true);
    }, 6000);

    const handleUpdate = () => loadDischargeCandidates(true);
    window.addEventListener('hc_api_updated', handleUpdate);

    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
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
          {liveCases.length} active discharge cases · dependency graph, predicted ready time and critical path by Discharge Orchestration Agent v3.0.2
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
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.1 200)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : liveCases.length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Approved Summaries</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.4 0.12 150)' }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.4 0.12 150)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : liveCases.filter(c => c.approval_status === 'Approved').length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '100px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Pending Sign-Off</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.13 70)' }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.18 25)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : liveCases.filter(c => c.approval_status !== 'Approved').length}
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
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('discharge-agent')}
              style={{
                height: '30px', padding: '0 12px', borderRadius: '6px',
                border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <span>⚡ Discharge Agent (AG-19)</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Mode */}
      {viewMode === 'table' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
          {loading && liveCases.length === 0 ? (
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
                      onClick={() => handleOpenCase(c)}
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
                          onClick={() => handleOpenCase(c)}
                          style={{
                            height: '24px', padding: '0 8px', borderRadius: '4px',
                            border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                            color: 'oklch(0.4 0.1 200)', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                          }}
                        >
                          View / Edit
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
                    onClick={() => handleOpenCase(c)}
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

      {/* Case Details Drawer / Modal with Dynamic Editing & Approval */}
      {selectedCase && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', justifyContent: 'flex-end', zIndex: 100
        }}>
          <div style={{
            width: 'min(620px, 100%)', height: '100%', background: '#fff',
            display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '24px', gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700 }}>{selectedCase.patient}</span>
                  <span style={{
                    fontSize: '10.5px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700,
                    background: selectedCase.approval_status === 'Approved' ? 'oklch(0.92 0.05 150)' : 'oklch(0.95 0.06 70)',
                    color: selectedCase.approval_status === 'Approved' ? 'oklch(0.35 0.14 150)' : 'oklch(0.45 0.15 60)'
                  }}>
                    {selectedCase.approval_status || 'Pending Approval'}
                  </span>
                </div>
                <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
                  ID: <code style={{ fontFamily: 'monospace' }}>{selectedCase.summary_id || selectedCase.patient_id}</code> · Bed {selectedCase.bed} · {selectedCase.doctor}
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

            {/* Save feedback banners */}
            {saveSuccessMsg && (
              <div style={{ background: 'oklch(0.96 0.04 150)', border: '1px solid oklch(0.7 0.1 150)', borderRadius: '6px', padding: '8px 12px', color: 'oklch(0.3 0.14 150)', fontSize: '12px', fontWeight: 600 }}>
                {saveSuccessMsg}
              </div>
            )}
            {saveErrorMsg && (
              <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '6px', padding: '8px 12px', color: '#c53030', fontSize: '12px', fontWeight: 600 }}>
                <strong>Error:</strong> {saveErrorMsg}
              </div>
            )}

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
                <div style={{ color: '#8a9096' }}>Attending Doctor</div>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCase.doctor}</div>
              </div>
              <div>
                <div style={{ color: '#8a9096' }}>Approval Status</div>
                <div style={{ fontFamily: 'sans-serif', fontSize: '12.5px', fontWeight: 700, color: selectedCase.approval_status === 'Approved' ? 'oklch(0.4 0.14 150)' : 'oklch(0.5 0.15 60)' }}>
                  {selectedCase.approval_status || 'Pending'}
                </div>
              </div>
            </div>

            {/* Clinical Discharge Summary Card with Toggleable Edit Form */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                    Clinical Discharge Summary
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', fontFamily: 'monospace' }}>
                    /api/v1/discharge-summary-llm/update/{selectedCase.summary_id || selectedCase.patient_id}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {!isEditingSummary ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditingSummary(true)}
                        style={{
                          height: '28px', padding: '0 10px', borderRadius: '5px',
                          border: '1px solid #cbd5e1', background: '#f8fafc',
                          color: '#334155', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <span>✏️</span> Edit Summary
                      </button>
                      {selectedCase.approval_status !== 'Approved' && (
                        <button
                          type="button"
                          onClick={() => handleSaveDischargeSummary('Approved')}
                          disabled={savingSummary}
                          style={{
                            height: '28px', padding: '0 12px', borderRadius: '5px',
                            border: 0, background: 'oklch(0.5 0.14 150)',
                            color: '#fff', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          {savingSummary ? 'Saving...' : '✓ Approve & Sign-Off'}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditingSummary(false)}
                        disabled={savingSummary}
                        style={{
                          height: '28px', padding: '0 10px', borderRadius: '5px',
                          border: '1px solid #cbd5e1', background: '#fff',
                          color: '#64748b', fontSize: '11.5px', cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveDischargeSummary()}
                        disabled={savingSummary}
                        style={{
                          height: '28px', padding: '0 14px', borderRadius: '5px',
                          border: 0, background: 'oklch(0.5 0.1 200)',
                          color: '#fff', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        {savingSummary ? 'Saving to Gold...' : '💾 Save Changes'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* VIEW MODE */}
              {!isEditingSummary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Diagnosis:</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{selectedCase.diagnoses}</div>
                  </div>
                  {selectedCase.case_history && (
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Hospital Course / Case History:</div>
                      <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4 }}>{selectedCase.case_history}</div>
                    </div>
                  )}
                  {selectedCase.treatment && (
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Treatment & Discharge Medications:</div>
                      <pre style={{ fontSize: '11px', color: '#334155', background: '#f8fafc', padding: '8px', borderRadius: '4px', margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {selectedCase.treatment}
                      </pre>
                    </div>
                  )}
                  {selectedCase.discharge_advice && (
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Discharge Advice & Follow-Up Plan:</div>
                      <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4, background: '#f8fafc', padding: '8px', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
                        {selectedCase.discharge_advice}
                      </div>
                    </div>
                  )}
                  {selectedCase.patient_condition && (
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Condition at Discharge:</div>
                      <div style={{ fontSize: '11.5px', color: '#334155', fontWeight: 500 }}>{selectedCase.patient_condition}</div>
                    </div>
                  )}
                </div>
              )}

              {/* EDIT MODE (Doctor Interactive Form) */}
              {isEditingSummary && (
                <form onSubmit={(e) => { e.preventDefault(); handleSaveDischargeSummary(); }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {/* Approval Status & Doctor Name Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                        Approval Status:
                      </label>
                      <select
                        value={editForm.approval_status}
                        onChange={(e) => setEditForm(prev => ({ ...prev, approval_status: e.target.value }))}
                        style={{
                          width: '100%', height: '32px', padding: '0 8px', borderRadius: '5px',
                          border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#fff'
                        }}
                      >
                        <option value="Approved">Approved</option>
                        <option value="Pending Approval">Pending Approval</option>
                        <option value="Under Revision">Under Revision</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                        Attending Physician / Signee:
                      </label>
                      <input
                        type="text"
                        value={editForm.approved_by}
                        onChange={(e) => setEditForm(prev => ({ ...prev, approved_by: e.target.value }))}
                        style={{
                          width: '100%', height: '32px', padding: '0 8px', borderRadius: '5px',
                          border: '1px solid #cbd5e1', fontSize: '11.5px'
                        }}
                      />
                    </div>
                  </div>

                  {/* Discharge Diagnosis */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Discharge Diagnosis:
                    </label>
                    <input
                      type="text"
                      value={editForm.discharge_diagnosis}
                      onChange={(e) => setEditForm(prev => ({ ...prev, discharge_diagnosis: e.target.value }))}
                      style={{
                        width: '100%', height: '32px', padding: '0 8px', borderRadius: '5px',
                        border: '1px solid #cbd5e1', fontSize: '11.5px'
                      }}
                    />
                  </div>

                  {/* Hospital Course Summary */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Hospital Course / Clinical Case History:
                    </label>
                    <textarea
                      rows={3}
                      value={editForm.hospital_course_summary}
                      onChange={(e) => setEditForm(prev => ({ ...prev, hospital_course_summary: e.target.value }))}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: '5px',
                        border: '1px solid #cbd5e1', fontSize: '11.5px', fontFamily: 'inherit', lineHeight: 1.4
                      }}
                    />
                  </div>

                  {/* Discharge Medications */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Discharge Medications (Dosage & Frequency):
                    </label>
                    <textarea
                      rows={4}
                      value={editForm.discharge_medications}
                      onChange={(e) => setEditForm(prev => ({ ...prev, discharge_medications: e.target.value }))}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: '5px',
                        border: '1px solid #cbd5e1', fontSize: '11px', fontFamily: 'monospace', lineHeight: 1.4
                      }}
                    />
                  </div>

                  {/* Follow-up Instructions */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Follow-up Advice & Patient Care Instructions:
                    </label>
                    <textarea
                      rows={3}
                      value={editForm.followup_instructions}
                      onChange={(e) => setEditForm(prev => ({ ...prev, followup_instructions: e.target.value }))}
                      style={{
                        width: '100%', padding: '6px 8px', borderRadius: '5px',
                        border: '1px solid #cbd5e1', fontSize: '11.5px', fontFamily: 'inherit', lineHeight: 1.4
                      }}
                    />
                  </div>

                  {/* Condition at Discharge */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                      Patient Condition at Discharge:
                    </label>
                    <input
                      type="text"
                      value={editForm.patient_condition}
                      onChange={(e) => setEditForm(prev => ({ ...prev, patient_condition: e.target.value }))}
                      style={{
                        width: '100%', height: '32px', padding: '0 8px', borderRadius: '5px',
                        border: '1px solid #cbd5e1', fontSize: '11.5px'
                      }}
                    />
                  </div>

                  {/* Save Button inside form */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setIsEditingSummary(false)}
                      disabled={savingSummary}
                      style={{
                        height: '32px', padding: '0 12px', borderRadius: '5px',
                        border: '1px solid #cbd5e1', background: '#fff', fontSize: '11.5px', cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingSummary}
                      style={{
                        height: '32px', padding: '0 16px', borderRadius: '5px', border: 0,
                        background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '12px',
                        fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      {savingSummary ? '⏳ Saving...' : '💾 Save to Lakehouse Gold Table'}
                    </button>
                  </div>

                </form>
              )}
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
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
