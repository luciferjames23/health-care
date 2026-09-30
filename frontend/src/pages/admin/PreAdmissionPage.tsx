import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchPreAdmissions, createPreAdmission, updatePreAdmissionStatus,
  sendPreAdmissionNotification, fetchPreAdmissionConversation,
  fetchDoctors, fetchDepartments, fetchPatients,
  format12HourTime,
  type PreAdmissionItem, type Doctor, type Department, type Patient
} from '../../services/dashboardApi';
import {
  BedDouble, FileText, Bell, CheckCircle, MessageSquare, RefreshCw,
  Plus, Search, Filter, AlertTriangle, Eye, Send, X, Clock, User, Check, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ModuleLoadingScreen, { TableSkeleton } from '../../components/ModuleLoadingScreen';

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

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  border: 0,
  background: 'oklch(0.5 0.1 200)',
  color: '#fff',
  fontWeight: 600,
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '0 8px',
  cursor: 'pointer',
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  backdropFilter: 'blur(2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '16px',
};

const modalBoxStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '8px',
  border: '1px solid #e3e6e8',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  width: '100%',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: "var(--sans, 'Public Sans', -apple-system, sans-serif)",
};

const modalLabelStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 600,
  color: '#52585e',
  marginBottom: '4px',
  display: 'block',
};

const modalInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
};

const modalSelectStyle: React.CSSProperties = {
  ...selectStyle,
  width: '100%',
};

const modalTextareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: '6px',
  border: '1px solid #e3e6e8',
  background: '#fff',
  fontSize: '12px',
  color: '#15181b',
  outline: 'none',
  fontFamily: "var(--sans, 'Public Sans', -apple-system, sans-serif)",
  resize: 'vertical',
};

