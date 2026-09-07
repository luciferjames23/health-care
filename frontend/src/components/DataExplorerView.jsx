import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  Filter,
  FileJson,
  FileSpreadsheet
} from 'lucide-react';
import { apiService } from '../services/api';

export default function DataExplorerView({ tables = [], initialTable = 'dim_patient' }) {
  const [selectedTable, setSelectedTable] = useState(initialTable);
  const [dataResult, setDataResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (initialTable) {
      setSelectedTable(initialTable);
      setOffset(0);
    }
  }, [initialTable]);

  useEffect(() => {
    async function loadData() {
      if (!selectedTable) return;
      setLoading(true);
      try {
        const res = await apiService.getTableData(selectedTable, limit, offset);
        setDataResult(res);
      } catch (err) {
        console.error("Failed to load table data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedTable, limit, offset]);

  const rawRows = dataResult?.data || [];
  
  // Client-side row search filter across all values
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
    a.download = `${selectedTable}_gold_export.csv`;
    a.click();
  };

  const handleExportJSON = () => {
    if (!rawRows.length) return;
    const blob = new Blob([JSON.stringify(rawRows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable}_gold_export.json`;
    a.click();
  };

  const totalRows = dataResult?.total_rows || rawRows.length;
  const totalPages = Math.ceil(totalRows / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      
      {/* Control Bar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-400" />
            Interactive Data Grid & Query Previewer
          </h2>
          <p className="text-xs text-slate-400">
            Query live rows from Databricks Gold tables with real-time pagination and export options.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            disabled={!rawRows.length}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            disabled={!rawRows.length}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          >
            <FileJson className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filters and Controls Card */}
      <div className="glass-panel rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Table Selector & Search */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-400 font-semibold">Table:</label>
            <select
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value);
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              {tables.map((t) => (
                <option key={t.table_name} value={t.table_name}>
                  {t.table_name} ({(t.row_count || 0).toLocaleString()} rows)
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter current view..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Page Size & Pagination Controls */}
        <div className="flex items-center space-x-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Rows / page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
              className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= totalRows}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Data Grid */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center space-y-3">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <span className="text-xs font-mono">Loading data from health_care.gold.{selectedTable}...</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-mono">
            No rows found for table '{selectedTable}'.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 text-center w-12 border-r border-slate-800">#</th>
                  {columns.map(col => (
                    <th key={col} className="py-3 px-4 whitespace-nowrap font-mono text-cyan-400">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 text-center text-slate-500 border-r border-slate-800/60 select-none">
                      {offset + rIdx + 1}
                    </td>
                    {columns.map(col => {
                      const val = row[col];
                      const isNull = val === null || val === undefined;
                      const isBool = typeof val === 'boolean';
                      return (
                        <td key={col} className="py-2.5 px-4 whitespace-nowrap">
                          {isNull ? (
                            <span className="text-slate-600 italic">null</span>
                          ) : isBool ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] ${val ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                              {String(val)}
                            </span>
                          ) : (
                            <span>{String(val)}</span>
                          )}
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
