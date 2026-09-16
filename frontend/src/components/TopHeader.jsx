import React from 'react';
import { ALL_ROLES, DEMO_ROLES } from '../services/meridianData';

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
  onOpenModal,
}) {
  const [askInput, setAskInput] = React.useState('');
  const [showDemo, setShowDemo] = React.useState(false);
  const [showNewMenu, setShowNewMenu] = React.useState(false);

  const handleAskSubmit = (e) => {
    e.preventDefault();
    if (askInput.trim() && onAskAi) {
      onAskAi(askInput.trim());
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AM';

  // Available users for current selected role
  const usersForCurrentRole = DEMO_ROLES.filter(r => r.role === role);
  const displayUsers = usersForCurrentRole.length > 0 ? usersForCurrentRole : DEMO_ROLES;

  return (
    <header style={{
      borderBottom: '1px solid #e3e6e8',
      background: '#fff',
      zIndex: 30,
      position: 'sticky',
      top: 0
    }}>
      {/* ── Row 1: Brand / AI search / pills / clock / actions ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px',
        padding: '8px 14px', minHeight: '44px'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => window.location.reload()}>
          <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'oklch(0.5 0.1 200)' }} />
          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.01em' }}>Hospital</span>
          <span style={{ fontSize: '11px', color: '#8a9096', whiteSpace: 'nowrap' }}>AI Hospital Operating Platform</span>
        </div>

        {/* AI search */}
        <form onSubmit={handleAskSubmit} style={{ flex: '1 1 260px', maxWidth: '520px', display: 'flex' }}>
          <input
            value={askInput}
            onChange={e => setAskInput(e.target.value)}
            placeholder={`Ask Hospital AI — “Which patients are blocked from discharge and why?”`}
            style={{
              width: '100%', height: '30px', border: '1px solid #e3e6e8', borderRadius: '8px',
              padding: '0 10px 0 28px',
              background: '#f6f7f8 no-repeat 10px center/8px 8px radial-gradient(circle,oklch(0.5 0.1 300) 0 4px,transparent 4.5px)',
              fontSize: '11.5px', outline: 'none'
            }}
          />
          <button
            type="button"
            onClick={() => { setAskInput('Which patients are currently blocked from discharge and why?'); if (onAskAi) onAskAi('Which patients are currently blocked from discharge and why?'); }}
            aria-label="Voice input"
            style={{ height: '30px', minWidth: '32px', marginLeft: '4px', border: '1px solid #e3e6e8', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            🎙
          </button>
        </form>

        {/* Demo env pill */}
        <span style={{
          font: '600 9px ui-monospace, Menlo, monospace', letterSpacing: '.04em',
          color: 'oklch(0.5 0.18 25)', border: '1px solid oklch(0.88 0.06 25)',
          padding: '3px 6px', borderRadius: '4px', whiteSpace: 'nowrap'
        }}>
          DEMO ENVIRONMENT • SYNTHETIC DATA • NOT FOR CLINICAL USE
        </span>

        {/* Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#52585e' }}>
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span style={{ fontWeight: 600, color: '#15181b' }}>{clock}</span>
          <button
            type="button"
            onClick={advanceClock}
            style={{ height: '24px', padding: '0 7px', border: '1px solid #e3e6e8', borderRadius: '5px', background: '#fff', cursor: 'pointer', fontSize: '11px' }}
            title="Advance simulated clock 15 minutes"
          >
            +15 m
          </button>
        </div>

        {/* + New Master Modal Action Menu */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowNewMenu(v => !v)}
            style={{
              height: '28px', padding: '0 10px', border: 'none',
              borderRadius: '6px', background: 'oklch(0.5 0.1 200)', color: '#fff',
              cursor: 'pointer', fontWeight: 600, fontSize: '11.5px',
              display: 'flex', alignItems: 'center', gap: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            <span>+ New</span>
            <span style={{ fontSize: '9px' }}>▼</span>
          </button>

          {showNewMenu && (
            <div
              style={{
                position: 'absolute', top: '34px', right: 0,
                background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px',
                boxShadow: '0 12px 28px rgba(0,0,0,0.15)', width: '210px', zIndex: 100,
                padding: '6px 0', fontSize: '12px'
              }}
              onClick={() => setShowNewMenu(false)}
            >
              <div style={{ padding: '6px 12px', fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Operational Actions
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'appt', title: 'New Outpatient Appointment' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>📅</span> New Appointment
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'admit', title: 'Inpatient Bed Admission' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>🛏️</span> Admit Inpatient
              </div>

              <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
              <div style={{ padding: '6px 12px', fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Master Catalog Registries
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'patients', title: 'Register Patient' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>👤</span> Register Patient
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'doctors', title: 'Add Doctor / Consultant' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>🩺</span> Add Doctor
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'drugs', title: 'Add Drug to Formulary' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>💊</span> Add Drug
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'services', title: 'Add Hospital Service' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>🔬</span> Add Service
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'departments', title: 'Add Department' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>🏥</span> Add Department
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'staff', title: 'Add Employee / Staff' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>👥</span> Add Employee
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'vendors', title: 'Add Empanelled Vendor' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>🏢</span> Add Vendor
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'insurers', title: 'Add Insurer / TPA' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>🛡️</span> Add Insurer / TPA
              </div>
              <div
                onClick={() => onOpenModal && onOpenModal({ kind: 'create', coll: 'taxes', title: 'Add GST / Tax Rule' })}
                style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span>📑</span> Add Tax Rule
              </div>
            </div>
          )}
        </div>

        {/* Demo controls button */}
        <button
          type="button"
          onClick={() => setShowDemo(v => !v)}
          style={{
            height: '28px', padding: '0 9px', border: '1px solid #e3e6e8',
            borderRadius: '6px', background: showDemo ? '#eef0f1' : '#fff',
            cursor: 'pointer', fontWeight: 600, fontSize: '11.5px'
          }}
        >
          Demo controls
        </button>

        {/* Alerts badge */}
        <button
          type="button"
          style={{ height: '28px', padding: '0 9px', border: '1px solid #e3e6e8', borderRadius: '6px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}
        >
          <span>Alerts</span>
          <span style={{ minWidth: '18px', padding: '1px 5px', borderRadius: '9px', background: 'oklch(0.5 0.18 25)', color: '#fff', fontSize: '10px', fontWeight: 700, textAlign: 'center' }}>
            {alertsCount}
          </span>
        </button>
      </div>

      {/* ── Row 2: Role / User / avatar / sign out / mobile ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px',
        padding: '5px 14px 6px', borderTop: '1px solid #eef0f1', background: '#fff'
      }}>
        {/* Role */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#8a9096', fontSize: '11.5px' }}>
          <span>Role</span>
          <select
            value={role}
            onChange={e => {
              const nextRole = e.target.value;
              setRole(nextRole);
              const matched = DEMO_ROLES.find(r => r.role === nextRole);
              if (matched && setUser) {
                setUser({ name: matched.name, role: matched.role, dept: matched.dept || matched.role, username: matched.username, title: matched.title });
              }
            }}
            style={{ height: '28px', border: '1px solid #e3e6e8', borderRadius: '6px', background: '#fff', padding: '0 6px', fontWeight: 600, color: '#15181b', fontSize: '11.5px', outline: 'none' }}
          >
            {ALL_ROLES.map(r => (<option key={r} value={r}>{r}</option>))}
          </select>
        </label>

        {/* User */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#8a9096', fontSize: '11.5px' }}>
          <span>User</span>
          <select
            value={user?.username || (displayUsers[0]?.username)}
            onChange={e => {
              const u = DEMO_ROLES.find(r => r.username === e.target.value);
              if (u && setUser) {
                setUser({ name: u.name, role: u.role, dept: u.dept || u.role, username: u.username, title: u.title });
                setRole(u.role);
              }
            }}
            style={{ height: '28px', maxWidth: '240px', border: '1px solid #e3e6e8', borderRadius: '6px', background: '#fff', padding: '0 6px', fontWeight: 600, color: '#15181b', fontSize: '11.5px', outline: 'none' }}
          >
            {displayUsers.map(r => (<option key={r.username} value={r.username}>{r.name} · {r.dept || r.role}</option>))}
          </select>
        </label>

        {/* Avatar + name + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '8px', borderLeft: '1px solid #e3e6e8' }}>
          <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'oklch(0.95 0.03 200)', color: 'oklch(0.4 0.1 200)', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {initials}
          </span>
          <span style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.name || 'Dr. Arjun Menon'}
          </span>
          <button
            type="button"
            onClick={onSignOut}
            style={{ height: '28px', padding: '0 9px', border: '1px solid #e3e6e8', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#52585e', fontSize: '11px' }}
          >
            Sign out
          </button>
        </div>

        {/* Mobile button */}
        <button
          type="button"
          onClick={onOpenMobile}
          style={{ height: '28px', padding: '0 10px', border: '1px solid #e3e6e8', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '11.5px', fontWeight: 500, color: '#15181b' }}
        >
          Mobile
        </button>
      </div>
    </header>
  );
}
