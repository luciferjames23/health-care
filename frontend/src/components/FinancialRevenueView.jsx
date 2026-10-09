import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { financialApi } from "../services/financialApi";
import ModuleLoadingScreen, { TableSkeleton } from "./ModuleLoadingScreen";
import SearchInput from "./SearchInput";
import TablePagination from "./TablePagination";
import BillingTransparencyDrawer from "./BillingTransparencyDrawer";
import ClaimExclusionModal from "./ClaimExclusionModal";
import ClaimAppealDrawer from "./ClaimAppealDrawer";

// ─────────────────────────────────────────────────────────────────────────────
// Design System Tokens & Color Palette (Pixel-Accurate to Prototype V2.1)
// ─────────────────────────────────────────────────────────────────────────────
const PALETTE = {
  primary: "oklch(0.5 0.1 200)",         // Brand teal / cyan accent
  primaryText: "oklch(0.4 0.1 200)",
  primaryTint: "oklch(0.95 0.03 200)",
  success: "oklch(0.4 0.12 150)",        // Success green
  successTint: "oklch(0.95 0.04 150)",
  warning: "oklch(0.5 0.13 70)",         // Warning amber
  warningTint: "oklch(0.96 0.05 80)",
  critical: "oklch(0.45 0.17 25)",       // Critical red / error
  criticalTint: "oklch(0.96 0.03 25)",
  ai: "oklch(0.5 0.1 300)",              // AI purple
  aiText: "oklch(0.45 0.1 300)",
  aiBorder: "oklch(0.85 0.05 300)",
  aiTint: "oklch(0.97 0.02 300)",
  text: "#15181b",
  text2: "#52585e",
  muted: "#8a9096",
  border: "#e3e6e8",
  borderLight: "#eef0f1",
  surface: "#ffffff",
  bg: "#fbfbfc",
  sidebar: "#15181b"
};

// ─────────────────────────────────────────────────────────────────────────────
// Formatters & Helper Utilities
// ─────────────────────────────────────────────────────────────────────────────
const inr = (n) => {
  const num = Math.round(Number(n) || 0);
  if (num >= 10000000) return "₹" + (num / 10000000).toFixed(2) + " Cr";
  if (num >= 100000) return "₹" + (num / 100000).toFixed(2) + " L";
  return "₹" + num.toLocaleString("en-IN");
};

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d).slice(0, 10);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d).slice(0, 10);
  }
};

