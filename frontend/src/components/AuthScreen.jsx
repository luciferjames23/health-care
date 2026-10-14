import React, { useState, useEffect } from 'react';
import { selectAccount, loginWithPassword } from '../services/accountSession';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

const getPasswordForUser = (uname) => {
  if (!uname) return 'Hospital@2026';
  const lower = uname.toLowerCase();
  if (lower === 'admin') return 'admin123';
  return 'Hospital@2026';
};

// 5 Curated Sample Patients with clinical histories (kept for testing compatibility)
export const SAMPLE_PATIENTS = [
  { username: 'patient', patient_code: 'MER-PAT-0087227', name: 'Saanvier Parthalan', age: 34, gender: 'Other', blood: 'A+', condition: 'Asthma / Respiratory', patient_id: 87227 },
  { username: 'kavitha.raman', patient_code: 'MER-PAT-0087225', name: 'Vijayer Parthalan', age: 46, gender: 'Male', blood: 'B+', condition: 'Post-Op Monitoring', patient_id: 87225 },
  { username: 'rajesh.v', patient_code: 'MER-PAT-0142901', name: 'Rajesh Venkataraman', age: 52, gender: 'Male', blood: 'B+', condition: 'Cardiology / Hypertension', patient_id: 142901 },
  { username: 'anand.n', patient_code: 'MER-PAT-0000004', name: 'Anand Narayanan', age: 39, gender: 'Male', blood: 'O+', condition: 'Inpatient / Diagnostics', patient_id: 4 },
  { username: 'divya.n', patient_code: 'MER-PAT-0000009', name: 'Divya Narayanan', age: 28, gender: 'Female', blood: 'A+', condition: 'Clinical Care / Follow-up', patient_id: 9 },
];

