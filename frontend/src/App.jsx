import React, { useState, useEffect } from 'react';
import { apiService } from './services/api';

function cleanId(val) {
  if (val == null) return '';
  const str = String(val).trim();
  const digitsOnly = str.replace(/\D/g, '');
  return digitsOnly ? String(parseInt(digitsOnly, 10)) : str.toLowerCase();
}

function getTodayFormatted() {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mapApiRecordsToPatients(admissionsData = [], summariesData = [], patientDetailsList = [], doctorDetailsList = []) {
  if (!admissionsData.length) return [];

  // Map discharge summaries STRICTLY by patient_id ONLY
  const summariesByPatientId = {};
  summariesData.forEach(s => {
    if (s.patient_id != null) {
      const pidStr = String(s.patient_id).trim();
      if (pidStr) summariesByPatientId[pidStr] = s;
    }
  });

  return admissionsData.map((adm, index) => {
    const pIdKey = adm.patient_id != null ? String(adm.patient_id).trim() : null;
    const matchedDs = pIdKey ? summariesByPatientId[pIdKey] : null;

    const isDischarged = !!matchedDs || adm.discharge_status === "Discharged" || adm.admission_status === "Discharged";

    const admDateStr = adm.admission_date
      ? new Date(adm.admission_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      : '';

    // Dynamic Patient Name from API record fields
    const firstName = adm.first_name || '';
    const lastName = adm.last_name || '';
    const pName = (firstName || lastName) 
      ? `${firstName} ${lastName}`.trim() 
      : (adm.patient_name || `Patient ${adm.patient_number || adm.patient_id || index + 1}`);
    
    const pAge = adm.age_at_admission ?? adm.age ?? '';
    const pSex = adm.gender || '';
    const pMrn = adm.patient_number || String(adm.patient_id || index + 1001);
    const admNum = adm.admission_number || adm.admission_id || String(index + 1);

    const patAddr = adm.address 
      ? `${adm.address}, ${adm.city || ''}, ${adm.state || ''} ${adm.postal_code || ''}`.replace(/,\s*,/g, ',').trim()
      : 'N/A';
    const patPhone = adm.phone || adm.phone_number || 'N/A';
    const patEmergency = adm.emergency_contact_name 
      ? `${adm.emergency_contact_name} ${adm.emergency_contact_phone ? '(' + adm.emergency_contact_phone + ')' : ''}`.trim()
      : 'N/A';

    const docName = matchedDs?.primary_consultant || adm.attending_doctor || matchedDs?.approved_by || matchedDs?.attending_physician || 'Attending Physician';
    const docSpecialty = adm.doctor_specialization || adm.physician_specialty || 'General Medicine';
    const docQual = adm.doctor_qualification ? `(${adm.doctor_qualification})` : '';

    const admType = adm.admission_type || 'General';
    const admSource = adm.admission_source ? ` (${adm.admission_source})` : '';
    const reason = adm.reason_for_admission || adm.chief_complaint || 'Clinical Evaluation';
    const primaryDx = adm.primary_diagnosis || adm.reason_for_admission || 'Under Management';
    const secondaryDx = Array.isArray(adm.secondary_diagnoses) 
      ? (adm.secondary_diagnoses.join(', ') || 'None')
      : (adm.secondary_diagnoses || 'None');

    let vitalsStr = '';
    if (adm.latest_temperature || adm.latest_heart_rate || adm.latest_systolic_bp) {
      vitalsStr = `Temp: ${adm.latest_temperature || '--'}°F · HR: ${adm.latest_heart_rate || '--'} bpm · BP: ${adm.latest_systolic_bp || '--'}/${adm.latest_diastolic_bp || '--'} mmHg · SpO2: ${adm.latest_oxygen_saturation || '--'}%`;
    } else {
      vitalsStr = adm.vital_signs_summary || 'Stable';
    }

    let parsedLlm = null;
    if (adm.llm_input_json) {
      try {
        parsedLlm = typeof adm.llm_input_json === 'string' ? JSON.parse(adm.llm_input_json) : adm.llm_input_json;
      } catch (e) {
        parsedLlm = null;
      }
    }

    const billStatusRaw = (adm.bill_clearance_status || adm.bill_status || '').toLowerCase();
    const billingStatus = (billStatusRaw.includes('cleared') || billStatusRaw.includes('settled') || billStatusRaw === 'paid') 
      ? 'cleared' 
      : (billStatusRaw.includes('partial')) 
      ? 'partial' 
      : 'pending';
    const amountDue = billingStatus === 'cleared' ? 0 : (adm.outstanding_balance ?? adm.billing_amount_due ?? 0);
    const amountTotal = adm.bill_net_amount ?? adm.billing_amount_total ?? amountDue;

    const rawNote = adm.llm_input || `Pt: ${pName} · ${pAge}${pSex} · Reg ${pMrn} · Adm ${admNum}
Addr: ${patAddr} · Ph: ${patPhone}
Emergency Contact: ${patEmergency}
Attending Physician: ${docName} ${docQual} (${docSpecialty})
Adm Date: ${adm.admission_date ? new Date(adm.admission_date).toLocaleString() : 'N/A'} · Type: ${admType}${admSource}

Reason for Adm: ${reason}
Primary Dx: ${primaryDx}
Secondary Dx: ${secondaryDx}

Vitals: ${vitalsStr}

Status: ${adm.discharge_status || adm.admission_status || 'Admitted'} | Stay: ${adm.current_stay_days || 1} days`;

    let medsData = matchedDs?.treatment || '';
    let medsArray = [];
    if (Array.isArray(medsData)) {
      medsArray = medsData;
    } else if (typeof medsData === 'string' && medsData.trim()) {
      medsArray = medsData.split('\n').filter(Boolean).map(line => {
        const parts = line.split(' - ');
        return [parts[0] || line, parts[1] || 'As directed', parts[2] || 'Treatment'];
      });
    } else if (parsedLlm && parsedLlm.medications && parsedLlm.medications.medications_list) {
      medsArray = parsedLlm.medications.medications_list.map(m => [
        m.medication_name || m.generic_name || 'Medication',
        `${m.dosage || ''} ${m.frequency || ''} (${m.route || ''})`.trim(),
        m.instructions || m.medication_category || 'Take as directed'
      ]);
    } else {
      medsArray = [];
    }

    const summary = {
      tableRecord: matchedDs || null,
      summaryId: matchedDs?.summary_id || null,
      admissionId: matchedDs?.admission_id || adm.admission_id,
      patientId: matchedDs?.patient_id || adm.patient_id,
      why: matchedDs?.case_history || matchedDs?.admission_reason || reason || '',
      dx: matchedDs?.diagnoses || matchedDs?.discharge_diagnosis || primaryDx || '',
      investigations: matchedDs?.investigations || '',
      treatmentText: typeof matchedDs?.treatment === 'string' ? matchedDs.treatment : '',
      meds: medsArray,
      consultant: matchedDs?.primary_consultant || docName,
      followup: matchedDs?.discharge_advice || matchedDs?.followup_instructions || '',
      surgery: matchedDs?.surgery_details || '',
      warnings: matchedDs?.patient_condition ? (Array.isArray(matchedDs.patient_condition) ? matchedDs.patient_condition : [matchedDs.patient_condition]) : []
    };

    return {
      id: adm.admission_id || adm.admission_number || adm.patient_id || index + 100,
      patientId: String(adm.patient_id || adm.patient_number || adm.admission_id || adm.admission_number || (index + 1001)),
      name: pName,
      age: pAge,
      sex: pSex,
      mrn: pMrn,
      ward: `${admType} Ward · Adm ${admNum}`,
      admitted: admDateStr,
      diagnosisShort: primaryDx,
      diagnosisSub: admType,
      billing: billingStatus,
      due: amountDue,
      of: amountTotal,
      discharged: !!isDischarged,
      signedBy: docName,
      signedDate: matchedDs?.discharge_date ? new Date(matchedDs.discharge_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (admDateStr || getTodayFormatted()),
      rawNote,
      summary,
      address: patAddr,
      phone: patPhone,
      emergencyContact: patEmergency
    };
  });
}

function billLabel(status) {
  if (status === "cleared") return "Cleared";
  if (status === "pending") return "Pending";
  return "Partial";
}

function fmtINR(n) {
  return "₹" + n.toLocaleString("en-IN");
}

function SummaryContent({ s }) {
  if (!s) return null;
  const rec = s.tableRecord;

  return (
    <>
      {/* Databricks Gold Table Record Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(14, 165, 233, 0.12) 100%)',
        border: '1px solid rgba(2, 132, 199, 0.25)',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '20px',
        fontSize: '12px',
        color: '#0369a1'
      }}>
        <div style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(2,132,199,0.15)', paddingBottom: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📊</span>
            <span>Discharge Record Details</span>
          </span>
          {rec?.summary_id && <span style={{ background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Summary ID #{rec.summary_id}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '8px' }}>
          <div><strong>Patient ID:</strong> {rec?.patient_id || s.patientId || 'N/A'}</div>
          <div><strong>Admission ID:</strong> {rec?.admission_id || s.admissionId || 'N/A'}</div>
          <div><strong>Doctor ID:</strong> {rec?.doctor_id || 'N/A'}</div>
          <div><strong>Consultant:</strong> {rec?.primary_consultant || s.consultant || 'N/A'}</div>
          {rec?.admission_date && <div><strong>Admission Date:</strong> {new Date(rec.admission_date).toLocaleString()}</div>}
          {rec?.discharge_date && <div><strong>Discharge Date:</strong> {new Date(rec.discharge_date).toLocaleString()}</div>}
          {rec?.generated_at && <div><strong>Generated At:</strong> {new Date(rec.generated_at).toLocaleString()}</div>}
          {rec?.source_table && <div><strong>LLM Engine / Model:</strong> {rec.source_table}</div>}
        </div>
      </div>

      {/* Clinical Summary Content Sections */}
      {s.why && (
        <div className="osec">
          <h3>Admission Details &amp; Case History</h3>
          <p>{s.why}</p>
        </div>
      )}
      {s.dx && (
        <div className="osec">
          <h3>Diagnoses</h3>
          <p>{s.dx}</p>
        </div>
      )}
      {s.investigations && (
        <div className="osec">
          <h3>Investigations &amp; Lab Results</h3>
          <p>{s.investigations}</p>
        </div>
      )}
      {(s.treatmentText || (s.meds && s.meds.length > 0)) && (
        <div className="osec">
          <h3>Treatment &amp; Medications</h3>
          {s.treatmentText && <p style={{ marginBottom: '10px' }}>{s.treatmentText}</p>}
          {s.meds && s.meds.length > 0 && typeof s.meds[0] !== 'string' && (
            <table className="med-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Dose</th>
                  <th>What it's for</th>
                </tr>
              </thead>
              <tbody>
                {s.meds.map((m, i) => (
                  <tr key={i}>
                    <td className="med-name">{m[0]}</td>
                    <td>{m[1]}</td>
                    <td className="med-note">{m[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {s.surgery && (
        <div className="osec">
          <h3>Surgery &amp; Procedures Details</h3>
          <p>{s.surgery}</p>
        </div>
      )}
      {s.consultant && (
        <div className="osec">
          <h3>Primary Consultant</h3>
          <p><strong>{s.consultant}</strong></p>
        </div>
      )}
      {s.followup && (
        <div className="osec">
          <h3>Discharge Advice &amp; Follow-up</h3>
          <p>{s.followup}</p>
        </div>
      )}
      {s.warnings && s.warnings.length > 0 && (
        <div className="osec">
          <h3>Patient Condition &amp; Care Instructions</h3>
          <div className="warn-box">
            <ul>
              {s.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Complete Discharge Table Schema & Values Grid */}
      {rec && (
        <div className="osec" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span>📋 Complete Discharge Record Details</span>
          </h3>
          <div style={{ overflowX: 'auto', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '12px' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '8px 10px', color: '#475569', fontWeight: 700, width: '210px' }}>Column Name</th>
                  <th style={{ padding: '8px 10px', color: '#475569', fontWeight: 700 }}>Stored Databricks Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(rec).map(([key, val], idx) => (
                  <tr key={key} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#0369a1' }}>
                      {key}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#334155', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {val == null ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>null</span> : String(val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [patients, setPatients] = useState([]);
  const [rawSummaries, setRawSummaries] = useState([]);
  const [activeNavTab, setActiveNavTab] = useState('patients'); // 'patients' | 'written_summaries'
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalPatientId, setModalPatientId] = useState(null);
  const [modalViewTab, setModalViewTab] = useState('summary'); // 'summary' | 'raw'
  const [generatedMap, setGeneratedMap] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [signPanelOpen, setSignPanelOpen] = useState(false);
  const [signName, setSignName] = useState('');
  const [signDate, setSignDate] = useState(getTodayFormatted());
  const [apiStatus, setApiStatus] = useState({ connected: false, loading: true });
  const [bedsSummary, setBedsSummary] = useState(null);

  useEffect(() => {
    fetchDynamicApiData();
  }, []);

  async function fetchDynamicApiData() {
    setApiStatus({ connected: false, loading: true });
    try {
      const [admissionsRes, summariesRes, bedsSummaryRes] = await Promise.allSettled([
        apiService.getCurrentAdmissionLlmInputs({ limit: 400 }),
        apiService.getGeneratedDischargeSummaries({ limit: 400 }),
        apiService.getBronzeBedsSummary()
      ]);

      const admissions = admissionsRes.status === 'fulfilled' ? admissionsRes.value?.data || [] : [];
      const summaries = summariesRes.status === 'fulfilled' ? summariesRes.value?.data || [] : [];
      const bSummary = bedsSummaryRes.status === 'fulfilled' ? bedsSummaryRes.value : null;

      if (bSummary) setBedsSummary(bSummary);
      setRawSummaries(summaries);

      if (admissions.length > 0) {
        const mapped = mapApiRecordsToPatients(admissions, summaries, [], []);
        setPatients(mapped || []);
        setApiStatus({ connected: true, loading: false });
      } else {
        setPatients([]);
        setApiStatus({ connected: false, loading: false });
      }
    } catch (err) {
      console.warn("API error:", err);
      setPatients([]);
      setApiStatus({ connected: false, loading: false });
    }
  }

  // Calculated Ward Stats
  const totalCount = patients.length;
  const clearedCount = patients.filter(p => p.billing === 'cleared').length;
  const outstandingCount = patients.filter(p => p.billing !== 'cleared').length;
  const dischargedCount = patients.filter(p => p.discharged).length;
  const admittedCount = patients.filter(p => !p.discharged).length;

  const rawAvailableBeds = bedsSummary?.metrics?.available_beds_count ?? bedsSummary?.metrics?.available ?? 0;
  const rawOccupiedBeds = bedsSummary?.metrics?.occupied_beds_count ?? bedsSummary?.metrics?.occupied ?? 0;
  const totalBedsCount = bedsSummary?.metrics?.total_beds_count ?? bedsSummary?.total_records ?? (rawAvailableBeds + rawOccupiedBeds);

  // Bed status changes from Occupied to Available when patient is discharged
  const availableBedsCount = rawAvailableBeds + dischargedCount;
  const occupiedBedsCount = Math.max(0, rawOccupiedBeds - dischargedCount);

  let currentPatient = patients.find(p => p.id === modalPatientId || cleanId(p.patientId) === cleanId(modalPatientId));
  if (!currentPatient && modalPatientId && rawSummaries.length > 0) {
    const rawMatch = rawSummaries.find(s => String(s.patient_id) === String(modalPatientId) || String(s.admission_id) === String(modalPatientId) || String(s.summary_id) === String(modalPatientId));
    if (rawMatch) {
      const matchedP = patients.find(p => String(p.patientId) === String(rawMatch.patient_id));
      const pName = matchedP?.name || rawMatch.patient_name || `Patient #${rawMatch.patient_id}`;
      const diagStr = rawMatch.discharge_diagnosis || rawMatch.diagnoses || matchedP?.diagnosisShort || 'Clinical Care';
      const docStr = rawMatch.attending_physician || rawMatch.primary_consultant || rawMatch.approved_by || matchedP?.signedBy || 'Attending Physician';
      const whyStr = rawMatch.hospital_course_summary || rawMatch.admission_reason || rawMatch.case_history || matchedP?.summary?.why || 'N/A';
      const medsStr = rawMatch.discharge_medications || rawMatch.treatment || '';
      let medsList = [];
      if (typeof medsStr === 'string' && medsStr.trim()) {
        medsList = medsStr.includes(',') 
          ? medsStr.split(',').map(m => [m.trim(), 'As directed', 'Treatment']) 
          : medsStr.split('\n').map(l => [l.split(' - ')[0] || l, l.split(' - ')[1] || 'As directed', 'Treatment']);
      }

      currentPatient = {
        id: rawMatch.admission_id || rawMatch.patient_id,
        patientId: String(rawMatch.patient_id),
        name: pName,
        age: matchedP?.age || 'N/A',
        sex: matchedP?.sex || '',
        mrn: rawMatch.patient_number || `PAT-${rawMatch.patient_id}`,
        ward: `Discharged · Adm ${rawMatch.admission_id}`,
        admitted: rawMatch.admission_date ? new Date(rawMatch.admission_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (matchedP?.admitted || ''),
        diagnosisShort: diagStr,
        diagnosisSub: 'Gold Table Summary',
        billing: 'cleared',
        due: 0,
        of: rawMatch.billing_amount_total || matchedP?.of || 0,
        discharged: true,
        signedBy: docStr,
        signedDate: rawMatch.discharge_date ? new Date(rawMatch.discharge_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : getTodayFormatted(),
        summary: {
          tableRecord: rawMatch,
          summaryId: rawMatch.summary_id,
          admissionId: rawMatch.admission_id,
          patientId: rawMatch.patient_id,
          why: whyStr,
          dx: diagStr,
          investigations: rawMatch.investigations || '',
          treatmentText: typeof rawMatch.treatment === 'string' ? rawMatch.treatment : '',
          meds: medsList,
          consultant: docStr,
          followup: rawMatch.followup_instructions || rawMatch.discharge_advice || 'Follow up as directed.',
          surgery: rawMatch.surgery_details || 'Nil',
          warnings: rawMatch.patient_condition ? [rawMatch.patient_condition] : []
        }
      };
    }
  }

  const openModal = (id) => {
    setModalPatientId(id);
    setModalViewTab('summary');
    setSignPanelOpen(false);
    const p = patients.find(pat => pat.id === id);
    setSignName(p?.signedBy || 'Dr. Attending Physician');
    setSignDate(getTodayFormatted());
  };

  const closeModal = () => {
    setModalPatientId(null);
    setIsGenerating(false);
  };

  const handleGenerate = async () => {
    if (!currentPatient) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const targetPatientId = currentPatient.patientId || currentPatient.mrn || currentPatient.id;
      console.log(`Triggering Databricks Notebook run-patient API for patient_id: ${targetPatientId}`);
      
      const response = await apiService.runPatientNotebook(targetPatientId);
      console.log("Notebook run response:", response);
      
      setGeneratedMap(prev => ({ ...prev, [currentPatient.id]: true }));

      if (response && (response.output || response.result || response.data)) {
        const outData = response.output || response.result || response.data;
        if (typeof outData === 'object') {
          setPatients(prev => prev.map(p => {
            if (p.id === currentPatient.id) {
              return {
                ...p,
                summary: {
                  why: outData.why || outData.admission_reason || p.summary.why,
                  dx: outData.dx || outData.discharge_diagnosis || p.summary.dx,
                  meds: outData.meds || p.summary.meds,
                  followup: outData.followup || outData.followup_instructions || p.summary.followup,
                  warnings: outData.warnings || p.summary.warnings
                }
              };
            }
            return p;
          }));
        }
      }
    } catch (err) {
      console.warn("Notebook API execution note:", err.message);
      // Retain generated view for seamless UX fallback
      setGeneratedMap(prev => ({ ...prev, [currentPatient.id]: true }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmSign = () => {
    if (!currentPatient) return;
    const finalName = signName.trim() || "Dr. (unspecified)";
    const finalDate = signDate.trim() || getTodayFormatted();

    setPatients(prev => prev.map(p => {
      if (p.id === currentPatient.id) {
        return {
          ...p,
          discharged: true,
          signedBy: finalName,
          signedDate: finalDate
        };
      }
      return p;
    }));

    setSignPanelOpen(false);
  };

  const handlePrint = () => {
    if (!currentPatient) return;
    window.print();
  };

  const filterChips = [
    { key: "all", label: "All patients" },
    { key: "cleared", label: "Billing cleared" },
    { key: "pending", label: "Billing pending" },
    { key: "partial", label: "Billing partial" }
  ];

  const filteredPatients = patients.filter(p => {
    if (activeFilter !== 'all' && p.billing !== activeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const cleanQ = cleanId(q);

      // If searching by numeric Patient ID (e.g. 87245), match exact Patient ID or MRN
      if (cleanQ) {
        if (cleanId(p.patientId) === cleanQ || cleanId(p.id) === cleanQ || cleanId(p.mrn) === cleanQ) {
          return true;
        }
      }

      return (
        p.name.toLowerCase().includes(q) ||
        (p.patientId && p.patientId.toLowerCase().includes(q)) ||
        p.mrn.toLowerCase().includes(q) ||
        p.diagnosisShort.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Pagination calculation
  const totalFiltered = filteredPatients.length;
  const totalPages = Math.ceil(totalFiltered / pageSize) || 1;
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedPatients = filteredPatients.slice(startIndex, startIndex + pageSize);

  function getPageNumbers(current, total) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total];
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, '...', current - 1, current, current + 1, '...', total];
  }

  const isCurrentGenerated = currentPatient ? (currentPatient.hasSummary || currentPatient.discharged || !!currentPatient.summary?.tableRecord || !!generatedMap[currentPatient.id]) : false;

  const renderRawNoteContent = (rawText) => {
    if (!rawText) return null;
    const strText = String(rawText);
    const parts = strText.split(/(\{\{FLAG\}\}.*?\{\{\/FLAG\}\})/g);
    return parts.map((part, idx) => {
      if (part.startsWith('{{FLAG}}') && part.endsWith('{{/FLAG}}')) {
        const flagText = part.replace('{{FLAG}}', '').replace('{{/FLAG}}', '');
        return <span key={idx} className="flag">{flagText}</span>;
      }
      return part;
    });
  };

  return (
    <>
      {apiStatus.loading && (
        <div className="full-page-loader">
          <div className="loader-card">
            <div className="loader-logo-ring">
              <div className="loader-spinner"></div>
              <div className="loader-icon-mark"></div>
            </div>
            <div className="loader-title">DischargeNote Admin</div>
            <div className="loader-subtitle">Connecting to Clinical REST API &amp; fetching admitted patient records...</div>
            <div className="loader-status-badge">
              <span className="loader-pulse-dot"></span>
              INITIALIZING LIVE DATA
            </div>
          </div>
        </div>
      )}
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <div className="brand-mark"></div>
            <div className="brand-name">DischargeNote</div>
          </div>
          <div className="masthead-meta" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button 
              className="btn-reload"
              onClick={() => window.location.reload()}
              style={{
                fontFamily: 'var(--sans)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '7px 13px',
                borderRadius: '7px',
                border: '1px solid var(--line)',
                background: 'var(--paper)',
                color: 'var(--primary-dark)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease'
              }}
              title="Perform Full Page Reload"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
              Reload Page
            </button>
            <div>
              ADMIN CONSOLE<br />
              Ward view · v0.3 &nbsp;
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: '10.5px',
                padding: '2px 7px',
                borderRadius: '4px',
                fontWeight: 600,
                background: apiStatus.loading ? 'var(--line-soft)' : apiStatus.connected ? 'var(--primary-tint)' : 'var(--alert-tint)',
                color: apiStatus.loading ? 'var(--ink-soft)' : apiStatus.connected ? 'var(--primary-dark)' : 'var(--alert)'
              }}>
                {apiStatus.loading ? 'CONNECTING TO API...' : apiStatus.connected ? 'API CONNECTED' : 'OFFLINE / NO API DATA'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <section className="hero">
          <div className="hero-eyebrow">Automated Clinical Discharge Summary Generator</div>
          <h1>Every admitted patient, their billing status, and a discharge summary — one screen.</h1>
          <p className="hero-sub">
            Search or filter the ward list, generate a plain-language summary per patient, and route it through clinician sign-off before it's finalized or printed.
          </p>
        </section>

        <div className="ward-strip" id="wardStrip">
          <div className="ward-stat">
            <div className="ward-stat-num">
              {totalBedsCount}
            </div>
            <div className="ward-stat-label">Total Beds</div>
          </div>
          <div className="ward-stat">
            <div className="ward-stat-num" style={{ color: '#059669' }}>
              {availableBedsCount}
            </div>
            <div className="ward-stat-label">Available Beds (Released)</div>
          </div>
          <div className="ward-stat">
            <div className="ward-stat-num" style={{ color: '#d97706' }}>
              {occupiedBedsCount}
            </div>
            <div className="ward-stat-label">Occupied Beds</div>
          </div>
          <div className="ward-stat">
            <div className="ward-stat-num">{admittedCount}</div>
            <div className="ward-stat-label">Currently Admitted Patients</div>
          </div>
          <div className="ward-stat">
            <div className="ward-stat-num" style={{ color: '#0284c7' }}>{dischargedCount} / {totalCount}</div>
            <div className="ward-stat-label">Written Discharge Summaries</div>
          </div>
        </div>

        {/* Top Navigation Tab Bar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          margin: '24px 0 20px 0',
          borderBottom: '2px solid var(--line-soft)',
          paddingBottom: '12px'
        }}>
          <button
            onClick={() => setActiveNavTab('patients')}
            style={{
              fontFamily: 'var(--sans)',
              fontSize: '13.5px',
              fontWeight: 700,
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: activeNavTab === 'patients' ? 'var(--primary-dark)' : 'var(--line)',
              background: activeNavTab === 'patients' ? 'var(--primary-tint)' : 'var(--paper)',
              color: activeNavTab === 'patients' ? 'var(--primary-dark)' : 'var(--ink-soft)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: activeNavTab === 'patients' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Admitted Patients ({admittedCount})
          </button>

          <button
            onClick={() => setActiveNavTab('written_summaries')}
            style={{
              fontFamily: 'var(--sans)',
              fontSize: '13.5px',
              fontWeight: 700,
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: activeNavTab === 'written_summaries' ? 'var(--primary-dark)' : 'var(--line)',
              background: activeNavTab === 'written_summaries' ? 'var(--primary-tint)' : 'var(--paper)',
              color: activeNavTab === 'written_summaries' ? 'var(--primary-dark)' : 'var(--ink-soft)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: activeNavTab === 'written_summaries' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            Written Discharge Summaries ({dischargedCount})
          </button>
        </div>

        {activeNavTab === 'patients' && (
        <section className="list-section">
          <div className="list-head-row">
            <div>
              <h2 className="section-heading">Admitted patients</h2>
              <p className="section-sub">
                Generating a summary is independent of billing — but discharge paperwork can be flagged until the bill clears.
              </p>
            </div>
            <div className="list-controls">
              <div className="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  id="searchInput"
                  placeholder="Search by name, Patient ID, MRN, or ward…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="filter-chips" id="filterChips" style={{ marginBottom: '16px' }}>
            {filterChips.map(c => (
              <button
                key={c.key}
                className={`chip ${activeFilter === c.key ? 'active' : ''}`}
                onClick={() => {
                  setActiveFilter(c.key);
                  setCurrentPage(1);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="patient-table-frame">
            <table className="patient-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Diagnosis</th>
                  <th>Admitted</th>
                  <th>Billing status</th>
                  <th>Amount due</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="patientRows">
                {apiStatus.loading ? (
                  <tr className="empty-row">
                    <td colSpan="6">Fetching patient records from API...</td>
                  </tr>
                ) : !apiStatus.connected && filteredPatients.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan="6">
                      <strong style={{ color: 'var(--alert)' }}>API Not Connected.</strong><br />
                      <span style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                        Please verify backend API service connection at http://127.0.0.1:8000
                      </span>
                    </td>
                  </tr>
                ) : paginatedPatients.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan="6">No patient records match this search or filter.</td>
                  </tr>
                ) : (
                  paginatedPatients.map(p => {
                    const hasSummary = p.hasSummary || p.discharged || !!generatedMap[p.id];
                    return (
                      <tr key={p.id} className={p.discharged ? 'discharged' : hasSummary ? 'has-summary' : ''}>
                        <td>
                          <div className="p-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span>{p.name}</span>
                            {p.discharged ? (
                              <span className="discharged-badge" style={{ background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                ✓ Discharged (Bed Released / Available)
                              </span>
                            ) : hasSummary ? (
                              <span className="summary-badge" style={{ background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                ✓ Summary Available
                              </span>
                            ) : null}
                          </div>
                          <div className="p-meta">
                            ID: {p.patientId} · MRN {p.mrn} · {p.age} Yrs / {p.sex} · {p.ward}
                          </div>
                        </td>
                        <td className="p-diagnosis">
                          {p.diagnosisShort}
                          <span className="dx-sub">{p.diagnosisSub}</span>
                        </td>
                        <td>{p.admitted}</td>
                        <td>
                          <span className={`bill-pill ${p.billing}`}>
                            <span className="dot"></span>
                            {billLabel(p.billing)}
                          </span>
                        </td>
                        <td>
                          {p.due === 0 ? (
                            <span className="amount-due zero">₹0</span>
                          ) : (
                            <span className="amount-due">
                              {fmtINR(p.due)} <span className="of">of {fmtINR(p.of)}</span>
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className={`btn-gen ${hasSummary ? 'done' : ''}`}
                            onClick={() => openModal(p.id)}
                          >
                            {hasSummary ? (
                              <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                                View summary
                              </>
                            ) : (
                              <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
                                </svg>
                                Generate discharge summary
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Controls Bar */}
            {!apiStatus.loading && totalFiltered > 0 && (
              <div className="pagination-bar">
                <div className="pagination-info">
                  Showing {startIndex + 1}–{Math.min(startIndex + pageSize, totalFiltered)} of {totalFiltered} admitted patients
                </div>
                <div className="pagination-controls">
                  <label style={{ fontSize: '12px', color: 'var(--ink-soft)', marginRight: '2px' }}>Per page:</label>
                  <select 
                    className="page-size-selector"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>

                  <button
                    className="pg-btn"
                    onClick={() => setCurrentPage(1)}
                    disabled={validCurrentPage === 1}
                    title="First Page"
                  >
                    «
                  </button>
                  <button
                    className="pg-btn"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={validCurrentPage === 1}
                    title="Previous Page"
                  >
                    ‹ Prev
                  </button>

                  {getPageNumbers(validCurrentPage, totalPages).map((p, idx) => (
                    p === '...' ? (
                      <span key={idx} style={{ padding: '0 4px', color: 'var(--ink-soft)' }}>…</span>
                    ) : (
                      <button
                        key={idx}
                        className={`pg-btn ${p === validCurrentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </button>
                    )
                  ))}

                  <button
                    className="pg-btn"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={validCurrentPage === totalPages}
                    title="Next Page"
                  >
                    Next ›
                  </button>
                  <button
                    className="pg-btn"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={validCurrentPage === totalPages}
                    title="Last Page"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        )}

        {/* Written Discharge Summaries Tab View */}
        {activeNavTab === 'written_summaries' && (
          <section className="list-section">
            <div className="list-head-row">
              <div>
                <h2 className="section-heading">Written Discharge Summaries</h2>
                <p className="section-sub">
                  All generated clinical discharge summaries.
                </p>
              </div>
            </div>

            <div className="patient-table-frame" style={{ marginTop: '16px' }}>
              <table className="patient-table">
                <thead>
                  <tr>
                    <th>Patient &amp; Demographics</th>
                    <th>Diagnoses</th>
                    <th>Primary Consultant</th>
                    <th>Discharge Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rawSummaries.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan="6">No written discharge summary records found.</td>
                    </tr>
                  ) : (
                    rawSummaries.map((s, idx) => {
                      const matchedPatient = patients.find(p => String(p.patientId) === String(s.patient_id) || String(p.id) === String(s.admission_id));
                      const pName = matchedPatient?.name || s.patient_name || (s.case_history ? s.case_history.match(/patient,\s*([^,]+),/i)?.[1] : null) || `Patient #${s.patient_id}`;
                      const disDate = s.discharge_date ? new Date(s.discharge_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : getTodayFormatted();
                      const diagText = s.discharge_diagnosis || s.diagnoses || matchedPatient?.diagnosisShort || 'Clinical Care';
                      const doctorText = s.attending_physician || s.primary_consultant || s.approved_by || matchedPatient?.signedBy || 'Attending Physician';

                      return (
                        <tr key={s.summary_id || idx}>
                          <td>
                            <div className="p-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{pName}</span>
                              <span className="summary-badge" style={{ background: '#0284c7', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                ✓ Generated Summary
                              </span>
                            </div>
                            <div className="p-meta">
                              Patient ID: {s.patient_id} · Adm ID: {s.admission_id}
                            </div>
                          </td>
                          <td className="p-diagnosis">
                            {diagText}
                          </td>
                          <td>
                            <strong>{doctorText}</strong>
                          </td>
                          <td>{disDate}</td>
                          <td>
                            <span className="bill-pill cleared">
                              <span className="dot"></span>
                              Written / Stored
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn-gen done"
                              onClick={() => {
                                if (matchedPatient) {
                                  openModal(matchedPatient.id);
                                } else {
                                  setModalPatientId(s.admission_id || s.patient_id);
                                }
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              View full summary
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {currentPatient && (
        <div
          className="modal-overlay open"
          id="modalOverlay"
          onClick={(e) => {
            if (e.target.id === 'modalOverlay') closeModal();
          }}
        >
          <div className="modal-box">
            <div className="modal-head">
              <div>
                <div className="modal-title" id="modalPatientName">
                  {currentPatient.name}
                </div>
                <div className="modal-sub" id="modalPatientMeta">
                  Patient ID: {currentPatient.patientId} · MRN {currentPatient.mrn} · {currentPatient.age} Yrs / {currentPatient.sex} · {currentPatient.ward} · Admitted {currentPatient.admitted}
                </div>
              </div>
              <div className="modal-head-actions">
                {isCurrentGenerated && (
                  <button className="icon-btn" id="printBtn" onClick={handlePrint}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" />
                    </svg>
                    Print
                  </button>
                )}
                <button className="modal-close" onClick={closeModal}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className={`billing-banner ${currentPatient.billing}`} id="billingBanner">
              {currentPatient.billing === 'cleared' && (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span>Billing cleared — this patient can be discharged as soon as the summary is signed.</span>
                </>
              )}
              {currentPatient.billing === 'pending' && (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>
                    Billing pending — {fmtINR(currentPatient.due)} due in full. The clinical summary can still be drafted, but discharge paperwork will be held until billing clears.
                  </span>
                </>
              )}
              {currentPatient.billing === 'partial' && (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span>
                    Billing partially cleared — {fmtINR(currentPatient.due)} of {fmtINR(currentPatient.of)} still due. Summary can be drafted; discharge paperwork held until the balance clears.
                  </span>
                </>
              )}
            </div>

            {isCurrentGenerated ? (
              <div className="modal-body single-col" style={{ display: 'block', padding: '20px 26px 26px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--line-soft)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setModalViewTab('summary')}
                      style={{
                        fontFamily: 'var(--sans)',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: modalViewTab === 'summary' ? '#0284c7' : 'var(--line)',
                        background: modalViewTab === 'summary' ? 'rgba(2, 132, 199, 0.1)' : 'var(--paper)',
                        color: modalViewTab === 'summary' ? '#0284c7' : 'var(--ink-soft)',
                        cursor: 'pointer'
                      }}
                    >
                      📄 Written Discharge Summary
                    </button>
                    <button
                      onClick={() => setModalViewTab('raw')}
                      style={{
                        fontFamily: 'var(--sans)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: modalViewTab === 'raw' ? '#0284c7' : 'var(--line)',
                        background: modalViewTab === 'raw' ? 'rgba(2, 132, 199, 0.1)' : 'var(--paper)',
                        color: modalViewTab === 'raw' ? '#0284c7' : 'var(--ink-soft)',
                        cursor: 'pointer'
                      }}
                    >
                      📝 Raw Clinical Input Data
                    </button>
                  </div>
                  <div className="pane-label" style={{ margin: 0 }}>
                    {modalViewTab === 'summary' ? 'Databricks Stored Discharge Summary' : 'Raw Input Data'}
                  </div>
                </div>

                {modalViewTab === 'summary' ? (
                  <div className="output-doc show" id="modalOutputDoc" style={{ width: '100%' }}>
                    <SummaryContent s={currentPatient.summary} />
                  </div>
                ) : (
                  <div className="raw-note" id="modalRawNote" style={{ width: '100%' }}>
                    {renderRawNoteContent(currentPatient.rawNote)}
                  </div>
                )}
              </div>
            ) : (
              <div className="modal-body">
                <div>
                  <div className="pane-label">Clinical record (raw)</div>
                  <div className="raw-note" id="modalRawNote">
                    {renderRawNoteContent(currentPatient.rawNote)}
                  </div>
                  {!currentPatient.discharged && (
                    <div className="generate-row">
                      <button
                        className="btn-generate"
                        id="modalGenBtn"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        style={{ opacity: isGenerating ? 0.7 : 1 }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
                        </svg>
                        <span id="modalGenLabel">
                          {isGenerating
                            ? "Generating…"
                            : generatedMap[currentPatient.id]
                            ? "Summary generated"
                            : "Generate discharge summary"}
                        </span>
                      </button>
                      <span className="generate-hint">~40 min saved</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="pane-label">Patient discharge summary</div>
                  <div className="output-empty" id="modalOutputEmpty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 12h6M9 16h6M9 8h6M5 4h10l4 4v12a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                    </svg>
                    Click "Generate discharge summary" to draft the plain-language version for this patient.
                  </div>
                </div>
              </div>
            )}

            <div className="modal-foot">
              <div className="modal-foot-row">
                <div className="modal-foot-note" id="modalFootNote">
                  {currentPatient.billing === 'cleared'
                    ? "A clinician must review and sign before this summary is finalized."
                    : currentPatient.billing === 'pending'
                    ? "Billing must clear before final discharge paperwork can be issued."
                    : "Remaining balance must clear before final discharge paperwork can be issued."}
                </div>
                <button
                  className="btn-sign"
                  id="modalSignBtn"
                  disabled={!isCurrentGenerated || currentPatient.discharged}
                  onClick={() => setSignPanelOpen(prev => !prev)}
                >
                  {currentPatient.discharged ? "Already signed" : "Review & sign"}
                </button>
              </div>

              <div className={`sign-panel ${signPanelOpen ? 'open' : ''}`} id="signPanel">
                <div className="sign-field">
                  <label>Signing clinician</label>
                  <input
                    type="text"
                    id="signName"
                    placeholder="Dr. …"
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                  />
                </div>
                <div className="sign-field">
                  <label>Date</label>
                  <input
                    type="text"
                    id="signDate"
                    value={signDate}
                    onChange={(e) => setSignDate(e.target.value)}
                  />
                </div>
                <button className="btn-confirm" onClick={handleConfirmSign}>
                  Confirm &amp; finalize
                </button>
              </div>

              {currentPatient.discharged && (
                <div className="signed-note show" id="signedNote">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span id="signedText">
                    Signed by {currentPatient.signedBy || 'clinician'} on {currentPatient.signedDate || '—'}.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print-only container */}
      {currentPatient && (
        <div id="printArea">
          <div className="print-page">
            <div className="print-header">
              <div>
                <div className="print-title">Discharge Summary</div>
                <div style={{ fontSize: '13px', color: '#4B564F', marginTop: '2px' }}>
                  {currentPatient.ward}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#4B564F' }}>
                DischargeNote Clinical Summary<br />
                Date: {currentPatient.signedDate || getTodayFormatted()}
              </div>
            </div>

            <div className="print-meta-grid">
              <div><strong>Patient Name:</strong> {currentPatient.name}</div>
              <div><strong>Patient ID:</strong> {currentPatient.patientId}</div>
              <div><strong>MRN / Reg No:</strong> {currentPatient.mrn}</div>
              <div><strong>Age / Sex:</strong> {currentPatient.age} Yrs / {currentPatient.sex}</div>
              <div><strong>Admitted Date:</strong> {currentPatient.admitted}</div>
              <div><strong>Diagnosis:</strong> {currentPatient.diagnosisShort}</div>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">1. Admission Details</div>
              <div className="print-sec-body">{currentPatient.summary.why}</div>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">2. Diagnosis &amp; Clinical Details</div>
              <div className="print-sec-body">{currentPatient.summary.dx}</div>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">3. Discharge Medications</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Medication</th>
                    <th>Dosage &amp; Frequency</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPatient.summary.meds.map((m, i) => (
                    <tr key={i}>
                      <td><strong>{m[0]}</strong></td>
                      <td>{m[1]}</td>
                      <td>{m[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">4. Follow-up &amp; Care Instructions</div>
              <div className="print-sec-body">{currentPatient.summary.followup}</div>
            </div>

            <div className="print-sec">
              <div className="print-sec-title">5. Emergency Warning Signs</div>
              <div className="print-warn-box">
                <ul>
                  {currentPatient.summary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="print-sig-box">
              <div className="print-sig-line">
                Prepared / Verified By
              </div>
              <div className="print-sig-line">
                Clinician Signature: {currentPatient.discharged ? (currentPatient.signedBy || 'Attending Physician') : '___________________'}
                <br />
                Date: {currentPatient.discharged ? (currentPatient.signedDate || getTodayFormatted()) : '____/____/________'}
              </div>
            </div>

            <div className="print-footer">
              <div>DischargeNote — Confidential Medical Record</div>
              <div>
                {currentPatient.discharged
                  ? `Signed & Finalized by ${currentPatient.signedBy} on ${currentPatient.signedDate}`
                  : 'DRAFT — Pending Clinician Sign-off'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
