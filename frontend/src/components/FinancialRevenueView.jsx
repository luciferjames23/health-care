import React, { useState, useEffect, useMemo, useCallback } from "react";
import { financialApi } from "../services/financialApi";
import ModuleLoadingScreen, { TableSkeleton } from "./ModuleLoadingScreen";

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
  } else if (/disputed|rejected|high denial|critical|failed|voided/i.test(lower)) {
    bg = PALETTE.criticalTint;
    fg = PALETTE.critical;
  } else if (/pending|awaiting|query|missing|provisional|part-paid|partially|under review/i.test(lower)) {
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
export function FinancialRevenueView({ initialTab = "billing", onOpenDrawer, onOpenModal }) {
  // Active view matches the selected Revenue cycle sub-module from sidebar
  const activeTab = initialTab || "billing";

  // Global search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Reset filter and search when activeTab changes
  useEffect(() => {
    setActiveFilter("All");
    setSearchQuery("");
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

  // Insurance & Claims State
  const [claims, setClaims] = useState([]);
  const [claimTotal, setClaimTotal] = useState(0);
  const [claimPage, setClaimPage] = useState(1);
  const [claimPageSize, setClaimPageSize] = useState(15);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claimsAnalytics, setClaimsAnalytics] = useState(null);
  const [claimsViewMode, setClaimsViewMode] = useState("kanban"); // 'table' | 'kanban'

  // Finance Dashboard State
  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

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
    try {
      if (!silent) setLoadingBills(true);
      const res = await financialApi.getBills({
        page: billPage,
        pageSize: billPageSize,
        status: activeFilter === "All" ? undefined : activeFilter,
        search: searchQuery.trim() || undefined
      });
      if (res && res.success) {
        setBills(res.items || []);
        setBillTotal(res.total || 0);
      }
    } catch (e) {
      console.error("Bills error:", e);
    } finally {
      if (!silent) setLoadingBills(false);
    }
  }, [billPage, billPageSize, activeFilter, searchQuery]);

  const loadClaims = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingClaims(true);
      const [cRes, aRes] = await Promise.all([
        financialApi.getInsuranceClaims({
          page: claimPage,
          pageSize: claimPageSize,
          status: activeFilter === "All" ? undefined : activeFilter,
          search: searchQuery.trim() || undefined
        }),
        financialApi.getClaimsAnalytics()
      ]);
      if (cRes && cRes.success) {
        setClaims(cRes.items || []);
        setClaimTotal(cRes.total || 0);
      }
      if (aRes && aRes.success) {
        setClaimsAnalytics(aRes);
      }
    } catch (e) {
      console.error("Claims error:", e);
    } finally {
      if (!silent) setLoadingClaims(false);
    }
  }, [claimPage, claimPageSize, activeFilter, searchQuery]);

  const loadDashboard = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingDashboard(true);
      const res = await financialApi.getFinanceDashboard();
      if (res && res.success) setDashboardData(res);
    } catch (e) {
      console.error("Dashboard error:", e);
    } finally {
      if (!silent) setLoadingDashboard(false);
    }
  }, []);

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
    // Initial fetch on tab change
    if (activeTab === "billing") loadBills(bills.length > 0);
    else if (activeTab === "insurance" || activeTab === "claims") loadClaims(claims.length > 0);
    else if (activeTab === "finance") loadDashboard(!!dashboardData);
    else if (activeTab === "tax") loadTax(!!taxData);

    const refreshSilently = () => {
      loadOverview(true);
      if (activeTab === "billing") loadBills(true);
      else if (activeTab === "insurance" || activeTab === "claims") loadClaims(true);
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
  }, [activeTab, loadOverview, loadBills, loadClaims, loadDashboard, loadTax]);

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
    return [
      { k: "Pending", v: "4", col: "", filter: "Pending" },
      { k: "Awaiting insurer", v: "4", col: "", filter: "Submitted · awaiting insurer" },
      { k: "Missing documents", v: "5", col: "", filter: "Missing Documents" },
      { k: "High denial risk", v: "6", col: PALETTE.critical, filter: "High Denial Risk" },
      { k: "Approved", v: "9", col: PALETTE.success, filter: "Approved" },
      { k: "Rejected", v: "3", col: PALETTE.critical, filter: "Rejected" }
    ];
  }, []);

  const claimsStats = useMemo(() => {
    return [
      { k: "Submitted", v: "3", col: "", filter: "Submitted" },
      { k: "Under review / query", v: "1", col: PALETTE.warning, filter: "Under Review" },
      { k: "Rejected", v: "1", col: PALETTE.critical, filter: "Rejected" },
      { k: "Settled", v: "1", col: PALETTE.success, filter: "Settled" },
      { k: "Insurance outstanding", v: "₹15,30,039", col: "", filter: "All" },
      { k: "Avg settlement", v: "11 days", col: "", filter: "All" }
    ];
  }, []);

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

  // Static rich preauth items matching Screenshot 1
  const preauthRows = useMemo(() => {
    const defaultPreauths = [
      { claim_id: "PA-1", claim: "PA-2026-1142", patient: "Kavitha Raman", tpa: "Star Health", procedure: "PTCA + DES", requested: 268450, approved: 268450, completeness: 70, risk: "9%", age: "6 d 9 h", owner: "R. Sundar", status: "Approved" },
      { claim_id: "PA-2", claim: "PA-2026-1098", patient: "Murugan Selvam", tpa: "ICICI Lombard", procedure: "CABG", requested: 420000, approved: 365000, completeness: 76, risk: "18%", age: "7 d 8 h", owner: "R. Sundar", status: "Partially Approved" },
      { claim_id: "PA-3", claim: "PA-2026-1120", patient: "Fathima Begum", tpa: "HDFC Ergo", procedure: "Total hip replacement", requested: 310000, approved: 290000, completeness: 100, risk: "4%", age: "10 d 8 h", owner: "L. Fathima", status: "Approved" },
      { claim_id: "PA-4", claim: "PA-2026-1131", patient: "Lakshmi Narayanan", tpa: "Aditya Birla Health", procedure: "AV fistula", requested: 85000, approved: 0, completeness: 100, risk: "12%", age: "13 d 8 h", owner: "L. Fathima", status: "Pending" },
      { claim_id: "PA-5", claim: "PA-2026-1139", patient: "Arun Prakash", tpa: "Bajaj Allianz", procedure: "ACL reconstruction", requested: 195000, approved: 195000, completeness: 100, risk: "3%", age: "8 d 8 h", owner: "R. Sundar", status: "Approved" },
      { claim_id: "PA-6", claim: "PA-2026-1136", patient: "Meenakshi Sundaram", tpa: "Star Health", procedure: "Chemotherapy cycle 4", requested: 112000, approved: 112000, completeness: 100, risk: "2%", age: "9 d 8 h", owner: "L. Fathima", status: "Approved" },
      { claim_id: "PA-7", claim: "PA-2026-1104", patient: "Joseph Antony", tpa: "Niva Bupa", procedure: "Stroke management", requested: 295000, approved: 260000, completeness: 63, risk: "22%", age: "7 d 8 h", owner: "R. Sundar", status: "Additional Documents" },
      { claim_id: "PA-8", claim: "PA-2026-1140", patient: "Priyanka Das", tpa: "Care Health", procedure: "LSCS", requested: 95000, approved: 95000, completeness: 100, risk: "2%", age: "7 d 8 h", owner: "L. Fathima", status: "Approved" },
      { claim_id: "PA-9", claim: "PA-2026-1145", patient: "Karthikeyan M", tpa: "Star Health", procedure: "URSL", requested: 78000, approved: 0, completeness: 78, risk: "31%", age: "6 d 7 h", owner: "Unassigned", status: "Missing Documents" }
    ];

    if (!activeFilter || activeFilter === "All") return defaultPreauths;
    const fLower = activeFilter.toLowerCase();
    return defaultPreauths.filter(p => {
      if (fLower.includes("pending")) return /pending/i.test(p.status);
      if (fLower.includes("awaiting")) return /awaiting|submitted/i.test(p.status);
      if (fLower.includes("query")) return /query/i.test(p.status);
      if (fLower.includes("missing")) return /missing/i.test(p.status);
      if (fLower.includes("additional")) return /additional/i.test(p.status);
      if (fLower.includes("denial")) return parseInt(p.risk, 10) >= 20;
      if (fLower.includes("approved")) return /approved/i.test(p.status);
      if (fLower.includes("rejected")) return /rejected/i.test(p.status);
      return true;
    });
  }, [activeFilter]);

  // Kanban items matching Screenshot 2
  const kanbanColumns = useMemo(() => {
    const claimReadyCards = [
      { id: "— (not yet)", patient: "Kavitha Raman", amount: "₹2,68,450" },
      { id: "— (not yet)", patient: "Murugan Selvam", amount: "₹3,65,000" },
      { id: "— (not yet)", patient: "Fathima Begum", amount: "₹2,90,000" },
      { id: "— (not yet)", patient: "Arun Prakash", amount: "₹1,95,000" },
      { id: "— (not yet)", patient: "Meenakshi Sundaram", amount: "₹1,12,000" },
      { id: "— (not yet)", patient: "Joseph Antony", amount: "₹2,60,000" },
      { id: "— (not yet)", patient: "Priyanka Das", amount: "₹95,000" },
      { id: "— (not yet)", patient: "Lakshmi Narayanan", amount: "₹85,000" },
      { id: "— (not yet)", patient: "Karthikeyan M", amount: "₹78,000" },
      { id: "— (not yet)", patient: "Venkatesan P", amount: "₹1,45,000" }
    ];

    const settledCards = [
      { id: "CLM-2026-5109", patient: "Rebecca Thomas", amount: "₹58,000", status: "Settled" }
    ];

    const underReviewCards = [
      { id: "CLM-2026-5118", patient: "Rebecca Thomas", amount: "₹2,84,000", status: "Under Review" }
    ];

    const rejectedCards = [
      { id: "CLM-2026-5121", patient: "Hari Mani", amount: "—", status: "Rejected" }
    ];

    return [
      { key: "Claim Ready", label: "Claim Ready", count: claimReadyCards.length, bg: "#f3f4f6", textCol: "#52585e", badgeBg: "#e5e7eb", badgeCol: "#374151", items: claimReadyCards },
      { key: "Settled", label: "Settled", count: settledCards.length, bg: "#f0fdf4", textCol: PALETTE.success, badgeBg: PALETTE.successTint, badgeCol: PALETTE.success, items: settledCards },
      { key: "Under Review", label: "Under Review", count: underReviewCards.length, bg: "#fffbeb", textCol: PALETTE.warning, badgeBg: PALETTE.warningTint, badgeCol: PALETTE.warning, items: underReviewCards },
      { key: "Rejected", label: "Rejected", count: rejectedCards.length, bg: "#fef2f2", textCol: PALETTE.critical, badgeBg: PALETTE.criticalTint, badgeCol: PALETTE.critical, items: rejectedCards }
    ];
  }, []);

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
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            style={{
              height: "30px",
              width: "220px",
              border: `1px solid ${PALETTE.border}`,
              borderRadius: "6px",
              padding: "0 10px",
              background: "#fff",
              outline: "none",
              fontSize: "12px"
            }}
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
        {(activeTab === "billing"
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
        ))}
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
            ? ["All", "Pending", "Submitted · awaiting insurer", "Query Raised", "Missing Documents", "Additional Documents", "High Denial Risk", "Approved", "Rejected"]
            : activeTab === "claims"
            ? ["All", "Claim Ready", "Submitted", "Under Review", "Query Raised", "Approved", "Partially Approved", "Rejected", "Settled"]
            : ["All", "Success", "Pending", "Failed"]
          ).map((filterLabel) => {
            const active = activeFilter === filterLabel;
            return (
              <button
                key={filterLabel}
                type="button"
                onClick={() => setActiveFilter(filterLabel)}
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
      {/* TAB 1: BILLING VIEW (Exact Prototype Table) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "billing" && (
        <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", overflow: "auto" }}>
          {/* Table Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(90px, 0.9fr) minmax(160px, 1.6fr) minmax(110px, 1.1fr) minmax(95px, 0.95fr) minmax(95px, 0.95fr) minmax(85px, 0.85fr) minmax(95px, 0.95fr) minmax(95px, 0.95fr) minmax(100px, 1fr)",
              gap: "8px",
              padding: "8px 12px",
              color: PALETTE.muted,
              fontSize: "10.5px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              borderBottom: `1px solid ${PALETTE.borderLight}`,
              minWidth: "760px",
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
          </div>

          {/* Loading Indicator */}
          {loadingBills && bills.length === 0 && (
            <div style={{ padding: "12px" }}>
              <TableSkeleton rows={6} columns={7} />
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
          {bills.map((b) => {
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
                  gridTemplateColumns: "minmax(90px, 0.9fr) minmax(160px, 1.6fr) minmax(110px, 1.1fr) minmax(95px, 0.95fr) minmax(95px, 0.95fr) minmax(85px, 0.85fr) minmax(95px, 0.95fr) minmax(95px, 0.95fr) minmax(100px, 1fr)",
                  gap: "8px",
                  padding: "7px 12px",
                  borderBottom: `1px solid #f2f3f4`,
                  alignItems: "center",
                  cursor: "pointer",
                  minWidth: "760px",
                  fontSize: "12px"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f7f8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{b.inv}</span>
                <span style={{ fontWeight: 600, color: PALETTE.text }}>{b.patient}</span>
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
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{inr(b.patientShare)}</span>
                <span>
                  <StatusPill status={isDisputed ? "Disputed" : b.status} />
                </span>
              </div>
            );
          })}

          {/* Table Footer Pagination */}
          <div
            style={{
              padding: "8px 12px",
              color: PALETTE.muted,
              fontSize: "11px",
              borderTop: `1px solid ${PALETTE.borderLight}`,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap"
            }}
          >
            <span>
              Showing {bills.length} of {billTotal.toLocaleString()} bills · click a row for detailed breakdown and AI explanation
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
              <span>Rows</span>
              {[15, 30, 50].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setBillPageSize(sz)}
                  style={{
                    height: "22px",
                    padding: "0 7px",
                    borderRadius: "4px",
                    border: `1px solid ${PALETTE.border}`,
                    background: billPageSize === sz ? "#15181b" : "#fff",
                    color: billPageSize === sz ? "#fff" : PALETTE.text2,
                    cursor: "pointer",
                    fontSize: "11px"
                  }}
                >
                  {sz}
                </button>
              ))}
              <button
                type="button"
                disabled={billPage <= 1}
                onClick={() => setBillPage((p) => Math.max(1, p - 1))}
                style={{
                  height: "22px",
                  padding: "0 8px",
                  borderRadius: "4px",
                  border: `1px solid ${PALETTE.border}`,
                  background: "#fff",
                  cursor: billPage <= 1 ? "default" : "pointer",
                  fontSize: "11px",
                  opacity: billPage <= 1 ? 0.5 : 1
                }}
              >
                ‹ Prev
              </button>
              <button
                type="button"
                disabled={billPage * billPageSize >= billTotal}
                onClick={() => setBillPage((p) => p + 1)}
                style={{
                  height: "22px",
                  padding: "0 8px",
                  borderRadius: "4px",
                  border: `1px solid ${PALETTE.border}`,
                  background: "#fff",
                  cursor: billPage * billPageSize >= billTotal ? "default" : "pointer",
                  fontSize: "11px",
                  opacity: billPage * billPageSize >= billTotal ? 0.5 : 1
                }}
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: INSURANCE & PREAUTH VIEW (Exact Match to Screenshot 1) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "insurance" && (
        <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", overflow: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(90px, 0.9fr) minmax(140px, 1.4fr) minmax(130px, 1.3fr) minmax(150px, 1.5fr) minmax(90px, 0.9fr) minmax(90px, 0.9fr) minmax(95px, 0.95fr) minmax(80px, 0.8fr) minmax(75px, 0.75fr) minmax(95px, 0.95fr) minmax(140px, 1.4fr)",
              gap: "8px",
              padding: "8px 12px",
              color: PALETTE.muted,
              fontSize: "10.5px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              borderBottom: `1px solid ${PALETTE.borderLight}`,
              minWidth: "880px",
              fontWeight: 600
            }}
          >
            <span>Case</span>
            <span>Patient</span>
            <span>Insurer</span>
            <span>Procedure</span>
            <span>Requested</span>
            <span>Approved</span>
            <span>Completeness</span>
            <span>Denial risk</span>
            <span>Age</span>
            <span>Owner</span>
            <span>Status</span>
          </div>

          {preauthRows.map((p, idx) => {
            const riskNum = parseInt(p.risk, 10) || 0;
            const riskHigh = riskNum >= 25;

            return (
              <div
                key={p.claim_id || idx}
                onClick={() => openPreauthDrawer(p)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(90px, 0.9fr) minmax(140px, 1.4fr) minmax(130px, 1.3fr) minmax(150px, 1.5fr) minmax(90px, 0.9fr) minmax(90px, 0.9fr) minmax(95px, 0.95fr) minmax(80px, 0.8fr) minmax(75px, 0.75fr) minmax(95px, 0.95fr) minmax(140px, 1.4fr)",
                  gap: "8px",
                  padding: "7px 12px",
                  borderBottom: `1px solid #f2f3f4`,
                  alignItems: "center",
                  cursor: "pointer",
                  minWidth: "880px",
                  fontSize: "12px"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f7f8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{p.claim}</span>
                <span style={{ fontWeight: 600, color: PALETTE.text }}>{p.patient}</span>
                <span style={{ color: PALETTE.text2 }}>{p.tpa}</span>
                <span>{p.procedure}</span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{inr(p.requested)}</span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px", fontWeight: 600 }}>
                  {p.approved > 0 ? inr(p.approved) : "—"}
                </span>
                <span
                  style={{
                    fontFamily: "ui-monospace, Menlo, monospace",
                    fontSize: "11.5px",
                    color: p.completeness < 100 ? PALETTE.warning : PALETTE.success
                  }}
                >
                  {p.completeness}%
                </span>
                <span
                  style={{
                    fontFamily: "ui-monospace, Menlo, monospace",
                    fontSize: "11.5px",
                    color: riskHigh ? PALETTE.critical : PALETTE.text2
                  }}
                >
                  {p.risk}
                </span>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11px", color: PALETTE.muted }}>
                  {p.age || "6 d 9 h"}
                </span>
                <span style={{ color: PALETTE.text2 }}>{p.owner || "L. Fathima"}</span>
                <span>
                  <StatusPill status={p.status} />
                </span>
              </div>
            );
          })}

          <div
            style={{
              padding: "8px 12px",
              color: PALETTE.muted,
              fontSize: "11px",
              borderTop: `1px solid ${PALETTE.borderLight}`,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap"
            }}
          >
            <span>Showing {preauthRows.length} preauthorisation cases · click a row to view audit & documents</span>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: CLAIMS VIEW (Kanban & Table Views - Exact Match to Screenshot 2) */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {activeTab === "claims" && (
        <>
          {claimsViewMode === "kanban" ? (
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
                      if (activeFilter === "Claim Ready") return col.key === "Claim Ready";
                      if (activeFilter === "Settled") return col.key === "Settled";
                      if (activeFilter === "Under Review") return col.key === "Under Review";
                      if (activeFilter === "Rejected") return col.key === "Rejected";
                      return true;
                    });

                return (
                  <div
                    key={col.key}
                    style={{
                      background: "#fbfbfc",
                      border: `1px solid ${PALETTE.border}`,
                      borderRadius: "8px",
                      padding: "12px",
                      minHeight: "450px"
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {filteredItems.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => openClaimDrawer({ claim: item.id, patient: item.patient, status: col.key, finalClaimed: item.amount })}
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
                              fontFamily: "ui-monospace, Menlo, monospace",
                              fontSize: "11.5px",
                              color: item.id === "— (not yet)" ? PALETTE.muted : col.badgeCol,
                              fontWeight: item.id === "— (not yet)" ? 400 : 600,
                              marginBottom: "4px"
                            }}
                          >
                            {item.id}
                          </div>
                          <div style={{ fontSize: "12.5px", fontWeight: 600, color: PALETTE.text, marginBottom: "4px" }}>
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
                  </div>
                );
              })}
            </div>
          ) : (
            /* CLAIMS TABLE VIEW */
            <div style={{ background: "#fff", border: `1px solid ${PALETTE.border}`, borderRadius: "8px", overflow: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(110px, 1.1fr) minmax(150px, 1.5fr) minmax(160px, 1.6fr) minmax(110px, 1.1fr) minmax(90px, 0.9fr) minmax(90px, 0.9fr) minmax(90px, 0.9fr) minmax(90px, 0.9fr) minmax(120px, 1.2fr) minmax(130px, 1.3fr)",
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
                    gridTemplateColumns: "minmax(110px, 1.1fr) minmax(150px, 1.5fr) minmax(160px, 1.6fr) minmax(110px, 1.1fr) minmax(90px, 0.9fr) minmax(90px, 0.9fr) minmax(90px, 0.9fr) minmax(90px, 0.9fr) minmax(120px, 1.2fr) minmax(130px, 1.3fr)",
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
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "11.5px" }}>{cl.claim}</span>
                  <span style={{ fontWeight: 600, color: PALETTE.text }}>{cl.patient}</span>
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
          )}
        </>
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
              <div style={{ padding: "12px" }}>
                <TableSkeleton rows={5} columns={6} />
              </div>
            )}

            {!loadingDashboard && (() => {
              const paymentList = (dashboardData?.recent_payments && dashboardData.recent_payments.length > 0)
                ? dashboardData.recent_payments
                : bills.slice(0, 15).map(b => ({
                    payment_id: b.bill_id,
                    patient_name: b.patient,
                    bill_number: b.inv,
                    amount: b.paid_amount || b.patientShare || b.total,
                    payment_method: "UPI",
                    payment_date: b.bill_date,
                    payment_status: "SUCCESS"
                  }));

              return paymentList.map((py, i) => {
                const amt = py.amount || 0;
                const payRef = py.payment_reference ? `PAY-${String(py.payment_reference).slice(-6)}` : `PAY-${String(py.payment_id || i + 101).slice(-5)}`;
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
                    <span style={{ fontWeight: 600, color: PALETTE.text }}>{py.patient_name || "Patient"}</span>
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
              });
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
            <span>Status</span>
          </div>

          {(taxData?.tax_slabs || [
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
              {drawerData.type === "preauth" && <StatusPill status="Denial risk 14%" />}
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
                  <span>L. Fathima (Insurance Supervisor)</span>
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
                    onClick={() => handleClearBillDirect(drawerData.data.bill_id, drawerData.data.patient_amount)}
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
                  <button
                    type="button"
                    onClick={() => alert("Preauthorisation package submitted to TPA portal!")}
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
                    Submit preauthorisation packet to insurer
                  </button>

                  <button
                    type="button"
                    onClick={() => alert("Simulated insurer sanction received: Approved for ₹" + (drawerData.data.finalClaimed || 120000))}
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
                    Simulate insurer settlement outcome
                  </button>
                </>
              )}

              {drawerData.type === "claim" && (
                <>
                  <button
                    type="button"
                    onClick={() => alert("Claim marked approved and settlement registered in General Ledger.")}
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
                    onClick={() => alert("Formal appeal package generated with clinical discharge summary attachments.")}
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
                  onClick={() => {
                    alert("Tax rule updated and logged in Audit Trail.");
                    setDrawerData(null);
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
                  Save / Re-affirm Tax Exemption Rule
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
    </div>
  );
}

export default FinancialRevenueView;
