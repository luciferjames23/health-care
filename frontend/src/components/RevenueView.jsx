import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Filter, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Eye, 
  Calendar,
  Building2,
  X
} from 'lucide-react';
import { apiService } from '../services/api';

export default function RevenueView() {
  const [dataResult, setDataResult] = useState(null);
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [departmentName, setDepartmentName] = useState('');
  const [billStatus, setBillStatus] = useState('');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Selected item modal
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    loadData();
  }, [departmentName, billStatus, limit, offset]);

  async function loadSummary() {
    try {
      const summary = await apiService.getRevenuePredictionsSummary();
      setSummaryMetrics(summary);
    } catch (err) {
      console.error("Failed to load revenue summary", err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const params = {
        limit,
        offset
      };
      if (departmentName) params.department_name = departmentName;
      if (billStatus) params.bill_status = billStatus;

      const res = await apiService.getRevenuePredictions(params);
      setDataResult(res);
    } catch (err) {
      console.error("Failed to load revenue predictions data", err);
    } finally {
      setLoading(false);
    }
  }

  const handleRecordClick = async (rec) => {
    const recId = rec.prediction_id || rec.revenue_prediction_id || rec.bill_number;
    setModalLoading(true);
    try {
      const fullDetail = await apiService.getRevenuePredictionById(recId);
      setSelectedRecord(fullDetail);
    } catch (err) {
      setSelectedRecord(rec);
    } finally {
      setModalLoading(false);
    }
  };

  const rows = dataResult?.data || [];
  const totalRows = dataResult?.total_rows || rows.length;
  const totalPages = Math.ceil(totalRows / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  const departments = [
    "All Departments", "General Medicine", "Cardiology", "Orthopedics", 
    "Pediatrics", "Neurology", "Gynecology", "Surgery", "Emergency"
  ];

  const totalGross = summaryMetrics?.total_gross || 1930750;
  const totalNet = summaryMetrics?.total_net || 1930750;
  const totalCollected = summaryMetrics?.total_collected || 1930750;
  const totalBills = summaryMetrics?.total_bills || 1000;

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Revenue Cycle Analytics & Live Bills Ledger
          </h2>
          <p className="text-xs text-slate-400">
            Real-time financial transactions, invoices, and billing telemetry from <span className="text-cyan-300 font-mono">public.bills &amp; public.payments</span>.
          </p>
        </div>

        <button
          onClick={() => { loadSummary(); loadData(); }}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh API</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Gross Invoiced</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold font-mono text-emerald-400">
              ₹{Number(totalGross).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Recorded across {totalBills.toLocaleString()} bills
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Actual Net Revenue</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold font-mono text-cyan-300">
              ₹{Number(totalNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Net receivable after discounts
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Payments Collected</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold font-mono text-purple-300">
              ₹{Number(totalCollected).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Cleared through payment gateway
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Prediction Engine</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold text-white">
              REV-PROJ-v2.4
            </div>
            <p className="text-[11px] text-amber-300 mt-1 font-mono">
              Delta Lake Gold Schema
            </p>
          </div>
        </div>

      </div>

      {/* Filter Bar */}
      <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <label className="text-xs text-slate-400 font-semibold">Department:</label>
            <select
              value={departmentName}
              onChange={(e) => {
                setDepartmentName(e.target.value === "All Departments" ? "" : e.target.value);
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-400 font-semibold">Status:</label>
            <select
              value={billStatus}
              onChange={(e) => {
                setBillStatus(e.target.value);
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="Settled">Settled</option>
              <option value="Pending">Pending</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

        </div>

        {/* Pagination Controls */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
          <span className="text-xs text-slate-400 font-mono">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= totalRows}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table Grid */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center space-y-3">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <span className="text-xs font-mono">Loading revenue predictions from backend API...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-mono">
            No revenue predictions found matching the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Prediction ID</th>
                  <th className="py-3 px-4">Department / Facility</th>
                  <th className="py-3 px-4">Target Period</th>
                  <th className="py-3 px-4 text-right">Predicted Rev</th>
                  <th className="py-3 px-4 text-right">Actual Net</th>
                  <th className="py-3 px-4 text-center">Accuracy / Growth</th>
                  <th className="py-3 px-4 text-center">Risk Level</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {rows.map((row, idx) => {
                  const predId = row.prediction_id || row.revenue_prediction_id || `REV-${idx+1}`;
                  const dept = row.department || row.department_name || "General";
                  const facility = row.facility_name || "St. Aloysius Hospital";
                  const target = row.target_period || row.prediction_date || "2026-Q1";
                  const predAmt = row.predicted_revenue ?? row.predicted_amount ?? 0;
                  const actAmt = row.actual_revenue ?? row.actual_net_amount ?? null;
                  const accuracy = row.accuracy_pct ? `${row.accuracy_pct}%` : "Pending";
                  const growth = row.growth_rate_pct ? `+${row.growth_rate_pct}%` : null;
                  const risk = row.risk_level || "LOW";

                  const riskColor = {
                    LOW: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                    MEDIUM: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                    HIGH: "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  }[risk] || "bg-slate-800 text-slate-300";

                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-cyan-300">{predId}</td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-semibold text-slate-200">{dept}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          {facility}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{target}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-400">
                        ${Number(predAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-cyan-300">
                        {actAmt !== null ? `$${Number(actAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : <span className="text-slate-500 italic">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="text-slate-200">{accuracy}</div>
                        {growth && <div className="text-[10px] text-emerald-400 font-semibold">{growth}</div>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${riskColor}`}>
                          {risk}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleRecordClick(row)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-sans font-medium border border-cyan-500/30 inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-xl w-full rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setSelectedRecord(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-mono text-white">
                  {selectedRecord.prediction_id || selectedRecord.revenue_prediction_id}
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedRecord.department} · {selectedRecord.facility_name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-2">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-sans">Predicted Revenue</span>
                <div className="text-emerald-400 text-base font-bold">
                  ${Number(selectedRecord.predicted_revenue || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-sans">Actual Settled</span>
                <div className="text-cyan-300 text-base font-bold">
                  {selectedRecord.actual_revenue ? `$${Number(selectedRecord.actual_revenue).toLocaleString()}` : 'Pending'}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-sans">95% Confidence Bounds</span>
                <div className="text-slate-300">
                  ${Number(selectedRecord.confidence_lower_bound || 0).toLocaleString()} - ${Number(selectedRecord.confidence_upper_bound || 0).toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-sans">ML Model Version</span>
                <div className="text-purple-300 font-semibold">
                  {selectedRecord.model_version || 'REV-PROJ-v2.4'}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
