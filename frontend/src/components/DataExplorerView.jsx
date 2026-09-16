import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  FileSpreadsheet,
  FileJson
} from 'lucide-react';
import { apiService } from '../services/api';

const DEFAULT_TABLES = [
  { table_name: 'dim_revenue_predictions', domain: 'Financial', row_count: 1000 },
  { table_name: 'fact_bed_demand_forecast_7day_detailed', domain: 'Operations', row_count: 350 },
  { table_name: 'dim_generated_discharge_summaries', domain: 'Discharge AI', row_count: 50 },
  { table_name: 'patients', domain: 'Master Index', row_count: 4000 },
  { table_name: 'admissions', domain: 'Inpatients', row_count: 250 }
];

export default function DataExplorerView({ tables = [], initialTable = 'dim_revenue_predictions' }) {
  const [tableList, setTableList] = useState(DEFAULT_TABLES);
  const [selectedTable, setSelectedTable] = useState(initialTable || 'dim_revenue_predictions');
  const [dataResult, setDataResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    async function initTables() {
      try {
        const res = await apiService.getPostgresTables();
        const tList = res.tables || [];
        if (tList.length > 0) {
          setTableList(tList);
        }
      } catch (err) {
        console.warn("Using default tables for Data Grid:", err);
      }
    }
    initTables();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!selectedTable) return;
      setLoading(true);
      try {
        const res = await apiService.getTableData(selectedTable, limit, offset);
        if (res && res.data) {
          setDataResult(res);
        } else {
          setDataResult({ data: [], total_rows: 0 });
        }
      } catch (err) {
        console.warn("Failed to load table data:", err);
        setDataResult({ data: [], total_rows: 0 });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedTable, limit, offset]);

  const rawRows = dataResult?.data || [];
  
  const filteredRows = rawRows.filter(row => {
    if (!searchFilter.trim()) return true;
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchFilter.toLowerCase())
    );
  });

  const columns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

  const handleExportCSV = () => {
    if (!rawRows.length) return;
    const headers = columns.join(',');
    const csvLines = rawRows.map(row => 
      columns.map(col => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers, ...csvLines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_export.csv`;
    a.click();
  };

  const handleExportJSON = () => {
    if (!rawRows.length) return;
    const blob = new Blob([JSON.stringify(rawRows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_export.json`;
    a.click();
  };

  const totalRows = dataResult?.total_rows || rawRows.length;
  const totalPages = Math.ceil(totalRows / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            DATABRICKS LAKEHOUSE · INTERACTIVE QUERY VIEWER
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '2px 0 0', color: '#15181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database style={{ width: '22px', height: '22px', color: 'oklch(0.5 0.1 200)' }} />
            Interactive Data Grid &amp; Query Previewer
          </h1>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            Query live records from Databricks Gold lakehouse tables with real-time pagination and export options.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!rawRows.length}
            style={{
              height: '32px', padding: '0 12px', borderRadius: '6px',
              border: '1px solid #cbd5e1', background: '#ffffff',
              color: '#334155', fontSize: '12px', fontWeight: 600,
              cursor: rawRows.length ? 'pointer' : 'not-allowed',
              opacity: rawRows.length ? 1 : 0.5,
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <FileSpreadsheet style={{ width: '13px', height: '13px', color: '#10b981' }} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={!rawRows.length}
            style={{
              height: '32px', padding: '0 12px', borderRadius: '6px',
              border: '1px solid #cbd5e1', background: '#ffffff',
              color: '#334155', fontSize: '12px', fontWeight: 600,
              cursor: rawRows.length ? 'pointer' : 'not-allowed',
              opacity: rawRows.length ? 1 : 0.5,
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <FileJson style={{ width: '13px', height: '13px', color: '#0284c7' }} />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Control Bar Card */}
      <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Table:</span>
            <select
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value);
                setOffset(0);
              }}
              style={{
                height: '32px', padding: '0 10px', borderRadius: '6px',
                border: '1px solid #cbd5e1', fontSize: '12px',
                fontWeight: 600, background: '#ffffff', color: '#0f172a', outline: 'none'
              }}
            >
              {tableList.map(t => (
                <option key={t.table_name} value={t.table_name}>
                  {t.table_name} ({t.domain || 'Lakehouse'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search style={{ width: '13px', height: '13px', color: '#94a3b8', position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Filter current rows..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                width: '100%', height: '32px', paddingLeft: '30px', paddingRight: '10px',
                borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px',
                outline: 'none', background: '#f8fafc', color: '#0f172a'
              }}
            />
          </div>
        </div>

        {/* Pagination controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalRows.toLocaleString()} rows)
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              style={{
                height: '30px', width: '30px', borderRadius: '6px',
                border: '1px solid #cbd5e1', background: '#ffffff',
                cursor: offset === 0 ? 'not-allowed' : 'pointer',
                opacity: offset === 0 ? 0.4 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <ChevronLeft style={{ width: '14px', height: '14px' }} />
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + limit)}
              disabled={currentPage >= totalPages}
              style={{
                height: '30px', width: '30px', borderRadius: '6px',
                border: '1px solid #cbd5e1', background: '#ffffff',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage >= totalPages ? 0.4 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <ChevronRight style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <RefreshCw style={{ width: '22px', height: '22px', animation: 'kpi-spin 1s linear infinite', color: '#0284c7' }} />
            <span style={{ fontSize: '12px' }}>Querying {selectedTable} from Gold Lakehouse...</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>No rows found in {selectedTable}</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>Try switching tables or resetting search filter</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em', position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  {columns.map((col, idx) => (
                    <th key={idx} style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                {filteredRows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {columns.map((col, cIdx) => {
                      const val = row[col];
                      const str = val !== null && val !== undefined ? String(val) : '—';
                      return (
                        <td key={cIdx} style={{ padding: '9px 14px', whiteSpace: 'nowrap', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {str}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
