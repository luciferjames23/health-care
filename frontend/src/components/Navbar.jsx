import React from 'react';
import { Activity, Database, Server, RefreshCw, ShieldCheck, Cpu } from 'lucide-react';

export default function Navbar({ healthInfo, onRefresh, loading }) {
  const isLive = healthInfo?.isConnected;

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-800 px-6 py-3.5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        
        {/* Left Side: Brand & Catalog Info */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-500 to-emerald-400 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-white tracking-tight">HealthPulse</h1>
                <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                Clinical Intelligence Platform
              </p>
            </div>
          </div>
        </div>

        {/* Center: Status Indicator */}
        <div className="hidden md:flex items-center space-x-3 bg-slate-900/80 border border-slate-800 rounded-full px-4 py-1.5 shadow-inner">
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
            <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              {isLive ? 'FastAPI Backend Connected' : 'Local Engine Mode'}
            </span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Delta Lake Warehousing</span>
          </div>
        </div>

        {/* Right Side: Quick Action & Health Indicator */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh Sync</span>
          </button>

          <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-3 py-1.5 rounded-lg font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">HIPAA Compliant</span>
          </div>
        </div>
      </div>
    </header>
  );
}
