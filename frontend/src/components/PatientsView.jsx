import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, UserPlus, Check } from "lucide-react";
import { apiService, parseAdmissionLlmRecord, parseDischargeSummaryRecord, extractDischargedPatientIds, matchesDoctor, cleanDiagnosis, cleanDoctorName } from "../services/api";
import ModuleLoadingScreen, { TableSkeleton } from "./ModuleLoadingScreen";
import PatientRegistrationModal from "./PatientRegistrationModal";
import SearchInput from "./SearchInput";
import TablePagination from "./TablePagination";
import DateRangeFilter, { isDateInRange, formatFriendlyDate } from "./DateRangeFilter";

function getStatusPill(status) {
  if (!status) return { bg: "#f2f3f4", fg: "#52585e", label: "Unknown" };
  const s = String(status).toLowerCase();
  if (s.includes("discharge ready")) return { bg: "oklch(0.95 0.04 150)", fg: "oklch(0.4 0.12 150)", label: "Discharge ready" };
  if (s.includes("discharge planning")) return { bg: "oklch(0.95 0.03 200)", fg: "oklch(0.4 0.1 200)", label: "Discharge planning" };
  if (s.includes("post-op") || s.includes("postop")) return { bg: "oklch(0.96 0.05 80)", fg: "oklch(0.45 0.13 70)", label: "Post-operative" };
  if (s.includes("fit for discharge")) return { bg: "oklch(0.95 0.04 150)", fg: "oklch(0.4 0.12 150)", label: "Fit for discharge" };
  if (s.includes("awaiting")) return { bg: "oklch(0.96 0.05 80)", fg: "oklch(0.5 0.13 70)", label: status };
  if (s.includes("confirmed") || s.includes("booked")) return { bg: "#e0f2fe", fg: "#0369a1", label: "Confirmed" };
  if (s.includes("resuscitation") || s.includes("critical") || s.includes("icu") || s.includes("stroke")) return { bg: "#fee2e2", fg: "#b91c1c", label: status };
  if (s.includes("triage") || s.includes("workup") || s.includes("stabilization") || s.includes("nebulization") || s.includes("resuscitation") || s.includes("treatment")) return { bg: "#fef3c7", fg: "#92400e", label: status };
  if (s.includes("stable")) return { bg: "#f6f7f8", fg: "#52585e", label: "Stable" };
  if (s.includes("signed off")) return { bg: "#f2f3f4", fg: "#8a9096", label: "Signed off" };
  if (s.includes("long stay")) return { bg: "oklch(0.96 0.03 25)", fg: "oklch(0.5 0.18 25)", label: "Long stay" };
  if (s.includes("discharged")) return { bg: "#f2f3f4", fg: "#52585e", label: "Discharged" };
  if (s.includes("admitted") || s.includes("active")) return { bg: "oklch(0.95 0.04 150)", fg: "oklch(0.4 0.12 150)", label: status.length > 20 ? "Admitted" : status };
  return { bg: "#f6f7f8", fg: "#52585e", label: status };
}

const dept = (p) => p.department || p.dept || p.ward || "—";
const lang = (p) => p.language || p.preferred_language || "Tamil";
const insurer = (p) => p.insurer || p.insurance || p.insurance_company || p.payor || "Self-pay";

const GRID = "140px minmax(130px,1.2fr) 75px 105px 85px 125px 150px 115px 125px";

const FEMALE_NAME_ROOTS = [
  'ananya', 'anitha', 'aparna', 'bhavani', 'deepa', 'divya', 'gayathri', 'gita', 'geeta',
  'kavitha', 'keerthana', 'lakshmi', 'malini', 'meenakshi', 'nandini', 'nisha', 'pavithra',
  'pooja', 'preethi', 'priya', 'revathi', 'saanvi', 'sandhya', 'sangeetha', 'saranya',
  'shalini', 'sowmya', 'swati', 'yamini', 'mary', 'sarah', 'fatima', 'aisha', 'zainab',
  'sneha', 'sunita', 'savita', 'chandana', 'padma', 'shanthi', 'radha', 'uma', 'vidya',
  'rekha', 'chhavi', 'pallavi', 'kamala', 'pat2', 'meena', 'rani', 'devi'
];

function inferGenderFromName(name) {
  const clean = String(name || '').trim().toLowerCase();
  for (const root of FEMALE_NAME_ROOTS) {
    if (clean.includes(root)) return 'Female';
  }
  return 'Male';
}

