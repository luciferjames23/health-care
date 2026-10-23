import React, { useState, useEffect } from 'react';
import {
  Activity, CheckCircle, AlertTriangle, PhoneCall, Clock, RefreshCw, Send,
  UserCheck, ShieldAlert, Calendar, FileText, ChevronRight, X, Filter,
  MessageSquare, AlertCircle, HeartPulse, User, Phone, CheckCircle2, XCircle
} from 'lucide-react';

export default function AG11FollowupAgentView({ userRole = 'Doctor' }) {
  const [metrics, setMetrics] = useState({
    active_plans: 0,
    completed_plans: 0,
    due_tasks: 0,
    overdue_tasks: 0,
    open_escalations: 0,
    pending_callbacks: 0,
    failed_deliveries: 0,
    total_responses: 0
  });

  const [activeTab, setActiveTab] = useState('queue'); // 'queue', 'escalations', 'callbacks'
  const [queue, setQueue] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [callbacks, setCallbacks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected Patient Detail Modal
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Action Modals
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [escalationNotes, setEscalationNotes] = useState('');
  const [escalationError, setEscalationError] = useState('');
  
  const [selectedCallback, setSelectedCallback] = useState(null);
  const [callbackNotes, setCallbackNotes] = useState('');
  const [callbackError, setCallbackError] = useState('');

  // Fetch Overview Metrics
  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/ag11-followup/overview-metrics');
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Failed fetching follow-up agent metrics:', err);
    }
  };

  // Fetch Patient Queue
  const fetchQueue = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({
        status: statusFilter,
        search: searchQuery,
        page: 1,
        limit: 50
      });
      const res = await fetch(`/api/ag11-followup/queue?${query}`);
      const data = await res.json();
      if (data.success) {
        setQueue(data.items || []);
      }
    } catch (err) {
      console.error('Failed fetching follow-up queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Escalations
  const fetchEscalations = async () => {
    try {
      const res = await fetch('/api/ag11-followup/escalations?status=OPEN');
      const data = await res.json();
      if (data.success) {
        setEscalations(data.items || []);
      }
    } catch (err) {
      console.error('Failed fetching escalations:', err);
    }
  };

  // Fetch Callbacks
  const fetchCallbacks = async () => {
    try {
      const res = await fetch('/api/ag11-followup/callbacks?status=PENDING');
      const data = await res.json();
      if (data.success) {
        setCallbacks(data.items || []);
      }
    } catch (err) {
      console.error('Failed fetching callbacks:', err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchQueue();
    fetchEscalations();
    fetchCallbacks();

    const interval = setInterval(() => {
      fetchMetrics();
    }, 15000);
    return () => clearInterval(interval);
  }, [statusFilter, searchQuery]);

  // View Patient Detail
  const handleOpenDetail = async (patientId) => {
    setSelectedPatientId(patientId);
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/ag11-followup/patient/${patientId}/detail`);
      const data = await res.json();
      if (data.success) {
        setPatientDetail(data);
      }
    } catch (err) {
      console.error('Failed fetching patient detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Trigger Manual Discharge Scan
  const handleTriggerScan = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ag11-followup/trigger-scan', { method: 'POST' });
      await res.json();
      fetchMetrics();
      fetchQueue();
    } catch (err) {
      console.error('Manual scan error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve Escalation
  const handleResolveEscalation = async () => {
    if (!selectedEscalation) return;
    setEscalationError('');
    try {
      const res = await fetch(`/api/ag11-followup/escalations/${selectedEscalation.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition_notes: escalationNotes || 'Resolved by nursing staff.' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedEscalation(null);
        setEscalationNotes('');
        setEscalationError('');
        fetchEscalations();
        fetchMetrics();
        fetchQueue();
      } else {
        setEscalationError(data.detail || data.message || 'Failed to resolve escalation.');
      }
    } catch (err) {
      console.error('Resolve escalation error:', err);
      setEscalationError('Network error while resolving escalation.');
    }
  };

  // Complete Callback
  const handleCompleteCallback = async () => {
    if (!selectedCallback) return;
    setCallbackError('');
    try {
      const res = await fetch(`/api/ag11-followup/callbacks/${selectedCallback.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome_notes: callbackNotes || 'Patient contacted via telephone.' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedCallback(null);
        setCallbackNotes('');
        setCallbackError('');
        fetchCallbacks();
        fetchMetrics();
        fetchQueue();
      } else {
        setCallbackError(data.detail || data.message || 'Failed to complete callback.');
      }
    } catch (err) {
      console.error('Complete callback error:', err);
      setCallbackError('Network error while completing callback.');
    }
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Top Header Navigation & Action Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)', boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.2)' }}>
              <HeartPulse size={24} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>Follow-up Agent</h1>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>Meridian Hospital Automated Post-Discharge Clinical Care & Monitoring</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f0fdf4', padding: '6px 14px', borderRadius: '20px', border: '1px solid #bbf7d0', fontSize: '12px', color: '#166534', fontWeight: '500' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
            Scheduler Active (60s loop)
          </div>
          
          <button
            onClick={handleTriggerScan}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: '600', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            Run Discharge Scan
          </button>
        </div>
      </div>

      {/* Screen A: Overview Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
            <span>Active Follow-up Plans</span>
            <Activity size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0f172a' }}>{metrics.active_plans}</div>
          <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', fontWeight: '600' }}>Day 3, 7, 14 Check-in Enrolled</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
            <span>Completed Plans</span>
            <CheckCircle size={18} color="#16a34a" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#16a34a' }}>{metrics.completed_plans}</div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px', fontWeight: '600' }}>Successfully Recovered</div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
            <span>Due / Sent Check-ins</span>
            <Clock size={18} color="#d97706" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#d97706' }}>{metrics.due_tasks}</div>
          <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px', fontWeight: '600' }}>WhatsApp Check-ins Active</div>
        </div>

        <div style={{ backgroundColor: metrics.open_escalations > 0 ? '#fef2f2' : '#ffffff', padding: '18px', borderRadius: '12px', border: metrics.open_escalations > 0 ? '1px solid #fca5a5' : '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
            <span>Clinical Escalations</span>
            <ShieldAlert size={18} color="#dc2626" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: metrics.open_escalations > 0 ? '#dc2626' : '#0f172a' }}>{metrics.open_escalations}</div>
          <div style={{ fontSize: '11px', color: metrics.open_escalations > 0 ? '#b91c1c' : '#64748b', marginTop: '4px', fontWeight: '600' }}>
            {metrics.open_escalations > 0 ? 'Urgent Nursing Review Needed' : 'No Open Escalations'}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
            <span>Pending Callbacks</span>
            <PhoneCall size={18} color="#9333ea" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#9333ea' }}>{metrics.pending_callbacks}</div>
          <div style={{ fontSize: '11px', color: '#7e22ce', marginTop: '4px', fontWeight: '600' }}>Patient Desk Requests</div>
        </div>

      </div>

      {/* Main Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('queue')}
          style={{ padding: '10px 20px', border: 'none', background: 'none', color: activeTab === 'queue' ? '#0284c7' : '#64748b', borderBottom: activeTab === 'queue' ? '2px solid #0284c7' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
        >
          Patient Queue ({queue.length})
        </button>
        <button
          onClick={() => setActiveTab('escalations')}
          style={{ padding: '10px 20px', border: 'none', background: 'none', color: activeTab === 'escalations' ? '#dc2626' : '#64748b', borderBottom: activeTab === 'escalations' ? '2px solid #dc2626' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Clinical Escalations
          {metrics.open_escalations > 0 && (
            <span style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>{metrics.open_escalations}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('callbacks')}
          style={{ padding: '10px 20px', border: 'none', background: 'none', color: activeTab === 'callbacks' ? '#9333ea' : '#64748b', borderBottom: activeTab === 'callbacks' ? '2px solid #9333ea' : '2px solid transparent', fontWeight: '600', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Callback Requests
          {metrics.pending_callbacks > 0 && (
            <span style={{ backgroundColor: '#9333ea', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>{metrics.pending_callbacks}</span>
          )}
        </button>
      </div>

      {/* Screen B: Patient Follow-up Queue */}
      {activeTab === 'queue' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <input
              type="text"
              placeholder="Search patient name, code, or procedure..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '340px', padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '13px', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              {['ALL', 'ACTIVE', 'COMPLETED'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '6px',
                    border: statusFilter === status ? 'none' : '1px solid #cbd5e1',
                    backgroundColor: statusFilter === status ? '#0284c7' : '#ffffff',
                    color: statusFilter === status ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                  <th style={{ padding: '14px 16px' }}>Patient</th>
                  <th style={{ padding: '14px 16px' }}>Procedure</th>
                  <th style={{ padding: '14px 16px' }}>Discharge Date</th>
                  <th style={{ padding: '14px 16px' }}>Stage</th>
                  <th style={{ padding: '14px 16px' }}>Plan Status</th>
                  <th style={{ padding: '14px 16px' }}>Alerts</th>
                  <th style={{ padding: '14px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                      No follow-up plans match the current search filter. Click "Run Discharge Scan" to auto-enroll eligible discharges.
                    </td>
                  </tr>
                ) : (
                  queue.map((item) => (
                    <tr key={item.plan_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.patient_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{item.patient_code} • {item.phone}</div>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#334155' }}>{item.procedure_name}</td>
                      <td style={{ padding: '14px 16px', color: '#64748b' }}>
                        {item.discharge_date ? new Date(item.discharge_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '12px', backgroundColor: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', fontSize: '11px', fontWeight: '600' }}>
                          Day {item.next_followup_day} Check-in
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: item.plan_status === 'ACTIVE' ? '#f0fdf4' : '#f1f5f9',
                          color: item.plan_status === 'ACTIVE' ? '#15803d' : '#64748b',
                          border: item.plan_status === 'ACTIVE' ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                        }}>
                          {item.plan_status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {item.open_escalations > 0 && (
                          <span style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '11px', fontWeight: '600', marginRight: '6px' }}>
                            ⚠️ Escalation
                          </span>
                        )}
                        {item.pending_callbacks > 0 && (
                          <span style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', fontSize: '11px', fontWeight: '600' }}>
                            📞 Callback
                          </span>
                        )}
                        {item.open_escalations === 0 && item.pending_callbacks === 0 && (
                          <span style={{ color: '#64748b', fontSize: '12px' }}>Normal</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenDetail(item.patient_id)}
                          style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #0284c7', backgroundColor: '#f0f9ff', color: '#0284c7', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                        >
                          View Detail
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Screen D: Clinical Escalations Desk */}
      {activeTab === 'escalations' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} />
            Clinical Escalations Queue (Nursing & Care Desk)
          </h3>
          {escalations.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
              No open clinical escalations. Patient responses reporting severe pain, fever, or surgical site concerns will automatically appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {escalations.map(item => (
                <div key={item.id} style={{ padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px', borderLeft: '4px solid #dc2626', borderTop: '1px solid #fee2e2', borderRight: '1px solid #fee2e2', borderBottom: '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', color: '#0f172a' }}>{item.patient_name}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>({item.patient_code})</span>
                      <span style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>HIGH SEVERITY</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: '13px', color: '#991b1b', fontWeight: '600' }}>
                      "{item.symptom_summary}"
                    </p>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Reported: {new Date(item.created_at).toLocaleString()} • Assigned: {item.assigned_team}
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedEscalation(item); setEscalationNotes(''); setEscalationError(''); }}
                    style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontWeight: '600', cursor: 'pointer', fontSize: '12px', boxShadow: '0 1px 2px 0 rgba(220, 38, 38, 0.2)' }}
                  >
                    Acknowledge & Resolve
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Screen D: Callback Requests Desk */}
      {activeTab === 'callbacks' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#9333ea', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PhoneCall size={18} />
            Patient Callback Requests Desk
          </h3>
          {callbacks.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
              No pending callback requests.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {callbacks.map(item => (
                <div key={item.id} style={{ padding: '16px', backgroundColor: '#faf5ff', borderRadius: '8px', borderLeft: '4px solid #9333ea', borderTop: '1px solid #f3e8ff', borderRight: '1px solid #f3e8ff', borderBottom: '1px solid #f3e8ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', color: '#0f172a' }}>{item.patient_name}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Phone: {item.phone}</span>
                      <span style={{ backgroundColor: '#9333ea', color: '#fff', fontSize: '10px', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>{item.priority}</span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: '13px', color: '#6b21a8', fontWeight: '500' }}>
                      Reason: {item.requested_reason}
                    </p>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Requested: {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => { setSelectedCallback(item); setCallbackNotes(''); setCallbackError(''); }}
                    style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#9333ea', color: '#ffffff', fontWeight: '600', cursor: 'pointer', fontSize: '12px', boxShadow: '0 1px 2px 0 rgba(147, 51, 234, 0.2)' }}
                  >
                    Complete Call
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Patient Detail Modal (Screen C) */}
      {selectedPatientId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', width: '700px', maxWidth: '100%', maxHeight: '90vh', borderRadius: '16px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            
            <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Patient Follow-up Detail</h3>
                {patientDetail?.patient && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                    {patientDetail.patient.patient_name} ({patientDetail.patient.patient_code}) • {patientDetail.patient.phone}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedPatientId(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {isDetailLoading || !patientDetail ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading follow-up record...</div>
              ) : (
                <>
                  {/* Plan Overview */}
                  <div style={{ padding: '14px', backgroundColor: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                    <div style={{ fontSize: '12px', color: '#0369a1' }}>Procedure / Care Plan</div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#0284c7', marginTop: '2px' }}>{patientDetail.plan?.procedure_name || 'General Post-Discharge'}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      Discharge Date: {patientDetail.plan?.discharge_date ? new Date(patientDetail.plan.discharge_date).toLocaleDateString() : 'N/A'} • Plan Status: <strong style={{ color: '#16a34a' }}>{patientDetail.plan?.status}</strong>
                    </div>
                  </div>

                  {/* Scheduled Tasks Timeline */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0f172a' }}>Scheduled Check-ins (Day 3, 7, 14)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      {patientDetail.tasks?.map(task => (
                        <div key={task.id} style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>Day {task.followup_day} Check-in</div>
                          <div style={{ fontSize: '11px', color: '#64748b', margin: '4px 0' }}>Due: {new Date(task.due_date).toLocaleDateString()}</div>
                          <span style={{
                            fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px',
                            backgroundColor: task.status === 'COMPLETED' ? '#f0fdf4' : task.status === 'SENT' ? '#f0f9ff' : '#f1f5f9',
                            color: task.status === 'COMPLETED' ? '#15803d' : task.status === 'SENT' ? '#0284c7' : '#64748b',
                            border: task.status === 'COMPLETED' ? '1px solid #bbf7d0' : task.status === 'SENT' ? '1px solid #bae6fd' : '1px solid #e2e8f0'
                          }}>
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Patient Responses */}
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0f172a' }}>Structured Responses ({patientDetail.responses?.length || 0})</h4>
                    {patientDetail.responses?.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>No responses received yet.</div>
                    ) : (
                      patientDetail.responses.map(resp => (
                        <div key={resp.id} style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '8px', borderLeft: '3px solid #0284c7', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ fontWeight: '600', color: '#0284c7' }}>{resp.response_type}</span>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>{new Date(resp.created_at).toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>"{resp.raw_text}"</div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Escalations & Callbacks */}
                  {patientDetail.escalations?.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#dc2626' }}>Clinical Escalations</h4>
                      {patientDetail.escalations.map(e => (
                        <div key={e.id} style={{ padding: '10px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '12px', color: '#991b1b' }}>
                          <strong>{e.severity} Severity:</strong> {e.symptom_summary} ({e.status})
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ padding: '14px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button onClick={() => setSelectedPatientId(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#0284c7', color: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Escalation Resolve Modal */}
      {selectedEscalation && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#ffffff', width: '450px', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#dc2626' }}>Resolve Clinical Escalation</h3>
            <p style={{ fontSize: '13px', color: '#334155', marginBottom: '12px' }}>
              Patient: <strong>{selectedEscalation.patient_name}</strong><br />
              Symptom: "{selectedEscalation.symptom_summary}"
            </p>
            {escalationError && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '12px', marginBottom: '12px' }}>
                {escalationError}
              </div>
            )}
            <textarea
              placeholder="Enter clinical disposition notes..."
              value={escalationNotes}
              onChange={e => setEscalationNotes(e.target.value)}
              style={{ width: '100%', height: '80px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '12px', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => { setSelectedEscalation(null); setEscalationError(''); }} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleResolveEscalation} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>Save & Resolve</button>
            </div>
          </div>
        </div>
      )}

      {/* Callback Resolve Modal */}
      {selectedCallback && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#ffffff', width: '450px', padding: '24px', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#9333ea' }}>Complete Callback Request</h3>
            <p style={{ fontSize: '13px', color: '#334155', marginBottom: '12px' }}>
              Patient: <strong>{selectedCallback.patient_name}</strong> ({selectedCallback.phone})<br />
              Reason: "{selectedCallback.requested_reason}"
            </p>
            {callbackError && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '12px', marginBottom: '12px' }}>
                {callbackError}
              </div>
            )}
            <textarea
              placeholder="Enter call outcome notes..."
              value={callbackNotes}
              onChange={e => setCallbackNotes(e.target.value)}
              style={{ width: '100%', height: '80px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a', fontSize: '12px', marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => { setSelectedCallback(null); setCallbackError(''); }} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCompleteCallback} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#9333ea', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>Mark Completed</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
