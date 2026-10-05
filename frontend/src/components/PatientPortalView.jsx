import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import {
  LayoutDashboard,
  User,
  ClipboardList,
  Stethoscope,
  Pill,
  FlaskConical,
  CalendarCheck,
  Activity,
  CreditCard,
  FileCheck,
  Download
} from 'lucide-react';

function generateDischargeSummaryHtml(ds, patient) {
  const diagnosesHtml = ds.diagnoses ? `
    <div class="section">
      <div class="section-title">Final Clinical Diagnoses</div>
      <div class="section-content"><strong>${ds.diagnoses}</strong></div>
    </div>` : '';

  const historyHtml = ds.case_history ? `
    <div class="section">
      <div class="section-title">Hospital Course & Clinical Summary</div>
      <div class="section-content">${ds.case_history}</div>
    </div>` : '';

  const investigationsHtml = ds.investigations ? `
    <div class="section">
      <div class="section-title">Key Investigations & Diagnostic Findings</div>
      <div class="section-content">${ds.investigations}</div>
    </div>` : '';

  const treatmentHtml = ds.treatment ? `
    <div class="section">
      <div class="section-title">Treatments & Procedures Provided</div>
      <div class="section-content">${ds.treatment}</div>
    </div>` : '';

  const surgeryHtml = ds.surgery_details ? `
    <div class="section">
      <div class="section-title">Surgical / Interventional Details</div>
      <div class="section-content">${ds.surgery_details}</div>
    </div>` : '';

  const conditionHtml = ds.patient_condition ? `
    <div class="section">
      <div class="section-title">Condition at Discharge</div>
      <div class="section-content">${ds.patient_condition}</div>
    </div>` : '';

  const adviceHtml = ds.discharge_advice ? `
    <div class="section">
      <div class="section-title">Discharge Advice, Medications & Home Care Instructions</div>
      <div class="advice-box">${ds.discharge_advice}</div>
    </div>` : '';

  const issueDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Discharge_Summary_${patient?.patient_code || 'Patient'}_#${ds.summary_id}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.5;
      font-size: 13px;
      margin: 0;
      padding: 24px;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0d767a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .hospital-title {
      font-size: 22px;
      font-weight: 800;
      color: #0d767a;
      letter-spacing: -0.02em;
    }
    .hospital-sub {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .doc-badge {
      text-align: right;
    }
    .doc-type {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .doc-id {
      font-size: 12px;
      color: #0284c7;
      font-weight: 600;
      margin-top: 2px;
    }
    .status-stamp {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 10px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .patient-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px 18px;
      font-size: 12.5px;
    }
    .patient-field strong {
      color: #475569;
      display: block;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .patient-field span {
      color: #0f172a;
      font-weight: 600;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .section-content {
      color: #334155;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .advice-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 14px 16px;
      color: #166534;
      line-height: 1.6;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 11.5px;
      color: #64748b;
    }
    .sign-box {
      text-align: right;
    }
    .sign-line {
      width: 220px;
      border-top: 1px solid #0f172a;
      margin-top: 45px;
      padding-top: 6px;
      font-weight: 600;
      color: #0f172a;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size: 22px; font-weight: 800; color: #0d767a; letter-spacing: -0.02em;">
        Clinical Discharge Summary
      </div>
      <div style="font-size: 12px; color: #64748b; margin-top: 3px;">
        Document Reference: MER-DS-${ds.summary_id}
      </div>
    </div>
    <div class="doc-badge">
      <div class="status-stamp">VERIFIED & APPROVED</div>
    </div>
  </div>

  <div class="patient-box">
    <div class="patient-field">
      <strong>Patient Name</strong>
      <span>${patient?.full_name || '—'}</span>
    </div>
    <div class="patient-field">
      <strong>UHID (Patient ID)</strong>
      <span>${patient?.patient_code || '—'}</span>
    </div>
    <div class="patient-field">
      <strong>Age / Gender</strong>
      <span>${patient?.age || '—'} yrs / ${patient?.gender || '—'}</span>
    </div>
    <div class="patient-field">
      <strong>Blood Group</strong>
      <span>${patient?.blood_group || '—'}</span>
    </div>
    <div class="patient-field">
      <strong>Admission Date</strong>
      <span>${ds.admission_date || '—'}</span>
    </div>
    <div class="patient-field">
      <strong>Discharge Date</strong>
      <span>${ds.discharge_date || '—'}</span>
    </div>
    <div class="patient-field">
      <strong>Attending Consultant</strong>
      <span>${ds.primary_consultant || 'Attending Physician'}</span>
    </div>
    <div class="patient-field">
      <strong>Admission ID</strong>
      <span>#${ds.admission_id || '—'}</span>
    </div>
    <div class="patient-field">
      <strong>Verification Status</strong>
      <span style="color: #059669;">Approved by Physician</span>
    </div>
  </div>

  ${diagnosesHtml}
  ${historyHtml}
  ${investigationsHtml}
  ${treatmentHtml}
  ${surgeryHtml}
  ${conditionHtml}
  ${adviceHtml}

  <div class="footer">
    <div>
      <div>Computer Generated Verified Clinical Summary · Official Patient Record</div>
      <div>Issued on ${issueDate}</div>
    </div>
    <div class="sign-box">
      <div class="sign-line">${ds.primary_consultant || 'Attending Consultant Physician'}</div>
      <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">Authorized Digital Sign-off</div>
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
</html>`;
}

export default function PatientPortalView({ currentUser, onSignOut }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const loadPatientData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getPatientPortalDashboard();
      if (res && res.success && res.data) {
        setData(res.data);
      } else {
        throw new Error(res?.detail || 'Failed to retrieve patient records');
      }
    } catch (err) {
      console.error('Error loading patient portal data:', err);
      setError(err.message || 'Unable to load your medical records. Please verify your authentication.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, [currentUser?.username, currentUser?.patient_id]);

  if (loading) {
    return (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        color: '#475569'
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          border: '3px solid #e2e8f0',
          borderTopColor: 'oklch(0.5 0.1 200)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
          Loading Your Personal Medical Record...
        </div>
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Verifying security token and fetching authenticated patient data
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ maxWidth: '650px', margin: '40px auto', padding: '24px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #fee2e2',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.05)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#991b1b', margin: '0 0 8px 0' }}>
            Access Restricted or Session Expired
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: '0 0 18px 0' }}>
            {error || 'Unable to retrieve your records.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button
              onClick={loadPatientData}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Retry Loading
            </button>
            {onSignOut && (
              <button
                onClick={onSignOut}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'oklch(0.5 0.1 200)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Sign In Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const {
    patient = {},
    admissions = [],
    diagnoses = [],
    appointments = [],
    vitals = [],
    prescriptions = [],
    lab_orders = [],
    bills = [],
    insurance_claims = [],
    discharge_summaries = [],
    notifications: _notifications = []
  } = data;

  const currentAdmission = admissions.find(a => !a.discharge_date || a.discharge_status?.toLowerCase() === 'admitted');
  const latestVital = vitals.length > 0 ? vitals[0] : null;
  const upcomingAppointments = appointments.filter(a => a.status?.toLowerCase() !== 'cancelled');

  // Only approved / completed discharge summaries are visible to the patient
  // Drafts or pending-approval summaries remain restricted to clinical staff
  const completedDischargeSummaries = (discharge_summaries || []).filter(ds => {
    const status = (ds.approval_status || '').toUpperCase().trim();
    return status === 'APPROVED' || status === 'COMPLETED';
  });

  const handleDownloadDischargeSummary = (ds) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up window was blocked. Please enable pop-ups to download or print your discharge summary.');
      return;
    }
    const html = generateDischargeSummaryHtml(ds, patient);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'profile', label: 'My Demographics', icon: User },
    { id: 'admissions', label: 'Visits & Admissions', count: admissions.length, icon: ClipboardList },
    { id: 'diagnoses', label: 'Diagnoses & Care', count: diagnoses.length, icon: Stethoscope },
    { id: 'prescriptions', label: 'Medications', count: prescriptions.length, icon: Pill },
    { id: 'labs', label: 'Lab Test Results', count: lab_orders.length, icon: FlaskConical },
    { id: 'appointments', label: 'Appointments', count: appointments.length, icon: CalendarCheck },
    { id: 'vitals', label: 'Vitals History', count: vitals.length, icon: Activity },
    { id: 'billing', label: 'Bills & Insurance', count: bills.length + insurance_claims.length, icon: CreditCard },
    { id: 'discharge', label: 'Discharge Summaries', count: completedDischargeSummaries.length, icon: FileCheck }
  ];

  return (
    <div style={{ maxWidth: '1380px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* ── Top Patient Identity Header Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0d5f63 0%, #0b7074 50%, #064346 100%)',
        color: '#fff',
        borderRadius: '14px',
        padding: '22px 28px',
        boxShadow: '0 4px 20px rgba(13, 95, 99, 0.18)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%)',
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 700,
            color: '#fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            flexShrink: 0
          }}>
            {patient.full_name ? patient.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'PT'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                {patient.full_name || 'Patient'}
              </h1>
              <span style={{
                background: 'rgba(255, 255, 255, 0.18)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em'
              }}>
                UHID: {patient.patient_code}
              </span>
              <span style={{
                background: 'rgba(52, 211, 153, 0.25)',
                color: '#a7f3d0',
                border: '1px solid rgba(52, 211, 153, 0.45)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600
              }}>
                {patient.status || 'Active Patient'}
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              marginTop: '8px',
              fontSize: '12.5px',
              color: 'rgba(255,255,255,0.85)'
            }}>
              <span><strong>Age:</strong> {patient.age || '—'} yrs</span>
              <span>·</span>
              <span><strong>Gender:</strong> {patient.gender || '—'}</span>
              <span>·</span>
              <span><strong>Blood Group:</strong> <span style={{ color: '#fca5a5', fontWeight: 700 }}>{patient.blood_group || '—'}</span></span>
              {patient.phone && (
                <>
                  <span>·</span>
                  <span><strong>Phone:</strong> {patient.phone}</span>
                </>
              )}
              {patient.email && (
                <>
                  <span>·</span>
                  <span><strong>Email:</strong> {patient.email}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Security & Access Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255,255,255,0.12)',
          padding: '8px 14px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <span style={{ fontSize: '15px' }}>🛡️</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>Authenticated Patient Identity</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
              Strict Backend-Verified Portal (ID: {patient.id})
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Inpatient Alert (if currently admitted) ── */}
      {currentAdmission && (
        <div style={{
          background: 'linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)',
          border: '1px solid #a7f3d0',
          borderRadius: '10px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          color: '#065f46'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>🏥</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
                Active Inpatient Admission · Admission #{currentAdmission.admission_number || currentAdmission.admission_id}
              </div>
              <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                Ward: <strong>{currentAdmission.ward_name || 'General Ward'}</strong> · Bed: <strong>{currentAdmission.bed_number || 'B-01'}</strong> · Attending: <strong>{currentAdmission.doctor_name}</strong> ({currentAdmission.department_name})
              </div>
            </div>
          </div>
          <span style={{
            background: '#059669',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.03em'
          }}>
            CURRENTLY ADMITTED
          </span>
        </div>
      )}

      {/* ── Main Layout: Vertical Sidebar + Content Area ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '270px 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* ── Left Sidebar Navigation (Doctor UI Aligned) ── */}
        <aside style={{
          background: '#ffffff',
          border: '1px solid #e3e6e8',
          borderRadius: '12px',
          padding: '12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          position: 'sticky',
          top: '80px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px'
        }}>
          <div style={{
            padding: '8px 12px 6px',
            fontSize: '11px',
            fontWeight: 700,
            color: '#8a9096',
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}>
            Navigation
          </div>
          {tabs.map(t => {
            const isActive = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  borderLeft: isActive ? '3px solid oklch(0.5 0.1 200)' : '3px solid transparent',
                  background: isActive ? 'oklch(0.95 0.03 200)' : 'transparent',
                  color: isActive ? 'oklch(0.4 0.1 200)' : '#52585e',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#f4f6f8';
                    e.currentTarget.style.color = 'oklch(0.4 0.1 200)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#52585e';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon
                    size={17}
                    style={{
                      flexShrink: 0,
                      color: isActive ? 'oklch(0.5 0.1 200)' : '#8a9096'
                    }}
                  />
                  <span>{t.label}</span>
                </div>
                {typeof t.count === 'number' && (
                  <span style={{
                    padding: '1px 7px',
                    borderRadius: '10px',
                    background: isActive ? 'oklch(0.9 0.05 200)' : '#f1f5f9',
                    color: isActive ? 'oklch(0.35 0.12 200)' : '#64748b',
                    fontSize: '11px',
                    fontWeight: 700
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* ── Right Content Area ── */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px'
          }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Admissions History</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{admissions.length}</div>
              <div style={{ fontSize: '11.5px', color: '#10b981', marginTop: '4px' }}>
                {currentAdmission ? '1 Current Active' : 'All Past Completed'}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Medications</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{prescriptions.length}</div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                Prescribed Regimens
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Diagnostic Lab Tests</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{lab_orders.length}</div>
              <div style={{ fontSize: '11.5px', color: '#0284c7', marginTop: '4px' }}>Verified Results Ready</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Appointments</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>{appointments.length}</div>
              <div style={{ fontSize: '11.5px', color: '#8b5cf6', marginTop: '4px' }}>
                {upcomingAppointments.length} Total Booked
              </div>
            </div>
          </div>

          {/* Vitals Summary & Next Appointment Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
            
            {/* Latest Vitals Card */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  💓 Latest Vital Signs
                </div>
                {latestVital && (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Recorded: {new Date(latestVital.recorded_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {latestVital ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Blood Pressure</div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {latestVital.blood_pressure || `${latestVital.systolic_bp || 120}/${latestVital.diastolic_bp || 80}`} mmHg
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Heart Rate</div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: '#e11d48', marginTop: '2px' }}>
                      {latestVital.heart_rate || '72'} bpm
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Oxygen (SpO2)</div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: '#0284c7', marginTop: '2px' }}>
                      {latestVital.oxygen_saturation || '98'}%
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Temperature</div>
                    <div style={{ fontSize: '17px', fontWeight: 700, color: '#ea580c', marginTop: '2px' }}>
                      {latestVital.temperature || '98.6'}°F
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No vital signs recorded recently.
                </div>
              )}
            </div>

            {/* Upcoming Appointments Card */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  📅 Doctor Consultations
                </div>
                <button
                  onClick={() => setActiveTab('appointments')}
                  style={{ border: 'none', background: 'transparent', color: '#0284c7', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  View All →
                </button>
              </div>

              {appointments.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {appointments.slice(0, 3).map((app, idx) => (
                    <div key={idx} style={{
                      padding: '10px 12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #f1f5f9',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                          {app.doctor_name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {app.doctor_specialization || app.department_name} · {app.appointment_type || 'Consultation'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7' }}>
                          {app.appointment_date}
                        </div>
                        <span style={{
                          fontSize: '10.5px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: app.status === 'CONFIRMED' ? '#dcfce7' : '#f1f5f9',
                          color: app.status === 'CONFIRMED' ? '#15803d' : '#475569',
                          fontWeight: 600
                        }}>
                          {app.status || 'SCHEDULED'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No scheduled doctor appointments.
                </div>
              )}
            </div>
          </div>

          {/* Recent Diagnoses & Active Regimens */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
            
            {/* Diagnoses Card */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
                🩺 Clinical Diagnoses
              </div>
              {diagnoses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {diagnoses.slice(0, 4).map((d, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{d.diagnosis_name}</strong>
                        {d.is_primary && (
                          <span style={{ fontSize: '10.5px', color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        ICD: {d.diagnosis_code || 'N/A'} · Dr. {d.doctor_name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '16px' }}>No recorded diagnoses.</div>
              )}
            </div>

            {/* Recent Prescriptions */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
                💊 Prescribed Medications
              </div>
              {prescriptions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {prescriptions.slice(0, 3).map((p, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>
                          Rx #{p.prescription_id} · {p.prescription_date}
                        </span>
                        <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>{p.status || 'Active'}</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                        {(p.items || []).map(it => `${it.medication_name} (${it.dosage || it.strength || ''})`).join(', ') || 'Medication items listed'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '16px' }}>No active prescriptions.</div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* 2. DEMOGRAPHICS & PROFILE TAB */}
      {activeTab === 'profile' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
            Patient Demographics & Registration Profile
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Full Legal Name</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{patient.full_name}</div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Unique Health Identifier (UHID)</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0284c7', marginTop: '2px' }}>{patient.patient_code}</div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Date of Birth / Age</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                {patient.date_of_birth || '—'} ({patient.age || '—'} years)
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Gender & Blood Group</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                {patient.gender} · {patient.blood_group}
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Phone Number</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{patient.phone || '—'}</div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Email Address</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{patient.email || '—'}</div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Residential Address</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                {[patient.address, patient.city, patient.state, patient.pincode].filter(Boolean).join(', ') || '—'}
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Emergency Contact</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                {patient.emergency_contact_name || '—'} ({patient.emergency_contact_phone || '—'})
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>Marital Status / Language</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                {patient.marital_status || '—'} · {patient.preferred_language || 'English'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ADMISSIONS TAB */}
      {activeTab === 'admissions' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
            Hospital Inpatient Admissions & History ({admissions.length})
          </h2>
          {admissions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {admissions.map((adm, i) => (
                <div key={i} style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  background: !adm.discharge_date ? '#f0fdf4' : '#fff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                        Admission #{adm.admission_number || adm.admission_id}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: !adm.discharge_date ? '#dcfce7' : '#f1f5f9',
                        color: !adm.discharge_date ? '#15803d' : '#475569',
                        fontWeight: 700
                      }}>
                        {adm.discharge_status || (!adm.discharge_date ? 'ADMITTED' : 'DISCHARGED')}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      <strong>Admitted:</strong> {adm.admission_date} {adm.discharge_date && `· Discharged: ${adm.discharge_date}`}
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    fontSize: '12.5px'
                  }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Attending Physician:</span>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{adm.doctor_name} ({adm.department_name})</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Ward & Bed:</span>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{adm.ward_name || 'General Ward'} · Bed {adm.bed_number || 'Standard'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Reason for Admission:</span>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{adm.reason_for_admission || 'Clinical management'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>No hospital admissions on record.</div>
          )}
        </div>
      )}

      {/* 4. DIAGNOSES TAB */}
      {activeTab === 'diagnoses' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
            Clinical Diagnoses & Assessment ({diagnoses.length})
          </h2>
          {diagnoses.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px 14px' }}>Diagnosis</th>
                    <th style={{ padding: '10px 14px' }}>ICD-10 Code</th>
                    <th style={{ padding: '10px 14px' }}>Classification</th>
                    <th style={{ padding: '10px 14px' }}>Date</th>
                    <th style={{ padding: '10px 14px' }}>Consulting Doctor</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnoses.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                        {d.diagnosis_name}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#0284c7', fontWeight: 600 }}>
                        {d.diagnosis_code || '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: d.is_primary ? '#fee2e2' : '#f1f5f9',
                          color: d.is_primary ? '#dc2626' : '#475569',
                          fontWeight: 600,
                          fontSize: '11px'
                        }}>
                          {d.is_primary ? 'PRIMARY' : (d.diagnosis_type || 'SECONDARY')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b' }}>{d.diagnosis_date}</td>
                      <td style={{ padding: '12px 14px', color: '#334155' }}>{d.doctor_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>No recorded diagnoses.</div>
          )}
        </div>
      )}

      {/* 5. MEDICATIONS / PHARMACY TAB */}
      {activeTab === 'prescriptions' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
            Prescribed Medications & Pharmacy Regimens ({prescriptions.length})
          </h2>
          {prescriptions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {prescriptions.map((p, idx) => (
                <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        Prescription #{p.prescription_id}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '10px' }}>
                        Prescribed on: {p.prescription_date} by <strong>{p.doctor_name}</strong>
                      </span>
                    </div>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: '#dcfce7',
                      color: '#15803d',
                      fontSize: '11px',
                      fontWeight: 700
                    }}>
                      {p.status || 'ACTIVE'}
                    </span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Medicine</th>
                        <th style={{ padding: '8px 10px' }}>Dosage & Strength</th>
                        <th style={{ padding: '8px 10px' }}>Frequency</th>
                        <th style={{ padding: '8px 10px' }}>Duration</th>
                        <th style={{ padding: '8px 10px' }}>Instructions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(p.items || []).map((it, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                            {it.medication_name} {it.dosage_form ? `(${it.dosage_form})` : ''}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>
                            {it.dosage || it.strength || 'Standard'}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#0284c7', fontWeight: 600 }}>
                            {it.frequency || '1-0-1'}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>
                            {it.duration || '5 Days'}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#047857' }}>
                            {it.instructions || 'After meals with water'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>No active prescriptions recorded.</div>
          )}
        </div>
      )}

      {/* 6. LAB TEST RESULTS TAB */}
      {activeTab === 'labs' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
            Laboratory Orders & Verified Test Results ({lab_orders.length})
          </h2>
          {lab_orders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {lab_orders.map((order, idx) => (
                <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        {order.test_name}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '10px' }}>
                        Category: {order.test_category || 'Clinical Pathology'} · Sample: {order.sample_type || 'Blood'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Ordered: {order.ordered_date} · By: <strong>{order.doctor_name}</strong>
                    </div>
                  </div>

                  {order.results && order.results.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px' }}>Parameter</th>
                          <th style={{ padding: '8px 10px' }}>Result</th>
                          <th style={{ padding: '8px 10px' }}>Reference Range</th>
                          <th style={{ padding: '8px 10px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.results.map((res, rIdx) => {
                          const isAbnormal = res.abnormal_flag && res.abnormal_flag !== 'NORMAL';
                          return (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                                {res.test_parameter}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 700, color: isAbnormal ? '#dc2626' : '#047857' }}>
                                {res.result_value} {res.unit}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>
                                {res.reference_range || 'Normal baseline'}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  background: isAbnormal ? '#fee2e2' : '#dcfce7',
                                  color: isAbnormal ? '#dc2626' : '#15803d',
                                  fontWeight: 700,
                                  fontSize: '10.5px'
                                }}>
                                  {isAbnormal ? res.abnormal_flag : 'NORMAL'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '12px', padding: '8px' }}>Test in processing by laboratory.</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>No laboratory tests on file.</div>
          )}
        </div>
      )}

      {/* 7. APPOINTMENTS TAB */}
      {activeTab === 'appointments' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
            Doctor Appointments & Consultation Visits ({appointments.length})
          </h2>
          {appointments.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {appointments.map((app, i) => (
                <div key={i} style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      {app.doctor_name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {app.doctor_specialization || app.department_name} · Type: {app.appointment_type || 'Consultation'}
                    </div>
                    {app.reason_for_visit && (
                      <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
                        Reason: {app.reason_for_visit}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0284c7' }}>
                      {app.appointment_date} · {app.appointment_time || '10:00 AM'}
                    </div>
                    <span style={{
                      display: 'inline-block',
                      marginTop: '4px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: app.status === 'CONFIRMED' ? '#dcfce7' : '#f1f5f9',
                      color: app.status === 'CONFIRMED' ? '#15803d' : '#475569',
                      fontSize: '11px',
                      fontWeight: 700
                    }}>
                      {app.status || 'SCHEDULED'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>No doctor appointments found.</div>
          )}
        </div>
      )}

      {/* 8. VITALS HISTORY TAB */}
      {activeTab === 'vitals' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
            Physiological Vital Signs Log ({vitals.length})
          </h2>
          {vitals.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px 14px' }}>Recorded At</th>
                    <th style={{ padding: '10px 14px' }}>Blood Pressure</th>
                    <th style={{ padding: '10px 14px' }}>Heart Rate</th>
                    <th style={{ padding: '10px 14px' }}>Temperature</th>
                    <th style={{ padding: '10px 14px' }}>SpO2</th>
                    <th style={{ padding: '10px 14px' }}>Resp Rate</th>
                    <th style={{ padding: '10px 14px' }}>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map((v, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>
                        {new Date(v.recorded_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                        {v.blood_pressure || `${v.systolic_bp}/${v.diastolic_bp}`} mmHg
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#e11d48' }}>
                        {v.heart_rate} bpm
                      </td>
                      <td style={{ padding: '10px 14px', color: '#ea580c' }}>
                        {v.temperature}°F
                      </td>
                      <td style={{ padding: '10px 14px', color: '#0284c7', fontWeight: 600 }}>
                        {v.oxygen_saturation}%
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>
                        {v.respiratory_rate || '18'} /min
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>
                        {v.recorded_by || 'Staff Nurse'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>No vital signs recorded.</div>
          )}
        </div>
      )}

      {/* 9. BILLING & INSURANCE TAB */}
      {activeTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Bills Section */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
              Hospital Invoices & Patient Bills ({bills.length})
            </h2>
            {bills.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '10px 14px' }}>Invoice #</th>
                      <th style={{ padding: '10px 14px' }}>Date</th>
                      <th style={{ padding: '10px 14px' }}>Gross Total</th>
                      <th style={{ padding: '10px 14px' }}>Insurance Covered</th>
                      <th style={{ padding: '10px 14px' }}>Patient Share</th>
                      <th style={{ padding: '10px 14px' }}>Net Payable</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                          {b.bill_number}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b' }}>{b.bill_date}</td>
                        <td style={{ padding: '12px 14px', color: '#334155' }}>₹{Number(b.gross_amount).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', color: '#047857', fontWeight: 600 }}>₹{Number(b.insurance_amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', color: '#b45309' }}>₹{Number(b.patient_amount || b.net_amount).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>₹{Number(b.net_amount).toLocaleString()}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: b.bill_status?.toLowerCase() === 'paid' ? '#dcfce7' : '#fef3c7',
                            color: b.bill_status?.toLowerCase() === 'paid' ? '#15803d' : '#b45309',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}>
                            {b.bill_status || 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>No billing invoices found.</div>
            )}
          </div>

          {/* Insurance Claims Section */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
              Insurance Coverage & TPA Claims ({insurance_claims.length})
            </h2>
            {insurance_claims.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {insurance_claims.map((ic, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                          {ic.insurance_provider}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '10px' }}>
                          Policy #: {ic.policy_number} · Claim #{ic.claim_number}
                        </span>
                      </div>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: ic.claim_status?.toLowerCase() === 'approved' ? '#dcfce7' : '#e0f2fe',
                        color: ic.claim_status?.toLowerCase() === 'approved' ? '#15803d' : '#0369a1',
                        fontWeight: 700,
                        fontSize: '11px'
                      }}>
                        {ic.claim_status || 'IN PROCESS'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', fontSize: '12.5px', marginTop: '8px' }}>
                      <div>Claimed: <strong>₹{Number(ic.claimed_amount).toLocaleString()}</strong></div>
                      <div>Approved: <strong style={{ color: '#047857' }}>₹{Number(ic.approved_amount || 0).toLocaleString()}</strong></div>
                      <div>Settled: <strong>₹{Number(ic.settled_amount || 0).toLocaleString()}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>No insurance claims submitted.</div>
            )}
          </div>

        </div>
      )}

      {/* 10. DISCHARGE SUMMARIES TAB */}
      {activeTab === 'discharge' && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', margin: '0 0 16px 0' }}>
            Clinical Discharge Summaries ({completedDischargeSummaries.length})
          </h2>
          {completedDischargeSummaries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {completedDischargeSummaries.map((ds, idx) => (
                <div key={idx} style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '20px',
                  background: '#f8fafc'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        Discharge Summary #{ds.summary_id}
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '12px' }}>
                        Stay: {ds.admission_date} to {ds.discharge_date}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: '#dcfce7',
                        color: '#15803d',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        VERIFIED & APPROVED
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadDischargeSummary(ds)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'oklch(0.5 0.1 200)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.42 0.1 200)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'oklch(0.5 0.1 200)'}
                        title="Download official discharge summary document or save as PDF"
                      >
                        <Download size={14} />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                    <div>
                      <strong style={{ color: '#334155' }}>Primary Consultant:</strong>
                      <div style={{ color: '#0f172a', marginTop: '2px' }}>{ds.primary_consultant || 'Attending Physician'}</div>
                    </div>

                    {ds.diagnoses && (
                      <div>
                        <strong style={{ color: '#334155' }}>Final Diagnoses:</strong>
                        <div style={{ color: '#0f172a', marginTop: '2px' }}>{ds.diagnoses}</div>
                      </div>
                    )}

                    {ds.case_history && (
                      <div>
                        <strong style={{ color: '#334155' }}>Hospital Course & Case History:</strong>
                        <div style={{ color: '#475569', marginTop: '2px', lineHeight: 1.5 }}>{ds.case_history}</div>
                      </div>
                    )}

                    {ds.treatment && (
                      <div>
                        <strong style={{ color: '#334155' }}>Treatment Provided:</strong>
                        <div style={{ color: '#475569', marginTop: '2px', lineHeight: 1.5 }}>{ds.treatment}</div>
                      </div>
                    )}

                    {ds.discharge_advice && (
                      <div style={{ background: '#ecfdf5', padding: '12px 14px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                        <strong style={{ color: '#065f46' }}>Discharge Advice & Recovery Instructions:</strong>
                        <div style={{ color: '#047857', marginTop: '4px', lineHeight: 1.5 }}>{ds.discharge_advice}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '40px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: '#f1f5f9',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileCheck size={22} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>
                No Completed Discharge Summaries
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', maxWidth: '440px', lineHeight: 1.5 }}>
                Discharge summaries remain restricted while approval is pending. Formal discharge summaries are only published to your portal once completed and signed off by the attending physician.
              </div>
            </div>
          )}
        </div>
      )}

        </div>
      </div>

    </div>
  );
}


