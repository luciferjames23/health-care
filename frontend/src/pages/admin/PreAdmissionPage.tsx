import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchPreAdmissions, createPreAdmission, updatePreAdmissionStatus,
  sendPreAdmissionNotification, fetchPreAdmissionConversation,
  fetchDoctors, fetchDepartments, fetchPatients,
  allocatePreAdmissionBed, confirmAndAdmitPreAdmission, fetchAvailableBedsHierarchy,
  format12HourTime,
  type PreAdmissionItem, type Doctor, type Department, type Patient,
  type AvailableWard, type AvailableRoom, type AvailableBed
} from '../../services/dashboardApi';
import {
  BedDouble, FileText, Bell, CheckCircle, MessageSquare, RefreshCw,
  Plus, Search, Filter, AlertTriangle, Eye, Send, X, Clock, User, Check, ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ModuleLoadingScreen, { CardGridSkeleton, TableSkeleton } from '../../components/ModuleLoadingScreen';

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
  if (s === 'READ') {
    return {
      bg: '#eff6ff',
      color: '#1d4ed8',
      border: '1px solid #bfdbfe',
      label: 'READ',
    };
  }
  if (s === 'DELIVERED') {
    return {
      bg: '#ecfdf5',
      color: '#047857',
      border: '1px solid #a7f3d0',
      label: 'DELIVERED',
    };
  }
  if (s === 'SENT') {
    return {
      bg: '#f0fdf4',
      color: '#15803d',
      border: '1px solid #bbf7d0',
      label: 'SENT',
    };
  }
  if (s === 'SUBMITTED' || s === 'ACCEPTED') {
    return {
      bg: '#f0fdf4',
      color: '#15803d',
      border: '1px solid #bbf7d0',
      label: 'SUBMITTED',
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
    bg: '#fefce8',
    color: '#854d0e',
    border: '1px solid #fef08a',
    label: s || 'PENDING',
  };
}

function getTypeBadge(type: string) {
  const t = String(type || '').toLowerCase();
  if (t === 'emergency' || t === 'surgical' || t === 'readmission') {
    return {
      bg: '#fef2f2',
      color: '#b91c1c',
      border: '1px solid #fecaca',
    };
  }
  if (t === 'elective' || t === 'day care' || t === 'maternity / obstetric') {
    return {
      bg: '#e0f2fe',
      color: '#0369a1',
      border: '1px solid #bae6fd',
    };
  }
  if (t === 'urgent' || t === 'observation') {
    return {
      bg: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a',
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

const ADMISSION_TYPES = [
  'Direct Admission',
  'Elective',
  'Emergency',
  'Urgent',
  'Routine',
  'Day Care',
  'Maternity / Obstetric',
  'Medical',
  'Newborn / Neonatal',
  'Observation',
  'Psychiatric',
  'Readmission',
  'Rehabilitation',
  'Surgical',
  'Transfer In',
  'Inpatient'
];

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
  hasError?: boolean;
  errorMsg?: string;
}> = ({ label, options, value, onChange, placeholder, disabled, required, hasError, errorMsg }) => {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
        <label style={modalLabelStyle}>{label} {required && '*'}</label>
        {errorMsg && (
          <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 500 }}>
            {errorMsg}
          </span>
        )}
      </div>

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
          borderColor: hasError ? '#ef4444' : (open ? 'oklch(0.5 0.1 200)' : '#e3e6e8'),
          boxShadow: hasError ? '0 0 0 1px #ef4444' : undefined,
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
  const { user: authContextUser } = useAuth();
  const user = authContextUser || (() => {
    try {
      return JSON.parse(sessionStorage.getItem('hx_auth') || sessionStorage.getItem('meridian_user') || 'null');
    } catch {
      return null;
    }
  })();

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
  const [showBedModal, setShowBedModal] = useState(false);

  // Bed allocation modal state
  const [availableWards, setAvailableWards] = useState<AvailableWard[]>([]);
  const [selectedWardId, setSelectedWardId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [bedSubmitting, setBedSubmitting] = useState(false);

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
  const [formType, setFormType] = useState('Elective');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('09:00');
  const [formInstructions, setFormInstructions] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formDocs, setFormDocs] = useState('Government ID, Insurance Card, Doctor Referral Note');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setModalError(null);
  };

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

  const isDoctorRole = Boolean(
    user && (
      String(user.role).toLowerCase() === 'doctor' ||
      String((user as any)?.role).toUpperCase() === 'DOCTOR'
    )
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const docId = isDoctorRole ? (user?.doctorId || (user as any)?.doctor_id) : undefined;
      const res = await fetchPreAdmissions({
        doctor_id: docId ? Number(docId) : undefined,
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
  }, [search, statusFilter, typeFilter, dateFilter, isDoctorRole, user]);

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
  const handleDoctorSelect = useCallback((docIdStr: string) => {
    setFormDoctorId(docIdStr);
    clearFieldError('doctor');
    clearFieldError('department');
    if (!docIdStr) {
      setFormDeptId('');
      return;
    }
    const selectedDoc = doctors.find(d => String(d.id) === String(docIdStr));
    if (selectedDoc && selectedDoc.department_id) {
      setFormDeptId(String(selectedDoc.department_id));
    }
  }, [doctors]);

  const handleDeptSelect = (deptIdStr: string) => {
    setFormDeptId(deptIdStr);
    clearFieldError('department');
    if (formDoctorId && !isDoctorRole) {
      const selectedDoc = doctors.find(d => String(d.id) === String(formDoctorId));
      if (selectedDoc && String(selectedDoc.department_id) !== deptIdStr) {
        setFormDoctorId('');
      }
    }
  };

  // Auto-populate Doctor & Department for authenticated doctor role or sync when doctor selection changes
  useEffect(() => {
    if (isDoctorRole && user) {
      const docId = user?.doctorId || (user as any)?.doctor_id;
      if (docId) {
        const docIdStr = String(docId);
        if (formDoctorId !== docIdStr) {
          setFormDoctorId(docIdStr);
        }
        const selectedDoc = doctors.find(d => String(d.id) === docIdStr);
        if (selectedDoc && selectedDoc.department_id) {
          setFormDeptId(String(selectedDoc.department_id));
        } else if (user?.departmentId || (user as any)?.department_id) {
          setFormDeptId(String(user.departmentId || (user as any)?.department_id));
        } else if (user?.department && departments.length > 0) {
          const matchedDept = departments.find(dep => dep.department_name.toLowerCase() === user.department?.toLowerCase());
          if (matchedDept) {
            setFormDeptId(String(matchedDept.id));
          }
        }
      }
    } else if (formDoctorId && doctors.length > 0) {
      const selectedDoc = doctors.find(d => String(d.id) === String(formDoctorId));
      if (selectedDoc && selectedDoc.department_id) {
        setFormDeptId(String(selectedDoc.department_id));
      }
    }
  }, [showAddModal, isDoctorRole, user, doctors, departments, formDoctorId]);

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
    showToastMsg('Submitting WhatsApp notification to Meta Cloud API...', 'info', true);
    try {
      const res = await sendPreAdmissionNotification(id);
      if (res.success) {
        // res.status is 'SUBMITTED' (accepted by provider) — delivery confirmed only via webhook
        const numDisplay = res.whatsapp_number ? ` (${res.whatsapp_number})` : '';
        showToastMsg(`✓ WhatsApp notification submitted; delivery pending confirmation.${numDisplay}`, 'success');
        loadData();
      } else {
        // Provider rejected or network failure — display provider error code/message
        const errDetail = res.error || 'Provider rejected the request';
        showToastMsg(`❌ WhatsApp notification failed: ${errDetail}`, 'error');
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
    if (submitting) return; // Prevent duplicate submissions

    // Field-level client validation
    const errors: Record<string, string> = {};
    if (!formPatientId) {
      errors.patient = 'Please select a patient';
    }
    if (!formDoctorId) {
      errors.doctor = 'Please select an attending doctor';
    }
    if (!formDeptId) {
      errors.department = 'Please select a department';
    }
    if (!formDate) {
      errors.date = 'Expected admission date is required';
    }
    if (!formType || !ADMISSION_TYPES.includes(formType)) {
      errors.admission_type = 'Please select a valid admission type';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setModalError('Please fill all required fields before registering.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    setFieldErrors({});

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

      if (res && res.success) {
        // Notification feedback
        const notifOk = res.notification_status === 'SUBMITTED' || res.notification_status === 'SENT';
        if (notifOk) {
          const numDisplay = res.whatsapp_number ? ` (${res.whatsapp_number})` : '';
          showToastMsg(
            `✓ Admission registered! Code: ${res.pre_admission_code}. WhatsApp notification submitted; delivery pending confirmation.${numDisplay}`,
            'success'
          );
        } else {
          const errDetail = res.notification_error || res.notification_detail || 'Check remarks for provider error';
          showToastMsg(
            `⚠️ Admission registered (Code: ${res.pre_admission_code}). WhatsApp notification not delivered: ${errDetail}`,
            'error'
          );
        }

        // Close modal and reset form ONLY on backend confirmed success
        setShowAddModal(false);
        setFormPatientId('');
        if (!isDoctorRole) {
          setFormDoctorId('');
          setFormDeptId('');
        }
        setFormDate('');
        setFormTime('09:00');
        setFormType('Elective');
        setFormInstructions('');
        setFormRemarks('');
        setFormDocs('Government ID, Insurance Card, Doctor Referral Note');
        setModalError(null);
        setFieldErrors({});

        loadData();
      } else {
        // Registration failed: Keep modal OPEN, preserve ALL entered values!
        const errMsg = res?.error || res?.message || 'Registration failed. Please review your submission.';
        setModalError(errMsg);

        // Assign to field errors if error specifies field
        const lower = errMsg.toLowerCase();
        const fErrors: Record<string, string> = {};
        if (lower.includes('admission_type') || lower.includes('admission type')) {
          fErrors.admission_type = errMsg;
        }
        if (lower.includes('doctor')) {
          fErrors.doctor = errMsg;
        }
        if (lower.includes('department')) {
          fErrors.department = errMsg;
        }
        if (lower.includes('patient')) {
          fErrors.patient = errMsg;
        }
        if (lower.includes('date')) {
          fErrors.date = errMsg;
        }
        if (Object.keys(fErrors).length > 0) {
          setFieldErrors(fErrors);
        }
      }
    } catch (err: any) {
      const netError = err?.message || 'An unexpected network error occurred while communicating with the server.';
      setModalError(netError);
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

  const handleOpenBedModal = async (pa: PreAdmissionItem) => {
    setSelectedPa(pa);
    setSelectedWardId(pa.ward_id ? String(pa.ward_id) : '');
    setSelectedRoomId(pa.room_id ? String(pa.room_id) : '');
    setSelectedBedId(pa.bed_id ? String(pa.bed_id) : '');
    setShowBedModal(true);
    setLoadingBeds(true);
    try {
      const res = await fetchAvailableBedsHierarchy();
      setAvailableWards(res?.wards || []);
      // If patient already has a ward, initialize it; otherwise auto-select first ward
      if (!pa.ward_id && res?.wards && res.wards.length > 0) {
        const firstW = res.wards[0];
        setSelectedWardId(String(firstW.ward_id));
        if (firstW.rooms && firstW.rooms.length > 0) {
          const firstR = firstW.rooms[0];
          setSelectedRoomId(String(firstR.room_id));
          if (firstR.beds && firstR.beds.length > 0) {
            setSelectedBedId(String(firstR.beds[0].bed_id));
          }
        }
      }
    } catch (err: any) {
      showToastMsg(`Failed to load available beds: ${err.message}`, 'error');
    } finally {
      setLoadingBeds(false);
    }
  };

  const handleAllocateBedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPa || !selectedWardId || !selectedRoomId || !selectedBedId) {
      showToastMsg('Please select Ward, Room, and Bed.', 'error');
      return;
    }
    setBedSubmitting(true);
    try {
      const res = await allocatePreAdmissionBed(selectedPa.id, {
        ward_id: Number(selectedWardId),
        room_id: Number(selectedRoomId),
        bed_id: Number(selectedBedId)
      });
      if (res.success) {
        showToastMsg(`✓ ${res.message || 'Bed allocated successfully!'}`, 'success');
        setShowBedModal(false);
        loadData();
      } else {
        showToastMsg(`❌ Bed allocation failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      showToastMsg(`❌ Bed allocation failed: ${err.message}`, 'error');
    } finally {
      setBedSubmitting(false);
    }
  };

  const handleConfirmAndAdmit = async (pa: PreAdmissionItem) => {
    setSubmitting(true);
    try {
      const res = await confirmAndAdmitPreAdmission(pa.id);
      if (res.success) {
        showToastMsg(`✓ Pre-admission confirmed & Inpatient Admission created (${res.admission_number || ''})!`, 'success');
        loadData();
      } else {
        showToastMsg(`❌ Confirmation failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      showToastMsg(`❌ Error: ${err.message}`, 'error');
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
    setModalError(null);
    setFieldErrors({});
    setShowAddModal(true);
    if (isDoctorRole) {
      const docId = user?.doctorId || (user as any)?.doctor_id;
      if (docId) {
        handleDoctorSelect(String(docId));
      }
    } else {
      setFormPatientId('');
      setFormDoctorId('');
      setFormDeptId('');
    }
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setModalError(null);
    setFieldErrors({});
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
            {isDoctorRole && user?.name ? `Pre-Admission Desk · ${user.name}` : 'Patient Admission & Pre-Admission Follow-up'}
          </div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            {isDoctorRole
              ? `Doctor Scope: ${user?.name || 'Attending Doctor'} · Showing pre-admission records assigned under your care`
              : 'Register pre-admissions, manage lifecycle, track documents, and view WhatsApp interactions'}
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
          <table style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f6f7f8', borderBottom: '1px solid #e3e6e8' }}>
                <th style={{ padding: '10px 12px', width: '100px', minWidth: '100px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Code</th>
                <th style={{ padding: '10px 12px', minWidth: '170px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Patient Details</th>
                <th style={{ padding: '10px 12px', width: '90px', minWidth: '90px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Type</th>
                <th style={{ padding: '10px 12px', width: '145px', minWidth: '145px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Expected Date & Time</th>
                <th style={{ padding: '10px 12px', minWidth: '160px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Doctor & Dept</th>
                <th style={{ padding: '10px 12px', minWidth: '180px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>IP Admission & Bed</th>
                <th style={{ padding: '10px 12px', width: '110px', minWidth: '110px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Status</th>
                <th style={{ padding: '10px 12px', width: '110px', minWidth: '110px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>WhatsApp Notif</th>
                <th style={{ padding: '10px 12px', width: '270px', minWidth: '270px', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#52585e', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {preAdmissions.map(pa => {
                const sBadge = getStatusBadge(pa.status || 'Pending');
                const nBadge = getNotificationBadge(pa.notification_status || 'Pending');
                const tBadge = getTypeBadge(pa.admission_type || 'Elective');
                const isConfirmedOrReady = Boolean(
                  pa.status && (
                    pa.status === 'CONFIRMED' ||
                    pa.status === 'READY' ||
                    pa.status === 'READY_FOR_ADMISSION'
                  )
                );
                const isCancelledOrCompleted = Boolean(
                  pa.status && (
                    pa.status === 'CANCELLED' ||
                    pa.status === 'COMPLETED'
                  )
                );
                const hasBed = Boolean(
                  pa.bed_number &&
                  pa.bed_number !== 'Pending' &&
                  pa.bed_number !== 'Pending Allocation'
                );

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
                    <td style={{ padding: '10px 12px', minWidth: '170px', verticalAlign: 'middle' }}>
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
                    <td style={{ padding: '10px 12px', minWidth: '160px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 500, color: '#15181b', whiteSpace: 'nowrap' }}>
                        {pa.doctor_name ? (pa.doctor_name.startsWith('Dr.') ? pa.doctor_name : `Dr. ${pa.doctor_name}`) : 'Unassigned'}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#8a9096', whiteSpace: 'nowrap', marginTop: '1px' }}>{pa.department_name}</div>
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: '180px', verticalAlign: 'middle' }}>
                      {pa.admission_number ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', fontWeight: 600, color: 'oklch(0.5 0.1 200)' }}>
                            <BedDouble size={12} />
                            {pa.admission_number}
                          </div>
                          <div style={{ fontSize: '10.5px', marginTop: '2px', color: hasBed ? '#15803d' : '#b45309', fontWeight: 500 }}>
                            {hasBed
                              ? `${pa.ward_name ? pa.ward_name + ' · ' : ''}${pa.room_number ? 'RM-' + pa.room_number + ' / ' : ''}${pa.bed_number}`
                              : (isCancelledOrCompleted ? 'Bed Released' : '⏳ Pending Bed Allocation')}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {pa.status === 'CANCELLED' ? (
                            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>Cancelled</span>
                          ) : pa.status === 'COMPLETED' ? (
                            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 500 }}>Completed</span>
                          ) : isConfirmedOrReady ? (
                            <>
                              <span style={{ fontSize: '10.5px', color: '#8a9096', fontStyle: 'italic' }}>Not Admitted</span>
                              <button
                                type="button"
                                onClick={() => handleConfirmAndAdmit(pa)}
                                title="Confirm Pre-Admission and Create Inpatient Admission"
                                style={{
                                  height: '22px', padding: '0 8px', borderRadius: '4px', border: '1px solid #cbd5e1',
                                  background: '#f8fafc', color: '#1e293b', fontSize: '10.5px', fontWeight: 600, cursor: 'pointer'
                                }}
                              >
                                + Admit
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: '10.5px', color: '#8a9096', fontStyle: 'italic' }}>Pending Confirmation</span>
                          )}
                        </div>
                      )}
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
                    <td style={{ padding: '10px 12px', width: '270px', minWidth: '270px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '96px 28px 64px 64px', gap: '6px', alignItems: 'center' }}>
                        {/* 1. Bed Allocation (Eligible only when confirmed/ready) */}
                        {isConfirmedOrReady ? (
                          <button
                            type="button"
                            onClick={() => handleOpenBedModal(pa)}
                            title={hasBed ? `Reallocate Bed (${pa.bed_number})` : 'Allocate Inpatient Bed'}
                            style={{
                              height: '26px', padding: '0 6px', borderRadius: '4px',
                              border: hasBed ? '1px solid #bbf7d0' : '1px solid #fed7aa',
                              background: hasBed ? '#f0fdf4' : '#fff7ed',
                              color: hasBed ? '#166534' : '#c2410c',
                              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                              width: '96px', boxSizing: 'border-box'
                            }}
                          >
                            <BedDouble size={11} /> {hasBed ? 'Bed' : 'Assign Bed'}
                          </button>
                        ) : (
                          <div style={{ width: '96px' }} />
                        )}

                        {/* 2. WhatsApp Notification */}
                        <button
                          type="button"
                          onClick={() => handleNotify(pa.id)}
                          title="Resend WhatsApp Notification"
                          disabled={pa.status === 'CANCELLED'}
                          style={{
                            height: '26px', width: '28px', padding: 0, borderRadius: '4px', border: '1px solid #e3e6e8',
                            background: pa.status === 'CANCELLED' ? '#f8fafc' : '#fff',
                            color: pa.status === 'CANCELLED' ? '#94a3b8' : '#15181b',
                            fontSize: '11px', cursor: pa.status === 'CANCELLED' ? 'not-allowed' : 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            boxSizing: 'border-box'
                          }}
                        >
                          <Send size={11} />
                        </button>

                        {/* 3. WhatsApp Conversation */}
                        <button
                          type="button"
                          onClick={() => handleOpenChat(pa)}
                          title="View Patient WhatsApp Conversation"
                          style={{
                            height: '26px', width: '64px', padding: '0 6px', borderRadius: '4px', border: '1px solid #e3e6e8',
                            background: '#fff', color: '#15181b', fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                            boxSizing: 'border-box'
                          }}
                        >
                          <MessageSquare size={11} color="#25D366" /> Chat
                        </button>

                        {/* 4. Status Update */}
                        <button
                          type="button"
                          onClick={() => handleOpenStatusModal(pa)}
                          title="Update Pre-Admission Status"
                          style={{
                            height: '26px', width: '64px', padding: '0 6px', borderRadius: '4px', border: 0,
                            background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '11px', fontWeight: 600,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            boxSizing: 'border-box'
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
          <div style={{ ...modalBoxStyle, maxWidth: 640 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e3e6e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fbfbfc' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#15181b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BedDouble size={16} color="oklch(0.5 0.1 200)" />
                <span>Register New Pre-Admission</span>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8a9096', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* General Registration/API Error Banner: Top of modal above form */}
            {modalError && (
              <div
                id="modal-registration-error-banner"
                style={{
                  margin: '12px 16px 0 16px',
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  color: '#991b1b',
                  fontSize: '12.5px',
                  lineHeight: '1.4'
                }}
              >
                <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '2px' }}>Registration Error</div>
                  <div>{modalError}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalError(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontSize: '14px',
                    lineHeight: 1
                  }}
                  title="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleCreateAdmission} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <SearchableSelect
                    label="Select Patient"
                    options={patientOptions}
                    value={formPatientId}
                    onChange={val => {
                      setFormPatientId(val);
                      clearFieldError('patient');
                    }}
                    placeholder="-- Search & Select Patient (Name, ID, Phone) --"
                    hasError={Boolean(fieldErrors.patient)}
                    errorMsg={fieldErrors.patient}
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
                    hasError={Boolean(fieldErrors.doctor)}
                    errorMsg={fieldErrors.doctor}
                    required
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Department"
                    options={departmentOptions}
                    value={formDeptId}
                    onChange={handleDeptSelect}
                    placeholder={isDoctorRole ? "-- Auto-filled when Doctor is selected --" : "-- Search & Select Department --"}
                    disabled={isDoctorRole}
                    hasError={Boolean(fieldErrors.department)}
                    errorMsg={fieldErrors.department}
                    required
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <label style={modalLabelStyle}>Admission Type *</label>
                    {fieldErrors.admission_type && (
                      <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 500 }}>
                        {fieldErrors.admission_type}
                      </span>
                    )}
                  </div>
                  <select
                    style={{
                      ...modalSelectStyle,
                      borderColor: fieldErrors.admission_type ? '#ef4444' : '#e3e6e8',
                      boxShadow: fieldErrors.admission_type ? '0 0 0 1px #ef4444' : undefined,
                    }}
                    value={formType}
                    onChange={e => {
                      setFormType(e.target.value);
                      clearFieldError('admission_type');
                    }}
                    required
                  >
                    {ADMISSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <label style={modalLabelStyle}>Expected Date *</label>
                    {fieldErrors.date && (
                      <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 500 }}>
                        {fieldErrors.date}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    style={{
                      ...modalInputStyle,
                      borderColor: fieldErrors.date ? '#ef4444' : '#e3e6e8',
                      boxShadow: fieldErrors.date ? '0 0 0 1px #ef4444' : undefined,
                    }}
                    value={formDate}
                    onChange={e => {
                      setFormDate(e.target.value);
                      clearFieldError('date');
                    }}
                    required
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                    <label style={modalLabelStyle}>Expected Check-in Time</label>
                    {fieldErrors.time && (
                      <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 500 }}>
                        {fieldErrors.time}
                      </span>
                    )}
                  </div>
                  <input
                    type="time"
                    style={{
                      ...modalInputStyle,
                      borderColor: fieldErrors.time ? '#ef4444' : '#e3e6e8',
                      boxShadow: fieldErrors.time ? '0 0 0 1px #ef4444' : undefined,
                    }}
                    value={formTime}
                    onChange={e => {
                      setFormTime(e.target.value);
                      clearFieldError('time');
                    }}
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
                <button type="button" style={btnSecondary} onClick={handleCloseAddModal}>Cancel</button>
                <button
                  type="submit"
                  style={{
                    ...btnPrimary,
                    opacity: submitting ? 0.7 : 1,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                  disabled={submitting}
                >
                  {submitting ? 'Registering Admission...' : 'Register Admission'}
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

      {/* ── Modal: Ward, Room & Bed Allocation ────────────────────────────── */}
      {showBedModal && selectedPa && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalBoxStyle, maxWidth: 520 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e3e6e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fbfbfc' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#15181b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BedDouble size={16} color="oklch(0.5 0.1 200)" />
                  Inpatient Bed Allocation
                </div>
                <div style={{ fontSize: '11px', color: '#8a9096', fontFamily: 'ui-monospace, Menlo, monospace', marginTop: '1px' }}>
                  {selectedPa.pre_admission_code} · {selectedPa.patient_name} ({selectedPa.patient_code})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBedModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8a9096', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAllocateBedSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '11.5px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Attending Doctor: </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedPa.doctor_name}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Department: </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedPa.department_name}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Admission Type: </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedPa.admission_type}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Linked Admission: </span>
                    <span style={{ fontWeight: 600, color: 'oklch(0.5 0.1 200)' }}>
                      {selectedPa.admission_number || 'Will be created & linked on allocation'}
                    </span>
                  </div>
                </div>

                {loadingBeds ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#8a9096' }}>
                    Loading available beds hierarchy...
                  </div>
                ) : availableWards.length === 0 ? (
                  <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '12px' }}>
                    ⚠️ No available beds found in the hospital. Please check Bed Board or discharge recovering patients.
                  </div>
                ) : (
                  <>
                    {/* Ward Selector */}
                    <div>
                      <label style={modalLabelStyle}>1. Select Inpatient Ward *</label>
                      <select
                        style={modalSelectStyle}
                        value={selectedWardId}
                        onChange={e => {
                          const wId = e.target.value;
                          setSelectedWardId(wId);
                          const w = availableWards.find(x => String(x.ward_id) === wId);
                          if (w && w.rooms && w.rooms.length > 0) {
                            setSelectedRoomId(String(w.rooms[0].room_id));
                            if (w.rooms[0].beds && w.rooms[0].beds.length > 0) {
                              setSelectedBedId(String(w.rooms[0].beds[0].bed_id));
                            } else {
                              setSelectedBedId('');
                            }
                          } else {
                            setSelectedRoomId('');
                            setSelectedBedId('');
                          }
                        }}
                        required
                      >
                        <option value="">-- Choose Ward --</option>
                        {availableWards.map(w => (
                          <option key={w.ward_id} value={w.ward_id}>
                            {w.ward_name} (Floor {w.floor_number} · {w.ward_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Room Selector */}
                    <div>
                      <label style={modalLabelStyle}>2. Select Room *</label>
                      <select
                        style={modalSelectStyle}
                        value={selectedRoomId}
                        onChange={e => {
                          const rId = e.target.value;
                          setSelectedRoomId(rId);
                          const w = availableWards.find(x => String(x.ward_id) === selectedWardId);
                          const r = w?.rooms?.find(x => String(x.room_id) === rId);
                          if (r && r.beds && r.beds.length > 0) {
                            setSelectedBedId(String(r.beds[0].bed_id));
                          } else {
                            setSelectedBedId('');
                          }
                        }}
                        disabled={!selectedWardId}
                        required
                      >
                        <option value="">-- Choose Room --</option>
                        {(() => {
                          const w = availableWards.find(x => String(x.ward_id) === selectedWardId);
                          return (w?.rooms || []).map(r => (
                            <option key={r.room_id} value={r.room_id}>
                              Room {r.room_number} ({r.room_type} · {r.beds.length} available bed{r.beds.length > 1 ? 's' : ''})
                            </option>
                          ));
                        })()}
                      </select>
                    </div>

                    {/* Bed Selector */}
                    <div>
                      <label style={modalLabelStyle}>3. Select Bed *</label>
                      <select
                        style={modalSelectStyle}
                        value={selectedBedId}
                        onChange={e => setSelectedBedId(e.target.value)}
                        disabled={!selectedRoomId}
                        required
                      >
                        <option value="">-- Choose Available Bed --</option>
                        {(() => {
                          const w = availableWards.find(x => String(x.ward_id) === selectedWardId);
                          const r = w?.rooms?.find(x => String(x.room_id) === selectedRoomId);
                          return (r?.beds || []).map(b => (
                            <option key={b.bed_id} value={b.bed_id}>
                              {b.bed_number} — {b.bed_type} (₹{b.daily_charge.toLocaleString('en-IN')}/day)
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div style={{ padding: '10px 16px', borderTop: '1px solid #e3e6e8', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#fbfbfc' }}>
                <button type="button" style={btnSecondary} onClick={() => setShowBedModal(false)}>Cancel</button>
                <button
                  type="submit"
                  style={btnPrimary}
                  disabled={bedSubmitting || !selectedBedId}
                >
                  {bedSubmitting ? 'Allocating Bed...' : 'Confirm Bed Allocation'}
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
                <CardGridSkeleton count={2} />
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
