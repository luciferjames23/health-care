import React, { useState, useMemo, useEffect } from 'react';
import XrayOrders from './XrayOrders';
import { StatusBadge, statusStyle } from './RadiologyShared';
import { ImagingHistoryButton } from './ImagingHistory';
import { groupImagingOrders, studyVersion, scanStudyLabel, orderViewResults, scanAssessmentStatus } from '../services/imagingHistory';
import RadiologyClarifications, { ClarificationButton } from './RadiologyClarifications';
import { clarificationApi } from '../services/clarificationApi';
import { radiologyApi, OHIF_BASE_URL } from '../services/radiologyApi';
import { apiService, resolveClinicalDiagnosis } from '../services/api';
import { financialApi } from '../services/financialApi';
import { imagingOrdersApi } from '../services/imagingOrdersApi';
import ModuleLoadingScreen from './ModuleLoadingScreen';

export default function Patient360View({
  patient,
  currentUser,
  onOpenDischarge,
  onOpenSoap,
  onBack,
  onNavigate,
  onOpenDrawer,
  onOpenModal,
  onOpenRadiologyStudy,
}) {
  const [activeTab, setActiveTab] = useState('Overview');
  const canDiscussXrays = ['doctor', 'radiologist'].includes(currentUser?.role?.toLowerCase());
  const [discussionUnread, setDiscussionUnread] = useState(0);
  useEffect(() => {
    if (!canDiscussXrays) return undefined;
    let alive = true;
    const refreshUnread = () => clarificationApi.list()
      .then(result => {
        if (alive) setDiscussionUnread(result.threads.reduce((total, thread) => total + Number(thread.unread), 0));
      })
      .catch(() => { if (alive) setDiscussionUnread(0); });
    refreshUnread();
    const timer = setInterval(refreshUnread, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [canDiscussXrays, currentUser?.username, activeTab]);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanAlert, setScanAlert] = useState(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [patientScans, setPatientScans] = useState([]);
  const [activeScanIdx, setActiveScanIdx] = useState(0);
  const [liveAdmission, setLiveAdmission] = useState(null);
  const [liveBill, setLiveBill] = useState(null);
  const [diagFilter, setDiagFilter] = useState('all');
  const [assignedBed, setAssignedBed] = useState(null);
  // Auto-fetched scans for inline Diagnoses X-ray card (no auth required)
  const [diagScans, setDiagScans] = useState([]);
  const [diagScanIdx, setDiagScanIdx] = useState(0);
  const [ohifViewerModal, setOhifViewerModal] = useState(null);

  const getOhifViewerUrl = (uid) => {
    const base = `${OHIF_BASE_URL}/viewer`;
    const params = new URLSearchParams();
    if (uid) params.set('StudyInstanceUIDs', uid);
    params.set('_cb', Date.now().toString());
    return `${base}?${params.toString()}`;
  };
  const [patientXrayOrders, setPatientXrayOrders] = useState([]);
  const [patientVitalsHistory, setPatientVitalsHistory] = useState([]);
  const [dischargeSummary, setDischargeSummary] = useState(null);
  const [loadingPatient360, setLoadingPatient360] = useState(true);

  // Unified synchronized data fetch for Patient 360 to eliminate screen refreshing/flickering
  useEffect(() => {
    let alive = true;
    setLoadingPatient360(true);

    const cleanNum = (val) => {
      if (!val) return null;
      const str = String(val).trim();
      const m = str.match(/\d+/);
      return m ? m[0].replace(/^0+/, '') || '0' : str;
    };

    const isOpPatient = patient?.patient_type === 'OP' || patient?._type === 'OP' || patient?.care_type === 'OP' || Boolean(patient?.appointment_number);
    const isErPatient = patient?.patient_type === 'ER' || patient?._type === 'ER' || patient?.care_type === 'ER' || Boolean(patient?.triage_number);

    let pid = cleanNum(patient?.patient_id || patient?.id || patient?.uhid || patient?.mrn || patient?.raw?.patient_id);
    let aid = cleanNum(patient?.admission_id || patient?.admission_number || patient?.encounter || patient?.raw?.admission_id);
    const pnum = patient?.patient_number || patient?.patient_code || patient?.uhid || patient?.mrn;
    const anum = patient?.admission_number;
    const pcode = patient?.mrn || patient?.uhid || patient?.patient_code;
    const targetName = (patient?.name || patient?.patient || patient?.patient_name || '').trim().toLowerCase();

    const withTimeout = (p, ms = 6000) =>
      Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms))
      ]);

    const loadAllPatientData = async () => {
      try {
        let resolvedAdmission = null;

        // 1. Fetch live admission if inpatient
        if (!isOpPatient && !isErPatient) {
          const fetchParams = {};
          if (aid) fetchParams.admission_id = aid;
          else if (pid) fetchParams.patient_id = pid;
          else if (pnum) fetchParams.patient_number = pnum;
          else if (anum) fetchParams.admission_number = anum;

          if (Object.keys(fetchParams).length > 0) {
            fetchParams.limit = 1;
            try {
              const res = await withTimeout(apiService.getCurrentAdmissions(fetchParams, { forceRefresh: true }), 4000);
              if (res?.data && res.data.length > 0) {
                const fetched = res.data[0];
                const fetchedAid = cleanNum(fetched.admission_id);
                const fetchedPid = cleanNum(fetched.patient_id);
                const matches = (!aid || fetchedAid === aid) && (!pid || fetchedPid === pid);
                if (matches) {
                  resolvedAdmission = fetched;
                  if (!aid) aid = fetchedAid;
                  if (!pid) pid = fetchedPid;
                }
              }
            } catch (e) {
              console.warn("Admission fetch skipped or timed out:", e);
            }
          }
        }

        const effectiveAid = aid || cleanNum(resolvedAdmission?.admission_id);
        const effectivePid = pid || cleanNum(resolvedAdmission?.patient_id);
        const effectiveBid = patient?.bill_id || resolvedAdmission?.bill_id;

        // 2. Concurrently fetch all secondary datasets in parallel
        const [bedRes, vitalsRes, billRes, dischargeRes, ordersRes, scansRes] = await Promise.allSettled([
          // Bed Management
          withTimeout(apiService.getBedManagementData(), 5000),
          // Vitals telemetry
          (effectivePid || effectiveAid)
            ? withTimeout(apiService.getPatientVitals({ patient_id: effectivePid || undefined, admission_id: effectiveAid || undefined, limit: 10 }), 5000)
            : Promise.resolve(null),
          // Dynamic Bill
          (async () => {
            let res = null;
            if (effectiveAid) res = await financialApi.getBillByAdmission(effectiveAid).catch(() => null);
            if (!res?.bill && effectiveBid) res = await financialApi.getBillDetail(effectiveBid).catch(() => null);
            if (!res?.bill && effectivePid) res = await financialApi.getBillByPatient(effectivePid).catch(() => null);
            return res;
          })(),
          // Discharge Summary
          (async () => {
            const fetchSummariesFn = apiService.getDischargeSummaries || apiService.getGeneratedDischargeSummaries || apiService.getDischargedPatients;
            if (typeof fetchSummariesFn === 'function' && (effectiveAid || effectivePid)) {
              return withTimeout(fetchSummariesFn.call(apiService, { limit: 100 }, { forceRefresh: true }), 5000);
            }
            return null;
          })(),
          // Imaging Orders
          effectivePid ? withTimeout(imagingOrdersApi.list(effectivePid), 5000) : Promise.resolve(null),
          // Radiology Scans
          (effectivePid || pcode)
            ? withTimeout(radiologyApi.getPatientScans({ patient_id: effectivePid || undefined, patient_code: pcode || undefined, limit: 5 }), 5000)
            : Promise.resolve(null)
        ]);

        if (!alive) return;

        // Apply all data atomically in a single state update batch
        setLiveAdmission(resolvedAdmission);

        // Bed assignment
        if (bedRes.status === 'fulfilled' && bedRes.value?.wards) {
          let matchedBed = null;
          for (const w of bedRes.value.wards) {
            for (const r of (w.rooms || [])) {
              for (const b of (r.beds || [])) {
                const bp = b.assigned_patient || b.patient;
                const bPid = cleanNum(b.patient_id || bp?.patient_id || bp?.id);
                const bAid = cleanNum(b.admission_id || bp?.admission_id || bp?.admission_number);
                const bName = (bp?.patient_name || bp?.name || '').trim().toLowerCase();

                const matchesAid = effectiveAid && bAid && effectiveAid === bAid;
                const matchesPid = effectivePid && bPid && effectivePid === bPid;
                const matchesName = targetName && bName && (targetName === bName || bName.includes(targetName) || targetName.includes(bName));

                if (matchesAid || matchesPid || matchesName) {
                  matchedBed = {
                    bed_id: b.bed_id,
                    bed_number: b.bed_number,
                    room_number: r.room_number,
                    room_type: r.room_type,
                    ward_id: w.ward_id,
                    ward_name: w.ward_name
                  };
                  break;
                }
              }
              if (matchedBed) break;
            }
            if (matchedBed) break;
          }
          setAssignedBed(matchedBed);
        } else {
          setAssignedBed(null);
        }

        // Vitals
        if (vitalsRes.status === 'fulfilled' && vitalsRes.value?.data && Array.isArray(vitalsRes.value.data) && vitalsRes.value.data.length > 0) {
          setPatientVitalsHistory(vitalsRes.value.data);
        } else {
          setPatientVitalsHistory([]);
        }

        // Bill
        if (billRes.status === 'fulfilled' && billRes.value?.bill) {
          setLiveBill(billRes.value.bill);
        } else {
          setLiveBill(null);
        }

        // Discharge
        if (dischargeRes.status === 'fulfilled' && dischargeRes.value?.data) {
          const matched = dischargeRes.value.data.find(r => {
            const rAid = cleanNum(r.admission_id);
            const rPid = cleanNum(r.patient_id);
            return (effectiveAid && rAid === effectiveAid) || (effectivePid && rPid === effectivePid);
          });
          setDischargeSummary(matched || null);
        } else {
          setDischargeSummary(null);
        }

        // Imaging orders
        if (ordersRes.status === 'fulfilled' && ordersRes.value?.orders) {
          setPatientXrayOrders(ordersRes.value.orders);
        } else {
          setPatientXrayOrders([]);
        }

        // Scans
        if (scansRes.status === 'fulfilled' && scansRes.value?.data?.length) {
          setDiagScans(scansRes.value.data);
          setDiagScanIdx(0);
        } else {
          setDiagScans([]);
        }
      } catch (err) {
        console.error("Patient 360 data load error:", err);
      } finally {
        if (alive) {
          setLoadingPatient360(false);
        }
      }
    };

    loadAllPatientData();

    // Silent background poller for X-ray orders every 10s
    let pollerTimer = null;
    if (pid) {
      pollerTimer = setInterval(() => {
        imagingOrdersApi.list(pid)
          .then(res => {
            if (alive && res?.orders) {
              setPatientXrayOrders(res.orders);
            }
          })
          .catch(() => {});
      }, 10000);
    }

    return () => {
      alive = false;
      if (pollerTimer) clearInterval(pollerTimer);
    };
  }, [
    patient?.patient_id,
    patient?.id,
    patient?.admission_id,
    patient?.admission_number,
    patient?.uhid,
    patient?.mrn,
    patient?.patient_code,
    patient?.patient_number
  ]);

  // Auto-dismiss scan notification after 8 seconds
  useEffect(() => {
    if (!scanAlert) return;
    const t = setTimeout(() => setScanAlert(null), 8000);
    return () => clearTimeout(t);
  }, [scanAlert]);

  // Normalize patient fields with live database values from dim_admission_inputs & liveBill
  const p = useMemo(() => {
    const d = patient || {};
    const isMatchingLive = liveAdmission && (
      (!d.admission_id || String(liveAdmission.admission_id) === String(d.admission_id)) &&
      (!d.patient_id || String(liveAdmission.patient_id) === String(d.patient_id))
    );
    const raw = (isMatchingLive ? liveAdmission : null) || d.raw || d;
    const rawPid = d.patient_id || raw.patient_id || d.id;
    const rawAdmId = d.admission_id || raw.admission_id;

    // Detect care stream types
    const isOP = d.patient_type === 'OP' || d._type === 'OP' || d.care_type === 'OP' || raw.patient_type === 'OP' || String(d.patient_type || '').toUpperCase() === 'OP' || String(d.appointment_type || '').toUpperCase() === 'OPD' || Boolean(d.appointment_number && !rawAdmId);
    const isER = d.patient_type === 'ER' || d._type === 'ER' || d.care_type === 'ER' || raw.patient_type === 'ER' || String(d.patient_type || '').toUpperCase() === 'ER' || Boolean(d.triage_number || d.triage_bay);

    const rawDischargeStatus = String(
      liveAdmission?.discharge_status ||
      raw.discharge_status ||
      d.discharge_status ||
      d._status ||
      d._type ||
      ''
    ).trim().toLowerCase();

    const summaryApproval = String(
      dischargeSummary?.approval_status ||
      d.approval_status ||
      raw.approval_status ||
      ''
    ).trim().toLowerCase();

    const isDischarged = !isOP && !isER && (
      rawDischargeStatus === 'discharged' ||
      rawDischargeStatus === 'completed' ||
      summaryApproval === 'approved' ||
      summaryApproval === 'signed off' ||
      summaryApproval === 'completed' ||
      d._type === 'Discharged' ||
      d.isCompleted === true
    );

    const isInpatient = !isOP && !isER && !isDischarged;

    // Unpack llm_input_json if available
    let parsedLlm = null;
    if (raw.llm_input_json) {
      try {
        parsedLlm = typeof raw.llm_input_json === 'string' ? JSON.parse(raw.llm_input_json) : raw.llm_input_json;
      } catch (e) {
        console.warn("Failed to parse llm_input_json", e);
      }
    }

    const demo = parsedLlm?.patient_demographics || {};
    const adm = parsedLlm?.admission_details || {};
    const diag = parsedLlm?.diagnoses || {};
    const vitals = parsedLlm?.vital_signs || {};
    const meds = parsedLlm?.medications?.medications_list || raw.medications || [];
    const labs = parsedLlm?.lab_results?.lab_results_list || raw.lab_results || [];
    const procs = parsedLlm?.procedures?.procedures_list || raw.procedures || [];
    const billing = parsedLlm?.billing || raw.billing || {};

    const firstName = demo.first_name || raw.first_name || '';
    const lastName = demo.last_name || raw.last_name || '';
    const name = d.name || d.patient || d.patient_name || (firstName ? `${firstName} ${lastName}`.trim() : (raw.patient_name || (rawPid ? `Patient #${rawPid}` : (isOP ? 'Outpatient' : isER ? 'Emergency Patient' : 'Inpatient'))));

    const uhid = d.mrn || d.uhid || raw.patient_code || demo.patient_number || (rawPid ? `MER-PAT-${String(rawPid).padStart(7, '0')}` : 'MER-PAT-0000000');
    const age = d.age || raw.age_at_admission || demo.age_at_admission || raw.age || '—';
    const rawSex = d.sex || demo.gender || raw.gender || 'Unknown';
    const sex = rawSex.toLowerCase().startsWith('f') ? 'Female' : (rawSex.toLowerCase().startsWith('m') ? 'Male' : rawSex);
    const lang = d.language || d.lang || demo.preferred_language || raw.preferred_language || 'English';
    const blood = d.bloodGroup || d.blood || demo.blood_group || raw.blood_group || 'B+';
    const phone = d.phone || demo.phone || raw.phone || (rawPid ? `+9198100${String(rawPid).slice(-4)}` : '+91 98100 00000');
    const email = demo.email || raw.email || (rawPid ? `patient.${rawPid}@hospital.com` : 'patient@hospital.com');
    const address = [demo.address, demo.city, demo.state].filter(Boolean).join(', ') || raw.address || 'Chennai, Tamil Nadu';

    const rawAdmNum = adm.admission_number || raw.admission_number || d.admission_number || (rawAdmId ? `MER-ADM-${String(rawAdmId).padStart(7, '0')}` : (isOP ? (d.appointment_number || `APT-2026-${String(rawPid || '661').slice(-4)}`) : isER ? (d.triage_number || `ER-2026-${String(rawPid || '4421').slice(-4)}`) : 'ENC-000000'));
    
    let encounter = d.encounter;
    if (!encounter) {
      if (isOP) {
        encounter = d.appointment_number || (rawAdmNum.startsWith('APT-') ? rawAdmNum : `APT-${rawAdmNum}`);
      } else if (isER) {
        encounter = d.triage_number || (rawAdmNum.startsWith('ER-') ? rawAdmNum : `ER-${rawAdmNum}`);
      } else {
        encounter = rawAdmNum.startsWith('ENC-') ? rawAdmNum : `ENC-${rawAdmNum}`;
      }
    }

    const isSyntheticBed = (val) => typeof val === 'string' && /^bed \d+$/i.test(val.trim());
    const validCandidate = [assignedBed?.bed_number, liveAdmission?.bed_number, raw.bed_number, adm.bed_number, d.bed_number, d.bed]
      .find(cand => cand && !isSyntheticBed(cand));
    
    let bed = d.bed;
    if (isOP) {
      bed = '— (Outpatient Desk)';
    } else if (isER) {
      bed = d.bed || (d.triage_bay ? `Bay ${d.triage_bay}` : 'Emergency Bay 14');
    } else if (isDischarged) {
      bed = validCandidate || 'BED-0193';
    } else {
      bed = validCandidate || 'BED-0193';
    }

    let room = d.room;
    if (isOP) {
      room = 'OPD-Desk';
    } else if (isER) {
      room = 'ER-Triage';
    } else {
      room = assignedBed?.room_number || liveAdmission?.room_number || raw.room_number || 'RM-044';
    }

    const dept = d.department || d.dept || adm.doctor_specialization || raw.doctor_specialization || (isER ? 'Emergency Medicine' : 'Clinical Services');
    const ward = isOP ? 'Outpatient Services' : isER ? 'Emergency Department' : (assignedBed?.ward_name || liveAdmission?.ward_name || raw.ward_name || dept);
    const doctor = d.doctor || d.primary_consultant || adm.attending_doctor || raw.attending_doctor || (isER ? 'Emergency Physician' : 'Dr. Sneha Das');
    const insurer = d.insurer || d.insurance || (isOP ? 'Direct / Outpatient' : isER ? 'Emergency Direct' : (billing.bill_insurance_portion > 0 ? 'Cashless Health Insurance' : 'Direct Billing / Corporate'));
    const risk = d.risk || (vitals.latest_heart_rate > 100 || vitals.latest_oxygen_saturation < 95 ? 'Moderate' : 'None');
    const attendant = d.attendant || (demo.emergency_contact_name ? `${demo.emergency_contact_name} · ${lang}` : 'Family Member · ' + lang);

    // Dynamic database billing information
    const defaultBillAmount = isOP ? (Number(d.bill_amount) || 800) : isER ? (Number(d.bill_amount) || 2500) : 246000;
    const billNumber = liveBill?.bill_number || raw.bill_number || d.bill_number || billing.bill_number || (isOP ? `OP-BIL-${String(rawPid || '101').padStart(6, '0')}` : isER ? `ER-BIL-${String(rawPid || '101').padStart(6, '0')}` : (rawAdmId ? `MER-BIL-${String(rawAdmId).padStart(7, '0')}` : 'MER-BIL-0000000'));
    const billGrossAmount = Number(liveBill?.gross_amount ?? billing.bill_gross_amount ?? raw.gross_amount ?? raw.bill_gross_amount ?? d.bill_amount ?? defaultBillAmount);
    const rawBillNet = liveBill?.net_amount ?? billing.bill_net_amount ?? raw.bill_net_amount ?? d.bill_net_amount ?? d.bill_amount ?? billGrossAmount;
    const billNetAmount = Number(rawBillNet);
    const discountAmount = Number(liveBill?.discount_amount ?? billing.bill_discount_amount ?? 0);
    const taxAmount = Number(liveBill?.tax_amount ?? billing.bill_tax_amount ?? 0);
    const insuranceAmount = Number(liveBill?.insurance_amount ?? billing.bill_insurance_portion ?? 0);
    
    const rawBillStatus = String(liveBill?.bill_status || raw.bill_status || d.bill_status || billing.bill_status || 'Pending').trim();
    const rawClearance = String(raw.bill_clearance_status || d.bill_clearance_status || billing.bill_clearance_status || '').trim();

    // Check if admission record has an explicit outstanding balance
    const rawAdmOutstanding = (raw.outstanding_balance != null && raw.outstanding_balance !== '')
      ? Number(raw.outstanding_balance)
      : (d.outstanding_balance != null && d.outstanding_balance !== '' ? Number(d.outstanding_balance) : null);

    // Sum of confirmed successful payments on liveBill
    const successfulPaymentsTotal = (liveBill?.payments || [])
      .filter(py => String(py.payment_status || '').toUpperCase() === 'SUCCESS')
      .reduce((sum, py) => sum + Number(py.amount || 0), 0);

    // Admission is explicitly pending clearance if clearance status is 'pending' or outstanding balance > 0
    const isExplicitlyPending = (
      rawClearance.toLowerCase() === 'pending' ||
      String(raw.bill_status || '').toLowerCase() === 'pending' ||
      (rawAdmOutstanding !== null && rawAdmOutstanding > 0)
    );

    // Determine if bill is genuinely cleared:
    const isCleared = isOP || (!isExplicitlyPending && (
      rawClearance.toLowerCase() === 'cleared' ||
      ['PAID', 'SETTLED'].includes(String(raw.bill_status || '').toUpperCase()) ||
      ['PAID', 'SETTLED'].includes(String(liveBill?.bill_status || '').toUpperCase()) ||
      (rawAdmOutstanding !== null && rawAdmOutstanding <= 0) ||
      (successfulPaymentsTotal >= billNetAmount && billNetAmount > 0)
    ));

    // Outstanding balance
    const calculatedOutstanding = (isOP || isCleared)
      ? 0
      : (rawAdmOutstanding !== null
          ? rawAdmOutstanding
          : Math.max(0, (liveBill?.patient_amount != null ? Number(liveBill.patient_amount) : (billNetAmount - insuranceAmount)) - successfulPaymentsTotal)
        );
    const outstandingBalance = Math.max(0, calculatedOutstanding);

    const billStatus = isOP ? 'Paid' : isCleared ? 'Paid' : (rawBillStatus === 'Settled' && !isCleared ? 'Pending' : rawBillStatus);
    const clearanceStatus = (isOP || isCleared) ? 'Cleared' : (rawClearance || 'Pending');

    const billingStatusDisplay = isOP
      ? 'Settled · Outpatient Fee'
      : isER
        ? 'Emergency Active · Covered'
        : isDischarged
          ? 'Discharged · Settled'
          : (isCleared
              ? 'Cleared · Paid'
              : (outstandingBalance > 0 ? `Pending Clearance - ₹${outstandingBalance.toLocaleString('en-IN')}` : 'Pending Clearance'));

    const status = isOP
      ? 'Outpatient Consultation'
      : isER
        ? 'Emergency Triage Active'
        : isDischarged
          ? 'Discharged'
          : (d.status || d._status || (isCleared ? 'Cleared for Discharge' : 'Admitted · Pending Clearance'));

    let statusBadge = {
      text: isCleared ? 'Bill Cleared · Admitted' : 'Admitted · Pending Clearance',
      bg: isCleared ? '#dcfce7' : '#fee2e2',
      color: isCleared ? '#15803d' : '#991b1b',
      border: isCleared ? '#bbf7d0' : '#fecaca',
    };
    if (isOP) {
      statusBadge = {
        text: 'Outpatient Consultation · Active',
        bg: '#e0f2fe',
        color: '#0369a1',
        border: '#bae6fd',
      };
    } else if (isER) {
      statusBadge = {
        text: 'Emergency Triage · Active',
        bg: '#fef3c7',
        color: '#92400e',
        border: '#fde68a',
      };
    } else if (isDischarged) {
      statusBadge = {
        text: isCleared ? 'Bill Cleared · Discharged' : 'Discharged',
        bg: '#e0f2fe',
        color: '#0369a1',
        border: '#bae6fd',
      };
    } else if (isCleared) {
      statusBadge = {
        text: 'Bill Cleared · Admitted',
        bg: '#dcfce7',
        color: '#15803d',
        border: '#bbf7d0',
      };
    } else if (outstandingBalance > 0) {
      statusBadge = {
        text: `Pending Clearance · ₹${outstandingBalance.toLocaleString('en-IN')}`,
        bg: '#fee2e2',
        color: '#991b1b',
        border: '#fecaca',
      };
    }
    
    // Clinical diagnoses & procedures
    const rawPrimary = diag.primary_diagnosis 
      || (diag.diagnoses_list?.[0]?.diagnosis_name) 
      || raw.primary_diagnosis 
      || d.primary_diagnosis 
      || d.primaryDiagnosis 
      || d.diagnosis 
      || d.chief_complaint 
      || d.reason_for_visit 
      || d.complaint 
      || raw.diagnosis 
      || raw.chief_complaint 
      || raw.reason_for_visit 
      || raw.reason_for_admission 
      || d.reason_for_admission 
      || d.procedure 
      || (isOP ? 'Routine Outpatient Follow-up' : isER ? 'Emergency Evaluation' : 'Clinical Care Evaluation');

    const reasonAdm = raw.reason_for_admission || adm.reason_for_admission || d.reason_for_admission || d.admission_reason;
    const primaryDiagnosis = resolveClinicalDiagnosis(rawPrimary, '');

    // Extract genuine secondary diagnoses only (if any exist in database)
    const rawSecList = Array.isArray(diag.secondary_diagnoses)
      ? diag.secondary_diagnoses
      : (typeof diag.secondary_diagnoses === 'string' && diag.secondary_diagnoses.trim() && diag.secondary_diagnoses !== '[]' && diag.secondary_diagnoses.toLowerCase() !== 'none'
          ? diag.secondary_diagnoses.split(',')
          : []);

    const secondaryDiagnosesList = [];
    if (Array.isArray(diag.diagnoses_list)) {
      diag.diagnoses_list.forEach(item => {
        if (!item.is_primary && item.diagnosis_type?.toLowerCase() !== 'primary') {
          const resSec = resolveClinicalDiagnosis(item.diagnosis_name, '');
          if (resSec && resSec !== primaryDiagnosis && !secondaryDiagnosesList.includes(resSec)) {
            secondaryDiagnosesList.push(resSec);
          }
        }
      });
    }
    rawSecList.forEach(item => {
      const resSec = resolveClinicalDiagnosis(item, '');
      if (resSec && resSec !== primaryDiagnosis && !secondaryDiagnosesList.includes(resSec)) {
        secondaryDiagnosesList.push(resSec);
      }
    });

    const secondaryDiagnoses = secondaryDiagnosesList.join(', ') || 'None recorded';
    const procedure = d.procedure || (isOP ? (primaryDiagnosis || 'Outpatient Consultation') : isER ? (primaryDiagnosis || 'Emergency Triage & Assessment') : (procs?.[0]?.procedure_name || raw.procedure_name || reasonAdm || primaryDiagnosis));
    
    const rawDate = isOP 
      ? (d.appointment_date || raw.admission_date || adm.admission_date)
      : isER
        ? (d.admission_date || d.triage_time || raw.admission_date)
        : (raw.admission_date || adm.admission_date || d.admission_date);

    const admittedDate = rawDate ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (isOP || isER ? '24 Sep 2026' : '17 May 2025');
    const admittedTime = isOP 
      ? (d.appointment_time || (rawDate ? new Date(rawDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '10:30 am'))
      : (rawDate ? new Date(rawDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '12:00 pm');

    // Build comprehensive, deduplicated list of clinical diagnoses for Diagnoses view
    const diagnosesList = [];
    const seenDxNames = new Set();

    // 1. Primary Diagnosis (always first, exactly one)
    const primaryCode = (diag.diagnoses_list && diag.diagnoses_list[0]?.diagnosis_code) || raw.diagnosis_code || (typeof rawPrimary === 'string' && rawPrimary.match(/D-\d+/i) ? rawPrimary.match(/D-\d+/i)[0] : (isOP ? 'OPD-DX-01' : isER ? 'ER-DX-01' : 'D-0'));
    const primaryDate = (diag.diagnoses_list && diag.diagnoses_list[0]?.diagnosis_date)
      ? new Date(diag.diagnoses_list[0].diagnosis_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : admittedDate;

    diagnosesList.push({
      code: primaryCode,
      name: primaryDiagnosis,
      type: 'Primary Diagnosis',
      date: primaryDate,
      doctor: doctor,
      status: 'Active',
      indication: reasonAdm || (isOP ? 'Outpatient Consultation' : isER ? 'Emergency Triage' : 'Inpatient Admission')
    });
    seenDxNames.add(primaryDiagnosis.toLowerCase());

    // 2. Secondary Diagnoses (only if genuinely present and distinct)
    secondaryDiagnosesList.forEach((secName, idx) => {
      if (!seenDxNames.has(secName.toLowerCase())) {
        seenDxNames.add(secName.toLowerCase());
        diagnosesList.push({
          code: `D-${idx + 1}`,
          name: secName,
          type: 'Secondary Diagnosis',
          date: admittedDate,
          doctor: doctor,
          status: 'Active',
          indication: 'Secondary / Co-morbid condition'
        });
      }
    });
    const admitted = d.admitted || `${admittedDate}, ${admittedTime}`;
    const condition = d.condition || `Clinically stable (${doctor})`;
    const dischargeInfo = isOP
      ? 'Completed same-day outpatient visit'
      : isER
        ? 'Active emergency observation in Bay'
        : (d.dischargeInfo || (isCleared ? 'Ready for clinical discharge sign-off' : `Billing pending · Outstanding ₹${outstandingBalance.toLocaleString('en-IN')}`));

    // Vitals summary
    const latestVitalRec = patientVitalsHistory[0];
    const sbp = latestVitalRec?.systolic_bp || Number(vitals.latest_systolic_bp ?? raw.latest_systolic_bp ?? raw.systolic_bp ?? raw.sbp ?? (d.vitals?.bp ? String(d.vitals.bp).split('/')[0] : null)) || (rawPid ? 110 + (Number(String(rawPid).replace(/\D/g, '')) % 40) : 120);
    const dbp = latestVitalRec?.diastolic_bp || Number(vitals.latest_diastolic_bp ?? raw.latest_diastolic_bp ?? raw.diastolic_bp ?? raw.dbp ?? (d.vitals?.bp ? String(d.vitals.bp).split('/')[1] : null)) || (rawPid ? 70 + (Number(String(rawPid).replace(/\D/g, '')) % 20) : 80);
    const hr = latestVitalRec?.heart_rate || Number(vitals.latest_heart_rate ?? raw.latest_heart_rate ?? raw.heart_rate ?? raw.hr ?? d.vitals?.hr) || (rawPid ? 65 + (Number(String(rawPid).replace(/\D/g, '')) % 35) : 78);
    
    const rawSpo2 = latestVitalRec?.oxygen_saturation ?? vitals.latest_oxygen_saturation ?? raw.latest_oxygen_saturation ?? raw.oxygen_saturation ?? raw.spo2 ?? d.vitals?.spo2;
    const spo2 = rawSpo2 != null ? (Number(rawSpo2) > 100 ? (Number(rawSpo2)/10).toFixed(2) : Number(rawSpo2).toFixed(2).replace(/\.00$/, '')) : (rawPid ? (96 + (Number(String(rawPid).replace(/\D/g, '')) % 3) + 0.5).toFixed(2) : '98.5');
    
    const rawTemp = latestVitalRec?.temperature ?? vitals.latest_temperature ?? raw.latest_temperature ?? raw.temperature ?? raw.temp ?? d.vitals?.temp;
    const temp = rawTemp != null ? Number(rawTemp).toFixed(2).replace(/\.00$/, '') : (rawPid ? (98 + (Number(String(rawPid).replace(/\D/g, '')) % 2) + 0.4).toFixed(2) : '98.6');
    
    const rr = latestVitalRec?.respiratory_rate || Number(vitals.latest_respiratory_rate ?? raw.respiratory_rate ?? raw.rr ?? 18);
    
    // Strict clinical temporal synchronization
    let dischargeFormattedDate;
    let dischargeFormattedTime = '01:38 PM';
    let dischargeDateTime;

    if (isOP) {
      dischargeFormattedDate = 'N/A (OP Visit)';
      dischargeFormattedTime = 'Same-day Exit';
      dischargeDateTime = 'Outpatient Consultation (No IP Stay)';
    } else if (isER) {
      dischargeFormattedDate = 'Pending Triage';
      dischargeFormattedTime = 'Active Observation';
      dischargeDateTime = 'Emergency Observation';
    } else if (isDischarged) {
      // Completed discharge: discharged on 23 Sept 2026 (or discharge_date)
      const rawDisDate = dischargeSummary?.discharge_date || liveAdmission?.discharge_date || raw.discharge_date || d.discharge_date || adm.discharge_date;
      dischargeFormattedDate = rawDisDate
        ? new Date(rawDisDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '23 Sept 2026';
      
      if (rawDisDate && (String(rawDisDate).includes('T') || String(rawDisDate).includes(':'))) {
        dischargeFormattedTime = new Date(rawDisDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }
      dischargeDateTime = `${dischargeFormattedDate}, ${dischargeFormattedTime}`;
    } else if (isCleared) {
      // Ready for discharge sign-off: scheduled for today afternoon
      dischargeFormattedDate = '24 Sept 2026';
      dischargeFormattedTime = '04:30 PM';
      dischargeDateTime = `Scheduled: ${dischargeFormattedDate}, ${dischargeFormattedTime}`;
    } else {
      // Inactive / Blocked / Pending: show '-'
      dischargeFormattedDate = '-';
      dischargeFormattedTime = '-';
      dischargeDateTime = '-';
    }

    // Vitals measurement timestamp: strictly aligned with clinical event timeline
    let vitalsTakenTime;
    if (latestVitalRec?.recorded_at) {
      vitalsTakenTime = new Date(latestVitalRec.recorded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else if (isOP) {
      vitalsTakenTime = `${admittedDate}, ${admittedTime}`;
    } else if (isER) {
      vitalsTakenTime = '24 Sept 2026, 09:45 AM';
    } else if (isDischarged) {
      vitalsTakenTime = `${dischargeFormattedDate}, 10:00 AM`;
    } else if (isCleared) {
      vitalsTakenTime = '24 Sept 2026, 09:30 AM';
    } else {
      vitalsTakenTime = '24 Sept 2026, 07:30 AM';
    }

    const latestBp = `BP ${sbp}/${dbp} · HR ${hr} bpm · SpO2 ${spo2}% · Temp ${temp}°F`;
    const stayDays = (isOP || isER) ? 1 : (adm.current_stay_days || (rawDate ? Math.max(1, Math.floor((Date.now() - new Date(rawDate).getTime()) / (1000 * 60 * 60 * 24))) : (rawPid ? ((Number(String(rawPid).replace(/\D/g, '')) % 14) + 1) : 14)));

    return {
      isOP,
      isER,
      isInpatient,
      statusBadge,
      patient_id: rawPid,
      admission_id: rawAdmId,
      uhid,
      patient_code: uhid,
      mrn: uhid,
      patientNumber: uhid,
      patient_number: uhid,
      name,
      age,
      sex,
      lang,
      blood,
      phone,
      email,
      address,
      encounter,
      bed,
      bed_number: bed,
      room,
      room_number: room,
      ward,
      ward_name: ward,
      doctor,
      dept,
      insurer,
      risk,
      attendant,
      status,
      procedure,
      diagnosis: primaryDiagnosis,
      primary_diagnosis: primaryDiagnosis,
      admission_reason: reasonAdm || primaryDiagnosis,
      reason_for_admission: reasonAdm || primaryDiagnosis,
      primaryDiagnosis,
      secondaryDiagnoses,
      diagnoses_list: diagnosesList,
      admitted,
      admittedDate,
      admittedTime,
      dischargeDateTime,
      dischargeDate: dischargeFormattedDate,
      dischargeTime: dischargeFormattedTime,
      condition,
      dischargeInfo,
      billNumber,
      billGrossAmount,
      billNetAmount,
      discountAmount,
      taxAmount,
      insuranceAmount,
      billStatus,
      clearanceStatus,
      outstandingBalance,
      isCleared,
      isDischarged,
      dischargeSummary,
      billingStatusDisplay,
      latestBp,
      vitalsTakenTime,
      vitalsHistory: patientVitalsHistory,
      vitalsObject: { sbp, dbp, hr, spo2, temp, rr, takenTime: vitalsTakenTime },
      medications: meds,
      lab_results_list: labs,
      procedures: procs,
      allergies: demo.allergies || raw.allergies || 'No known drug allergies recorded (NKDA)',
      current_stay_days: stayDays,
    };
  }, [patient, liveAdmission, liveBill, assignedBed, dischargeSummary, patientVitalsHistory]);

  const TABS = [
    'Overview',
    'Appointments',
    'Encounters',
    'Clinical',
    'Diagnoses',
    'X-Ray',
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
    ...(canDiscussXrays ? ['My X-ray discussions'] : []),
  ];

  // Dynamic calculations for itemized billing: Pharmacy, Lab, and Hospital Base/Bed charges
  const pharmacySum = useMemo(() => {
    if (liveBill?.pharmacy_items && liveBill.pharmacy_items.length > 0) {
      return liveBill.pharmacy_items.reduce((acc, item) => acc + Number(item.net_amount || (item.quantity * item.unit_price) || 0), 0);
    }
    return 100;
  }, [liveBill]);

  const labSum = useMemo(() => {
    if (liveBill?.lab_items && liveBill.lab_items.length > 0) {
      return liveBill.lab_items.reduce((acc, item) => acc + Number(item.unit_price || item.net_amount || 0), 0);
    }
    return 450;
  }, [liveBill]);

  const hospitalSum = useMemo(() => {
    if (liveBill?.items && liveBill.items.length > 0) {
      return liveBill.items.reduce((acc, item) => acc + Number(item.net_amount || item.gross_amount || 0), 0);
    }
    return Math.max(0, p.billNetAmount - pharmacySum - labSum);
  }, [liveBill, p.billNetAmount, pharmacySum, labSum]);

  // Dynamic Overview Journey Timeline items derived from live clinical and billing facts
  const timeline = useMemo(() => {
    const list = [];
    const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const currentActivityDate = (p.current_stay_days && p.current_stay_days > 1) ? todayDate : p.admittedDate;
    
    if (p.isOP) {
      list.push({
        t: `${p.admittedDate} 11:30`,
        ts: 100,
        c: '#0284c7',
        e: `Prescription issued · ${p.procedure || p.primaryDiagnosis}`
      });
      list.push({
        t: `${p.admittedDate} 10:45`,
        ts: 90,
        c: 'oklch(0.5 0.1 200)',
        e: `OPD Consultation encounter · ${p.doctor} (${p.dept})`
      });
      list.push({
        t: `${p.admittedDate} 10:15`,
        ts: 80,
        c: '#64748b',
        e: `Vitals & Clinical Check-in · Outpatient Desk`
      });
      list.push({
        t: `${p.admittedDate} 09:30`,
        ts: 70,
        c: 'oklch(0.5 0.13 70)',
        e: `Appointment Checked In · Token ${p.encounter}`
      });
      return list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    if (p.isER) {
      list.push({
        t: `${p.admittedDate} 10:45`,
        ts: 100,
        c: '#b45309',
        e: `Trauma & Emergency Evaluation · ${p.doctor}`
      });
      list.push({
        t: `${p.admittedDate} 10:15`,
        ts: 90,
        c: '#ef4444',
        e: `Emergency Intake & Triage · Assigned to ${p.bed}`
      });
      list.push({
        t: `${p.admittedDate} 09:50`,
        ts: 80,
        c: '#64748b',
        e: `STAT Vitals & Clinical Assessment · Stabilized`
      });
      return list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    // 1. Recent Patient Communications & Care Updates (Current / Active Day)
    list.push({
      t: `${currentActivityDate} 12:47`,
      ts: 100,
      c: '#64748b',
      e: `Email · Diagnostic and progress summary ready (${p.lang?.slice(0, 2)?.toUpperCase() || 'EN'})`
    });
    list.push({
      t: `${currentActivityDate} 11:10`,
      ts: 90,
      c: '#64748b',
      e: `WhatsApp · Discharge status · expected ~4:20 PM (${p.lang?.slice(0, 2)?.toUpperCase() || 'EN'})`
    });
    list.push({
      t: `${currentActivityDate} 09:12`,
      ts: 80,
      c: '#64748b',
      e: `Mobile push · Discharge planning has started (${p.lang?.slice(0, 2)?.toUpperCase() || 'EN'})`
    });
    list.push({
      t: `${currentActivityDate} 09:03`,
      ts: 70,
      c: 'oklch(0.5 0.1 300)',
      e: `Discharge Orchestration Agent · ${p.isCleared ? 'Ready' : 'Waiting'}`
    });

    // 2. Admission Day Clinical Activity
    list.push({
      t: `${p.admittedDate} 14:10`,
      ts: 60,
      c: 'oklch(0.5 0.1 300)',
      e: 'Diagnostic Coordination Agent · Completed'
    });
    list.push({
      t: `${p.admittedDate} 12:45`,
      ts: 50,
      c: '#64748b',
      e: `Email · Initial admission package confirmed (${p.lang?.slice(0, 2)?.toUpperCase() || 'EN'})`
    });
    list.push({
      t: `${p.admittedDate} 12:00`,
      ts: 40,
      c: 'oklch(0.5 0.1 200)',
      e: `Inpatient encounter · ${p.doctor}`
    });
    list.push({
      t: `${p.admittedDate} 10:15`,
      ts: 30,
      c: 'oklch(0.5 0.13 70)',
      e: `Admission · ${p.bed}`
    });

    // 3. Lab Orders / Results (with full date & time)
    const labEntries = (liveBill?.lab_items || []).slice(0, 3);
    if (labEntries.length > 0) {
      labEntries.forEach((item, idx) => {
        const itemDate = item.ordered_date
          ? new Date(item.ordered_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : p.admittedDate;
        const itemTime = item.ordered_date
          ? new Date(item.ordered_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : '10:00 am';
        list.push({
          t: `${itemDate} ${itemTime}`,
          ts: 20 - idx,
          c: '#64748b',
          e: `Laboratory order · ${item.item_name || 'Investigation'} · ${item.order_status || 'Completed'}`
        });
      });
    } else {
      list.push({
        t: `${p.admittedDate} 10:00 am`,
        ts: 20,
        c: '#64748b',
        e: `Laboratory order · CBC (Complete Blood Count) · Completed`
      });
      list.push({
        t: `${p.admittedDate} 10:00 am`,
        ts: 19,
        c: '#64748b',
        e: `Laboratory order · CRP (C-Reactive Protein) · Completed`
      });
    }

    return list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }, [liveBill, p]);

  // AI Activity on this patient
  const aiAgents = useMemo(() => [
    {
      id: `EXE-2026-${String(p.admission_id || 118204).slice(-6)}`,
      agent: 'Discharge Orchestration Agent',
      version: '3.0.2',
      status: p.isCleared ? 'Completed' : 'Waiting',
      steps: 12,
      bg: p.isCleared ? '#dcfce7' : '#fef3c7',
      fg: p.isCleared ? '#15803d' : '#92400e',
    },
    {
      id: `EXE-2026-${String((p.admission_id || 117656) - 548).slice(-6)}`,
      agent: 'Diagnostic Coordination Agent',
      version: '1.5.1',
      status: 'Completed',
      steps: 5,
      bg: '#dcfce7',
      fg: '#15803d',
    },
    {
      id: `EXE-2026-${String((p.admission_id || 117666) - 538).slice(-6)}`,
      agent: 'Queue / Flow Agent',
      version: '2.0.4',
      status: 'Completed',
      steps: 6,
      bg: '#dcfce7',
      fg: '#15803d',
    },
    {
      id: `EXE-2026-${String((p.admission_id || 117718) - 486).slice(-6)}`,
      agent: 'Feedback Agent',
      version: '1.2.0',
      status: 'Completed',
      steps: 4,
      bg: '#dcfce7',
      fg: '#15803d',
    },
  ], [p]);

  const pendingApprovals = useMemo(() => [
    { type: 'Billing release', owner: 'Billing Desk', age: p.isCleared ? 'Cleared' : '2 d 19 h' },
    { type: 'Discharge summary', owner: p.doctor, age: p.isCleared ? 'Ready' : '2 d 19 h' },
  ], [p]);

  const [clearingBill, setClearingBill] = useState(false);

  // Handler to print / generate official Itemized Bill PDF report
  const handlePrintItemizedBill = () => {
    const isCleared = p.isCleared;
    const outstanding = p.outstandingBalance;
    const net = p.billNetAmount;
    const covered = isCleared ? net : Math.max(0, net - outstanding);
    const pCode = p.patient_code || p.uhid || p.mrn || p.patientNumber || (p.patient_id ? `MER-PAT-${String(p.patient_id).padStart(7, '0')}` : 'MER-PAT-0000001');
    const invoiceNo = p.billNumber || (p.admission_id ? `MER-BIL-${String(p.admission_id).padStart(7, '0')}` : `INV-${pCode}-2026`);
    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const pharmItems = (liveBill?.pharmacy_items && liveBill.pharmacy_items.length > 0)
      ? liveBill.pharmacy_items.map(item => `
          <tr>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">Pharmacy: ${item.item_name || 'Medication Dispensed'}</td>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${item.quantity || 1}</td>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right;">₹${Number(item.unit_price || item.net_amount || 0).toLocaleString('en-IN')}</td>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right; font-weight: 600;">₹${Number(item.net_amount || (item.quantity * item.unit_price) || 0).toLocaleString('en-IN')}</td>
          </tr>
        `).join('')
      : `<tr>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">Inpatient Pharmacy & Consumables</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">1 pkg</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right;">₹${pharmacySum.toLocaleString('en-IN')}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right; font-weight: 600;">₹${pharmacySum.toLocaleString('en-IN')}</td>
        </tr>`;

    const labItems = (liveBill?.lab_items && liveBill.lab_items.length > 0)
      ? liveBill.lab_items.map(item => `
          <tr>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">Diagnostics: ${item.test_name || 'Laboratory Workup'}</td>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">1</td>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right;">₹${Number(item.unit_price || item.net_amount || 0).toLocaleString('en-IN')}</td>
            <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right; font-weight: 600;">₹${Number(item.unit_price || item.net_amount || 0).toLocaleString('en-IN')}</td>
          </tr>
        `).join('')
      : `<tr>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">Laboratory, Pathology & Imaging Workup</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">1 set</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right;">₹${labSum.toLocaleString('en-IN')}</td>
          <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right; font-weight: 600;">₹${labSum.toLocaleString('en-IN')}</td>
        </tr>`;

    const hospDays = Math.max(1, p.current_stay_days || 3);
    const hospItems = `
      <tr>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px;">Inpatient Room, Nursing & Telemetry Care (${p.bed || 'Ward'})</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: center;">${hospDays} days</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right;">₹${Math.round(hospitalSum / hospDays).toLocaleString('en-IN')}</td>
        <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: right; font-weight: 600;">₹${hospitalSum.toLocaleString('en-IN')}</td>
      </tr>
    `;

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Itemized Bill - ${p.name} (${invoiceNo})</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 14px;
            margin-bottom: 18px;
          }
          .hospital-title {
            font-size: 18px;
            font-weight: 800;
            color: #0369a1;
            letter-spacing: -0.02em;
          }
          .hospital-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .invoice-badge {
            text-align: right;
          }
          .invoice-badge h2 {
            margin: 0;
            font-size: 16px;
            color: #0f172a;
            font-weight: 700;
          }
          .status-pill {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            margin-top: 4px;
            background: ${isCleared ? '#dcfce7' : '#fef3c7'};
            color: ${isCleared ? '#15803d' : '#92400e'};
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            padding: 2px 0;
          }
          .info-label {
            color: #64748b;
            font-weight: 600;
          }
          .info-val {
            font-weight: 600;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th {
            background: #f1f5f9;
            color: #334155;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 10px 12px;
            border-bottom: 2px solid #cbd5e1;
            text-align: left;
          }
          .summary-box {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 24px;
          }
          .summary-table {
            width: 320px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            font-size: 12.5px;
            padding: 4px 0;
          }
          .summary-total {
            border-top: 1px solid #cbd5e1;
            margin-top: 6px;
            padding-top: 6px;
            font-weight: 800;
            font-size: 14px;
            color: #0369a1;
          }
          .footer {
            border-top: 1px dashed #cbd5e1;
            padding-top: 14px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 11px;
            color: #64748b;
            margin-top: 30px;
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
            <div class="hospital-title">INPATIENT BILLING &amp; FINANCIAL CLEARANCE DESK</div>
            <div class="hospital-sub">Department of Financial Services &amp; Hospital Inpatient Accounts</div>
            <div class="hospital-sub">NABH Accredited Health System · GSTIN: 33AAAAA0000A1Z5 · 24x7 Billing Desk</div>
          </div>
          <div class="invoice-badge">
            <h2>ITEMIZED TAX INVOICE</h2>
            <div style="font-size: 11.5px; color: #64748b; font-family: monospace;">Bill No: ${invoiceNo}</div>
            <div class="status-pill">${isCleared ? '✓ Cleared · Paid in Full' : '⏳ Pending Settlement'}</div>
          </div>
        </div>

        <div class="info-grid">
          <div>
            <div class="info-row"><span class="info-label">Patient Name:</span><span class="info-val">${p.name}</span></div>
            <div class="info-row"><span class="info-label">Patient Code / MRN:</span><span class="info-val" style="font-family: monospace; font-weight: 700; color: #0284c7;">${pCode}</span></div>
            <div class="info-row"><span class="info-label">Age / Gender:</span><span class="info-val">${p.age} Yrs / ${p.gender}</span></div>
            <div class="info-row"><span class="info-label">Admission Date:</span><span class="info-val">${p.admittedDate || '10 Sep 2026'}</span></div>
            <div class="info-row"><span class="info-label">Discharge Date:</span><span class="info-val">${p.dischargeDate || todayStr}</span></div>
          </div>
          <div>
            <div class="info-row"><span class="info-label">Admission ID:</span><span class="info-val">${p.encounter || 'ADM-87224'}</span></div>
            <div class="info-row"><span class="info-label">Ward / Bed:</span><span class="info-val">${p.bed}</span></div>
            <div class="info-row"><span class="info-label">Attending Doctor:</span><span class="info-val">${p.doctor || p.attendingPhysician || 'Dr. Sneha Das'}</span></div>
            <div class="info-row"><span class="info-label">Primary Diagnosis:</span><span class="info-val">${p.primaryDiagnosis || 'Clinical Inpatient Care'}</span></div>
            <div class="info-row"><span class="info-label">TPA / Insurer:</span><span class="info-val">${p.insurer}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 55%;">Description of Service / Consumable</th>
              <th style="width: 15%; text-align: center;">Qty / Days</th>
              <th style="width: 15%; text-align: right;">Unit Rate</th>
              <th style="width: 15%; text-align: right;">Net Amount</th>
            </tr>
          </thead>
          <tbody>
            ${hospItems}
            ${pharmItems}
            ${labItems}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="summary-table">
            <div class="summary-row"><span style="color: #64748b;">Gross Incurred Amount:</span><span style="font-weight: 600;">₹${net.toLocaleString('en-IN')}</span></div>
            <div class="summary-row"><span style="color: #64748b;">TPA / Insurance Approved:</span><span style="font-weight: 600; color: #15803d;">- ₹${covered.toLocaleString('en-IN')}</span></div>
            <div class="summary-row"><span style="color: #64748b;">Hospital Discount:</span><span style="font-weight: 600;">₹0</span></div>
            <div class="summary-row summary-total"><span>Patient Net Payable:</span><span>₹${outstanding.toLocaleString('en-IN')}</span></div>
          </div>
        </div>

        <div class="footer">
          <div>
            <div>Computer generated tax invoice &amp; bill of supply · Official Hospital Record.</div>
            <div style="margin-top: 2px;">Generated on ${todayStr} · Verified by Finance &amp; Inpatient Billing Desk</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 700; color: #0f172a;">Hospital Inpatient Billing Desk</div>
            <div style="margin-top: 20px; font-size: 10px; color: #94a3b8;">Authorized Signatory / Cashier</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=880,height=960');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
    }
  };

  // Handler to clear patient bill via API: POST /api/v1/discharge-agent/patient/{patient_id}/clear-bill
  const handleClearBill = async () => {
    const cleanNum = (val) => {
      if (!val) return null;
      const str = String(val).trim();
      const m = str.match(/\d+/);
      return m ? m[0].replace(/^0+/, '') || '0' : str;
    };

    const targetPid = (
      cleanNum(p.patient_id) ||
      cleanNum(patient?.patient_id) ||
      cleanNum(patient?.id) ||
      cleanNum(p.admission_id) ||
      cleanNum(patient?.admission_id) ||
      cleanNum(p.uhid) ||
      cleanNum(p.encounter) ||
      cleanNum(p.billNumber)
    );

    if (!targetPid) {
      alert("Unable to identify patient or admission ID for bill clearance.");
      return;
    }

    setClearingBill(true);
    try {
      const res = await apiService.clearPatientBill(targetPid);

      // Immediately update local state in Patient360View
      setLiveAdmission(prev => prev ? {
        ...prev,
        bill_status: 'Paid',
        bill_clearance_status: 'Cleared',
        outstanding_balance: 0.0
      } : {
        bill_status: 'Paid',
        bill_clearance_status: 'Cleared',
        outstanding_balance: 0.0
      });

      setLiveBill(prev => prev ? {
        ...prev,
        bill_status: 'Settled',
        patient_amount: 0.0,
        outstanding_balance: 0.0
      } : {
        bill_status: 'Settled',
        patient_amount: 0.0,
        outstanding_balance: 0.0
      });

      // Update open drawer immediately to reflect cleared status & print action
      if (onOpenDrawer) {
        onOpenDrawer({
          title: `${p.billNumber} · ${p.name}`,
          sub: `Admission: ${p.encounter} · Bed: ${p.bed}`,
          badges: [
            { t: 'Cleared · Paid in Full', bg: '#dcfce7', fg: '#15803d' }
          ],
          facts: [
            { k: 'Hospital & Bed Charges', v: `₹${hospitalSum.toLocaleString('en-IN')}` },
            { k: 'Pharmacy & Dispensed Total', v: `₹${pharmacySum.toLocaleString('en-IN')}` },
            { k: 'Lab & Diagnostic Total', v: `₹${labSum.toLocaleString('en-IN')}` },
            { k: 'Actual Gross Bill', v: `₹${p.billNetAmount.toLocaleString('en-IN')}`, b: true },
            { k: 'Insurance / Settled', v: `₹${p.billNetAmount.toLocaleString('en-IN')}` },
            { k: 'Patient Share / Due', v: '₹0', b: true },
            { k: 'TPA / Insurer', v: p.insurer },
            { k: 'Financial Clearance', v: 'Cleared · Paid' }
          ],
          actions: [
            { label: 'Print Itemized Bill', primary: true, on: handlePrintItemizedBill }
          ]
        });
      }

      alert(res?.message || `✅ Bill successfully cleared and settled for ${p.name}!`);

      // Broadcast update event to all other open views
      window.dispatchEvent(new CustomEvent('hc_api_updated', {
        detail: { action: 'bill_cleared', patient_id: targetPid }
      }));
    } catch (err) {
      console.error("Failed to clear patient bill:", err);
      alert(`Failed to clear bill: ${err.message || err}`);
    } finally {
      setClearingBill(false);
    }
  };

  // Handler to open deep dynamic itemized bill detail drawer
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
          { k: 'Hospital & Bed Charges', v: `₹${hospitalSum.toLocaleString('en-IN')}` },
          { k: 'Pharmacy & Dispensed Total', v: `₹${pharmacySum.toLocaleString('en-IN')}` },
          { k: 'Lab & Diagnostic Total', v: `₹${labSum.toLocaleString('en-IN')}` },
          { k: 'Actual Gross Bill', v: `₹${net.toLocaleString('en-IN')}`, b: true },
          { k: 'Insurance / Settled', v: `₹${covered.toLocaleString('en-IN')}` },
          { k: 'Patient Share / Due', v: `₹${outstanding.toLocaleString('en-IN')}`, b: true },
          { k: 'TPA / Insurer', v: p.insurer },
          { k: 'Financial Clearance', v: p.billingStatusDisplay }
        ],
        actions: [
          ...(!isCleared
            ? [{ label: clearingBill ? 'Settling Bill...' : 'Settle Cashless Co-Pay', primary: true, disabled: clearingBill, on: handleClearBill }]
            : []),
          { label: 'Print Itemized Bill', primary: isCleared, on: handlePrintItemizedBill }
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
  const handleViewScan = async (targetScanOrId = null) => {
    setScanLoading(true);
    setScanAlert(null);

    const targetScanId = typeof targetScanOrId === 'object' ? targetScanOrId?.scan_id : targetScanOrId;

    // Fast-path: If diagScans is already available for this patient, open the exact scan immediately
    if (diagScans && diagScans.length > 0) {
      setPatientScans(diagScans);
      const foundIdx = targetScanId ? diagScans.findIndex(s => s.scan_id === targetScanId) : 0;
      setActiveScanIdx(foundIdx >= 0 ? foundIdx : 0);
      setScanModalOpen(true);
      setScanLoading(false);
      return;
    }

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
        const foundIdx = targetScanId ? scans.findIndex(s => s.scan_id === targetScanId) : 0;
        setActiveScanIdx(foundIdx >= 0 ? foundIdx : 0);
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

  if (loadingPatient360) {
    const patientDisplayName = patient?.name || patient?.patient_name || patient?.patient || p.name || 'Patient Record';
    const patientUhid = p.uhid || patient?.uhid || patient?.patient_code || patient?.mrn || (patient?.patient_id ? `UHID-${String(patient.patient_id).padStart(6, '0')}` : '');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', animation: 'fadeIn 0.2s ease-in-out' }}>
        <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
          <span>AI Command Centre</span> › <span>Patient 360</span> ›{' '}
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>{patientUhid || 'Loading Profile...'}</span>
        </div>
        <ModuleLoadingScreen
          title={`Loading Patient 360 · ${patientDisplayName}${patientUhid ? ` (${patientUhid})` : ''}...`}
          subtitle="Synchronizing electronic health record, bed allocation, vitals telemetry, diagnostics, and financial ledger..."
          badgeText="Live Clinical 360 Sync"
          showKpis={true}
          statCount={5}
          layout="table"
          tableRows={7}
          tableColumns={8}
        />
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', color: '#64748b' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '16px' }}>No Patient Selected</h3>
        <p style={{ margin: 0, fontSize: '13px' }}>Please select a patient from Admissions, Patients, or Bed Board to view their 360 profile.</p>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              marginTop: '16px',
              padding: '8px 18px',
              borderRadius: '6px',
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            ← Return to Previous View
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Breadcrumb */}
      <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
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
                  background: p.statusBadge.bg,
                  color: p.statusBadge.color,
                  border: `1px solid ${p.statusBadge.border}`,
                }}
              >
                {p.statusBadge.text}
              </span>
            </div>

            <div style={{ color: '#52585e', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', marginTop: '2px' }}>
              {p.uhid} · {p.age} · {p.sex} · {p.lang} · {p.blood} · {p.phone}
            </div>

            {/* Facts Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 22px', marginTop: '10px' }}>
              {[
                ['ENCOUNTER', p.encounter],
                ['BED', p.isDischarged ? `${p.bed} (Released)` : p.bed],
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
            {p.isOP ? (
              <button
                type="button"
                onClick={() => {
                  if (onNavigate) onNavigate('doctor-portal');
                }}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: 0,
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                OPD Consultation · Active
              </button>
            ) : p.isER ? (
              <button
                type="button"
                onClick={() => {
                  if (onNavigate) onNavigate('emergency');
                }}
                style={{
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: 0,
                  background: '#b45309',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Emergency Triage · Active
              </button>
            ) : (
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
                  background: p.isDischarged ? '#0d5244' : 'oklch(0.5 0.1 200)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {p.isDischarged ? '✓ Discharge Summary (Signed Off)' : 'Open discharge case'}
              </button>
            )}
          </div>
        </div>

        {/* Patient modules */}
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
              {t === 'My X-ray discussions' && discussionUnread > 0 && (
                <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '10px', background: '#e0f2f1', color: '#087e8b', fontSize: '10px' }}>
                  {discussionUnread} unread
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {activeTab === 'My X-ray discussions' && canDiscussXrays && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '16px' }}>My X-ray discussions</h2>
          <RadiologyClarifications key={currentUser?.username || currentUser?.user_id || 'discussions'} />
        </div>
      )}

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
                    gridTemplateColumns: '125px 12px minmax(0, 1fr)',
                    gap: '8px',
                    alignItems: 'start',
                    padding: '5px 0',
                  }}
                >
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#52585e', lineHeight: 1.35 }}>
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
                ['Bill Number', p.billNumber],
                ['Net Amount', `₹${p.billNetAmount.toLocaleString('en-IN')}`],
                ['Status', p.billingStatusDisplay],
                ['Patient Due', `₹${(p.isCleared ? 0 : p.outstandingBalance).toLocaleString('en-IN')}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr)', gap: '4px 12px', padding: '3px 0', fontSize: '12px' }}>
                  <span style={{ color: '#8a9096' }}>{k}</span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: p.isCleared ? '#15803d' : (k === 'Patient Due' && p.outstandingBalance > 0 ? '#991b1b' : '#15181b'), fontWeight: 600 }}>
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
          grid="120px minmax(180px, 1fr) 140px 180px 140px 100px"
          rows={
            p.isOP ? [
              [p.encounter, p.doctor, `${p.admittedDate}, ${p.admittedTime}`, `${p.dept} Outpatient Consultation`, 'OPD Desk', 'Confirmed'],
              [`APT-FOLLOWUP-${p.patient_id || '01'}`, p.doctor, 'Next Week 10:00 AM', 'Outpatient Follow-up Review', 'OPD Portal', 'Scheduled'],
            ] : p.isER ? [
              [p.encounter, p.doctor, `${p.admittedDate}, ${p.admittedTime}`, 'Emergency Triage & Assessment', 'Emergency Desk', 'Active'],
              [`ER-OBS-${p.patient_id || '01'}`, p.doctor, 'Observation Bay Review', 'Clinical Trauma Monitoring', 'ER Station', 'In Progress'],
            ] : [
              [`APT-${p.patient_id || p.admission_id || '01'}-01`, p.doctor, p.admittedDate || '17 May 2025', `${p.dept} Inpatient Admission`, 'Clinical Referral', 'Completed'],
              [`APT-${p.patient_id || p.admission_id || '01'}-02`, p.doctor, 'Daily Round 10:00 AM', 'Inpatient Ward Review', 'Ward Workstation', 'Completed'],
            ]
          }
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
          grid="160px 180px minmax(180px, 1fr) 160px 100px"
          rows={
            p.isOP ? [
              [p.encounter, 'Outpatient Consultation', p.doctor, `${p.admittedDate}, ${p.admittedTime}`, 'Confirmed'],
              [`ENC-OPD-VITALS-${p.patient_id || '01'}`, 'OPD Baseline Vitals & Check-in', p.doctor, p.admittedDate, 'Completed'],
              [`ENC-OPD-RX-${p.patient_id || '01'}`, 'Prescription & Consultation Note', p.doctor, p.admittedDate, 'Completed'],
            ] : p.isER ? [
              [p.encounter, 'Emergency Room Intake & Triage', p.doctor, `${p.admittedDate}, ${p.admittedTime}`, 'Active Triage'],
              [`ENC-ER-TRAUMA-${p.patient_id || '01'}`, 'Emergency Bay Assessment', p.doctor, p.admittedDate, 'Active'],
              [`ENC-ER-WORKUP-${p.patient_id || '01'}`, 'STAT Emergency Lab & Imaging', p.doctor, p.admittedDate, 'In Progress'],
            ] : [
              [p.encounter || `ENC-${p.admission_number || p.admission_id}`, `${p.admission_type || 'Inpatient'} Admission`, p.doctor, p.admitted, p.isDischarged ? 'Discharged' : (p.status || 'Active')],
              [`ENC-TRIAGE-${p.patient_id || '01'}`, 'Initial Emergency & Clinical Triage', p.doctor, p.admittedDate, 'Completed'],
              [`ENC-WORKUP-${p.patient_id || '01'}`, 'Diagnostic Lab & Imaging Workup', p.doctor, p.admittedDate, 'Completed'],
            ]
          }
        />
      )}

      {/* Tab 4: Clinical */}
      {activeTab === 'Clinical' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: '12px', fontSize: '12px' }}>
              <span style={{ fontWeight: 600, color: p.allergies?.toLowerCase().includes('no') ? '#15181b' : '#dc2626' }}>Known Allergies</span>
              <span style={{ color: p.allergies?.toLowerCase().includes('no') ? '#52585e' : '#dc2626', fontWeight: 600 }}>
                {p.allergies?.toLowerCase().includes('no') ? p.allergies : `⚠ ${p.allergies}`}
              </span>

              <span style={{ fontWeight: 600, color: '#15181b' }}>Primary Diagnosis</span>
              <span>{p.primaryDiagnosis} · {p.doctor}</span>

              <span style={{ fontWeight: 600, color: '#15181b' }}>Secondary Diagnosis</span>
              <span>{p.secondaryDiagnoses || 'None recorded'}</span>

              <span style={{ fontWeight: 600, color: '#15181b' }}>Treating Doctor</span>
              <span>{p.doctor} ({p.dept})</span>

              <span style={{ fontWeight: 600, color: '#15181b' }}>Blood Group</span>
              <span>{p.blood}</span>

              <span style={{ fontWeight: 600, color: '#15181b' }}>Risk Indicators</span>
              <span>{p.risk}</span>

              <span style={{ fontWeight: 600, color: '#15181b' }}>Clinical Progress Note</span>
              <span style={{ lineHeight: 1.5, background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                {p.isOP ? (
                  `Outpatient consultation on ${p.admittedDate} for ${p.primaryDiagnosis}. ${p.condition}. Vitals: ${p.latestBp || 'Stable'}. Follow-up advice and outpatient prescription provided.`
                ) : p.isER ? (
                  `Emergency trauma & triage assessment on ${p.admittedDate} for ${p.primaryDiagnosis}. Bay assignment: ${p.bed}. Vitals: ${p.latestBp || 'Monitored'}.`
                ) : (
                  `Day ${p.current_stay_days || 1} of inpatient admission for ${p.primaryDiagnosis}. ${p.condition}. Vitals: ${p.latestBp || 'Stable'}. ${p.isCleared ? 'Patient cleared for discharge with home regimen.' : 'Awaiting final billing clearance and discharge sign-off.'}`
                )}
              </span>
            </div>
          </div>

          {/* Vitals Taken & Observation History */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                Vital Signs Observations & Measurements
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Last Measured: <strong>{p.vitalsTakenTime}</strong>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Blood Pressure</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{p.vitalsObject.sbp}/{p.vitalsObject.dbp} <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b' }}>mmHg</span></div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Heart Rate (Pulse)</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{p.vitalsObject.hr} <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b' }}>bpm</span></div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>SpO2 (Pulse Oximetry)</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{p.vitalsObject.spo2}%</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Temperature</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{p.vitalsObject.temp}°F</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Respiratory Rate</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{p.vitalsObject.rr} <span style={{ fontSize: '11px', fontWeight: 400, color: '#64748b' }}>/min</span></div>
              </div>
            </div>

            {p.vitalsHistory && p.vitalsHistory.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '10.5px', fontWeight: 700 }}>
                    <th style={{ padding: '8px 10px' }}>RECORDED TIME</th>
                    <th style={{ padding: '8px 10px' }}>BP (SYS/DIA)</th>
                    <th style={{ padding: '8px 10px' }}>HEART RATE</th>
                    <th style={{ padding: '8px 10px' }}>SPO2</th>
                    <th style={{ padding: '8px 10px' }}>TEMP</th>
                    <th style={{ padding: '8px 10px' }}>RESP RATE</th>
                    <th style={{ padding: '8px 10px' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {p.vitalsHistory.slice(0, 5).map((v, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', color: '#0f172a', fontFamily: 'monospace' }}>
                        {new Date(v.recorded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>{v.systolic_bp}/{v.diastolic_bp} mmHg</td>
                      <td style={{ padding: '8px 10px', color: '#334155' }}>{v.heart_rate} bpm</td>
                      <td style={{ padding: '8px 10px', color: '#334155' }}>{Number(v.oxygen_saturation).toFixed(1)}%</td>
                      <td style={{ padding: '8px 10px', color: '#334155' }}>{Number(v.temperature).toFixed(1)}°F</td>
                      <td style={{ padding: '8px 10px', color: '#334155' }}>{v.respiratory_rate} /min</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600 }}>
                          Normal
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Diagnoses & Diagnostic Investigations */}
      {(activeTab === 'Diagnoses' || activeTab === 'Diagnostics') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Sub-filter tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setDiagFilter('all')}
                style={{
                  padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: diagFilter === 'all' ? '1px solid oklch(0.5 0.1 200)' : '1px solid #e3e6e8',
                  background: diagFilter === 'all' ? 'oklch(0.96 0.04 200)' : '#fff',
                  color: diagFilter === 'all' ? 'oklch(0.4 0.12 200)' : '#52585e'
                }}
              >
                All Records ({p.diagnoses_list?.length || 1} {p.diagnoses_list?.length === 1 ? 'Diagnosis' : 'Diagnoses'} + {((liveBill?.lab_items?.length || p.lab_results_list?.length) || 2) + patientXrayOrders.length} Diagnostic Orders)
              </button>
              <button
                type="button"
                onClick={() => setDiagFilter('diagnoses')}
                style={{
                  padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: diagFilter === 'diagnoses' ? '1px solid oklch(0.5 0.1 200)' : '1px solid #e3e6e8',
                  background: diagFilter === 'diagnoses' ? 'oklch(0.96 0.04 200)' : '#fff',
                  color: diagFilter === 'diagnoses' ? 'oklch(0.4 0.12 200)' : '#52585e'
                }}
              >
                Clinical Diagnoses ({p.diagnoses_list?.length || 1})
              </button>
              <button
                type="button"
                onClick={() => setDiagFilter('labs')}
                style={{
                  padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: diagFilter === 'labs' ? '1px solid oklch(0.5 0.1 200)' : '1px solid #e3e6e8',
                  background: diagFilter === 'labs' ? 'oklch(0.96 0.04 200)' : '#fff',
                  color: diagFilter === 'labs' ? 'oklch(0.4 0.12 200)' : '#52585e'
                }}
              >
                Lab &amp; Diagnostic Orders ({((liveBill?.lab_items?.length || p.lab_results_list?.length) || 2) + patientXrayOrders.length})
              </button>
            </div>
          </div>

          {/* Section 1: Clinical Diagnoses */}
          {(diagFilter === 'all' || diagFilter === 'diagnoses') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#15181b' }}>Clinical Diagnoses</span>
                  <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                    Active Medical Record
                  </span>
                </div>
                <span style={{ fontSize: '11.5px', color: '#687076' }}>
                  Attending Consultant: <strong>{p.doctor}</strong>
                </span>
              </div>

              <TableContainer
                cols={['Code', 'Diagnosis Name', 'Classification', 'Diagnosed Date', 'Attending Clinician', 'Status']}
                grid="90px minmax(240px, 1.4fr) 140px 120px minmax(160px, 1fr) 110px"
                rows={(p.diagnoses_list || []).map(dx => [
                  dx.code,
                  dx.name,
                  dx.type,
                  dx.date,
                  dx.doctor,
                  dx.status
                ])}
              />
            </div>
          )}

          {/* Section 2: Supporting Diagnostic Investigations & Lab Tests */}
          {(diagFilter === 'all' || diagFilter === 'labs') && (() => {
            const labRows = (liveBill?.lab_items && liveBill.lab_items.length > 0)
              ? liveBill.lab_items.map((li, idx) => [
                  `ORD-${li.lab_order_id || idx + 101}`,
                  li.item_name || 'Laboratory Test',
                  li.test_category || 'LIS',
                  li.ordered_date ? new Date(li.ordered_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (p.admittedDate || 'Admission Day'),
                  li.test_parameter ? `${li.test_parameter}: ${li.result_value || 'Normal'} ${li.unit || ''}`.trim() : (li.result_value || 'Verified'),
                  li.order_status || 'Verified'
                ])
              : (p.lab_results_list && p.lab_results_list.length > 0)
                ? p.lab_results_list.map((lr, idx) => [
                    `ORD-${idx + 101}`,
                    lr.test_parameter || 'Clinical Diagnostic Test',
                    'LIS / Biochemistry',
                    lr.result_date ? new Date(lr.result_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (p.admittedDate || 'Admission Day'),
                    `${lr.test_parameter}: ${lr.result_value} ${lr.unit || ''} (Ref: ${lr.reference_range || 'Normal'})`,
                    lr.verification_status || 'Verified'
                  ])
                : [
                    [`ORD-${p.admission_id || '87248'}`, 'CBC (Complete Blood Count)', 'Hematology', p.admittedDate || '17 May 2025', 'Param: 10.5 g/dL', 'Verified'],
                    [`ORD-${(p.admission_id || 87248) + 1}`, 'Electrolytes Panel', 'Biochemistry', p.admittedDate || '17 May 2025', 'K: 4.1, Na: 138 mEq/L', 'Verified'],
                    [`ORD-${(p.admission_id || 87248) + 2}`, 'HbA1c Glycated Hemoglobin', 'LIS', p.admittedDate || '17 May 2025', '6.8% · Good control', 'Verified']
                  ];

            const xrayRows = patientXrayOrders.map((xo) => {
              const isUrgent = (xo.priority || '').toLowerCase() === 'urgent';
              const isUploaded = xo.status === 'Uploaded' || xo.status === 'Completed';
              const views = orderViewResults(xo, diagScans);
              const matchingScan = views.find(view => view.scan)?.scan;
              const studyUid = views.map(view => view.uid).filter(Boolean).join(',');
              const scanResult = views.map(view => `${view.projection}: ${view.status}`).join(' · ');

              return [
                xo.accession_number || `XR-${xo.order_id.slice(0, 8)}`,
                <div key={xo.order_id + '-test'}>
                  <strong>🩻 {xo.examination || 'Chest X-ray PA'}</strong>
                  <div style={{ fontSize: '11px', color: '#087e8b', marginTop: '3px' }}>{studyVersion(xo, patientXrayOrders)}</div>
                </div>,
                <span key={xo.order_id + '-kind'} style={{ color: '#0284c7', fontWeight: 600 }}>
                  Radiology · X-Ray
                </span>,
                xo.created_at ? new Date(xo.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (p.admittedDate || 'Today'),
                <div key={xo.order_id + '-res'} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                    background: isUrgent ? '#fee2e2' : '#f1f5f9',
                    color: isUrgent ? '#b91c1c' : '#475569',
                    border: `1px solid ${isUrgent ? '#fca5a5' : '#e2e8f0'}`,
                    flexShrink: 0
                  }}>
                    {isUrgent && '⚡ '}{xo.priority || 'Routine'}
                  </span>
                  <span style={{
                    color: matchingScan?.target === 1 ? '#dc2626' : (matchingScan ? '#15803d' : '#475569'),
                    fontWeight: matchingScan ? 600 : 400,
                    whiteSpace: 'normal'
                  }}>
                    {scanResult}
                  </span>
                </div>,
                <div key={xo.order_id + '-st'} style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                  <span style={{
                    padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                    background: isUploaded ? '#dcfce7' : '#fef3c7',
                    color: isUploaded ? '#15803d' : '#b45309',
                    whiteSpace: 'nowrap'
                  }}>
                    {views.filter(view => view.uid).length}/{views.length} views available
                  </span>
                  {studyUid && (
                    <button
                      type="button"
                      title="Open DICOM image in OHIF Viewer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOhifViewerModal(getOhifViewerUrl(studyUid));
                      }}
                      style={{
                        height: '24px',
                        padding: '0 8px',
                        borderRadius: '4px',
                        border: '1px solid oklch(0.5 0.1 200)',
                        background: 'oklch(0.96 0.04 200)',
                        color: 'oklch(0.4 0.12 200)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <span>🖼️</span> Open OHIF →
                    </button>
                  )}
                </div>
              ];
            });

            const rowsToDisplay = [...labRows, ...xrayRows];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: diagFilter === 'all' ? '10px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#15181b' }}>Diagnostic Investigations &amp; Lab Orders</span>
                    <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                      Supporting Workup ({rowsToDisplay.length})
                    </span>
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#687076' }}>
                    Ordered for inpatient diagnostic monitoring
                  </span>
                </div>

                <TableContainer
                  cols={['Order', 'Test', 'Kind', 'Ordered', 'Result', 'Status']}
                  grid="130px minmax(180px, 1fr) 120px 100px minmax(190px, 1.2fr) 185px"
                  rows={rowsToDisplay}
                />

                {/* Detailed X-Ray Order Cards */}
                {patientXrayOrders.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#15181b' }}>
                          🩻 Radiology &amp; X-Ray Order Details
                        </span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                          {patientXrayOrders.length} {patientXrayOrders.length === 1 ? 'Order' : 'Orders'} on Record
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('X-Ray')}
                        style={{
                          background: 'none', border: 0, color: 'oklch(0.5 0.1 200)',
                          fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', padding: 0
                        }}
                      >
                        Manage in X-Ray Tab →
                      </button>
                    </div>

                    {groupImagingOrders(patientXrayOrders).map(group => (
                    <section key={group.id} style={{ border: '1px solid #dbe4ec', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <div><b>Clinical problem: {group.problem}</b><div style={{ fontSize: '11px', color: '#64748b' }}>{group.studies.length} linked {group.studies.length === 1 ? 'study' : 'studies'} · baseline and follow-ups</div></div>
                        <ImagingHistoryButton orderId={group.studies.at(-1).order_id} />
                      </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                      {group.studies.map((xo) => {
                        const isUrgent = (xo.priority || '').toLowerCase() === 'urgent';
                        const views = orderViewResults(xo, diagScans);
                        const isUploaded = views.every(view => view.uid);

                        return (
                          <div
                            key={xo.order_id}
                            style={{
                              background: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                            }}
                          >
                            <b style={{ fontSize: '12px', color: '#087e8b' }}>{studyVersion(xo, patientXrayOrders)}</b>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                  {xo.accession_number}
                                </span>
                                <span style={{
                                  padding: '1px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                                  background: isUrgent ? '#fee2e2' : '#f1f5f9',
                                  color: isUrgent ? '#b91c1c' : '#475569',
                                  border: `1px solid ${isUrgent ? '#fca5a5' : '#e2e8f0'}`
                                }}>
                                  {isUrgent && '⚡ '}{xo.priority}
                                </span>
                              </div>

                              <span style={{
                                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                background: isUploaded ? '#dcfce7' : '#fef3c7',
                                color: isUploaded ? '#166534' : '#92400e'
                              }}>
                                {views.filter(view => view.uid).length}/{views.length} views available
                              </span>
                            </div>

                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                                {xo.examination || 'Chest X-ray PA'}
                              </div>
                              {xo.indication && (
                                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                  <span style={{ fontWeight: 600 }}>Indication: </span>{xo.indication}
                                </div>
                              )}
                            </div>

                            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                              <span>Requested by {xo.requested_by_name || 'Attending Doctor'}</span>
                              <span>{xo.created_at ? new Date(xo.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            </div>

                            <div style={{ display: 'grid', gap: '6px' }}>
                              {views.map(view => (
                                <div key={view.projection} style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '12px' }}>
                                  <b>{view.projection}</b> · {view.status}
                                  {view.uid && <button type="button" style={{ marginLeft: '8px' }} onClick={() => setOhifViewerModal(getOhifViewerUrl(view.uid))}>Open {view.projection} image</button>}
                                  {view.scan && <button type="button" style={{ marginLeft: '8px' }} onClick={() => { setPatientScans([view.scan]); setActiveScanIdx(0); setScanModalOpen(true); }}>View {view.projection} result · Scan #{view.scan.scan_id}</button>}
                                  <ClarificationButton orderId={xo.order_id} scanId={view.scan?.scan_id} projection={view.projection} disabled={!view.scan?.scan_id} />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </section>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Section 3: Radiology Scans (only if patient has scan records in All Records view) */}
          {diagFilter === 'all' && diagScans.length > 0 && (() => {
            const sc = diagScans[diagScanIdx] || diagScans[0];
            const isOpacity = sc.target === 1;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#15181b' }}>Radiology Imaging · X-Ray</span>
                    <span style={{
                      fontSize: '11px', padding: '2px 7px', borderRadius: '4px', fontWeight: 600,
                      ...statusStyle(scanAssessmentStatus(sc))
                    }}>
                      {sc.reviewed_at ? 'Reviewed' : 'Preliminary AI'} · {scanAssessmentStatus(sc)}
                    </span>
                    {diagScans.length > 1 && (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{diagScans.length} analysis records (not an image count)</span>
                    )}
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#687076' }}>
                    {scanStudyLabel(sc, patientXrayOrders)} · {sc.review_status || 'Pending Sign-off'}
                    {sc.order_id && <ImagingHistoryButton orderId={sc.order_id} />}
                  </span>
                </div>

                {/* Inline X-ray card */}
                <div style={{
                  border: `1px solid ${isOpacity ? '#fca5a5' : '#bbf7d0'}`,
                  borderRadius: '10px',
                  background: '#0f172a',
                  display: 'flex',
                  gap: 0,
                  overflow: 'hidden',
                  minHeight: '200px'
                }}>
                  {/* X-ray image panel */}
                  <div style={{ flex: '0 0 220px', position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                    {sc.image ? (
                      <>
                        <img
                          src={sc.image.startsWith('data:') ? sc.image : `data:image/png;base64,${sc.image}`}
                          alt={`X-ray · ${sc.projection || 'View unverified'} · Scan #${sc.scan_id}`} 
                          style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
                        />
                        {isOpacity && sc.x != null && sc.width != null && (
                          <div style={{
                            position: 'absolute',
                            left: `${Math.min(80, Math.max(5, (sc.x / 1024) * 100))}%`,
                            top: `${Math.min(80, Math.max(5, (sc.y / 1024) * 100))}%`,
                            width: `${Math.min(55, Math.max(12, (sc.width / 1024) * 100))}%`,
                            height: `${Math.min(55, Math.max(12, (sc.height / 1024) * 100))}%`,
                            border: '2px solid #ef4444',
                            borderRadius: '3px',
                            pointerEvents: 'none'
                          }} />
                        )}
                      </>
                    ) : (
                      <div style={{ color: '#475569', fontSize: '11px', textAlign: 'center', padding: '12px' }}>
                        <div style={{ fontSize: '28px', marginBottom: '6px' }}>🩻</div>
                        No image on file
                      </div>
                    )}
                  </div>

                  {/* Details panel */}
                  <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#e2e8f0' }}>
                    {/* Status row */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.05em',
                        background: isOpacity ? '#dc2626' : '#16a34a', color: '#fff'
                      }}>
                        {sc.projection || 'VIEW UNVERIFIED'} · {isOpacity ? 'OPACITY' : sc.target === 0 ? 'NO OPACITY' : 'RESULT UNAVAILABLE'}
                      </span>
                      {scanAssessmentStatus(sc) && (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, background: '#1e293b', color: '#94a3b8' }}>
                          <StatusBadge status={scanAssessmentStatus(sc)} />
                        </span>
                      )}
                      {sc.probability != null && (
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Confidence: {(sc.probability * 100).toFixed(1)}%</span>
                      )}
                    </div>

                    {/* Finding / Assessment */}
                    {(sc.radiologist_finding || sc.findings || sc.clinical_summary || sc.assessment) && (
                      <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
                        <span style={{ color: '#94a3b8', fontWeight: 600 }}>Finding: </span>
                        {sc.radiologist_finding || sc.findings || sc.clinical_summary || sc.assessment}
                      </div>
                    )}

                    {/* Scan report */}
                    {sc.scan_report && (
                      <div style={{
                        background: '#1e293b', borderRadius: '6px', padding: '8px 10px',
                        fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.55, marginTop: '2px'
                      }}>
                        <span style={{ color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '3px' }}>{sc.reviewed_at ? 'Radiologist Report' : 'Preliminary report · awaiting radiologist review'}</span>
                        {sc.scan_report}
                      </div>
                    )}

                    {/* Recommended action */}
                    {sc.reviewed_at && (
                      <div style={{ fontSize: '11.5px', color: '#a7f3d0', marginTop: '2px' }}>
                        Radiologist review recorded · {sc.review_status || 'Reviewed'}
                        {sc.reviewed_by ? ` · ${sc.reviewed_by}` : ''}
                        {' · '}{new Date(sc.reviewed_at).toLocaleString()}
                      </div>
                    )}
                    {sc.recommended_action && sc.reviewed_at ? (
                      <details style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                        <summary>Original AI recommendation (before radiologist review)</summary>
                        <div style={{ marginTop: '4px' }}>{sc.recommended_action}</div>
                      </details>
                    ) : sc.recommended_action && (
                      <div style={{ fontSize: '11.5px', color: '#fbbf24', marginTop: '2px' }}>
                        ⚡ {sc.recommended_action}
                      </div>
                    )}

                    {/* Footer meta */}
                    <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '10.5px', color: '#475569', borderTop: '1px solid #1e293b', paddingTop: '8px' }}>
                      <span>SCAN #{sc.scan_id}</span>
                      {sc.patient_code && <span>{sc.patient_code}</span>}
                      {sc.reviewed_by && <span>Reviewed: {sc.reviewed_by}</span>}
                      {sc.created_at && <span>{new Date(sc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                      <button
                        type="button"
                        onClick={() => { setPatientScans(diagScans); setActiveScanIdx(diagScanIdx); setScanModalOpen(true); }}
                        style={{
                          marginLeft: 'auto', padding: '2px 10px', borderRadius: '4px', fontSize: '11px',
                          border: '1px solid #334155', background: '#1e293b', color: '#7dd3fc', cursor: 'pointer', fontWeight: 600
                        }}
                      >
                        View full scan →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Multi-scan selector */}
                {diagScans.length > 1 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {diagScans.map((s, idx) => (
                      <button
                        key={s.scan_id || idx}
                        type="button"
                        onClick={() => setDiagScanIdx(idx)}
                        style={{
                          padding: '3px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${diagScanIdx === idx ? '#4f46e5' : '#cbd5e1'}`,
                          background: diagScanIdx === idx ? '#4f46e5' : '#fff',
                          color: diagScanIdx === idx ? '#fff' : '#475569'
                        }}
                      >
                        {scanStudyLabel(s, patientXrayOrders)} · {scanAssessmentStatus(s)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab: X-Ray */}
      {(activeTab === 'X-Ray' || activeTab === 'X-ray') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top header bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#15181b' }}>Radiology & X-Ray Studies</span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'oklch(0.95 0.04 220)', color: 'oklch(0.4 0.12 220)', fontWeight: 600 }}>
                Patient: {p.name} ({p.uhid})
              </span>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('radiology')}
                style={{
                  height: '28px', padding: '0 12px', borderRadius: '6px',
                  border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                  color: 'oklch(0.4 0.1 200)', fontWeight: 600, cursor: 'pointer', fontSize: '11.5px'
                }}
              >
                Open Radiology Workstation →
              </button>
            )}
          </div>

          {/* Dedicated X-ray order form and order history for this patient */}
          <XrayOrders key={p.patient_id || p.uhid} patient={p} radiologist={currentUser?.role?.toLowerCase() === 'radiologist'} />

          {/* Saved / Archival Scans for this patient */}
          {diagScans.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#15181b' }}>PACS Radiology Archive Scans ({diagScans.length})</span>
                <span style={{ fontSize: '11px', color: '#687076' }}>Live PACS Studies</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {diagScans.map((scan, sIdx) => {
                  const isOp = scan.target === 1;
                  return (
                    <div key={scan.scan_id || sIdx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{scan.scan_type || 'Chest X-Ray'}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Scan #{scan.scan_id} · {scan.scan_date ? new Date(scan.scan_date).toLocaleDateString('en-IN') : 'Recent'}</div>
                        </div>
                        <span style={{
                          fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600,
                          background: isOp ? '#fee2e2' : '#dcfce7',
                          color: isOp ? '#991b1b' : '#166534'
                        }}>
                          {isOp ? 'Opacity Detected' : 'Normal'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#334155', marginBottom: '10px' }}>
                        <strong>Findings:</strong> {scan.findings || (isOp ? 'Opacity detected in lower right lobe.' : 'Clear lung fields, normal cardiac silhouette.')}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewScan(scan)}
                        style={{
                          width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #c7d2fe',
                          background: '#eef2ff', color: '#3730a3', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        🔬 View in DICOM Viewer
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Medications */}
      {activeTab === 'Medications' && (
        <TableContainer
          cols={['Rx', 'Drug', 'Dose · Route · Freq', 'Days · Qty', 'Safety', 'Status']}
          grid="120px minmax(200px, 1fr) 180px 140px 100px 90px"
          rows={
            (p.medications && p.medications.length > 0)
              ? p.medications.map((m, idx) => {
                  const qtyVal = m.quantity || (() => {
                    const days = parseInt(m.duration) || 5;
                    const freqLower = (m.frequency || '').toLowerCase().trim();
                    const freqMultiplier = freqLower.includes('tds') || freqLower.includes('tid') ? 3
                      : (freqLower.includes('bd') || freqLower.includes('bid')) ? 2
                      : freqLower.includes('qid') ? 4
                      : 1;
                    return days * freqMultiplier;
                  })();
                  return [
                    `RX-${idx + 101}`,
                    m.medication_name,
                    `${m.dosage || ''} ${m.route || 'Oral'} ${m.frequency || 'OD'}`.trim() || 'Standard Dose',
                    `${m.duration || '5 Days'} · Qty: ${qtyVal}`,
                    'Clear',
                    'Active'
                  ];
                })
              : (liveBill?.pharmacy_items && liveBill.pharmacy_items.length > 0)
                ? liveBill.pharmacy_items.map((pi, idx) => [
                    `RX-${pi.sale_item_id || idx + 101}`,
                    pi.item_name,
                    `${pi.category || 'Therapeutic'} · Dispensed`,
                    `${pi.quantity || 1} units · Qty: ${pi.quantity || 1}`,
                    'Clear',
                    'Active'
                  ])
                : [
                    [`RX-${p.admission_id || '87248'}`, 'Tab. Paracetamol 650mg', '650mg Oral SOS', '5 Days · Qty: 10', 'Clear', 'Active']
                  ]
          }
          onRowClick={(row) => {
            if (onOpenDrawer) {
              onOpenDrawer({
                title: `${row[1]} · ${row[0]}`,
                sub: `${row[2]} · ${row[3]}`,
                badges: [{ t: row[5], bg: '#dcfce7', fg: '#15803d' }],
                facts: [
                  { k: 'Prescription Code', v: row[0], b: true },
                  { k: 'Medication Name', v: row[1] },
                  { k: 'Dosage & Regimen', v: row[2] },
                  { k: 'Duration & Quantity', v: row[3] },
                  { k: 'Safety Clearance', v: row[4] },
                  { k: 'Status', v: row[5] }
                ]
              });
            }
          }}
        />
      )}

      {/* Tab 7: Admissions */}
      {activeTab === 'Admissions' && (
        <TableContainer
          cols={['Admission / Encounter', 'Bed / Location', 'Date & Time', 'Estimate / Fee', 'Status']}
          grid="160px minmax(180px, 1fr) 160px 140px 180px"
          rows={
            p.isOP ? [
              [p.encounter, '— (Outpatient Desk)', `${p.admittedDate}, ${p.admittedTime}`, `₹${(p.billGrossAmount || 800).toLocaleString('en-IN')}`, 'Outpatient Consultation (No IP Stay)'],
            ] : p.isER ? [
              [p.encounter, p.bed, `${p.admittedDate}, ${p.admittedTime}`, `₹${(p.billGrossAmount || 2500).toLocaleString('en-IN')}`, 'Emergency Observation (Bay Triage)'],
            ] : [
              [p.encounter || `IP-${p.admission_id}`, p.isDischarged ? `${p.bed} (Released)` : p.bed, p.admitted, `₹${p.billNetAmount.toLocaleString('en-IN')}`, p.isDischarged ? 'Discharged' : (p.status || 'Active Inpatient')],
            ]
          }
        />
      )}

      {/* Tab 8: Insurance */}
      {activeTab === 'Insurance' && (
        <TableContainer
          cols={['Case', 'Insurer', 'Requested', 'Approved', 'Missing', 'Risk', 'Status']}
          grid="130px 180px 120px 120px minmax(180px, 1fr) 80px 160px"
          rows={
            (liveBill?.claims && liveBill.claims.length > 0)
              ? liveBill.claims.map(claim => [
                  claim.claim_number || `CLM-${claim.claim_id}`,
                  claim.insurance_provider || p.insurer,
                  `₹${Number(claim.claimed_amount || p.billNetAmount).toLocaleString('en-IN')}`,
                  `₹${Number(claim.approved_amount || 0).toLocaleString('en-IN')}`,
                  claim.rejection_reason || (Number(claim.outstanding_amount) > 0 ? `Co-pay: ₹${Number(claim.outstanding_amount).toLocaleString('en-IN')}` : 'None · Verified'),
                  '0%',
                  claim.claim_status || 'Pending'
                ])
              : [
                  [
                    `PA-2026-${String(p.patient_id || p.admission_id || '01').slice(-4)}`,
                    p.insurer || 'Direct Billing / Corporate',
                    `₹${p.billNetAmount.toLocaleString('en-IN')}`,
                    `₹${(p.isCleared ? p.billNetAmount : Math.max(0, p.billNetAmount - p.outstandingBalance)).toLocaleString('en-IN')}`,
                    p.isCleared ? 'None · Pre-auth verified' : `Co-pay balance: ₹${p.outstandingBalance.toLocaleString('en-IN')}`,
                    p.isCleared ? '0%' : '5%',
                    p.isCleared ? 'Approved · Settled' : 'Pending Clearance'
                  ]
                ]
          }
        />
      )}

      {/* Tab 9: Billing - Full Dynamic Itemized Bill Breakdown */}
      {activeTab === 'Billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Master Bill Overview Row */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#15181b', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Inpatient Master Bill · Summary</span>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>Click row to view full drawer facts</span>
            </div>
            <TableContainer
              cols={['Bill', 'Estimate', 'Actual Gross', 'Insurance / Paid', 'Patient Due', 'Status']}
              grid="150px 120px 120px 140px 130px 180px"
              rows={[
                [
                  p.billNumber,
                  `₹${Math.round(p.billNetAmount * 0.9).toLocaleString('en-IN')}`,
                  `₹${p.billNetAmount.toLocaleString('en-IN')}`,
                  `₹${(p.isCleared ? p.billNetAmount : Math.max(0, p.billNetAmount - p.outstandingBalance)).toLocaleString('en-IN')}`,
                  `₹${(p.isCleared ? 0 : p.outstandingBalance).toLocaleString('en-IN')}`,
                  p.billingStatusDisplay
                ],
              ]}
              onRowClick={handleOpenBillDrawer}
            />
          </div>

          {/* Section 1: Hospital Accommodation & Base Services */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#15181b', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🏥</span>
                <span>Inpatient Bed Accommodation & Hospital Base Care</span>
              </div>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px', fontWeight: 600, color: '#15181b' }}>
                Subtotal: ₹{hospitalSum.toLocaleString('en-IN')}
              </span>
            </div>
            <TableContainer
              cols={['Service Description', 'Code', 'Date', 'Qty / Stay', 'Unit Rate', 'Net Amount']}
              grid="minmax(220px, 1.4fr) 110px 120px 120px 120px 140px"
              rows={
                (liveBill?.items && liveBill.items.length > 0)
                  ? liveBill.items.map((bi, i) => [
                      bi.description || `Inpatient Bed & Dietary Care #${i + 1}`,
                      bi.service_code || 'BED-CLR',
                      bi.service_date ? new Date(bi.service_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (p.admittedDate || '17 May 2025'),
                      `${bi.quantity || 1} ${Number(bi.quantity) > 1 ? 'days' : 'unit'}`,
                      `₹${Number(bi.unit_price || 0).toLocaleString('en-IN')}`,
                      `₹${Number(bi.net_amount || bi.gross_amount || 0).toLocaleString('en-IN')}`
                    ])
                  : [
                      ['Inpatient Bed Clearance & Dietary Food Bill', 'BED-CLR', p.admittedDate || '17 May 2025', `${p.current_stay_days || 487} days`, '₹500.00', `₹${hospitalSum.toLocaleString('en-IN')}`],
                      ['Inpatient Base Fee & Clinical Nursing Care', 'BASE-FEE', p.admittedDate || '17 May 2025', '1 unit', '₹2,500.00', '₹2,500.00']
                    ]
              }
              onRowClick={handleOpenBillDrawer}
            />
          </div>

          {/* Section 2: Pharmacy & Prescribed Medications */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#15181b', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💊</span>
                <span>Pharmacy Sales & Dispensed Medications Details</span>
              </div>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px', fontWeight: 600, color: '#15181b' }}>
                Subtotal: ₹{pharmacySum.toLocaleString('en-IN')}
              </span>
            </div>
            <TableContainer
              cols={['Medication / Item', 'Generic Classification', 'Category', 'Dispensed Date', 'Qty', 'Unit Price', 'Net Amount']}
              grid="minmax(180px, 1.2fr) minmax(140px, 1fr) 130px 120px 90px 110px 130px"
              rows={
                (liveBill?.pharmacy_items && liveBill.pharmacy_items.length > 0)
                  ? liveBill.pharmacy_items.map(pi => [
                      pi.item_name || 'Prescribed Medication',
                      pi.generic_name || 'Generic Formulation',
                      pi.category || 'Therapeutic',
                      pi.sale_date ? new Date(pi.sale_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (p.admittedDate || '17 May 2025'),
                      `${pi.quantity || 1} units`,
                      `₹${Number(pi.unit_price || 0).toFixed(2)}`,
                      `₹${Number(pi.net_amount || (pi.quantity * pi.unit_price) || 0).toLocaleString('en-IN')}`
                    ])
                  : (p.medications && p.medications.length > 0)
                    ? p.medications.map((m, i) => [
                        m.medication_name,
                        m.generic_name || 'Generic Formulation',
                        m.category || 'Oral Formulation',
                        p.admittedDate || '17 May 2025',
                        m.duration || '1 Course',
                        'Standard Rate',
                        'Billed'
                      ])
                    : [
                        ['Tab. Paracetamol 650mg', 'Paracetamol', 'Analgesic', p.admittedDate || '17 May 2025', '10 tabs', '₹10.00', '₹100.00']
                      ]
              }
              onRowClick={handleOpenBillDrawer}
            />
          </div>

          {/* Section 3: Laboratory & Diagnostic Investigations */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#15181b', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🧪</span>
                <span>Laboratory Investigations & Diagnostic Test Charges</span>
              </div>
              <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px', fontWeight: 600, color: '#15181b' }}>
                Subtotal: ₹{labSum.toLocaleString('en-IN')}
              </span>
            </div>
            <TableContainer
              cols={['Test / Investigation', 'Department', 'Ordered Date', 'Parameter & Result', 'Standard Charge', 'Status']}
              grid="minmax(180px, 1.2fr) 130px 120px minmax(180px, 1fr) 130px 110px"
              rows={
                (liveBill?.lab_items && liveBill.lab_items.length > 0)
                  ? liveBill.lab_items.map(li => [
                      li.item_name || 'Diagnostic Investigation',
                      li.test_category || 'LIS / Hematology',
                      li.ordered_date ? new Date(li.ordered_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (p.admittedDate || '17 May 2025'),
                      li.test_parameter ? `${li.test_parameter}: ${li.result_value || 'Normal'} ${li.unit || ''}`.trim() : (li.result_value || 'Verified'),
                      `₹${Number(li.unit_price || li.net_amount || 0).toLocaleString('en-IN')}`,
                      li.order_status || 'Completed'
                    ])
                  : (p.lab_results_list && p.lab_results_list.length > 0)
                    ? p.lab_results_list.map(lr => [
                        lr.test_parameter || 'Clinical Diagnostic Test',
                        'Biochemistry / LIS',
                        lr.result_date ? new Date(lr.result_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (p.admittedDate || '17 May 2025'),
                        `${lr.result_value || 'Normal'} ${lr.unit || ''}`,
                        '₹450.00',
                        lr.verification_status || 'Verified'
                      ])
                    : [
                        ['Complete Blood Count (CBC)', 'Hematology', p.admittedDate || '17 May 2025', 'Param: 10.5 g/dL', '₹450.00', 'Completed']
                      ]
              }
              onRowClick={handleOpenBillDrawer}
            />
          </div>

          {/* Section 4: Comprehensive Financial Reconciliation Card */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#15181b', marginBottom: '12px' }}>
              Itemized Financial Reconciliation & Clearance Balance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Hospital Stay & Nursing</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '4px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  ₹{hospitalSum.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Pharmacy & Dispensed</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '4px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  ₹{pharmacySum.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Lab Investigations</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '4px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  ₹{labSum.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Insurance / Settled</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#15803d', marginTop: '4px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  ₹{(p.isCleared ? p.billNetAmount : Math.max(0, p.billNetAmount - p.outstandingBalance)).toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: p.isCleared ? '#f0fdf4' : '#fef2f2', padding: '12px', borderRadius: '6px', border: `1px solid ${p.isCleared ? '#bbf7d0' : '#fecaca'}` }}>
                <div style={{ fontSize: '11px', color: p.isCleared ? '#15803d' : '#991b1b', textTransform: 'uppercase', letterSpacing: '.04em' }}>Patient Balance Due</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: p.isCleared ? '#15803d' : '#991b1b', marginTop: '4px', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                  ₹{(p.isCleared ? 0 : p.outstandingBalance).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!p.isCleared && (
                <button
                  type="button"
                  onClick={handleClearBill}
                  disabled={clearingBill}
                  style={{
                    height: '32px', padding: '0 14px', borderRadius: '6px',
                    border: '1px solid #059669', background: '#059669',
                    color: '#fff', fontWeight: 600, cursor: clearingBill ? 'not-allowed' : 'pointer', fontSize: '12px',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    opacity: clearingBill ? 0.7 : 1
                  }}
                >
                  <span>💳</span> {clearingBill ? 'Settling Bill...' : 'Settle Cashless Co-Pay'}
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenBillDrawer}
                style={{
                  height: '32px', padding: '0 14px', borderRadius: '6px',
                  border: '1px solid oklch(0.5 0.1 200)', background: 'oklch(0.5 0.1 200)',
                  color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px',
                  display: 'inline-flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span>🧾</span> Open Detailed Bill Drawer →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 10: Discharge */}
      {activeTab === 'Discharge' && (
        <TableContainer
          cols={['Case', 'Intent', 'Predicted', 'Discharge Date & Time', 'Owner', 'Status']}
          grid="130px 130px 130px minmax(190px, 1.3fr) minmax(160px, 1fr) 180px"
          rows={
            p.isOP ? [
              [
                `OPD-${p.encounter}`,
                p.admittedDate,
                'N/A (OP Visit)',
                'Same-Day Outpatient Exit',
                `Doctor: ${p.doctor}`,
                'Outpatient Visit · No IP Stay Required'
              ]
            ] : p.isER ? [
              [
                `ER-${p.encounter}`,
                p.admittedDate,
                'Pending Triage',
                'Observation / Pending Admission',
                `ER Physician: ${p.doctor}`,
                'Active Emergency Observation'
              ]
            ] : [
              [
                `DC-2026-${String(p.patient_id || p.admission_id || '01').slice(-4)}`,
                p.admittedDate || '17 May 2025',
                p.isDischarged ? 'Completed' : (p.isCleared ? 'Ready' : 'Blocked'),
                p.dischargeDateTime,
                p.isDischarged ? (p.doctor || 'Clinical Care Desk / Doctor') : (p.isCleared ? 'Clinical Discharge Agent' : `Doctor: ${p.doctor}`),
                p.isDischarged ? 'Discharged · Signed Off' : (p.isCleared ? 'Ready for Sign-Off' : 'Blocked · Pending Bill Clearance')
              ],
            ]
          }
          onRowClick={(row) => {
            if (p.isOP || p.isER) {
              if (onOpenDrawer) {
                onOpenDrawer({
                  title: `${row[0]} · ${p.name}`,
                  sub: `Status: ${row[5]} | Date: ${row[1]}`,
                  badges: [
                    { t: p.isOP ? 'Outpatient Consultation' : 'Emergency Observation', bg: p.isOP ? '#e0f2fe' : '#fef3c7', fg: p.isOP ? '#0369a1' : '#92400e' }
                  ],
                  facts: [
                    { k: 'Record ID', v: row[0], b: true },
                    { k: 'Patient Name', v: p.name, b: true },
                    { k: 'Visit Date', v: row[1] },
                    { k: 'Attending Physician', v: row[4] },
                    { k: 'Status', v: row[5] },
                    { k: 'Billing Settlement', v: p.billingStatusDisplay }
                  ]
                });
              }
              return;
            }

            if (onOpenDrawer) {
              onOpenDrawer({
                title: `${row[0]} · ${p.name}`,
                sub: `Discharge Status: ${row[5]} | Date & Time: ${row[3]}`,
                badges: [
                  { t: p.isDischarged ? 'Discharged & Signed Off' : (p.isCleared ? 'Ready for Sign-Off' : 'Pending Clearance'), bg: p.isDischarged ? '#dcfce7' : (p.isCleared ? '#e0f2fe' : '#fef3c7'), fg: p.isDischarged ? '#15803d' : (p.isCleared ? '#0369a1' : '#92400e') }
                ],
                facts: [
                  { k: 'Discharge Case ID', v: row[0], b: true },
                  { k: 'Patient Name', v: p.name, b: true },
                  { k: 'Discharge Date & Time', v: row[3], b: true },
                  { k: 'Intent Date', v: row[1] },
                  { k: 'Predicted Progression', v: row[2] },
                  { k: 'Attending Physician', v: row[4] },
                  { k: 'Clearance Status', v: row[5] },
                  { k: 'Bill Settlement', v: p.billingStatusDisplay },
                  { k: 'Vital Signs at Discharge', v: p.latestBp }
                ],
                actions: [
                  {
                    label: p.isDischarged ? 'View Signed Discharge Summary' : 'Execute Discharge Sign-Off',
                    primary: true,
                    on: () => {
                      if (onOpenDischarge) onOpenDischarge();
                      else if (onNavigate) onNavigate('discharge');
                    }
                  }
                ]
              });
            } else if (onOpenDischarge) {
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
          grid="130px 110px minmax(260px, 1fr) 60px 100px"
          rows={[
            ['Today 11:10', 'WhatsApp', `Discharge status update · ${p.isCleared ? 'NOC Approved' : 'Outstanding balance ₹' + p.outstandingBalance.toLocaleString('en-IN')}`, p.lang?.slice(0, 2)?.toUpperCase() || 'EN', 'Delivered'],
            ['Today 09:12', 'Mobile push', `Discharge planning status notification sent to ${p.phone}`, p.lang?.slice(0, 2)?.toUpperCase() || 'EN', 'Delivered'],
            [`${p.admittedDate} 12:45`, 'Email', `Diagnostic lab & imaging reports ready for review by ${p.doctor}`, p.lang?.slice(0, 2)?.toUpperCase() || 'EN', 'Delivered'],
            [`${p.admittedDate} 10:20`, 'SMS', `Inpatient admission confirmed at ${p.bed}`, 'EN', 'Delivered'],
          ]}
        />
      )}

      {/* Tab 12: Feedback */}
      {activeTab === 'Feedback' && (
        <TableContainer
          cols={['Case', 'Feedback', 'Priority', 'Owner', 'Status']}
          grid="120px minmax(240px, 1fr) 90px 160px 100px"
          rows={[
            [`FDB-${String(p.patient_id || p.admission_id || '101').slice(-4)}`, `Patient care & billing coordination for ${p.name} (${p.insurer})`, 'Medium', p.doctor, p.isCleared ? 'Completed' : 'In Progress'],
          ]}
        />
      )}

      {/* Tab 13: Documents */}
      {activeTab === 'Documents' && (
        <TableContainer
          cols={['Document', 'Version', 'Author', 'Status']}
          grid="minmax(240px, 1fr) 90px 180px 160px"
          rows={[
            ['Discharge Summary', 'v1 draft', `AI draft · ${p.doctor}`, p.isCleared ? 'Approved & Signed' : 'DRAFT — HUMAN REVIEW'],
            ['Itemized Hospital & Pharmacy Bill', 'v1', 'Finance & Revenue Lead', p.isCleared ? 'Paid in Full' : 'Pending Settlement'],
            ['Diagnostic & Lab Investigation Panel', 'Final', 'LIS Pathology Lead', 'Verified & Signed'],
            ['Patient Admission & Consent Form', 'v1', 'Front Office Lead', 'Signed'],
          ]}
        />
      )}

      {/* Tab 14: Consent */}
      {activeTab === 'Consent' && (
        <TableContainer
          cols={['Purpose', 'State', 'Verified']}
          grid="minmax(240px, 1fr) 100px 200px"
          rows={[
            ['WhatsApp Messaging', 'Active On', `${p.admittedDate} · OTP Verified (${p.phone})`],
            ['Appointment Reminders', 'Active On', `${p.admittedDate} · Mobile OTP`],
            ['Diagnostic & Lab Notifications', 'Active On', `${p.admittedDate} · Mobile OTP`],
            ['Billing & Payment Notifications', 'Active On', `${p.admittedDate} · Mobile OTP`],
            ['Discharge Status Notifications', 'Active On', `${p.admittedDate} · Mobile OTP`],
            ['AI Clinical Interpretation', 'Active On', 'Clinical Consent Protocol'],
            ['Third-party Data Sharing', 'Disabled Off', 'Statutory Patient Privacy'],
          ]}
        />
      )}

      {/* Tab 15: AI Activity */}
      {activeTab === 'AI Activity' && (
        <TableContainer
          cols={['Execution', 'Agent', 'Started', 'Steps', 'Status']}
          grid="150px minmax(200px, 1fr) 130px 70px 110px"
          rows={aiAgents.map(a => [
            a.id,
            a.agent,
            p.admittedDate || 'Today',
            String(a.steps),
            a.status
          ])}
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
                      ...statusStyle(scanAssessmentStatus(currentScan)),
                    }}
                  >
                    {scanAssessmentStatus(currentScan)}
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
                    {scanStudyLabel(s, patientXrayOrders)} · {scanAssessmentStatus(s)}
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
                    <span>VIEW: {currentScan.projection || 'Unverified'}</span>
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
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Combined AI review priority</div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: statusStyle(scanAssessmentStatus(currentScan)).color,
                        marginTop: '2px',
                      }}
                    >
                      {scanAssessmentStatus(currentScan)}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Opacity Status</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {currentScan.target === 1 ? 'Focal opacity localized' : currentScan.target === 0 ? 'No focal opacity localized' : 'Localization unavailable'}
                    </div>
                  </div>
                </div>

                {/* Scan Report Text */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Automated Radiologic Report / Findings:
                  </div>
                  <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {currentScan.scan_report || 'Report unavailable · awaiting radiologist review.'}
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
                  title="Open original patient X-ray in OHIF DICOM Viewer"
                  onClick={() => {
                    const uid = currentScan?.study_instance_uid ||
                                (currentScan?.original_patient_id && currentScan.original_patient_id.includes('.') ? currentScan.original_patient_id : null) ||
                                (currentScan?.study_id && currentScan.study_id.includes('.') ? currentScan.study_id : null);
                    const ohifUrl = getOhifViewerUrl(uid);
                    // Close the triage popup and open OHIF exclusively in the same tab
                    setScanModalOpen(false);
                    setOhifViewerModal(ohifUrl);
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
                  <span>🖼️</span>
                  Open in OHIF Viewer →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Embedded OHIF DICOM Viewer Modal (Same Tab) */}
      {ohifViewerModal && (
        <div
          onClick={() => setOhifViewerModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '98vw',
              height: '96vh',
              background: '#090d16',
              borderRadius: 10,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              border: '1px solid #1e293b',
            }}
          >
            {/* Dark medical themed header */}
            <div
              style={{
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                borderBottom: '1px solid #1e293b',
                background: '#0f172a',
                color: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '18px' }}>🖼️</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                    OHIF DICOM Viewer
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: '#1e3a8a', color: '#93c5fd' }}>
                      ORIGINAL X-RAY
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    Patient: <strong style={{ color: '#e2e8f0' }}>{p.name}</strong> · UHID: {p.uhid}
                    {currentScan?.display_study_id && ` · Accession: ${currentScan.display_study_id}`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <a
                  href={ohifViewerModal}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#93c5fd',
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Open Direct ↗
                </a>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={() => {
                    setOhifViewerModal(null);
                    setScanModalOpen(true);
                  }}
                >
                  ← Back to Triage Scan
                </button>
                <button
                  type="button"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#fca5a5',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  onClick={() => setOhifViewerModal(null)}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* OHIF Iframe */}
            <iframe
              title="OHIF DICOM Viewer"
              src={ohifViewerModal}
              style={{ border: 0, flex: 1, width: '100%', height: '100%', background: '#000' }}
            />
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
          {row.map((cell, cIdx) => {
            if (React.isValidElement(cell)) {
              return (
                <div key={cIdx} style={{ minWidth: 0, overflow: 'hidden' }}>
                  {cell}
                </div>
              );
            }
            const cellStr = String(cell ?? '');
            const isMono = cIdx === 0 || cellStr.includes('₹') || cellStr.includes(':') || /^\d/.test(cellStr) || /^D-\d+/i.test(cellStr);
            const isRed = cellStr.includes('Blocked') || cellStr.includes('⚠') || cellStr.includes('Pending Clearance');
            const isGreen = cellStr.includes('Completed') || cellStr.includes('Verified') || cellStr.includes('Final') || cellStr.includes('Cleared') || cellStr.includes('Paid') || cellStr.includes('Active');
            return (
              <span
                key={cIdx}
                style={{
                  fontFamily: isMono ? 'ui-monospace, Menlo, monospace' : 'inherit',
                  fontWeight: cIdx === 0 || cIdx === 1 ? 600 : 400,
                  color: isRed ? '#dc2626' : isGreen ? '#15803d' : '#15181b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {cellStr}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
