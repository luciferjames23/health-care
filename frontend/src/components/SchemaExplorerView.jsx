import React, { useState, useEffect } from 'react';
import { 
  TableProperties, 
  Search, 
  Key, 
  Eye, 
  Copy, 
  Check, 
  RefreshCw,
  Database
} from 'lucide-react';
import { apiService } from '../services/api';

const GOLD_TABLES_FALLBACK = [
  {
    table_name: "dim_revenue_predictions",
    domain: "Financial & Predictive Analytics",
    row_count: 1000,
    primary_key: "revenue_prediction_id",
    description: "Departmental and patient-level revenue projections, actual amounts, prediction variances, and monthly totals.",
    columns: [
      { column_name: "revenue_prediction_id", data_type: "BIGINT", is_primary: true, description: "Unique revenue prediction record identifier" },
      { column_name: "bill_number", data_type: "STRING", is_primary: false, description: "Hospital IPD billing identifier" },
      { column_name: "patient_id", data_type: "BIGINT", is_primary: false, description: "Foreign key reference to patient" },
      { column_name: "patient_number", data_type: "STRING", is_primary: false, description: "Patient hospital registration code" },
      { column_name: "patient_name", data_type: "STRING", is_primary: false, description: "Patient full legal name" },
      { column_name: "bill_date", data_type: "TIMESTAMP", is_primary: false, description: "Date of financial invoice generation" },
      { column_name: "bill_status", data_type: "STRING", is_primary: false, description: "Settlement clearance status" },
      { column_name: "actual_net_amount", data_type: "DOUBLE", is_primary: false, description: "Audited actual collection amount in INR" },
      { column_name: "predicted_revenue", data_type: "DOUBLE", is_primary: false, description: "AI regression model predicted collection" },
      { column_name: "prediction_variance", data_type: "DOUBLE", is_primary: false, description: "Variance between forecast and actuals" },
      { column_name: "model_name", data_type: "STRING", is_primary: false, description: "Databricks MLflow model version identifier" }
    ]
  },
  {
    table_name: "fact_bed_demand_forecast_7day_detailed",
    domain: "Clinical Operations & Bed Management",
    row_count: 350,
    primary_key: "forecast_date, ward_id",
    description: "Detailed 7-day rolling bed demand and ward unit occupancy forecasts including predicted emergency/elective beds.",
    columns: [
      { column_name: "forecast_date", data_type: "DATE", is_primary: true, description: "Target forecast calendar date" },
      { column_name: "ward_id", data_type: "INT", is_primary: true, description: "Internal ward unit reference key" },
      { column_name: "ward_name", data_type: "STRING", is_primary: false, description: "Clinical ward name" },
      { column_name: "floor_number", data_type: "INT", is_primary: false, description: "Hospital building floor location" },
      { column_name: "department_name", data_type: "STRING", is_primary: false, description: "Specialty department assignment" },
      { column_name: "predicted_beds", data_type: "INT", is_primary: false, description: "Total predicted occupied beds" },
      { column_name: "predicted_emergency", data_type: "INT", is_primary: false, description: "Predicted acute triage arrivals" },
      { column_name: "predicted_elective", data_type: "INT", is_primary: false, description: "Scheduled elective admissions" },
      { column_name: "predicted_occupancy_rate", data_type: "DOUBLE", is_primary: false, description: "Projected percentage occupancy" }
    ]
  },
  {
    table_name: "dim_generated_discharge_summaries",
    domain: "LLM & Clinical AI Analytics",
    row_count: 50,
    primary_key: "summary_id",
    description: "AI-generated clinical discharge summaries containing diagnoses, case history, treatment, and physician approvals.",
    columns: [
      { column_name: "summary_id", data_type: "BIGINT", is_primary: true, description: "Unique discharge document ID" },
      { column_name: "admission_id", data_type: "BIGINT", is_primary: false, description: "Inpatient stay encounter ID" },
      { column_name: "patient_id", data_type: "BIGINT", is_primary: false, description: "Master patient reference" },
      { column_name: "diagnoses", data_type: "STRING", is_primary: false, description: "Primary and secondary ICD-10 diagnoses" },
      { column_name: "case_history", data_type: "STRING", is_primary: false, description: "Clinical course and presentation narrative" },
      { column_name: "investigations", data_type: "STRING", is_primary: false, description: "Lab parameters and imaging findings" },
      { column_name: "treatment", data_type: "STRING", is_primary: false, description: "Medications and procedures administered" },
      { column_name: "primary_consultant", data_type: "STRING", is_primary: false, description: "Attending consultant physician" },
      { column_name: "discharge_advice", data_type: "STRING", is_primary: false, description: "Take-home prescription and red-flag alerts" },
      { column_name: "approval_status", data_type: "STRING", is_primary: false, description: "Doctor review workflow status" }
    ]
  },
  {
    table_name: "patients",
    domain: "Front Office & Master Index",
    row_count: 4000,
    primary_key: "patient_id",
    description: "Enterprise Patient Master Index (EMPI) containing demographics, contact information, and registration history.",
    columns: [
      { column_name: "patient_id", data_type: "BIGINT", is_primary: true, description: "Unique Master Patient Index identifier" },
      { column_name: "patient_number", data_type: "STRING", is_primary: false, description: "Hospital UHID tracking number" },
      { column_name: "first_name", data_type: "STRING", is_primary: false, description: "Patient legal first name" },
      { column_name: "last_name", data_type: "STRING", is_primary: false, description: "Patient legal surname" },
      { column_name: "gender", data_type: "STRING", is_primary: false, description: "Biological sex / gender identity" },
      { column_name: "date_of_birth", data_type: "DATE", is_primary: false, description: "Date of birth (YYYY-MM-DD)" },
      { column_name: "blood_group", data_type: "STRING", is_primary: false, description: "ABO and Rh blood group classification" },
      { column_name: "phone", data_type: "STRING", is_primary: false, description: "Primary verified contact telephone number" },
      { column_name: "city", data_type: "STRING", is_primary: false, description: "Residential municipality / city" }
    ]
  },
  {
    table_name: "admissions",
    domain: "Clinical Operations & Inpatient",
    row_count: 250,
    primary_key: "admission_id",
    description: "Hospital admission encounters, active inpatient stays, attending doctor assignments, and discharge disposition.",
    columns: [
      { column_name: "admission_id", data_type: "BIGINT", is_primary: true, description: "Unique inpatient encounter identifier" },
      { column_name: "patient_id", data_type: "BIGINT", is_primary: false, description: "Foreign key to patients table" },
      { column_name: "admission_number", data_type: "STRING", is_primary: false, description: "Encounter tracking registration code" },
      { column_name: "admission_date", data_type: "TIMESTAMP", is_primary: false, description: "Date and time of inpatient bed booking" },
      { column_name: "admission_type", data_type: "STRING", is_primary: false, description: "Elective, Emergency, or Transfer encounter" },
      { column_name: "discharge_status", data_type: "STRING", is_primary: false, description: "Admitted, Ready for Discharge, or Discharged" },
      { column_name: "primary_diagnosis", data_type: "STRING", is_primary: false, description: "Definitive ICD admission diagnosis" }
    ]
  }
];

