import React from 'react';
import { ALL_ROLES, DEMO_ROLES } from '../services/meridianData';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const FALLBACK_DB_USERS = [
  { username: 'admin', role: 'Hospital Management', name: 'System Admin', dept: 'Administration', specialization: 'Administration', title: 'Admin' },
  { username: 'doctor_1', role: 'Doctor', name: 'Dr. Priya Patel', dept: 'Cardiology', specialization: 'Cardiologist', title: 'Cardiologist' },
  { username: 'doctor_2', role: 'Doctor', name: 'Dr. Ravi Reddy', dept: 'Orthopedics', specialization: 'Orthopedist', title: 'Orthopedist' },
  { username: 'doctor_3', role: 'Doctor', name: 'Dr. Anjali Iyer', dept: 'Pediatrics', specialization: 'Pediatrician', title: 'Pediatrician' },
  { username: 'doctor_4', role: 'Doctor', name: 'Dr. Vikram Singh', dept: 'Neurology', specialization: 'Neurologist', title: 'Neurologist' },
  { username: 'doctor_5', role: 'Doctor', name: 'Dr. Neha Nair', dept: 'Gynecology', specialization: 'Gynecologist', title: 'Gynecologist' },
  { username: 'doctor_6', role: 'Doctor', name: 'Dr. Suresh Menon', dept: 'Surgery', specialization: 'Surgeon', title: 'Surgeon' },
  { username: 'doctor_7', role: 'Doctor', name: 'Dr. Divya Verma', dept: 'Emergency', specialization: 'ER Physician', title: 'ER Physician' },
  { username: 'doctor_8', role: 'Doctor', name: 'Dr. Rahul Kumar', dept: 'Intensive Care Unit', specialization: 'Intensivist', title: 'Intensivist' },
  { username: 'doctor_9', role: 'Doctor', name: 'Dr. Sneha Das', dept: 'Laboratory', specialization: 'Pathologist', title: 'Pathologist' },
  { username: 'doctor_10', role: 'Doctor', name: 'Dr. Karthik Bose', dept: 'Pharmacy', specialization: 'Pharmacologist', title: 'Pharmacologist' },
  { username: 'doctor_11', role: 'Doctor', name: 'Dr. Pooja Pillai', dept: 'Oncology', specialization: 'Oncologist', title: 'Oncologist' },
  { username: 'doctor_12', role: 'Doctor', name: 'Dr. Arjun Rao', dept: 'Administration', specialization: 'Administrator', title: 'Administrator' },
  { username: 'doctor_13', role: 'Doctor', name: 'Dr. Meenakshi Gupta', dept: 'General Medicine', specialization: 'General Physician', title: 'General Physician' },
  { username: 'doctor_14', role: 'Doctor', name: 'Dr. Sanjay Jain', dept: 'Cardiology', specialization: 'Cardiologist', title: 'Cardiologist' },
  { username: 'doctor_15', role: 'Doctor', name: 'Dr. Amit Sharma', dept: 'Orthopedics', specialization: 'Orthopedist', title: 'Orthopedist' },
];

