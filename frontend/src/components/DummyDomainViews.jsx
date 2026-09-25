import React, { useState, useMemo, useEffect } from 'react';
import { apiService } from '../services/api';
import ModuleLoadingScreen, { TableSkeleton } from './ModuleLoadingScreen';

// Common badge and card helpers
const cardStyle = {
  background: '#ffffff',
  border: '1px solid #e3e6e8',
  borderRadius: '8px',
  padding: '16px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
};

const pillStyle = (bg, color) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: '4px',
  fontSize: '11px',
  fontWeight: 700,
  background: bg,
  color: color,
  whiteSpace: 'nowrap'
});

function Header({ title, subtitle, count, onExport, exportLabel = 'Export CSV', onNew, newLabel = '+ New Record' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '2px', fontWeight: 600, letterSpacing: '0.04em' }}>
          HOSPITAL OPERATING PLATFORM · CLINICAL DATA ENGINE
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#15181b', letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          {count !== undefined && (
            <span style={pillStyle('#eef2f6', '#334155')}>{count} Records</span>
          )}
        </div>
        <div style={{ color: '#52585e', fontSize: '12px', marginTop: '3px' }}>
          {subtitle}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {onNew && (
          <button
            type="button"
            onClick={onNew}
            style={{
              height: '32px',
              padding: '0 14px',
              borderRadius: '6px',
              border: 'none',
              background: 'oklch(0.5 0.1 200)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
            }}
          >
            {newLabel}
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            style={{
              height: '32px',
              padding: '0 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>📥</span> {exportLabel}
          </button>
        )}
      </div>
    </div>
  );
}


function LoadingState({ label = "Loading live records...", columns = 7, rows = 7 }) {
  return (
    <div style={{ marginTop: '8px' }}>
      <ModuleLoadingScreen
        title={label.replace(/ from PostgreSQL\.\.\./g, '...')}
        subtitle="Retrieving real-time clinical and operational records..."
        badgeText="Live Sync"
        showKpis={false}
        tableRows={rows}
        tableColumns={columns}
      />
    </div>
  );
}

function EmptyState({ title = "No records found", description = "There are currently no records in this module.", onAction, actionLabel = "+ Add Record" }) {
  return (
    <div style={{ ...cardStyle, padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📋</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{title}</div>
      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', maxWidth: '380px', margin: '4px auto 14px' }}>{description}</div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color = '#0f766e', bg = '#f0fdf4' }) {
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: '160px', padding: '12px 16px' }}>
      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '4px 0 2px' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color }}>{sub}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 1. APPOINTMENTS VIEW
// -----------------------------------------------------------------------------
const INITIAL_APPOINTMENTS = [
  { id: 'APT-1001', token: 'T-01', patient: 'Kavitha Raman', uhid: 'MER-PAT-0087221', doctor: 'Dr. Arjun Menon', dept: 'Cardiology', time: '09:30 AM', room: 'OPD-102', status: 'In Consultation', type: 'Follow-up' },
  { id: 'APT-1002', token: 'T-02', patient: 'Saanvier Parthalan', uhid: 'MER-PAT-0087227', doctor: 'Dr. Priya Narayanan', dept: 'Internal Medicine', time: '09:45 AM', room: 'OPD-105', status: 'Checked In', type: 'New Consult' },
  { id: 'APT-1003', token: 'T-03', patient: 'Bhavani Kumar', uhid: 'MER-PAT-0087222', doctor: 'Dr. Sanjay Gupta', dept: 'Neurology', time: '10:00 AM', room: 'OPD-108', status: 'Waiting', type: 'Review' },
  { id: 'APT-1004', token: 'T-04', patient: 'M. Senthil', uhid: 'MER-PAT-0087225', doctor: 'Dr. Pooja Menon', dept: 'General Surgery', time: '10:15 AM', room: 'OPD-110', status: 'Checked In', type: 'Post-Op' },
  { id: 'APT-1005', token: 'T-05', patient: 'Lakshmi Narayanan', uhid: 'MER-PAT-0087230', doctor: 'Dr. Arjun Menon', dept: 'Cardiology', time: '10:30 AM', room: 'OPD-102', status: 'Waiting', type: 'ECG Check' },
  { id: 'APT-1006', token: 'T-06', patient: 'Christoer Parthalan', uhid: 'MER-PAT-0087233', doctor: 'Dr. Priya Narayanan', dept: 'Internal Medicine', time: '10:45 AM', room: 'OPD-105', status: 'Completed', type: 'Review' },
  { id: 'APT-1007', token: 'T-07', patient: 'A. Murugan', uhid: 'MER-PAT-0087238', doctor: 'Dr. Rajesh Sharma', dept: 'Orthopedics', time: '11:00 AM', room: 'OPD-114', status: 'Waiting', type: 'X-Ray Review' },
  { id: 'APT-1008', token: 'T-08', patient: 'Deepa Natarajan', uhid: 'MER-PAT-0087242', doctor: 'Dr. Anita Roy', dept: 'Pediatrics', time: '11:15 AM', room: 'OPD-101', status: 'Checked In', type: 'Vaccination' },
];

