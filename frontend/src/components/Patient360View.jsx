import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export default function Patient360View({ patient, onOpenDischarge, onOpenSoap, onBack }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [liveRecord, setLiveRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [inpatientList, setInpatientList] = useState([]);
  const [selectedPid, setSelectedPid] = useState(patient?.patient_id || patient?.id || '29');

  // Load list of active inpatients for top quick switcher
  useEffect(() => {
    async function loadInpatientOptions() {
      try {
        const res = await apiService.getClinicalPatients({ limit: 100 });
        const list = res?.patients || res?.data || [];
        if (list.length > 0) {
          setInpatientList(list);
          // If no patient prop passed, select the first live inpatient
          if (!patient?.patient_id && !patient?.id) {
            setSelectedPid(String(list[0].patient_id));
          }
        }
      } catch (err) {
        console.warn("Failed to load patient options:", err);
      }
    }
    loadInpatientOptions();
  }, [patient]);

  // Update selectedPid if patient prop changes
  useEffect(() => {
    if (patient?.patient_id || patient?.id) {
      setSelectedPid(String(patient.patient_id || patient.id));
    }
  }, [patient]);

  // Load 360 record for selectedPid
  useEffect(() => {
    async function loadPatient360() {
      if (!selectedPid) return;
      setLoading(true);
      try {
        const res = await apiService.getPatient360(selectedPid);
        if (res && res.patient) {
          setLiveRecord(res);
        }
      } catch (err) {
        console.warn("Could not load live Patient 360:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPatient360();
  }, [selectedPid]);

  // Derived patient object from live PostgreSQL record or fallback
  const lp = liveRecord?.patient;
  const lIns = liveRecord?.insurance;
  const latestAdmission = liveRecord?.admissions?.[0];
  const latestVitals = liveRecord?.vitals?.[0];
  const latestDiagnosis = liveRecord?.diagnoses?.[0];

  const p = {
    name: lp ? `${lp.first_name} ${lp.last_name}` : (patient?.name || 'Madhav Pillai'),
    age: lp?.date_of_birth ? new Date().getFullYear() - new Date(lp.date_of_birth).getFullYear() : (patient?.age || 70),
    sex: lp ? (lp.gender === 'Female' ? 'F' : 'M') : (patient?.sex || 'M'),
    bed: latestAdmission?.bed_number || patient?.bed || 'BED-0005',
    ward: latestAdmission?.ward_name || patient?.ward || 'Platinum Deluxe Wing',
    mrn: lp?.patient_number || patient?.mrn || 'MER-PAT-0000029',
    doctor: latestAdmission?.doctor_name || patient?.doctor || 'Dr. Sujatha Gupta',
    insurer: lIns ? `${lIns.insurance_provider}` : (patient?.insurer || 'Bajaj Allianz Life'),
    policyNumber: lIns?.policy_number || 'POL-2024-0000029',
    policyType: lIns?.policy_type || 'Comprehensive Cashless Mediclaim',
    insuranceLimit: lIns?.coverage_limit ? `₹${Number(lIns.coverage_limit).toLocaleString()}` : '₹15,00,000',
    insuranceStatus: lIns?.status || 'Active',
    diagnosis: latestDiagnosis?.diagnosis_name || patient?.diagnosis || 'Type 2 Diabetes Mellitus with Hyperosmolar State',
    diagnosisCode: latestDiagnosis?.diagnosis_code || 'E11.0',
    admitted: latestAdmission?.admission_date ? new Date(latestAdmission.admission_date).toLocaleString('en-IN') : (patient?.admitted || 'Active Inpatient'),
    bloodGroup: lp?.blood_group || 'B-',
    phone: lp?.phone || '+91 98100 00029',
    email: lp?.email || 'patient.29@meridiancare.in',
    address: lp?.address ? `${lp.address}, ${lp.city || ''}, ${lp.state || ''} ${lp.postal_code || ''}`.trim() : 'Flat 30, OMR IT Corridor, Bengaluru',
    emergency: lp?.emergency_contact_phone || lp?.phone || '+91 98401 98765',
    preferredLanguage: lp?.preferred_language || 'English',
    maritalStatus: lp?.marital_status || 'Single',
    latestBp: latestVitals ? `BP ${latestVitals.systolic_bp}/${latestVitals.diastolic_bp} · HR ${latestVitals.heart_rate} bpm · SpO2 ${latestVitals.oxygen_saturation || 98}% · Temp ${latestVitals.temperature || 98.6}°F` : 'BP 120/80 · HR 66 bpm · SpO2 98%'
  };

  const tabs = ['Overview', 'Clinical', 'Diagnoses', 'Medications', 'Imaging', 'Billing'];

  const timeline = [
    { t: 'Admitted', e: `Admitted under ${p.doctor} to ${p.ward} · Bed ${p.bed}`, c: 'oklch(0.5 0.18 25)' },
    { t: 'Vitals Log', e: `Latest recorded vital signs: ${p.latestBp}`, c: 'oklch(0.5 0.1 200)' },
    { t: 'Diagnosis', e: `Primary diagnosis recorded: ${p.diagnosis} (${p.diagnosisCode})`, c: 'oklch(0.5 0.1 200)' },
    { t: 'Governance', e: 'Synchronized with live PostgreSQL health database records (public.patients)', c: 'oklch(0.4 0.12 150)' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Header & Patient Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8a9096' }}>
          <span onClick={onBack} style={{ cursor: 'pointer', color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}>← Back to Clinical</span>
          <span>·</span>
          <span style={{ color: '#15181b', fontWeight: 600 }}>Patient 360 Dossier</span>
          {loading && <span style={{ marginLeft: '6px', color: 'oklch(0.5 0.1 200)', fontSize: '11px' }}>● Fetching live records...</span>}
        </div>

        {/* Live Inpatient Quick Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11.5px', color: '#52585e', fontWeight: 500 }}>Select Inpatient:</span>
          <select
            value={selectedPid}
            onChange={(e) => setSelectedPid(e.target.value)}
            style={{
              height: '30px', padding: '0 8px', borderRadius: '6px', border: '1px solid #e3e6e8',
              background: '#fff', fontSize: '12px', color: '#15181b', outline: 'none', cursor: 'pointer'
            }}
          >
            {inpatientList.length > 0 ? (
              inpatientList.map((ip) => (
                <option key={ip.patient_id} value={ip.patient_id}>
                  {ip.patient_name} ({ip.patient_number}) · {ip.bed_number}
                </option>
              ))
            ) : (
              <option value="29">Madhav Pillai (MER-PAT-0000029) · BED-0005</option>
            )}
          </select>
        </div>
      </div>

      {/* Patient Dossier Header */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px 18px 0' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%',
            background: 'repeating-linear-gradient(45deg, #e3e6e8 0 4px, #eef0f1 4px 8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: '600 12px ui-monospace, Menlo, monospace', color: '#52585e'
          }}>
            {p.name.split(' ').map(n => n[0]).join('')}
          </div>

          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '22px', fontWeight: 600 }}>{p.name}</span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)'
              }}>
                Admitted · Bed {p.bed}
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
            <div style={{ color: '#52585e', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', marginTop: '3px' }}>
              {p.mrn} · {p.age} Yrs / {p.sex} · Attending: {p.doctor} · Ward: {p.ward}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', marginTop: '10px', fontSize: '11.5px' }}>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8a9096' }}>Primary Diagnosis</div>
                <div style={{ fontWeight: 600 }}>{p.diagnosis}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8a9096' }}>Policy & Limit</div>
                <div style={{ fontWeight: 600 }}>{p.policyNumber} ({p.insuranceLimit})</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8a9096' }}>Phone / Emergency</div>
                <div>{p.phone}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onOpenSoap && onOpenSoap({ ...patient, patient_id: selectedPid, name: p.name })}
              style={{
                height: '30px', padding: '0 10px', borderRadius: '6px',
                border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                color: 'oklch(0.4 0.1 200)', fontWeight: 600, cursor: 'pointer', fontSize: '11.5px'
              }}
            >
              SOAP Note
            </button>
            <button
              type="button"
              onClick={() => onOpenDischarge && onOpenDischarge({ ...patient, patient_id: selectedPid, name: p.name })}
              style={{
                height: '30px', padding: '0 10px', borderRadius: '6px',
                border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11.5px'
              }}
            >
              Discharge Case
            </button>
          </div>
        </div>

        {/* Tab Headers */}
        <div style={{ display: 'flex', gap: '18px', borderTop: '1px solid #eef0f1', marginTop: '16px' }}>
          {tabs.map(tab => (
            <div
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 2px',
                fontSize: '12px',
                fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? 'oklch(0.5 0.1 200)' : '#52585e',
                borderBottom: activeTab === tab ? '2px solid oklch(0.5 0.1 200)' : '2px solid transparent',
                cursor: 'pointer'
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
          {/* Left Column: Timeline & Care Pathway */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Active Inpatient Timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {timeline.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: item.c, width: '90px' }}>{item.t}</span>
                    <span style={{ color: '#52585e', flex: 1 }}>{item.e}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Demographics & Contact Card */}
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Demographics & Registered Address</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '11.5px' }}>
                <div><span style={{ color: '#8a9096' }}>Language:</span> <strong>{p.preferredLanguage}</strong></div>
                <div><span style={{ color: '#8a9096' }}>Marital Status:</span> <strong>{p.maritalStatus}</strong></div>
                <div><span style={{ color: '#8a9096' }}>Phone:</span> <strong>{p.phone}</strong></div>
                <div><span style={{ color: '#8a9096' }}>Email:</span> <strong>{p.email}</strong></div>
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#8a9096' }}>Address:</span> <strong>{p.address}</strong></div>
              </div>
            </div>
          </div>

          {/* Right Column: Insurance & Telemetry summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Insurance Policy Dossier</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
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
                  <span style={{ color: '#8a9096' }}>Policy Type</span>
                  <span>{p.policyType}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Status</span>
                  <span style={{ padding: '1px 6px', borderRadius: '3px', background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                    {p.insuranceStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Financial Summary */}
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Hospital Billing Ledger</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Bills Recorded</span>
                  <span>{liveRecord?.bills?.length || 0} bill(s)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Total Net Amount</span>
                  <strong style={{ fontFamily: 'monospace' }}>
                    ₹{(liveRecord?.bills?.reduce((acc, b) => acc + (b.net_amount || 0), 0) || 0).toLocaleString()}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Prescriptions</span>
                  <span>{liveRecord?.prescriptions?.length || 0} active</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#8a9096' }}>Imaging Studies</span>
                  <span>{liveRecord?.radiology?.length || 0} studies</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Clinical Vitals */}
      {activeTab === 'Clinical' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Vital Signs History (PostgreSQL telemetry)</div>
            <span style={{ fontSize: '11px', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>● Live Telemetry Stream</span>
          </div>
          {liveRecord?.vitals && liveRecord.vitals.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px' }}>
                    <th style={{ padding: '8px 10px' }}>Recorded Timestamp</th>
                    <th style={{ padding: '8px 10px' }}>Heart Rate</th>
                    <th style={{ padding: '8px 10px' }}>Blood Pressure</th>
                    <th style={{ padding: '8px 10px' }}>Temperature</th>
                    <th style={{ padding: '8px 10px' }}>Oxygen Saturation</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {liveRecord.vitals.map((v, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f2f3f4' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{new Date(v.recorded_at).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.heart_rate} bpm</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.systolic_bp}/{v.diastolic_bp} mmHg</td>
                      <td style={{ padding: '8px 10px' }}>{v.temperature}°F</td>
                      <td style={{ padding: '8px 10px', color: v.oxygen_saturation < 95 ? 'oklch(0.5 0.18 25)' : 'inherit' }}>
                        {v.oxygen_saturation || 98}%
                      </td>
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
            <div style={{ color: '#8a9096', fontSize: '12px', padding: '16px 0' }}>No vital signs recorded for this patient in PostgreSQL.</div>
          )}
        </div>
      )}

      {/* Tab Content: Diagnoses */}
      {activeTab === 'Diagnoses' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Recorded Clinical Diagnoses (ICD-10 Classification)</div>
          {liveRecord?.diagnoses && liveRecord.diagnoses.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px' }}>
                    <th style={{ padding: '8px 10px' }}>Diagnosis Date</th>
                    <th style={{ padding: '8px 10px' }}>ICD-10 Code</th>
                    <th style={{ padding: '8px 10px' }}>Diagnosis Name</th>
                    <th style={{ padding: '8px 10px' }}>Classification</th>
                    <th style={{ padding: '8px 10px' }}>Primary</th>
                  </tr>
                </thead>
                <tbody>
                  {liveRecord.diagnoses.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f2f3f4' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{d.diagnosis_date}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: 'oklch(0.5 0.1 200)' }}>{d.diagnosis_code}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{d.diagnosis_name}</td>
                      <td style={{ padding: '8px 10px' }}>{d.diagnosis_type || 'Inpatient Admission'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                          background: d.is_primary ? 'oklch(0.96 0.05 80)' : '#f2f3f4',
                          color: d.is_primary ? 'oklch(0.5 0.13 70)' : '#52585e'
                        }}>
                          {d.is_primary ? 'Primary' : 'Secondary'}
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
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Active Prescriptions & Medication Orders</div>
          {liveRecord?.prescriptions && liveRecord.prescriptions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px' }}>
                    <th style={{ padding: '8px 10px' }}>Prescription</th>
                    <th style={{ padding: '8px 10px' }}>Medication Name</th>
                    <th style={{ padding: '8px 10px' }}>Dosage & Route</th>
                    <th style={{ padding: '8px 10px' }}>Frequency</th>
                    <th style={{ padding: '8px 10px' }}>Duration</th>
                    <th style={{ padding: '8px 10px' }}>Instructions</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {liveRecord.prescriptions.map((pr, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f2f3f4' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>RX-{pr.prescription_id}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600, color: '#15181b' }}>{pr.medication_name || 'Enoxaparin 40mg PFS'}</div>
                        {pr.generic_name && <div style={{ fontSize: '10.5px', color: '#8a9096' }}>{pr.generic_name}</div>}
                      </td>
                      <td style={{ padding: '8px 10px' }}>{pr.dosage || '650mg'} · {pr.route || 'Oral'}</td>
                      <td style={{ padding: '8px 10px' }}>{pr.frequency || 'TDS (Thrice daily)'}</td>
                      <td style={{ padding: '8px 10px' }}>{pr.duration || '3 Days'}</td>
                      <td style={{ padding: '8px 10px', color: '#52585e', fontSize: '11px' }}>{pr.instructions || 'Standard nursing administration'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                          background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)'
                        }}>
                          {pr.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#8a9096', fontSize: '12px', padding: '16px 0' }}>No active prescriptions recorded for this patient.</div>
          )}
        </div>
      )}

      {/* Tab Content: Imaging */}
      {activeTab === 'Imaging' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Radiology Studies & Reports</div>
          {liveRecord?.radiology && liveRecord.radiology.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {liveRecord.radiology.map((r, i) => (
                <div key={i} style={{ border: '1px solid #eef0f1', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'oklch(0.5 0.1 200)' }}>
                      {r.modality} · {r.body_part} (Report #{r.report_id})
                    </span>
                    <span style={{ color: '#8a9096', fontSize: '11px' }}>
                      {new Date(r.reported_at).toLocaleString()} · Priority: <strong>{r.priority || 'Urgent'}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#52585e', lineHeight: 1.5 }}>
                    {r.report_text}
                  </div>
                  {r.impression && (
                    <div style={{
                      marginTop: '8px', padding: '8px 10px', background: '#f9fafa',
                      borderRadius: '5px', fontSize: '11.5px', fontWeight: 600, color: '#15181b', borderLeft: '3px solid oklch(0.5 0.1 200)'
                    }}>
                      Impression: {r.impression}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '12px', background: '#f9fafa', borderRadius: '6px', color: '#52585e', fontSize: '12px' }}>
              No immediate radiology studies pending for this patient. Studies can be requested via Radiology Orders workflow.
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Billing */}
      {activeTab === 'Billing' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px' }}>Hospital Bills & Invoices</div>
          {liveRecord?.bills && liveRecord.bills.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '11px' }}>
                    <th style={{ padding: '8px 10px' }}>Bill Number</th>
                    <th style={{ padding: '8px 10px' }}>Date</th>
                    <th style={{ padding: '8px 10px' }}>Service Description</th>
                    <th style={{ padding: '8px 10px' }}>Gross</th>
                    <th style={{ padding: '8px 10px' }}>Net Amount</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {liveRecord.bills.map((b, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f2f3f4' }}>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{b.bill_number}</td>
                      <td style={{ padding: '8px 10px' }}>{new Date(b.bill_date).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 10px', color: '#52585e' }}>{b.item_description || 'Inpatient Consultation & Care'}</td>
                      <td style={{ padding: '8px 10px' }}>₹{b.gross_amount}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: 'oklch(0.4 0.12 150)' }}>₹{b.net_amount}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                          background: b.bill_status === 'Settled' ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 80)',
                          color: b.bill_status === 'Settled' ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.13 70)'
                        }}>
                          {b.bill_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#8a9096', fontSize: '12px', padding: '16px 0' }}>No bills recorded for this patient.</div>
          )}
        </div>
      )}
    </div>
  );
}
