import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Download, 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown,
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { apiService } from '../services/api';
import ModuleLoadingScreen from './ModuleLoadingScreen';

export default function LiveDataQualityView({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortAsc, setSortAsc] = useState(true);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedRule, setSelectedRule] = useState(null);

  const fetchQualityData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getLiveDataQuality();
      if (res && res.success) {
        setData(res);
      }
    } catch (err) {
      console.error("Failed to load live data quality:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualityData();
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const rawRules = data?.rules || [];

  // Normalize data to ensure all columns (rule, domain, pass_rate, failures, owner, status) are ALWAYS populated
  const normalizedRules = useMemo(() => {
    const domainOwners = {
      'Operations': 'Bed manager',
      'Clinical Operations': 'Bed manager',
      'Finance': 'Insurance Desk',
      'Revenue Cycle': 'Insurance Desk',
      'Patient': 'Front Office',
      'Patient Master': 'Front Office',
      'Governance': 'Governance Officer',
      'Clinical': 'Laboratory',
      'Clinical Coding': 'Laboratory',
      'Telemetry / Safety': 'Clinical Engineering',
      'Knowledge': 'Knowledge Manager'
    };

    return rawRules.map((r, idx) => {
      const domain = r.domain || 'Operations';
      const rule = r.rule || r.rule_name || r.name || 'Validation Rule';
      const failures = r.failures !== undefined ? r.failures : (r.failed_records !== undefined ? r.failed_records : 0);
      const passRateNum = r.pass_rate_num !== undefined ? r.pass_rate_num : (r.compliance_pct !== undefined ? r.compliance_pct : 100);
      const passRate = r.pass_rate || (Number.isInteger(passRateNum) ? `${passRateNum}%` : `${passRateNum.toFixed(1)}%`);
      const owner = r.owner || domainOwners[domain] || 'System Admin';
      const status = (r.status === 'Passed' || r.status === 'Optimal') ? 'Pass' : (r.status || (failures === 0 ? 'Pass' : passRateNum >= 95 ? 'Review' : 'Failed'));
      const totalChecked = r.total_checked || r.total || 100;
      const targetTable = r.target_table || 'Database';

      return {
        id: r.id || idx + 1,
        rule,
        domain,
        pass_rate: passRate,
        pass_rate_num: passRateNum,
        failures,
        total_checked: totalChecked,
        owner,
        status,
        target_table: targetTable
      };
    });
  }, [rawRules]);

  // Filter & Sort
  const filteredRules = useMemo(() => {
    let result = normalizedRules.filter(r => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        r.rule?.toLowerCase().includes(query) ||
        r.domain?.toLowerCase().includes(query) ||
        r.owner?.toLowerCase().includes(query) ||
        r.status?.toLowerCase().includes(query) ||
        r.pass_rate?.toLowerCase().includes(query)
      );
    });

    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'pass_rate') {
        valA = a.pass_rate_num || 0;
        valB = b.pass_rate_num || 0;
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return result;
  }, [normalizedRules, searchQuery, sortField, sortAsc]);

  // Export to CSV
  const handleExportCsv = () => {
    if (!filteredRules || filteredRules.length === 0) return;
    const headers = ['Rule', 'Domain', 'Pass Rate', 'Failures', 'Total Checked', 'Owner', 'Status', 'Target Table'];
    const rows = filteredRules.map(r => [
      `"${(r.rule || '').replace(/"/g, '""')}"`,
      `"${r.domain || ''}"`,
      `"${r.pass_rate || ''}"`,
      r.failures ?? 0,
      r.total_checked ?? 0,
      `"${r.owner || ''}"`,
      `"${r.status || ''}"`,
      `"${r.target_table || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `data_quality_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !data) {
    return (
      <ModuleLoadingScreen
        title="Evaluating Dynamic Data Quality Rules..."
        subtitle="Executing live SQL assertions across PostgreSQL tables (inpatients, insurance, patients, consents, lab, knowledge)..."
        badgeText="Live Data Quality"
        showKpis={false}
        layout="table"
        tableRows={6}
        tableColumns={6}
      />
    );
  }

  const renderStatusBadge = (status) => {
    let bg = '#dcfce7';
    let color = '#15803d';

    if (status === 'Review') {
      bg = '#fef3c7';
      color = '#b45309';
    } else if (status === 'Failed') {
      bg = '#fee2e2';
      color = '#dc2626';
    }

    return (
      <span style={{
        background: bg,
        color: color,
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '11.5px',
        fontWeight: 600,
        display: 'inline-block',
        minWidth: '54px',
        textAlign: 'center'
      }}>
        {status}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.2s ease-in-out' }}>
      
      {/* Top Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
        <button
          type="button"
          onClick={() => {
            if (typeof onBack === 'function') onBack();
            else window.history.back();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#0284c7',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            padding: 0
          }}
        >
          ← Back
        </button>
        <span style={{ color: '#cbd5e1' }}>·</span>
        <span>Command Centre</span>
        <span style={{ color: '#94a3b8' }}>›</span>
        <span style={{ color: '#1e293b', fontWeight: 600 }}>Data Quality</span>
      </div>

      {/* Main Title & Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 2px', color: '#0f172a' }}>
            Data quality
          </h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            Rules evaluated hourly · failures create exceptions for data owners
          </p>
        </div>

        {/* Search & Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                height: '34px',
                width: '190px',
                padding: '0 12px 0 30px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '12.5px',
                color: '#1e293b',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            />
            <Search style={{ position: 'absolute', left: '9px', top: '10px', width: '14px', height: '14px', color: '#94a3b8' }} />
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              height: '34px',
              padding: '0 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <Download style={{ width: '13px', height: '13px', color: '#64748b' }} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Clean Table Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                color: '#64748b',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em'
              }}>
                <th 
                  onClick={() => handleSort('rule')}
                  style={{ padding: '12px 18px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>RULE</span>
                    {sortField === 'rule' ? (sortAsc ? <ChevronUp style={{ width: '12px', height: '12px' }} /> : <ChevronDown style={{ width: '12px', height: '12px' }} />) : <ArrowUpDown style={{ width: '11px', height: '11px', opacity: 0.4 }} />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('domain')}
                  style={{ padding: '12px 18px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>DOMAIN</span>
                    {sortField === 'domain' ? (sortAsc ? <ChevronUp style={{ width: '12px', height: '12px' }} /> : <ChevronDown style={{ width: '12px', height: '12px' }} />) : <ArrowUpDown style={{ width: '11px', height: '11px', opacity: 0.4 }} />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('pass_rate')}
                  style={{ padding: '12px 18px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>PASS RATE</span>
                    {sortField === 'pass_rate' ? (sortAsc ? <ChevronUp style={{ width: '12px', height: '12px' }} /> : <ChevronDown style={{ width: '12px', height: '12px' }} />) : <ArrowUpDown style={{ width: '11px', height: '11px', opacity: 0.4 }} />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('failures')}
                  style={{ padding: '12px 18px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>FAILURES</span>
                    {sortField === 'failures' ? (sortAsc ? <ChevronUp style={{ width: '12px', height: '12px' }} /> : <ChevronDown style={{ width: '12px', height: '12px' }} />) : <ArrowUpDown style={{ width: '11px', height: '11px', opacity: 0.4 }} />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('owner')}
                  style={{ padding: '12px 18px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>OWNER</span>
                    {sortField === 'owner' ? (sortAsc ? <ChevronUp style={{ width: '12px', height: '12px' }} /> : <ChevronDown style={{ width: '12px', height: '12px' }} />) : <ArrowUpDown style={{ width: '11px', height: '11px', opacity: 0.4 }} />}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('status')}
                  style={{ padding: '12px 18px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>STATUS</span>
                    {sortField === 'status' ? (sortAsc ? <ChevronUp style={{ width: '12px', height: '12px' }} /> : <ChevronDown style={{ width: '12px', height: '12px' }} />) : <ArrowUpDown style={{ width: '11px', height: '11px', opacity: 0.4 }} />}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    No quality rules found matching "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredRules.slice(0, rowsPerPage).map((r, idx) => (
                  <tr
                    key={r.id || idx}
                    onClick={() => setSelectedRule(r)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <td style={{ padding: '14px 18px', color: '#0f172a', fontWeight: 500 }}>
                      {r.rule}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#475569' }}>
                      {r.domain}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#0f172a', fontWeight: 600 }}>
                      {r.pass_rate}
                    </td>
                    <td style={{ padding: '14px 18px', color: r.failures > 0 ? '#b45309' : '#0f172a', fontWeight: r.failures > 0 ? 600 : 400 }}>
                      {r.failures}
                    </td>
                    <td style={{ padding: '14px 18px', color: '#475569' }}>
                      {r.owner}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {renderStatusBadge(r.status)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          background: '#ffffff',
          borderTop: '1px solid #f1f5f9',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <div>
            Page 1 of 1 · {filteredRules.length} records · click a header to sort, a row for detail and actions
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Rows</span>
            {[25, 50, 100].map(cnt => (
              <button
                key={cnt}
                type="button"
                onClick={() => setRowsPerPage(cnt)}
                style={{
                  background: rowsPerPage === cnt ? '#0f172a' : 'transparent',
                  color: rowsPerPage === cnt ? '#ffffff' : '#64748b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {cnt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row Detail Drawer / Modal */}
      {selectedRule && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '10px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                  {selectedRule.domain} DOMAIN RULE
                </span>
                <h3 style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  {selectedRule.rule}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRule(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>PASS RATE</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {selectedRule.pass_rate}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>FAILURES</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: selectedRule.failures > 0 ? '#b45309' : '#16a34a', marginTop: '2px' }}>
                    {selectedRule.failures}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Assigned Data Owner:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedRule.owner}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Target PostgreSQL Table:</span>
                  <span style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: '12px' }}>{selectedRule.target_table}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Total Checked Records:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedRule.total_checked?.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Evaluation Schedule:</span>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>Hourly Continuous Sync</span>
                </div>
              </div>

              <div style={{ background: selectedRule.failures > 0 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${selectedRule.failures > 0 ? '#fde68a' : '#bbf7d0'}`, borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: selectedRule.failures > 0 ? '#92400e' : '#166534' }}>
                {selectedRule.failures > 0 ? (
                  <div>
                    <strong>Action Required:</strong> {selectedRule.failures} non-compliant record(s) flagged. An exception has been automatically routed to <strong>{selectedRule.owner}</strong> for remediation.
                  </div>
                ) : (
                  <div>
                    <strong>Zero Exceptions:</strong> All checked records in PostgreSQL table <code>{selectedRule.target_table}</code> are fully compliant with hospital governance policies.
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedRule(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
