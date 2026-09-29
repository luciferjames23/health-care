import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function DoctorsView({ onNavigate, userRole = 'Hospital Management' }) {
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('roster'); // 'roster' | 'schedules'

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

  // Schedule Modal State
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
      setError('Unable to load doctor roster from database.');
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
      setError('Please select a doctor for the schedule.');
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
      setActionSuccess('Doctor shift schedule configured successfully!');
      setTimeout(() => setActionSuccess(''), 3000);
      fetchDoctors();
    } catch (err) {
      setError(err.message || 'Failed to add schedule.');
    } finally {
      setSchedLoading(false);
    }
  };

  // Delete Doctor Schedule
  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Are you sure you want to remove this schedule slot?')) return;
    try {
      await apiService.deleteDoctorSchedule(scheduleId);
      setActionSuccess('Schedule slot deleted.');
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
      const s = search.toLowerCase();
      const matchSearch = !s || [
        d.display_name, d.first_name, d.last_name, d.specialization, d.department_name, d.email, d.phone, d.room_number
      ].some(v => v && String(v).toLowerCase().includes(s));
      return matchDept && matchSearch;
    });
  }, [doctors, departmentFilter, search]);

  const totalActive = doctors.filter(d => d.status === 'ACTIVE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span onClick={() => onNavigate && onNavigate('command')} style={{ cursor: 'pointer', color: 'oklch(0.5 0.1 200)' }}>← Back</span>
            {' · '}<span>Administration</span>{' · '}<span>Doctors & Consultants</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>Doctor Roster & Schedules</div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            Manage consultant doctors, active OPD hours, department assignments, credentials, and schedules
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search doctor, spec or dept…"
            style={{ height: '30px', width: '200px', border: '1px solid #e3e6e8', borderRadius: '6px', padding: '0 10px', fontSize: '12px', outline: 'none' }}
          />
          <button
            type="button"
            onClick={() => fetchDoctors()}
            style={{ height: '30px', padding: '0 12px', borderRadius: '6px', border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            style={{ height: '30px', padding: '0 14px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
          >
            + Add Doctor
          </button>
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div style={{ background: 'oklch(0.95 0.04 150)', border: '1px solid oklch(0.85 0.08 150)', borderRadius: '6px', padding: '8px 12px', color: 'oklch(0.35 0.12 150)', fontSize: '12px' }}>
          ✓ {actionSuccess}
        </div>
      )}
      {error && (
        <div style={{ background: 'oklch(0.96 0.03 25)', border: '1px solid oklch(0.88 0.06 25)', borderRadius: '6px', padding: '8px 12px', color: 'oklch(0.45 0.17 25)', fontSize: '12px' }}>
          ⚠ {error}
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
          👨‍⚕️ Doctor Roster ({doctors.length})
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
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#8a9096' }}>Loading doctor profiles…</div>
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
                  {filteredDoctors.map(doc => {
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
          </div>
        </>
      )}

      {/* Schedules Tab View */}
      {activeTab === 'schedules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Configure Schedule Form Card */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px', color: '#15181b' }}>
              Configure Doctor Working Shift & Time Slot
            </div>
            <form onSubmit={handleAddScheduleSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#52585e' }}>Select Doctor *</label>
                <select
                  value={schedDoctorId}
                  onChange={e => setSchedDoctorId(e.target.value)}
                  style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}
                  required
                >
                  <option value="">— Choose Doctor —</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.display_name || `Dr. ${d.first_name} ${d.last_name}`} ({d.department_name || d.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ width: '130px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#52585e' }}>Day of Week</label>
                <select
                  value={schedDay}
                  onChange={e => setSchedDay(e.target.value)}
                  style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div style={{ width: '110px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#52585e' }}>Start Time</label>
                <input
                  type="time"
                  value={schedStartTime}
                  onChange={e => setSchedStartTime(e.target.value)}
                  style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}
                  required
                />
              </div>

              <div style={{ width: '110px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#52585e' }}>End Time</label>
                <input
                  type="time"
                  value={schedEndTime}
                  onChange={e => setSchedEndTime(e.target.value)}
                  style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}
                  required
                />
              </div>

              <div style={{ width: '120px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: '#52585e' }}>Slot Duration</label>
                <select
                  value={schedSlotDuration}
                  onChange={e => setSchedSlotDuration(e.target.value)}
                  style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }}
                >
                  <option value="15">15 Mins</option>
                  <option value="20">20 Mins</option>
                  <option value="30">30 Mins</option>
                  <option value="45">45 Mins</option>
                  <option value="60">60 Mins</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={schedLoading}
                style={{ height: '32px', padding: '0 16px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
              >
                {schedLoading ? 'Saving…' : '+ Add Schedule'}
              </button>
            </form>
          </div>

          {/* Schedules Table */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
            {schedules.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#8a9096' }}>No active doctor shift schedules configured.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    <th style={{ padding: '10px 14px' }}>Doctor Name</th>
                    <th style={{ padding: '10px 14px' }}>Department</th>
                    <th style={{ padding: '10px 14px' }}>Day of Week</th>
                    <th style={{ padding: '10px 14px' }}>Shift Timing</th>
                    <th style={{ padding: '10px 14px' }}>Slot Duration</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#15181b' }}>{s.doctor_name}</td>
                      <td style={{ padding: '10px 14px', color: '#0369a1' }}>{s.department_name}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#334155' }}>{s.day_of_week}</td>
                      <td style={{ padding: '10px 14px', color: '#1e293b' }}>{s.start_time} - {s.end_time}</td>
                      <td style={{ padding: '10px 14px', color: '#52585e' }}>{s.slot_duration_minutes} mins</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)' }}>
                          ● ACTIVE
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(s.id)}
                          style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px', border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Remove Slot
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>+ Add New Doctor Roster Profile</div>
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
                  <input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="doctor@meridian.com" style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12px' }} required />
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
                <button type="submit" disabled={addLoading} style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>{addLoading ? 'Saving…' : 'Create Doctor'}</button>
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
                <button type="submit" disabled={editLoading} style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>{editLoading ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
