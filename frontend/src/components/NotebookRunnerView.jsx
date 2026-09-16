import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import {
  Play, RefreshCw, Copy, CheckCheck, ExternalLink,
  AlertCircle, Info, BookOpen, ChevronDown, ChevronUp,
  User, Cpu, Clock, Table2, Zap, Sparkles, CheckCircle2,
  FileText, Pill, Stethoscope, HeartPulse
} from 'lucide-react';

// ─── Utility ──────────────────────────────────────────────────────────────────
function fmtVal(v) {
  if (v === null || v === undefined)
    return <span className="text-slate-600 italic text-xs">null</span>;
  if (typeof v === 'boolean')
    return <span className="text-amber-400 font-mono text-xs">{String(v)}</span>;
  if (typeof v === 'number')
    return <span className="text-cyan-300 font-mono text-xs">{v.toLocaleString()}</span>;
  const s = String(v);
  if (s.length > 120)
    return <span className="text-slate-200 text-xs break-words">{s.slice(0, 120)}<span className="text-slate-500">…</span></span>;
  return <span className="text-slate-200 text-xs">{s}</span>;
}

// ─── Result Table ─────────────────────────────────────────────────────────────
function ResultTable({ data }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
        <Table2 className="w-4 h-4" />
        No records in output table.
      </div>
    );
  }

  const columns = Object.keys(data[0]);
  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const pageData = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
        <span>{data.length} row{data.length !== 1 ? 's' : ''} &middot; {columns.length} col{columns.length !== 1 ? 's' : ''}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0}
              className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition">
              Prev
            </button>
            <span className="font-mono">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))} disabled={page === totalPages - 1}
              className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition">
              Next
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-inner">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-900/90 border-b border-slate-800">
              {columns.map(col => (
                <th key={col} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-400 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, ri) => (
              <tr key={ri} className={`border-b border-slate-800/60 transition-colors ${ri % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-950/30'} hover:bg-cyan-950/20`}>
                {columns.map(col => (
                  <td key={col} className="px-3 py-2 align-top max-w-xs">{fmtVal(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true, badge = null }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800/50 transition">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-4 h-4 text-cyan-400" />}
          {title}
          {badge && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NotebookRunnerView() {
  const [patientId, setPatientId] = useState('87423,87428,87433');
  const [modelName, setModelName] = useState('databricks-meta-llama-3-3-70b-instruct');
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(2000);
  const [saveToGold, setSaveToGold] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  const PRESETS = [
    { label: 'Batch (87423,87428,87433)', val: '87423,87428,87433' },
    { label: 'Cardiology AMI (87245)', val: '87245' },
    { label: 'GI Surgery (87246)', val: '87246' },
    { label: 'Pulmonology Asthma (87224)', val: '87224' },
    { label: 'All Admitted (all)', val: 'all' },
  ];

  async function handleRun(e) {
    e?.preventDefault();
    const pid = patientId.trim();
    if (!pid) { setError('Please enter Patient IDs (e.g. 87423,87428,87433 or all).'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await apiService.generateDischargeSummaryLLM(pid, {
        model_name: modelName,
        temperature,
        max_tokens: maxTokens,
        save_to_gold: saveToGold
      });
      setResult(res);
    } catch (err) {
      setError(err.message || 'Discharge summary generation failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleReset() {
    setPatientId('87423,87428,87433'); setResult(null); setError(null);
    inputRef.current?.focus();
  }

  const generatedSummaries = result?.data || [];
  const hasRows = generatedSummaries.length > 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Clinical Workspace</span> › <span>AI Generation</span> › <span className="text-cyan-400 font-semibold">Llama 3.3 70B Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center shadow-lg shadow-violet-950/40">
              <Sparkles className="w-5 h-5 text-cyan-300" />
            </span>
            Discharge Summary LLM Generation
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Direct API: <code className="text-cyan-300 font-mono text-xs bg-slate-800 px-1.5 py-0.5 rounded">http://127.0.0.1:8000/api/v1/discharge-summary-llm/generate</code>
            {' '}— Generates evidence-based clinical discharge summaries for single or comma-separated patients.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Meta Llama-3.3-70B Ready
          </span>
        </div>
      </div>

      {/* Input Form */}
      <Section title="LLM Generation Parameters" icon={Zap} defaultOpen={true}>
        <form onSubmit={handleRun} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                Patient IDs (Comma-separated or 'all') <span className="text-rose-400">*</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                Target: <code className="text-cyan-300 font-mono">health_care.gold.dim_generated_discharge_summaries</code>
              </span>
            </label>
            <input ref={inputRef} id="llm-patient-id-input" type="text"
              value={patientId} onChange={e => setPatientId(e.target.value)}
              placeholder="e.g. 87423,87428,87433 or 87245 or all"
              className="w-full bg-slate-950/70 border border-slate-700 focus:border-cyan-500 text-slate-100 text-sm rounded-xl px-4 py-2.5 outline-none transition placeholder:text-slate-600 font-mono" />
            
            {/* Quick Fill Presets */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[11px] text-slate-400">Quick Presets:</span>
              {PRESETS.map(p => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => setPatientId(p.val)}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition ${
                    patientId === p.val
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200 font-semibold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-violet-400" />
                Model Architecture
              </label>
              <input type="text" value={modelName} onChange={e => setModelName(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-700 focus:border-cyan-500 text-slate-100 text-xs rounded-xl px-3 py-2 outline-none font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Temperature / Max Tokens
              </label>
              <div className="flex gap-2">
                <input type="number" step="0.1" min="0" max="1" value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-1/2 bg-slate-950/70 border border-slate-700 focus:border-cyan-500 text-slate-100 text-xs rounded-xl px-3 py-2 font-mono" />
                <input type="number" step="100" min="500" max="4000" value={maxTokens} onChange={e => setMaxTokens(parseInt(e.target.value))}
                  className="w-1/2 bg-slate-950/70 border border-slate-700 focus:border-cyan-500 text-slate-100 text-xs rounded-xl px-3 py-2 font-mono" />
              </div>
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300 bg-slate-950/70 border border-slate-700 rounded-xl px-3 py-2">
                <input type="checkbox" checked={saveToGold} onChange={e => setSaveToGold(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0" />
                <span>Save to Gold Delta Table</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button id="llm-generate-btn" type="submit" disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-cyan-600 to-teal-500 text-white text-sm font-semibold shadow-lg shadow-cyan-950/40 hover:opacity-95 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {loading ? 'Generating Discharge Summaries...' : 'Generate Discharge Summaries'}
            </button>
            {(result || error) && (
              <button type="button" onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition">
                <RefreshCw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>
        </form>
      </Section>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl px-5 py-4 text-sm text-rose-300 shadow">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-200 mb-1">Generation Failed</p>
            <p className="text-xs text-rose-300/80">{error}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-sm text-slate-200 font-semibold">
              Calling /api/v1/discharge-summary-llm/generate for patient(s): <span className="text-cyan-300 font-mono">{patientId}</span>...
            </span>
          </div>
          <div className="space-y-2 text-xs text-slate-400">
            <div>1. Resolving clinical inputs and vitals from Delta Lakehouse...</div>
            <div>2. Extracting exact prescribed medications and diagnosis parameters...</div>
            <div>3. Formulating structured discharge summaries, treatments & take-home regimen...</div>
            <div>4. Committing output records to <code className="text-cyan-300">dim_generated_discharge_summaries</code>...</div>
          </div>
          <div className="h-2 bg-slate-800 rounded-full w-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 w-3/4 animate-pulse" />
          </div>
        </div>
      )}

      {/* Results View */}
      {result && !loading && (
        <div className="space-y-6">
          
          {/* Metadata Banner */}
          <Section title="Generation Execution Summary" icon={CheckCircle2} defaultOpen={true} badge={`${result.total_generated || generatedSummaries.length} generated`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Status', value: result.status || 'success' },
                { label: 'Patient IDs Requested', value: result.patient_ids_requested || patientId },
                { label: 'Patient IDs Executed', value: result.patient_ids_executed || '—' },
                { label: 'Total Generated', value: result.total_generated ?? generatedSummaries.length },
                { label: 'Model Architecture', value: result.model || modelName },
                { label: 'Target Delta Table', value: result.target_table || 'gold.dim_generated_discharge_summaries' },
                { label: 'Generated At', value: result.timestamp ? String(result.timestamp).slice(0, 19).replace('T', ' ') : '—' },
                { label: 'Persisted to Gold', value: saveToGold ? '✓ Yes (Auto-committed)' : 'No' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-xs font-mono text-slate-200 truncate">{String(value)}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Individual Patient Summary Cards */}
          {generatedSummaries.map((summary, idx) => (
            <div key={summary.summary_id || idx} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4 shadow-lg">
              
              {/* Patient Title Bar */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono font-bold flex items-center justify-center text-xs">
                    #{idx + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{summary.patient_name || `Patient ${summary.patient_id}`}</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {summary.patient_number || `PID: ${summary.patient_id}`}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Attending Consultant: <strong className="text-slate-300">{summary.attending_physician}</strong> · Discharge: {summary.discharge_date}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono">
                    ID: {summary.summary_id}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    {summary.approval_status || 'Pending Approval'}
                  </span>
                </div>
              </div>

              {/* Diagnosis & Case History */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Admission Reason & Discharge Diagnosis
                  </div>
                  <div className="text-xs font-semibold text-slate-100">
                    {summary.discharge_diagnosis}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Reason: {summary.admission_reason}
                  </div>
                </div>

                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <HeartPulse className="w-3.5 h-3.5" />
                    Surgery & Procedures Details
                  </div>
                  <div className="text-xs text-slate-300 leading-relaxed">
                    {summary.surgery_details || (summary.llm_generated_summary_text?.includes('6. SURGERY DETAILS:\n')
                      ? summary.llm_generated_summary_text.split('6. SURGERY DETAILS:\n')[1].split('\n\n')[0]
                      : 'Nil')}
                  </div>
                </div>
              </div>

              {/* Inpatient Treatment Given */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5" />
                  Inpatient Treatment & Medications Given (with exact dosage/volume/route)
                </div>
                <pre className="text-xs text-emerald-200/90 font-mono whitespace-pre-wrap leading-relaxed bg-slate-950/90 border border-emerald-950/40 rounded-lg p-3">
                  {summary.discharge_medications}
                </pre>
              </div>

              {/* Discharge Advice & Home Instructions */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Discharge Advice & Take-Home Regimen
                </div>
                <pre className="text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed bg-slate-950/90 border border-slate-800 rounded-lg p-3">
                  {summary.followup_instructions ? summary.followup_instructions.split('\n').filter(l => !l.includes('தமிழ்') && !l.includes('Tamil Instructions') && !/[\u0B80-\u0BFF]/.test(l)).join('\n').trim() : ''}
                </pre>
              </div>

            </div>
          ))}

          {/* Output Table */}
          <Section title="Lakehouse Gold Output Table" icon={Table2} defaultOpen={false}
            badge={hasRows ? `${generatedSummaries.length} rows` : "empty"}>
            <ResultTable data={generatedSummaries} />
          </Section>

          {/* Raw JSON */}
          <Section title="Raw API JSON Payload (/api/v1/discharge-summary-llm/generate)" icon={BookOpen} defaultOpen={false}>
            <div className="flex justify-end mb-2">
              <button id="notebook-copy-json-btn" onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition">
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>
            <pre className="text-[11px] text-slate-300 font-mono bg-slate-950/70 border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-80 leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </Section>
        </div>
      )}
    </div>
  );
}
