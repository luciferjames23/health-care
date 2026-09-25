import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, CheckCircle, XCircle, RefreshCw, ChevronLeft, ChevronRight,
  Download, ArrowUpDown, Clock, Calendar, User, Stethoscope, Building
} from 'lucide-react';
import {
  fetchAppointments, fetchDoctors, fetchDepartments, updateAppointmentStatus,
  format12HourTime,
  type Appointment, type Doctor, type Department
} from '../../services/dashboardApi';
import {
  type DatePreset,
  type DateRangeValue,
  calculateDateRange,
  toYMD
} from '../../components/DateRangeFilter';
import ModuleLoadingScreen from '../../components/ModuleLoadingScreen';

const btnBase: React.CSSProperties = {
  height: '30px',
  padding: '0 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  outline: 'none',
  fontFamily: "var(--sans, 'Public Sans', -apple-system, sans-serif)",
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  border: '1px solid #e3e6e8',
  background: '#fff',
  color: '#15181b',
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  height: '30px',
  padding: '0 10px',
  borderRadius: '6px',
  border: '1px solid #e3e6e8',
  background: '#fff',
  fontSize: '12px',
  color: '#15181b',
  outline: 'none',
  fontFamily: "var(--sans, 'Public Sans', -apple-system, sans-serif)",
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '0 8px',
  cursor: 'pointer',
};

function getStatusBadge(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'CONFIRMED' || s === 'COMPLETED') {
    return {
      bg: '#ecfdf5',
      color: '#047857',
      border: '1px solid #a7f3d0',
      label: s,
    };
  }
  if (s === 'BOOKED' || s === 'RESCHEDULED') {
    return {
      bg: 'oklch(0.96 0.05 80)',
      color: 'oklch(0.5 0.13 70)',
      border: '1px solid #fde68a',
      label: s,
    };
  }
  if (s === 'CANCELLED' || s === 'NO_SHOW') {
    return {
      bg: '#fef2f2',
      color: '#b91c1c',
      border: '1px solid #fecaca',
      label: s,
    };
  }
  return {
    bg: '#f6f7f8',
    color: '#52585e',
    border: '1px solid #e3e6e8',
    label: s || 'UNKNOWN',
  };
}

interface AppointmentManagementProps {
  doctorName?: string | null;
  userRole?: string;
}

