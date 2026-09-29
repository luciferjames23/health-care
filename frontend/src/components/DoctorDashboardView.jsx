import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';

export default function DoctorDashboardView({ user, onNavigate, onSelectPatient }) {
  const doctorName = user?.name || 'Doctor';
  const doctorId = user?.doctorId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const fetchDoctorData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, apptRes, schedRes] = await Promise.all([
        apiService.getDashboardSummary({ date_from: dateFrom, date_to: dateTo, doctor_id: doctorId }).catch(() => null),
        apiService.getDashboardAppointments({ date_from: dateFrom, date_to: dateTo, doctor_id: doctorId, per_page: 50 }).catch(() => null),
        apiService.getDoctorSchedules({ doctor_id: doctorId }).catch(() => null)
      ]);

      if (sumRes) setSummary(sumRes);
      if (apptRes?.appointments) {
        setAppointments(apptRes.appointments);
      } else {
        setAppointments([]);
      }
      if (schedRes?.schedules) {
        setSchedules(schedRes.schedules);
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error('Failed to load doctor dashboard data:', err);
      setError('Unable to load doctor workspace data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorData();
  }, [dateFrom, dateTo, doctorId]);

  const apptStats = useMemo(() => {
    const total = appointments.length;
    const confirmed = appointments.filter(a => (a.status || '').toUpperCase() === 'CONFIRMED' || (a.status || '').toUpperCase() === 'BOOKED').length;
    const completed = appointments.filter(a => (a.status || '').toUpperCase() === 'COMPLETED').length;
    const cancelled = appointments.filter(a => (a.status || '').toUpperCase() === 'CANCELLED').length;
    const uniquePatients = new Set(appointments.map(a => a.patient_id)).size;
    return { total, confirmed, completed, cancelled, uniquePatients };
  }, [appointments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Doctor Workspace</span> · <span>Doctor Portal Dashboard</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>Doctor Portal — {doctorName}</div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            {user?.dept ? `Department: ${user.dept} · ` : ''}Showing live clinical records & patient appointments
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <label style={{ fontSize: '11px', color: '#64748b' }}>From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ height: '30px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}
            />
            <label style={{ fontSize: '11px', color: '#64748b' }}>To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ height: '30px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}
            />
          </div>
          <button
            type="button"
            onClick={() => fetchDoctorData()}
            style={{ height: '30px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Scope Banner */}
      <div style={{ background: 'oklch(0.96 0.03 200)', border: '1px solid oklch(0.88 0.08 200)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'oklch(0.4 0.12 200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          🔒 <strong>Doctor Clinical Scope Active</strong> — Showing appointments and patients assigned to <strong>{doctorName}</strong>.
        </div>
        <div style={{ fontWeight: 600 }}>
          {apptStats.total} Appointment(s) in Selected Range
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', color: '#991b1b', fontSize: '12px' }}>
          ⚠ {error}
        </div>
      )}

      {/* Doctor KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>My Appointments</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#15181b', marginTop: '4px' }}>{apptStats.total}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Confirmed</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(0.4 0.12 150)', marginTop: '4px' }}>{apptStats.confirmed}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Completed</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(0.5 0.1 200)', marginTop: '4px' }}>{apptStats.completed}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cancelled</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(0.45 0.17 25)', marginTop: '4px' }}>{apptStats.cancelled}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px 16px' }}>
          <div style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>My Patients</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#15181b', marginTop: '4px' }}>{apptStats.uniquePatients}</div>
        </div>
      </div>

      {/* Doctor Working Shifts Card */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#15181b' }}>📅 My Shift Schedules & Slot Configurations</div>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('doctors')}
            style={{ fontSize: '12px', color: 'oklch(0.5 0.1 200)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Manage Timings →
          </button>
        </div>

        {schedules.length === 0 ? (
          <div style={{ color: '#8a9096', fontSize: '12px' }}>No active working shift schedule configured for this doctor profile.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {schedules.map(s => (
              <div key={s.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#15181b' }}>{s.day_of_week}</div>
                <div style={{ fontSize: '12px', color: '#0369a1', marginTop: '2px' }}>{s.start_time} - {s.end_time}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{s.slot_duration_minutes} min duration per slot</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointments Timeline Table */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#15181b' }}>📋 Patient Appointments Schedule</div>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('appointments')}
            style={{ fontSize: '12px', color: 'oklch(0.5 0.1 200)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            View Appointments →
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#8a9096' }}>Loading appointments schedule…</div>
        ) : appointments.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#8a9096' }}>
            No appointments found for the selected date range.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <th style={{ padding: '8px 12px' }}>Time / Date</th>
                <th style={{ padding: '8px 12px' }}>Patient Name</th>
                <th style={{ padding: '8px 12px' }}>Department</th>
                <th style={{ padding: '8px 12px' }}>Booking Source</th>
                <th style={{ padding: '8px 12px' }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#15181b' }}>
                    <div>{a.appointment_time || a.slot_time || '10:00 AM'}</div>
                    <div style={{ fontSize: '10.5px', color: '#8a9096', fontWeight: 400 }}>{a.appointment_date || 'Today'}</div>
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#15181b' }}>
                    {a.patient_name || `Patient #${a.patient_id}`}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#0369a1' }}>
                    {a.department_name || a.department || 'General'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#52585e', fontSize: '11px' }}>
                    {a.booking_source || 'WHATSAPP_AI'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                      background: (a.status || '').toUpperCase() === 'CONFIRMED' ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 80)',
                      color: (a.status || '').toUpperCase() === 'CONFIRMED' ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.13 70)'
                    }}>
                      ● {a.status || 'CONFIRMED'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => onSelectPatient && onSelectPatient({ id: a.patient_id, name: a.patient_name })}
                      style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid #e3e6e8', background: '#fff', color: '#15181b', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Patient 360
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
