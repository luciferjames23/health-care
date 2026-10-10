import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchDoctorQueueToday,
  callNextPatient,
  startConsultation,
  completeConsultation,
  checkInPatient,
  markNoShow,
  cancelQueueEntry,
  fetchAppointments,
  fetchDoctors,
  createQueueSession,
  pauseQueueSession,
  resumeQueueSession,
  format12HourTime,
  type Appointment,
  type Doctor
} from '../../services/dashboardApi';
import {
  Users, Clock, CheckCircle2, UserCheck, Play, PhoneCall,
  RefreshCw, AlertCircle, Calendar, CheckSquare, Pause, Stethoscope
} from 'lucide-react';

interface TodaysQueueViewProps {
  onNavigate?: (page: string, patient?: any) => void;
  onSelectPatient?: (patient: any) => void;
}

const TodaysQueueView: React.FC<TodaysQueueViewProps> = ({ onNavigate, onSelectPatient }) => {
  const { user: authContextUser } = useAuth();
  const currentUser = authContextUser || (() => {
    try {
      return JSON.parse(sessionStorage.getItem('hx_auth') || sessionStorage.getItem('meridian_user') || 'null');
    } catch {
      return null;
    }
  })();

  const userRole = String(currentUser?.role || authContextUser?.role || '').toUpperCase();
  const isDoctorRole = userRole === 'DOCTOR' || Boolean(currentUser?.doctorId || currentUser?.doctor_id);
  const isAdmin = ['ADMIN', 'HOSPITAL MANAGEMENT', 'SYSTEM ADMIN', 'QUALITY'].includes(userRole);
  const showDoctorDropdown = isAdmin && !isDoctorRole;

  const initialDoctorId = currentUser?.doctorId
    ? Number(currentUser.doctorId)
    : currentUser?.doctor_id
    ? Number(currentUser.doctor_id)
    : undefined;

  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | undefined>(initialDoctorId);
  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [pausingSession, setPausingSession] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [queueData, setQueueData] = useState<any>(null);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  const todayDateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  const todayYMD = new Date().toISOString().split('T')[0];

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 5000);
  };

  // Fetch doctors list for admin doctor selector dropdown ONLY when admin is viewing
  useEffect(() => {
    if (!showDoctorDropdown) return;
    async function loadDoctors() {
      try {
        const res = await fetchDoctors({ per_page: 50 });
        if (res?.doctors?.length > 0) {
          setDoctorsList(res.doctors);
          if (!selectedDoctorId) {
            setSelectedDoctorId(res.doctors[0].id);
          }
        }
      } catch (err) {}
    }
    loadDoctors();
  }, [showDoctorDropdown]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const targetDocId = isDoctorRole ? initialDoctorId : (selectedDoctorId || initialDoctorId);
      const [qRes, apptRes] = await Promise.all([
        fetchDoctorQueueToday(targetDocId),
        fetchAppointments({
          date_from: todayYMD,
          date_to: todayYMD,
          doctor_id: targetDocId,
          per_page: 100
        })
      ]);

      if (qRes?.success) {
        setQueueData(qRes.data);
      }
      if (apptRes?.appointments) {
        setTodayAppointments(apptRes.appointments);
      }
      setLastUpdated(new Date());
    } catch (err: any) {
      showFeedback('error', 'Failed to refresh queue data.');
    } finally {
      setLoading(false);
    }
  }, [isDoctorRole, selectedDoctorId, initialDoctorId, todayYMD]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle Start OPD Queue Session
  const handleStartQueueSession = async () => {
    const docInfo = queueData?.doctor_info;
    const docId = selectedDoctorId || docInfo?.doctor_id || initialDoctorId;
    if (!docId) {
      showFeedback('error', 'Please select a doctor to start OPD queue.');
      return;
    }
    setStartingSession(true);
    try {
      const res = await createQueueSession(docId, docInfo?.department_id || 1, 'OPD Room 101');
      if (res.success) {
        showFeedback('success', `✅ OPD Queue Session started for ${docInfo?.doctor_name || 'Doctor'}.`);
        loadData();
      } else {
        showFeedback('error', `❌ ${res.error || 'Failed to start queue session.'}`);
      }
    } finally {
      setStartingSession(false);
    }
  };

  // Handle Pause / Resume Queue
  const handlePauseResumeQueue = async () => {
    const session = queueData?.session;
    if (!session) return;
    setPausingSession(true);
    try {
      if (session.status === 'ACTIVE') {
        const res = await pauseQueueSession(session.session_id, 'Doctor break / emergency');
        if (res.success) {
          showFeedback('success', '⏸️ Queue session paused. Waiting patients notified via WhatsApp.');
          loadData();
        } else {
          showFeedback('error', `❌ ${res.error || 'Failed to pause queue.'}`);
        }
      } else if (session.status === 'PAUSED') {
        const res = await resumeQueueSession(session.session_id);
        if (res.success) {
          showFeedback('success', '▶️ Queue session resumed. Positions updated.');
          loadData();
        } else {
          showFeedback('error', `❌ ${res.error || 'Failed to resume queue.'}`);
        }
      }
    } finally {
      setPausingSession(false);
    }
  };

  // Handle Queue Actions
  const handleCheckIn = async (appointmentId: number) => {
    setCheckingInId(appointmentId);
    try {
      const res = await checkInPatient(appointmentId);
      if (res.success) {
        showFeedback('success', `✅ Patient checked in. Token #${res.data?.token_number} assigned. WhatsApp sent.`);
        loadData();
      } else {
        showFeedback('error', `❌ ${res.error || 'Check-in failed.'}`);
      }
    } finally {
      setCheckingInId(null);
    }
  };

  const handleCallNext = async (sessionId: number) => {
    const res = await callNextPatient(sessionId);
    if (res.success) {
      showFeedback('success', `🚨 ${res.message || 'Next patient called. WhatsApp sent.'}`);
      loadData();
    } else {
      showFeedback('error', `❌ ${res.error || 'Failed to call next patient.'}`);
    }
  };

  const handleStartConsultation = async (entryId: number) => {
    const res = await startConsultation(entryId);
    if (res.success) {
      showFeedback('success', `👨‍⚕️ ${res.message || 'Consultation started.'}`);
      loadData();
    } else {
      showFeedback('error', `❌ ${res.error || 'Failed to start consultation.'}`);
    }
  };

  const handleCompleteConsultation = async (entryId: number) => {
    const res = await completeConsultation(entryId);
    if (res.success) {
      showFeedback('success', `🎉 ${res.message || 'Consultation completed. Next patient notified.'}`);
      loadData();
    } else {
      showFeedback('error', `❌ ${res.error || 'Failed to complete consultation.'}`);
    }
  };

  const handleMarkNoShow = async (entryId: number) => {
    if (!window.confirm('Are you sure you want to mark this patient as No Show?')) return;
    const res = await markNoShow(entryId);
    if (res.success) {
      showFeedback('success', `⚠️ Patient marked as No Show.`);
      loadData();
    } else {
      showFeedback('error', `❌ ${res.error || 'Failed to mark No Show.'}`);
    }
  };

  // Queue Session Derived Stats
  const docInfo = queueData?.doctor_info;
  const session = queueData?.session;
  const entries: any[] = session?.entries || [];

  const activeDoctorName = docInfo?.doctor_name || currentUser?.name || 'Dr. Immanuel S';
  const doctorDeptName = docInfo?.department_name || currentUser?.dept || 'General Medicine';
  const queueStatus = session?.status || 'NOT STARTED';

  const totalCheckedIn = entries.length;
  const waitingEntries = entries.filter((e: any) => e.queue_status === 'WAITING' || e.queue_status === 'NEXT');
  const calledEntry = entries.find((e: any) => e.queue_status === 'CALLED');
  const inConsultationEntry = entries.find((e: any) => e.queue_status === 'IN_CONSULTATION');
  const completedEntries = entries.filter((e: any) => e.queue_status === 'COMPLETED');
  const noShowEntries = entries.filter((e: any) => e.queue_status === 'NO_SHOW');
  const cancelledEntries = entries.filter((e: any) => e.queue_status === 'CANCELLED');

  const currentPatient = inConsultationEntry || calledEntry;
  const nextPatient = waitingEntries.length > 0 ? waitingEntries[0] : null;

  return (
    <div style={{ padding: '24px 28px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users style={{ color: '#2563eb' }} size={28} />
            Today's Queue
          </h1>
          <div style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>👨‍⚕️ <strong>{activeDoctorName}</strong></span>
            <span>🏥 Department: <strong>{doctorDeptName}</strong></span>
            <span>📅 Date: <strong>{todayDateStr}</strong></span>
          </div>
        </div>

        {/* Doctor Selector Dropdown & Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {showDoctorDropdown && doctorsList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
              <Stethoscope size={16} style={{ color: '#2563eb' }} />
              <select
                value={selectedDoctorId || ''}
                onChange={(e) => setSelectedDoctorId(Number(e.target.value))}
                style={{ border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 600, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
              >
                {doctorsList.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.display_name || doc.first_name || `Doctor #${doc.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(!session || queueStatus === 'NOT STARTED') && (
            <button
              onClick={handleStartQueueSession}
              disabled={startingSession}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px',
                border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700,
                cursor: 'pointer', fontSize: '13px', boxShadow: '0 2px 4px rgba(22,163,74,0.2)'
              }}
            >
              <Play size={14} />
              {startingSession ? 'Starting...' : 'Start OPD Queue'}
            </button>
          )}

          {session && (
            <button
              onClick={handlePauseResumeQueue}
              disabled={pausingSession}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px',
                border: 'none', background: queueStatus === 'ACTIVE' ? '#d97706' : '#2563eb', color: '#fff', fontWeight: 700,
                cursor: 'pointer', fontSize: '13px'
              }}
            >
              <Pause size={14} />
              {pausingSession ? 'Processing...' : queueStatus === 'ACTIVE' ? 'Pause Queue' : 'Resume Queue'}
            </button>
          )}
        </div>
      </div>

      {/* ── ACTION FEEDBACK NOTIFICATION ── */}
      {actionMsg && (
        <div style={{
          padding: '12px 18px', borderRadius: '8px', marginBottom: '20px',
          background: actionMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${actionMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: actionMsg.type === 'success' ? '#166534' : '#991b1b',
          fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {actionMsg.text}
        </div>
      )}

      {/* ── SUMMARY STATS BAR ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>Queue Status</div>
          <div style={{ marginTop: '6px' }}>
            <span style={{
              display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
              background: queueStatus === 'ACTIVE' ? '#dcfce7' : queueStatus === 'PAUSED' ? '#fef3c7' : '#f1f5f9',
              color: queueStatus === 'ACTIVE' ? '#15803d' : queueStatus === 'PAUSED' ? '#b45309' : '#475569'
            }}>
              {queueStatus}
            </span>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>Total Checked In</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{totalCheckedIn}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#d97706', fontWeight: 700, letterSpacing: '0.05em' }}>Waiting</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>{waitingEntries.length}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#2563eb', fontWeight: 700, letterSpacing: '0.05em' }}>Called</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>{calledEntry ? 1 : 0}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#7c3aed', fontWeight: 700, letterSpacing: '0.05em' }}>In Consultation</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#7c3aed', marginTop: '4px' }}>{inConsultationEntry ? 1 : 0}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#16a34a', fontWeight: 700, letterSpacing: '0.05em' }}>Completed</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{completedEntries.length}</div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#dc2626', fontWeight: 700, letterSpacing: '0.05em' }}>No Show</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>{noShowEntries.length}</div>
        </div>

      </div>

      {/* ── CURRENT PATIENT & NEXT PATIENT LIVE PANELS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        
        {/* CURRENT PATIENT CARD */}
        <div style={{
          background: '#fff', border: '2px solid #3b82f6', borderRadius: '12px', padding: '20px',
          boxShadow: '0 4px 12px rgba(59,130,246,0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Current Patient
            </span>
            {currentPatient && (
              <span style={{
                fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px',
                background: currentPatient.queue_status === 'IN_CONSULTATION' ? '#f3e8ff' : '#dbeafe',
                color: currentPatient.queue_status === 'IN_CONSULTATION' ? '#7e22ce' : '#1e40af'
              }}>
                {currentPatient.queue_status === 'IN_CONSULTATION' ? 'In Consultation' : 'CALLED'}
              </span>
            )}
          </div>

          {currentPatient ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px', fontWeight: 900, color: '#1e3a8a' }}>Token #{currentPatient.token_number}</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{currentPatient.patient_name}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', display: 'flex', gap: '16px' }}>
                <span>🕐 Appt: <strong>{format12HourTime(currentPatient.appointment_time)}</strong></span>
                <span>📱 {currentPatient.whatsapp_number}</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {currentPatient.queue_status === 'CALLED' && (
                  <button
                    onClick={() => handleStartConsultation(currentPatient.entry_id)}
                    style={{
                      flex: 1, padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none',
                      borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <Play size={16} /> Start Consultation
                  </button>
                )}

                {currentPatient.queue_status === 'IN_CONSULTATION' && (
                  <button
                    onClick={() => handleCompleteConsultation(currentPatient.entry_id)}
                    style={{
                      flex: 1, padding: '10px 16px', background: '#16a34a', color: '#fff', border: 'none',
                      borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                  >
                    <CheckSquare size={16} /> Complete Consultation
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic', padding: '16px 0' }}>
              No patient is currently in consultation or called.
            </div>
          )}
        </div>

        {/* NEXT PATIENT CARD */}
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Next Patient in Line
            </span>
            {nextPatient && (
              <span style={{ fontSize: '12px', fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '3px 10px', borderRadius: '12px' }}>
                Position 1st
              </span>
            )}
          </div>

          {nextPatient ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '24px', fontWeight: 900, color: '#b45309' }}>Token #{nextPatient.token_number}</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{nextPatient.patient_name}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                🕐 Appointment: <strong>{format12HourTime(nextPatient.appointment_time)}</strong>
              </div>

              <button
                onClick={() => session && handleCallNext(session.session_id)}
                style={{
                  width: '100%', padding: '10px 16px', background: '#d97706', color: '#fff', border: 'none',
                  borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <PhoneCall size={16} /> Call Next Patient
              </button>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic', padding: '16px 0' }}>
              {waitingEntries.length === 0 ? 'No waiting patients in queue.' : 'No next patient.'}
            </div>
          )}
        </div>

      </div>

      {/* ── WAITING QUEUE TABLE ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '28px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
          Waiting Queue ({waitingEntries.length})
        </h3>

        {waitingEntries.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '10px 14px' }}>Token #</th>
                  <th style={{ padding: '10px 14px' }}>Patient Name</th>
                  <th style={{ padding: '10px 14px' }}>Appointment Time</th>
                  <th style={{ padding: '10px 14px' }}>Position</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px' }}>Est. Wait</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {waitingEntries.map((e: any) => (
                  <tr key={e.entry_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#2563eb' }}>Token #{e.token_number}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>{e.patient_name}</td>
                    <td style={{ padding: '12px 14px', color: '#64748b' }}>{format12HourTime(e.appointment_time)}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#d97706' }}>#{e.position}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#b45309' }}>
                        {e.queue_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#475569' }}>{e.estimated_wait_minutes ?? 0} mins</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => session && handleCallNext(session.session_id)}
                          style={{ padding: '4px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Call Next
                        </button>
                        <button
                          onClick={() => handleMarkNoShow(e.entry_id)}
                          style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          No Show
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic', padding: '12px 0' }}>
            No patients currently waiting in queue.
          </div>
        )}
      </div>

      {/* ── TODAY'S APPOINTMENTS & CHECK-IN MODULE ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} style={{ color: '#2563eb' }} />
          Today's Confirmed Appointments ({todayAppointments.length})
        </h3>

        {todayAppointments.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '10px 14px' }}>Booking ID</th>
                  <th style={{ padding: '10px 14px' }}>Patient</th>
                  <th style={{ padding: '10px 14px' }}>Date</th>
                  <th style={{ padding: '10px 14px' }}>Time</th>
                  <th style={{ padding: '10px 14px' }}>Appt Status</th>
                  <th style={{ padding: '10px 14px' }}>Queue Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Check-In Action</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((appt) => {
                  const qEntry = entries.find((e: any) => e.appointment_id === appt.id);
                  const isCheckedIn = !!qEntry;

                  return (
                    <tr key={appt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: '#334155' }}>{appt.booking_id || `#${appt.id}`}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>{appt.patient_name}</td>
                      <td style={{ padding: '12px 14px', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {appt.appointment_date
                          ? new Date(appt.appointment_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : todayDateStr}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{format12HourTime(appt.appointment_time)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>
                          {appt.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {isCheckedIn ? (
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: '#dbeafe', color: '#1e40af' }}>
                            Token #{qEntry.token_number} ({qEntry.queue_status})
                          </span>
                        ) : (
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>
                            Not Checked In
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {!isCheckedIn ? (
                          <button
                            onClick={() => handleCheckIn(appt.id)}
                            disabled={checkingInId === appt.id}
                            style={{
                              padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none',
                              borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            <UserCheck size={14} />
                            {checkingInId === appt.id ? 'Checking In...' : 'Check In'}
                          </button>
                        ) : (
                          <span style={{ color: '#16a34a', fontSize: '12px', fontWeight: 700 }}>
                            Checked In ✓
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '14px', fontStyle: 'italic', padding: '12px 0' }}>
            No confirmed appointments scheduled for today.
          </div>
        )}
      </div>

    </div>
  );
};

export default TodaysQueueView;
