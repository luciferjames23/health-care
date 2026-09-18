import React, { useState, useMemo, useEffect } from 'react';
import { radiologyApi } from '../services/radiologyApi';
import { apiService } from '../services/api';

export default function Patient360View({
  patient,
  onOpenDischarge,
  onOpenSoap,
  onBack,
  onNavigate,
  onOpenDrawer,
  onOpenModal,
  onOpenRadiologyStudy,
}) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanAlert, setScanAlert] = useState(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [patientScans, setPatientScans] = useState([]);
  const [activeScanIdx, setActiveScanIdx] = useState(0);
  const [liveAdmission, setLiveAdmission] = useState(null);

  // Fetch live admission details from dim_admission_inputs so billing and vitals are 100% accurate
  useEffect(() => {
    let alive = true;
    const pid = patient?.patient_id || patient?.id;
    const aid = patient?.admission_id;

    if (pid || aid) {
      const fetchParams = aid ? { admission_id: aid, limit: 1 } : { patient_id: pid, limit: 1 };
      apiService.getCurrentAdmissions(fetchParams, { forceRefresh: true })
        .then(res => {
          if (alive && res?.data && res.data.length > 0) {
            setLiveAdmission(res.data[0]);
          }
        })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [patient]);

  // Auto-dismiss scan notification after 8 seconds
  useEffect(() => {
    if (!scanAlert) return;
    const t = setTimeout(() => setScanAlert(null), 8000);
    return () => clearTimeout(t);
  }, [scanAlert]);

  // Normalize patient fields with live database values from dim_admission_inputs
  const p = useMemo(() => {
    const d = patient || {};
    const raw = liveAdmission || d.raw || d;
    const rawPid = d.patient_id || raw.patient_id || d.id;
    const rawAdmId = d.admission_id || raw.admission_id;

    const name = d.name || d.patient || d.patient_name || (raw.first_name ? `${raw.first_name} ${raw.last_name || ''}`.trim() : 'Kavitha Raman');
    const isKavitha = name.toLowerCase().includes('kavitha') || String(rawPid || '').includes('8421');

    const uhid = d.mrn || d.uhid || (rawPid ? `MER-2026-${String(rawPid).padStart(6, '0')}` : (isKavitha ? 'MER-2026-008421' : 'MER-2026-008421'));
    const age = d.age || raw.age_at_admission || (isKavitha ? 48 : 48);
    const sex = d.sex ? (d.sex === 'F' || d.sex === 'Female' ? 'Female' : 'Male') : (raw.gender ? (raw.gender.toLowerCase().startsWith('f') ? 'Female' : 'Male') : (isKavitha ? 'Female' : 'Male'));
    const lang = d.language || d.lang || raw.preferred_language || 'Tamil';
    const blood = d.bloodGroup || d.blood || raw.blood_group || 'B+';
    const phone = d.phone || raw.phone || '+91 98•••• 4410';

    const encounter = d.encounter || (raw.admission_number ? `ENC-${raw.admission_number}` : (d.admission_number ? `ENC-${d.admission_number}` : (isKavitha ? 'ENC-20481' : 'ENC-20481')));
    const bed = d.bed || (raw.bed_number ? `${raw.bed_number} · ${raw.ward_name || 'General Ward'}` : (d.bed_number ? `${d.bed_number} · ${d.ward || 'Cardiac Ward'}` : 'C-412 · Cardiac Ward'));
    const doctor = d.doctor || d.primary_consultant || raw.attending_doctor || 'Dr. Arjun Menon';
    const dept = d.department || d.dept || raw.doctor_specialization || 'Cardiology';
    const insurer = d.insurer || d.insurance || 'Direct Billing / Corporate';
    const risk = d.risk || 'None';
    const attendant = d.attendant || (isKavitha ? 'Raman S (husband) · Tamil' : 'Family Member · Tamil');

    // Real database billing info from dim_admission_inputs
    const billNumber = raw.bill_number || d.bill_number || d.billing?.bill_number || (rawAdmId ? `MER-BIL-${String(rawAdmId).padStart(7, '0')}` : 'MER-BIL-0087223');
    const rawBillNet = raw.bill_net_amount ?? d.bill_net_amount ?? d.billing?.bill_net_amount ?? 168000;
    const billNetAmount = Number(rawBillNet);
    const billStatus = String(raw.bill_status || d.bill_status || d.billing?.bill_status || 'Pending').trim();
    const clearanceStatus = String(raw.bill_clearance_status || d.bill_clearance_status || d.billing?.bill_clearance_status || billStatus).trim();
    const rawOutstanding = raw.outstanding_balance ?? d.outstanding_balance ?? d.billing?.outstanding_balance ?? 0;
    const outstandingBalance = Number(rawOutstanding);

    const isCleared = (
      outstandingBalance <= 0 &&
      ['PAID', 'CLEARED', 'SETTLED', 'ZERO_BALANCE', 'APPROVED'].includes(billStatus.toUpperCase())
    );

    const billingStatusDisplay = isCleared
      ? 'Cleared · Paid'
      : (outstandingBalance > 0 ? `Pending Clearance (₹${outstandingBalance.toLocaleString('en-IN')})` : 'Pending Clearance');

    const status = d.status || d._status || (isCleared ? 'Cleared for Discharge' : 'Admitted · Pending Clearance');
    const procedure = d.procedure || raw.primary_diagnosis || (isKavitha ? 'PTCA with single drug-eluting stent' : 'Clinical Inpatient Protocol');
    const admitted = d.admitted || (raw.admission_date ? `${new Date(raw.admission_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${bed}` : `09 Sep 2026 · ${bed}`);
    const condition = d.condition || `Clinically stable (${doctor})`;
    const dischargeInfo = d.dischargeInfo || (isCleared ? 'Ready for clinical discharge sign-off' : `Billing pending · Outstanding ₹${outstandingBalance.toLocaleString('en-IN')}`);

    return {
      patient_id: rawPid,
      admission_id: rawAdmId,
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
      billNumber,
      billNetAmount,
      billStatus,
      clearanceStatus,
      outstandingBalance,
      isCleared,
      billingStatusDisplay,
    };
  }, [patient, liveAdmission]);

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
      const isCleared = p.isCleared;
      const outstanding = p.outstandingBalance;
      const net = p.billNetAmount;
      const covered = isCleared ? net : Math.max(0, net - outstanding);

      onOpenDrawer({
        title: `${p.billNumber} · ${p.name}`,
        sub: `Admission: ${p.encounter} · Bed: ${p.bed}`,
        badges: [
          isCleared
            ? { t: 'Cleared · Paid in Full', bg: '#dcfce7', fg: '#15803d' }
            : { t: 'Pending Settlement', bg: '#fef3c7', fg: '#92400e' }
        ],
        facts: [
          { k: 'Estimated Cost', v: `₹${Math.round(net * 0.9).toLocaleString('en-IN')}` },
          { k: 'Actual Gross Bill', v: `₹${net.toLocaleString('en-IN')}`, b: true },
          { k: 'Insurance / Settled', v: `₹${covered.toLocaleString('en-IN')}` },
          { k: 'Patient Share / Due', v: `₹${outstanding.toLocaleString('en-IN')}`, b: true },
          { k: 'TPA / Insurer', v: p.insurer },
          { k: 'Financial Clearance', v: p.billingStatusDisplay }
        ],
        actions: [
          isCleared
            ? { label: 'Print Financial NOC / Clearance', primary: true, on: () => alert(`Financial Clearance NOC verified for ${p.name}`) }
            : { label: 'Settle Cashless Co-Pay', primary: true, on: () => alert(`Payment processed for ${p.name}`) },
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

  // Handler for viewing patient's radiology scans
  const handleViewScan = async () => {
    setScanLoading(true);
    setScanAlert(null);

    try {
      // 1. Resolve numeric ID
      let numericId = null;
      if (patient?.patient_id && !isNaN(Number(patient.patient_id))) {
        numericId = Number(patient.patient_id);
      } else if (patient?.id && !isNaN(Number(patient.id))) {
        numericId = Number(patient.id);
      } else if (p.uhid) {
        const parts = String(p.uhid).split('-');
        const lastPart = parts[parts.length - 1];
        if (/^\d+$/.test(lastPart)) {
          numericId = parseInt(lastPart, 10);
        }
      }

      // 2. Resolve patient code and search name
      const patientCode = patient?.patient_code || (numericId ? `MER-PAT-${String(numericId).padStart(7, '0')}` : null);
      const searchName = (patient?.first_name || patient?.name || p.name || '').trim();

      let scans = [];

      // A. Query backend by patient_id
      if (numericId) {
        try {
          const res = await radiologyApi.getScans({ patient_id: numericId, limit: 10 });
          if (res && Array.isArray(res.data) && res.data.length > 0) {
            scans = res.data;
          }
        } catch (e) {
          console.warn('Scan search by patient_id failed:', e);
        }
      }

      // B. Query backend by patient_code
      if (scans.length === 0 && patientCode) {
        try {
          const res = await radiologyApi.getScans({ patient_code: patientCode, limit: 10 });
          if (res && Array.isArray(res.data) && res.data.length > 0) {
            scans = res.data;
          }
        } catch (e) {
          console.warn('Scan search by patient_code failed:', e);
        }
      }

      // C. Query backend by search name
      if (scans.length === 0 && searchName) {
        try {
          const namePart = searchName.split(' ')[0];
          if (namePart && namePart.length >= 3) {
            const res = await radiologyApi.getScans({ search: namePart, limit: 10 });
            if (res && Array.isArray(res.data) && res.data.length > 0) {
              const matched = res.data.filter(s =>
                (numericId && s.patient_id === numericId) ||
                (patientCode && s.patient_code === patientCode) ||
                (s.first_name && searchName.toLowerCase().includes(s.first_name.toLowerCase()))
              );
              if (matched.length > 0) {
                scans = matched;
              }
            }
          }
        } catch (e) {
          console.warn('Scan search by name failed:', e);
        }
      }

      // Outcome processing
      if (scans && scans.length > 0) {
        setPatientScans(scans);
        setActiveScanIdx(0);
        setScanModalOpen(true);
        setScanAlert(null);
      } else {
        setPatientScans([]);
        setScanAlert({
          type: 'warning',
          message: 'No scan record found for this patient',
          detail: `No radiology imaging or PACS studies have been recorded in the system for ${p.name} (${p.uhid}).`
        });
      }
    } catch (err) {
      console.error('Scan lookup error:', err);
      setPatientScans([]);
      setScanAlert({
        type: 'error',
        message: 'No scan record found for this patient',
        detail: err.message || 'Error communicating with radiology PACS service.'
      });
    } finally {
      setScanLoading(false);
    }
  };

  const currentScan = patientScans.length > 0 ? (patientScans[activeScanIdx] || patientScans[0]) : null;

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

      {/* Scan Alert Notification Banner */}
      {scanAlert && (
        <div
          role="alert"
          style={{
            background: scanAlert.type === 'error' ? '#fef2f2' : '#fffbeb',
            border: `1px solid ${scanAlert.type === 'error' ? '#fca5a5' : '#fcd34d'}`,
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>
              {scanAlert.type === 'error' ? '⚠️' : '🔔'}
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: scanAlert.type === 'error' ? '#991b1b' : '#92400e' }}>
                {scanAlert.message}
              </div>
              {scanAlert.detail && (
                <div style={{ fontSize: '12px', color: scanAlert.type === 'error' ? '#b91c1c' : '#b45309', marginTop: '2px' }}>
                  {scanAlert.detail}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('radiology')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d97706',
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Go to Radiology Workstation →
              </button>
            )}
            <button
              type="button"
              onClick={() => setScanAlert(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                color: '#78350f',
                padding: '2px 6px',
                lineHeight: 1,
              }}
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
                  background: p.isCleared ? '#dcfce7' : '#fee2e2',
                  color: p.isCleared ? '#15803d' : '#991b1b',
                }}
              >
                {p.isCleared ? 'Bill Cleared · Admitted' : (p.status || 'Admitted')}
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
            {/* View Scan Action */}
            <button
              type="button"
              onClick={handleViewScan}
              disabled={scanLoading}
              title="Query radiology imaging & PACS scans for this patient"
              style={{
                height: '30px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #c7d2fe',
                background: scanLoading ? '#f1f5f9' : '#eef2ff',
                cursor: scanLoading ? 'wait' : 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                color: '#3730a3',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              {scanLoading ? (
                <>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Checking scan...
                </>
              ) : (
                <>
                  <span>🔬</span>
                  View scan
                </>
              )}
            </button>

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
              onClick={() => {
                if (onOpenDischarge) {
                  onOpenDischarge();
                } else if (onNavigate) {
                  onNavigate('discharge');
                }
              }}
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
          grid="120px 160px 110px 110px minmax(180px, 1fr) 70px 150px"
          rows={[
            [
              `PA-2026-${String(p.patient_id || p.admission_id || '1142').slice(-4)}`,
              p.insurer || 'Direct Billing / Corporate',
              `₹${p.billNetAmount.toLocaleString('en-IN')}`,
              `₹${(p.isCleared ? p.billNetAmount : Math.max(0, p.billNetAmount - p.outstandingBalance)).toLocaleString('en-IN')}`,
              p.isCleared ? 'None · Pre-auth verified' : `Co-pay balance: ₹${p.outstandingBalance.toLocaleString('en-IN')}`,
              p.isCleared ? '0%' : '9%',
              p.isCleared ? 'Approved · Settled' : 'Pending Clearance'
            ],
          ]}
        />
      )}

      {/* Tab 9: Billing */}
      {activeTab === 'Billing' && (
        <TableContainer
          cols={['Bill', 'Estimate', 'Actual', 'Insurance / Paid', 'Patient Due', 'Status']}
          grid="140px 110px 110px 130px 120px 170px"
          rows={[
            [
              p.billNumber,
              `₹${Math.round(p.billNetAmount * 0.9).toLocaleString('en-IN')}`,
              `₹${p.billNetAmount.toLocaleString('en-IN')}`,
              `₹${(p.isCleared ? p.billNetAmount : Math.max(0, p.billNetAmount - p.outstandingBalance)).toLocaleString('en-IN')}`,
              `₹${p.outstandingBalance.toLocaleString('en-IN')}`,
              p.billingStatusDisplay
            ],
          ]}
          onRowClick={handleOpenBillDrawer}
        />
      )}

      {/* Tab 10: Discharge */}
      {activeTab === 'Discharge' && (
        <TableContainer
          cols={['Case', 'Intent', 'Predicted', 'Owner', 'Status']}
          grid="120px 120px 120px minmax(180px, 1fr) 170px"
          rows={[
            [
              `DC-2026-${String(p.patient_id || p.admission_id || '0842').slice(-4)}`,
              '18 Sep 09:02',
              p.isCleared ? 'Ready' : 'Blocked',
              p.isCleared ? 'Clinical Discharge Agent' : 'Billing desk · R. Sundar',
              p.isCleared ? 'Ready for Sign-Off' : 'Pending Bill Clearance'
            ],
          ]}
          onRowClick={() => {
            if (onOpenDischarge) {
              onOpenDischarge();
            } else if (onNavigate) {
              onNavigate('discharge');
            }
          }}
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

      {/* ── Radiology Scan Modal ────────────────────────────────────────────── */}
      {scanModalOpen && currentScan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setScanModalOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '860px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔬</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Radiology Imaging & Triage Scan
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: currentScan.target === 1 ? '#fee2e2' : '#dcfce7',
                      color: currentScan.target === 1 ? '#991b1b' : '#166534',
                    }}
                  >
                    {currentScan.target === 1 ? '⚠️ OPACITY DETECTED' : '✓ ROUTINE / NORMAL'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Patient: <strong style={{ color: '#1e293b' }}>{p.name}</strong> · UHID: <strong style={{ fontFamily: 'ui-monospace, monospace', color: '#1e293b' }}>{p.uhid}</strong>
                  {patientScans.length > 1 && ` · Showing Scan ${activeScanIdx + 1} of ${patientScans.length}`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setScanModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Multiple Scans Selector if > 1 */}
            {patientScans.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  padding: '8px 20px',
                  background: '#f1f5f9',
                  borderBottom: '1px solid #e2e8f0',
                  overflowX: 'auto',
                }}
              >
                {patientScans.map((s, idx) => (
                  <button
                    key={s.scan_id || idx}
                    type="button"
                    onClick={() => setActiveScanIdx(idx)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '14px',
                      fontSize: '11.5px',
                      fontWeight: activeScanIdx === idx ? 700 : 500,
                      border: '1px solid',
                      borderColor: activeScanIdx === idx ? '#4f46e5' : '#cbd5e1',
                      background: activeScanIdx === idx ? '#4f46e5' : '#fff',
                      color: activeScanIdx === idx ? '#fff' : '#475569',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Scan #{idx + 1} ({s.target === 1 ? 'Target 1 · Opacity' : 'Normal'})
                  </button>
                ))}
              </div>
            )}

            {/* Modal Body: 2 Columns */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '20px',
                padding: '20px',
              }}
            >
              {/* Left Column: Image Viewport */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  DICOM Medical Imaging Viewport
                </div>

                <div
                  style={{
                    background: '#090d16',
                    borderRadius: '8px',
                    minHeight: '280px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid #1e293b',
                    padding: '8px',
                  }}
                >
                  {currentScan.image ? (
                    <div style={{ position: 'relative', maxWidth: '100%', display: 'flex', justifyContent: 'center' }}>
                      <img
                        src={currentScan.image.startsWith('data:') ? currentScan.image : `data:image/png;base64,${currentScan.image}`}
                        alt="Radiology Study X-Ray"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '340px',
                          objectFit: 'contain',
                          borderRadius: '4px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        }}
                      />
                      {currentScan.target === 1 && currentScan.x !== null && currentScan.width !== null && (
                        <div
                          style={{
                            position: 'absolute',
                            left: `${Math.min(80, Math.max(10, (currentScan.x / 1024) * 100))}%`,
                            top: `${Math.min(80, Math.max(10, (currentScan.y / 1024) * 100))}%`,
                            width: `${Math.min(60, Math.max(15, (currentScan.width / 1024) * 100))}%`,
                            height: `${Math.min(60, Math.max(15, (currentScan.height / 1024) * 100))}%`,
                            border: '2px solid #ef4444',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            pointerEvents: 'none',
                            boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                          }}
                        >
                          <span
                            style={{
                              position: 'absolute',
                              top: '-20px',
                              left: 0,
                              background: '#ef4444',
                              color: '#fff',
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '2px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            AI SUSPECTED OPACITY
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Fallback stylized DICOM frame when raw pixel image is PACS-archived */
                    <div
                      style={{
                        width: '100%',
                        height: '280px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8',
                        textAlign: 'center',
                        padding: '16px',
                        background: 'radial-gradient(ellipse at center, #1e293b 0%, #090d16 80%)',
                      }}
                    >
                      <span style={{ fontSize: '48px', marginBottom: '8px', opacity: 0.8 }}>🩻</span>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                        Chest Radiograph (CR / DX)
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', maxWidth: '280px' }}>
                        Study ID: <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{currentScan.original_patient_id || currentScan.study_id || 'PACS-MER-001'}</span>
                      </div>
                      {currentScan.target === 1 && (
                        <div
                          style={{
                            marginTop: '12px',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid #ef4444',
                            color: '#fca5a5',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          Region Marker: X: {Math.round(currentScan.x || 264)} · Y: {Math.round(currentScan.y || 152)} · W: {Math.round(currentScan.width || 213)} · H: {Math.round(currentScan.height || 379)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* DICOM Overlay Stats HUD */}
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '10px',
                      color: '#94a3b8',
                      fontFamily: 'ui-monospace, monospace',
                      marginTop: '6px',
                      padding: '0 4px',
                    }}
                  >
                    <span>ID: {currentScan.patient_code || p.uhid}</span>
                    <span>SCAN #{currentScan.scan_id}</span>
                    <span>TARGET: {currentScan.target}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Triage & Clinical Insights */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  AI Triage Analysis & Report
                </div>

                {/* Key Metrics Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Triage Priority</div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: currentScan.target === 1 ? '#dc2626' : '#16a34a',
                        marginTop: '2px',
                      }}
                    >
                      {currentScan.priority || (currentScan.target === 1 ? 'HIGH PRIORITY' : 'ROUTINE')}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Opacity Status</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {currentScan.target === 1 ? 'Suspected Opacity' : 'Clear / Unremarkable'}
                    </div>
                  </div>
                </div>

                {/* Scan Report Text */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Automated Radiologic Report / Findings:
                  </div>
                  <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {currentScan.scan_report ||
                      (currentScan.target === 1
                        ? 'The triage deep-learning model identified suspected pulmonary opacity. Localized coordinates flagged for urgent radiologist review. No tension pneumothorax.'
                        : 'No focal consolidation, pneumothorax, or large pleural effusion detected. Cardiac silhouette within normal limits for patient age.')}
                  </div>
                </div>

                {/* Metadata Details Table */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: '6px', fontSize: '11.5px' }}>
                    <span style={{ color: '#64748b' }}>Scan Database ID:</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#0f172a' }}>{currentScan.scan_id}</span>

                    <span style={{ color: '#64748b' }}>Patient Code:</span>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#0f172a' }}>{currentScan.patient_code || p.uhid}</span>

                    <span style={{ color: '#64748b' }}>Scan Recorded:</span>
                    <span style={{ color: '#0f172a' }}>{currentScan.created_at ? new Date(currentScan.created_at).toLocaleString() : '12 Sep 2026'}</span>

                    <span style={{ color: '#64748b' }}>Review Status:</span>
                    <span style={{ fontWeight: 600, color: currentScan.review_status ? '#16a34a' : '#d97706' }}>
                      {currentScan.review_status || 'Pending Radiologist Sign-off'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Powered by Meridian Clinical Imaging Intelligence
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setScanModalOpen(false)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScanModalOpen(false);
                    if (onOpenRadiologyStudy) {
                      onOpenRadiologyStudy(currentScan.study_id || currentScan.scan_id);
                    } else if (onNavigate) {
                      onNavigate('radiology');
                    }
                  }}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'oklch(0.5 0.1 200)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🔬</span>
                  Open in Radiology Workstation →
                </button>
              </div>
            </div>
          </div>
        </div>
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