const AppointmentManagement: React.FC<AppointmentManagementProps> = ({
  doctorName = null,
  userRole = 'Hospital Management'
}) => {
  const isDoctor = userRole === 'Doctor' || Boolean(doctorName) || (typeof doctorName === 'string' && doctorName.toLowerCase().includes('immanuvel'));
  const activeDoctorName = isDoctor ? (doctorName || 'Dr. Immanuvel S') : null;

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    dateFrom: toYMD(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    dateTo: toYMD(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
    preset: 'this_month',
    displayLabel: 'This Month',
  });
  const [dateType, setDateType] = useState<'appointment_date' | 'created_at'>('appointment_date');
  const [deptFilter, setDeptFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortBy, setSortBy] = useState('appointment_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const perPage = 15;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Load static filter options & auto-bind doctor if doctor role
  useEffect(() => {
    fetchDoctors().then(res => {
      const docList = Array.isArray(res?.doctors) ? res.doctors : [];
      setDoctors(docList);
      if (isDoctor && activeDoctorName) {
        const baseName = activeDoctorName.split('-')[0].trim();
        const cleanName = baseName.toLowerCase().replace(/^dr\.?\s*/i, '').trim();
        const firstWord = cleanName.split(' ')[0];

        let matched = docList.find(d => {
          const dName = (d.display_name || (d as any).name || '').toLowerCase().replace(/^dr\.?\s*/i, '').trim();
          return dName === cleanName || dName.includes(cleanName) || cleanName.includes(dName);
        });

        if (!matched && firstWord.length > 2) {
          matched = docList.find(d => {
            const dName = (d.display_name || (d as any).name || '').toLowerCase().replace(/^dr\.?\s*/i, '').trim();
            return dName.includes(firstWord);
          });
        }

        if (matched) {
          setDoctorFilter(matched.id);
        } else {
          const fallback = docList.find(d => (d.display_name || '').toLowerCase().includes('immanuvel'));
          if (fallback) setDoctorFilter(fallback.id);
        }
      }
    });
    fetchDepartments().then(res => setDepartments(Array.isArray(res?.departments) ? res.departments : []));
  }, [isDoctor, activeDoctorName]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const loadAppointments = useCallback(async () => {
    // If logged in as Doctor, do not fetch un-scoped appointments while doctorFilter ID is resolving!
    if (isDoctor && doctorFilter === undefined) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetchAppointments({
        search: search || undefined,
        status: statusFilter || undefined,
        department: isDoctor ? undefined : (deptFilter || undefined),
        doctor_id: isDoctor ? (doctorFilter || 1015) : doctorFilter,
        booking_source: sourceFilter || undefined,
        date_from: dateRange.dateFrom,
        date_to: dateRange.dateTo,
        date_type: dateType,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        per_page: perPage,
      });

      let rawAppts = Array.isArray(res?.appointments) ? res.appointments : [];
      // Fail-safe doctor scoping to ensure only Dr. Immanuvel S / active doctor's appointments are displayed
      if (isDoctor && activeDoctorName) {
        const activeClean = activeDoctorName.toLowerCase().replace(/^dr\.?\s*/i, '').trim();
        rawAppts = rawAppts.filter(a => {
          if (doctorFilter && a.doctor_id) {
            return a.doctor_id === doctorFilter;
          }
          const docClean = (a.doctor_name || '').toLowerCase().replace(/^dr\.?\s*/i, '').trim();
          return docClean.includes(activeClean) || activeClean.includes(docClean) || docClean.includes('immanuvel');
        });
      }

      setAppointments(rawAppts);
      setTotal(isDoctor ? rawAppts.length : (res?.total ?? 0));
      setTotalPages(isDoctor ? Math.ceil(rawAppts.length / perPage) || 1 : (res?.total_pages ?? 1));
    } finally {
      setLoading(false);
    }
  }, [isDoctor, activeDoctorName, search, statusFilter, deptFilter, doctorFilter, sourceFilter, dateRange, dateType, sortBy, sortOrder, page]);

  useEffect(() => {
    const timer = setTimeout(loadAppointments, 300);
    return () => clearTimeout(timer);
  }, [loadAppointments]);

  const handleStatusChange = async (bookingId: string, newStatus: string, reason?: string) => {
    const ok = await updateAppointmentStatus(bookingId, newStatus, reason);
    if (ok) {
      showToast(`Appointment ${bookingId} → ${newStatus}`);
      loadAppointments();
    } else {
      showToast('❌ Status update failed. Check the backend.');
    }
  };

  // CSV Export feature
  const exportToCSV = async () => {
    try {
      // Fetch up to 1000 items matching current filters
      const res = await fetchAppointments({
        search: search || undefined,
        status: statusFilter || undefined,
        department: deptFilter || undefined,
        doctor_id: doctorFilter,
        booking_source: sourceFilter || undefined,
        date_from: dateRange.dateFrom,
        date_to: dateRange.dateTo,
        date_type: dateType,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: 1,
        per_page: 1000,
      });

      if (!res.appointments || res.appointments.length === 0) {
        showToast('⚠️ No appointments to export');
        return;
      }

      const headers = [
        'Appointment ID (Booking ID)',
        'Patient Name',
        'Patient ID (Code)',
        'Phone',
        'Doctor Name',
        'Department',
        'Reason',
        'Appointment Date',
        'Appointment Time',
        'Duration (Minutes)',
        'Status',
        'Booking Source',
        'Created Date'
      ];

      const rows = res.appointments.map(a => [
        `"${a.booking_id || ''}"`,
        `"${a.patient_name || ''}"`,
        `"${a.patient_code || ''}"`,
        `"${a.patient_phone || ''}"`,
        `"${a.doctor_name || ''}"`,
        `"${a.department_name || ''}"`,
        `"${(a.patient_reason || '').replace(/"/g, '""')}"`,
        `"${a.appointment_date || ''}"`,
        `"${a.appointment_time || ''}"`,
        `"${a.duration_minutes || 30}"`,
        `"${a.status || ''}"`,
        `"${a.booking_source || ''}"`,
        `"${a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : ''}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `appointments_${dateRange.dateFrom}_to_${dateRange.dateTo}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('✓ Appointments exported to CSV successfully');
    } catch (e) {
      showToast('❌ Failed to export CSV');
    }
  };

  const handlePresetChange = (preset: DatePreset) => {
    const calculated = calculateDateRange(preset);
    setDateRange({
      preset,
      dateFrom: calculated.from,
      dateTo: calculated.to,
      displayLabel: calculated.label,
    });
    setPage(1);
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Header & Breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Front Office & Patients</span> › <span>{isDoctor ? 'Doctor Schedule' : 'Appointments'}</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#15181b' }}>
            {isDoctor && activeDoctorName ? `Appointment Schedule · ${activeDoctorName}` : 'Appointment Management'}
          </div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            {isDoctor && activeDoctorName
              ? `Doctor Scope: ${activeDoctorName} · Showing consultations and procedures scheduled under your care`
              : 'View, filter, sort and manage hospital appointments — database records'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            style={btnSecondary}
            onClick={exportToCSV}
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            type="button"
            style={btnSecondary}
            onClick={loadAppointments}
            disabled={loading}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'kpi-spin 0.7s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '8px 12px', color: '#047857', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CheckCircle size={15} /> {toast}
        </div>
      )}

      {/* Filter and Search Bar Card */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e3e6e8', borderRadius: '6px', padding: '0 10px', height: '30px', flex: '1 1 240px', maxWidth: 320 }}>
            <Search size={14} style={{ color: '#8a9096', flexShrink: 0 }} />
            <input
              placeholder="Search patient, doctor, ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%', background: 'transparent', color: '#15181b', fontFamily: "var(--sans, 'Public Sans', sans-serif)" }}
            />
          </div>

          {/* Date Filter & Date Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f6f7f8', border: '1px solid #e3e6e8', borderRadius: '6px', padding: '0 8px', height: '30px' }}>
              <Calendar size={13} style={{ color: 'oklch(0.5 0.1 200)' }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'oklch(0.4 0.1 200)' }}>Date:</span>
              <select
                value={dateRange.preset}
                onChange={e => handlePresetChange(e.target.value as DatePreset)}
                style={{ border: 'none', background: 'transparent', fontSize: '12px', color: '#15181b', outline: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="this_week">This Week</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="next_7_days">Next 7 Days</option>
                <option value="next_30_days">Next 30 Days</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {dateRange.preset === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="date"
                  value={dateRange.dateFrom}
                  onChange={e => setDateRange(prev => ({ ...prev, dateFrom: e.target.value }))}
                  style={inputStyle}
                />
                <span style={{ fontSize: '11px', color: '#8a9096' }}>→</span>
                <input
                  type="date"
                  value={dateRange.dateTo}
                  onChange={e => setDateRange(prev => ({ ...prev, dateTo: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            )}

            <select
              value={dateType}
              onChange={e => { setDateType(e.target.value as 'appointment_date' | 'created_at'); setPage(1); }}
              style={selectStyle}
              title="Select which timestamp to filter on"
            >
              <option value="appointment_date">Filter by: Appointment Date</option>
              <option value="created_at">Filter by: Booking Created Date</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Row: Doctor, Department, Status, Source, Sorting */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid #eef0f1' }}>
          <Filter size={13} style={{ color: '#8a9096' }} />

          {!isDoctor ? (
            <>
              <select
                value={deptFilter}
                onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
                style={selectStyle}
              >
                <option value="">All Departments</option>
                {(departments || []).map(d => <option key={d.id} value={d.department_name}>{d.department_name}</option>)}
              </select>

              <select
                value={doctorFilter !== undefined ? String(doctorFilter) : ''}
                onChange={e => { setDoctorFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
                style={selectStyle}
              >
                <option value="">All Doctors</option>
                {(doctors || []).map(d => <option key={d.id} value={d.id}>{d.display_name}</option>)}
              </select>
            </>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '30px',
              padding: '0 10px',
              borderRadius: '6px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#0369a1',
              fontSize: '11.5px',
              fontWeight: 600
            }}>
              <span>🩺 Scope: {activeDoctorName || 'My Assigned Patients Only'}</span>
            </div>
          )}

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={selectStyle}
          >
            <option value="">All Status</option>
            {['BOOKED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
            style={selectStyle}
          >
            <option value="">All Sources</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="WEB_PORTAL">Web Portal</option>
            <option value="PHONE">Phone</option>
            <option value="WALK_IN">Walk-in</option>
            <option value="ADMIN">Admin</option>
            <option value="DOCTOR">Doctor</option>
          </select>

          {/* Sort By Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <span style={{ fontSize: '11px', color: '#8a9096' }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={selectStyle}
            >
              <option value="appointment_date">Appointment Date</option>
              <option value="created_at">Created Date</option>
              <option value="patient">Patient Name</option>
              <option value="doctor">Doctor Name</option>
              <option value="status">Status</option>
            </select>

            <button
              type="button"
              style={btnSecondary}
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              title={`Sort ${sortOrder.toUpperCase()}`}
            >
              <ArrowUpDown size={12} /> {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Appointment Table */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '16px' }}>
            <ModuleLoadingScreen
              title="Loading Outpatient Appointments..."
              subtitle="Retrieving OPD bookings, doctor consultation slots, queue tokens, and appointment statuses..."
              badgeText="Live OPD Bookings Sync"
              showKpis={false}
              tableRows={8}
              tableColumns={11}
            />
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8a9096' }}>
            <div style={{ fontWeight: 600, color: '#52585e', marginBottom: '4px' }}>No appointments found</div>
            <div>Try adjusting your date range or filter options.</div>
          </div>
        ) : (
          <table style={{ width: '100%', minWidth: '1250px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f6f7f8', borderBottom: '1px solid #e3e6e8' }}>
                <th style={{ padding: '10px 12px', width: '110px', minWidth: '110px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Booking ID</th>
                <th style={{ padding: '10px 12px', minWidth: '180px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Patient</th>
                <th style={{ padding: '10px 12px', minWidth: '160px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Doctor</th>
                <th style={{ padding: '10px 12px', minWidth: '130px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Department</th>
                <th style={{ padding: '10px 12px', minWidth: '160px', maxWidth: '200px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Reason</th>
                <th style={{ padding: '10px 12px', width: '105px', minWidth: '105px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Date</th>
                <th style={{ padding: '10px 12px', width: '145px', minWidth: '145px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Time</th>
                <th style={{ padding: '10px 12px', width: '115px', minWidth: '115px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Status</th>
                <th style={{ padding: '10px 12px', width: '125px', minWidth: '125px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Source</th>
                <th style={{ padding: '10px 12px', width: '105px', minWidth: '105px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Created</th>
                <th style={{ padding: '10px 12px', width: '120px', minWidth: '120px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => {
                const badge = getStatusBadge(a.status);
                return (
                  <tr
                    key={a.id || a.booking_id}
                    style={{ borderBottom: '1px solid #f2f3f4', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f6f7f8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: 'oklch(0.4 0.1 200)', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      {a.booking_id}
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '180px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, color: '#15181b', whiteSpace: 'nowrap' }}>{a.patient_name}</div>
                      <div style={{ fontSize: '10.5px', color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'nowrap', marginTop: '1px' }}>
                        {a.patient_code} · {a.patient_phone}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '160px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 500, color: '#15181b', whiteSpace: 'nowrap' }}>{a.doctor_name}</div>
                      <div style={{ fontSize: '10.5px', color: '#8a9096', whiteSpace: 'nowrap', marginTop: '1px' }}>{a.specialization}</div>
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '130px', color: '#52585e', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{a.department_name}</td>
                    <td style={{ padding: '10px 12px', minWidth: '160px', maxWidth: '200px', verticalAlign: 'middle', color: '#52585e' }}>
                      <div style={{ maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.patient_reason || ''}>
                        {a.patient_reason || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: '#15181b', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{formatDate(a.appointment_date)}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, color: '#15181b', whiteSpace: 'nowrap' }}>{format12HourTime(a.appointment_time)}</div>
                      <div style={{ fontSize: '10.5px', color: '#8a9096', whiteSpace: 'nowrap', marginTop: '1px' }}>
                        {a.duration_minutes ? `${a.duration_minutes}m` : '30m'}
                        {a.appointment_end_time && ` · until ${format12HourTime(a.appointment_end_time)}`}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          border: badge.border,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <span style={{ background: '#f6f7f8', border: '1px solid #e3e6e8', borderRadius: '4px', padding: '2px 7px', fontSize: '10.5px', color: '#52585e', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        {formatSourceLabel(a.booking_source)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '11px', color: '#8a9096', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {a.status === 'BOOKED' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(a.booking_id, 'CONFIRMED')}
                            title="Confirm Appointment"
                            style={{
                              height: '24px', padding: '0 8px', borderRadius: '4px', border: 0,
                              background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '11px',
                              fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3
                            }}
                          >
                            <CheckCircle size={12} /> Confirm
                          </button>
                        )}
                        {(a.status === 'CONFIRMED' || a.status === 'BOOKED') && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(a.booking_id, 'COMPLETED')}
                              title="Mark Completed"
                              style={{
                                height: '24px', padding: '0 8px', borderRadius: '4px', border: '1px solid #e3e6e8',
                                background: '#fff', color: '#52585e', fontSize: '11px', fontWeight: 500, cursor: 'pointer'
                              }}
                            >
                              ✓ Done
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(a.booking_id, 'CANCELLED', 'Cancelled by admin')}
                              title="Cancel Appointment"
                              style={{
                                height: '24px', padding: '0 6px', borderRadius: '4px', border: '1px solid #fecaca',
                                background: '#fff', color: '#b91c1c', fontSize: '11px', cursor: 'pointer'
                              }}
                            >
                              <XCircle size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid #e3e6e8', background: '#fff', fontSize: '11.5px', color: '#8a9096', flexWrap: 'wrap', gap: 8 }}>
          <span>
            {loading ? 'Loading...' : `Showing ${Math.min((page - 1) * perPage + 1, total)}–${Math.min(page * perPage, total)} of ${total} appointments`}
          </span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                height: '26px', padding: '0 8px', borderRadius: '4px', border: '1px solid #e3e6e8',
                background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1
              }}
            >
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = i + Math.max(1, page - 3);
              if (pg > totalPages) return null;
              const isActive = page === pg;
              return (
                <button
                  key={pg}
                  type="button"
                  onClick={() => setPage(pg)}
                  style={{
                    height: '26px', minWidth: '26px', padding: '0 6px', borderRadius: '4px',
                    border: '1px solid #e3e6e8',
                    background: isActive ? 'oklch(0.5 0.1 200)' : '#fff',
                    color: isActive ? '#fff' : '#15181b',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '11.5px', cursor: 'pointer'
                  }}
                >
                  {pg}
                </button>
              );
            })}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{
                height: '26px', padding: '0 8px', borderRadius: '4px', border: '1px solid #e3e6e8',
                background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1
              }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentManagement;
