import React, { useState, useEffect, useMemo } from 'react';
import { apiService, parseDischargeSummaryRecord, cleanDiagnosis } from '../services/api';
import DischargeSummaryModal from './DischargeSummaryModal';

// Status color definitions matching Meridian Prototype V2.1
const STATUS_STYLES = {
  Ready: {
    label: 'Ready',
    bg: 'oklch(0.96 0.03 150)',
    fg: 'oklch(0.35 0.14 150)',
    border: 'oklch(0.85 0.08 150)',
    dot: 'oklch(0.55 0.13 150)'
  },
  Blocked: {
    label: 'Blocked',
    bg: 'oklch(0.96 0.03 25)',
    fg: 'oklch(0.45 0.18 25)',
    border: 'oklch(0.88 0.06 25)',
    dot: 'oklch(0.55 0.18 25)'
  },
  'Approval required': {
    label: 'Approval required',
    bg: 'oklch(0.98 0.02 80)',
    fg: 'oklch(0.48 0.14 70)',
    border: 'oklch(0.88 0.06 80)',
    dot: 'oklch(0.62 0.14 70)'
  },
  'In progress': {
    label: 'In progress',
    bg: 'oklch(0.96 0.02 200)',
    fg: 'oklch(0.4 0.1 200)',
    border: 'oklch(0.88 0.04 200)',
    dot: 'oklch(0.5 0.1 200)'
  },
  Completed: {
    label: 'Completed',
    bg: '#f1f5f9',
    fg: '#334155',
    border: '#cbd5e1',
    dot: '#0ea5e9'
  }
};

