import React, { useState } from 'react';
import { apiService } from '../services/api';

export default function DoctorProfileView({ user, setUser }) {
  const [form, setForm] = useState({
    first_name: user?.name ? user.name.split(' ')[0] : '',
    last_name: user?.name ? user.name.split(' ').slice(1).join(' ') : '',
    phone: '',
    email: '',
    specialization: '',
    qualification: '',
    username: user?.username || '',
    password: ''
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    setError('');
    try {
      if (!user?.doctorId) {
        throw new Error('Doctor ID not associated with current session.');
      }
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        specialization: form.specialization.trim() || undefined,
        qualification: form.qualification.trim() || undefined,
        username: form.username.trim() || undefined,
        password: form.password ? form.password : undefined
      };

      await apiService.updateDoctor(user.doctorId, payload);
      setMsg('Doctor profile & login credentials updated successfully!');
      if (form.username && setUser) {
        setUser({ ...user, username: form.username, loginId: form.username });
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '600px' }}>
      <div>
        <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
          <span>Doctor Workspace</span> · <span>My Profile</span>
        </div>
        <div style={{ fontSize: '20px', fontWeight: 600 }}>Doctor Profile & Login Credentials</div>
        <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
          Update your consultant profile details, contact information, username, and password
        </div>
      </div>

      {msg && (
        <div style={{ background: 'oklch(0.95 0.04 150)', border: '1px solid oklch(0.85 0.08 150)', borderRadius: '6px', padding: '8px 12px', color: 'oklch(0.35 0.12 150)', fontSize: '12px' }}>
          ✓ {msg}
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', color: '#991b1b', fontSize: '12px' }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '20px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>First Name</label>
              <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Last Name</label>
              <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Specialization</label>
              <input value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Cardiology" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Qualification</label>
              <input value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. MD, MBBS" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Phone Number</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 9876543210" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Email Address</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="doctor@meridian.com" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>Login Username</label>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>New Password (Optional)</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep unchanged" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="submit" disabled={loading} style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
              {loading ? 'Saving…' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
