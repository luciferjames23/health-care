import React, { useState, useEffect } from 'react';
import { DEMO_PASSWORD } from '../services/meridianData';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const FALLBACK_DB_USERS = [
  { username: 'admin', role: 'Admin', name: 'System Admin', dept: 'Administration', title: 'Admin' },
  { username: 'doctor_1', role: 'Doctor', name: 'Dr. Priya Patel', dept: 'Cardiology', title: 'Cardiologist' },
  { username: 'doctor_2', role: 'Doctor', name: 'Dr. Ravi Reddy', dept: 'Orthopedics', title: 'Orthopedist' },
  { username: 'doctor_3', role: 'Doctor', name: 'Dr. Anjali Iyer', dept: 'Pediatrics', title: 'Pediatrician' },
  { username: 'doctor_4', role: 'Doctor', name: 'Dr. Vikram Singh', dept: 'Neurology', title: 'Neurologist' },
  { username: 'doctor_5', role: 'Doctor', name: 'Dr. Neha Nair', dept: 'Gynecology', title: 'Gynecologist' },
  { username: 'doctor_6', role: 'Doctor', name: 'Dr. Suresh Menon', dept: 'Surgery', title: 'Surgeon' },
  { username: 'doctor_7', role: 'Doctor', name: 'Dr. Divya Verma', dept: 'Emergency', title: 'ER Physician' },
  { username: 'doctor_8', role: 'Doctor', name: 'Dr. Rahul Kumar', dept: 'Intensive Care Unit', title: 'Intensivist' },
  { username: 'doctor_9', role: 'Doctor', name: 'Dr. Sneha Das', dept: 'Laboratory', title: 'Pathologist' },
  { username: 'doctor_10', role: 'Doctor', name: 'Dr. Karthik Bose', dept: 'Pharmacy', title: 'Pharmacologist' },
  { username: 'doctor_11', role: 'Doctor', name: 'Dr. Pooja Pillai', dept: 'Oncology', title: 'Oncologist' },
  { username: 'doctor_12', role: 'Doctor', name: 'Dr. Arjun Rao', dept: 'Administration', title: 'Administrator' },
  { username: 'doctor_13', role: 'Doctor', name: 'Dr. Meenakshi Gupta', dept: 'General Medicine', title: 'General Physician' },
  { username: 'doctor_14', role: 'Doctor', name: 'Dr. Sanjay Jain', dept: 'Cardiology', title: 'Cardiologist' },
  { username: 'doctor_15', role: 'Doctor', name: 'Dr. Amit Sharma', dept: 'Orthopedics', title: 'Orthopedist' },
];

export default function AuthScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadUsers() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/users`);
        if (res.ok) {
          const data = await res.json();
          if (data.users && data.users.length > 0 && isMounted) {
            setUsersList(data.users);
            const defaultUser = data.users.find(u => u.username === 'admin') || data.users[0];
            if (defaultUser) {
              setUsername(defaultUser.username);
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
  }, []);

  const activeUsers = usersList.length > 0 ? usersList : FALLBACK_DB_USERS;

  const handleSelectRole = (r) => {
    setUsername(r.username);
    setPassword(DEMO_PASSWORD);
    setError('');
    setInfo(`Selected ${r.role || 'Staff'} (${r.name}). Click Sign In to continue.`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const u = username.trim().toLowerCase();
    if (!u) {
      setError('Please enter Employee ID or username.');
      return;
    }
    if (password !== DEMO_PASSWORD && password !== 'admin' && password !== 'admin123' && password !== 'doctor123') {
      setError('Invalid credentials. Standard password is ' + DEMO_PASSWORD);
      return;
    }

    const matched = activeUsers.find(
      r => r.username.toLowerCase() === u ||
           (r.email && r.email.toLowerCase() === u) ||
           (r.staff_code && r.staff_code.toLowerCase() === u)
    );
    const roleName = matched ? (matched.role === 'Admin' ? 'Hospital Management' : matched.role) : (u.includes('admin') ? 'Hospital Management' : 'Doctor');
    const fullName = matched ? matched.name : (u.includes('admin') ? 'System Admin' : `Doctor ${u}`);
    const deptName = matched ? (matched.dept || 'General Medicine') : 'General Medicine';
    const specName = matched ? (matched.specialization || matched.title || deptName) : 'General Medicine';

    // Successful login
    onLoginSuccess({
      username: u,
      role: roleName,
      name: fullName,
      dept: deptName,
      specialization: specName,
      title: specName,
    });
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
                  placeholder="e.g. admin or doctor_1"
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
                  onClick={() => alert('Password for registered accounts is: ' + DEMO_PASSWORD)}
                  style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'oklch(0.5 0.1 200)' }}
                >
                  Forgot password?
                </button>
                <span style={{ color: '#8a9096' }}>Branch · BR-01</span>
              </div>

              <button
                type="submit"
                style={{
                  height: '38px', borderRadius: '6px', border: 0,
                  background: 'oklch(0.5 0.1 200)', color: '#fff',
                  fontWeight: 600, cursor: 'pointer', fontSize: '13px',
                  marginTop: '4px'
                }}
              >
                Sign in
              </button>
            </form>
          </div>

          {/* Dynamic Users from Database Table */}
          <div style={{
            background: '#fff', border: '1px solid #e3e6e8', borderRadius: '10px',
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: '12px' }}>Hospital Accounts &amp; Staff Directory</span>
              <span style={{ font: '500 10px ui-monospace, Menlo, monospace', color: '#0284c7' }}>
                {loadingUsers ? 'loading database...' : `live table (${activeUsers.length} accounts)`}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '190px', overflowY: 'auto' }}>
              {activeUsers.slice(0, 30).map((r) => (
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
                  <span style={{ fontWeight: 600 }}>{r.role || 'Doctor'}</span>
                  <span style={{ color: '#52585e' }}> · {r.name}</span>
                </button>
              ))}
            </div>

            <div style={{ fontSize: '11px', color: '#8a9096', lineHeight: 1.45, marginTop: '4px' }}>
              Select an account to load its credentials (password <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', color: '#15181b', fontWeight: 600 }}>{DEMO_PASSWORD}</span>). Connected directly to PostgreSQL <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>users</span> and <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>doctors</span> tables.
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