export default function TopHeader({
  role,
  setRole,
  user,
  setUser,
  clock,
  advanceClock,
  alertsCount = 26,
  onSignOut,
  onOpenMobile,
  onAskAi,
  onOpenModal,
  onSwitchUserPromptPassword,
}) {
  const [askInput, setAskInput] = React.useState('');
  const [showNewMenu, setShowNewMenu] = React.useState(false);
  const [switchingDoctor, setSwitchingDoctor] = React.useState(null);

  // Dynamic real-time live clock and calendar date
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const liveDateStr = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const liveTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const handleAskSubmit = (e) => {
    e.preventDefault();
    if (askInput.trim() && onAskAi) {
      onAskAi(askInput.trim());
    }
  };

  // Fetch dynamic users and specializations from database
  const [dbUsers, setDbUsers] = React.useState(FALLBACK_DB_USERS);

  React.useEffect(() => {
    let isMounted = true;
    async function loadUsers() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/users`);
        if (res.ok) {
          const data = await res.json();
          if (data.users && data.users.length > 0 && isMounted) {
            setDbUsers(data.users);
          }
        }
      } catch (err) {
        console.warn('Could not load dynamic users in TopHeader:', err);
      }
    }
    loadUsers();
    return () => { isMounted = false; };
  }, []);

  // Merge database users with other domain roles
  const combinedUsers = React.useMemo(() => {
    const list = (dbUsers && dbUsers.length > 0 ? dbUsers : FALLBACK_DB_USERS).map(u => {
      const isAdm = (u.role === 'Admin' || u.role === 'ADMIN' || u.username === 'admin');
      const normalizedRole = isAdm ? 'Hospital Management' : (u.role || 'Doctor');
      const spec = u.specialization || u.title || u.dept || (isAdm ? 'Administration' : 'General Medicine');
      return {
        username: u.username,
        name: u.name,
        role: normalizedRole,
        dept: u.dept || 'General Medicine',
        specialization: spec,
        title: spec
      };
    });

    const existingUsernames = new Set(list.map(u => u.username?.toLowerCase()));

    // Other non-doctor roles from DEMO_ROLES
    const extraRoles = DEMO_ROLES
      .filter(d => d.role !== 'Doctor' && !existingUsernames.has(d.username?.toLowerCase()))
      .map(d => ({
        username: d.username,
        name: d.name,
        role: d.role,
        dept: d.dept || d.role,
        specialization: d.title || d.dept || d.role,
        title: d.title || d.dept || d.role
      }));

    return [...list, ...extraRoles];
  }, [dbUsers]);

  // Available users for current selected role
  const usersForCurrentRole = React.useMemo(() => {
    if (!role) return combinedUsers;
    const targetRole = role.toLowerCase();
    const filtered = combinedUsers.filter(r => {
      const rRole = (r.role || '').toLowerCase();
      if (rRole === targetRole) return true;
      if (targetRole === 'hospital management' && (rRole === 'admin' || rRole === 'hospital management')) return true;
      return false;
    });
    return filtered.length > 0 ? filtered : combinedUsers;
  }, [combinedUsers, role]);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'DR';

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

        {/* Dynamic Real-time Live Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#52585e' }}>
          <span>{liveDateStr}</span>
          <span style={{ fontWeight: 600, color: '#15181b' }}>{liveTimeStr}</span>
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
              const matched = combinedUsers.find(r => 
                r.role?.toLowerCase() === nextRole.toLowerCase() ||
                (nextRole === 'Hospital Management' && (r.role?.toLowerCase() === 'admin' || r.role?.toLowerCase() === 'hospital management'))
              );
              if (matched && matched.username !== user?.username) {
                setSwitchingDoctor(matched);
                setTimeout(() => {
                  if (onSwitchUserPromptPassword) {
                    onSwitchUserPromptPassword(matched);
                  } else if (setUser) {
                    setUser(matched);
                  }
                  setSwitchingDoctor(null);
                }, 700);
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
            value={user?.username || (usersForCurrentRole[0]?.username)}
            onChange={e => {
              const selectedUsername = e.target.value;
              const u = combinedUsers.find(r => r.username === selectedUsername);
              if (u && u.username !== user?.username) {
                // Trigger loading and redirect to enter password for this doctor
                setSwitchingDoctor(u);
                setTimeout(() => {
                  if (onSwitchUserPromptPassword) {
                    onSwitchUserPromptPassword(u);
                  } else if (setUser) {
                    setUser(u);
                  }
                  setSwitchingDoctor(null);
                }, 700);
              }
            }}
            style={{ height: '28px', maxWidth: '300px', border: '1px solid #e3e6e8', borderRadius: '6px', background: '#fff', padding: '0 6px', fontWeight: 600, color: '#15181b', fontSize: '11.5px', outline: 'none' }}
          >
            {usersForCurrentRole.map(r => (
              <option key={r.username} value={r.username}>
                {r.name} · {r.specialization || r.dept || r.role}
              </option>
            ))}
          </select>
        </label>

        {/* Avatar + name + specialization + sign out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '8px', borderLeft: '1px solid #e3e6e8' }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'oklch(0.95 0.03 200)', color: 'oklch(0.4 0.1 200)', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {initials}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, justifyContent: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
              {user?.name || 'Dr. Rahul Kumar'}
            </span>
            {(user?.specialization || user?.dept) && (
              <span style={{ fontSize: '10px', color: '#626d77', whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.1' }}>
                {user?.specialization || user?.dept}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            style={{ height: '28px', padding: '0 9px', border: '1px solid #e3e6e8', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#52585e', fontSize: '11px', flexShrink: 0 }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Doctor Switch Loading Overlay */}
      {switchingDoctor && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(21, 24, 27, 0.72)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          color: '#fff',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            border: '3.5px solid rgba(255,255,255,0.2)',
            borderTop: '3.5px solid #38bdf8',
            borderRadius: '50%',
            animation: 'kpi-spin 0.7s linear infinite'
          }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '4px' }}>
              Switching Account · {switchingDoctor.name}
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
              Redirecting to verification... Please enter password for {switchingDoctor.name}.
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
