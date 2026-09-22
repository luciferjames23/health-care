import React, { useState, useEffect } from 'react';
import { selectAccount } from '../services/accountSession';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export default function AuthScreen({
  onLoginSuccess,
  initialUsername = null,
  initialInfo = ''
}) {
  const [username, setUsername] = useState(initialUsername || 'admin');
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
              const defaultUser = data.users.find(u => u.username === 'admin') || data.users[0];
              if (defaultUser) {
                setUsername(defaultUser.username);
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
    }
  }, [initialUsername]);

  useEffect(() => {
    if (initialInfo) {
      setInfo(initialInfo);
    }
  }, [initialInfo]);

  const activeUsers = [...usersList].sort((a, b) => {
    const rank = user => user.role?.toLowerCase() === 'radiologist' ? 0 : user.role?.toLowerCase() === 'admin' ? 1 : 2;
    return rank(a) - rank(b);
  });

  const selectedUser = usersList.find(u => u.username === username) ||
                       (initialUsername ? usersList.find(u => u.username === initialUsername) : null) ||
                       activeUsers[0];

  const handleSelectRole = async (user) => {
    if (signingIn || !user) return;
    setUsername(user.username);
    setSigningIn(true);
    setError('');
    setInfo(`Signing in as ${user.name || user.username}…`);
    try { onLoginSuccess(await selectAccount(user.username)); }
    catch (error) { setError(error.message); setInfo(''); }
    finally { setSigningIn(false); }
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
                Select an account and sign in to access clinical or hospital workspace.
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

            {selectedUser && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                padding: '14px 16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: 'oklch(0.95 0.03 200)', color: 'oklch(0.4 0.1 200)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '13px', flexShrink: 0
                  }}>
                    {selectedUser.name ? selectedUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'DR'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#15181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedUser.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      <span style={{ fontWeight: 600, color: '#0284c7' }}>{selectedUser.role}</span>
                      {(selectedUser.specialization || selectedUser.dept) && ` · ${selectedUser.specialization || selectedUser.dept}`}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  id="sign-in-submit-btn"
                  disabled={signingIn}
                  onClick={() => handleSelectRole(selectedUser)}
                  style={{
                    height: '38px',
                    borderRadius: '6px',
                    border: 0,
                    background: 'oklch(0.5 0.1 200)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'opacity 0.15s'
                  }}
                >
                  {signingIn ? 'Signing in…' : `Sign in as ${selectedUser.name} →`}
                </button>
              </div>
            )}

          </div>

          {/* Dynamic Users from Database Table */}
          <div style={{
            background: '#fff', border: '1px solid #e3e6e8', borderRadius: '10px',
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: '12px' }}>Hospital Accounts &amp; Staff Directory</span>
              <span style={{ font: '500 10px ui-monospace, Menlo, monospace', color: '#0284c7' }}>
                {loadingUsers ? 'loading database...' : `directory (${activeUsers.length} accounts)`}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '190px', overflowY: 'auto' }}>
              {activeUsers.map((r) => {
                const isSelected = (username === r.username || selectedUser?.username === r.username);
                return (
                  <button
                    key={r.username}
                    type="button"
                    disabled={signingIn}
                    onClick={() => {
                      setUsername(r.username);
                      handleSelectRole(r);
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

            <div style={{ fontSize: '11px', color: '#8a9096', lineHeight: 1.45, marginTop: '4px' }}>
              Select a doctor to request an X-ray, or select Radiologist to view incoming orders.
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
