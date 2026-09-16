import React, { useState, useMemo } from 'react';

export default function Patient360View({
  patient,
  onOpenDischarge,
  onOpenSoap,
  onBack,
  onNavigate,
  onOpenDrawer,
  onOpenModal,
}) {
  const [activeTab, setActiveTab] = useState('Overview');

  // Normalize patient fields with rich fallbacks matching prototype and user screenshot
  const p = useMemo(() => {
    const d = patient || {};
    const name = d.name || d.patient || d.patient_name || 'Kavitha Raman';
    const isKavitha = name.toLowerCase().includes('kavitha') || String(d.patient_id || d.id || '').includes('8421');

    const uhid = d.mrn || d.uhid || (isKavitha ? 'MER-2026-008421' : (d.patient_id ? `MER-2026-${String(d.patient_id).padStart(6, '0')}` : 'MER-2026-008421'));
    const age = d.age || (isKavitha ? 48 : 48);
    const sex = d.sex ? (d.sex === 'F' || d.sex === 'Female' ? 'Female' : 'Male') : (isKavitha ? 'Female' : 'Female');
    const lang = d.language || d.lang || 'Tamil';
    const blood = d.bloodGroup || d.blood || 'B+';
    const phone = d.phone || '+91 98•••• 4410';

    const encounter = d.encounter || (isKavitha ? 'ENC-20481' : (d.admission_number ? `ENC-${d.admission_number}` : 'ENC-20481'));
    const bed = d.bed || (d.bed_number ? `${d.bed_number} · ${d.ward || 'Cardiac Ward'}` : (isKavitha ? 'C-412 · Cardiac Ward' : 'C-412 · Cardiac Ward'));
    const doctor = d.doctor || d.primary_consultant || 'Dr. Arjun Menon';
    const dept = d.department || d.dept || 'Cardiology';
    const insurer = d.insurer || d.insurance || (isKavitha ? 'Star Health · Query Raised' : 'Star Health · Query Raised');
    const risk = d.risk || 'None';
    const attendant = d.attendant || (isKavitha ? 'Raman S (husband) · Tamil' : 'Family Member · Tamil');

    const status = d.status || d._status || (isKavitha ? 'Blocked · insurance' : 'Blocked · insurance');
    const procedure = d.procedure || (isKavitha ? 'PTCA with single drug-eluting stent' : 'Clinical Inpatient Protocol');
    const admitted = d.admitted || (isKavitha ? `09 Sep 2026 · ${bed}` : `09 Sep 2026 · ${bed}`);
    const condition = d.condition || `Clinically stable (${doctor})`;
    const dischargeInfo = d.dischargeInfo || (isKavitha ? 'Blocked · insurance · ETA 4:20 PM' : 'Blocked · insurance · ETA 4:20 PM');

    return {
      uhid,
      name,
      age,
      sex,
      lang,
      blood,
      phone,
      encounter,
      bed,
      doctor,
      dept,
      insurer,
      risk,
      attendant,
      status,
      procedure,
      admitted,
      condition,
      dischargeInfo,
    };
  }, [patient]);

  const TABS = [
    'Overview',
    'Appointments',
    'Encounters',
    'Clinical',
    'Diagnostics',
    'Medications',
    'Admissions',
    'Insurance',
    'Billing',
    'Discharge',
    'Communications',
    'Feedback',
    'Documents',
    'Consent',
    'AI Activity',
    'Audit',
  ];

  // Overview Journey Timeline items
  const timeline = [
    { t: '18:02', c: '#64748b', e: 'Laboratory order · Electrolytes · In progress' },
    { t: '16:53', c: '#64748b', e: 'Laboratory order · HbA1c · In progress' },
    { t: '12:47', c: '#64748b', e: 'Email · Report ready (TA)' },
    { t: '11:10', c: '#64748b', e: 'WhatsApp · Discharge status · expected ~4:20 PM (TA)' },
    { t: '09:12', c: '#64748b', e: 'Mobile push · Discharge planning has started (TA)' },
    { t: '09:03', c: 'oklch(0.5 0.1 300)', e: 'Discharge Orchestration Agent · Waiting' },
    { t: '11 Sep 14:10', c: 'oklch(0.5 0.1 300)', e: 'Radiology Screening Agent · Completed' },
    { t: '11 Sep 09:04', c: '#64748b', e: 'Email · Report ready (TA)' },
    { t: '10 Sep 16:30', c: 'oklch(0.5 0.1 200)', e: `Inpatient encounter · ${p.doctor}` },
    { t: '09 Sep 10:15', c: 'oklch(0.5 0.13 70)', e: `Admission · ${p.bed}` },
  ];

  // AI Activity on this patient
  const aiAgents = [
    {
      id: 'EXE-2026-118204',
      agent: 'Discharge Orchestration Agent',
      version: '3.0.2',
      status: 'Waiting',
      steps: 12,
      bg: '#fef3c7',
      fg: '#92400e',
    },
    {
      id: 'EXE-2026-117656',
      agent: 'Diagnostic Coordination Agent',
      version: '1.5.1',
      status: 'Completed',
      steps: 5,
      bg: '#dcfce7',
      fg: '#15803d',
    },
    {
      id: 'EXE-2026-117666',
      agent: 'Queue / Flow Agent',
      version: '2.0.4',
      status: 'Completed',
      steps: 6,
      bg: '#dcfce7',
      fg: '#15803d',
    },
    {
      id: 'EXE-2026-117718',
      agent: 'Feedback Agent',
      version: '1.2.0',
      status: 'Completed',
      steps: 4,
      bg: '#dcfce7',
      fg: '#15803d',
    },
  ];

  const pendingApprovals = [
    { type: 'Billing release', owner: 'Billing', age: '2 d 19 h' },
    { type: 'Discharge summary', owner: 'Doctor', age: '2 d 19 h' },
  ];

  // Handler to open bill detail drawer
  const handleOpenBillDrawer = () => {
    if (onOpenDrawer) {
      onOpenDrawer({
        title: `INV-2026-902 · ${p.name}`,
        sub: `Admission: ${p.encounter} · Bed: ${p.bed}`,
        badges: [{ t: 'Pending Settlement', bg: '#fef3c7', fg: '#92400e' }],
        facts: [
          { k: 'Estimated Cost', v: '₹2,45,000' },
          { k: 'Actual Gross Bill', v: '₹3,22,450', b: true },
          { k: 'Insurance Covered', v: '₹1,95,000' },
          { k: 'Patient Share', v: '₹1,27,450', b: true },
          { k: 'TPA / Insurer', v: p.insurer },
          { k: 'Status', v: 'Query Raised: Angioplasty procedure report' }
        ],
        actions: [
          { label: 'Settle Cashless Co-Pay', primary: true, on: () => alert(`Payment processed for ${p.name}`) },
          { label: 'Print Itemized Bill' }
        ]
      });
    }
  };

  // Handler for messaging patient
  const handleMessagePatient = () => {
    if (onOpenModal) {
      onOpenModal({
        kind: 'reason',
        title: `Message Patient · ${p.name}`,
        text: `Compose SMS / WhatsApp status update message for ${p.name} (${p.phone}):`
      });
    } else {
      alert(`Sent status update message to ${p.name}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Breadcrumb */}
      <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
        <span
          onClick={onBack}
          style={{ cursor: 'pointer', color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}
        >
          ← Back
        </span>
        {' · '}
        <span>AI Command Centre</span> › <span>Patient 360</span> ›{' '}
        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>{p.uhid}</span>
      </div>

      {/* Patient Dossier Header Card */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'repeating-linear-gradient(45deg, #e3e6e8 0 4px, #eef0f1 4px 8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: '500 9px ui-monospace, Menlo, monospace',
              color: '#52585e',
              flex: 'none',
            }}
          >
            avatar
          </div>

          {/* Patient Details */}
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '22px', fontWeight: 600, color: '#15181b' }}>{p.name}</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: '#fee2e2',
                  color: '#991b1b',
                }}
              >
                {p.status}
              </span>
            </div>

            <div style={{ color: '#52585e', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', marginTop: '2px' }}>
              {p.uhid} · {p.age} · {p.sex} · {p.lang} · {p.blood} · {p.phone}
            </div>

            {/* Facts Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', marginTop: '10px' }}>
              {[
                ['ENCOUNTER', p.encounter],
                ['BED', p.bed],
                ['DOCTOR', p.doctor],
                ['DEPARTMENT', p.dept],
                ['INSURANCE', p.insurer],
                ['RISK', p.risk],
                ['ATTENDANT', p.attendant],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096' }}>
                    {k}
                  </div>
                  <div style={{ fontSize: '12px', color: '#15181b', fontWeight: 500, marginTop: '1px' }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons Top Right */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleMessagePatient}
              style={{
                height: '30px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #e3e6e8',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                color: '#15181b',
              }}
            >
              Message patient
            </button>
            <button
              type="button"
              onClick={() => onOpenDischarge && onOpenDischarge(patient)}
              style={{
                height: '30px',
                padding: '0 12px',
                borderRadius: '6px',
                border: 0,
                background: 'oklch(0.5 0.1 200)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Open discharge case
            </button>
          </div>
        </div>

        {/* 16 Tabs Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginTop: '14px', fontWeight: 500, fontSize: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '4px' }}>
          {TABS.map((t) => (
            <span
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderBottom: activeTab === t ? '2px solid oklch(0.5 0.1 200)' : '2px solid transparent',
                color: activeTab === t ? 'oklch(0.4 0.1 200)' : '#52585e',
                fontWeight: activeTab === t ? 600 : 500,
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'Overview' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr)',
            gap: '14px',
            alignItems: 'start',
          }}
        >
          {/* Column 1: Journey Timeline */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>Journey timeline</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {timeline.map((ev, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '92px 12px minmax(0, 1fr)',
                    gap: '8px',
                    alignItems: 'start',
                    padding: '5px 0',
                  }}
                >
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#52585e' }}>
                    {ev.t}
                  </span>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ev.c, marginTop: '4px' }} />
                  <span style={{ lineHeight: 1.45, fontSize: '12px', color: '#15181b' }}>{ev.e}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Current Encounter + Insurance and Billing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Current encounter</div>
              {[
                ['Procedure', p.procedure],
                ['Admitted', p.admitted],
                ['Condition', p.condition],
                ['Discharge', p.dischargeInfo],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr)', gap: '4px 12px', padding: '3px 0', fontSize: '12px' }}>
                  <span style={{ color: '#8a9096' }}>{k}</span>
                  <span style={{ color: '#15181b', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <div
              onClick={handleOpenBillDrawer}
              style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'oklch(0.5 0.1 200)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e3e6e8')}
            >
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Insurance and billing</div>
              {[
                ['Estimate', '₹2,45,000'],
                ['Running bill', '₹3,22,450'],
                ['Insurance', '₹1,95,000 · Query Raised'],
                ['Patient share', '₹1,27,450'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr)', gap: '4px 12px', padding: '3px 0', fontSize: '12px' }}>
                  <span style={{ color: '#8a9096' }}>{k}</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#15181b', fontWeight: 600 }}>
                    {v}
                  </span>
                </div>
              ))}
              <div style={{ color: 'oklch(0.45 0.1 200)', marginTop: '6px', fontSize: '12px', fontWeight: 500 }}>
                Open bill →
              </div>
            </div>
          </div>

          {/* Column 3: AI Activity on this patient */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#fff', border: '1px solid oklch(0.85 0.05 300)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)' }} />
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#15181b' }}>AI activity on this patient</span>
              </div>

              {aiAgents.map((e) => (
                <div
                  key={e.id}
                  onClick={() => onNavigate && onNavigate('runs')}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: '2px 8px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#f6f7f8',
                    marginBottom: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(evt) => (evt.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={(evt) => (evt.currentTarget.style.background = '#f6f7f8')}
                >
                  <span style={{ fontWeight: 600, fontSize: '12px', color: '#15181b' }}>
                    {e.agent} v{e.version}
                  </span>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: e.bg,
                      color: e.fg,
                    }}
                  >
                    {e.status}
                  </span>
                  <span style={{ gridColumn: '1 / -1', color: '#52585e', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px' }}>
                    {e.id} · {e.steps} steps
                  </span>
                </div>
              ))}

              <div style={{ fontWeight: 600, margin: '10px 0 6px', fontSize: '12px', color: '#15181b' }}>Pending approvals</div>
              {pendingApprovals.map((a, i) => (
                <div
                  key={i}
                  onClick={() => onNavigate && onNavigate('approvals')}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '4px 0', cursor: 'pointer', color: '#52585e', fontSize: '12px' }}
                >
                  <span>
                    {a.type} → <span style={{ color: '#15181b', fontWeight: 500 }}>{a.owner}</span>
                  </span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096' }}>{a.age}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Appointments */}
      {activeTab === 'Appointments' && (
        <TableContainer
          cols={['ID', 'Doctor', 'Time', 'Type', 'Channel', 'Status']}
          grid="100px minmax(180px, 1fr) 130px 140px 120px 100px"
          rows={[
            ['APT-24110', p.doctor, '09 Sep 09:30', 'OPD Consultation', 'Mobile app', 'Completed'],
            ['APT-24115', p.doctor, '19 Sep 10:30', 'Follow-up Cardiology', 'WhatsApp Bot', 'Confirmed'],
          ]}
          onRowClick={(row) => {
            if (onOpenDrawer) {
              onOpenDrawer({
                title: `${row[0]} · ${p.name}`,
                sub: `Doctor: ${row[1]} · Timing: ${row[2]}`,
                badges: [{ t: row[5], bg: row[5] === 'Completed' ? '#dcfce7' : '#e0f2fe', fg: row[5] === 'Completed' ? '#15803d' : '#0369a1' }],
                facts: [
                  { k: 'Appointment ID', v: row[0], b: true },
                  { k: 'Consultant', v: row[1] },
                  { k: 'Appointment Slot', v: row[2] },
                  { k: 'Visit Classification', v: row[3] },
                  { k: 'Booking Channel', v: row[4] },
                  { k: 'Status', v: row[5] }
                ]
              });
            }
          }}
        />
      )}

      {/* Tab 3: Encounters */}
      {activeTab === 'Encounters' && (
        <TableContainer
          cols={['ID', 'Type', 'Doctor', 'Time', 'Status']}
          grid="110px 160px minmax(180px, 1fr) 140px 100px"
          rows={[
            ['ENC-20481', 'Inpatient Admission', p.doctor, '09 Sep 10:15', 'Active'],
            ['ENC-19802', 'Cardiology Outpatient', p.doctor, '02 Aug 11:20', 'Completed'],
            ['ENC-18450', 'Emergency Resuscitation', 'Dr. Priya Narayanan', '14 Jun 18:40', 'Completed'],
          ]}
        />
      )}

      {/* Tab 4: Clinical */}
      {activeTab === 'Clinical' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: '12px', fontSize: '12px' }}>
            <span style={{ fontWeight: 600, color: '#dc2626' }}>Known Allergies</span>
            <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠ Iodinated contrast (mild rash, 2019)</span>

            <span style={{ fontWeight: 600, color: '#15181b' }}>Primary Diagnosis</span>
            <span>I21.0 · ST elevation myocardial infarction (STEMI) anterior wall · {p.doctor}</span>

            <span style={{ fontWeight: 600, color: '#15181b' }}>Secondary Diagnosis</span>
            <span>E11.9 · Type 2 diabetes mellitus without complications</span>

            <span style={{ fontWeight: 600, color: '#15181b' }}>Treating Doctor</span>
            <span>{p.doctor} ({p.dept})</span>

            <span style={{ fontWeight: 600, color: '#15181b' }}>Blood Group</span>
            <span>{p.blood}</span>

            <span style={{ fontWeight: 600, color: '#15181b' }}>Risk Indicators</span>
            <span>{p.risk}</span>

            <span style={{ fontWeight: 600, color: '#15181b' }}>Clinical Progress Note</span>
            <span style={{ lineHeight: 1.5, background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
              Post-PTCA Day 3. Patient ambulating comfortably without angina. Vitals stable. Puncture site clean and dry. Awaiting insurance query clearance for discharge sign-off.
            </span>
          </div>
          <div style={{ marginTop: '14px' }}>
            <button
              type="button"
              onClick={() => onOpenSoap && onOpenSoap(patient)}
              style={{
                height: '30px', padding: '0 12px', borderRadius: '6px',
                border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                color: 'oklch(0.4 0.1 200)', fontWeight: 600, cursor: 'pointer', fontSize: '12px'
              }}
            >
              Open Doctor SOAP Note →
            </button>
          </div>
        </div>
      )}

      {/* Tab 5: Diagnostics */}
      {activeTab === 'Diagnostics' && (
        <TableContainer
          cols={['Order', 'Test', 'Kind', 'Ordered', 'Result', 'Status']}
          grid="100px minmax(180px, 1fr) 90px 120px 180px 100px"
          rows={[
            ['ORD-8812', 'Electrolytes Panel', 'LIS', '12 Sep 18:02', 'K: 4.1, Na: 138 mEq/L', 'Verified'],
            ['ORD-8809', 'HbA1c Glycated Hemoglobin', 'LIS', '12 Sep 16:53', '6.8% · Good control', 'Verified'],
            ['ORD-8790', '2D Echocardiography', 'PACS', '10 Sep 14:10', 'LVEF 52%, Normal LV', 'Final'],
            ['ORD-8742', 'Coronary Angiography', 'Cath-Lab', '09 Sep 11:30', '90% LAD stenosis, DES deployed', 'Final'],
          ]}
        />
      )}

      {/* Tab 6: Medications */}
      {activeTab === 'Medications' && (
        <TableContainer
          cols={['Rx', 'Drug', 'Dose · Route · Freq', 'Days · Qty', 'Safety', 'Status']}
          grid="90px minmax(180px, 1fr) 140px 100px 100px 90px"
          rows={[
            ['RX-9011', 'Tab. Aspirin 75mg', '75mg Oral OD', '30 d · 30 tabs', 'Clear', 'Active'],
            ['RX-9012', 'Tab. Ticagrelor 90mg', '90mg Oral BD', '30 d · 60 tabs', 'Clear', 'Active'],
            ['RX-9013', 'Tab. Atorvastatin 40mg', '40mg Oral HS', '30 d · 30 tabs', 'Clear', 'Active'],
            ['RX-9014', 'Tab. Metoprolol 25mg', '25mg Oral OD', '15 d · 15 tabs', 'Clear', 'Active'],
            ['RX-9015', 'Tab. Metformin 500mg', '500mg Oral BD', '30 d · 60 tabs', 'Clear', 'Active'],
          ]}
        />
      )}

      {/* Tab 7: Admissions */}
      {activeTab === 'Admissions' && (
        <TableContainer
          cols={['Admission', 'Bed', 'Admitted', 'Estimate', 'Status']}
          grid="120px minmax(180px, 1fr) 140px 120px 110px"
          rows={[
            ['IP-2026-3187', p.bed, '09 Sep 2026 10:15', '₹2,45,000', 'Active Inpatient'],
          ]}
        />
      )}

      {/* Tab 8: Insurance */}
      {activeTab === 'Insurance' && (
        <TableContainer
          cols={['Case', 'Insurer', 'Requested', 'Approved', 'Missing', 'Risk', 'Status']}
          grid="110px 160px 110px 110px minmax(180px, 1fr) 70px 140px"
          rows={[
            ['PA-2026-1142', 'Star Health Insurance', '₹2,68,450', '₹1,95,000', 'Angioplasty procedure report', '9%', 'Query Raised'],
          ]}
        />
      )}

      {/* Tab 9: Billing */}
      {activeTab === 'Billing' && (
        <TableContainer
          cols={['Bill', 'Estimate', 'Actual', 'Insurance', 'Patient', 'Status']}
          grid="120px 110px 110px 110px 110px 130px"
          rows={[
            ['INV-2026-902', '₹2,45,000', '₹3,22,450', '₹1,95,000', '₹1,27,450', 'Pending Clearance'],
          ]}
          onRowClick={handleOpenBillDrawer}
        />
      )}

      {/* Tab 10: Discharge */}
      {activeTab === 'Discharge' && (
        <TableContainer
          cols={['Case', 'Intent', 'Predicted', 'Owner', 'Status']}
          grid="120px 120px 120px minmax(180px, 1fr) 160px"
          rows={[
            ['DC-2026-0842', '12 Sep 09:02', '4:20 PM', 'Insurance desk · R. Sundar', 'Insurance Blocked'],
          ]}
          onRowClick={() => onOpenDischarge && onOpenDischarge(patient)}
        />
      )}

      {/* Tab 11: Communications */}
      {activeTab === 'Communications' && (
        <TableContainer
          cols={['Time', 'Channel', 'Message', 'Lang', 'Status']}
          grid="110px 110px minmax(240px, 1fr) 60px 100px"
          rows={[
            ['12 Sep 11:10', 'WhatsApp', 'Discharge status update · expected ~4:20 PM', 'TA', 'Delivered'],
            ['12 Sep 09:12', 'Mobile push', 'Discharge planning has started', 'TA', 'Delivered'],
            ['11 Sep 09:04', 'Email', 'Laboratory & ECHO reports ready for review', 'TA', 'Delivered'],
            ['09 Sep 10:20', 'SMS', 'Inpatient admission confirmed at Cardiac Ward', 'EN', 'Delivered'],
          ]}
        />
      )}

      {/* Tab 12: Feedback */}
      {activeTab === 'Feedback' && (
        <TableContainer
          cols={['Case', 'Feedback', 'Priority', 'Owner', 'Status']}
          grid="110px minmax(240px, 1fr) 90px 140px 100px"
          rows={[
            ['FDB-1042', 'Patient requested update regarding Star Health cashless query status', 'Medium', 'R. Sundar', 'In Progress'],
          ]}
        />
      )}

      {/* Tab 13: Documents */}
      {activeTab === 'Documents' && (
        <TableContainer
          cols={['Document', 'Version', 'Author', 'Status']}
          grid="minmax(220px, 1fr) 90px 180px 160px"
          rows={[
            ['Discharge Summary', 'v2 draft', `AI draft · ${p.doctor}`, 'DRAFT — HUMAN REVIEW'],
            ['Medication Instructions (TA/EN)', 'v1', 'AI draft · Nurse verifies', 'Pending verification'],
            ['Pre-Auth Enhancement Packet', 'v3', 'Insurance Preauth Agent', 'Submitted'],
            ['Patient Consent Form', 'v1', 'Front Office Lead', 'Signed'],
            ['ECHO Clinical Study Report', 'Final', 'Radiology PACS', 'Final Signed'],
          ]}
        />
      )}

      {/* Tab 14: Consent */}
      {activeTab === 'Consent' && (
        <TableContainer
          cols={['Purpose', 'State', 'Verified']}
          grid="minmax(220px, 1fr) 100px 180px"
          rows={[
            ['WhatsApp Messaging', 'Active On', '12 Sep 08:42 · Mobile OTP'],
            ['Appointment Reminders', 'Active On', '12 Sep 08:42 · Mobile OTP'],
            ['Diagnostic & Lab Notifications', 'Active On', '12 Sep 08:42 · Mobile OTP'],
            ['Billing & Payment Notifications', 'Active On', '12 Sep 08:42 · Mobile OTP'],
            ['Discharge Status Notifications', 'Active On', '12 Sep 08:42 · Mobile OTP'],
            ['AI Clinical Interpretation', 'Disabled Off', 'Patient preference'],
            ['Third-party Data Sharing', 'Disabled Off', 'Statutory default'],
          ]}
        />
      )}

      {/* Tab 15: AI Activity */}
      {activeTab === 'AI Activity' && (
        <TableContainer
          cols={['Execution', 'Agent', 'Started', 'Steps', 'Status']}
          grid="140px minmax(200px, 1fr) 110px 70px 110px"
          rows={[
            ['EXE-2026-118204', 'Discharge Orchestration Agent', '12 Sep 09:03', '12', 'Waiting'],
            ['EXE-2026-117656', 'Diagnostic Coordination Agent', '11 Sep 14:10', '5', 'Completed'],
            ['EXE-2026-117666', 'Queue / Flow Agent', '10 Sep 11:00', '6', 'Completed'],
            ['EXE-2026-117718', 'Feedback Agent', '09 Sep 16:30', '4', 'Completed'],
          ]}
          onRowClick={() => onNavigate && onNavigate('runs')}
        />
      )}

      {/* Tab 16: Audit */}
      {activeTab === 'Audit' && (
        <TableContainer
          cols={['Time', 'Actor', 'Action', 'After', 'Correlation']}
          grid="100px 160px minmax(240px, 1fr) 120px 140px"
          rows={[
            ['11:19:41', 'system', 'ETA recomputed', 'OK', 'AUD-2026-091241'],
            ['11:18:07', 'anitha.kumar', 'Patient accessed (Nurse Workspace)', 'Granted', 'AUD-2026-091240'],
            ['11:12:48', 'dr.arjun.menon', 'Dictation transcribed · 38s · Tamil/English', 'Pending sign', 'AUD-2026-091236'],
            ['11:10:05', 'patient', 'AI response generated (WhatsApp) · discharge status', 'Read-only', 'AUD-2026-091235'],
            ['11:02:44', 'patient', 'Consent changed · Billing notifications ON', 'OK', 'AUD-2026-091232'],
          ]}
        />
      )}
    </div>
  );
}

// Reusable table container matching prototype styling
function TableContainer({ cols, grid, rows, onRowClick }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: grid,
          gap: '8px',
          padding: '8px 14px',
          color: '#8a9096',
          fontSize: '10.5px',
          textTransform: 'uppercase',
          letterSpacing: '.04em',
          borderBottom: '1px solid #eef0f1',
          minWidth: '600px',
        }}
      >
        {cols.map((col) => (
          <span key={col}>{col}</span>
        ))}
      </div>
      {rows.map((row, idx) => (
        <div
          key={idx}
          onClick={() => onRowClick && onRowClick(row)}
          style={{
            display: 'grid',
            gridTemplateColumns: grid,
            gap: '8px',
            padding: '8px 14px',
            borderBottom: idx === rows.length - 1 ? 'none' : '1px solid #f2f3f4',
            alignItems: 'center',
            fontSize: '12px',
            minWidth: '600px',
            cursor: onRowClick ? 'pointer' : 'default',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => {
            if (onRowClick) e.currentTarget.style.background = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            if (onRowClick) e.currentTarget.style.background = 'transparent';
          }}
        >
          {row.map((cell, cIdx) => (
            <span
              key={cIdx}
              style={{
                fontFamily: cIdx === 0 || cell.includes('₹') || cell.includes('Sep') || cell.includes(':') ? 'ui-monospace, Menlo, monospace' : 'inherit',
                fontWeight: cIdx === 0 || cIdx === 1 ? 600 : 400,
                color: cell.includes('Blocked') || cell.includes('⚠') ? '#dc2626' : cell.includes('Completed') || cell.includes('Verified') || cell.includes('Final') ? '#15803d' : '#15181b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
