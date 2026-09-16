import React, { useState, useMemo } from 'react';

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
        subtitle="Live out-patient consultation appointments, automated queue management, and doctor check-in desk"
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
const EMERGENCY_CASES = [
  { id: 'ER-401', bay: 'Resus 1', patient: 'Ravi Teja', age: '42M', triage: 'Red', complaint: 'Acute STEMI, severe crushing chest pain', bp: '84/52', hr: 128, spo2: '89%', doctor: 'Dr. Arjun Menon', elapsed: '8m', status: 'Immediate Resuscitation' },
  { id: 'ER-402', bay: 'Trauma 2', patient: 'Sundaram K.', age: '28M', triage: 'Red', complaint: 'RTA polytrauma, suspected pelvic fracture', bp: '98/64', hr: 114, spo2: '94%', doctor: 'Dr. Rajesh Sharma', elapsed: '14m', status: 'FAST Scan in Progress' },
  { id: 'ER-403', bay: 'Bay 03', patient: 'Malini G.', age: '65F', triage: 'Yellow', complaint: 'Severe acute dyspnea, COPD exacerbation', bp: '142/88', hr: 98, spo2: '91%', doctor: 'Dr. Priya Narayanan', elapsed: '22m', status: 'Nebulization & BiPAP' },
  { id: 'ER-404', bay: 'Bay 04', patient: 'Karthik Raja', age: '34M', triage: 'Yellow', complaint: 'Acute appendicular colic, guarding in RIF', bp: '124/78', hr: 82, spo2: '99%', doctor: 'Dr. Pooja Menon', elapsed: '35m', status: 'IV Analgesia & USG Pending' },
  { id: 'ER-405', bay: 'Bay 05', patient: 'Ayesha Banu', age: '19F', triage: 'Green', complaint: 'Moderate laceration on right forearm, bleeding controlled', bp: '116/74', hr: 76, spo2: '99%', doctor: 'Dr. Vignesh K.', elapsed: '41m', status: 'Suturing Planned' },
  { id: 'ER-406', bay: 'Bay 06', patient: 'Natarajan P.', age: '71M', triage: 'Yellow', complaint: 'Transient ischemic attack, left facial weakness resolved', bp: '168/96', hr: 78, spo2: '98%', doctor: 'Dr. Sanjay Gupta', elapsed: '48m', status: 'Urgent NCCT Brain Done' },
];