function getStatusBadge(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'CONFIRMED' || s === 'READY' || s === 'READY_FOR_ADMISSION' || s === 'COMPLETED') {
    return {
      bg: '#ecfdf5',
      color: '#047857',
      border: '1px solid #a7f3d0',
      label: s,
    };
  }
  if (s === 'PENDING' || s === 'CONTACTED' || s === 'DOCUMENTS_PENDING') {
    return {
      bg: 'oklch(0.96 0.05 80)',
      color: 'oklch(0.5 0.13 70)',
      border: '1px solid #fde68a',
      label: s,
    };
  }
  if (s === 'ESCALATED' || s === 'CANCELLED') {
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

function getNotificationBadge(status: string) {
  const s = String(status || '').toUpperCase();
  if (s === 'SENT') {
    return {
      bg: '#ecfdf5',
      color: '#047857',
      border: '1px solid #a7f3d0',
      label: 'SENT',
    };
  }
  if (s === 'FAILED') {
    return {
      bg: '#fef2f2',
      color: '#b91c1c',
      border: '1px solid #fecaca',
      label: 'FAILED',
    };
  }
  return {
    bg: '#f6f7f8',
    color: '#52585e',
    border: '1px solid #e3e6e8',
    label: s || 'PENDING',
  };
}

function getTypeBadge(type: string) {
  const t = String(type || '').toUpperCase();
  if (t === 'SURGERY') {
    return {
      bg: '#fef2f2',
      color: '#b91c1c',
      border: '1px solid #fecaca',
    };
  }
  return {
    bg: 'oklch(0.96 0.03 200)',
    color: 'oklch(0.4 0.1 200)',
    border: '1px solid oklch(0.88 0.04 200)',
  };
}

const STATUS_OPTIONS = [
  'PENDING', 'CONTACTED', 'CONFIRMED', 'DOCUMENTS_PENDING',
  'READY', 'ESCALATED', 'COMPLETED', 'CANCELLED'
];

const ADMISSION_TYPES = ['INPATIENT', 'SURGERY', 'DAYCARE'];

interface SearchableOption {
  id: string | number;
  title: string;
  subtitle?: string;
  badge?: string;
}

const SearchableSelect: React.FC<{
  label: string;
  options: SearchableOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}> = ({ label, options, value, onChange, placeholder, disabled, required }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const selectedOpt = options.find(o => String(o.id) === String(value));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(o => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      o.title.toLowerCase().includes(q) ||
      (o.subtitle && o.subtitle.toLowerCase().includes(q)) ||
      (o.badge && o.badge.toLowerCase().includes(q)) ||
      String(o.id).toLowerCase().includes(q)
    );
  });

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <label style={modalLabelStyle}>{label} {required && '*'}</label>

      {/* Hidden input for HTML form validation */}
      <input
        type="text"
        value={value}
        onChange={() => {}}
        required={required}
        style={{
          opacity: 0,
          width: 0,
          height: 0,
          position: 'absolute',
          bottom: 0,
          left: '50%',
          pointerEvents: 'none'
        }}
      />

      <div
        onClick={() => { if (!disabled) setOpen(!open); }}
        style={{
          ...modalInputStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: disabled ? (selectedOpt ? '#f8fafc' : '#f4f5f6') : '#fff',
          borderColor: open ? 'oklch(0.5 0.1 200)' : '#e3e6e8',
          color: disabled ? '#334155' : '#15181b',
          fontWeight: disabled && selectedOpt ? 500 : 400,
        }}
      >
        <span style={{ color: selectedOpt ? '#15181b' : '#8a9096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOpt ? (selectedOpt.subtitle && label !== 'Department' ? `${selectedOpt.title} (${selectedOpt.subtitle})` : selectedOpt.title) : (placeholder || `-- Select ${label} --`)}
        </span>
        {disabled && selectedOpt ? (
          <span style={{ fontSize: '10px', color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>Locked</span>
        ) : !disabled ? (
          <span style={{ fontSize: '10px', color: '#8a9096', marginLeft: '6px' }}>▼</span>
        ) : null}
      </div>

      {open && !disabled && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1100,
          marginTop: '4px',
          background: '#fff',
          borderRadius: '6px',
          border: '1px solid #e3e6e8',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          maxHeight: '240px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '6px', borderBottom: '1px solid #e3e6e8', background: '#fbfbfc' }}>
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${label}...`}
              style={{
                width: '100%',
                height: '28px',
                padding: '0 8px',
                borderRadius: '4px',
                border: '1px solid #e3e6e8',
                fontSize: '12px',
                outline: 'none'
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: '12px', color: '#8a9096', textAlign: 'center' }}>
                No matching records found
              </div>
            ) : (
              filtered.map(o => {
                const isSelected = String(o.id) === String(value);
                return (
                  <div
                    key={o.id}
                    onClick={() => {
                      onChange(String(o.id));
                      setOpen(false);
                      setQuery('');
                    }}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      background: isSelected ? 'oklch(0.96 0.03 200)' : 'transparent',
                      color: isSelected ? 'oklch(0.4 0.1 200)' : '#15181b',
                      fontWeight: isSelected ? 600 : 400,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = isSelected ? 'oklch(0.96 0.03 200)' : '#f6f7f8')}
                    onMouseLeave={e => (e.currentTarget.style.background = isSelected ? 'oklch(0.96 0.03 200)' : 'transparent')}
                  >
                    <div>
                      <div>{o.title}</div>
                      {o.subtitle && <div style={{ fontSize: '11px', color: '#8a9096' }}>{o.subtitle}</div>}
                    </div>
                    {o.badge && (
                      <span style={{ fontSize: '10px', background: '#f0f2f4', color: '#52585e', padding: '2px 6px', borderRadius: '4px' }}>
                        {o.badge}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PreAdmissionPage: React.FC = () => {
  const { user } = useAuth();
  const [preAdmissions, setPreAdmissions] = useState<PreAdmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'success' | 'error'; loading?: boolean } | null>(null);
  const toastTimeoutRef = React.useRef<any>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Auxiliary data for modal
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Selected item state
  const [selectedPa, setSelectedPa] = useState<PreAdmissionItem | null>(null);
  const [chatData, setChatData] = useState<{
    patient_name: string;
    conversation?: any;
    messages: any[];
  } | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  // Form State
  const [formPatientId, setFormPatientId] = useState('');
  const [formDoctorId, setFormDoctorId] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formType, setFormType] = useState('INPATIENT');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formInstructions, setFormInstructions] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formDocs, setFormDocs] = useState('Government ID, Insurance Card, Doctor Referral Note');
  const [submitting, setSubmitting] = useState(false);

  // Status update form
  const [newStatus, setNewStatus] = useState('');
  const [subDocs, setSubDocs] = useState('');
  const [statusRemarks, setStatusRemarks] = useState('');

  const showToastMsg = (msg: string, type: 'info' | 'success' | 'error' = 'success', loading = false) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast({ msg, type, loading });
    if (type === 'success') {
      toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
    } else if (loading) {
      // Safety net timeout: clear loading state after 15 seconds if API request hangs
      toastTimeoutRef.current = setTimeout(() => {
        setToast({
          msg: '⚠️ Notification dispatch request timed out. Please check network connection.',
          type: 'error',
          loading: false
        });
      }, 15000);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPreAdmissions({
        search: search || undefined,
        status: statusFilter || undefined,
        admission_type: typeFilter || undefined,
        admission_date: dateFilter || undefined
      });
      setPreAdmissions(res?.pre_admissions || []);
    } catch (err) {
      console.error('Error fetching pre-admissions:', err);
      setPreAdmissions([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, dateFilter]);

  useEffect(() => {
    const t = setTimeout(loadData, 300);
    return () => clearTimeout(t);
  }, [loadData]);

  // Load auxiliary lists on mount
  useEffect(() => {
    fetchDoctors().then(res => setDoctors(res.doctors || []));
    fetchDepartments().then(res => setDepartments(res.departments || []));
    fetchPatients({ per_page: 100 }).then(res => setPatients(res.patients || []));
  }, []);

  // Handle Doctor change in modal to auto-select department
  const handleDoctorSelect = (docIdStr: string) => {
    setFormDoctorId(docIdStr);
    const selectedDoc = doctors.find(d => String(d.id) === docIdStr);
    if (selectedDoc) {
      setFormDeptId(String(selectedDoc.department_id));
    }
  };

  const handleDeptSelect = (deptIdStr: string) => {
    setFormDeptId(deptIdStr);
    if (formDoctorId) {
      const selectedDoc = doctors.find(d => String(d.id) === formDoctorId);
      if (selectedDoc && String(selectedDoc.department_id) !== deptIdStr) {
        setFormDoctorId('');
      }
    }
  };

  const isDoctorRole = Boolean(
    user && (
      String(user.role).toLowerCase() === 'doctor' ||
      (user as any)?.role === 'DOCTOR'
    )
  );

  // Auto-populate Doctor & Department for authenticated doctor role
  useEffect(() => {
    if (showAddModal && isDoctorRole) {
      const docId = user?.doctorId || (user as any)?.doctor_id;
      if (docId) {
        const docIdStr = String(docId);
        setFormDoctorId(docIdStr);
        const selectedDoc = doctors.find(d => String(d.id) === docIdStr);
        if (selectedDoc) {
          setFormDeptId(String(selectedDoc.department_id));
        } else if (user?.department) {
          const matchedDept = departments.find(dep => dep.department_name.toLowerCase() === user.department?.toLowerCase());
          if (matchedDept) {
            setFormDeptId(String(matchedDept.id));
          }
        }
      }
    }
  }, [showAddModal, isDoctorRole, user, doctors, departments]);

  const patientOptions: SearchableOption[] = patients.map(p => ({
    id: String(p.id),
    title: `${p.first_name} ${p.last_name}`.trim(),
    subtitle: `ID: ${p.patient_code} · Phone: ${p.phone || p.whatsapp_number || 'N/A'}`,
    badge: p.status
  }));

  const doctorOptions: SearchableOption[] = doctors.map(d => ({
    id: String(d.id),
    title: d.display_name.startsWith('Dr.') ? d.display_name : `Dr. ${d.display_name}`,
    subtitle: d.specialization || d.qualification || undefined,
    badge: d.status
  }));

  const departmentOptions: SearchableOption[] = departments.map(d => ({
    id: String(d.id),
    title: d.department_name,
    subtitle: d.description || d.department_code || undefined,
    badge: d.status
  }));

  // Open Chat Modal
  const handleOpenChat = async (pa: PreAdmissionItem) => {
    setSelectedPa(pa);
    setShowChatModal(true);
    setChatLoading(true);
    try {
      const res = await fetchPreAdmissionConversation(pa.id);
      setChatData(res);
    } finally {
      setChatLoading(false);
    }
  };

  // Trigger Notification
  const handleNotify = async (id: number) => {
    showToastMsg('Sending WhatsApp notification to patient...', 'info', true);
    try {
      const res = await sendPreAdmissionNotification(id);
      if (res.success && res.status === 'SENT') {
        showToastMsg(`✓ WhatsApp admission notification sent successfully! (${res.whatsapp_number || ''})`, 'success');
        loadData();
      } else {
        showToastMsg(`❌ Failed to send WhatsApp notification: ${res.error || 'Delivery failed'}`, 'error');
        loadData();
      }
    } catch (err: any) {
      showToastMsg(`❌ Failed to send WhatsApp notification: ${err?.message || 'Network error'}`, 'error');
      loadData();
    }
  };

  // Create Admission Submission
  const handleCreateAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPatientId || !formDoctorId || !formDeptId || !formDate || !formType) {
      showToastMsg('Please fill all required fields.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createPreAdmission({
        patient_id: Number(formPatientId),
        doctor_id: Number(formDoctorId),
        department_id: Number(formDeptId),
        admission_type: formType,
        expected_admission_date: formDate,
        expected_checkin_time: formTime,
        instructions: formInstructions,
        remarks: formRemarks,
        pending_documents: formDocs
      });
      if (res.success) {
        if (res.notification_status === 'SENT') {
          showToastMsg(`✓ Admission registered! Code: ${res.pre_admission_code}. WhatsApp message delivered successfully.`, 'success');
        } else {
          showToastMsg(`⚠️ Admission registered! Code: ${res.pre_admission_code}. WhatsApp notification FAILED to deliver (check remarks).`, 'error');
        }
        setShowAddModal(false);
        // Reset form
        setFormPatientId('');
        setFormDoctorId('');
        setFormDeptId('');
        setFormDate('');
        loadData();
      } else {
        showToastMsg(`❌ Registration failed: ${res.error || 'Database error'}`, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open Status Update Modal
  const handleOpenStatusModal = (pa: PreAdmissionItem) => {
    setSelectedPa(pa);
    setNewStatus(pa.status);
    setSubDocs(pa.submitted_documents || '');
    setStatusRemarks(pa.remarks || '');
    setShowStatusModal(true);
  };

  // Submit Status Update
  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPa) return;
    setSubmitting(true);
    try {
      const res = await updatePreAdmissionStatus(selectedPa.id, {
        status: newStatus,
        submitted_documents: subDocs,
        remarks: statusRemarks
      });
      if (res.success) {
        showToastMsg('✓ Pre-admission record updated successfully!', 'success');
        setShowStatusModal(false);
        loadData();
      } else {
        showToastMsg(`❌ Update failed: ${res.error}`, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // KPIs
  const totalCount = preAdmissions?.length || 0;
  const pendingCount = (preAdmissions || []).filter(p => p.status === 'PENDING' || p.status === 'CONTACTED').length;
  const confirmedCount = (preAdmissions || []).filter(p => p.status === 'CONFIRMED' || p.status === 'READY' || p.status === 'READY_FOR_ADMISSION').length;
  const escalatedCount = (preAdmissions || []).filter(p => p.status === 'ESCALATED').length;
  const completedCount = (preAdmissions || []).filter(p => p.status === 'COMPLETED').length;

  const handleOpenAddModal = () => {
    setShowAddModal(true);
    const docId = user?.doctorId || (user as any)?.doctor_id;
    if (user && (user.role === 'doctor' || (user as any)?.role === 'DOCTOR') && docId) {
      handleDoctorSelect(String(docId));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Top Header & Breadcrumbs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Front Office & Patients</span> › <span>Pre-Admission Follow-up</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: '#15181b' }}>
            Patient Admission & Pre-Admission Follow-up
          </div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            Register pre-admissions, manage lifecycle, track documents, and view WhatsApp interactions
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            style={btnPrimary}
            onClick={handleOpenAddModal}
          >
            <Plus size={14} /> Register Admission
          </button>
        </div>
      </div>

      {toast && (
        <div
          style={{
            background: toast.type === 'info' ? '#eff6ff' : toast.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${toast.type === 'info' ? '#bfdbfe' : toast.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            borderRadius: '6px',
            padding: '8px 12px',
            color: toast.type === 'info' ? '#1e40af' : toast.type === 'success' ? '#047857' : '#b91c1c',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toast.loading ? (
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : toast.type === 'info' ? (
              <Bell size={14} />
            ) : toast.type === 'success' ? (
              <CheckCircle size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            <span>{toast.msg}</span>
          </div>
          {toast.type === 'error' && (
            <button
              onClick={() => setToast(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#b91c1c',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '12px',
                padding: '2px 6px'
              }}
              title="Dismiss error message"
            >
              ✕ Dismiss
            </button>
          )}
        </div>
      )}

      {/* KPI Cards Strip */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                background: '#fff',
                border: '1px solid #e3e6e8',
                borderRadius: '8px',
                padding: '10px 16px',
                minWidth: '130px',
                flex: '1 1 130px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div className="hx-shimmer" style={{ width: '65%', height: '11px', borderRadius: '3px' }} />
              <div className="hx-shimmer" style={{ width: '45%', height: '22px', borderRadius: '4px', marginTop: '2px' }} />
            </div>
          ))
        ) : (
          <>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px', flex: '1 1 130px' }}>
              <div style={{ color: '#8a9096', fontSize: '11px' }}>Total Pre-Admissions</div>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: '#15181b', marginTop: '2px' }}>
                {totalCount}
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px', flex: '1 1 130px' }}>
              <div style={{ color: '#8a9096', fontSize: '11px' }}>Pending / Contacted</div>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.13 70)', marginTop: '2px' }}>
                {pendingCount}
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px', flex: '1 1 130px' }}>
              <div style={{ color: '#8a9096', fontSize: '11px' }}>Confirmed & Ready</div>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.4 0.12 150)', marginTop: '2px' }}>
                {confirmedCount}
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 16px', minWidth: '130px', flex: '1 1 130px' }}>
              <div style={{ color: '#8a9096', fontSize: '11px' }}>Escalated (Needs Staff)</div>
              <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '24px', lineHeight: 1.1, color: 'oklch(0.5 0.18 25)', marginTop: '2px' }}>
                {escalatedCount}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter and Search Bar Card */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '10px 14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e3e6e8', borderRadius: '6px', padding: '0 10px', height: '30px', flex: '1 1 240px', maxWidth: 320 }}>
            <Search size={14} style={{ color: '#8a9096', flexShrink: 0 }} />
            <input
              placeholder="Search code, patient, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%', background: 'transparent', color: '#15181b', fontFamily: "var(--sans, 'Public Sans', sans-serif)" }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={13} style={{ color: '#8a9096' }} />

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Admission Types</option>
              {ADMISSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={inputStyle}
            />

            {(search || statusFilter || typeFilter || dateFilter) && (
              <button
                type="button"
                style={btnSecondary}
                onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setDateFilter(''); }}
              >
                Clear Filters
              </button>
            )}

            <button
              type="button"
              style={btnSecondary}
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw size={13} style={{ animation: loading ? 'kpi-spin 0.7s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Admission Table */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '16px' }}>
            <ModuleLoadingScreen
              title="Loading Pre-Admission Desk..."
              subtitle="Retrieving planned inpatient admissions, bed reservations, and insurance pre-authorizations..."
              badgeText="Live Pre-Admission Sync"
              showKpis={false}
              tableRows={7}
              tableColumns={8}
            />
          </div>
        ) : preAdmissions.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8a9096' }}>
            <div style={{ fontWeight: 600, color: '#52585e', marginBottom: '4px' }}>No pre-admission records found</div>
            <div>Try adjusting your search criteria or register a new admission.</div>
          </div>
        ) : (
          <table style={{ width: '100%', minWidth: '1150px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f6f7f8', borderBottom: '1px solid #e3e6e8' }}>
                <th style={{ padding: '10px 12px', width: '110px', minWidth: '110px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Code</th>
                <th style={{ padding: '10px 12px', minWidth: '180px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Patient Details</th>
                <th style={{ padding: '10px 12px', width: '110px', minWidth: '110px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Type</th>
                <th style={{ padding: '10px 12px', width: '160px', minWidth: '160px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Expected Date & Time</th>
                <th style={{ padding: '10px 12px', minWidth: '170px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Department & Doctor</th>
                <th style={{ padding: '10px 12px', width: '120px', minWidth: '120px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Status</th>
                <th style={{ padding: '10px 12px', width: '120px', minWidth: '120px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>WhatsApp Notif</th>
                <th style={{ padding: '10px 12px', width: '140px', minWidth: '140px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {preAdmissions.map(pa => {
                const sBadge = getStatusBadge(pa.status || 'Pending');
                const nBadge = getNotificationBadge(pa.notification_status || 'Pending');
                const tBadge = getTypeBadge(pa.admission_type || 'Elective');

                return (
                  <tr
                    key={pa.id}
                    style={{ borderBottom: '1px solid #f2f3f4', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f6f7f8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11.5px', fontWeight: 600, color: 'oklch(0.5 0.1 200)', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      {pa.pre_admission_code}
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '180px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, color: '#15181b', whiteSpace: 'nowrap' }}>{pa.patient_name}</div>
                      <div style={{ fontSize: '10.5px', color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace', whiteSpace: 'nowrap', marginTop: '1px' }}>
                        ID: {pa.patient_code} · {pa.patient_phone}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          background: tBadge.bg,
                          color: tBadge.color,
                          border: tBadge.border,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}
                      >
                        {pa.admission_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 500, color: '#15181b', whiteSpace: 'nowrap' }}>{pa.expected_admission_date}</div>
                      <div style={{ fontSize: '10.5px', color: '#8a9096', whiteSpace: 'nowrap', marginTop: '1px' }}>
                        Check-in: {format12HourTime(pa.expected_checkin_time)}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '170px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 500, color: '#15181b', whiteSpace: 'nowrap' }}>
                        {pa.doctor_name ? (pa.doctor_name.startsWith('Dr.') ? pa.doctor_name : `Dr. ${pa.doctor_name}`) : 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#8a9096', whiteSpace: 'nowrap', marginTop: '1px' }}>{pa.department_name}</div>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <span
                        onClick={() => handleOpenStatusModal(pa)}
                        title="Click to update status"
                        style={{
                          background: sBadge.bg,
                          color: sBadge.color,
                          border: sBadge.border,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}
                      >
                        {sBadge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          background: nBadge.bg,
                          color: nBadge.color,
                          border: nBadge.border,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}
                      >
                        {nBadge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleNotify(pa.id)}
                          title="Resend WhatsApp Notification"
                          style={{
                            height: '24px', padding: '0 7px', borderRadius: '4px', border: '1px solid #e3e6e8',
                            background: '#fff', color: '#15181b', fontSize: '11px', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 3
                          }}
                        >
                          <Send size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenChat(pa)}
                          title="View Patient WhatsApp Conversation"
                          style={{
                            height: '24px', padding: '0 8px', borderRadius: '4px', border: '1px solid #e3e6e8',
                            background: '#fff', color: '#15181b', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4
                          }}
                        >
                          <MessageSquare size={12} color="#25D366" /> Chat
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenStatusModal(pa)}
                          style={{
                            height: '24px', padding: '0 8px', borderRadius: '4px', border: 0,
                            background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '11px', fontWeight: 600,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                          }}
                        >
                          Update
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

      {/* ── Modal: Register New Admission ──────────────────────────────────── */}
      {showAddModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalBoxStyle, maxWidth: 620 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e3e6e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fbfbfc' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#15181b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BedDouble size={16} color="oklch(0.5 0.1 200)" />
                <span>Register New Pre-Admission</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8a9096', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmission} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <SearchableSelect
                    label="Select Patient"
                    options={patientOptions}
                    value={formPatientId}
                    onChange={setFormPatientId}
                    placeholder="-- Search & Select Patient (Name, ID, Phone) --"
                    required
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Attending Doctor"
                    options={doctorOptions}
                    value={formDoctorId}
                    onChange={handleDoctorSelect}
                    placeholder="-- Search & Select Doctor --"
                    disabled={isDoctorRole}
                    required
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Department"
                    options={departmentOptions}
                    value={formDeptId}
                    onChange={handleDeptSelect}
                    placeholder="-- Auto-filled when Doctor is selected --"
                    disabled={true}
                    required
                  />
                </div>

                <div>
                  <label style={modalLabelStyle}>Admission Type *</label>
                  <select
                    style={modalSelectStyle}
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                    required
                  >
                    {ADMISSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label style={modalLabelStyle}>Expected Date *</label>
                  <input
                    type="date"
                    style={modalInputStyle}
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={modalLabelStyle}>Expected Check-in Time</label>
                  <input
                    type="time"
                    style={modalInputStyle}
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={modalLabelStyle}>Required / Pending Documents</label>
                  <input
                    type="text"
                    style={modalInputStyle}
                    value={formDocs}
                    onChange={e => setFormDocs(e.target.value)}
                    placeholder="e.g. Government ID, Insurance Card, Doctor Referral Note"
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={modalLabelStyle}>Special Instructions for Patient</label>
                  <textarea
                    style={modalTextareaStyle}
                    rows={2}
                    value={formInstructions}
                    onChange={e => setFormInstructions(e.target.value)}
                    placeholder="e.g. Fast 8 hours prior to check-in. Bring regular medications."
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={modalLabelStyle}>Internal Remarks</label>
                  <textarea
                    style={modalTextareaStyle}
                    rows={2}
                    value={formRemarks}
                    onChange={e => setFormRemarks(e.target.value)}
                    placeholder="Physician notes, bed category requests, etc."
                  />
                </div>
              </div>

              <div style={{ padding: '10px 16px', borderTop: '1px solid #e3e6e8', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fbfbfc' }}>
                <button type="button" style={btnSecondary} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" style={btnPrimary} disabled={submitting}>
                  {submitting ? 'Registering & Sending WhatsApp...' : 'Register Admission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Update Status & Documents ──────────────────────────────── */}
      {showStatusModal && selectedPa && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalBoxStyle, maxWidth: 480 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e3e6e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fbfbfc' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#15181b' }}>
                  Update Pre-Admission Status
                </div>
                <div style={{ fontSize: '11px', color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace', marginTop: '1px' }}>
                  Code: {selectedPa.pre_admission_code} · {selectedPa.patient_name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8a9096', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={modalLabelStyle}>Admission Status</label>
                  <select
                    style={modalSelectStyle}
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label style={modalLabelStyle}>Submitted Documents</label>
                  <input
                    type="text"
                    style={modalInputStyle}
                    value={subDocs}
                    onChange={e => setSubDocs(e.target.value)}
                    placeholder="e.g. Aadhaar Card, Insurance Approval Letter"
                  />
                </div>

                <div>
                  <label style={modalLabelStyle}>Remarks / Notes</label>
                  <textarea
                    style={modalTextareaStyle}
                    rows={3}
                    value={statusRemarks}
                    onChange={e => setStatusRemarks(e.target.value)}
                    placeholder="Follow-up notes, patient response, etc."
                  />
                </div>
              </div>

              <div style={{ padding: '10px 16px', borderTop: '1px solid #e3e6e8', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fbfbfc' }}>
                <button type="button" style={btnSecondary} onClick={() => setShowStatusModal(false)}>Cancel</button>
                <button type="submit" style={btnPrimary} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: WhatsApp Conversation View ────────────────────────────── */}
      {showChatModal && selectedPa && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalBoxStyle, maxWidth: 600, height: '80vh' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e3e6e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fbfbfc' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#15181b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={16} color="#25D366" />
                  WhatsApp Conversation — {selectedPa.patient_name}
                </div>
                <div style={{ fontSize: '11px', color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace', marginTop: '1px' }}>
                  Code: {selectedPa.pre_admission_code} · Phone: {selectedPa.patient_phone}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChatModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8a9096', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', background: '#f9fafa', padding: '16px' }}>
              {chatLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8a9096' }}>Loading conversation history...</div>
              ) : !chatData || !chatData.messages || chatData.messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#8a9096' }}>
                  No WhatsApp messages exchanged yet for this pre-admission.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {chatData.messages.map((m: any) => {
                    const isPatient = m.sender_type === 'PATIENT';
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isPatient ? 'flex-start' : 'flex-end',
                          maxWidth: '80%',
                          background: isPatient ? '#FFFFFF' : '#dcf8c6',
                          border: `1px solid ${isPatient ? '#e3e6e8' : '#bbf7d0'}`,
                          padding: '9px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          lineHeight: 1.4,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{ fontSize: '10.5px', fontWeight: 600, marginBottom: '3px', color: isPatient ? 'oklch(0.4 0.1 200)' : '#15803d' }}>
                          {isPatient ? '👤 Patient' : '🤖 AI Agent'} {m.intent ? `(${m.intent})` : ''}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', color: '#15181b' }}>{m.message_text}</div>
                        <div style={{ fontSize: '10px', color: '#8a9096', marginTop: '4px', textAlign: 'right' }}>
                          {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid #e3e6e8', display: 'flex', justifyContent: 'flex-end', background: '#fbfbfc' }}>
              <button type="button" style={btnSecondary} onClick={() => setShowChatModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreAdmissionPage;
