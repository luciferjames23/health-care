import React, { useState, useEffect } from 'react';
import { selectAccount, loginWithPassword } from '../services/accountSession';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

const getPasswordForUser = (uname) => {
  if (!uname) return 'Hospital@2026';
  const lower = uname.toLowerCase();
  if (lower === 'admin') return 'admin123';
  return 'Hospital@2026';
};

// 5 Curated Sample Patients with clinical histories
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
  const [loginMode, setLoginMode] = useState(() => {
    if (initialRole?.toLowerCase() === 'patient') return 'patient';
    const isSample = SAMPLE_PATIENTS.some(p => p.username === initialUsername || p.patient_code === initialUsername);
    return isSample ? 'patient' : 'staff';
  });

  const [username, setUsername] = useState(initialUsername || (loginMode === 'patient' ? 'patient' : 'admin'));
  const [password, setPassword] = useState(() => getPasswordForUser(initialUsername || (loginMode === 'patient' ? 'patient' : 'admin')));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(initialInfo || '');
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadUsers() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/users`);
        if (res.ok) {
          const data = await res.json();
          if (data.users && data.users.length > 0 && isMounted) {
            setUsersList(data.users);
            if (!initialUsername) {
              if (loginMode === 'patient') {
                setUsername('patient');
                setPassword('Hospital@2026');
              } else {
                const defaultUser = data.users.find(u => u.username === 'admin') || data.users[0];
                if (defaultUser) {
                  setUsername(defaultUser.username);
                  setPassword(getPasswordForUser(defaultUser.username));
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not load dynamic users from database table:', err);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    }
    loadUsers();
    return () => { isMounted = false; };
  }, [initialUsername]);

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

  // Show every account from public.users (staff + patient + inactive)
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

  // Selected user lookup
  const selectedUser = usersList.find(u => 
    u.username?.toLowerCase() === (username || '').trim().toLowerCase() ||
    (u.patient_code && u.patient_code.toLowerCase() === (username || '').trim().toLowerCase())
  ) || (loginMode === 'patient' ? SAMPLE_PATIENTS[0] : staffUsers[0]);

  const handleSwitchMode = (mode) => {
    setLoginMode(mode);
    setError('');
    setInfo('');
    if (mode === 'patient') {
      const p = SAMPLE_PATIENTS[0];
      setUsername(p.username);
      setPassword('Hospital@2026');
    } else {
      const defaultUser = staffUsers.find(u => u.username === 'admin') || staffUsers[0];
      if (defaultUser) {
        setUsername(defaultUser.username);
        setPassword(getPasswordForUser(defaultUser.username));
      }
    }
  };

  const handleSignIn = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (signingIn) return;
    const targetUsername = (username || '').trim();
    if (!targetUsername) {
      setError(loginMode === 'patient' ? 'Please enter your Patient Username, UHID, Phone, or Email.' : 'Please enter a username.');
      return;
    }
    setSigningIn(true);
    setError('');
    const targetName = selectedUser?.name || targetUsername;
    setInfo(`Signing in as ${targetName}…`);
    try {
      let userObj;
      if (password) {
        userObj = await loginWithPassword(targetUsername, password);
      } else {
        userObj = await selectAccount(targetUsername);
      }
      onLoginSuccess(userObj);
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please verify your credentials.');
      setInfo('');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', background: '#fbfbfc' }}>
      {/* Left dark branding panel */}
      <aside style={{
        background: '#15181b', color: '#fff', padding: '36px 40px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '40px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'oklch(0.5 0.1 200)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.01em' }}>Hospital</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.55)' }}>AI Hospital Operating Platform</div>
          </div>
        </div>

        <div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '30px', lineHeight: 1.25, maxWidth: '420px' }}>
            One record, one workflow, every human decision kept with a human.
          </div>
          <div style={{
            marginTop: '22px', display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)',
            gap: '10px 14px', color: 'rgba(255,255,255,.75)', fontSize: '12px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.7 0.14 150)', marginTop: '5px' }} />
            <span>HMS · EMR · Billing · LIS · PACS · Patient Portal — healthy</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.7 0.14 150)', marginTop: '5px' }} />
            <span>Authenticated Patient Portal · Strict token-level records isolation</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.75 0.13 70)', marginTop: '5px' }} />
            <span>AI agents run under governance · clinical data strictly bound to verified patient</span>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
          © 2026 Meridian Hospital Systems · Enterprise Clinical Platform
        </div>
      </aside>

      {/* Right sign-in container */}
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 20px' }}>
        <div style={{ width: 'min(480px, 100%)', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Role Selection Tabs: Staff vs Patient Login */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <button
              type="button"
              id="tab-staff-login"
              onClick={() => handleSwitchMode('staff')}
              style={{
                height: '36px',
                borderRadius: '8px',
                border: 'none',
                background: loginMode === 'staff' ? '#ffffff' : 'transparent',
                color: loginMode === 'staff' ? '#0f172a' : '#64748b',
                fontWeight: loginMode === 'staff' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: loginMode === 'staff' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span>👨‍⚕️</span>
              <span>Staff &amp; Doctors</span>
            </button>

            <button
              type="button"
              id="tab-patient-login"
              onClick={() => handleSwitchMode('patient')}
              style={{
                height: '36px',
                borderRadius: '8px',
                border: 'none',
                background: loginMode === 'patient' ? '#ffffff' : 'transparent',
                color: loginMode === 'patient' ? 'oklch(0.5 0.1 200)' : '#64748b',
                fontWeight: loginMode === 'patient' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: loginMode === 'patient' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span>👤</span>
              <span>Patient Login</span>
              <span style={{
                background: loginMode === 'patient' ? 'oklch(0.95 0.03 200)' : '#e2e8f0',
                color: loginMode === 'patient' ? 'oklch(0.4 0.1 200)' : '#64748b',
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                Portal
              </span>
            </button>
          </div>

          {/* Main Card */}
          <div style={{
            background: '#fff', border: '1px solid #e3e6e8', borderRadius: '12px',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {loginMode === 'patient' ? 'Patient Portal Login' : 'Staff Sign In'}
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: loginMode === 'patient' ? 'oklch(0.95 0.03 200)' : '#f1f5f9',
                  color: loginMode === 'patient' ? 'oklch(0.4 0.1 200)' : '#475569'
                }}>
                  {loginMode === 'patient' ? '🔒 Patient Role' : 'Clinical Workspace'}
                </span>
              </div>
              <div style={{ color: '#64748b', marginTop: '4px', lineHeight: 1.45, fontSize: '12px' }}>
                {loginMode === 'patient'
                  ? 'Sign in using your Patient credentials (Username, UHID, Phone, or Email) to view your personal health record.'
                  : 'Select an account and sign in to access clinical, administrative, or diagnostic workspace.'}
              </div>
            </div>

            {error && (
              <div role="alert" style={{
                display: 'flex', gap: '8px', padding: '9px 12px', borderRadius: '6px',
                background: 'oklch(0.96 0.03 25)', color: 'oklch(0.45 0.17 25)', fontSize: '12px'
              }}>
                <span style={{ fontWeight: 700 }}>✕</span>
                <span>{error}</span>
              </div>
            )}

            {info && (
              <div style={{
                display: 'flex', gap: '8px', padding: '9px 12px', borderRadius: '6px',
                background: 'oklch(0.95 0.03 200)', color: 'oklch(0.4 0.1 200)', fontSize: '12px'
              }}>
                <span style={{ fontWeight: 700 }}>ⓘ</span>
                <span>{info}</span>
              </div>
            )}

            {/* Selected User Identity Banner */}
            {selectedUser && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                background: loginMode === 'patient' ? 'oklch(0.98 0.01 200)' : '#f8fafc',
                border: loginMode === 'patient' ? '1px solid oklch(0.9 0.03 200)' : '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: 'oklch(0.95 0.03 200)', color: 'oklch(0.4 0.1 200)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '14px', flexShrink: 0
                }}>
                  {selectedUser.name ? selectedUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : (loginMode === 'patient' ? 'PT' : 'DR')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#15181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedUser.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    <span style={{ fontWeight: 600, color: 'oklch(0.5 0.1 200)' }}>
                      {loginMode === 'patient' ? 'Patient' : selectedUser.role}
                    </span>
                    {(selectedUser.specialization || selectedUser.patient_code || selectedUser.dept) && (
                      ` · ${selectedUser.patient_code || selectedUser.specialization || selectedUser.dept}`
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>
                  {loginMode === 'patient' ? 'Patient ID / Username / Phone / Email' : 'Username'}
                </span>
                <input
                  type="text"
                  id="login-username-input"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  placeholder={loginMode === 'patient' ? 'e.g. MER-PAT-0087227, rajesh.v, or phone' : 'Username'}
                  autoComplete="username"
                  style={{
                    height: '36px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#0f172a',
                    background: '#fff',
                    outline: 'none',
                    transition: 'border-color 0.15s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'oklch(0.5 0.1 200)'}
                  onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>Password</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: 'oklch(0.5 0.1 200)',
                      fontSize: '11px',
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
                  placeholder="Password"
                  autoComplete="current-password"
                  style={{
                    height: '36px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#0f172a',
                    background: '#fff',
                    outline: 'none',
                    transition: 'border-color 0.15s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'oklch(0.5 0.1 200)'}
                  onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                />
              </label>

              <button
                type="submit"
                id="sign-in-submit-btn"
                disabled={signingIn}
                style={{
                  height: '40px',
                  borderRadius: '6px',
                  border: 0,
                  background: 'oklch(0.5 0.1 200)',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '4px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'opacity 0.15s'
                }}
              >
                {signingIn ? 'Signing in…' : (loginMode === 'patient' ? `Sign in to Patient Portal →` : `Sign in as ${selectedUser?.name || username} →`)}
              </button>
            </form>

          </div>

          {/* Bottom Section: Mode Specific Directory */}
          {loginMode === 'patient' ? (
            /* 5 Sample Patients for Patient Login */
            <div style={{
              background: '#fff', border: '1px solid #e3e6e8', borderRadius: '12px',
              padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: '12.5px', color: '#1e293b' }}>
                  Sample Patient Accounts (5 Available)
                </span>
                <span style={{ fontSize: '11px', color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}>
                  Password: Hospital@2026
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                Click any of the 5 sample patient profiles below to auto-fill their credentials and verify patient-specific isolation:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                {SAMPLE_PATIENTS.map((p) => {
                  const isSelected = (
                    username?.toLowerCase() === p.username.toLowerCase() ||
                    username?.toLowerCase() === p.patient_code.toLowerCase()
                  );

                  return (
                    <button
                      key={p.username}
                      type="button"
                      id={`sample-patient-${p.username}`}
                      disabled={signingIn}
                      onClick={() => {
                        setUsername(p.username);
                        setPassword('Hospital@2026');
                        setError('');
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: isSelected ? '1.5px solid oklch(0.5 0.1 200)' : '1px solid #e2e8f0',
                        background: isSelected ? 'oklch(0.96 0.03 200)' : '#f8fafc',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: isSelected ? 700 : 600, color: '#0f172a' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          UHID: <span style={{ color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}>{p.patient_code}</span> · {p.age}y · {p.gender} · {p.blood}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: '10.5px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: isSelected ? 'oklch(0.5 0.1 200)' : '#e2e8f0',
                          color: isSelected ? '#fff' : '#475569',
                          fontWeight: 600
                        }}>
                          {p.condition}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Staff Directory */
            <div style={{
              background: '#fff', border: '1px solid #e3e6e8', borderRadius: '12px',
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, fontSize: '12px' }}>Hospital Accounts &amp; Staff Directory</span>
                <span style={{ font: '500 10px ui-monospace, Menlo, monospace', color: '#0284c7' }}>
                  {loadingUsers ? 'loading database...' : `directory (${staffUsers.length} accounts)`}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                {staffUsers.map((r) => {
                  const isSelected = (username?.toLowerCase() === r.username?.toLowerCase() || selectedUser?.username?.toLowerCase() === r.username?.toLowerCase());
                  const isPatient = r.role?.toLowerCase() === 'patient';
                  return (
                    <button
                      key={r.id || r.username}
                      type="button"
                      disabled={signingIn}
                      onClick={() => {
                        if (isPatient) setLoginMode('patient');
                        setUsername(r.username);
                        setPassword(getPasswordForUser(r.username));
                        setError('');
                      }}
                      style={{
                        height: '28px', padding: '0 10px', borderRadius: '14px',
                        border: isSelected ? '1.5px solid oklch(0.5 0.1 200)' : '1px solid #e3e6e8',
                        background: isSelected ? 'oklch(0.95 0.03 200)' : '#f6f7f8',
                        cursor: 'pointer', fontSize: '11.5px', color: '#15181b', transition: 'all 0.15s',
                        fontWeight: isSelected ? 600 : 400
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{r.role || 'Doctor'}</span>
                      <span style={{ color: '#52585e' }}> · {r.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
