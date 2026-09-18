import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService, parseDischargeSummaryRecord, cleanDiagnosis } from '../services/api';
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
  'Pending Approval': {
    label: 'Pending Approval',
    bg: '#fef3c7',
    fg: '#92400e',
    border: '#fde68a',
    dot: '#f59e0b'
  },
  'In progress': {
    label: 'In progress',
    bg: '#f0fdf4',
    fg: '#15803d',
    border: '#bbf7d0',
    dot: '#22c55e'
  },
  'Preauth enhancement': {
    label: 'Preauth enhancement',
    bg: '#fffbeb',
    fg: '#b45309',
    border: '#fde68a',
    dot: '#f59e0b'
  },
  Completed: {
    label: 'Completed',
    bg: '#f1f5f9',
    fg: '#334155',
    border: '#cbd5e1',
    dot: '#0ea5e9'
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

// Fallback prototype demo cases from Meridian Prototype V2.1
const PROTOTYPE_SEED_CASES = [
  {
    id: 'DIS-2026-0842',
    patient_id: 'MER-2026-008421',
    patient: 'Kavitha Raman',
    bed: 'Bed 304 (Cardiac Ward)',
    doctor: 'Dr. Arjun Menon',
    doctorRole: 'Lead Interventional Cardiologist',
    doctorId: 'DR-014',
    insurer: 'Star Health',
    paId: 'PA-2026-1104',
    paRef: 'REF-91104',
    billId: 'BILL-30507',
    admission_id: 'ADM-2026-0412',
    diagnoses: 'Non-ST elevation myocardial infarction · Post-PTCA',
    intentAt: '09:02',
    initialEta: '11:45',
    owner: 'Discharge Orchestration Agent',
    initialStatus: 'Preauth enhancement',
    billDetails: {
      estimated: 190000,
      actual: 204589,
      variance: 14589,
      variancePct: 8,
      insurance: 190000,
      patient: 14589,
      paid: 0,
      due: 14589
    },
    insuranceDetails: {
      estimate: 190000,
      requested: 204589,
      approved: 190000,
      liability: 14589,
      completeness: '100%',
      owner: 'K. Meena (Insurance)',
      submitted: '09:15',
      age: '2 h 43 m',
      lifecycle: 'Preauth approved ₹1,90,000 → Enhancement requested ₹2,04,589',
      claim: 'Ready to submit upon doctor signature',
      denialRisk: '24% (Medium)'
    }
  },
  {
    id: 'DIS-2026-0843',
    patient_id: 'MER-2026-009104',
    patient: 'Fathima Begum',
    bed: 'Bed 214 (Ortho Ward)',
    doctor: 'Dr. Priya Sharma',
    doctorRole: 'Senior Orthopedic Surgeon',
    doctorId: 'DR-018',
    insurer: 'HDFC ERGO',
    paId: 'PA-2026-1105',
    paRef: 'REF-91105',
    billId: 'BILL-30508',
    admission_id: 'ADM-2026-0415',
    diagnoses: 'Total Knee Arthroplasty (Right) · Post-op Day 3',
    intentAt: '09:30',
    initialEta: '13:15',
    owner: 'Discharge Orchestration Agent',
    initialStatus: 'Blocked · pharmacy',
    billDetails: {
      estimated: 240000,
      actual: 242500,
      variance: 2500,
      variancePct: 1,
      insurance: 240000,
      patient: 2500,
      paid: 0,
      due: 2500
    },
    insuranceDetails: {
      estimate: 240000,
      requested: 242500,
      approved: 240000,
      liability: 2500,
      completeness: '100%',
      owner: 'R. Sundar (Insurance)',
      submitted: '09:45',
      age: '2 h 15 m',
      lifecycle: 'Preauth approved ₹2,40,000',
      claim: 'Awaiting pharmacy stock clearance',
      denialRisk: '12% (Low)'
    }
  },
  {
    id: 'DIS-2026-0844',
    patient_id: 'MER-2026-007890',
    patient: 'Murugan Selvam',
    bed: 'Bed 108 (Neuro Ward)',
    doctor: 'Dr. Suresh Rao',
    doctorRole: 'Chief Neurologist',
    doctorId: 'DR-005',
    insurer: 'ICICI Lombard',
    paId: 'PA-2026-1106',
    paRef: 'REF-91106',
    billId: 'BILL-30509',
    admission_id: 'ADM-2026-0418',
    diagnoses: 'Transient Ischemic Attack · Carotid Artery Stenting',
    intentAt: '08:45',
    initialEta: '11:00',
    owner: 'Discharge Orchestration Agent',
    initialStatus: 'Ready',
    billDetails: {
      estimated: 165000,
      actual: 165000,
      variance: 0,
      variancePct: 0,
      insurance: 165000,
      patient: 0,
      paid: 0,
      due: 0
    },
    insuranceDetails: {
      estimate: 165000,
      requested: 165000,
      approved: 165000,
      liability: 0,
      completeness: '100%',
      owner: 'K. Meena (Insurance)',
      submitted: '08:50',
      age: '3 h 00 m',
      lifecycle: 'Preauth settled and approved in full',
      claim: 'Settled',
      denialRisk: '5% (Low)'
    }
  }
];

export default function DischargeCommandCentre({
  selectedPatient,
  onClearSelectedPatient,
  onSelectPatient,
  onNavigate
}) {
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'kanban'
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'bill', 'insurance', or null
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawSummaries, setRawSummaries] = useState([]);
  const [rawAdmissions, setRawAdmissions] = useState([]);
  const [familyMsgLang, setFamilyMsgLang] = useState('TA'); // 'TA' or 'EN'
  const [toasts, setToasts] = useState([]);

  // Per-case interactive state (workflow state machine)
  const [caseStates, setCaseStates] = useState(() => {
    const initial = {};
    PROTOTYPE_SEED_CASES.forEach(seed => {
      initial[seed.id] = {
        deps: {
          clinical: { status: 'done', note: `Intent by ${seed.doctor}`, time: seed.intentAt },
          investigations: { status: 'done', note: '0 pending', time: seed.intentAt },
          pharmacy: {
            status: seed.initialStatus.includes('pharmacy') ? 'blocked' : 'done',
            note: seed.initialStatus.includes('pharmacy') ? 'Enoxaparin 40 mg stock-out in Ortho ward' : 'Cleared',
            time: '09:05'
          },
          billing: {
            status: seed.initialStatus === 'Ready' ? 'done' : 'pending',
            note: seed.initialStatus === 'Ready' ? 'Final bill released by Billing' : `Provisional bill · ₹${seed.billDetails.actual.toLocaleString('en-IN')}`,
            time: '09:05'
          },
          insurance: {
            status: seed.initialStatus === 'Ready' ? 'done' : seed.initialStatus.includes('pharmacy') ? 'done' : 'waiting',
            note: seed.initialStatus === 'Ready' ? `Approved by ${seed.insurer}` : `Enhancement submitted 09:15 · awaiting ${seed.insurer}`,
            time: '09:15'
          },
          housekeeping: {
            status: seed.initialStatus === 'Ready' ? 'done' : 'waiting',
            note: seed.initialStatus === 'Ready' ? 'Team B dispatched' : 'Bed turnaround pre-alert acknowledged',
            time: '09:07'
          },
          transport: {
            status: seed.initialStatus === 'Ready' ? 'done' : 'waiting',
            note: seed.initialStatus === 'Ready' ? 'Porter dispatched · wheelchair at ward' : 'Slot held',
            time: '09:08'
          },
          summary: {
            status: seed.initialStatus === 'Ready' ? 'done' : 'approval',
            note: seed.initialStatus === 'Ready' ? 'Signed by doctor' : 'v2 draft · groundedness 97%',
            time: '09:09'
          },
          prescription: {
            status: seed.initialStatus === 'Ready' ? 'done' : 'approval',
            note: seed.initialStatus === 'Ready' ? 'Signed with summary' : 'Awaiting doctor sign-off',
            time: '09:09'
          }
        },
        paStatus: seed.initialStatus === 'Ready' ? 'Approved' : 'Submitted · awaiting insurer',
        paApproved: seed.insuranceDetails.approved,
        paLiability: seed.insuranceDetails.liability,
        billStatus: seed.initialStatus === 'Ready' ? 'Released' : 'Provisional',
        billInsurance: seed.billDetails.insurance,
        billPatient: seed.billDetails.patient,
        approvals: seed.initialStatus === 'Ready' ? [] : [
          {
            id: `AP-${seed.id}-01`,
            type: 'Discharge summary',
            action: 'Sign discharge summary v2',
            owner: seed.doctor,
            time: '15m ago',
            details: 'AI draft · groundedness 97% · verified contraindications'
          },
          {
            id: `AP-${seed.id}-02`,
            type: 'Preauth submission',
            action: `Submit enhancement · ${seed.insurer}`,
            owner: 'Insurance Desk',
            time: '32m ago',
            details: `Enhancement packet ₹${seed.billDetails.actual.toLocaleString('en-IN')} assembled`
          },
          {
            id: `AP-${seed.id}-03`,
            type: 'Billing release',
            action: 'Release final bill & gate pass',
            owner: 'Billing',
            time: '40m ago',
            details: 'Awaiting insurer settlement and doctor signature'
          }
        ],
        steps: [
          { t: '09:02', what: 'Orchestrator · Identity ✓ Consent ✓ Intent discharge.coordinate → Discharge Agent', col: '#0284c7', res: 'Allowed' },
          { t: '09:03', what: 'Discharge Agent · Pending investigations checked', col: '#52585e', res: '0 pending' },
          { t: '09:04', what: 'Discharge Agent · Pharmacy clearance requested', col: '#52585e', res: seed.initialStatus.includes('pharmacy') ? 'Stock-out' : 'Cleared' },
          { t: '09:05', what: 'Discharge Agent · Bill assembly triggered', col: '#52585e', res: 'Provisional bill' },
          { t: '09:06', what: `Discharge Agent · Final approval requested from ${seed.insurer}`, col: '#52585e', res: 'Awaiting insurer' },
          { t: '09:07', what: 'Discharge Agent · Bed turnaround pre-alert sent to Housekeeping', col: '#52585e', res: 'Acknowledged' },
          { t: '09:08', what: 'Discharge Agent · Patient transport requirement detected', col: '#52585e', res: 'Slot held' },
          { t: '09:09', what: 'Discharge Agent · Discharge summary draft v2 generated', col: '#9333ea', res: 'Groundedness 97%' }
        ],
        log: [
          { t: seed.intentAt, who: seed.doctor, what: 'Marked likely discharge in EMR', col: '#d97706' },
          { t: '09:15', who: 'Insurance Coordinator', what: 'Enhancement packet submitted to Star Health', col: '#d97706' }
        ],
        paused: false,
        pauseReason: '',
        completed: seed.initialStatus === 'Completed',
        dischargedAt: null,
        eta: seed.initialEta
      };
    });
    return initial;
  });

  // Table pagination & sorting
  const [pageN, setPageN] = useState(0);
  const [pageSize, setPageSize] = useState(25);
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

  // Fetch live backend data
  const loadDischargeCandidates = useCallback(async (isSilent = false) => {
    if (!isSilent && rawSummaries.length === 0) setLoading(true);
    setError(null);
    try {
      const [resSummaries, resAdmissions] = await Promise.all([
        apiService.getDischargedPatients({}, { forceRefresh: true }).catch(() => ({ data: [] })),
        apiService.getCurrentAdmissions({}, { forceRefresh: true }).catch(() => ({ data: [] }))
      ]);
      setRawSummaries(resSummaries?.data || []);
      setRawAdmissions(resAdmissions?.data || []);
    } catch (err) {
      if (!isSilent) setError(err.message || 'Failed to fetch live discharge candidates.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [rawSummaries.length]);

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

  // Combine backend records with prototype cases
  const allCases = useMemo(() => {
    const admMap = {};
    rawAdmissions.forEach(a => {
      const pid = String(a.patient_id || a.id || '');
      if (pid) admMap[pid] = a;
    });

    const liveList = rawSummaries.map((c, index) => {
      const parsed = parseDischargeSummaryRecord(c);
      const pid = String(parsed.patient_id || parsed.id || `LIVE-${index}`);
      const adm = admMap[pid] || {};
      const caseId = parsed.summary_id ? `DIS-SUM-${parsed.summary_id}` : `DIS-LIVE-${index + 1}`;

      const rawBillNet = parseFloat(adm.bill_net_amount || 195000);
      const billNet = rawBillNet > 0 ? rawBillNet : 195000;
      const rawIns = parseFloat(adm.insurance_coverage || billNet);
      const insCoverage = rawIns > 0 ? rawIns : billNet;
      const rawBal = parseFloat(adm.outstanding_balance || 0);

      const doctorName = parsed.doctor_name || adm.consulting_doctor || 'Dr. Arjun Menon';
      const patientName = parsed.patient_name || adm.patient_name || `Patient ${pid}`;
      const bed = adm.bed_number ? `Bed ${adm.bed_number} (${adm.department || 'Ward'})` : `Bed ${301 + index} (Ward)`;
      const insurer = adm.insurance_provider || 'Star Health';

      return {
        id: caseId,
        patient_id: pid,
        patient: patientName,
        bed,
        doctor: doctorName,
        doctorRole: 'Treating Consultant',
        doctorId: adm.doctor_id || 'DR-014',
        insurer,
        paId: `PA-2026-${1100 + index}`,
        paRef: `REF-${91100 + index}`,
        billId: `BILL-${30500 + index}`,
        admission_id: adm.admission_id || `ADM-2026-${0o400 + index}`,
        diagnoses: cleanDiagnosis(parsed.diagnoses || adm.primary_diagnosis || 'Inpatient admission under clinical observation'),
        intentAt: '09:00',
        initialEta: '12:30',
        owner: 'Discharge Orchestration Agent',
        initialStatus: parsed.approval_status === 'Approved' ? 'Ready' : 'Approval required',
        discharge_advice: parsed.discharge_advice || '',
        rawRecord: c,
        billDetails: {
          estimated: Math.round(billNet * 0.95),
          actual: billNet,
          variance: Math.round(billNet * 0.05),
          variancePct: 5,
          insurance: insCoverage,
          patient: rawBal,
          paid: 0,
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
          age: '1 h 40 m',
          lifecycle: 'Preauth approved → awaiting doctor sign-off',
          claim: 'Ready to submit',
          denialRisk: '15% (Low)'
        }
      };
    });

    // Seed cases guarantee that Kavitha Raman and friends are always present for demo flow
    const combined = [...PROTOTYPE_SEED_CASES];
    liveList.forEach(item => {
      if (!combined.some(x => x.patient_id === item.patient_id)) {
        combined.push(item);
      }
    });

    return combined;
  }, [rawSummaries, rawAdmissions]);

  // Synchronize caseStates when new cases arrive
  useEffect(() => {
    setCaseStates(prev => {
      const next = { ...prev };
      let changed = false;
      allCases.forEach(item => {
        if (!next[item.id]) {
          changed = true;
          next[item.id] = {
            deps: {
              clinical: { status: 'done', note: `Intent by ${item.doctor}`, time: item.intentAt },
              investigations: { status: 'done', note: '0 pending', time: item.intentAt },
              pharmacy: { status: 'done', note: 'Cleared', time: '09:05' },
              billing: { status: item.initialStatus === 'Ready' ? 'done' : 'pending', note: `Provisional bill · ₹${item.billDetails.actual.toLocaleString('en-IN')}`, time: '09:05' },
              insurance: { status: item.initialStatus === 'Ready' ? 'done' : 'waiting', note: `Enhancement submitted · awaiting ${item.insurer}`, time: '09:10' },
              housekeeping: { status: item.initialStatus === 'Ready' ? 'done' : 'waiting', note: 'Bed turnaround pre-alert acknowledged', time: '09:07' },
              transport: { status: item.initialStatus === 'Ready' ? 'done' : 'waiting', note: 'Slot held', time: '09:08' },
              summary: { status: item.initialStatus === 'Ready' ? 'done' : 'approval', note: 'v2 draft · groundedness 97%', time: '09:09' },
              prescription: { status: item.initialStatus === 'Ready' ? 'done' : 'approval', note: 'Awaiting doctor sign-off', time: '09:09' }
            },
            paStatus: item.initialStatus === 'Ready' ? 'Approved' : 'Submitted · awaiting insurer',
            paApproved: item.insuranceDetails.approved,
            paLiability: item.insuranceDetails.liability,
            billStatus: item.initialStatus === 'Ready' ? 'Released' : 'Provisional',
            billInsurance: item.billDetails.insurance,
            billPatient: item.billDetails.patient,
            approvals: item.initialStatus === 'Ready' ? [] : [
              {
                id: `AP-${item.id}-01`,
                type: 'Discharge summary',
                action: 'Sign discharge summary v2',
                owner: item.doctor,
                time: '18m ago',
                details: 'AI draft · verified contraindications'
              },
              {
                id: `AP-${item.id}-02`,
                type: 'Preauth submission',
                action: `Submit enhancement · ${item.insurer}`,
                owner: 'Insurance Desk',
                time: '35m ago',
                details: `Enhancement packet ₹${item.billDetails.actual.toLocaleString('en-IN')} assembled`
              },
              {
                id: `AP-${item.id}-03`,
                type: 'Billing release',
                action: 'Release final bill',
                owner: 'Billing',
                time: '45m ago',
                details: 'Awaiting doctor signature'
              }
            ],
            steps: [
              { t: '09:00', what: 'Orchestrator · Identity ✓ Consent ✓ Intent discharge.coordinate → Discharge Agent', col: '#0284c7', res: 'Allowed' },
              { t: '09:02', what: 'Discharge Agent · Pending investigations checked', col: '#52585e', res: '0 pending' },
              { t: '09:03', what: 'Discharge Agent · Pharmacy clearance requested', col: '#52585e', res: 'Cleared' },
              { t: '09:04', what: 'Discharge Agent · Bill assembly triggered', col: '#52585e', res: 'Provisional bill' },
              { t: '09:05', what: `Discharge Agent · Preauth request sent to ${item.insurer}`, col: '#52585e', res: 'Awaiting insurer' }
            ],
            log: [
              { t: item.intentAt, who: item.doctor, what: 'Marked likely discharge in EMR', col: '#d97706' }
            ],
            paused: false,
            pauseReason: '',
            completed: false,
            dischargedAt: null,
            eta: item.initialEta
          };
        }
      });
      return changed ? next : prev;
    });
  }, [allCases]);

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
    }
  }, [selectedPatient, allCases]);

  // Compute live enriched discharge case objects
  const enrichedCases = useMemo(() => {
    return allCases.map(base => {
      const st = caseStates[base.id] || {};
      const deps = st.deps || {};
      const openDeps = Object.entries(deps).filter(([, val]) => val.status !== 'done');
      const isCompleted = !!st.completed;
      const isPaused = !!st.paused;

      // Status label calculation matching prototype `dischargeState(d)`
      let statusLabel = 'Ready';
      let statusKind = 'ready';

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

      // Critical path computation
      const cpNames = {
        clinical: 'Clinical',
        investigations: 'Investigations',
        pharmacy: 'Pharmacy',
        billing: 'Billing',
        insurance: 'Insurance',
        housekeeping: 'Housekeeping',
        transport: 'Transport',
        summary: 'Doctor summary',
        prescription: 'Prescription'
      };
      const cp = openDeps.map(([k]) => cpNames[k] || k).slice(0, 3).join(' → ') || 'Clear';

      // ETA
      const eta = isCompleted
        ? (st.dischargedAt || '11:45')
        : statusKind === 'ready'
          ? 'Now'
          : st.eta || '11:45';

      return {
        ...base,
        status: statusLabel,
        statusKind,
        eta,
        isCompleted,
        isPaused,
        pauseReason: st.pauseReason || '',
        pendingCount: openDeps.length,
        cp,
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

  // Filtered cases for list
  const filteredCases = useMemo(() => {
    return enrichedCases.filter(c => {
      if (statusFilter !== 'All') {
        if (statusFilter === 'Ready' && c.statusKind !== 'ready') return false;
        if (statusFilter === 'Blocked' && c.statusKind !== 'blocked') return false;
        if (statusFilter === 'Approval required' && c.statusKind !== 'approval') return false;
        if (statusFilter === 'In progress' && c.statusKind !== 'pending') return false;
        if (statusFilter === 'Completed' && !c.isCompleted) return false;
      }
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          c.patient.toLowerCase().includes(s) ||
          c.bed.toLowerCase().includes(s) ||
          c.doctor.toLowerCase().includes(s) ||
          c.insurer.toLowerCase().includes(s) ||
          c.diagnoses.toLowerCase().includes(s) ||
          c.status.toLowerCase().includes(s) ||
          c.id.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [enrichedCases, statusFilter, search]);

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
        case 5: valA = a.cp; valB = b.cp; break;
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedCases.length / pageSize));
  const paginatedCases = useMemo(() => {
    const start = pageN * pageSize;
    return sortedCases.slice(start, start + pageSize);
  }, [sortedCases, pageN, pageSize]);

  // Summary counts
  const stats = useMemo(() => {
    const ready = enrichedCases.filter(c => c.statusKind === 'ready' && !c.isCompleted).length;
    const blocked = enrichedCases.filter(c => c.statusKind === 'blocked' && !c.isCompleted).length;
    const approval = enrichedCases.filter(c => c.statusKind === 'approval' && !c.isCompleted).length;
    const inProgress = enrichedCases.filter(c => c.statusKind === 'pending' && !c.isCompleted).length;
    const completed = enrichedCases.filter(c => c.isCompleted).length;
    return { ready, blocked, approval, inProgress, completed };
  }, [enrichedCases]);

  // ─────────────────────────────────────────────────────────────
  // INTERACTIVE WORKFLOW ACTIONS (State Machine)
  // ─────────────────────────────────────────────────────────────

  // 1. Check if case is ready and auto-dispatch transport & housekeeping
  const checkAndAdvanceCase = useCallback((caseId, updatedState) => {
    const d = updatedState.deps;
    const openNonAuto = ['clinical', 'investigations', 'pharmacy', 'billing', 'insurance', 'summary', 'prescription']
      .some(k => d[k] && d[k].status !== 'done');

    if (!openNonAuto && !updatedState.paused && !updatedState.completed) {
      // Automatically advance transport & housekeeping
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

  // 2. Doctor signs summary & prescription
  const handleSignDischargeSummary = (caseId) => {
    setCaseStates(prev => {
      const cur = prev[caseId];
      if (!cur) return prev;
      const targetCase = allCases.find(x => x.id === caseId) || {};

      const nextDeps = {
        ...cur.deps,
        summary: { status: 'done', note: `Signed by ${targetCase.doctor || 'Doctor'}`, time: '11:15' },
        prescription: { status: 'done', note: 'Signed with summary', time: '11:15' }
      };
      const nextApprovals = cur.approvals.filter(a => a.type !== 'Discharge summary');
      const nextSteps = [
        { t: '11:15', what: `${targetCase.doctor || 'Doctor'} · Discharge summary + prescription signed`, col: '#d97706', res: 'Approved' },
        ...cur.steps
      ];
      const nextLog = [
        { t: '11:15', who: targetCase.doctor || 'Dr. Arjun Menon', what: 'Signed discharge summary and prescription', col: '#d97706' },
        ...cur.log
      ];

      notify('Discharge summary signed', `${targetCase.patient || 'Patient'} · summary v2 signed by doctor`, 'Medium', 'Discharge Agent');

      const updated = {
        ...cur,
        deps: nextDeps,
        approvals: nextApprovals,
        steps: nextSteps,
        log: nextLog
      };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  // 3. Submit enhancement to insurer
  const handleSubmitPreauthEnhancement = (caseId) => {
    setCaseStates(prev => {
      const cur = prev[caseId];
      if (!cur) return prev;
      const targetCase = allCases.find(x => x.id === caseId) || {};

      const nextDeps = {
        ...cur.deps,
        insurance: { status: 'waiting', note: `Enhancement submitted 11:04 · awaiting ${targetCase.insurer || 'Insurer'}`, time: '11:04' }
      };
      const nextApprovals = cur.approvals.filter(a => a.type !== 'Preauth submission');
      const nextSteps = [
        { t: '11:04', what: `Insurance Preauth Agent · Human submitted enhancement to ${targetCase.insurer || 'Insurer'} · watching response`, col: '#52585e', res: 'Submitted' },
        ...cur.steps
      ];
      const nextLog = [
        { t: '11:04', who: 'Insurance Coordinator', what: `Enhancement packet submitted to ${targetCase.insurer || 'Insurer'}`, col: '#d97706' },
        ...cur.log
      ];

      notify('Enhancement submitted', `${targetCase.patient || 'Patient'} · awaiting response (simulate with approve/reject buttons)`, 'Medium', 'Insurance Preauth Agent');

      const updated = {
        ...cur,
        deps: nextDeps,
        paStatus: 'Submitted · awaiting insurer',
        approvals: nextApprovals,
        steps: nextSteps,
        log: nextLog
      };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  // 4. Release final bill
  const handleReleaseFinalBill = (caseId) => {
    setCaseStates(prev => {
      const cur = prev[caseId];
      if (!cur) return prev;
      const targetCase = allCases.find(x => x.id === caseId) || {};

      const nextDeps = {
        ...cur.deps,
        billing: { status: 'done', note: 'Final bill released by Billing', time: '11:16' }
      };
      const nextApprovals = cur.approvals.filter(a => a.type !== 'Billing release');
      const nextSteps = [
        { t: '11:16', what: 'Billing Executive · Final bill released · provisional gate pass generated', col: '#d97706', res: 'Released' },
        ...cur.steps
      ];
      const nextLog = [
        { t: '11:16', who: 'Billing Executive', what: 'Final bill released', col: '#d97706' },
        ...cur.log
      ];

      notify('Final bill released', `${targetCase.patient || 'Patient'} · final charges settled`, 'Medium', 'Billing Desk');

      const updated = {
        ...cur,
        deps: nextDeps,
        billStatus: 'Released',
        approvals: nextApprovals,
        steps: nextSteps,
        log: nextLog
      };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  // 5. Simulate insurer: APPROVE
  const handleSimulateInsurerApprove = (caseId) => {
    setCaseStates(prev => {
      const cur = prev[caseId];
      if (!cur) return prev;
      const targetCase = allCases.find(x => x.id === caseId) || {};

      const requestedAmt = targetCase.billDetails?.actual || 204589;
      const nextDeps = {
        ...cur.deps,
        insurance: { status: 'done', note: `Approved by ${targetCase.insurer || 'Star Health'} 11:12`, time: '11:12' },
        billing: cur.deps.billing.status !== 'done'
          ? { status: 'approval', note: 'Final bill ready · awaiting Billing release', time: '11:12' }
          : cur.deps.billing
      };
      const nextApprovals = cur.approvals.filter(a => a.type !== 'Preauth submission');
      const nextSteps = [
        { t: '11:12', what: `Insurance Preauth Agent · Insurer response: approved ₹${requestedAmt.toLocaleString('en-IN')} · dependency cleared`, col: '#10b981', res: 'Approved' },
        ...cur.steps
      ];
      const nextLog = [
        { t: '11:12', who: targetCase.insurer || 'Star Health', what: `Final approval received for ₹${requestedAmt.toLocaleString('en-IN')}`, col: '#10b981' },
        ...cur.log
      ];

      notify('Insurer approved', `${targetCase.patient || 'Patient'} · ${targetCase.insurer || 'Star Health'} approved ₹${requestedAmt.toLocaleString('en-IN')} · patient notified in Tamil`, 'High', 'Insurance Preauth Agent');

      const updated = {
        ...cur,
        deps: nextDeps,
        paStatus: 'Approved',
        paApproved: requestedAmt,
        paLiability: 0,
        billInsurance: requestedAmt,
        billPatient: 0,
        approvals: nextApprovals,
        steps: nextSteps,
        log: nextLog
      };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  // 6. Simulate insurer: REJECT
  const handleSimulateInsurerReject = (caseId) => {
    setCaseStates(prev => {
      const cur = prev[caseId];
      if (!cur) return prev;
      const targetCase = allCases.find(x => x.id === caseId) || {};

      const nextDeps = {
        ...cur.deps,
        insurance: { status: 'blocked', note: 'Enhancement rejected · patient liability counselling needed', time: '11:12' }
      };
      const nextApprovals = [
        ...cur.approvals.filter(a => a.type !== 'Preauth submission'),
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
        ...cur.steps
      ];
      const nextLog = [
        { t: '11:12', who: targetCase.insurer || 'Star Health', what: 'Enhancement rejected', col: '#ef4444' },
        ...cur.log
      ];

      notify('Insurer rejected', `${targetCase.patient || 'Patient'} · appeal packet being prepared by Claim Denial Agent`, 'High', 'Claim Denial Agent');

      const updated = {
        ...cur,
        deps: nextDeps,
        paStatus: 'Rejected',
        eta: '14:30',
        approvals: nextApprovals,
        steps: nextSteps,
        log: nextLog
      };
      return { ...prev, [caseId]: updated };
    });
  };

  // 7. Toggle Pause Clinical Deterioration
  const handleTogglePause = (caseId) => {
    setCaseStates(prev => {
      const cur = prev[caseId];
      if (!cur) return prev;
      const nextPaused = !cur.paused;
      const targetCase = allCases.find(x => x.id === caseId) || {};

      if (nextPaused) {
        notify('Workflow paused', `${targetCase.patient || 'Patient'} · clinical deterioration pauses agent coordination`, 'High', 'Clinical Team');
      } else {
        notify('Workflow resumed', `${targetCase.patient || 'Patient'} · discharge coordination resumed`, 'Medium', 'Clinical Team');
      }

      const updated = {
        ...cur,
        paused: nextPaused,
        pauseReason: nextPaused ? 'Clinical deterioration' : ''
      };
      return { ...prev, [caseId]: checkAndAdvanceCase(caseId, updated) };
    });
  };

  // 8. Discharge patient · release bed
  const handleDischargePatient = (caseId) => {
    setCaseStates(prev => {
      const cur = prev[caseId];
      if (!cur) return prev;
      const targetCase = allCases.find(x => x.id === caseId) || {};

      notify('Patient discharged', `${targetCase.patient || 'Patient'} · bed ${targetCase.bed?.split(' ')[0] || 'ward'} released to housekeeping · follow-up booked 19 Sep 10:30`, 'High', 'Front Office');

      const nextSteps = [
        { t: '11:45', what: 'Front Office / Nurse · Patient discharged · bed released to Command Centre', col: '#d97706', res: 'Discharged' },
        { t: '11:45', what: 'Follow-up Agent · Handoff: follow-up booked 19 Sep 10:30 · feedback request scheduled', col: '#0284c7', res: 'Booked' },
        ...cur.steps
      ];
      const nextLog = [
        { t: '11:45', who: 'Nurse In-Charge', what: 'Patient discharged · bed released to Command Centre', col: '#d97706' },
        ...cur.log
      ];

      return {
        ...prev,
        [caseId]: {
          ...cur,
          completed: true,
          dischargedAt: '11:45',
          steps: nextSteps,
          log: nextLog
        }
      };
    });
  };

  // Escalate
  const handleEscalate = (targetCase) => {
    notify('Escalated', `${targetCase.patient} discharge escalated to Operations Lead`, 'High', 'Discharge Board');
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────

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
  // VIEW: DISCHARGE CASE DETAIL VIEW (Matching Prototype V2.1)
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
                    {dc.eta}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#8a9096' }}>
                    ±35 min · Forecasting v1.0.6 · decision support only
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
                  <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>{dc.isCompleted ? '—' : '2 h 43 m'}</div>
                </div>
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Owner</div>
                  <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>{dc.owner}</div>
                </div>
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Critical path</div>
                  <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>{dc.cp}</div>
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
                {/* 1. Discharge Patient Button */}
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

                {/* 2. Simulation Buttons */}
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

                {/* 3. Drawers & Navigation */}
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

              {/* Paused alert box */}
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

              {/* Monospace 3-column steps */}
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

              {/* Human Actions list */}
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

                    {/* Action buttons inside approval card */}
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

              {/* View Full Document Modal Button */}
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

              {/* Family WhatsApp Message Preview */}
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
            {/* Dark Backdrop */}
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

            {/* Slide-over Aside Panel */}
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
              {/* BILL DRAWER CONTENT (Image 1) */}
              {activeDrawer === 'bill' && (
                <>
                  {/* Header */}
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

                  {/* Badges */}
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

                  {/* Facts Grid */}
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

                  {/* AI Plain-Language Explanation */}
                  <div style={{ border: '1px solid oklch(0.85 0.05 300)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)' }} />
                      <span style={{ fontWeight: 600, fontSize: '12px', color: '#15181b' }}>
                        AI GENERATED · plain-language explanation · Billing Transparency Agent
                      </span>
                    </div>
                    <div style={{ lineHeight: 1.55, color: '#52585e', fontSize: '12px' }}>
                      Charges follow Tariff FY26-27 v1.3. The variance comes from an extra day of stay and additional consumables.
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#8a9096' }}>
                      Tariff FY26-27 v1.3 · confidence 95% · the billing executive remains responsible for the final response
                    </div>
                  </div>

                  {/* Tax Section */}
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

                  {/* Actions */}
                  <div style={{ borderTop: '1px solid #eef0f1', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        notify('Dispute raised', 'Dispute ticket raised for billing transparency desk', 'Medium', 'Billing Desk');
                      }}
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

                  {/* Related */}
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

              {/* INSURANCE DRAWER CONTENT (Image 2) */}
              {activeDrawer === 'insurance' && (
                <>
                  {/* Header */}
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

                  {/* Badges */}
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

                  {/* Facts Grid */}
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

                  {/* Documents Section with Collected Badges */}
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

                  {/* Denial-Risk Indicators */}
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

                  {/* Workflow Timeline */}
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

                  {/* Actions inside drawer */}
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

                  {/* Related */}
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
          summaryData={dc.rawRecord || dc}
          onSummaryUpdated={() => {
            loadDischargeCandidates(true);
          }}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // VIEW: MAIN DISCHARGE BOARD VIEW (Table & Kanban)
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

      {/* Header matching Prototype V2.1 */}
      <div>
        <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
          <span>Clinical Workspace</span> › <span>Discharge</span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 600, color: '#15181b' }}>
          Discharge command centre
        </div>
        <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
          {enrichedCases.filter(c => !c.isCompleted).length} active cases · dependency graph, predicted ready time and critical path by Discharge Orchestration Agent v3.0.2
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

      {/* KPI Stats in Newsreader serif typography */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div
          onClick={() => setStatusFilter(statusFilter === 'Ready' ? 'All' : 'Ready')}
          style={{
            background: '#fff',
            border: statusFilter === 'Ready' ? '1.5px solid #047857' : '1px solid #e3e6e8',
            borderRadius: '8px',
            padding: '8px 16px',
            minWidth: '110px',
            cursor: 'pointer'
          }}
        >
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Ready</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#047857', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.ready}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'Blocked' ? 'All' : 'Blocked')}
          style={{
            background: '#fff',
            border: statusFilter === 'Blocked' ? '1.5px solid #b91c1c' : '1px solid #e3e6e8',
            borderRadius: '8px',
            padding: '8px 16px',
            minWidth: '110px',
            cursor: 'pointer'
          }}
        >
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Blocked</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#b91c1c', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.blocked}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'Approval required' ? 'All' : 'Approval required')}
          style={{
            background: '#fff',
            border: statusFilter === 'Approval required' ? '1.5px solid #b45309' : '1px solid #e3e6e8',
            borderRadius: '8px',
            padding: '8px 16px',
            minWidth: '130px',
            cursor: 'pointer'
          }}
        >
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Approval required</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#b45309', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.approval}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'In progress' ? 'All' : 'In progress')}
          style={{
            background: '#fff',
            border: statusFilter === 'In progress' ? '1.5px solid #15181b' : '1px solid #e3e6e8',
            borderRadius: '8px',
            padding: '8px 16px',
            minWidth: '110px',
            cursor: 'pointer'
          }}
        >
          <div style={{ color: '#8a9096', fontSize: '11px' }}>In progress</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#15181b', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.inProgress}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'Completed' ? 'All' : 'Completed')}
          style={{
            background: '#fff',
            border: statusFilter === 'Completed' ? '1.5px solid #0284c7' : '1px solid #e3e6e8',
            borderRadius: '8px',
            padding: '8px 16px',
            minWidth: '120px',
            cursor: 'pointer'
          }}
        >
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Completed today</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#0284c7', fontWeight: 500 }}>
            {loading && enrichedCases.length === 0 ? '—' : stats.completed}
          </div>
        </div>
      </div>

      {/* Controls: Table/Kanban Switcher, Search, CSV Export, Agent Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid #e3e6e8', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                height: '28px',
                padding: '0 12px',
                border: 0,
                background: viewMode === 'table' ? '#15181b' : '#fff',
                color: viewMode === 'table' ? '#fff' : '#15181b',
                fontWeight: 600,
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
                height: '28px',
                padding: '0 12px',
                border: 0,
                borderLeft: '1px solid #e3e6e8',
                background: viewMode === 'kanban' ? '#15181b' : '#fff',
                color: viewMode === 'kanban' ? '#fff' : '#15181b',
                fontWeight: 600,
                fontSize: '11.5px',
                cursor: 'pointer'
              }}
            >
              Kanban
            </button>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {['All', 'Ready', 'Blocked', 'Approval required', 'In progress', 'Completed'].map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                style={{
                  height: '28px',
                  padding: '0 9px',
                  borderRadius: '6px',
                  border: '1px solid #e3e6e8',
                  background: statusFilter === f ? '#15181b' : '#fff',
                  color: statusFilter === f ? '#fff' : '#52585e',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPageN(0);
            }}
            placeholder="Search patient, bed, doctor, insurer..."
            style={{
              height: '30px',
              width: '260px',
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
                `"${c.cp}"`,
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
              padding: '0 10px',
              borderRadius: '6px',
              border: '1px solid #e3e6e8',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Export CSV
          </button>

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('discharge-agent')}
              style={{
                height: '30px',
                padding: '0 12px',
                borderRadius: '6px',
                border: 0,
                background: 'oklch(0.5 0.1 200)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>⚡ Discharge Summary Agent</span>
            </button>
          )}
        </div>
      </div>

      {/* TABLE VIEW (10 Columns matching Meridian Prototype V2.1) */}
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
                    onClick={() => setActiveCaseId(c.id)}
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
                      {c.cp}
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

      {/* KANBAN BOARD VIEW (5 Status Columns matching Prototype V2.1) */}
      {viewMode === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(220px, 1fr))', gap: '12px', overflowX: 'auto', paddingBottom: '10px' }}>
          {[
            { key: 'Ready', label: 'Ready for release', pillBg: '#ecfdf5', pillFg: '#047857' },
            { key: 'Blocked', label: 'Blocked / Exception', pillBg: '#fef2f2', pillFg: '#b91c1c' },
            { key: 'Approval required', label: 'Approval required', pillBg: '#fffbeb', pillFg: '#b45309' },
            { key: 'In progress', label: 'In progress', pillBg: '#f0fdf4', pillFg: '#15803d' },
            { key: 'Completed', label: 'Discharged today', pillBg: '#f1f5f9', pillFg: '#334155' }
          ].map(col => {
            const colCases = enrichedCases.filter(c => {
              if (col.key === 'Ready') return c.statusKind === 'ready' && !c.isCompleted;
              if (col.key === 'Blocked') return c.statusKind === 'blocked' && !c.isCompleted;
              if (col.key === 'Approval required') return c.statusKind === 'approval' && !c.isCompleted;
              if (col.key === 'In progress') return c.statusKind === 'pending' && !c.isCompleted;
              if (col.key === 'Completed') return c.isCompleted;
              return false;
            });

            return (
              <div
                key={col.key}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e3e6e8',
                  borderRadius: '8px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  minHeight: '400px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
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
                    {colCases.length}
                  </span>
                </div>

                {colCases.length === 0 ? (
                  <div style={{ padding: '24px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '11.5px' }}>
                    No cases
                  </div>
                ) : (
                  colCases.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setActiveCaseId(c.id)}
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '10px',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: '12.5px', color: '#15181b' }}>{c.patient}</strong>
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10.5px', color: c.statusKind === 'ready' ? '#047857' : '#0284c7', fontWeight: 600 }}>
                          {c.eta}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>{c.bed}</div>
                      <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>
                        {c.doctor} · {c.insurer}
                      </div>
                      <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10.5px', color: '#8a9096' }}>
                          {c.pendingCount} pending
                        </span>
                        {renderStatusPill(c.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
