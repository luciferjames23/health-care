import React, { useState, useEffect } from 'react';
import { 
  TableProperties, 
  Search, 
  Key, 
  Eye, 
  Layers, 
  Copy, 
  Check, 
  RefreshCw,
  FileCode,
  ShieldAlert
} from 'lucide-react';
import { apiService } from '../services/api';

export default function SchemaExplorerView({ tables = [], initialTable = 'patients', onViewData }) {
  const [tableList, setTableList] = useState(tables);
  const [selectedTable, setSelectedTable] = useState(initialTable);
  const [schemaData, setSchemaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function initTables() {
      if (tables && tables.length > 0) {
        setTableList(tables);
        return;
      }
      try {
        const res = await apiService.getPostgresTables();
        const tList = res.tables || [];
        setTableList(tList);
        if (tList.length > 0 && (!selectedTable || selectedTable === 'dim_patient')) {
          setSelectedTable(tList[0].table_name);
        }
      } catch (err) {
        console.error("Failed to load tables list", err);
      }
    }
    initTables();
  }, [tables]);

  useEffect(() => {
    if (initialTable && initialTable !== 'dim_patient') {
      setSelectedTable(initialTable);
    }
  }, [initialTable]);

  useEffect(() => {
    async function loadSchema() {
      if (!selectedTable) return;
      if (!schemaData) {
        setLoading(true);
      }
      try {
        const res = await apiService.getTableSchema(selectedTable);
        setSchemaData(res);
      } catch (err) {
        console.error("Failed to load schema", err);
      } finally {
        setLoading(false);
      }
    }
    loadSchema();
  }, [selectedTable]);

  const filteredTables = tableList.filter(t => 
    t.table_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.domain && t.domain.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentTableObj = tableList.find(t => t.table_name === selectedTable) || {
    table_name: selectedTable,
    catalog: 'postgres',
    schema: 'public',
    row_count: 0
  };

  const copySqlSelect = () => {
    if (!schemaData?.columns) return;
    const cols = schemaData.columns.map(c => c.column_name).join(',\n  ');
    const sql = `SELECT\n  ${cols}\nFROM health_care.gold.${selectedTable}\nLIMIT 100;`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeBadgeColor = (type) => {
    const t = (type || '').toUpperCase();
    if (t.includes('INT') || t.includes('BIGINT')) return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30';
    if (t.includes('DOUBLE') || t.includes('DECIMAL') || t.includes('NUMERIC')) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
    if (t.includes('DATE') || t.includes('TIMESTAMP')) return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
    if (t.includes('BOOL')) return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  return (
    <div className="space-y-6">
      
      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TableProperties className="w-5 h-5 text-cyan-400" />
            Gold Schema & Data Dictionary Explorer
          </h2>
          <p className="text-xs text-slate-400">
            Inspect table definitions, column types, primary keys, and description metadata for Databricks Gold schema.
          </p>
        </div>

        {selectedTable && (
          <div className="flex items-center space-x-2">
            <button
              onClick={copySqlSelect}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'SQL Copied!' : 'Copy SELECT SQL'}</span>
            </button>
            <button
              onClick={() => onViewData(selectedTable)}
              className="flex items-center space-x-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md shadow-cyan-500/20"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Query Data Grid</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Table List */}
        <div className="glass-panel rounded-xl p-4 border border-slate-800 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {filteredTables.map((t) => {
              const isSelected = selectedTable === t.table_name;
              return (
                <button
                  key={t.table_name}
                  onClick={() => setSelectedTable(t.table_name)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-sm'
                      : 'bg-slate-900/50 hover:bg-slate-800/80 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-mono text-xs font-bold">{t.table_name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{t.domain || 'Gold Table'}</div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {(t.row_count || 0).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Schema Detail Table */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Table Metadata Header Card */}
          <div className="glass-panel rounded-xl p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3">
                <span className="font-mono text-xs text-cyan-400 font-semibold px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
                  health_care.gold
                </span>
                <span className="text-xs text-slate-400">Delta Lake Format</span>
              </div>
              <h3 className="text-xl font-bold font-mono text-white mt-1">
                {currentTableObj.table_name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {currentTableObj.description || 'Gold layer curated analytical dataset.'}
              </p>
            </div>

            <div className="flex items-center space-x-3 text-center sm:text-right">
              <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
                <div className="text-xs text-slate-400">Columns</div>
                <div className="text-sm font-bold font-mono text-cyan-400">
                  {schemaData?.columns?.length || 0}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
                <div className="text-xs text-slate-400">Total Rows</div>
                <div className="text-sm font-bold font-mono text-emerald-400">
                  {(currentTableObj.row_count || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Column Dictionary Table */}
          <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center space-y-3">
                <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                <span className="text-xs font-mono">Fetching Databricks DESCRIBE TABLE schema...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Column Name</th>
                      <th className="py-3 px-4">Data Type</th>
                      <th className="py-3 px-4">Constraint</th>
                      <th className="py-3 px-4">Description & Usage Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {schemaData?.columns?.map((col, idx) => {
                      const isPk = col.is_primary || col.column_name.endsWith('_id');
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-cyan-300 flex items-center gap-2">
                            {isPk && <Key className="w-3 h-3 text-amber-400 shrink-0" />}
                            <span>{col.column_name}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] border font-mono ${getTypeBadgeColor(col.data_type)}`}>
                              {col.data_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] font-sans">
                            {col.is_primary ? (
                              <span className="text-amber-400 font-medium">PRIMARY KEY</span>
                            ) : (
                              <span className="text-slate-500">NULLABLE</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] font-sans">
                            {col.description || `Field ${col.column_name} in ${selectedTable}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