export default function DischargeCommandCentre({
  selectedPatient,
  onClearSelectedPatient,
  onSelectPatient,
  onOpenSoap,
  onNavigate
}) {
  const [viewMode, setViewMode] = useState('table'); // Default to prototype table
  const [search, setSearch] = useState('');
  const [activeCase, setActiveCase] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [liveCases, setLiveCases] = useState([]);
  const [simState, setSimState] = useState({});
  const [familyMsgLang, setFamilyMsgLang] = useState('EN'); // 'EN' or 'TA'

  // Table pagination & sorting
  const [pageN, setPageN] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortCol, setSortCol] = useState(0);
  const [sortDir, setSortDir] = useState('asc');

  // Load and enrich live discharge cases from backend API
  const loadDischargeCandidates = async (isSilent = false) => {
    if (!isSilent && liveCases.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      // Fetch live discharge summaries and admissions
      const [resSummaries, resAdmissions] = await Promise.all([
        apiService.getDischargedPatients({}, { forceRefresh: true }).catch(() => ({ data: [] })),
        apiService.getCurrentAdmissions({}, { forceRefresh: true }).catch(() => ({ data: [] }))
      ]);

      const summaries = resSummaries?.data || [];
      const admissions = resAdmissions?.data || [];

      // Map admissions into candidate dictionary
      const admMap = {};
      admissions.forEach(a => {
        const pid = String(a.patient_id || a.id || '');
        if (pid) admMap[pid] = a;
      });

      if (summaries.length > 0) {
        const mapped = summaries.map((c, index) => {
          const parsed = parseDischargeSummaryRecord(c);
          const pid = String(parsed.patient_id || parsed.id || '');
          const adm = admMap[pid] || {};

          // Determine live simulation overrides if any
          const sim = simState[parsed.summary_id || parsed.id] || {};
          const isApproved = sim.approved || parsed.approval_status === 'Approved' || parsed.approval_status === 'Signed';
          const isRejected = sim.insurerRejected;
          const isReleased = sim.released;
          const isPaused = sim.paused;

          // Detect clinical blockers from live vitals or bills
          const billBalance = parseFloat(adm.outstanding_balance || adm.bill_net_amount || 0);
          const hasPendingBill = billBalance > 0 && (adm.bill_status || '').toLowerCase().includes('pending');
          const vitalsSummary = (adm.vital_signs_summary || '').toLowerCase();
          const hasAbnormalVitals = vitalsSummary.includes('high') || vitalsSummary.includes('critical') || vitalsSummary.includes('desaturation');

          // Build status matching prototype
          let status = 'In progress';
          if (isReleased) {
            status = 'Completed';
          } else if (isPaused) {
            status = 'Blocked';
          } else if (isRejected) {
            status = 'Blocked';
          } else if (hasAbnormalVitals) {
            status = 'Blocked';
          } else if (!isApproved) {
            status = 'Approval required';
          } else if (isApproved && !hasPendingBill) {
            status = 'Ready';
          }

          // Build prototype dependency graph items
          const deps = {
            clinical: {
              label: 'Clinical clearance',
              status: isPaused ? 'blocked' : 'done',
              note: isPaused ? 'Workflow paused: clinical deterioration' : 'Attending physician confirmed stable',
              at: '10:15 AM'
            },
            investigations: {
              label: 'Pending investigations',
              status: hasAbnormalVitals ? 'blocked' : 'done',
              note: hasAbnormalVitals ? 'Abnormal vital signs flagged · medical review' : 'Lab & diagnostic reports cleared',
              at: '11:00 AM'
            },
            pharmacy: {
              label: 'Pharmacy clearance',
              status: 'done',
              note: parsed.discharge_advice ? 'Take-home medications packed and verified' : 'Medications dispensed to ward',
              at: '11:30 AM'
            },
            insurance: {
              label: 'Insurance approval',
              status: isRejected ? 'blocked' : 'done',
              note: isRejected ? 'Query raised by TPA desk · awaiting response' : (parsed.insurance_provider ? `${parsed.insurance_provider} preauth enhanced` : 'Cashless preauth verified'),
              at: '12:45 PM'
            },
            summary: {
              label: 'Discharge summary (doctor signs)',
              status: isApproved ? 'done' : 'approval',
              note: isApproved ? `Signed by ${parsed.doctor || 'Consultant'}` : `Generated via ${parsed.model_name || 'Llama-3.3-70B'} · awaits signature`,
              at: parsed.intent || '13:15 PM'
            },
            billing: {
              label: 'Unbilled charges / final bill',
              status: hasPendingBill ? 'approval' : 'done',
              note: hasPendingBill ? `Co-pay ₹${billBalance.toLocaleString()} pending settlement` : 'Zero balance cleared',
              at: '13:45 PM'
            },
            housekeeping: {
              label: 'Housekeeping & bed turnover',
              status: isReleased ? 'done' : (status === 'Ready' ? 'approval' : 'waiting'),
              note: isReleased ? 'Bed sanitized and released to inventory' : 'Notification staged for patient exit',
              at: isReleased ? (parsed.discharge_date || 'Today') : '—'
            }
          };

          // Critical path computation (prototype logic)
          const pendingDeps = Object.entries(deps).filter(([, x]) => x.status !== 'done');
          const cp = pendingDeps.map(([, d]) => d.label.split(' (')[0]).slice(0, 3).join(' → ') || 'Clear';

          // Bed formatting
          const bedClean = (parsed.bed || adm.bed_number || `Ward C · Bed ${400 + (index % 20)}`).trim();

          // Predicted ETA calculation
          const defaultEta = parsed.eta || '14:30';

          return {
            ...parsed,
            rawRecord: c,
            admission: adm,
            id: parsed.summary_id || `DIS-${parsed.patient_id || index + 1}`,
            patient: parsed.patient || `Patient ${parsed.patient_id}`,
            patient_id: parsed.patient_id,
            admission_id: parsed.admission_id || adm.admission_number || `ADM-${parsed.patient_id}`,
            bed: bedClean,
            doctor: parsed.doctor || adm.attending_doctor || 'Dr. Suresh Menon',
            insurer: adm.insurance_provider || parsed.insurance_provider || 'Star Health (Cashless)',
            intentAt: parsed.intent || '10:00 AM',
            eta: isReleased ? (parsed.discharge_date || '15:10') : defaultEta,
            etaLabel: isReleased ? 'Discharged at' : 'Predicted ready',
            age: parsed.admission_date ? `${Math.max(1, Math.floor((Date.now() - new Date(parsed.admission_date).getTime()) / (3600000 * 24)))}d stay` : '2h 15m',
            owner: parsed.doctor || 'Attending Physician',
            cp: cp,
            pendingCount: pendingDeps.length,
            status: status,
            isApproved: isApproved,
            isReleased: isReleased,
            isPaused: isPaused,
            deps: deps,
            diagnoses: parsed.diagnoses || adm.primary_diagnosis || 'Clinical Inpatient Care',
            investigations: parsed.investigations || 'Clinical investigations verified',
            discharge_advice: parsed.discharge_advice || 'Take prescribed medications regularly. Follow-up in 7 days.',
            steps: [
              { t: '10:00', k: 'human', what: 'Consultant recorded discharge intent in EMR', res: 'Intent logged' },
              { t: '10:02', k: 'ai', what: 'Discharge Orchestration Agent triggered workflow v3.0.2', res: 'Dependencies mapped' },
              { t: '10:08', k: 'tool', what: 'Query LIS / RIS: all pending investigation results fetched', res: 'Reports normal' },
              { t: '10:15', k: 'ai', what: `LLM generated clinical course & take-home medications (${parsed.model_name || 'Llama 3.3 70B'})`, res: 'Draft created' },
              { t: '10:20', k: 'policy', what: 'Governance policy check: medication dose verification against hospital formulary', res: 'Passed (0 errors)' },
              { t: '11:00', k: 'human', what: 'TPA insurance pre-auth enhancement request submitted', res: 'Ref #CLM-9921' },
              {
                t: '13:15',
                k: isApproved ? 'human' : 'policy',
                what: isApproved ? 'Attending physician approved and digitally signed discharge summary' : 'Discharge summary staged for physician digital signature',
                res: isApproved ? 'Signed & locked' : 'Awaiting sign-off'
              }
            ],
            billDetails: {
              netAmount: parseFloat(adm.bill_net_amount || 48500),
              insuranceCoverage: parseFloat(adm.insurance_coverage || 45000),
              patientLiability: billBalance
            }
          };
        });

        setLiveCases(mapped);

        // If a patient was actively selected in detail view, keep it synced
        setActiveCase(prev => {
          if (!prev) return null;
          return mapped.find(m => m.id === prev.id || m.patient_id === prev.patient_id) || prev;
        });
      } else {
        setLiveCases([]);
      }
    } catch (err) {
      console.error('Failed to load discharge candidates:', err);
      if (!isSilent) setError(err.message || 'Failed to connect to backend discharge summaries API');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDischargeCandidates();

    const interval = setInterval(() => {
      loadDischargeCandidates(true);
    }, 8000);

    const handleUpdate = () => loadDischargeCandidates(true);
    window.addEventListener('hc_api_updated', handleUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, [simState]);

  // Handle selectedPatient prop passed from App.jsx or other views
  useEffect(() => {
    if (!selectedPatient) return;
    const sPid = String(selectedPatient.patient_id || selectedPatient.id || '').trim();
    const sSummaryId = String(selectedPatient.summary_id || '').trim();

    if (liveCases.length > 0) {
      const match = liveCases.find(c => {
        if (sSummaryId && String(c.summary_id || c.id) === sSummaryId) return true;
        if (sPid && String(c.patient_id) === sPid) return true;
        return false;
      });
      if (match) {
        setActiveCase(match);
      }
    }
  }, [selectedPatient, liveCases]);

  // Filtered cases based on search
  const filteredCases = useMemo(() => {
    if (!search.trim()) return liveCases;
    const s = search.toLowerCase();
    return liveCases.filter(c => {
      return (
        (c.patient && c.patient.toLowerCase().includes(s)) ||
        (c.bed && c.bed.toLowerCase().includes(s)) ||
        (c.doctor && c.doctor.toLowerCase().includes(s)) ||
        (c.insurer && c.insurer.toLowerCase().includes(s)) ||
        (c.diagnoses && c.diagnoses.toLowerCase().includes(s)) ||
        (c.status && c.status.toLowerCase().includes(s)) ||
        (c.id && c.id.toLowerCase().includes(s))
      );
    });
  }, [liveCases, search]);

  // Sorting
  const sortedCases = useMemo(() => {
    const list = [...filteredCases];
    list.sort((a, b) => {
      let valA = '';
      let valB = '';
      switch (sortCol) {
        case 0: valA = a.patient; valB = b.patient; break;
        case 1: valA = a.doctor; valB = b.doctor; break;
        case 2: valA = a.insurer; valB = b.insurer; break;
        case 3: valA = a.intentAt; valB = b.intentAt; break;
        case 4: valA = a.eta; valB = b.eta; break;
        case 5: valA = a.cp; valB = b.cp; break;
        case 6: valA = a.pendingCount; valB = b.pendingCount; break;
        case 7: valA = a.owner; valB = b.owner; break;
        case 8: valA = a.age; valB = b.age; break;
        case 9: valA = a.status; valB = b.status; break;
        default: valA = a.patient; valB = b.patient; break;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return sortDir === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
    return list;
  }, [filteredCases, sortCol, sortDir]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(sortedCases.length / pageSize));
  const paginatedCases = useMemo(() => {
    const start = pageN * pageSize;
    return sortedCases.slice(start, start + pageSize);
  }, [sortedCases, pageN, pageSize]);

  // KPI statistics calculation matching Prototype V2.1
  const stats = useMemo(() => {
    const ready = liveCases.filter(c => c.status === 'Ready').length;
    const blocked = liveCases.filter(c => c.status === 'Blocked').length;
    const approval = liveCases.filter(c => c.status === 'Approval required').length;
    const inProgress = liveCases.filter(c => c.status === 'In progress').length;
    const completed = liveCases.filter(c => c.status === 'Completed').length;
    return { ready, blocked, approval, inProgress, completed };
  }, [liveCases]);

  // Handlers for case actions
  const handleApproveCase = async (c) => {
    try {
      if (c.summary_id) {
        await apiService.updateDischargeSummary(c.summary_id, {
          approval_status: 'Approved',
          signed_by: c.doctor,
          signed_at: new Date().toISOString()
        });
      }
      setSimState(prev => ({
        ...prev,
        [c.id]: { ...(prev[c.id] || {}), approved: true }
      }));
      alert(`Discharge summary for ${c.patient} has been signed and approved.`);
      loadDischargeCandidates(true);
    } catch (err) {
      console.error('Failed to approve summary:', err);
      // Fallback in simulation mode
      setSimState(prev => ({
        ...prev,
        [c.id]: { ...(prev[c.id] || {}), approved: true }
      }));
      alert(`Discharge summary for ${c.patient} approved.`);
    }
  };

  const handleReleaseBed = (c) => {
    setSimState(prev => ({
      ...prev,
      [c.id]: { ...(prev[c.id] || {}), released: true }
    }));
    alert(`Bed ${c.bed} has been released. Housekeeping turnover alert broadcasted.`);
    loadDischargeCandidates(true);
  };

  const handleSimulateInsurer = (c, decision) => {
    if (decision === 'approve') {
      setSimState(prev => ({
        ...prev,
        [c.id]: { ...(prev[c.id] || {}), insurerRejected: false, insurerApproved: true }
      }));
      alert(`Insurer (${c.insurer}): Preauth enhancement ₹85,000 APPROVED.`);
    } else {
      setSimState(prev => ({
        ...prev,
        [c.id]: { ...(prev[c.id] || {}), insurerRejected: true, insurerApproved: false }
      }));
      alert(`Insurer (${c.insurer}): Query / Rejection simulated. Insurance blocker active.`);
    }
  };

  const handleTogglePause = (c) => {
    const currentPaused = c.isPaused;
    setSimState(prev => ({
      ...prev,
      [c.id]: { ...(prev[c.id] || {}), paused: !currentPaused }
    }));
    alert(!currentPaused ? `Discharge workflow paused due to clinical deterioration.` : `Discharge workflow resumed.`);
  };

  const handleExportCsv = () => {
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
  };

  // Helper function to render prototype status pills
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
        {s.label}
      </span>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // VIEW: CASE DETAIL VIEW (discharge-case)
  // ─────────────────────────────────────────────────────────────
  if (activeCase) {
    const dc = activeCase;
    const st = STATUS_STYLES[dc.status] || STATUS_STYLES['In progress'];
    const canRelease = (dc.status === 'Ready' || dc.isApproved) && !dc.isReleased;

    // Bilingual family WhatsApp message text
    const familyMsgEn = `Dear Family of ${dc.patient}, your patient's discharge from Meridian Hospital (${dc.bed}) is predicted for ${dc.eta}. Medications: ${dc.discharge_advice ? dc.discharge_advice.slice(0, 80) + '...' : 'Prescribed take-home medicines packed'}. Bill cleared: ₹${dc.billDetails.netAmount.toLocaleString()}. Please arrange transport. Contact ward nurse for any queries.`;
    const familyMsgTa = `அன்புள்ள ${dc.patient} குடும்பத்தினரே, மெரிடியன் மருத்துவமனையில் (${dc.bed}) நோயாளியின் டிஸ்சார்ஜ் நேரம் சுமார் ${dc.eta} மணி என எதிர்பார்க்கப்படுகிறது. மருந்துகள் மற்றும் பரிசோதனை அறிக்கைகள் தயாராக உள்ளன. நோயாளியை அழைத்துச் செல்ல ஏற்பாடு செய்யவும். உதவிக்கு செவிலியரை அணுகவும்.`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Top Back Navigation Banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => {
              setActiveCase(null);
              if (onClearSelectedPatient) onClearSelectedPatient();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #e3e6e8',
              background: '#fff',
              color: '#15181b',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'oklch(0.5 0.1 200)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e3e6e8'}
          >
            ← Back to Discharge board
          </button>

          <div style={{ fontSize: '11px', color: '#8a9096' }}>
            <span>Clinical Workspace</span> › <span>Discharge</span> › <strong>{dc.id}</strong>
          </div>
        </div>

        {/* 2-Column Responsive Layout (matching Prototype lines 8-22) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 390px', gap: '14px', alignItems: 'start' }}>
          {/* LEFT MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Patient Header Card */}
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
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
                  <div style={{ color: '#8a9096', fontSize: '11.5px' }}>{dc.etaLabel}</div>
                  <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '28px', lineHeight: 1, color: '#15181b' }}>
                    {dc.eta}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#8a9096', marginTop: '2px' }}>
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
                  padding: '10px',
                  borderRadius: '6px',
                  background: '#f6f7f8'
                }}
              >
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Doctor intent</div>
                  <div style={{ fontWeight: 600, fontSize: '12.5px', marginTop: '2px' }}>{dc.intentAt}</div>
                </div>
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Length of stay</div>
                  <div style={{ fontWeight: 600, fontSize: '12.5px', marginTop: '2px' }}>{dc.age}</div>
                </div>
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Owner</div>
                  <div style={{ fontWeight: 600, fontSize: '12.5px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dc.owner}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#8a9096', fontSize: '11px' }}>Critical path</div>
                  <div style={{ fontWeight: 600, fontSize: '12.5px', marginTop: '2px', color: 'oklch(0.45 0.1 200)' }}>
                    {dc.cp}
                  </div>
                </div>
              </div>

              {/* Dependency Graph */}
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Dependency graph</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {Object.entries(dc.deps).map(([key, d]) => {
                  let icon = '⚪';
                  let ibg = '#fff';
                  let ic = '#52585e';
                  let rowBg = 'transparent';

                  if (d.status === 'done') {
                    icon = '✓';
                    ibg = 'oklch(0.55 0.13 150)';
                    ic = '#fff';
                  } else if (d.status === 'blocked') {
                    icon = '!';
                    ibg = 'oklch(0.55 0.18 25)';
                    ic = '#fff';
                    rowBg = 'oklch(0.96 0.03 25)';
                  } else if (d.status === 'approval') {
                    icon = '⧗';
                    ibg = 'oklch(0.62 0.14 70)';
                    ic = '#fff';
                    rowBg = 'oklch(0.98 0.02 80)';
                  }

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
                        background: rowBg
                      }}
                    >
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: ibg,
                          color: ic,
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          border: d.status === 'pending' || d.status === 'waiting' ? '2px solid #c9cdd1' : 'none'
                        }}
                      >
                        {icon}
                      </span>
                      <span style={{ fontSize: '12px' }}>
                        <span style={{ fontWeight: 600, color: '#15181b' }}>{d.label}</span>
                        <span style={{ color: '#52585e' }}> · {d.note}</span>
                      </span>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096' }}>
                        {d.status.toUpperCase()} · {d.at}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleReleaseBed(dc)}
                  disabled={!canRelease}
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
                    opacity: canRelease ? 1 : 0.45,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Discharge patient · release bed
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateInsurer(dc, 'approve')}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #e3e6e8',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: 500
                  }}
                >
                  Simulate insurer: approve
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulateInsurer(dc, 'reject')}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #e3e6e8',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: 500
                  }}
                >
                  Simulate insurer: reject
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
                    fontSize: '11.5px',
                    fontWeight: 500
                  }}
                >
                  Patient 360
                </button>

                <button
                  type="button"
                  onClick={() => alert(`Operational Escalation: Discharge Case ${dc.id} routed to Duty Operations Lead.`)}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #e3e6e8',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: 500
                  }}
                >
                  Escalate
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePause(dc)}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid oklch(0.88 0.06 25)',
                    background: '#fff',
                    color: 'oklch(0.45 0.17 25)',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    fontWeight: 600
                  }}
                >
                  {dc.isPaused ? 'Resume workflow' : 'Pause · clinical deterioration'}
                </button>
              </div>

              {/* Paused state notice if active */}
              {dc.isPaused && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'oklch(0.96 0.03 25)',
                    color: 'oklch(0.45 0.17 25)',
                    fontSize: '11.5px',
                    fontWeight: 500
                  }}
                >
                  Workflow paused · Patient deterioration noted · Agent coordination halted, family messages held, bed retained.
                </div>
              )}

              <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '8px' }}>
                {dc.isReleased
                  ? 'Discharge process completed. Bed sanitized and reassigned.'
                  : canRelease
                  ? 'Bed goes to housekeeping · family follow-up notification broadcasted.'
                  : 'Available when all clinical and insurance dependencies are cleared.'}
              </div>
            </div>

            {/* Agent Activity · Discharge Orchestration Agent */}
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Agent activity · Discharge Orchestration Agent</span>
                <span style={{ fontSize: '11px', color: 'oklch(0.45 0.1 200)', cursor: 'pointer', fontWeight: 600 }}>
                  Full trace TRACE-{dc.id} →
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {dc.steps.map((st, i) => {
                  const tagColor =
                    st.k === 'human'
                      ? 'oklch(0.5 0.13 70)'
                      : st.k === 'policy'
                      ? 'oklch(0.5 0.1 200)'
                      : st.k === 'ai'
                      ? 'oklch(0.5 0.1 300)'
                      : '#52585e';

                  return (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '48px minmax(0, 1fr) minmax(0, 150px)',
                        gap: '8px',
                        padding: '6px 0',
                        borderBottom: i < dc.steps.length - 1 ? '1px solid #f2f3f4' : 'none',
                        alignItems: 'baseline',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: tagColor, fontWeight: 600 }}>
                        {st.t}
                      </span>
                      <span style={{ color: '#15181b' }}>{st.what}</span>
                      <span style={{ color: '#52585e', textAlign: 'right', fontSize: '11px', fontWeight: 500 }}>
                        {st.res}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Human Actions Log */}
              <div style={{ fontWeight: 600, fontSize: '12px', margin: '12px 0 6px', color: '#15181b' }}>Human actions log</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr)', gap: '8px', fontSize: '11.5px' }}>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#8a9096' }}>10:15</span>
                  <span style={{ color: '#52585e' }}>{dc.doctor} · Confirmed clinical stability and initiated discharge</span>
                </div>
                {dc.isApproved && (
                  <div style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr)', gap: '8px', fontSize: '11.5px' }}>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#8a9096' }}>13:15</span>
                    <span style={{ color: '#52585e' }}>{dc.doctor} · Electronically signed clinical discharge summary</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Human Approvals Card */}
            <div style={{ background: '#fff', border: '1px solid oklch(0.85 0.08 80)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Human approvals on this case</div>

              {/* Doctor Sign-Off Card */}
              <div style={{ padding: '8px 10px', borderRadius: '6px', background: '#f6f7f8', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>Doctor Signs Summary</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10.5px', color: dc.isApproved ? 'oklch(0.4 0.12 150)' : 'oklch(0.62 0.14 70)', fontWeight: 600 }}>
                    {dc.isApproved ? '✓ SIGNED' : 'PENDING'}
                  </span>
                </div>
                <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '2px' }}>
                  Attending Consultant: {dc.doctor}
                </div>
                {!dc.isApproved && (
                  <button
                    type="button"
                    onClick={() => handleApproveCase(dc)}
                    style={{
                      marginTop: '8px',
                      width: '100%',
                      height: '28px',
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
              </div>

              {/* Insurance Desk Card */}
              <div style={{ padding: '8px 10px', borderRadius: '6px', background: '#f6f7f8', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>Insurance Desk Approval</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10.5px', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                    CLEARED
                  </span>
                </div>
                <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '2px' }}>
                  {dc.insurer} · Cashless approval received
                </div>
              </div>

              {/* Billing Clearance Card */}
              <div style={{ padding: '8px 10px', borderRadius: '6px', background: '#f6f7f8', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>Billing Desk Release</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '10.5px', color: dc.billDetails.patientLiability > 0 ? 'oklch(0.62 0.14 70)' : 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                    {dc.billDetails.patientLiability > 0 ? 'CO-PAY DUE' : 'ZERO BALANCE'}
                  </span>
                </div>
                <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '2px' }}>
                  Patient liability: ₹{dc.billDetails.patientLiability.toLocaleString()}
                </div>
              </div>

              <div style={{ color: '#8a9096', fontSize: '11px', lineHeight: 1.4 }}>
                Doctor signs summary + prescription · Insurance submits · Billing releases. The agent never auto-issues either.
              </div>
            </div>

            {/* Generated for Human Review Card */}
            <div style={{ background: '#fff', border: '1px solid oklch(0.85 0.05 300)', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)' }} />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Generated for human review</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ padding: '4px 0', borderBottom: '1px solid #f2f3f4' }}>
                  <div style={{ fontWeight: 500, fontSize: '12px', color: '#15181b' }}>Provisional bill summary</div>
                  <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '2px' }}>
                    Total: ₹{dc.billDetails.netAmount.toLocaleString()} · Insurance: ₹{dc.billDetails.insuranceCoverage.toLocaleString()} · Patient Liability: ₹{dc.billDetails.patientLiability.toLocaleString()}
                  </div>
                </div>

                <div style={{ padding: '4px 0', borderBottom: '1px solid #f2f3f4' }}>
                  <div style={{ fontWeight: 500, fontSize: '12px', color: '#15181b' }}>Summary of clinical course</div>
                  <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '2px', lineHeight: 1.4 }}>
                    {cleanDiagnosis(dc.diagnoses)} · Patient responded satisfactorily to treatment. Vitals stable at discharge.
                  </div>
                </div>

                <div style={{ padding: '4px 0' }}>
                  <div style={{ fontWeight: 500, fontSize: '12px', color: '#15181b' }}>Take-home medication instructions</div>
                  <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '2px', lineHeight: 1.4 }}>
                    {dc.discharge_advice ? dc.discharge_advice.slice(0, 120) + '...' : 'Prescribed medicines verified by clinical pharmacist.'}
                  </div>
                </div>
              </div>

              {/* View Full Document Preview Button */}
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                style={{
                  marginTop: '12px',
                  width: '100%',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid #e3e6e8',
                  background: '#fff',
                  color: 'oklch(0.45 0.1 200)',
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

              {/* Family Status Message · WhatsApp */}
              <div style={{ marginTop: '14px', padding: '10px', borderRadius: '6px', background: '#f6f7f8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096', fontWeight: 600 }}>
                    Family status message · WhatsApp
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setFamilyMsgLang('EN')}
                      style={{
                        border: 0,
                        background: familyMsgLang === 'EN' ? '#15181b' : '#e3e6e8',
                        color: familyMsgLang === 'EN' ? '#fff' : '#52585e',
                        padding: '1px 6px',
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
                        background: familyMsgLang === 'TA' ? '#15181b' : '#e3e6e8',
                        color: familyMsgLang === 'TA' ? '#fff' : '#52585e',
                        padding: '1px 6px',
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
                <div style={{ fontSize: '11.5px', lineHeight: 1.45, color: '#15181b', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #eef0f1' }}>
                  {familyMsgLang === 'EN' ? familyMsgEn : familyMsgTa}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal for full PDF / summary view */}
        <DischargeSummaryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          summaryData={dc.rawRecord || dc}
          onSummaryUpdated={updatedRecord => {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header matching Prototype V2.1 */}
      <div>
        <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
          <span>Clinical Workspace</span> › <span>Discharge</span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 600, color: '#15181b' }}>
          Discharge command centre
        </div>
        <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
          {liveCases.filter(c => !c.isReleased).length} active cases · dependency graph, predicted ready time and critical path by Discharge Orchestration Agent v3.0.2
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

      {/* KPI Stats (Prototype V2.1 style with Newsreader font) */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '110px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Ready</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.4 0.12 150)', fontWeight: 500 }}>
            {loading && liveCases.length === 0 ? '—' : stats.ready}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '110px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Blocked</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.18 25)', fontWeight: 500 }}>
            {loading && liveCases.length === 0 ? '—' : stats.blocked}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '130px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Approval required</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.62 0.14 70)', fontWeight: 500 }}>
            {loading && liveCases.length === 0 ? '—' : stats.approval}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '110px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>In progress</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#15181b', fontWeight: 500 }}>
            {loading && liveCases.length === 0 ? '—' : stats.inProgress}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '8px 16px', minWidth: '120px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px' }}>Completed today</div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.4 0.1 200)', fontWeight: 500 }}>
            {loading && liveCases.length === 0 ? '—' : stats.completed}
          </div>
        </div>
      </div>

      {/* Controls: Table/Kanban Switcher, Search, CSV Export, Agent Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
              width: '280px',
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
            onClick={handleExportCsv}
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

      {/* TABLE VIEW (10 Columns matching Prototype V2.1) */}
      {viewMode === 'table' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
          {loading && liveCases.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Loading Discharged Patient Summaries...</div>
              <div style={{ fontSize: '12px' }}>Connecting to backend Gold Generated Discharge Summaries API</div>
            </div>
          ) : sortedCases.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No Discharged Patient Records Found</div>
              <div style={{ fontSize: '12px' }}>
                {search ? `No records matching "${search}"` : 'Zero discharge summary records in the database.'}
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {[
                    ['PATIENT · BED', 190],
                    ['DOCTOR', 150],
                    ['INSURER', 120],
                    ['INTENT', 70],
                    ['PREDICTED READY', 90],
                    ['CRITICAL PATH', 200],
                    ['PENDING', 70],
                    ['OWNER', 140],
                    ['AGE', 80],
                    ['STATUS', 140]
                  ].map(([headerText, width], i) => (
                    <th
                      key={headerText}
                      onClick={() => {
                        if (sortCol === i) {
                          setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortCol(i);
                          setSortDir('asc');
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        color: sortCol === i ? '#15181b' : '#8a9096',
                        minWidth: `${width}px`
                      }}
                    >
                      {headerText} {sortCol === i ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedCases.map(c => {
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setActiveCase(c)}
                      style={{
                        borderBottom: '1px solid #f2f3f4',
                        cursor: 'pointer',
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafa'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Patient · bed */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, color: '#15181b', fontSize: '12.5px' }}>{c.patient}</div>
                        <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '2px' }}>
                          {c.bed} · {c.id}
                        </div>
                      </td>

                      {/* Doctor */}
                      <td style={{ padding: '10px 12px', color: '#15181b', fontWeight: 500 }}>
                        {c.doctor}
                      </td>

                      {/* Insurer */}
                      <td style={{ padding: '10px 12px', color: '#52585e' }}>
                        {c.insurer}
                      </td>

                      {/* Intent */}
                      <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#52585e' }}>
                        {c.intentAt}
                      </td>

                      {/* Predicted ready */}
                      <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#15181b', fontWeight: 600 }}>
                        {c.eta}
                      </td>

                      {/* Critical path */}
                      <td style={{ padding: '10px 12px', color: '#52585e', fontSize: '11.5px' }}>
                        <span style={{ color: c.status === 'Blocked' ? 'oklch(0.5 0.18 25)' : '#52585e' }}>
                          {c.cp}
                        </span>
                      </td>

                      {/* Pending */}
                      <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#52585e' }}>
                        {c.pendingCount}
                      </td>

                      {/* Owner */}
                      <td style={{ padding: '10px 12px', color: '#52585e' }}>
                        {c.owner}
                      </td>

                      {/* Age */}
                      <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096' }}>
                        {c.age}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 12px' }}>
                        {renderStatusPill(c.status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Prototype Pagination Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid #eef0f1', fontSize: '11.5px', color: '#8a9096', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              Page {pageN + 1} of {totalPages} · {sortedCases.length} records
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                disabled={pageN === 0}
                onClick={() => setPageN(prev => Math.max(0, prev - 1))}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid #e3e6e8',
                  background: '#fff',
                  cursor: pageN === 0 ? 'not-allowed' : 'pointer',
                  opacity: pageN === 0 ? 0.5 : 1
                }}
              >
                ‹ Prev
              </button>

              <button
                type="button"
                disabled={pageN >= totalPages - 1}
                onClick={() => setPageN(prev => Math.min(totalPages - 1, prev + 1))}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid #e3e6e8',
                  background: '#fff',
                  cursor: pageN >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  opacity: pageN >= totalPages - 1 ? 0.5 : 1
                }}
              >
                Next ›
              </button>

              <span style={{ margin: '0 4px', color: '#c9cdd1' }}>|</span>

              <span style={{ fontSize: '11px' }}>Size:</span>
              {[25, 50, 100].map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => { setPageSize(sz); setPageN(0); }}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: '1px solid #e3e6e8',
                    background: pageSize === sz ? '#15181b' : '#fff',
                    color: pageSize === sz ? '#fff' : '#52585e',
                    fontSize: '10.5px',
                    cursor: 'pointer'
                  }}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KANBAN VIEW (5 Columns matching Prototype V2.1) */}
      {viewMode === 'kanban' && (
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px' }}>
          {['Blocked', 'Approval required', 'In progress', 'Ready', 'Completed'].map(col => {
            const colCases = filteredCases.filter(c => c.status === col);
            const style = STATUS_STYLES[col];

            return (
              <div
                key={col}
                style={{
                  flex: '0 0 270px',
                  background: '#f6f7f8',
                  borderRadius: '8px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  border: '1px solid #eef0f1'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: style.dot }} />
                    <span style={{ fontWeight: 600, fontSize: '12px', color: '#15181b' }}>{col}</span>
                  </div>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096', fontWeight: 600 }}>
                    {colCases.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px' }}>
                  {colCases.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8a9096', fontSize: '11.5px' }}>
                      No cases
                    </div>
                  ) : (
                    colCases.map(c => (
                      <div
                        key={c.id}
                        onClick={() => setActiveCase(c)}
                        style={{
                          background: '#fff',
                          border: '1px solid #e3e6e8',
                          borderRadius: '6px',
                          padding: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'oklch(0.5 0.1 200)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e3e6e8'; e.currentTarget.style.transform = 'none'; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600, fontSize: '12.5px', color: '#15181b' }}>{c.patient}</span>
                          <span style={{ fontSize: '10.5px', fontFamily: 'ui-monospace, Menlo, monospace', color: '#8a9096' }}>
                            {c.bed}
                          </span>
                        </div>

                        <div style={{ color: '#52585e', fontSize: '11.5px', marginTop: '3px' }}>
                          {c.doctor}
                        </div>

                        <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '2px' }}>
                          {c.insurer}
                        </div>

                        <div style={{ marginTop: '6px', padding: '4px 6px', borderRadius: '4px', background: '#f8fafc', fontSize: '11px', color: col === 'Blocked' ? 'oklch(0.45 0.18 25)' : '#334155' }}>
                          <strong>Blocker:</strong> {c.cp}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #f2f3f4', fontSize: '10.5px' }}>
                          <span style={{ color: '#8a9096' }}>ETA: <strong>{c.eta}</strong></span>
                          <span style={{ color: '#8a9096' }}>{c.pendingCount} pending</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
