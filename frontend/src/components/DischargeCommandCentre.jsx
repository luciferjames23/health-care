import React, { useState, useEffect } from 'react';
import { apiService, parseDischargeSummaryRecord } from '../services/api';
import DischargeSummaryModal from './DischargeSummaryModal';

export default function DischargeCommandCentre({ onSelectPatient, onOpenSoap, onNavigate }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [simState, setSimState] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [liveCases, setLiveCases] = useState([]);

  const handleOpenSummaryModal = (c) => {
    setSelectedCase(c);
    setIsModalOpen(true);
  };

  const handleSummaryUpdated = (updatedRecord) => {
    setSelectedCase(prev => ({ ...prev, ...updatedRecord }));
    setLiveCases(prev => prev.map(item => (
      item.id === updatedRecord.id ||
      item.summary_id === updatedRecord.summary_id ||
      String(item.patient_id) === String(updatedRecord.patient_id)
    ) ? { ...item, ...updatedRecord } : item));
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
                  <th style={{ padding: '10px 14px', minWidth: '220px' }}>PATIENT & DEMOGRAPHICS</th>
                  <th style={{ padding: '10px 14px', minWidth: '200px' }}>DIAGNOSES</th>
                  <th style={{ padding: '10px 14px', minWidth: '180px' }}>PRIMARY CONSULTANT</th>
                  <th style={{ padding: '10px 14px', width: '130px' }}>DISCHARGE DATE</th>
                  <th style={{ padding: '10px 14px', width: '140px' }}>STATUS</th>
                  <th style={{ padding: '10px 14px', width: '150px', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  return (
                    <tr
                      key={c.id || c.patient_id}
                      onClick={() => handleOpenSummaryModal(c)}
                      style={{ borderBottom: '1px solid #f2f3f4', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{c.patient}</span>
                          <span style={{
                            padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                            background: '#0284c7', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '3px'
                          }}>
                            ✓ Generated Summary
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontFamily: 'monospace' }}>
                          Patient ID: {c.patient_id} · Adm ID: {c.admission_id || c.patient_id}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', color: '#1e293b', fontWeight: 500, fontSize: '12.5px' }}>
                        {c.diagnoses}
                      </td>

                      <td style={{ padding: '12px 14px', color: '#0f172a', fontWeight: 600, fontSize: '12px' }}>
                        {c.doctor}
                      </td>

                      <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12px' }}>
                        {c.eta}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                          background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0',
                          display: 'inline-flex', alignItems: 'center', gap: '5px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                          Written / Stored
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenSummaryModal(c)}
                          style={{
                            height: '28px', padding: '0 12px', borderRadius: '6px',
                            border: '1px solid #cbd5e1', background: '#ffffff',
                            color: '#334155', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.color = '#0284c7'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#334155'; }}
                        >
                          <span>✓</span> View full summary
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
                    key={c.id || c.patient_id}
                    onClick={() => handleOpenSummaryModal(c)}
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

      {/* Full Discharge Summary Modal (View, Edit, Print) */}
      <DischargeSummaryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        summaryData={selectedCase}
        onSummaryUpdated={handleSummaryUpdated}
      />
    </div>
  );
}
