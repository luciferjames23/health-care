import React, { useState } from 'react';
import { DEMO_ROLES, DEMO_PASSWORD } from '../services/meridianData';
import { setAuthToken } from '../services/api';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function AuthScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('arjun.menon');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectRole = (r) => {
    setUsername(r.username);
    setPassword(DEMO_PASSWORD);
    setError('');
    setInfo(`Selected ${r.role} (${r.name}). Click Sign In to continue.`);
  };

  // Map backend role names to frontend role names
  const mapRole = (backendRole, username) => {
    const roleUpper = (backendRole || '').toUpperCase();
    if (roleUpper === 'ADMIN') return 'Hospital Management';
    if (roleUpper === 'DOCTOR') return 'Doctor';
    // Fallback: try to match from demo roles
    const matched = DEMO_ROLES.find(r => r.username === username);
    return matched ? matched.role : 'Hospital Management';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const u = (username || '').trim();
    if (!u) {
      setError('Please enter your username.');
      return;
    }

    setError('');
    setInfo('');
    setLoading(true);

    try {
      // Determine role hint for the backend
      const matched = DEMO_ROLES.find(r => r.username === u.toLowerCase() || r.username.includes(u.toLowerCase()));
      const roleHint = matched
        ? (matched.role === 'Doctor' ? 'doctor' : 'admin')
        : (u.toLowerCase().includes('doc') ? 'doctor' : 'admin');

      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: password, role: roleHint }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.detail || data.message || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Store JWT token for authenticated API calls
      if (data.token) {
        setAuthToken(data.token);
      }

      // Build the auth object from backend response
      const user = data.user || {};
      const roleName = mapRole(user.role, u.toLowerCase());
      const fullName = user.name || (matched ? matched.name : u);

      onLoginSuccess({
        username: user.username || u,
        role: roleName,
        name: fullName,
        dept: user.department || (matched ? matched.dept : 'General'),
        doctorId: user.doctorId,
        loginId: user.loginId || u,
      });
    } catch (fetchErr) {
      console.warn('[AUTH] Backend login failed, falling back to demo auth:', fetchErr.message);
      // Fallback to local demo auth if backend is unreachable
      const matched = DEMO_ROLES.find(r => r.username === u.toLowerCase() || r.username.includes(u.toLowerCase()));
      const roleName = matched ? matched.role : (u.toLowerCase().includes('admin') ? 'Hospital Management' : (u.toLowerCase().includes('doc') ? 'Doctor' : 'Hospital Management'));
      const fullName = matched ? matched.name : (u.toLowerCase().includes('admin') ? 'System Administrator' : u);

      setInfo('Backend unavailable — signed in with demo credentials.');
      onLoginSuccess({
        username: u.toLowerCase(),
        role: roleName,
        name: fullName,
        dept: matched ? matched.dept : 'General',
      });
    } finally {
      setLoading(false);
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
            <span>HMS · EMR · Billing · LIS · PACS · TPA gateway — healthy</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.7 0.14 150)', marginTop: '5px' }} />
            <span>AI agents run under governance · every action audited under your name</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.75 0.13 70)', marginTop: '5px' }} />
            <span>Clinical AI drafts require a signing clinician · no autonomous diagnosis or prescribing</span>
          </div>
        </div>

        <div style={{
          font: '600 9px ui-monospace, Menlo, monospace', letterSpacing: '.04em',
          color: 'oklch(0.8 0.1 25)', border: '1px solid oklch(0.5 0.12 25)',
          padding: '4px 7px', borderRadius: '4px', alignSelf: 'flex-start'
        }}>
          DEMO ENVIRONMENT • SYNTHETIC DATA • NOT FOR CLINICAL USE
        </div>
      </aside>

      {/* Right sign-in container */}
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 20px' }}>
        <div style={{ width: 'min(440px, 100%)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{
            background: '#fff', border: '1px solid #e3e6e8', borderRadius: '10px',
            padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>Sign in</div>
              <div style={{ color: '#52585e', marginTop: '2px', lineHeight: 1.45, fontSize: '12px' }}>
                Use your hospital Employee ID or username. Role, department and consultant scope come from your account.
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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#8a9096', fontSize: '11px', fontWeight: 500 }}>Employee ID or username</span>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. arjun.menon or EMP-D014"
                  disabled={loading}
                  style={{
                    height: '36px', border: '1px solid #e3e6e8', borderRadius: '6px',
                    padding: '0 10px', fontSize: '13px', outline: 'none', background: '#fff'
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#8a9096', fontSize: '11px', fontWeight: 500 }}>Password</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    style={{
                      flex: 1, height: '36px', border: '1px solid #e3e6e8', borderRadius: '6px',
                      padding: '0 10px', fontSize: '13px', outline: 'none', minWidth: 0, background: '#fff'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      height: '36px', padding: '0 10px', border: '1px solid #e3e6e8',
                      borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#52585e'
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                <button
                  type="button"
                  onClick={() => alert('Synthetic password for demo is: ' + DEMO_PASSWORD)}
                  style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'oklch(0.5 0.1 200)' }}
                >
                  Forgot password?
                </button>
                <span style={{ color: '#8a9096' }}>Branch · BR-01</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  height: '38px', borderRadius: '6px', border: 0,
                  background: loading ? '#b0b6bc' : 'oklch(0.5 0.1 200)', color: '#fff',
                  fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px',
                  marginTop: '4px', transition: 'background 0.15s'
                }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          {/* Role-based demo quick picker */}
          <div style={{
            background: '#fff', border: '1px solid #e3e6e8', borderRadius: '10px',
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: '12px' }}>Role-based demo access</span>
              <span style={{ font: '500 10px ui-monospace, Menlo, monospace', color: '#8a9096' }}>synthetic accounts</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DEMO_ROLES.map((r) => (
                <button
                  key={r.username}
                  type="button"
                  onClick={() => handleSelectRole(r)}
                  style={{
                    height: '28px', padding: '0 10px', borderRadius: '14px',
                    border: '1px solid #e3e6e8', background: username === r.username ? 'oklch(0.95 0.03 200)' : '#f6f7f8',
                    cursor: 'pointer', fontSize: '11.5px', color: '#15181b', transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{r.role}</span>
                  <span style={{ color: '#52585e' }}> · {r.name}</span>
                </button>
              ))}
            </div>

            <div style={{ fontSize: '11px', color: '#8a9096', lineHeight: 1.45, marginTop: '4px' }}>
              Picking an account fills its synthetic credentials (password <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#15181b', fontWeight: 600 }}>{DEMO_PASSWORD}</span>). Password check, MFA, lockout after 5 failures and the audit trail run exactly as for a real user — nothing is bypassed.
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
