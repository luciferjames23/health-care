import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchAppointments, updateAppointmentStatus, format12HourTime, checkInPatient, type Appointment
} from '../../services/dashboardApi';
import { CheckCircle, XCircle, RefreshCw, Search, Calendar, UserCheck } from 'lucide-react';
import DateRangeFilter, { type DateRangeValue, formatFriendlyDate, toYMD } from '../../components/DateRangeFilter';
import { TableSkeleton } from '../../components/ModuleLoadingScreen';
import { LoadingSpinner, ButtonSpinner } from '../../components/LoadingSpinner';

const STATUS_CLASS: Record<string, string> = {
  BOOKED: 'pending',
  CONFIRMED: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'inactive',
  RESCHEDULED: 'rescheduled',
};

const formatSourceLabel = (source?: string) => {
  if (!source) return 'Web Portal';
  const s = source.toUpperCase();
  if (s.includes('WHATSAPP')) return 'WhatsApp';
  if (s === 'ADMIN' || s === 'PORTAL_ADMIN') return 'Admin';
  if (s === 'DOCTOR' || s === 'DOCTOR_PORTAL') return 'Doctor';
  if (s === 'PHONE') return 'Phone';
  if (s === 'WALK_IN' || s === 'WALK-IN') return 'Walk-in';
  if (s === 'WEB_PORTAL' || s === 'WEB PORTAL' || s === 'PORTAL') return 'Web Portal';
  return source;
};

interface DoctorAppointmentsProps {
  user?: any;
}