export function AppointmentsView({ onOpenDrawer, onOpenModal }) {
  const [data, setData] = useState(INITIAL_APPOINTMENTS);
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return data.filter(item => {
      const matchFilter = filter === 'All' || item.status === filter;
      const hay = `${item.patient} ${item.uhid} ${item.doctor} ${item.dept} ${item.token}`.toLowerCase();
      const matchQuery = !query || hay.includes(query.toLowerCase());
      return matchFilter && matchQuery;
    });
  }, [data, filter, query]);

  const updateStatus = (id, newStatus) => {
    setData(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  };

  const handleRowClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.token} · ${row.patient}`,
      sub: `Consultant: ${row.doctor} · ${row.dept} · Room ${row.room}`,
      badges: [
        { t: row.status, bg: row.status === 'Completed' ? '#dcfce7' : row.status === 'In Consultation' ? '#fef3c7' : '#dbeafe', fg: row.status === 'Completed' ? '#15803d' : row.status === 'In Consultation' ? '#92400e' : '#1e40af' },
        { t: row.type, bg: '#f1f5f9', fg: '#475569' }
      ],
      facts: [
        { k: 'Token Number', v: row.token, b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'UHID / MRN', v: row.uhid },
        { k: 'Consulting Doctor', v: row.doctor },
        { k: 'Department', v: row.dept },
        { k: 'Room Location', v: row.room },
        { k: 'Time Slot', v: row.time },
        { k: 'Appointment Type', v: row.type },
        { k: 'Workflow Status', v: row.status }
      ],
      actions: [
        { label: 'Check In Patient', on: () => updateStatus(row.id, 'Checked In') },
        { label: 'Start Consultation', primary: true, on: () => updateStatus(row.id, 'In Consultation') },
        { label: 'Mark Completed', on: () => updateStatus(row.id, 'Completed') }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Consultant Appointments & OPD Token Queue"
        subtitle="Out-patient consultation appointments, automated queue management, and doctor check-in desk"
        count={filtered.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'appt', title: 'New Outpatient Appointment' })}
        newLabel="+ New Appointment"
        onExport={() => alert(`Exported ${filtered.length} appointments to CSV`)}
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Today's Appointments" value="48" sub="14 In-Person · 6 Telehealth" color="#0284c7" />
        <StatCard label="Checked In" value={data.filter(d => d.status === 'Checked In').length} sub="Arrived in Waiting Bay" color="#059669" />
        <StatCard label="In Consultation" value={data.filter(d => d.status === 'In Consultation').length} sub="Rooms 102, 105 active" color="#d97706" />
        <StatCard label="Completed Today" value="28" sub="Avg consultation: 14 mins" color="#475569" />
      </div>

      <div style={{ ...cardStyle, padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by patient name, UHID, doctor or token..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: '220px', height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          {['All', 'Checked In', 'In Consultation', 'Waiting', 'Completed'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              style={{
                height: '30px', padding: '0 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                border: filter === st ? '1px solid #0284c7' : '1px solid #e2e8f0',
                background: filter === st ? '#f0f9ff' : '#ffffff',
                color: filter === st ? '#0284c7' : '#475569'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <th style={{ padding: '10px 14px' }}>Token</th>
              <th style={{ padding: '10px 14px' }}>Patient / UHID</th>
              <th style={{ padding: '10px 14px' }}>Consultant</th>
              <th style={{ padding: '10px 14px' }}>Dept / Room</th>
              <th style={{ padding: '10px 14px' }}>Slot</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{row.token}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.patient}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.uhid}</div>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{row.doctor}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div>{row.dept}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.room}</div>
                </td>
                <td style={{ padding: '10px 14px', color: '#475569' }}>{row.time}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.status === 'In Consultation' ? '#fef3c7' :
                    row.status === 'Checked In' ? '#dbeafe' :
                    row.status === 'Completed' ? '#dcfce7' : '#f1f5f9',
                    row.status === 'In Consultation' ? '#92400e' :
                    row.status === 'Checked In' ? '#1e40af' :
                    row.status === 'Completed' ? '#15803d' : '#475569'
                  )}>
                    ● {row.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  {row.status === 'Waiting' && (
                    <button type="button" onClick={() => updateStatus(row.id, 'Checked In')} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                      Check-in
                    </button>
                  )}
                  {row.status === 'Checked In' && (
                    <button type="button" onClick={() => updateStatus(row.id, 'In Consultation')} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                      Call Token
                    </button>
                  )}
                  {row.status === 'In Consultation' && (
                    <button type="button" onClick={() => updateStatus(row.id, 'Completed')} style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', border: 'none', background: '#059669', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                      Complete
                    </button>
                  )}
                  {row.status === 'Completed' && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Done</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 2. EMERGENCY & TRAUMA BOARD (emergency)
// -----------------------------------------------------------------------------
export function EmergencyView({ onOpenDrawer, onOpenModal }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchEmergencyData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getEmergencyCases();
      if (res?.data && Array.isArray(res.data)) {
        const mapped = res.data.map(r => ({
          id: r.id,
          bay: r.bay || 'ER Bay',
          patient: r.patient_name,
          age: r.age_gender,
          triage: r.triage_level,
          complaint: r.chief_complaint,
          bp: r.bp,
          hr: r.hr,
          spo2: r.spo2,
          doctor: r.doctor_name || 'Dr. Arjun Menon',
          arrival: r.arrival_time || '09:30',
          waiting: r.waiting_time || r.elapsed_time || '15 m',
          acuity: r.acuity || (r.triage_level === 'Red' ? 'ESI-1 (clinician)' : r.triage_level === 'Yellow' ? 'ESI-2 (clinician)' : 'Not triaged'),
          critical: r.critical_alert,
          mlc: Boolean(r.mlc_flag),
          status: r.clinical_status || 'Awaiting triage'
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error("Failed to fetch emergency cases:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmergencyData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, pageSize]);

  const filtered = useMemo(() => {
    if (!query) return data;
    const q = query.toLowerCase();
    return data.filter(d =>
      (d.id && d.id.toLowerCase().includes(q)) ||
      (d.patient && d.patient.toLowerCase().includes(q)) ||
      (d.complaint && d.complaint.toLowerCase().includes(q)) ||
      (d.doctor && d.doctor.toLowerCase().includes(q)) ||
      (d.acuity && d.acuity.toLowerCase().includes(q)) ||
      (d.status && d.status.toLowerCase().includes(q))
    );
  }, [data, query]);

  const untriagedCount = data.filter(d => d.acuity === 'Not triaged' || d.status === 'Awaiting triage').length;
  const awaitingBedCount = data.filter(d => d.status === 'Awaiting bed').length;
  const criticalCount = data.filter(d => Boolean(d.critical && d.critical !== '—')).length;
  const erBedsFree = Math.max(0, 22 - data.length);

  // Pagination calculations
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRows = useMemo(() => {
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, startIndex, pageSize]);

  const handleRowClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.id} · ${row.patient}`,
      sub: `Arrival: ${row.arrival} (${row.waiting}) · Acuity: ${row.acuity}`,
      badges: [
        { t: row.acuity, bg: row.acuity === 'Not triaged' ? '#fee2e2' : '#fef3c7', fg: row.acuity === 'Not triaged' ? '#991b1b' : '#92400e' },
        { t: row.status, bg: '#fef3c7', fg: '#92400e' },
        ...(row.critical ? [{ t: row.critical, bg: '#fee2e2', fg: '#dc2626' }] : [])
      ],
      facts: [
        { k: 'Case Identifier', v: row.id, b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'Chief Complaint', v: row.complaint },
        { k: 'Arrival Timestamp', v: row.arrival },
        { k: 'Waiting Duration', v: row.waiting },
        { k: 'Assigned Clinician', v: row.doctor },
        { k: 'Triage Acuity', v: row.acuity },
        { k: 'Critical Result', v: row.critical || 'Normal / None' },
        { k: 'MLC Flag', v: row.mlc ? 'Yes (Police Intimated)' : 'No' },
        { k: 'Vital Signs', v: `BP ${row.bp || '120/80'} · HR ${row.hr || '76'} bpm · SpO2 ${row.spo2 || '99%'}` }
      ],
      actions: [
        {
          label: 'Triage & Assign Acuity',
          primary: true,
          on: async () => {
            const nextAcuity = row.acuity === 'Not triaged' ? 'ESI-1 (clinician)' : row.acuity;
            const nextStatus = 'Treatment';
            try {
              await apiService.updateEmergencyCase(row.id, { acuity: nextAcuity, clinical_status: nextStatus });
              setData(prev => prev.map(p => p.id === row.id ? { ...p, acuity: nextAcuity, status: nextStatus } : p));
            } catch (err) {
              console.error(err);
            }
          }
        },
        {
          label: 'Mark Awaiting Bed',
          on: async () => {
            try {
              await apiService.updateEmergencyCase(row.id, { clinical_status: 'Awaiting bed' });
              setData(prev => prev.map(p => p.id === row.id ? { ...p, status: 'Awaiting bed' } : p));
            } catch (err) {
              console.error(err);
            }
          }
        },
        {
          label: 'Admit to Inpatient Bed',
          on: () => onOpenModal && onOpenModal({
            kind: 'admit',
            title: `Admit ER Patient: ${row.patient}`,
            data: { patientId: row.id, name: row.patient, dept: 'Emergency', cls: 'ICU' }
          })
        }
      ]
    });
  };

  const exportCSV = () => {
    const headers = ['CASE', 'PATIENT', 'ARRIVAL', 'WAITING', 'COMPLAINT', 'CLINICIAN', 'ACUITY', 'CRITICAL', 'STATUS'];
    const rows = filtered.map(r => [
      r.id,
      `"${r.patient}"`,
      r.arrival,
      r.waiting,
      `"${r.complaint}"`,
      `"${r.doctor}"`,
      `"${r.acuity}"`,
      `"${r.critical || '—'}"`,
      `"${r.status}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `emergency_board_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && data.length === 0) {
    return (
      <ModuleLoadingScreen
        title="Loading Emergency & Trauma Board..."
        subtitle="Retrieving real-time triage acuity, emergency bay allocations, attending clinicians, and telemetry monitoring..."
        badgeText="Live Emergency Triage Sync"
        showKpis={true}
        statCount={4}
        layout="table"
        tableRows={6}
        tableColumns={9}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'inherit' }}>
      {/* Title & Subtitle Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Front Office & Patients</span> › <span>Emergency Triage & Trauma Board</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 2px', color: '#15181b' }}>
            Emergency & Trauma Board
          </h1>
          <div style={{ color: '#8a9096', fontSize: '11.5px' }}>
            Ordered by clinical triage acuity (ESI 1 → 5); active emergency bay telemetry, clinician assignment, and MLC tracking.
          </div>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          style={{
            height: '32px',
            padding: '0 14px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          Export CSV
        </button>
      </div>

      {/* 4 Stat Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <div style={{ ...cardStyle, padding: '12px 16px', background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Active ER Cases</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#15181b', marginTop: '2px' }}>
            {data.length}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 16px', background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Awaiting Inpatient Bed</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#0284c7', marginTop: '2px' }}>
            {awaitingBedCount}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 16px', background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Critical / Resuscitation</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#dc2626', marginTop: '2px' }}>
            {criticalCount}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 16px', background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>ER Bays Ready</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#15803d', marginTop: '2px' }}>
            {erBedsFree}
          </div>
        </div>
      </div>

      {/* Action / Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            placeholder="Search patient, complaint, doctor, bay..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              height: '32px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              color: '#1e293b',
              background: '#ffffff',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Alert Banner for untriaged cases */}
      {untriagedCount > 0 && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '10px 14px',
            color: '#b91c1c',
            fontSize: '12.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            ⚠️ {untriagedCount} arrival{untriagedCount === 1 ? '' : 's'} awaiting triage. Open case to triage & assign clinician.
          </div>
        </div>
      )}

      {/* Live Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No Emergency Cases Found"
          description="There are currently no active emergency patients matching the search."
          onAction={() => onOpenModal && onOpenModal({ kind: 'admit', title: 'Emergency Inpatient Bed Admission', data: { dept: 'Emergency', cls: 'ICU' } })}
          actionLabel="+ Triage & Admit Patient"
        />
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#ffffff', borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px' }}>CASE</th>
                  <th style={{ padding: '10px 14px' }}>PATIENT</th>
                  <th style={{ padding: '10px 14px' }}>LOCATION</th>
                  <th style={{ padding: '10px 14px' }}>ARRIVAL & WAIT</th>
                  <th style={{ padding: '10px 14px', minWidth: '220px' }}>CHIEF COMPLAINT</th>
                  <th style={{ padding: '10px 14px' }}>CLINICIAN</th>
                  <th style={{ padding: '10px 14px' }}>ACUITY</th>
                  <th style={{ padding: '10px 14px' }}>CRITICAL ALERT</th>
                  <th style={{ padding: '10px 14px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map(row => {
                  const isRed = row.triage === 'Red' || (row.acuity && row.acuity.toLowerCase().includes('resuscitation'));
                  return (
                    <tr
                      key={row.id}
                      onClick={() => handleRowClick(row)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace, sans-serif', color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}>
                        {row.id}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                        <div>{row.patient}</div>
                        {row.mlc && (
                          <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, background: '#fee2e2', padding: '1px 5px', borderRadius: '3px' }}>
                            MLC POLICE
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontWeight: 500 }}>
                        {row.bay}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>
                        <div>{row.arrival}</div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>{row.waiting}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#0f172a' }}>
                        <span style={{ display: 'inline-block', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.complaint}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontWeight: 500 }}>
                        {row.doctor}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: isRed ? '#fee2e2' : '#fef3c7',
                          color: isRed ? '#991b1b' : '#92400e',
                          border: isRed ? '1px solid #fecaca' : '1px solid #fde68a'
                        }}>
                          {row.acuity}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {row.critical && row.critical !== '—' ? (
                          <span style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            border: '1px solid #fecaca'
                          }}>
                            {row.critical}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          background: '#f1f5f9',
                          color: '#334155',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          display: 'inline-block',
                          whiteSpace: 'nowrap'
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filtered.length > 0 && (
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
                  Showing <strong>{totalRows > 0 ? startIndex + 1 : 0}</strong>–<strong>{Math.min(startIndex + pageSize, totalRows)}</strong> of <strong>{totalRows}</strong> emergency cases
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '11.5px', color: '#8a9096' }}>Per page:</span>
                  {[10, 15, 25, 50].map(sz => (
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

                {/* Page Numbers */}
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
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 3. CONSULTANT SCHEDULES (schedules)
// -----------------------------------------------------------------------------
export function SchedulesView({ onOpenDrawer, onOpenModal }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await apiService.getConsultantSchedules({ forceRefresh: true });
      if (res?.data && Array.isArray(res.data)) {
        const mapped = res.data.map(r => ({
          id: r.id,
          doctor: r.doctor_name,
          dept: r.specialty,
          days: r.clinic_days || 'Mon Wed Fri',
          hours: r.opd_hours || '09:00-13:00',
          slot: r.slot_duration_mins ? `${r.slot_duration_mins} m` : '15 m',
          room: r.room_no || 'OPD-1',
          todayBooked: `${r.booked_today_count || 0} / ${r.total_today_slots || 16} booked`,
          tomorrow: r.tomorrow_schedule || 'Not consulting',
          status: r.status || 'Active',
          onCall: r.on_call_assignment,
          isConsultingToday: r.is_consulting_today !== false,
          totalSlots: r.total_today_slots || 16,
          bookedCount: r.booked_today_count || 0
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error("Failed to load consultant schedules:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const departments = useMemo(() => {
    const depts = new Set();
    data.forEach(d => {
      if (d.dept && d.dept.trim()) {
        depts.add(d.dept.trim());
      }
    });
    return ['All', ...Array.from(depts).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter(d => {
      const matchDept = selectedDept === 'All' || d.dept.toLowerCase() === selectedDept.toLowerCase();
      const q = query.toLowerCase();
      const matchQuery = !q ||
        d.doctor.toLowerCase().includes(q) ||
        d.dept.toLowerCase().includes(q) ||
        d.room.toLowerCase().includes(q) ||
        d.days.toLowerCase().includes(q) ||
        d.hours.toLowerCase().includes(q);
      return matchDept && matchQuery;
    });
  }, [data, selectedDept, query]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDept, query, pageSize]);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRows = filtered.slice(startIndex, startIndex + pageSize);

  const consultingTodayCount = data.filter(d => d.isConsultingToday && d.status === 'Active').length;
  const onLeaveCount = data.filter(d => d.status === 'On Leave' || d.status === 'Inactive').length;
  const totalSlotsToday = data.reduce((acc, curr) => acc + (curr.totalSlots || 0), 0);
  const totalBookedToday = data.reduce((acc, curr) => acc + (curr.bookedCount || 0), 0);

  const handleDoctorClick = (d) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${d.doctor} · ${d.dept}`,
      sub: `${d.room} · Clinic Hours: ${d.hours} (${d.days})`,
      badges: [
        { t: d.status, bg: d.status === 'Active' ? '#dcfce7' : '#fee2e2', fg: d.status === 'Active' ? '#15803d' : '#991b1b' },
        { t: `Slot: ${d.slot}`, bg: '#f1f5f9', fg: '#334155' }
      ],
      facts: [
        { k: 'Consultant Name', v: d.doctor, b: true },
        { k: 'Department', v: d.dept },
        { k: 'Consultation Room', v: d.room },
        { k: 'OPD Schedule Hours', v: d.hours },
        { k: 'Clinic Operating Days', v: d.days },
        { k: 'Template Slot Length', v: d.slot },
        { k: 'Today Booking Load', v: d.todayBooked },
        { k: 'Tomorrow Forecast', v: d.tomorrow },
        { k: 'Emergency On-Call', v: d.onCall || 'General Hospital Call' }
      ],
      actions: [
        {
          label: 'Book Consultation Slot',
          primary: true,
          on: () => onOpenModal && onOpenModal({ kind: 'appt', title: `Book Appointment with ${d.doctor}`, data: { doctorId: d.doctor, dept: d.dept } })
        },
        {
          label: d.status === 'Active' ? 'Mark On Leave (Block Slots)' : 'Set Active / Restore Roster',
          on: async () => {
            const nextStatus = d.status === 'Active' ? 'On Leave' : 'Active';
            try {
              if (d.id) await apiService.updateConsultantSchedule(d.id, { status: nextStatus });
              setData(prev => prev.map(item => item.id === d.id ? { ...item, status: nextStatus } : item));
            } catch (err) {
              console.error(err);
            }
          }
        }
      ]
    });
  };

  const exportCSV = () => {
    const headers = ['CONSULTANT', 'DEPARTMENT', 'DAYS', 'HOURS', 'SLOT', 'ROOM', 'TODAY', 'TOMORROW', 'STATUS'];
    const rows = filtered.map(r => [
      `"${r.doctor}"`,
      `"${r.dept}"`,
      `"${r.days}"`,
      r.hours,
      r.slot,
      r.room,
      `"${r.todayBooked}"`,
      `"${r.tomorrow}"`,
      r.status
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `consultant_schedules_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && data.length === 0) {
    return (
      <div style={{ marginTop: '8px' }}>
        <ModuleLoadingScreen
          title="Consultant Schedules"
          subtitle="Synchronizing 160+ physician slot templates, OPD clinic hours, and on-call assignments..."
          badgeText="Live Sync"
          showKpis={false}
          tableRows={8}
          tableColumns={9}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'inherit' }}>
      {/* Title & Subtitle */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 4px', color: '#0f172a', letterSpacing: '-0.02em' }}>
          Consultant schedules
        </h1>
        <div style={{ color: '#64748b', fontSize: '13px', lineHeight: '1.4' }}>
          Slot templates per consultant (days · hours · slot length · room). Booking validates day, hours, slot alignment and leave; a leave block flags every affected appointment for rescheduling.
        </div>
      </div>

      {/* Search & Export Action */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative', width: '240px' }}>
          <input
            type="text"
            placeholder="Search doctor, dept, room..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              height: '34px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              color: '#1e293b',
              background: '#ffffff',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <button
          type="button"
          onClick={exportCSV}
          style={{
            height: '34px',
            padding: '0 16px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          Export CSV
        </button>
      </div>

      {/* 5 Stat Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        <div style={{ ...cardStyle, padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Consultants</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {data.length}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Consulting today</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
            {consultingTodayCount}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>On leave</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b45309', marginTop: '4px' }}>
            {onLeaveCount}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Slots today</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {totalSlotsToday}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '14px 18px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Booked today</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f766e', marginTop: '4px' }}>
            {totalBookedToday}
          </div>
        </div>
      </div>

      {/* Specialty Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
        {departments.map(dept => {
          const isSelected = selectedDept.toLowerCase() === dept.toLowerCase();
          const count = dept === 'All' ? data.length : data.filter(d => d.dept.toLowerCase() === dept.toLowerCase()).length;
          return (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              style={{
                borderRadius: '20px',
                padding: '5px 14px',
                fontSize: '12px',
                fontWeight: isSelected ? 700 : 500,
                border: isSelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                background: isSelected ? '#0f172a' : '#ffffff',
                color: isSelected ? '#ffffff' : '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{dept}</span>
              <span style={{
                fontSize: '10.5px',
                opacity: 0.85,
                background: isSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                color: isSelected ? '#ffffff' : '#64748b',
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Live Data Table */}
      {loading ? (
        <LoadingState label="Fetching live consultant schedules from PostgreSQL..." columns={9} rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Consultant Schedules Found"
          description="There are currently no consultants matching the selected department or query."
          onAction={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'doctors', title: 'Add Doctor / Consultant' })}
          actionLabel="+ Add Consultant"
        />
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 16px' }}>CONSULTANT</th>
                <th style={{ padding: '12px 16px' }}>DEPARTMENT</th>
                <th style={{ padding: '12px 16px' }}>DAYS</th>
                <th style={{ padding: '12px 16px' }}>HOURS</th>
                <th style={{ padding: '12px 16px' }}>SLOT</th>
                <th style={{ padding: '12px 16px' }}>ROOM</th>
                <th style={{ padding: '12px 16px' }}>TODAY</th>
                <th style={{ padding: '12px 16px' }}>TOMORROW</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map(row => (
                <tr
                  key={row.id || row.doctor}
                  onClick={() => handleDoctorClick(row)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                    {row.doctor}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {row.dept}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {row.days}
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace, sans-serif', color: '#334155' }}>
                    {row.hours}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {row.slot}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 600 }}>
                    {row.room}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#0f172a' }}>
                    {row.todayBooked}
                  </td>
                  <td style={{ padding: '12px 16px', color: row.tomorrow === 'Not consulting' ? '#94a3b8' : '#0f172a' }}>
                    {row.tomorrow}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: row.status === 'Active' ? '#dcfce7' : '#fee2e2',
                      color: row.status === 'Active' ? '#15803d' : '#991b1b',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      display: 'inline-block',
                      whiteSpace: 'nowrap'
                    }}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Footer */}
          {totalRows > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
              color: '#64748b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span>
                  Showing <strong>{totalRows > 0 ? startIndex + 1 : 0}</strong>–<strong>{Math.min(startIndex + pageSize, totalRows)}</strong> of <strong>{totalRows}</strong> consultant schedules
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

                {/* Page Numbers */}
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
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 4. NURSING WORKSPACE (nursing)
// -----------------------------------------------------------------------------
export function NursingWorkspaceView({ onOpenDrawer, onOpenModal }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedWard, setSelectedWard] = useState('All Wards');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const loadNursingData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getNursingTasks({ forceRefresh: true });
      if (res?.data && Array.isArray(res.data)) {
        const mapped = res.data.map(r => ({
          id: r.id,
          bed: r.bed_no || '',
          patient: r.patient_name || '',
          uhid: r.uhid || '',
          task: r.task_description || '',
          status: r.status || 'Active',
          nurse: r.assigned_nurse || '',
          notes: r.clinical_notes || '',
          lastVitals: r.last_vitals_time || '11:00',
          hr: r.hr ?? 75,
          bp: r.bp || '120/80',
          spo2: r.spo2 ?? 98,
          temp: r.temp ?? 37.0,
          rr: r.rr ?? 18,
          pain: r.pain_score ?? 0,
          ews: r.ews_score ?? 0,
          fall: r.fall_risk || 'Low / Low',
          diet: r.diet_type || 'Standard',
          overdueMeds: r.overdue_meds || '—',
          flag: r.flag_status || 'Normal',
          ward: r.ward_name || 'General Multi-Specialty Ward'
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error("Failed to load nursing tasks:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNursingData();
  }, []);

  const wards = useMemo(() => {
    const wSet = new Set();
    data.forEach(d => {
      if (d.ward && d.ward.trim()) wSet.add(d.ward.trim());
    });
    return ['All Wards', ...Array.from(wSet).sort()];
  }, [data]);

  const handleTaskClick = (t) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${t.bed} · ${t.patient}`,
      sub: `Ward: ${t.ward} | UHID: ${t.uhid}`,
      badges: [
        { 
          t: t.flag, 
          bg: t.flag.includes('Critical') || t.flag.includes('escalate') ? '#fee2e2' : t.flag.includes('Pending') || t.flag.includes('watch') ? '#fef3c7' : '#dcfce7', 
          fg: t.flag.includes('Critical') || t.flag.includes('escalate') ? '#dc2626' : t.flag.includes('Pending') || t.flag.includes('watch') ? '#92400e' : '#15803d' 
        },
        { 
          t: `EWS: ${t.ews}`, 
          bg: t.ews >= 3 ? '#fee2e2' : t.ews === 2 ? '#fef3c7' : '#f1f5f9', 
          fg: t.ews >= 3 ? '#dc2626' : t.ews === 2 ? '#92400e' : '#475569' 
        }
      ],
      facts: [
        { k: 'Bed Number', v: t.bed, b: true },
        { k: 'Patient Name', v: t.patient, b: true },
        { k: 'UHID', v: t.uhid },
        { k: 'Ward / Unit', v: t.ward },
        { k: 'Assigned Nurse', v: t.nurse },
        { k: 'Latest Vitals Time', v: t.lastVitals },
        { k: 'Heart Rate (HR)', v: `${t.hr} bpm` },
        { k: 'Blood Pressure (BP)', v: t.bp },
        { k: 'Oxygen Saturation (SpO₂)', v: `${t.spo2}%` },
        { k: 'Temperature', v: `${t.temp} °C` },
        { k: 'Respiratory Rate (RR)', v: `${t.rr} /min` },
        { k: 'Pain Score', v: `${t.pain} / 10` },
        { k: 'Early Warning Score (EWS)', v: `${t.ews}` },
        { k: 'Fall / Pressure Risk', v: t.fall },
        { k: 'Diet Type', v: t.diet },
        { k: 'Overdue Meds', v: t.overdueMeds },
        { k: 'Care Plan / Task', v: t.task },
        { k: 'Clinical Notes', v: t.notes }
      ],
      actions: [
        {
          label: 'Mark Task Completed',
          primary: true,
          on: async () => {
            try {
              if (t.id) await apiService.updateNursingTask(t.id, { status: 'Completed' });
              setData(prev => prev.map(item => item.id === t.id ? { ...item, status: 'Completed' } : item));
            } catch (e) {
              console.error(e);
            }
          }
        },
        {
          label: 'Acknowledge Vitals / Watch',
          on: async () => {
            try {
              if (t.id) await apiService.updateNursingTask(t.id, { status: 'In Progress' });
              setData(prev => prev.map(item => item.id === t.id ? { ...item, status: 'In Progress' } : item));
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    });
  };

  const handleExportCSV = () => {
    if (data.length === 0) return alert('No nursing data to export.');
    const headers = ['Bed', 'Patient', 'UHID', 'Ward', 'Last Vitals', 'HR', 'BP', 'SpO2', 'Temp', 'RR', 'Pain', 'EWS', 'Fall/Pressure', 'Diet', 'Overdue Meds', 'Flag', 'Task', 'Nurse'];
    const rows = filtered.map(d => [
      d.bed, `"${d.patient}"`, d.uhid, `"${d.ward}"`, d.lastVitals, d.hr, d.bp, `${d.spo2}%`, d.temp, d.rr, d.pain, d.ews, `"${d.fall}"`, `"${d.diet}"`, `"${d.overdueMeds}"`, `"${d.flag}"`, `"${d.task}"`, `"${d.nurse}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nursing_workspace_census_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics across whole live dataset
  const censusCount = data.length;
  const ewsEscalateCount = data.filter(d => (d.flag && (d.flag.toLowerCase().includes('escalate') || d.flag.toLowerCase().includes('critical'))) || Number(d.ews) >= 3).length;
  const watchCount = data.filter(d => (d.flag && (d.flag.toLowerCase().includes('watch') || d.flag.toLowerCase().includes('pending'))) || Number(d.ews) === 2).length;
  const overdueMedsCount = data.filter(d => d.overdueMeds && d.overdueMeds !== '—' && d.overdueMeds !== '-').length;
  const dueNowCount = data.filter(d => d.status === 'Due Now' || (d.overdueMeds && d.overdueMeds !== '—' && d.overdueMeds !== '-')).length;
  const highFallRiskCount = data.filter(d => d.fall && d.fall.toLowerCase().includes('high')).length;

  // Filter & Search Logic
  const filtered = useMemo(() => {
    return data.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        item.patient.toLowerCase().includes(q) ||
        item.bed.toLowerCase().includes(q) ||
        item.uhid.toLowerCase().includes(q) ||
        item.ward.toLowerCase().includes(q) ||
        item.nurse.toLowerCase().includes(q) ||
        item.diet.toLowerCase().includes(q) ||
        item.flag.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const matchesWard = selectedWard === 'All Wards' || item.ward.toLowerCase() === selectedWard.toLowerCase();
      if (!matchesWard) return false;

      if (selectedFilter === 'Escalate') {
        return (item.flag && (item.flag.toLowerCase().includes('escalate') || item.flag.toLowerCase().includes('critical'))) || Number(item.ews) >= 3;
      }
      if (selectedFilter === 'Watch') {
        return (item.flag && (item.flag.toLowerCase().includes('watch') || item.flag.toLowerCase().includes('pending'))) || Number(item.ews) === 2;
      }
      if (selectedFilter === 'Normal') {
        return item.flag && item.flag.toLowerCase().includes('normal');
      }
      return true;
    });
  }, [data, searchQuery, selectedWard, selectedFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedWard, selectedFilter, pageSize]);

  // Pagination calculations
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRows = filtered.slice(startIndex, startIndex + pageSize);

  const filterOptions = ['All', 'Escalate', 'Watch', 'Normal'];

  if (loading && data.length === 0) {
    return (
      <div style={{ marginTop: '8px' }}>
        <ModuleLoadingScreen
          title="Nursing Workspace"
          subtitle="Retrieving real-time ward census, vitals, EWS deterioration alerts, and medication schedules..."
          badgeText="Live Sync"
          showKpis={false}
          tableRows={8}
          tableColumns={14}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'inherit' }}>
      {/* Title & Subtitle */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
          Nursing workspace · Inpatient wards
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
          Real-time census across all inpatient units, latest vitals with Early Warning Score (EWS), care plan risks, overdue medications, and clinical handovers.
        </p>
      </div>

      {/* Search & Export bar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            placeholder="Search patient, bed, UHID, ward, nurse..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '34px',
              padding: '0 12px',
              fontSize: '12.5px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              background: '#ffffff',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            height: '34px',
            padding: '0 16px',
            fontSize: '12.5px',
            fontWeight: 600,
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          Export CSV
        </button>
      </div>

      {/* 7 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Census (IP)</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>{censusCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>EWS escalate</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{ewsEscalateCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Watch</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b45309' }}>{watchCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Medications overdue</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{overdueMedsCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Due now</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>{dueNowCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>High fall risk</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b45309' }}>{highFallRiskCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Handover</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', lineHeight: '1.4', marginTop: '4px' }}>AI draft · nurse verifies</div>
        </div>
      </div>

      {/* Ward Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Ward:</span>
        {wards.map(w => {
          const isSelected = selectedWard === w;
          const count = w === 'All Wards' ? data.length : data.filter(d => d.ward.toLowerCase() === w.toLowerCase()).length;
          return (
            <button
              key={w}
              type="button"
              onClick={() => setSelectedWard(w)}
              style={{
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '11.5px',
                fontWeight: isSelected ? 700 : 500,
                border: isSelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                background: isSelected ? '#0f172a' : '#ffffff',
                color: isSelected ? '#ffffff' : '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>{w}</span>
              <span style={{
                fontSize: '10.5px',
                opacity: 0.85,
                background: isSelected ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                color: isSelected ? '#ffffff' : '#64748b',
                padding: '1px 5px',
                borderRadius: '10px'
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Acuity Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Acuity:</span>
        {filterOptions.map(f => {
          const isSelected = selectedFilter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setSelectedFilter(f)}
              style={{
                padding: '4px 14px',
                borderRadius: '16px',
                fontSize: '11.5px',
                fontWeight: isSelected ? 700 : 500,
                border: isSelected ? '1px solid #0284c7' : '1px solid #e2e8f0',
                background: isSelected ? '#e0f2fe' : '#ffffff',
                color: isSelected ? '#0369a1' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Live Data Table */}
      {loading ? (
        <LoadingState label="Fetching live nursing tasks from PostgreSQL..." columns={14} rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Inpatients Found"
          description="There are currently no patients matching the selected filter or query."
          onAction={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'nursing', title: 'Log Nursing Task' })}
          actionLabel="+ Log Inpatient Task"
        />
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', minWidth: '1050px' }}>
            <thead>
              <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 14px' }}>BED</th>
                <th style={{ padding: '12px 14px' }}>PATIENT</th>
                <th style={{ padding: '12px 14px' }}>WARD</th>
                <th style={{ padding: '12px 14px' }}>LAST VITALS</th>
                <th style={{ padding: '12px 14px' }}>HR</th>
                <th style={{ padding: '12px 14px' }}>BP</th>
                <th style={{ padding: '12px 14px' }}>SPO₂</th>
                <th style={{ padding: '12px 14px' }}>TEMP</th>
                <th style={{ padding: '12px 14px' }}>RR</th>
                <th style={{ padding: '12px 14px' }}>PAIN</th>
                <th style={{ padding: '12px 14px' }}>EWS</th>
                <th style={{ padding: '12px 14px' }}>FALL / PRESSURE</th>
                <th style={{ padding: '12px 14px' }}>DIET</th>
                <th style={{ padding: '12px 14px' }}>OVERDUE MEDS</th>
                <th style={{ padding: '12px 14px' }}>FLAG</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map(row => {
                const isHrAlert = Number(row.hr) > 100 || Number(row.hr) < 60;
                const isSpo2Alert = Number(row.spo2) < 95;
                const isEwsCritical = Number(row.ews) >= 3;
                const isEwsWatch = Number(row.ews) === 2;

                const isCriticalFlag = row.flag && (row.flag.includes('Critical') || row.flag.includes('escalate'));
                const isWatchFlag = row.flag && (row.flag.includes('Pending') || row.flag.includes('watch'));

                return (
                  <tr
                    key={row.id || row.bed}
                    onClick={() => handleTaskClick(row)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {row.bed}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                      {row.patient}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '11.5px' }}>
                      {row.ward}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                      {row.lastVitals}
                    </td>
                    <td style={{ padding: '12px 14px', color: isHrAlert ? '#dc2626' : '#0f172a', fontWeight: isHrAlert ? 700 : 400 }}>
                      {row.hr}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a', fontFamily: 'monospace, sans-serif' }}>
                      {row.bp}
                    </td>
                    <td style={{ padding: '12px 14px', color: isSpo2Alert ? '#dc2626' : '#0f172a', fontWeight: isSpo2Alert ? 700 : 400 }}>
                      {row.spo2}%
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a' }}>
                      {row.temp}°C
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a' }}>
                      {row.rr}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a' }}>
                      {row.pain}
                    </td>
                    <td style={{ padding: '12px 14px', color: isEwsCritical ? '#dc2626' : isEwsWatch ? '#b45309' : '#0f172a', fontWeight: (isEwsCritical || isEwsWatch) ? 700 : 400 }}>
                      {row.ews}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a' }}>
                      {row.fall}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a' }}>
                      {row.diet}
                    </td>
                    <td style={{ padding: '12px 14px', color: row.overdueMeds !== '—' && row.overdueMeds !== '-' ? '#dc2626' : '#94a3b8', fontWeight: row.overdueMeds !== '—' && row.overdueMeds !== '-' ? 600 : 400 }}>
                      {row.overdueMeds}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: isCriticalFlag ? '#fee2e2' : isWatchFlag ? '#fef3c7' : '#dcfce7',
                        color: isCriticalFlag ? '#dc2626' : isWatchFlag ? '#92400e' : '#15803d',
                        border: isCriticalFlag ? '1px solid #fca5a5' : isWatchFlag ? '1px solid #fde68a' : '1px solid #bbf7d0',
                        padding: '3px 10px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        display: 'inline-block',
                        whiteSpace: 'nowrap'
                      }}>
                        {row.flag}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Footer */}
          {totalRows > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
              color: '#64748b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span>
                  Showing <strong>{totalRows > 0 ? startIndex + 1 : 0}</strong>–<strong>{Math.min(startIndex + pageSize, totalRows)}</strong> of <strong>{totalRows}</strong> inpatients
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

                {/* Page Numbers */}
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
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 5. MEDICATION ADMINISTRATION (eMAR) (emar)
// -----------------------------------------------------------------------------
export function MedicationAdminView({ onOpenDrawer, onOpenModal }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('Kanban'); // 'Kanban' | 'Table'
  const [selectedFilter, setSelectedFilter] = useState('All'); // 'All' | 'Overdue' | 'Due' | 'Scheduled' | 'Given'
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const loadEmarData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getEmarRecords({ forceRefresh: true });
      if (res?.data && Array.isArray(res.data)) {
        const mapped = res.data.map(r => ({
          id: r.id,
          time: r.scheduled_time || '08:00 AM',
          patient: r.patient_name || '',
          bed: r.bed_no || '',
          drug: r.medication_name || '',
          route: r.dosage_route || '',
          status: r.status || 'Scheduled',
          stage: r.stage || 'Scheduled',
          isHighAlert: r.is_high_alert ?? false,
          isOverdue: r.is_overdue ?? false,
          prescriber: r.prescribed_by || 'Dr. Amit Sharma',
          verification: r.verification_status || 'Verified',
          nurse: r.administered_by || '',
          signedAt: r.signed_at || ''
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error("Failed to load eMAR records:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmarData();
  }, []);

  const handleAdminister = async (m) => {
    try {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (m.id) {
        await apiService.signOffEmarRecord(m.id, {
          status: 'Given',
          stage: 'Completed',
          administered_by: 'Anitha Kumar, RN',
          signed_at: timeStr
        });
      }
      setData(prev => prev.map(item => item.id === m.id ? {
        ...item,
        status: 'Given',
        stage: 'Completed',
        nurse: 'Anitha Kumar, RN',
        signedAt: timeStr
      } : item));
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDrawer = (m) => {
    setSelectedCardId(m.id);
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${m.bed} · ${m.patient}`,
      sub: `${m.drug} (${m.route})`,
      badges: [
        {
          t: m.stage || m.status,
          bg: m.stage === 'Completed' || m.status === 'Given' ? '#dcfce7' : m.stage === 'Critical' || m.status === 'Overdue' ? '#fee2e2' : '#fef3c7',
          fg: m.stage === 'Completed' || m.status === 'Given' ? '#15803d' : m.stage === 'Critical' || m.status === 'Overdue' ? '#991b1b' : '#92400e'
        },
        ...(m.isHighAlert ? [{ t: 'High-Alert IV', bg: '#fee2e2', fg: '#dc2626' }] : [])
      ],
      facts: [
        { k: 'Bed Number', v: m.bed, b: true },
        { k: 'Patient Name', v: m.patient, b: true },
        { k: 'Medication Name', v: m.drug, b: true },
        { k: 'Dosage & Route', v: m.route },
        { k: 'Scheduled Time', v: m.time },
        { k: 'Prescribing Doctor', v: m.prescriber },
        { k: 'Pharmacy Verification', v: m.verification },
        { k: 'High-Alert Drug', v: m.isHighAlert ? 'Yes (Requires 2-Nurse Sign-off)' : 'Standard' },
        { k: 'Current Stage', v: m.stage },
        { k: 'Administered By', v: m.nurse || 'Pending Administration' },
        { k: 'Signed At', v: m.signedAt || '—' }
      ],
      actions: [
        {
          label: '✓ Administer & Sign Off',
          primary: true,
          on: () => handleAdminister(m)
        },
        {
          label: 'Mark Awaiting Pharmacy',
          on: async () => {
            try {
              if (m.id) {
                await apiService.signOffEmarRecord(m.id, { status: 'Scheduled', stage: 'Awaiting pharmacy', administered_by: '' });
                setData(prev => prev.map(item => item.id === m.id ? { ...item, status: 'Scheduled', stage: 'Awaiting pharmacy' } : item));
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      ]
    });
  };

  const handleExportCSV = () => {
    if (data.length === 0) return alert('No eMAR data to export.');
    const headers = ['Bed', 'Patient', 'Medication', 'Dosage & Route', 'Scheduled Time', 'Status', 'Stage', 'High Alert', 'Prescriber', 'Administered By', 'Signed At'];
    const rows = filtered.map(d => [
      d.bed, `"${d.patient}"`, `"${d.drug}"`, `"${d.route}"`, d.time, d.status, d.stage, d.isHighAlert ? 'Yes' : 'No', `"${d.prescriber}"`, `"${d.nurse}"`, d.signedAt
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medication_administration_record_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic Metrics calculated directly from live database records
  const overdueCount = data.filter(d => d.isOverdue || d.status === 'Overdue' || d.stage === 'Critical').length;
  const dueNowCount = data.filter(d => d.status === 'Due Now' || (d.stage === 'Scheduled' && (d.time.includes('12:') || d.time.includes('01:')))).length;
  const givenTodayCount = data.filter(d => d.status === 'Given' || d.stage === 'Completed').length;
  const highAlertCount = data.filter(d => d.isHighAlert).length;

  // Filter & Search Logic
  const filtered = useMemo(() => {
    return data.filter(item => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        item.patient.toLowerCase().includes(q) ||
        item.bed.toLowerCase().includes(q) ||
        item.drug.toLowerCase().includes(q) ||
        item.route.toLowerCase().includes(q) ||
        item.prescriber.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedFilter === 'Overdue') {
        return item.stage === 'Critical' || item.status === 'Overdue' || item.isOverdue;
      }
      if (selectedFilter === 'Due') {
        return item.status === 'Due Now' || (item.stage === 'Scheduled' && (item.time.includes('12:') || item.time.includes('01:')));
      }
      if (selectedFilter === 'Scheduled') {
        return item.stage === 'Scheduled';
      }
      if (selectedFilter === 'Given') {
        return item.stage === 'Completed' || item.status === 'Given';
      }
      return true;
    });
  }, [data, searchQuery, selectedFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilter, pageSize]);

  // Pagination for Table view
  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRows = filtered.slice(startIndex, startIndex + pageSize);

  // Dynamic Kanban columns with live counts
  const columns = [
    {
      key: 'Scheduled',
      label: 'Scheduled',
      count: data.filter(d => d.stage === 'Scheduled').length,
      bg: '#fef3c7',
      fg: '#92400e',
      border: '#fde68a'
    },
    {
      key: 'Completed',
      label: 'Completed',
      count: data.filter(d => d.stage === 'Completed' || d.status === 'Given').length,
      bg: '#dcfce7',
      fg: '#15803d',
      border: '#bbf7d0'
    },
    {
      key: 'Critical',
      label: 'Critical / Overdue',
      count: data.filter(d => d.stage === 'Critical' || d.status === 'Overdue' || d.isOverdue).length,
      bg: '#fee2e2',
      fg: '#991b1b',
      border: '#fca5a5'
    },
    {
      key: 'Awaiting pharmacy',
      label: 'Awaiting pharmacy',
      count: data.filter(d => d.stage === 'Awaiting pharmacy').length,
      bg: '#ffedd5',
      fg: '#9a3412',
      border: '#fed7aa'
    }
  ];

  if (loading && data.length === 0) {
    return (
      <div style={{ marginTop: '8px' }}>
        <ModuleLoadingScreen
          title="Medication Administration Record (eMAR)"
          subtitle="Loading live electronic MAR, scheduled medication doses, and high-alert drug validations..."
          badgeText="Live Sync"
          showKpis={false}
          tableRows={8}
          tableColumns={9}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'inherit' }}>
      {/* Title & Subtitle */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
          Medication administration record (eMAR)
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
          Prescription → pharmacy verification → dispensing → eMAR → nurse administration → clinical audit. High-alert IV drugs require independent two-nurse double-check.
        </p>
      </div>

      {/* Search & Export bar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            placeholder="Search patient, bed, drug, route, doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '34px',
              padding: '0 12px',
              fontSize: '12.5px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              background: '#ffffff',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            height: '34px',
            padding: '0 16px',
            fontSize: '12.5px',
            fontWeight: 600,
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}
        >
          Export CSV
        </button>
      </div>

      {/* 4 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Overdue</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{overdueCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Due now</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>{dueNowCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Given today</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#15803d' }}>{givenTodayCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>High-alert pending</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{highAlertCount}</div>
        </div>
      </div>

      {/* View Mode Toggle & Status Filter Bar */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Toggle between Table & Kanban */}
        <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setViewMode('Table')}
            style={{
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              border: 'none',
              background: viewMode === 'Table' ? '#0f172a' : '#ffffff',
              color: viewMode === 'Table' ? '#ffffff' : '#475569',
              cursor: 'pointer'
            }}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('Kanban')}
            style={{
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              border: 'none',
              background: viewMode === 'Kanban' ? '#0f172a' : '#ffffff',
              color: viewMode === 'Kanban' ? '#ffffff' : '#475569',
              cursor: 'pointer'
            }}
          >
            Kanban
          </button>
        </div>

        {/* Status Filters */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {['All', 'Overdue', 'Due', 'Scheduled', 'Given'].map(f => {
            const isSelected = selectedFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFilter(f)}
                style={{
                  padding: '4px 14px',
                  borderRadius: '16px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  border: isSelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                  background: isSelected ? '#0f172a' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState label="Fetching live medication administration records from PostgreSQL..." columns={9} rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Medication Doses Found"
          description="There are currently no medication records matching your query or filter."
          onAction={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'emar', title: 'Schedule Medication Dose' })}
          actionLabel="+ Schedule Dose"
        />
      ) : viewMode === 'Kanban' ? (
        /* Kanban Board View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '14px', alignItems: 'start' }}>
          {columns.map(col => {
            const items = filtered.filter(d => {
              if (col.key === 'Scheduled') return d.stage === 'Scheduled';
              if (col.key === 'Completed') return d.stage === 'Completed' || d.status === 'Given';
              if (col.key === 'Critical') return d.stage === 'Critical' || d.status === 'Overdue' || d.isOverdue;
              if (col.key === 'Awaiting pharmacy') return d.stage === 'Awaiting pharmacy';
              return false;
            });
            return (
              <div
                key={col.key}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  minHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* Column Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{
                    background: col.bg,
                    color: col.fg,
                    border: `1px solid ${col.border}`,
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '11.5px',
                    fontWeight: 700
                  }}>
                    {col.label}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                    {items.length} of {col.count}
                  </span>
                </div>

                {/* Cards List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
                  {items.map(card => {
                    const isCardSelected = selectedCardId === card.id;
                    return (
                      <div
                        key={card.id}
                        onClick={() => handleOpenDrawer(card)}
                        style={{
                          background: '#ffffff',
                          border: isCardSelected ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          boxShadow: isCardSelected ? '0 0 0 1px rgba(13, 148, 136, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
                          transition: 'transform 0.1s, border-color 0.15s, box-shadow 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isCardSelected) {
                            e.currentTarget.style.borderColor = '#94a3b8';
                            e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.06)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCardSelected) {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '12px' }}>
                            {card.bed}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            {card.time}
                          </span>
                        </div>
                        <div style={{ color: '#1e293b', fontSize: '12.5px', marginBottom: '3px', fontWeight: 600 }}>
                          {card.patient}
                        </div>
                        <div style={{ color: '#475569', fontSize: '11.5px', lineHeight: '1.3', marginBottom: '4px' }}>
                          {card.drug} · {card.route}
                        </div>
                        {card.isHighAlert && (
                          <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: '3px', fontSize: '10.5px', fontWeight: 700 }}>
                            High-Alert IV
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '12px' }}>
                      No doses in this lane
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div style={{ ...cardStyle, padding: 0, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 14px' }}>BED</th>
                <th style={{ padding: '12px 14px' }}>PATIENT</th>
                <th style={{ padding: '12px 14px' }}>MEDICATION</th>
                <th style={{ padding: '12px 14px' }}>DOSAGE & ROUTE</th>
                <th style={{ padding: '12px 14px' }}>SCHEDULED TIME</th>
                <th style={{ padding: '12px 14px' }}>STAGE / STATUS</th>
                <th style={{ padding: '12px 14px' }}>HIGH ALERT</th>
                <th style={{ padding: '12px 14px' }}>ADMINISTERED BY / SIGN-OFF</th>
                <th style={{ padding: '12px 14px' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => handleOpenDrawer(row)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                    {row.bed}
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                    {row.patient}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#334155', fontWeight: 600 }}>
                    {row.drug}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#64748b' }}>
                    {row.route}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#0f172a', fontFamily: 'monospace' }}>
                    {row.time}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      background: row.stage === 'Completed' || row.status === 'Given' ? '#dcfce7' : row.stage === 'Critical' || row.status === 'Overdue' ? '#fee2e2' : row.stage === 'Awaiting pharmacy' ? '#ffedd5' : '#fef3c7',
                      color: row.stage === 'Completed' || row.status === 'Given' ? '#15803d' : row.stage === 'Critical' || row.status === 'Overdue' ? '#991b1b' : row.stage === 'Awaiting pharmacy' ? '#9a3412' : '#92400e',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      display: 'inline-block',
                      whiteSpace: 'nowrap'
                    }}>
                      {row.stage || row.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {row.isHighAlert ? (
                      <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        High-Alert
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>Standard</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#64748b' }}>
                    {row.nurse ? `${row.nurse} (${row.signedAt})` : 'Pending'}
                  </td>
                  <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                    {row.status !== 'Given' && row.stage !== 'Completed' && (
                      <button
                        type="button"
                        onClick={() => handleAdminister(row)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: 'none',
                          background: '#059669',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Administer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination Footer */}
          {totalRows > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '12px',
              color: '#64748b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span>
                  Showing <strong>{totalRows > 0 ? startIndex + 1 : 0}</strong>–<strong>{Math.min(startIndex + pageSize, totalRows)}</strong> of <strong>{totalRows}</strong> medication doses
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

                {/* Page Numbers */}
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
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 6. OT & SURGERY (surgeries)
// -----------------------------------------------------------------------------
export function SurgeryOTView({ onOpenDrawer, onOpenModal }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('Kanban'); // 'Kanban' | 'Table'
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedCardId, setSelectedCardId] = useState(null);

  const loadSurgeryData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getSurgeryCases();
      if (res?.data && Array.isArray(res.data)) {
        const mapped = res.data.map(r => ({
          id: r.id,
          code: r.case_number || `SUR-2026-${400 + r.id}`,
          ot: r.ot_suite || '',
          patient: r.patient_name || '',
          procedure: r.procedure_name || '',
          surgeon: r.lead_surgeon || '',
          anesthetist: r.anesthetist || '',
          intraopStage: r.intraop_stage || '',
          stage: r.stage || 'Scheduled',
          start: r.start_time || '',
          end: r.end_time || '',
          status: r.status || 'Active',
          consent: r.consent_status || 'Obtained',
          isEmergency: r.is_emergency ?? false,
          isDelayed: r.is_delayed ?? false,
          bloodReserved: r.blood_reserved || '2 PRBC Reserved',
          sterileVerified: r.sterile_set_verified ?? true,
          pacuBed: r.pacu_bed || ''
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error("Failed to load surgery cases:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSurgeryData();
  }, []);

  const handleRowClick = (s) => {
    setSelectedCardId(s.id);
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${s.code} · ${s.patient}`,
      sub: `${s.procedure} (${s.ot})`,
      badges: [
        {
          t: s.stage,
          bg: s.stage === 'Completed' ? '#dcfce7' : s.stage === 'In progress' ? '#fef3c7' : s.stage === 'Recovery (PACU)' ? '#e0e7ff' : '#f1f5f9',
          fg: s.stage === 'Completed' ? '#15803d' : s.stage === 'In progress' ? '#92400e' : s.stage === 'Recovery (PACU)' ? '#3730a3' : '#334155'
        },
        ...(s.isEmergency ? [{ t: 'Emergency', bg: '#fee2e2', fg: '#dc2626' }] : []),
        ...(s.isDelayed ? [{ t: 'Delayed', bg: '#fee2e2', fg: '#dc2626' }] : [])
      ],
      facts: [
        { k: 'Surgery Case Number', v: s.code, b: true },
        { k: 'Patient Name', v: s.patient, b: true },
        { k: 'Surgical Procedure', v: s.procedure, b: true },
        { k: 'Operating Suite / Room', v: s.ot },
        { k: 'Lead Surgeon', v: s.surgeon },
        { k: 'Anesthetist', v: s.anesthetist },
        { k: 'Current Intra-op Stage', v: s.intraopStage },
        { k: 'Consent Status', v: s.consent },
        { k: 'Blood Bank Cross-Match', v: s.bloodReserved },
        { k: 'Sterile Instrument Tray', v: s.sterileVerified ? 'Verified & Autoclaved' : 'Pending Verification' },
        { k: 'PACU Recovery Bay', v: s.pacuBed || 'Awaiting PACU Handover' },
        { k: 'Operating Hours', v: `${s.start} → ${s.end}` }
      ],
      actions: [
        ...(s.stage === 'Requested' ? [{
          label: 'Approve Surgery Booking',
          primary: true,
          on: async () => {
            try {
              if (s.id) {
                await apiService.updateSurgeryCase(s.id, { stage: 'Approved', status: 'Approved' });
                setData(prev => prev.map(item => item.id === s.id ? { ...item, stage: 'Approved', status: 'Approved' } : item));
              }
            } catch (e) { console.error(e); }
          }
        }] : []),
        ...(s.stage === 'Approved' ? [{
          label: 'Schedule OT Slot & Allocate Team',
          primary: true,
          on: async () => {
            try {
              if (s.id) {
                await apiService.updateSurgeryCase(s.id, { stage: 'Scheduled', status: 'Scheduled' });
                setData(prev => prev.map(item => item.id === s.id ? { ...item, stage: 'Scheduled', status: 'Scheduled' } : item));
              }
            } catch (e) { console.error(e); }
          }
        }] : []),
        ...(s.stage === 'Scheduled' ? [{
          label: 'Call Patient to Pre-op Bay',
          primary: true,
          on: async () => {
            try {
              if (s.id) {
                await apiService.updateSurgeryCase(s.id, { stage: 'Pre-op', status: 'Pre-op' });
                setData(prev => prev.map(item => item.id === s.id ? { ...item, stage: 'Pre-op', status: 'Pre-op' } : item));
              }
            } catch (e) { console.error(e); }
          }
        }] : []),
        ...(s.consent !== 'Obtained' ? [{
          label: 'Sign & Verify Surgical Consent',
          on: async () => {
            try {
              if (s.id) {
                await apiService.updateSurgeryCase(s.id, { consent_status: 'Obtained' });
                setData(prev => prev.map(item => item.id === s.id ? { ...item, consent: 'Obtained' } : item));
              }
            } catch (e) { console.error(e); }
          }
        }] : []),
        ...(s.stage === 'Pre-op' ? [{
          label: 'Transfer Patient to Operating Suite (Start)',
          primary: true,
          on: async () => {
            try {
              if (s.id) {
                await apiService.updateSurgeryCase(s.id, {
                  stage: 'In progress',
                  intraop_stage: 'Patient on Table / Under Anesthesia',
                  status: 'In OT'
                });
                setData(prev => prev.map(item => item.id === s.id ? {
                  ...item,
                  stage: 'In progress',
                  intraopStage: 'Patient on Table / Under Anesthesia',
                  status: 'In OT'
                } : item));
              }
            } catch (e) { console.error(e); }
          }
        }] : []),
        ...(s.stage === 'In progress' ? [{
          label: 'Transition to PACU Recovery',
          primary: true,
          on: async () => {
            try {
              if (s.id) {
                await apiService.updateSurgeryCase(s.id, {
                  stage: 'Recovery (PACU)',
                  intraop_stage: 'In PACU Recovery',
                  status: 'In PACU'
                });
                setData(prev => prev.map(item => item.id === s.id ? {
                  ...item,
                  stage: 'Recovery (PACU)',
                  intraopStage: 'In PACU Recovery',
                  status: 'In PACU'
                } : item));
              }
            } catch (e) { console.error(e); }
          }
        }] : []),
        ...(s.stage === 'Recovery (PACU)' ? [{
          label: 'Discharge PACU to Inpatient Ward / Complete',
          primary: true,
          on: async () => {
            try {
              if (s.id) {
                await apiService.updateSurgeryCase(s.id, {
                  stage: 'Completed',
                  intraop_stage: 'Procedure Completed & Handed Over',
                  status: 'Completed'
                });
                setData(prev => prev.map(item => item.id === s.id ? {
                  ...item,
                  stage: 'Completed',
                  intraopStage: 'Procedure Completed & Handed Over',
                  status: 'Completed'
                } : item));
              }
            } catch (e) { console.error(e); }
          }
        }] : []),
        {
          label: 'Refresh Status from Database',
          on: loadSurgeryData
        }
      ]
    });
  };

  const handleExportCSV = () => {
    if (data.length === 0) return alert('No surgery cases to export.');
    const headers = ['Case #', 'Patient', 'Procedure', 'OT Suite', 'Surgeon', 'Anesthetist', 'Stage', 'Consent', 'Blood Reserved', 'Start Time', 'End Time'];
    const rows = data.map(d => [
      d.code, `"${d.patient}"`, `"${d.procedure}"`, `"${d.ot}"`, `"${d.surgeon}"`, `"${d.anesthetist}"`, `"${d.stage}"`, `"${d.consent}"`, `"${d.bloodReserved}"`, d.start, d.end
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ot_surgery_roster_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic Metric counts derived directly from live database records
  const todaysCasesCount = data.length;
  const inOtNowCount = data.filter(d => d.stage === 'In progress' || d.status === 'In OT').length;
  const awaitingConsentCount = data.filter(d => (d.consent || '').toLowerCase().includes('awaiting') || (d.consent || '').toLowerCase().includes('pending')).length;
  const delayedCount = data.filter(d => Boolean(d.isDelayed)).length;
  const emergencyCount = data.filter(d => Boolean(d.isEmergency)).length;

  // 5 Operational Theaters & Cath Labs
  const theaterRooms = useMemo(() => [
    { name: 'OT-1 (Cardiac)', suiteKey: 'OT-1' },
    { name: 'OT-2 (General)', suiteKey: 'OT-2' },
    { name: 'OT-3 (Ortho)', suiteKey: 'OT-3' },
    { name: 'OT-4 (Emergency)', suiteKey: 'OT-4' },
    { name: 'Cath Lab 1', suiteKey: 'Cath Lab' }
  ], []);

  // Theater live statuses dynamically computed from live database records
  const theaterCards = useMemo(() => {
    return theaterRooms.map(room => {
      const suiteCases = data.filter(d => d.ot && (d.ot.includes(room.suiteKey) || room.suiteKey.includes(d.ot)));
      const activeCase = suiteCases.find(d => d.stage === 'In progress' || d.status === 'In OT');
      const pacuCase = suiteCases.find(d => d.stage === 'Recovery (PACU)');
      const preopCase = suiteCases.find(d => d.stage === 'Pre-op');
      const scheduledCase = suiteCases.find(d => d.stage === 'Scheduled');

      if (activeCase) {
        return {
          name: room.name,
          status: `In use · free ${activeCase.end || 'soon'}`,
          sub: `${activeCase.procedure} (${activeCase.patient})`,
          color: '#0f172a'
        };
      }
      if (pacuCase) {
        return {
          name: room.name,
          status: `Cleaning · free ${pacuCase.end || 'soon'}`,
          sub: `Turnover after PACU transfer`,
          color: '#b45309'
        };
      }
      if (preopCase) {
        return {
          name: room.name,
          status: `Pre-op · start ${preopCase.start || 'soon'}`,
          sub: `${preopCase.procedure} (${preopCase.patient})`,
          color: '#2563eb'
        };
      }
      if (scheduledCase) {
        return {
          name: room.name,
          status: `Scheduled · ${scheduledCase.start || 'today'}`,
          sub: `${scheduledCase.procedure} (${scheduledCase.patient})`,
          color: '#475569'
        };
      }
      return {
        name: room.name,
        status: `Available · Standby`,
        sub: `Ready for booking`,
        color: '#15803d'
      };
    });
  }, [data, theaterRooms]);

  const activeTheatersCount = theaterCards.filter(c => c.status.startsWith('In use') || c.status.startsWith('Cleaning') || c.status.startsWith('Pre-op')).length;
  const otUtilisation = `${Math.round((activeTheatersCount / (theaterRooms.length || 1)) * 100)}%`;

  // Filtering
  const filtered = data.filter(item => {
    const matchesSearch =
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.patient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.procedure.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.surgeon.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ot.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'In OT') return item.stage === 'In progress' || item.status === 'In OT';
    if (selectedFilter === 'Recovery (PACU)') return item.stage === 'Recovery (PACU)';
    if (selectedFilter === 'Completed') return item.stage === 'Completed';
    if (selectedFilter === 'Pre-op') return item.stage === 'Pre-op';
    if (selectedFilter === 'Scheduled') return item.stage === 'Scheduled';
    if (selectedFilter === 'Requested') return item.stage === 'Requested';
    if (selectedFilter === 'Approved') return item.stage === 'Approved';
    if (selectedFilter === 'Cancelled') return item.stage === 'Cancelled';
    return true;
  });

  const filterOptions = ['All', 'Requested', 'Approved', 'Scheduled', 'Pre-op', 'In OT', 'Recovery (PACU)', 'Completed', 'Cancelled'];

  const kanbanColumns = useMemo(() => [
    { key: 'Requested', label: 'Requested', count: data.filter(d => d.stage === 'Requested').length, bg: '#faf5ff', fg: '#6b21a8', border: '#e9d5ff' },
    { key: 'Approved', label: 'Approved', count: data.filter(d => d.stage === 'Approved').length, bg: '#eff6ff', fg: '#1e40af', border: '#bfdbfe' },
    { key: 'Scheduled', label: 'Scheduled', count: data.filter(d => d.stage === 'Scheduled').length, bg: '#fef3c7', fg: '#92400e', border: '#fde68a' },
    { key: 'Pre-op', label: 'Pre-op', count: data.filter(d => d.stage === 'Pre-op').length, bg: '#e0e7ff', fg: '#3730a3', border: '#c7d2fe' },
    { key: 'In progress', label: 'In progress', count: data.filter(d => d.stage === 'In progress' || d.status === 'In OT').length, bg: '#fef3c7', fg: '#92400e', border: '#fde68a' },
    { key: 'Recovery (PACU)', label: 'Recovery (PACU)', count: data.filter(d => d.stage === 'Recovery (PACU)').length, bg: '#e0f2fe', fg: '#0369a1', border: '#bae6fd' },
    { key: 'Completed', label: 'Completed', count: data.filter(d => d.stage === 'Completed').length, bg: '#dcfce7', fg: '#15803d', border: '#bbf7d0' }
  ], [data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header section */}
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
          – Back · Clinical Workspace › OT & Surgery
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
              OT & surgery
            </h1>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
              Request → approval → scheduling → pre-op → consent (surgeon) → anaesthesia → OT → procedure → PACU → post-op → billing · sterile set and reserved blood are hard gates
            </p>
          </div>
        </div>
      </div>

      {/* Search & Export bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: '260px' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 14px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              background: '#ffffff'
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            padding: '7px 16px',
            fontSize: '13px',
            fontWeight: 600,
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Top Metric Cards (Row 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>Today's cases</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{todaysCasesCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>In OT now</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#b45309' }}>{inOtNowCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>Awaiting consent</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#b45309' }}>{awaitingConsentCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>Delayed</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{delayedCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>Emergency</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{emergencyCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>OT utilisation today</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>{otUtilisation}</div>
        </div>
      </div>

      {/* Secondary Theater Live Status Cards (Row 2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {theaterCards.map((card, idx) => (
          <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '2px' }}>{card.name}</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: card.color, marginTop: '2px' }}>{card.status}</div>
            {card.sub && (
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {card.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* View Mode Toggle & Status Filter Bar */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Toggle between Table & Kanban */}
        <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setViewMode('Table')}
            style={{
              padding: '5px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              border: 'none',
              background: viewMode === 'Table' ? '#0f172a' : '#ffffff',
              color: viewMode === 'Table' ? '#ffffff' : '#475569',
              cursor: 'pointer'
            }}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('Kanban')}
            style={{
              padding: '5px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              border: 'none',
              background: viewMode === 'Kanban' ? '#0f172a' : '#ffffff',
              color: viewMode === 'Kanban' ? '#ffffff' : '#475569',
              cursor: 'pointer'
            }}
          >
            Kanban
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {filterOptions.map(f => {
            const isSelected = selectedFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFilter(f)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: isSelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                  background: isSelected ? '#0f172a' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState label="Fetching live OT suite cases from PostgreSQL..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Surgical Cases Found"
          description="There are currently no surgical cases matching your query or filter."
          onAction={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'ot_bookings', title: 'Schedule OT Surgery' })}
          actionLabel="+ Schedule Surgery"
        />
      ) : viewMode === 'Kanban' ? (
        /* Kanban Board View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px', alignItems: 'start' }}>
          {kanbanColumns.map(col => {
            const items = filtered.filter(d => d.stage === col.key || (col.key === 'In progress' && (d.stage === 'In progress' || d.status === 'In OT')));
            return (
              <div
                key={col.key}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px',
                  minHeight: '380px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* Column Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{
                    background: col.bg,
                    color: col.fg,
                    border: `1px solid ${col.border}`,
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '11.5px',
                    fontWeight: 700
                  }}>
                    {col.label}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                    {col.count}
                  </span>
                </div>

                {/* Cards List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map(card => {
                    const isSelected = selectedCardId === card.id;
                    return (
                      <div
                        key={card.id}
                        onClick={() => handleRowClick(card)}
                        style={{
                          background: '#ffffff',
                          border: isSelected ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                          transition: 'transform 0.1s, border-color 0.15s, box-shadow 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#94a3b8';
                            e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.06)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                          }
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px', marginBottom: '2px' }}>
                          {card.code}
                        </div>
                        <div style={{ color: '#334155', fontSize: '12px', marginBottom: '2px', fontWeight: 500 }}>
                          {card.patient}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '11.5px', lineHeight: '1.3' }}>
                          {card.procedure}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '12px' }}>
                      No cases in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div style={{ ...cardStyle, padding: 0, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 14px' }}>CASE #</th>
                <th style={{ padding: '12px 14px' }}>PATIENT</th>
                <th style={{ padding: '12px 14px' }}>PROCEDURE</th>
                <th style={{ padding: '12px 14px' }}>OT SUITE</th>
                <th style={{ padding: '12px 14px' }}>LEAD SURGEON</th>
                <th style={{ padding: '12px 14px' }}>ANESTHETIST</th>
                <th style={{ padding: '12px 14px' }}>STAGE</th>
                <th style={{ padding: '12px 14px' }}>CONSENT</th>
                <th style={{ padding: '12px 14px' }}>TIMELINE</th>
                <th style={{ padding: '12px 14px' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr
                  key={row.id}
                  onClick={() => handleRowClick(row)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                    {row.code}
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                    {row.patient}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#334155', fontWeight: 600 }}>
                    {row.procedure}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#0284c7', fontWeight: 600 }}>
                    {row.ot}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#334155' }}>
                    {row.surgeon}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#64748b' }}>
                    {row.anesthetist}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      background: row.stage === 'Completed' ? '#dcfce7' : row.stage === 'In progress' ? '#fef3c7' : row.stage === 'Recovery (PACU)' ? '#e0e7ff' : '#f1f5f9',
                      color: row.stage === 'Completed' ? '#15803d' : row.stage === 'In progress' ? '#92400e' : row.stage === 'Recovery (PACU)' ? '#3730a3' : '#334155',
                      padding: '3px 10px',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      display: 'inline-block',
                      whiteSpace: 'nowrap'
                    }}>
                      {row.stage}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{
                      background: row.consent === 'Obtained' ? '#dcfce7' : '#fef3c7',
                      color: row.consent === 'Obtained' ? '#15803d' : '#92400e',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      {row.consent}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#0f172a', fontFamily: 'monospace' }}>
                    {row.start} → {row.end}
                  </td>
                  <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                    {row.stage !== 'Completed' && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (row.id) {
                              await apiService.updateSurgeryCase(row.id, {
                                stage: 'Completed',
                                intraop_stage: 'Procedure Completed',
                                status: 'Completed'
                              });
                              setData(prev => prev.map(item => item.id === row.id ? { ...item, stage: 'Completed' } : item));
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function printBloodRequisitionSlip(b) {
  const printWindow = window.open('', '_blank', 'width=800,height=850');
  if (!printWindow) {
    alert('Popup blocker prevented print window from opening. Please allow popups.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Blood Requisition - ${b.unitId}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 36px; color: #1e293b; line-height: 1.5; }
        .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 20px; }
        .title { font-size: 17px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin: 0 0 6px; letter-spacing: 0.04em; }
        .sub { font-size: 12px; color: #475569; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; }
        th { background: #f8fafc; color: #475569; width: 35%; font-weight: 600; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 12px; }
        .sign { display: flex; justify-content: space-between; margin-top: 50px; }
        .sign-b { text-align: center; width: 220px; }
        .line { border-top: 1px solid #475569; margin-bottom: 6px; }
        .btn { background: #0f172a; color: #fff; border: none; padding: 8px 18px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer; margin-bottom: 16px; }
        @media print { .no-print { display: none !important; } body { margin: 20px; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: right;">
        <button class="btn" onclick="window.print()">🖨️ Print Requisition Slip</button>
      </div>
      <div class="header">
        <div class="title">Blood Component Transfusion & Compatibility Requisition</div>
        <div class="sub">Department of Transfusion Medicine & Blood Center</div>
      </div>
      <table>
        <tr>
          <th>Requisition / Unit ID</th>
          <td><strong>${b.unitId}</strong></td>
        </tr>
        <tr>
          <th>Patient Name</th>
          <td><strong>${b.reservedFor || 'Unassigned / General Stock'}</strong></td>
        </tr>
        <tr>
          <th>Blood Group & Rh</th>
          <td><span style="font-size: 16px; font-weight: 800; color: #b91c1c;">${b.group}</span></td>
        </tr>
        <tr>
          <th>Component Type</th>
          <td><strong>${b.component}</strong></td>
        </tr>
        <tr>
          <th>Indication / Procedure</th>
          <td>${b.screening}</td>
        </tr>
        <tr>
          <th>Requisition Info</th>
          <td>${b.collected}</td>
        </tr>
        <tr>
          <th>Expiry / Target Hour</th>
          <td>${b.expiry}</td>
        </tr>
        <tr>
          <th>Storage Location</th>
          <td>${b.storage}</td>
        </tr>
        <tr>
          <th>Compatibility & Status</th>
          <td><span class="badge" style="background: #dcfce7; color: #15803d;">${b.status}</span></td>
        </tr>
      </table>
      <div class="sign">
        <div class="sign-b">
          <div class="line"></div>
          <div><strong>Blood Bank Medical Officer</strong></div>
          <div style="font-size: 11px; color: #64748b;">Transfusion Medicine Service</div>
        </div>
        <div class="sign-b" style="border: 2px dashed #cbd5e1; padding: 10px; border-radius: 4px;">
          <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Transfusion Medicine Division</div>
          <div style="font-size: 10px; color: #64748b;">Authenticated Official Seal</div>
        </div>
        <div class="sign-b">
          <div class="line"></div>
          <div><strong>Transfusion Nurse / Ward Incharge</strong></div>
          <div style="font-size: 11px; color: #64748b;">Bedside Verification Sign-off</div>
        </div>
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// -----------------------------------------------------------------------------
// 7. BLOOD BANK (bloodbank)
// -----------------------------------------------------------------------------
export function BloodBankView({ onOpenDrawer, onOpenModal }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  const loadBloodData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getBloodInventory();
      if (res?.data && Array.isArray(res.data)) {
        const mapped = res.data.map(r => ({
          id: r.id,
          unitId: r.unit_id || '',
          group: r.blood_group || '',
          component: r.component_type || '',
          collected: r.collected_info || '',
          expiry: r.expiry_info || '',
          screening: r.screening_notes || '',
          storage: r.storage_location || '—',
          reservedFor: r.reserved_for || '—',
          status: r.status || 'Active · available'
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error("Failed to load blood inventory:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBloodData();
  }, []);

  const handleRowClick = (b) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${b.unitId} · ${b.group} ${b.component}`,
      sub: `Reserved For: ${b.reservedFor} | Storage: ${b.storage}`,
      badges: [
        {
          t: b.status,
          bg: b.status.includes('available') || b.status === 'Completed' ? '#dcfce7' : b.status.includes('reserved') ? '#f1f5f9' : b.status.includes('requested') || b.status === 'Quarantine' ? '#fef3c7' : '#fee2e2',
          fg: b.status.includes('available') || b.status === 'Completed' ? '#15803d' : b.status.includes('reserved') ? '#475569' : b.status.includes('requested') || b.status === 'Quarantine' ? '#92400e' : '#dc2626'
        }
      ],
      facts: [
        { k: 'Unit / Requisition ID', v: b.unitId, b: true },
        { k: 'ABO & Rh Blood Group', v: b.group, b: true },
        { k: 'Blood Component', v: b.component, b: true },
        { k: 'Collection / Request Info', v: b.collected },
        { k: 'Expiry / Target Time', v: b.expiry },
        { k: 'Screening & Cross-Match', v: b.screening },
        { k: 'Cold-Chain Storage Location', v: b.storage },
        { k: 'Reserved Patient', v: b.reservedFor },
        { k: 'Status', v: b.status }
      ],
      actions: [
        {
          label: 'Issue Blood Unit for Transfusion',
          primary: true,
          on: async () => {
            try {
              if (b.unitId) {
                await apiService.updateBloodUnit(b.unitId, { status: 'Transfused · Completed' });
                const updated = { ...b, status: 'Transfused · Completed' };
                setData(prev => prev.map(item => item.unitId === b.unitId ? updated : item));
                handleRowClick(updated);
              }
            } catch (e) {
              console.error(e);
              alert('Error updating blood unit in database');
            }
          }
        },
        {
          label: 'Cross-Match & Reserve Unit',
          on: async () => {
            try {
              if (b.unitId) {
                await apiService.updateBloodUnit(b.unitId, { status: 'Cross-matched · reserved' });
                const updated = { ...b, status: 'Cross-matched · reserved' };
                setData(prev => prev.map(item => item.unitId === b.unitId ? updated : item));
                handleRowClick(updated);
              }
            } catch (e) {
              console.error(e);
              alert('Error updating blood unit in database');
            }
          }
        },
        {
          label: '🖨️ Print Transfusion Requisition Slip',
          on: () => printBloodRequisitionSlip(b)
        }
      ]
    });
  };

  const handleExportCSV = () => {
    if (data.length === 0) return alert('No blood bank data to export.');
    const headers = ['Unit ID', 'Blood Group', 'Component', 'Collected', 'Expiry', 'Screening Notes', 'Storage Location', 'Reserved For', 'Status'];
    const rows = data.map(d => [
      d.unitId, d.group, d.component, `"${d.collected}"`, `"${d.expiry}"`, `"${d.screening}"`, `"${d.storage}"`, `"${d.reservedFor}"`, `"${d.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `blood_bank_inventory_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic Metrics derived directly from live database records
  const requestsOpenCount = data.filter(d => d.unitId.startsWith('BR-') && !d.status.includes('Completed') && !d.status.includes('Transfused')).length;
  const availableUnitsCount = data.filter(d => d.status.includes('available')).length;
  const reservedCount = data.filter(d => d.status.includes('reserved')).length;
  const quarantineCount = data.filter(d => d.status.includes('Quarantine')).length;
  const expiredCount = data.filter(d => d.status.includes('Expired') || d.status.includes('Discarded')).length;
  const oNegAvailableCount = data.filter(d => d.group === 'O-' && d.status.includes('available')).length;

  // Dynamic Requisition Notice Banner
  const activeRequestsBanner = useMemo(() => {
    const reqs = data.filter(d => d.unitId.startsWith('BR-'));
    if (reqs.length === 0) return 'No active requisitions pending.';
    return reqs.slice(0, 4).map(r => `${r.unitId} · ${r.reservedFor} · ${r.group} ${r.component} · ${r.status}`).join(' | ');
  }, [data]);

  // Filter & Search
  const filtered = data.filter(item => {
    const matchesSearch =
      item.unitId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.group.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.component.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.screening.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.storage.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reservedFor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.status.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Available') return item.status.includes('available');
    if (selectedFilter === 'Reserved') return item.status.includes('reserved');
    if (selectedFilter === 'Issued') return item.status.includes('Issued');
    if (selectedFilter === 'Transfused') return item.status === 'Completed' || item.status.includes('Transfused');
    if (selectedFilter === 'Quarantine') return item.status === 'Quarantine';
    if (selectedFilter === 'Expired') return item.status === 'Expired';
    if (selectedFilter === 'Discarded') return item.status === 'Discarded';
    return true;
  });

  const filterOptions = ['All', 'Available', 'Reserved', 'Issued', 'Transfused', 'Quarantine', 'Expired', 'Discarded'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header section */}
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
          – Back · Clinical Workspace › Blood Bank
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
              Blood bank
            </h1>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
              Request → compatibility → cross-match → reserve → issue → transfusion → reaction record → traceability · expired units are discarded, never issued
            </p>
          </div>
        </div>
      </div>

      {/* Search & Export bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: '260px' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 14px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              background: '#ffffff'
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            padding: '7px 16px',
            fontSize: '13px',
            fontWeight: 600,
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Cyan / Light Blue Requisition Notice Banner */}
      <div style={{
        background: '#ecfeff',
        border: '1px solid #a5f3fc',
        borderRadius: '6px',
        padding: '10px 14px',
        color: '#0e7490',
        fontSize: '12.5px',
        fontWeight: 500,
        lineHeight: '1.4'
      }}>
        <strong>Requests:</strong> {activeRequestsBanner} — click any request in the table below to cross-match or issue for transfusion.
      </div>

      {/* 6 Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Requests open</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b45309' }}>{requestsOpenCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Available units</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#15803d' }}>{availableUnitsCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Reserved</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b45309' }}>{reservedCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Quarantine (screening)</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b45309' }}>{quarantineCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Expired / wastage</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{expiredCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>O- available</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#15803d' }}>{oNegAvailableCount}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {filterOptions.map(f => {
          const isSelected = selectedFilter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setSelectedFilter(f)}
              style={{
                padding: '5px 14px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 600,
                border: isSelected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                background: isSelected ? '#0f172a' : '#ffffff',
                color: isSelected ? '#ffffff' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Live Data Table */}
      {loading ? (
        <LoadingState label="Fetching live blood bank units from PostgreSQL..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Blood Units Found"
          description="There are currently no blood units matching your query or filter."
          onAction={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'blood_requests', title: 'Raise Emergency Blood Requisition' })}
          actionLabel="+ Request Blood"
        />
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', minWidth: '980px' }}>
            <thead>
              <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 14px' }}>UNIT</th>
                <th style={{ padding: '12px 14px' }}>GROUP</th>
                <th style={{ padding: '12px 14px' }}>COMPONENT</th>
                <th style={{ padding: '12px 14px' }}>COLLECTED</th>
                <th style={{ padding: '12px 14px' }}>EXPIRY</th>
                <th style={{ padding: '12px 14px' }}>SCREENING</th>
                <th style={{ padding: '12px 14px' }}>STORAGE</th>
                <th style={{ padding: '12px 14px' }}>RESERVED FOR</th>
                <th style={{ padding: '12px 14px' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const isCrossMatched = row.status.includes('Cross-matched');
                const isRequested = row.status.includes('requested');
                const isCompleted = row.status === 'Completed';
                const isAvailable = row.status.includes('available');
                const isQuarantine = row.status === 'Quarantine';
                const isExpired = row.status === 'Expired';
                const isDiscarded = row.status === 'Discarded';

                return (
                  <tr
                    key={row.id || row.unitId}
                    onClick={() => handleRowClick(row)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {row.unitId}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {row.group}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155', fontWeight: 500 }}>
                      {row.component}
                    </td>
                    <td style={{ padding: '12px 14px', color: row.collected.includes('REQUEST') ? '#0f172a' : '#64748b', fontWeight: row.collected.includes('REQUEST') ? 600 : 400 }}>
                      {row.collected}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a', fontFamily: 'monospace' }}>
                      {row.expiry}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      {row.screening}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {row.storage}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a', fontWeight: row.reservedFor !== '—' ? 600 : 400 }}>
                      {row.reservedFor}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: isAvailable || isCompleted ? '#dcfce7' : isCrossMatched ? '#f1f5f9' : isRequested ? '#fef3c7' : isQuarantine ? '#fef9c3' : isExpired ? '#fee2e2' : '#e2e8f0',
                        color: isAvailable || isCompleted ? '#15803d' : isCrossMatched ? '#475569' : isRequested ? '#92400e' : isQuarantine ? '#854d0e' : isExpired ? '#991b1b' : '#475569',
                        padding: '3px 10px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        display: 'inline-block',
                        whiteSpace: 'nowrap'
                      }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 8. LAB DASHBOARD & LIS (lab)
// -----------------------------------------------------------------------------
const LAB_ORDERS = [
  { id: 'LAB-8801', patient: 'Saanvier Parthalan', uhid: 'MER-PAT-0087227', test: 'HbA1c + Serum Ketones', dept: 'Biochemistry', priority: 'Stat', tat: '24m', status: 'Authorized', result: 'HbA1c 9.4% · Ketones Neg' },
  { id: 'LAB-8802', patient: 'Kavitha Raman', uhid: 'MER-PAT-0087221', test: 'hs-Troponin I (High Sensitivity)', dept: 'Biochemistry', priority: 'Critical', tat: '12m', status: 'Flagged Critical', result: '53.2 pg/mL (Ref < 15.6)' },
  { id: 'LAB-8803', patient: 'Christoer Parthalan', uhid: 'MER-PAT-0087233', test: 'CBC + Absolute Neutrophils', dept: 'Hematology', priority: 'Urgent', tat: '18m', status: 'Analyzing', result: 'WBC 14,800/mcL' },
  { id: 'LAB-8804', patient: 'Sundaram K.', uhid: 'MER-PAT-0087228', test: 'Coagulation Profile (PT/INR, aPTT)', dept: 'Hematology', priority: 'Routine', tat: '45m', status: 'Authorized', result: 'INR 1.08 · aPTT 31s' },
  { id: 'LAB-8805', patient: 'Deepa Natarajan', uhid: 'MER-PAT-0087242', test: 'Urine Routine & Microalbumin', dept: 'Clinical Path', priority: 'Routine', tat: '30m', status: 'Sample Collected', result: 'Pending Analyzer' },
];

export function LabDashboardView({ onOpenDrawer, onOpenModal }) {
  const handleLabClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.id} · ${row.test}`,
      sub: `Patient: ${row.patient} (${row.uhid}) · Discipline: ${row.dept}`,
      badges: [
        { t: row.status, bg: row.status === 'Flagged Critical' ? '#fee2e2' : '#dcfce7', fg: row.status === 'Flagged Critical' ? '#991b1b' : '#15803d' },
        { t: `TAT ${row.tat}`, bg: '#f1f5f9', fg: '#334155' }
      ],
      facts: [
        { k: 'Accession ID', v: row.id, b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'UHID / MRN', v: row.uhid },
        { k: 'Investigation', v: row.test },
        { k: 'Discipline', v: row.dept },
        { k: 'Turnaround Time', v: row.tat },
        { k: 'Status', v: row.status },
        { k: 'Laboratory Result', v: row.result }
      ],
      actions: [
        { label: 'Validate & Sign Out Result', primary: true, on: () => alert(`Validated result for ${row.patient}`) },
        { label: 'Trigger Clinical Recoll' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Laboratory Information System (LIS) Dashboard"
        subtitle="Automated analyzer interfaces, critical value verification, turnaround times, and specimen tracking"
        count={LAB_ORDERS.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'services', title: 'Add Diagnostic Lab Test Service' })}
        newLabel="+ Order Lab Test"
        onExport={() => alert('Exported LIS logs')}
      />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Specimens Processed Today" value="148" sub="Biochem, Hematology, Micro" color="#0284c7" />
        <StatCard label="Flagged Critical Values" value="1" sub="hs-Troponin 53.2 pg/mL alert" color="#dc2626" />
        <StatCard label="Average LIS TAT" value="28 mins" sub="Within CAP/NABL 45 min target" color="#059669" />
        <StatCard label="Automated Analyzer Link" value="4 Online" sub="Sysmex, Beckman, Roche Cobas" color="#475569" />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Order ID</th>
              <th style={{ padding: '10px 14px' }}>Patient / UHID</th>
              <th style={{ padding: '10px 14px' }}>Investigation Requested</th>
              <th style={{ padding: '10px 14px' }}>Discipline</th>
              <th style={{ padding: '10px 14px' }}>TAT</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
              <th style={{ padding: '10px 14px' }}>Verified Result</th>
            </tr>
          </thead>
          <tbody>
            {LAB_ORDERS.map(row => (
              <tr key={row.id} onClick={() => handleLabClick(row)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{row.id}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600 }}>{row.patient}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.uhid}</div>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{row.test}</td>
                <td style={{ padding: '10px 14px' }}>{row.dept}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{row.tat}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.status === 'Flagged Critical' ? '#fee2e2' : row.status === 'Authorized' ? '#dcfce7' : '#fef3c7',
                    row.status === 'Flagged Critical' ? '#991b1b' : row.status === 'Authorized' ? '#166534' : '#92400e'
                  )}>
                    ● {row.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 500, color: row.status === 'Flagged Critical' ? '#dc2626' : '#334155' }}>
                  {row.result}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 9. BILLING & CLEARANCE (billing)
// -----------------------------------------------------------------------------
const BILLING_RECORDS = [
  { inv: 'INV-2026-901', patient: 'Saanvier Parthalan', uhid: 'MER-PAT-0087227', adm: 'MER-ADM-0087226', total: 68400, tpa: 52000, patientShare: 16400, pharmacyClear: true, dischargeClear: true, status: 'Cleared for Discharge' },
  { inv: 'INV-2026-902', patient: 'Kavitha Raman', uhid: 'MER-PAT-0087221', adm: 'MER-ADM-0087220', total: 142000, tpa: 120000, patientShare: 22000, pharmacyClear: true, dischargeClear: false, status: 'Final Authorization Pending' },
  { inv: 'INV-2026-903', patient: 'Christoer Parthalan', uhid: 'MER-PAT-0087233', adm: 'MER-ADM-0087232', total: 45000, tpa: 35000, patientShare: 10000, pharmacyClear: true, dischargeClear: true, status: 'Cleared for Discharge' },
  { inv: 'INV-2026-904', patient: 'Sundaram K.', uhid: 'MER-PAT-0087228', adm: 'MER-ADM-0087227', total: 92000, tpa: 75000, patientShare: 17000, pharmacyClear: false, dischargeClear: false, status: 'Pharmacy Clearance Due' },
  { inv: 'INV-2026-905', patient: 'Lakshmi Narayanan', uhid: 'MER-PAT-0087230', adm: 'MER-ADM-0087229', total: 31000, tpa: 25000, patientShare: 6000, pharmacyClear: true, dischargeClear: true, status: 'Settled' },
];

export function BillingView({ onOpenDrawer, onOpenModal }) {
  const handleBillClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.inv} · ${row.patient}`,
      sub: `Gross: ₹${row.total.toLocaleString()} · Insurance: ₹${row.tpa.toLocaleString()} · Due: ₹${row.patientShare.toLocaleString()}`,
      badges: [
        { t: row.status, bg: row.dischargeClear ? '#dcfce7' : '#fef3c7', fg: row.dischargeClear ? '#15803d' : '#92400e' }
      ],
      facts: [
        { k: 'Invoice Number', v: row.inv, b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'UHID / MRN', v: row.uhid },
        { k: 'Admission Encounter', v: row.adm },
        { k: 'Total Gross Amount', v: `₹${row.total.toLocaleString()}` },
        { k: 'Insurance / TPA Share', v: `₹${row.tpa.toLocaleString()}` },
        { k: 'Patient Co-Pay Balance', v: `₹${row.patientShare.toLocaleString()}` },
        { k: 'Pharmacy Clearance', v: row.pharmacyClear ? 'Cleared' : 'Pending' },
        { k: 'Financial Status', v: row.status }
      ],
      actions: [
        { label: 'Issue Discharge Gate Pass', primary: true, on: () => alert(`Gate pass issued for ${row.patient}`) },
        { label: 'Collect Co-Pay Online' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Patient Billing, Invoicing & Clearance Desk"
        subtitle="Inpatient bed charges, pharmacy reconciliations, TPA co-pay settlement, and discharge financial gate passes"
        count={BILLING_RECORDS.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'services', title: 'Add Billable Item / Service' })}
        newLabel="+ Generate Bill"
        onExport={() => alert('Exported financial ledger')}
      />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Gross Revenue Invoiced" value="₹3,78,400" sub="5 Inpatients actively tracked" color="#0284c7" />
        <StatCard label="TPA Pre-Auth Settlement" value="₹3,07,000" sub="81% Cashless Insurance Share" color="#059669" />
        <StatCard label="Patient Co-Pay Balance" value="₹71,400" sub="Due at discharge billing desk" color="#d97706" />
        <StatCard label="Gate Passes Issued" value="3 Ready" sub="Zero financial holds" color="#475569" />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Invoice ID</th>
              <th style={{ padding: '10px 14px' }}>Patient / UHID</th>
              <th style={{ padding: '10px 14px' }}>Total Charges</th>
              <th style={{ padding: '10px 14px' }}>Insurance Share</th>
              <th style={{ padding: '10px 14px' }}>Patient Due</th>
              <th style={{ padding: '10px 14px' }}>Pharmacy Check</th>
              <th style={{ padding: '10px 14px' }}>Financial Status</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Gate Pass</th>
            </tr>
          </thead>
          <tbody>
            {BILLING_RECORDS.map(row => (
              <tr key={row.inv} onClick={() => handleBillClick(row)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{row.inv}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600 }}>{row.patient}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.uhid}</div>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>₹{row.total.toLocaleString()}</td>
                <td style={{ padding: '10px 14px', color: '#059669' }}>₹{row.tpa.toLocaleString()}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#dc2626' }}>₹{row.patientShare.toLocaleString()}</td>
                <td style={{ padding: '10px 14px' }}>
                  {row.pharmacyClear ? <span style={{ color: '#059669', fontWeight: 700 }}>✓ Cleared</span> : <span style={{ color: '#d97706', fontWeight: 600 }}>⏳ Due</span>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.dischargeClear ? '#dcfce7' : '#fef3c7',
                    row.dischargeClear ? '#15803d' : '#92400e'
                  )}>
                    ● {row.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <button type="button" onClick={() => alert(`Generated Gate Pass for ${row.patient}`)} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                    Print Slip
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 10. INSURANCE & CLAIMS (insurance)
// -----------------------------------------------------------------------------
const CLAIMS_DATA = [
  { claim: 'CLM-7701', patient: 'Saanvier Parthalan', tpa: 'Star Health Insurance', policy: 'SH-884920-IND', sumInsured: 500000, initialAuth: 50000, finalClaimed: 52000, status: 'Settled & Approved', turnaround: '2.4 hrs' },
  { claim: 'CLM-7702', patient: 'Kavitha Raman', tpa: 'Medi Assist TPA / ICICI', policy: 'MA-99210-CORP', sumInsured: 800000, initialAuth: 100000, finalClaimed: 120000, status: 'Final Enhancement Under Review', turnaround: '1.8 hrs' },
  { claim: 'CLM-7703', patient: 'Christoer Parthalan', tpa: 'Vidal Health Insurance', policy: 'VH-44102-IND', sumInsured: 300000, initialAuth: 35000, finalClaimed: 35000, status: 'Settled & Approved', turnaround: '3.1 hrs' },
  { claim: 'CLM-7704', patient: 'Sundaram K.', tpa: 'HDFC ERGO General', policy: 'HD-66290-FAM', sumInsured: 1000000, initialAuth: 60000, finalClaimed: 75000, status: 'Query Raised: Implant Invoice', turnaround: '4.2 hrs' },
];

export function InsuranceView({ onOpenDrawer, onOpenModal }) {
  const handleInsClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.claim} · ${row.patient}`,
      sub: `${row.tpa} · Policy: ${row.policy}`,
      badges: [
        { t: row.status, bg: row.status.includes('Approved') ? '#dcfce7' : row.status.includes('Query') ? '#fee2e2' : '#fef3c7', fg: row.status.includes('Approved') ? '#15803d' : row.status.includes('Query') ? '#991b1b' : '#92400e' }
      ],
      facts: [
        { k: 'Claim Identifier', v: row.claim, b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'TPA / Insurer', v: row.tpa },
        { k: 'Policy Number', v: row.policy },
        { k: 'Sum Insured', v: `₹${row.sumInsured.toLocaleString()}` },
        { k: 'Initial Auth', v: `₹${row.initialAuth.toLocaleString()}` },
        { k: 'Final Claimed', v: `₹${row.finalClaimed.toLocaleString()}` },
        { k: 'Turnaround Time', v: row.turnaround },
        { k: 'Pre-auth Status', v: row.status }
      ],
      actions: [
        { label: 'Submit Enhancement', primary: true, on: () => alert(`Enhancement submitted for ${row.patient}`) },
        { label: 'Upload Query Response' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Insurance & TPA Cashless Claims Desk"
        subtitle="Pre-authorization processing, final cashless enhancements, query resolutions, and settlement remittances"
        count={CLAIMS_DATA.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'insurers', title: 'Add Insurer / TPA Provider' })}
        newLabel="+ Add Insurer"
        onExport={() => alert('Exported claims desk data')}
      />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Claims Under Process" value="₹2,82,000" sub="4 Cashless IP Admissions" color="#0284c7" />
        <StatCard label="Approved & Authorized" value="₹2,45,000" sub="87% Cashless Approval Ratio" color="#059669" />
        <StatCard label="Queries Pending" value="1" sub="Implant sticker & batch number" color="#d97706" />
        <StatCard label="Disallowance Risk" value="1.4%" sub="Well below hospital target 3%" color="#475569" />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Claim ID</th>
              <th style={{ padding: '10px 14px' }}>Patient</th>
              <th style={{ padding: '10px 14px' }}>TPA / Insurer</th>
              <th style={{ padding: '10px 14px' }}>Policy No</th>
              <th style={{ padding: '10px 14px' }}>Claimed Amount</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
              <th style={{ padding: '10px 14px' }}>TAT</th>
            </tr>
          </thead>
          <tbody>
            {CLAIMS_DATA.map(row => (
              <tr
                key={row.claim}
                onClick={() => handleInsClick(row)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{row.claim}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.patient}</td>
                <td style={{ padding: '10px 14px', color: '#0f766e', fontWeight: 600 }}>{row.tpa}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{row.policy}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>₹{row.finalClaimed.toLocaleString()}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.status.includes('Approved') ? '#dcfce7' : row.status.includes('Query') ? '#fee2e2' : '#fef3c7',
                    row.status.includes('Approved') ? '#15803d' : row.status.includes('Query') ? '#991b1b' : '#92400e'
                  )}>
                    ● {row.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: '#64748b' }}>{row.turnaround}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 11. SBAR WARD HANDOVER (sbar)
// -----------------------------------------------------------------------------
export function SbarView({ onOpenDrawer, onOpenModal }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getSbarHandovers().catch(() => ({ data: [] }));
      if (res?.data && Array.isArray(res.data)) {
        const mapped = res.data.map(r => ({
          id: r.id,
          bed: r.bed_no || '',
          patient: r.patient_name || '',
          uhid: r.uhid || '',
          ageGender: r.age_gender || '',
          ews: r.ews || '',
          marDue: r.mar_due || '',
          lastHandover: r.last_handover_time || '',
          fromNurse: r.from_nurse || '',
          toNurse: r.to_nurse || '',
          situation: r.situation || '',
          background: r.background || '',
          assessment: r.assessment || '',
          recommendation: r.recommendation || '',
          sbarFull: r.sbar_full || (r.situation ? `S: ${r.situation} B: ${r.background} A: ${r.assessment} R: ${r.recommendation}` : 'No handover recorded'),
          status: r.status || (r.sbar_full?.includes('No handover') ? 'Missing' : 'Stale'),
          handoverShift: r.handover_shift || 'Morning (07:00 - 15:00)',
          acknowledged: r.acknowledged ?? false
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error("Failed to load SBAR handovers:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRowClick = (row) => {
    if (!onOpenDrawer) return;
    const isMissing = row.status === 'Missing' || !row.situation;
    onOpenDrawer({
      title: `${row.bed ? row.bed + ' · ' : ''}${row.patient}`,
      sub: row.lastHandover ? `Last Handover: ${row.lastHandover}` : 'No handover on file for this patient',
      badges: [
        {
          t: row.status,
          bg: row.status === 'Current' ? '#dcfce7' : row.status === 'Missing' ? '#fee2e2' : '#f1f5f9',
          fg: row.status === 'Current' ? '#15803d' : row.status === 'Missing' ? '#dc2626' : '#475569'
        },
        ...(row.ews ? [{ t: `EWS: ${row.ews}`, bg: row.ews.includes('Normal') ? '#dcfce7' : '#fee2e2', fg: row.ews.includes('Normal') ? '#15803d' : '#dc2626' }] : []),
        ...(row.marDue ? [{ t: `MAR: ${row.marDue}`, bg: '#fef3c7', fg: '#b45309' }] : [])
      ],
      facts: [
        { k: 'Bed / Ward Location', v: row.bed || 'Unassigned / Step-Down', b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'UHID', v: row.uhid || 'MER-PAT-0087101' },
        { k: 'EWS Status', v: row.ews || 'Not Recorded' },
        { k: 'MAR Due Status', v: row.marDue || 'All scheduled doses clear' },
        { k: 'Last Shift Handover', v: row.lastHandover || 'None recorded' },
        { k: 'Situation (S)', v: row.situation || (isMissing ? 'No situation recorded yet' : '') },
        { k: 'Background (B)', v: row.background || (isMissing ? 'No background recorded yet' : '') },
        { k: 'Assessment (A)', v: row.assessment || (isMissing ? 'No assessment recorded yet' : '') },
        { k: 'Recommendation (R)', v: row.recommendation || (isMissing ? 'No recommendation recorded yet' : '') }
      ],
      actions: [
        {
          label: isMissing ? 'Record SBAR Handover' : 'Update SBAR Handover Note',
          primary: true,
          on: () => {
            const sit = prompt('Enter [S] Situation:', row.situation || '');
            if (!sit) return;
            const bg = prompt('Enter [B] Background:', row.background || '');
            const ass = prompt('Enter [A] Assessment:', row.assessment || 'stable, vitals normal');
            const rec = prompt('Enter [R] Recommendation:', row.recommendation || 'continue clinical plan');
            const nurse = prompt('Enter Your Nurse Name:', 'Sheela J');

            const sbarFull = `S: ${sit} B: ${bg} A: ${ass} R: ${rec}`;
            const timeStr = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${nurse}`;

            apiService.updateSbarHandover(row.id, {
              situation: sit,
              background: bg,
              assessment: ass,
              recommendation: rec,
              sbar_full: sbarFull,
              from_nurse: nurse,
              last_handover_time: timeStr,
              status: 'Current'
            }).then(() => {
              loadData();
              alert(`SBAR Handover recorded for ${row.patient}`);
            }).catch(err => {
              console.error(err);
              loadData();
            });
          }
        },
        {
          label: 'Acknowledge Shift Handover',
          on: async () => {
            try {
              if (row.id) await apiService.acknowledgeSbarHandover(row.id);
              loadData();
              alert(`Handover acknowledged for ${row.patient}`);
            } catch (e) {
              loadData();
            }
          }
        }
      ]
    });
  };

  const handleExportCSV = () => {
    if (data.length === 0) return alert('No SBAR handover records to export.');
    const headers = ['Bed', 'Patient', 'EWS', 'MAR Due', 'Last Handover', 'SBAR (Latest)', 'Status'];
    const rows = data.map(d => [
      `"${d.bed}"`, `"${d.patient}"`, `"${d.ews || '—'}"`, `"${d.marDue || '—'}"`, `"${d.lastHandover || '—'}"`, `"${d.sbarFull}"`, `"${d.status}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ward_sbar_handovers_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics calculation
  const totalPatients = data.length;
  const handoverRecordedThisShift = data.filter(d => d.status === 'Current').length;
  const noHandoverCount = data.filter(d => d.status === 'Missing' || !d.sbarFull || d.sbarFull.includes('No handover')).length;
  const ewsHighCount = data.filter(d => {
    if (!d.ews) return false;
    const num = parseInt(d.ews.replace(/\D/g, ''), 10);
    return !isNaN(num) && num >= 3;
  }).length;
  const marDueCount = data.filter(d => d.marDue && (d.marDue.includes('due') || d.marDue.includes('overdue') || parseInt(d.marDue) > 0)).length;

  // Filtered rows & pagination
  const filtered = data.filter(item => {
    const q = searchQuery.toLowerCase();
    return (
      item.bed.toLowerCase().includes(q) ||
      item.patient.toLowerCase().includes(q) ||
      item.ews.toLowerCase().includes(q) ||
      item.marDue.toLowerCase().includes(q) ||
      item.lastHandover.toLowerCase().includes(q) ||
      item.sbarFull.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header section */}
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
          – Back · Clinical Workspace › Ward Handover (SBAR)
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
              Ward handover · SBAR · inpatients
            </h1>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
              Latest SBAR handover per patient with EWS and open work. Nurses record a handover from the patient row; Situation · Background · Assessment · Recommendation.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Export bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: '260px' }}>
          <input
            type="text"
            placeholder="Search by patient, bed, EWS, diagnosis..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            style={{
              width: '100%',
              padding: '7px 14px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              background: '#ffffff'
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            padding: '7px 16px',
            fontSize: '13px',
            fontWeight: 600,
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          Export CSV
        </button>
      </div>

      {/* 5 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Patients</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>{totalPatients}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Handover recorded this shift</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#16a34a' }}>{handoverRecordedThisShift}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>No handover on file</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{noHandoverCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>EWS ≥ 3</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{ewsHighCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>MAR due / overdue</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b45309' }}>{marDueCount}</div>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <LoadingState label="Fetching live SBAR handovers from PostgreSQL..." />
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 14px', width: '90px' }}>BED</th>
                <th style={{ padding: '12px 14px', width: '180px' }}>PATIENT</th>
                <th style={{ padding: '12px 14px', width: '100px' }}>EWS</th>
                <th style={{ padding: '12px 14px', width: '100px' }}>MAR DUE</th>
                <th style={{ padding: '12px 14px', width: '140px' }}>LAST HANDOVER</th>
                <th style={{ padding: '12px 14px' }}>SBAR (LATEST)</th>
                <th style={{ padding: '12px 14px', width: '90px' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px', marginBottom: '4px' }}>
                      Nothing matches
                    </div>
                    <div style={{ color: '#64748b', fontSize: '12.5px' }}>
                      No handover records match this search. Clear the search input.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map(row => {
                  const isMissing = row.status === 'Missing' || !row.situation;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => handleRowClick(row)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                        {row.bed || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                        {row.patient}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {row.ews ? (
                          <span style={{
                            background: row.ews.includes('Normal') ? '#dcfce7' : '#fee2e2',
                            color: row.ews.includes('Normal') ? '#15803d' : '#dc2626',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600
                          }}>
                            {row.ews}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', color: row.marDue ? '#b45309' : '#94a3b8', fontWeight: row.marDue ? 600 : 400 }}>
                        {row.marDue || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: row.lastHandover ? '#0f172a' : '#94a3b8', fontSize: '12px' }}>
                        {row.lastHandover || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', lineHeight: '1.4' }}>
                        {isMissing ? (
                          <span style={{ color: '#dc2626', fontWeight: 500 }}>
                            No handover recorded
                          </span>
                        ) : (
                          <div style={{ color: '#334155', fontSize: '12px' }}>
                            {row.sbarFull}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          background: row.status === 'Current' ? '#dcfce7' : row.status === 'Missing' ? '#fee2e2' : '#f1f5f9',
                          color: row.status === 'Current' ? '#15803d' : row.status === 'Missing' ? '#dc2626' : '#475569',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Footer Info Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            fontSize: '12px',
            color: '#64748b',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>Page {currentPage} of {totalPages} · {filtered.length} live inpatient records</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: currentPage <= 1 ? '#cbd5e1' : '#334155',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  ◀ Prev
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: currentPage >= totalPages ? '#cbd5e1' : '#334155',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  Next ▶
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Rows per page</span>
              {[25, 50, 100].map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => { setPageSize(sz); setPage(1); }}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: pageSize === sz ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    background: pageSize === sz ? '#0f172a' : '#ffffff',
                    color: pageSize === sz ? '#ffffff' : '#475569',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function printMccdCertificate(row) {
  const printWindow = window.open('', '_blank', 'width=860,height=900');
  if (!printWindow) {
    alert('Popup blocker prevented print window from opening. Please allow popups.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>MCCD Form 4 - ${row.patient}</title>
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          margin: 40px;
          color: #1e293b;
          line-height: 1.5;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .cert-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .cert-act {
          font-size: 12px;
          color: #475569;
          font-style: italic;
          margin: 0;
        }
        .reg-badge {
          display: inline-block;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 4px 12px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 13px;
          margin-top: 10px;
        }
        .grid-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 13px;
        }
        .grid-table th, .grid-table td {
          border: 1px solid #cbd5e1;
          padding: 10px 14px;
          text-align: left;
        }
        .grid-table th {
          background: #f8fafc;
          width: 32%;
          color: #475569;
          font-weight: 600;
        }
        .cause-box {
          background: #f8fafc;
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 16px;
          margin: 20px 0;
        }
        .cause-title {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .cause-item {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
          font-size: 13px;
        }
        .cause-label {
          font-weight: 700;
          color: #334155;
          min-width: 170px;
        }
        .declaration {
          font-size: 12px;
          color: #334155;
          font-style: italic;
          margin: 24px 0 36px;
          padding: 12px 16px;
          border-left: 3px solid #0284c7;
          background: #f0f9ff;
        }
        .sign-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 48px;
          padding-top: 16px;
        }
        .sign-block {
          text-align: center;
          min-width: 200px;
        }
        .sign-line {
          border-top: 1px solid #475569;
          margin-bottom: 6px;
        }
        .print-btn {
          background: #0f172a;
          color: #fff;
          border: none;
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          margin-bottom: 20px;
        }
        @media print {
          .no-print { display: none !important; }
          body { margin: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align: right;">
        <button class="print-btn" onclick="window.print()">🖨️ Print Certificate</button>
      </div>

      <div class="header">
        <div class="cert-title">FORM NO. 4 / 4A: MEDICAL CERTIFICATE OF CAUSE OF DEATH (MCCD)</div>
        <div class="cert-act">(Issued in accordance with the Registration of Births & Deaths Act, 1969 - Section 10/17)</div>
        <div class="reg-badge">Statutory Register No: ${row.regNo}</div>
      </div>

      <table class="grid-table">
        <tr>
          <th>Deceased Patient Name</th>
          <td><strong>${row.patient}</strong></td>
          <th>Patient UHID / MRN</th>
          <td><code>${row.uhid || 'PAT-RECORD'}</code></td>
        </tr>
        <tr>
          <th>Department / Unit</th>
          <td>${row.dept}</td>
          <th>Date & Time of Death</th>
          <td><strong>${row.time}</strong></td>
        </tr>
        <tr>
          <th>MCCD Certificate Status</th>
          <td><span style="color: #15803d; font-weight: 700;">✓ Form 4 & 4A Certified</span></td>
          <th>Medico-Legal (MLC)</th>
          <td>${row.isMlc ? '<strong style="color: #dc2626;">Yes · MLC Inquest Requisitioned</strong>' : 'No (Natural Medical Event)'}</td>
        </tr>
        <tr>
          <th>Body Custody / Location</th>
          <td colspan="3">${row.body}</td>
        </tr>
      </table>

      <div class="cause-box">
        <div class="cause-title">Medical Cause of Death Statement</div>
        <div class="cause-item">
          <div class="cause-label">I. Immediate Cause (Line A):</div>
          <div><strong>${row.cause}</strong></div>
        </div>
        <div class="cause-item">
          <div class="cause-label">II. Antecedent Cause (Line B):</div>
          <div>${row.secondary || 'Pre-existing chronic sequelae leading to primary illness'}</div>
        </div>
        <div class="cause-item">
          <div class="cause-label">III. Contributing Condition:</div>
          <div>Cardiopulmonary compromise during critical inpatient management</div>
        </div>
      </div>

      <div class="declaration">
        "I hereby certify that I attended the deceased during his/her last illness and that the death took place on the date and hour stated above. To the best of my knowledge and medical opinion, the cause of death stated above is true."
      </div>

      <div class="sign-row">
        <div class="sign-block">
          <div class="sign-line"></div>
          <div><strong>${row.doctor}</strong></div>
          <div style="font-size: 11px; color: #64748b;">Certifying Consultant / Medical Officer</div>
          <div style="font-size: 11px; color: #64748b;">Reg No: TN-MC-54819</div>
        </div>

        <div class="sign-block" style="border: 2px dashed #94a3b8; padding: 12px; border-radius: 6px;">
          <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Medical Records Division</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Institutional Registry & Vital Statistics</div>
          <div style="font-size: 10px; color: #64748b;">Authenticated Copy</div>
        </div>

        <div class="sign-block">
          <div class="sign-line"></div>
          <div><strong>Medical Superintendent</strong></div>
          <div style="font-size: 11px; color: #64748b;">Authorized Signatory</div>
          <div style="font-size: 11px; color: #64748b;">Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

// -----------------------------------------------------------------------------
// 12. DEATH & MLC REGISTER (death_mlc)
// -----------------------------------------------------------------------------
export function DeathMlcView({ onOpenDrawer, onOpenModal }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(25);

  const loadData = async () => {
    setLoading(true);
    try {
      const deathRes = await apiService.getDeathRecords().catch(() => ({ data: [] }));
      if (deathRes?.data && Array.isArray(deathRes.data)) {
        const mapped = deathRes.data.map(r => ({
          id: r.id,
          regNo: r.death_reg_no || '',
          patient: r.patient_name || '',
          uhid: r.uhid || '',
          dept: r.department || 'Emergency',
          time: r.date_time_of_death || '',
          cause: r.primary_cause_of_death || '',
          secondary: r.secondary_cause || '',
          doctor: r.certifying_doctor || '',
          isMlc: r.is_mlc ?? false,
          mlcDetails: r.mlc_details || (r.is_mlc ? 'Yes · Medico-Legal' : 'No'),
          certificate: r.mccd_status || 'Pending',
          body: r.mortuary_bay || r.body_handed_over_to || 'Mortuary Bay',
          bill: r.bill_status || 'Compassionate Review · Closed'
        }));
        setData(mapped);
      } else {
        setData([]);
      }
    } catch (e) {
      console.error("Failed to load Death & MLC records:", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRowClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.regNo} · ${row.patient}`,
      sub: `Department: ${row.dept} | Time of Death: ${row.time}`,
      badges: [
        {
          t: row.certificate,
          bg: row.certificate.includes('Issued') ? '#dcfce7' : '#fee2e2',
          fg: row.certificate.includes('Issued') ? '#15803d' : '#991b1b'
        },
        ...(row.isMlc ? [{ t: 'MLC Record', bg: '#fee2e2', fg: '#dc2626' }] : [])
      ],
      facts: [
        { k: 'Statutory Register No', v: row.regNo, b: true },
        { k: 'Deceased Patient Name', v: row.patient, b: true },
        { k: 'Department', v: row.dept },
        { k: 'Date & Time of Death', v: row.time },
        { k: 'Primary Cause (MCCD)', v: row.cause, b: true },
        { k: 'Secondary / Contributing Cause', v: row.secondary || 'None' },
        { k: 'Certifying Doctor', v: row.doctor },
        { k: 'Medico-Legal (MLC) Status', v: row.mlcDetails },
        { k: 'Body Custody / Mortuary', v: row.body },
        { k: 'Billing Review', v: row.bill }
      ],
      actions: [
        {
          label: '🖨️ Print MCCD Form 4 Certificate',
          primary: true,
          on: () => {
            printMccdCertificate(row);
          }
        },
        {
          label: 'Authorize Body Release Handover',
          on: async () => {
            try {
              const nextCustody = row.isMlc ? 'Released to Police Escort (MLC)' : 'Released to Family';
              await apiService.updateDeathRecord(row.regNo, {
                mortuary_bay: nextCustody,
                body_handed_over_to: row.isMlc ? 'Police Sub-Inspector / Inquest Team' : 'Authorized Next of Kin / Nominee'
              });
              const updatedRow = { ...row, body: nextCustody };
              setData(prev => prev.map(item => item.regNo === row.regNo ? updatedRow : item));
              handleRowClick(updatedRow);
            } catch (e) {
              console.error(e);
              alert('Error updating body release status in database');
            }
          }
        }
      ]
    });
  };

  const handleExportCSV = () => {
    if (data.length === 0) return alert('No statutory death/MLC records to export.');
    const headers = ['Register No', 'Patient', 'Department', 'Time of Death', 'Primary Cause', 'MLC', 'Certificate Status', 'Body Custody', 'Bill Status'];
    const rows = data.map(d => [
      d.regNo, `"${d.patient}"`, `"${d.dept}"`, `"${d.time}"`, `"${d.cause}"`, `"${d.mlcDetails}"`, `"${d.certificate}"`, `"${d.body}"`, `"${d.bill}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `death_and_mlc_register_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Metrics
  const deathsCount = data.length;
  const certPendingCount = data.filter(d => !d.certificate.includes('Issued')).length;
  const mlcCount = data.filter(d => d.isMlc || d.mlcDetails.toLowerCase().includes('yes')).length;
  const bodyInMortuaryCount = data.filter(d => d.body.toLowerCase().includes('mortuary') || d.body.toLowerCase().includes('bay')).length;

  // Filtering
  const filtered = data.filter(item => {
    return (
      item.regNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.patient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.cause.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.doctor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.mlcDetails.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.certificate.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header section */}
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
          – Back · Clinical Workspace › Death & MLC Register
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0' }}>
              Death & MLC register
            </h1>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
              Statutory registers. Death → certificate (Form 4 / MCCD) by the certifying doctor → body release by Front Office (police clearance first for MLC) → bill closed under compassionate review by Billing. Nothing here can be deleted.
            </p>
          </div>
        </div>
      </div>

      {/* Search & Export bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: '260px' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 14px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              background: '#ffffff'
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          style={{
            padding: '7px 16px',
            fontSize: '13px',
            fontWeight: 600,
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#ffffff',
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          Export CSV
        </button>
      </div>

      {/* Cyan / Light Blue Notice Banner */}
      <div style={{
        background: '#ecfeff',
        border: '1px solid #a5f3fc',
        borderRadius: '6px',
        padding: '10px 14px',
        color: '#0e7490',
        fontSize: '12.5px',
        fontWeight: 500,
        lineHeight: '1.4'
      }}>
        No deaths recorded in this session. A Doctor records an outcome from the Clinical workspace or an ER case ("Death &lt;cause&gt;", add MLC if medico-legal).
      </div>

      {/* 4 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Deaths recorded</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#0f172a' }}>{deathsCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Certificate pending</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b45309' }}>{certPendingCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>MLC</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#dc2626' }}>{mlcCount}</div>
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>Body in mortuary</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#b45309' }}>{bodyInMortuaryCount}</div>
        </div>
      </div>

      {/* Live Data Table / Empty State Container */}
      {loading ? (
        <LoadingState label="Fetching statutory records from PostgreSQL..." />
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 14px' }}>REGISTER</th>
                <th style={{ padding: '12px 14px' }}>PATIENT</th>
                <th style={{ padding: '12px 14px' }}>DEPT</th>
                <th style={{ padding: '12px 14px' }}>TIME</th>
                <th style={{ padding: '12px 14px' }}>CAUSE (AS RECORDED)</th>
                <th style={{ padding: '12px 14px' }}>MLC</th>
                <th style={{ padding: '12px 14px' }}>CERTIFICATE</th>
                <th style={{ padding: '12px 14px' }}>BODY</th>
                <th style={{ padding: '12px 14px' }}>BILL</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px', marginBottom: '4px' }}>
                      Nothing matches
                    </div>
                    <div style={{ color: '#64748b', fontSize: '12.5px' }}>
                      No records for this filter or search. Clear the search or choose "All".
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr
                    key={row.id || row.regNo}
                    onClick={() => handleRowClick(row)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {row.regNo}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                      {row.patient}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      {row.dept}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a', fontFamily: 'monospace' }}>
                      {row.time}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155', maxWidth: '280px' }}>
                      {row.cause}
                    </td>
                    <td style={{ padding: '12px 14px', color: row.isMlc ? '#dc2626' : '#64748b', fontWeight: row.isMlc ? 600 : 400 }}>
                      {row.mlcDetails}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        background: row.certificate.includes('Issued') ? '#dcfce7' : '#fee2e2',
                        color: row.certificate.includes('Issued') ? '#15803d' : '#991b1b',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        {row.certificate}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>
                      {row.body}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0f172a' }}>
                      {row.bill}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Footer Pagination / Info Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            fontSize: '12px',
            color: '#64748b'
          }}>
            <div>
              Page 1 of 1 · {filtered.length} records · click a header to sort, a row for detail and actions
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Rows</span>
              {[25, 50, 100].map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setPageSize(sz)}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: pageSize === sz ? '1px solid #0f172a' : '1px solid #cbd5e1',
                    background: pageSize === sz ? '#0f172a' : '#ffffff',
                    color: pageSize === sz ? '#ffffff' : '#475569',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 13. AUDIT TRAIL (audit)
// -----------------------------------------------------------------------------
const AUDIT_LOGS = [
  { ts: '2026-09-16 10:14:02', user: 'Dr. Priya Narayanan', role: 'Doctor', action: 'DISCHARGE_SUMMARY_PRINT', resource: 'MER-PAT-0087227 (Saanvier Parthalan)', ip: '10.240.12.84', outcome: 'Success' },
  { ts: '2026-09-16 10:08:44', user: 'Meera Iyer', role: 'Hospital Management', action: 'VIEW_GOLD_ANALYTICS', resource: 'health_care.gold.dim_revenue_forecast', ip: '10.240.12.10', outcome: 'Success' },
  { ts: '2026-09-16 09:54:19', user: 'K. Meena', role: 'Billing', action: 'BILLING_CLEARANCE_UPDATE', resource: 'INV-2026-901', ip: '10.240.12.44', outcome: 'Success' },
  { ts: '2026-09-16 09:30:12', user: 'Dr. Sanjay Gupta', role: 'AI Administrator', action: 'AGENT_RUN_DISPATCH', resource: 'Agent AG-19 (Discharge Automator)', ip: '10.240.14.02', outcome: 'Success' },
  { ts: '2026-09-16 09:15:30', user: 'Anitha Kumar', role: 'Nurse', action: 'EMAR_DRUG_ADMINISTRATION', resource: 'MER-PAT-0087227 (Insulin 8U)', ip: '10.240.15.19', outcome: 'Success' },
];

export function AuditTrailView({ onOpenDrawer, onOpenModal }) {
  const handleAuditClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.action} · ${row.outcome}`,
      sub: `Actor: ${row.user} (${row.role}) · Timestamp: ${row.ts}`,
      badges: [{ t: row.outcome, bg: '#dcfce7', fg: '#15803d' }],
      facts: [
        { k: 'Timestamp (UTC+5:30)', v: row.ts, b: true },
        { k: 'Authenticated User', v: row.user, b: true },
        { k: 'User Role', v: row.role },
        { k: 'Action Code', v: row.action },
        { k: 'Target Resource', v: row.resource },
        { k: 'Source IP Address', v: row.ip },
        { k: 'Audit Outcome', v: row.outcome }
      ],
      actions: [
        { label: 'Verify Audit Block Hash', primary: true, on: () => alert(`Audit signature verified: SHA256 matches immutable ledger`) },
        { label: 'Download Signed Evidence' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="HIPAA & Digital Health Audit Trail"
        subtitle="Immutable electronic health record access logs, role-based authorization events, and modification entries"
        count={AUDIT_LOGS.length}
        onExport={() => alert('Exported immutable audit trail')}
      />
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Timestamp (UTC+5:30)</th>
              <th style={{ padding: '10px 14px' }}>Authenticated User</th>
              <th style={{ padding: '10px 14px' }}>User Role</th>
              <th style={{ padding: '10px 14px' }}>Action Triggered</th>
              <th style={{ padding: '10px 14px' }}>Target Resource / Record</th>
              <th style={{ padding: '10px 14px' }}>IP / Device</th>
              <th style={{ padding: '10px 14px' }}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {AUDIT_LOGS.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => handleAuditClick(row)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#64748b' }}>{row.ts}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{row.user}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#f1f5f9', '#334155')}>{row.role}</span></td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f766e', fontFamily: 'monospace' }}>{row.action}</td>
                <td style={{ padding: '10px 14px', color: '#1e293b' }}>{row.resource}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#64748b' }}>{row.ip}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#dcfce7', '#15803d')}>✓ {row.outcome}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 14. CLAIMS VIEW (claims)
// -----------------------------------------------------------------------------
const CLAIMS_RECORDS = [
  { id: 'CLM-2026-4401', patient: 'Kavitha Raman', uhid: 'MER-PAT-0087221', insurer: 'Star Health', tpa: 'Medi Assist', auth: 'AUTH-SH-88910', requested: 142000, approved: 120000, paid: 120000, liability: 22000, preauthStatus: 'Approved', status: 'Settled' },
  { id: 'CLM-2026-4402', patient: 'Saanvier Parthalan', uhid: 'MER-PAT-0087227', insurer: 'HDFC ERGO', tpa: 'Vidal Health', auth: 'AUTH-HE-91023', requested: 68400, approved: 52000, paid: 52000, liability: 16400, preauthStatus: 'Approved', status: 'Settled' },
  { id: 'CLM-2026-4403', patient: 'Christoer Parthalan', uhid: 'MER-PAT-0087233', insurer: 'ICICI Lombard', tpa: 'Paramount TPA', auth: 'AUTH-IC-77189', requested: 45000, approved: 35000, paid: 0, liability: 10000, preauthStatus: 'Approved', status: 'Submitted' },
  { id: 'CLM-2026-4404', patient: 'Sundaram K.', uhid: 'MER-PAT-0087228', insurer: 'United India', tpa: 'Heritage Health', auth: 'AUTH-UI-66120', requested: 92000, approved: 75000, paid: 0, liability: 17000, preauthStatus: 'Query Raised', status: 'Query Raised' },
  { id: 'CLM-2026-4405', patient: 'Lakshmi Narayanan', uhid: 'MER-PAT-0087230', insurer: 'Max Bupa (Niva)', tpa: 'Raksha TPA', auth: 'AUTH-NB-55410', requested: 31000, approved: 25000, paid: 25000, liability: 6000, preauthStatus: 'Approved', status: 'Settled' },
  { id: 'CLM-2026-4406', patient: 'R. Murugan', uhid: 'MER-PAT-0087235', insurer: 'New India Assurance', tpa: 'MDIndia', auth: 'AUTH-NI-44109', requested: 115000, approved: 95000, paid: 0, liability: 20000, preauthStatus: 'Approved', status: 'Under Review' },
];

export function ClaimsView({ onOpenDrawer, onOpenModal }) {
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All'
    ? CLAIMS_RECORDS
    : CLAIMS_RECORDS.filter(r => r.status === filter);

  const handleClaimClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.id} · ${row.patient}`,
      sub: `Insurer: ${row.insurer} · TPA: ${row.tpa}`,
      badges: [
        { t: row.status, bg: row.status === 'Settled' ? '#dcfce7' : row.status === 'Submitted' ? '#e0f2fe' : '#fef3c7', fg: row.status === 'Settled' ? '#15803d' : row.status === 'Submitted' ? '#0369a1' : '#92400e' }
      ],
      facts: [
        { k: 'Claim Identifier', v: row.id, b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'UHID / MRN', v: row.uhid },
        { k: 'Insurance Company', v: row.insurer },
        { k: 'TPA Network', v: row.tpa },
        { k: 'Pre-auth Approval No', v: row.auth },
        { k: 'Gross Claimed', v: `₹${row.requested.toLocaleString()}` },
        { k: 'TPA Sanctioned', v: `₹${row.approved.toLocaleString()}` },
        { k: 'Disallowed / Co-Pay Due', v: `₹${row.liability.toLocaleString()}` },
        { k: 'Current Status', v: row.status }
      ],
      actions: [
        { label: 'Reconcile Remittance Batch', primary: true, on: () => alert(`Reconciled claim ${row.id}`) },
        { label: 'File TPA Enhancement / Grievance' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Insurance Claims Tracking & Settlement Desk"
        subtitle="End-to-end cashless preauthorisation claims, TPA adjudication, query handling, and remittances"
        count={filtered.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'insurers', title: 'Submit Insurance Claim Dossier' })}
        newLabel="+ Submit Claim"
        onExport={() => alert('Exported claims tracker CSV')}
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Total Invoiced Claims" value="₹4,93,400" sub="6 Managed cases" color="#0284c7" />
        <StatCard label="TPA Approved Settlement" value="₹4,02,000" sub="81.5% Claim pass rate" color="#059669" />
        <StatCard label="Insurer Outstanding" value="₹1,70,000" sub="3 Open remittances" color="#d97706" />
        <StatCard label="Avg Remittance TAT" value="11 Days" sub="Within SLA target (15d)" color="#475569" />
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '4px 0', flexWrap: 'wrap' }}>
        {['All', 'Settled', 'Submitted', 'Under Review', 'Query Raised'].map(st => (
          <button
            key={st}
            type="button"
            onClick={() => setFilter(st)}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: filter === st ? 700 : 500,
              cursor: 'pointer',
              border: filter === st ? '1px solid oklch(0.5 0.1 200)' : '1px solid #cbd5e1',
              background: filter === st ? 'oklch(0.95 0.04 200)' : '#ffffff',
              color: filter === st ? 'oklch(0.35 0.1 200)' : '#334155'
            }}
          >
            {st}
          </button>
        ))}
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Claim ID</th>
              <th style={{ padding: '10px 14px' }}>Patient / UHID</th>
              <th style={{ padding: '10px 14px' }}>Insurer · TPA</th>
              <th style={{ padding: '10px 14px' }}>Preauth Auth</th>
              <th style={{ padding: '10px 14px' }}>Claimed Amt</th>
              <th style={{ padding: '10px 14px' }}>Approved Amt</th>
              <th style={{ padding: '10px 14px' }}>Patient Due</th>
              <th style={{ padding: '10px 14px' }}>Claim Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr
                key={row.id}
                onClick={() => handleClaimClick(row)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{row.id}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600 }}>{row.patient}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.uhid}</div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div>{row.insurer}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.tpa}</div>
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#475569' }}>{row.auth}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>₹{row.requested.toLocaleString()}</td>
                <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 600 }}>₹{row.approved.toLocaleString()}</td>
                <td style={{ padding: '10px 14px', color: '#dc2626', fontWeight: 700 }}>₹{row.liability.toLocaleString()}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.status === 'Settled' ? '#dcfce7' : row.status === 'Submitted' ? '#e0f2fe' : '#fef3c7',
                    row.status === 'Settled' ? '#15803d' : row.status === 'Submitted' ? '#0369a1' : '#92400e'
                  )}>
                    ● {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 15. FINANCE DASHBOARD VIEW (finance)
// -----------------------------------------------------------------------------
const REVENUE_TXNS = [
  { id: 'PAY-8801', patient: 'Kavitha Raman', bill: 'INV-2026-902', mode: 'UPI (GPay)', time: '10:45 AM', amount: 22000, status: 'Success' },
  { id: 'PAY-8802', patient: 'Saanvier Parthalan', bill: 'INV-2026-901', mode: 'Credit Card (HDFC)', time: '10:20 AM', amount: 16400, status: 'Success' },
  { id: 'PAY-8803', patient: 'Star Health TPA Remittance', bill: 'BAT-TPA-991', mode: 'NEFT Corporate', time: '09:50 AM', amount: 120000, status: 'Settled' },
  { id: 'PAY-8804', patient: 'Christoer Parthalan', bill: 'INV-2026-903', mode: 'Cash Counter 1', time: '09:15 AM', amount: 10000, status: 'Success' },
  { id: 'PAY-8805', patient: 'Vidal Health Remittance', bill: 'BAT-TPA-992', mode: 'RTGS Settlement', time: '08:40 AM', amount: 52000, status: 'Settled' },
];

export function FinanceDashboardView({ onOpenDrawer, onOpenModal }) {
  const [modeFilter, setModeFilter] = useState('All');

  const filtered = modeFilter === 'All'
    ? REVENUE_TXNS
    : REVENUE_TXNS.filter(t => t.mode.toLowerCase().includes(modeFilter.toLowerCase()));

  const handleTxnClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.id} · ₹${row.amount.toLocaleString()}`,
      sub: `Payer: ${row.patient} · Tender: ${row.mode}`,
      badges: [{ t: row.status, bg: '#dcfce7', fg: '#15803d' }],
      facts: [
        { k: 'Payment Reference', v: row.id, b: true },
        { k: 'Payer / Patient', v: row.patient, b: true },
        { k: 'Linked Bill / Batch', v: row.bill },
        { k: 'Tender Mode', v: row.mode },
        { k: 'Transaction Time', v: row.time },
        { k: 'Collected Amount', v: `₹${row.amount.toLocaleString()}` },
        { k: 'Settlement Status', v: row.status }
      ],
      actions: [
        { label: 'Print Official Receipt', primary: true, on: () => alert(`Printed payment receipt for ${row.id}`) },
        { label: 'Generate Bank Deposit Slip' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Hospital Finance Dashboard & Collections Journal"
        subtitle="Direct cash collection, TPA electronic remittances, patient receivables, and daily daybook ledger"
        count={filtered.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'taxes', title: 'Add Fiscal / Tax Rule to Ledger' })}
        newLabel="+ Add Ledger Item"
        onExport={() => alert('Exported financial daybook')}
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Today's Total Receipts" value="₹2,20,400" sub="5 Collections processed" color="#059669" />
        <StatCard label="Monthly Projected Run-Rate" value="₹4.8 Cr" sub="98.2% Against monthly target" color="#0284c7" />
        <StatCard label="Patient Receivables" value="₹18.4L" sub="Discharge co-pays & dues" color="#d97706" />
        <StatCard label="Insurer Receivables" value="₹42.6L" sub="Awaiting batch remittance" color="#475569" />
      </div>

      <div style={{ display: 'flex', gap: '8px', margin: '4px 0', flexWrap: 'wrap' }}>
        {['All', 'UPI', 'Credit Card', 'NEFT', 'Cash'].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setModeFilter(m)}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: modeFilter === m ? 700 : 500,
              cursor: 'pointer',
              border: modeFilter === m ? '1px solid oklch(0.5 0.1 200)' : '1px solid #cbd5e1',
              background: modeFilter === m ? 'oklch(0.95 0.04 200)' : '#ffffff',
              color: modeFilter === m ? 'oklch(0.35 0.1 200)' : '#334155'
            }}
          >
            {m}
          </button>
        ))}
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Payment Ref</th>
              <th style={{ padding: '10px 14px' }}>Payer / Patient</th>
              <th style={{ padding: '10px 14px' }}>Bill / Batch Ref</th>
              <th style={{ padding: '10px 14px' }}>Tender Mode</th>
              <th style={{ padding: '10px 14px' }}>Transacted Time</th>
              <th style={{ padding: '10px 14px' }}>Receipt Amount</th>
              <th style={{ padding: '10px 14px' }}>Ledger Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => (
              <tr
                key={row.id}
                onClick={() => handleTxnClick(row)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{row.id}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.patient}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#475569' }}>{row.bill}</td>
                <td style={{ padding: '10px 14px' }}>{row.mode}</td>
                <td style={{ padding: '10px 14px', color: '#64748b' }}>{row.time}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#059669' }}>₹{row.amount.toLocaleString()}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle('#dcfce7', '#15803d')}>
                    ✓ {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 16. TAX CONFIGURATION VIEW (tax)
// -----------------------------------------------------------------------------
const TAX_RULES = [
  { code: 'EXEMPT-HC', name: 'Clinical Healthcare Services', cgst: 0, sgst: 0, igst: 0, hsn: 'SAC 9993', category: 'Inpatient Consultation & Care', status: 'Active', inclusive: false },
  { code: 'GST-12-MED', name: 'Prescription Drugs & Medicines', cgst: 6, sgst: 6, igst: 12, hsn: 'HSN 3004', category: 'Pharmacy Formulary Master', status: 'Active', inclusive: true },
  { code: 'GST-5-IMPLANT', name: 'Stents & Orthopedic Implants', cgst: 2.5, sgst: 2.5, igst: 5, hsn: 'HSN 9021', category: 'Cardiac & Surgical Implants', status: 'Active', inclusive: true },
  { code: 'GST-5-DIET', name: 'Inpatient Dietary Meals', cgst: 2.5, sgst: 2.5, igst: 5, hsn: 'HSN 9963', category: 'Canteen & Patient Nutrition', status: 'Active', inclusive: true },
  { code: 'GST-18-AMB', name: 'Specialized Transport & Ambulance', cgst: 9, sgst: 9, igst: 18, hsn: 'SAC 9964', category: 'Emergency Transport Fleet', status: 'Active', inclusive: false },
  { code: 'GST-18-EXEC', name: 'Executive Preventive Health Check', cgst: 9, sgst: 9, igst: 18, hsn: 'SAC 9983', category: 'Outpatient Wellness Screening', status: 'Active', inclusive: false },
];

export function TaxConfigView({ onOpenDrawer, onOpenModal }) {
  const handleTaxClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.code} · ${row.name}`,
      sub: `${row.hsn} · Category: ${row.category}`,
      badges: [{ t: row.status, bg: '#dcfce7', fg: '#15803d' }],
      facts: [
        { k: 'Statutory Tax Code', v: row.code, b: true },
        { k: 'Rule Description', v: row.name, b: true },
        { k: 'HSN / SAC Code', v: row.hsn },
        { k: 'Service Category', v: row.category },
        { k: 'Central CGST', v: `${row.cgst}%` },
        { k: 'State SGST', v: `${row.sgst}%` },
        { k: 'Combined IGST', v: `${row.igst}%` },
        { k: 'Statutory Rule Status', v: row.status }
      ],
      actions: [
        { label: 'Edit Tax Slab Rule', primary: true, on: () => onOpenModal && onOpenModal({ kind: 'create', coll: 'taxes', title: 'Update Tax Schedule' }) },
        { label: 'Verify SAC Exemption Expiry' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Central GST & Statutory Tax Configuration"
        subtitle="Centralised taxation engine configured for healthcare clinical exemptions (SAC 9993), pharmacy, and implants"
        count={TAX_RULES.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'taxes', title: 'Add Central GST Rule / SAC Exemption' })}
        newLabel="+ Add Tax Rule"
        onExport={() => alert('Exported tax rules')}
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Configured Tax Schedules" value="6 Active Rules" sub="Audit reviewed FY26-27" color="#0284c7" />
        <StatCard label="Clinical Services Status" value="Exempt (0%)" sub="SAC 9993 Clinical Healthcare" color="#059669" />
        <StatCard label="Pharma & Implants GST" value="5% – 12%" sub="Standard statutory schedules" color="#475569" />
        <StatCard label="Reconciliation Status" value="Compliant" sub="No unmapped billing lines" color="#059669" />
      </div>

      <div style={{
        background: '#fffbeb',
        border: '1px solid #fef3c7',
        borderRadius: '6px',
        padding: '10px 14px',
        fontSize: '12px',
        color: '#92400e',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>⚠️</span>
        <span><strong>Regulatory Guidance:</strong> Clinical healthcare provided by clinical establishments is fully exempt under SAC 9993. Pharmacy items and implants are taxed per GST Council statutory notifications.</span>
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Tax Code</th>
              <th style={{ padding: '10px 14px' }}>Rule Description</th>
              <th style={{ padding: '10px 14px' }}>HSN / SAC</th>
              <th style={{ padding: '10px 14px' }}>Applicable Category</th>
              <th style={{ padding: '10px 14px' }}>CGST</th>
              <th style={{ padding: '10px 14px' }}>SGST</th>
              <th style={{ padding: '10px 14px' }}>Total GST</th>
              <th style={{ padding: '10px 14px' }}>Tax Status</th>
            </tr>
          </thead>
          <tbody>
            {TAX_RULES.map(row => (
              <tr
                key={row.code}
                onClick={() => handleTaxClick(row)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{row.code}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.name}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#64748b' }}>{row.hsn}</td>
                <td style={{ padding: '10px 14px' }}>{row.category}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{row.cgst}%</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{row.sgst}%</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: row.igst === 0 ? '#059669' : '#0f172a' }}>
                  {row.igst}%
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle('#dcfce7', '#15803d')}>
                    ✓ {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 17. EXPANDED DATA DOMAIN VIEWS (data-patient, data-ops, data-clinical, data-financial, data-quality, forecasting, scenario, beforeafter)
// -----------------------------------------------------------------------------
export function DataDomainView({ domain = 'Patient', onOpenDrawer, onOpenModal }) {
  const d = domain.toLowerCase();
  const isPatient = d.includes('patient');
  const isOps = d.includes('ops') || d.includes('operation');
  const isClinical = d.includes('clinical');
  const isFinancial = d.includes('financial');
  const isQuality = d.includes('quality');
  const isForecasting = d.includes('forecast');
  const isScenario = d.includes('scenario');
  const isBeforeAfter = d.includes('before') || d.includes('after');

  const title = isPatient ? 'Master Patient Index · Clinical Database' :
    isOps ? 'Hospital Operational & Throughput Metrics' :
    isClinical ? 'Structured Clinical Observations & Diagnostic Codes' :
    isFinancial ? 'Financial Ledger & AR/AP Fact Records' :
    isQuality ? 'Automated Data Quality & Validation Rules' :
    isForecasting ? 'Predictive Inpatient Census & Demand Forecasting' :
    isScenario ? 'Hospital Capacity & Surge Scenario Simulator' :
    isBeforeAfter ? 'Pre vs Post AI Intervention Outcomes & SLA Impact' :
    `${domain} Data View`;

  const subtitle = `Direct query view of health_care.gold.${
    isPatient ? 'dim_patients' :
    isOps ? 'fact_hospital_operations' :
    isClinical ? 'fact_clinical_observations' :
    isFinancial ? 'fact_financial_ledger' :
    isQuality ? 'dq_rules_evaluator' :
    isForecasting ? 'pred_census_forecast' :
    isScenario ? 'sim_capacity_scenarios' :
    isBeforeAfter ? 'outcomes_sla_benchmark' :
    'gold_table'
  }`;

  const rows = isPatient ? [
    { c1: 'MER-PAT-0087221', c2: 'Kavitha Raman', c3: '58 / Female', c4: 'AB Positive', c5: 'Cardiology', c6: '98401-22910', c7: 'Active IP' },
    { c1: 'MER-PAT-0087227', c2: 'Saanvier Parthalan', c3: '84 / Female', c4: 'O Positive', c5: 'Internal Medicine', c6: '94432-88102', c7: 'Active IP' },
    { c1: 'MER-PAT-0087233', c2: 'Christoer Parthalan', c3: '42 / Male', c4: 'B Positive', c5: 'General Surgery', c6: '98409-11234', c7: 'Active IP' },
    { c1: 'MER-PAT-0087238', c2: 'Sundaram K.', c3: '28 / Male', c4: 'O Negative', c5: 'Orthopedics', c6: '94431-77291', c7: 'Active IP' },
  ] : isOps ? [
    { c1: 'WARD-2A', c2: 'Elective Ward', c3: '18 / 20 Beds (90%)', c4: '4 Discharges Today', c5: 'Avg LOS: 3.4 Days', c6: 'Staff Ratio 1:4', c7: 'Optimal' },
    { c1: 'WARD-ICU', c2: 'Intensive Coronary Care', c3: '8 / 10 Beds (80%)', c4: '1 Admission, 1 Shift', c5: 'Avg LOS: 4.8 Days', c6: 'Staff Ratio 1:1', c7: 'High Acuity' },
    { c1: 'ER-BAY', c2: 'Emergency Resuscitation', c3: '6 / 10 Bays (60%)', c4: '42 Triage Visits', c5: 'Avg TAT: 2.1 Hrs', c6: 'Staff Ratio 1:2', c7: 'Normal' },
  ] : isClinical ? [
    { c1: 'OBS-9901', c2: 'MER-PAT-0087227', c3: 'E11.65 (Type 2 DM with DKA)', c4: 'Random Blood Glucose: 118 mg/dL', c5: 'LOINC 2345-7', c6: 'Dr. Priya Narayanan', c7: 'Normalized' },
    { c1: 'OBS-9902', c2: 'MER-PAT-0087221', c3: 'I21.0 (Acute transmural MI anterior wall)', c4: 'hs-Troponin I: 53.2 pg/mL', c5: 'LOINC 49563-0', c6: 'Dr. Arjun Menon', c7: 'Critical High' },
    { c1: 'OBS-9903', c2: 'MER-PAT-0087233', c3: 'K35.80 (Acute appendicitis, other and unspec)', c4: 'Total WBC: 14,800/mcL', c5: 'LOINC 6690-2', c6: 'Dr. Pooja Menon', c7: 'Elevated' },
  ] : isFinancial ? [
    { c1: 'TXN-FIN-101', c2: 'Kavitha Raman', c3: 'PTCA Cath-Lab Procedure', c4: '₹1,42,000 (Insurance ₹1.2L)', c5: 'Invoice INV-2026-902', c6: 'Billing Desk 1', c7: 'Verified' },
    { c1: 'TXN-FIN-102', c2: 'Saanvier Parthalan', c3: 'Internal Med Inpatient Care', c4: '₹68,400 (Insurance ₹52k)', c5: 'Invoice INV-2026-901', c6: 'Billing Desk 2', c7: 'Verified' },
    { c1: 'TXN-FIN-103', c2: 'Christoer Parthalan', c3: 'Appendectomy Surgical Suite', c4: '₹45,000 (Insurance ₹35k)', c5: 'Invoice INV-2026-903', c6: 'Billing Desk 1', c7: 'Verified' },
    { c1: 'TXN-FIN-104', c2: 'Sundaram K.', c3: 'Orthopedic Fracture Fixation', c4: '₹92,000 (Co-Pay Pending)', c5: 'Invoice INV-2026-904', c6: 'Billing Desk 3', c7: 'Hold' },
  ] : isQuality ? [
    { c1: 'DQ-RULE-01', c2: 'Inpatient Active Bed Binding', c3: 'Operations Domain', c4: '100% Inpatients Bound to Bed', c5: 'Zero Unmapped Beds', c6: 'Bed Manager', c7: 'Passed' },
    { c1: 'DQ-RULE-02', c2: 'Insured Admission Preauth Linkage', c3: 'Finance Domain', c4: '98.5% Bound to Preauth', c5: '1 Manual Follow-up', c6: 'Insurance Desk', c7: 'Optimal' },
    { c1: 'DQ-RULE-03', c2: 'Critical Value Acknowledgement TAT', c3: 'Clinical Domain', c4: '99.2% Acked Under 15m', c5: 'Average Ack TAT 6.2m', c6: 'Lab Director', c7: 'Passed' },
    { c1: 'DQ-RULE-04', c2: 'ICD-10 Primary Diagnosis Coded', c3: 'Medical Records', c4: '100% Valid WHO ICD-10', c5: 'No Placeholders', c6: 'HOD Records', c7: 'Passed' },
  ] : isForecasting ? [
    { c1: 'FCST-D0', c2: 'Today (T+0)', c3: 'Cardiology + Medicine', c4: 'Predicted Discharges: 8', c5: 'Predicted Admissions: 9', c6: 'Net Census: 92%', c7: 'High Demand' },
    { c1: 'FCST-D1', c2: 'Tomorrow (T+1)', c3: 'General Surgery + Ortho', c4: 'Predicted Discharges: 12', c5: 'Predicted Admissions: 7', c6: 'Net Census: 86%', c7: 'Balanced' },
    { c1: 'FCST-D2', c2: 'Day After (T+2)', c3: 'Critical Care ICU', c4: 'Predicted Discharges: 3', c5: 'Predicted Admissions: 4', c6: 'Net Census: 89%', c7: 'Capacity Warning' },
  ] : isScenario ? [
    { c1: 'SCEN-01', c2: 'Mass Casualty ER Surge (20 Arrivals)', c3: 'Emergency Resuscitation', c4: 'Triage Surge Response Activated', c5: '8 Fast-track Transfers', c6: 'ER Coordinator', c7: 'Simulated OK' },
    { c1: 'SCEN-02', c2: 'Cardiac Cath Lab Overrun (+3 hrs)', c3: 'OT & Procedure Suite', c4: 'Elective 2 Cases Rescheduled', c5: 'Zero Safety Event', c6: 'Chief of Surgery', c7: 'Simulated OK' },
    { c1: 'SCEN-03', c2: 'TPA Server Latency (>45 mins)', c3: 'Insurance Clearance', c4: 'Autonomous Pre-Auth Packet Buffer', c5: 'Manual Release Fallback', c6: 'TPA Coordinator', c7: 'Simulated OK' },
  ] : [
    { c1: 'KPI-DIS-TAT', c2: 'Discharge Turnaround Time', c3: 'Operational SLA', c4: 'Before: 4.8 hrs → After: 1.4 hrs', c5: '70.8% TAT Reduction', c6: 'Discharge Agent AG-19', c7: 'Benchmark Achieved' },
    { c1: 'KPI-PREAUTH', c2: 'First-Pass Pre-Auth Acceptance', c3: 'Finance & TPA', c4: 'Before: 64% → After: 91.5%', c5: '27.5% Denial Reduction', c6: 'Pre-Auth Assembly Agent', c7: 'Benchmark Achieved' },
    { c1: 'KPI-CRIT-ACK', c2: 'Critical Lab Value Escalation', c3: 'Patient Safety', c4: 'Before: 28 mins → After: 6.4 mins', c5: 'Zero Unacknowledged Values', c6: 'Diagnostic Alert Engine', c7: 'Benchmark Achieved' },
  ];

  const handleRowClick = (r) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${r.c1} · ${r.c2}`,
      sub: `${r.c3} · Classification: ${r.c5}`,
      badges: [{ t: r.c7, bg: '#f0fdf4', fg: '#166534' }],
      facts: [
        { k: 'Record / Code', v: r.c1, b: true },
        { k: 'Entity / Description', v: r.c2, b: true },
        { k: 'Details / Capacity', v: r.c3 },
        { k: 'Primary Metric', v: r.c4 },
        { k: 'Reference Standard', v: r.c5 },
        { k: 'Owner / Station', v: r.c6 },
        { k: 'Status / Disposition', v: r.c7 }
      ],
      actions: [
        { label: 'Export Table Slice', primary: true, on: () => alert(`Exported slice for ${r.c1}`) }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title={title}
        subtitle={subtitle}
        count={rows.length}
        onExport={() => alert(`Exported table: ${title}`)}
      />
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>ID / Code</th>
              <th style={{ padding: '10px 14px' }}>Entity / Metric</th>
              <th style={{ padding: '10px 14px' }}>Classification</th>
              <th style={{ padding: '10px 14px' }}>Key Observation / Metric</th>
              <th style={{ padding: '10px 14px' }}>Reference Standard / Note</th>
              <th style={{ padding: '10px 14px' }}>Owner / Source</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                onClick={() => handleRowClick(r)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{r.c1}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{r.c2}</td>
                <td style={{ padding: '10px 14px' }}>{r.c3}</td>
                <td style={{ padding: '10px 14px', color: '#0f766e', fontWeight: 600 }}>{r.c4}</td>
                <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.c5}</td>
                <td style={{ padding: '10px 14px' }}>{r.c6}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#f0fdf4', '#166534')}>{r.c7}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 15. EXCEPTIONS VIEW (exceptions)
// -----------------------------------------------------------------------------
const EXCEPTIONS = [
  { id: 'EXP-101', type: 'Clinical Override', desc: 'Antibiotic dose adjusted beyond normal renal clearance limit', physician: 'Dr. Priya Narayanan', reason: 'Severe septicemia protocol override approved', status: 'Approved' },
  { id: 'EXP-102', type: 'Billing Discount', desc: '15% compassionate billing concession on IP room rent', physician: 'Meera Iyer (Admin)', reason: 'Patient financial hardship request', status: 'Authorized' },
  { id: 'EXP-103', type: 'Formulary Substitution', desc: 'Brand substitution for Cefixime 200mg due to pharmacy stockout', physician: 'S. Devi (Pharmacy)', reason: 'Equivalent generic bio-availability', status: 'Documented' },
];

export function ExceptionsView({ onOpenDrawer, onOpenModal }) {
  const handleExClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.id} · ${row.type}`,
      sub: `Authorized Provider: ${row.physician}`,
      badges: [{ t: row.status, bg: '#dcfce7', fg: '#15803d' }],
      facts: [
        { k: 'Exception Code', v: row.id, b: true },
        { k: 'Exception Category', v: row.type },
        { k: 'Clinical Exception Description', v: row.desc },
        { k: 'Authorized Provider', v: row.physician },
        { k: 'Clinical Rationale / Protocol', v: row.reason },
        { k: 'Compliance Audit Status', v: row.status }
      ],
      actions: [
        { label: 'Sign Compliance Clearance', primary: true, on: () => alert(`Cleared exception ${row.id}`) },
        { label: 'Refer to Clinical Ethics Committee' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Clinical & Administrative Exception Register"
        subtitle="Monitored clinical overrides, drug formulary substitutions, and financial discount approvals"
        count={EXCEPTIONS.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'reason', title: 'Raise Clinical / Operational Exception', text: 'Detail the clinical override justification, patient UHID, and supervising consultant sign-off:' })}
        newLabel="+ Raise Exception"
        onExport={() => alert('Exported exceptions register')}
      />
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Exception ID</th>
              <th style={{ padding: '10px 14px' }}>Category</th>
              <th style={{ padding: '10px 14px' }}>Clinical Exception Details</th>
              <th style={{ padding: '10px 14px' }}>Authorized Provider</th>
              <th style={{ padding: '10px 14px' }}>Clinical Rationale</th>
              <th style={{ padding: '10px 14px' }}>Audit Status</th>
            </tr>
          </thead>
          <tbody>
            {EXCEPTIONS.map(row => (
              <tr
                key={row.id}
                onClick={() => handleExClick(row)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{row.id}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#e0e7ff', '#3730a3')}>{row.type}</span></td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{row.desc}</td>
                <td style={{ padding: '10px 14px' }}>{row.physician}</td>
                <td style={{ padding: '10px 14px', color: '#52585e' }}>{row.reason}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#dcfce7', '#15803d')}>✓ {row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// PHARMACY & SUPPLY CHAIN VIEWS (Live PostgreSQL Database)
// ----------------------------------------------------

export {
  PrescriptionsView,
  DrugMasterView,
  PharmacyView,
  InventoryView,
  StoresView,
  ProcurementView,
  VendorsView,
  CssdView
} from './PharmacySupplyViews';


// ----------------------------------------------------
// PEOPLE VIEWS
// ----------------------------------------------------

export const DUMMY_HR_QUERIES = [
  { time: '11:22', employee: 'Anitha Kumar', question: 'How many casual leave days do I have left?', source: 'HR Leave Policy v5.0 §3 + HRMS', conf: '98%', outcome: 'Answered · 4 days' },
  { time: '11:04', employee: 'R. Sundar', question: 'What is the new policy for cashless robotic surgery packages?', source: 'No authoritative source', conf: '42%', outcome: 'Refused · routed to Insurance Supervisor' },
  { time: '10:51', employee: 'K. Meena', question: 'When is September payroll credited?', source: 'Payroll FAQ v2.1', conf: '96%', outcome: 'Answered · 30 Sep' },
  { time: '10:25', employee: 'S. Devi', question: 'How do I replace my ID card?', source: 'Facility Handbook v1.2', conf: '93%', outcome: 'Answered · ticket raised' },
  { time: '09:56', employee: 'P. Velu', question: 'Night shift allowance rate?', source: 'HR Leave Policy v5.0 §7', conf: '95%', outcome: 'Answered' },
  { time: '09:05', employee: 'New joiner · Ortho', question: 'Onboarding checklist for nurses', source: 'Onboarding SOP v1.4', conf: '97%', outcome: 'Answered · 12 items' },
];

export function HrEmployeeView({ onOpenDrawer, onOpenModal }) {
  const handleRowClick = (q) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `HR Query · ${q.employee}`,
      sub: `Submitted at ${q.time} · Confidence ${q.conf}`,
      badges: [{ t: q.conf.startsWith('4') ? 'Escalated' : 'AI Resolved', bg: q.conf.startsWith('4') ? '#fee2e2' : '#dcfce7', fg: q.conf.startsWith('4') ? '#b91c1c' : '#15803d' }],
      facts: [
        { k: 'Employee', v: q.employee },
        { k: 'Natural Language Query', v: q.question },
        { k: 'Knowledge Source Citation', v: q.source },
        { k: 'Agent Outcome', v: q.outcome }
      ],
      actions: [
        { label: 'View Employee HR Record', primary: true, on: () => alert(`Navigating to HR record of ${q.employee}`) },
        { label: 'Adjust Leave Balance', on: () => onOpenModal && onOpenModal({ kind: 'reason', title: 'HR Exception Override', text: `Adjust policy or leave entitlement for ${q.employee}:` }) }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="HR & Employee Service"
        subtitle="Employee Service Agent answers from governed HR knowledge (Leave Policy v5.0, Payroll FAQ). Low-confidence queries route to HR leads."
        count={DUMMY_HR_QUERIES.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'reason', title: 'Ask Employee Service Copilot', text: 'Enter staff HR question (leave, benefits, allowances):' })}
        newLabel="+ Submit HR Query"
        onExport={() => alert('Exported HR query logs')}
      />

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Time</th>
              <th style={{ padding: '10px 14px' }}>Employee</th>
              <th style={{ padding: '10px 14px' }}>Question</th>
              <th style={{ padding: '10px 14px' }}>Source Citation</th>
              <th style={{ padding: '10px 14px' }}>Confidence</th>
              <th style={{ padding: '10px 14px' }}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_HR_QUERIES.map((q, i) => (
              <tr
                key={i}
                onClick={() => handleRowClick(q)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{q.time}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>{q.employee}</td>
                <td style={{ padding: '10px 14px' }}>{q.question}</td>
                <td style={{ padding: '10px 14px', color: '#0f766e' }}>{q.source}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: parseInt(q.conf) < 70 ? '#dc2626' : '#15803d' }}>{q.conf}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(q.conf.startsWith('4') ? '#fee2e2' : '#dcfce7', q.conf.startsWith('4') ? '#b91c1c' : '#15803d')}>
                    {q.outcome}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// ADMINISTRATION VIEWS
// ----------------------------------------------------

export const DUMMY_NOTIFICATIONS = [
  { id: 'NOTIF-01', time: '11:21', pri: 'Critical', title: 'Critical lab result · Potassium 6.2 mmol/L', detail: 'Kavitha Raman (C-102) · Acknowledge timer 15 m running', src: 'LIS Connector', unread: true },
  { id: 'NOTIF-02', time: '11:18', pri: 'High', title: 'Pharmacy stock-out blocking discharge', detail: 'Enoxaparin 40 mg for Fathima Begum (O-207) · Central transfer queued', src: 'Discharge Orchestration Agent', unread: true },
  { id: 'NOTIF-03', time: '11:15', pri: 'High', title: 'Doctor approval required for CABG summary', detail: 'Murugan Selvam (C-104) · Draft ready for Dr. Priya Venkatesh', src: 'Discharge Summary Agent', unread: true },
  { id: 'NOTIF-04', time: '11:02', pri: 'Medium', title: 'Preauth query raised by Star Health', detail: 'Additional operative notes requested for Ganesan T', src: 'Insurance Preauth Agent', unread: true },
  { id: 'NOTIF-05', time: '10:45', pri: 'Medium', title: 'Consultant leave notice', detail: 'Dr. Arjun Menon requested leave for Mon 22 Sep · 14 appointments affected', src: 'Consultant Scheduling', unread: true },
  { id: 'NOTIF-06', time: '10:20', pri: 'Low', title: 'Bed cleaning completed · Ready for admit', detail: 'Room 304, Bed B released by Housekeeping team', src: 'Facilities & Housekeeping', unread: false },
];

export function NotificationsView({ onOpenDrawer, onOpenModal }) {
  const handleRowClick = (n) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: n.title,
      sub: `${n.id} · Received ${n.time} · Source: ${n.src}`,
      badges: [{ t: n.pri, bg: n.pri === 'Critical' ? '#fee2e2' : n.pri === 'High' ? '#fef3c7' : '#e0e7ff', fg: n.pri === 'Critical' ? '#b91c1c' : n.pri === 'High' ? '#b45309' : '#3730a3' }],
      facts: [
        { k: 'Notification Message', v: n.detail },
        { k: 'Source System', v: n.src },
        { k: 'Priority Level', v: n.pri },
        { k: 'Read Status', v: n.unread ? 'Unread · High Attention' : 'Acknowledged' }
      ],
      actions: [
        { label: 'Mark as Acknowledged', primary: true, on: () => alert(`Notification ${n.id} acknowledged`) },
        { label: 'Deep Link to Workflow', on: () => alert(`Opening correlated workflow for ${n.id}`) }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Hospital Notification Centre"
        subtitle="26 unread platform notifications · clinical safety alerts, agent approvals, SLA breaches and statutory escalations"
        count={26}
        onNew={() => alert('All notifications marked as read')}
        newLabel="Mark All Read"
        onExport={() => alert('Exported notifications log')}
      />

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Time</th>
              <th style={{ padding: '10px 14px' }}>Priority</th>
              <th style={{ padding: '10px 14px' }}>Title</th>
              <th style={{ padding: '10px 14px' }}>Clinical / Operational Details</th>
              <th style={{ padding: '10px 14px' }}>Source Service</th>
              <th style={{ padding: '10px 14px' }}>State</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_NOTIFICATIONS.map(n => (
              <tr
                key={n.id}
                onClick={() => handleRowClick(n)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: n.unread ? 'rgba(254, 242, 242, 0.25)' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = n.unread ? 'rgba(254, 242, 242, 0.25)' : 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{n.time}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(n.pri === 'Critical' ? '#fee2e2' : n.pri === 'High' ? '#fef3c7' : '#f1f5f9', n.pri === 'Critical' ? '#b91c1c' : n.pri === 'High' ? '#b45309' : '#475569')}>
                    {n.pri}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>{n.title}</td>
                <td style={{ padding: '10px 14px', color: '#334155' }}>{n.detail}</td>
                <td style={{ padding: '10px 14px', color: '#0f766e' }}>{n.src}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(n.unread ? '#fee2e2' : '#dcfce7', n.unread ? '#b91c1c' : '#15803d')}>
                    {n.unread ? 'Unread' : 'Read'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const DUMMY_CONFIG = [
  { setting: 'Refusal confidence threshold', value: '70%', scope: 'All AI Agents', changed: '02 Sep 2026', by: 'AI Governance Committee' },
  { setting: 'Critical-value acknowledgement timer', value: '15 minutes → escalate to HoD', scope: 'Laboratory', changed: '15 Aug 2026', by: 'Medical Director' },
  { setting: 'Discharge turnaround target', value: '3 h from doctor intent', scope: 'Operations', changed: '01 Jul 2026', by: 'COO Office' },
  { setting: 'Estimate variance alert threshold', value: '> 5% notify · > 10% counselling mandatory', scope: 'Billing', changed: '01 Apr 2026', by: 'Finance Head' },
  { setting: 'Default patient language', value: 'Tamil (fallback English)', scope: 'Channels & Messaging', changed: '01 Jul 2026', by: 'Patient Experience' },
  { setting: 'PHI masking outside care team', value: 'Enabled (Zero-knowledge redaction)', scope: 'Policy Gateway', changed: '01 Jul 2026', by: 'CISO Office' },
  { setting: 'Conversation retention', value: '0 days (audit metadata 90 days)', scope: 'Agent Memory', changed: '01 Jul 2026', by: 'CISO Office' },
];

export function ConfigurationView({ onOpenDrawer, onOpenModal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="System & Platform Configuration"
        subtitle="Platform settings · changes are fully audited and require AI Administrator role"
        count={DUMMY_CONFIG.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'reason', title: 'Modify System Setting', text: 'Specify configuration key, target value, and governance justification:' })}
        newLabel="+ Edit Config"
        onExport={() => alert('Exported system config')}
      />

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Setting Key</th>
              <th style={{ padding: '10px 14px' }}>Current Value</th>
              <th style={{ padding: '10px 14px' }}>Scope</th>
              <th style={{ padding: '10px 14px' }}>Last Changed</th>
              <th style={{ padding: '10px 14px' }}>Authorized By</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_CONFIG.map((c, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>{c.setting}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#0f766e', fontWeight: 600 }}>{c.value}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#f1f5f9', '#475569')}>{c.scope}</span></td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{c.changed}</td>
                <td style={{ padding: '10px 14px' }}>{c.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const DUMMY_REPORTS = [
  { report: 'Daily Operations Census Summary', domain: 'Operations', freq: 'Daily 06:00', lastRun: '12 Sep 06:00', owner: 'COO Office', status: 'Ready' },
  { report: 'Discharge Turnaround by Blocker Category', domain: 'Operations', freq: 'Daily 06:00', lastRun: '12 Sep 06:00', owner: 'Operations Desk', status: 'Ready' },
  { report: 'Preauth First-Pass Acceptance & Shortfall Analysis', domain: 'Finance', freq: 'Weekly', lastRun: '08 Sep 18:00', owner: 'Insurance Desk', status: 'Ready' },
  { report: 'Estimate Variance > 10% Clinical Audit', domain: 'Finance', freq: 'Weekly', lastRun: '08 Sep 18:00', owner: 'Finance Lead', status: 'Ready' },
  { report: 'Critical-Value Acknowledgement TAT (SLA 15m)', domain: 'Quality', freq: 'Weekly', lastRun: '08 Sep 18:00', owner: 'Quality Head', status: 'Ready' },
  { report: 'AI Measured Value & ROI Board Presentation', domain: 'AI Platform', freq: 'Monthly', lastRun: '01 Sep 09:00', owner: 'AI Programme Lead', status: 'Ready' },
  { report: 'NABH Clinical Documentation Compliance Audit', domain: 'Quality', freq: 'Quarterly', lastRun: '01 Jul 09:00', owner: 'Medical Director', status: 'Ready' },
];

export function ReportsView({ onOpenDrawer, onOpenModal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Reports & Statutory Registers"
        subtitle="Scheduled and on-demand regulatory reports built from the shared clinical data foundation"
        count={DUMMY_REPORTS.length}
        onNew={() => alert('Triggering ad-hoc report compilation')}
        newLabel="+ Run New Report"
        onExport={() => alert('Exported reports register')}
      />

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Report Name</th>
              <th style={{ padding: '10px 14px' }}>Domain</th>
              <th style={{ padding: '10px 14px' }}>Frequency</th>
              <th style={{ padding: '10px 14px' }}>Last Run</th>
              <th style={{ padding: '10px 14px' }}>Owner</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_REPORTS.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>{r.report}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#f1f5f9', '#475569')}>{r.domain}</span></td>
                <td style={{ padding: '10px 14px' }}>{r.freq}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.lastRun}</td>
                <td style={{ padding: '10px 14px' }}>{r.owner}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#dcfce7', '#15803d')}>✓ {r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// GENERIC ADMIN / INTEGRATION MASTER VIEW
// ----------------------------------------------------

export function AdminSystemView({ module = 'Integration Architecture', onOpenDrawer, onOpenModal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title={module}
        subtitle="Governed enterprise infrastructure · connected to clinical data foundation"
        count={8}
        onNew={() => onOpenModal && onOpenModal({ kind: 'reason', title: `Configure ${module}`, text: `Modify settings or credentials for ${module}:` })}
        newLabel="+ Add Configuration"
        onExport={() => alert(`Exported ${module} configuration`)}
      />

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Component</th>
              <th style={{ padding: '10px 14px' }}>Protocol</th>
              <th style={{ padding: '10px 14px' }}>Direction</th>
              <th style={{ padding: '10px 14px' }}>Sync Frequency</th>
              <th style={{ padding: '10px 14px' }}>Fallback Mode</th>
              <th style={{ padding: '10px 14px' }}>Health</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['HMS (Hospital Management System)', 'REST / HL7 v2', 'Bidirectional', 'Real-time (WebSocket)', 'Local SQLite queue', 'Healthy'],
              ['EMR Clinical Progress Notes', 'FHIR R4 / JSON', 'Read · Draft write', '1 min pull', 'Clinician direct input', 'Healthy'],
              ['LIS (Laboratory Information System)', 'ASTM 1394 / TCP', 'Read-only', 'Real-time analyzer push', 'Manual entry fallback', 'Healthy'],
              ['RIS / PACS Imaging & Studies', 'DICOM / DIMSE', 'Read-only', 'On study complete', 'Radiology workstation', 'Healthy'],
              ['Insurance & TPA Clearinghouse', 'National Health Claims (NHCX)', 'Bidirectional', '3 min polling', 'Web portal manual', 'Healthy'],
              ['Central Formulary & Pharmacy', 'REST API', 'Bidirectional', 'Direct transaction', 'Paper MAR contingency', 'Healthy'],
              ['WhatsApp Patient Notification Gateway', 'Meta Cloud API', 'Outbound / Inbound', 'Instant', 'SMS fallback', 'Healthy'],
              ['Clinical Data Foundation Views', 'Clinical SQL Service', 'Registry Ingestion', '5 min interval sync', 'Read replica cache', 'Healthy'],
            ].map(([c, p, d, f, fb, h], i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>{c}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p}</td>
                <td style={{ padding: '10px 14px' }}>{d}</td>
                <td style={{ padding: '10px 14px' }}>{f}</td>
                <td style={{ padding: '10px 14px', color: '#52585e' }}>{fb}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#dcfce7', '#15803d')}>✓ {h}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

