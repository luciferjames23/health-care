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

function Header({ title, subtitle, count, onExport, exportLabel = 'Export CSV' }) {
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

export function AppointmentsView() {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Consultant Appointments & OPD Token Queue"
        subtitle="Live out-patient consultation appointments, automated queue management, and doctor check-in desk"
        count={filtered.length}
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
              <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
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

export function EmergencyView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Emergency & Trauma Resuscitation Board"
        subtitle="Live emergency department triage, trauma bay occupancy, and vital resuscitation alerts"
        count={EMERGENCY_CASES.length}
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
              <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
                <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0f766e' }}>{row.status}</td>
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

export function SchedulesView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Consultant Roster & On-Call Schedules"
        subtitle="Medical consultant clinic hours, emergency on-call rotas, and leave master"
        count={ROASTER.length}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
        {ROASTER.map(d => (
          <div key={d.doctor} style={cardStyle}>
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

export function NursingWorkspaceView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Inpatient Nursing Station & Shift Tasks"
        subtitle="Live ward nurse assignment, scheduled drug administration, and clinical care checklists"
        count={NURSING_TASKS.length}
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
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function MedicationAdminView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="eMAR · Electronic Medication Administration Record"
        subtitle="Barcode-verified drug administration rounds, nurse sign-offs, and scheduled dosages"
        count={EMAR_SCHEDULE.length}
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
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function SurgeryOTView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Operating Theatres & Surgical Suite"
        subtitle="Live OT suite tracking, intra-operative milestones, anesthesia records, and PACU recovery"
        count={SURGERY_CASES.length}
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
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function BloodBankView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Blood Bank Component Inventory & Cross-Match"
        subtitle="Licensed blood bank storage, component separation units, cross-match reservations and voluntary donor registry"
        count={BLOOD_INVENTORY.length}
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
              <tr key={row.group} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function LabDashboardView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Laboratory Information System (LIS) Dashboard"
        subtitle="Automated analyzer interfaces, critical value verification, turnaround times, and specimen tracking"
        count={LAB_ORDERS.length}
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
              <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function BillingView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Patient Billing, Invoicing & Clearance Desk"
        subtitle="Inpatient bed charges, pharmacy reconciliations, TPA co-pay settlement, and discharge financial gate passes"
        count={BILLING_RECORDS.length}
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
              <tr key={row.inv} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function InsuranceView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Insurance & TPA Cashless Claims Desk"
        subtitle="Pre-authorization processing, final cashless enhancements, query resolutions, and settlement remittances"
        count={CLAIMS_DATA.length}
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
              <tr key={row.claim} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function SbarView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Ward Clinical Handover · SBAR Protocol"
        subtitle="Situation, Background, Assessment, Recommendation shift-to-shift nurse and doctor handover cards"
        count={SBAR_DATA.length}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {SBAR_DATA.map((item, idx) => (
          <div key={idx} style={cardStyle}>
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

export function DeathMlcView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Medico-Legal Case (MLC) & Statutory Register"
        subtitle="Police intimations, accident wound certificates, post-mortem tracking, and statutory medico-legal compliance"
        count={MLC_RECORDS.length}
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
              <tr key={row.mlcNo} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function AuditTrailView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="HIPAA & Digital Health Audit Trail"
        subtitle="Immutable electronic health record access logs, role-based authorization events, and modification entries"
        count={AUDIT_LOGS.length}
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
              <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function ClaimsView() {
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All'
    ? CLAIMS_RECORDS
    : CLAIMS_RECORDS.filter(r => r.status === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Insurance Claims Tracking & Settlement Desk"
        subtitle="End-to-end cashless preauthorisation claims, TPA adjudication, query handling, and remittances"
        count={filtered.length}
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
              <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function FinanceDashboardView() {
  const [modeFilter, setModeFilter] = useState('All');

  const filtered = modeFilter === 'All'
    ? REVENUE_TXNS
    : REVENUE_TXNS.filter(t => t.mode.toLowerCase().includes(modeFilter.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Hospital Finance Dashboard & Collections Journal"
        subtitle="Direct cash collection, TPA electronic remittances, patient receivables, and daily daybook ledger"
        count={filtered.length}
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
              <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function TaxConfigView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Central GST & Statutory Tax Configuration"
        subtitle="Centralised taxation engine configured for healthcare clinical exemptions (SAC 9993), pharmacy, and implants"
        count={TAX_RULES.length}
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
              <tr key={row.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
export function DataDomainView({ domain = 'Patient' }) {
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
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

export function ExceptionsView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Header
        title="Clinical & Administrative Exception Register"
        subtitle="Monitored clinical overrides, drug formulary substitutions, and financial discount approvals"
        count={EXCEPTIONS.length}
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
              <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
