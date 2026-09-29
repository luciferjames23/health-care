import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchDashboardSummary, fetchAppointments, fetchDateWiseAnalytics, fetchDailyView,
  format12HourTime,
  type DashboardSummary, type Appointment, type DateWiseAnalytics, type DailyViewResponse
} from '../../services/dashboardApi';
import {
  CalendarCheck, Users, Clock, Bot, BedDouble,
  CheckCircle, Eye, RefreshCw, XCircle, UserPlus, UserCheck, TrendingUp, AlertTriangle, Calendar
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import DateRangeFilter, { type DateRangeValue, formatFriendlyDate, toYMD } from '../../components/DateRangeFilter';

const STATUS_COLORS: Record<string, string> = {
  BOOKED: '#ECC94B',
  CONFIRMED: '#48BB78',
  COMPLETED: '#4299E1',
  CANCELLED: '#F56565',
  RESCHEDULED: '#9F7AEA',
  NO_SHOW: '#A0AEC0',
};

interface DoctorDashboardProps {
  onNavigate?: (page: string, patient?: any) => void;
  onSelectPatient?: (patient: any) => void;
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ onNavigate, onSelectPatient }) => {
  const { user: authContextUser } = useAuth();
  const navigate = useNavigate();

  const currentUser = authContextUser || (() => {
    try {
      return JSON.parse(sessionStorage.getItem('hx_auth') || sessionStorage.getItem('meridian_user') || 'null');
    } catch {
      return null;
    }
  })();
  const doctorId = currentUser?.doctorId ? Number(currentUser.doctorId) : undefined;

  const [dateRange, setDateRange] = useState<DateRangeValue>({
    dateFrom: toYMD(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    dateTo: toYMD(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
    preset: 'this_month',
    displayLabel: 'This Month',
  });

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [analytics, setAnalytics] = useState<DateWiseAnalytics | null>(null);
  const [rangeAppointments, setRangeAppointments] = useState<Appointment[]>([]);
  const [dailyView, setDailyView] = useState<DailyViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Interactive View Mode & Detail Modal State
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
  const [selectedApptModal, setSelectedApptModal] = useState<Appointment | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, ana, apptRes, dView] = await Promise.all([
        fetchDashboardSummary({
          date_from: dateRange.dateFrom,
          date_to: dateRange.dateTo,
          doctor_id: doctorId,
        }),
        fetchDateWiseAnalytics({
          date_from: dateRange.dateFrom,
          date_to: dateRange.dateTo,
          doctor_id: doctorId,
        }),
        fetchAppointments({
          date_from: dateRange.dateFrom,
          date_to: dateRange.dateTo,
          doctor_id: doctorId,
          per_page: 200,
        }),
        fetchDailyView({
          date: toYMD(new Date()),
          doctor_id: doctorId,
        }),
      ]);
      setSummary(sum);
      setAnalytics(ana);
      setRangeAppointments(apptRes?.appointments || []);
      setDailyView(dView);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [dateRange, doctorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleViewAllInTable = () => {
    setViewMode(prev => prev === 'timeline' ? 'table' : 'timeline');
    if (onNavigate) {
      onNavigate('appointments');
    } else {
      try { navigate('/doctor/appointments'); } catch {}
    }
  };

  const handleViewPatientRecord = (a: Appointment) => {
    const patObj = {
      id: a.patient_id,
      patient_id: a.patient_id,
      patient_code: a.patient_code || `PAT-${a.patient_id}`,
      name: a.patient_name,
      patient_name: a.patient_name,
      department_name: a.department_name,
      phone: a.phone || '',
    };

    // Open detail modal overlay immediately
    setSelectedApptModal(a);

    // Trigger parent app navigation if passed
    if (onSelectPatient) {
      onSelectPatient(patObj);
    } else if (onNavigate) {
      onNavigate('patient360', patObj);
    } else {
      try { navigate(`/doctor/patient-records/${a.patient_id}`); } catch {}
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Status pie chart
  const statusPieData = summary
    ? [
        { name: 'Completed', value: summary.appointments.completed, color: STATUS_COLORS.COMPLETED },
        { name: 'Confirmed', value: summary.appointments.confirmed, color: STATUS_COLORS.CONFIRMED },
        { name: 'Booked', value: summary.appointments.booked, color: STATUS_COLORS.BOOKED },
        { name: 'Cancelled', value: summary.appointments.cancelled, color: STATUS_COLORS.CANCELLED },
        { name: 'Rescheduled', value: summary.appointments.rescheduled, color: STATUS_COLORS.RESCHEDULED },
        { name: 'No Show', value: summary.appointments.no_show, color: STATUS_COLORS.NO_SHOW },
      ].filter(item => item.value > 0)
    : [];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2>Meridian Hospital — Doctor Portal</h2>
            <p>{greeting}, {currentUser?.name || 'Doctor'} {currentUser?.department ? `· Department: ${currentUser?.department}` : ''}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? 'Loading...' : `Refresh · ${lastUpdated.toLocaleTimeString()}`}
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          marginBottom: 20,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <DateRangeFilter
          initialPreset="this_month"
          initialFrom={dateRange.dateFrom}
          initialTo={dateRange.dateTo}
          onChange={val => setDateRange(val)}
        />
        <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
          🔒 Showing ONLY your clinical records
        </div>
      </div>

      {/* Showing range banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--primary-lightest, #EFF6FF)',
          border: '1px solid #BFDBFE',
          borderRadius: 8,
          padding: '8px 16px',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--primary, #2563EB)',
          fontWeight: 500,
        }}
      >
        <div>
          📅 Showing data from <strong>{formatFriendlyDate(dateRange.dateFrom)}</strong> to <strong>{formatFriendlyDate(dateRange.dateTo)}</strong>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {summary?.appointments.total ?? 0} appointment(s) in selected range
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon blue"><CalendarCheck size={22} /></div>
            <span className="kpi-trend up"><TrendingUp size={14} /> In Range</span>
          </div>
          <div className="kpi-value">{loading ? '—' : summary?.appointments.total ?? 0}</div>
          <div className="kpi-label">My Appointments</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <div className="kpi-icon teal"><CheckCircle size={22} /></div>
            <span className="kpi-trend up">{summary?.appointments.total ? Math.round(((summary.appointments.completed) / summary.appointments.total) * 100) : 0}%</span>
          </div>
          <div className="kpi-value">{loading ? '—' : summary?.appointments.completed ?? 0}</div>
          <div className="kpi-label">Completed Consultations</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header"><div className="kpi-icon green"><CalendarCheck size={22} /></div></div>
          <div className="kpi-value">{loading ? '—' : summary?.appointments.confirmed ?? 0}</div>
          <div className="kpi-label">Confirmed</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header"><div className="kpi-icon amber"><Clock size={22} /></div></div>
          <div className="kpi-value">{loading ? '—' : summary?.appointments.booked ?? 0}</div>
          <div className="kpi-label">Booked (Pending)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header"><div className="kpi-icon red"><XCircle size={22} /></div></div>
          <div className="kpi-value">{loading ? '—' : summary?.appointments.cancelled ?? 0}</div>
          <div className="kpi-label">Cancelled</div>
        </div>

        <div className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/doctor/patient-records')}>
          <div className="kpi-card-header"><div className="kpi-icon teal"><Users size={22} /></div></div>
          <div className="kpi-value">{loading ? '—' : summary?.patients.unique_in_range ?? summary?.patients.total ?? 0}</div>
          <div className="kpi-label">My Patients (In Range)</div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      {summary && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Upcoming Consultations', value: summary.appointments.upcoming, color: '#4A90D9', icon: Clock },
            { label: 'New Patients In Range', value: summary.patients.new_in_range ?? 0, color: '#48BB78', icon: UserPlus },
            { label: 'Returning Patients', value: summary.patients.returning_in_range ?? 0, color: '#3182CE', icon: UserCheck },
            { label: 'Rescheduled', value: summary.appointments.rescheduled, color: '#9F7AEA', icon: Clock },
            { label: 'No-Show', value: summary.appointments.no_show, color: '#A0AEC0', icon: AlertTriangle },
            { label: 'Open Escalations', value: summary.escalations.open, color: '#E53E3E', icon: Bot },
          ].map(item => (
            <div key={item.label} className="card" style={{ flex: '1 1 160px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 8, background: `${item.color}15`, color: item.color }}>
                <item.icon size={20} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today's Schedule & Slot Utilization Summary */}
      {dailyView?.doctor_schedules && dailyView.doctor_schedules.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3><Clock size={16} style={{ marginRight: 8 }} />Today's Working Schedule & Slot Utilization ({formatFriendlyDate(toYMD(new Date()))})</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {dailyView.doctor_schedules.map(ds => (
                <div key={ds.schedule_id} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Working Hours: {ds.working_hours}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Slot Duration: {ds.slot_duration_minutes} mins · Total Slots: {ds.total_slots}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span>Booked: <strong>{ds.booked_slots}</strong></span>
                    <span>Completed: <strong style={{ color: '#16A34A' }}>{ds.completed_slots}</strong></span>
                    <span>Available: <strong style={{ color: '#2563EB' }}>{ds.available_slots}</strong></span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      <span>Slot Utilization</span>
                      <span>{ds.slot_utilization_pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, ds.slot_utilization_pct)}%`,
                          height: '100%',
                          background: ds.slot_utilization_pct > 80 ? '#16A34A' : ds.slot_utilization_pct > 50 ? '#2563EB' : '#D97706',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row: Trend & Status */}
      <div className="chart-grid" style={{ marginBottom: 24 }}>
        <div className="chart-card">
          <div className="card-header">
            <h3>Daily Appointment Trend</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {formatFriendlyDate(dateRange.dateFrom)} – {formatFriendlyDate(dateRange.dateTo)}
            </span>
          </div>
          <div className="card-body">
            {analytics?.appointments_by_date && analytics.appointments_by_date.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={analytics.appointments_by_date}>
                  <defs>
                    <linearGradient id="colorDocAppt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A90D9" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4A90D9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8796A9' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#8796A9' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#4A90D9" strokeWidth={2} fill="url(#colorDocAppt)" />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#48BB78" strokeWidth={2} fill="none" />
                  <Area type="monotone" dataKey="cancelled" name="Cancelled" stroke="#F56565" strokeWidth={1.5} fill="none" strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                No appointments found for the selected date range.
              </div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="card-header">
            <h3>Status Distribution</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>In Selected Range</span>
          </div>
          <div className="card-body">
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                No appointments in selected range.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Record / Clinical Detail Modal Overlay */}
      {selectedApptModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 10, border: '1px solid #cbd5e1',
            width: '100%', maxWidth: 580, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {selectedApptModal.patient_name} ({selectedApptModal.patient_code})
                </h3>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Patient Record ID: #{selectedApptModal.patient_id} · Dept: {selectedApptModal.department_name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedApptModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13, marginBottom: 20 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Appointment Time</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {format12HourTime(selectedApptModal.appointment_time)}
                </div>
                <div style={{ fontSize: 12, color: '#475569' }}>{selectedApptModal.appointment_date}</div>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Booking Status</div>
                <div style={{ marginTop: 4 }}>
                  <span
                    className="status-badge"
                    style={{
                      background: `${STATUS_COLORS[selectedApptModal.status] || '#A0AEC0'}20`,
                      color: STATUS_COLORS[selectedApptModal.status] || '#4A5568',
                      fontWeight: 700, fontSize: 12
                    }}
                  >
                    ● {selectedApptModal.status}
                  </span>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Reason for Visit & Notes</div>
                <div style={{ fontSize: 13, color: '#0f172a', marginTop: 4, fontWeight: 500 }}>
                  {selectedApptModal.patient_reason ? `"${selectedApptModal.patient_reason}"` : 'Regular Clinical Checkup'}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
                  Booking Source: {selectedApptModal.booking_source} · Duration: {selectedApptModal.duration_minutes || 30} mins
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedApptModal(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const patObj = {
                    id: selectedApptModal.patient_id,
                    patient_id: selectedApptModal.patient_id,
                    patient_code: selectedApptModal.patient_code || `PAT-${selectedApptModal.patient_id}`,
                    name: selectedApptModal.patient_name,
                    patient_name: selectedApptModal.patient_name,
                  };
                  setSelectedApptModal(null);
                  if (onSelectPatient) onSelectPatient(patObj);
                  else if (onNavigate) onNavigate('patient360', patObj);
                }}
              >
                Open Full Patient 360 View →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointments Timeline / Table in Selected Range */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <h3>Appointments in Selected Range ({formatFriendlyDate(dateRange.dateFrom)} – {formatFriendlyDate(dateRange.dateTo)})</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: 6, padding: 2 }}>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                style={{
                  padding: '3px 10px', fontSize: 12, borderRadius: 4, border: 'none',
                  background: viewMode === 'timeline' ? '#fff' : 'transparent',
                  color: viewMode === 'timeline' ? '#0f172a' : '#64748b',
                  fontWeight: viewMode === 'timeline' ? 600 : 400,
                  boxShadow: viewMode === 'timeline' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Timeline View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  padding: '3px 10px', fontSize: 12, borderRadius: 4, border: 'none',
                  background: viewMode === 'table' ? '#fff' : 'transparent',
                  color: viewMode === 'table' ? '#0f172a' : '#64748b',
                  fontWeight: viewMode === 'table' ? 600 : 400,
                  boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer'
                }}
              >
                Table View
              </button>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={handleViewAllInTable}>
              {viewMode === 'timeline' ? 'View All in Table →' : 'View Full Appointments Page →'}
            </button>
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading appointments...</div>
          ) : viewMode === 'table' ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <th style={{ padding: '10px 12px' }}>Time & Date</th>
                    <th style={{ padding: '10px 12px' }}>Patient Name & Code</th>
                    <th style={{ padding: '10px 12px' }}>Department & Reason</th>
                    <th style={{ padding: '10px 12px' }}>Booking Source</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeAppointments.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>
                        {format12HourTime(a.appointment_time)}
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{a.appointment_date}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0284c7' }}>
                        {a.patient_name}
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{a.patient_code}</div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>
                        {a.department_name}
                        {a.patient_reason && <div style={{ fontSize: 11, color: '#64748b' }}>Reason: "{a.patient_reason}"</div>}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569', fontSize: 12 }}>
                        {a.booking_source}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          className="status-badge"
                          style={{
                            background: `${STATUS_COLORS[a.status] || '#A0AEC0'}20`,
                            color: STATUS_COLORS[a.status] || '#4A5568',
                            fontWeight: 600,
                            fontSize: 11.5
                          }}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewPatientRecord(a)}
                          title="View Patient Record"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 12 }}
                        >
                          <Eye size={13} />
                          <span>View Record</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rangeAppointments.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No appointments found for the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="timeline">
              {rangeAppointments.map(a => (
                <div key={a.id} className={`timeline-item ${a.status.toLowerCase()}`}>
                  <div className="timeline-time">
                    <div style={{ fontWeight: 600 }}>{format12HourTime(a.appointment_time)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.appointment_date}</div>
                  </div>
                  <div className="timeline-content">
                    <div>
                      <div className="timeline-patient">{a.patient_name} ({a.patient_code})</div>
                      <div className="timeline-dept">
                        {a.department_name} · {a.booking_source}
                        {a.duration_minutes && ` · ${a.duration_minutes} min slot`}
                        {a.patient_reason && ` · Reason: "${a.patient_reason}"`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="status-badge"
                        style={{
                          background: `${STATUS_COLORS[a.status] || '#A0AEC0'}20`,
                          color: STATUS_COLORS[a.status] || '#4A5568',
                          fontWeight: 600,
                        }}
                      >
                        {a.status}
                      </span>
                      <div className="timeline-actions">
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewPatientRecord(a)}
                          title="View Patient Record"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {rangeAppointments.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  No appointments found for the selected date range.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
