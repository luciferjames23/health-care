import React, { useState, useEffect, useMemo } from 'react';
import { apiService, parseAdmissionLlmRecord, extractDischargedPatientIds, matchesDoctor } from '../services/api';
import ModuleLoadingScreen, { TableSkeleton } from './ModuleLoadingScreen';

export default function AdmissionsView({
  onSelectPatient,
  onOpenSoap,
  onNavigate,
  doctorName = null,
  userRole = 'Hospital Management'
}) {
  const isDoctor = userRole === 'Doctor' || (doctorName && userRole !== 'Hospital Management' && userRole !== 'Admin');
  const activeDoctorName = isDoctor ? doctorName : null;

  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedWard, setSelectedWard] = useState('All');
  const [wardOptions, setWardOptions] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadAdmissionsData(isSilent = false) {
      if (!isSilent && admissions.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        const [admRes, bedsRes, wardsRes, dcRes] = await Promise.all([
          apiService.getCurrentAdmissions({}, { forceRefresh: true }).catch(() => ({ data: [] })),
          apiService.getBeds({}, { forceRefresh: true }).catch(() => ({ data: [] })),
          apiService.getWards({}, { forceRefresh: true }).catch(() => ({ data: [] })),
          apiService.getDischargedPatients({}, { forceRefresh: true }).catch(() => ({ data: [] }))
        ]);

        if (!isMounted) return;

        // Discharge API is the source of truth for discharged patients
        const dischargedTracker = extractDischargedPatientIds(dcRes?.data || []);

        const bedMap = {};
        (bedsRes?.data || []).forEach(b => {
          if (b.patient_id) bedMap[String(b.patient_id)] = b;
        });

        const wardMap = {};
        const wList = [];
        (wardsRes?.data || []).forEach(w => {
          if (w.ward_id) {
            wardMap[w.ward_id] = w.ward_name;
            wList.push(w.ward_name);
          }
        });
        setWardOptions([...new Set(wList)]);

        // Filter out any patient who is in the discharge API
        const rawAdmissions = admRes?.data || [];
        const actualAdmittedRaw = rawAdmissions.filter(r => !dischargedTracker.has(r));

        const list = actualAdmittedRaw.map(r => {
          const p = parseAdmissionLlmRecord(r);
          const matchedBed = bedMap[String(p.patient_id)];
          if (matchedBed) {
            p.bed = matchedBed.bed_number || p.bed;
            if (matchedBed.ward_id && wardMap[matchedBed.ward_id]) {
              p.ward = wardMap[matchedBed.ward_id];
            }
          }
          return p;
        });

        setAdmissions(list);
      } catch (err) {
        console.error("Failed to load admissions data:", err);
        if (isMounted) setError(err.message || 'Failed to fetch admissions');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAdmissionsData();

    const timer = setInterval(() => {
      loadAdmissionsData(true);
    }, 6000);

    const handleUpdate = () => loadAdmissionsData(true);
    window.addEventListener('hc_api_updated', handleUpdate);

    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedType, selectedWard, pageSize]);

  const scopedAdmissions = useMemo(() => {
    if (!activeDoctorName) return admissions;
    return admissions.filter(item =>
      matchesDoctor(item.doctor || item.attending_doctor || item.doctor_name, activeDoctorName)
    );
  }, [admissions, activeDoctorName]);

  // Dynamic list of available admission types from DB records
  const typeOptions = useMemo(() => {
    const types = new Set(scopedAdmissions.map(a => a.admission_type).filter(Boolean));
    return ['All', ...Array.from(types)];
  }, [scopedAdmissions]);

  const filteredAdmissions = useMemo(() => {
    return scopedAdmissions.filter(item => {
      // Type filter
      if (selectedType !== 'All' && item.admission_type !== selectedType) {
        return false;
      }
      // Ward filter
      if (selectedWard !== 'All' && item.ward !== selectedWard) {
        return false;
      }
      // Search
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (item.name && item.name.toLowerCase().includes(s)) ||
             (item.mrn && item.mrn.toLowerCase().includes(s)) ||
             (item.admission_number && item.admission_number.toLowerCase().includes(s)) ||
             (item.admission_type && item.admission_type.toLowerCase().includes(s)) ||
             (item.admission_source && item.admission_source.toLowerCase().includes(s)) ||
             (item.doctor && item.doctor.toLowerCase().includes(s)) ||
             (item.reason_for_admission && item.reason_for_admission.toLowerCase().includes(s)) ||
             (item.diagnosis && item.diagnosis.toLowerCase().includes(s)) ||
             (item.bed && item.bed.toLowerCase().includes(s)) ||
             (item.ward && item.ward.toLowerCase().includes(s));
    });
  }, [scopedAdmissions, selectedType, selectedWard, search]);

  // KPIs dynamically derived from DB
  const totalAdmissions = scopedAdmissions.length;
  const emergencyCount = scopedAdmissions.filter(a => a.admission_type === 'Emergency' || a.admission_source?.includes('Emergency') || a.admission_source?.includes('ER')).length;
  const electiveCount = scopedAdmissions.filter(a => a.admission_type === 'Elective').length;
  const referralCount = scopedAdmissions.filter(a => a.admission_type === 'Referral').length;
  const highEwsCount = scopedAdmissions.filter(a => a.ewsType === 'red').length;

  // Pagination calculations
  const totalRows = filteredAdmissions.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedAdmissions = useMemo(() => {
    return filteredAdmissions.slice(startIndex, startIndex + pageSize);
  }, [filteredAdmissions, startIndex, pageSize]);

  const handleExportCsv = () => {
    if (scopedAdmissions.length === 0) return alert('No admission records to export');
    const headers = ['Admission ID / MRN', 'Patient Name', 'Admission Date', 'Admission Type', 'Source', 'Ward', 'Bed', 'Attending Doctor', 'Specialization', 'Reason for Admission', 'EWS Score'];
    const rows = [headers.join(',')];
    scopedAdmissions.forEach(a => {
      rows.push([
        `"${a.mrn || a.admission_number || ''}"`,
        `"${a.name || ''}"`,
        `"${a.admission_date || ''}"`,
        `"${a.admission_type || ''}"`,
        `"${a.admission_source || ''}"`,
        `"${a.ward || ''}"`,
        `"${a.bed || ''}"`,
        `"${a.doctor || ''}"`,
        `"${a.doctor_specialty || ''}"`,
        `"${(a.reason_for_admission || a.diagnosis || '').replace(/"/g, '""')}"`,
        `"${a.ews || ''}"`
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admissions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getAdmissionTypeBadge = (type) => {
    switch (type) {
      case 'Emergency':
        return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' };
      case 'Elective':
        return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
      case 'Referral':
        return { bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff' };
      case 'Urgent':
        return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' };
      default:
        return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
  };

  if (loading && admissions.length === 0) {
    return (
      <ModuleLoadingScreen
        title={isDoctor && activeDoctorName ? `Loading Doctor Admissions · ${activeDoctorName}...` : "Loading Inpatient Admissions & Bed Allocation..."}
        subtitle="Retrieving real-time admission streams, bed allocations, attending consultants, and telemetry monitoring..."
        badgeText="Live Clinical Sync"
        showKpis={true}
        statCount={5}
        layout="table"
        tableRows={7}
        tableColumns={8}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Front Office & Patients</span> › <span>{isDoctor ? 'Doctor Admissions' : 'Inpatient Admissions'}</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>
            {isDoctor && activeDoctorName
              ? `Inpatient Admissions · ${activeDoctorName}`
              : 'Inpatient Admissions & Bed Allocation'}
          </div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            {isDoctor && activeDoctorName
              ? `Doctor Scope: ${activeDoctorName} · Showing ${scopedAdmissions.length} active inpatient admissions under your clinical care`
              : 'Active patient admission streams, attending clinical consultant allocation, and telemetry monitoring'}
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
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px', flex: '1 1 130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Active Inpatient Admissions</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#15181b', marginTop: '2px' }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.1 200)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : totalAdmissions}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px', flex: '1 1 130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Emergency Intakes</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#dc2626', marginTop: '2px' }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid #dc2626',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : emergencyCount}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px', flex: '1 1 130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Elective / Planned</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#0284c7', marginTop: '2px' }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid #0284c7',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : electiveCount}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px', flex: '1 1 130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Referral Admissions</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#7c3aed', marginTop: '2px' }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid #7c3aed',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : referralCount}
          </div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px', flex: '1 1 130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>High EWS Critical Care</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.18 25)', marginTop: '2px' }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.18 25)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : highEwsCount}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Admission Type Dropdown */}
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            style={{
              height: '30px', padding: '0 8px', borderRadius: '6px', border: '1px solid #e3e6e8',
              background: '#fff', fontSize: '12px', color: '#15181b', outline: 'none', cursor: 'pointer'
            }}
          >
            {typeOptions.map(t => (
              <option key={t} value={t}>{t === 'All' ? 'All Admission Types' : t}</option>
            ))}
          </select>

          {/* Ward Dropdown */}
          <select
            value={selectedWard}
            onChange={e => setSelectedWard(e.target.value)}
            style={{
              height: '30px', padding: '0 8px', borderRadius: '6px', border: '1px solid #e3e6e8',
              background: '#fff', fontSize: '12px', color: '#15181b', outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="All">All Wards {wardOptions.length > 0 ? `(${wardOptions.length} Wards)` : ''}</option>
            {wardOptions.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search patient, MRN, admission #, doctor, bed..."
          style={{
            height: '30px', width: '280px', border: '1px solid #e3e6e8',
            borderRadius: '6px', padding: '0 10px', background: '#fff', fontSize: '12px', outline: 'none'
          }}
        />
      </div>

      {/* Admissions Table */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden' }}>
        {loading && admissions.length === 0 ? (
          <div style={{ padding: '12px' }}>
            <TableSkeleton rows={7} columns={8} />
          </div>
        ) : filteredAdmissions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No Admissions Found</div>
            <div style={{ fontSize: '12px' }}>{search ? `No records matching "${search}"` : 'Zero active admission records.'}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  <th style={{ padding: '9px 12px', minWidth: '180px' }}>Patient Name & MRN</th>
                  <th style={{ padding: '9px 12px', width: '120px' }}>Admission No.</th>
                  <th style={{ padding: '9px 12px', minWidth: '140px' }}>Type & Source</th>
                  <th style={{ padding: '9px 12px', minWidth: '140px' }}>Ward & Bed</th>
                  <th style={{ padding: '9px 12px', minWidth: '170px' }}>Attending Physician</th>
                  <th style={{ padding: '9px 12px', minWidth: '220px' }}>Reason for Admission</th>
                  <th style={{ padding: '9px 12px', width: '110px' }}>Telemetry / EWS</th>
                  <th style={{ padding: '9px 12px', width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAdmissions.map((a, idx) => {
                  const badge = getAdmissionTypeBadge(a.admission_type);
                  return (
                    <tr
                      key={a.id || idx}
                      onClick={() => onSelectPatient && onSelectPatient(a)}
                      style={{ borderBottom: '1px solid #f2f3f4', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#15181b', fontSize: '12.5px' }}>{a.name}</div>
                        <div style={{ fontSize: '10.5px', color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                          {a.age} Yrs / {a.sex} · Blood: {a.bloodGroup}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px', fontWeight: 600, color: 'oklch(0.5 0.1 200)' }}>
                        {a.mrn || `ADM-${a.admission_id}`}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ marginBottom: '3px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`
                          }}>
                            {a.admission_type || 'Inpatient'}
                          </span>
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>{a.admission_source || 'Referral'}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#15181b' }}>{a.bed}</div>
                        <div style={{ fontSize: '11px', color: '#8a9096' }}>{a.ward}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 500, color: '#15181b' }}>{a.doctor}</div>
                        <div style={{ fontSize: '10.5px', color: '#8a9096' }}>{a.doctor_specialty}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>
                        <span style={{ display: 'inline-block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.reason_for_admission || a.diagnosis}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                          background: a.ewsType === 'red' ? 'oklch(0.96 0.05 25)' : 'oklch(0.95 0.04 150)',
                          color: a.ewsType === 'red' ? 'oklch(0.5 0.18 25)' : 'oklch(0.4 0.12 150)'
                        }}>
                          {a.ews}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => onSelectPatient && onSelectPatient(a)}
                            style={{
                              height: '24px', padding: '0 8px', borderRadius: '4px',
                              border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                              color: 'oklch(0.4 0.1 200)', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                            }}
                          >
                            Dossier 360
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenSoap && onOpenSoap(a)}
                            style={{
                              height: '24px', padding: '0 6px', borderRadius: '4px',
                              border: '1px solid #e3e6e8', background: '#fff',
                              color: '#52585e', cursor: 'pointer', fontSize: '11px'
                            }}
                          >
                            SOAP
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredAdmissions.length > 0 && (
          <div style={{
            padding: '10px 14px',
            background: '#fafbfc',
            borderTop: '1px solid #eef0f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '12px',
            color: '#64748b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span>
                Showing <strong>{totalRows > 0 ? startIndex + 1 : 0}</strong>–<strong>{Math.min(startIndex + pageSize, totalRows)}</strong> of <strong>{totalRows}</strong> admissions
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '11.5px', color: '#8a9096' }}>Per page:</span>
                {[15, 25, 50, 100].map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => { setPageSize(sz); setCurrentPage(1); }}
                    style={{
                      height: '24px',
                      padding: '0 8px',
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: pageSize === sz ? '#0284c7' : '#e2e8f0',
                      background: pageSize === sz ? '#f0f9ff' : '#ffffff',
                      color: pageSize === sz ? '#0369a1' : '#64748b',
                      fontWeight: pageSize === sz ? 700 : 500,
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                title="First Page"
                style={{
                  height: '28px',
                  width: '28px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: safeCurrentPage <= 1 ? '#cbd5e1' : '#475569',
                  cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                «
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safeCurrentPage <= 1}
                title="Previous Page"
                style={{
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: safeCurrentPage <= 1 ? '#cbd5e1' : '#475569',
                  cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '11.5px',
                  fontWeight: 500
                }}
              >
                ‹ Prev
              </button>

              {/* Page Number Pills */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) {
                    acc.push('ellipsis-' + p);
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) => {
                  if (typeof item === 'string') {
                    return (
                      <span key={`el-${idx}`} style={{ padding: '0 4px', color: '#94a3b8' }}>
                        …
                      </span>
                    );
                  }
                  const isCurrent = item === safeCurrentPage;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      style={{
                        height: '28px',
                        minWidth: '28px',
                        padding: '0 6px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isCurrent ? '#0284c7' : '#e2e8f0',
                        background: isCurrent ? '#0284c7' : '#ffffff',
                        color: isCurrent ? '#ffffff' : '#475569',
                        fontWeight: isCurrent ? 700 : 500,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      {item}
                    </button>
                  );
                })}

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage >= totalPages}
                title="Next Page"
                style={{
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: safeCurrentPage >= totalPages ? '#cbd5e1' : '#475569',
                  cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '11.5px',
                  fontWeight: 500
                }}
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                title="Last Page"
                style={{
                  height: '28px',
                  width: '28px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: safeCurrentPage >= totalPages ? '#cbd5e1' : '#475569',
                  cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
