import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import {
  Play, RefreshCw, Copy, CheckCheck, ExternalLink,
  AlertCircle, Info, BookOpen, ChevronDown, ChevronUp,
  User, Cpu, Clock, Table2, Zap,
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
  const PAGE_SIZE = 20;

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
  const [patientId, setPatientId] = useState('');
  const [timeoutSec, setTimeoutSec] = useState(120);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [notebookConfig, setNotebookConfig] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    apiService.getNotebookConfig().then(setNotebookConfig).catch(() => {});
  }, []);

  async function handleRun(e) {
    e?.preventDefault();
    const pid = patientId.trim();
    if (!pid) { setError('Please enter a Patient ID before running the notebook.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await apiService.runPatientNotebook(pid, { timeoutSeconds: timeoutSec });
      setResult(res);
    } catch (err) {
      setError(err.message || 'Notebook run failed.');
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
    setPatientId(''); setResult(null); setError(null);
    inputRef.current?.focus();
  }

  const hasRows = (result?.data ?? result?.result?.data) && Array.isArray(result?.data ?? result?.result?.data) && (result?.data ?? result?.result?.data).length > 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center shadow-lg shadow-violet-950/40">
              <BookOpen className="w-5 h-5 text-violet-300" />
            </span>
            Notebook Runner
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Trigger Databricks notebook{' '}
            <code className="text-cyan-300 font-mono text-xs bg-slate-800 px-1.5 py-0.5 rounded">3655906645282312</code>
            {' '}with a patient ID and view the output table.
          </p>
        </div>
        {notebookConfig?.notebook_url && (
          <a href={notebookConfig.notebook_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition shadow">
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Databricks
          </a>
        )}
      </div>

      {/* Input Form */}
      <Section title="Run Parameters" icon={Zap} defaultOpen={true}>
        <form onSubmit={handleRun} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                Patient ID <span className="text-rose-400">*</span>
              </label>
              <input ref={inputRef} id="notebook-patient-id-input" type="text"
                value={patientId} onChange={e => setPatientId(e.target.value)}
                placeholder="e.g. 10892 or PAT-10892"
                className="w-full bg-slate-950/70 border border-slate-700 focus:border-cyan-500 text-slate-100 text-sm rounded-xl px-4 py-2.5 outline-none transition placeholder:text-slate-600 font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Timeout (sec)
              </label>
              <input id="notebook-timeout-input" type="number" min={10} max={600}
                value={timeoutSec} onChange={e => setTimeoutSec(Number(e.target.value))}
                className="w-full bg-slate-950/70 border border-slate-700 focus:border-cyan-500 text-slate-100 text-sm rounded-xl px-4 py-2.5 outline-none transition font-mono" />
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <span>
              The notebook is submitted via Databricks Jobs API and polled until complete.
              If Databricks is unreachable, a <span className="text-amber-300">fallback mock result</span> is returned automatically.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button id="notebook-run-btn" type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-semibold shadow-lg shadow-violet-950/40 hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {loading ? 'Running Notebook…' : 'Run Notebook'}
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

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-rose-950/40 border border-rose-500/30 rounded-2xl px-5 py-4 text-sm text-rose-300 shadow">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-200 mb-1">Notebook Run Failed</p>
            <p className="text-xs text-rose-300/80">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-violet-400 animate-spin" />
            <span className="text-sm text-slate-300 font-medium">Executing notebook on Databricks cluster…</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full w-3/4" />
          <div className="h-2 bg-slate-800 rounded-full w-1/2" />
          <div className="h-2 bg-slate-800 rounded-full w-2/3" />
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <>
          {/* Run Metadata */}
          <Section title="Run Metadata" icon={Cpu} defaultOpen={true} badge={result.status || 'done'}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Patient ID', value: result.patient_id ?? result.parameters?.patient_id ?? '—' },
                { label: 'Notebook ID', value: result.notebook_id ?? '3655906645282312' },
                { label: 'Status', value: result.status ?? '—' },
                { label: 'Run ID', value: result.run_id ?? '—' },
                { label: 'Duration', value: result.duration_seconds != null ? `${result.duration_seconds}s` : '—' },
                { label: 'Source', value: result.source ?? (result.is_mock ? 'Mock Fallback' : 'Databricks') },
                { label: 'Rows Returned', value: (result.data ?? result.result?.data)?.length ?? 0 },
                { label: 'Columns', value: result.data?.[0] ? Object.keys(result.data[0]).length : 0 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
                  <div className="text-sm font-mono text-slate-200 truncate">{String(value)}</div>
                </div>
              ))}
            </div>
            {result.is_mock && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-500/20 rounded-xl px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Fallback mode active — Databricks unreachable. Showing generated mock data.
              </div>
            )}
          </Section>

          {/* Output Table */}
          <Section title="Output Table" icon={Table2} defaultOpen={true}
            badge={hasRows ? `${(result.data ?? result.result?.data).length} rows` : "empty"}>
            <div className="flex justify-end mb-3">
              <button id="notebook-copy-json-btn" onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition">
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy JSON'}
              </button>
            </div>
            <ResultTable data={result.data ?? result.result?.data} />
          </Section>

          {/* Raw JSON */}
          <Section title="Raw JSON Response" icon={BookOpen} defaultOpen={false}>
            <pre className="text-[11px] text-slate-300 font-mono bg-slate-950/70 border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-72 leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </Section>
        </>
      )}
    </div>
  );
}

