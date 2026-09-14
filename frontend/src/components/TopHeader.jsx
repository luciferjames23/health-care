import React from 'react';
import { DEMO_ROLES } from '../services/meridianData';

export default function TopHeader({
  role,
  setRole,
  user,
  setUser,
  clock,
  advanceClock,
  alertsCount = 9,
  onSignOut,
  onOpenMobile,
  onAskAi,
}) {
  const [askInput, setAskInput] = React.useState('');

  const handleAskSubmit = (e) => {
    e.preventDefault();
    if (askInput.trim() && onAskAi) {
      onAskAi(askInput.trim());
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AM';

  return (
    <header style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px',
      padding: '8px 14px', minHeight: '48px', borderBottom: '1px solid #e3e6e8',
      background: '#fff', zIndex: 30, position: 'sticky', top: 0
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => window.location.reload()}>
        <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'oklch(0.5 0.1 200)' }} />
        <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.01em' }}>Hospital</span>
        <span style={{ fontSize: '11px', color: '#8a9096', whiteSpace: 'nowrap' }}>AI Hospital Operating Platform</span>
      </div>

      {/* Hospital AI prompt input */}
      <form onSubmit={handleAskSubmit} style={{ flex: '1 1 260px', maxWidth: '520px', display: 'flex' }}>
        <input
          value={askInput}
          onChange={e => setAskInput(e.target.value)}
          placeholder="Ask Hospital AI — “Which patients are blocked from discharge and why?”"
          style={{
            width: '100%', height: '30px', border: '1px solid #e3e6e8', borderRadius: '8px',
            padding: '0 10px 0 26px', background: '#f6f7f8', fontSize: '11.5px', outline: 'none'
          }}
        />
        <button
          type="button"
          onClick={() => {
            setAskInput('Which patients are currently blocked from discharge and why?');
            if (onAskAi) onAskAi('Which patients are currently blocked from discharge and why?');
          }}
          aria-label="Voice input"
          title="Voice input / dictate"
          style={{
            height: '30px', minWidth: '32px', marginLeft: '4px', border: '1px solid #e3e6e8',
            borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12px'
          }}
        >
          🎙
        </button>
      </form>

      {/* Demo environment pill */}
      <span style={{
        font: '600 9px ui-monospace, Menlo, monospace', letterSpacing: '.04em',
        color: 'oklch(0.5 0.18 25)', border: '1px solid oklch(0.88 0.06 25)',
        padding: '3px 6px', borderRadius: '4px', whiteSpace: 'nowrap'
      }}>
        DEMO ENVIRONMENT • SYNTHETIC DATA • NOT FOR CLINICAL USE
      </span>

      {/* Clock & advance button */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#52585e'
      }}>
        <span>Fri 12 Sep 2026</span>
        <span style={{ fontWeight: 600, color: '#15181b' }}>{clock}</span>
        <button
          type="button"
          onClick={advanceClock}
          style={{
            height: '24px', padding: '0 7px', border: '1px solid #e3e6e8',
            borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '11px'
          }}
          title="Advance simulated clock 15 minutes"
        >
          +15 m
        </button>
      </div>

      {/* Alerts badge */}
      <button
        type="button"
        style={{
          height: '28px', padding: '0 9px', border: '1px solid #e3e6e8',
          borderRadius: '6px', background: '#fff', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: '6px', fontSize: '11.5px'
        }}
      >
        <span>Alerts</span>
        <span style={{
          minWidth: '18px', padding: '1px 5px', borderRadius: '9px',
          background: 'oklch(0.5 0.18 25)', color: '#fff', fontSize: '10px',
          fontWeight: 700, textAlign: 'center'
        }}>
          {alertsCount}
        </span>
      </button>

      {/* Role Switcher */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#8a9096', fontSize: '11.5px' }}>
        <span>Role</span>
        <select
          value={role}
          onChange={e => {
            const nextRole = e.target.value;
            setRole(nextRole);
            const matched = DEMO_ROLES.find(r => r.role === nextRole);
            if (matched && setUser) {
              setUser({
                name: matched.name,
                role: matched.role,
                dept: matched.role === 'Doctor' ? 'Cardiology' : matched.role,
                username: matched.username,
              });
            }
          }}
          style={{
            height: '28px', border: '1px solid #e3e6e8', borderRadius: '6px',
            background: '#fff', padding: '0 6px', fontWeight: 600, color: '#15181b',
            fontSize: '11.5px', outline: 'none'
          }}
        >
          {DEMO_ROLES.map(r => (
            <option key={r.role} value={r.role}>{r.role}</option>
          ))}
        </select>
      </label>

      {/* User Scope Dropdown */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#8a9096', fontSize: '11.5px' }}>
        <span>User</span>
        <select
          value={user?.username || 'arjun.menon'}
          onChange={e => {
            const u = DEMO_ROLES.find(r => r.username === e.target.value);
            if (u && setUser) {
              setUser({
                name: u.name,
                role: u.role,
                dept: u.role === 'Doctor' ? 'Cardiology' : u.role,
                username: u.username
              });
              setRole(u.role);
            }
          }}
          style={{
            height: '28px', maxWidth: '190px', border: '1px solid #e3e6e8',
            borderRadius: '6px', background: '#fff', padding: '0 6px',
            fontWeight: 600, color: '#15181b', fontSize: '11.5px', outline: 'none'
          }}
        >
          {DEMO_ROLES.map(r => (
            <option key={r.username} value={r.username}>
              {r.name} · {r.role}
            </option>
          ))}
        </select>
      </label>

      {/* Auth user info + Sign out */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        paddingLeft: '8px', borderLeft: '1px solid #e3e6e8'
      }}>
        <span style={{
          width: '24px', height: '24px', borderRadius: '50%',
          background: 'oklch(0.95 0.03 200)', color: 'oklch(0.4 0.1 200)',
          fontSize: '10px', fontWeight: 700, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          {initials}
        </span>
        <span style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user?.name || 'Dr. Arjun Menon'}
        </span>
        <button
          type="button"
          onClick={onSignOut}
          style={{
            height: '28px', padding: '0 9px', border: '1px solid #e3e6e8',
            borderRadius: '6px', background: '#fff', cursor: 'pointer',
            color: '#52585e', fontSize: '11px'
          }}
        >
          Sign out
        </button>
      </div>

      {/* Mobile simulator button */}
      <button
        type="button"
        onClick={onOpenMobile}
        style={{
          height: '28px', padding: '0 10px', border: '1px solid #e3e6e8',
          borderRadius: '6px', background: '#fff', cursor: 'pointer',
          fontSize: '11.5px', fontWeight: 500, color: '#15181b'
        }}
      >
        Mobile
      </button>
    </header>
  );
}
