import React, { useState, useEffect, useMemo } from 'react';
import { apiService, parseAdmissionLlmRecord, extractDischargedPatientIds, matchesDoctor } from '../services/api';

export default function ClinicalWorkspaceView({
  doctorName = 'Dr. Priya Patel',
  userRole = 'Doctor',
  onSelectPatient,
  onOpenSoap,
}) {
  const [search, setSearch] = useState('');
  const [patientList, setPatientList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isDoctor = userRole === 'Doctor' || (doctorName && userRole !== 'Hospital Management' && userRole !== 'Admin');
  const activeDoctorName = isDoctor ? doctorName : null;

  useEffect(() => {
    async function loadInpatients() {
      if (patientList.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        // 1. Fetch Current Admitted Patients, Discharges, beds, and wards
        const [admRes, dcRes, bedsRes, wardsRes] = await Promise.all([
          apiService.getCurrentAdmissions().catch(() => ({ data: [] })),
          apiService.getDischargedPatients().catch(() => ({ data: [] })),
          apiService.getBeds().catch(() => ({ data: [] })),
          apiService.getWards().catch(() => ({ data: [] }))
        ]);

        // Discharge API is source of truth: filter out discharged patients
        const dischargedTracker = extractDischargedPatientIds(dcRes?.data || []);
        const rawAdmissions = admRes?.data || [];
        const actualAdmitted = rawAdmissions.filter(r => !dischargedTracker.has(r));

        const bedMap = {};
        (bedsRes?.data || []).forEach(b => {
          if (b.patient_id) bedMap[String(b.patient_id)] = b;
          if (b.bed_id) bedMap[`bed_${b.bed_id}`] = b;
        });

        const wardMap = {};
        (wardsRes?.data || []).forEach(w => {
          if (w.ward_id) wardMap[w.ward_id] = w.ward_name;
        });

        if (actualAdmitted.length > 0) {
          const mapped = actualAdmitted.map(rawRecord => {
            const p = parseAdmissionLlmRecord(rawRecord);
            // Resolve bed and ward if matched
            const matchedBed = bedMap[String(p.patient_id)];
            if (matchedBed) {
              p.bed = matchedBed.bed_number || p.bed;
              if (matchedBed.ward_id && wardMap[matchedBed.ward_id]) {
                p.ward = wardMap[matchedBed.ward_id];
              }
            }
            return p;
          });
          setPatientList(mapped);
        } else {
          setPatientList([]);
        }
      } catch (err) {
        console.error("Failed to fetch live admitted patients:", err);
        setError(err.message || 'Failed to connect to Admissions API');
      } finally {
        setLoading(false);
      }
    }
    loadInpatients();
  }, [activeDoctorName]);

  // Doctor-scoped list
  const scopedPatientList = useMemo(() => {
    if (!activeDoctorName) return patientList;
    return patientList.filter(p =>
      matchesDoctor(p.doctor || p.doctor_name || p.attending_physician, activeDoctorName)
    );
  }, [patientList, activeDoctorName]);

  const filtered = scopedPatientList.filter(p => {
    if (!search.trim()) return true;
    const s = search.toLowerCase().trim();
    const isDigits = /^\d+$/.test(s);
    if (isDigits) {
      const pid = String(p.patient_id || '');
      const patNum = String(p.patient_number || p.mrn || '').toLowerCase();
      return pid === s || patNum.endsWith(s);
    }
    return (p.name && p.name.toLowerCase().includes(s)) ||
           (p.bed && p.bed.toLowerCase().includes(s)) ||
           (p.diagnosis && p.diagnosis.toLowerCase().includes(s)) ||
           (p.mrn && p.mrn.toLowerCase().includes(s)) ||
           (p.doctor && p.doctor.toLowerCase().includes(s));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Breadcrumb & heading */}
      <div>
        <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
          <span>Clinical Workspace</span> › <span>{isDoctor ? 'My Patients' : 'All Wards'}</span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 600 }}>
          {isDoctor && activeDoctorName
            ? `Clinical workspace · patients under ${activeDoctorName}`
            : `Clinical workspace · all inpatients (${patientList.length})`}
        </div>
        <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px', maxWidth: '850px' }}>
          {isDoctor && activeDoctorName
            ? `Scope comes from the signed-in user (${activeDoctorName} · Doctor). Showing ${scopedPatientList.length} admitted patient${scopedPatientList.length === 1 ? '' : 's'} assigned to your clinical care.`
            : `Hospital-wide clinical view. Showing all ${patientList.length} admitted patients across all hospital departments.`}
        </div>
      </div>

      {/* Action controls & Search */}
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
          onClick={() => {
            if (!patientList.length) return alert('No admitted patient records to export');
            const headers = ['Bed', 'Patient Name', 'MRN', 'Age', 'Gender', 'Diagnosis', 'Attending Doctor', 'Admission Date', 'EWS'];
            const csvRows = [headers.join(',')];
            patientList.forEach(p => {
              csvRows.push([
                `"${p.bed || ''}"`,
                `"${p.name || ''}"`,
                `"${p.mrn || ''}"`,
                p.age || '',
                `"${p.gender || ''}"`,
                `"${(p.diagnosis || '').replace(/"/g, '""')}"`,
                `"${p.doctor || ''}"`,
                `"${p.admitted || ''}"`,
                `"${p.ews || ''}"`
              ].join(','));
            });
            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `admitted_patients_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          style={{
            height: '30px', padding: '0 10px', borderRadius: '6px',
            border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '12px',
            display: 'flex', alignItems: 'center', gap: '5px'
          }}
        >
          Export CSV
        </button>
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

      {/* Summary KPI stats */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 14px', minWidth: '110px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>{isDoctor ? 'My Inpatients' : 'Active Inpatients'}</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1 }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.1 200)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : scopedPatientList.length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 14px', minWidth: '110px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Attending Doctor Filter</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '16px', lineHeight: 1.6, color: '#15181b', fontWeight: 600 }}>
            {isDoctor && activeDoctorName ? (activeDoctorName.split(' ')[1] || activeDoctorName) : 'All Doctors'}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 14px', minWidth: '110px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Critical / Alert EWS</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.18 25)' }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.18 25)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : scopedPatientList.filter(p => p.ewsType === 'red' || p.ewsType === 'amber').length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 14px', minWidth: '110px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Active Prescriptions</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.1 200)' }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.1 200)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : scopedPatientList.filter(p => p.rx && p.rx !== '—').length}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 14px', minWidth: '110px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Data Sync</div>
          <div style={{ fontSize: '12px', lineHeight: 1.8, color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
            Live · Up to date
          </div>
        </div>
      </div>

      {/* Patient Table */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
        {loading && patientList.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Loading Currently Admitted Patients...</div>
            <div style={{ fontSize: '12px' }}>Fetching currently admitted patients from clinical data system…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No Admitted Patients Found</div>
            <div style={{ fontSize: '12px' }}>{search ? `No patients matching "${search}"` : 'No currently admitted patient records in the database.'}</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <th style={{ padding: '8px 12px', width: '90px' }}>Bed</th>
                <th style={{ padding: '8px 12px', minWidth: '160px' }}>Patient</th>
                <th style={{ padding: '8px 12px', width: '50px' }}>Age</th>
                <th style={{ padding: '8px 12px', minWidth: '220px' }}>Primary Diagnosis</th>
                <th style={{ padding: '8px 12px', minWidth: '140px' }}>Ward</th>
                <th style={{ padding: '8px 12px', width: '120px' }}>Orders / Tests</th>
                <th style={{ padding: '8px 12px', minWidth: '160px' }}>Active Rx</th>
                <th style={{ padding: '8px 12px', width: '80px' }}>EWS</th>
                <th style={{ padding: '8px 12px', width: '110px' }}>Status</th>
                <th style={{ padding: '8px 12px', width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  style={{ borderBottom: '1px solid #f2f3f4', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => onSelectPatient && onSelectPatient(p)}
                >
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#0f172a' }}>
                    <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {p.bed}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: '#15181b' }}>
                    <div>{p.name}</div>
                    <div style={{ fontSize: '10.5px', color: '#8a9096', fontWeight: 400 }}>{p.mrn}</div>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#52585e' }}>{p.age} {p.sex}</td>
                  <td style={{ padding: '9px 12px', color: '#15181b' }}>{p.diagnosis}</td>
                  <td style={{ padding: '9px 12px', color: '#52585e', fontSize: '11.5px' }}>{p.ward}</td>
                  <td style={{ padding: '9px 12px', color: '#15181b', fontWeight: 500 }}>{p.orders_count} · {p.latest_modality}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: '4px', fontSize: '11px',
                      background: '#f2f3f4', color: '#15181b', fontWeight: 500, display: 'inline-block', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {p.latest_med}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    {p.ewsType === 'green' && (
                      <span style={{
                        padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                        background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)'
                      }}>
                        {p.ews}
                      </span>
                    )}
                    {p.ewsType === 'amber' && (
                      <span style={{
                        padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                        background: 'oklch(0.96 0.05 80)', color: 'oklch(0.5 0.13 70)'
                      }}>
                        {p.ews}
                      </span>
                    )}
                    {p.ewsType === 'red' && (
                      <span style={{
                        padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                        background: 'oklch(0.96 0.03 25)', color: 'oklch(0.45 0.17 25)'
                      }}>
                        {p.ews}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                      background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)'
                    }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px' }} onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onOpenSoap && onOpenSoap(p)}
                      style={{
                        height: '24px', padding: '0 8px', borderRadius: '4px',
                        border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                        color: 'oklch(0.4 0.1 200)', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                      }}
                    >
                      SOAP Note
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