const DoctorAppointments: React.FC<DoctorAppointmentsProps> = ({ user: propUser }) => {
  const { user: authUser } = useAuth();
  const currentUser = propUser || authUser || (() => {
    try {
      return JSON.parse(sessionStorage.getItem('hx_auth') || sessionStorage.getItem('hospital_user') || 'null');
    } catch {
      return null;
    }
  })();
  const doctorId = (currentUser?.doctorId || currentUser?.doctor_id) ? Number(currentUser.doctorId || currentUser.doctor_id) : undefined;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    dateFrom: '',
    dateTo: '',
    preset: 'all_time',
    displayLabel: 'All Time',
  });
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [total, setTotal] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetchAppointments({
        doctor_id: doctorId,
        search: search || undefined,
        status: statusFilter || undefined,
        booking_source: sourceFilter || undefined,
        date_from: dateRange.dateFrom || undefined,
        date_to: dateRange.dateTo || undefined,
        per_page: 50,
      });
      if (res.success === false && res.error) {
        setApiError(res.error);
        setAppointments([]);
        setTotal(0);
        return;
      }
      setAppointments(Array.isArray(res.appointments) ? res.appointments : []);
      setTotal(res.total ?? 0);
    } catch (err: any) {
      setApiError(err?.message || 'Failed to load appointments');
      setAppointments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [doctorId, search, statusFilter, sourceFilter, dateRange]);

  useEffect(() => {
    const timer = setTimeout(loadAppointments, 300);
    return () => clearTimeout(timer);
  }, [loadAppointments]);

  const handleStatusUpdate = async (bookingId: string, newStatus: string, reason?: string) => {
    setActionLoadingId(bookingId);
    try {
      const ok = await updateAppointmentStatus(bookingId, newStatus, reason);
      if (ok) {
        showToast(`Appointment ${bookingId} → ${newStatus}`);
        loadAppointments();
      } else {
        showToast('❌ Status update failed.');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCheckIn = async (appointmentId: number, patientName: string) => {
    setActionLoadingId(appointmentId);
    try {
      const res = await checkInPatient(appointmentId);
      if (res.success) {
        showToast(`✅ Patient ${patientName} checked in. Token #${res.data?.token_number} assigned.`);
        loadAppointments();
      } else {
        showToast(`❌ ${res.error || 'Check-in failed.'}`);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>My Appointments</h2>
            <p>Appointments for {user?.name}{user?.department ? ` — ${user?.department}` : ''}</p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => loadAppointments()}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ButtonSpinner loading={loading} />
            {!loading && <RefreshCw size={15} />}
            Refresh
          </button>
        </div>
      </div>

      {toast && <div className="success-alert" style={{ marginBottom: 16 }}><CheckCircle size={16} /> {toast}</div>}

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-bar" style={{ maxWidth: 300, flex: '1 1 200px' }}>
            <Search size={18} />
            <input
              placeholder="Search patient, booking ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <DateRangeFilter
              initialPreset="all_time"
              initialFrom={dateRange.dateFrom}
              initialTo={dateRange.dateTo}
              onChange={val => setDateRange(val)}
            />

            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--radius-sm, 6px)',
              background: 'var(--bg-primary)',
              cursor: 'pointer'
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
                aria-label="Status"
              >
                <option value="">All Status</option>
                <option value="BOOKED">Booked</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="RESCHEDULED">Rescheduled</option>
                <option value="NO_SHOW">No Show</option>
              </select>
            </label>

            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: 13,
                fontFamily: 'inherit',
                background: 'var(--bg-primary)',
              }}
            >
              <option value="">All Sources</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="WEB_PORTAL">Web Portal</option>
              <option value="PHONE">Phone</option>
              <option value="WALK_IN">Walk-in</option>
              <option value="ADMIN">Admin</option>
              <option value="DOCTOR">Doctor</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          {loading ? (
            <TableSkeleton rows={6} columns={8} />
          ) : apiError ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ color: '#dc2626', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>⚠️ Unable to load appointments</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{apiError}</div>
              <button
                type="button"
                onClick={loadAppointments}
                style={{ padding: '6px 14px', borderRadius: '6px', background: '#0284c7', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Retry
              </button>
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
              No appointments found for the selected date range ({formatFriendlyDate(dateRange.dateFrom)} – {formatFriendlyDate(dateRange.dateTo)}).
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Patient</th>
                  <th>Reason</th>
                  <th>Appointment Date</th>
                  <th>Time & Duration</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Queue Token</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id || a.booking_id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 12 }}>{a.booking_id}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.patient_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.patient_code} · {a.patient_phone}</div>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={a.patient_reason || ''}>
                      {a.patient_reason || '—'}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{a.appointment_date}</td>
                    <td style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{format12HourTime(a.appointment_time)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {a.duration_minutes ? `${a.duration_minutes} mins` : '30 mins'}
                        {a.appointment_end_time && ` (– ${format12HourTime(a.appointment_end_time)})`}
                      </div>
                    </td>
                    <td><span className="intent-badge">{formatSourceLabel(a.booking_source)}</span></td>
                    <td>
                      <span className={`status-badge ${STATUS_CLASS[a.status] || ''}`}>{a.status}</span>
                    </td>
                    <td>
                      {a.queue_status ? (
                        <span className="status-badge active" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                          #{a.token_number} ({a.queue_status})
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not Checked In</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!a.queue_status && (a.status === 'CONFIRMED' || a.status === 'BOOKED') && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={actionLoadingId !== null}
                            onClick={() => handleCheckIn(a.id, a.patient_name)}
                            title="Check In Patient to Queue"
                            style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <ButtonSpinner loading={actionLoadingId === a.id} />
                            {actionLoadingId !== a.id && <UserCheck size={13} />} Check In
                          </button>
                        )}
                        {a.status === 'BOOKED' && (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={actionLoadingId !== null}
                            onClick={() => handleStatusUpdate(a.booking_id, 'CONFIRMED')}
                            title="Confirm"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <ButtonSpinner loading={actionLoadingId === a.booking_id} />
                            {actionLoadingId !== a.booking_id && <CheckCircle size={13} />} Confirm
                          </button>
                        )}
                        {a.status === 'CONFIRMED' && (
                          <button
                            className="btn btn-success btn-sm"
                            disabled={actionLoadingId !== null}
                            onClick={() => handleStatusUpdate(a.booking_id, 'COMPLETED')}
                            title="Complete Consultation"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <ButtonSpinner loading={actionLoadingId === a.booking_id} />
                            {actionLoadingId !== a.booking_id && <CheckCircle size={13} />} Complete
                          </button>
                        )}
                        {(a.status === 'BOOKED' || a.status === 'CONFIRMED') && (
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={actionLoadingId !== null}
                            onClick={() => handleStatusUpdate(a.booking_id, 'CANCELLED', 'Cancelled by doctor')}
                            title="Cancel"
                            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <ButtonSpinner loading={actionLoadingId === a.booking_id} />
                            {actionLoadingId !== a.booking_id && <XCircle size={13} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '12px 22px', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && <LoadingSpinner inline size="xs" />}
          {loading ? 'Loading appointments...' : `${appointments.length} of ${total} appointment(s) shown`}
        </div>
      </div>
    </div>
  );
};

export default DoctorAppointments;
