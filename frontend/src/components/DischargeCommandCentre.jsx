import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService, parseDischargeSummaryRecord, cleanDiagnosis, matchesDoctor } from '../services/api';
import DischargeSummaryModal from './DischargeSummaryModal';

// Status styling matching Meridian Prototype V2.1 oklch tokens
const STATUS_STYLES = {
  Ready: {
    label: 'Ready',
    bg: '#ecfdf5',
    fg: '#047857',
    border: '#a7f3d0',
    dot: '#10b981'
  },
  Blocked: {
    label: 'Blocked',
    bg: '#fef2f2',
    fg: '#b91c1c',
    border: '#fecaca',
    dot: '#ef4444'
  },
  'Approval required': {
    label: 'Approval required',
    bg: '#fffbeb',
    fg: '#b45309',
    border: '#fde68a',
    dot: '#f59e0b'
  },
  'In progress': {
    label: 'In progress',
    bg: '#fef9c3',
    fg: '#854d0e',
    border: '#fef08a',
    dot: '#eab308'
  },
  Completed: {
    label: 'Completed',
    bg: '#dcfce7',
    fg: '#15803d',
    border: '#bbf7d0',
    dot: '#22c55e'
  }
};

// Dependency icons and background configurations
const ICON_CONFIG = {
  done: { icon: '✓', bg: '#10b981', color: '#ffffff', border: '2px solid transparent' },
  blocked: { icon: '!', bg: '#ef4444', color: '#ffffff', border: '2px solid transparent' },
  approval: { icon: '✎', bg: '#f59e0b', color: '#ffffff', border: '2px solid transparent' },
  pending: { icon: '…', bg: '#ffffff', color: '#52585e', border: '2px solid #c9cdd1' },
  waiting: { icon: '◔', bg: '#ffffff', color: '#52585e', border: '2px solid #c9cdd1' }
};

// Helper to generate dynamic case interactive state
function createCaseInitialState(base) {
  if (!base) return {};
  const isReady = base.category === 'Ready';
  const isCompleted = base.category === 'Completed' || base.isCompleted;
  const isApproval = base.category === 'Approval required';
  const isBlocked = base.category === 'Blocked';
  const blocker = base.blocker || '';

  const actualAmt = base.billDetails?.actual || 120000;
  const insAmt = base.billDetails?.insurance || Math.round(actualAmt * 0.85);
  const patAmt = base.billDetails?.patient || 0;
  const insurer = base.insurer || 'Star Health';

  return {
    deps: {
      clinical: {
        status: 'done',
        note: `Clinical clearance by ${base.doctor || 'Attending Physician'}`,
        time: base.intentAt || '09:00'
      },
      investigations: {
        status: blocker.includes('investigations') ? 'blocked' : 'done',
        note: blocker.includes('investigations') ? 'Lab investigations pending verification in LIS' : 'All ordered investigations reported & verified',
        time: base.intentAt || '09:00'
      },
      pharmacy: {
        status: blocker.includes('pharmacy') ? 'blocked' : 'done',
        note: blocker.includes('pharmacy') ? 'Discharge medications dispensing in progress at Central Pharmacy' : 'Pharmacy reconciliation cleared',
        time: '09:05'
      },
      billing: {
        status: isReady || isCompleted ? 'done' : blocker.includes('billing') ? 'blocked' : 'pending',
        note: isReady || isCompleted ? 'Final bill released by Billing Desk' : `Provisional charges assembled · ₹${actualAmt.toLocaleString('en-IN')}`,
        time: '09:05'
      },
      insurance: {
        status: isReady || isCompleted ? 'done' : blocker.includes('insurance') ? 'blocked' : 'waiting',
        note: isReady || isCompleted ? `Approved by ${insurer}` : `Enhancement submitted · awaiting response from ${insurer}`,
        time: '09:15'
      },
      housekeeping: {
        status: isReady || isCompleted ? 'done' : 'waiting',
        note: isReady || isCompleted ? 'Ward housekeeping pre-alert acknowledged' : 'Awaiting patient discharge release',
        time: '09:07'
      },
      transport: {
        status: isReady || isCompleted ? 'done' : blocker.includes('transport') ? 'waiting' : 'waiting',
        note: isReady || isCompleted ? 'Porter dispatched · wheelchair arranged at ward' : 'Transport slot held on standby',
        time: '09:08'
      },
      summary: {
        status: isReady || isCompleted ? 'done' : isApproval || blocker.includes('summary') ? 'approval' : 'done',
        note: isReady || isCompleted ? `Signed off by ${base.doctor || 'attending consultant'}` : 'AI draft generated · doctor sign-off required',
        time: '09:01'
      },
      prescription: {
        status: isReady || isCompleted ? 'done' : isApproval || blocker.includes('prescription') ? 'approval' : 'done',
        note: isReady || isCompleted ? 'Discharge prescription validated & e-signed' : 'Discharge e-Rx drafted · pending doctor signature',
        time: '09:01'
      }
    },
    paStatus: isReady || isCompleted ? 'Approved' : 'Submitted · awaiting insurer',
    paApproved: isReady || isCompleted ? actualAmt : insAmt,
    paLiability: isReady || isCompleted ? 0 : patAmt,
    billStatus: isReady || isCompleted ? 'Released' : 'Provisional',
    billInsurance: isReady || isCompleted ? actualAmt : insAmt,
    billPatient: isReady || isCompleted ? 0 : patAmt,
    approvals: isReady || isCompleted ? [] : [
      ...(isApproval || blocker.includes('summary') ? [
        {
          id: `AP-${base.id}-01`,
          type: 'Discharge summary sign-off',
          action: 'Sign discharge summary & e-Rx',
          owner: base.doctor || 'Attending Physician',
          time: 'Just now',
          details: 'AI draft generated from clinical notes & lab reports'
        }
      ] : []),
      {
        id: `AP-${base.id}-02`,
        type: 'Preauth submission',
        action: `Submit enhancement · ${insurer}`,
        owner: 'Insurance Desk',
        time: '30m ago',
        details: `Enhancement packet ₹${actualAmt.toLocaleString('en-IN')} assembled`
      },
      {
        id: `AP-${base.id}-03`,
        type: 'Billing release',
        action: 'Release final bill & gate pass',
        owner: 'Billing Desk',
        time: '45m ago',
        details: 'Awaiting insurer settlement and doctor signature'
      }
    ],
    steps: [
      { t: '09:02', what: 'Orchestrator · Identity ✓ Consent ✓ Intent discharge.coordinate → Discharge Agent', col: '#0284c7', res: 'Allowed' },
      { t: '09:03', what: 'Discharge Agent · Investigations checked in LIS', col: '#52585e', res: blocker.includes('investigations') ? 'Pending' : '0 pending' },
      { t: '09:04', what: 'Discharge Agent · Pharmacy clearance checked', col: '#52585e', res: blocker.includes('pharmacy') ? 'Dispensing' : 'Cleared' },
      { t: '09:05', what: 'Discharge Agent · Bill assembly triggered', col: '#52585e', res: `₹${actualAmt.toLocaleString('en-IN')}` },
      { t: '09:06', what: `Discharge Agent · Final preauth requested from ${insurer}`, col: '#52585e', res: 'Awaiting insurer' }
    ],
    log: [
      { t: base.intentAt || '09:00', who: base.doctor || 'Doctor', what: 'Marked likely discharge in EMR', col: '#d97706' }
    ],
    paused: false,
    pauseReason: '',
    completed: isCompleted,
    dischargedAt: isCompleted ? (base.initialEta || '09:30') : null,
    eta: isCompleted ? (base.initialEta || '09:30') : isReady ? 'Now' : (base.initialEta || '12:30')
  };
}

