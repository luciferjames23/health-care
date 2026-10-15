import React, { useCallback, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { isPageAllowed } from '../services/meridianData';
import DetailDrawer from './DetailDrawer';
import './AG21ManagementCopilotView.css';

const CATEGORY_LABELS = {
  QUEUE: 'Queue', FOLLOWUP: 'Follow-up', ESCALATION: 'Escalations', CALLBACK: 'Callbacks',
  FEEDBACK: 'Feedback', XRAY: 'X-ray', RADIOLOGY_REVIEW: 'Radiology',
};
const MANAGEMENT_CATEGORIES = [
  { id: '', label: 'All' },
  { id: 'QUEUE', label: 'Queue' },
  { id: 'FOLLOW_UP', label: 'Follow-up' },
  { id: 'ESCALATIONS_CALLBACKS', label: 'Escalations & Callbacks' },
  { id: 'FEEDBACK', label: 'Feedback' },
  { id: 'XRAY_DIAGNOSTICS', label: 'X-ray / Diagnostics' },
  { id: 'RADIOLOGY_REVIEW', label: 'Radiology Review' },
];
const EVIDENCE_LABELS = {
  queue_status: 'Queue status', checked_in_at: 'Checked in', elapsed_wait_minutes: 'Elapsed wait (minutes)',
  department_id: 'Department', doctor_id: 'Doctor', plan_id: 'Follow-up plan', status: 'Status',
  followup_day: 'Follow-up day', due_date: 'Due date', severity: 'Severity', created_at: 'Created',
  acknowledged_at: 'Acknowledged', assigned_team: 'Assigned team', priority: 'Priority', completed_at: 'Completed',
  rating: 'Rating', sentiment: 'Sentiment', requires_action: 'Requires action', category: 'Category',
  accession_number: 'Accession number', examination: 'Examination', order_status: 'Order status',
  projection: 'Projection', projection_status: 'Projection status', upload_started_at: 'Upload started',
  review_status: 'Review status', reviewed_at: 'Reviewed', study_created_at: 'Study created',
};
const OMIT_EVIDENCE_KEYS = new Set(['patient_id', 'user_id', 'assigned_to_user_id', 'source_record_id', 'source_table', 'source_timestamp', 'source_agent', 'calculation']);
const SOURCE_EVIDENCE_ALLOWLIST = new Set([
  'queue_status', 'checked_in_at', 'department_id', 'doctor_id', 'plan_id', 'status', 'followup_day', 'due_date',
  'severity', 'created_at', 'acknowledged_at', 'priority', 'completed_at', 'rating', 'sentiment', 'requires_action',
  'categories', 'issues', 'original_feedback', 'ai_summary', 'resolution_notes', 'resolved_at', 'updated_at',
  'accession_number', 'examination', 'order_status', 'projection', 'projection_status', 'upload_started_at', 'uploaded_at',
  'review_status', 'reviewed_at', 'reviewed', 'study_created_at', 'study_key', 'order_id', 'scan_id', 'timestamp_used_for_age',
]);
const STRATEGY_SUGGESTIONS = [
  'What needs attention now?',
  'Show the oldest pending work.',
  'How many follow-ups are overdue?',
  'What feedback requires action?',
  'Which X-rays are still pending?',
  'Which studies await radiology review?',
];

function formatAge(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Age unavailable';
  const minutes = Math.max(0, Math.floor(Number(value)));
  if (minutes >= 2880) return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes} min`;
}

function formatDate(value) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString();
}

function titleCase(value) {
  return String(value || '').toLowerCase().replace(/(^|[_\s-])\w/g, (match) => match.toUpperCase()).replaceAll('_', ' ');
}

function metricValue(section, key) {
  if (!section || section.data_status === 'UNAVAILABLE' || section.data_status === 'ERROR') return null;
  const value = section.metrics?.[key];
  return value === null || value === undefined ? null : value;
}

function statusText(section) {
  const status = section?.data_status;
  return status === 'AVAILABLE' || status === 'PARTIAL' ? status : 'UNAVAILABLE';
}

function getPageNumbers(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const numbers = new Set([1, totalPages, page - 1, page, page + 1].filter((number) => number >= 1 && number <= totalPages));
  return [...numbers].sort((left, right) => left - right).reduce((result, number, index, list) => {
    if (index > 0 && number - list[index - 1] > 1) result.push('…');
    result.push(number);
    return result;
  }, []);
}

const KPI_DEFINITIONS = [
  { title: 'Queue Waiting', section: 'queue', metric: 'waiting', provenance: 'waiting_provenance', source: 'AG-06 Queue' },
  { title: 'Overdue Follow-ups', section: 'follow_up', metric: 'overdue', provenance: 'overdue_provenance', source: 'AG-11 Follow-up' },
  { title: 'Open Escalations', section: 'follow_up', metric: 'open_clinical_escalations', provenance: 'open_clinical_escalations_provenance', source: 'AG-11 Follow-up' },
  { title: 'Feedback Requiring Action', section: 'feedback', metric: 'requiring_action', provenance: 'requiring_action_provenance', source: 'Feedback / Service Recovery' },
  { title: 'Requested X-ray Orders', section: 'diagnostics', metric: 'requested_orders', provenance: 'requested_orders_provenance', source: 'AG-10 / Radiology' },
  { title: 'Awaiting Radiology Review', section: 'radiology', metric: 'studies_awaiting_review', provenance: 'studies_awaiting_review_provenance', source: 'Radiology' },
];

function openMetricEvidence(card) {
  const provenance = card.section?.metrics?.[card.provenance];
  const evidence = provenance || {};
  const current = card.value === null || !provenance ? 'Unavailable — source evidence insufficient' : Number(card.value).toLocaleString();
  return { title: card.title, sub: 'KPI source evidence', badges: [], facts: [], sections: [{ title: 'Metric Provenance', items: [
    { label: 'Metric', value: card.title }, { label: 'Current Value', value: current },
    { label: 'Source Module', value: evidence.source_module || card.source },
    { label: 'Source Table', value: (evidence.source_tables || []).join(', ') || 'Unavailable' },
    { label: 'Persisted Fields Used', value: (evidence.fields || []).join(', ') || 'Unavailable' },
    { label: 'Filter / Calculation Rule', value: evidence.filter_description || 'Source evidence unavailable' },
    { label: 'Records Counted', value: evidence.record_count ?? 'Unavailable' },
    { label: 'Latest Contributing Source Timestamp', value: evidence.latest_source_timestamp ? formatDate(evidence.latest_source_timestamp) : 'Source timestamp unavailable' },
    { label: 'Calculated At', value: evidence.calculated_at ? formatDate(evidence.calculated_at) : 'Unavailable' },
    { label: 'Data Status', value: evidence.data_status || card.status },
    { label: 'Data Origin', value: evidence.data_origin === 'PERSISTED_DATABASE' ? 'Persisted database records' : 'Unavailable' },
    { label: 'Synthetic / Default Values Used', value: evidence.synthetic_values_used === false ? 'NO' : evidence.synthetic_values_used === true ? 'YES' : 'UNKNOWN' },
  ] }] };
}

function renderEvidenceValue(value) {
  if (value === null || value === undefined || value === '') return 'Unavailable';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(renderEvidenceValue).join(', ');
  if (typeof value === 'object') return Object.entries(value).map(([key, child]) => `${EVIDENCE_LABELS[key] || titleCase(key)}: ${renderEvidenceValue(child)}`).join(' · ');
  return String(value);
}

function formatFeedbackContent(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') {
    try {
      return renderEvidenceValue(JSON.parse(value));
    } catch {
      return value;
    }
  }
  return renderEvidenceValue(value);
}

export default function AG21ManagementCopilotView({ userRole }) {
  const [summary, setSummary] = useState(null);
  const [feed, setFeed] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [feedError, setFeedError] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [priorities, setPriorities] = useState([]);
  const [, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedItem, setSelectedItem] = useState(null);
  const [strategyQuestion, setStrategyQuestion] = useState('');
  const [strategyMessages, setStrategyMessages] = useState([]);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [lastStrategyQuestion, setLastStrategyQuestion] = useState('');
  const [lastStrategyItems, setLastStrategyItems] = useState([]);

  const submitStrategyQuestion = async (questionOverride) => {
    const question = String(questionOverride ?? strategyQuestion).trim();
    if (!question || strategyLoading) return;
    setStrategyQuestion(question);
    setStrategyLoading(true);
    setStrategyMessages((messages) => [...messages, { role: 'CEO', question, pending: true }]);
    const contextQuestion = /evidence|source|provenance|proof|prove|come from|where did|where does|how did you get|explain (?:this|that) number|\bthis number\b|\bthat number\b|\b(those|these|them|only|urgent|oldest|next|more|details|open|orders?|ones?|items?|records?|cases?|first|second|third|last)\b|\bfeedback\s+\d+\b/i.test(question) ? lastStrategyQuestion : undefined;
    try {
      const contextItems = contextQuestion ? lastStrategyItems.map((item) => item.source_record_id).filter(Boolean) : undefined;
      const response = await apiService.queryAg21(question, contextQuestion, contextItems);
      if (/\b(open|show)\b|\bdetails?\b|\bsource\b/i.test(question) && response.items?.[0]?.category === 'FEEDBACK') {
        openEvidence(response.items[0]);
      }
      if (response.items?.length) setLastStrategyItems(response.items);
      setStrategyMessages((messages) => [...messages.filter((message) => !message.pending), { role: 'CEO', question }, { role: 'AG-21', response }]);
      if (!contextQuestion) setLastStrategyQuestion(question);
      setStrategyQuestion('');
    } catch (error) {
      setStrategyMessages((messages) => [...messages.filter((message) => !message.pending), { role: 'CEO', question }, { role: 'AG-21', response: {
        answer: error.status === 403 ? 'Access denied. Your management role cannot query the CEO Strategy Console.' : 'AG-21 could not generate the management explanation at this time.',
        generated_at: new Date().toISOString(), data_status: 'UNAVAILABLE', sources: [], limitations: [error.status === 403 ? 'The backend denied management access.' : 'The AG-21 query endpoint is currently unavailable.'],
      } }]);
      setStrategyQuestion('');
    } finally {
      setStrategyLoading(false);
    }
  };

  const openStrategySources = (response) => {
    const sourceSections = (response.sources || []).map((source, index) => ({
      title: `${source.kind === 'BOTTLENECK' ? 'Bottleneck Evidence' : source.kind === 'LIMITATION' ? 'Evidence Limitation' : 'Metric Evidence'} ${index + 1}`,
      items: source.kind === 'BOTTLENECK'
        ? [
          { label: 'Bottleneck ID', value: source.bottleneck_id }, { label: 'Source module', value: source.source_module },
          { label: 'Source table', value: source.source_table }, { label: 'Source record ID', value: source.source_record_id },
          { label: 'Source status', value: source.source_status }, { label: 'Persisted priority / severity', value: source.source_priority },
          { label: 'Timestamp used', value: formatDate(source.timestamp_used_for_age || source.source_timestamp) },
          { label: 'Age (AG-21 derived)', value: formatAge(source.age_minutes) },
          ...(source.source_origin ? [{ label: 'X-ray record origin', value: source.source_origin }] : []),
        ]
        : [
          { label: 'Metric', value: source.metric }, { label: 'Value', value: source.value },
          { label: 'Source module', value: source.source_module }, { label: 'Source tables', value: (source.source_tables || []).join(', ') },
          ...Object.entries(source.provenance || {}).map(([key, value]) => ({ label: titleCase(key), value: renderEvidenceValue(value) })),
        ],
    }));
    setSelectedItem({
      title: 'CEO Strategy Console Sources', sub: 'AG-21 verified evidence references', badges: [], facts: [],
      sections: sourceSections.length ? sourceSections : [{ title: 'No source records', text: 'AG-21 has no verified source reference for this answer. See the limitation shown with the answer.' }],
    });
  };

  const loadFeed = useCallback(async (filters = {}) => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const response = await apiService.getAg21Bottlenecks({ ...filters, page_size: filters.page_size || pageSize });
      setFeed(response);
      setPriorities(response.available_priorities || []);
      return response;
    } catch (error) {
      setFeedError(error);
      return null;
    } finally {
      setFeedLoading(false);
    }
  }, [pageSize]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setSummaryLoading(true);
    setFeedLoading(true);
    setSummaryError(null);
    setFeedError(null);
    const [summaryResult, feedResult] = await Promise.allSettled([
      apiService.getAg21Summary(),
      apiService.getAg21Bottlenecks({ management_category: category || undefined, priority: priority || undefined, page: 1, page_size: pageSize }),
    ]);
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
    else setSummaryError(summaryResult.reason);
    if (feedResult.status === 'fulfilled') {
      setFeed(feedResult.value);
      setPriorities(feedResult.value.available_priorities || []);
    }
    else setFeedError(feedResult.reason);
    setLastRefreshed(new Date());
    setPage(1);
    setSummaryLoading(false);
    setFeedLoading(false);
    setRefreshing(false);
  }, [category, priority, pageSize]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [summaryResult, feedResult] = await Promise.allSettled([
        apiService.getAg21Summary(),
        apiService.getAg21Bottlenecks({ page: 1, page_size: 20 }),
      ]);
      if (!active) return;
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
      else setSummaryError(summaryResult.reason);
      if (feedResult.status === 'fulfilled') {
        setFeed(feedResult.value);
        setPriorities(feedResult.value.available_priorities || []);
      } else setFeedError(feedResult.reason);
      setLastRefreshed(new Date());
      setSummaryLoading(false);
      setFeedLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const categoryCounts = feed?.category_counts || {};

  const openEvidence = (item) => {
    const evidence = item.evidence && typeof item.evidence === 'object' ? item.evidence : {};
    if (item.category === 'FEEDBACK') {
      const originalFeedback = typeof evidence.original_feedback === 'string' && evidence.original_feedback.trim()
        ? evidence.original_feedback
        : 'Original feedback unavailable';
      const feedbackSections = [
        { title: 'AG-21 Item', items: [
          { label: 'Bottleneck ID', value: item.bottleneck_id || 'Unavailable' },
          { label: 'Category', value: CATEGORY_LABELS[item.category] || titleCase(item.category) },
          { label: 'AG-21 Feed State', value: item.feed_state || 'Unavailable' },
        ] },
        { title: 'Original Source Record', items: [
          { label: 'Source module', value: item.source_agent || 'Unavailable' },
          { label: 'Source table', value: evidence.source_table || 'Unavailable' },
          { label: 'Source record ID', value: item.source_record_id || 'Unavailable' },
          { label: 'Source status', value: item.source_status || evidence.status || 'Unavailable' },
          { label: 'Persisted severity', value: evidence.severity || item.source_priority || 'Unavailable' },
          { label: 'Source timestamp', value: formatDate(item.source_timestamp) },
        ] },
        { title: 'Original Feedback', text: originalFeedback },
      ];
      if (evidence.ai_summary !== null && evidence.ai_summary !== undefined && evidence.ai_summary !== '') {
        feedbackSections.push({ title: 'AI Summary', text: `AI-generated/classified content\n\n${formatFeedbackContent(evidence.ai_summary)}` });
      }
      const issues = formatFeedbackContent(evidence.issues);
      if (issues) feedbackSections.push({ title: 'Issues Identified', text: issues });
      const categories = formatFeedbackContent(evidence.categories);
      if (categories) feedbackSections.push({ title: 'Categories', text: categories });
      feedbackSections.push({
        title: 'Feedback Metadata',
        items: [
          { label: 'Rating', value: renderEvidenceValue(evidence.rating) },
          { label: 'Sentiment', value: renderEvidenceValue(evidence.sentiment) },
          { label: 'Severity', value: renderEvidenceValue(evidence.severity) },
          { label: 'Status', value: renderEvidenceValue(evidence.status) },
          { label: 'Created time', value: formatDate(evidence.created_at || item.source_timestamp) },
          { label: 'Updated time', value: formatDate(evidence.updated_at) },
        ],
      });
      if (evidence.resolution_notes || evidence.resolved_at) {
        feedbackSections.push({
          title: 'Resolution',
          items: [
            ...(evidence.resolution_notes ? [{ label: 'Resolution Notes', value: evidence.resolution_notes }] : []),
            ...(evidence.resolved_at ? [{ label: 'Resolved time', value: formatDate(evidence.resolved_at) }] : []),
          ],
        });
      }
      feedbackSections.push({
        title: 'Source Metadata',
        items: [
          { label: 'Source record ID', value: item.source_record_id || 'Unavailable' },
          { label: 'Source table', value: evidence.source_table || 'Unavailable' },
          { label: 'Source time', value: formatDate(item.source_timestamp) },
          { label: 'AG-21 evaluated/observed time', value: formatDate(item.observed_at) },
        ],
      });
      feedbackSections.push({ title: 'Derived by AG-21', items: [
        { label: 'Age', value: formatAge(item.age_minutes) },
        { label: 'Timestamp used for age', value: formatDate(evidence.timestamp_used_for_age || item.source_timestamp) },
        { label: 'Display rank', value: item.display_rank ?? 'Unavailable' },
        { label: 'Observation time', value: formatDate(item.observed_at) },
        { label: 'AG-21 Feed State', value: item.feed_state || 'Unavailable' },
      ] });
      setSelectedItem({ title: item.title || 'Feedback requiring action', sub: 'Feedback · Management evidence', badges: [], facts: [], sections: feedbackSections });
      return;
    }
    const evidenceFacts = Object.entries(evidence)
      .filter(([key, value]) => SOURCE_EVIDENCE_ALLOWLIST.has(key) && !OMIT_EVIDENCE_KEYS.has(key) && value !== null && value !== undefined)
      .map(([key, value]) => ({ label: EVIDENCE_LABELS[key] || titleCase(key), value: renderEvidenceValue(value) }));
    setSelectedItem({
      title: item.title || 'Bottleneck evidence',
      sub: `${item.source_agent || 'Source unavailable'} · ${item.category ? CATEGORY_LABELS[item.category] || titleCase(item.category) : 'Category unavailable'}`,
      badges: [item.source_priority && { t: `Source priority: ${item.source_priority}` }, (item.source_status || evidence.status) && { t: `Source status: ${item.source_status || evidence.status}` }].filter(Boolean),
      facts: [
        { label: 'AG-21 Item ID', value: item.bottleneck_id || 'Unavailable' },
        { label: 'Category', value: CATEGORY_LABELS[item.category] || titleCase(item.category) },
        { label: 'Source status', value: item.source_status || evidence.status || 'Unavailable' },
      ],
      sections: [
        { title: 'Original Source Record', items: [
          { label: 'Source module', value: item.source_agent || 'Unavailable' },
          { label: 'Source table', value: evidence.source_table || 'Unavailable' },
          { label: 'Source record ID', value: item.source_record_id || 'Unavailable' },
          { label: 'Source status', value: item.source_status || evidence.status || evidence.queue_status || evidence.projection_status || evidence.review_status || 'Unavailable' },
          { label: 'Source priority / severity', value: item.source_priority || evidence.priority || evidence.severity || 'Unavailable' },
          { label: 'Source timestamp', value: formatDate(item.source_timestamp) },
          ...(evidence.source_origin ? [{ label: 'X-ray record origin', value: evidence.source_origin }] : []),
          ...evidenceFacts,
        ] },
        { title: 'Derived by AG-21', items: [
          { label: 'Age', value: formatAge(item.age_minutes) },
          { label: 'Timestamp used for age', value: formatDate(evidence.timestamp_used_for_age || item.source_timestamp) },
          { label: 'Display rank', value: item.display_rank ?? 'Unavailable' },
          { label: 'Observation time', value: formatDate(item.observed_at) },
          { label: 'AG-21 Feed State', value: item.feed_state || 'Unavailable' },
        ] },
      ],
    });
  };

  const openQueueEvidence = (item) => {
    const evidence = item.evidence || {};
    setSelectedItem({
      title: item.patient_display || 'Queue entry', sub: 'AG-06 Queue · Management detail', badges: [], facts: [],
      sections: [
        { title: 'Queue Record', items: [
          { label: 'Patient', value: item.patient_display || 'Unavailable' },
          { label: 'Department', value: item.department || 'Unavailable' },
          { label: 'Doctor', value: item.doctor || 'Unavailable' },
          { label: 'Token', value: item.token || 'Unavailable' },
          { label: 'Queue status', value: item.source_status || 'Unavailable' },
          { label: 'Checked in', value: formatDate(item.checked_in_at) },
          { label: 'Called', value: formatDate(item.called_at) },
          { label: 'Consultation started', value: formatDate(item.consultation_started_at) },
        ] },
        { title: 'Source Evidence', items: [
          { label: 'Source module', value: item.source_module || 'AG-06' },
          { label: 'Source table', value: item.source_table || 'queue_entries' },
          { label: 'Source record ID', value: item.source_record_id || 'Unavailable' },
          { label: 'Persisted source status', value: evidence.queue_status || item.source_status || 'Unavailable' },
          { label: 'Source timestamp', value: formatDate(item.source_timestamp) },
        ] },
        { title: 'Derived by AG-21', items: [
          { label: 'Waiting age', value: formatAge(item.age_minutes) },
          { label: 'Age anchor', value: 'Persisted checked_in_at' },
        ] },
      ],
    });
  };

  if (!isPageAllowed(userRole, 'management-copilot')) {
    return <main className="ag21-page"><section className="ag21-message ag21-denied" role="alert"><h1>Access denied</h1><p>You do not have permission to view the Executive Command Center.</p></section></main>;
  }

  const cards = KPI_DEFINITIONS.map((definition) => {
    const section = summary?.[definition.section];
    const baseStatus = summaryLoading && !summary ? 'LOADING' : summaryError ? 'UNAVAILABLE' : statusText(section);
    const provenance = section?.metrics?.[definition.provenance];
    const provenanceValid = provenance?.data_origin === 'PERSISTED_DATABASE'
      && provenance?.synthetic_values_used === false
      && Number.isFinite(Number(provenance?.record_count));
    const status = baseStatus !== 'LOADING' && baseStatus !== 'UNAVAILABLE' && !provenanceValid ? 'UNAVAILABLE' : baseStatus;
    const value = status === 'UNAVAILABLE' ? null : metricValue(section, definition.metric);
    return { ...definition, section, status, value };
  });

  const items = feed?.items || [];
  const sourceStatuses = feed?.source_status ? Object.values(feed.source_status) : [];
  const anySourceAvailable = sourceStatuses.some((status) => status === 'AVAILABLE');
  const feedUnavailable = feed?.data_status === 'UNAVAILABLE' || (sourceStatuses.length > 0 && !anySourceAvailable);

  return (
    <main className="ag21-page">
      <header className="ag21-header">
        <div><div className="ag21-eyebrow">AG-21 MANAGEMENT COPILOT</div><h1>Executive Command Center</h1><p>Current operational priorities and management evidence</p></div>
        <div className="ag21-refresh-group"><div className="ag21-last-refresh">Last refreshed: {lastRefreshed ? formatDate(lastRefreshed) : 'Loading'}</div><button type="button" className="ag21-refresh-button" onClick={refreshAll} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
      </header>

      <section className="ag21-section" aria-labelledby="ag21-snapshot-heading">
        <div className="ag21-section-heading"><div><h2 id="ag21-snapshot-heading">Operational Snapshot</h2><p>Persisted metrics reported by AG-21</p></div>{summary?.data_status && <span className={`ag21-status status-${summary.data_status.toLowerCase()}`}>{titleCase(summary.data_status)} summary</span>}</div>
        {summaryError && <div className="ag21-message" role="status">{summaryError.status === 403 ? 'Access denied. Your management role cannot view the executive summary.' : 'Executive summary temporarily unavailable'}</div>}
        <div className="ag21-kpi-grid">
          {cards.map((card) => <article className="ag21-kpi-card" key={card.title}>
            <div className="ag21-kpi-top"><span className="ag21-kpi-title">{card.title}</span><span className={`ag21-status status-${card.status.toLowerCase()}`}>{card.status === 'LOADING' ? 'Loading' : titleCase(card.status)}</span></div>
            <div className="ag21-kpi-value">{card.status === 'LOADING' ? <span className="ag21-skeleton" /> : card.value === null ? 'Unavailable' : Number(card.value).toLocaleString()}</div>
            <div className="ag21-kpi-source">{card.source}{card.status === 'PARTIAL' && <span className="ag21-partial-note"> · Partial data</span>}</div>
            <button type="button" className="ag21-source-button" onClick={() => setSelectedItem(openMetricEvidence(card))} disabled={card.status === 'LOADING'}>View Source</button>
          </article>)}
        </div>
        {summaryError && <p className="ag21-error-detail">{summaryError.status === 403 ? 'Your session is authenticated, but the backend has denied management access.' : summaryError.message}</p>}
      </section>

      <section className="ag21-section ag21-strategy-section" aria-labelledby="ag21-strategy-heading">
        <div className="ag21-section-heading">
          <div><h2 id="ag21-strategy-heading">CEO Strategy Console</h2><p>Ask operational questions answered only from verified AG-21 summary and bottleneck evidence.</p></div>
        </div>
        <form className="ag21-strategy-form" onSubmit={(event) => { event.preventDefault(); submitStrategyQuestion(); }}>
          <label className="ag21-sr-only" htmlFor="ag21-strategy-question">Ask about current hospital operations</label>
          <input id="ag21-strategy-question" value={strategyQuestion} onChange={(event) => setStrategyQuestion(event.target.value)} maxLength={1000} placeholder="Ask about current hospital operations..." disabled={strategyLoading} />
          <button type="submit" className="ag21-refresh-button" disabled={strategyLoading || !strategyQuestion.trim()}>{strategyLoading ? 'Asking…' : 'Ask'}</button>
        </form>
        <div className="ag21-strategy-suggestions" aria-label="Suggested questions">
          {STRATEGY_SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => submitStrategyQuestion(suggestion)} disabled={strategyLoading}>{suggestion}</button>)}
        </div>
        {strategyMessages.length > 0 && <div className="ag21-strategy-transcript" aria-live="polite">
          {strategyMessages.map((message, index) => message.role === 'CEO' ? (
            <div className="ag21-strategy-question" key={`q-${index}`}><span>CEO</span><p>{message.question}{message.pending ? ' · AG-21 is checking current evidence…' : ''}</p></div>
          ) : (
            <article className="ag21-strategy-answer" key={`a-${index}`}>
              <div className="ag21-strategy-answer-heading"><strong>AG-21</strong><span className={`ag21-status status-${String(message.response.data_status || 'UNAVAILABLE').toLowerCase()}`}>{titleCase(message.response.data_status || 'UNAVAILABLE')}</span></div>
              <p>{message.response.answer}</p>
              <div className="ag21-strategy-answer-meta"><span>Generated: {formatDate(message.response.generated_at)}</span><span>{(message.response.sources || []).length} source reference{(message.response.sources || []).length === 1 ? '' : 's'}</span></div>
              {message.response.items?.length > 0 && <div className="ag21-feedback-result-list">
                {message.response.items.map((feedbackItem, feedbackIndex) => <article className="ag21-feedback-result" key={feedbackItem.bottleneck_id || feedbackItem.source_record_id || feedbackIndex}>
                  <div className="ag21-feedback-result-heading"><h4>{feedbackIndex + 1}. {feedbackItem.title || 'Feedback requiring action'}</h4><span className={`ag21-priority priority-${String(feedbackItem.severity || 'unspecified').toLowerCase()}`}>{feedbackItem.severity || 'Severity unavailable'}</span></div>
                  <div className="ag21-feedback-result-meta">
                    <span>Raised by: {feedbackItem.raised_by || 'Unavailable'}</span>
                    <span>Status: {feedbackItem.source_status || 'Unavailable'}</span>
                    <span>Rating: {feedbackItem.rating === null || feedbackItem.rating === undefined ? 'Unavailable' : `${feedbackItem.rating}/10`}</span>
                    <span>Sentiment: {feedbackItem.sentiment || 'Unavailable'}</span>
                    <span>Raised: {feedbackItem.created_at ? formatDate(feedbackItem.created_at) : 'Date/time unavailable'}</span>
                  </div>
                  <p className="ag21-feedback-result-excerpt">{feedbackItem.feedback_excerpt || 'Feedback text unavailable'}</p>
                  <button type="button" className="ag21-evidence-button" onClick={() => openEvidence(feedbackItem)}>View Details</button>
                </article>)}
              </div>}
              {message.response.answer_type === 'QUEUE_LIST' && message.response.items?.length > 0 && <div className="ag21-feedback-result-list">
                {message.response.items.map((queueItem) => <article className="ag21-feedback-result" key={queueItem.source_record_id}>
                  <div className="ag21-feedback-result-heading"><h4>{queueItem.patient_display || 'Patient: Unavailable'}</h4><span className="ag21-category-tag">{queueItem.source_status ? titleCase(queueItem.source_status) : 'Status unavailable'}</span></div>
                  <div className="ag21-feedback-result-meta">
                    <span>Department: {queueItem.department || 'Unavailable'}</span><span>Doctor: {queueItem.doctor || 'Unavailable'}</span>
                    <span>Token: {queueItem.token || 'Unavailable'}</span><span>Checked in: {queueItem.checked_in_at ? formatDate(queueItem.checked_in_at) : 'Unavailable'}</span>
                    <span>Waiting: {formatAge(queueItem.age_minutes)}</span>
                  </div>
                  <button type="button" className="ag21-evidence-button" onClick={() => openQueueEvidence(queueItem)}>View Details</button>
                </article>)}
              </div>}
              {message.response.limitations?.length > 0 && <div className="ag21-strategy-limitations"><strong>Limitations</strong><ul>{message.response.limitations.map((limitation, limitationIndex) => <li key={limitationIndex}>{limitation}</li>)}</ul></div>}
              <button type="button" className="ag21-evidence-button" onClick={() => openStrategySources(message.response)}>View Sources</button>
            </article>
          ))}
        </div>}
      </section>

      <section className="ag21-section ag21-feed-section" aria-labelledby="ag21-feed-heading">
        <div className="ag21-section-heading"><div><h2 id="ag21-feed-heading">Live Bottleneck Feed</h2><p>Backend-ranked operational items from monitored AG-21 sources</p></div>{feed?.data_status && <span className={`ag21-status status-${feed.data_status.toLowerCase()}`}>{titleCase(feed.data_status)} feed</span>}</div>
        <div className="ag21-category-chips" aria-label="Filter by bottleneck category">
          {MANAGEMENT_CATEGORIES.map(({ id, label }) => <button
            key={id || 'all'} type="button" className={`ag21-category-chip${category === id ? ' selected' : ''}`}
            aria-pressed={category === id} onClick={() => {
              setCategory(id); setPage(1);
              loadFeed({ management_category: id || undefined, priority: priority || undefined, page: 1, page_size: pageSize });
            }}
          >{label}<span>{Number(categoryCounts[id || 'ALL'] || 0).toLocaleString()}</span></button>)}
        </div>
        <div className="ag21-filters">
          <label>Source priority<select aria-label="Filter source priority" value={priority} onChange={(event) => {
            const value = event.target.value; setPriority(value); setPage(1);
            loadFeed({ management_category: category || undefined, priority: value || undefined, page: 1, page_size: pageSize });
          }}><option value="">All priorities</option>{priorities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          {(category || priority) && <button type="button" className="ag21-clear-filters" onClick={() => {
            setCategory(''); setPriority(''); setPage(1);
            loadFeed({ page: 1, page_size: pageSize });
          }}>Clear filters</button>}
          <span className="ag21-feed-count">{feed && Number.isFinite(feed.total_active) ? `${feed.total_active.toLocaleString()} active overall` : ''}</span>
        </div>
        {feed && <div className="ag21-feed-page-controls">
          <span>{feed.filtered_total ? `Showing ${((feed.page - 1) * feed.page_size) + 1}–${Math.min(feed.page * feed.page_size, feed.filtered_total)} of ${feed.filtered_total.toLocaleString()} filtered` : 'Showing 0 filtered items'}</span>
          <label>Per page<select aria-label="Items per page" value={pageSize} onChange={(event) => {
            const value = Number(event.target.value); setPageSize(value); setPage(1);
            loadFeed({ management_category: category || undefined, priority: priority || undefined, page: 1, page_size: value });
          }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
          <nav className="ag21-pagination" aria-label="Bottleneck pages">
            <button type="button" disabled={feed.page <= 1 || feedLoading} onClick={() => {
              const nextPage = feed.page - 1; setPage(nextPage);
              loadFeed({ management_category: category || undefined, priority: priority || undefined, page: nextPage, page_size: pageSize });
            }}>Previous</button>
            {getPageNumbers(feed.page || 1, feed.total_pages || 0).map((number, index) => number === '…'
              ? <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
              : <button type="button" key={number} className={number === feed.page ? 'selected' : ''} aria-current={number === feed.page ? 'page' : undefined} disabled={feedLoading} onClick={() => {
                setPage(number); loadFeed({ management_category: category || undefined, priority: priority || undefined, page: number, page_size: pageSize });
              }}>{number}</button>)}
            <button type="button" disabled={feed.page >= feed.total_pages || feedLoading} onClick={() => {
              const nextPage = feed.page + 1; setPage(nextPage);
              loadFeed({ management_category: category || undefined, priority: priority || undefined, page: nextPage, page_size: pageSize });
            }}>Next</button>
          </nav>
        </div>}

        {feedLoading && <div className="ag21-feed-skeletons" aria-label="Loading bottlenecks">{[0, 1, 2].map((item) => <div className="ag21-feed-skeleton" key={item}><span className="ag21-skeleton ag21-skeleton-short" /><span className="ag21-skeleton" /><span className="ag21-skeleton ag21-skeleton-long" /></div>)}</div>}
        {feedError && <div className="ag21-message" role="status">{feedError.status === 403 ? 'Access denied. Your management role cannot view the bottleneck feed.' : 'Live bottleneck feed temporarily unavailable'}<div className="ag21-error-detail">{feedError.status === 403 ? 'The backend denied management access for this account.' : feedError.message}</div></div>}
        {!feedError && feedUnavailable && <div className="ag21-message">Live bottleneck feed temporarily unavailable</div>}
        {!feedError && !feedUnavailable && feed?.data_status === 'PARTIAL' && <div className="ag21-message ag21-partial-warning" role="status">Some monitored sources are currently unavailable; results include available sources.</div>}
        {!feedError && !feedUnavailable && feed && !feedLoading && items.length === 0 && (
          <div className="ag21-empty-state">{category ? 'No active bottlenecks in this category.' : 'No active bottlenecks found in the currently monitored AG-21 sources.'}</div>
        )}
        {!feedError && !feedUnavailable && !feedLoading && items.length > 0 && <div className="ag21-feed-list">
          {items.map((item, index) => <article className="ag21-feed-item" key={item.bottleneck_id || `${item.category}-${item.source_record_id}-${index}`}>
            <div className="ag21-priority-col">{item.source_priority ? <span className={`ag21-priority priority-${String(item.source_priority).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{item.source_priority}</span> : <span className="ag21-priority priority-unspecified">Priority unavailable</span>}</div>
            <div className="ag21-feed-content"><div className="ag21-feed-title-line"><h3>{item.title || 'Untitled bottleneck'}</h3><span className="ag21-category-tag">{CATEGORY_LABELS[item.category] || titleCase(item.category) || 'Category unavailable'}</span></div>
              <p className="ag21-feed-summary">{item.summary || 'Summary unavailable'}</p>
              <div className="ag21-feed-meta"><span>Source: {item.source_agent || 'Unavailable'}</span><span>Source status: {item.source_status || 'Unavailable'}</span><span>Age: {formatAge(item.age_minutes)}</span><span>Observed: {formatDate(item.observed_at)}</span></div>
            </div>
            <button type="button" className="ag21-evidence-button" onClick={() => openEvidence(item)}>View Evidence</button>
          </article>)}
        </div>}
      </section>
      <DetailDrawer drawer={selectedItem} onClose={() => setSelectedItem(null)} />
    </main>
  );
}