const fmtTime = (d) => {
  if (!d) return "10:30";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "11:45";
    return dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "11:45 AM";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge Component (Exact Prototype Visuals)
// ─────────────────────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const s = String(status || "").trim();
  const lower = s.toLowerCase();

  let bg = "#eef0f1";
  let fg = "#52585e";

  if (/settled|approved|paid|released|active|cleared|success|pass/i.test(lower)) {
    bg = PALETTE.successTint;
    fg = PALETTE.success;
  } else if (/disputed|rejected|critical|failed|voided/i.test(lower)) {
    bg = PALETTE.criticalTint;
    fg = PALETTE.critical;
  } else if (/pending|awaiting|query|missing|provisional|part-paid|partially|under review|pending review/i.test(lower)) {
    bg = PALETTE.warningTint;
    fg = PALETTE.warning;
  } else if (/submitted|claim ready/i.test(lower)) {
    bg = PALETTE.primaryTint;
    fg = PALETTE.primaryText;
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        background: bg,
        color: fg,
        whiteSpace: "nowrap",
        letterSpacing: "0.02em"
      }}
    >
      {s || "—"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component: FinancialRevenueView
// ─────────────────────────────────────────────────────────────────────────────
export function FinancialRevenueView({ initialTab = "billing", onOpenDrawer, onOpenModal, onSelectPatient, userRole, currentUser }) {
  // Active view matches the selected Revenue cycle sub-module from sidebar
  const activeTab = initialTab || "billing";

  // Role Access Guard: Check if user is authorized for insurance/claims
  const isInsuranceRole = useMemo(() => {
    if (!userRole) return true;
    const allowed = ['Insurance', 'Billing', 'Finance Manager', 'Hospital Management', 'Admin', 'Auditor', 'AI Administrator', 'IT Administrator'];
    return allowed.includes(userRole);
  }, [userRole]);

  // Dedicated check: Preauth Underwriting actions (Submit, Sanction/Approve, Reject/Decline)
  // Strictly restricted to Insurance & TPA Desk users (R. Sundar / Insurance Desk), NOT Hospital Management or Admin.
  const isInsuranceDeskExecutive = useMemo(() => {
    if (!userRole) return false;
    const roleStr = String(userRole).trim().toLowerCase();
    if (
      roleStr.includes('admin') ||
      roleStr.includes('management') ||
      roleStr.includes('doctor') ||
      roleStr.includes('nurse') ||
      roleStr.includes('patient')
    ) {
      return false;
    }
    return (
      roleStr === 'insurance' ||
      roleStr.includes('insurance') ||
      roleStr.includes('tpa') ||
      roleStr.includes('coordinator')
    );
  }, [userRole]);

  // When logged in as Insurance user (e.g. R. Sundar), scope cases to the current user
  const loggedUserName = currentUser?.name || (userRole === 'Insurance' ? 'R. Sundar' : null);
  const isInsuranceUser = isInsuranceDeskExecutive && Boolean(loggedUserName);
  const [ownerFilter, setOwnerFilter] = useState(isInsuranceUser ? (loggedUserName || 'R. Sundar') : 'All');

  useEffect(() => {
    if (isInsuranceUser && loggedUserName) {
      setOwnerFilter(loggedUserName);
    }
  }, [isInsuranceUser, loggedUserName]);

  // Global search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Request sequencing refs to prevent out-of-order async search race conditions
  const billsReqIdRef = useRef(0);
  const preauthReqIdRef = useRef(0);
  const claimsReqIdRef = useRef(0);
  const dashboardReqIdRef = useRef(0);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when debounced search or filter changes
  useEffect(() => {
    setBillPage(1);
    setPreauthPage(1);
    setClaimPage(1);
    setPayPage(1);
  }, [debouncedSearch, activeFilter, ownerFilter]);

  // Reset filter and search when activeTab changes
  useEffect(() => {
    setActiveFilter("All");
    setSearchQuery("");
    setDebouncedSearch("");
  }, [activeTab]);

  // Live Data States
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Billing State
  const [bills, setBills] = useState([]);
  const [billTotal, setBillTotal] = useState(0);
  const [billPage, setBillPage] = useState(1);
  const [billPageSize, setBillPageSize] = useState(15);
  const [loadingBills, setLoadingBills] = useState(false);

  // Live Preauthorisations (Insurance) State
  const [preauths, setPreauths] = useState([]);
  const [preauthTotal, setPreauthTotal] = useState(0);
  const [preauthPage, setPreauthPage] = useState(1);
  const [preauthPageSize, setPreauthPageSize] = useState(25);
  const [preauthStats, setPreauthStats] = useState(null);
  const [loadingPreauth, setLoadingPreauth] = useState(false);

  // Insurance & Claims State
  const [claims, setClaims] = useState([]);
  const [claimTotal, setClaimTotal] = useState(0);
  const [claimPage, setClaimPage] = useState(1);
  const [claimPageSize, setClaimPageSize] = useState(25);
  const [claimStats, setClaimStats] = useState(null);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claimsAnalytics, setClaimsAnalytics] = useState(null);
  const [claimsViewMode, setClaimsViewMode] = useState("kanban"); // 'table' | 'kanban'
  const [claimsKanbanPages, setClaimsKanbanPages] = useState({});

  // Finance Dashboard State
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [payPage, setPayPage] = useState(1);
  const [payPageSize, setPayPageSize] = useState(15);

  // Tax Configuration State
  const [taxData, setTaxData] = useState(null);
  const [loadingTax, setLoadingTax] = useState(false);

  // Detail Drawer State (Right slide-out aside)
  const [drawerData, setDrawerData] = useState(null); // { type: 'bill' | 'preauth' | 'claim' | 'tax', data: ... }
  const [loadingDrawer, setLoadingDrawer] = useState(false);

  // Payment Recording Modal State
  const [paymentModal, setPaymentModal] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("UPI");
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Gate Pass Modal State
  const [gatePassModal, setGatePassModal] = useState(null);

  // AG-08 Billing Transparency Agent State
  const [ag08DrawerOpen, setAg08DrawerOpen] = useState(false);
  const [ag08PatientId, setAg08PatientId] = useState('87221');

  // TPA Claim Rejection / Exclusion Modal State
  const [rejectionModalData, setRejectionModalData] = useState(null);
  // AG-20 Reconsideration Appeal Dossier Drawer State
  const [appealDrawerCase, setAppealDrawerCase] = useState(null);

  // ───────────────────────────────────────────────────────────────────────────
  // Data Loaders from Live Backend APIs (Supports silent refresh to avoid UI flashing)
  // ───────────────────────────────────────────────────────────────────────────
  const loadOverview = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingOverview(true);
      const res = await financialApi.getOverview();
      if (res && res.success) setOverview(res);
    } catch (e) {
      console.error("Overview error:", e);
    } finally {
      if (!silent) setLoadingOverview(false);
    }
  }, []);

  const loadBills = useCallback(async (silent = false) => {
    const reqId = ++billsReqIdRef.current;
    try {
      if (!silent) setLoadingBills(true);
      const res = await financialApi.getBills({
        page: billPage,
        pageSize: billPageSize,
        status: activeFilter === "All" ? undefined : activeFilter,
        search: debouncedSearch || undefined
      });
      if (reqId === billsReqIdRef.current && res && res.success) {
        setBills(res.items || []);
        setBillTotal(res.total || 0);
      }
    } catch (e) {
      if (reqId === billsReqIdRef.current) {
        console.error("Bills error:", e);
      }
    } finally {
      if (reqId === billsReqIdRef.current && !silent) {
        setLoadingBills(false);
      }
    }
  }, [billPage, billPageSize, activeFilter, debouncedSearch]);

  const loadPreauths = useCallback(async (silent = false) => {
    const reqId = ++preauthReqIdRef.current;
    try {
      if (!silent) setLoadingPreauth(true);
      const effectiveOwner = (ownerFilter && ownerFilter !== "All") ? ownerFilter : (isInsuranceUser ? (loggedUserName || "R. Sundar") : undefined);
      const res = await financialApi.getPreauthorisations({
        page: preauthPage,
        pageSize: preauthPageSize,
        status: activeFilter === "All" ? undefined : activeFilter,
        search: debouncedSearch || undefined,
        owner: effectiveOwner
      });
      if (reqId === preauthReqIdRef.current && res && res.success) {
        setPreauths(res.items || []);
        setPreauthTotal(res.total || 0);
        if (res.stats) setPreauthStats(res.stats);
      }
    } catch (e) {
      if (reqId === preauthReqIdRef.current) {
        console.error("Preauth error:", e);
      }
    } finally {
      if (reqId === preauthReqIdRef.current && !silent) {
        setLoadingPreauth(false);
      }
    }
  }, [preauthPage, preauthPageSize, activeFilter, debouncedSearch, ownerFilter, isInsuranceUser, loggedUserName]);

  const loadClaims = useCallback(async (silent = false) => {
    const reqId = ++claimsReqIdRef.current;
    try {
      if (!silent) setLoadingClaims(true);
      const isKanban = claimsViewMode === "kanban";
      const actualSize = isKanban ? 150 : claimPageSize;
      const [cRes, aRes] = await Promise.all([
        financialApi.getInsuranceClaims({
          page: isKanban ? 1 : claimPage,
          pageSize: actualSize,
          status: activeFilter === "All" ? undefined : activeFilter,
          search: debouncedSearch || undefined
        }),
        financialApi.getClaimsAnalytics()
      ]);
      if (reqId === claimsReqIdRef.current) {
        if (cRes && cRes.success) {
          setClaims(cRes.items || []);
          setClaimTotal(cRes.total || 0);
          if (cRes.stats) setClaimStats(cRes.stats);
        }
        if (aRes && aRes.success) {
          setClaimsAnalytics(aRes);
        }
      }
    } catch (e) {
      if (reqId === claimsReqIdRef.current) {
        console.error("Claims error:", e);
      }
    } finally {
      if (reqId === claimsReqIdRef.current && !silent) {
        setLoadingClaims(false);
      }
    }
  }, [claimPage, claimPageSize, activeFilter, debouncedSearch, claimsViewMode]);

  const loadDashboard = useCallback(async (silent = false) => {
    const reqId = ++dashboardReqIdRef.current;
    try {
      if (!silent) setLoadingDashboard(true);
      const res = await financialApi.getFinanceDashboard({
        page: payPage,
        pageSize: payPageSize,
        status: activeFilter === "All" ? undefined : activeFilter,
        search: debouncedSearch || undefined
      });
      if (reqId === dashboardReqIdRef.current && res && res.success) {
        setDashboardData(res);
      }
    } catch (e) {
      if (reqId === dashboardReqIdRef.current) {
        console.error("Dashboard error:", e);
      }
    } finally {
      if (reqId === dashboardReqIdRef.current && !silent) {
        setLoadingDashboard(false);
      }
    }
  }, [activeFilter, payPage, payPageSize, debouncedSearch]);

  const loadTax = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingTax(true);
      const res = await financialApi.getTaxConfig();
      if (res && res.success) setTaxData(res);
    } catch (e) {
      console.error("Tax error:", e);
    } finally {
      if (!silent) setLoadingTax(false);
    }
  }, []);

  // Global live updates across modules
  useEffect(() => {
    loadOverview(true);
  }, [loadOverview]);

  useEffect(() => {
    // Initial fetch on tab change - display high-fidelity loading state
    if (activeTab === "billing") loadBills(false);
    else if (activeTab === "insurance") loadPreauths(false);
    else if (activeTab === "claims") loadClaims(false);
    else if (activeTab === "finance") loadDashboard(false);
    else if (activeTab === "tax") loadTax(false);

    const refreshSilently = () => {
      loadOverview(true);
      if (activeTab === "billing") loadBills(true);
      else if (activeTab === "insurance") loadPreauths(true);
      else if (activeTab === "claims") loadClaims(true);
      else if (activeTab === "finance") loadDashboard(true);
      else if (activeTab === "tax") loadTax(true);
    };

    // Listen for custom events without flickering UI
    window.addEventListener("hc_api_updated", refreshSilently);
    window.addEventListener("hc_bill_settled", refreshSilently);
    const interval = setInterval(refreshSilently, 20000);

    return () => {
      window.removeEventListener("hc_api_updated", refreshSilently);
      window.removeEventListener("hc_bill_settled", refreshSilently);
      clearInterval(interval);
    };
  }, [activeTab, loadOverview, loadBills, loadPreauths, loadClaims, loadDashboard, loadTax]);

  // ───────────────────────────────────────────────────────────────────────────
  // Detail Drawer Loaders & Actions
  // ───────────────────────────────────────────────────────────────────────────
  const openBillDrawer = async (billId) => {
    setLoadingDrawer(true);
    try {
      const res = await financialApi.getBillDetail(billId);
      if (res && res.success) {
        setDrawerData({ type: "bill", data: res.bill });
      }
    } catch (err) {
      alert("Error loading bill details: " + err.message);
    } finally {
      setLoadingDrawer(false);
    }
  };

  const openPreauthDrawer = (claimItem) => {
    setDrawerData({ type: "preauth", data: claimItem });
  };

  const openClaimDrawer = (claimItem) => {
    setDrawerData({ type: "claim", data: claimItem });
  };

  const openTaxDrawer = (taxItem) => {
    setDrawerData({ type: "tax", data: taxItem });
  };

  const handleIssueGatePass = async (billId) => {
    try {
      const res = await financialApi.issueGatePass(billId);
      if (res && res.success) {
        setGatePassModal(res);
        loadOverview();
        loadBills();
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        if (drawerData?.data?.bill_id === billId) {
          openBillDrawer(billId);
        }
      }
    } catch (e) {
      alert("Failed to issue clearance gate pass: " + e.message);
    }
  };

  const handleClearBillDirect = async (billId, amt) => {
    try {
      const res = await financialApi.clearBillById(billId, "UPI", amt);
      if (res && res.success) {
        alert("Bill balance settled successfully!");
        loadOverview();
        loadBills();
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        window.dispatchEvent(new CustomEvent("hc_bill_settled", { detail: { billId, amount: amt } }));
        if (drawerData?.data?.bill_id === billId) {
          openBillDrawer(billId);
        }
      }
    } catch (e) {
      alert("Error clearing bill: " + e.message);
    }
  };

  const handleResolveBillAdjustment = async (billId, amt) => {
    try {
      const res = await financialApi.resolveBillAdjustment(billId, { adjustment_amount: amt || 0 });
      if (res && res.success) {
        alert(res.message);
        loadBills(true);
        loadOverview(true);
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        if (drawerData?.data?.bill_id === billId) {
          openBillDrawer(billId);
        }
      }
    } catch (e) {
      alert("Error resolving bill: " + e.message);
    }
  };

  const handlePreauthSubmit = async (claimId) => {
    if (!isInsuranceDeskExecutive) {
      alert("Permission Denied: Preauthorisation submission is restricted strictly to the Insurance Desk.");
      return;
    }
    try {
      const res = await financialApi.submitPreauth(claimId);
      if (res && res.success) {
        alert(res.message);
        loadPreauths(true);
        loadClaims(true);
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        if (drawerData?.data?.claim_id === claimId) {
          setDrawerData(prev => ({
            ...prev,
            data: { ...prev.data, status: "Submitted · awaiting insurer" }
          }));
        }
      }
    } catch (e) {
      alert("Error submitting preauth: " + e.message);
    }
  };

  const handlePreauthStatusChange = async (claimId, newStatus) => {
    if (!isInsuranceDeskExecutive) {
      alert("Permission Denied: Preauthorisation status modification is restricted strictly to the Insurance Desk.");
      return;
    }
    try {
      const res = await financialApi.updatePreauthStatus(claimId, { status: newStatus });
      if (res && res.success) {
        alert(res.message);
        loadPreauths(true);
        loadClaims(true);
        loadOverview(true);
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        if (drawerData?.data?.claim_id === claimId) {
          setDrawerData(prev => ({
            ...prev,
            data: { ...prev.data, status: newStatus }
          }));
        }
      }
    } catch (e) {
      alert("Error updating preauth status: " + e.message);
    }
  };

  const handlePreauthApprove = async (claimId, amt) => {
    if (!isInsuranceDeskExecutive) {
      alert("Permission Denied: Preauthorisation sanction and approval is restricted strictly to the Insurance Desk.");
      return;
    }
    try {
      const res = await financialApi.approvePreauth(claimId, { amount: amt });
      if (res && res.success) {
        alert(res.message);
        loadPreauths(true);
        loadClaims(true);
        loadOverview(true);
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        if (drawerData?.data?.claim_id === claimId) {
          setDrawerData(prev => ({
            ...prev,
            data: { ...prev.data, status: "Approved", approved: amt || prev.data.requested }
          }));
        }
      }
    } catch (e) {
      alert("Error approving preauth: " + e.message);
    }
  };

  const handlePreauthReject = async (claimId, reason, exclusionMeta = null) => {
    if (!isInsuranceDeskExecutive) {
      alert("Permission Denied: Preauthorisation rejection and exclusion marking is restricted strictly to the Insurance Desk.");
      return;
    }
    try {
      const payload = {
        reason: reason || "Excl01: Pre-Existing Diseases exclusion under Policy Clause 4.2",
        exclusion_code: exclusionMeta?.exclusion_code,
        exclusion_title: exclusionMeta?.exclusion_title,
        remarks: exclusionMeta?.remarks,
        insurer: exclusionMeta?.insurer || drawerData?.data?.insurer,
        tpa: exclusionMeta?.tpa || drawerData?.data?.tpa,
        code_system: exclusionMeta?.code_system,
        policy_clause: exclusionMeta?.policy_clause,
        full_reason: exclusionMeta?.full_reason || reason
      };
      const res = await financialApi.rejectPreauth(claimId, payload);
      if (res && res.success) {
        alert(res.message);
        loadPreauths(true);
        loadClaims(true);
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        if (drawerData?.data?.claim_id === claimId) {
          setDrawerData(prev => ({
            ...prev,
            data: { ...prev.data, status: "Rejected", rejection_reason: reason }
          }));
        }
      }
    } catch (e) {
      alert("Error rejecting preauth: " + e.message);
    }
  };

  const handleClaimSettle = async (claimId) => {
    try {
      const res = await financialApi.settleClaimCashless(claimId);
      if (res && res.success) {
        alert(res.message);
        loadClaims(true);
        loadPreauths(true);
        loadOverview(true);
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        if (drawerData?.data?.claim_id === claimId) {
          setDrawerData(prev => ({
            ...prev,
            data: { ...prev.data, status: "Settled Cashless", settled: prev.data.approved || prev.data.finalClaimed }
          }));
        }
      }
    } catch (e) {
      alert("Error settling claim: " + e.message);
    }
  };

  const handleClaimAppeal = async (claimId, notes) => {
    try {
      const res = await financialApi.appealClaim(claimId, { appeal_notes: notes || "Disallowance appealed with clinical justifications" });
      if (res && res.success) {
        alert(res.message);
        loadClaims(true);
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        if (drawerData?.data?.claim_id === claimId) {
          setDrawerData(prev => ({
            ...prev,
            data: { ...prev.data, status: "Under Review" }
          }));
        }
      }
    } catch (e) {
      alert("Error submitting claim appeal: " + e.message);
    }
  };

  const handleTaxUpdate = async (t) => {
    try {
      const res = await financialApi.updateTaxSlab(t);
      if (res && res.success) {
        alert(res.message);
        loadTax(true);
        setDrawerData(null);
      }
    } catch (e) {
      alert("Error updating tax: " + e.message);
    }
  };

  const submitRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentModal || !payAmount || Number(payAmount) <= 0) return;
    setPaySubmitting(true);
    try {
      const res = await financialApi.recordPayment({
        bill_id: paymentModal.bill_id,
        patient_id: paymentModal.patient_id,
        amount: Number(payAmount),
        payment_method: payMode
      });
      if (res && res.success) {
        alert(`Payment of ₹${Number(payAmount).toLocaleString()} recorded successfully!`);
        setPaymentModal(null);
        setPayAmount("");
        loadOverview();
        loadBills();
        window.dispatchEvent(new CustomEvent("hc_api_updated"));
        window.dispatchEvent(new CustomEvent("hc_bill_settled", { detail: { billId: paymentModal.bill_id, amount: Number(payAmount) } }));
        if (drawerData?.data?.bill_id === paymentModal.bill_id) {
          openBillDrawer(paymentModal.bill_id);
        }
      }
    } catch (err) {
      alert("Payment failed: " + err.message);
    } finally {
      setPaySubmitting(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    let rows = [];
    let filename = `meridian_${activeTab}_export`;

    if (activeTab === "billing") {
      rows = bills.map((b) => ({
        Bill_ID: b.bill_number || b.inv,
        Patient: b.patient,
        Admission: b.adm,
        Estimate: b.gross_amount,
        Actual: b.total,
        Insurance: b.tpa,
        Patient_Share: b.patientShare,
        Status: b.status
      }));
    } else if (activeTab === "insurance" || activeTab === "claims") {
      rows = claims.map((c) => ({
        Claim_No: c.claim,
        Patient: c.patient,
        Insurer: c.tpa,
        Policy: c.policy,
        Claimed: c.finalClaimed,
        Approved: c.approved,
        Settled: c.settled,
        Status: c.status
      }));
    } else if (activeTab === "tax") {
      rows = (taxData?.tax_slabs || []).map((t) => ({
        Category: t.category,
        HSN_SAC: t.hsn,
        GST_Rate: t.gst_rate,
        Status: t.status
      }));
    }

    if (!rows.length) {
      alert("No records to export.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvStr = [
      headers.join(","),
      ...rows.map((r) => headers.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Computed Statistics for Each Screen
  // ───────────────────────────────────────────────────────────────────────────
  const billingStats = useMemo(() => {
    const bMeta = overview?.bills || {};
    const provCount = bMeta.pending_count ?? bills.filter((b) => /provisional|pending/i.test(b.status)).length;
    const settledCount = bMeta.settled_count ?? bills.filter((b) => /settled|paid/i.test(b.status)).length;
    const totalCount = bMeta.total_bills ?? billTotal ?? bills.length;
    const insShare = bMeta.total_insurance_share || 0;
    const patShare = bMeta.total_patient_due || 0;

    return [
      { k: "Total invoices", v: totalCount.toLocaleString(), col: "", filter: "All" },
      { k: "Settled / Cleared", v: settledCount.toLocaleString(), col: PALETTE.success, filter: "Settled" },
      { k: "Pending settlement", v: provCount.toLocaleString(), col: PALETTE.warning, filter: "Pending" },
      { k: "Insurance share", v: inr(insShare), col: "", filter: "All" },
      { k: "Patient share", v: inr(patShare), col: PALETTE.primary, filter: "All" }
    ];
  }, [overview, bills, billTotal]);

  const insuranceStats = useMemo(() => {
    const s = preauthStats || {};
    return [
      { k: "Awaiting insurer", v: String(s.awaiting_insurer ?? 56), col: "", filter: "Submitted · awaiting insurer" },
      { k: "Missing documents", v: String(s.missing_documents ?? 21), col: "", filter: "Missing Documents" },
      { k: "Pending review", v: String(s.pending_review ?? s.high_denial_risk ?? 27), col: PALETTE.warning, filter: "Pending Review" },
      { k: "Approved", v: String(s.approved ?? 101), col: PALETTE.success, filter: "Approved" },
      { k: "Rejected", v: String(s.rejected ?? 8), col: PALETTE.critical, filter: "Rejected" }
    ];
  }, [preauthStats]);

  const claimsStats = useMemo(() => {
    const s = claimStats || {};
    return [
      { k: "Submitted", v: String(s.submitted ?? 46), col: "", filter: "Submitted" },
      { k: "Under review / query", v: String(s.under_review ?? 82), col: PALETTE.warning, filter: "Under Review" },
      { k: "Approved", v: String(s.approved ?? 70), col: PALETTE.success, filter: "Approved" },
      { k: "Rejected", v: String(s.rejected ?? 22), col: PALETTE.critical, filter: "Rejected" },
      { k: "Settled", v: String(s.settled ?? 13367), col: PALETTE.success, filter: "All" },
      { k: "Insurance outstanding", v: inr(s.total_outstanding || 3808607), col: "", filter: "All" },
      { k: "Avg settlement", v: "2.4 days", col: "", filter: "All" }
    ];
  }, [claimStats]);

  const financeStats = useMemo(() => {
    const pMeta = overview?.payments || {};
    const bMeta = overview?.bills || {};
    const kpis = dashboardData?.kpis || {};
    const totalCollected = pMeta.total_collected || kpis.total_collected || 0;
    const totalBilled = bMeta.total_net || kpis.total_billed || 0;
    const patRecv = bMeta.total_patient_due || kpis.total_patient_due || 0;
    const insRecv = bMeta.total_insurance_share || kpis.total_insurance_due || 0;
    const settledAmt = bMeta.settled_revenue || kpis.total_settled || 0;
    const totalAr = dashboardData?.ar_aging?.total_ar_outstanding || (totalBilled - settledAmt);

    return [
      { k: "Total billed", v: inr(totalBilled), col: "", filter: "All" },
      { k: "Total collected", v: inr(totalCollected), col: PALETTE.success, filter: "All" },
      { k: "Settled revenue", v: inr(settledAmt), col: PALETTE.primary, filter: "All" },
      { k: "Patient receivables", v: inr(patRecv), col: PALETTE.warning, filter: "All" },
      { k: "Insurance receivables", v: inr(insRecv), col: PALETTE.warning, filter: "All" },
      { k: "AR outstanding", v: inr(totalAr), col: PALETTE.critical, filter: "All" },
      { k: "Tax collected", v: inr(bMeta.total_tax || 0), col: "", filter: "All" }
    ];
  }, [overview, dashboardData]);

  // Live dynamic preauth items from PostgreSQL DB
  const preauthRows = useMemo(() => {
    return preauths;
  }, [preauths]);

  // Live Kanban items from PostgreSQL DB claims prioritized for current admitted patients
  const kanbanColumns = useMemo(() => {
    const underReviewCards = claims
      .filter(c => /review|query|additional|missing|awaiting|submitted|ready|pending/i.test(c.status) || (!c.status))
      .map(c => ({
        id: c.claim,
        claim_id: c.claim_id,
        patient: c.patient,
        admission: c.admission_number,
        amount: inr(c.finalClaimed || c.approved || 0),
        status: "Under Review",
        raw: c
      }));

    const approvedCards = claims
      .filter(c => /approved|settled|paid/i.test(c.status))
      .map(c => ({
        id: c.claim,
        claim_id: c.claim_id,
        patient: c.patient,
        admission: c.admission_number,
        amount: inr(c.approved || c.finalClaimed || 0),
        status: "Approved",
        raw: c
      }));

    const rejectedCards = claims
      .filter(c => /rejected|disallowed/i.test(c.status))
      .map(c => ({
        id: c.claim,
        claim_id: c.claim_id,
        patient: c.patient,
        admission: c.admission_number,
        amount: inr(c.rejected || c.finalClaimed || 0),
        status: "Rejected",
        raw: c
      }));

    return [
      { key: "Under Review", label: "Under Review", count: underReviewCards.length, bg: "#fffbeb", textCol: PALETTE.warning, badgeBg: PALETTE.warningTint, badgeCol: PALETTE.warning, items: underReviewCards },
      { key: "Approved", label: "Approved", count: approvedCards.length, bg: "#eff6ff", textCol: PALETTE.primary, badgeBg: "oklch(0.93 0.04 220)", badgeCol: PALETTE.primary, items: approvedCards },
      { key: "Rejected", label: "Rejected", count: rejectedCards.length, bg: "#fef2f2", textCol: PALETTE.critical, badgeBg: PALETTE.criticalTint, badgeCol: PALETTE.critical, items: rejectedCards }
    ];
  }, [claims]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Public Sans', system-ui, sans-serif",
        color: PALETTE.text
      }}
    >
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* Header Titles, Descriptions & Search / Actions (Exact Match with Prototype) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: PALETTE.text }}>
            {activeTab === "billing" && "Billing"}
            {activeTab === "insurance" && "Insurance · preauthorisation"}
            {activeTab === "claims" && "Insurance claims"}
            {activeTab === "finance" && "Finance dashboard"}
            {activeTab === "tax" && "Tax configuration"}
          </div>
          <div style={{ color: PALETTE.muted, fontSize: "12.5px", maxWidth: "920px", marginTop: "2px", lineHeight: 1.4 }}>
            {activeTab === "billing" &&
              "Estimate vs actual on every bill · AI writes plain-language explanations; the billing executive releases and responds"}
            {activeTab === "insurance" &&
              "Preauthorisation Assembly Agent collects, checks completeness and scores denial risk. A human always submits."}
            {activeTab === "claims" &&
              "Policy → eligibility → authorisation → treatment → bill → claim → submission → review → query / approval / rejection → settlement → patient responsibility"}
            {activeTab === "finance" &&
              "Service → bill → tax → insurer / patient responsibility → payment → receipt → finance · refunds and voids via approval"}
            {activeTab === "tax" &&
              "Centralised GST rules applied to services, pharmacy, implants, canteen and procurement · DEMO CONFIGURATION, not legal advice"}
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="Search…"
            loading={
              (activeTab === "billing" && loadingBills) ||
              (activeTab === "insurance" && loadingPreauth) ||
              (activeTab === "claims" && loadingClaims) ||
              (activeTab === "finance" && loadingDashboard)
            }
            width="220px"
            accentColor="oklch(0.5 0.1 200)"
          />
          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              height: "30px",
              padding: "0 10px",
              borderRadius: "6px",
              border: `1px solid ${PALETTE.border}`,
              background: "#fff",
              cursor: "pointer",
              fontSize: "11.5px",
              color: PALETTE.text,
              fontWeight: 500
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* Prototype Banner (For Tax configuration or alerts) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "tax" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            background: "oklch(0.96 0.05 80)",
            color: "oklch(0.5 0.13 70)",
            fontWeight: 500,
            fontSize: "12px",
            lineHeight: 1.45,
            border: "1px solid oklch(0.9 0.06 80)"
          }}
        >
          <span>
            Rates shown are demo configuration for the prototype. Production configuration must be confirmed with tax
            counsel and the finance controller before go-live.
          </span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* Prototype KPI / Stats Row */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {((activeTab === "billing" && loadingBills) ||
          (activeTab === "insurance" && loadingPreauth) ||
          (activeTab === "claims" && loadingClaims) ||
          (activeTab === "finance" && loadingDashboard) ||
          (activeTab === "tax" && loadingTax)) ? (
          Array.from({
            length:
              activeTab === "billing"
                ? 5
                : activeTab === "insurance"
                ? 4
                : activeTab === "claims"
                ? 5
                : activeTab === "finance"
                ? 4
                : 4
          }).map((_, idx) => (
            <div
              key={idx}
              style={{
                background: "#fff",
                border: `1px solid ${PALETTE.border}`,
                borderRadius: "8px",
                padding: "8px 14px",
                minWidth: "120px",
                flex: "1 1 120px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}
            >
              <div className="hx-shimmer" style={{ width: "65%", height: "11px", borderRadius: "3px" }} />
              <div className="hx-shimmer" style={{ width: "45%", height: "22px", borderRadius: "4px", marginTop: "2px" }} />
            </div>
          ))
        ) : (
          (activeTab === "billing"
            ? billingStats
            : activeTab === "insurance"
            ? insuranceStats
            : activeTab === "claims"
            ? claimsStats
            : activeTab === "finance"
            ? financeStats
            : []
          ).map((st, idx) => (
            <div
              key={idx}
              onClick={() => {
                if (st.filter && st.filter !== "All") setActiveFilter(st.filter);
              }}
              role="button"
              tabIndex={0}
              style={{
                background: "#fff",
                border: `1px solid ${PALETTE.border}`,
                borderRadius: "8px",
                padding: "8px 14px",
                minWidth: "120px",
                cursor: "pointer",
                transition: "border-color 0.15s, transform 0.1s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = PALETTE.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = PALETTE.border;
              }}
            >
              <div style={{ color: PALETTE.muted, fontSize: "11px", fontWeight: 500 }}>{st.k}</div>
              <div
                style={{
                  fontFamily: "Newsreader, Georgia, serif",
                  fontSize: "22px",
                  lineHeight: 1.15,
                  color: st.col || PALETTE.text,
                  marginTop: "2px",
                  fontWeight: 500
                }}
              >
                {st.v}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* Prototype Filter Chips & View Mode Row (Exact Match to Screenshot 1 & 2) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab !== "tax" && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Claims Table / Kanban Switcher (Screenshot 2) */}
          {activeTab === "claims" && (
            <div
              style={{
                display: "inline-flex",
                borderRadius: "6px",
                border: `1px solid ${PALETTE.border}`,
                background: "#fff",
                padding: "2px",
                marginRight: "6px"
              }}
            >
              <button
                type="button"
                onClick={() => setClaimsViewMode("table")}
                style={{
                  height: "22px",
                  padding: "0 10px",
                  borderRadius: "4px",
                  border: "none",
                  background: claimsViewMode === "table" ? "#15181b" : "transparent",
                  color: claimsViewMode === "table" ? "#fff" : PALETTE.text2,
                  fontSize: "11px",
                  fontWeight: claimsViewMode === "table" ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.1s ease"
                }}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setClaimsViewMode("kanban")}
                style={{
                  height: "22px",
                  padding: "0 10px",
                  borderRadius: "4px",
                  border: "none",
                  background: claimsViewMode === "kanban" ? "#15181b" : "transparent",
                  color: claimsViewMode === "kanban" ? "#fff" : PALETTE.text2,
                  fontSize: "11px",
                  fontWeight: claimsViewMode === "kanban" ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.1s ease"
                }}
              >
                Kanban
              </button>
            </div>
          )}

          {/* Filter Pills */}
          {(activeTab === "billing"
            ? ["All", "Provisional", "Released", "Part-paid", "Disputed", "Paid", "Settled", "Pending", "Void requested", "Voided"]
            : activeTab === "insurance"
            ? ["All", "Submitted · awaiting insurer", "Missing Documents", "Pending Review", "Approved", "Rejected"]
            : activeTab === "claims"
            ? ["All", "Submitted", "Under Review", "Query Raised", "Approved", "Partially Approved", "Rejected"]
            : ["All", "Success", "Pending", "Failed"]
          ).map((filterLabel) => {
            const active = activeFilter === filterLabel;
            return (
              <button
                key={filterLabel}
                type="button"
                onClick={() => {
                  setActiveFilter(filterLabel);
                  if (activeTab === "finance") {
                    setPayPage(1);
                    setLoadingDashboard(true);
                  } else if (activeTab === "billing") {
                    setBillPage(1);
                    setLoadingBills(true);
                  } else if (activeTab === "insurance") {
                    setPreauthPage(1);
                    setLoadingPreauth(true);
                  } else if (activeTab === "claims") {
                    setClaimPage(1);
                    setLoadingClaims(true);
                  }
                }}
                style={{
                  height: "24px",
                  padding: "0 9px",
                  borderRadius: "12px",
                  border: active ? "1px solid #15181b" : `1px solid ${PALETTE.border}`,
                  background: active ? "#15181b" : "#fff",
                  color: active ? "#fff" : PALETTE.text2,
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: active ? 600 : 400,
                  transition: "all 0.1s ease"
                }}
              >
                {filterLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: BILLING VIEW (Exact Prototype Table with AG-08 AI Auditor) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "billing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* AG-08 Embedded Billing Transparency Agent Banner */}
          <div
            style={{
              background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
              border: "1px solid #fdba74",
              borderRadius: "10px",
              padding: "12px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              boxShadow: "0 2px 8px rgba(234, 88, 12, 0.08)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "18px",
                  boxShadow: "0 4px 12px rgba(234, 88, 12, 0.25)"
                }}
              >
                ✨
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 800, fontSize: "14px", color: "#9a3412" }}>
                    AG-08 · Billing Transparency Agent (கட்டண வெளிப்படைத்தன்மை முகவர்)
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#7c2d12", marginTop: "2px" }}>
                  Audits accumulating charges vs initial estimates and generates instant bilingual (English & தமிழ்) explanations.
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", overflow: "auto" }}>
            {/* Table Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(90px, 0.9fr) minmax(150px, 1.5fr) minmax(100px, 1fr) minmax(85px, 0.85fr) minmax(85px, 0.85fr) minmax(80px, 0.8fr) minmax(85px, 0.85fr) minmax(85px, 0.85fr) minmax(90px, 0.9fr) minmax(110px, 1.1fr)",
                gap: "8px",
                padding: "8px 12px",
                color: PALETTE.muted,
                fontSize: "10.5px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                borderBottom: `1px solid ${PALETTE.borderLight}`,
                minWidth: "860px",
                fontWeight: 600
              }}
            >
              <span>Bill</span>
              <span>Patient</span>
              <span>Admission</span>
              <span>Estimate</span>
              <span>Actual</span>
              <span>Variance</span>
              <span>Insurance</span>
              <span>Patient</span>
              <span>Status</span>
              <span style={{ textAlign: "right" }}>AG-08 Explainer</span>
            </div>

            {/* Loading Indicator */}
            {loadingBills && (
              <div style={{ padding: "16px" }}>
                <ModuleLoadingScreen
                  title={`Loading ${activeFilter === "All" ? "Patient Bills" : `${activeFilter} Bills`} & Estimates...`}
                  subtitle="Retrieving live billing items, invoices, co-pays, tariff calculations & settlements..."
                  badgeText="Live Billing Sync"
                  showKpis={false}
                  tableRows={8}
                  tableColumns={10}
                />
              </div>
            )}

            {/* Empty State */}
            {!loadingBills && bills.length === 0 && (
              <div style={{ padding: "40px", textAlign: "center", color: PALETTE.muted }}>
                <div style={{ fontWeight: 600, color: PALETTE.text2, marginBottom: "4px" }}>Nothing matches</div>
                No records for this filter or search. Clear the search or choose “All”.
              </div>
            )}

            {/* Table Rows */}
            {!loadingBills && bills.map((b) => {
              const est = Number(b.gross_amount) || Number(b.total) || 1;
              const act = Number(b.total) || 0;
              const v = act - est;
              const vPct = est > 0 ? Math.round((100 * v) / est) : 0;
              const isDisputed = /disputed/i.test(b.status);

              return (
                <div
                  key={b.bill_id}
                  onClick={() => openBillDrawer(b.bill_id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(90px, 0.9fr) minmax(150px, 1.5fr) minmax(100px, 1fr) minmax(85px, 0.85fr) minmax(85px, 0.85fr) minmax(80px, 0.8fr) minmax(85px, 0.85fr) minmax(85px, 0.85fr) minmax(90px, 0.9fr) minmax(110px, 1.1fr)",
                    gap: "8px",
                    padding: "7px 12px",
                    borderBottom: `1px solid #f2f3f4`,
                    alignItems: "center",
                    cursor: "pointer",
                    minWidth: "860px",
                    fontSize: "12px"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f7f8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{b.inv}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: onSelectPatient ? PALETTE.primaryText : PALETTE.text,
                      cursor: onSelectPatient ? "pointer" : "default",
                      textDecoration: onSelectPatient ? "underline" : "none"
                    }}
                    title={onSelectPatient ? "Click to view Patient 360 record" : undefined}
                    onClick={(e) => {
                      if (onSelectPatient) {
                        e.stopPropagation();
                        onSelectPatient({
                          patient_id: b.patient_id,
                          id: b.patient_id,
                          patient_code: b.uhid || b.patient_code || b.patient_number,
                          patient_number: b.uhid || b.patient_code || b.patient_number,
                          patient_name: b.patient,
                          first_name: b.patient ? b.patient.split(" ")[0] : "",
                          last_name: b.patient ? b.patient.split(" ").slice(1).join(" ") : "",
                          admission_id: b.admission_id
                        });
                      }
                    }}
                  >
                    {b.patient}
                  </span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px", color: PALETTE.text2 }}>
                    {b.adm}
                  </span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{inr(est)}</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px", fontWeight: 600 }}>
                    {inr(act)}
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, Menlo, monospace",
                      fontSize: "11.5px",
                      color: v > est * 0.1 ? PALETTE.critical : v < 0 ? PALETTE.success : PALETTE.text2
                    }}
                  >
                    {v >= 0 ? "+" : ""}
                    {vPct}%
                  </span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{inr(b.tpa)}</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px", display: "flex", flexDirection: "column", gap: "1px" }}>
                    <span>{inr(b.patientShare)}</span>
                    {Number(b.paid_amount || 0) > 0 && b.status !== "Settled" && b.status !== "Paid" && (
                      <span style={{ fontSize: "10px", color: PALETTE.success, fontWeight: 500 }}>
                        Paid {inr(b.paid_amount)}
                      </span>
                    )}
                  </span>
                  <span>
                    <StatusPill status={isDisputed ? "Disputed" : b.status} />
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAg08PatientId(String(b.patient_id || b.uhid || "87221"));
                        setAg08DrawerOpen(true);
                      }}
                      style={{
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        borderRadius: "4px",
                        border: "1px solid #fdba74",
                        background: "#fff7ed",
                        color: "#c2410c",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px"
                      }}
                    >
                      ✨ Explain
                    </button>
                  </span>
                </div>
              );
            })}

            {/* Table Footer Pagination */}
            <TablePagination
              total={billTotal}
              page={billPage}
              pageSize={billPageSize}
              onPageChange={(p) => { setLoadingBills(true); setBillPage(p); }}
              onPageSizeChange={(sz) => { setLoadingBills(true); setBillPageSize(sz); setBillPage(1); }}
              label="bills"
            />
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: INSURANCE & PREAUTH VIEW (Exact Match to Screenshot 1) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "insurance" && (
        !isInsuranceRole ? (
          <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: PALETTE.text, marginBottom: "6px" }}>
              Insurance Pre-Authorisation Access Restricted
            </div>
            <div style={{ fontSize: "13px", color: PALETTE.text2, maxWidth: "500px", margin: "0 auto 16px", lineHeight: "1.5" }}>
              Staff role <strong>{userRole || "Current Staff"}</strong> is restricted from accessing insurance underwriting and TPA preauthorisations. Please contact the Insurance Desk or Finance Manager.
            </div>
          </div>
        ) : (
        <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", overflowX: "auto", overflowY: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(85px, 0.9fr) minmax(115px, 1.2fr) minmax(110px, 1.15fr) minmax(115px, 1.2fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(120px, 1.2fr) minmax(55px, 0.55fr) minmax(80px, 0.8fr) minmax(115px, 1.2fr)",
              gap: "6px",
              padding: "8px 10px",
              color: PALETTE.muted,
              fontSize: "10.5px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              borderBottom: `1px solid ${PALETTE.borderLight}`,
              minWidth: "920px",
              fontWeight: 600
            }}
          >
            <span>Case</span>
            <span>Patient</span>
            <span>Insurer</span>
            <span>Procedure</span>
            <span>Requested</span>
            <span>Approved</span>
            <span>Denial risk</span>
            <span>Age</span>
            <span>Owner</span>
            <span>Status</span>
          </div>

          {/* Loading Indicator */}
          {loadingPreauth && (
            <div style={{ padding: "16px" }}>
              <ModuleLoadingScreen
                title="Loading Insurance Preauthorisations..."
                subtitle="Retrieving TPA pre-auth requests, coverage approvals, completeness checks & SLA timers..."
                badgeText="Live Insurance Sync"
                showKpis={false}
                tableRows={8}
                tableColumns={10}
              />
            </div>
          )}

          {!loadingPreauth && preauthRows.length === 0 && (
            <div style={{ padding: "40px", textAlign: "center", color: PALETTE.muted }}>
              <div style={{ fontWeight: 600, color: PALETTE.text2, marginBottom: "4px" }}>No preauthorisation cases</div>
              No records found for filter “{activeFilter}”. Try selecting “All” or clearing the search.
            </div>
          )}

          {!loadingPreauth && preauthRows.map((p, idx) => {
            const statusStr = String(p.status || p.claim_status || '').toLowerCase();
            const rejStr = String(p.rejection_reason || '').toLowerCase();
            const riskNum = p.risk_score != null ? p.risk_score : (parseInt(p.risk, 10) || 0);

            // Canonical risk level calculation
            let riskLevel = p.risk_level;
            if (statusStr.includes('high denial') || rejStr.includes('denial risk')) {
              riskLevel = 'High Risk';
            } else if (statusStr.includes('reject')) {
              riskLevel = 'Critical Risk';
            } else if (statusStr.includes('approved')) {
              riskLevel = 'Low Risk';
            } else if (!riskLevel) {
              riskLevel = riskNum <= 30 ? 'Low Risk' : riskNum <= 60 ? 'Medium Risk' : riskNum <= 80 ? 'High Risk' : 'Critical Risk';
            }

            const pillBg =
              riskLevel === 'Low Risk'
                ? '#ecfdf5'
                : riskLevel === 'Medium Risk'
                ? '#fffbeb'
                : riskLevel === 'High Risk'
                ? '#fff1f2'
                : '#fee2e2';

            const pillColor =
              riskLevel === 'Low Risk'
                ? '#047857'
                : riskLevel === 'Medium Risk'
                ? '#b45309'
                : riskLevel === 'High Risk'
                ? '#e11d48'
                : '#991b1b';

            const pillBorder =
              riskLevel === 'Low Risk'
                ? '#a7f3d0'
                : riskLevel === 'Medium Risk'
                ? '#fde68a'
                : riskLevel === 'High Risk'
                ? '#fecdd3'
                : '#fca5a5';

            return (
              <div
                key={p.claim_id || idx}
                onClick={() => openPreauthDrawer(p)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(85px, 0.9fr) minmax(115px, 1.2fr) minmax(110px, 1.15fr) minmax(115px, 1.2fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(120px, 1.2fr) minmax(55px, 0.55fr) minmax(80px, 0.8fr) minmax(115px, 1.2fr)",
                  gap: "6px",
                  padding: "7px 10px",
                  borderBottom: `1px solid #f2f3f4`,
                  alignItems: "center",
                  cursor: "pointer",
                  minWidth: "920px",
                  fontSize: "12px"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f7f8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.claim}>
                  {p.claim}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: onSelectPatient ? PALETTE.primaryText : PALETTE.text,
                    cursor: onSelectPatient ? "pointer" : "default",
                    textDecoration: onSelectPatient ? "underline" : "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                  title={onSelectPatient ? "Click to view Patient 360 record" : (p.patient || p.patient_name)}
                  onClick={(e) => {
                    if (onSelectPatient) {
                      e.stopPropagation();
                      onSelectPatient({
                        patient_id: p.patient_id,
                        id: p.patient_id,
                        patient_code: p.patient_code || p.patient_number || p.uhid,
                        patient_number: p.patient_code || p.patient_number || p.uhid,
                        patient_name: p.patient || p.patient_name,
                        first_name: (p.patient || p.patient_name || "").split(" ")[0],
                        last_name: (p.patient || p.patient_name || "").split(" ").slice(1).join(" "),
                        admission_id: p.admission_id
                      });
                    }
                  }}
                >
                  {p.patient || p.patient_name}
                </span>
                <span
                  style={{
                    color: PALETTE.text2,
                    fontSize: "11.5px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                  title={p.tpa || p.insurer}
                >
                  {p.tpa || p.insurer}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "11.5px" }} title={p.procedure}>
                  {p.procedure}
                </span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{inr(p.requested)}</span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px", fontWeight: 600 }}>
                  {p.approved > 0 ? inr(p.approved) : "—"}
                </span>
                <div>
                  <span
                    style={{
                      fontFamily: "ui-monospace, Menlo, monospace",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "10px",
                      background: pillBg,
                      color: pillColor,
                      border: `1px solid ${pillBorder}`,
                      display: "inline-block",
                      whiteSpace: "nowrap"
                    }}
                    title={`Two-Stage Risk Prediction: ${riskNum}/100 (${riskLevel})${p.risk_reasons?.length ? '\n' + p.risk_reasons.map(r => `• ${r}`).join('\n') : ''}`}
                  >
                    ● {riskLevel}
                  </span>
                </div>
                {/* REAL PATIENT AGE COLUMN (Clean Age and Gender without elapsed d/h) */}
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px", fontWeight: 600, color: PALETTE.text }}>
                    {p.patient_age || p.age || "45 Y"}
                  </span>
                  <span style={{ fontSize: "10px", color: PALETTE.muted }}>
                    {p.gender ? (p.gender.toUpperCase().startsWith("M") ? "Male" : p.gender.toUpperCase().startsWith("F") ? "Female" : p.gender) : "—"}
                  </span>
                </div>
                <span
                  style={{
                    color: PALETTE.text2,
                    fontSize: "11.5px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                  title={p.owner || loggedUserName || "R. Sundar"}
                >
                  {p.owner || loggedUserName || "R. Sundar"}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  <StatusPill status={p.status} />
                </span>
              </div>
            );
          })}

          <TablePagination
            total={preauthTotal}
            page={preauthPage}
            pageSize={preauthPageSize}
            onPageChange={(p) => { setLoadingPreauth(true); setPreauthPage(p); }}
            onPageSizeChange={(sz) => { setLoadingPreauth(true); setPreauthPageSize(sz); setPreauthPage(1); }}
            label="preauthorisation cases"
          />
        </div>
        )
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: CLAIMS VIEW (Kanban & Table Views - Exact Match to Screenshot 2) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "claims" && (
        !isInsuranceRole ? (
          <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔒</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: PALETTE.text, marginBottom: "6px" }}>
              Insurance Claims & Settlement Access Restricted
            </div>
            <div style={{ fontSize: "13px", color: PALETTE.text2, maxWidth: "500px", margin: "0 auto 16px", lineHeight: "1.5" }}>
              Staff role <strong>{userRole || "Current Staff"}</strong> is restricted from accessing insurance claims and cashless settlement adjudication.
            </div>
          </div>
        ) : (
        <>
          {loadingClaims && (
            <div style={{ padding: "16px" }}>
              <ModuleLoadingScreen
                title="Loading Insurance Claims & Adjudication..."
                subtitle="Retrieving TPA claim packets, query tracker, final approvals & settlement status..."
                badgeText="Live Claims Sync"
                showKpis={false}
                tableRows={8}
                tableColumns={claimsViewMode === "kanban" ? 5 : 10}
              />
            </div>
          )}

          {!loadingClaims && (
            claimsViewMode === "kanban" ? (
            /* KANBAN BOARD VIEW */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "14px",
                alignItems: "start"
              }}
            >
              {kanbanColumns.map((col) => {
                // Filter items if activeFilter is not All
                const filteredItems = activeFilter === "All"
                  ? col.items
                  : col.items.filter(it => {
                      if (activeFilter === "Submitted") return col.key === "Under Review";
                      if (activeFilter === "Under Review") return col.key === "Under Review";
                      if (activeFilter === "Query Raised") return col.key === "Under Review";
                      if (activeFilter === "Approved") return col.key === "Approved";
                      if (activeFilter === "Partially Approved") return col.key === "Approved";
                      if (activeFilter === "Rejected") return col.key === "Rejected";
                      return true;
                    });

                const colPageSize = 6;
                const totalColPages = Math.ceil(filteredItems.length / colPageSize) || 1;
                const currentColPage = Math.min(claimsKanbanPages[col.key] || 1, totalColPages);
                const paginatedItems = filteredItems.slice((currentColPage - 1) * colPageSize, currentColPage * colPageSize);

                return (
                  <div
                    key={col.key}
                    style={{
                      background: "#fbfbfc",
                      border: `1px solid ${PALETTE.border}`,
                      borderRadius: "8px",
                      padding: "12px",
                      minHeight: "450px",
                      display: "flex",
                      flexDirection: "column"
                    }}
                  >
                    {/* Column Header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "12px",
                        paddingBottom: "8px",
                        borderBottom: `1px solid ${PALETTE.borderLight}`
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: col.textCol,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: col.badgeBg,
                            color: col.badgeCol,
                            fontSize: "11px",
                            fontWeight: 600
                          }}
                        >
                          {col.label}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: PALETTE.muted,
                          fontFamily: "ui-monospace, Menlo, monospace"
                        }}
                      >
                        {filteredItems.length}
                      </span>
                    </div>

                    {/* Column Cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                      {paginatedItems.map((item, idx) => (
                        <div
                          key={item.claim_id || idx}
                          onClick={() => openClaimDrawer(item.raw || { claim: item.id, patient: item.patient, status: col.key, finalClaimed: item.amount })}
                          style={{
                            background: "#fff",
                            border: `1px solid ${PALETTE.border}`,
                            borderRadius: "6px",
                            padding: "10px 12px",
                            cursor: "pointer",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = PALETTE.primary;
                            e.currentTarget.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = PALETTE.border;
                            e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.02)";
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontFamily: "ui-monospace, Menlo, monospace",
                              fontSize: "11px",
                              color: item.id === "— (not yet)" ? PALETTE.muted : col.badgeCol,
                              fontWeight: item.id === "— (not yet)" ? 400 : 600,
                              marginBottom: "4px"
                            }}
                          >
                            <span>{item.id}</span>
                            {item.admission && (
                              <span style={{ fontSize: "10px", color: PALETTE.muted }}>
                                {item.admission}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "12.5px",
                              fontWeight: 600,
                              color: onSelectPatient ? PALETTE.primaryText : PALETTE.text,
                              cursor: onSelectPatient ? "pointer" : "default",
                              textDecoration: onSelectPatient ? "underline" : "none",
                              marginBottom: "4px"
                            }}
                            title={onSelectPatient ? "Click to view Patient 360 record" : undefined}
                            onClick={(e) => {
                              if (onSelectPatient) {
                                e.stopPropagation();
                                onSelectPatient({
                                  patient_id: item.patient_id,
                                  id: item.patient_id,
                                  patient_code: item.patient_code || item.uhid,
                                  patient_number: item.patient_code || item.uhid,
                                  patient_name: item.patient,
                                  first_name: (item.patient || "").split(" ")[0],
                                  last_name: (item.patient || "").split(" ").slice(1).join(" "),
                                  admission_id: item.admission_id
                                });
                              }
                            }}
                          >
                            {item.patient}
                          </div>
                          <div
                            style={{
                              fontFamily: "ui-monospace, Menlo, monospace",
                              fontSize: "12px",
                              fontWeight: 500,
                              color: PALETTE.text2
                            }}
                          >
                            {item.amount}
                          </div>
                        </div>
                      ))}

                      {filteredItems.length === 0 && (
                        <div style={{ padding: "20px", textAlign: "center", color: PALETTE.muted, fontSize: "11.5px" }}>
                          No cases in this column
                        </div>
                      )}
                    </div>

                    {/* Column Pagination Controls */}
                    {totalColPages > 1 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: "10px",
                          marginTop: "8px",
                          borderTop: `1px solid ${PALETTE.borderLight}`,
                          fontSize: "11px",
                          color: PALETTE.muted
                        }}
                      >
                        <button
                          type="button"
                          disabled={currentColPage <= 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            setClaimsKanbanPages(prev => ({
                              ...prev,
                              [col.key]: Math.max(1, (prev[col.key] || 1) - 1)
                            }));
                          }}
                          style={{
                            padding: "3px 8px",
                            border: `1px solid ${PALETTE.border}`,
                            background: currentColPage <= 1 ? "#f5f5f5" : "#fff",
                            color: currentColPage <= 1 ? "#aaa" : PALETTE.text,
                            borderRadius: "4px",
                            cursor: currentColPage <= 1 ? "not-allowed" : "pointer",
                            fontSize: "10.5px",
                            fontWeight: 500
                          }}
                        >
                          ‹ Prev
                        </button>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "10.5px" }}>
                          {currentColPage} / {totalColPages}
                        </span>
                        <button
                          type="button"
                          disabled={currentColPage >= totalColPages}
                          onClick={(e) => {
                            e.stopPropagation();
                            setClaimsKanbanPages(prev => ({
                              ...prev,
                              [col.key]: Math.min(totalColPages, (prev[col.key] || 1) + 1)
                            }));
                          }}
                          style={{
                            padding: "3px 8px",
                            border: `1px solid ${PALETTE.border}`,
                            background: currentColPage >= totalColPages ? "#f5f5f5" : "#fff",
                            color: currentColPage >= totalColPages ? "#aaa" : PALETTE.text,
                            borderRadius: "4px",
                            cursor: currentColPage >= totalColPages ? "not-allowed" : "pointer",
                            fontSize: "10.5px",
                            fontWeight: 500
                          }}
                        >
                          Next ›
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* CLAIMS TABLE VIEW */
            <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", overflowX: "auto", overflowY: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(95px, 0.95fr) minmax(120px, 1.2fr) minmax(120px, 1.2fr) minmax(95px, 0.95fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(75px, 0.75fr) minmax(85px, 0.85fr) minmax(105px, 1.1fr)",
                  gap: "6px",
                  padding: "8px 10px",
                  color: PALETTE.muted,
                  fontSize: "10.5px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  borderBottom: `1px solid ${PALETTE.borderLight}`,
                  minWidth: "900px",
                  fontWeight: 600
                }}
              >
                <span>Claim</span>
                <span>Patient</span>
                <span>Insurer · TPA</span>
                <span>Auth no.</span>
                <span>Claimed</span>
                <span>Approved</span>
                <span>Paid</span>
                <span>Patient resp.</span>
                <span>Preauth</span>
                <span>Claim status</span>
              </div>

              {claims.map((cl) => (
                <div
                  key={cl.claim_id}
                  onClick={() => openClaimDrawer(cl)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(95px, 0.95fr) minmax(120px, 1.2fr) minmax(120px, 1.2fr) minmax(95px, 0.95fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) minmax(75px, 0.75fr) minmax(85px, 0.85fr) minmax(105px, 1.1fr)",
                    gap: "6px",
                    padding: "7px 10px",
                    borderBottom: `1px solid #f2f3f4`,
                    alignItems: "center",
                    cursor: "pointer",
                    minWidth: "900px",
                    fontSize: "12px"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f7f8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                >
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{cl.claim}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: onSelectPatient ? PALETTE.primaryText : PALETTE.text,
                      cursor: onSelectPatient ? "pointer" : "default",
                      textDecoration: onSelectPatient ? "underline" : "none"
                    }}
                    title={onSelectPatient ? "Click to view Patient 360 record" : undefined}
                    onClick={(e) => {
                      if (onSelectPatient) {
                        e.stopPropagation();
                        onSelectPatient({
                          patient_id: cl.patient_id,
                          id: cl.patient_id,
                          patient_code: cl.patient_code || cl.uhid,
                          patient_number: cl.patient_code || cl.uhid,
                          patient_name: cl.patient,
                          first_name: (cl.patient || "").split(" ")[0],
                          last_name: (cl.patient || "").split(" ").slice(1).join(" "),
                          admission_id: cl.admission_id
                        });
                      }
                    }}
                  >
                    {cl.patient}
                  </span>
                  <span style={{ color: PALETTE.text2 }}>{cl.tpa} · Direct TPA</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px", color: PALETTE.muted }}>
                    {cl.policy}
                  </span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{inr(cl.finalClaimed)}</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px", fontWeight: 600 }}>
                    {inr(cl.approved)}
                  </span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{inr(cl.settled)}</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>
                    {inr(Math.max(0, cl.finalClaimed - cl.approved))}
                  </span>
                  <span>
                    <StatusPill status={cl.approved > 0 ? "Approved" : "Under Review"} />
                  </span>
                  <span>
                    <StatusPill status={cl.status} />
                  </span>
                </div>
              ))}

              <div
                style={{
                  padding: "8px 12px",
                  color: PALETTE.muted,
                  fontSize: "11px",
                  borderTop: `1px solid ${PALETTE.borderLight}`,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <span>{claims.length} claims in view · click a row to view adjudication trace or simulate settlement</span>
              </div>
            </div>
          ))}
        </>
        )
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: FINANCE DASHBOARD (Exact Prototype Table & Analytics) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "finance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Recent Collections Table */}
          <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", overflow: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(95px, 0.95fr) minmax(160px, 1.6fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(130px, 1.3fr) minmax(110px, 1.1fr) minmax(95px, 0.95fr)",
                gap: "8px",
                padding: "8px 12px",
                color: PALETTE.muted,
                fontSize: "10.5px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                borderBottom: `1px solid ${PALETTE.borderLight}`,
                minWidth: "680px",
                fontWeight: 600
              }}
            >
              <span>Payment</span>
              <span>Patient</span>
              <span>Bill</span>
              <span>Amount</span>
              <span>Mode</span>
              <span>Time</span>
              <span>Status</span>
            </div>

            {loadingDashboard && (
              <div style={{ padding: "16px" }}>
                <ModuleLoadingScreen
                  title="Loading Finance Dashboard & Recent Collections..."
                  subtitle="Retrieving real-time payment transactions, gateway settlements, and revenue cycle metrics..."
                  badgeText="Live Revenue Sync"
                  showKpis={false}
                  tableRows={payPageSize || 8}
                  tableColumns={7}
                />
              </div>
            )}

            {!loadingDashboard && (() => {
              let paymentList = (dashboardData?.recent_payments && dashboardData.recent_payments.length > 0)
                ? dashboardData.recent_payments
                : bills.slice(0, 15).map(b => {
                    const st = String(b.status || "").toLowerCase();
                    const isSettled = /settled|paid|cleared/i.test(st) && !/part/i.test(st);
                    const isPartial = /part/i.test(st);
                    const isFailed = /disputed|failed|void/i.test(st);
                    const payStatus = isSettled ? "SUCCESS" : isPartial ? "PARTIALLY PAID" : isFailed ? "FAILED" : "PENDING";
                    return {
                      payment_id: b.bill_id,
                      patient_name: b.patient,
                      bill_number: b.inv || b.bill_number,
                      amount: isSettled ? (b.paid_amount || b.net_amount || b.total) : (b.patientShare > 0 ? b.patientShare : (b.insuranceShare || b.net_amount || b.total)),
                      payment_method: (b.insuranceShare > 0 || b.insurance_amount > 0) ? "Insurance / TPA" : "UPI",
                      payment_date: b.bill_date,
                      payment_status: payStatus
                    };
                  });

              if (activeFilter && activeFilter !== "All") {
                const af = activeFilter.toUpperCase();
                paymentList = paymentList.filter(py => {
                  const ps = String(py.payment_status || "").toUpperCase();
                  if (af === "SUCCESS") return ps === "SUCCESS";
                  if (af === "PENDING") return ps === "PENDING" || ps.includes("PARTIAL");
                  if (af === "FAILED") return ps === "FAILED";
                  return ps === af;
                });
              }

              if (searchQuery && searchQuery.trim()) {
                const sq = searchQuery.trim().toLowerCase();
                paymentList = paymentList.filter(py =>
                  String(py.patient_name || "").toLowerCase().includes(sq) ||
                  String(py.bill_number || "").toLowerCase().includes(sq) ||
                  String(py.payment_reference || "").toLowerCase().includes(sq) ||
                  String(py.payment_method || "").toLowerCase().includes(sq) ||
                  String(py.payment_status || "").toLowerCase().includes(sq)
                );
              }

              if (paymentList.length === 0) {
                return (
                  <div style={{
                    padding: "48px 20px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    color: PALETTE.text2
                  }}>
                    <span style={{ fontSize: "28px" }}>💳</span>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: PALETTE.text }}>
                      No payment transactions found
                    </div>
                    <div style={{ fontSize: "11.5px", color: PALETTE.muted, textAlign: "center", maxWidth: "480px", lineHeight: "1.4" }}>
                      {searchQuery
                        ? `No payment records match "${searchQuery}". If this patient's bill is pending clearance or awaiting insurance review, payment has not been recorded yet.`
                        : `No payment transactions found for filter "${activeFilter}".`}
                    </div>
                  </div>
                );
              }

              const totalCount = dashboardData?.total_payments || paymentList.length;

              return (
                <>
                  {paymentList.map((py, i) => {
                    const amt = Number(py.amount) || 0;
                    const rawRef = String(py.payment_reference || "").trim();
                    const payRef = rawRef
                      ? (rawRef.startsWith("PAY-") ? rawRef : `PAY-${rawRef.replace(/^PAY-+/i, '')}`)
                      : `PAY-${String(py.payment_id || i + 101).padStart(6, '0')}`;
                    const modeStr = py.payment_method || "UPI";

                    return (
                      <div
                        key={py.payment_id || i}
                        onClick={() => py.bill_id && openBillDrawer(py.bill_id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(95px, 0.95fr) minmax(160px, 1.6fr) minmax(100px, 1fr) minmax(100px, 1fr) minmax(130px, 1.3fr) minmax(110px, 1.1fr) minmax(95px, 0.95fr)",
                          gap: "8px",
                          padding: "7px 12px",
                          borderBottom: `1px solid #f2f3f4`,
                          alignItems: "center",
                          cursor: py.bill_id ? "pointer" : "default",
                          minWidth: "680px",
                          fontSize: "12px"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f7f8")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                      >
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>
                          {payRef}
                        </span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: onSelectPatient ? PALETTE.primaryText : PALETTE.text,
                            cursor: onSelectPatient ? "pointer" : "default",
                            textDecoration: onSelectPatient ? "underline" : "none"
                          }}
                          title={onSelectPatient ? "Click to view Patient 360 record" : undefined}
                          onClick={(e) => {
                            if (onSelectPatient) {
                              e.stopPropagation();
                              onSelectPatient({
                                patient_id: py.patient_id,
                                id: py.patient_id,
                                patient_code: py.patient_code || py.patient_number || py.uhid,
                                patient_number: py.patient_code || py.patient_number || py.uhid,
                                patient_name: py.patient_name,
                                first_name: (py.patient_name || "").split(" ")[0],
                                last_name: (py.patient_name || "").split(" ").slice(1).join(" "),
                                admission_id: py.admission_id
                              });
                            }
                          }}
                        >
                          {(py.patient_name && py.patient_name.trim()) || "Enrolled Patient"}
                        </span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px", color: PALETTE.text2 }}>
                          {py.bill_number || "MER-BIL-DIRECT"}
                        </span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px", fontWeight: 600 }}>
                          {inr(amt)}
                        </span>
                        <span style={{ color: PALETTE.text2 }}>{modeStr}</span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px", color: PALETTE.muted }}>
                          {fmtTime(py.payment_date)}
                        </span>
                        <span>
                          <StatusPill status={py.payment_status || "Success"} />
                        </span>
                      </div>
                    );
                  })}

                  {/* Table Footer Pagination */}
                  <TablePagination
                    total={totalCount}
                    page={payPage}
                    pageSize={payPageSize}
                    onPageChange={(p) => { setLoadingDashboard(true); setPayPage(p); }}
                    onPageSizeChange={(sz) => { setLoadingDashboard(true); setPayPageSize(sz); setPayPage(1); }}
                    label="transactions"
                  />
                </>
              );
            })()}
          </div>

          {/* Departmental & Service Collections Breakdown Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
            {/* Payment Channels Distribution */}
            <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontWeight: 600, fontSize: "13px" }}>Payment Channels Distribution</div>
              <div style={{ color: PALETTE.muted, fontSize: "11px", marginBottom: "10px" }}>
                Live gateway settlements & cash desk receipts
              </div>
              {(() => {
                const modes = (dashboardData?.payment_modes && dashboardData.payment_modes.length > 0)
                  ? dashboardData.payment_modes
                  : [
                      { mode: "UPI (GooglePay / PhonePe)", pct_str: "52%", total_amount: 18000000, color: PALETTE.primary },
                      { mode: "Debit / Credit Cards (POS)", pct_str: "26%", total_amount: 9120000, color: "#2563EB" },
                      { mode: "Direct Bank Transfer / NEFT", pct_str: "14%", total_amount: 4890000, color: "#7C3AED" },
                      { mode: "Counter Cash Collections", pct_str: "8%", total_amount: 2800000, color: PALETTE.success }
                    ];

                return modes.map((m, idx) => {
                  const paletteColors = [PALETTE.primary, "#2563EB", "#7C3AED", PALETTE.success, PALETTE.warning, "#EC4899"];
                  const barColor = m.color || paletteColors[idx % paletteColors.length];
                  const pct = m.pct_str || `${m.percentage || 10}%`;

                  return (
                    <div key={idx} style={{ marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
                        <span>{m.mode}</span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>
                          {inr(m.total_amount)} ({pct})
                        </span>
                      </div>
                      <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: pct, height: "100%", background: barColor }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Revenue by Clinical Specialty */}
            <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontWeight: 600, fontSize: "13px" }}>Revenue by Clinical Specialty</div>
              <div style={{ color: PALETTE.muted, fontSize: "11px", marginBottom: "10px" }}>
                Gross collections MTD from inpatient & outpatient tariffs
              </div>
              {(() => {
                const depts = (dashboardData?.dept_revenue && dashboardData.dept_revenue.length > 0)
                  ? dashboardData.dept_revenue
                  : [
                      { department: "Cardiology & Cath Lab", revenue: 14200000 },
                      { department: "Orthopaedics & Joint Replacement", revenue: 11800000 },
                      { department: "General & Laparoscopic Surgery", revenue: 8840000 },
                      { department: "Medical & Surgical Oncology", revenue: 7420000 },
                      { department: "Emergency & Critical Care ICU", revenue: 5700000 }
                    ];
                const maxRev = Math.max(...depts.map(d => Number(d.revenue || 0))) || 1;

                return depts.slice(0, 5).map((d, idx) => {
                  const barPct = `${Math.round((Number(d.revenue || 0) / maxRev) * 100)}%`;

                  return (
                    <div key={idx} style={{ marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
                        <span>{d.department || d.dept}</span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>{inr(d.revenue || d.amt)}</span>
                      </div>
                      <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: barPct, height: "100%", background: PALETTE.primary }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* AR Aging Analysis Card */}
            <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontWeight: 600, fontSize: "13px" }}>Accounts Receivable (AR) Aging</div>
              <div style={{ color: PALETTE.muted, fontSize: "11px", marginBottom: "10px" }}>
                Outstanding patient & insurance receivables by aging bucket
              </div>
              {(() => {
                const ar = dashboardData?.ar_aging || {};
                const agingBuckets = [
                  { label: "0 – 30 Days (Current)", amt: ar.aging_0_30 || 0, color: PALETTE.success },
                  { label: "31 – 60 Days (Follow-up)", amt: ar.aging_31_60 || 0, color: PALETTE.primary },
                  { label: "61 – 90 Days (Overdue)", amt: ar.aging_61_90 || 0, color: PALETTE.warning },
                  { label: "90+ Days (Critical)", amt: ar.aging_90_plus || 0, color: PALETTE.critical }
                ];
                const totalAr = Number(ar.total_ar_outstanding || agingBuckets.reduce((acc, b) => acc + b.amt, 0)) || 1;

                return agingBuckets.map((b, idx) => {
                  const pct = `${Math.min(100, Math.round((b.amt / totalAr) * 100))}%`;

                  return (
                    <div key={idx} style={{ marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
                        <span>{b.label}</span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>{inr(b.amt)}</span>
                      </div>
                      <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ width: pct, height: "100%", background: b.color }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: TAX CONFIGURATION (Exact Prototype Table) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "tax" && (
        <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", overflow: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(90px, 0.9fr) minmax(210px, 2.1fr) minmax(70px, 0.7fr) minmax(60px, 0.6fr) minmax(60px, 0.6fr) minmax(60px, 0.6fr) minmax(100px, 1fr) minmax(210px, 2.1fr) minmax(100px, 1fr) minmax(70px, 0.7fr) minmax(80px, 0.8fr)",
              gap: "8px",
              padding: "8px 12px",
              color: PALETTE.muted,
              fontSize: "10.5px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              borderBottom: `1px solid ${PALETTE.borderLight}`,
              minWidth: "960px",
              fontWeight: 600
            }}
          >
            <span>Code</span>
            <span>Name</span>
            <span>Type</span>
            <span>CGST</span>
            <span>SGST</span>
            <span>IGST</span>
            <span>HSN / SAC</span>
            <span>Applies to</span>
            <span>Effective</span>
            <span>Inclusive</span>
          </div>

          {/* Loading Indicator */}
          {loadingTax && (
            <div style={{ padding: "16px" }}>
              <ModuleLoadingScreen
                title="Loading GST & Tax Configuration..."
                subtitle="Retrieving central tax master, SAC/HSN codes & healthcare statutory exemptions..."
                badgeText="Live Tax Sync"
                showKpis={false}
                tableRows={8}
                tableColumns={11}
              />
            </div>
          )}

          {!loadingTax && (taxData?.tax_slabs || [
            { category: "Clinical Consultation", hsn: "999312", gst_rate: 0.0, desc: "Exempted under Healthcare Services Notification", status: "Active" },
            { category: "Inpatient Room Charges (< ₹5,000/day)", hsn: "999311", gst_rate: 0.0, desc: "Standard general ward beds exempted", status: "Active" },
            { category: "Inpatient Luxury Room (> ₹5,000/day)", hsn: "999311", gst_rate: 5.0, desc: "GST applicable on non-ICU room rent exceeding ₹5,000", status: "Active" },
            { category: "Diagnostic & Lab Tests", hsn: "999314", gst_rate: 0.0, desc: "Pathology and radiology diagnostics exempted", status: "Active" },
            { category: "Pharmacy Life-Saving Drugs", hsn: "3004", gst_rate: 5.0, desc: "Formulations, insulin, oncological medications", status: "Active" },
            { category: "Pharmacy General Formulations", hsn: "3004", gst_rate: 12.0, desc: "Standard branded formulations and antibiotics", status: "Active" },
            { category: "Dietary & Canteen (Inpatients)", hsn: "996331", gst_rate: 0.0, desc: "Prescribed hospital patient food served in-ward", status: "Active" },
            { category: "Dietary & Canteen (Visitors)", hsn: "996331", gst_rate: 5.0, desc: "Hospital cafeteria services for visitors/attendants", status: "Active" }
          ]).map((t, idx) => {
            const halfRate = (t.gst_rate / 2).toFixed(1) + "%";
            const fullRate = t.gst_rate.toFixed(1) + "%";
            const code = "GST-" + t.hsn;

            return (
              <div
                key={idx}
                onClick={() => openTaxDrawer(t)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(90px, 0.9fr) minmax(210px, 2.1fr) minmax(70px, 0.7fr) minmax(60px, 0.6fr) minmax(60px, 0.6fr) minmax(60px, 0.6fr) minmax(100px, 1fr) minmax(210px, 2.1fr) minmax(100px, 1fr) minmax(70px, 0.7fr) minmax(80px, 0.8fr)",
                  gap: "8px",
                  padding: "7px 12px",
                  borderBottom: `1px solid #f2f3f4`,
                  alignItems: "center",
                  cursor: "pointer",
                  minWidth: "960px",
                  fontSize: "12px"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f7f8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{code}</span>
                <span style={{ fontWeight: 600, color: PALETTE.text }}>{t.category}</span>
                <span style={{ color: PALETTE.text2 }}>GST</span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px" }}>{halfRate}</span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px" }}>{halfRate}</span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px" }}>{fullRate}</span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{t.hsn}</span>
                <span style={{ color: PALETTE.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.desc}
                </span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px", color: PALETTE.muted }}>
                  01 Apr 2026
                </span>
                <span>No</span>
                <span>
                  <StatusPill status="Active" />
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* SLIDE-OUT RIGHT DETAIL DRAWER (Matching Prototype <aside> Exactly) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {drawerData && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerData(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(21, 24, 27, 0.25)",
              zIndex: 998,
              transition: "opacity 0.2s"
            }}
          />

          {/* Slide-out Panel */}
          <aside
            role="dialog"
            aria-label="Detail Drawer"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(560px, 100vw)",
              background: "#fff",
              borderLeft: `1px solid ${PALETTE.border}`,
              zIndex: 999,
              overflowY: "auto",
              padding: "18px 20px 40px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxShadow: "-8px 0 24px rgba(0,0,0,0.08)",
              animation: "slideInRight 0.2s ease-out"
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 600, lineHeight: 1.2, color: PALETTE.text }}>
                  {drawerData.type === "bill" && `${drawerData.data.patient_name || drawerData.data.patient} · ${inr(drawerData.data.net_amount || drawerData.data.total)}`}
                  {drawerData.type === "preauth" && `${drawerData.data.patient} · Inpatient Treatment`}
                  {drawerData.type === "claim" && `Claim ${drawerData.data.claim} · ${drawerData.data.patient}`}
                  {drawerData.type === "tax" && `${drawerData.data.category} · HSN ${drawerData.data.hsn}`}
                </div>
                <div style={{ color: PALETTE.muted, fontSize: "12px", marginTop: "2px" }}>
                  {drawerData.type === "bill" && `${drawerData.data.bill_number} · ${drawerData.data.admission_number || "OPD"}`}
                  {drawerData.type === "preauth" && `${drawerData.data.claim} · ${drawerData.data.tpa} · ${drawerData.data.policy}`}
                  {drawerData.type === "claim" && `${drawerData.data.tpa} · Policy ${drawerData.data.policy}`}
                  {drawerData.type === "tax" && `GST Rule · Standard Hospital Tariff Schedule`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerData(null)}
                aria-label="Close"
                style={{
                  height: "28px",
                  width: "28px",
                  borderRadius: "6px",
                  border: `1px solid ${PALETTE.border}`,
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: PALETTE.text2
                }}
              >
                ✕
              </button>
            </div>

            {/* Badges Row */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <StatusPill
                status={
                  drawerData.type === "bill"
                    ? drawerData.data.bill_status || drawerData.data.status
                    : drawerData.type === "tax"
                    ? "Active"
                    : drawerData.data.status
                }
              />
              {drawerData.type === "preauth" && (
                <StatusPill status={`Denial Risk: ${drawerData.data.risk_level || 'Low Risk'}`} />
              )}
              {drawerData.type === "bill" && drawerData.data.tax_amount > 0 && (
                <StatusPill status="Tax Inclusive" />
              )}
            </div>

            {/* Facts Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "130px minmax(0, 1fr)",
                gap: "6px 12px",
                fontSize: "12.5px",
                background: "#f8fafc",
                padding: "10px 14px",
                borderRadius: "6px"
              }}
            >
              {drawerData.type === "bill" && (
                <>
                  <span style={{ color: PALETTE.muted }}>Estimated:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                    {inr(drawerData.data.gross_amount)}
                  </span>
                  <span style={{ color: PALETTE.muted }}>Actual:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>
                    {inr(drawerData.data.net_amount || drawerData.data.total)}
                  </span>
                  <span style={{ color: PALETTE.muted }}>Variance:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: PALETTE.warning }}>
                    +{inr(Math.max(0, (drawerData.data.net_amount || 0) - (drawerData.data.gross_amount || 0)))} (+12%)
                  </span>
                  <span style={{ color: PALETTE.muted }}>Insurance:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                    {inr(drawerData.data.insurance_amount || drawerData.data.tpa)}
                  </span>
                  <span style={{ color: PALETTE.muted }}>Patient Share:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>
                    {inr(drawerData.data.patient_amount || drawerData.data.patientShare)}
                  </span>
                  <span style={{ color: PALETTE.muted }}>Paid to Date:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: PALETTE.success, fontWeight: 600 }}>
                    {inr(drawerData.data.status === "Settled" || drawerData.data.status === "Paid" 
                      ? (drawerData.data.patient_amount || drawerData.data.patientShare || drawerData.data.net_amount) 
                      : (drawerData.data.paid_amount || 0))}
                  </span>
                  <span style={{ color: PALETTE.muted }}>Balance Due:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: (drawerData.data.status === "Settled" || drawerData.data.status === "Paid") ? PALETTE.muted : PALETTE.critical, fontWeight: 600 }}>
                    {inr(drawerData.data.status === "Settled" || drawerData.data.status === "Paid"
                      ? 0
                      : Math.max(0, (drawerData.data.patient_amount || drawerData.data.patientShare || 0) - (drawerData.data.paid_amount || 0)))}
                  </span>
                </>
              )}

              {drawerData.type === "preauth" && (
                <>
                  <span style={{ color: PALETTE.muted }}>Requested:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{inr(drawerData.data.finalClaimed)}</span>
                  <span style={{ color: PALETTE.muted }}>Approved:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>{inr(drawerData.data.approved)}</span>
                  <span style={{ color: PALETTE.muted }}>Patient Liability:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                    {inr(Math.max(0, drawerData.data.finalClaimed - drawerData.data.approved))}
                  </span>
                  <span style={{ color: PALETTE.muted }}>Completeness:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: PALETTE.success }}>100%</span>
                  <span style={{ color: PALETTE.muted }}>Human Owner:</span>
                  <span>{drawerData.data.owner || (loggedUserName ? `${loggedUserName} (TPA Coordinator)` : "R. Sundar (Insurance Coordinator)")}</span>
                  <span style={{ color: PALETTE.muted }}>Submitted:</span>
                  <span>{drawerData.data.claim_date || "Today"}</span>
                </>
              )}

              {drawerData.type === "claim" && (
                <>
                  <span style={{ color: PALETTE.muted }}>Claim Number:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{drawerData.data.claim}</span>
                  <span style={{ color: PALETTE.muted }}>Claimed Amount:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{inr(drawerData.data.finalClaimed)}</span>
                  <span style={{ color: PALETTE.muted }}>Approved Amount:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}>{inr(drawerData.data.approved)}</span>
                  <span style={{ color: PALETTE.muted }}>Settled / Paid:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: PALETTE.success }}>{inr(drawerData.data.settled)}</span>
                  <span style={{ color: PALETTE.muted }}>Turnaround Time:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{drawerData.data.turnaround}</span>
                </>
              )}

              {drawerData.type === "tax" && (
                <>
                  <span style={{ color: PALETTE.muted }}>CGST / SGST / IGST:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                    {(drawerData.data.gst_rate / 2).toFixed(1)}% / {(drawerData.data.gst_rate / 2).toFixed(1)}% / {drawerData.data.gst_rate.toFixed(1)}%
                  </span>
                  <span style={{ color: PALETTE.muted }}>HSN / SAC Code:</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{drawerData.data.hsn}</span>
                  <span style={{ color: PALETTE.muted }}>Applies To:</span>
                  <span>{drawerData.data.desc}</span>
                  <span style={{ color: PALETTE.muted }}>Effective Date:</span>
                  <span>01 Apr 2026</span>
                  <span style={{ color: PALETTE.muted }}>Statutory Note:</span>
                  <span>Exemption under MoF Healthcare Notification</span>
                </>
              )}
            </div>

            {/* AI Generated Section Box (Matching Prototype's Purple Box) */}
            {(drawerData.type === "bill" || drawerData.type === "preauth") && (
              <div
                style={{
                  border: `1px solid ${PALETTE.aiBorder}`,
                  borderRadius: "8px",
                  padding: "12px",
                  background: PALETTE.aiTint
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: PALETTE.ai }} />
                  <span style={{ fontWeight: 600, fontSize: "12px", color: PALETTE.aiText }}>
                    {drawerData.type === "bill"
                      ? "AI GENERATED · plain-language explanation · Billing Transparency Agent"
                      : "AI GENERATED · Denial-risk indicators · Preauthorisation Assembly Agent"}
                  </span>
                </div>
                <div style={{ lineHeight: 1.5, fontSize: "12.5px", color: PALETTE.text2 }}>
                  {drawerData.type === "bill" ? (
                    drawerData.data.patient_id === 122516 ? (
                      "The bill is ₹23,450 above the estimate: a second balloon was needed before the stent (₹15,950, consumables) and one extra ward night on the doctor's advice (₹7,500). The stent is priced at the government-capped rate. Star Health approved ₹1,95,000; the remaining is under enhancement."
                    ) : (
                      `Charges follow Tariff FY26-27 v1.3. Actual of ${inr(drawerData.data.net_amount || drawerData.data.total)} is aligned with the counselled inpatient package. Approved insurance share of ${inr(drawerData.data.insurance_amount || drawerData.data.tpa)} is reconciled with TPA cashless sanction.`
                    )
                  ) : (
                    "All required clinical documentation (Doctor Referral, Admission Sheet, Diagnostic Reports, ID Card) are collected and verified. Denial risk is scored at 14% (within safe automated boundary < 25%). Submission draft prepared for executive sign-off."
                  )}
                </div>
                <div style={{ marginTop: "6px", fontSize: "11px", color: PALETTE.muted }}>
                  Tariff FY26-27 v1.3 · confidence 95% · the billing executive remains responsible for the final response
                </div>
              </div>
            )}

            {/* Bill Line Items Section */}
            {drawerData.type === "bill" && (
              <div style={{ borderTop: `1px solid ${PALETTE.borderLight}`, paddingTop: "10px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>
                  Line items · estimate → actual
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                  {(drawerData.data.pharmacy_items || []).slice(0, 4).map((pi, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f8fafc" }}>
                      <span>{pi.item_name} ({pi.quantity || 1} units)</span>
                      <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{inr(pi.net_amount)}</span>
                    </div>
                  ))}
                  {(drawerData.data.lab_items || []).slice(0, 3).map((li, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f8fafc" }}>
                      <span>{li.item_name}</span>
                      <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{inr(li.net_amount)}</span>
                    </div>
                  ))}
                  {(!drawerData.data.pharmacy_items?.length && !drawerData.data.lab_items?.length) && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                        <span>Room Rent · Twin Sharing (3 days)</span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>₹18,000 → ₹18,000</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                        <span>Clinical Consultation & Rounds</span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>₹4,500 → ₹4,500</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                        <span>Pharmacy Formulations & IV Infusions</span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>₹12,400 → ₹14,200 · extra antibiotics</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Tax Breakdown Section */}
            {drawerData.type === "bill" && (
              <div style={{ borderTop: `1px solid ${PALETTE.borderLight}`, paddingTop: "10px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>
                  Tax (central configuration · demo rates)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 12px", fontSize: "12px", color: PALETTE.text2 }}>
                  <span>Healthcare Services (SAC 9993)</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: PALETTE.success }}>EXEMPT</span>
                  <span>Pharmacy Formulations GST (5% / 12%)</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{inr(drawerData.data.tax_amount || 320)}</span>
                  <span style={{ fontWeight: 600, color: PALETTE.text }}>Total Tax Collected</span>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600, color: PALETTE.text }}>
                    {inr(drawerData.data.tax_amount || 320)}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons in Drawer (Exact Prototype Actions) */}
            <div style={{ borderTop: `1px solid ${PALETTE.borderLight}`, paddingTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {onSelectPatient && drawerData.type !== "tax" && (drawerData.data.patient_id || drawerData.data.patient) && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectPatient({
                      patient_id: drawerData.data.patient_id,
                      id: drawerData.data.patient_id,
                      patient_code: drawerData.data.uhid || drawerData.data.patient_code || drawerData.data.patient_number,
                      patient_number: drawerData.data.uhid || drawerData.data.patient_code || drawerData.data.patient_number,
                      patient_name: drawerData.data.patient_name || drawerData.data.patient,
                      first_name: (drawerData.data.patient_name || drawerData.data.patient || "").split(" ")[0],
                      last_name: (drawerData.data.patient_name || drawerData.data.patient || "").split(" ").slice(1).join(" "),
                      admission_id: drawerData.data.admission_id
                    });
                    setDrawerData(null);
                  }}
                  style={{
                    height: "34px",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: `1px solid ${PALETTE.border}`,
                    background: "#f0fdf4",
                    color: PALETTE.success,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <span>👤 View Patient 360 Profile</span>
                  <span style={{ fontSize: "12px" }}>→</span>
                </button>
              )}

              {drawerData.type === "bill" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentModal(drawerData.data);
                      setPayAmount(String(drawerData.data.patient_amount || drawerData.data.patientShare || 0));
                    }}
                    style={{
                      height: "34px",
                      padding: "0 12px",
                      borderRadius: "6px",
                      border: "0",
                      background: PALETTE.primary,
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    Record Payment (Co-pay / Settlement)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleIssueGatePass(drawerData.data.bill_id)}
                    style={{
                      height: "34px",
                      padding: "0 12px",
                      borderRadius: "6px",
                      border: `1px solid ${PALETTE.border}`,
                      background: "#fff",
                      color: PALETTE.text,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    Issue Financial Clearance Gate Pass
                  </button>

                  <button
                    type="button"
                    onClick={() => handleResolveBillAdjustment(drawerData.data.bill_id, drawerData.data.patient_amount || drawerData.data.patientShare || 0)}
                    style={{
                      height: "34px",
                      padding: "0 12px",
                      borderRadius: "6px",
                      border: `1px solid ${PALETTE.border}`,
                      background: "#fff",
                      color: PALETTE.text2,
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    Resolve: honour quoted rate (goodwill adjustment)
                  </button>
                </>
              )}

              {drawerData.type === "preauth" && (
                <>
                  {(drawerData.data.status === "Rejected" || drawerData.data.claim_status === "Rejected") ? (
                    <>
                      <div style={{
                        padding: "10px 12px",
                        borderRadius: "6px",
                        background: "#fff1f2",
                        border: "1px solid #fecdd3",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px"
                      }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#be123c", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          Exclusion Reason Cited by Insurer
                        </span>
                        <span style={{ fontSize: "12.5px", color: "#9f1239", fontWeight: 600 }}>
                          {drawerData.data.rejection_reason || "Standard Exclusion Cited"}
                        </span>
                      </div>

                      {isInsuranceDeskExecutive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setAppealDrawerCase(drawerData.data)}
                            style={{
                              height: "36px",
                              padding: "0 14px",
                              borderRadius: "6px",
                              border: "0",
                              background: PALETTE.critical,
                              color: "#fff",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                            }}
                          >
                            <span>⚖️ Prepare AG-20 Reconsideration Appeal to TPA</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePreauthSubmit(drawerData.data.claim_id)}
                            style={{
                              height: "34px",
                              padding: "0 12px",
                              borderRadius: "6px",
                              border: `1px solid ${PALETTE.border}`,
                              background: "#fff",
                              color: PALETTE.text,
                              fontWeight: 500,
                              cursor: "pointer",
                              textAlign: "left"
                            }}
                          >
                            Re-submit updated preauthorisation packet
                          </button>
                        </>
                      ) : (
                        <div style={{
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          fontSize: "11px",
                          color: "#64748b"
                        }}>
                          🔒 Reconsideration appeals and resubmissions are managed by the Insurance & TPA Desk.
                        </div>
                      )}
                    </>
                  ) : !isInsuranceDeskExecutive ? (
                    <div style={{
                      padding: "10px 14px",
                      borderRadius: "6px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px"
                    }}>
                      <span style={{ fontSize: "16px", marginTop: "1px" }}>🔒</span>
                      <div>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                          Underwriting Actions Restricted
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", lineHeight: "1.4" }}>
                          Preauthorisation submission, approval, and rejection are restricted strictly to the <strong>Insurance & TPA Coordinator ({loggedUserName || 'Insurance Desk'})</strong>.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Case 1: ALREADY APPROVED */}
                      {/approved|settled/i.test(drawerData.data.status || '') ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{
                            background: "#f0fdf4",
                            border: "1px solid #86efac",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px"
                          }}>
                            <span style={{ fontSize: "18px", color: "#16a34a", lineHeight: 1 }}>✓</span>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 700, color: "#166534" }}>
                                Preauthorisation Sanctioned & Approved
                              </div>
                              <div style={{ fontSize: "11.5px", color: "#15803d", marginTop: "2px", lineHeight: 1.4 }}>
                                Guarantee of Payment (GOP) active for <strong>{inr(drawerData.data.approved || drawerData.data.requested || drawerData.data.finalClaimed || 0)}</strong>. Patient is cleared for cashless medical care.
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              alert(`Preauthorisation Approval Letter\n\nPatient: ${drawerData.data.patient || drawerData.data.patient_name}\nSanction Amount: ${inr(drawerData.data.approved || drawerData.data.requested)}\nInsurer / TPA: ${drawerData.data.tpa || drawerData.data.insurer}\nPolicy: ${drawerData.data.policy}\nGuarantee of Payment (GOP): ACTIVE`);
                            }}
                            style={{
                              height: "36px",
                              padding: "0 14px",
                              borderRadius: "6px",
                              border: "1px solid #16a34a",
                              background: "#f0fdf4",
                              color: "#166534",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                            }}
                          >
                            📄 View TPA Approval Letter & Guarantee of Payment
                          </button>

                          {/* Re-open / Update Status (Administrative) */}
                          <div style={{ marginTop: "4px", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: `1px solid ${PALETTE.borderLight}` }}>
                            <div style={{ fontSize: "10.5px", fontWeight: 700, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                              Re-open / Update Status (Administrative):
                            </div>
                            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                              {["Submitted · awaiting insurer", "Missing Documents", "Pending Review", "Approved", "Rejected"].map(st => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handlePreauthStatusChange(drawerData.data.claim_id, st)}
                                  style={{
                                    padding: "3px 7px",
                                    fontSize: "10.5px",
                                    fontWeight: drawerData.data.status === st ? 700 : 500,
                                    borderRadius: "4px",
                                    border: drawerData.data.status === st ? "1px solid #2563eb" : `1px solid ${PALETTE.border}`,
                                    background: drawerData.data.status === st ? "#eff6ff" : "#fff",
                                    color: drawerData.data.status === st ? "#1d4ed8" : PALETTE.text,
                                    cursor: "pointer",
                                    transition: "all 0.15s ease"
                                  }}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : /rejected|declined/i.test(drawerData.data.status || '') ? (
                        /* Case 2: REJECTED */
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px"
                          }}>
                            <span style={{ fontSize: "18px", color: "#dc2626", lineHeight: 1 }}>✕</span>
                            <div>
                              <div style={{ fontSize: "13px", fontWeight: 700, color: "#991b1b" }}>
                                Preauthorisation Rejected by Insurer
                              </div>
                              <div style={{ fontSize: "11.5px", color: "#b91c1c", marginTop: "2px", lineHeight: 1.4 }}>
                                Reason: {drawerData.data.rejection_reason || "Adverse policy exclusion / waiting period criteria."}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleClaimAppeal(drawerData.data.claim_id, "Inpatient medical record and diagnostic reports attached for reconsideration.")}
                            style={{
                              height: "36px",
                              padding: "0 14px",
                              borderRadius: "6px",
                              border: "0",
                              background: "#0284c7",
                              color: "#fff",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                            }}
                          >
                            ⚖️ Prepare Reconsideration Appeal Dossier (AG-20)
                          </button>

                          {/* Re-open / Update Status */}
                          <div style={{ marginTop: "4px", background: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: `1px solid ${PALETTE.borderLight}` }}>
                            <div style={{ fontSize: "10.5px", fontWeight: 700, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                              Re-open / Update Status:
                            </div>
                            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                              {["Submitted · awaiting insurer", "Missing Documents", "Pending Review", "Approved", "Rejected"].map(st => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handlePreauthStatusChange(drawerData.data.claim_id, st)}
                                  style={{
                                    padding: "3px 7px",
                                    fontSize: "10.5px",
                                    fontWeight: drawerData.data.status === st ? 700 : 500,
                                    borderRadius: "4px",
                                    border: drawerData.data.status === st ? "1px solid #2563eb" : `1px solid ${PALETTE.border}`,
                                    background: drawerData.data.status === st ? "#eff6ff" : "#fff",
                                    color: drawerData.data.status === st ? "#1d4ed8" : PALETTE.text,
                                    cursor: "pointer",
                                    transition: "all 0.15s ease"
                                  }}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : /submitted|awaiting/i.test(drawerData.data.status || '') ? (
                        /* Case 3: SUBMITTED - AWAITING INSURER */
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            borderRadius: "8px",
                            padding: "10px 14px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "12px",
                            color: "#1d4ed8",
                            fontWeight: 500
                          }}>
                            <span>⏳</span>
                            <span>Packet submitted to TPA portal. Awaiting insurer medical adjudication.</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handlePreauthApprove(drawerData.data.claim_id, drawerData.data.requested || drawerData.data.finalClaimed || 120000)}
                            style={{
                              height: "36px",
                              padding: "0 14px",
                              borderRadius: "6px",
                              border: "0",
                              background: "#059669",
                              color: "#fff",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                            }}
                          >
                            ✓ Sanction & Approve Preauthorisation (Approval Letter Received)
                          </button>

                          <button
                            type="button"
                            onClick={() => setRejectionModalData(drawerData.data)}
                            style={{
                              height: "36px",
                              padding: "0 14px",
                              borderRadius: "6px",
                              border: `1px solid ${PALETTE.critical}`,
                              background: "#fff",
                              color: PALETTE.critical,
                              fontWeight: 500,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                            }}
                          >
                            ✕ Mark preauthorisation rejected / declined
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePreauthStatusChange(drawerData.data.claim_id, "Missing Documents")}
                            style={{
                              height: "32px",
                              padding: "0 12px",
                              borderRadius: "6px",
                              border: `1px solid ${PALETTE.border}`,
                              background: "#fff",
                              color: PALETTE.text2,
                              fontSize: "11.5px",
                              fontWeight: 500,
                              cursor: "pointer"
                            }}
                          >
                            📨 Insurer Query: Request Additional / Missing Documents
                          </button>
                        </div>
                      ) : (
                        /* Case 4: PENDING / MISSING DOCUMENTS / PENDING REVIEW */
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <button
                            type="button"
                            onClick={() => handlePreauthSubmit(drawerData.data.claim_id)}
                            style={{
                              height: "36px",
                              padding: "0 14px",
                              borderRadius: "6px",
                              border: "0",
                              background: PALETTE.primary,
                              color: "#fff",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                            }}
                          >
                            🚀 Submit Preauthorisation Packet to TPA Portal
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePreauthApprove(drawerData.data.claim_id, drawerData.data.requested || drawerData.data.finalClaimed || 120000)}
                            style={{
                              height: "36px",
                              padding: "0 14px",
                              borderRadius: "6px",
                              border: "0",
                              background: "#059669",
                              color: "#fff",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                            }}
                          >
                            ✓ Sanction & Approve Preauthorisation
                          </button>

                          <button
                            type="button"
                            onClick={() => setRejectionModalData(drawerData.data)}
                            style={{
                              height: "36px",
                              padding: "0 14px",
                              borderRadius: "6px",
                              border: `1px solid ${PALETTE.critical}`,
                              background: "#fff",
                              color: PALETTE.critical,
                              fontWeight: 500,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                            }}
                          >
                            ✕ Mark preauthorisation rejected / declined
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {drawerData.type === "claim" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleClaimSettle(drawerData.data.claim_id)}
                    style={{
                      height: "34px",
                      padding: "0 12px",
                      borderRadius: "6px",
                      border: "0",
                      background: PALETTE.primary,
                      color: "#fff",
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    TPA Outcome: Approve & Settle Cashless
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClaimAppeal(drawerData.data.claim_id, "Discharge summary and inpatient bills attached for review")}
                    style={{
                      height: "34px",
                      padding: "0 12px",
                      borderRadius: "6px",
                      border: `1px solid ${PALETTE.border}`,
                      background: "#fff",
                      color: PALETTE.critical,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left"
                    }}
                  >
                    Appeal Disallowance / Re-submit Claim
                  </button>
                </>
              )}

              {drawerData.type === "tax" && (
                <button
                  type="button"
                  onClick={() => handleTaxUpdate(drawerData.data)}
                  style={{
                    height: "34px",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: "0",
                    background: PALETTE.primary,
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  Save & Update Tariff Tax Rule
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* RECORD PAYMENT MODAL */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {paymentModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(21, 24, 27, 0.4)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "10px",
              width: "min(460px, 100%)",
              padding: "20px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>Record Payment against {paymentModal.bill_number || paymentModal.inv}</div>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitRecordPayment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: PALETTE.muted, textTransform: "uppercase" }}>
                  Patient
                </label>
                <div style={{ fontSize: "14px", fontWeight: 600, color: PALETTE.text, marginTop: "2px" }}>
                  {paymentModal.patient}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: PALETTE.muted, textTransform: "uppercase" }}>
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    height: "34px",
                    border: `1px solid ${PALETTE.border}`,
                    borderRadius: "6px",
                    padding: "0 10px",
                    fontSize: "14px",
                    marginTop: "4px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: PALETTE.muted, textTransform: "uppercase" }}>
                  Payment Method
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  style={{
                    width: "100%",
                    height: "34px",
                    border: `1px solid ${PALETTE.border}`,
                    borderRadius: "6px",
                    padding: "0 8px",
                    background: "#fff",
                    fontSize: "13px",
                    marginTop: "4px",
                    boxSizing: "border-box"
                  }}
                >
                  <option value="UPI">UPI (QR / Instant Settlement)</option>
                  <option value="CARD">Credit / Debit Card (POS)</option>
                  <option value="NETBANKING">Net Banking / NEFT</option>
                  <option value="CASH">Cash at Cashier Desk</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setPaymentModal(null)}
                  style={{
                    height: "32px",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: `1px solid ${PALETTE.border}`,
                    background: "#fff",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  style={{
                    height: "32px",
                    padding: "0 14px",
                    borderRadius: "6px",
                    border: "0",
                    background: PALETTE.primary,
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {paySubmitting ? "Processing…" : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* GATE PASS MODAL (Official Clearance Verification) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {gatePassModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(21, 24, 27, 0.4)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "10px",
              width: "min(440px, 100%)",
              padding: "24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              textAlign: "center"
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: PALETTE.successTint,
                color: PALETTE.success,
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto"
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: PALETTE.text }}>Financial Clearance Gate Pass</div>
            <div style={{ fontSize: "12px", color: PALETTE.muted }}>{gatePassModal.message}</div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: "8px",
                padding: "14px",
                margin: "8px 0"
              }}
            >
              <div style={{ fontSize: "10.5px", textTransform: "uppercase", color: PALETTE.muted }}>Gate Pass Code</div>
              <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "20px", fontWeight: 700, color: PALETTE.primary }}>
                {gatePassModal.gate_pass_code}
              </div>
              <div style={{ fontSize: "12px", marginTop: "4px", color: PALETTE.text2 }}>
                Patient: <strong>{gatePassModal.patient}</strong> · {gatePassModal.uhid}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setGatePassModal(null)}
              style={{
                height: "34px",
                borderRadius: "6px",
                border: "0",
                background: "#15181b",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Close & Handover to Discharge Desk
            </button>
          </div>
        </div>
      )}

      {/* AG-08 Embedded Billing Transparency Agent Drawer */}
      <BillingTransparencyDrawer
        isOpen={ag08DrawerOpen}
        onClose={() => setAg08DrawerOpen(false)}
        patientId={ag08PatientId}
        onApproved={() => loadBills(true)}
      />

      {/* ABDM / NRCeS & IRDAI Claim Exclusion Reason Modal */}
      {rejectionModalData && (
        <ClaimExclusionModal
          isOpen={!!rejectionModalData}
          onClose={() => setRejectionModalData(null)}
          claimData={rejectionModalData}
          onConfirm={async (exclusionPayload) => {
            await handlePreauthReject(exclusionPayload.claim_id, exclusionPayload.full_reason, exclusionPayload);
          }}
        />
      )}

      {/* AG-20 Slide-over Claim Appeal Dossier Drawer */}
      {appealDrawerCase && (
        <ClaimAppealDrawer
          isOpen={!!appealDrawerCase}
          onClose={() => {
            setAppealDrawerCase(null);
            loadPreauths(true);
            loadClaims(true);
          }}
          claimIdentifier={appealDrawerCase?.claim_id || appealDrawerCase?.claim || appealDrawerCase?.claim_number}
          patientData={appealDrawerCase}
          onAppealSubmitted={() => {
            setAppealDrawerCase(null);
            loadPreauths(true);
            loadClaims(true);
          }}
        />
      )}
    </div>
  );
}

export default FinancialRevenueView;
