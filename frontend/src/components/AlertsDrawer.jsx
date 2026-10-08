import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { CardGridSkeleton } from './ModuleLoadingScreen';

/**
 * AlertsDrawer — Hospital Notification Centre Slide-over Panel
 *
 * Field mapping from API response:
 *   id           – unique notification ID (e.g. "NOTIF-0570" or "ESC-0019")
 *   type         – notification type string (e.g. "APPOINTMENT_CONFIRMED", "ESCALATION")
 *   priority     – "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"  (canonical)
 *   status       – "UNREAD" | "READ"                       (canonical)
 *   title        – short display title
 *   message      – full notification message
 *   source       – originating system (e.g. "Clinical Safety Gateway")
 *   patient_id   – linked patient ID (may be null)
 *   patient_name – linked patient full name
 *   created_at   – ISO timestamp
 *   unread       – boolean convenience flag (same as status === "UNREAD")
 */
export default function AlertsDrawer({ isOpen, onClose, onNavigate, onOpenPatient, role, currentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [filter, setFilter] = useState('ALL'); // ALL, CRITICAL, UNREAD, DISCHARGE
  const [markingId, setMarkingId] = useState(null);

  const fetchAlerts = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Pass current role and user details for user-scoped filtering
      const res = await apiService.getNotifications({
        limit: 200,
        role: role || undefined,
        username: currentUser?.username || undefined,
        user_name: currentUser?.name || undefined
      });
      if (res && res.success) {
        setNotifications(res.data || []);
        setTotalCount(res.total || 0);
        setUnreadCount(res.unread_count || 0);
        setCriticalCount(res.critical_count || 0);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
      const interval = setInterval(() => fetchAlerts(true), 12000);
      const handleUpdate = () => fetchAlerts(true);
      window.addEventListener('hc_api_updated', handleUpdate);
      return () => {
        clearInterval(interval);
        window.removeEventListener('hc_api_updated', handleUpdate);
      };
    }
  }, [isOpen, role, currentUser?.username, currentUser?.name]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleMarkRead = async (id, e) => {
    e?.stopPropagation();
    try {
      setMarkingId(id);
      // Optimistic instant UI update
      setNotifications(prev => prev.map(item => item.id === id ? { ...item, status: 'READ', unread: false, state: 'Read' } : item));
      setUnreadCount(prev => Math.max(0, prev - 1));
      await apiService.markNotificationRead(id);
      await fetchAlerts(true);
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Optimistic instant UI update
      setNotifications(prev => prev.map(item => ({ ...item, status: 'READ', unread: false, state: 'Read' })));
      setUnreadCount(0);
      await apiService.markAllNotificationsRead({
        role: role || undefined,
        username: currentUser?.username || undefined,
        user_name: currentUser?.name || undefined
      });
      await fetchAlerts(true);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const leaveCount = notifications.filter(item => {
    const txt = `${item.title || ''} ${item.message || ''} ${item.type || ''} ${item.source || ''}`.toLowerCase();
    return txt.includes('leave') || txt.includes('comp-off') || txt.includes('staff') || txt.includes('employee');
  }).length;

  const filteredList = notifications.filter(item => {
    const itemPriority = (item.priority || item.pri || '').toUpperCase();
    const isItemUnread = item.status === 'UNREAD' || item.unread === true || (item.state || '').toUpperCase() === 'UNREAD';
    const itemMessage = item.message || item.detail || '';
    const itemType = item.type || '';

    if (filter === 'CRITICAL') {
      return itemPriority === 'CRITICAL' || itemPriority === 'HIGH';
    }
    if (filter === 'UNREAD') {
      return isItemUnread;
    }
    if (filter === 'DISCHARGE') {
      const txt = `${item.title || ''} ${itemMessage} ${itemType}`.toLowerCase();
      return txt.includes('discharge') || txt.includes('block') || txt.includes('pending') || txt.includes('admission');
    }
    if (filter === 'LEAVE') {
      const txt = `${item.title || ''} ${itemMessage} ${itemType} ${item.source || ''}`.toLowerCase();
      return txt.includes('leave') || txt.includes('comp-off') || txt.includes('staff') || txt.includes('employee');
    }
    return true;
  });

  // Helper to calculate human-readable relative time and exact timestamp (12-hour format)
  const formatAlertTime = (dateStr) => {
    if (!dateStr) return { relative: 'Recently', timeFormatted: '--:--', isNew: false, dateFormatted: '' };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { relative: 'Recently', timeFormatted: '--:--', isNew: false, dateFormatted: '' };
    
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    const isToday = d.toDateString() === now.toDateString();
    const timeFormatted = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

    let relative = '';
    let isNew = false;

    if (diffSec < 60) {
      relative = 'Just now';
      isNew = true;
    } else if (diffMin < 60) {
      relative = `${diffMin}m ago`;
      if (diffMin <= 30) isNew = true;
    } else if (diffHours < 24 && isToday) {
      relative = `${diffHours}h ago (${timeFormatted})`;
      if (diffHours < 2) isNew = true;
    } else if (diffDays === 1 || (!isToday && diffHours < 48)) {
      relative = `Yesterday (${timeFormatted})`;
    } else if (diffDays < 7) {
      relative = `${diffDays}d ago (${dateFormatted})`;
    } else {
      relative = `${dateFormatted}, ${timeFormatted}`;
    }

    return {
      relative,
      timeFormatted,
      dateFormatted,
      isNew,
      isToday
    };
  };

  const renderAlertCard = (item, idx) => {
    const itemPriority = (item.priority || item.pri || 'NORMAL').toUpperCase();
    const isUnread = item.status === 'UNREAD' || item.unread === true || (item.state || '').toUpperCase() === 'UNREAD';
    const isCritical = itemPriority === 'CRITICAL';
    const isHigh = itemPriority === 'HIGH';
    const itemMessage = item.message || item.detail || 'No additional details provided.';
    const itemType = item.type || 'Clinical';
    const itemSource = item.source || item.src || '';
    const timeInfo = formatAlertTime(item.created_at);

    return (
      <div
        key={item.id || idx}
        style={{
          padding: '12px 14px',
          borderRadius: '8px',
          borderTop: '1px solid',
          borderRight: '1px solid',
          borderBottom: '1px solid',
          borderLeft: isUnread 
            ? (isCritical ? '4px solid #ef4444' : isHigh ? '4px solid #f97316' : '4px solid #2563eb')
            : '4px solid #cbd5e1',
          borderColor: isUnread 
            ? (isCritical ? '#fca5a5' : isHigh ? '#fdba74' : '#bfdbfe')
            : '#e2e8f0',
          background: isUnread 
            ? (isCritical ? '#fff8f8' : isHigh ? '#fffaf5' : '#f8fbff')
            : '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: isUnread ? '0 2px 6px rgba(15, 23, 42, 0.05)' : 'none',
          opacity: isUnread ? 1 : 0.82,
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* NEW / UNREAD Indicator Badge */}
            {isUnread ? (
              <span style={{
                padding: '2px 7px',
                fontSize: '10px',
                fontWeight: 800,
                borderRadius: '10px',
                background: '#2563eb',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                letterSpacing: '0.4px'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }} />
                NEW
              </span>
            ) : (
              <span style={{
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: 600,
                borderRadius: '4px',
                background: '#e2e8f0',
                color: '#64748b'
              }}>
                ✓ Read
              </span>
            )}

            <span style={{
              padding: '2px 6px',
              fontSize: '10px',
              fontWeight: 700,
              borderRadius: '4px',
              background: itemPriority === 'CRITICAL' ? '#fee2e2' : itemPriority === 'HIGH' ? '#ffedd5' : '#f1f5f9',
              color: itemPriority === 'CRITICAL' ? '#b91c1c' : itemPriority === 'HIGH' ? '#c2410c' : '#475569'
            }}>
              {itemPriority}
            </span>

            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 500 }}>
              {itemType}
            </span>
            {itemSource && (
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                · {itemSource}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Relative & Exact Timestamp */}
            <span 
              title={item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : ''}
              style={{ 
                fontSize: '11px', 
                color: isUnread ? '#1e293b' : '#94a3b8', 
                fontWeight: isUnread ? 700 : 500,
                background: isUnread ? '#ffffff' : 'transparent',
                padding: isUnread ? '1px 6px' : '0',
                borderRadius: '4px',
                border: isUnread ? '1px solid #e2e8f0' : 'none'
              }}
            >
              🕒 {timeInfo.relative}
            </span>

            {isUnread && (
              <button
                type="button"
                onClick={(e) => handleMarkRead(item.id, e)}
                disabled={markingId === item.id}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)'
                }}
                title="Mark as read / acknowledged"
              >
                {markingId === item.id ? '...' : 'Ack'}
              </button>
            )}
          </div>
        </div>

        <div style={{ 
          fontWeight: isUnread ? 700 : 600, 
          fontSize: '12.5px', 
          color: isUnread ? '#0f172a' : '#475569', 
          lineHeight: 1.3 
        }}>
          {item.title || item.subject || 'System Notification'}
        </div>

        <div style={{ 
          fontSize: '11.5px', 
          color: isUnread ? '#334155' : '#64748b', 
          lineHeight: 1.4 
        }}>
          {itemMessage}
        </div>

        {/* Actions / Patient Link */}
        {(item.patient_id || item.patient_name) && (
          <div style={{
            marginTop: '4px',
            paddingTop: '6px',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px'
          }}>
            <span style={{ color: isUnread ? '#475569' : '#64748b' }}>
              {(item.type === 'Staff Leave Request' || (item.source || '').includes('Employee')) ? 'Staff: ' : 'Patient: '}
              <strong>{item.patient_name || item.patient_id}</strong>
              {item.patient_code ? ` (${item.patient_code})` : ''}
            </span>
            {onOpenPatient && item.patient_id && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPatient({
                    id: item.patient_id,
                    name: item.patient_name,
                    patient_id: item.patient_id,
                    patient_code: item.patient_code,
                    uhid: item.patient_code,
                    mrn: item.patient_code
                  });
                }}
                style={{
                  color: '#0284c7',
                  background: 'transparent',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '11px'
                }}
              >
                Open Patient 360 →
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const unreadItems = filteredList.filter(item => item.status === 'UNREAD' || item.unread === true || (item.state || '').toUpperCase() === 'UNREAD');
  const readItems = filteredList.filter(item => item.status !== 'UNREAD' && item.unread !== true && (item.state || '').toUpperCase() !== 'UNREAD');

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.35)',
          backdropFilter: 'blur(3px)',
          zIndex: 1040,
          animation: 'fadeIn 0.18s ease-out'
        }}
      />

      {/* Slide-over Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(520px, 94vw)',
          background: '#ffffff',
          borderLeft: '1px solid #e2e8f0',
          zIndex: 1050,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.12)',
          animation: 'drawerSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: '#fee2e2',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '16px'
            }}>
              🔔
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Hospital Alerts</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: unreadCount > 0 ? '#2563eb' : '#64748b',
                  color: '#ffffff'
                }}>
                  {unreadCount} New
                </span>
                {criticalCount > 0 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: '#ef4444',
                    color: '#ffffff'
                  }}>
                    {criticalCount} Critical
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                {role ? `Showing alerts for: ${role}${currentUser?.name && role !== 'Hospital Management' ? ` · ${currentUser.name}` : ''}` : 'Real-time clinical, operational & system alerts'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  padding: '4px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#0284c7',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
                title="Mark all as read"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 16px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          overflowX: 'auto'
        }}>
          {[
            { id: 'ALL', label: `All (${totalCount})` },
            { id: 'UNREAD', label: `⚡ New / Unread (${unreadCount})` },
            { id: 'CRITICAL', label: `Critical (${criticalCount})` },
            { id: 'DISCHARGE', label: 'Discharge & Admissions' },
            { id: 'LEAVE', label: `Staff Leaves (${leaveCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '5px 10px',
                fontSize: '11.5px',
                fontWeight: filter === tab.id ? 700 : 500,
                color: filter === tab.id ? '#0f172a' : '#64748b',
                background: filter === tab.id ? '#f1f5f9' : 'transparent',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Timeline Sorting Indicator */}
        <div style={{
          padding: '6px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#64748b'
        }}>
          <span>Showing {filteredList.length} alert{filteredList.length === 1 ? '' : 's'}</span>
          <span style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⬇ Sorted: Newest First</span>
          </span>
        </div>

        {/* Alert Items List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {loading && notifications.length === 0 ? (
            <CardGridSkeleton count={3} />
          ) : filteredList.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
              fontSize: '12.5px'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✨</div>
              <div style={{ fontWeight: 600, color: '#334155' }}>No active alerts</div>
              <div style={{ fontSize: '11.5px', marginTop: '4px' }}>All clinical conditions &amp; operational checks are normal.</div>
            </div>
          ) : filter === 'ALL' && unreadItems.length > 0 && readItems.length > 0 ? (
            <>
              {/* Group 1: New / Unread */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px',
                marginBottom: '2px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#1e40af',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                <span>New &amp; Unread Alerts ({unreadItems.length})</span>
              </div>
              {unreadItems.map((item, idx) => renderAlertCard(item, `unread-${item.id || idx}`))}

              {/* Group 2: Earlier / Read */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '16px',
                marginBottom: '2px',
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderTop: '1px dashed #cbd5e1',
                paddingTop: '12px'
              }}>
                <span>✓ Earlier / Acknowledged Alerts ({readItems.length})</span>
              </div>
              {readItems.map((item, idx) => renderAlertCard(item, `read-${item.id || idx}`))}
            </>
          ) : (
            filteredList.map((item, idx) => renderAlertCard(item, item.id || idx))
          )}
        </div>

        {/* Drawer Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onNavigate) onNavigate('notifications');
            }}
            style={{
              padding: '6px 12px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#334155',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Open Full Notification Centre
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#ffffff',
              background: '#0f172a',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
