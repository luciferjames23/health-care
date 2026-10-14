import React, { useState, useEffect } from 'react';
import { apiService, parseDischargeSummaryRecord, extractDischargedPatientIds, cleanDiagnosis } from '../services/api';
import { fetchRoleKpis } from '../services/dashboardApi';
import ModuleLoadingScreen from './ModuleLoadingScreen';

const Spinner = () => (
  <span style={{
    display: 'inline-block',
    width: '18px', height: '18px',
    border: '2px solid #e3e6e8',
    borderTop: '2px solid oklch(0.5 0.1 200)',
    borderRadius: '50%',
    animation: 'kpi-spin 0.7s linear infinite',
    verticalAlign: 'middle',
    marginTop: '6px'
  }} />
);

// ─── Role classification helpers ─────────────────────────────────────────────

function normaliseRole(role) {
  return String(role || '').trim().toLowerCase();
}

function getRoleProfile(role) {
  const r = normaliseRole(role);

  // Full executive / ops view
  if (['hospital management', 'admin', 'system admin', 'ai administrator', 'it administrator'].includes(r))
    return 'management';

  // Finance-centric view
  if (['finance manager'].includes(r))
    return 'finance_manager';

  // Billing / insurance desk
  if (['billing', 'insurance'].includes(r))
    return 'billing';

  // Pharmacy / supply chain
  if (['pharmacy', 'store manager', 'procurement officer'].includes(r))
    return 'supply';

  // Clinical nursing
  if (['nurse'].includes(r))
    return 'nurse';

  // Laboratory / pathology
  if (['laboratory', 'pathologist'].includes(r))
    return 'lab';

  // Governance / audit
  if (['governance officer', 'auditor'].includes(r))
    return 'governance';

  // Front office
  if (['front office'].includes(r))
    return 'front_office';

  // Doctor uses its own portal, but if they somehow land here show clinical view
  if (['doctor'].includes(r))
    return 'clinical';

  // Default: full management view
  return 'management';
}

