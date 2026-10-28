import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import SearchInput from './SearchInput';
import TablePagination from './TablePagination';
import { TableSkeleton } from './ModuleLoadingScreen';
import { LoadingSpinner, ButtonSpinner } from './LoadingSpinner';
import { Clock, Calendar, AlertCircle, CheckCircle } from 'lucide-react';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export function format12HourTime(timeStr) {
  if (!timeStr) return '—';
  const str = String(timeStr).trim();
  if (!str) return '—';
  if (str.toUpperCase().includes('AM') || str.toUpperCase().includes('PM')) {
    return str;
  }
  const parts = str.split(':');
  if (parts.length < 2) return str;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].slice(0, 2);
  if (isNaN(hours)) return str;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const padHours = hours < 10 ? `0${hours}` : `${hours}`;
  return `${padHours}:${minutes} ${ampm}`;
}

export default function DoctorsView({ onNavigate, userRole = 'Hospital Management', initialTab = 'roster' }) {
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [schedPage, setSchedPage] = useState(1);
  const [schedPageSize, setSchedPageSize] = useState(25);

  useEffect(() => {
    if (search.trim()) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setDebouncedSearch(search);
        setIsSearching(false);
      }, 150);
      return () => clearTimeout(timer);
    } else {
      setDebouncedSearch('');
      setIsSearching(false);
    }
  }, [search]);
  const [actionSuccess, setActionSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab || 'roster'); // 'roster' | 'schedules'

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Add Doctor Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    first_name: '',
    last_name: '',
    specialization: '',
    qualification: 'MD, MBBS',
    experience_years: '5',
    phone: '',
    email: '',
    consultation_fee: '500',
    department_id: '',
    username: '',
    password: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  // Edit Doctor Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    specialization: '',
    qualification: '',
    experience_years: '',
    phone: '',
    email: '',
    consultation_fee: '',
    department_id: '',
    room_number: '',
    username: '',
    password: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  const [schedDoctorFilter, setSchedDoctorFilter] = useState('');
  const [schedDayFilter, setSchedDayFilter] = useState('');
  const [schedDoctorId, setSchedDoctorId] = useState('');
  const [schedDay, setSchedDay] = useState('MONDAY');
  const [schedStartTime, setSchedStartTime] = useState('09:00');
  const [schedEndTime, setSchedEndTime] = useState('17:00');
  const [schedSlotDuration, setSchedSlotDuration] = useState('30');
  const [schedLoading, setSchedLoading] = useState(false);

  const fetchDoctors = async () => {
    setLoading(true);
    setError(null);
    try {
      const [docRes, deptRes, schedRes] = await Promise.all([
        apiService.getDashboardDoctors(),
        apiService.getDashboardDepartments().catch(() => ({ departments: [] })),
        apiService.getDoctorSchedules().catch(() => ({ schedules: [] }))
      ]);

      if (docRes && Array.isArray(docRes)) {
        setDoctors(docRes);
      } else if (docRes?.doctors && Array.isArray(docRes.doctors)) {
        setDoctors(docRes.doctors);
      } else {
        setDoctors([]);
      }

      if (deptRes?.departments) {
        setDepartmentsList(deptRes.departments);
      }
      if (schedRes?.schedules) {
        setSchedules(schedRes.schedules);
      }
    } catch (err) {
      console.error('Failed to load doctors data:', err);
      setError('Unable to load doctor  from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleToggleStatus = async (doctorId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? false : true;
    try {
      await apiService.toggleDoctorStatus(doctorId, nextStatus);
      setActionSuccess(`Doctor status updated successfully.`);
      setTimeout(() => setActionSuccess(''), 3000);
      fetchDoctors();
    } catch (err) {
      setError(err.message || 'Failed to update doctor status.');
    }
  };

  // Create Doctor submit
  const handleAddDoctorSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.first_name || !addForm.last_name || !addForm.phone || !addForm.email || !addForm.department_id || !addForm.username || !addForm.password) {
      setError('Please fill in all required fields for adding a doctor.');
      return;
    }
    setAddLoading(true);
    setError(null);
    try {
      const payload = {
        first_name: addForm.first_name.trim(),
        last_name: addForm.last_name.trim(),
        specialization: addForm.specialization.trim() || 'General Medicine',
        qualification: addForm.qualification.trim() || 'MD',
        experience_years: parseInt(addForm.experience_years) || 1,
        phone: addForm.phone.trim(),
        email: addForm.email.trim(),
        consultation_fee: parseFloat(addForm.consultation_fee) || 500,
        department_id: parseInt(addForm.department_id),
        username: addForm.username.trim(),
        password: addForm.password
      };
      await apiService.createDoctor(payload);
      setActionSuccess(`Doctor Dr. ${addForm.first_name} ${addForm.last_name} created successfully!`);
      setTimeout(() => setActionSuccess(''), 3000);
      setShowAddModal(false);
      setAddForm({
        first_name: '', last_name: '', specialization: '', qualification: 'MD, MBBS',
        experience_years: '5', phone: '', email: '', consultation_fee: '500', department_id: '', username: '', password: ''
      });
      fetchDoctors();
    } catch (err) {
      setError(err.message || 'Failed to create doctor.');
    } finally {
      setAddLoading(false);
    }
  };

  // Open Edit Doctor modal
  const openEditDoctor = (doc) => {
    setEditingDoctor(doc);
    setEditForm({
      first_name: doc.first_name || '',
      last_name: doc.last_name || '',
      specialization: doc.specialization || '',
      qualification: doc.qualification || '',
      experience_years: doc.experience_years ? String(doc.experience_years) : '5',
      phone: doc.phone || '',
      email: doc.email || '',
      consultation_fee: doc.consultation_fee ? String(doc.consultation_fee) : '500',
      department_id: doc.department_id ? String(doc.department_id) : '',
      room_number: doc.room_number || '',
      username: doc.username || '',
      password: ''
    });
    setShowEditModal(true);
  };

  // Edit Doctor submit
  const handleEditDoctorSubmit = async (e) => {
    e.preventDefault();
    if (!editingDoctor) return;
    setEditLoading(true);
    setError(null);
    try {
      const payload = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        specialization: editForm.specialization.trim(),
        qualification: editForm.qualification.trim(),
        experience_years: editForm.experience_years ? parseInt(editForm.experience_years) : undefined,
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
        consultation_fee: editForm.consultation_fee ? parseFloat(editForm.consultation_fee) : undefined,
        department_id: editForm.department_id ? parseInt(editForm.department_id) : undefined,
        room_number: editForm.room_number.trim(),
        username: editForm.username.trim() || undefined,
        password: editForm.password ? editForm.password : undefined
      };
      await apiService.updateDoctor(editingDoctor.id, payload);
      setActionSuccess(`Doctor Dr. ${editForm.first_name} ${editForm.last_name} updated successfully!`);
      setTimeout(() => setActionSuccess(''), 3000);
      setShowEditModal(false);
      setEditingDoctor(null);
      fetchDoctors();
    } catch (err) {
      setError(err.message || 'Failed to update doctor.');
    } finally {
      setEditLoading(false);
    }
  };

  // Add Doctor Schedule submit
  const handleAddScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!schedDoctorId) {
      setError('Please select a Doctor from the dropdown.');
      return;
    }
    if (!schedStartTime || !schedEndTime) {
      setError('Please specify both Shift Start Time and Shift End Time.');
      return;
    }
    if (schedStartTime >= schedEndTime) {
      setError('Shift End Time must be later than Shift Start Time.');
      return;
    }
    setSchedLoading(true);
    setError(null);
    try {
      await apiService.createDoctorSchedule({
        doctor_id: parseInt(schedDoctorId),
        day_of_week: schedDay,
        start_time: schedStartTime,
        end_time: schedEndTime,
        slot_duration_minutes: parseInt(schedSlotDuration) || 30,
        status: 'ACTIVE'
      });
      setActionSuccess('✓ Doctor shift schedule configured & persisted to database successfully!');
      setTimeout(() => setActionSuccess(''), 4000);
      fetchDoctors();
    } catch (err) {
      setError(err.message || 'Failed to add schedule.');
    } finally {
      setSchedLoading(false);
    }
  };

  // Edit Schedule Modal State
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editDay, setEditDay] = useState('MONDAY');
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('17:00');
  const [editSlotDuration, setEditSlotDuration] = useState('30');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editSchedLoading, setEditSchedLoading] = useState(false);

  const openEditSchedule = (s) => {
    setEditingSchedule(s);
    setEditDay(s.day_of_week || 'MONDAY');
    setEditStartTime(s.start_time || '09:00');
    setEditEndTime(s.end_time || '17:00');
    setEditSlotDuration(String(s.slot_duration_minutes || 30));
    setEditStatus((s.status || 'ACTIVE').toUpperCase());
  };

  const handleUpdateScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!editingSchedule) return;
    if (!editStartTime || !editEndTime) {
      setError('Please specify both Shift Start Time and Shift End Time.');
      return;
    }
    if (editStartTime >= editEndTime) {
      setError('Shift End Time must be later than Shift Start Time.');
      return;
    }
    setEditSchedLoading(true);
    setError(null);
    try {
      await apiService.updateDoctorSchedule(editingSchedule.id, {
        doctor_id: editingSchedule.doctor_id,
        day_of_week: editDay,
        start_time: editStartTime,
        end_time: editEndTime,
        slot_duration_minutes: parseInt(editSlotDuration) || 30,
        status: editStatus
      });
      setActionSuccess(`✓ Schedule for ${editingSchedule.doctor_name} updated successfully!`);
      setTimeout(() => setActionSuccess(''), 4000);
      setEditingSchedule(null);
      fetchDoctors();
    } catch (err) {
      setError(err.message || 'Failed to update schedule.');
    } finally {
      setEditSchedLoading(false);
    }
  };

  const handleToggleScheduleStatus = async (s) => {
    const nextStatus = (s.status || '').toUpperCase() === 'ACTIVE' ? 'ON_LEAVE' : 'ACTIVE';
    try {
      await apiService.updateDoctorScheduleStatus(s.id, nextStatus);
      setActionSuccess(`✓ Schedule status updated to ${nextStatus}.`);
      setTimeout(() => setActionSuccess(''), 3000);
      fetchDoctors();
    } catch (err) {
      setError(err.message || 'Failed to update schedule status.');
    }
  };

  const handleSelectDoctorFilter = (docId) => {
    setSchedDoctorFilter(docId);
    if (docId) {
      setSchedDoctorId(docId);
    }
  };

  // Delete Doctor Schedule
  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to remove this schedule slot?')) return;
    try {
      await apiService.deleteDoctorSchedule(scheduleId);
      setActionSuccess('✓ Schedule slot removed from database.');
      setTimeout(() => setActionSuccess(''), 3000);
      fetchDoctors();
    } catch (err) {
      setError(err.message || 'Failed to delete schedule slot.');
    }
  };

  const departments = useMemo(() => {
    const set = new Set(doctors.map(d => d.department_name || d.department).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter(d => {
      const matchDept = departmentFilter === 'All' || (d.department_name || d.department) === departmentFilter;
      const s = debouncedSearch.toLowerCase();
      const matchSearch = !s || [
        d.display_name, d.first_name, d.last_name, d.specialization, d.department_name, d.email, d.phone, d.room_number
      ].some(v => v && String(v).toLowerCase().includes(s));
      return matchDept && matchSearch;
    });
  }, [doctors, departmentFilter, debouncedSearch]);

  const paginatedDoctors = useMemo(() => {
    return filteredDoctors.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredDoctors, page, pageSize]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const matchDoc = !schedDoctorFilter || String(s.doctor_id) === String(schedDoctorFilter);
      const matchDept = departmentFilter === 'All' || (s.department_name && s.department_name.toLowerCase() === departmentFilter.toLowerCase());
      const matchDay = !schedDayFilter || (s.day_of_week && s.day_of_week.toUpperCase() === schedDayFilter.toUpperCase());
      const q = (debouncedSearch || '').toLowerCase().trim();
      const matchSearch = !q || [
        s.doctor_name,
        s.department_name,
        s.day_of_week,
        s.specialization,
        s.start_time,
        s.end_time
      ].some(v => v && String(v).toLowerCase().includes(q));
      return matchDoc && matchDept && matchDay && matchSearch;
    });
  }, [schedules, schedDoctorFilter, departmentFilter, schedDayFilter, debouncedSearch]);

  const paginatedSchedules = useMemo(() => {
    return filteredSchedules.slice((schedPage - 1) * schedPageSize, schedPage * schedPageSize);
  }, [filteredSchedules, schedPage, schedPageSize]);

  useEffect(() => {
    setSchedPage(1);
  }, [schedDoctorFilter, departmentFilter, schedDayFilter, debouncedSearch]);

  const totalActive = doctors.filter(d => d.status === 'ACTIVE').length;

  const activeDoctors = useMemo(() => {
    return doctors.filter(d => (d.status || '').toUpperCase() === 'ACTIVE');
  }, [doctors]);

  const selectedDoctorObj = useMemo(() => {
    if (!schedDoctorFilter) return null;
    return activeDoctors.find(d => String(d.id) === String(schedDoctorFilter)) ||
      doctors.find(d => String(d.id) === String(schedDoctorFilter));
  }, [activeDoctors, doctors, schedDoctorFilter]);

  const activeSchedulesCount = useMemo(() => {
    return filteredSchedules.filter(s => (s.status || '').toUpperCase() === 'ACTIVE').length;
  }, [filteredSchedules]);

  const onLeaveSchedulesCount = useMemo(() => {
    return filteredSchedules.filter(s => (s.status || '').toUpperCase() === 'ON_LEAVE').length;
  }, [filteredSchedules]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span onClick={() => onNavigate && onNavigate('command')} style={{ cursor: 'pointer', color: 'oklch(0.5 0.1 200)' }}>← Back</span>
            {' · '}<span>Administration</span>{' · '}<span>Doctor Directory</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>Doctor Directory</div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            Manage consultant doctors, active OPD hours, department assignments, credentials, and shift schedules
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchInput
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder={activeTab === 'roster' ? "Search doctor, spec or dept…" : "Search schedule doctor, dept, day…"}
            loading={isSearching || loading}
            width="220px"
            accentColor="oklch(0.5 0.1 200)"
          />
          <button
            type="button"
            onClick={() => fetchDoctors()}
            style={{ height: '30px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            Refresh
          </button>
          {activeTab === 'roster' && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              style={{ height: '30px', padding: '0 14px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
            >
              + Add Doctor
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div style={{ background: 'oklch(0.95 0.04 150)', border: '1px solid oklch(0.85 0.08 150)', borderRadius: '6px', padding: '8px 12px', color: 'oklch(0.35 0.12 150)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={15} /> {actionSuccess}
        </div>
      )}
      {error && (
        <div style={{ background: 'oklch(0.96 0.03 25)', border: '1px solid oklch(0.88 0.06 25)', borderRadius: '6px', padding: '8px 12px', color: 'oklch(0.45 0.17 25)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Mode Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e3e6e8', paddingBottom: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          style={{
            padding: '6px 14px', borderRadius: '6px', border: 'none',
            background: activeTab === 'roster' ? '#15181b' : 'transparent',
            color: activeTab === 'roster' ? '#fff' : '#52585e',
            fontWeight: 600, fontSize: '12.5px', cursor: 'pointer'
          }}
        >
          👨‍⚕️ Doctor  ({doctors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          style={{
            padding: '6px 14px', borderRadius: '6px', border: 'none',
            background: activeTab === 'schedules' ? '#15181b' : 'transparent',
            color: activeTab === 'schedules' ? '#fff' : '#52585e',
            fontWeight: 600, fontSize: '12.5px', cursor: 'pointer'
          }}
        >
          📅 Doctor Shift Schedules ({schedules.length})
        </button>
      </div>

      {activeTab === 'roster' && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', flex: 1, minWidth: '130px' }}>
              <div style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Doctors</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#15181b', marginTop: '2px' }}>{doctors.length}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', flex: 1, minWidth: '130px' }}>
              <div style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Active On Duty</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.4 0.12 150)', marginTop: '2px' }}>{totalActive}</div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', flex: 1, minWidth: '130px' }}>
              <div style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Departments</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.5 0.1 200)', marginTop: '2px' }}>{departments.length - 1}</div>
            </div>
          </div>

          {/* Department Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {departments.map(dept => (
              <button
                key={dept}
                type="button"
                onClick={() => setDepartmentFilter(dept)}
                style={{
                  height: '28px', padding: '0 14px', borderRadius: '14px', border: '1px solid #e3e6e8',
                  background: departmentFilter === dept ? '#15181b' : '#fff',
                  color: departmentFilter === dept ? '#fff' : '#52585e',
                  fontWeight: departmentFilter === dept ? 600 : 400, fontSize: '12px', cursor: 'pointer'
                }}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Doctor Cards / Table */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto', position: 'relative' }}>
            {/* Shimmer loading progress bar */}
            {(loading || isSearching) && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #0284c7, #38bdf8, #7dd3fc, #0284c7)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.2s infinite linear',
                  zIndex: 10
                }}
              />
            )}

            {/* Searching overlay */}
            {(loading || isSearching) && filteredDoctors.length > 0 && (
              <LoadingSpinner
                overlay
                size="md"
                color="oklch(0.5 0.1 200)"
                text="Filtering doctors..."
              />
            )}
            {loading ? (
              <TableSkeleton rows={6} columns={7} />
            ) : filteredDoctors.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#8a9096' }}>
                <div style={{ fontWeight: 600, color: '#52585e', marginBottom: '4px' }}>No doctors found</div>
                No doctor records match the selected filter.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <th style={{ padding: '10px 14px' }}>Doctor Name</th>
                    <th style={{ padding: '10px 14px' }}>Department</th>
                    <th style={{ padding: '10px 14px' }}>Specialization</th>
                    <th style={{ padding: '10px 14px' }}>Room / OPD</th>
                    <th style={{ padding: '10px 14px' }}>Fee</th>
                    <th style={{ padding: '10px 14px' }}>Contact</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDoctors.map(doc => {
                    const isActive = doc.status === 'ACTIVE';
                    return (
                      <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>
                          {doc.display_name || `Dr. ${doc.first_name || ''} ${doc.last_name || ''}`.trim()}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#0369a1', fontWeight: 500 }}>
                          {doc.department_name || doc.department || 'General'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#52585e' }}>
                          {doc.specialization || 'Consultant'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#52585e' }}>
                          {doc.room_number || 'OPD Desk'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#52585e', fontWeight: 500 }}>
                          ₹{doc.consultation_fee || 500}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#52585e', fontSize: '11px' }}>
                          <div>{doc.phone || '—'}</div>
                          <div style={{ color: '#8a9096' }}>{doc.email || ''}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                            background: isActive ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.03 25)',
                            color: isActive ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.17 25)'
                          }}>
                            ● {isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => openEditDoctor(doc)}
                              style={{
                                padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #e3e6e8',
                                background: '#fff', color: '#15181b', fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              Edit Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(doc.id, doc.status)}
                              style={{
                                padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #e3e6e8',
                                background: isActive ? '#fff' : 'oklch(0.5 0.1 200)',
                                color: isActive ? '#52585e' : '#fff', fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              {isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <TablePagination
              total={filteredDoctors.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
              label="doctors"
            />
          </div>
        </>
      )}

      {/* Schedules Tab View */}
      {activeTab === 'schedules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Doctor Filter & Summary Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Active Doctor Filter</div>
              <select
                value={schedDoctorFilter}
                onChange={e => handleSelectDoctorFilter(e.target.value)}
                style={{ width: '100%', marginTop: '6px', height: '32px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}
              >
                <option value="">All Doctors ({activeDoctors.length} Total)</option>
                {activeDoctors.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.display_name || `Dr. ${d.first_name} ${d.last_name}`} ({d.department_name || d.department || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Schedules</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{filteredSchedules.length}</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Active Shifts</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>{activeSchedulesCount}</div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Leave / Blocked</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', marginTop: '2px' }}>{onLeaveSchedulesCount}</div>
            </div>
          </div>

          {/* Selected Doctor Info Banner if filtered */}
          {selectedDoctorObj && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                👨‍⚕️ <strong>Managing Shift Schedules for {selectedDoctorObj.display_name || `Dr. ${selectedDoctorObj.first_name} ${selectedDoctorObj.last_name}`}</strong> · Specialization: {selectedDoctorObj.specialization || 'Consultant'} · Department: {selectedDoctorObj.department_name || selectedDoctorObj.department || 'General Medicine'}
              </div>
              <button
                type="button"
                onClick={() => handleSelectDoctorFilter('')}
                style={{ background: '#fff', border: '1px solid #7dd3fc', borderRadius: '4px', padding: '3px 10px', fontSize: '11.5px', color: '#0369a1', fontWeight: 600, cursor: 'pointer' }}
              >
                Clear Filter ✕
              </button>
            </div>
          )}

          {/* Add / Configure Schedule Form Card */}
          <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} style={{ color: '#0284c7' }} />
              <span>Add / Configure Doctor Shift Schedule Slot</span>
            </div>
            <form onSubmit={handleAddScheduleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Doctor <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={schedDoctorId}
                  onChange={e => setSchedDoctorId(e.target.value)}
                  style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                  required
                >
                  <option value="">— Select Doctor —</option>
                  {activeDoctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.display_name || `Dr. ${d.first_name} ${d.last_name}`} ({d.department_name || d.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Day of Week</label>
                <select
                  value={schedDay}
                  onChange={e => setSchedDay(e.target.value)}
                  style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Shift Start Time</label>
                <input
                  type="time"
                  value={schedStartTime}
                  onChange={e => setSchedStartTime(e.target.value)}
                  style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Shift End Time</label>
                <input
                  type="time"
                  value={schedEndTime}
                  onChange={e => setSchedEndTime(e.target.value)}
                  style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Slot Duration</label>
                <select
                  value={schedSlotDuration}
                  onChange={e => setSchedSlotDuration(e.target.value)}
                  style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                >
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={schedLoading}
                  style={{
                    width: '100%', height: '34px', borderRadius: '6px', border: 'none',
                    background: '#16a34a', color: '#fff', fontWeight: 600, fontSize: '12.5px',
                    cursor: schedLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    transition: 'background-color 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={e => { if (!schedLoading) e.currentTarget.style.backgroundColor = '#15803d'; }}
                  onMouseLeave={e => { if (!schedLoading) e.currentTarget.style.backgroundColor = '#16a34a'; }}
                >
                  <ButtonSpinner loading={schedLoading} />
                  {schedLoading ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>

          {/* Schedules Table Card with Filter Bar */}
          <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} style={{ color: '#0284c7' }} />
                <span>Configured Doctor Shift Schedules in Database</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '170px' }}>
                  <select
                    value={schedDoctorFilter}
                    onChange={e => handleSelectDoctorFilter(e.target.value)}
                    style={{ height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px', fontWeight: 500, color: '#15181b', background: '#fff', width: '100%' }}
                  >
                    <option value="">All Doctors ({activeDoctors.length} Total)</option>
                    {activeDoctors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.display_name || `Dr. ${d.first_name} ${d.last_name}`} ({d.department_name || d.department || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: '120px' }}>
                  <select
                    value={schedDayFilter}
                    onChange={e => setSchedDayFilter(e.target.value)}
                    style={{ height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px', fontWeight: 500, color: '#15181b', background: '#fff', width: '100%' }}
                  >
                    <option value="">All Days</option>
                    {DAYS.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: '130px' }}>
                  <select
                    value={departmentFilter}
                    onChange={e => setDepartmentFilter(e.target.value)}
                    style={{ height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px', fontWeight: 500, color: '#15181b', background: '#fff', width: '100%' }}
                  >
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
                    ))}
                  </select>
                </div>

                {(schedDoctorFilter || schedDayFilter || debouncedSearch || departmentFilter !== 'All') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSchedDoctorFilter('');
                      setSchedDayFilter('');
                      setDepartmentFilter('All');
                      setSearch('');
                    }}
                    style={{ height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Reset Filters ✕
                  </button>
                )}

                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginLeft: '4px' }}>
                  Showing {filteredSchedules.length} of {schedules.length} shift slots
                </span>
              </div>
            </div>

            {loading ? (
              <TableSkeleton rows={6} columns={7} />
            ) : filteredSchedules.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                No doctor shift schedules found matching the selected criteria.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <th style={{ padding: '10px 12px' }}>Doctor Name</th>
                    <th style={{ padding: '10px 12px' }}>Department</th>
                    <th style={{ padding: '10px 12px' }}>Day of Week</th>
                    <th style={{ padding: '10px 12px' }}>Shift Timing</th>
                    <th style={{ padding: '10px 12px' }}>Slot Duration</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSchedules.map(s => {
                    const isActive = (s.status || '').toUpperCase() === 'ACTIVE';
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>
                          {s.doctor_name}
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>{s.specialization}</div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155' }}>
                          {s.department_name}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700 }}>
                            {s.day_of_week}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, fontFamily: 'monospace, sans-serif', color: '#0f172a' }}>
                          {format12HourTime(s.start_time)} – {format12HourTime(s.end_time)}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                          {s.slot_duration_minutes} mins
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            background: isActive ? '#dcfce7' : '#fef3c7',
                            color: isActive ? '#15803d' : '#b45309',
                            padding: '2px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700
                          }}>
                            ● {isActive ? 'ACTIVE' : 'ON LEAVE'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => openEditSchedule(s)}
                              style={{
                                padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #bae6fd',
                                background: '#f0f9ff', color: '#0369a1', fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleScheduleStatus(s)}
                              style={{
                                padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1',
                                background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer'
                              }}
                              title={isActive ? 'Mark On Leave (Block Slots)' : 'Set Active'}
                            >
                              {isActive ? 'Mark Leave' : 'Set Active'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSchedule(s.id)}
                              style={{
                                padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #fecaca',
                                background: '#fef2f2', color: '#991b1b', fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <TablePagination
              total={filteredSchedules.length}
              page={schedPage}
              pageSize={schedPageSize}
              onPageChange={setSchedPage}
              onPageSizeChange={(sz) => { setSchedPageSize(sz); setSchedPage(1); }}
              label="schedules"
            />
          </div>
        </div>
      )}

      {/* Edit Doctor Schedule Modal */}
      {editingSchedule && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '500px', padding: '20px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Edit Schedule for {editingSchedule.doctor_name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateScheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Day of Week</label>
                <select
                  value={editDay}
                  onChange={e => setEditDay(e.target.value)}
                  style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Shift Start Time</label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={e => setEditStartTime(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Shift End Time</label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={e => setEditEndTime(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Slot Duration</label>
                  <select
                    value={editSlotDuration}
                    onChange={e => setEditSlotDuration(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                  >
                    <option value="10">10 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="20">20 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    style={{ width: '100%', height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSchedLoading}
                  style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ButtonSpinner loading={editSchedLoading} />
                  {editSchedLoading ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>+ Add New Doctor  Profile</div>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#8a9096' }}>✕</button>
            </div>
            <form onSubmit={handleAddDoctorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>First Name *</label>
                  <input value={addForm.first_name} onChange={e => setAddForm({ ...addForm, first_name: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Last Name *</label>
                  <input value={addForm.last_name} onChange={e => setAddForm({ ...addForm, last_name: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Phone Number (10 digits) *</label>
                  <input value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="9876543210" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Email Address *</label>
                  <input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="doctor@hospital.com" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Department *</label>
                  <select value={addForm.department_id} onChange={e => setAddForm({ ...addForm, department_id: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required>
                    <option value="">— Select Department —</option>
                    {departmentsList.map(d => (
                      <option key={d.id} value={d.id}>{d.department_name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Specialization *</label>
                  <input value={addForm.specialization} onChange={e => setAddForm({ ...addForm, specialization: e.target.value })} placeholder="e.g. Cardiology" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Fee (₹)</label>
                  <input type="number" value={addForm.consultation_fee} onChange={e => setAddForm({ ...addForm, consultation_fee: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Qualification</label>
                  <input value={addForm.qualification} onChange={e => setAddForm({ ...addForm, qualification: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>Login Username *</label>
                  <input value={addForm.username} onChange={e => setAddForm({ ...addForm, username: e.target.value })} placeholder="e.g. dr.arjun" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>Login Password *</label>
                  <input type="password" value={addForm.password} onChange={e => setAddForm({ ...addForm, password: e.target.value })} placeholder="Min 6 chars" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                <button type="submit" disabled={addLoading} style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ButtonSpinner loading={addLoading} />
                  {addLoading ? 'Saving…' : 'Create Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Doctor Modal */}
      {showEditModal && editingDoctor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>Edit Doctor Profile & Credentials</div>
              <button type="button" onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#8a9096' }}>✕</button>
            </div>
            <form onSubmit={handleEditDoctorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>First Name</label>
                  <input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Last Name</label>
                  <input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Specialization</label>
                  <input value={editForm.specialization} onChange={e => setEditForm({ ...editForm, specialization: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Room / OPD</label>
                  <input value={editForm.room_number} onChange={e => setEditForm({ ...editForm, room_number: e.target.value })} placeholder="OPD 102" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Phone</label>
                  <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#52585e' }}>Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>Update Username</label>
                  <input value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>New Password (Optional)</label>
                  <input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="Leave blank to keep unchanged" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                <button type="submit" disabled={editLoading} style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ButtonSpinner loading={editLoading} />
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
