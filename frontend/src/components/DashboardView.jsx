import React from 'react';
import { 
  TableProperties, 
  Database, 
  Activity, 
  ArrowUpRight, 
  Layers, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  Cpu, 
  FileText,
  BarChart2,
  Lock,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

export default function DashboardView({ summary, onSelectTable, onNavigateTab }) {
  const tables = summary?.tables || [];
  const totalRecords = summary?.total_records || 124860;

  const financialKpis = summary?.financial_kpis || { total_predicted_revenue_usd: 29400000.0, total_prediction_records: 7 };
  const bedKpis = summary?.bed_capacity_kpis || { total_predicted_beds_demanded: 26, avg_predicted_occupancy_rate_pct: 36.87, total_forecast_records: 3 };

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Hero Welcome */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-emerald-950/70 border border-slate-800 p-6 md:p-8 shadow-2xl">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-0 right-1/3 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Databricks Healthcare Gold Layer Active
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Healthcare Analytics & Gold Schema Hub
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Query curated Delta Lake analytics tables: department revenue predictions (<span className="text-cyan-300 font-mono">dim_revenue_predictions</span>), 7-day bed demand forecasts (<span className="text-cyan-300 font-mono">fact_bed_demand_forecast_7day_detailed</span>), encounters, and claims directly from <span className="text-cyan-300 font-mono">health_care.gold</span>.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigateTab('revenue')}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-cyan-500/25"
            >
              <TrendingUp className="w-4 h-4" />
              Revenue Predictions
            </button>
            <button
              onClick={() => onNavigateTab('beds')}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              7-Day Bed Forecast
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Predicted Revenue */}
        <div className="glass-panel glass-panel-hover rounded-xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Predicted Revenue</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold font-mono text-emerald-400 tracking-tight">
              ${(financialKpis.total_predicted_revenue_usd || 29400000).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              dim_revenue_predictions
            </p>
          </div>
        </div>

        {/* Card 2: Bed Demand Forecast */}
        <div className="glass-panel glass-panel-hover rounded-xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">7-Day Demanded Beds</span>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono text-cyan-300 tracking-tight">
              {bedKpis.total_predicted_beds_demanded || 26} beds
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-cyan-400" />
              {bedKpis.avg_predicted_occupancy_rate_pct || 36.87}% avg occupancy
            </p>
          </div>
        </div>

        {/* Card 3: Gold Tables Count */}
        <div className="glass-panel glass-panel-hover rounded-xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Gold Tables</span>
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <TableProperties className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
              {tables.length || 8}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-400" />
              catalog: health_care.gold
            </p>
          </div>
        </div>

        {/* Card 4: Total Records */}
        <div className="glass-panel glass-panel-hover rounded-xl p-5 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Ingested Records</span>
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
              <Database className="w-4 h-4 text-teal-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold font-mono text-white tracking-tight">
              {totalRecords.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-teal-400" />
              Delta Lake Format (Parquet)
            </p>
          </div>
        </div>
      </div>

      {/* Gold Schema Directory Quick Access Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Healthcare Gold Tables Directory
            </h3>
            <p className="text-xs text-slate-400">Curated, business-ready healthcare datasets in Databricks</p>
          </div>
          <button
            onClick={() => onNavigateTab('tables')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
          >
            View All Schemas <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map((t) => {
            const domainColors = {
              Clinical: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
              Financial: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
              Operations: "bg-purple-500/10 text-purple-300 border-purple-500/30",
              Pharmacy: "bg-amber-500/10 text-amber-300 border-amber-500/30",
              "Financial & Predictive Analytics": "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-bold",
              "Clinical Operations & Bed Management": "bg-cyan-500/15 text-cyan-300 border-cyan-500/40 font-bold"
            };
            const badgeStyle = domainColors[t.domain] || "bg-slate-800 text-slate-300 border-slate-700";

            return (
              <div 
                key={t.table_name} 
                className="glass-panel glass-panel-hover rounded-xl p-5 border border-slate-800/80 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border ${badgeStyle}`}>
                        {t.domain || "Healthcare"}
                      </span>
                      <h4 className="text-sm font-bold text-white font-mono mt-2">
                        {t.table_name}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-semibold text-cyan-400 block">
                        {(t.row_count || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500">rows</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {t.description || "Healthcare Gold layer analytical dataset."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono truncate max-w-[120px]">
                    gold.{t.table_name}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onSelectTable(t.table_name, 'schema')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                    >
                      Schema
                    </button>
                    <button
                      onClick={() => onSelectTable(t.table_name, 'data')}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-medium border border-cyan-500/30"
                    >
                      View Data
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
