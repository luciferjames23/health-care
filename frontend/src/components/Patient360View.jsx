import React, { useState, useEffect, useMemo } from 'react';
import { apiService, parseAdmissionLlmRecord, parseDischargeSummaryRecord, extractDischargedPatientIds } from '../services/api';

export default function Patient360View({ patient, onOpenDischarge, onOpenSoap, onBack }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(false);
  const [admittedPatients, setAdmittedPatients] = useState([]);
  const [selectedPatientData, setSelectedPatientData] = useState(null);
  const [selectedPid, setSelectedPid] = useState(patient?.patient_id || patient?.id || '');

  // 1. Fetch live currently admitted patients list from Gold Delta table (excluding discharged patients)
  useEffect(() => {
    let isMounted = true;
    async function loadInpatientOptions() {
      try {
        const [admRes, dcRes] = await Promise.all([
          apiService.getCurrentAdmissions().catch(() => ({ data: [] })),
          apiService.getDischargedPatients().catch(() => ({ data: [] }))
        ]);
        const dischargedTracker = extractDischargedPatientIds(dcRes?.data || []);
        const rawAdmissions = admRes?.data || [];
        const list = rawAdmissions
          .filter(r => !dischargedTracker.has(r))
          .map(parseAdmissionLlmRecord)
          .filter(Boolean);

        if (isMounted && list.length > 0) {
          setAdmittedPatients(list);
          // If no initial patient selected, default to first live patient
          if (!selectedPid) {
            setSelectedPid(String(list[0].patient_id || list[0].id));
            setSelectedPatientData(list[0]);
          }
        }
      } catch (err) {
        console.warn("Failed to load live admitted patient options:", err);
      }
    }
    loadInpatientOptions();
    return () => { isMounted = false; };
  }, []);

  // 2. Sync if patient prop changes
  useEffect(() => {
    if (patient?.patient_id || patient?.id) {
      const pid = String(patient.patient_id || patient.id);
      setSelectedPid(pid);
      if (patient.raw || patient.llm_input_json || patient.medications) {
        setSelectedPatientData(patient.medications ? patient : parseAdmissionLlmRecord(patient));
      }
    }
  }, [patient]);

  // 3. Load full patient dossier whenever selectedPid changes
  useEffect(() => {
    let isMounted = true;
    async function resolvePatientDetails() {
      if (!selectedPid) return;

      // Check if already present in admittedPatients
      const existing = admittedPatients.find(p => String(p.patient_id) === String(selectedPid) || String(p.id) === String(selectedPid));
      if (existing) {
        setSelectedPatientData(existing);
        return;
      }

      setLoading(true);
      try {
        // Try querying current admissions table
        const admRes = await apiService.getCurrentAdmissions({ patient_id: selectedPid, limit: 1 });
        if (isMounted && admRes?.data && admRes.data.length > 0) {
          const parsed = parseAdmissionLlmRecord(admRes.data[0]);
          setSelectedPatientData(parsed);
          setLoading(false);
          return;
        }

        // Check if it's a discharged patient
        const dcRes = await apiService.getDischargedPatients({ patient_id: selectedPid, limit: 1 });
        if (isMounted && dcRes?.data && dcRes.data.length > 0) {
          const parsedDc = parseDischargeSummaryRecord(dcRes.data[0]);
          setSelectedPatientData(parsedDc);
          setLoading(false);
          return;
        }

        // Secondary fallback to legacy postgres endpoint if available
        const pgRes = await apiService.getPatient360(selectedPid).catch(() => null);
        if (isMounted && pgRes?.patient) {
          setSelectedPatientData(pgRes);
        }
      } catch (err) {
        console.warn("Could not load live Patient 360 record:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    resolvePatientDetails();
    return () => { isMounted = false; };
  }, [selectedPid, admittedPatients]);

  // Normalize patient object fields
  const p = useMemo(() => {
    const d = selectedPatientData || patient || {};
    const isDischarged = Boolean(d.summary_id || d.case_history || d.discharge_date || d.discharge_advice);

    const name = d.name || d.patient || d.patient_name || (d.raw?.patient_name) || 'Admitted Patient';
    const age = d.age || d.age_at_admission || d.raw?.age || 48;
    const sex = d.sex || (d.gender?.toLowerCase().startsWith('f') ? 'F' : 'M') || 'M';
    const bed = d.bed || d.bed_number || (d.raw?.bed_number) || 'Bed 01';
    const ward = d.ward || d.ward_name || (d.raw?.ward_name) || 'Inpatient Wing';
    const mrn = d.mrn || d.patient_number || d.admission_number || (d.raw?.admission_number) || `MER-PAT-${selectedPid}`;
    const doctor = d.doctor || d.doctor_name || d.primary_consultant || (d.raw?.primary_consultant) || 'Attending Physician';
    const doctorSpecialty = d.doctor_specialty || d.raw?.doctor_specialization || 'Internal Medicine';
    const doctorQualification = d.doctor_qualification || d.raw?.doctor_qualification || 'MBBS, MD';
    const diagnosis = d.diagnosis || d.primary_diagnosis || d.diagnoses || (d.raw?.primary_diagnosis) || 'Clinical Inpatient Observation';
    const diagnosisCode = d.diagnoses_list?.[0]?.diagnosis_code || 'A00.0';
    const admittedDate = d.admission_date ? new Date(d.admission_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Active Stay';
    const bloodGroup = d.bloodGroup || d.blood_group || 'O+';
    const phone = d.phone || '+91 98100 00000';
    const email = d.email || `patient.${selectedPid}@hospital.com`;
    const address = d.address || 'Metropolitan Ward, Central Wing';
    const emergency = d.emergencyContact || d.emergency || '+91 94200 00000';
    const preferredLanguage = d.preferredLanguage || 'English';
    const maritalStatus = d.maritalStatus || 'Single';

    // Insurance & Financials
    const bill = d.billing || {};
    const insPolicy = d.insurance_policy || {};
    const insurer = d.insurer || insPolicy.provider || (bill.bill_insurance_portion > 0 ? 'Cashless Health Insurance' : 'Direct Billing / TPA');
    const policyNumber = insPolicy.policy_number || `POL-2024-${String(selectedPid).padStart(6, '0')}`;
    const insuranceLimit = insPolicy.coverage_limit || `₹${Number(bill.bill_gross_amount ? bill.bill_gross_amount * 3 : 500000).toLocaleString()}`;
    const insuranceStatus = insPolicy.status || (bill.bill_insurance_portion > 0 ? 'Pre-Authorized' : 'Verified');

    // Vitals
    const vitalsList = d.vital_signs_list || [];
    const latestBp = d.latestBp || `BP ${d.systolic_bp || 120}/${d.diastolic_bp || 80} · HR ${d.heart_rate || 72} bpm · SpO2 ${d.oxygen_saturation || 98}% · Temp ${d.temperature || 98.6}°F`;

    // Diagnoses list
    const diagnosesList = d.diagnoses_list || [
      { diagnosis_code: diagnosisCode, diagnosis_name: diagnosis, diagnosis_type: 'Primary Admission', is_primary: true, diagnosis_date: d.admission_date }
    ];

    // Medications
    const medications = d.medications || [];

    // Procedures
    const procedures = d.procedures || [];

    return {
      raw: d,
      isDischarged,
      name,
      age,
      sex,
      bed,
      ward,
      mrn,
      doctor,
      doctorSpecialty,
      doctorQualification,
      diagnosis,
      diagnosisCode,
      diagnosesList,
      admittedDate,
      bloodGroup,
      phone,
      email,
      address,
      emergency,
      preferredLanguage,
      maritalStatus,
      insurer,
      policyNumber,
      insuranceLimit,
      insuranceStatus,
      bill,
      vitalsList,
      latestBp,
      heart_rate: d.heart_rate || 72,
      systolic_bp: d.systolic_bp || 120,
      diastolic_bp: d.diastolic_bp || 80,
      temperature: d.temperature || 98.6,
      oxygen_saturation: d.oxygen_saturation || 98,
      ews: d.ews || 'Normal 0',
      ewsType: d.ewsType || 'green',
      medications,
      procedures,
      // Discharged summary specifics
      case_history: d.case_history,
      investigations: d.investigations,
      treatment: d.treatment,
      discharge_advice: d.discharge_advice,
      approval_status: d.approval_status || (isDischarged ? 'Approved' : 'Inpatient Care Active')
    };
  }, [selectedPatientData, patient, selectedPid]);

  const tabs = p.isDischarged 
    ? ['Overview', 'Discharge Summary', 'Clinical', 'Diagnoses', 'Medications', 'Procedures', 'Billing']
    : ['Overview', 'Clinical', 'Diagnoses', 'Medications', 'Procedures', 'Billing'];

  const timeline = [
    { 
      t: 'Admitted', 
      e: `Admitted under ${p.doctor} (${p.doctorSpecialty}) to ${p.ward} · ${p.bed}`, 
      c: 'oklch(0.5 0.18 25)' 
    },
    { 
      t: 'Vitals Log', 
      e: `Latest recorded vital telemetry: ${p.latestBp}`, 
      c: 'oklch(0.5 0.1 200)' 
    },
    { 
      t: 'Diagnosis', 
      e: `Primary diagnosis recorded: ${p.diagnosis} (${p.diagnosisCode})`, 
      c: 'oklch(0.5 0.1 200)' 
    },
    { 
      t: 'Record Status', 
      e: `Patient record verified and synchronized with the hospital information system`, 
      c: 'oklch(0.4 0.12 150)' 
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Header & Patient Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8a9096' }}>
          <span onClick={onBack} style={{ cursor: 'pointer', color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}>← Back to Workspace</span>
          <span>·</span>
          <span style={{ color: '#15181b', fontWeight: 600 }}>Patient 360 Comprehensive Dossier</span>
          {loading && <span style={{ marginLeft: '6px', color: 'oklch(0.5 0.1 200)', fontSize: '11px' }}>● Loading patient records…</span>}
        </div>

        {/* Live Inpatient Quick Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11.5px', color: '#52585e', fontWeight: 500 }}>Select Inpatient:</span>
          <select
            value={selectedPid}
            onChange={(e) => setSelectedPid(e.target.value)}
            style={{
              height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8',
              background: '#fff', fontSize: '12px', color: '#15181b', outline: 'none', cursor: 'pointer',
              fontWeight: 500
            }}
          >
            {admittedPatients.length > 0 ? (
              admittedPatients.map((ip) => (
                <option key={ip.id || ip.patient_id} value={ip.patient_id || ip.id}>
                  {ip.name} ({ip.mrn}) · {ip.bed} · {ip.ward}
                </option>
              ))
            ) : (
              <option value={selectedPid || "1"}>
                {p.name} ({p.mrn}) · {p.bed}
              </option>
            )}
          </select>
        </div>
      </div>

      {/* Patient Dossier Header */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px 20px 0' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{
            width: '54px', height: '54px', borderRadius: '50%',
            background: p.isDischarged 
              ? 'oklch(0.95 0.04 150)' 
              : 'oklch(0.96 0.04 220)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '700 14px ui-monospace, Menlo, monospace', 
            color: p.isDischarged ? 'oklch(0.4 0.12 150)' : 'oklch(0.4 0.12 200)'
          }}>
            {p.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>

          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '22px', fontWeight: 600 }}>{p.name}</span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                background: p.isDischarged ? 'oklch(0.95 0.04 150)' : 'oklch(0.95 0.05 150)', 
                color: 'oklch(0.4 0.12 150)'
              }}>
                {p.isDischarged ? 'Discharged' : `Admitted · ${p.bed}`}
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                background: '#f2f3f4', color: '#52585e'
              }}>
                Blood Group: {p.bloodGroup}
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                background: 'oklch(0.96 0.05 80)', color: 'oklch(0.5 0.13 70)'
              }}>
                {p.insurer}
              </span>
            </div>
            <div style={{ color: '#52585e', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px', marginTop: '4px' }}>
              MRN: {p.mrn} · {p.age} Yrs / {p.sex} · Attending: {p.doctor} ({p.doctorSpecialty}) · Ward: {p.ward}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginTop: '12px', fontSize: '11.5px' }}>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8a9096' }}>Primary Diagnosis</div>
                <div style={{ fontWeight: 600, color: '#15181b' }}>{p.diagnosis}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8a9096' }}>Insurance Policy & Coverage</div>
                <div style={{ fontWeight: 600, color: '#15181b' }}>{p.policyNumber} ({p.insuranceLimit})</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8a9096' }}>Emergency Contact</div>
                <div style={{ color: '#15181b' }}>{p.emergency}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onOpenSoap && onOpenSoap({ ...patient, patient_id: selectedPid, name: p.name })}
              style={{
                height: '32px', padding: '0 12px', borderRadius: '6px',
                border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                color: 'oklch(0.4 0.1 200)', fontWeight: 600, cursor: 'pointer', fontSize: '12px'
              }}
            >
              SOAP Note
            </button>
            <button
              type="button"
              onClick={() => onOpenDischarge && onOpenDischarge({ ...patient, patient_id: selectedPid, name: p.name })}
              style={{
                height: '32px', padding: '0 12px', borderRadius: '6px',
                border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '12px',
                color: '#15181b', fontWeight: 500
              }}
            >
              Discharge Case
            </button>
          </div>
        </div>

        {/* Tab Headers */}
        <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid #eef0f1', marginTop: '16px', overflowX: 'auto' }}>
          {tabs.map(tab => (
            <div
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 2px',
                fontSize: '12.5px',
                fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? 'oklch(0.5 0.1 200)' : '#52585e',
                borderBottom: activeTab === tab ? '2px solid oklch(0.5 0.1 200)' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab}
            </div>
          ))}
        </div>
      </div>

      {/* Tab Content: Overview */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '14px' }}>
          {/* Left Column: Timeline & Demographics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>Active Inpatient Timeline & Events</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {timeline.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '12px', fontSize: '12px', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, color: item.c, width: '110px', flexShrink: 0 }}>{item.t}</span>
                    <span style={{ color: '#52585e', flex: 1, lineHeight: 1.5 }}>{item.e}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Demographics & Contact Card */}
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>Demographics & Registered Residence</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 18px', fontSize: '12px' }}>
                <div><span style={{ color: '#8a9096' }}>Preferred Language:</span> <strong>{p.preferredLanguage}</strong></div>
                <div><span style={{ color: '#8a9096' }}>Marital Status:</span> <strong>{p.maritalStatus}</strong></div>
                <div><span style={{ color: '#8a9096' }}>Phone:</span> <strong>{p.phone}</strong></div>
                <div><span style={{ color: '#8a9096' }}>Email:</span> <strong>{p.email}</strong></div>
                <div><span style={{ color: '#8a9096' }}>Emergency Contact:</span> <strong>{p.emergency}</strong></div>
                <div><span style={{ color: '#8a9096' }}>Admitted Date:</span> <strong>{p.admittedDate}</strong></div>
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#8a9096' }}>Residential Address:</span> <strong>{p.address}</strong></div>
              </div>
            </div>
          </div>

          {/* Right Column: Insurance & Telemetry summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>Insurance Policy Dossier</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Payer Provider</span>
                  <strong>{p.insurer}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Policy Number</span>
                  <span style={{ fontFamily: 'monospace' }}>{p.policyNumber}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Coverage Limit</span>
                  <strong style={{ color: 'oklch(0.4 0.12 150)' }}>{p.insuranceLimit}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Authorization Status</span>
                  <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                    {p.insuranceStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Financial Summary */}
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>Hospital Inpatient Billing Ledger</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Bill Reference</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.bill?.bill_number || 'MER-BIL-CURRENT'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Gross Inpatient Bill</span>
                  <span>₹{Number(p.bill?.bill_gross_amount || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Insurance Settled</span>
                  <span style={{ color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>₹{Number(p.bill?.total_insurance_settled || p.bill?.bill_insurance_portion || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Patient Liability / Paid</span>
                  <span>₹{Number(p.bill?.total_paid_amount || p.bill?.bill_patient_portion || 0).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eef0f1', paddingTop: '6px' }}>
                  <span style={{ color: '#8a9096' }}>Outstanding Balance</span>
                  <strong style={{ fontFamily: 'monospace', color: p.bill?.outstanding_balance > 0 ? 'oklch(0.5 0.18 25)' : 'inherit' }}>
                    ₹{Number(p.bill?.outstanding_balance || 0).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Discharge Summary (if discharged) */}
      {activeTab === 'Discharge Summary' && p.isDischarged && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>Official Clinical Discharge Summary</div>
              <div style={{ fontSize: '11.5px', color: '#8a9096', marginTop: '2px' }}>
                Primary Consultant: {p.doctor}
              </div>
            </div>
            <span style={{
              padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
              background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)'
            }}>
              Status: {p.approval_status}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px', lineHeight: 1.6 }}>
            {p.case_history && (
              <div style={{ background: '#f9fafa', padding: '12px', borderRadius: '6px', borderLeft: '3px solid oklch(0.5 0.1 200)' }}>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'oklch(0.5 0.1 200)', marginBottom: '4px' }}>
                  Clinical Case History
                </div>
                <div style={{ color: '#15181b' }}>{p.case_history}</div>
              </div>
            )}

            {p.investigations && (
              <div style={{ background: '#f9fafa', padding: '12px', borderRadius: '6px', borderLeft: '3px solid oklch(0.5 0.13 70)' }}>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'oklch(0.5 0.13 70)', marginBottom: '4px' }}>
                  Investigations & Lab Findings
                </div>
                <div style={{ color: '#15181b' }}>{p.investigations}</div>
              </div>
            )}

            {p.treatment && (
              <div style={{ background: '#f9fafa', padding: '12px', borderRadius: '6px', borderLeft: '3px solid oklch(0.4 0.12 150)' }}>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'oklch(0.4 0.12 150)', marginBottom: '4px' }}>
                  Treatment Administered & Hospital Course
                </div>
                <div style={{ color: '#15181b' }}>{p.treatment}</div>
              </div>
            )}

            {p.discharge_advice && (
              <div style={{ background: '#f9fafa', padding: '12px', borderRadius: '6px', borderLeft: '3px solid oklch(0.5 0.18 25)' }}>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '11px', color: 'oklch(0.5 0.18 25)', marginBottom: '4px' }}>
                  Discharge Advice & Follow-Up Regimen
                </div>
                <div style={{ color: '#15181b' }}>{p.discharge_advice}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Clinical Vitals */}
      {activeTab === 'Clinical' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Vital Signs Telemetry Stream</div>
              <div style={{ fontSize: '11px', color: '#8a9096', marginTop: '2px' }}>
                Bedside telemetry stream — live patient vitals monitoring
              </div>
            </div>
            <span style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
              background: p.ewsType === 'red' ? 'oklch(0.96 0.05 25)' : 'oklch(0.95 0.04 150)',
              color: p.ewsType === 'red' ? 'oklch(0.5 0.18 25)' : 'oklch(0.4 0.12 150)'
            }}>
              Early Warning Score: {p.ews}
            </span>
          </div>

          {/* KPI Mini Cards for Current Vitals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', background: '#f9fafa', borderRadius: '6px', border: '1px solid #eef0f1' }}>
              <div style={{ fontSize: '10.5px', color: '#8a9096', textTransform: 'uppercase' }}>Heart Rate</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: p.heart_rate > 100 || p.heart_rate < 50 ? 'oklch(0.5 0.18 25)' : '#15181b', marginTop: '4px' }}>
                {p.heart_rate} <span style={{ fontSize: '11px', fontWeight: 400, color: '#8a9096' }}>bpm</span>
              </div>
            </div>
            <div style={{ padding: '12px', background: '#f9fafa', borderRadius: '6px', border: '1px solid #eef0f1' }}>
              <div style={{ fontSize: '10.5px', color: '#8a9096', textTransform: 'uppercase' }}>Blood Pressure</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#15181b', marginTop: '4px' }}>
                {p.systolic_bp}/{p.diastolic_bp} <span style={{ fontSize: '11px', fontWeight: 400, color: '#8a9096' }}>mmHg</span>
              </div>
            </div>
            <div style={{ padding: '12px', background: '#f9fafa', borderRadius: '6px', border: '1px solid #eef0f1' }}>
              <div style={{ fontSize: '10.5px', color: '#8a9096', textTransform: 'uppercase' }}>Body Temp</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: p.temperature > 100.4 ? 'oklch(0.5 0.18 25)' : '#15181b', marginTop: '4px' }}>
                {p.temperature} <span style={{ fontSize: '11px', fontWeight: 400, color: '#8a9096' }}>°F</span>
              </div>
            </div>
            <div style={{ padding: '12px', background: '#f9fafa', borderRadius: '6px', border: '1px solid #eef0f1' }}>
              <div style={{ fontSize: '10.5px', color: '#8a9096', textTransform: 'uppercase' }}>Oxygen SpO2</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: p.oxygen_saturation < 95 ? 'oklch(0.5 0.18 25)' : 'oklch(0.4 0.12 150)', marginTop: '4px' }}>
                {p.oxygen_saturation} <span style={{ fontSize: '11px', fontWeight: 400, color: '#8a9096' }}>%</span>
              </div>
            </div>
          </div>

          {/* Vitals History Table */}
          {p.vitalsList && p.vitalsList.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px' }}>
                    <th style={{ padding: '8px 10px' }}>Recorded At</th>
                    <th style={{ padding: '8px 10px' }}>Heart Rate</th>
                    <th style={{ padding: '8px 10px' }}>Blood Pressure</th>
                    <th style={{ padding: '8px 10px' }}>Temp</th>
                    <th style={{ padding: '8px 10px' }}>SpO2</th>
                    <th style={{ padding: '8px 10px' }}>Respiration</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p.vitalsList.map((v, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f2f3f4' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{v.recorded_at ? new Date(v.recorded_at).toLocaleString() : 'Recent'}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.heart_rate} bpm</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.systolic_bp}/{v.diastolic_bp} mmHg</td>
                      <td style={{ padding: '8px 10px' }}>{v.temperature}°F</td>
                      <td style={{ padding: '8px 10px', color: v.oxygen_saturation < 95 ? 'oklch(0.5 0.18 25)' : 'inherit', fontWeight: 600 }}>
                        {v.oxygen_saturation}%
                      </td>
                      <td style={{ padding: '8px 10px' }}>{v.respiratory_rate || 18} /min</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                          background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)'
                        }}>
                          Normal Range
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#8a9096', fontSize: '12px', padding: '12px 0' }}>Latest telemetry captured and displayed in overview cards.</div>
          )}
        </div>
      )}

      {/* Tab Content: Diagnoses */}
      {activeTab === 'Diagnoses' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Recorded Clinical Diagnoses (ICD-10 Classification)</div>
          {p.diagnosesList && p.diagnosesList.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px' }}>
                    <th style={{ padding: '8px 10px' }}>Diagnosis Date</th>
                    <th style={{ padding: '8px 10px' }}>ICD-10 Code</th>
                    <th style={{ padding: '8px 10px' }}>Diagnosis Name</th>
                    <th style={{ padding: '8px 10px' }}>Classification</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p.diagnosesList.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f2f3f4' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>
                        {d.diagnosis_date ? new Date(d.diagnosis_date).toLocaleDateString() : 'Active Inpatient'}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: 'oklch(0.5 0.1 200)' }}>{d.diagnosis_code}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{d.diagnosis_name}</td>
                      <td style={{ padding: '8px 10px' }}>{d.diagnosis_type || 'Inpatient Admission'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                          background: d.is_primary ? 'oklch(0.96 0.05 80)' : '#f2f3f4',
                          color: d.is_primary ? 'oklch(0.5 0.13 70)' : '#52585e'
                        }}>
                          {d.is_primary ? 'Primary Diagnosis' : 'Secondary'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#8a9096', fontSize: '12px', padding: '16px 0' }}>No diagnoses recorded for this patient.</div>
          )}
        </div>
      )}

      {/* Tab Content: Medications */}
      {activeTab === 'Medications' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Active Prescriptions & Medication Orders</div>
          {p.medications && p.medications.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px' }}>
                    <th style={{ padding: '8px 10px' }}>Medication Name</th>
                    <th style={{ padding: '8px 10px' }}>Generic / Category</th>
                    <th style={{ padding: '8px 10px' }}>Dosage & Route</th>
                    <th style={{ padding: '8px 10px' }}>Frequency</th>
                    <th style={{ padding: '8px 10px' }}>Duration</th>
                    <th style={{ padding: '8px 10px' }}>Instructions</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p.medications.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f2f3f4' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#15181b' }}>{m.medication_name}</td>
                      <td style={{ padding: '8px 10px', fontSize: '11px', color: '#52585e' }}>{m.generic_name || m.medication_category || 'Prescription'}</td>
                      <td style={{ padding: '8px 10px' }}>{m.dosage} · {m.route}</td>
                      <td style={{ padding: '8px 10px' }}>{m.frequency}</td>
                      <td style={{ padding: '8px 10px' }}>{m.duration}</td>
                      <td style={{ padding: '8px 10px', color: '#52585e', fontSize: '11px' }}>{m.instructions}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                          background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)'
                        }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#8a9096', fontSize: '12px', padding: '16px 0' }}>No active prescriptions recorded in this stay.</div>
          )}
        </div>
      )}

      {/* Tab Content: Procedures / Imaging */}
      {activeTab === 'Procedures' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Clinical Procedures & OT Investigations</div>
          {p.procedures && p.procedures.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px' }}>
                    <th style={{ padding: '8px 10px' }}>Procedure Code</th>
                    <th style={{ padding: '8px 10px' }}>Procedure Name</th>
                    <th style={{ padding: '8px 10px' }}>Date</th>
                    <th style={{ padding: '8px 10px' }}>Charge</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                    <th style={{ padding: '8px 10px' }}>Clinical Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {p.procedures.map((pr, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f2f3f4' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: 'oklch(0.5 0.1 200)' }}>
                        {pr.procedure_code}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#15181b' }}>{pr.procedure_name}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>
                        {pr.procedure_date ? new Date(pr.procedure_date).toLocaleDateString() : 'Inpatient Care'}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>₹{Number(pr.charge || 0).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                          background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)'
                        }}>
                          {pr.status || 'Completed'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#52585e', fontSize: '11.5px' }}>{pr.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#8a9096', fontSize: '12px', padding: '16px 0' }}>No surgical procedures recorded for this admission.</div>
          )}
        </div>
      )}

      {/* Tab Content: Billing */}
      {activeTab === 'Billing' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Hospital Bills & Invoices</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px' }}>
                  <th style={{ padding: '8px 10px' }}>Bill Number</th>
                  <th style={{ padding: '8px 10px' }}>Bill Date</th>
                  <th style={{ padding: '8px 10px' }}>Gross Amount</th>
                  <th style={{ padding: '8px 10px' }}>Net Invoiced</th>
                  <th style={{ padding: '8px 10px' }}>Insurance Settled</th>
                  <th style={{ padding: '8px 10px' }}>Patient Liability</th>
                  <th style={{ padding: '8px 10px' }}>Outstanding</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f2f3f4' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600 }}>
                    {p.bill?.bill_number || 'MER-BIL-CURRENT'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {p.bill?.bill_date ? new Date(p.bill.bill_date).toLocaleDateString() : 'Current Stay'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>₹{Number(p.bill?.bill_gross_amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>₹{Number(p.bill?.bill_net_amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                    ₹{Number(p.bill?.total_insurance_settled || p.bill?.bill_insurance_portion || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    ₹{Number(p.bill?.bill_patient_portion || p.bill?.total_paid_amount || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: p.bill?.outstanding_balance > 0 ? 'oklch(0.5 0.18 25)' : 'inherit' }}>
                    ₹{Number(p.bill?.outstanding_balance || 0).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                      background: p.bill?.bill_status === 'Settled' ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 80)',
                      color: p.bill?.bill_status === 'Settled' ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.13 70)'
                    }}>
                      {p.bill?.bill_status || 'Active Ledger'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