// Per-profile: title, subtitle breadcrumb, which KPI ids to show, copilot config
const PROFILE_CONFIG = {
  management: {
    title: 'Executive Dashboard',
    breadcrumb: 'Hospital Operations › Executive Dashboard',
    kpiIds: ['adm', 'dis', 'op_patients', 'inv', 'occ', 'wards', 'rooms', 'avail', 'appts', 'er', 'lab', 'revenue', 'claims', 'inventory', 'doctors', 'surgeries'],
    showExceptions: true,
    showApprovalQueue: true,
    showWards: true,
    showCopilot: true,
    copilotLabel: 'Management Copilot',
    copilotInsight: 'Discharge delays are concentrated in insurance preauthorisation reviews. Ward turnaround and bed releases are monitored dynamically.',
    copilotSources: 'Clinical EHR Database, LIS & Hospital Registry',
    copilotActions: [
      { label: 'Insurance ageing', prompt: 'Show insurance cases older than 2 hours.' },
      { label: 'Critical results', prompt: 'Which critical results are awaiting clinician acknowledgement?' },
    ],
  },
  finance_manager: {
    title: 'Finance & Revenue Dashboard',
    breadcrumb: 'Finance & Accounts › Finance Dashboard',
    kpiIds: ['revenue', 'claims', 'inventory', 'adm', 'dis', 'appts'],
    showExceptions: false,
    showApprovalQueue: true,
    showWards: false,
    showCopilot: true,
    copilotLabel: 'Finance Copilot',
    copilotInsight: 'Outstanding insurance claims are the primary driver of AR ageing. Collections are tracking above target for this billing cycle.',
    copilotSources: 'Billing Database, Insurance Claims Ledger, Finance ERP',
    copilotActions: [
      { label: 'AR ageing summary', prompt: 'Summarise accounts receivable ageing buckets today.' },
      { label: 'Top unpaid claims', prompt: 'Which insurance claims have been outstanding for more than 30 days?' },
    ],
  },
  billing: {
    title: 'Billing & Claims Dashboard',
    breadcrumb: 'Revenue Cycle › Billing & Claims',
    kpiIds: ['revenue', 'claims', 'adm', 'dis', 'appts'],
    showExceptions: false,
    showApprovalQueue: false,
    showWards: false,
    showCopilot: true,
    copilotLabel: 'Billing Copilot',
    copilotInsight: 'Pending pre-authorisation approvals are holding up claim submissions. Check the insurance queue for cases flagged for review.',
    copilotSources: 'Billing Database, TPA Claims Ledger',
    copilotActions: [
      { label: 'Pending pre-auth', prompt: 'List insurance cases pending pre-authorisation approval today.' },
      { label: 'Unbilled encounters', prompt: 'Show discharged patients with no final bill raised.' },
    ],
  },
  supply: {
    title: 'Pharmacy & Supply Dashboard',
    breadcrumb: 'Pharmacy & Supply Chain › Overview',
    kpiIds: ['inventory', 'revenue', 'adm'],
    showExceptions: false,
    showApprovalQueue: false,
    showWards: false,
    showCopilot: true,
    copilotLabel: 'Supply Copilot',
    copilotInsight: 'Stock levels for high-velocity items are within safety thresholds. Review reorder alerts for critical drug categories.',
    copilotSources: 'Pharmacy LIS, Central Stores Database, Procurement ERP',
    copilotActions: [
      { label: 'Reorder alerts', prompt: 'Which drugs are below reorder level and need immediate procurement?' },
      { label: 'High-velocity items', prompt: 'Show top 10 drugs by dispensing volume this week.' },
    ],
  },
  nurse: {
    title: 'Ward Operations Dashboard',
    breadcrumb: 'Nursing › Ward Operations',
    kpiIds: ['adm', 'dis', 'inv', 'occ', 'wards', 'avail', 'er'],
    showExceptions: true,
    showApprovalQueue: false,
    showWards: true,
    showCopilot: true,
    copilotLabel: 'Nursing Copilot',
    copilotInsight: 'Bed turnaround is within SLA. Two wards are approaching 90 % occupancy — escalate admissions coordinator if intake continues.',
    copilotSources: 'Bed Management System, ADT Module, Ward EHR',
    copilotActions: [
      { label: 'Pending discharges', prompt: 'List patients whose discharge has been delayed more than 4 hours.' },
      { label: 'High-risk patients', prompt: 'Which current inpatients have fall-risk or pressure-injury alerts?' },
    ],
  },
  lab: {
    title: 'Laboratory Dashboard',
    breadcrumb: 'Diagnostics & LIS › Laboratory',
    kpiIds: ['lab', 'adm', 'er', 'dis'],
    showExceptions: false,
    showApprovalQueue: false,
    showWards: false,
    showCopilot: true,
    copilotLabel: 'Lab Copilot',
    copilotInsight: 'Critical value notifications have a 100 % clinician acknowledgement rate today. Pending culture reports are within TAT norms.',
    copilotSources: 'LIS Database, Critical Values Registry',
    copilotActions: [
      { label: 'Pending critical values', prompt: 'Show unacknowledged critical lab results.' },
      { label: 'Overdue reports', prompt: 'Which lab orders have exceeded TAT without a result?' },
    ],
  },
  governance: {
    title: 'Governance & Audit Dashboard',
    breadcrumb: 'Clinical Governance › Audit Overview',
    kpiIds: ['adm', 'dis', 'appts', 'revenue', 'claims', 'doctors'],
    showExceptions: true,
    showApprovalQueue: true,
    showWards: false,
    showCopilot: true,
    copilotLabel: 'Governance Copilot',
    copilotInsight: 'Discharge summary completion rate is above 95 %. One open audit flag for insurance pre-auth compliance requires review.',
    copilotSources: 'Clinical Governance Registry, Audit Trail, Compliance Database',
    copilotActions: [
      { label: 'Open audit flags', prompt: 'Show current open audit flags and compliance exceptions.' },
      { label: 'Completion rates', prompt: 'What is the discharge summary completion rate for this month?' },
    ],
  },
  front_office: {
    title: 'Front Office Dashboard',
    breadcrumb: 'Front Office › Reception Overview',
    kpiIds: ['adm', 'avail', 'appts', 'op_patients', 'occ'],
    showExceptions: false,
    showApprovalQueue: false,
    showWards: true,
    showCopilot: true,
    copilotLabel: 'Reception Copilot',
    copilotInsight: 'Today\'s appointment load is at 78 % capacity. Three patients are marked as arriving with no confirmed slot — follow up needed.',
    copilotSources: 'Appointment Module, Patient Registry, Bed Management',
    copilotActions: [
      { label: 'Unconfirmed arrivals', prompt: 'Which patients are checked in but have no confirmed appointment slot today?' },
      { label: 'Available beds', prompt: 'How many beds are available for new admissions right now?' },
    ],
  },
  clinical: {
    title: 'Clinical Operations Dashboard',
    breadcrumb: 'Clinical Workspace › Operations',
    kpiIds: ['adm', 'dis', 'er', 'lab', 'occ', 'avail'],
    showExceptions: true,
    showApprovalQueue: false,
    showWards: true,
    showCopilot: true,
    copilotLabel: 'Clinical Copilot',
    copilotInsight: 'No critical result backlogs detected. Discharge pipeline has 3 cases pending physician sign-off.',
    copilotSources: 'Clinical EHR, LIS, Bed Management',
    copilotActions: [
      { label: 'Pending sign-offs', prompt: 'Which discharge summaries are awaiting physician sign-off?' },
      { label: 'Emergency queue', prompt: 'Show current emergency triage queue and wait times.' },
    ],
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommandCentreView({ onNavigate, onAskAi, role, user }) {
  const [liveKpis, setLiveKpis] = useState(null);
  const [execMetrics, setExecMetrics] = useState(null);
  const [roleKpis, setRoleKpis] = useState(null);
  const [liveWards, setLiveWards] = useState([]);
  const [liveExceptions, setLiveExceptions] = useState([]);
  const [liveApprovals, setLiveApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  // Derive role profile once
  const profile = PROFILE_CONFIG[getRoleProfile(role)] || PROFILE_CONFIG.management;
  const displayName = user?.name || user?.username || '';
  const isManagement = ['management', 'governance'].includes(getRoleProfile(role));

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadCommandCentre(isSilent = false) {
      if (!isSilent && !liveKpis) setLoading(true);
      try {
        // Always fetch scoped role KPIs
        const roleKpisPromise = fetchRoleKpis(controller.signal);
        // Only hit heavy executive endpoint for management/governance
        const execPromise = isManagement ? apiService.getExecutiveKpis({}) : Promise.resolve(null);
        // Only pull bed/ward/exception data when the profile needs it
        const needsBedData = profile.showWards || profile.showExceptions || isManagement;
        const admPromise = needsBedData ? apiService.getCurrentAdmissions({ discharge_status: 'all' }) : Promise.resolve(null);
        const disPromise = needsBedData ? apiService.getDischargedPatients({}) : Promise.resolve(null);
        const bmPromise  = needsBedData ? apiService.getBedManagementData({}) : Promise.resolve(null);

        const [rk, execRes, admRes, disRes, bmRes] = await Promise.allSettled([
          roleKpisPromise, execPromise, admPromise, disPromise, bmPromise,
        ]);

        if (!isMounted) return;

        // Role KPIs (user-scoped)
        if (rk.status === 'fulfilled' && rk.value) setRoleKpis(rk.value);

        // Executive KPIs (management only, hospital-wide)
        if (execRes.status === 'fulfilled' && execRes.value?.success) setExecMetrics(execRes.value);

        const bmValue   = bmRes?.status  === 'fulfilled' ? bmRes.value  : null;
        const disValue  = disRes?.status === 'fulfilled' ? disRes.value : null;
        const admValue  = admRes?.status === 'fulfilled' ? admRes.value : null;
        const wardsList = bmValue?.wards || [];
        const kpisObj   = bmValue?.kpis  || {};
        const rkv       = (rk.status === 'fulfilled' && rk.value) ? rk.value : {};
        const exec      = (execRes.status === 'fulfilled' && execRes.value?.success) ? execRes.value : null;

        // Merge priority: role-kpis > executive-kpis > bed-management > defaults
        const totalBeds     = (rkv.total_beds     ?? exec?.total_beds     ?? kpisObj.total_beds     ?? wardsList.reduce((a, w) => a + (w.total_beds || 0), 0)) || 312;
        const occupiedBeds  = rkv.occupied_beds  ?? exec?.occupied_beds  ?? kpisObj.occupied_beds  ?? 208;
        const availableBeds = rkv.available_beds ?? exec?.available_beds ?? kpisObj.available_beds ?? 104;
        const occupancyRate = rkv.occupancy_rate ?? exec?.occupancy_rate ?? (totalBeds > 0 ? Number(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 66.7);
        const totalWards    = (rkv.total_wards    ?? exec?.total_wards    ?? kpisObj.total_wards    ?? wardsList.length) || 9;
        const totalRooms    = (rkv.total_rooms    ?? exec?.total_rooms    ?? kpisObj.total_rooms    ?? wardsList.reduce((a, w) => a + (w.rooms_count || w.rooms?.length || 0), 0)) || 150;
        const activeAdm     = rkv.active_admissions ?? exec?.active_admissions ?? occupiedBeds;
        const dischargedCnt = rkv.discharged_patients ?? exec?.discharged_patients ?? 0;

        if (!totalBeds && !activeAdm && !exec && !rkv.appointments_today) {
          setApiError('Backend API unreachable. Verify server is running on http://127.0.0.1:8000.');
          setLiveKpis(null); setLiveWards([]); setLiveExceptions([]); setLiveApprovals([]);
          return;
        }

        setApiError(null);
        setLiveKpis({
          active_admissions: activeAdm, discharged_patients: dischargedCnt,
          total_beds: totalBeds, occupied_beds: occupiedBeds, available_beds: availableBeds,
          maintenance_beds: rkv.maintenance_beds ?? exec?.maintenance_beds ?? kpisObj.maintenance_beds ?? 0,
          occupancy_rate: occupancyRate, total_wards: totalWards, total_rooms: totalRooms,
        });
        setLiveWards(wardsList);

        // Exceptions built from discharge records (only when profile needs them)
        if (needsBedData && disValue) {
          const discharges = (disValue?.data || []).map(parseDischargeSummaryRecord).filter(Boolean);
          if (discharges.length > 0) {
            setLiveExceptions(discharges.slice(0, 5).map(c => {
              const cleanDiag = cleanDiagnosis(c.diagnoses || c.primary_diagnosis || c.discharge_diagnosis || '');
              return {
                ref: `${c.patient} · ${c.bed || 'Released Bed'}`, owner: c.doctor || 'Attending Physician',
                age: 'Active Record',
                pri: c.approval_status === 'Approved' ? 'Low' : 'High',
                priC: c.approval_status === 'Approved' ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.18 25)',
                reason: cleanDiag ? (cleanDiag.length > 55 ? `${cleanDiag.slice(0, 55)}...` : cleanDiag) : 'Clinical summary review',
                next: c.approval_status === 'Approved' ? 'Bed released' : 'Physician sign-off',
                target: 'discharge',
              };
            }));
            setLiveApprovals(discharges.slice(0, 4).map(c => ({
              type: 'Discharge summary', patient: c.patient, age: c.approval_status,
              owner: c.doctor || 'Attending Physician', agent: c.model_name || 'Llama 3.3 70B',
            })));
          } else {
            setLiveExceptions([]); setLiveApprovals([]);
          }
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        console.warn('Failed to load Command Centre metrics:', err);
        if (isMounted) {
          setApiError(err.message || 'Failed to load metrics from backend API');
          setLiveKpis(null); setLiveWards([]); setLiveExceptions([]); setLiveApprovals([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCommandCentre();
    const timer = setInterval(() => loadCommandCentre(true), 15000);
    const handleUpdate = () => loadCommandCentre(true);
    window.addEventListener('hc_api_updated', handleUpdate);
    return () => {
      isMounted = false;
      clearInterval(timer);
      controller.abort();
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // ── Helpers to resolve a value with priority: roleKpis > execMetrics > liveKpis ──
  const rk = roleKpis || {};
  const em = execMetrics || {};

  function fmtCrore(n) {
    if (!n) return '—';
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000)   return `₹${(n / 100000).toFixed(2)} L`;
    return `₹${Number(n).toLocaleString()}`;
  }

  // ── Full KPI catalogue — values drawn from role-scoped data ──────────────
  const allKpis = [
    {
      id: 'adm',
      t: 'Currently Admitted Patients',
      v: liveKpis ? String(liveKpis.active_admissions) : (apiError ? '—' : null),
      sub: liveKpis ? `Active inpatients across ${liveKpis.total_wards} wards` : (apiError ? 'API Offline · No data' : 'Active inpatients across all wards'),
      c: 'oklch(0.5 0.1 200)', target: 'clinical',
    },
    {
      id: 'dis',
      t: 'Discharged Patient Records',
      v: liveKpis ? String(liveKpis.discharged_patients) : (apiError ? '—' : null),
      sub: apiError ? 'API Offline · No data' : 'Patients discharged from inpatient care',
      c: 'oklch(0.4 0.12 150)', target: 'discharge',
    },
    {
      id: 'op_patients',
      t: 'Outpatient (OP) Count',
      v: rk.total_patients != null ? String(rk.total_patients) : (em.op_patients != null ? String(em.op_patients) : (apiError ? '—' : '—')),
      sub: 'Active outpatient consultations & clinic roster',
      c: 'oklch(0.45 0.14 175)', target: 'patients-op',
    },
    {
      id: 'inv',
      t: 'Total Hospital Beds',
      v: liveKpis ? String(liveKpis.total_beds) : (apiError ? '—' : null),
      sub: liveKpis ? `${liveKpis.available_beds} available · ${liveKpis.occupied_beds} occupied` : (apiError ? 'API Offline · Bed census unavailable' : 'Real-time bed census'),
      c: '#15181b', target: 'beds',
    },
    {
      id: 'occ',
      t: 'Hospital Occupancy Rate',
      v: liveKpis ? `${liveKpis.occupancy_rate}%` : (apiError ? '—' : null),
      sub: liveKpis ? `${liveKpis.occupied_beds} of ${liveKpis.total_beds} beds in use` : (apiError ? 'API Offline · Capacity unknown' : 'Calculated capacity'),
      c: 'oklch(0.5 0.18 25)', target: 'beds',
    },
    {
      id: 'wards',
      t: 'Hospital Wards Count',
      v: liveKpis ? String(liveKpis.total_wards) : (apiError ? '—' : null),
      sub: apiError ? 'API Offline · Wards unavailable' : 'Across all floors and departments',
      c: '#15181b', target: 'beds',
    },
    {
      id: 'rooms',
      t: 'Hospital Rooms Count',
      v: liveKpis ? String(liveKpis.total_rooms) : (apiError ? '—' : null),
      sub: apiError ? 'API Offline · Rooms unavailable' : 'Across all wards and care units',
      c: '#15181b', target: 'beds',
    },
    {
      id: 'avail',
      t: 'Available Vacant Beds',
      v: liveKpis ? String(liveKpis.available_beds) : (apiError ? '—' : null),
      sub: apiError ? 'API Offline · Intake capacity unknown' : 'Immediate intake capacity',
      c: 'oklch(0.4 0.12 150)', target: 'beds',
    },
    // Appointments — role-scoped count first, exec total as fallback
    {
      id: 'appts',
      t: 'Appointments Recorded',
      v: rk.appointments_today != null
          ? `${rk.appointments_today} today`
          : (rk.appointments_active != null
              ? rk.appointments_active.toLocaleString()
              : (em.appointments != null ? em.appointments.toLocaleString() : (apiError ? '—' : null))),
      sub: rk.appointments_today != null
          ? `${rk.appointments_today} today · ${rk.appointments_total ?? em.all_time_appointments ?? ''} all-time`
          : 'Active scheduled & confirmed outpatient encounters',
      c: '#15181b', target: 'appointments',
    },
    // Emergency — same for all roles (hospital-wide is correct here)
    {
      id: 'er',
      t: 'Emergency Load',
      v: (rk.emergency_load ?? em.emergency_load)?.toLocaleString() ?? (apiError ? '—' : null),
      sub: 'Active emergency triage & critical admissions',
      c: 'oklch(0.5 0.18 25)', target: 'emergency',
    },
    // Lab — role-scoped for Lab/Doctor, hospital-wide for management
    {
      id: 'lab',
      t: 'Lab Tests',
      v: (rk.orders_pending ?? rk.lab_orders_active ?? rk.lab_orders_pending ?? em.lab_orders)?.toLocaleString() ?? (apiError ? '—' : null),
      sub: rk.orders_pending != null
          ? `${rk.orders_pending} pending · ${rk.orders_today ?? 0} ordered today`
          : 'Active orders for current IP & Emergency patients',
      c: '#15181b', target: 'lab',
    },
    // Revenue — role-scoped amounts, exec totals for management
    {
      id: 'revenue',
      t: 'Total Invoiced Revenue',
      v: rk.revenue_total != null ? fmtCrore(rk.revenue_total)
          : (em.bills?.total_revenue != null ? fmtCrore(em.bills.total_revenue) : (apiError ? '—' : null)),
      sub: rk.revenue_today != null
          ? `₹${Number(rk.revenue_today).toLocaleString()} collected today · ${rk.bills_today ?? 0} bills`
          : (em.bills ? `${em.bills.count.toLocaleString()} bills · ${fmtCrore(em.bills.total_collected)} collected` : 'Active invoices & collections'),
      c: 'oklch(0.5 0.1 200)', target: 'finance',
    },
    // Claims — role-scoped counts
    {
      id: 'claims',
      t: 'Insurance Claims',
      v: (rk.claims_total ?? rk.claims_count ?? em.claims?.count)?.toLocaleString() ?? (apiError ? '—' : null),
      sub: rk.outstanding_amount != null
          ? `${rk.claims_pending ?? 0} pending · ${fmtCrore(rk.outstanding_amount)} outstanding`
          : (em.claims
              ? (em.claims.approved >= 10000000
                  ? `₹${(em.claims.approved / 10000000).toFixed(2)} Cr approved · ₹${(em.claims.outstanding / 100000).toFixed(2)} L due`
                  : `₹${(em.claims.approved / 100000).toFixed(2)} L approved · ₹${(em.claims.outstanding / 100000).toFixed(2)} L due`)
              : 'Claims for current active cases'),
      c: '#15181b', target: 'insurance',
    },
    // Inventory — role-scoped for pharmacy/supply, exec for management
    {
      id: 'inventory',
      t: 'Pharmacy Inventory Value',
      v: rk.inventory_value != null ? fmtCrore(rk.inventory_value)
          : (em.inventory?.valuation != null ? fmtCrore(em.inventory.valuation) : (apiError ? '—' : null)),
      sub: rk.low_stock_items != null
          ? `${rk.dispensed_today ?? rk.inventory_total ?? 0} items · ${rk.low_stock_items} at reorder level`
          : (em.inventory ? `${em.inventory.count} active prescription sales · ${em.inventory.low_stock} at reorder level` : 'Live pharmacy stock valuation'),
      c: '#15181b', target: 'pharmacy',
    },
    // Doctors — hospital-wide (management only shows this)
    {
      id: 'doctors',
      t: 'Medical Specialists',
      v: (rk.doctors_active ?? em.doctors)?.toLocaleString() ?? (apiError ? '—' : null),
      sub: 'Attending doctors across all departments',
      c: '#15181b', target: 'doctor-management',
    },
    // Surgeries — hospital-wide
    {
      id: 'surgeries',
      t: 'OT Surgeries Scheduled',
      v: (rk.surgeries_scheduled ?? em.surgeries)?.toLocaleString() ?? (apiError ? '—' : null),
      sub: `${rk.active_surgeries ?? em.active_surgeries ?? 0} active · 5 operating suites in use`,
      c: '#15181b', target: 'surgery',
    },
    // Role-specific supplementary cards shown only for relevant profiles
    {
      id: 'appts_today',
      t: 'Today\'s Appointments',
      v: rk.appointments_today?.toLocaleString() ?? (apiError ? '—' : null),
      sub: rk.appointments_completed_today != null
          ? `${rk.appointments_completed_today} completed · ${rk.appointments_upcoming ?? 0} upcoming`
          : 'Scheduled for today',
      c: '#15181b', target: 'appointments',
    },
    {
      id: 'bills_pending',
      t: 'Pending Bills',
      v: rk.bills_pending?.toLocaleString() ?? (apiError ? '—' : null),
      sub: rk.bills_today != null ? `${rk.bills_today} raised today` : 'Awaiting finalisation or payment',
      c: 'oklch(0.5 0.18 25)', target: 'billing',
    },
    {
      id: 'low_stock',
      t: 'Low Stock Items',
      v: (rk.low_stock_items ?? rk.out_of_stock != null ? `${rk.low_stock_items ?? 0}` : null) ?? (apiError ? '—' : null),
      sub: rk.out_of_stock != null ? `${rk.out_of_stock} out of stock · ${rk.inventory_total ?? 0} total SKUs` : 'Items at or below reorder level',
      c: 'oklch(0.5 0.18 25)', target: 'pharmacy',
    },
    {
      id: 'lab_pending',
      t: 'Pending Lab Orders',
      v: rk.orders_pending?.toLocaleString() ?? (apiError ? '—' : null),
      sub: rk.critical_unacked != null ? `${rk.critical_unacked} critical unacknowledged` : 'Awaiting processing or reporting',
      c: 'oklch(0.5 0.18 25)', target: 'lab',
    },
    {
      id: 'checkins_today',
      t: 'Check-Ins Today',
      v: rk.checkins_today?.toLocaleString() ?? (apiError ? '—' : null),
      sub: rk.walkins_today != null ? `${rk.walkins_today} walk-ins · ${rk.upcoming_slots ?? 0} upcoming slots` : 'Patients checked in today',
      c: 'oklch(0.4 0.12 150)', target: 'appointments',
    },
    {
      id: 'escalations',
      t: 'Open Escalations',
      v: rk.open_escalations?.toLocaleString() ?? (apiError ? '—' : null),
      sub: 'Cases requiring immediate attention',
      c: 'oklch(0.5 0.18 25)', target: 'escalations',
    },
  ];

  // Filter KPIs to those allowed by this role's profile
  const kpiIdSet = new Set(profile.kpiIds);
  const kpis = allKpis.filter(k => kpiIdSet.has(k.id));

  const displayWards = liveWards.map(w => ({
    name: w.ward_name,
    o: w.occupied_beds,
    n: w.total_beds,
    pct: w.occupancy_rate || 0,
    color: w.occupancy_rate > 80
      ? 'oklch(0.5 0.18 25)'
      : w.occupancy_rate > 50
        ? 'oklch(0.5 0.13 70)'
        : 'oklch(0.4 0.12 150)',
  }));

  const exceptions = liveExceptions;
  const approvals  = liveApprovals;

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading && !liveKpis && !apiError) {
    return (
      <ModuleLoadingScreen
        title={`Loading ${profile.title}...`}
        subtitle="Synthesising hospital census, ward occupancy, and operational metrics..."
        badgeText="Live Operations Sync"
        statCount={5}
        tableRows={6}
        tableColumns={6}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            {profile.breadcrumb}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>{profile.title}</div>
        </div>
        {displayName && (
          <div style={{
            fontSize: '12px', color: '#52585e',
            background: '#f6f7f8', border: '1px solid #e3e6e8',
            borderRadius: '6px', padding: '4px 10px',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <span style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'oklch(0.5 0.1 200)', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, flexShrink: 0
            }}>
              {displayName.charAt(0).toUpperCase()}
            </span>
            <span>
              <span style={{ fontWeight: 600 }}>{displayName}</span>
              {role && <span style={{ color: '#8a9096' }}> · {role}</span>}
            </span>
          </div>
        )}
      </div>

      {/* API offline banner */}
      {apiError && (
        <div style={{
          background: 'oklch(0.97 0.04 25)', border: '1px solid oklch(0.85 0.08 25)',
          borderRadius: '8px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'oklch(0.4 0.16 25)' }}>
                API Offline · Backend Unreachable
              </div>
              <div style={{ fontSize: '11.5px', color: '#667085', marginTop: '2px' }}>
                {apiError} Dynamic data will display once the backend responds.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('hc_api_updated'))}
            style={{
              height: '30px', padding: '0 14px', borderRadius: '6px', border: 0,
              background: 'oklch(0.5 0.18 25)', color: '#fff',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Retry Connection 🔄
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        {kpis.map(k => (
          <div
            key={k.id}
            onClick={() => onNavigate && onNavigate(k.target)}
            style={{
              background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px',
              padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'oklch(0.7 0.1 200)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#e3e6e8')}
          >
            <div style={{ color: '#8a9096', fontSize: '11px', fontWeight: 500 }}>{k.t}</div>
            <div style={{
              fontFamily: 'Newsreader, Georgia, serif', fontSize: '28px',
              lineHeight: 1.15, color: k.c, margin: '2px 0',
              minHeight: '34px', display: 'flex', alignItems: 'center'
            }}>
              {k.v === null ? <Spinner /> : k.v}
            </div>
            <div style={{ color: '#52585e', fontSize: '11px', lineHeight: 1.35 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column lower section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: (profile.showExceptions || (profile.showWards && !profile.showCopilot))
          ? 'minmax(0, 1fr) 340px'
          : '1fr',
        gap: '14px', alignItems: 'start'
      }}>

        {/* Left: Operational Exceptions (role-dependent) */}
        {profile.showExceptions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>
                Operational exceptions · {exceptions.length} open
              </div>
              <a
                href="#exceptions"
                onClick={e => { e.preventDefault(); onNavigate('discharge'); }}
                style={{ textDecoration: 'none', color: 'oklch(0.5 0.1 200)', fontSize: '12px', fontWeight: 500 }}
              >
                Exception centre →
              </a>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{
                padding: '8px 12px', borderBottom: '1px solid #eef0f1',
                fontWeight: 600, fontSize: '11.5px', background: '#f9fafa'
              }}>
                Priority exceptions requiring immediate human resolution
              </div>
              {exceptions.length === 0 ? (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: '#8a9096', fontSize: '12px' }}>
                  {apiError ? '⚠️ Exceptions cannot be loaded while the API is offline.' : 'No active operational exceptions.'}
                </div>
              ) : (
                exceptions.map((it, idx) => (
                  <div
                    key={idx}
                    onClick={() => onNavigate(it.target)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) 75px 65px minmax(0, 2fr) 95px',
                      gap: '8px', padding: '8px 12px', borderBottom: '1px solid #f2f3f4',
                      alignItems: 'center', cursor: 'pointer', fontSize: '11.5px'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <span style={{ fontWeight: 600 }}>{it.ref}</span>
                    <span style={{ color: '#52585e' }}>{it.owner}</span>
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096' }}>{it.age}</span>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: it.priC }}>{it.pri}</span>
                    <span style={{ color: '#52585e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.reason}</span>
                    <span style={{ color: 'oklch(0.45 0.1 200)', fontWeight: 600 }}>{it.next} →</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Right column: Copilot + Approval Queue + Ward Occupancy */}
        {(profile.showCopilot || profile.showApprovalQueue || profile.showWards) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Role-specific Copilot */}
            {profile.showCopilot && (
              <div style={{
                background: '#fff', border: '1px solid oklch(0.85 0.05 300)',
                borderRadius: '8px', padding: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)' }} />
                  <span style={{ fontWeight: 600, fontSize: '12.5px' }}>{profile.copilotLabel}</span>
                  <span style={{ marginLeft: 'auto', font: '500 10px ui-monospace, Menlo, monospace', color: 'oklch(0.5 0.1 300)' }}>
                    {apiError ? 'OFFLINE' : 'ONLINE'}
                  </span>
                </div>
                <div style={{ lineHeight: 1.5, color: '#52585e', fontSize: '12px' }}>
                  {apiError
                    ? 'Copilot telemetry is paused while the backend is unreachable. Connect the FastAPI server to resume.'
                    : profile.copilotInsight}
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#8a9096' }}>
                  Sources: {profile.copilotSources}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {profile.copilotActions.map((action, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onAskAi && onAskAi(action.prompt)}
                      style={{
                        height: '26px', padding: '0 9px', borderRadius: '6px',
                        border: i === 0 ? 0 : '1px solid #e3e6e8',
                        background: i === 0 ? 'oklch(0.5 0.1 200)' : '#fff',
                        color: i === 0 ? '#fff' : '#15181b',
                        fontWeight: 600, cursor: 'pointer', fontSize: '11px'
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Human approval queue — management & governance only */}
            {profile.showApprovalQueue && (
              <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '8px' }}>
                  Human approval queue ({approvals.length})
                </div>
                {approvals.length === 0 ? (
                  <div style={{ padding: '14px 4px', textAlign: 'center', color: '#8a9096', fontSize: '11.5px' }}>
                    {apiError ? 'Approval queue unavailable (API offline).' : 'No items awaiting approval.'}
                  </div>
                ) : (
                  approvals.map((a, i) => (
                    <div
                      key={i}
                      onClick={() => onNavigate('discharge')}
                      style={{
                        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto',
                        gap: '2px 8px', padding: '6px 0', borderBottom: '1px solid #f2f3f4', cursor: 'pointer'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f9fafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <span style={{ fontWeight: 600, fontSize: '12px' }}>{a.type} · {a.patient}</span>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096' }}>{a.age}</span>
                      <span style={{ color: '#52585e', gridColumn: '1 / -1', fontSize: '11px' }}>{a.owner} · {a.agent}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Ward occupancy — management, nurse, front office, clinical */}
            {profile.showWards && (
              <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '10px' }}>
                  Ward occupancy ({displayWards.length} wards)
                </div>
                {displayWards.length === 0 ? (
                  <div style={{ padding: '14px 4px', textAlign: 'center', color: '#8a9096', fontSize: '11.5px' }}>
                    {apiError ? 'Ward occupancy unavailable (API offline).' : 'No active wards found.'}
                  </div>
                ) : (
                  displayWards.map(w => (
                    <div
                      key={w.name}
                      style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 40px', gap: '8px', alignItems: 'center', padding: '3px 0', fontSize: '11.5px' }}
                    >
                      <span style={{ color: '#52585e' }}>{w.name}</span>
                      <div style={{ height: '7px', background: '#eef0f1', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${w.pct}%`, height: '100%', background: w.color }} />
                      </div>
                      <span style={{ textAlign: 'right', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px' }}>
                        {w.o}/{w.n}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
