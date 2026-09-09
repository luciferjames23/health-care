import React from 'react';
import { 
  LayoutDashboard, 
  TableProperties, 
  Database, 
  Terminal, 
  BarChart3, 
  Sliders,
  ChevronRight,
  Layers,
  Sparkles,
  TrendingUp,
  Activity
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, totalTables, totalRecords }) {
  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'revenue', label: 'Revenue Predictions', icon: TrendingUp, badge: 'dim_revenue' },
    { id: 'beds', label: '7-Day Bed Forecast', icon: Activity, badge: 'fact_bed' },
    { id: 'tables', label: 'Schema Explorer', icon: TableProperties, badge: totalTables ? `${totalTables} Tables` : null },
    { id: 'explorer', label: 'Data Grid Viewer', icon: Database, badge: 'Live Data' },
    { id: 'sql', label: 'SQL Sandbox', icon: Terminal, badge: 'Query' },
    { id: 'analytics', label: 'Analytics & Insights', icon: BarChart3, badge: 'AI Charts' },
    { id: 'settings', label: 'Databricks Settings', icon: Sliders, badge: null },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-slate-800 flex flex-col justify-between p-4 shrink-0 hidden md:flex min-h-[calc(100vh-61px)]">
      <div className="space-y-6">
        
        {/* Navigation Category Label */}
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-3 px-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Gold Analytics Suite
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 via-teal-500/10 to-transparent border border-cyan-500/30 text-cyan-300 shadow-md shadow-cyan-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {item.badge && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                        isActive 
                          ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/30' 
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Gold Summary Info Box */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3.5 shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Gold Catalog Metrics
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <div className="text-sm font-bold font-mono text-cyan-400">{totalTables || 8}</div>
              <div className="text-[10px] text-slate-400">Gold Tables</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <div className="text-sm font-bold font-mono text-emerald-400">
                {totalRecords ? (totalRecords / 1000).toFixed(1) + 'k' : '124.8k'}
              </div>
              <div className="text-[10px] text-slate-400">Total Rows</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span>Engine: Databricks SQL</span>
          <span className="font-mono text-cyan-400">Delta Lake</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Target: <span className="text-slate-300 font-mono">health_care.gold</span>
        </div>
      </div>
    </aside>
  );
}