export default function SchemaExplorerView({ tables = [], initialTable = 'dim_revenue_predictions', onViewData }) {
  const [tableList, setTableList] = useState(GOLD_TABLES_FALLBACK);
  const [selectedTable, setSelectedTable] = useState(initialTable || 'dim_revenue_predictions');
  const [schemaData, setSchemaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function initTables() {
      try {
        const res = await apiService.getPostgresTables();
        const tList = res.tables || [];
        if (tList.length > 0) {
          setTableList(tList);
          if (!selectedTable || selectedTable === 'patients') {
            setSelectedTable(tList[0].table_name);
          }
        }
      } catch (err) {
        console.warn("Using fallback tables list:", err);
      }
    }
    initTables();
  }, []);

  useEffect(() => {
    async function loadSchema() {
      if (!selectedTable) return;
      setLoading(true);
      try {
        const res = await apiService.getTableSchema(selectedTable);
        if (res && res.columns && res.columns.length > 0) {
          setSchemaData(res);
        } else {
          // Fallback to local table metadata
          const local = GOLD_TABLES_FALLBACK.find(t => t.table_name.toLowerCase() === selectedTable.toLowerCase()) || GOLD_TABLES_FALLBACK[0];
          setSchemaData(local);
        }
      } catch (err) {
        console.warn("Using fallback table schema:", err);
        const local = GOLD_TABLES_FALLBACK.find(t => t.table_name.toLowerCase() === selectedTable.toLowerCase()) || GOLD_TABLES_FALLBACK[0];
        setSchemaData(local);
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

  const currentTableObj = tableList.find(t => t.table_name === selectedTable) || schemaData || GOLD_TABLES_FALLBACK[0];

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
    if (t.includes('INT')) return { bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd' };
    if (t.includes('DOUBLE') || t.includes('DECIMAL')) return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
    if (t.includes('DATE') || t.includes('TIMESTAMP')) return { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' };
    if (t.includes('BOOL')) return { bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
    return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Header Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            DATABRICKS LAKEHOUSE · GOLD LAYER METADATA
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '2px 0 0', color: '#15181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TableProperties style={{ width: '22px', height: '22px', color: 'oklch(0.5 0.1 200)' }} />
            Gold Schema &amp; Data Dictionary Explorer
          </h1>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            Inspect table definitions, column types, primary keys, and description metadata for Databricks Gold schema.
          </div>
        </div>

        {selectedTable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={copySqlSelect}
              style={{
                height: '32px', padding: '0 12px', borderRadius: '6px',
                border: '1px solid #cbd5e1', background: '#ffffff',
                color: '#334155', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              {copied ? <Check style={{ width: '13px', height: '13px', color: '#10b981' }} /> : <Copy style={{ width: '13px', height: '13px', color: '#64748b' }} />}
              <span>{copied ? 'SQL Copied!' : 'Copy SELECT SQL'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (onViewData) onViewData(selectedTable);
                else alert(`Querying data grid for ${selectedTable}`);
              }}
              style={{
                height: '32px', padding: '0 14px', borderRadius: '6px',
                border: 0, background: 'oklch(0.5 0.1 200)',
                color: '#ffffff', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Eye style={{ width: '13px', height: '13px' }} />
              <span>Query Data Grid</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Left Side: Table List */}
        <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search style={{ width: '14px', height: '14px', color: '#94a3b8', position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', height: '32px', paddingLeft: '32px', paddingRight: '10px',
                borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px',
                outline: 'none', background: '#f8fafc', color: '#0f172a'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '540px', overflowY: 'auto' }}>
            {filteredTables.map((t) => {
              const isSelected = selectedTable === t.table_name;
              return (
                <button
                  key={t.table_name}
                  type="button"
                  onClick={() => setSelectedTable(t.table_name)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '6px',
                    border: isSelected ? '1px solid oklch(0.5 0.1 200)' : '1px solid #f1f5f9',
                    background: isSelected ? 'oklch(0.95 0.03 200)' : '#ffffff',
                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: isSelected ? 'oklch(0.4 0.1 200)' : '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {t.table_name}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                      {t.domain || 'Gold Lakehouse'}
                    </div>
                  </div>
                  <span style={{
                    fontFamily: 'monospace', fontSize: '10px', color: '#475569',
                    background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px'
                  }}>
                    {(t.row_count || 0).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Schema Detail Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Table Metadata Header Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: '11px', color: '#0369a1', fontWeight: 600,
                    padding: '2px 8px', background: '#e0f2fe', borderRadius: '12px'
                  }}>
                    health_care.gold
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>Delta Lake Format</span>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', margin: '6px 0 2px', color: '#0f172a' }}>
                  {currentTableObj.table_name}
                </h2>
                <div style={{ color: '#52585e', fontSize: '12px' }}>
                  {currentTableObj.description || 'Gold layer curated analytical dataset.'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase' }}>Columns</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace', color: '#0284c7' }}>
                    {schemaData?.columns?.length || currentTableObj.columns?.length || 0}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 14px', borderRadius: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10.5px', color: '#64748b', textTransform: 'uppercase' }}>Total Rows</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'monospace', color: '#10b981' }}>
                    {(currentTableObj.row_count || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column Dictionary Table */}
          <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            {loading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <RefreshCw style={{ width: '22px', height: '22px', animation: 'kpi-spin 1s linear infinite', color: '#0284c7' }} />
                <span style={{ fontSize: '12px' }}>Fetching Databricks DESCRIBE TABLE schema...</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>Column Name</th>
                      <th style={{ padding: '10px 14px' }}>Data Type</th>
                      <th style={{ padding: '10px 14px' }}>Constraint</th>
                      <th style={{ padding: '10px 14px' }}>Description &amp; Usage Notes</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                    {(schemaData?.columns || currentTableObj?.columns || []).map((col, idx) => {
                      const isPk = col.is_primary || col.column_name.endsWith('_id');
                      const badge = getTypeBadgeColor(col.data_type);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isPk && <Key style={{ width: '13px', height: '13px', color: '#f59e0b', flexShrink: 0 }} />}
                              <span>{col.column_name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                              background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`
                            }}>
                              {col.data_type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'inherit', fontSize: '11px' }}>
                            {col.is_primary ? (
                              <span style={{ color: '#d97706', fontWeight: 700 }}>PRIMARY KEY</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>NULLABLE</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontFamily: 'inherit', fontSize: '11.5px' }}>
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
