import React, { useState, useEffect } from 'react';
import { fetchUserProfile } from '../services/accountSession';

function cleanValue(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '' || s.toLowerCase() === 'none' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
    return null;
  }
  return s;
}

export default function UserProfileModal({ user, onClose, onSignOut }) {
  const [profile, setProfile] = useState(user || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchUserProfile(user?.username || '');
        if (data && isMounted) {
          setProfile(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.warn('Could not fetch updated profile:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [user?.username]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const displayName = cleanValue(profile.name) || cleanValue(user?.name) || 'User Profile';
  const roleName = cleanValue(profile.role) || cleanValue(user?.role) || 'Staff';
  const isDoctor = roleName.toLowerCase() === 'doctor' || Boolean(profile.doctor_id || profile.doctorId || user?.doctorId);

  const qualification = cleanValue(profile.qualification || user?.qualification);
  const designation = cleanValue(profile.designation || profile.specialization || user?.designation || user?.specialization || user?.title);
  const department = cleanValue(profile.department || user?.department || profile.dept || user?.dept);
  const phone = cleanValue(profile.phone || user?.phone);
  const email = cleanValue(profile.email || user?.email);
  const doctorCode = cleanValue(profile.doctor_code || profile.doctorCode || profile.staff_code);
  const experience = profile.experience_years ? `${profile.experience_years} years` : null;

  let feeFormatted = null;
  const rawFee = profile.consultation_fee ?? user?.consultation_fee;
  if (rawFee !== null && rawFee !== undefined) {
    const feeNum = Number(rawFee);
    if (!isNaN(feeNum) && feeNum > 0) {
      feeFormatted = `₹${feeNum.toLocaleString('en-IN')}`;
    }
  }

  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #f8fafc, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
              background: '#f0fdf4',
              color: '#166534',
              border: '1px solid #bbf7d0',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {roleName}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Account Profile</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 700,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
          >
            ✕
          </button>
        </div>

        {/* Profile Identity Hero */}
        <div style={{
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, oklch(0.55 0.12 180), oklch(0.4 0.1 200))',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 700,
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)'
          }}>
            {initials}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="user-profile-title" style={{
              margin: '0 0 4px 0',
              fontSize: '18px',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {displayName}
            </h2>

            <div style={{ fontSize: '12.5px', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              {designation && (
                <span style={{ fontWeight: 600, color: '#0d9488' }}>
                  {designation}
                </span>
              )}
              {department && designation && <span>·</span>}
              {department && (
                <span>{department}</span>
              )}
            </div>

            {loading && (
              <div style={{ fontSize: '10.5px', color: '#0284c7', marginTop: '4px' }}>
                Synchronizing live database details…
              </div>
            )}
          </div>
        </div>

        {/* Profile Details List */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Full Name */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Full Name</span>
            <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{displayName}</span>
          </div>

          {/* Qualification (Doctors) */}
          {qualification && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Qualification</span>
              <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{qualification}</span>
            </div>
          )}

          {/* Designation */}
          {designation && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Designation</span>
              <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{designation}</span>
            </div>
          )}

          {/* Department */}
          {department && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Department</span>
              <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{department}</span>
            </div>
          )}

          {/* Phone */}
          {phone && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Phone</span>
              <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{phone}</span>
            </div>
          )}

          {/* Email */}
          {email && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Email</span>
              <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{email}</span>
            </div>
          )}

          {/* Consultation Fee (Doctors only when available) */}
          {feeFormatted && isDoctor && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Consultation Fee</span>
              <span style={{ color: '#047857', fontWeight: 700, textAlign: 'right' }}>{feeFormatted}</span>
            </div>
          )}

          {/* Experience */}
          {experience && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Clinical Experience</span>
              <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{experience}</span>
            </div>
          )}

          {/* Code */}
          {doctorCode && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '13px' }}>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Identifier Code</span>
              <span style={{ color: '#0f172a', fontFamily: 'ui-monospace, monospace', fontSize: '12px', fontWeight: 600 }}>{doctorCode}</span>
            </div>
          )}

          {/* Security Status */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12.5px',
            paddingTop: '8px',
            borderTop: '1px dashed #e2e8f0',
            marginTop: '4px'
          }}>
            <span style={{ color: '#64748b' }}>Account Status</span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#15803d',
              background: '#f0fdf4',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
              Active · Verified
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px'
        }}>
          {onSignOut && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              style={{
                height: '34px',
                padding: '0 14px',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                background: '#fff',
                color: '#b91c1c',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Sign out
            </button>
          )}

          <button
            type="button"
            id="btn-close-profile-modal"
            onClick={onClose}
            style={{
              height: '34px',
              padding: '0 18px',
              borderRadius: '6px',
              border: 'none',
              background: 'linear-gradient(135deg, #0f766e, #0d9488)',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'opacity 0.15s'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
