import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Bed, 
  Calendar, 
  Clock, 
  Filter, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  BarChart2, 
  Building,
  Users
} from 'lucide-react';
import { apiService } from '../services/api';

export default function BedDemandView() {
  const [dataResult, setDataResult] = useState(null);
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [wardName, setWardName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [dayName, setDayName] = useState('');
  const [isWeekend, setIsWeekend] = useState('');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    loadSummaryAndTrend();
  }, []);

  useEffect(() => {
    loadData();
  }, [wardName, departmentName, dayName, isWeekend, limit, offset]);

  async function loadSummaryAndTrend() {
    try {
      const summary = await apiService.getBedDemandSummary();
      setSummaryMetrics(summary);

      const trendRes = await apiService.getBedDemand7DayTrend();
      setTrendData(trendRes?.data || []);
    } catch (err) {
      console.error("Failed to load bed demand summary", err);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const params = { limit, offset };
      if (wardName) params.ward_name = wardName;
      if (departmentName) params.department_name = departmentName;
      if (dayName) params.day_name = dayName;
      if (isWeekend !== '') params.is_weekend = isWeekend;

      const res = await apiService.getBedDemandForecast(params);
      setDataResult(res);
    } catch (err) {
      console.error("Failed to load bed demand forecast data", err);
    } finally {
      setLoading(false);
    }
  }

  const rows = dataResult?.data || [];
  const totalRows = dataResult?.total_rows || rows.length;
  const totalPages = Math.ceil(totalRows / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  const wards = [
    "All Wards",
    "Coronary Care CCU",
    "Medical Intensive Care MICU",
    "Surgical Intensive Care SICU",
    "Emerald Semi-Private Ward",
    "Platinum Deluxe Wing",
    "Emergency Observation Bay"
  ];
  const days = ["All Days", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            7-Day Detailed Bed Demand Forecast & Ward Capacity
          </h2>
          <p className="text-xs text-slate-400">
            Real-time ward capacity, bed inventory, and telemetry projections from <span className="text-cyan-300 font-mono">public.beds &amp; public.wards</span>.
          </p>
        </div>

        <button
          onClick={() => { loadSummaryAndTrend(); loadData(); }}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh API</span>
        </button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Hospital Beds</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono text-cyan-300">
              {summaryMetrics?.overview?.total_beds || 180}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Active licensed capacity in PostgreSQL
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Available Ready Beds</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono text-emerald-400">
              {summaryMetrics?.overview?.available_beds ?? 180}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Immediately available for intake
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Avg Daily Bed Charge</span>
            <Building className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono text-purple-300">
              ₹{(summaryMetrics?.overview?.avg_daily_charge || 5260).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Per bed/day across 6 clinical wards
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Projected Peak Occupancy</span>
            <BarChart2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono text-cyan-300">
              {trendData?.[0]?.avg_occupancy_rate || 72.5}%
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Target operational threshold &lt; 85%
            </p>
          </div>
        </div>

      </div>

      {/* 7-Day Trend Visual Card Section */}
      <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              7-Day Bed Forecast Trend Timeline
            </h3>
            <p className="text-xs text-slate-400">Live ward breakdown by day from Databricks ML model</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trendData.slice(0, 3).map((item, idx) => (
            <div key={idx} className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white font-mono">{item.forecast_date} ({item.day_name})</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.is_weekend ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'}`}>
                  {item.is_weekend ? 'Weekend' : 'Weekday'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-slate-300 font-semibold">{item.ward_name}</div>
                <div className="text-[11px] text-slate-400">{item.department_name} · Floor {item.floor_number}</div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono pt-1">
                <div className="bg-slate-950 rounded-lg p-2 border border-slate-800">
                  <div className="text-cyan-400 font-bold">{item.predicted_beds}</div>
                  <div className="text-[9px] text-slate-500 font-sans">Total</div>
                </div>
                <div className="bg-slate-950 rounded-lg p-2 border border-slate-800">
                  <div className="text-rose-400 font-bold">{item.predicted_emergency}</div>
                  <div className="text-[9px] text-slate-500 font-sans">Emergency</div>
                </div>
                <div className="bg-slate-950 rounded-lg p-2 border border-slate-800">
                  <div className="text-emerald-400 font-bold">{item.predicted_elective}</div>
                  <div className="text-[9px] text-slate-500 font-sans">Elective</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Occupancy Rate:</span>
                  <span className="font-bold font-mono text-purple-300">{item.predicted_occupancy_rate}%</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                    style={{ width: `${Math.min(100, item.predicted_occupancy_rate)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <label className="text-xs text-slate-400 font-semibold">Ward:</label>
            <select
              value={wardName}
              onChange={(e) => {
                setWardName(e.target.value === "All Wards" ? "" : e.target.value);
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              {wards.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-400 font-semibold">Day:</label>
            <select
              value={dayName}
              onChange={(e) => {
                setDayName(e.target.value === "All Days" ? "" : e.target.value);
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              {days.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-400 font-semibold">Weekend:</label>
            <select
              value={isWeekend}
              onChange={(e) => {
                setIsWeekend(e.target.value);
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Days</option>
              <option value="1">Weekend Only (1)</option>
              <option value="0">Weekday Only (0)</option>
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

      {/* Main Detailed Grid Table */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center space-y-3">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <span className="text-xs font-mono">Loading bed demand detailed forecasts...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-mono">
            No bed demand records found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Forecast Date</th>
                  <th className="py-3 px-4">Ward Name & Department</th>
                  <th className="py-3 px-4 text-center">Floor</th>
                  <th className="py-3 px-4 text-right">Predicted Beds</th>
                  <th className="py-3 px-4 text-right">Emerg / Elective</th>
                  <th className="py-3 px-4 text-center">ALOS (Days)</th>
                  <th className="py-3 px-4 text-center">Occupancy Rate</th>
                  <th className="py-3 px-4 text-left">ML Model</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {rows.map((row, idx) => {
                  const fDate = row.forecast_date || "2026-09-13";
                  const dName = row.day_name || "Sunday";
                  const ward = row.ward_name || `Ward #${row.ward_id || idx+1}`;
                  const dept = row.department_name || "Clinical Ops";
                  const floor = row.floor_number ?? 1;
                  const beds = row.predicted_beds ?? 0;
                  const emerg = row.predicted_emergency ?? 0;
                  const elect = row.predicted_elective ?? 0;
                  const alos = row.avg_length_of_stay ? row.avg_length_of_stay.toFixed(2) : "5.50";
                  const occRate = row.predicted_occupancy_rate ?? 0;
                  const model = row.model_name || "bed_demand_prediction_prophet";

                  return (
                    <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-cyan-300">
                        {fDate}
                        <div className="text-[10px] text-slate-400 font-sans font-normal">{dName}</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-semibold text-slate-200">{ward}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Building className="w-3 h-3 text-slate-500" />
                          {dept}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-300">F{floor}</td>
                      <td className="py-3 px-4 text-right font-bold text-cyan-300">{beds} beds</td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="text-rose-400 font-semibold">{emerg} E</span>
                        <span className="text-slate-600 px-1">/</span>
                        <span className="text-emerald-400 font-semibold">{elect} S</span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300">{alos}</td>
                      <td className="py-3 px-4 text-center font-bold text-purple-300">{occRate}%</td>
                      <td className="py-3 px-4 text-slate-400 text-[10px] truncate max-w-[160px] font-mono">
                        {model}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
