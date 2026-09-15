import React from 'react';
import { 
  Sliders, 
  Server, 
  Database, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2,
  HardDrive,
  Globe
} from 'lucide-react';

export default function SettingsView({ healthInfo, onRefresh, loading }) {
  const isConnected = healthInfo?.isConnected;

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            Databricks & System Configuration
          </h2>
          <p className="text-xs text-slate-400">
            View active connection properties for Databricks Lakehouse and FastAPI REST service.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center space-x-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Test System Connection</span>
        </button>
      </div>

      {/* Connection Status Card */}
      <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3.5 h-3.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isConnected ? 'FastAPI Backend Online & Connected' : 'Local Prototype Engine Active'}
              </h3>
              <p className="text-xs text-slate-400">
                {isConnected ? 'Connected to http://localhost:8000/api/v1/health' : 'Serving rich offline mock data for Databricks Gold schema'}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-cyan-300">
            {isConnected ? 'HTTP 200 OK' : 'LOCAL FALLBACK'}
          </span>
        </div>
      </div>

      {/* Databricks Connector Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Databricks Properties */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Databricks Gold Layer Metadata
          </h3>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-sans">Databricks Server Hostname</span>
              <div className="text-slate-200 text-ellipsis overflow-hidden">
                dbc-478013da-49af.cloud.databricks.com
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-sans">HTTP Path</span>
              <div className="text-slate-200 text-ellipsis overflow-hidden">
                /sql/1.0/warehouses/769f9abf1dd202a2
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-sans">Catalog</span>
                <div className="text-cyan-300 font-bold">health_care</div>
              </div>
              <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-sans">Schema</span>
                <div className="text-emerald-300 font-bold">gold</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: REST API Endpoints */}
        <div className="glass-panel rounded-xl p-6 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            FastAPI Backend Service Endpoints
          </h3>

          <div className="space-y-2 font-mono text-xs max-h-[260px] overflow-y-auto pr-1">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span className="text-cyan-300">GET /api/v1/health</span>
              <span className="text-[10px] text-slate-500 font-sans">Health Check</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span className="text-cyan-300">GET /api/v1/gold/summary</span>
              <span className="text-[10px] text-slate-500 font-sans">Gold Summary KPIs</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span className="text-cyan-300">GET /api/v1/gold/revenue-predictions</span>
              <span className="text-[10px] text-slate-500 font-sans">Revenue Projections</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span className="text-cyan-300">GET /api/v1/gold/bed-management</span>
              <span className="text-[10px] text-slate-500 font-sans">Hospital Bed Management</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span className="text-cyan-300">GET /api/v1/gold/tables</span>
              <span className="text-[10px] text-slate-500 font-sans">Table Metadata</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
              <span className="text-cyan-300">GET /api/v1/gold/table/&#123;table&#125;</span>
              <span className="text-[10px] text-slate-500 font-sans">Dynamic Query</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
