import React, { useState } from 'react';
import { 
  Terminal, 
  Play, 
  Sparkles, 
  Copy, 
  Check, 
  Clock, 
  Database,
  FileCode,
  RotateCcw
} from 'lucide-react';
import { MOCK_TABLE_DATA } from '../services/api';

const PRESET_QUERIES = [
  {
    title: "30-Day Hospital Readmissions Analysis",
    sql: `SELECT 
  p.patient_id, 
  p.first_name || ' ' || p.last_name AS patient_name,
  e.encounter_class,
  e.primary_diagnosis,
  e.total_cost,
  e.readmitted_30d
FROM health_care.gold.fact_encounters e
JOIN health_care.gold.dim_patient p ON e.patient_id = p.patient_id
WHERE e.readmitted_30d = TRUE
ORDER BY e.total_cost DESC;`,
    mockResultKey: 'fact_encounters'
  },
  {
    title: "Claims Breakdown by Insurance Type",
    sql: `SELECT 
  p.insurance_type,
  COUNT(c.claim_id) AS total_claims,
  SUM(c.billed_amount) AS total_billed,
  SUM(c.paid_amount) AS total_paid
FROM health_care.gold.fact_claims c
JOIN health_care.gold.dim_patient p ON c.patient_id = p.patient_id
GROUP BY p.insurance_type
ORDER BY total_billed DESC;`,
    mockResultKey: 'fact_claims'
  },
  {
    title: "Critical Diagnostic Lab Results",
    sql: `SELECT 
  p.patient_id,
  l.test_name,
  l.result_value,
  l.units,
  l.flag
FROM health_care.gold.fact_lab_results l
JOIN health_care.gold.dim_patient p ON l.patient_id = p.patient_id
WHERE l.flag = 'CRITICAL' OR l.flag = 'HIGH';`,
    mockResultKey: 'fact_lab_results'
  }
];

export default function SqlSandboxView() {
  const [activeQueryIndex, setActiveQueryIndex] = useState(0);
  const [sqlText, setSqlText] = useState(PRESET_QUERIES[0].sql);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleRunQuery = () => {
    setIsExecuting(true);
    setExecResult(null);
    setTimeout(() => {
      const key = PRESET_QUERIES[activeQueryIndex]?.mockResultKey || 'dim_patient';
      const rows = MOCK_TABLE_DATA[key] || MOCK_TABLE_DATA.dim_patient;
      setExecResult({
        rows,
        columns: rows.length ? Object.keys(rows[0]) : [],
        duration: (Math.random() * 0.15 + 0.12).toFixed(2),
        rowCount: rows.length
      });
      setIsExecuting(false);
    }, 400);
  };

  const handleSelectPreset = (idx) => {
    setActiveQueryIndex(idx);
    setSqlText(PRESET_QUERIES[idx].sql);
    setExecResult(null);
  };

  const copySql = () => {
    navigator.clipboard.writeText(sqlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            Databricks SQL Query Sandbox
          </h2>
          <p className="text-xs text-slate-400">
            Execute SQL queries directly against Delta Lake Gold tables in <span className="text-cyan-300 font-mono">health_care.gold</span> catalog.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {PRESET_QUERIES.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPreset(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                activeQueryIndex === idx
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              Preset {idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Editor Box */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
        
        {/* Editor Toolbar */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
            <span className="text-xs font-mono text-slate-400 ml-2">databricks_sql_editor.sql</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={copySql}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span className="hidden sm:inline">Copy</span>
            </button>
            <button
              onClick={() => setSqlText(PRESET_QUERIES[activeQueryIndex].sql)}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
              title="Reset query"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={handleRunQuery}
              disabled={isExecuting}
              className="flex items-center space-x-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isExecuting ? 'animate-spin' : ''}`} />
              <span>{isExecuting ? 'Executing...' : 'Run Query'}</span>
            </button>
          </div>
        </div>

        {/* Text Area */}
        <textarea
          value={sqlText}
          onChange={(e) => setSqlText(e.target.value)}
          rows={7}
          className="w-full bg-slate-950 text-cyan-200 font-mono text-xs p-4 focus:outline-none resize-y leading-relaxed border-none"
        />
      </div>

      {/* Query Execution Output */}
      {execResult && (
        <div className="glass-panel rounded-xl border border-slate-800 space-y-4 p-4 animate-in fade-in duration-300">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3 text-xs">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Query Succeeded
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-300 font-mono flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                {execResult.duration} seconds
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-300 font-mono">
                {execResult.rowCount} rows returned
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Engine: Databricks Serverless SQL</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  {execResult.columns.map(col => (
                    <th key={col} className="py-2.5 px-4 font-mono text-cyan-400">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {execResult.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    {execResult.columns.map(col => (
                      <td key={col} className="py-2.5 px-4 whitespace-nowrap">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