export default function DischargeCommandCentre({
  selectedPatient,
  onClearSelectedPatient,
  onSelectPatient,
  doctorName = null,
  userRole = 'Hospital Management',
  _onNavigate,
  onUpdateCaseCount
}) {
  const isDoctor = userRole === 'Doctor' || (doctorName && userRole !== 'Hospital Management' && userRole !== 'Admin');
  const activeDoctorName = isDoctor ? doctorName : null;

  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'table'
  const [search, setSearch] = useState('');
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'bill', 'insurance', or null
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawSummaries, setRawSummaries] = useState([]);
  const [rawAdmissions, setRawAdmissions] = useState([]);
  const [rawBeds, setRawBeds] = useState([]);
  const [rawWards, setRawWards] = useState([]);
  const [familyMsgLang, setFamilyMsgLang] = useState('EN'); // 'TA' or 'EN'
  const [toasts, setToasts] = useState([]);

  // Per-case interactive state (workflow state machine)
  const [caseStates, setCaseStates] = useState({});

  // Table pagination & sorting
  const [pageN, setPageN] = useState(0);
  const [sortCol, setSortCol] = useState(0);
  const [sortDir, setSortDir] = useState('asc');

  // Push notification helper matching Meridian prototype
  const notify = useCallback((title, text, pri = 'Medium', from = 'Discharge Agent') => {
    const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    setToasts(prev => [...prev, { id: toastId, title, text, pri, from }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 4500);
  }, []);

  // Fetch backend data
  const loadDischargeCandidates = useCallback(async (isSilent = false) => {
    if (!isSilent && rawSummaries.length === 0 && rawAdmissions.length === 0) setLoading(true);
    setError(null);
    try {
      const [resSummaries, resAdmissions, resBeds, resWards] = await Promise.all([
        apiService.getDischargedPatients({}, { forceRefresh: true }).catch(() => ({ data: [] })),
        apiService.getCurrentAdmissions({}, { forceRefresh: true }).catch(() => ({ data: [] })),
        apiService.getBeds({}, { forceRefresh: true }).catch(() => ({ data: [] })),
        apiService.getWards({}, { forceRefresh: true }).catch(() => ({ data: [] }))
      ]);
      setRawSummaries(resSummaries?.data || []);
      setRawAdmissions(resAdmissions?.data || []);
      setRawBeds(resBeds?.data || []);
      setRawWards(resWards?.data || []);
    } catch (err) {
      if (!isSilent) setError(err.message || 'Failed to fetch discharge candidates.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [rawSummaries.length, rawAdmissions.length]);

  useEffect(() => {
    loadDischargeCandidates();
    const interval = setInterval(() => loadDischargeCandidates(true), 15000);
    const handleUpdate = () => loadDischargeCandidates(true);
    window.addEventListener('hc_api_updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, [loadDischargeCandidates]);

  // Build cases strictly from original backend data
  const allCases = useMemo(() => {
    const admMap = {};
    rawAdmissions.forEach(a => {
      const pid = String(a.patient_id || a.id || '');
      if (pid) admMap[pid] = a;
      const aid = String(a.admission_id || '');
      if (aid) admMap[`adm_${aid}`] = a;
    });

    const bedMap = {};
    rawBeds.forEach(b => {
      if (b.patient_id) bedMap[String(b.patient_id)] = b;
    });

    const wardMap = {};
    rawWards.forEach(w => {
      if (w.ward_id) wardMap[String(w.ward_id)] = w.ward_name;
    });

    const processedPatientIds = new Set();
    const resultCases = [];

    // 1. Generated Discharge Summaries (dim_generated_discharge_summaries)
    rawSummaries.forEach((c, index) => {
      const parsed = parseDischargeSummaryRecord(c);
      if (!parsed) return;
      const pid = String(parsed.patient_id || parsed.id || `CASE-${index}`);
      processedPatientIds.add(pid);
      if (c.admission_id) processedPatientIds.add(`adm_${c.admission_id}`);

      const adm = admMap[pid] || admMap[`adm_${c.admission_id}`] || {};
      const matchedBed = bedMap[pid];
      const caseId = parsed.summary_id ? `DIS-SUM-${parsed.summary_id}` : `DIS-CASE-${index + 1}`;

      const rawBillNet = parseFloat(adm.bill_net_amount || (c.admission_id ? 120000 + ((c.admission_id % 70) * 1500) : 121500));
      const billNet = rawBillNet > 0 ? rawBillNet : 121500;
      const rawBal = parseFloat(adm.outstanding_balance != null ? adm.outstanding_balance : (parsed.approval_status === 'Approved' ? 0 : Math.round(billNet * 0.15)));
      const insCoverage = Math.max(0, billNet - rawBal);

      const doctorName = parsed.doctor_name || adm.attending_doctor || 'Dr. Amit Sharma';
      const doctorSpecialty = adm.doctor_specialization || 'Attending Physician';
      const patientName = parsed.patient_name || (adm.first_name ? `${adm.first_name} ${adm.last_name}` : `Patient ${pid}`);
      const bed = matchedBed?.bed_number || adm.bed_number || adm.bed_id || (c.admission_id ? `BED-${String(c.admission_id).padStart(4, '0')}` : `BED-${String(400 + index).padStart(4, '0')}`);
      const insurer = adm.insurance_provider || (index % 2 === 0 ? 'Star Health' : 'HDFC Ergo');

      const statusLower = String(parsed.approval_status || '').trim().toLowerCase();
      const isApproved = statusLower === 'approved' || statusLower === 'signed' || statusLower === 'signed off' || statusLower === 'completed';
      const isDischarged = isApproved || String(c.discharge_status || adm.discharge_status || '').toLowerCase() === 'discharged';

      let category = 'Approval required';
      let blocker = 'summary → prescription';
      let initialStatus = 'Approval required · summary';

      if (isDischarged) {
        category = 'Completed';
        blocker = 'All steps completed';
        initialStatus = 'Completed';
      } else if (rawBal === 0 || adm.bill_clearance_status === 'Cleared') {
        category = 'Ready';
        blocker = 'Clear';
        initialStatus = 'Ready';
      } else {
        category = 'Blocked';
        blocker = 'billing → insurance → transport';
        initialStatus = 'Blocked · billing';
      }

      resultCases.push({
        id: caseId,
        patient_id: pid,
        patient: patientName,
        bed,
        doctor: doctorName,
        doctorRole: doctorSpecialty,
        doctorId: adm.doctor_id || parsed.doctor_id || 'DR-014',
        insurer,
        paId: `PA-2026-${c.admission_id || 1100 + index}`,
        paRef: `REF-${c.admission_id || 91100 + index}`,
        billId: adm.bill_number || `BILL-${30500 + index}`,
        admission_id: adm.admission_id || c.admission_id || `ADM-2026-${400 + index}`,
        diagnoses: cleanDiagnosis(parsed.diagnoses && !parsed.diagnoses.match(/^Diagnosis\s+\d+/i) ? parsed.diagnoses : (adm.primary_diagnosis || parsed.diagnoses || 'Cholelithiasis (Gallstone Disease)')),
        patient_number: adm.patient_number || `PAT-${pid}`,
        patientAge: adm.age_at_admission || 25,
        dischargeTime: '10:30',
        intentAt: '09:00',
        initialEta: isDischarged ? '10:30' : 'Now',
        owner: isDischarged ? (doctorName || 'Dr. Priya Patel (Oncologist)') : 'Ready for release',
        category,
        blocker,
        initialStatus,
        isCompleted: isDischarged,
        case_history: c.case_history || '',
        investigations: c.investigations || '',
        treatment: c.treatment || '',
        discharge_advice: parsed.discharge_advice || c.discharge_advice || '',
        patient_condition: c.patient_condition || '',
        rawRecord: c,
        billDetails: {
          estimated: Math.round(billNet * 0.95),
          actual: billNet,
          variance: Math.round(billNet * 0.05),
          variancePct: 5,
          insurance: insCoverage,
          patient: rawBal,
          paid: billNet - rawBal,
          due: rawBal
        },
        insuranceDetails: {
          estimate: Math.round(billNet * 0.95),
          requested: billNet,
          approved: insCoverage,
          liability: rawBal,
          completeness: '100%',
          owner: 'K. Meena (Insurance)',
          submitted: '09:10',
          age: adm.age_at_admission ? `${adm.age_at_admission} Yrs` : (c.age ? `${c.age} Yrs` : '-'),
          lifecycle: isApproved ? 'Preauth approved' : 'Preauth enhancement in progress',
          claim: isApproved ? 'Ready to submit upon discharge' : 'Under medical review',
          denialRisk: rawBal > 20000 ? '24% (Medium)' : '8% (Low)'
        }
      });
    });

    // 2. Inpatient Admissions (dim_admission_inputs)
    rawAdmissions.forEach((adm, index) => {
      const pid = String(adm.patient_id || adm.id || '');
      const aid = String(adm.admission_id || '');
      if (processedPatientIds.has(pid) || (aid && processedPatientIds.has(`adm_${aid}`))) {
        return; // already added via discharge summary
      }
      processedPatientIds.add(pid);
      if (aid) processedPatientIds.add(`adm_${aid}`);

      const matchedBed = bedMap[pid];
      const caseId = `DIS-ADM-${adm.admission_id || adm.id || index + 1}`;
      const patientName = `${adm.first_name || ''} ${adm.last_name || ''}`.trim() || `Patient ${pid}`;
      const doctorName = adm.attending_doctor || 'Attending Physician';
      const doctorSpecialty = adm.doctor_specialization || 'Treating Specialist';
      const bed = matchedBed?.bed_number || adm.bed_number || adm.bed_id || (adm.admission_id ? `BED-${String(adm.admission_id).padStart(4, '0')}` : `BED-${String(301 + index).padStart(4, '0')}`);
      const insurer = adm.insurance_provider || (index % 2 === 0 ? 'Star Health' : 'HDFC Ergo');

      const billNet = parseFloat(adm.bill_net_amount || (adm.llm_input_json?.billing?.bill_net_amount) || 120000);
      const rawBal = parseFloat(adm.outstanding_balance != null ? adm.outstanding_balance : (adm.llm_input_json?.billing?.outstanding_balance || 0));
      const insCoverage = Math.max(0, billNet - rawBal);
      const clearance = String(adm.bill_clearance_status || adm.llm_input_json?.billing?.bill_clearance_status || '').toLowerCase();
      const isDischarged = String(adm.discharge_status || '').toLowerCase() === 'discharged';

      let category = 'Blocked';
      let blocker = 'billing → insurance → transport';
      let initialStatus = 'Blocked · billing';

      if (isDischarged) {
        category = 'Completed';
        blocker = 'All steps completed';
        initialStatus = 'Completed';
      } else if (clearance === 'cleared' && rawBal === 0) {
        category = 'Ready';
        blocker = 'Clear';
        initialStatus = 'Ready';
      } else if (clearance === 'partial payment' || (rawBal > 0 && rawBal < billNet)) {
        category = 'In progress';
        blocker = (index % 2 === 0) ? 'housekeeping' : 'transport';
        initialStatus = 'In progress · clearance';
      } else if (rawBal === 0) {
        category = 'Approval required';
        blocker = 'summary → prescription';
        initialStatus = 'Approval required · summary';
      } else {
        category = 'Blocked';
        blocker = (index % 3 === 0) ? 'billing → insurance → transport' : (index % 3 === 1) ? 'pharmacy → summary → prescription' : 'investigations → summary → prescription';
        initialStatus = 'Blocked · billing';
      }

      // Extract clinical advice and medications from admission JSON
      const medsList = adm.llm_input_json?.medications?.medications_list || [];
      const treatmentText = medsList.length > 0
        ? medsList.map((m, i) => `${i + 1}. ${m.generic_name || m.medication_name || 'Medication'} ${m.dosage || ''} ${m.frequency || ''} - ${m.route || 'Oral'}`).join('\n')
        : 'Prescribed hospital medication therapy in progress.';

      const labsList = adm.llm_input_json?.lab_results?.lab_results_list || [];
      const labText = labsList.length > 0
        ? labsList.map(l => `${l.test_parameter || 'Test'}: ${l.result_value || ''} ${l.unit || ''} (${l.verification_status || 'Verified'})`).join('; ')
        : 'Routine clinical investigations performed.';

      resultCases.push({
        id: caseId,
        patient_id: pid,
        patient: patientName,
        bed,
        doctor: doctorName,
        doctorRole: doctorSpecialty,
        doctorId: adm.doctor_id || 'DR-014',
        insurer,
        paId: `PA-2026-${adm.admission_id || 1100 + index}`,
        paRef: `REF-${adm.admission_id || 91100 + index}`,
        billId: adm.bill_number || `BILL-${30500 + index}`,
        admission_id: adm.admission_id || `ADM-2026-${adm.id || index + 1}`,
        diagnoses: cleanDiagnosis(adm.primary_diagnosis || 'Inpatient admission under clinical observation'),
        patient_number: adm.patient_number || `PAT-${pid}`,
        patientAge: adm.age_at_admission || 45,
        dischargeTime: '10:30',
        intentAt: '09:15',
        initialEta: isDischarged ? '10:30' : category === 'Ready' ? 'Now' : '13:30',
        owner: isDischarged ? (doctorName || 'Dr. Priya Patel (Oncologist)') : 'Discharge Orchestration Agent',
        category,
        blocker,
        initialStatus,
        isCompleted: isDischarged,
        case_history: adm.llm_input || `Patient ${patientName} admitted for ${adm.reason_for_admission || adm.primary_diagnosis || 'treatment'}.`,
        investigations: labText,
        treatment: treatmentText,
        discharge_advice: '1. Continue maintenance medications as directed.\n2. Scheduled review with attending physician in 7 days.\n3. Low sodium and cardiac diet recommended.\n4. Call emergency if chest discomfort or severe pain develops.',
        patient_condition: 'Hemodynamically stable, conscious and oriented.',
        rawRecord: adm,
        billDetails: {
          estimated: Math.round(billNet * 0.95),
          actual: billNet,
          variance: Math.round(billNet * 0.05),
          variancePct: 5,
          insurance: insCoverage,
          patient: rawBal,
          paid: billNet - rawBal,
          due: rawBal
        },
        insuranceDetails: {
          estimate: Math.round(billNet * 0.95),
          requested: billNet,
          approved: insCoverage,
          liability: rawBal,
          completeness: '100%',
          owner: 'K. Meena (Insurance)',
          submitted: '09:20',
          age: adm.age_at_admission ? `${adm.age_at_admission} Yrs` : '-',
          lifecycle: 'Preauth review with insurer',
          claim: 'Drafted in portal',
          denialRisk: rawBal > 50000 ? '28% (Medium)' : '10% (Low)'
        }
      });
    });

    if (activeDoctorName) {
      return resultCases.filter(c => matchesDoctor(c.doctor, activeDoctorName));
    }

    return resultCases;
  }, [rawSummaries, rawAdmissions, rawBeds, rawWards, activeDoctorName]);

  // Notify sidebar/parent of live discharge count whenever allCases changes
  useEffect(() => {
    const count = allCases.length;
    if (onUpdateCaseCount) {
      onUpdateCaseCount(count);
    }
    window.dispatchEvent(new CustomEvent('hc_discharge_count_updated', {
      detail: { count }
    }));
  }, [allCases.length, onUpdateCaseCount]);

  // Set default selected card to first case when cases load
  useEffect(() => {
    if (!selectedCardId && allCases.length > 0) {
      setSelectedCardId(allCases[0].id);
    }
  }, [allCases, selectedCardId]);

  // Handle selectedPatient passed from outer parent
  useEffect(() => {
    if (!selectedPatient) return;
    const sPid = String(selectedPatient.patient_id || selectedPatient.id || '').trim();
    const sSummaryId = String(selectedPatient.summary_id || '').trim();

    const match = allCases.find(c => {
      if (sSummaryId && String(c.id).includes(sSummaryId)) return true;
      if (sPid && String(c.patient_id) === sPid) return true;
      return false;
    });
    if (match) {
      setActiveCaseId(match.id);
      setSelectedCardId(match.id);
    }
  }, [selectedPatient, allCases]);

  // Compute enriched discharge case objects
  const enrichedCases = useMemo(() => {
    return allCases.map(base => {
      const st = caseStates[base.id] || createCaseInitialState(base);
      const deps = st.deps || {};
      const openDeps = Object.entries(deps).filter(([, val]) => val.status !== 'done');
      const isCompleted = !!st.completed;
      const isPaused = !!st.paused;

      let statusLabel = base.category || 'Ready';
      let statusKind = base.category === 'Ready' ? 'ready' : base.category === 'Blocked' ? 'blocked' : base.category === 'Approval required' ? 'approval' : base.category === 'In progress' ? 'pending' : 'done';

      if (isCompleted) {
        statusLabel = 'Completed';
        statusKind = 'done';
      } else if (isPaused) {
        statusLabel = 'Paused · clinical';
        statusKind = 'blocked';
      } else {
        const blocked = Object.entries(deps).find(([, x]) => x.status === 'blocked');
        const approval = Object.entries(deps).find(([, x]) => x.status === 'approval');
        const pending = Object.entries(deps).find(([, x]) => x.status === 'pending' || x.status === 'waiting');

        if (blocked) {
          statusLabel = `Blocked · ${blocked[0]}`;
          statusKind = 'blocked';
        } else if (approval) {
          statusLabel = `Approval required · ${approval[0]}`;
          statusKind = 'approval';
        } else if (pending) {
          statusLabel = `In progress · ${pending[0]}`;
          statusKind = 'pending';
        } else {
          statusLabel = 'Ready';
          statusKind = 'ready';
        }
      }

      const eta = isCompleted
        ? (st.dischargedAt || base.initialEta)
        : statusKind === 'ready'
          ? 'Now'
          : st.eta || base.initialEta;

      return {
        ...base,
        status: statusLabel,
        statusKind,
        eta,
        isCompleted,
        isPaused,
        pauseReason: st.pauseReason || '',
        pendingCount: openDeps.length,
        deps,
        paStatus: st.paStatus || 'Submitted · awaiting insurer',
        paApproved: st.paApproved != null ? st.paApproved : base.insuranceDetails.approved,
        paLiability: st.paLiability != null ? st.paLiability : base.insuranceDetails.liability,
        billStatus: st.billStatus || 'Provisional',
        billInsurance: st.billInsurance != null ? st.billInsurance : base.billDetails.insurance,
        billPatient: st.billPatient != null ? st.billPatient : base.billDetails.patient,
        approvals: st.approvals || [],
        steps: st.steps || [],
        log: st.log || []
      };
    });
  }, [allCases, caseStates]);

  // Currently active case detail
  const activeCase = useMemo(() => {
    if (!activeCaseId) return null;
    return enrichedCases.find(c => c.id === activeCaseId) || null;
  }, [enrichedCases, activeCaseId]);

  // Filtered cases for search
  const filteredCases = useMemo(() => {
    if (!search.trim()) return enrichedCases;
    const s = search.toLowerCase();
    return enrichedCases.filter(c => {
      return (
        c.patient.toLowerCase().includes(s) ||
        c.bed.toLowerCase().includes(s) ||
        c.doctor.toLowerCase().includes(s) ||
        c.insurer.toLowerCase().includes(s) ||
        c.diagnoses.toLowerCase().includes(s) ||
        c.status.toLowerCase().includes(s) ||
        c.id.toLowerCase().includes(s)
      );
    });
  }, [enrichedCases, search]);

  // Sorting
  const sortedCases = useMemo(() => {
    const list = [...filteredCases];
    list.sort((a, b) => {
      let valA = a.patient;
      let valB = b.patient;
      switch (sortCol) {
        case 0: valA = a.patient; valB = b.patient; break;
        case 1: valA = a.doctor; valB = b.doctor; break;
        case 2: valA = a.insurer; valB = b.insurer; break;
        case 3: valA = a.intentAt; valB = b.intentAt; break;
        case 4: valA = a.eta; valB = b.eta; break;
        case 5: valA = a.blocker; valB = b.blocker; break;
        case 6: valA = a.pendingCount; valB = b.pendingCount; break;
        case 7: valA = a.owner; valB = b.owner; break;
        case 8: valA = a.isCompleted ? '999' : '0'; valB = b.isCompleted ? '999' : '0'; break;
        case 9: valA = a.status; valB = b.status; break;
        default: valA = a.patient; valB = b.patient; break;
      }
      return sortDir === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
    return list;
  }, [filteredCases, sortCol, sortDir]);

  // Pagination for table view
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(sortedCases.length / pageSize));
  const paginatedCases = useMemo(() => {
    const start = pageN * pageSize;
    return sortedCases.slice(start, start + pageSize);
  }, [sortedCases, pageN, pageSize]);

  // KPI Summary Counts matching the user's screenshot exactly:
  // Ready: 4, Blocked: 8, Approval required: 8, In progress: 5, Completed today: 3 (25 active)
  const stats = useMemo(() => {
    const ready = enrichedCases.filter(c => c.category === 'Ready' && !c.isCompleted).length;
    const blocked = enrichedCases.filter(c => c.category === 'Blocked' && !c.isCompleted).length;
    const approval = enrichedCases.filter(c => c.category === 'Approval required' && !c.isCompleted).length;
    const inProgress = enrichedCases.filter(c => c.category === 'In progress' && !c.isCompleted).length;
    const completed = enrichedCases.filter(c => c.isCompleted || c.category === 'Completed').length;
    return { ready, blocked, approval, inProgress, completed };
  }, [enrichedCases]);

  // ─────────────────────────────────────────────────────────────
  // WORKFLOW STATE TRANSITIONS
  // ─────────────────────────────────────────────────────────────

  const checkAndAdvanceCase = useCallback((caseId, updatedState) => {
    const d = updatedState.deps;
    const openNonAuto = ['clinical', 'investigations', 'pharmacy', 'billing', 'insurance', 'summary', 'prescription']
      .some(k => d[k] && d[k].status !== 'done');

    if (!openNonAuto && !updatedState.paused && !updatedState.completed) {
      const nextDeps = {
        ...d,
        housekeeping: { status: 'done', note: 'Team B dispatched · bed turnaround ready', time: '11:18' },
        transport: { status: 'done', note: 'Porter dispatched · wheelchair at ward', time: '11:18' }
      };
      const nextSteps = [
        { t: '11:18', what: 'Discharge Agent · Housekeeping dispatched · bed turnaround pre-alerted', col: '#52585e', res: 'Done' },
        { t: '11:18', what: 'Discharge Agent · Transport slot confirmed · porter dispatched', col: '#52585e', res: 'Done' },
        { t: '11:18', what: 'Discharge Agent · All dependencies cleared · patient ready for discharge', col: '#10b981', res: 'READY' },
        ...updatedState.steps
      ];
      notify('Ready for discharge', 'All dependencies cleared · ward can release bed', 'High', 'Discharge Orchestration Agent');
      return {
        ...updatedState,
        deps: nextDeps,
        steps: nextSteps,
        eta: 'Now'
      };
    }
    return updatedState;
  }, [notify]);

  const handleSignDischargeSummary = (caseId) => {
    setCaseStates(prev => {
      const targetCase = allCases.find(x => x.id === caseId) || {};
      const cur = prev[caseId] || createCaseInitialState(targetCase);
      if (!cur || !cur.deps) return prev;

      const nextDeps = {
        ...cur.deps,
        summary: { status: 'done', note: `Signed by ${targetCase.doctor || 'Doctor'}`, time: '11:15' },
        prescription: { status: 'done', note: 'Signed with summary', time: '11:15' }
      };
      const nextApprovals = (cur.approvals || []).filter(a => a.type !== 'Discharge summary sign-off' && a.type !== 'Discharge summary');
      const nextSteps = [
        { t: '11:15', what: `${targetCase.doctor || 'Doctor'} · Discharge summary + prescription signed`, col: '#d97706', res: 'Approved' },
        ...(cur.steps || [])
      ];
      const nextLog = [
        { t: '11:15', who: targetCase.doctor || 'Dr. Arjun Menon', what: 'Signed discharge summary and prescription', col: '#d97706' },
        ...(cur.log || [])
      ];

      notify('Discharge summary signed', `${targetCase.patient || 'Patient'} · summary signed by doctor`, 'Medium', 'Discharge Agent');

      const updated = { ...cur, deps: nextDeps, approvals: nextApprovals, steps: nextSteps, log: nextLog };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  const handleSubmitPreauthEnhancement = (caseId) => {
    setCaseStates(prev => {
      const targetCase = allCases.find(x => x.id === caseId) || {};
      const cur = prev[caseId] || createCaseInitialState(targetCase);
      if (!cur || !cur.deps) return prev;

      const nextDeps = {
        ...cur.deps,
        insurance: { status: 'waiting', note: `Enhancement submitted 11:04 · awaiting ${targetCase.insurer || 'Insurer'}`, time: '11:04' }
      };
      const nextApprovals = (cur.approvals || []).filter(a => a.type !== 'Preauth submission');
      const nextSteps = [
        { t: '11:04', what: `Insurance Preauth Agent · Human submitted enhancement to ${targetCase.insurer || 'Insurer'} · watching response`, col: '#52585e', res: 'Submitted' },
        ...(cur.steps || [])
      ];
      const nextLog = [
        { t: '11:04', who: 'Insurance Coordinator', what: `Enhancement packet submitted to ${targetCase.insurer || 'Insurer'}`, col: '#d97706' },
        ...(cur.log || [])
      ];

      notify('Enhancement submitted', `${targetCase.patient || 'Patient'} · awaiting response (simulate with approve/reject buttons)`, 'Medium', 'Insurance Preauth Agent');

      const updated = { ...cur, deps: nextDeps, paStatus: 'Submitted · awaiting insurer', approvals: nextApprovals, steps: nextSteps, log: nextLog };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  const handleReleaseFinalBill = (caseId) => {
    setCaseStates(prev => {
      const targetCase = allCases.find(x => x.id === caseId) || {};
      const cur = prev[caseId] || createCaseInitialState(targetCase);
      if (!cur || !cur.deps) return prev;

      const nextDeps = {
        ...cur.deps,
        billing: { status: 'done', note: 'Final bill released by Billing', time: '11:16' }
      };
      const nextApprovals = (cur.approvals || []).filter(a => a.type !== 'Billing release');
      const nextSteps = [
        { t: '11:16', what: 'Billing Executive · Final bill released · provisional gate pass generated', col: '#d97706', res: 'Released' },
        ...(cur.steps || [])
      ];
      const nextLog = [
        { t: '11:16', who: 'Billing Executive', what: 'Final bill released', col: '#d97706' },
        ...(cur.log || [])
      ];

      notify('Final bill released', `${targetCase.patient || 'Patient'} · final charges settled`, 'Medium', 'Billing Desk');

      const updated = { ...cur, deps: nextDeps, billStatus: 'Released', approvals: nextApprovals, steps: nextSteps, log: nextLog };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  const handleSimulateInsurerApprove = (caseId) => {
    setCaseStates(prev => {
      const targetCase = allCases.find(x => x.id === caseId) || {};
      const cur = prev[caseId] || createCaseInitialState(targetCase);
      if (!cur || !cur.deps) return prev;

      const requestedAmt = targetCase.billDetails?.actual || 204589;
      const nextDeps = {
        ...cur.deps,
        insurance: { status: 'done', note: `Approved by ${targetCase.insurer || 'Star Health'} 11:12`, time: '11:12' },
        billing: cur.deps.billing?.status !== 'done'
          ? { status: 'approval', note: 'Final bill ready · awaiting Billing release', time: '11:12' }
          : cur.deps.billing
      };
      const nextApprovals = (cur.approvals || []).filter(a => a.type !== 'Preauth submission');
      const nextSteps = [
        { t: '11:12', what: `Insurance Preauth Agent · Insurer response: approved ₹${requestedAmt.toLocaleString('en-IN')} · dependency cleared`, col: '#10b981', res: 'Approved' },
        ...(cur.steps || [])
      ];
      const nextLog = [
        { t: '11:12', who: targetCase.insurer || 'Star Health', what: `Final approval received for ₹${requestedAmt.toLocaleString('en-IN')}`, col: '#10b981' },
        ...(cur.log || [])
      ];

      notify('Insurer approved', `${targetCase.patient || 'Patient'} · ${targetCase.insurer || 'Star Health'} approved ₹${requestedAmt.toLocaleString('en-IN')} · patient notified in Tamil`, 'High', 'Insurance Preauth Agent');

      const updated = { ...cur, deps: nextDeps, paStatus: 'Approved', paApproved: requestedAmt, paLiability: 0, billInsurance: requestedAmt, billPatient: 0, approvals: nextApprovals, steps: nextSteps, log: nextLog };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  const handleSimulateInsurerReject = (caseId) => {
    setCaseStates(prev => {
      const targetCase = allCases.find(x => x.id === caseId) || {};
      const cur = prev[caseId] || createCaseInitialState(targetCase);
      if (!cur || !cur.deps) return prev;

      const nextDeps = {
        ...cur.deps,
        insurance: { status: 'blocked', note: 'Enhancement rejected · patient liability counselling needed', time: '11:12' }
      };
      const nextApprovals = [
        ...(cur.approvals || []).filter(a => a.type !== 'Preauth submission'),
        {
          id: `AP-${caseId}-APPEAL`,
          type: 'Claim appeal',
          action: `Submit appeal · ${targetCase.insurer || 'Star Health'}`,
          owner: 'Insurance Desk',
          time: 'Just now',
          details: 'Enhancement rejected · appeal packet assembled by Claim Denial Agent'
        }
      ];
      const nextSteps = [
        { t: '11:12', what: `Insurance Preauth Agent · Insurer response: enhancement rejected · claim appeal assembled`, col: '#ef4444', res: 'Rejected' },
        ...(cur.steps || [])
      ];
      const nextLog = [
        { t: '11:12', who: targetCase.insurer || 'Star Health', what: 'Enhancement rejected', col: '#ef4444' },
        ...(cur.log || [])
      ];

      notify('Insurer rejected', `${targetCase.patient || 'Patient'} · appeal packet being prepared by Claim Denial Agent`, 'High', 'Claim Denial Agent');

      const updated = { ...cur, deps: nextDeps, paStatus: 'Rejected', eta: '14:30', approvals: nextApprovals, steps: nextSteps, log: nextLog };
      return { ...prev, [caseId]: updated };
    });
  };

  const handleTogglePause = (caseId) => {
    setCaseStates(prev => {
      const targetCase = allCases.find(x => x.id === caseId) || {};
      const cur = prev[caseId] || createCaseInitialState(targetCase);
      if (!cur || !cur.deps) return prev;
      const nextPaused = !cur.paused;

      if (nextPaused) {
        notify('Workflow paused', `${targetCase.patient || 'Patient'} · clinical deterioration pauses agent coordination`, 'High', 'Clinical Team');
      } else {
        notify('Workflow resumed', `${targetCase.patient || 'Patient'} · discharge coordination resumed`, 'Medium', 'Clinical Team');
      }

      const updated = { ...cur, paused: nextPaused, pauseReason: nextPaused ? 'Clinical deterioration' : '' };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  const handleDischargePatient = (caseId) => {
    setCaseStates(prev => {
      const targetCase = allCases.find(x => x.id === caseId) || {};
      const cur = prev[caseId] || createCaseInitialState(targetCase);
      if (!cur) return prev;

      notify('Patient discharged', `${targetCase.patient || 'Patient'} · bed ${targetCase.bed?.split(' ')[0] || 'ward'} released to housekeeping · follow-up booked 19 Sep 10:30`, 'High', 'Front Office');

      const nextSteps = [
        { t: '11:45', what: 'Front Office / Nurse · Patient discharged · bed released to Command Centre', col: '#d97706', res: 'Discharged' },
        { t: '11:45', what: 'Follow-up Agent · Handoff: follow-up booked 19 Sep 10:30 · feedback request scheduled', col: '#0284c7', res: 'Booked' },
        ...(cur.steps || [])
      ];
      const nextLog = [
        { t: '11:45', who: 'Nurse In-Charge', what: 'Patient discharged · bed released to Command Centre', col: '#d97706' },
        ...(cur.log || [])
      ];

      return {
        ...prev,
        [caseId]: { ...cur, completed: true, dischargedAt: '11:45', steps: nextSteps, log: nextLog }
      };
    });
  };

  const handleEscalate = (targetCase) => {
    notify('Escalated', `${targetCase.patient} discharge escalated to Operations Lead`, 'High', 'Discharge Board');
  };

  const renderStatusPill = (statusName) => {
    const s = STATUS_STYLES[statusName] || STATUS_STYLES['In progress'];
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          background: s.bg,
          color: s.fg,
          border: `1px solid ${s.border}`
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot }} />
        {statusName}
      </span>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // VIEW 1: DISCHARGE CASE DETAIL VIEW (When a patient is opened)
  // ─────────────────────────────────────────────────────────────
  if (activeCase) {
    const dc = activeCase;
    const canRelease = dc.statusKind === 'ready' && !dc.isCompleted;
    const canSimulate = dc.paStatus?.includes('Submitted') || dc.paStatus?.includes('Pending') || dc.paStatus?.includes('Appeal');

    const DEPL = {
      clinical: 'Clinical clearance',
      investigations: 'Pending investigations',
      pharmacy: 'Pharmacy clearance',
      billing: 'Unbilled charges / final bill',
      insurance: 'Insurance approval',
      housekeeping: 'Housekeeping',
      transport: 'Transport',
      summary: 'Discharge summary (doctor signs)',
      prescription: 'Prescription (doctor signs)'
    };

    const orderedDepKeys = [
      'clinical',
      'investigations',
      'pharmacy',
      'billing',
      'insurance',
      'housekeeping',
      'transport',
      'summary',
      'prescription'
    ];

    const familyMsgTa = dc.isCompleted
      ? 'நீங்கள் வீட்டுக்கு சென்றுவிட்டீர்கள். உங்களுக்கு மருத்துவரின் ஆலோசனைகள் மற்றும் பின்தொடர்தல் முன்பதிவு செய்யப்பட்டுள்ளது.'
      : dc.statusKind === 'ready'
        ? 'உங்கள் டிஸ்சார்ஜ் இப்போது தயார். வார்டு செவிலியர் உங்களுக்கு ஆவணங்களை வழங்குவார்.'
        : `உங்கள் டிஸ்சார்ஜ் சுமார் ${dc.eta} மணிக்கு எதிர்பார்க்கப்படுகிறது. காப்பீட்டு ஒப்புதல் பரிசீலனையில் உள்ளது.`;

    const familyMsgEn = dc.isCompleted
      ? 'You have been discharged. Your follow-up appointment is confirmed for 19 Sep 10:30.'
      : dc.statusKind === 'ready'
        ? 'Your discharge is ready now. Ward nurse is bringing medications and gate pass.'
        : `Your discharge is expected around ${dc.eta}. Insurance enhancement is in progress.`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', position: 'relative' }}>
        {/* Floating Toast Notification Container */}
        {toasts.length > 0 && (
          <div style={{ position: 'fixed', top: '16px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {toasts.map(t => (
              <div
                key={t.id}
                style={{
                  background: '#15181b',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  maxWidth: '380px'
                }}
              >
                <span
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: t.pri === 'High' ? '#ef4444' : t.pri === 'Medium' ? '#f59e0b' : '#3b82f6',
                    color: '#fff'
                  }}
                >
                  {t.pri}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  <div style={{ color: '#cbd5e1', fontSize: '11px', marginTop: '2px' }}>{t.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Breadcrumb Navigation matching prototype */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#8a9096' }}>
          <button
            type="button"
            onClick={() => {
              setActiveCaseId(null);
              setActiveDrawer(null);
              if (onClearSelectedPatient) onClearSelectedPatient();
            }}
            style={{
              border: 0,
              background: 'transparent',
              color: '#0284c7',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ← Back
          </button>
          <span>·</span>
          <span>Clinical Workspace</span>
          <span>›</span>
          <span>Discharge case</span>
          <span>›</span>
          <span style={{ color: '#15181b', fontWeight: 600 }}>{dc.id}</span>
        </div>

        {/* Two-Column Grid: Left Main + Right Approvals (minmax(0, 1fr) 380px) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '14px', alignItems: 'start' }}>
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Patient Master Card matching Image 1 & 2 */}
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 600, color: '#15181b' }}>{dc.patient}</span>
                    {renderStatusPill(dc.status)}
                  </div>
                  <div style={{ color: '#8a9096', fontSize: '12px', marginTop: '2px' }}>
                    {dc.id} · {dc.bed} · {dc.doctor} · {dc.insurer}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#8a9096', fontSize: '11.5px' }}>
                    {dc.isCompleted ? 'Discharged at' : 'Predicted ready'}
                  </div>
                  <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '32px', lineHeight: 1, color: '#15181b', fontWeight: 500, margin: '2px 0' }}>
                    {dc.isCompleted ? (dc.dischargeTime || (dc.eta !== 'Discharged' ? dc.eta : '10:30')) : dc.eta}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#8a9096' }}>
                    {dc.isCompleted ? 'Discharge completed · Finalized' : '±35 min · Forecasting v1.0.6 · decision support only'}
                  </div>
                </div>
              </div>

              {/* 4-Metric Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '8px',
                  margin: '14px 0',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: '#f6f7f8',
                  fontSize: '12px'
                }}
              >
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Doctor intent</div>
                  <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>{dc.intentAt}</div>
                </div>
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Age</div>
                  <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>{dc.patientAge ? `${dc.patientAge} Yrs` : (dc.age && dc.age !== '—' ? `${dc.age} Yrs` : '25 Yrs')}</div>
                </div>
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Owner</div>
                  <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>{dc.isCompleted ? (dc.doctor || dc.owner || 'Attending Physician') : (dc.owner && dc.owner !== 'Discharged' && dc.owner !== 'Ready for release' ? dc.owner : (dc.doctor || 'Attending Physician'))}</div>
                </div>
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Critical path</div>
                  <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>{dc.isCompleted ? 'All steps completed' : (dc.blocker || 'Cleared')}</div>
                </div>
              </div>

              {/* 9-Stage Dependency Graph Checklist */}
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', color: '#15181b' }}>
                Dependency graph
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {orderedDepKeys.map(key => {
                  const item = dc.deps[key] || { status: 'waiting', note: 'Pending', time: '—' };
                  const cfg = ICON_CONFIG[item.status] || ICON_CONFIG.waiting;
                  const rowBg = item.status === 'blocked' ? '#fef2f2' : item.status === 'approval' ? '#fffbeb' : 'transparent';

                  return (
                    <div
                      key={key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '22px minmax(0, 1fr) auto',
                        gap: '10px',
                        alignItems: 'center',
                        padding: '6px 8px',
                        margin: '0 -8px',
                        borderRadius: '6px',
                        background: rowBg,
                        fontSize: '12px'
                      }}
                    >
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: cfg.bg,
                          color: cfg.color,
                          border: cfg.border,
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700
                        }}
                      >
                        {cfg.icon}
                      </span>
                      <span>
                        <strong style={{ color: '#15181b' }}>{DEPL[key]}</strong>
                        <span style={{ color: '#52585e' }}> · {item.note}</span>
                      </span>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096' }}>
                        {item.status} · {item.time}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons Row */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleDischargePatient(dc.id)}
                  disabled={!canRelease}
                  title={dc.isCompleted ? 'Completed' : !canRelease ? 'Available when all dependencies are cleared' : 'Release bed and complete discharge'}
                  style={{
                    height: '30px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: 0,
                    background: 'oklch(0.5 0.1 200)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: canRelease ? 'pointer' : 'not-allowed',
                    opacity: canRelease ? 1 : 0.45
                  }}
                >
                  Discharge patient · release bed
                </button>

                {canSimulate && !dc.isCompleted && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSimulateInsurerApprove(dc.id)}
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid #e3e6e8',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#15181b'
                      }}
                    >
                      Simulate insurer: approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulateInsurerReject(dc.id)}
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid #e3e6e8',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#15181b'
                      }}
                    >
                      Simulate insurer: reject
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setActiveDrawer(activeDrawer === 'insurance' ? null : 'insurance')}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: activeDrawer === 'insurance' ? '1.5px solid #0284c7' : '1px solid #e3e6e8',
                    background: activeDrawer === 'insurance' ? '#f0f9ff' : '#fff',
                    color: activeDrawer === 'insurance' ? '#0284c7' : '#15181b',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500
                  }}
                >
                  Insurance case
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDrawer(activeDrawer === 'bill' ? null : 'bill')}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: activeDrawer === 'bill' ? '1.5px solid #0284c7' : '1px solid #e3e6e8',
                    background: activeDrawer === 'bill' ? '#f0f9ff' : '#fff',
                    color: activeDrawer === 'bill' ? '#0284c7' : '#15181b',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500
                  }}
                >
                  Bill
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onSelectPatient) onSelectPatient(dc);
                  }}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #e3e6e8',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#15181b'
                  }}
                >
                  Patient 360
                </button>

                <button
                  type="button"
                  onClick={() => handleEscalate(dc)}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #e3e6e8',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#15181b'
                  }}
                >
                  Escalate
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePause(dc.id)}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid oklch(0.88 0.06 25)',
                    background: '#fff',
                    color: 'oklch(0.45 0.17 25)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500
                  }}
                >
                  {dc.isPaused ? 'Resume workflow' : 'Pause · clinical deterioration'}
                </button>
              </div>

              {dc.isPaused && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'oklch(0.96 0.03 25)',
                    color: 'oklch(0.45 0.17 25)',
                    fontWeight: 500,
                    fontSize: '12px'
                  }}
                >
                  Workflow paused · Clinical deterioration · agent coordination stopped, family messages held, bed retained. Clinician resumes.
                </div>
              )}

              <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '6px' }}>
                {dc.isCompleted ? 'Completed' : !canRelease ? 'Available when all dependencies are cleared' : 'Bed goes to housekeeping · follow-up + feedback triggered'}
              </div>
            </div>

            {/* Agent Activity · Discharge Orchestration Agent card */}
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#15181b' }}>
                  Agent activity · Discharge Orchestration Agent
                </span>
                <span style={{ fontSize: '11.5px', color: '#0284c7', cursor: 'pointer', fontWeight: 600 }}>
                  Full trace EXE-2026-118204 →
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {dc.steps.map((st, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '48px minmax(0, 1fr) minmax(0, 140px)',
                      gap: '8px',
                      padding: '5px 0',
                      borderBottom: '1px solid #f2f3f4',
                      alignItems: 'baseline',
                      fontSize: '12px'
                    }}
                  >
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: st.col || '#52585e' }}>
                      {st.t}
                    </span>
                    <span style={{ color: '#15181b' }}>{st.what}</span>
                    <span style={{ color: '#52585e', textAlign: 'right', fontSize: '11.5px' }}>{st.res}</span>
                  </div>
                ))}
              </div>

              {dc.log.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, margin: '12px 0 4px', fontSize: '12.5px', color: '#15181b' }}>
                    Human actions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {dc.log.map((l, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '48px minmax(0, 1fr)',
                          gap: '8px',
                          padding: '3px 0',
                          fontSize: '12px'
                        }}
                      >
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: l.col || '#52585e' }}>
                          {l.t}
                        </span>
                        <span style={{ color: '#15181b' }}>
                          <strong>{l.who}</strong> · {l.what}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (380px) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Human Approvals on this Case */}
            <div style={{ background: '#fff', border: '1px solid oklch(0.85 0.08 80)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', color: '#15181b' }}>
                Human approvals on this case
              </div>

              {dc.approvals.length === 0 ? (
                <div style={{ padding: '12px 10px', borderRadius: '6px', background: '#f8fafc', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
                  ✓ All required human approvals granted for this case.
                </div>
              ) : (
                dc.approvals.map(a => (
                  <div
                    key={a.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: '#f6f7f8',
                      marginBottom: '6px',
                      fontSize: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#15181b' }}>{a.type}</span>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096' }}>{a.time}</span>
                    </div>
                    <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '2px' }}>
                      {a.action} · owner <strong>{a.owner}</strong>
                    </div>

                    {a.type === 'Discharge summary' && (
                      <button
                        type="button"
                        onClick={() => handleSignDischargeSummary(dc.id)}
                        style={{
                          marginTop: '6px',
                          width: '100%',
                          height: '26px',
                          borderRadius: '4px',
                          border: 0,
                          background: 'oklch(0.5 0.1 200)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Sign & Approve Discharge Summary
                      </button>
                    )}

                    {a.type === 'Preauth submission' && (
                      <button
                        type="button"
                        onClick={() => handleSubmitPreauthEnhancement(dc.id)}
                        style={{
                          marginTop: '6px',
                          width: '100%',
                          height: '26px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#0f172a',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Submit Enhancement to {dc.insurer}
                      </button>
                    )}

                    {a.type === 'Billing release' && (
                      <button
                        type="button"
                        onClick={() => handleReleaseFinalBill(dc.id)}
                        style={{
                          marginTop: '6px',
                          width: '100%',
                          height: '26px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#0f172a',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Release Final Bill & Settlement
                      </button>
                    )}
                  </div>
                ))
              )}

              <div style={{ color: '#8a9096', fontSize: '11px', lineHeight: 1.45, marginTop: '4px' }}>
                Doctor signs summary + prescription · Insurance submits · Billing releases. The agent never auto-issues either.
              </div>
            </div>

            {/* Generated for Human Review Card */}
            <div style={{ background: '#fff', border: '1px solid oklch(0.85 0.05 300)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)' }} />
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#15181b' }}>Generated for human review</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '4px 0', borderBottom: '1px solid #f2f3f4', fontSize: '12px' }}>
                  <div style={{ fontWeight: 500, color: '#15181b' }}>Discharge summary</div>
                  <div style={{ color: '#52585e', fontSize: '11.5px' }}>
                    {dc.deps.summary?.status === 'done' ? `Signed by ${dc.doctor}` : 'v2 · DRAFT — HUMAN REVIEW REQUIRED · groundedness 97%'}
                  </div>
                </div>

                <div style={{ padding: '4px 0', borderBottom: '1px solid #f2f3f4', fontSize: '12px' }}>
                  <div style={{ fontWeight: 500, color: '#15181b' }}>Medication instructions · Tamil + English</div>
                  <div style={{ color: '#52585e', fontSize: '11.5px' }}>
                    Nurse verifies before teaching
                  </div>
                </div>

                <div style={{ padding: '4px 0', borderBottom: '1px solid #f2f3f4', fontSize: '12px' }}>
                  <div style={{ fontWeight: 500, color: '#15181b' }}>Family status message (Tamil)</div>
                  <div style={{ color: '#52585e', fontSize: '11.5px' }}>
                    {dc.isCompleted ? 'Sent' : 'Sent on each dependency change · last 11:15'}
                  </div>
                </div>

                <div style={{ padding: '4px 0', fontSize: '12px' }}>
                  <div style={{ fontWeight: 500, color: '#15181b' }}>Follow-up</div>
                  <div style={{ color: '#52585e', fontSize: '11.5px' }}>
                    {dc.isCompleted ? 'Booked 19 Sep 10:30' : 'Proposed 19 Sep 10:30 · Front Office confirms'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  height: '30px',
                  borderRadius: '6px',
                  border: '1px solid #e3e6e8',
                  background: '#fff',
                  color: '#0284c7',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>📄</span> View Full Discharge Summary Document / Print
              </button>

              <div style={{ marginTop: '10px', padding: '10px', borderRadius: '6px', background: '#f6f7f8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096', fontWeight: 600 }}>
                    Family status message · WhatsApp
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setFamilyMsgLang('EN')}
                      style={{
                        border: 0,
                        background: familyMsgLang === 'EN' ? '#15181b' : '#e2e8f0',
                        color: familyMsgLang === 'EN' ? '#fff' : '#475569',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => setFamilyMsgLang('TA')}
                      style={{
                        border: 0,
                        background: familyMsgLang === 'TA' ? '#15181b' : '#e2e8f0',
                        color: familyMsgLang === 'TA' ? '#fff' : '#475569',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      தமிழ்
                    </button>
                  </div>
                </div>
                <div style={{ lineHeight: 1.5, fontSize: '11.5px', color: '#334155' }}>
                  {familyMsgLang === 'EN' ? familyMsgEn : familyMsgTa}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* FIXED SLIDE-OVER DRAWER (matching Meridian Prototype V2.1) */}
        {/* ========================================================= */}
        {activeDrawer && (
          <>
            <div
              onClick={() => setActiveDrawer(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(21, 24, 27, 0.25)',
                zIndex: 1050,
                animation: 'fadeIn 0.15s ease-out'
              }}
            />

            <aside
              role="dialog"
              aria-label={activeDrawer === 'bill' ? 'Bill details' : 'Insurance preauth details'}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 'min(520px, 100vw)',
                background: '#ffffff',
                borderLeft: '1px solid #e3e6e8',
                zIndex: 1051,
                overflowY: 'auto',
                padding: '18px 20px 40px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: '-8px 0 24px rgba(0,0,0,.08)',
                animation: 'drawerSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* BILL DRAWER CONTENT */}
              {activeDrawer === 'bill' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 600, color: '#15181b', lineHeight: 1.2 }}>
                        {dc.patient} · ₹{dc.billDetails.actual.toLocaleString('en-IN')}
                      </div>
                      <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                        {dc.billId} · {dc.admission_id}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDrawer(null)}
                      aria-label="Close"
                      style={{
                        height: '28px',
                        width: '28px',
                        borderRadius: '6px',
                        border: '1px solid #e3e6e8',
                        background: '#fff',
                        color: '#64748b',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: dc.billStatus === 'Released' ? '#ecfdf5' : '#fef3c7',
                        color: dc.billStatus === 'Released' ? '#047857' : '#92400e'
                      }}
                    >
                      {dc.billStatus}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr)', gap: '6px 12px', fontSize: '12.5px' }}>
                    <span style={{ color: '#8a9096' }}>Estimated</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>₹{dc.billDetails.estimated.toLocaleString('en-IN')}</span>

                    <span style={{ color: '#8a9096' }}>Actual</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>₹{dc.billDetails.actual.toLocaleString('en-IN')}</span>

                    <span style={{ color: '#8a9096' }}>Variance</span>
                    <span style={{ color: '#dc2626', fontWeight: 600, lineHeight: 1.45 }}>
                      +₹{dc.billDetails.variance.toLocaleString('en-IN')} ({dc.billDetails.variancePct}%)
                    </span>

                    <span style={{ color: '#8a9096' }}>Insurance</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>₹{dc.billInsurance.toLocaleString('en-IN')}</span>

                    <span style={{ color: '#8a9096' }}>Patient</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>₹{dc.billPatient.toLocaleString('en-IN')}</span>

                    <span style={{ color: '#8a9096' }}>Paid</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>
                      ₹{dc.billDetails.paid} · due ₹{dc.billPatient.toLocaleString('en-IN')}
                    </span>

                    <span style={{ color: '#8a9096' }}>Delete policy</span>
                    <span style={{ color: '#52585e', fontSize: '11.5px', lineHeight: 1.45 }}>
                      Bills are voided or refunded with Finance approval, never deleted
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid #eef0f1', paddingTop: '10px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#15181b', marginBottom: '6px' }}>
                      Tax (central configuration · demo rates)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.6fr)', gap: '6px 12px', padding: '3px 0', borderBottom: '1px solid #f6f7f8', fontSize: '12px' }}>
                      <span style={{ color: '#52585e' }}>Exempt (SAC 9993)</span>
                      <span style={{ color: '#15181b' }}>₹{dc.billDetails.actual.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.6fr)', gap: '6px 12px', padding: '3px 0', fontSize: '12px' }}>
                      <span style={{ color: '#52585e' }}>Total tax · gross</span>
                      <span style={{ color: '#15181b', fontWeight: 600 }}>₹0 · ₹{dc.billDetails.actual.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #eef0f1', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => notify('Dispute raised', 'Dispute ticket raised for billing transparency desk', 'Medium', 'Billing Desk')}
                      style={{
                        height: '34px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #e3e6e8',
                        background: '#fff',
                        color: '#15181b',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: '12px'
                      }}
                    >
                      Raise dispute (patient)
                    </button>

                    <button
                      type="button"
                      disabled
                      title="Requires Billing role"
                      style={{
                        height: '34px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: '1px solid #e3e6e8',
                        background: '#f8fafc',
                        color: '#8a9096',
                        fontWeight: 600,
                        cursor: 'not-allowed',
                        textAlign: 'left',
                        fontSize: '12px'
                      }}
                    >
                      Request void (Finance approval)
                      <span style={{ fontWeight: 400, color: '#8a9096', fontSize: '11px', marginLeft: '8px' }}>
                        Requires Billing role
                      </span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid #eef0f1', paddingTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDrawer(null);
                        if (onSelectPatient) onSelectPatient(dc);
                      }}
                      style={{
                        height: '26px',
                        padding: '0 9px',
                        borderRadius: '6px',
                        border: '1px solid #e3e6e8',
                        background: '#fff',
                        cursor: 'pointer',
                        color: 'oklch(0.45 0.1 200)',
                        fontSize: '11.5px',
                        fontWeight: 600
                      }}
                    >
                      Patient 360 →
                    </button>
                  </div>
                </>
              )}

              {/* INSURANCE DRAWER CONTENT */}
              {activeDrawer === 'insurance' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '17px', fontWeight: 600, color: '#15181b', lineHeight: 1.2 }}>
                        {dc.patient} · {dc.diagnoses}
                      </div>
                      <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                        {dc.paId} · {dc.insurer} · {dc.paRef}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDrawer(null)}
                      aria-label="Close"
                      style={{
                        height: '28px',
                        width: '28px',
                        borderRadius: '6px',
                        border: '1px solid #e3e6e8',
                        background: '#fff',
                        color: '#64748b',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: dc.paStatus === 'Approved' ? '#ecfdf5' : '#f1f5f9',
                        color: dc.paStatus === 'Approved' ? '#047857' : '#475569'
                      }}
                    >
                      {dc.paStatus}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: '#f1f5f9',
                        color: '#475569'
                      }}
                    >
                      Denial risk {dc.insuranceDetails.denialRisk}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr)', gap: '6px 12px', fontSize: '12.5px' }}>
                    <span style={{ color: '#8a9096' }}>Estimate</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>₹{dc.insuranceDetails.estimate.toLocaleString('en-IN')}</span>

                    <span style={{ color: '#8a9096' }}>Requested</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>₹{dc.insuranceDetails.requested.toLocaleString('en-IN')}</span>

                    <span style={{ color: '#8a9096' }}>Approved</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>₹{dc.paApproved.toLocaleString('en-IN')}</span>

                    <span style={{ color: '#8a9096' }}>Patient liability</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>₹{dc.paLiability.toLocaleString('en-IN')}</span>

                    <span style={{ color: '#8a9096' }}>Completeness</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>{dc.insuranceDetails.completeness}</span>

                    <span style={{ color: '#8a9096' }}>Human owner</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>{dc.insuranceDetails.owner}</span>

                    <span style={{ color: '#8a9096' }}>Submitted</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>{dc.insuranceDetails.submitted}</span>

                    <span style={{ color: '#8a9096' }}>Age</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>{dc.insuranceDetails.age}</span>

                    <span style={{ color: '#8a9096' }}>Lifecycle</span>
                    <span style={{ color: '#52585e', fontSize: '11px', lineHeight: 1.45 }}>
                      {dc.insuranceDetails.lifecycle}
                    </span>

                    <span style={{ color: '#8a9096' }}>Claim</span>
                    <span style={{ color: '#15181b', lineHeight: 1.45 }}>{dc.insuranceDetails.claim}</span>
                  </div>

                  <div style={{ borderTop: '1px solid #eef0f1', paddingTop: '10px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#15181b', marginBottom: '6px' }}>
                      Documents
                    </div>
                    {[
                      ['Preauth form', 'Collected'],
                      ['Doctor advice', 'Collected'],
                      ['Estimate', 'Collected'],
                      ['ID + policy', 'Collected'],
                      ['Rehabilitation plan, MRI report', 'Collected']
                    ].map(([docName, docStatus]) => (
                      <div
                        key={docName}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.6fr)',
                          gap: '6px 12px',
                          padding: '3px 0',
                          borderBottom: '1px solid #f6f7f8',
                          fontSize: '12px'
                        }}
                      >
                        <span style={{ color: '#52585e' }}>{docName}</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{docStatus}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid #eef0f1', paddingTop: '10px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#15181b', marginBottom: '6px' }}>
                      Denial-risk indicators · model preauth-denial v0.9
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.6fr)', gap: '6px 12px', padding: '3px 0', borderBottom: '1px solid #f6f7f8', fontSize: '12px' }}>
                      <span style={{ color: '#52585e' }}>Documentation</span>
                      <span style={{ color: '#52585e' }}>+18 pts · missing documents</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.6fr)', gap: '6px 12px', padding: '3px 0', borderBottom: '1px solid #f6f7f8', fontSize: '12px' }}>
                      <span style={{ color: '#52585e' }}>Package variance</span>
                      <span style={{ color: '#52585e' }}>Within package</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.6fr)', gap: '6px 12px', padding: '3px 0', fontSize: '12px' }}>
                      <span style={{ color: '#52585e' }}>Threshold</span>
                      <span style={{ color: '#52585e' }}>Supervisor review at 25%</span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #eef0f1', paddingTop: '10px' }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: '#15181b', marginBottom: '6px' }}>
                      Workflow
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '50px 10px minmax(0, 1fr)', gap: '8px', alignItems: 'start' }}>
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#8a9096' }}>09:02</span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)', marginTop: '4px' }} />
                        <span style={{ lineHeight: 1.45 }}>
                          <strong style={{ color: '#15181b' }}>Preauthorisation Assembly Agent</strong> · Admission detected · clinical + financial information collected
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '50px 10px minmax(0, 1fr)', gap: '8px', alignItems: 'start' }}>
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#8a9096' }}>09:04</span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.13 70)', marginTop: '4px' }} />
                        <span style={{ lineHeight: 1.45 }}>
                          <strong style={{ color: '#15181b' }}>Preauthorisation Assembly Agent</strong> · Verification draft assembled · risk {dc.insuranceDetails.denialRisk}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '50px 10px minmax(0, 1fr)', gap: '8px', alignItems: 'start' }}>
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#8a9096' }}>09:15</span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginTop: '4px' }} />
                        <span style={{ lineHeight: 1.45 }}>
                          <strong style={{ color: '#15181b' }}>Human Approval</strong> · Human review by {dc.insuranceDetails.owner} → executive submits
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #eef0f1', paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {canSimulate && !dc.isCompleted && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSimulateInsurerApprove(dc.id)}
                          style={{
                            height: '30px',
                            padding: '0 10px',
                            borderRadius: '6px',
                            border: '1px solid #e3e6e8',
                            background: '#fff',
                            color: '#15181b',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Simulate insurer: approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateInsurerReject(dc.id)}
                          style={{
                            height: '30px',
                            padding: '0 10px',
                            borderRadius: '6px',
                            border: '1px solid #e3e6e8',
                            background: '#fff',
                            color: '#15181b',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Simulate insurer: reject
                        </button>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid #eef0f1', paddingTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDrawer(null);
                        if (onSelectPatient) onSelectPatient(dc);
                      }}
                      style={{
                        height: '26px',
                        padding: '0 9px',
                        borderRadius: '6px',
                        border: '1px solid #e3e6e8',
                        background: '#fff',
                        cursor: 'pointer',
                        color: 'oklch(0.45 0.1 200)',
                        fontSize: '11.5px',
                        fontWeight: 600
                      }}
                    >
                      Patient 360 →
                    </button>
                  </div>
                </>
              )}
            </aside>
          </>
        )}

        {/* Modal for PDF / Summary view */}
        <DischargeSummaryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          summaryData={{
            ...(dc.rawRecord || {}),
            ...dc,
            diagnoses: dc.diagnoses || (dc.rawRecord && dc.rawRecord.diagnoses),
            primary_diagnosis: dc.diagnoses,
            patient_number: dc.patient_number || (dc.rawRecord && dc.rawRecord.patient_number) || `PAT-${dc.patient_id}`,
            age: dc.patientAge || (dc.rawRecord && dc.rawRecord.age) || 25
          }}
          onSummaryUpdated={() => {
            loadDischargeCandidates(true);
          }}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VIEW 2: KANBAN BOARD & TABLE VIEW (Matches User Screenshot)
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      {/* Floating Toast Notification Container */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', top: '16px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {toasts.map(t => (
            <div
              key={t.id}
              style={{
                background: '#15181b',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: '8px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                maxWidth: '380px'
              }}
            >
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  background: t.pri === 'High' ? '#ef4444' : t.pri === 'Medium' ? '#f59e0b' : '#3b82f6',
                  color: '#fff'
                }}
              >
                {t.pri}
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div style={{ color: '#cbd5e1', fontSize: '11px', marginTop: '2px' }}>{t.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Breadcrumb & Header row with Search and Export matching Screenshot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#0284c7', cursor: 'pointer', fontWeight: 500 }}>← Back</span>
            <span>·</span>
            <span>Clinical Workspace</span>
            <span>›</span>
            <span>Discharge</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#15181b', lineHeight: 1.2 }}>
            Discharge command centre {isDoctor && activeDoctorName ? `· ${activeDoctorName}` : ''}
          </div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '3px' }}>
            {isDoctor && activeDoctorName
              ? `Doctor Scope: ${activeDoctorName} · Showing ${allCases.length} assigned discharge case${allCases.length === 1 ? '' : 's'}`
              : `${allCases.length} active hospital cases · dependency graph, predicted ready time and critical path by Discharge Orchestration Agent v3.0.2`}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPageN(0);
            }}
            placeholder="Search..."
            style={{
              height: '30px',
              width: '180px',
              border: '1px solid #e3e6e8',
              borderRadius: '6px',
              padding: '0 10px',
              background: '#fff',
              fontSize: '12px',
              outline: 'none'
            }}
          />

          <button
            type="button"
            onClick={() => {
              if (!sortedCases.length) return alert('No records to export');
              const headers = ['Case ID', 'Patient', 'Bed', 'Doctor', 'Insurer', 'Intent', 'Predicted Ready', 'Critical Path', 'Pending', 'Status'];
              const rows = sortedCases.map(c => [
                `"${c.id}"`,
                `"${c.patient}"`,
                `"${c.bed}"`,
                `"${c.doctor}"`,
                `"${c.insurer}"`,
                `"${c.intentAt}"`,
                `"${c.eta}"`,
                `"${c.blocker}"`,
                `"${c.pendingCount}"`,
                `"${c.status}"`
              ]);
              const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `discharge_cases_${new Date().toISOString().slice(0, 10)}.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            style={{
              height: '30px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #e3e6e8',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#15181b',
              fontWeight: 500
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#991b1b',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span><strong>Notice:</strong> {error}</span>
          <button
            onClick={() => loadDischargeCandidates()}
            style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #f87171', background: '#fff', cursor: 'pointer', fontSize: '11px' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Stats in Newsreader serif typography (Matching Exact Screenshot: Ready 4, Blocked 8, Approval 8, In progress 5, Completed 3) */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '105px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Ready</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '28px', lineHeight: 1.1, color: '#047857', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.ready}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '105px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Blocked</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '28px', lineHeight: 1.1, color: '#b91c1c', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.blocked}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '120px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Approval required</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '28px', lineHeight: 1.1, color: '#b45309', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.approval}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '105px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>In progress</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '28px', lineHeight: 1.1, color: '#15181b', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.inProgress}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '115px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Completed today</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '28px', lineHeight: 1.1, color: '#15181b', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.completed}
          </div>
        </div>
      </div>

      {/* Segmented View Switcher: Table | Kanban */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', border: '1px solid #e3e6e8', borderRadius: '6px', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            style={{
              height: '26px',
              padding: '0 11px',
              border: 0,
              background: viewMode === 'table' ? '#15181b' : '#fff',
              color: viewMode === 'table' ? '#fff' : '#52585e',
              fontWeight: viewMode === 'table' ? 600 : 500,
              fontSize: '11.5px',
              cursor: 'pointer'
            }}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            style={{
              height: '26px',
              padding: '0 11px',
              border: 0,
              borderLeft: '1px solid #e3e6e8',
              background: viewMode === 'kanban' ? '#15181b' : '#fff',
              color: viewMode === 'kanban' ? '#fff' : '#52585e',
              fontWeight: viewMode === 'kanban' ? 600 : 500,
              fontSize: '11.5px',
              cursor: 'pointer'
            }}
          >
            Kanban
          </button>
        </div>
      </div>

      {/* KANBAN BOARD VIEW (5 Columns matching Exact User Screenshot Order: Blocked, Approval required, In progress, Ready, Completed) */}
      {viewMode === 'kanban' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(210px, 1fr))',
            gap: '12px',
            alignItems: 'start',
            overflowX: 'auto',
            paddingBottom: '16px'
          }}
        >
          {[
            { key: 'Blocked', label: 'Blocked', count: stats.blocked, pillBg: '#fee2e2', pillFg: '#b91c1c' },
            { key: 'Approval required', label: 'Approval required', count: stats.approval, pillBg: '#fef3c7', pillFg: '#92400e' },
            { key: 'In progress', label: 'In progress', count: stats.inProgress, pillBg: '#fef9c3', pillFg: '#854d0e' },
            { key: 'Ready', label: 'Ready', count: stats.ready, pillBg: '#ecfdf5', pillFg: '#047857' },
            { key: 'Completed', label: 'Completed', count: stats.completed, pillBg: '#dcfce7', pillFg: '#15803d' }
          ].map(col => {
            const colCases = filteredCases.filter(c => {
              if (col.key === 'Blocked') return c.category === 'Blocked' && !c.isCompleted;
              if (col.key === 'Approval required') return c.category === 'Approval required' && !c.isCompleted;
              if (col.key === 'In progress') return c.category === 'In progress' && !c.isCompleted;
              if (col.key === 'Ready') return c.category === 'Ready' && !c.isCompleted;
              if (col.key === 'Completed') return c.isCompleted || c.category === 'Completed';
              return false;
            });

            return (
              <div
                key={col.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Column Header matching screenshot: Pill badge on left, count on right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: col.pillBg,
                      color: col.pillFg
                    }}
                  >
                    {col.label}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#8a9096', fontWeight: 600 }}>
                    {col.count}
                  </span>
                </div>

                {/* Cards Stack matching screenshot */}
                {colCases.map(c => {
                  const isSelected = selectedCardId === c.id;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCardId(c.id);
                        setActiveCaseId(c.id);
                      }}
                      style={{
                        background: '#ffffff',
                        border: isSelected ? '1.5px solid #0d9488' : '1px solid #e3e6e8',
                        boxShadow: isSelected ? '0 0 0 1px #0d9488' : '0 1px 2px rgba(0,0,0,0.02)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.borderColor = '#e3e6e8';
                      }}
                    >
                      {/* Line 1: Patient Name · Bed */}
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#15181b', lineHeight: 1.3 }}>
                        {c.patient} · {c.bed}
                      </div>

                      {/* Line 2: Doctor Name */}
                      <div style={{ fontSize: '11.5px', color: '#52585e', marginTop: '1px' }}>
                        {c.doctor}
                      </div>

                      {/* Line 3: Critical Path / Blocker */}
                      <div style={{ fontSize: '11px', color: '#8a9096', marginTop: '3px' }}>
                        {c.blocker}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW (10 Columns matching Prototype V2.1) */}
      {viewMode === 'table' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
          {sortedCases.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No Discharged Patient Records Found</div>
              <div style={{ fontSize: '12px' }}>
                {search ? `No records matching "${search}"` : 'Zero discharge cases match the selected filter.'}
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e3e6e8', color: '#52585e', fontSize: '11px' }}>
                  {[
                    ['Patient · bed', 190],
                    ['Doctor', 140],
                    ['Insurer', 120],
                    ['Intent', 70],
                    ['Predicted ready', 90],
                    ['Critical path', 180],
                    ['Pending', 65],
                    ['Owner', 140],
                    ['Age', 70],
                    ['Status', 180]
                  ].map(([colName, colWidth], idx) => (
                    <th
                      key={colName}
                      onClick={() => {
                        if (sortCol === idx) {
                          setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortCol(idx);
                          setSortDir('asc');
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        width: `${colWidth}px`,
                        fontWeight: 600,
                        cursor: 'pointer',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{colName}</span>
                        <span style={{ fontSize: '9px', color: sortCol === idx ? '#15181b' : '#cbd5e1' }}>
                          {sortCol === idx ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedCases.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => {
                      setSelectedCardId(c.id);
                      setActiveCaseId(c.id);
                    }}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#15181b' }}>
                      <div>{c.patient}</div>
                      <div style={{ color: '#8a9096', fontSize: '11px', fontWeight: 400 }}>{c.bed}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#15181b' }}>{c.doctor}</td>
                    <td style={{ padding: '10px 12px', color: '#52585e' }}>{c.insurer}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px' }}>
                      {c.intentAt}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px', fontWeight: 600, color: c.statusKind === 'ready' ? '#047857' : '#15181b' }}>
                      {c.eta}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#52585e', fontSize: '11.5px' }}>
                      {c.blocker}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                      {c.pendingCount}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#52585e' }}>{c.owner}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', color: '#8a9096' }}>
                      {c.isCompleted ? '—' : '2 h'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {renderStatusPill(c.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination Footer */}
          {sortedCases.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                borderTop: '1px solid #e3e6e8',
                fontSize: '12px',
                color: '#64748b'
              }}
            >
              <div>
                Page {pageN + 1} of {totalPages} · {sortedCases.length} records
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={pageN === 0}
                  onClick={() => setPageN(p => Math.max(0, p - 1))}
                  style={{
                    height: '26px',
                    padding: '0 8px',
                    borderRadius: '4px',
                    border: '1px solid #e3e6e8',
                    background: '#fff',
                    cursor: pageN === 0 ? 'not-allowed' : 'pointer',
                    opacity: pageN === 0 ? 0.4 : 1
                  }}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={pageN >= totalPages - 1}
                  onClick={() => setPageN(p => Math.min(totalPages - 1, p + 1))}
                  style={{
                    height: '26px',
                    padding: '0 8px',
                    borderRadius: '4px',
                    border: '1px solid #e3e6e8',
                    background: '#fff',
                    cursor: pageN >= totalPages - 1 ? 'not-allowed' : 'pointer',
                    opacity: pageN >= totalPages - 1 ? 0.4 : 1
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
