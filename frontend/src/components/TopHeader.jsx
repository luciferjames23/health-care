import React, { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import UserProfileModal from './UserProfileModal';

export default function TopHeader({
  role,
  setRole,
  user,
  setUser,
  clock,
  advanceClock,
  alertsCount = 0,
  onSignOut,
  onOpenMobile,
  onOpenAlerts,
  onAskAi,
  onOpenModal,
  onSwitchUserPromptPassword,
}) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const accountMenuRef = useRef(null);

  // Dynamic real-time clock and calendar date
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setShowAccountMenu(false);
      }
    };
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAccountMenu]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAccountMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const liveDateStr = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const hours12 = now.getHours() % 12 || 12;
  const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
  const liveTimeStr = `${String(hours12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${ampm}`;

  const displayName = (user?.name || (role === 'Doctor' ? 'Doctor' : 'Admin')).trim();
  const displayRole = user?.role || role || 'Staff';
  const displaySubtitle = user?.specialization || user?.designation || user?.department || user?.dept || '';

  const isDoctor = String(displayRole).trim().toLowerCase() === 'doctor';
  let welcomeTitle = '';
  if (isDoctor) {
    if (/^dr\.?\s+/i.test(displayName)) {
      const clean = displayName.replace(/^dr\.?\s+/i, '').trim();
      welcomeTitle = `Welcome, Dr. ${clean}`;
    } else {
      welcomeTitle = `Welcome, Dr. ${displayName}`;
    }
  } else {
    welcomeTitle = `Welcome, ${displayName}`;
  }

  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
    : 'U';

  const isPatient = (role === 'Patient' || displayRole.toLowerCase() === 'patient');

  const unreadBadgeCount = typeof alertsCount === 'number' ? Math.max(0, alertsCount) : (parseInt(alertsCount, 10) || 0);
  const unreadBadgeText = unreadBadgeCount > 99 ? '99+' : String(unreadBadgeCount);

  return (
    <>
      <header style={{
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        zIndex: 40,
        position: 'sticky',
        top: 0,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '8px 20px',
          minHeight: '52px'
        }}>
          {/* Left: Mobile Toggle, Brand & Top-Navbar Personalized Welcome Area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
            <button
              type="button"
              onClick={onOpenMobile}
              aria-label="Toggle navigation menu"
              className="header-mobile-toggle-btn"
              style={{
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#ffffff',
                cursor: 'pointer',
                padding: 0,
                color: '#1e293b',
                flexShrink: 0
              }}
              title="Open navigation menu"
            >
              <Menu size={18} />
            </button>

            {/* Brand Logo & Name: "Hospital" */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', flexShrink: 0 }}
              onClick={() => window.location.reload()}
              title="Hospital Clinical Operating Platform"
            >
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: '7px',
                background: 'linear-gradient(135deg, oklch(0.55 0.14 180), oklch(0.42 0.12 210))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: '14px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}>
                +
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 700, fontSize: '14.5px', letterSpacing: '-0.01em', color: '#0f172a', lineHeight: 1.2 }}>
                  Hospital
                </span>
                <span style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                  Clinical Operating Platform
                </span>
              </div>
            </div>

            {/* Highlighted Top-Navbar Personalized Welcome Message */}
            {!isPatient && (
              <div
                id="top-navbar-welcome-area"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  marginLeft: '8px',
                  borderLeft: '1px solid #e2e8f0',
                  paddingLeft: '18px',
                  minWidth: 0
                }}
              >
                <div style={{
                  fontSize: '13.5px',
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {welcomeTitle}
                </div>
                {displaySubtitle && (
                  <div style={{
                    fontSize: '11px',
                    color: '#64748b',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {displayRole} {displaySubtitle ? `· ${displaySubtitle}` : ''}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Clock, Bell Icon Button, and Profile Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginLeft: 'auto', flexShrink: 0 }}>
            {/* Dynamic Real-time Clock */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '11px',
              color: '#475569',
              background: '#f8fafc',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #f1f5f9'
            }}>
              <span>{liveDateStr}</span>
              <span style={{ color: '#cbd5e1' }}>·</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{liveTimeStr}</span>
            </div>

            {/* Alerts Bell Icon Button with Compact Numeric Unread Badge */}
            <button
              type="button"
              id="btn-header-alerts"
              onClick={() => {
                if (onOpenAlerts) onOpenAlerts();
              }}
              aria-label="View alerts"
              style={{
                position: 'relative',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                padding: 0
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#0f172a';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
              title={unreadBadgeCount > 0 ? `${unreadBadgeCount} Unread Alert${unreadBadgeCount > 1 ? 's' : ''} — Click to open Alert Drawer` : "Alerts Drawer"}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>

              {/* Compact numeric badge showing actual unread notification count */}
              {unreadBadgeCount > 0 && (
                <span
                  id="alerts-unread-badge"
                  data-testid="alerts-unread-badge"
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    minWidth: '17px',
                    height: '17px',
                    padding: '0 4px',
                    borderRadius: '9999px',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 700,
                    lineHeight: '17px',
                    textAlign: 'center',
                    boxShadow: '0 0 0 2px #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
                    pointerEvents: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  {unreadBadgeText}
                </span>
              )}
            </button>

            {/* Circular Profile Avatar Button & Dropdown Menu */}
            <div ref={accountMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                id="top-navbar-avatar-btn"
                onClick={() => setShowAccountMenu(prev => !prev)}
                aria-expanded={showAccountMenu}
                aria-haspopup="true"
                title="Account Menu"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, oklch(0.55 0.12 180), oklch(0.4 0.1 200))',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: showAccountMenu ? '2px solid #0d9488' : '2px solid #ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  outline: 'none',
                  padding: 0
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {initials}
              </button>

              {/* Dropdown containing EXACTLY: My Profile and Sign Out */}
              {showAccountMenu && (
                <div
                  id="account-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '180px',
                    background: '#ffffff',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                    border: '1px solid #e2e8f0',
                    zIndex: 999,
                    overflow: 'hidden',
                    padding: '4px'
                  }}
                >
                  <button
                    type="button"
                    id="menu-item-view-profile"
                    onClick={() => {
                      setShowAccountMenu(false);
                      setShowProfileModal(true);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#0f172a',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '14px' }}>👤</span>
                    <span>My Profile</span>
                  </button>

                  <div style={{ height: '1px', background: '#f1f5f9', margin: '3px 0' }} />

                  <button
                    type="button"
                    id="menu-item-signout"
                    onClick={() => {
                      setShowAccountMenu(false);
                      if (onSignOut) onSignOut();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#b91c1c',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontSize: '14px' }}>🚪</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* User Profile Modal */}
      {showProfileModal && (
        <UserProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onSignOut={onSignOut}
        />
      )}
    </>
  );
}
