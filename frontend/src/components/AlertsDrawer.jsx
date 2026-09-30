import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

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
export default function AlertsDrawer({ isOpen, onClose, onNavigate, onOpenPatient, role }) {
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
      // Pass current role for role-based backend filtering
      const res = await apiService.getNotifications({ limit: 50, role: role || undefined });
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
  }, [isOpen, role]);

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
      setLoading(true);
      await apiService.markAllNotificationsRead();
      await fetchAlerts(true);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredList = notifications.filter(item => {
    // Use canonical 'priority' field; fall back to legacy 'pri' for safety
    const itemPriority = (item.priority || item.pri || '').toUpperCase();
    // Use canonical 'status' field; fall back to 'unread' boolean for safety
    const isItemUnread = item.status === 'UNREAD' || item.unread === true || (item.state || '').toUpperCase() === 'UNREAD';
    // Use canonical 'type' and 'message'; fall back to 'detail' for legacy
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
    return true;
  });

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
          width: 'min(500px, 94vw)',
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
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#fee2e2',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '15px'
            }}>
              🔔
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Hospital Alerts</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: unreadCount > 0 ? '#b91c1c' : '#64748b',
                  color: '#ffffff'
                }}>
                  {unreadCount} Unread
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
                {role ? `Showing alerts for: ${role}` : 'Real-time clinical, operational & system alerts'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{
                  padding: '4px 8px',
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
          background: '#ffffff'
        }}>
          {[
            { id: 'ALL', label: `All (${totalCount})` },
            { id: 'CRITICAL', label: `Critical (${criticalCount})` },
            { id: 'UNREAD', label: `Unread (${unreadCount})` },
            { id: 'DISCHARGE', label: 'Discharge & Admissions' }
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
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
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
            <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
              Loading alerts...
            </div>
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
          ) : (
            filteredList.map((item, idx) => {
              // Canonical field names with legacy fallbacks for robustness
              const itemPriority = (item.priority || item.pri || 'NORMAL').toUpperCase();
              const isUnread = item.status === 'UNREAD' || item.unread === true || (item.state || '').toUpperCase() === 'UNREAD';
              const isCritical = itemPriority === 'CRITICAL' || itemPriority === 'HIGH';
              const itemMessage = item.message || item.detail || 'No additional details provided.';
              const itemType = item.type || 'Clinical';
              const itemSource = item.source || item.src || '';

              return (
                <div
                  key={item.id || idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: isCritical
                      ? '1px solid #fca5a5'
                      : isUnread
                      ? '1px solid #cbd5e1'
                      : '1px solid #e2e8f0',
                    background: isCritical
                      ? '#fff5f5'
                      : isUnread
                      ? '#f8fafc'
                      : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    boxShadow: isUnread ? '0 1px 3px rgba(0,0,0,0.03)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 500 }}>
                        {itemType}
                      </span>
                      {itemSource && (
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                          · {itemSource}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace' }}>
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </span>
                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkRead(item.id, e)}
                          disabled={markingId === item.id}
                          style={{
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: 600,
                            color: '#0284c7',
                            background: '#ffffff',
                            border: '1px solid #bae6fd',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          title="Mark as read"
                        >
                          {markingId === item.id ? '...' : 'Ack'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#0f172a', lineHeight: 1.3 }}>
                    {item.title || item.subject || 'System Notification'}
                  </div>

                  <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.4 }}>
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
                      <span style={{ color: '#64748b' }}>
                        Patient: <strong>{item.patient_name || item.patient_id}</strong>
                        {item.patient_code ? ` (${item.patient_code})` : ''}
                      </span>
                      {onOpenPatient && item.patient_id && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenPatient({ id: item.patient_id, name: item.patient_name, patient_id: item.patient_id });
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
            })
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
