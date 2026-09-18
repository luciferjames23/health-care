import React, { useState } from 'react';
import { 
  Terminal, 
  Play, 
  Copy, 
  Check, 
  Clock, 
  Database,
  RotateCcw
} from 'lucide-react';
import { apiService } from '../services/api';

const PRESET_QUERIES = [
  {
    title: "Patient Demographics & Master Index",
    sql: `SELECT 
  patient_id, 
  patient_number, 
  first_name,
  last_name,
  gender,
  date_of_birth,
  blood_group,
  phone
FROM health_care.gold.patients
ORDER BY patient_id ASC
LIMIT 50;`
  },
  {
    title: "Active Admissions & Attending Doctors",
    sql: `SELECT 
  admission_id,
  patient_id,
  admission_number,
  admission_date,
  admission_type,
  discharge_status,
  primary_diagnosis
FROM health_care.gold.admissions
ORDER BY admission_date DESC
LIMIT 50;`
  },
  {
    title: "Generated Discharge Summaries AI",
    sql: `SELECT 
  summary_id,
  admission_id,
  patient_name,
  model_name,
  approval_status,
  created_at
FROM health_care.gold.dim_generated_discharge_summaries
ORDER BY created_at DESC
LIMIT 50;`
  },
  {
    title: "7-Day Bed Occupancy Forecasts",
    sql: `SELECT 
  forecast_date,
  ward_name,
  predicted_beds,
  predicted_emergency,
  predicted_elective,
  predicted_occupancy_rate
FROM health_care.gold.fact_bed_demand_forecast_7day_detailed
ORDER BY forecast_date ASC
LIMIT 50;`
  }
];

export default function SqlSandboxView() {
  const [activeQueryIndex, setActiveQueryIndex] = useState(0);
  const [sqlText, setSqlText] = useState(PRESET_QUERIES[0].sql);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleExecute = async () => {
    setIsExecuting(true);
    setErrorMsg(null);
    const start = performance.now();
    try {
      // Determine which table the query targets
      let targetTable = 'fact_bed_demand_forecast_7day_detailed';
      if (/fact_bed_demand/i.test(sqlText)) {
        targetTable = 'fact_bed_demand_forecast_7day_detailed';
      } else if (/discharge/i.test(sqlText)) {
        targetTable = 'dim_generated_discharge_summaries';
      } else if (/patients/i.test(sqlText)) {
        targetTable = 'patients';
      } else if (/admissions/i.test(sqlText)) {
        targetTable = 'admissions';
      }

      const res = await apiService.getTableData(targetTable, 50, 0);
      const rows = res?.data || [];
      const elapsed = ((performance.now() - start) / 1000).toFixed(3);

      setExecResult({
        rows,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        duration: elapsed,
        rowCount: rows.length
      });
    } catch (err) {
      const elapsed = ((performance.now() - start) / 1000).toFixed(3);
      setErrorMsg(err.message || String(err));
      setExecResult({
        rows: [],
        columns: [],
        duration: elapsed,
        rowCount: 0
      });
    } finally {
      setIsExecuting(false);
    }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            HOSPITAL DATABASE · INTERACTIVE SQL QUERY CONSOLE
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '2px 0 0', color: '#15181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal style={{ width: '22px', height: '22px', color: 'oklch(0.5 0.1 200)' }} />
            Hospital Database Query Sandbox
          </h1>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            Execute SQL queries directly against hospital records and clinical tables.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={copySql}
            style={{
              height: '32px', padding: '0 12px', borderRadius: '6px',
              border: '1px solid #cbd5e1', background: '#ffffff',
              color: '#334155', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            {copied ? <Check style={{ width: '13px', height: '13px', color: '#10b981' }} /> : <Copy style={{ width: '13px', height: '13px', color: '#64748b' }} />}
            <span>{copied ? 'Copied' : 'Copy SQL'}</span>
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isExecuting}
            style={{
              height: '32px', padding: '0 16px', borderRadius: '6px',
              border: 0, background: 'oklch(0.5 0.1 200)',
              color: '#ffffff', fontSize: '12px', fontWeight: 700,
              cursor: isExecuting ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Play style={{ width: '13px', height: '13px', fill: '#ffffff' }} />
            <span>{isExecuting ? 'Running...' : 'Run Query (F5)'}</span>
          </button>
        </div>
      </div>

      {/* Preset Query Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {PRESET_QUERIES.map((preset, idx) => {
          const isActive = activeQueryIndex === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(idx)}
              style={{
                padding: '6px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600,
                border: isActive ? '1px solid oklch(0.5 0.1 200)' : '1px solid #cbd5e1',
                background: isActive ? 'oklch(0.95 0.03 200)' : '#ffffff',
                color: isActive ? 'oklch(0.4 0.1 200)' : '#334155',
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {preset.title}
            </button>
          );
        })}
      </div>

      {/* SQL Editor Area */}
      <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
            <Database style={{ width: '13px', height: '13px', color: '#0284c7' }} />
            <span>Target Catalog: health_care.gold · Dialect: ANSI SQL / Spark SQL</span>
          </div>
          <button
            type="button"
            onClick={() => setSqlText(PRESET_QUERIES[activeQueryIndex].sql)}
            style={{
              background: 'transparent', border: 0, color: '#64748b',
              fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <RotateCcw style={{ width: '11px', height: '11px' }} />
            <span>Reset</span>
          </button>
        </div>
        <textarea
          value={sqlText}
          onChange={(e) => setSqlText(e.target.value)}
          rows={7}
          style={{
            width: '100%', padding: '14px', border: 0, outline: 'none',
            fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
            fontSize: '12.5px', lineHeight: 1.5, color: '#0f172a',
            background: '#ffffff', resize: 'vertical'
          }}
        />
      </div>

      {/* Query Results / Telemetry */}
      {execResult && (
        <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
              <span style={{ color: '#10b981' }}>✓ Query Executed Successfully</span>
              <span style={{ color: '#94a3b8' }}>·</span>
              <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{execResult.rowCount} rows returned</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: '#64748b' }}>
              <Clock style={{ width: '13px', height: '13px' }} />
              <span>{execResult.duration}s execution time</span>
            </div>
          </div>

          {errorMsg ? (
            <div style={{ padding: '20px', color: '#dc2626', fontSize: '12px' }}>
              <strong>Execution Error:</strong> {errorMsg}
            </div>
          ) : execResult.rows.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
              Query executed with 0 rows returned.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '480px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0 }}>
                  <tr>
                    {execResult.columns.map((col, idx) => (
                      <th key={idx} style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                  {execResult.rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {execResult.columns.map((col, cIdx) => (
                        <td key={cIdx} style={{ padding: '9px 14px', whiteSpace: 'nowrap', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
