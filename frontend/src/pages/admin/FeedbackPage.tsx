import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, RefreshCw, CheckCircle, Clock,
  AlertTriangle, Filter, Search, ThumbsUp, ThumbsDown,
  Meh, Star, Sparkles, Phone, User, ShieldAlert,
  ArrowRight, X, FileText, Mic, Send
} from 'lucide-react';
import { apiService } from '../../services/api';
import ModuleLoadingScreen from '../../components/ModuleLoadingScreen';
import TablePagination from '../../components/TablePagination';

interface FeedbackRecord {
  id: number;
  patient_id: string | null;
  patient_name: string | null;
  phone_number: string | null;
  whatsapp_phone: string | null;
  conversation_id: string | null;
  source: string;
  rating: number | null;
  original_feedback: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
  categories: string[];
  issues: string[];
  ai_summary: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requires_action: boolean;
  recommended_action: string | null;
  confidence: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SummaryKpis {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  avg_rating: number | null;
  open_grievances: number;
  high_priority: number;
  requires_action_count: number;
}

const SENTIMENT_STYLES: Record<string, { bg: string; color: string; label: string; icon: any }> = {
  POSITIVE: { bg: '#e6f4ea', color: '#137333', label: 'Positive', icon: ThumbsUp },
  NEGATIVE: { bg: '#fce8e6', color: '#c5221f', label: 'Negative', icon: ThumbsDown },
  NEUTRAL: { bg: '#f1f3f4', color: '#5f6368', label: 'Neutral', icon: Meh },
  MIXED: { bg: '#feefc3', color: '#b06000', label: 'Mixed', icon: Sparkles },
};

const SEVERITY_STYLES: Record<string, { bg: string; color: string }> = {
  LOW: { bg: '#e8f0fe', color: '#1a73e8' },
  MEDIUM: { bg: '#feefc3', color: '#b06000' },
  HIGH: { bg: '#feebd9', color: '#d93025' },
  CRITICAL: { bg: '#fce8e6', color: '#a50e0e' },
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  OPEN: { bg: '#fce8e6', color: '#c5221f', label: '🔴 Open' },
  IN_PROGRESS: { bg: '#feefc3', color: '#b06000', label: '🟡 In Progress' },
  RESOLVED: { bg: '#e6f4ea', color: '#137333', label: '🟢 Resolved' },
  CLOSED: { bg: '#f1f3f4', color: '#5f6368', label: '⚪ Closed' },
};

const CATEGORY_OPTIONS = [
  'Doctor / Clinical Care',
  'Nursing',
  'Staff / Service',
  'Waiting Time',
  'Appointment',
  'Billing',
  'Insurance',
  'Pharmacy',
  'Laboratory',
  'Radiology',
  'Food / Dining',
  'Cleanliness',
  'Room / Facilities',
  'Emergency',
  'Communication',
  'Hospital Information',
  'Registration',
  'Discharge',
  'Other'
];

export const FeedbackPage: React.FC = () => {
  const [feedbackList, setFeedbackList] = useState<FeedbackRecord[]>([]);
  const [summary, setSummary] = useState<SummaryKpis>({
    total: 0, positive: 0, negative: 0, neutral: 0, mixed: 0,
    avg_rating: null, open_grievances: 0, high_priority: 0, requires_action_count: 0
  });

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<FeedbackRecord | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [requiresActionFilter, setRequiresActionFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);

  // Update Status Modal / Form State
  const [statusInput, setStatusInput] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'>('OPEN');
  const [notesInput, setNotesInput] = useState('');
  const [updating, setUpdating] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Summary KPIs
      const summaryData = await apiService.getFeedbackSummary().catch(() => null);
      if (summaryData?.summary) {
        setSummary(summaryData.summary);
      }

      // 2. Fetch Filtered Feedback List
      const listData = await apiService.getFeedbackList({
        sentiment: sentimentFilter || undefined,
        category: categoryFilter || undefined,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        requires_action: requiresActionFilter !== '' ? requiresActionFilter : undefined,
        search: search || undefined,
        limit: perPage,
        offset: (page - 1) * perPage
      }).catch(() => null);

      if (listData?.data) {
        setFeedbackList(listData.data);
        setTotalRecords(listData.total || listData.data.length);
      } else {
        setFeedbackList([]);
        setTotalRecords(0);
      }
    } finally {
      setLoading(false);
    }
  }, [sentimentFilter, categoryFilter, severityFilter, statusFilter, requiresActionFilter, search, page, perPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDetail = (record: FeedbackRecord) => {
    setSelectedRecord(record);
    setStatusInput(record.status);
    setNotesInput(record.resolution_notes || '');
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setUpdating(true);
    try {
      const res = await apiService.updateFeedbackStatus(selectedRecord.id, {
        status: statusInput,
        resolution_notes: notesInput,
        assigned_to: 'Patient Relations Lead'
      });
      if (res?.success || res?.status) {
        showToast(`Feedback #${selectedRecord.id} updated to ${statusInput}`);
        setSelectedRecord(prev => prev ? { ...prev, status: statusInput, resolution_notes: notesInput } : null);
        loadData();
      }
    } catch (err: any) {
      showToast(`❌ Error: ${err.message || 'Failed to update feedback'}`);
    } finally {
      setUpdating(false);
    }
  };

  const totalPages = Math.ceil(totalRecords / perPage) || 1;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Patient Feedback & Grievance Centre</h2>
              <span className="badge" style={{ backgroundColor: '#107c41', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                AG-05 Feedback Agent
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: '#5f6368', fontSize: '14px' }}>
              Real-time AI semantic sentiment classification, grievance resolution, and post-discharge feedback analytics from WhatsApp Patient Desk
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {toast && (
        <div className="success-alert" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px', backgroundColor: '#e6f4ea', color: '#137333', border: '1px solid #ceead6' }}>
          <CheckCircle size={16} /> {toast}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="kpi-card" style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#5f6368', fontWeight: 500 }}>Total Feedback</span>
            <MessageSquare size={18} color="#1a73e8" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px', color: '#202124' }}>
            {summary.total}
          </div>
          <div style={{ fontSize: '11px', color: '#70757a', marginTop: '4px' }}>WhatsApp & Voice</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#137333', fontWeight: 500 }}>Positive</span>
            <ThumbsUp size={18} color="#137333" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px', color: '#137333' }}>
            {summary.positive}
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#5f6368', marginLeft: '6px' }}>
              ({summary.total > 0 ? Math.round((summary.positive / summary.total) * 100) : 0}%)
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#70757a', marginTop: '4px' }}>High satisfaction</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#c5221f', fontWeight: 500 }}>Negative</span>
            <ThumbsDown size={18} color="#c5221f" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px', color: '#c5221f' }}>
            {summary.negative}
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#5f6368', marginLeft: '6px' }}>
              ({summary.total > 0 ? Math.round((summary.negative / summary.total) * 100) : 0}%)
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#70757a', marginTop: '4px' }}>Service complaints</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#b06000', fontWeight: 500 }}>Neutral / Mixed</span>
            <Meh size={18} color="#b06000" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px', color: '#b06000' }}>
            {summary.neutral + summary.mixed}
          </div>
          <div style={{ fontSize: '11px', color: '#70757a', marginTop: '4px' }}>Constructive comments</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#e37400', fontWeight: 500 }}>Avg Rating</span>
            <Star size={18} color="#e37400" fill="#e37400" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px', color: '#e37400' }}>
            {summary.avg_rating ? `${summary.avg_rating} / 10` : 'N/A'}
          </div>
          <div style={{ fontSize: '11px', color: '#70757a', marginTop: '4px' }}>Overall patient score</div>
        </div>

        <div className="kpi-card" style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#d93025', fontWeight: 500 }}>Open Grievances</span>
            <ShieldAlert size={18} color="#d93025" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px', color: '#d93025' }}>
            {summary.open_grievances}
          </div>
          <div style={{ fontSize: '11px', color: '#70757a', marginTop: '4px' }}>Require resolution</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9aa0a6' }} />
            <input
              type="text"
              placeholder="Search patient, text, summary..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', fontSize: '13px',
                borderRadius: '6px', border: '1px solid #dadce0', outline: 'none'
              }}
            />
          </div>

          {/* Sentiment Filter */}
          <select
            value={sentimentFilter}
            onChange={e => { setSentimentFilter(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #dadce0', background: '#fff' }}
          >
            <option value="">All Sentiments</option>
            <option value="POSITIVE">Positive</option>
            <option value="NEGATIVE">Negative</option>
            <option value="NEUTRAL">Neutral</option>
            <option value="MIXED">Mixed</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #dadce0', background: '#fff' }}
          >
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #dadce0', background: '#fff' }}
          >
            <option value="">All Severities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #dadce0', background: '#fff' }}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Requires Action Filter */}
          <select
            value={requiresActionFilter}
            onChange={e => { setRequiresActionFilter(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #dadce0', background: '#fff' }}
          >
            <option value="">All Feedback Types</option>
            <option value="true">Grievances Only (Requires Action)</option>
            <option value="false">General Feedback Only</option>
          </select>
        </div>
      </div>

      {/* Main Feedback List Table */}
      {loading ? (
        <ModuleLoadingScreen message="Loading live patient feedback & grievance data..." />
      ) : feedbackList.length === 0 ? (
        <div style={{ background: '#fff', padding: '48px', textAlign: 'center', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <MessageSquare size={36} color="#9aa0a6" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#3c4043' }}>No Feedback Records Found</h3>
          <p style={{ margin: 0, color: '#70757a', fontSize: '14px' }}>
            No records matched your selected filters or search terms.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e0e0e0', color: '#5f6368', fontWeight: 600 }}>
                  <th style={{ padding: '12px 16px' }}>Patient</th>
                  <th style={{ padding: '12px 16px' }}>Source</th>
                  <th style={{ padding: '12px 16px' }}>Rating</th>
                  <th style={{ padding: '12px 16px' }}>Sentiment</th>
                  <th style={{ padding: '12px 16px' }}>Categories</th>
                  <th style={{ padding: '12px 16px' }}>Priority</th>
                  <th style={{ padding: '12px 16px' }}>AI Summary / Feedback</th>
                  <th style={{ padding: '12px 16px' }}>Submitted</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {feedbackList.map(item => {
                  const sentStyle = SENTIMENT_STYLES[item.sentiment] || SENTIMENT_STYLES.NEUTRAL;
                  const SentIcon = sentStyle.icon;
                  const sevStyle = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.LOW;
                  const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.OPEN;

                  return (
                    <tr
                      key={item.id}
                      style={{ borderBottom: '1px solid #f1f3f4', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8f9fa')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                      {/* Patient */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#202124' }}>
                          {item.patient_name || 'Anonymous Patient'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#70757a' }}>
                          ID: {item.patient_id || 'P-GUEST'}
                        </div>
                      </td>

                      {/* Source */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#5f6368' }}>
                          {item.source === 'WHATSAPP_VOICE' ? <Mic size={14} color="#d93025" /> : <MessageSquare size={14} color="#1a73e8" />}
                          {item.source.replace('WHATSAPP_', '')}
                        </span>
                      </td>

                      {/* Rating */}
                      <td style={{ padding: '12px 16px' }}>
                        {item.rating ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600, color: '#e37400' }}>
                            <Star size={14} fill="#e37400" />
                            {item.rating}/10
                          </div>
                        ) : (
                          <span style={{ color: '#9aa0a6' }}>—</span>
                        )}
                      </td>

                      {/* Sentiment */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                            backgroundColor: sentStyle.bg, color: sentStyle.color
                          }}
                        >
                          <SentIcon size={12} />
                          {sentStyle.label}
                        </span>
                      </td>

                      {/* Categories */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '200px' }}>
                          {item.categories && item.categories.length > 0 ? (
                            item.categories.slice(0, 2).map((cat, idx) => (
                              <span key={idx} style={{ padding: '2px 6px', borderRadius: '4px', background: '#e8f0fe', color: '#1a73e8', fontSize: '11px', fontWeight: 500 }}>
                                {cat}
                              </span>
                            ))
                          ) : (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#f1f3f4', color: '#5f6368', fontSize: '11px' }}>
                              General
                            </span>
                          )}
                          {item.categories && item.categories.length > 2 && (
                            <span style={{ fontSize: '11px', color: '#70757a' }}>+{item.categories.length - 2}</span>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                            backgroundColor: sevStyle.bg, color: sevStyle.color
                          }}
                        >
                          {item.severity}
                        </span>
                      </td>

                      {/* Summary */}
                      <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 500, color: '#3c4043', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.ai_summary || item.original_feedback}
                        </div>
                        <div style={{ fontSize: '11px', color: '#70757a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                          "{item.original_feedback}"
                        </div>
                      </td>

                      {/* Submitted */}
                      <td style={{ padding: '12px 16px', fontSize: '11px', color: '#5f6368', whiteSpace: 'nowrap' }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                            backgroundColor: statusStyle.bg, color: statusStyle.color
                          }}
                        >
                          {statusStyle.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenDetail(item)}
                          style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px' }}
                        >
                          View Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#5f6368' }}>
              Showing {feedbackList.length} of {totalRecords} feedback records
            </span>
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Detail & Grievance Resolution Modal Drawer */}
      {selectedRecord && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', justifyContent: 'flex-end'
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            style={{
              width: '100%', maxWidth: '640px', height: '100%', backgroundColor: '#fff',
              overflowY: 'auto', padding: '24px', boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e0e0e0', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Feedback Details & Service Recovery</h3>
                <span style={{ fontSize: '12px', color: '#5f6368' }}>Record ID #{selectedRecord.id}</span>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} color="#5f6368" />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
              {/* Patient Info Card */}
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e0e0e0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#70757a', display: 'block', fontSize: '11px' }}>Patient Name</span>
                    <strong style={{ color: '#202124' }}>{selectedRecord.patient_name || 'Anonymous Patient'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#70757a', display: 'block', fontSize: '11px' }}>Patient ID / UHID</span>
                    <strong style={{ color: '#202124' }}>{selectedRecord.patient_id || 'P-GUEST'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#70757a', display: 'block', fontSize: '11px' }}>WhatsApp Number</span>
                    <span style={{ color: '#202124' }}>{selectedRecord.whatsapp_phone || selectedRecord.phone_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: '#70757a', display: 'block', fontSize: '11px' }}>Submitted Date</span>
                    <span style={{ color: '#202124' }}>{selectedRecord.created_at ? new Date(selectedRecord.created_at).toLocaleString() : 'Recent'}</span>
                  </div>
                </div>
              </div>

              {/* Original Patient Feedback (Preserved Unmodified) */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#5f6368', marginBottom: '6px' }}>
                  Original Patient Feedback ({selectedRecord.source})
                </label>
                <div style={{ padding: '14px', borderRadius: '8px', background: '#fff', border: '1px solid #dadce0', fontSize: '14px', color: '#202124', lineHeight: '1.5', fontStyle: 'italic' }}>
                  "{selectedRecord.original_feedback}"
                </div>
              </div>

              {/* AI Feedback Analysis Structure Card */}
              <div style={{ background: '#f0f4f9', padding: '16px', borderRadius: '10px', marginBottom: '24px', border: '1px solid #d3e3fd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <Sparkles size={16} color="#1a73e8" />
                  <strong style={{ fontSize: '14px', color: '#1a73e8' }}>AI Semantic Analysis (AG-05)</strong>
                  <span style={{ fontSize: '11px', color: '#5f6368', marginLeft: 'auto' }}>Confidence: {Math.round(selectedRecord.confidence * 100)}%</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '12px' }}>
                  <div>
                    <span style={{ color: '#5f6368', fontSize: '11px' }}>Sentiment</span>
                    <div>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, backgroundColor: SENTIMENT_STYLES[selectedRecord.sentiment]?.bg, color: SENTIMENT_STYLES[selectedRecord.sentiment]?.color }}>
                        {selectedRecord.sentiment}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#5f6368', fontSize: '11px' }}>Overall Rating</span>
                    <div style={{ fontWeight: 600, color: '#e37400' }}>
                      {selectedRecord.rating ? `${selectedRecord.rating} / 10` : 'Not provided'}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#5f6368', fontSize: '11px' }}>Severity Level</span>
                    <div>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, backgroundColor: SEVERITY_STYLES[selectedRecord.severity]?.bg, color: SEVERITY_STYLES[selectedRecord.severity]?.color }}>
                        {selectedRecord.severity}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: '#5f6368', fontSize: '11px' }}>Requires Action</span>
                    <div style={{ fontWeight: 600, color: selectedRecord.requires_action ? '#c5221f' : '#137333' }}>
                      {selectedRecord.requires_action ? 'Yes (Grievance Ticket Created)' : 'No'}
                    </div>
                  </div>
                </div>

                {/* Categories & Issues */}
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ color: '#5f6368', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Identified Categories & Issues</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedRecord.categories && selectedRecord.categories.map((cat, idx) => (
                      <span key={idx} style={{ padding: '3px 8px', borderRadius: '4px', background: '#e8f0fe', color: '#1a73e8', fontSize: '11px', fontWeight: 500 }}>
                        📁 {cat}
                      </span>
                    ))}
                    {selectedRecord.issues && selectedRecord.issues.map((iss, idx) => (
                      <span key={idx} style={{ padding: '3px 8px', borderRadius: '4px', background: '#fce8e6', color: '#c5221f', fontSize: '11px', fontWeight: 500 }}>
                        ⚠️ {iss}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Executive Summary */}
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ color: '#5f6368', fontSize: '11px', display: 'block' }}>Executive Summary</span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#202124' }}>
                    {selectedRecord.ai_summary}
                  </p>
                </div>

                {/* Recommended Action */}
                {selectedRecord.recommended_action && (
                  <div>
                    <span style={{ color: '#5f6368', fontSize: '11px', display: 'block' }}>Recommended Action</span>
                    <div style={{ fontSize: '12px', color: '#b06000', fontWeight: 500 }}>
                      👉 {selectedRecord.recommended_action}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Update & Grievance Resolution Form */}
              <form onSubmit={handleStatusSubmit} style={{ background: '#fff', padding: '16px', borderRadius: '10px', border: '1px solid #e0e0e0' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#202124' }}>
                  Grievance Status & Staff Resolution Notes
                </h4>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#5f6368', marginBottom: '4px' }}>Resolution Status</label>
                  <select
                    value={statusInput}
                    onChange={e => setStatusInput(e.target.value as any)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #dadce0' }}
                  >
                    <option value="OPEN">🔴 Open (Requires Follow-up)</option>
                    <option value="IN_PROGRESS">🟡 In Progress (Contacting Patient)</option>
                    <option value="RESOLVED">🟢 Resolved (Service Recovered)</option>
                    <option value="CLOSED">⚪ Closed (Archived)</option>
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#5f6368', marginBottom: '4px' }}>Resolution Notes / Action Taken</label>
                  <textarea
                    rows={4}
                    placeholder="Enter staff notes, patient call details, department escalations..."
                    value={notesInput}
                    onChange={e => setNotesInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedRecord(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={updating}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {updating && <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                    Save Resolution Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackPage;