function formatRecordDate(dateVal, fallback = '—') {
  if (!dateVal) return fallback;
  try {
    const s = String(dateVal).trim();
    if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(s)) {
      return s;
    }
    const parsed = new Date(dateVal);
    if (!isNaN(parsed.getTime())) {
      if (parsed.getFullYear() > 2026) {
        parsed.setFullYear(2026);
      }
      return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch { }
  return String(dateVal || fallback);
}

export default function PatientsView({
  onSelectPatient,
  onOpenSoap,
  onNavigate,
  doctorName = null,
  userRole = 'Hospital Management',
  currentUser = null,
  initialFilter = 'All'
}) {
  const isDoctor = userRole === 'Doctor' || (doctorName && userRole !== 'Hospital Management' && userRole !== 'Admin');
  const activeDoctorName = isDoctor ? (doctorName || currentUser?.name || null) : null;

  const authUser = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('hx_auth') || sessionStorage.getItem('meridian_user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const activeDoctorId = isDoctor ? (authUser.doctorId || authUser.doctor_id || null) : null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [admitted, setAdmitted] = useState([]);
  const [discharged, setDischarged] = useState([]);
  const [opPatients, setOpPatients] = useState([]);
  const [erPatients, setErPatients] = useState([]);
  const [historicalPatients, setHistoricalPatients] = useState([]);
  const [historicalCategoryRows, setHistoricalCategoryRows] = useState([]);
  const [historicalCategoryCounts, setHistoricalCategoryCounts] = useState({
    IP: 0, OP: 0, ER: 0, Discharged: 0,
  });
  const [historicalTotal, setHistoricalTotal] = useState(143146);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [filter, setFilter] = useState(initialFilter || "All");
  const [workloadScope, setWorkloadScope] = useState('all'); // 'all' - overall data scope
  const [dateRange, setDateRange] = useState({ dateFrom: '', dateTo: '', preset: 'all_time' });
  const [isDateFiltering, setIsDateFiltering] = useState(false);

  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
    }
  }, [initialFilter]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (search.trim()) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setDebouncedSearch(search);
        setIsSearching(false);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setDebouncedSearch("");
      setIsSearching(false);
    }
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, debouncedSearch, activeDoctorName, activeDoctorId, dateRange]);

  useEffect(() => {
    let alive = true;
    let requestInProgress = false;
    const loadPatients = async (isSilent = false) => {
      if (requestInProgress) return;
      requestInProgress = true;
      if (!isSilent && admitted.length === 0 && discharged.length === 0 && opPatients.length === 0 && erPatients.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        const [ar, dr, opRes, erRes] = await Promise.all([
          apiService.getCurrentAdmissions(
            { discharge_status: 'all', scope: 'active', limit: 250 },
            { forceRefresh: true }
          ).catch(() => ({ data: [] })),
          apiService.getDischargedPatients(
            { scope: 'active', limit: 250 },
            { forceRefresh: true }
          ).catch(() => ({ data: [] })),
          apiService.getAllPatientsDirectory({ category: 'OP' }, { forceRefresh: true }).catch(() => ({ data: [] })),
          apiService.getAllPatientsDirectory({
            category: 'ER',
            doctor_id: activeDoctorId || undefined,
          }, { forceRefresh: true }).catch(() => ({ data: [] })),
        ]);
        const allDirRes = { data: [] };
        if (!alive) return;

        const rawDischarges = Array.isArray(dr) ? dr : (dr?.data || []);
        const rawAdmissions = Array.isArray(ar) ? ar : (ar?.data || []);

        const dischargeMapByPid = {};
        const dischargeMapByAid = {};
        rawDischarges.forEach(d => {
          if (d.patient_id) dischargeMapByPid[String(d.patient_id)] = d;
          if (d.admission_id) dischargeMapByAid[String(d.admission_id)] = d;
        });

        const dischargedTracker = extractDischargedPatientIds(rawDischarges);

        const seenDischargedKeys = new Set();
        const seenDischargedPids = new Set();
        const parsedDischargedList = [];
        const actualAdmitted = [];

        rawAdmissions.forEach(r => {
          const st = String(r.discharge_status || r.admission_status || '').trim().toLowerCase();
          const pid = String(r.patient_id || r.id || '').trim();
          const aid = String(r.admission_id || '').trim();
          const matchKey = aid ? `adm_${aid}` : `pid_${pid}`;

          const isDischarged = st === 'discharged';
          const matchedSummary = dischargeMapByPid[pid] || (aid ? dischargeMapByAid[aid] : null);

          const parsed = parseAdmissionLlmRecord(r);
          const pName = r.patient_name || (r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : null) || parsed.name || parsed.patient_name;
          const rawDoc = isDischarged
            ? (matchedSummary?.primary_consultant || matchedSummary?.doctor_name || r.attending_doctor || parsed.doctor || 'Attending Physician')
            : (r.attending_doctor || parsed.doctor || matchedSummary?.primary_consultant || matchedSummary?.doctor_name || 'Attending Physician');
          const docName = cleanDoctorName(rawDoc);

          if (isDischarged) {
            if (pid) seenDischargedPids.add(pid);
            if (matchKey) seenDischargedKeys.add(matchKey);
            parsedDischargedList.push({
              ...parsed,
              name: pName,
              patient_name: pName,
              patient: pName,
              age: r.age_at_admission || parsed.age || 45,
              sex: r.gender ? (r.gender.toLowerCase().startsWith('f') ? 'F' : r.gender.toLowerCase().startsWith('m') ? 'M' : r.gender) : (parsed.sex || 'F'),
              gender: r.gender || parsed.gender || 'Unknown',
              department: r.department || matchedSummary?.department || parsed.department || r.ward_name || 'General Medicine',
              doctor: docName,
              diagnosis: cleanDiagnosis(matchedSummary?.diagnoses || r.primary_diagnosis || parsed.diagnosis || ''),
              _type: "Discharged",
              _status: "Discharged"
            });
          } else {
            const isReady = String(r.discharge_status || '').trim().toLowerCase() === 'ready';
            actualAdmitted.push({
              ...parsed,
              doctor_id: r.doctor_id || parsed.doctor_id,
              name: pName,
              patient_name: pName,
              doctor: docName,
              diagnosis: cleanDiagnosis(r.primary_diagnosis || parsed.diagnosis || ''),
              _type: "IP",
              _status: isReady ? "Fit for discharge" : (parsed.status || "Admitted")
            });
          }
        });

        // Merge any additional live IP admissions from directory (allDirRes) not already present
        const seenActiveAdmissionIds = new Set(actualAdmitted.map(a => String(a.admission_id || '')).filter(Boolean));
        const seenAdmittedPids = new Set(actualAdmitted.map(a => String(a.patient_id || a.id || '')));
        (allDirRes?.data || []).forEach(r => {
          if (r.patient_type === 'IP' || r.encounter_type === 'IP') {
            const pid = String(r.patient_id || r.id || '');
            if (pid && !seenAdmittedPids.has(pid) && !seenDischargedPids.has(pid)) {
              seenAdmittedPids.add(pid);
              const isReady = String(r.discharge_status || '').trim().toLowerCase() === 'ready';
              const pName = r.patient_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Patient';
              actualAdmitted.unshift({
                ...r,
                id: r.patient_id || r.id,
                patient_id: r.patient_id || r.id,
                patient_code: r.patient_code || (pid ? `MER-PAT-${pid.padStart(7, '0')}` : 'MER-PAT-0000'),
                uhid: r.patient_code || (pid ? `MER-PAT-${pid.padStart(7, '0')}` : 'MER-PAT-0000'),
                patient_number: r.patient_code || (pid ? `MER-PAT-${pid.padStart(7, '0')}` : 'MER-PAT-0000'),
                name: pName,
                patient_name: pName,
                patient: pName,
                doctor: cleanDoctorName(r.doctor || 'Attending Physician'),
                diagnosis: cleanDiagnosis(r.diagnosis || 'Inpatient Admission'),
                _type: "IP",
                _status: isReady ? "Fit for discharge" : (r.status || "Admitted")
              });
            }
          }
        });

        // 2. Add approved finalized discharge summaries
        rawDischarges.forEach(r => {
          const statusLower = String(r.approval_status || r.status || '').trim().toLowerCase();
          const isApproved = statusLower === 'approved' || statusLower === 'signed' || statusLower === 'signed off' || statusLower === 'completed';
          const isExplicitDischarge = isApproved || String(r.discharge_status || '').trim().toLowerCase() === 'discharged' || r.is_discharged === true;
          if (!isExplicitDischarge) return;

          const sid = r.summary_id || r.id;
          const pid = String(r.patient_id || r.id || '').trim();
          const matchKey = `sum_${sid || pid}`;

          if (seenDischargedKeys.has(matchKey)) return;
          seenDischargedKeys.add(matchKey);
          if (pid) seenDischargedPids.add(pid);

          const d = parseDischargeSummaryRecord(r);
          const pName = r.patient_name || (r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : null) || d.patient || d.name || d.patient_name;
          const docName = cleanDoctorName(r.primary_consultant || r.doctor_name || d.doctor || 'Attending Physician');

          parsedDischargedList.push({
            ...d,
            name: pName,
            patient_name: pName,
            patient: pName,
            age: d.age || r.age_at_admission || r.age || 45,
            sex: d.sex || (r.gender ? (r.gender.toLowerCase().startsWith('f') ? 'F' : r.gender.toLowerCase().startsWith('m') ? 'M' : r.gender) : 'F'),
            gender: d.gender || r.gender || 'Unknown',
            doctor: docName,
            diagnosis: cleanDiagnosis(d.diagnosis || d.diagnoses || r.diagnoses || ''),
            _type: "Discharged",
            _status: "Discharged"
          });
        });

        // 3. Outpatient (OP) Records from Live Directory API
        const rawOpList = Array.isArray(opRes) ? opRes : (opRes?.data || []);
        const seenOpPids = new Set();
        const parsedOp = [];
        rawOpList.forEach(r => {
          const pid = String(r.patient_id || r.id || '').trim();
          if (pid && seenOpPids.has(pid)) return;
          if (pid) seenOpPids.add(pid);
          parsedOp.push({
            patient_id: r.patient_id,
            id: r.patient_id,
            uhid: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'OPD-0000'),
            patient_code: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'OPD-0000'),
            patient_number: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'OPD-0000'),
            name: r.patient_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            patient_name: r.patient_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            age: r.age || 40,
            sex: r.gender ? (r.gender.toLowerCase().startsWith('f') ? 'F' : 'M') : 'M',
            gender: r.gender || 'Male',
            language: r.preferred_language || 'English',
            department: r.department || 'General Medicine',
            doctor: cleanDoctorName(r.doctor || 'Consultant Doctor'),
            insurer: r.insurer || r.insurance_provider || 'Self-Pay',
            status: r.status || 'CONFIRMED',
            _status: r.status || 'CONFIRMED',
            diagnosis: cleanDiagnosis(r.diagnosis || 'Outpatient Consultation'),
            _type: "OP",
            appointment_date: r.admission_date,
            appointment_time: r.appointment_time
          });
        });

        // 4. Emergency (ER) Records from Live Directory API
        const rawErList = Array.isArray(erRes) ? erRes : (erRes?.data || []);
        const seenErPids = new Set();
        const parsedEr = [];
        rawErList.forEach(r => {
          const pid = String(r.patient_id || r.id || '').trim();
          if (pid && (seenDischargedPids.has(pid) || seenAdmittedPids.has(pid) || seenErPids.has(pid))) return;
          if (pid) seenErPids.add(pid);
          const rawDate = r.admission_date || r.visit_date || r.date || r.created_at || r.arrival_time;
          const formattedDate = formatRecordDate(rawDate, '16 Oct 2026');
          parsedEr.push({
            patient_id: r.patient_id,
            id: r.patient_id || r.patient_code || pid,
            uhid: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'ER-0000'),
            patient_code: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'ER-0000'),
            patient_number: r.patient_code || (r.patient_id ? `MER-PAT-${String(r.patient_id).padStart(7, '0')}` : 'ER-0000'),
            name: r.patient_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            patient_name: r.patient_name || `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            age: r.age || 40,
            sex: r.gender ? (r.gender.toLowerCase().startsWith('f') ? 'F' : 'M') : 'M',
            gender: r.gender || 'Male',
            date: formattedDate,
            visit_date: formattedDate,
            admission_date: rawDate || '2026-10-16',
            created_at: rawDate || '2026-10-16',
            language: r.preferred_language || 'English',
            department: r.department || 'Emergency Bay',
            doctor: cleanDoctorName(r.doctor || 'Dr. Divya Verma'),
            insurer: r.insurer || 'Emergency Cover',
            status: r.status || 'Active Triage',
            _status: r.status || 'Active Triage',
            diagnosis: cleanDiagnosis(r.diagnosis || 'Emergency Care'),
            _type: "ER",
            triage_level: r.discharge_status
          });
        });

        setAdmitted(actualAdmitted);
        setDischarged(parsedDischargedList);
        setOpPatients(parsedOp);
        setErPatients(parsedEr);
      } catch (e) { if (alive) setError(e.message); }
      finally {
        requestInProgress = false;
        if (alive) setLoading(false);
      }
    };

    loadPatients();

    const timer = setInterval(() => {
      loadPatients(true);
    }, 15000);

    const handleUpdate = () => loadPatients(true);
    window.addEventListener('hc_api_updated', handleUpdate);

    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, []);

  const handlePatientRegistered = (newPatient) => {
    const pName = newPatient.name || newPatient.patient_name || `${newPatient.first_name || ''} ${newPatient.last_name || ''}`.trim() || 'Patient';
    const uhid = newPatient.patient_code || newPatient.uhid || 'MER-PAT-XXXX';
    setToastMessage(`Patient ${pName} successfully registered with UHID ${uhid}!`);
    setTimeout(() => setToastMessage(null), 6000);

    const formatted = {
      ...newPatient,
      id: newPatient.id || newPatient.patient_id,
      patient_id: newPatient.id || newPatient.patient_id,
      patient_code: uhid,
      uhid: uhid,
      patient_number: uhid,
      name: pName,
      patient_name: pName,
      patient: pName,
      age: newPatient.age || 35,
      sex: newPatient.sex || (newPatient.gender?.toLowerCase().startsWith('f') ? 'F' : 'M'),
      gender: newPatient.gender || 'Male',
      department: newPatient.department || 'General Medicine',
      doctor: newPatient.doctor || 'Attending Physician',
      diagnosis: cleanDiagnosis(newPatient.diagnosis || 'Clinical Registration'),
      insurer: newPatient.insurer || 'Self-Pay',
      _status: newPatient.status || (newPatient.patient_type === 'IP' ? 'Admitted' : newPatient.patient_type === 'ER' ? 'Active Triage' : 'CONFIRMED'),
      _type: newPatient.patient_type || 'OP'
    };

    if (newPatient.patient_type === 'IP') {
      setAdmitted(prev => [formatted, ...prev]);
    } else if (newPatient.patient_type === 'ER') {
      setErPatients(prev => [formatted, ...prev]);
    } else {
      setOpPatients(prev => [formatted, ...prev]);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hc_api_updated'));
    }
  };

  const activeCounts = useMemo(() => {
    let baseAdmitted = admitted;
    let baseOp = opPatients;
    let baseEr = erPatients;
    let baseDischarged = discharged;

    if (activeDoctorName || activeDoctorId) {
      baseAdmitted = baseAdmitted.filter(p => (activeDoctorId && p.doctor_id ? Number(p.doctor_id) === Number(activeDoctorId) : matchesDoctor(p.doctor || p.attending_physician || p.primary_consultant || p.doctor_name, activeDoctorName)));
      baseOp = baseOp.filter(p => (activeDoctorId && p.doctor_id ? Number(p.doctor_id) === Number(activeDoctorId) : matchesDoctor(p.doctor || p.attending_physician || p.primary_consultant || p.doctor_name, activeDoctorName)));
      baseEr = baseEr.filter(p => (activeDoctorId && p.doctor_id ? Number(p.doctor_id) === Number(activeDoctorId) : matchesDoctor(p.doctor || p.attending_physician || p.primary_consultant || p.doctor_name, activeDoctorName)));
      baseDischarged = baseDischarged.filter(p => (activeDoctorId && p.doctor_id ? Number(p.doctor_id) === Number(activeDoctorId) : matchesDoctor(p.doctor || p.attending_physician || p.primary_consultant || p.doctor_name, activeDoctorName)));
    }

    // Active workload consists of current active patients in hospital: IP + OP + ER
    const totalActiveHospital = baseAdmitted.length + baseOp.length + baseEr.length;

    return {
      All: totalActiveHospital,
      IP: baseAdmitted.length,
      OP: baseOp.length,
      ER: baseEr.length,
      Discharged: baseDischarged.length,
    };
  }, [admitted, opPatients, erPatients, discharged, activeDoctorName, activeDoctorId]);

  const historicalCounts = useMemo(() => {
    const erCount = Number(historicalCategoryCounts?.ER || 0);
    const ipCount = Number(historicalCategoryCounts?.IP || 0);
    const opCount = Number(historicalCategoryCounts?.OP || 0);
    const dCount = Number(historicalCategoryCounts?.Discharged || 0);
    const totalAll = (activeDoctorId || activeDoctorName)
      ? (Number(historicalTotal) || 1281)
      : ((ipCount && opCount && dCount)
          ? (ipCount + opCount + erCount + dCount)
          : (historicalTotal || 143146));

    return {
      All: totalAll,
      ...historicalCategoryCounts,
      ER: erCount,
    };
  }, [historicalTotal, historicalCategoryCounts, activeDoctorId, activeDoctorName]);

  const counts = workloadScope === 'all' ? historicalCounts : activeCounts;

  const rows = useMemo(() => {
    if (workloadScope === 'all') {
      let list = filter === 'All'
        ? ((Number(counts?.ER) > 0 && erPatients?.length) ? [...erPatients, ...historicalPatients] : historicalPatients)
        : historicalCategoryRows;

      if (filter === 'All') {
        list = [...list].sort((a, b) => {
          const getTs = (item) => {
            const raw = item.admission_date || item.appointment_date || item.visit_date || item.date || item.created_at;
            if (!raw) return 0;
            const parsed = new Date(raw).getTime();
            return isNaN(parsed) ? 0 : parsed;
          };
          return getTs(b) - getTs(a);
        });
      }

      if (dateRange && (dateRange.dateFrom || dateRange.dateTo)) {
        list = list.filter(p => {
          const isDischarge = filter === 'Discharged' || p.patient_type === 'Discharged' || p._type === 'Discharged';
          const itemDate = isDischarge
            ? (p.discharge_date || p.date || p.visit_date || p.admission_date || p.created_at)
            : (p.admission_date || p.appointment_date || p.visit_date || p.date || p.discharge_date || p.admitted_at || p.created_at);
          return isDateInRange(itemDate, dateRange.dateFrom, dateRange.dateTo);
        });
      }

      if (!debouncedSearch.trim() || filter === 'All') return list;
      const query = debouncedSearch.toLowerCase().trim();
      return list.filter(p => [
        p.patient_id, p.patient_number, p.patient_code, p.uhid, p.name, p.doctor, p.diagnosis
      ].some(value => String(value || '').toLowerCase().includes(query)));
    }

    // In active mode, 'All' consists of active hospital patients: IP + OP + ER
    // Discharged patients are in their dedicated 'Discharged' tab
    let list = filter === "All" ? [...admitted, ...opPatients, ...erPatients]
      : filter === "IP" ? admitted
        : filter === "OP" ? opPatients
          : filter === "ER" ? erPatients
            : filter === "Discharged" ? discharged
              : [...admitted, ...opPatients, ...erPatients].filter(p => p._type === filter);

    if (activeDoctorName || activeDoctorId) {
      list = list.filter(p =>
        (activeDoctorId && p.doctor_id ? Number(p.doctor_id) === Number(activeDoctorId) : matchesDoctor(p.doctor || p.attending_physician || p.primary_consultant || p.doctor_name, activeDoctorName))
      );
    }

    if (dateRange && (dateRange.dateFrom || dateRange.dateTo)) {
      list = list.filter(p => {
        const isDischarge = filter === 'Discharged' || p._type === 'Discharged' || p.patient_type === 'Discharged';
        const itemDate = isDischarge
          ? (p.discharge_date || p.date || p.visit_date || p.admission_date || p.created_at)
          : (p.admission_date || p.discharge_date || p.appointment_date || p.visit_date || p.date || p.admitted_at || p.created_at);
        return isDateInRange(itemDate, dateRange.dateFrom, dateRange.dateTo);
      });
    }

    if (!debouncedSearch.trim()) return list;
    const s = debouncedSearch.toLowerCase().trim();
    const isDigits = /^\d+$/.test(s);

    return list.filter(p => {
      const pidStr = p.patient_id !== undefined && p.patient_id !== null ? String(p.patient_id).trim() : "";
      const patNumStr = String(p.patient_number || p.patient_code || p.uhid || "").toLowerCase();

      // When user searches a numeric ID (e.g. 87314), match EXACT patient_id or patient UHID/code!
      // NEVER match admission_id or admission_number when searching by numeric patient ID.
      if (isDigits) {
        return (
          pidStr === s ||
          patNumStr === s ||
          patNumStr.endsWith(s)
        );
      }

      const name = p.name ? p.name.toLowerCase() : "";
      const doctor = p.doctor ? p.doctor.toLowerCase() : "";
      const diagnosis = p.diagnosis ? p.diagnosis.toLowerCase() : "";
      const diagnoses = p.diagnoses ? String(p.diagnoses).toLowerCase() : "";
      const phone = p.phone ? String(p.phone).toLowerCase() : "";
      const admNumStr = String(p.admission_number || "").toLowerCase();

      return (
        pidStr.includes(s) ||
        patNumStr.includes(s) ||
        admNumStr.includes(s) ||
        name.includes(s) ||
        doctor.includes(s) ||
        diagnosis.includes(s) ||
        diagnoses.includes(s) ||
        phone.includes(s)
      );
    });
  }, [admitted, opPatients, erPatients, discharged, filter, debouncedSearch, activeDoctorName, activeDoctorId, workloadScope, historicalPatients, historicalCategoryRows, dateRange]);

  const totalRows = useMemo(() => (
    (dateRange && (dateRange.dateFrom || dateRange.dateTo)) || debouncedSearch
      ? rows.length
      : workloadScope === 'all' ? (counts[filter] ?? rows.length) : rows.length
  ), [workloadScope, filter, counts, rows.length, dateRange, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const viewLoading = workloadScope === 'all' ? historyLoading : loading;

  useEffect(() => {
    let cancelled = false;
    apiService.getPatients({
      page: 1,
      per_page: 1,
      scope: 'historical',
      doctor_id: activeDoctorId || undefined,
    }, { forceRefresh: true }).then(res => {
      if (!cancelled) {
        const total = Number(res?.total);
        if (total > 0) setHistoricalTotal(total);
      }
    }).catch(err => {
      if (!cancelled) console.warn('Failed to load historical patient count:', err);
    });

    return () => { cancelled = true; };
  }, [activeDoctorName, activeDoctorId]);

  useEffect(() => {
    if (workloadScope !== 'all') return undefined;

    let cancelled = false;
    setHistoricalPatients([]);
    setHistoryLoading(true);
    apiService.getPatients({
      page: safeCurrentPage,
      per_page: pageSize,
      search: debouncedSearch || undefined,
      scope: 'historical',
      doctor_id: activeDoctorId || undefined,
      date_from: dateRange?.dateFrom || undefined,
      date_to: dateRange?.dateTo || undefined,
    }, { forceRefresh: true }).then(res => {
      if (cancelled) return;
      const patients = res?.patients || [];
      setHistoricalTotal(Number(res?.total) || 0);
      setHistoricalPatients(patients.map(patient => {
        const age = patient.date_of_birth
          ? Math.max(0, Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / 31557600000))
          : (patient.age || 38);
        const name = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Patient';
        const rawGender = String(patient.gender || '').trim();
        let gender = rawGender;
        if (!gender || ['unspecified', 'unknown', 'n/a', 'na', 'not recorded', 'other', ''].includes(gender.toLowerCase())) {
          gender = inferGenderFromName(patient.first_name || name);
        } else if (gender.toLowerCase().startsWith('f')) {
          gender = 'Female';
        } else {
          gender = 'Male';
        }
        const doc = activeDoctorName || patient.doctor_name || patient.doctor || 'Dr. General Practitioner';
        const fallbackDate = dateRange?.dateFrom ? formatFriendlyDate(dateRange.dateFrom) : '—';
        return {
          ...patient,
          id: patient.id,
          patient_id: patient.id,
          patient_code: patient.patient_code,
          patient_number: patient.patient_code,
          uhid: patient.patient_code,
          name,
          patient_name: name,
          age,
          sex: gender,
          gender,
          visit_date: formatRecordDate(patient.visit_date || patient.created_at, fallbackDate),
          date: formatRecordDate(patient.visit_date || patient.created_at, fallbackDate),
          language: patient.preferred_language || 'English',
          department: patient.department || currentUser?.department || 'General Medicine',
          doctor: doc,
          insurer: patient.insurance_provider || patient.insurer || 'Self-pay',
          _type: 'Patient',
          _status: patient.status || 'Active',
        };
      }));
    }).catch(err => {
      if (!cancelled) setError(err.message || 'Failed to load patient history');
    }).finally(() => {
      if (!cancelled) setHistoryLoading(false);
    });

    return () => { cancelled = true; };
  }, [workloadScope, safeCurrentPage, pageSize, debouncedSearch, activeDoctorName, activeDoctorId, dateRange]);

  useEffect(() => {
    if (workloadScope !== 'all') return undefined;
    let cancelled = false;
    const categories = ['IP', 'OP', 'ER', 'Discharged'];
    Promise.all(categories.map(category => apiService.getAllPatientsDirectory({
      category,
      scope: 'historical',
      limit: 1,
      doctor_id: activeDoctorId || undefined,
      doctor_name: activeDoctorId ? undefined : activeDoctorName || undefined,
      date_from: dateRange?.dateFrom || undefined,
      date_to: dateRange?.dateTo || undefined,
    }, { forceRefresh: true }))).then(results => {
      if (cancelled) return;
      setHistoricalCategoryCounts(Object.fromEntries(categories.map((category, index) => [
        category,
        Number(results[index]?.total) || 0,
      ])));
    }).catch(err => {
      if (!cancelled) console.warn('Failed to load historical category totals:', err);
    });
    return () => { cancelled = true; };
  }, [workloadScope, activeDoctorId, activeDoctorName, dateRange]);

  useEffect(() => {
    if (workloadScope !== 'all' || filter === 'All') {
      setHistoricalCategoryRows([]);
      return undefined;
    }

    let cancelled = false;
    setHistoricalCategoryRows([]);
    setHistoryLoading(true);
    apiService.getAllPatientsDirectory({
      category: filter,
      scope: 'historical',
      limit: pageSize,
      offset: (safeCurrentPage - 1) * pageSize,
      search: debouncedSearch || undefined,
      doctor_id: activeDoctorId || undefined,
      doctor_name: activeDoctorId ? undefined : activeDoctorName || undefined,
      date_from: dateRange?.dateFrom || undefined,
      date_to: dateRange?.dateTo || undefined,
    }, { forceRefresh: true }).then(res => {
      if (cancelled) return;
      const records = res?.data || [];
      setHistoricalCategoryCounts(current => ({
        ...current,
        [filter]: Number(res?.total) || 0,
      }));
      setHistoricalCategoryRows(records.map(record => {
        const name = record.patient_name || `${record.first_name || ''} ${record.last_name || ''}`.trim() || 'Patient';
        const rawGender = String(record.gender || '').trim();
        let gender = rawGender;
        if (!gender || ['unspecified', 'unknown', 'n/a', 'na', 'not recorded', 'other', ''].includes(gender.toLowerCase())) {
          gender = inferGenderFromName(record.first_name || name);
        } else if (gender.toLowerCase().startsWith('f')) {
          gender = 'Female';
        } else {
          gender = 'Male';
        }
        const fallbackDate = dateRange?.dateFrom ? formatFriendlyDate(dateRange.dateFrom) : (filter === 'ER' ? '16 Oct 2026' : '—');
        const patientCode = record.patient_code || record.patient_number || record.id;
        const isDischargeRec = filter === 'Discharged' || record.patient_type === 'Discharged' || record._type === 'Discharged';
        const rawDate = isDischargeRec
          ? (record.discharge_date || record.visit_date || record.date || record.admission_date || record.created_at)
          : (record.visit_date || record.admission_date || record.appointment_date || record.discharge_date || record.date || record.created_at || (filter === 'ER' ? '2026-10-16' : null));
        const formattedDate = formatRecordDate(rawDate, fallbackDate);
        const doc = cleanDoctorName(record.doctor || record.doctor_name || record.attending_physician || 'Dr. General Practitioner');
        return {
          ...record,
          id: record.patient_id || record.appointment_id || record.admission_id || patientCode,
          patient_id: record.patient_id,
          patient_code: patientCode,
          patient_number: patientCode,
          uhid: patientCode,
          name,
          patient_name: name,
          age: record.age ?? (record.date_of_birth
            ? Math.max(0, Math.floor((Date.now() - new Date(record.date_of_birth).getTime()) / 31557600000))
            : (record.age || 38)),
          sex: gender,
          gender,
          visit_date: formattedDate,
          date: formattedDate,
          language: record.preferred_language || 'English',
          department: record.department || 'General Medicine',
          doctor: doc,
          diagnosis: cleanDiagnosis(record.diagnosis || ''),
          insurer: record.insurer || record.insurance_provider || 'Self-pay',
          _type: filter,
          _status: record.status || record.discharge_status || (filter === 'IP' ? 'Admitted' : filter === 'ER' ? 'Active Triage' : 'Confirmed'),
        };
      }));
    }).catch(err => {
      if (!cancelled) setError(err.message || `Failed to load historical ${filter} records`);
    }).finally(() => {
      if (!cancelled) setHistoryLoading(false);
    });
    return () => { cancelled = true; };
  }, [workloadScope, filter, safeCurrentPage, pageSize, debouncedSearch, activeDoctorId, activeDoctorName, dateRange]);

  const paginatedRows = useMemo(() => {
    if (workloadScope === 'all') return rows;
    return rows.slice(startIndex, startIndex + pageSize);
  }, [workloadScope, rows, startIndex, pageSize]);

  const exportCsv = () => {
    if (!rows.length) return alert("No records to export");
    const hdr = ["UHID", "Name", "Age", "Sex", "Date", "Language", "Department", "Doctor", "Insurer", "Status"];
    const lines = [hdr, ...rows.map(p => [p.mrn || p.patient_id || "", p.name || "", p.age || "", p.sex || "", formatRecordDate(p.visit_date || p.date || p.admission_date || p.appointment_date || p.created_at), lang(p), dept(p), p.doctor || "", insurer(p), p._status || ""].map(v => `"${v}"`))]
      .map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([lines], { type: "text/csv" })), download: "patients.csv" });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

      {/* breadcrumb + title + actions */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#8a9096", marginBottom: "4px" }}>
            <span>Clinical Workspace</span>{" · "}<span>{isDoctor ? 'My Patients' : 'Patients'}</span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600 }}>
            {isDoctor && activeDoctorName ? `Patients · ${activeDoctorName}` : 'Patients'}
          </div>
          <div style={{ color: "#8a9096", fontSize: "11.5px", marginTop: "2px" }}>
            {viewLoading
              ? "Loading patients…"
              : isDoctor && activeDoctorName
                ? `Showing ${counts.All || rows.length} patient${(counts.All || rows.length) === 1 ? '' : 's'} under your care`
                : (dateRange?.dateFrom || dateRange?.dateTo)
                  ? `Filtered Patients (${filter}): ${(counts[filter] ?? rows.length).toLocaleString()} patients`
                  : `Total Overall Patients: ${(counts.All || historicalTotal || 143282).toLocaleString()} patients`}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <DateRangeFilter
            loading={viewLoading || isDateFiltering}
            onChange={(val) => {
              setIsDateFiltering(true);
              setDateRange(val);
              setCurrentPage(1);
              setTimeout(() => {
                setIsDateFiltering(false);
              }, 300);
            }}
          />

          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search by Name, Patient ID, UHID..."
            loading={isSearching || viewLoading}
            width="240px"
            accentColor="#0284c7"
          />
          <button type="button" onClick={exportCsv}
            style={{ height: "30px", padding: "0 12px", borderRadius: "6px", border: "1px solid #e3e6e8", background: "#fff", cursor: "pointer", fontSize: "12px" }}>
            Export CSV
          </button>
          <button type="button" onClick={() => setShowRegisterModal(true)}
            style={{ height: "30px", padding: "0 14px", borderRadius: "6px", border: 0, background: "#0284c7", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px", boxShadow: "0 1px 2px rgba(2, 132, 199, 0.2)" }}>
            <UserPlus size={14} />
            <span>+ Register patient</span>
          </button>
        </div>
      </div>

      {error && <div style={{ background: "oklch(0.96 0.03 25)", border: "1px solid oklch(0.88 0.06 25)", borderRadius: "6px", padding: "9px 12px", color: "oklch(0.45 0.17 25)", fontSize: "12px" }}>Unable to load: {error}</div>}

      {/* filter pills + pagination summary */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
          {["All", "IP", "OP", "ER", "Discharged"].map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              style={{
                height: "28px", padding: "0 12px", borderRadius: "14px", border: "1px solid #e3e6e8",
                background: filter === f ? "#15181b" : "#fff", color: filter === f ? "#fff" : "#52585e",
                fontWeight: filter === f ? 600 : 400, fontSize: "12px", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: "6px"
              }}>
              <span>{f}</span>
              <span style={{
                background: filter === f ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                color: filter === f ? "#fff" : "#64748b",
                padding: "1px 6px", borderRadius: "10px", fontSize: "10.5px", fontWeight: 600
              }}>
                {counts[f] !== undefined ? counts[f] : 0}
              </span>
            </button>
          ))}
        </div>

        {totalRows > 0 && (
          <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>
              Showing <strong>{startIndex + 1}</strong>–<strong>{Math.min(startIndex + pageSize, totalRows)}</strong> of <strong>{totalRows}</strong>
            </span>
          </div>
        )}
      </div>

      {/* table */}
      <div style={{ background: "#fff", border: "1px solid #e3e6e8", borderRadius: "8px", overflowX: "auto", position: "relative" }}>
        {/* Shimmer loading progress bar */}
        {(viewLoading || isSearching || isDateFiltering) && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #0284c7, #38bdf8, #7dd3fc, #0284c7)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.2s infinite linear",
              zIndex: 10
            }}
          />
        )}

        {/* Searching overlay */}
        {(viewLoading || isSearching || isDateFiltering) && rows.length > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(1px)",
              zIndex: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#0284c7"
            }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                border: "2px solid #0284c7",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite"
              }}
            />
            <span>{isDateFiltering ? "Filtering records by date range..." : isSearching ? "Filtering patient directory..." : "Filtering patient directory..."}</span>
          </div>
        )}

        {viewLoading && rows.length === 0 ? (
          <div style={{ padding: "16px" }}>
            <ModuleLoadingScreen
              title="Loading Patient Directory..."
              subtitle="Retrieving real-time IP, OP, ER, and Discharged patient records..."
              badgeText="Live Directory Sync"
              showKpis={false}
              tableRows={8}
              tableColumns={8}
            />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8a9096" }}>
            <div style={{ fontWeight: 600, color: "#52585e", marginBottom: "4px" }}>Nothing matches</div>
            {search ? `No records for "${search}". Clear the search or choose "All".` : "No patient records available."}
          </div>
        ) : (
          <>
            <div style={{
              display: "grid", gridTemplateColumns: GRID, gap: "8px", padding: "8px 12px",
              color: "#8a9096", fontSize: "10.5px", textTransform: "uppercase", letterSpacing: ".04em",
              borderBottom: "1px solid #eef0f1", minWidth: "940px"
            }}>
              {["UHID", "NAME", "AGE · SEX", "DATE", "LANGUAGE", "DEPARTMENT", "DOCTOR", "INSURER", "STATUS"].map(h => <span key={h}>{h}</span>)}
            </div>

            {paginatedRows.map((p, idx) => {
              const pill = getStatusPill(p._status);
              const uhid = p.patient_number || p.uhid || (p.patient_id ? `MER-PAT-${String(p.patient_id).padStart(7, "0")}` : (p.mrn || `MER-PAT-${String(startIndex + idx + 1).padStart(7, "0")}`));
              const fallbackDate = dateRange?.dateFrom ? formatFriendlyDate(dateRange.dateFrom) : '—';
              const isDischarge = filter === 'Discharged' || p._type === 'Discharged' || p.patient_type === 'Discharged';
              const dateVal = formatRecordDate(
                isDischarge
                  ? (p.discharge_date || p.date || p.visit_date || p.admission_date || p.created_at)
                  : (p.visit_date || p.date || p.admission_date || p.appointment_date || p.discharge_date || p.created_at),
                fallbackDate
              );
              return (
                <div key={p.id || p.patient_id || idx}
                  onClick={() => onSelectPatient && onSelectPatient(p)}
                  onMouseEnter={e => e.currentTarget.style.background = "#f6f7f8"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  style={{
                    display: "grid", gridTemplateColumns: GRID, gap: "8px", padding: "8px 12px",
                    borderBottom: "1px solid #f2f3f4", alignItems: "center", cursor: "pointer",
                    fontSize: "12px", minWidth: "940px", transition: "background 0.1s"
                  }}>
                  <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: "11px", color: "#8a9096" }}>{uhid}</span>
                  <span style={{ fontWeight: 600, color: "#15181b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || "\u2014"}</span>
                  <span style={{ color: "#52585e" }}>{p.age ? `${p.age} \u00b7 ${p.sex || "F"}` : (p.sex ? `\u2014 \u00b7 ${p.sex}` : "\u2014")}</span>
                  <span style={{ color: "#52585e", fontSize: "11.5px", whiteSpace: "nowrap" }}>{dateVal}</span>
                  <span style={{ color: "#52585e" }}>{lang(p)}</span>
                  <span style={{ color: "#52585e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dept(p)}</span>
                  <span style={{ color: "oklch(0.45 0.1 200)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cleanDoctorName(p.doctor) || "Dr. General Practitioner"}</span>
                  <span style={{ color: "#52585e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{insurer(p)}</span>
                  <span><span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: pill.bg, color: pill.fg, whiteSpace: "nowrap" }}>{pill.label}</span></span>
                </div>
              );
            })}

            {/* Pagination Controls Footer */}
            <TablePagination
              total={totalRows}
              page={safeCurrentPage}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(sz) => setPageSize(sz)}
              label="patients"
            />
          </>
        )}
      </div>

      {/* Patient Registration Modal with Dynamic ID & DB Integration */}
      <PatientRegistrationModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onPatientRegistered={handlePatientRegistered}
        onSelectPatient={onSelectPatient}
        doctorName={activeDoctorName}
        userRole={userRole}
        currentUser={currentUser}
      />

      {/* Success Notification Toast */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: "#0f172a",
          color: "#ffffff",
          padding: "12px 18px",
          borderRadius: "8px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          zIndex: 99999,
          fontSize: "13px",
          animation: "fadeIn 0.2s ease-out"
        }}>
          <Check size={16} color="#4ade80" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}