export default function AuthScreen({
  onLoginSuccess,
  initialUsername = null,
  initialInfo = '',
  initialRole = null
}) {
  const [username, setUsername] = useState(initialUsername || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(initialInfo || '');
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadUsers() {
      try {
        setLoadingUsers(true);
        const res = await fetch(`${API_BASE_URL}/api/auth/users`);
        if (res.ok) {
          const data = await res.json();
          if (data.users && data.users.length > 0 && isMounted) {
            setUsersList(data.users);
          }
        }
      } catch (err) {
        console.warn('Could not load dynamic users list:', err);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    }
    loadUsers();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (initialUsername) {
      setUsername(initialUsername);
      setPassword(getPasswordForUser(initialUsername));
    }
  }, [initialUsername]);

  useEffect(() => {
    if (initialInfo) {
      setInfo(initialInfo);
    }
  }, [initialInfo]);

  const staffUsers = [...usersList].sort((a, b) => {
    const rank = (user) => {
      const role = user.role?.toLowerCase() || '';
      if (role === 'radiologist') return 0;
      if (role === 'admin') return 1;
      if (role === 'patient') return 3;
      return 2;
    };
    return rank(a) - rank(b);
  });

  const handleSignIn = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (signingIn) return;
    const targetUsername = (username || '').trim();
    if (!targetUsername) {
      setError('Please enter your Username or Employee ID.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }
    setSigningIn(true);
    setError('');
    setInfo('Authenticating credentials…');
    try {
      const userObj = await loginWithPassword(targetUsername, password);
      onLoginSuccess(userObj);
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please check your username and password.');
      setInfo('');
    } finally {
      setSigningIn(false);
    }
  };

  const handleQuickFill = (user) => {
    setUsername(user.username);
    setPassword(getPasswordForUser(user.username));
    setError('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', background: '#f8fafc' }}>
      {/* Left dark branding panel */}
      <aside style={{
        background: '#0f172a',
        color: '#fff',
        padding: '48px 44px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '40px',
        borderRight: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, oklch(0.6 0.14 180), oklch(0.45 0.12 210))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.01em', color: '#ffffff' }}>
              Hospital
            </div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
              Clinical &amp; Hospital Operating Platform
            </div>
          </div>
        </div>

        <div>
          <div style={{
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: '32px',
            lineHeight: 1.25,
            maxWidth: '440px',
            color: '#f8fafc',
            fontWeight: 400
          }}>
            One record, one workflow, every human decision kept with a human.
          </div>
          <div style={{
            marginTop: '28px',
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            gap: '12px 14px',
            color: '#cbd5e1',
            fontSize: '12.5px',
            lineHeight: 1.45
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginTop: '6px' }} />
            <span>HMS · EMR · Billing · LIS · PACS · Pharmacy · Bed Command</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginTop: '6px' }} />
            <span>Role-Based Access Control (RBAC) with token-level isolation</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', marginTop: '6px' }} />
            <span>Governed clinical decision support with end-to-end audit compliance</span>
          </div>
        </div>

        <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>© 2026 Hospital Systems</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            Systems Operational
          </span>
        </div>
      </aside>

      {/* Right sign-in container */}
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 24px' }}>
        <div style={{ width: 'min(440px, 100%)', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Main Production Card */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '32px 30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)'
          }}>
            {/* Header */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: '20px',
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Secure Enterprise Sign In
                </span>
              </div>
              <h1 style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#0f172a',
                margin: '0 0 6px 0',
                letterSpacing: '-0.02em'
              }}>
                Sign In
              </h1>
              <p style={{
                color: '#64748b',
                fontSize: '13px',
                margin: 0,
                lineHeight: 1.5
              }}>
                Enter your institutional credentials to access your clinical workspace and administrative services.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div role="alert" style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '12.5px',
                lineHeight: 1.45
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Info Message */}
            {info && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                color: '#0369a1',
                fontSize: '12.5px',
                lineHeight: 1.45
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>{info}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Username or Employee ID
                </span>
                <input
                  type="text"
                  id="login-username-input"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g. doctor_1, admin, or username"
                  autoComplete="username"
                  autoFocus={!initialUsername}
                  style={{
                    height: '40px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0 14px',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#0284c7';
                    e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.12)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Password</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: '#0284c7',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="login-password-input"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{
                    height: '40px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0 14px',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    background: '#ffffff',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = '#0284c7';
                    e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.12)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </label>

              {/* Remember me & Help row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', marginTop: '-2px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#475569', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ accentColor: '#0284c7', cursor: 'pointer' }}
                  />
                  <span>Remember this device</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowHelpDialog(true)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#0284c7',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: 0,
                    textDecoration: 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                >
                  Need assistance?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="sign-in-submit-btn"
                disabled={signingIn}
                style={{
                  height: '42px',
                  borderRadius: '8px',
                  border: 0,
                  background: 'linear-gradient(135deg, #0f766e, #0d9488)',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: signingIn ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px',
                  boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
                  transition: 'opacity 0.15s, transform 0.05s',
                  opacity: signingIn ? 0.8 : 1
                }}
              >
                {signingIn ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Security Notice */}
            <div style={{
              borderTop: '1px solid #f1f5f9',
              paddingTop: '16px',
              fontSize: '11px',
              color: '#94a3b8',
              lineHeight: 1.5,
              textAlign: 'center'
            }}>
              Authorized clinical and administrative personnel only. System access is monitored, recorded, and audited under institutional security governance.
            </div>
          </div>

          {/* Collapsible Development & Testing Credentials Helper */}
          <details style={{
            border: '1px dashed #cbd5e1',
            borderRadius: '10px',
            padding: '10px 14px',
            background: '#ffffff',
            color: '#64748b',
            fontSize: '12px'
          }}>
            <summary style={{
              cursor: 'pointer',
              fontWeight: 600,
              color: '#475569',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>Demo Accounts &amp; Quick Fill</span>
              <span style={{ fontSize: '10.5px', color: '#0284c7', background: '#f0f9ff', padding: '2px 8px', borderRadius: '12px', border: '1px solid #e0f2fe' }}>
                {loadingUsers ? 'loading accounts...' : `${staffUsers.length} accounts available`}
              </span>
            </summary>

            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Click any profile to auto-fill credentials for quick validation:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto', paddingRight: '4px' }}>
                {staffUsers.map((r) => {
                  const isSelected = username?.toLowerCase() === r.username?.toLowerCase();
                  return (
                    <button
                      key={r.id || r.username}
                      type="button"
                      disabled={signingIn}
                      onClick={() => handleQuickFill(r)}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        borderRadius: '14px',
                        border: isSelected ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
                        background: isSelected ? '#f0fdfa' : '#f8fafc',
                        cursor: 'pointer',
                        fontSize: '11.5px',
                        color: isSelected ? '#0f766e' : '#334155',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s',
                        fontWeight: isSelected ? 600 : 400
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{r.role || 'Doctor'}</span>
                      <span style={{ color: '#64748b' }}>· {r.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </details>

        </div>
      </main>

      {/* IT Helpdesk Modal */}
      {showHelpDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            maxWidth: '400px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Hospital IT Support</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpDialog(false)}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: '18px', padding: 0 }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: 0 }}>
              If you have forgotten your password or require role permissions to access clinical systems, please contact the Hospital IT Helpdesk:
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', fontSize: '12.5px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>Internal Phone:</strong> Ext. 4400 (24/7 Support)</div>
              <div><strong>Direct Line:</strong> +1 (800) 555-0199</div>
              <div><strong>Email:</strong> it-support@hospital.org</div>
              <div><strong>Location:</strong> Clinical Informatics Center, Tower B, Level 2</div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpDialog(false)}
              style={{
                height: '36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
