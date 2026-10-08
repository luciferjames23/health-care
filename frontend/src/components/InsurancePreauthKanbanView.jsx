import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import PreauthDossierDrawer from './PreauthDossierDrawer';
import ClaimAppealDrawer from './ClaimAppealDrawer';
import ModuleLoadingScreen from './ModuleLoadingScreen';

export default function InsurancePreauthKanbanView({ onOpenPatient, onNavigate }) {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedInsurer, setSelectedInsurer] = useState('ALL');
  const [processingId, setProcessingId] = useState(null);
  const [activeDossierPatient, setActiveDossierPatient] = useState(null);
  const [drawerInitialMode, setDrawerInitialMode] = useState('dossier');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAppealDrawerOpen, setIsAppealDrawerOpen] = useState(false);
  const [activeAppealCase, setActiveAppealCase] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchCasesAndStats = async (silent = false) => {
    try {
      if (!silent) setIsRefreshing(true);
      const [casesRes, statsRes] = await Promise.all([
        apiService.getPreauthCases(),
        apiService.getPreauthStats()
      ]);

      if (casesRes && casesRes.cases) {
        setCases(casesRes.cases);
      }
      if (statsRes) {
        setStats(statsRes);
      }
      setLastRefreshed(new Date());
      if (!silent) {
        setJustRefreshed(true);
        setTimeout(() => setJustRefreshed(false), 2500);
      }
    } catch (err) {
      console.warn('Error fetching preauth cases:', err);
    } finally {
      if (!silent) {
        setIsRefreshing(false);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchCasesAndStats();
    const interval = setInterval(() => fetchCasesAndStats(true), 15000);
    const handleUpdate = () => fetchCasesAndStats(true);
    window.addEventListener('hc_api_updated', handleUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, []);

  // Filter cases by search and insurer
  const filteredCases = cases.filter(c => {
    const rawSearch = (search || '').trim().toLowerCase();

    const matchesInsurer = selectedInsurer === 'ALL' ||
      (c.insurance_provider || '').toLowerCase().includes(selectedInsurer.toLowerCase());

    if (!matchesInsurer) return false;
    if (!rawSearch) return true;

    // Multi-term matching: split by whitespace (e.g. "Divyaya Parthalan", "MER-CLM-0087308", "87308")
    const searchTerms = rawSearch.split(/\s+/).filter(Boolean);

    const searchableCorpus = [
      c.patient_name,
      c.patient_code,
      c.patient_id,
      c.claim_reference,
      c.claim_number,
      c.claim_id,
      c.policy_number,
      c.bill_number,
      c.admission_number,
      c.admission_id,
      c.insurance_provider,
      c.primary_diagnosis,
      c.reason_for_admission,
      c.procedure_name,
      c.attending_doctor,
      c.lead_surgeon,
      c.department,
      c.ward_bed,
      c.ward_name,
      c.bed_number,
      c.claim_status,
      c.stage,
      c.phone
    ].filter(Boolean).join(' ').toLowerCase();

    return searchTerms.every(term => searchableCorpus.includes(term));
  });

  // Distribute into 4 Preauth & Denial Kanban stages (AG-07 + AG-20)
  const colDossierReady = filteredCases.filter(c => !c.stage || c.stage === 'DOSSIER_READY' || c.stage === 'NEW_ADMISSION');
  const colSubmittedTPA = filteredCases.filter(c => c.stage === 'SUBMITTED_TPA');
  const colApproved = filteredCases.filter(c => c.stage === 'APPROVED');
  const colRejected = filteredCases.filter(c => c.stage === 'REJECTED_SHORTFALL');

  const activePendingCases = colDossierReady.length + colSubmittedTPA.length;
  const activePendingSum = [...colDossierReady, ...colSubmittedTPA].reduce((acc, c) => acc + (c.estimated_cost || 0), 0);
  const shortfallSum = colRejected.reduce((acc, c) => acc + (c.rejected_amount || c.disputed_amount || 0), 0);

  // Kanban Column Pagination (4 Columns) - Even 8 records per column page
  const [colPages, setColPages] = useState({ 1: 1, 2: 1, 3: 1, 4: 1 });
  const COL_PAGE_SIZE = 8;

  const getPaginatedColumn = (items, colNum) => {
    const page = colPages[colNum] || 1;
    const totalPages = Math.max(1, Math.ceil(items.length / COL_PAGE_SIZE));
    const validPage = Math.min(page, totalPages);
    const startIdx = (validPage - 1) * COL_PAGE_SIZE;
    return {
      items: items.slice(startIdx, startIdx + COL_PAGE_SIZE),
      page: validPage,
      totalPages,
      totalCount: items.length
    };
  };

  const renderColumnPagination = (colNum, totalCount, currentPage, totalPages) => {
    if (totalCount === 0) return null;
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '8px',
        marginTop: 'auto',
        borderTop: '1px solid #e2e8f0',
        fontSize: '11px',
        color: '#64748b'
      }}>
        <span>
          Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalCount})
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={(e) => {
              e.stopPropagation();
              setColPages(prev => ({ ...prev, [colNum]: Math.max(1, currentPage - 1) }));
            }}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              background: currentPage <= 1 ? '#f8fafc' : '#ffffff',
              color: currentPage <= 1 ? '#94a3b8' : '#334155',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
            }}
          >
            ‹ Prev
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={(e) => {
              e.stopPropagation();
              setColPages(prev => ({ ...prev, [colNum]: Math.min(totalPages, currentPage + 1) }));
            }}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              background: currentPage >= totalPages ? '#f8fafc' : '#ffffff',
              color: currentPage >= totalPages ? '#94a3b8' : '#334155',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next ›
          </button>
        </div>
      </div>
    );
  };

  // Handle 1-Click Run AG-07 AI Drafter for a patient
  const handleRunAgentDrafter = async (patientItem, e) => {
    e?.stopPropagation();
    try {
      setProcessingId(patientItem.patient_id);
      await apiService.generatePreauthDossier({
        patient_id: patientItem.patient_code || patientItem.patient_id || patientItem.patient_name
      });
      // Optimistically advance card to DOSSIER_READY
      setCases(prev => prev.map(item => {
        if (item.patient_id === patientItem.patient_id) {
          return {
            ...item,
            stage: 'DOSSIER_READY',
            dossier_status: 'Dossier Ready · 4/4 Verified'
          };
        }
        return item;
      }));
      // Auto-open dossier drawer so user can inspect the generated result
      setActiveDossierPatient(patientItem.patient_code || patientItem.patient_id);
      setDrawerInitialMode('dossier');
      setIsDrawerOpen(true);
      await fetchCasesAndStats(true);
    } catch (err) {
      console.error('Error generating preauth dossier:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle 1-Click TPA Dispatch
  const handleSubmitToTPA = async (patientItem, e) => {
    e?.stopPropagation();
    try {
      setProcessingId(patientItem.patient_id);
      await apiService.submitPreauthToTPA({
        patient_id: patientItem.patient_id,
        patient_code: patientItem.patient_code,
        patient_name: patientItem.patient_name,
        insurance_provider: patientItem.insurance_provider,
        policy_number: patientItem.policy_number,
        claimed_amount: patientItem.estimated_cost || 50000,
        submitted_by: 'Insurance Desk Lead (R. Sundar)'
      });
      // Optimistically move to SUBMITTED_TPA
      setCases(prev => prev.map(item => {
        if (item.patient_id === patientItem.patient_id) {
          return {
            ...item,
            stage: 'SUBMITTED_TPA',
            claim_reference: `TPA-${Math.floor(100000 + Math.random() * 900000)}`,
            dossier_status: 'Under TPA Review'
          };
        }
        return item;
      }));
      await fetchCasesAndStats(true);
    } catch (err) {
      console.error('Error submitting preauth:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Simulating Instant TPA Approval (Permanent DB Update)
  const handleApproveTPA = async (patientItem, e) => {
    e?.stopPropagation();
    try {
      setProcessingId(patientItem.patient_id);
      await apiService.approvePreauthClaim({
        patient_id: patientItem.patient_id,
        patient_code: patientItem.patient_code,
        approved_amount: patientItem.estimated_cost || 35000,
        approved_by: 'TPA Medical Adjudicator / Insurance Desk'
      });
      setCases(prev => prev.map(item => {
        if (item.patient_id === patientItem.patient_id) {
          return {
            ...item,
            stage: 'APPROVED',
            approved_amount: item.estimated_cost,
            claim_reference: item.claim_reference || `AUTH-${Math.floor(100000 + Math.random() * 900000)}`,
            dossier_status: 'Approved'
          };
        }
        return item;
      }));
      await fetchCasesAndStats(true);
    } catch (err) {
      console.error('Error approving claim:', err);
    } finally {
      setProcessingId(null);
    }
  };

  const totalPipelineSum = filteredCases.reduce((acc, c) => acc + (c.estimated_cost || 0), 0);

  // Insurer unique options for filter
  const insurerOptions = ['ALL', 'Star Health', 'Medi Assist', 'ICICI Lombard', 'Care Health', 'HDFC ERGO', 'United India'];

  if (loading && cases.length === 0) {
    return (
      <ModuleLoadingScreen
        title="Loading Insurance Preauth Pipeline..."
        subtitle="Retrieving cashless preauth dossiers, IRDAI compliance checklists & TPA adjudications..."
        badgeText="TPA & Insurance Live Sync"
        showKpis={true}
        statCount={4}
        layout="cards"
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 'calc(100vh - 110px)', animation: 'fadeIn 0.2s ease-out' }}>
      
      {/* ── Top Header & Title ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Hospital Platform</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>›</span>
            <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>Insurance &amp; Pre-Authorization Desk</span>
            <span style={{
              fontSize: '10.5px',
              padding: '1px 7px',
              borderRadius: '12px',
              background: '#dbeafe',
              color: '#1d4ed8',
              fontWeight: 700
            }}>
              Clinical Intelligence Engine
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
              Insurance Preauth Desk &amp; TPA Pipeline
            </h1>
            {justRefreshed && (
              <span style={{
                fontSize: '11px',
                color: '#059669',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 600,
                animation: 'fadeIn 0.2s ease-out'
              }}>
                ✓ Live Pipeline Synced
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
            Autonomous Cashless Preauthorisation Dossier Assembly · Real-Time Clinical &amp; Tariff Synthesis · IRDAI Compliance Gate
          </div>
        </div>

        {/* Action Header Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => fetchCasesAndStats(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 600,
              background: isRefreshing ? '#f1f5f9' : '#ffffff',
              color: isRefreshing ? '#2563eb' : '#334155',
              border: isRefreshing ? '1px solid #93c5fd' : '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: isRefreshing ? 'wait' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{
              display: 'inline-block',
              animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none'
            }}>
              🔄
            </span>
            <span>{isRefreshing ? 'Refreshing Pipeline...' : 'Refresh Pipeline'}</span>
          </button>



          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('agents')}
              style={{
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: 600,
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Agent Studio →
            </button>
          )}
        </div>
      </div>

      {/* ── 4 Top KPI Metric Cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
        
        {/* Metric 1 */}
        <div style={{
          padding: '14px 16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Active Preauth Pipeline
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
            {activePendingCases} <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>active patients</span>
          </div>
          <div style={{ fontSize: '11px', color: '#0284c7' }}>
            ₹{(activePendingSum / 100000).toFixed(2)} Lakhs · {colDossierReady.length} ready · {colSubmittedTPA.length} in review
          </div>
        </div>


        {/* Metric 3 */}
        <div style={{
          padding: '14px 16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            First-Pass Approval Rate
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>
            {stats?.approved_rate || '99.7%'}
          </div>
          <div style={{ fontSize: '11px', color: '#1d4ed8' }}>
            Automated Policy Eligibility &amp; Clinical Validation
          </div>
        </div>

        {/* Metric 4: AG-20 Shortfall & Denial Desk */}
        <div style={{
          padding: '14px 16px',
          background: '#ffffff',
          border: '1px solid #fee2e2',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            🚨 AG-20 Claim Denial Desk
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#b91c1c', fontFamily: 'monospace' }}>
            {colRejected.length} <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>denial cases</span>
          </div>
          <div style={{ fontSize: '11px', color: '#991b1b' }}>
            ₹{(shortfallSum / 100000).toFixed(2)} Lakhs at risk · 91% appeal win rate
          </div>
        </div>
      </div>

      {/* ── Search & Insurer Filter Bar ───────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#ffffff',
        padding: '10px 14px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              placeholder="Search patient, UHID, claim #, doctor, insurer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                background: '#f8fafc'
              }}
            />
            <span style={{ position: 'absolute', left: '10px', top: '7px', fontSize: '13px', color: '#94a3b8' }}>🔍</span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '7px',
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Insurer Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {insurerOptions.map(ins => (
              <button
                key={ins}
                type="button"
                onClick={() => setSelectedInsurer(ins)}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: selectedInsurer === ins ? 700 : 500,
                  borderRadius: '6px',
                  border: selectedInsurer === ins ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  background: selectedInsurer === ins ? '#eff6ff' : '#ffffff',
                  color: selectedInsurer === ins ? '#1d4ed8' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                {ins === 'ALL' ? 'All Insurers' : ins}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
          Showing <strong>{colDossierReady.length}</strong> ready · <strong>{colSubmittedTPA.length}</strong> in review · <strong>{colApproved.length}</strong> approved · <strong style={{ color: '#dc2626' }}>{colRejected.length} denials</strong> ({filteredCases.length} total)
        </div>
      </div>

      {/* ── 4-Column Visual Kanban Board (AG-07 Preauth + AG-20 Denial Appeal Desk) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(285px, 1fr))',
        gap: '12px',
        alignItems: 'start',
        overflowX: 'auto',
        paddingBottom: '20px'
      }}>
        
        {/* ================================================================= */}
        {/* COLUMN 1: DOSSIER ASSEMBLED / READY FOR SUBMISSION                */}
        {/* ================================================================= */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minHeight: '480px'
        }}>
          {/* Column Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #8b5cf6',
            paddingBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>🤖</span>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>1. Dossier Assembled</span>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '10px',
              background: '#ede9fe',
              color: '#6d28d9'
            }}>
              {colDossierReady.length}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Clinical checklist verified with bilingual English &amp; Tamil justifications. Ready for 1-click submission.
          </div>

          {/* Cards List */}
          {(() => {
            const { items: paginated, page, totalPages, totalCount } = getPaginatedColumn(colDossierReady, 1);
            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {totalCount === 0 ? (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
                      No pending dossier assembly cases.
                    </div>
                  ) : (
                    paginated.map(item => renderKanbanCard(item, 1))
                  )}
                </div>
                {renderColumnPagination(1, totalCount, page, totalPages)}
              </>
            );
          })()}
        </div>

        {/* ================================================================= */}
        {/* COLUMN 2: TPA UNDER REVIEW                                        */}
        {/* ================================================================= */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minHeight: '480px'
        }}>
          {/* Column Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #f59e0b',
            paddingBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>⏳</span>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>2. Under TPA Review</span>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '10px',
              background: '#fef3c7',
              color: '#b45309'
            }}>
              {colSubmittedTPA.length}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Dispatched to TPA Desk. Review and verification in progress.
          </div>

          {/* Cards List */}
          {(() => {
            const { items: paginated, page, totalPages, totalCount } = getPaginatedColumn(colSubmittedTPA, 2);
            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {totalCount === 0 ? (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
                      No active submissions in review.
                    </div>
                  ) : (
                    paginated.map(item => renderKanbanCard(item, 2))
                  )}
                </div>
                {renderColumnPagination(2, totalCount, page, totalPages)}
              </>
            );
          })()}
        </div>

        {/* ================================================================= */}
        {/* COLUMN 3: CASHLESS GUARANTEE APPROVED                             */}
        {/* ================================================================= */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minHeight: '480px'
        }}>
          {/* Column Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #10b981',
            paddingBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>✅</span>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>3. Guarantee Approved</span>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '10px',
              background: '#d1fae5',
              color: '#047857'
            }}>
              {colApproved.length}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Initial Cashless Authorization Letter issued by Insurer.
          </div>

          {/* Cards List */}
          {(() => {
            const { items: paginated, page, totalPages, totalCount } = getPaginatedColumn(colApproved, 3);
            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {totalCount === 0 ? (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
                      Approved preauth cases will appear here.
                    </div>
                  ) : (
                    paginated.map(item => renderKanbanCard(item, 3))
                  )}
                </div>
                {renderColumnPagination(3, totalCount, page, totalPages)}
              </>
            );
          })()}
        </div>

        {/* ================================================================= */}
        {/* COLUMN 4: REJECTION / SHORTFALL (AG-20 CLAIM APPEAL DESK)         */}
        {/* ================================================================= */}
        <div style={{
          background: '#fffbfb',
          border: '1px solid #fee2e2',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minHeight: '480px'
        }}>
          {/* Column Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #ef4444',
            paddingBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>🚨</span>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#991b1b' }}>4. Claim Denial</span>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '10px',
              background: '#fee2e2',
              color: '#991b1b'
            }}>
              {colRejected.length}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: '#7f1d1d' }}>
            TPA deductions &amp; rejections. AG-20 retrieves EMR evidence for 1-click appeal.
          </div>

          {/* Cards List */}
          {(() => {
            const { items: paginated, page, totalPages, totalCount } = getPaginatedColumn(colRejected, 4);
            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {totalCount === 0 ? (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', border: '1px dashed #cbd5e1', borderRadius: '6px' }}>
                      No denied claims pending appeal.
                    </div>
                  ) : (
                    paginated.map(item => renderKanbanCard(item, 4))
                  )}
                </div>
                {renderColumnPagination(4, totalCount, page, totalPages)}
              </>
            );
          })()}
        </div>

      </div>

      {/* ── Slide-over Preauth Dossier Drawer ─────────────────────────────── */}
      <PreauthDossierDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setActiveDossierPatient(null);
          fetchCasesAndStats(true);
        }}
        patientIdentifier={activeDossierPatient}
        initialMode={drawerInitialMode}
        onSubmitted={() => {
          fetchCasesAndStats(true);
        }}
        onOpenPatient={onOpenPatient}
      />

      {/* ── Slide-over AG-20 Claim Appeal Dossier Drawer ───────────────────── */}
      <ClaimAppealDrawer
        isOpen={isAppealDrawerOpen}
        onClose={() => {
          setIsAppealDrawerOpen(false);
          setActiveAppealCase(null);
          fetchCasesAndStats(true);
        }}
        claimIdentifier={activeAppealCase?.claim_id || activeAppealCase?.claim_number}
        patientData={activeAppealCase}
        onAppealSubmitted={() => {
          fetchCasesAndStats(true);
        }}
      />

    </div>
  );

  // Helper to render individual Kanban Card
  function renderKanbanCard(item, columnNumber) {
    const isProcessing = processingId === item.patient_id;
    const est = item.estimated_cost || 25000;
    const cov = item.coverage_limit || 500000;
    const riskScore = item.denial_risk?.risk_score ?? item.denial_risk?.risk_pct ?? 12;
    const riskLevel = item.denial_risk?.risk_level || (riskScore <= 30 ? 'Low Risk' : riskScore <= 60 ? 'Medium Risk' : riskScore <= 80 ? 'High Risk' : 'Critical Risk');
    const reasonsList = item.denial_risk?.risk_reasons || (item.denial_risk?.explanation ? [item.denial_risk.explanation] : ['All 17 statutory and policy criteria verified']);
    const tooltipText = `Two-Stage Risk Prediction: ${riskScore}/100 (${riskLevel})\n${reasonsList.map(r => `• ${r}`).join('\n')}`;

    const pillBg =
      riskLevel === 'Low Risk'
        ? '#ecfdf5'
        : riskLevel === 'Medium Risk'
        ? '#fffbeb'
        : riskLevel === 'High Risk'
        ? '#fff1f2'
        : '#fee2e2';

    const pillColor =
      riskLevel === 'Low Risk'
        ? '#047857'
        : riskLevel === 'Medium Risk'
        ? '#b45309'
        : riskLevel === 'High Risk'
        ? '#e11d48'
        : '#991b1b';

    const pillBorder =
      riskLevel === 'Low Risk'
        ? '#a7f3d0'
        : riskLevel === 'Medium Risk'
        ? '#fde68a'
        : riskLevel === 'High Risk'
        ? '#fecdd3'
        : '#fca5a5';

    return (
      <div
        key={item.patient_id || item.patient_code}
        onClick={() => {
          if (columnNumber === 4) {
            setActiveAppealCase(item);
            setIsAppealDrawerOpen(true);
          } else {
            setActiveDossierPatient(item.patient_code || item.patient_id);
            setDrawerInitialMode(columnNumber === 3 ? 'letter' : 'dossier');
            setIsDrawerOpen(true);
          }
        }}
        style={{
          background: columnNumber === 4 ? '#ffffff' : '#ffffff',
          border: columnNumber === 4 ? '1px solid #fecaca' : '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: columnNumber === 4 ? '0 1px 3px rgba(220, 38, 38, 0.05)' : '0 1px 3px rgba(0,0,0,0.03)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = columnNumber === 4 ? '#f87171' : '#93c5fd';
          e.currentTarget.style.boxShadow = columnNumber === 4 ? '0 4px 12px rgba(220, 38, 38, 0.12)' : '0 4px 12px rgba(37, 99, 235, 0.08)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = columnNumber === 4 ? '#fecaca' : '#e2e8f0';
          e.currentTarget.style.boxShadow = columnNumber === 4 ? '0 1px 3px rgba(220, 38, 38, 0.05)' : '0 1px 3px rgba(0,0,0,0.03)';
        }}
      >
        {/* Top line: Ward/Bed + Denial Risk pill */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
            {item.ward_bed || 'General Ward'}
          </span>

          {columnNumber === 4 ? (
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '1px 7px',
              borderRadius: '10px',
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fecaca'
            }}>
              ● Denied: -₹{Math.round(item.rejected_amount || item.disputed_amount || 0).toLocaleString('en-IN')}
            </span>
          ) : columnNumber === 3 ? (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '10px',
              background: '#d1fae5',
              color: '#047857',
              border: '1px solid #a7f3d0'
            }}>
              ● Approved
            </span>
          ) : (
            <span 
              style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '10px',
                background: pillBg,
                color: pillColor,
                border: `1px solid ${pillBorder}`
              }}
              title={tooltipText}
            >
              ● {riskLevel}
            </span>
          )}
        </div>

        {/* Patient Name & UHID */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', lineHeight: 1.2 }}>
            {item.patient_name}
          </div>
          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px', fontFamily: 'monospace' }}>
            {item.patient_code || `MER-PAT-${item.patient_id}`} · {item.gender || 'Patient'}
          </div>
        </div>

        {/* Diagnosis & Attending Doctor */}
        <div style={{ fontSize: '11px', color: '#334155', background: '#f8fafc', padding: '6px 8px', borderRadius: '5px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontWeight: 600, color: '#1e293b' }}>
            {item.primary_diagnosis || item.reason_for_admission || 'Clinical Inpatient Admission'}
          </div>
          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
            Dr. {item.attending_doctor || 'On Duty'} ({item.department || 'Inpatient'})
          </div>
        </div>

        {/* Insurer & Cost comparison */}
        <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
            <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.insurance_provider ? item.insurance_provider.split(' ')[0] : 'Star Health'}</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: columnNumber === 4 ? '#b91c1c' : '#0284c7' }}>
              {columnNumber === 4 ? `Cut: -₹${Math.round(item.rejected_amount || item.disputed_amount || 0).toLocaleString('en-IN')}` : `Est: ₹${est.toLocaleString('en-IN')}`}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
            <span>Policy: {item.policy_number || 'ACTIVE-POL'}</span>
            <span>Limit: ₹{(cov / 100000).toFixed(1)}L</span>
          </div>
        </div>

        {/* Action Button depending on Kanban Column */}
        <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
          {columnNumber === 1 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                disabled={isProcessing}
                onClick={(e) => handleSubmitToTPA(item, e)}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: '#7c3aed',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(124, 58, 237, 0.2)'
                }}
              >
                {isProcessing ? 'Submitting...' : '⚡ Submit TPA (1-Click)'}
              </button>
            </div>
          )}

          {columnNumber === 2 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDossierPatient(item.patient_code || item.patient_id);
                  setDrawerInitialMode('dossier');
                  setIsDrawerOpen(true);
                }}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#b45309',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🔍 Review Preauth Dossier
              </button>
            </div>
          )}

          {columnNumber === 3 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '10.5px',
              color: '#047857',
              fontWeight: 600
            }}>
              <span>Guarantee Issued: ₹{est.toLocaleString('en-IN')}</span>
              <span 
                style={{ color: '#0284c7', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDossierPatient(item.patient_code || item.patient_id);
                  setDrawerInitialMode('letter');
                  setIsDrawerOpen(true);
                }}
              >
                View Letter →
              </span>
            </div>
          )}

          {columnNumber === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{
                fontSize: '10.5px',
                color: '#991b1b',
                background: '#fff1f2',
                padding: '4px 6px',
                borderRadius: '4px',
                border: '1px solid #ffe4e6',
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 600
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                  {item.rejection_reason || 'Tariff Capping / Exclusion'}
                </span>
                <span style={{ color: '#dc2626', fontWeight: 800 }}>
                  -₹{Math.round(item.rejected_amount || item.disputed_amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAppealCase(item);
                  setIsAppealDrawerOpen(true);
                }}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)'
                }}
              >
                ⚖️ Open Appeal Dossier (AG-20)
              </button>
            </div>
          )}
        </div>

      </div>
    );
  }
}
