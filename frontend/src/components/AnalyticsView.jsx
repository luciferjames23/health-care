import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Activity, 
  DollarSign, 
  Users, 
  ShieldCheck, 
  AlertTriangle,
  Stethoscope
} from 'lucide-react';

export default function AnalyticsView() {
  const encounterDistribution = [
    { label: "Inpatient Admissions", percentage: 42, count: "21,882", color: "bg-cyan-500", glow: "shadow-cyan-500/30" },
    { label: "Emergency Department", percentage: 31, count: "16,151", color: "bg-amber-500", glow: "shadow-amber-500/30" },
    { label: "Outpatient Visits", percentage: 27, count: "14,067", color: "bg-teal-400", glow: "shadow-teal-400/30" }
  ];

  const insuranceBreakdown = [
    { type: "Medicare (Senior)", share: "45%", value: 45, count: "11,025 patients", color: "bg-emerald-400" },
    { type: "Private Insurance", share: "32%", value: 32, count: "7,840 patients", color: "bg-cyan-400" },
    { type: "Medicaid (Assistance)", share: "18%", value: 18, count: "4,410 patients", color: "bg-purple-400" },
    { type: "Uninsured / Self-Pay", share: "5%", value: 5, count: "1,225 patients", color: "bg-rose-400" }
  ];

  const topDiagnoses = [
    { code: "E11.9", name: "Type 2 Diabetes Mellitus", encounters: 4210, trend: "+12.4%" },
    { code: "I10", name: "Essential (Primary) Hypertension", encounters: 3890, trend: "+8.1%" },
    { code: "J44.9", name: "Chronic Obstructive Pulmonary Disease", encounters: 2750, trend: "-2.3%" },
    { code: "I20.9", name: "Angina Pectoris / Coronary Syndrome", encounters: 1980, trend: "+5.6%" },
    { code: "N18.9", name: "Chronic Kidney Disease", encounters: 1420, trend: "+3.8%" }
  ];

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Healthcare Gold Insights & Executive Analytics
          </h2>
          <p className="text-xs text-slate-400">
            Real-time analytical dashboards derived from aggregated Databricks Gold schemas.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono">
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Live Aggregation: health_care.gold</span>
        </div>
      </div>

      {/* Top Row: Metric Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Readmission Rate */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">30-Day Readmission Rate</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-mono font-extrabold text-amber-400">14.2%</span>
            <span className="text-xs text-slate-400">-1.8% vs last quarter</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Target threshold is &lt; 15.0%. Hospital readmission reduction program is performing optimally.
          </p>
        </div>

        {/* Card 2: Financial Claims Paid Ratio */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Claims Reimbursement Rate</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-mono font-extrabold text-emerald-400">91.4%</span>
            <span className="text-xs text-slate-400">$42.8M total paid</span>
          </div>
          <p className="text-[11px] text-slate-400">
            $46.8M total billed. Denial rate stands at 8.6% across institutional claims.
          </p>
        </div>

        {/* Card 3: Provider Utilization */}
        <div className="glass-panel rounded-xl p-5 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Avg Provider Rating</span>
            <Stethoscope className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-mono font-extrabold text-cyan-400">4.87 / 5</span>
            <span className="text-xs text-slate-400">3,200 active NPIs</span>
          </div>
          <p className="text-[11px] text-slate-400">
            96% of network physicians meet primary patient satisfaction benchmarks.
          </p>
        </div>

      </div>

      {/* Middle Row: Visual Chart Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Encounter Class Distribution */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-cyan-400" />
                Hospital Encounter Volume Breakdown
              </h3>
              <p className="text-xs text-slate-400">Distribution across 52,100 Gold encounter records</p>
            </div>
          </div>

          <div className="space-y-4">
            {encounterDistribution.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-mono text-cyan-300">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${item.color} ${item.glow}`} 
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Insurance Demographics */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Patient Payer Mix Demographics
              </h3>
              <p className="text-xs text-slate-400">Primary coverage for 24,500 registered patients</p>
            </div>
          </div>

          <div className="space-y-4">
            {insuranceBreakdown.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">{item.type}</span>
                  <span className="font-mono text-emerald-300">{item.count} ({item.share})</span>
                </div>
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ${item.color}`} 
                    style={{ width: `${item.value}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom Table: Top Diagnoses Leaderboard */}
      <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Top Primary Diagnoses (ICD-10 Classification)
          </h3>
          <p className="text-xs text-slate-400">Most frequent clinical primary diagnosis codes recorded in Gold encounters</p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">ICD-10 Code</th>
                <th className="py-3 px-4">Diagnosis Name</th>
                <th className="py-3 px-4">Total Encounters</th>
                <th className="py-3 px-4">YoY Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {topDiagnoses.map((diag, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-cyan-300">{diag.code}</td>
                  <td className="py-3 px-4 text-slate-200 font-sans font-medium">{diag.name}</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">{diag.encounters.toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${diag.trend.startsWith('+') ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                      {diag.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
