import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Calendar, Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, ToggleLeft, ToggleRight, UserCheck } from 'lucide-react';
import {
  fetchDoctors, fetchSchedules, createSchedule, deleteSchedule, updateScheduleStatus, format12HourTime,
  type Doctor, type DoctorSchedule
} from '../../services/dashboardApi';
import ModuleLoadingScreen from '../../components/ModuleLoadingScreen';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const DoctorSchedules: React.FC = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formDoctorId, setFormDoctorId] = useState<string>('');
  const [formDay, setFormDay] = useState<string>('MONDAY');
  const [formStartTime, setFormStartTime] = useState<string>('09:00');
  const [formEndTime, setFormEndTime] = useState<string>('17:00');
  const [formSlotDuration, setFormSlotDuration] = useState<number>(30);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, schedRes] = await Promise.all([
        fetchDoctors(),
        fetchSchedules(selectedDoctorId ? Number(selectedDoctorId) : undefined),
      ]);
      setDoctors(docRes.doctors || []);
      setSchedules(schedRes.schedules || []);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When selected Doctor filter changes, sync form default doctor
  useEffect(() => {
    if (selectedDoctorId && !formDoctorId) {
      setFormDoctorId(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDoctorId) {
      showToast('❌ Please select a Doctor from the dropdown.', 'error');
      return;
    }
    if (!formStartTime || !formEndTime) {
      showToast('❌ Please specify both Shift Start Time and Shift End Time.', 'error');
      return;
    }
    if (formStartTime >= formEndTime) {
      showToast('❌ Shift End Time must be later than Shift Start Time.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createSchedule({
        doctor_id: Number(formDoctorId),
        day_of_week: formDay,
        start_time: formStartTime,
        end_time: formEndTime,
        slot_duration_minutes: Number(formSlotDuration),
        status: 'ACTIVE',
      });
      if (res.success) {
        showToast('✓ Doctor schedule configured & persisted to database successfully!');
        loadData();
      } else {
        showToast(`❌ ${res.error || 'Failed to add schedule'}`, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Modal / Form State
  const [editingSchedule, setEditingSchedule] = useState<DoctorSchedule | null>(null);
  const [editDay, setEditDay] = useState<string>('MONDAY');
  const [editStartTime, setEditStartTime] = useState<string>('09:00');
  const [editEndTime, setEditEndTime] = useState<string>('17:00');
  const [editSlotDuration, setEditSlotDuration] = useState<number>(30);
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const openEditModal = (s: DoctorSchedule) => {
    setEditingSchedule(s);
    setEditDay(s.day_of_week || 'MONDAY');
    setEditStartTime(s.start_time || '09:00');
    setEditEndTime(s.end_time || '17:00');
    setEditSlotDuration(s.slot_duration_minutes || 30);
    setEditStatus((s.status || 'ACTIVE').toUpperCase());
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    if (!editStartTime || !editEndTime) {
      showToast('❌ Please specify both Shift Start Time and Shift End Time.', 'error');
      return;
    }
    if (editStartTime >= editEndTime) {
      showToast('❌ Shift End Time must be later than Shift Start Time.', 'error');
      return;
    }
    setEditSubmitting(true);
    try {
      const res = await updateSchedule(editingSchedule.id, {
        doctor_id: editingSchedule.doctor_id,
        day_of_week: editDay,
        start_time: editStartTime,
        end_time: editEndTime,
        slot_duration_minutes: Number(editSlotDuration),
        status: editStatus,
      });
      if (res.success) {
        showToast('✓ Doctor schedule updated successfully in database!');
        setEditingSchedule(null);
        loadData();
      } else {
        showToast(`❌ ${res.error || 'Failed to update schedule'}`, 'error');
      }
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleStatus = async (s: DoctorSchedule) => {
    const nextStatus = s.status === 'ACTIVE' || s.status === 'Active' ? 'ON_LEAVE' : 'ACTIVE';
    const ok = await updateScheduleStatus(s.id, nextStatus);
    if (ok) {
      showToast(`✓ Schedule status updated to ${nextStatus}`);
      loadData();
    } else {
      showToast('❌ Failed to update schedule status', 'error');
    }
  };

  const handleDeleteSchedule = async (schedId: number) => {
    if (!window.confirm('Are you sure you want to remove this schedule slot?')) return;
    const ok = await deleteSchedule(schedId);
    if (ok) {
      showToast('✓ Schedule slot removed from database');
      loadData();
    } else {
      showToast('❌ Failed to delete schedule', 'error');
    }
  };

  const selectedDoctorObj = doctors.find(d => String(d.id) === selectedDoctorId);

  const filteredSchedules = schedules.filter(s => {
    const matchesDoc = !selectedDoctorId || s.doctor_id === Number(selectedDoctorId);
    const q = searchQuery.toLowerCase().trim();
    const matchesQ = !q ||
      (s.doctor_name || '').toLowerCase().includes(q) ||
      (s.department_name || '').toLowerCase().includes(q) ||
      (s.day_of_week || '').toLowerCase().includes(q) ||
      (s.specialization || '').toLowerCase().includes(q);
    return matchesDoc && matchesQ;
  });

  const activeSchedulesCount = filteredSchedules.filter(s => (s.status || '').toUpperCase() === 'ACTIVE').length;
  const onLeaveSchedulesCount = filteredSchedules.filter(s => (s.status || '').toUpperCase() === 'ON_LEAVE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Consultant Schedules & OPD Timings</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
              Configure doctor working days, shift hours, and consultation slot lengths. All saved schedules directly drive Doctor Availability & WhatsApp Slot Generation.
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 12 }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {toast && (
        <div style={{
          background: toastType === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${toastType === 'success' ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: 6, padding: '10px 14px', fontSize: 13,
          color: toastType === 'success' ? '#166534' : '#991b1b',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {toastType === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {toast}
        </div>
      )}

      {/* Doctor Filter & Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Active Doctor Filter</div>
          <select
            value={selectedDoctorId}
            onChange={e => {
              setSelectedDoctorId(e.target.value);
              setFormDoctorId(e.target.value);
            }}
            style={{ width: '100%', marginTop: 6, height: 32, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, fontWeight: 600, color: '#0f172a' }}
          >
            <option value="">All Doctors ({doctors.length} Total)</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {d.display_name} ({d.department_name})
              </option>
            ))}
          </select>
        </div>

        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Schedules</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{filteredSchedules.length}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Active Shifts</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>{activeSchedulesCount}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Leave / Blocked</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706', marginTop: 2 }}>{onLeaveSchedulesCount}</div>
        </div>
      </div>

      {/* Selected Doctor Info Banner if filtered */}
      {selectedDoctorObj && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#0369a1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            👨‍⚕️ <strong>Managing Schedule for {selectedDoctorObj.display_name}</strong> · Specialization: {selectedDoctorObj.specialization} · Department: {selectedDoctorObj.department_name}
          </div>
          <button
            type="button"
            onClick={() => setSelectedDoctorId('')}
            style={{ background: '#fff', border: '1px solid #7dd3fc', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#0369a1', fontWeight: 600, cursor: 'pointer' }}
          >
            Clear Filter ✕
          </button>
        </div>
      )}

      {/* Add / Configure Schedule Form */}
      <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={16} style={{ color: '#0284c7' }} />
          <span>Add / Configure Doctor Shift Schedule Slot</span>
        </div>

        <form onSubmit={handleAddSchedule} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>
              Doctor <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={formDoctorId}
              onChange={e => setFormDoctorId(e.target.value)}
              style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
              required
            >
              <option value="">— Select Doctor —</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.display_name} ({d.department_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Day of Week</label>
            <select
              value={formDay}
              onChange={e => setFormDay(e.target.value)}
              style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
            >
              {DAYS.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Shift Start Time</label>
            <input
              type="time"
              value={formStartTime}
              onChange={e => setFormStartTime(e.target.value)}
              style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Shift End Time</label>
            <input
              type="time"
              value={formEndTime}
              onChange={e => setFormEndTime(e.target.value)}
              style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Slot Duration</label>
            <select
              value={formSlotDuration}
              onChange={e => setFormSlotDuration(Number(e.target.value))}
              style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
            >
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', height: 34, borderRadius: 6, border: 'none',
                background: '#0284c7', color: '#fff', fontWeight: 600, fontSize: 12.5,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <Plus size={16} /> {submitting ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </form>
      </div>

      {/* Edit Modal */}
      {editingSchedule && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #cbd5e1', width: '100%', maxWidth: 500, padding: 20, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                Edit Schedule for {editingSchedule.doctor_name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Day of Week</label>
                <select
                  value={editDay}
                  onChange={e => setEditDay(e.target.value)}
                  style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Shift Start Time</label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={e => setEditStartTime(e.target.value)}
                    style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Shift End Time</label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={e => setEditEndTime(e.target.value)}
                    style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Slot Duration</label>
                  <select
                    value={editSlotDuration}
                    onChange={e => setEditSlotDuration(Number(e.target.value))}
                    style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
                  >
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 4 }}>Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    style={{ width: '100%', height: 34, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12.5 }}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ON_LEAVE">ON_LEAVE</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#0284c7', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  {editSubmitting ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedules Table Card */}
      <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={16} style={{ color: '#0284c7' }} />
            <span>Configured Doctor Schedules in PostgreSQL</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              placeholder="Search doctor, dept, day..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ height: 30, padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, width: 200 }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading schedules from PostgreSQL database...</div>
        ) : filteredSchedules.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            No schedule slots found matching the criteria.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <th style={{ padding: '10px 12px' }}>Doctor Name</th>
                <th style={{ padding: '10px 12px' }}>Department</th>
                <th style={{ padding: '10px 12px' }}>Day of Week</th>
                <th style={{ padding: '10px 12px' }}>Working Hours</th>
                <th style={{ padding: '10px 12px' }}>Slot Duration</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedules.map(s => {
                const isActive = (s.status || '').toUpperCase() === 'ACTIVE';
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>
                      {s.doctor_name}
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{s.specialization}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#334155' }}>
                      {s.department_name}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontSize: 11.5, fontWeight: 700 }}>
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
                        padding: '2px 8px', borderRadius: 4, fontSize: 11.5, fontWeight: 700
                      }}>
                        ● {isActive ? 'ACTIVE' : 'ON LEAVE'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          style={{
                            padding: '3px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #bae6fd',
                            background: '#f0f9ff', color: '#0369a1', fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(s)}
                          style={{
                            padding: '3px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1',
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
                            padding: '3px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #fecaca',
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
      </div>
    </div>
  );
};

export default DoctorSchedules;
