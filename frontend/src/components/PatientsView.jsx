import React, { useState, useEffect, useMemo } from 'react';
import { apiService, parseAdmissionLlmRecord, parseDischargeSummaryRecord } from '../services/api';

export default function PatientsView({ onSelectPatient, onOpenSoap, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [admittedList, setAdmittedList] = useState([]);
  const [dischargedList, setDischargedList] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Admitted' | 'Discharged'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  useEffect(() => {
    let isMounted = true;
    async function loadPatientsData() {
      setLoading(true);
      setError(null);
      try {
        const [admRes, disRes, bedsRes, wardsRes] = await Promise.all([
          apiService.getCurrentAdmissions().catch(() => ({ data: [] })),
          apiService.getDischargedPatients().catch(() => ({ data: [] })),
          apiService.getBeds().catch(() => ({ data: [] })),
          apiService.getWards().catch(() => ({ data: [] }))
        ]);

        if (!isMounted) return;

        const bedMap = {};
        (bedsRes?.data || []).forEach(b => {
          if (b.patient_id) bedMap[String(b.patient_id)] = b;
        });

        const wardMap = {};
        (wardsRes?.data || []).forEach(w => {
          if (w.ward_id) wardMap[w.ward_id] = w.ward_name;
        });

        // Parse Admitted
        const parsedAdmitted = (admRes?.data || []).map(r => {
          const p = parseAdmissionLlmRecord(r);
          const matchedBed = bedMap[String(p.patient_id)];
          if (matchedBed) {
            p.bed = matchedBed.bed_number || p.bed;
            if (matchedBed.ward_id && wardMap[matchedBed.ward_id]) {
              p.ward = wardMap[matchedBed.ward_id];
            }
          }
          return {
            ...p,
            patientType: 'Admitted',
            typeBadgeColor: 'oklch(0.95 0.04 150)',
            typeTextColor: 'oklch(0.4 0.12 150)'
          };
        });

        // Parse Discharged
        const parsedDischarged = (disRes?.data || []).map(r => {
          const d = parseDischargeSummaryRecord(r);
          return {
            ...d,
            name: d.patient,
            patientType: 'Discharged',
            typeBadgeColor: '#f2f3f4',
            typeTextColor: '#52585e'
          };
        });

        setAdmittedList(parsedAdmitted);
        setDischargedList(parsedDischarged);
      } catch (err) {
        console.error("Failed to load patient management data:", err);
        if (isMounted) setError(err.message || 'Failed to fetch patient records');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPatientsData();
    return () => { isMounted = false; };
  }, []);

  // Combine and filter patients
  const allPatients = useMemo(() => {
    let combined = [];
    if (statusFilter === 'All') {
      combined = [...admittedList, ...dischargedList];
    } else if (statusFilter === 'Admitted') {
      combined = [...admittedList];
    } else if (statusFilter === 'Discharged') {
      combined = [...dischargedList];
    }

    if (!search.trim()) return combined;

    const s = search.toLowerCase();
    return combined.filter(p => {
      return (p.name && p.name.toLowerCase().includes(s)) ||
             (p.mrn && p.mrn.toLowerCase().includes(s)) ||
             (p.doctor && p.doctor.toLowerCase().includes(s)) ||
             (p.diagnosis && p.diagnosis.toLowerCase().includes(s)) ||
             (p.diagnoses && p.diagnoses.toLowerCase().includes(s)) ||
             (p.bed && p.bed.toLowerCase().includes(s)) ||
             (p.ward && p.ward.toLowerCase().includes(s));
    });
  }, [admittedList, dischargedList, statusFilter, search]);

  const handleExportCsv = () => {
    if (allPatients.length === 0) return alert('No patient records to export');
    const headers = ['MRN / ID', 'Patient Name', 'Status', 'Age', 'Sex', 'Ward', 'Bed', 'Attending Physician', 'Primary Diagnosis', 'Admission Date'];
    const rows = [headers.join(',')];
    allPatients.forEach(p => {
      rows.push([
        `"${p.mrn || p.id || ''}"`,
        `"${p.name || p.patient || ''}"`,
        `"${p.patientType || ''}"`,
        `"${p.age || ''}"`,
        `"${p.sex || ''}"`,
        `"${p.ward || ''}"`,
        `"${p.bed || ''}"`,
        `"${p.doctor || ''}"`,
        `"${(p.diagnosis || p.diagnoses || '').replace(/"/g, '""')}"`,
        `"${p.admission_date || p.admitted || ''}"`
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `patients_registry_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Front Office & Patients</span> › <span>Patient Registry</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>
            Patients Management & Live Directory
          </div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            Comprehensive patient records across all active admissions and discharge history
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              height: '32px', padding: '0 12px', borderRadius: '6px',
              border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '12px',
              fontWeight: 500, color: '#15181b'
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#991b1b', fontSize: '12px' }}>
          <strong>Unable to load records:</strong> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Total Registry Patients</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#15181b', marginTop: '2px' }}>
            {loading ? '—' : admittedList.length + dischargedList.length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Currently Admitted</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.4 0.12 150)', marginTop: '2px' }}>
            {loading ? '—' : admittedList.length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Discharged Cases</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.1 200)', marginTop: '2px' }}>
            {loading ? '—' : dischargedList.length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>High EWS Alerts</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.18 25)', marginTop: '2px' }}>
            {loading ? '—' : admittedList.filter(p => p.ewsType === 'red').length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {['All', 'Admitted', 'Discharged'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              style={{
                height: '28px', padding: '0 12px', borderRadius: '6px',
                border: statusFilter === f ? '1px solid oklch(0.5 0.1 200)' : '1px solid #e3e6e8',
                background: statusFilter === f ? 'oklch(0.95 0.03 200)' : '#fff',
                color: statusFilter === f ? 'oklch(0.4 0.1 200)' : '#52585e',
                fontWeight: statusFilter === f ? 600 : 400,
                fontSize: '11.5px', cursor: 'pointer'
              }}
            >
              {f} ({f === 'All' ? admittedList.length + dischargedList.length : f === 'Admitted' ? admittedList.length : dischargedList.length})
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patient name, MRN, bed, doctor..."
            style={{
              height: '30px', width: '280px', border: '1px solid #e3e6e8',
              borderRadius: '6px', padding: '0 10px', background: '#fff', fontSize: '12px', outline: 'none'
            }}
          />
          <div style={{ display: 'flex', border: '1px solid #e3e6e8', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                height: '28px', padding: '0 10px', border: 0,
                background: viewMode === 'table' ? '#15181b' : '#fff',
                color: viewMode === 'table' ? '#fff' : '#15181b',
                fontWeight: 600, fontSize: '11px', cursor: 'pointer'
              }}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              style={{
                height: '28px', padding: '0 10px', border: 0, borderLeft: '1px solid #e3e6e8',
                background: viewMode === 'cards' ? '#15181b' : '#fff',
                color: viewMode === 'cards' ? '#fff' : '#15181b',
                fontWeight: 600, fontSize: '11px', cursor: 'pointer'
              }}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Patient Table View */}
      {viewMode === 'table' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Loading Live Patients Directory...</div>
              <div style={{ fontSize: '12px' }}>Fetching live patient records from clinical data system…</div>
            </div>
          ) : allPatients.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No Patients Found</div>
              <div style={{ fontSize: '12px' }}>{search ? `No records matching "${search}"` : 'Zero patient records available.'}</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  <th style={{ padding: '9px 12px', minWidth: '180px' }}>Patient Name & MRN</th>
                  <th style={{ padding: '9px 12px', width: '110px' }}>Status</th>
                  <th style={{ padding: '9px 12px', minWidth: '140px' }}>Ward & Bed</th>
                  <th style={{ padding: '9px 12px', minWidth: '160px' }}>Attending Physician</th>
                  <th style={{ padding: '9px 12px', minWidth: '220px' }}>Primary Diagnosis</th>
                  <th style={{ padding: '9px 12px', width: '110px' }}>Admission Date</th>
                  <th style={{ padding: '9px 12px', width: '130px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPatients.map((p, idx) => (
                  <tr
                    key={p.id || idx}
                    onClick={() => onSelectPatient && onSelectPatient(p)}
                    style={{ borderBottom: '1px solid #f2f3f4', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#15181b', fontSize: '12.5px' }}>{p.name}</div>
                      <div style={{ fontSize: '10.5px', color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                        {p.mrn || `PAT-${p.patient_id || p.id}`} · {p.age} Y / {p.sex}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        background: p.typeBadgeColor, color: p.typeTextColor
                      }}>
                        {p.patientType}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 500, color: '#15181b' }}>{p.bed || '—'}</div>
                      <div style={{ fontSize: '11px', color: '#8a9096' }}>{p.ward || 'General Care'}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#15181b', fontWeight: 500 }}>
                      {p.doctor || 'Attending Physician'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#334155' }}>
                      <span style={{ display: 'inline-block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.diagnosis || p.diagnoses || 'Observation'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#52585e' }}>
                      {p.admitted || p.admission_date ? new Date(p.admission_date || p.admitted).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                    </td>
                    <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => onSelectPatient && onSelectPatient(p)}
                          style={{
                            height: '24px', padding: '0 8px', borderRadius: '4px',
                            border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                            color: 'oklch(0.4 0.1 200)', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                          }}
                        >
                          Dossier 360
                        </button>
                        {p.patientType === 'Admitted' && (
                          <button
                            type="button"
                            onClick={() => onOpenSoap && onOpenSoap(p)}
                            style={{
                              height: '24px', padding: '0 6px', borderRadius: '4px',
                              border: '1px solid #e3e6e8', background: '#fff',
                              color: '#52585e', cursor: 'pointer', fontSize: '11px'
                            }}
                          >
                            SOAP
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Patient Cards View */}
      {viewMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
          {allPatients.map((p, idx) => (
            <div
              key={p.id || idx}
              onClick={() => onSelectPatient && onSelectPatient(p)}
              style={{
                background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px',
                padding: '16px', cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'oklch(0.5 0.1 200)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e3e6e8'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#15181b' }}>{p.name}</div>
                  <div style={{ fontSize: '11px', color: '#8a9096', fontFamily: 'monospace', marginTop: '2px' }}>
                    {p.mrn || `PAT-${p.patient_id}`} · {p.age} Yrs / {p.sex}
                  </div>
                </div>
                <span style={{
                  padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                  background: p.typeBadgeColor, color: p.typeTextColor
                }}>
                  {p.patientType}
                </span>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Ward & Bed:</span>
                  <span style={{ fontWeight: 600 }}>{p.ward} · {p.bed}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Attending Physician:</span>
                  <span style={{ fontWeight: 500 }}>{p.doctor}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Diagnosis:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a', maxWidth: '180px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.diagnosis || p.diagnoses || 'Observation'}
                  </span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #eef0f1', marginTop: '12px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#8a9096' }}>
                  {p.admitted || 'Recent Stay'}
                </span>
                <span style={{ fontSize: '11.5px', color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}>
                  View Full Dossier →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