export function EmergencyView({ onOpenDrawer, onOpenModal }) {
  const handleRowClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.bay} · ${row.patient} (${row.age})`,
      sub: `Triage Level: ${row.triage} · Attending: ${row.doctor}`,
      badges: [
        { t: `LEVEL ${row.triage.toUpperCase()}`, bg: row.triage === 'Red' ? '#fee2e2' : row.triage === 'Yellow' ? '#fef3c7' : '#dcfce7', fg: row.triage === 'Red' ? '#991b1b' : row.triage === 'Yellow' ? '#92400e' : '#166534' },
        { t: row.status, bg: '#f1f5f9', fg: '#334155' }
      ],
      facts: [
        { k: 'Trauma Bay', v: row.bay, b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'Age / Sex', v: row.age },
        { k: 'Chief Complaint', v: row.complaint },
        { k: 'Vital Signs', v: `BP ${row.bp} · HR ${row.hr} bpm · SpO2 ${row.spo2}` },
        { k: 'Elapsed Time', v: row.elapsed },
        { k: 'Attending Doctor', v: row.doctor },
        { k: 'Clinical Status', v: row.status }
      ],
      actions: [
        { label: 'Admit to Inpatient Bed', primary: true, on: () => onOpenModal && onOpenModal({ kind: 'admit', title: `Admit ER Patient: ${row.patient}`, data: { patientId: row.id, name: row.patient, dept: 'Emergency', cls: 'ICU' } }) },
        { label: 'Order Stat Radiology / CT' },
        { label: 'Discharge / Transfer' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Emergency & Trauma Resuscitation Board"
        subtitle="Live emergency department triage, trauma bay occupancy, and vital resuscitation alerts"
        count={EMERGENCY_CASES.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'admit', title: 'Emergency Inpatient Bed Admission', data: { dept: 'Emergency', cls: 'ICU' } })}
        newLabel="+ Triage & Admit"
        onExport={() => alert('Exported ER log')}
      />

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="RED TRIAGE (Immediate)" value="2" sub="Trauma & Resus 1 occupied" color="#dc2626" bg="#fef2f2" />
        <StatCard label="YELLOW TRIAGE (Urgent)" value="3" sub="Within 15 min review window" color="#d97706" bg="#fffbeb" />
        <StatCard label="GREEN TRIAGE (Standard)" value="1" sub="Minor injury & walk-in" color="#059669" bg="#f0fdf4" />
        <StatCard label="ER Bay Occupancy" value="6 / 10" sub="4 Available emergency bays" color="#0284c7" />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Bay / Location</th>
              <th style={{ padding: '10px 14px' }}>Patient</th>
              <th style={{ padding: '10px 14px' }}>Triage Level</th>
              <th style={{ padding: '10px 14px' }}>Chief Presentation</th>
              <th style={{ padding: '10px 14px' }}>Vitals</th>
              <th style={{ padding: '10px 14px' }}>Attending Doctor</th>
              <th style={{ padding: '10px 14px' }}>Elapsed</th>
              <th style={{ padding: '10px 14px' }}>Current Clinical Action</th>
            </tr>
          </thead>
          <tbody>
            {EMERGENCY_CASES.map(row => (
              <tr
                key={row.id}
                onClick={() => handleRowClick(row)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{row.bay}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600 }}>{row.patient}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.age}</div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.triage === 'Red' ? '#fee2e2' : row.triage === 'Yellow' ? '#fef3c7' : '#dcfce7',
                    row.triage === 'Red' ? '#991b1b' : row.triage === 'Yellow' ? '#92400e' : '#166534'
                  )}>
                    ● LEVEL {row.triage.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', maxWidth: '240px', color: '#1e293b' }}>{row.complaint}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px' }}>
                  BP {row.bp} · HR {row.hr} · SpO2 {row.spo2}
                </td>
                <td style={{ padding: '10px 14px' }}>{row.doctor}</td>
                <td style={{ padding: '10px 14px', color: '#64748b' }}>{row.elapsed}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0284c7' }}>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 3. CONSULTANT SCHEDULES (schedules)
// -----------------------------------------------------------------------------
const ROASTER = [
  { doctor: 'Dr. Arjun Menon', dept: 'Cardiology', opd: '09:00 AM - 01:00 PM', days: 'Mon, Wed, Fri', room: 'OPD 102', onCall: 'Tonight (20:00 - 08:00)', status: 'On Duty' },
  { doctor: 'Dr. Priya Narayanan', dept: 'Internal Medicine', opd: '10:00 AM - 02:00 PM', days: 'Daily (Mon-Sat)', room: 'OPD 105', onCall: 'Weekend Coverage', status: 'On Duty' },
  { doctor: 'Dr. Pooja Menon', dept: 'General & Lap. Surgery', opd: '11:00 AM - 03:00 PM', days: 'Tue, Thu, Sat', room: 'OPD 110', onCall: 'Emergency OT Call', status: 'In OT 2' },
  { doctor: 'Dr. Rajesh Sharma', dept: 'Orthopedics & Trauma', opd: '09:30 AM - 01:30 PM', days: 'Mon, Tue, Thu, Fri', room: 'OPD 114', onCall: 'Primary Trauma Call', status: 'On Duty' },
  { doctor: 'Dr. Sanjay Gupta', dept: 'Neurology', opd: '02:00 PM - 06:00 PM', days: 'Mon, Wed, Thu', room: 'OPD 108', onCall: 'Telestroke Active', status: 'Evening Clinic' },
  { doctor: 'Dr. Anita Roy', dept: 'Pediatrics', opd: '09:00 AM - 01:00 PM', days: 'Mon-Fri', room: 'OPD 101', onCall: 'NICU Secondary', status: 'On Duty' },
  { doctor: 'Dr. Meera Iyer', dept: 'Pulmonology', opd: '03:00 PM - 07:00 PM', days: 'Wed, Fri, Sat', room: 'OPD 107', onCall: 'ICU Bronchoscopy', status: 'On Leave' },
];

export function SchedulesView({ onOpenDrawer, onOpenModal }) {
  const handleDoctorClick = (d) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${d.doctor} · ${d.dept}`,
      sub: `Room ${d.room} · Clinic Days: ${d.days}`,
      badges: [
        { t: d.status, bg: d.status === 'On Duty' ? '#dcfce7' : '#fee2e2', fg: d.status === 'On Duty' ? '#15803d' : '#991b1b' }
      ],
      facts: [
        { k: 'Consultant', v: d.doctor, b: true },
        { k: 'Specialty', v: d.dept },
        { k: 'OPD Hours', v: `${d.opd} (${d.days})` },
        { k: 'Room Location', v: d.room },
        { k: 'Emergency On-Call', v: d.onCall },
        { k: 'Current Status', v: d.status }
      ],
      actions: [
        { label: 'Book Appointment', primary: true, on: () => onOpenModal && onOpenModal({ kind: 'appt', title: `Book with ${d.doctor}`, data: { doctorId: d.doctor } }) },
        { label: 'Request Shift Swap' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Consultant Roster & On-Call Schedules"
        subtitle="Medical consultant clinic hours, emergency on-call rotas, and leave master"
        count={ROASTER.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'doctors', title: 'Add Doctor / Consultant' })}
        newLabel="+ Add Doctor"
        onExport={() => alert('Exported consultant roster')}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
        {ROASTER.map(d => (
          <div
            key={d.doctor}
            onClick={() => handleDoctorClick(d)}
            style={{ ...cardStyle, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e3e6e8'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{d.doctor}</div>
              <span style={pillStyle(d.status === 'On Duty' ? '#dcfce7' : d.status === 'On Leave' ? '#fee2e2' : '#fef3c7', d.status === 'On Duty' ? '#15803d' : d.status === 'On Leave' ? '#991b1b' : '#92400e')}>
                ● {d.status}
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#0369a1', fontWeight: 600, marginTop: '2px' }}>{d.dept} · {d.room}</div>
            <div style={{ fontSize: '12px', color: '#334155', marginTop: '8px' }}>
              <strong>OPD Hours:</strong> {d.opd} ({d.days})
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
              <strong>On-Call Assignment:</strong> {d.onCall}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 4. NURSING WORKSPACE (nursing)
// -----------------------------------------------------------------------------
const NURSING_TASKS = [
  { bed: 'Bed 201-A', patient: 'Saanvier Parthalan', uhid: 'MER-PAT-0087227', task: 'Q4H Blood Glucose Monitoring (Pre-lunch check)', status: 'Due Now', nurse: 'Anitha Kumar', notes: 'Target BG < 160 mg/dL' },
  { bed: 'Bed 202-B', patient: 'Kavitha Raman', uhid: 'MER-PAT-0087221', task: 'Titrate IV Heparin @ 18 ml/hr & check aPTT', status: 'In Progress', nurse: 'K. Selvi', notes: 'Check puncture site for hematoma' },
  { bed: 'Bed 204-A', patient: 'Christoer Parthalan', uhid: 'MER-PAT-0087233', task: 'Post-op surgical dressing inspection & drain output', status: 'Completed', nurse: 'Anitha Kumar', notes: 'Drain: 25ml serosanguinous' },
  { bed: 'Bed 205-C', patient: 'Natarajan P.', uhid: 'MER-PAT-0087235', task: 'Turn & reposition Q2H + Fall Risk Precautions', status: 'Due in 30m', nurse: 'K. Selvi', notes: 'Braden Score 13 - High Risk' },
  { bed: 'Bed 208-A', patient: 'Lakshmi Narayanan', uhid: 'MER-PAT-0087230', task: 'Administer Inj. Cefoperazone-Sulbactam 1.5g IV', status: 'Due Now', nurse: 'Anitha Kumar', notes: 'Skin test negative confirmed' },
];

export function NursingWorkspaceView({ onOpenDrawer, onOpenModal }) {
  const handleTaskClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.bed} · ${row.patient}`,
      sub: `Order: ${row.task} · Nurse: ${row.nurse}`,
      badges: [
        { t: row.status, bg: row.status === 'Due Now' ? '#fee2e2' : row.status === 'In Progress' ? '#fef3c7' : '#dcfce7', fg: row.status === 'Due Now' ? '#991b1b' : row.status === 'In Progress' ? '#92400e' : '#166534' }
      ],
      facts: [
        { k: 'Bed / Room', v: row.bed, b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'UHID / MRN', v: row.uhid },
        { k: 'Nursing Task', v: row.task },
        { k: 'Current Status', v: row.status },
        { k: 'Assigned Nurse', v: row.nurse },
        { k: 'Clinical Instructions', v: row.notes }
      ],
      actions: [
        { label: 'Mark Task Completed', primary: true, on: () => alert(`Task completed for ${row.patient}`) },
        { label: 'Record Vital Signs' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Inpatient Nursing Station & Shift Tasks"
        subtitle="Live ward nurse assignment, scheduled drug administration, and clinical care checklists"
        count={NURSING_TASKS.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'staff', title: 'Add Staff Nurse / User' })}
        newLabel="+ Add Nurse"
        onExport={() => alert('Exported nursing care log')}
      />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Assigned Inpatients" value="28" sub="Floor 2 Wards A & B" color="#0284c7" />
        <StatCard label="Tasks Due Now" value="2" sub="Immediate nursing action required" color="#dc2626" />
        <StatCard label="Infusions Running" value="9" sub="Smart syringe & IV pumps" color="#059669" />
        <StatCard label="High Fall Risk" value="4" sub="Bed alarm & sensor pads active" color="#d97706" />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Bed</th>
              <th style={{ padding: '10px 14px' }}>Patient / UHID</th>
              <th style={{ padding: '10px 14px' }}>Nursing Task / Order</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
              <th style={{ padding: '10px 14px' }}>Assigned Nurse</th>
              <th style={{ padding: '10px 14px' }}>Clinical Instructions</th>
            </tr>
          </thead>
          <tbody>
            {NURSING_TASKS.map((row, idx) => (
              <tr key={idx} onClick={() => handleTaskClick(row)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f766e' }}>{row.bed}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600 }}>{row.patient}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.uhid}</div>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{row.task}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.status === 'Due Now' ? '#fee2e2' : row.status === 'In Progress' ? '#fef3c7' : '#dcfce7',
                    row.status === 'Due Now' ? '#991b1b' : row.status === 'In Progress' ? '#92400e' : '#166534'
                  )}>
                    {row.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>{row.nurse}</td>
                <td style={{ padding: '10px 14px', color: '#52585e' }}>{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 5. MEDICATION ADMINISTRATION (eMAR)
// -----------------------------------------------------------------------------
const EMAR_SCHEDULE = [
  { time: '08:00 AM', patient: 'Saanvier Parthalan', bed: 'Bed 201-A', med: 'Inj. Regular Human Insulin', dose: '8 Units SubCut', status: 'Given', nurse: 'Anitha Kumar', signedAt: '08:05 AM' },
  { time: '08:00 AM', patient: 'Saanvier Parthalan', bed: 'Bed 201-A', med: 'Tab. Pantoprazole 40mg', dose: '1 Tab Oral before breakfast', status: 'Given', nurse: 'Anitha Kumar', signedAt: '08:06 AM' },
  { time: '12:00 PM', patient: 'Christoer Parthalan', bed: 'Bed 204-A', med: 'Inj. Metronidazole 500mg', dose: '100ml IV Infusion over 30 mins', status: 'Due Now', nurse: 'Anitha Kumar', signedAt: '—' },
  { time: '02:00 PM', patient: 'Kavitha Raman', bed: 'Bed 202-B', med: 'Tab. Atorvastatin 40mg', dose: '1 Tab Oral', status: 'Scheduled', nurse: 'K. Selvi', signedAt: '—' },
  { time: '02:00 PM', patient: 'Lakshmi Narayanan', bed: 'Bed 208-A', med: 'Inj. Paracetamol 1000mg', dose: '100ml IV Infusion SOS for fever', status: 'Scheduled', nurse: 'K. Selvi', signedAt: '—' },
  { time: '08:00 PM', patient: 'Saanvier Parthalan', bed: 'Bed 201-A', med: 'Inj. Glargine Insulin (Lantus)', dose: '14 Units SubCut at bedtime', status: 'Scheduled', nurse: 'Night Shift Nurse', signedAt: '—' },
];

export function MedicationAdminView({ onOpenDrawer, onOpenModal }) {
  const handleEmarClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.med} · ${row.dose}`,
      sub: `Patient: ${row.patient} (${row.bed}) · Slot: ${row.time}`,
      badges: [
        { t: row.status, bg: row.status === 'Given' ? '#dcfce7' : row.status === 'Due Now' ? '#fee2e2' : '#f1f5f9', fg: row.status === 'Given' ? '#15803d' : row.status === 'Due Now' ? '#991b1b' : '#475569' }
      ],
      facts: [
        { k: 'Medication', v: row.med, b: true },
        { k: 'Dose & Route', v: row.dose },
        { k: 'Patient', v: row.patient },
        { k: 'Bed Assignment', v: row.bed },
        { k: 'Scheduled Round', v: row.time },
        { k: 'Administration Status', v: row.status },
        { k: 'Nurse Sign-off', v: `${row.nurse} (${row.signedAt})` }
      ],
      actions: [
        { label: 'Confirm Barcode Admin', primary: true, on: () => alert(`Administered ${row.med} to ${row.patient}`) },
        { label: 'Hold Dose / Report Allergy' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="eMAR · Electronic Medication Administration Record"
        subtitle="Barcode-verified drug administration rounds, nurse sign-offs, and scheduled dosages"
        count={EMAR_SCHEDULE.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'drugs', title: 'Add Drug to Formulary' })}
        newLabel="+ Add Drug"
        onExport={() => alert('Exported eMAR log')}
      />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Doses Due Today" value="54" sub="Round 08:00, 12:00, 18:00, 22:00" color="#0284c7" />
        <StatCard label="Administered & Signed" value="38" sub="100% Barcode double-checked" color="#059669" />
        <StatCard label="Pending Now" value="1" sub="Inj. Metronidazole due" color="#d97706" />
        <StatCard label="Adverse Drug Reactions" value="0" sub="Zero allergy overrides reported" color="#475569" />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Scheduled</th>
              <th style={{ padding: '10px 14px' }}>Patient / Bed</th>
              <th style={{ padding: '10px 14px' }}>Medication &amp; Strength</th>
              <th style={{ padding: '10px 14px' }}>Dose &amp; Route</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
              <th style={{ padding: '10px 14px' }}>Administered By</th>
              <th style={{ padding: '10px 14px' }}>Sign-off Time</th>
            </tr>
          </thead>
          <tbody>
            {EMAR_SCHEDULE.map((row, idx) => (
              <tr key={idx} onClick={() => handleEmarClick(row)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 14px', fontWeight: 700 }}>{row.time}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: 600 }}>{row.patient}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{row.bed}</div>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{row.med}</td>
                <td style={{ padding: '10px 14px', color: '#334155' }}>{row.dose}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.status === 'Given' ? '#dcfce7' : row.status === 'Due Now' ? '#fee2e2' : '#f1f5f9',
                    row.status === 'Given' ? '#15803d' : row.status === 'Due Now' ? '#991b1b' : '#475569'
                  )}>
                    ● {row.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>{row.nurse}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px' }}>{row.signedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 6. OT & SURGERY SUITE (surgery & otschedule)
// -----------------------------------------------------------------------------
const SURGERY_CASES = [
  { ot: 'OT-01 (Cardiac)', patient: 'Kavitha Raman', procedure: 'Coronary Angiography & Stenting', surgeon: 'Dr. Arjun Menon', anesthetist: 'Dr. K. Nair', stage: 'In PACU Recovery', start: '08:30 AM', end: '10:15 AM' },
  { ot: 'OT-02 (General)', patient: 'Christoer Parthalan', procedure: 'Emergency Laparoscopic Appendectomy', surgeon: 'Dr. Pooja Menon', anesthetist: 'Dr. K. Nair', stage: 'Surgical Incision', start: '10:00 AM', end: 'Est 11:30 AM' },
  { ot: 'OT-03 (Orthopedics)', patient: 'Sundaram K.', procedure: 'ORIF Patella & Tension Band Wiring', surgeon: 'Dr. Rajesh Sharma', anesthetist: 'Dr. Geetha V.', stage: 'Pre-op Anesthesia Induction', start: '10:45 AM', end: 'Est 12:45 PM' },
  { ot: 'OT-04 (Maternity/Gyn)', patient: 'Revathi S.', procedure: 'Elective Lower Segment Cesarean Section', surgeon: 'Dr. Anita Roy', anesthetist: 'Dr. Geetha V.', stage: 'Scheduled Next (12:00 PM)', start: '12:00 PM', end: 'Est 01:15 PM' },
];

export function SurgeryOTView({ onOpenDrawer, onOpenModal }) {
  const handleSurgeryClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.ot} · ${row.procedure}`,
      sub: `Surgeon: ${row.surgeon} · Anesthetist: ${row.anesthetist}`,
      badges: [
        { t: row.stage, bg: row.stage.includes('PACU') ? '#dcfce7' : '#fee2e2', fg: row.stage.includes('PACU') ? '#15803d' : '#991b1b' }
      ],
      facts: [
        { k: 'Operating Theatre', v: row.ot, b: true },
        { k: 'Patient Name', v: row.patient, b: true },
        { k: 'Surgical Procedure', v: row.procedure },
        { k: 'Lead Surgeon', v: row.surgeon },
        { k: 'Anesthetist', v: row.anesthetist },
        { k: 'Intra-Op Stage', v: row.stage },
        { k: 'Timing', v: `${row.start} → ${row.end}` }
      ],
      actions: [
        { label: 'Check into PACU', primary: true, on: () => alert(`Transferred ${row.patient} to PACU`) },
        { label: 'Print WHO Checklist' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Operating Theatres & Surgical Suite"
        subtitle="Live OT suite tracking, intra-operative milestones, anesthesia records, and PACU recovery"
        count={SURGERY_CASES.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'services', title: 'Add Surgical Service / OT Procedure' })}
        newLabel="+ Schedule OT Case"
        onExport={() => alert('Exported OT ledger')}
      />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Active Theatre Rooms" value="3 / 4" sub="OT 1, OT 2, OT 3 In Progress" color="#0284c7" />
        <StatCard label="Cases Slated Today" value="9" sub="4 Completed · 3 Active · 2 Next" color="#059669" />
        <StatCard label="In Recovery (PACU)" value="1" sub="Kavitha Raman - Aldrete Score 9" color="#d97706" />
        <StatCard label="Emergency OT Ready" value="OT-05" sub="Cleaned & sterile emergency reserve" color="#475569" />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>OT Suite</th>
              <th style={{ padding: '10px 14px' }}>Patient</th>
              <th style={{ padding: '10px 14px' }}>Surgical Procedure</th>
              <th style={{ padding: '10px 14px' }}>Lead Surgeon</th>
              <th style={{ padding: '10px 14px' }}>Anesthetist</th>
              <th style={{ padding: '10px 14px' }}>Stage</th>
              <th style={{ padding: '10px 14px' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {SURGERY_CASES.map((row, idx) => (
              <tr key={idx} onClick={() => handleSurgeryClick(row)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0369a1' }}>{row.ot}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.patient}</td>
                <td style={{ padding: '10px 14px', color: '#0f172a' }}>{row.procedure}</td>
                <td style={{ padding: '10px 14px' }}>{row.surgeon}</td>
                <td style={{ padding: '10px 14px', color: '#64748b' }}>{row.anesthetist}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.stage.includes('Incision') ? '#fee2e2' :
                    row.stage.includes('PACU') ? '#dcfce7' : '#fef3c7',
                    row.stage.includes('Incision') ? '#991b1b' :
                    row.stage.includes('PACU') ? '#15803d' : '#92400e'
                  )}>
                    ● {row.stage}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px' }}>
                  {row.start} → {row.end}
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
// 7. BLOOD BANK (bloodbank)
// -----------------------------------------------------------------------------
const BLOOD_INVENTORY = [
  { group: 'O Positive (O+)', prbc: 18, ffp: 12, platelets: 6, reserved: 3, status: 'Adequate' },
  { group: 'A Positive (A+)', prbc: 14, ffp: 8, platelets: 4, reserved: 2, status: 'Adequate' },
  { group: 'B Positive (B+)', prbc: 16, ffp: 10, platelets: 5, reserved: 1, status: 'Adequate' },
  { group: 'AB Positive (AB+)', prbc: 6, ffp: 4, platelets: 2, reserved: 0, status: 'Adequate' },
  { group: 'O Negative (O-)', prbc: 3, ffp: 2, platelets: 1, reserved: 2, status: 'Critical Reserve' },
  { group: 'A Negative (A-)', prbc: 4, ffp: 2, platelets: 1, reserved: 0, status: 'Low Stock' },
  { group: 'B Negative (B-)', prbc: 2, ffp: 1, platelets: 0, reserved: 1, status: 'Critical Reserve' },
];

export function BloodBankView({ onOpenDrawer, onOpenModal }) {
  const handleBbClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `Blood Inventory: ${row.group}`,
      sub: `PRBC: ${row.prbc} units · FFP: ${row.ffp} units · Platelets: ${row.platelets} bags`,
      badges: [
        { t: row.status, bg: row.status === 'Adequate' ? '#dcfce7' : '#fee2e2', fg: row.status === 'Adequate' ? '#15803d' : '#991b1b' }
      ],
      facts: [
        { k: 'ABO / Rh Group', v: row.group, b: true },
        { k: 'Packed Cells (PRBC)', v: `${row.prbc} units` },
        { k: 'Fresh Frozen Plasma', v: `${row.ffp} units` },
        { k: 'Platelets Concentrate', v: `${row.platelets} bags` },
        { k: 'Reserved for Active OT', v: `${row.reserved} units` },
        { k: 'Stock Disposition', v: row.status }
      ],
      actions: [
        { label: 'Issue Units to OT', primary: true, on: () => alert(`Issued unit of ${row.group} to OT`) },
        { label: 'Notify Voluntary Donors' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Blood Bank Component Inventory & Cross-Match"
        subtitle="Licensed blood bank storage, component separation units, cross-match reservations and voluntary donor registry"
        count={BLOOD_INVENTORY.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'vendors', title: 'Add Blood Bank Supplier / Donor Org' })}
        newLabel="+ Request Units"
        onExport={() => alert('Exported blood bank inventory')}
      />
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard label="Total Packed Cells (PRBC)" value="63 Units" sub="4°C Monitored Refrigeration" color="#dc2626" />
        <StatCard label="Fresh Frozen Plasma" value="39 Units" sub="-30°C Cryopreserved" color="#0284c7" />
        <StatCard label="Platelet Concentrates" value="19 Bags" sub="Agitator incubator 22°C" color="#d97706" />
        <StatCard label="Active Cross-Match Requests" value="9 Units" sub="2 Units reserved for OT-03" color="#059669" />
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Blood Group</th>
              <th style={{ padding: '10px 14px' }}>PRBC Units</th>
              <th style={{ padding: '10px 14px' }}>FFP Units</th>
              <th style={{ padding: '10px 14px' }}>Platelet Bags</th>
              <th style={{ padding: '10px 14px' }}>Reserved for Surgery</th>
              <th style={{ padding: '10px 14px' }}>Stock Alert</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {BLOOD_INVENTORY.map(row => (
              <tr key={row.group} onClick={() => handleBbClick(row)} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: '13px' }}>{row.group}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.prbc} units</td>
                <td style={{ padding: '10px 14px' }}>{row.ffp} units</td>
                <td style={{ padding: '10px 14px' }}>{row.platelets} bags</td>
                <td style={{ padding: '10px 14px', color: '#0369a1' }}>{row.reserved} units</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(
                    row.status === 'Critical Reserve' ? '#fee2e2' : row.status === 'Low Stock' ? '#fef3c7' : '#dcfce7',
                    row.status === 'Critical Reserve' ? '#991b1b' : row.status === 'Low Stock' ? '#92400e' : '#166534'
                  )}>
                    ● {row.status}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <button type="button" onClick={() => alert(`Initiated donor call / request for ${row.group}`)} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                    Request Stock
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
const SBAR_DATA = [
  { bed: 'Bed 201-A', patient: 'Saanvier Parthalan, 84F', nurse: 'Anitha Kumar -> Selvi K.', situation: 'Type 2 DM with DKA, 3 days inpatient, blood sugar normalized (118 mg/dL).', background: 'Admitted with random BG 384 mg/dL. IV insulin infusion transitioned to subcutaneous regimen.', assessment: 'Hemodynamically stable, ketones negative. Billing cleared. Awaiting final discharge summary sign-off.', recommendation: 'Ensure patient takes light breakfast. Deliver discharge medication package once physician signs summary.' },
  { bed: 'Bed 202-B', patient: 'Kavitha Raman, 58F', nurse: 'Anitha Kumar -> Selvi K.', situation: 'Post-PTCA Day 2, femoral puncture site stable, dual antiplatelets active.', background: 'Presented with acute angina and hs-Troponin 53.2 pg/mL. Stented with drug-eluting stent in LAD.', assessment: 'No chest pain, puncture site clean. TPA final approval pending.', recommendation: 'Maintain telemetry monitoring until noon. Follow up with MediAssist coordinator.' },
];

export function SbarView({ onOpenDrawer, onOpenModal }) {
  const handleSbarClick = (item) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${item.bed} · ${item.patient}`,
      sub: `Handover by: ${item.nurse}`,
      badges: [{ t: 'SBAR Handover', bg: '#e0f2fe', fg: '#0369a1' }],
      facts: [
        { k: 'Bed Assignment', v: item.bed, b: true },
        { k: 'Patient Name', v: item.patient, b: true },
        { k: 'Handover Nurses', v: item.nurse },
        { k: 'Situation (S)', v: item.situation },
        { k: 'Background (B)', v: item.background },
        { k: 'Assessment (A)', v: item.assessment },
        { k: 'Recommendation (R)', v: item.recommendation }
      ],
      actions: [
        { label: 'Acknowledge Shift Handover', primary: true, on: () => alert(`Handover acknowledged for ${item.patient}`) },
        { label: 'Print SBAR Card' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Ward Clinical Handover · SBAR Protocol"
        subtitle="Situation, Background, Assessment, Recommendation shift-to-shift nurse and doctor handover cards"
        count={SBAR_DATA.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'reason', title: 'Add SBAR Shift Handover Note', text: 'Enter patient bed, current status, and key clinical handoff recommendations:' })}
        newLabel="+ New Handover"
        onExport={() => alert('Exported SBAR handover log')}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {SBAR_DATA.map((item, idx) => (
          <div
            key={idx}
            onClick={() => handleSbarClick(item)}
            style={{ ...cardStyle, cursor: 'pointer', transition: 'border-color 0.15s, transform 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'oklch(0.5 0.1 200)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '12px' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f766e' }}>{item.bed}</span>
                <strong style={{ fontSize: '14px', color: '#0f172a', marginLeft: '8px' }}>{item.patient}</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Handover: <strong>{item.nurse}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', fontSize: '12px', lineHeight: 1.5 }}>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #0284c7' }}>
                <strong style={{ color: '#0284c7', textTransform: 'uppercase', fontSize: '11px', display: 'block', marginBottom: '4px' }}>[S] Situation</strong>
                {item.situation}
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #64748b' }}>
                <strong style={{ color: '#475569', textTransform: 'uppercase', fontSize: '11px', display: 'block', marginBottom: '4px' }}>[B] Background</strong>
                {item.background}
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #d97706' }}>
                <strong style={{ color: '#d97706', textTransform: 'uppercase', fontSize: '11px', display: 'block', marginBottom: '4px' }}>[A] Assessment</strong>
                {item.assessment}
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #059669' }}>
                <strong style={{ color: '#059669', textTransform: 'uppercase', fontSize: '11px', display: 'block', marginBottom: '4px' }}>[R] Recommendation</strong>
                {item.recommendation}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 12. DEATH & MLC REGISTER (deathmlc)
// -----------------------------------------------------------------------------
const MLC_RECORDS = [
  { mlcNo: 'MLC-2026-042', date: '14 Sept 2026', patient: 'Sundaram K.', age: '28M', type: 'Road Traffic Accident', station: 'Yelagiri Hills PS', io: 'SI Karunakaran', injuryReport: 'Polytrauma, fracture patella, blunt chest injury', status: 'Police Intimated & Acknowledged' },
  { mlcNo: 'MLC-2026-041', date: '11 Sept 2026', patient: 'Ayesha Banu', age: '19F', type: 'Workplace Industrial Injury', station: 'Tirupattur Town PS', io: 'HC Natarajan', injuryReport: 'Deep flexor tendon laceration right forearm', status: 'Wound Certificate Issued' },
  { mlcNo: 'MLC-2026-040', date: '06 Sept 2026', patient: 'Ramesh V.', age: '52M', type: 'Suspected Accidental Poisoning', station: 'Jolarpettai PS', io: 'SI Murugan', injuryReport: 'Organophosphate compound smell, gastric lavage done', status: 'Discharged - Investigation Closed' },
];

export function DeathMlcView({ onOpenDrawer, onOpenModal }) {
  const handleMlcClick = (row) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${row.mlcNo} · ${row.patient}`,
      sub: `Incident: ${row.type} · Police Station: ${row.station}`,
      badges: [{ t: row.status, bg: '#e0f2fe', fg: '#0369a1' }],
      facts: [
        { k: 'MLC Record No', v: row.mlcNo, b: true },
        { k: 'Registration Date', v: row.date },
        { k: 'Patient Details', v: `${row.patient} (${row.age})` },
        { k: 'Incident Nature', v: row.type },
        { k: 'Jurisdiction Station', v: row.station },
        { k: 'Investigating Officer', v: row.io },
        { k: 'Wound / Trauma Report', v: row.injuryReport },
        { k: 'Statutory Status', v: row.status }
      ],
      actions: [
        { label: 'Issue Wound Certificate', primary: true, on: () => alert(`Wound certificate generated for ${row.mlcNo}`) },
        { label: 'Print Police Intimation Form' }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Medico-Legal Case (MLC) & Statutory Register"
        subtitle="Police intimations, accident wound certificates, post-mortem tracking, and statutory medico-legal compliance"
        count={MLC_RECORDS.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'reason', title: 'Register Medico-Legal Case (MLC)', text: 'Specify incident details, patient identity, attending CMO, and police station intimation number:' })}
        newLabel="+ Register MLC"
        onExport={() => alert('Exported MLC register')}
      />
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>MLC Number</th>
              <th style={{ padding: '10px 14px' }}>Date</th>
              <th style={{ padding: '10px 14px' }}>Patient / Age</th>
              <th style={{ padding: '10px 14px' }}>Incident Type</th>
              <th style={{ padding: '10px 14px' }}>Police Station / IO</th>
              <th style={{ padding: '10px 14px' }}>Clinical Injury Description</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {MLC_RECORDS.map(row => (
              <tr
                key={row.mlcNo}
                onClick={() => handleMlcClick(row)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#dc2626' }}>{row.mlcNo}</td>
                <td style={{ padding: '10px 14px', color: '#64748b' }}>{row.date}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600 }}>{row.patient} ({row.age})</td>
                <td style={{ padding: '10px 14px' }}>{row.type}</td>
                <td style={{ padding: '10px 14px' }}>{row.station} · {row.io}</td>
                <td style={{ padding: '10px 14px', color: '#334155' }}>{row.injuryReport}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle('#e0f2fe', '#0369a1')}>
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

  const title = isPatient ? 'Master Patient Index · Databricks Gold Layer' :
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
// PHARMACY & SUPPLY CHAIN VIEWS
// ----------------------------------------------------

export const DUMMY_PRESCRIPTIONS = [
  { id: 'RX-2026-0041', patientId: 'MER-2026-007733', patient: 'Murugan Selvam', drug: 'Aspirin 75 mg + Clopidogrel 75 mg', dose: '75 mg PO OD', days: '30 d · 60 tab', doctor: 'Dr. Priya Venkatesh', checks: ['Clear · antiplatelet protocol verified'], verifiedBy: 'S. Devi, RPh', status: 'Prescribed' },
  { id: 'RX-2026-0042', patientId: 'MER-2026-008421', patient: 'Kavitha Raman', drug: 'Enoxaparin Injection 40 mg', dose: '40 mg SC OD', days: '5 d · 5 amp', doctor: 'Dr. Arjun Menon', checks: ['Clear · renal function normal'], verifiedBy: 'S. Devi, RPh', status: 'Verified' },
  { id: 'RX-2026-0043', patientId: 'MER-2026-009104', patient: 'Fathima Begum', drug: 'Meropenem Injection 1 g', dose: '1 g IV TDS', days: '7 d · 21 vial', doctor: 'Dr. Rajesh Kannan', checks: ['⚠ High-alert antibiotic'], verifiedBy: '—', status: 'Stock-out' },
  { id: 'RX-2026-0044', patientId: 'MER-2026-005098', patient: 'Meenakshi Sundaram', drug: 'Ondansetron 4 mg Tab', dose: '4 mg PO BD', days: '3 d · 6 tab', doctor: 'Dr. Priya Venkatesh', checks: ['Clear · pre-chemo antiemetic'], verifiedBy: 'K. Meena, RPh', status: 'Dispensed' },
  { id: 'RX-2026-0045', patientId: 'MER-2026-003319', patient: 'R. Sundar', drug: 'Atorvastatin 40 mg', dose: '40 mg PO HS', days: '30 d · 30 tab', doctor: 'Dr. Arjun Menon', checks: ['Clear · lipid management'], verifiedBy: 'S. Devi, RPh', status: 'Prescribed' },
  { id: 'RX-2026-0046', patientId: 'MER-2026-001290', patient: 'Anitha Kumar', drug: 'Paracetamol 650 mg', dose: '650 mg PO QDS', days: '3 d · 12 tab', doctor: 'Dr. Sanjay Gupta', checks: ['Clear · PRN fever'], verifiedBy: 'K. Meena, RPh', status: 'Dispensed' },
];

export function PrescriptionsView({ onOpenDrawer, onOpenModal }) {
  const [filter, setFilter] = useState('All');
  const filtered = DUMMY_PRESCRIPTIONS.filter(r => filter === 'All' || r.status === filter);

  const handleRowClick = (r) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `Rx: ${r.drug}`,
      sub: `${r.id} · ${r.patient} · Prescribed by ${r.doctor}`,
      badges: [{ t: r.status, bg: r.status === 'Dispensed' ? '#dcfce7' : r.status === 'Stock-out' ? '#fee2e2' : '#e0e7ff', fg: r.status === 'Dispensed' ? '#15803d' : r.status === 'Stock-out' ? '#b91c1c' : '#3730a3' }],
      facts: [
        { k: 'Dosage & Route', v: r.dose },
        { k: 'Duration & Quantity', v: r.days },
        { k: 'Safety & Interaction', v: r.checks[0] },
        { k: 'Verification', v: r.verifiedBy },
        { k: 'Patient UHID', v: r.patientId }
      ],
      actions: [
        { label: 'Verify & Dispense', primary: true, on: () => alert(`Pharmacist verification confirmed for ${r.id}`) },
        { label: 'Print MAR Label', on: () => alert(`MAR label queued for ${r.patient}`) }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Prescriptions & Pharmacy Orders"
        subtitle="Prescription → pharmacist verification (allergy · interaction · controlled-drug checks) → dispense from mapped stock item with batch & expiry → MAR rows"
        count={DUMMY_PRESCRIPTIONS.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'prescription', title: 'New Prescription Entry' })}
        newLabel="+ Prescribe Medication"
        onExport={() => alert('Exported prescriptions CSV')}
      />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        {[
          ['Awaiting verification', '4', '#d97706'],
          ['Verified · to dispense', '12', '#2563eb'],
          ['Stock-out', '1', '#dc2626'],
          ['Safety flags open', '2', '#dc2626'],
          ['Dispensed today', '38', '#16a34a'],
        ].map(([k, v, c]) => (
          <div key={k} style={{ ...cardStyle, padding: '12px 16px' }}>
            <div style={{ fontSize: '11px', color: '#8a9096' }}>{k}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: c, marginTop: '2px' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {['All', 'Prescribed', 'Verified', 'Dispensed', 'Stock-out'].map(st => (
          <button
            key={st}
            type="button"
            onClick={() => setFilter(st)}
            style={{
              padding: '4px 12px', borderRadius: '12px', fontSize: '11.5px', border: '1px solid #e3e6e8',
              background: filter === st ? '#15181b' : '#fff', color: filter === st ? '#fff' : '#52585e', cursor: 'pointer'
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
              <th style={{ padding: '10px 14px' }}>Rx ID</th>
              <th style={{ padding: '10px 14px' }}>Patient</th>
              <th style={{ padding: '10px 14px' }}>Drug</th>
              <th style={{ padding: '10px 14px' }}>Dose · Route · Freq</th>
              <th style={{ padding: '10px 14px' }}>Days · Qty</th>
              <th style={{ padding: '10px 14px' }}>Prescriber</th>
              <th style={{ padding: '10px 14px' }}>Safety</th>
              <th style={{ padding: '10px 14px' }}>Verified By</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr
                key={r.id}
                onClick={() => handleRowClick(r)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{r.id}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>{r.patient}</td>
                <td style={{ padding: '10px 14px' }}>{r.drug}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.dose}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{r.days}</td>
                <td style={{ padding: '10px 14px' }}>{r.doctor}</td>
                <td style={{ padding: '10px 14px', color: r.checks[0].includes('⚠') ? '#dc2626' : '#15803d' }}>{r.checks[0]}</td>
                <td style={{ padding: '10px 14px' }}>{r.verifiedBy}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(r.status === 'Dispensed' ? '#dcfce7' : r.status === 'Stock-out' ? '#fee2e2' : '#e0e7ff', r.status === 'Dispensed' ? '#15803d' : r.status === 'Stock-out' ? '#b91c1c' : '#3730a3')}>
                    {r.status}
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

export const DUMMY_DRUGS = [
  { id: 'DRUG-01', generic: 'Paracetamol', brand: 'Dolo 650', form: 'Tablet', strength: '650 mg', schedule: 'OTC', route: 'Oral', stockItem: 'TAB-PAR-650 (2,400 tab)', highAlert: false, interactions: 'None major', active: true },
  { id: 'DRUG-02', generic: 'Enoxaparin Sodium', brand: 'Clexane', form: 'Injection', strength: '40 mg / 0.4 mL', schedule: 'Sch H', route: 'SC', stockItem: 'INJ-ENOX-40 (180 amp)', highAlert: true, interactions: 'Heparin, Warfarin, NSAIDs', active: true },
  { id: 'DRUG-03', generic: 'Meropenem', brand: 'Meronem', form: 'Injection', strength: '1 g', schedule: 'Sch H1', route: 'IV', stockItem: 'INJ-MERO-1G (12 vial)', highAlert: true, interactions: 'Valproic acid', active: true },
  { id: 'DRUG-04', generic: 'Atorvastatin', brand: 'Atorva 40', form: 'Tablet', strength: '40 mg', schedule: 'Sch H', route: 'Oral', stockItem: 'TAB-ATOR-40 (850 tab)', highAlert: false, interactions: 'Clarithromycin', active: true },
  { id: 'DRUG-05', generic: 'Tramadol HCl', brand: 'Tramazac', form: 'Injection', strength: '50 mg / mL', schedule: 'Sch X', route: 'IV/IM', stockItem: 'INJ-TRAM-50 (45 amp)', highAlert: true, interactions: 'SSRIs, MAOIs, CNS depressants', active: true },
  { id: 'DRUG-06', generic: 'Metformin HCl', brand: 'Glycomet 500', form: 'Tablet', strength: '500 mg', schedule: 'Sch H', route: 'Oral', stockItem: 'TAB-MET-500 (1,900 tab)', highAlert: false, interactions: 'Iodinated contrast media', active: true },
];

export function DrugMasterView({ onOpenDrawer, onOpenModal }) {
  const [filter, setFilter] = useState('All');
  const filtered = DUMMY_DRUGS.filter(d => filter === 'All' || d.form === filter);

  const handleRowClick = (d) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${d.generic} (${d.brand})`,
      sub: `${d.id} · ${d.form} ${d.strength} · Schedule ${d.schedule}`,
      badges: [{ t: d.active ? 'Active Formulary' : 'Inactive', bg: '#dcfce7', fg: '#15803d' }, ...(d.highAlert ? [{ t: 'High Alert', bg: '#fee2e2', fg: '#b91c1c' }] : [])],
      facts: [
        { k: 'Route', v: d.route },
        { k: 'Mapped Inventory Item', v: d.stockItem },
        { k: 'Schedule Classification', v: d.schedule },
        { k: 'Known Drug Interactions', v: d.interactions },
      ],
      actions: [
        { label: 'Check Live Inventory', primary: true, on: () => alert(`Central stock check for ${d.generic}: 420 units available`) },
        { label: 'Edit Formulary Parameters', on: () => onOpenModal && onOpenModal({ kind: 'reason', title: 'Edit Drug Master', text: `Modify formulation or interaction alerts for ${d.generic}:` }) }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Drug Master & Formulary Catalog"
        subtitle="142 formulary entries · generic, brand, form, strength, schedule (H / OTC / X), route, mapped inventory item, high-alert flag, interaction pairs"
        count={DUMMY_DRUGS.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'drug', title: 'Add Formulary Drug Master' })}
        newLabel="+ Add Formulary Drug"
        onExport={() => alert('Exported drug formulary')}
      />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        {[
          ['Formulary entries', '142', '#0f766e'],
          ['High-alert medications', '18', '#dc2626'],
          ['Controlled (Sch X)', '6', '#d97706'],
          ['Unmapped to stock', '2', '#dc2626'],
        ].map(([k, v, c]) => (
          <div key={k} style={{ ...cardStyle, padding: '12px 16px' }}>
            <div style={{ fontSize: '11px', color: '#8a9096' }}>{k}</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: c, marginTop: '2px' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>ID</th>
              <th style={{ padding: '10px 14px' }}>Generic</th>
              <th style={{ padding: '10px 14px' }}>Brand</th>
              <th style={{ padding: '10px 14px' }}>Form · Strength</th>
              <th style={{ padding: '10px 14px' }}>Schedule</th>
              <th style={{ padding: '10px 14px' }}>Route</th>
              <th style={{ padding: '10px 14px' }}>Stock Item</th>
              <th style={{ padding: '10px 14px' }}>High Alert</th>
              <th style={{ padding: '10px 14px' }}>Interactions</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr
                key={d.id}
                onClick={() => handleRowClick(d)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{d.id}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>{d.generic}</td>
                <td style={{ padding: '10px 14px' }}>{d.brand}</td>
                <td style={{ padding: '10px 14px' }}>{d.form} · {d.strength}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#f1f5f9', '#475569')}>{d.schedule}</span></td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{d.route}</td>
                <td style={{ padding: '10px 14px', fontSize: '11.5px', color: '#0f766e' }}>{d.stockItem}</td>
                <td style={{ padding: '10px 14px' }}>{d.highAlert ? <span style={pillStyle('#fee2e2', '#b91c1c')}>High alert</span> : '—'}</td>
                <td style={{ padding: '10px 14px', color: '#52585e' }}>{d.interactions}</td>
                <td style={{ padding: '10px 14px' }}><span style={pillStyle('#dcfce7', '#15803d')}>Active</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const DUMMY_PHARMACY_TXNS = [
  { id: 'PH-91100', patient: 'Fathima Begum (O-207)', drug: 'Enoxaparin 40 mg', qty: 2, ward: 'Ortho Ward', time: '11:18', status: 'Stock-out' },
  { id: 'PH-91099', patient: 'Murugan Selvam (C-104)', drug: 'Aspirin 75 mg', qty: 30, ward: 'Cardiac Ward', time: '11:05', status: 'Dispensed' },
  { id: 'PH-91098', patient: 'Kavitha Raman (C-102)', drug: 'Atorvastatin 40 mg', qty: 15, ward: 'Cardiac Ward', time: '10:48', status: 'Dispensed' },
  { id: 'PH-91097', patient: 'Ganesan T (S-301)', drug: 'Tramadol 50 mg Inj', qty: 2, ward: 'Surgical ICU', time: '10:30', status: 'Pending' },
  { id: 'PH-91096', patient: 'Meenakshi Sundaram (O-205)', drug: 'Ondansetron 4 mg', qty: 6, ward: 'Oncology', time: '10:12', status: 'Dispensed' },
  { id: 'PH-91095', patient: 'Anitha Kumar (M-101)', drug: 'Paracetamol 650 mg', qty: 10, ward: 'Medical Ward', time: '09:50', status: 'Returned' },
];

export function PharmacyView({ onOpenDrawer, onOpenModal }) {
  const [filter, setFilter] = useState('All');
  const filtered = DUMMY_PHARMACY_TXNS.filter(t => filter === 'All' || t.status === filter);

  const handleRowClick = (p) => {
    if (!onOpenDrawer) return;
    onOpenDrawer({
      title: `${p.drug} · ${p.patient}`,
      sub: `${p.id} · ${p.ward} · Recorded ${p.time}`,
      badges: [{ t: p.status, bg: p.status === 'Dispensed' ? '#dcfce7' : p.status === 'Stock-out' ? '#fee2e2' : '#e0e7ff', fg: p.status === 'Dispensed' ? '#15803d' : p.status === 'Stock-out' ? '#b91c1c' : '#3730a3' }],
      facts: [
        { k: 'Quantity Requested', v: `${p.qty} units` },
        { k: 'Ward Location', v: p.ward },
        { k: 'Batch & Expiry', v: `B${p.id.slice(-4)} · 03/2027` },
        { k: 'Discharge Dependency', v: p.status === 'Stock-out' ? 'BLOCKING DISCHARGE · Transfer required' : 'Cleared' }
      ],
      actions: p.status === 'Stock-out' ? [
        { label: 'Transfer from Central Pharmacy', primary: true, on: () => alert(`Initiated rapid stock transfer for ${p.drug} to ${p.ward}`) }
      ] : [
        { label: 'Dispense & Deduct Stock', primary: true, on: () => alert(`Dispensed transaction ${p.id}`) }
      ]
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Central Pharmacy Operations"
        subtitle="Discharge medication clearance and stock-outs feed the discharge dependency graph directly"
        count={DUMMY_PHARMACY_TXNS.length}
        onNew={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'pharmacy', title: 'New Pharmacy Dispense Record' })}
        newLabel="+ Dispense Order"
        onExport={() => alert('Exported pharmacy transactions')}
      />

      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Txn ID</th>
              <th style={{ padding: '10px 14px' }}>Patient</th>
              <th style={{ padding: '10px 14px' }}>Drug</th>
              <th style={{ padding: '10px 14px' }}>Qty</th>
              <th style={{ padding: '10px 14px' }}>Ward</th>
              <th style={{ padding: '10px 14px' }}>Time</th>
              <th style={{ padding: '10px 14px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr
                key={p.id}
                onClick={() => handleRowClick(p)}
                style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{p.id}</td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>{p.patient}</td>
                <td style={{ padding: '10px 14px' }}>{p.drug}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p.qty}</td>
                <td style={{ padding: '10px 14px' }}>{p.ward}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{p.time}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={pillStyle(p.status === 'Dispensed' ? '#dcfce7' : p.status === 'Stock-out' ? '#fee2e2' : '#e0e7ff', p.status === 'Dispensed' ? '#15803d' : p.status === 'Stock-out' ? '#b91c1c' : '#3730a3')}>
                    {p.status}
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
        subtitle="Governed enterprise infrastructure · connected live to Lakehouse data foundation"
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
              ['Central Formulary & Pharmacy', 'REST API', 'Bidirectional', 'Live transaction', 'Paper MAR contingency', 'Healthy'],
              ['WhatsApp Patient Notification Gateway', 'Meta Cloud API', 'Outbound / Inbound', 'Instant', 'SMS fallback', 'Healthy'],
              ['Databricks Lakehouse Gold Views', 'Delta Lake / SQL', 'Lakehouse Ingestion', '5 min micro-batch', 'Read replica cache', 'Healthy'],
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

