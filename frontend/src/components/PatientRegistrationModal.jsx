import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, CheckCircle2, User, HeartPulse, Building2, ShieldCheck, Phone, AlertCircle, ArrowRight, Lock, BedDouble, Check } from 'lucide-react';
import { apiService, matchesDoctor } from '../services/api';

export default function PatientRegistrationModal({
  isOpen,
  onClose,
  onPatientRegistered,
  onSelectPatient,
  doctorName = null,
  userRole = 'Hospital Management',
  currentUser = null
}) {
  if (!isOpen) return null;

  // Determine if logged-in user is a Doctor or Hospital Management / Admin
  const isDoctor = (userRole?.toLowerCase() === 'doctor') || Boolean(doctorName && userRole !== 'Hospital Management' && userRole !== 'Admin');
  const loggedDoctorName = isDoctor ? (doctorName || currentUser?.name || '') : null;

  const [loadingId, setLoadingId] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Metadata from Database
  const [meta, setMeta] = useState({
    departments: [],
    doctors: [],
    wards: [],
    beds: [],
    insurers: [
      'Star Health & Allied',
      'HDFC ERGO Health',
      'Care Health Insurance',
      'ICICI Lombard Health',
      'Vidal Health TPA',
      'Medi Assist TPA',
      'Self-Pay'
    ],
    blood_groups: ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'],
    languages: ['Tamil', 'English', 'Telugu', 'Malayalam', 'Hindi', 'Kannada']
  });

  // Form State
  const [formData, setFormData] = useState({
    patient_code: '',
    first_name: '',
    last_name: '',
    age: '35',
    date_of_birth: '',
    gender: 'Male',
    phone: '',
    whatsapp_number: '',
    sameAsPhone: true,
    email: '',
    blood_group: 'O+',
    preferred_language: 'Tamil',
    city: 'Chennai',
    state: 'Tamil Nadu',
    address: '',
    patient_type: 'OP', // 'OP', 'IP', 'ER'
    department: 'General Medicine',
    doctor: loggedDoctorName || '',
    ward_id: '',
    room_id: '',
    room_number: '',
    bed_id: '',
    bed_number: '',
    reason: '',
    insurer: 'Self-Pay',
    policy_number: ''
  });

  // Filter doctors based on authenticated role and selected department:
  // - Admin / Hospital Management: show doctors belonging to the selected department
  // - Doctor: show ONLY that logged-in doctor
  const displayedDoctors = useMemo(() => {
    if (!isDoctor) {
      const allDocs = (meta.doctors && meta.doctors.length > 0)
        ? meta.doctors
        : [
            { id: 1, name: 'Dr. Priya Patel', specialization: 'Cardiologist', department_name: 'Cardiology' },
            { id: 2, name: 'Dr. Ravi Reddy', specialization: 'Orthopedist', department_name: 'Orthopedics' },
            { id: 4, name: 'Dr. Vikram Singh', specialization: 'Neurologist', department_name: 'Neurology' },
            { id: 5, name: 'Dr. Neha Nair', specialization: 'Gynecologist', department_name: 'Obstetrics and Gynecology' },
            { id: 6, name: 'Dr. Suresh Menon', specialization: 'Surgeon', department_name: 'General Surgery' },
            { id: 7, name: 'Dr. Divya Verma', specialization: 'ER Physician', department_name: 'Emergency Bay' },
            { id: 8, name: 'Dr. Rahul Kumar', specialization: 'Intensivist', department_name: 'Critical Care' },
            { id: 9, name: 'Dr. Sneha Das', specialization: 'Pathologist', department_name: 'Pathology' }
          ];

      if (!formData.department) {
        return allDocs;
      }

      const selectedDept = formData.department.trim().toLowerCase();

      // Find department obj from meta.departments if available
      const deptObj = meta.departments?.find(
        d => d.name?.trim().toLowerCase() === selectedDept
      );

      const filtered = allDocs.filter(d => {
        // Direct department_id match
        if (deptObj && d.department_id && Number(d.department_id) === Number(deptObj.id)) {
          return true;
        }

        // Direct department_name match
        if (d.department_name) {
          const docDept = d.department_name.trim().toLowerCase();
          if (docDept === selectedDept || docDept.includes(selectedDept) || selectedDept.includes(docDept)) {
            return true;
          }
        }

        // Specialization match
        if (d.specialization) {
          const spec = d.specialization.trim().toLowerCase();
          if (spec === selectedDept || spec.includes(selectedDept) || selectedDept.includes(spec)) {
            return true;
          }
          const roots = ['cardio', 'ortho', 'neuro', 'pediatric', 'pedia', 'gyn', 'surger', 'surg', 'emergen', 'radio', 'patho', 'derma', 'onco', 'nephro', 'pulmo', 'gastro', 'psych', 'ophthalm', 'ent', 'uro', 'dent', 'icu', 'critical'];
          for (const root of roots) {
            if (selectedDept.includes(root) && spec.includes(root)) {
              return true;
            }
          }
        }

        return false;
      });

      return filtered;
    }

    // Logged in as Doctor -> restrict to ONLY this doctor
    if (loggedDoctorName) {
      const match = (meta.doctors || []).find(d =>
        matchesDoctor(d.name, loggedDoctorName) ||
        d.name?.toLowerCase() === loggedDoctorName.toLowerCase() ||
        loggedDoctorName.toLowerCase().includes(d.name?.toLowerCase()) ||
        d.name?.toLowerCase().includes(loggedDoctorName.toLowerCase())
      );
      if (match) {
        return [match];
      }
      return [{
        id: currentUser?.id || 9999,
        name: loggedDoctorName,
        specialization: currentUser?.specialization || currentUser?.dept || 'Attending Physician',
        department_id: currentUser?.department_id || null
      }];
    }

    return meta.doctors || [];
  }, [isDoctor, loggedDoctorName, meta.doctors, meta.departments, formData.department, currentUser]);

  // Synchronize doctor selection and default department according to role
  useEffect(() => {
    if (isDoctor && loggedDoctorName) {
      const doctorItem = displayedDoctors[0];
      const targetDocName = doctorItem?.name || loggedDoctorName;

      setFormData(prev => {
        let matchedDept = prev.department;
        if (doctorItem) {
          if (doctorItem.department_id && meta.departments?.length > 0) {
            const found = meta.departments.find(d => d.id === doctorItem.department_id);
            if (found) matchedDept = found.name;
          } else if (doctorItem.specialization && meta.departments?.length > 0) {
            const found = meta.departments.find(d =>
              d.name.toLowerCase().includes(doctorItem.specialization.toLowerCase()) ||
              doctorItem.specialization.toLowerCase().includes(d.name.toLowerCase())
            );
            if (found) matchedDept = found.name;
          } else if (currentUser?.dept && meta.departments?.length > 0) {
            const found = meta.departments.find(d =>
              d.name.toLowerCase().includes(currentUser.dept.toLowerCase()) ||
              currentUser.dept.toLowerCase().includes(d.name.toLowerCase())
            );
            if (found) matchedDept = found.name;
          }
        }

        return {
          ...prev,
          doctor: targetDocName,
          department: matchedDept
        };
      });
    } else if (!isDoctor && displayedDoctors.length > 0) {
      setFormData(prev => {
        if (!prev.doctor || !displayedDoctors.some(d => d.name === prev.doctor)) {
          return {
            ...prev,
            doctor: displayedDoctors[0].name
          };
        }
        return prev;
      });
    }
  }, [isDoctor, loggedDoctorName, displayedDoctors, meta.departments, currentUser]);

  // Available Wards filtered by encounter type (IP vs ER)
  const availableWards = useMemo(() => {
    if (formData.patient_type === 'OP') return [];
    const isER = formData.patient_type === 'ER';
    const wardsList = meta.wards || [];

    if (isER) {
      const erWards = wardsList.filter(w =>
        Number(w.ward_id) === 8 ||
        (w.type && w.type.toLowerCase().includes('emergency')) ||
        (w.name && w.name.toLowerCase().includes('emergency'))
      );
      return erWards.length > 0 ? erWards : wardsList;
    } else {
      const ipWards = wardsList.filter(w =>
        Number(w.ward_id) !== 8 &&
        !(w.type && w.type.toLowerCase().includes('emergency')) &&
        !(w.name && w.name.toLowerCase().includes('emergency'))
      );
      return ipWards.length > 0 ? ipWards : wardsList;
    }
  }, [formData.patient_type, meta.wards]);

  // Total available beds across filtered wards for this encounter type
  const totalAvailableBedsForType = useMemo(() => {
    const wardIds = new Set(availableWards.map(w => Number(w.ward_id)));
    return (meta.beds || []).filter(b => wardIds.has(Number(b.ward_id))).length;
  }, [availableWards, meta.beds]);

  // Available rooms for currently selected ward
  const availableRoomsForWard = useMemo(() => {
    if (!formData.ward_id) return [];
    const wardIdNum = Number(formData.ward_id);
    const bedsInWard = (meta.beds || []).filter(b => Number(b.ward_id) === wardIdNum);

    const roomMap = new Map();
    bedsInWard.forEach(b => {
      const key = b.room_id || b.room_number;
      if (!roomMap.has(key)) {
        roomMap.set(key, {
          room_id: b.room_id,
          room_number: b.room_number || `RM-${b.room_id}`,
          room_type: b.room_type || 'Standard Care',
          available_beds: 0
        });
      }
      roomMap.get(key).available_beds++;
    });
    return Array.from(roomMap.values());
  }, [formData.ward_id, meta.beds]);

  // Available beds for currently selected room and ward
  const availableBedsForRoom = useMemo(() => {
    if (!formData.ward_id) return [];
    const wardIdNum = Number(formData.ward_id);
    const roomIdNum = formData.room_id ? Number(formData.room_id) : null;

    return (meta.beds || []).filter(b => {
      if (Number(b.ward_id) !== wardIdNum) return false;
      if (roomIdNum && Number(b.room_id) !== roomIdNum) return false;
      return true;
    });
  }, [formData.ward_id, formData.room_id, meta.beds]);

  // Selected Ward & Bed objects for live confirmation badge
  const selectedWardObj = useMemo(() => {
    return (meta.wards || []).find(w => Number(w.ward_id) === Number(formData.ward_id));
  }, [meta.wards, formData.ward_id]);

  const selectedBedObj = useMemo(() => {
    return (meta.beds || []).find(b => Number(b.bed_id) === Number(formData.bed_id));
  }, [meta.beds, formData.bed_id]);

  // Synchronize default Ward, Room, and Bed whenever patient_type or meta changes
  useEffect(() => {
    if (formData.patient_type === 'OP') {
      if (formData.ward_id || formData.bed_id) {
        setFormData(prev => ({
          ...prev,
          ward_id: '',
          room_id: '',
          room_number: '',
          bed_id: '',
          bed_number: ''
        }));
      }
      return;
    }

    if (availableWards.length === 0) return;

    let targetWardId = formData.ward_id;
    if (!targetWardId || !availableWards.some(w => String(w.ward_id) === String(targetWardId))) {
      targetWardId = String(availableWards[0].ward_id);
    }

    const bedsInWard = (meta.beds || []).filter(b => String(b.ward_id) === String(targetWardId));
    const firstBed = bedsInWard[0];

    let targetRoomId = formData.room_id;
    let targetRoomNumber = formData.room_number;
    const roomValid = bedsInWard.some(b => String(b.room_id) === String(targetRoomId));
    if (!roomValid && firstBed) {
      targetRoomId = String(firstBed.room_id);
      targetRoomNumber = firstBed.room_number;
    }

    const bedsInRoom = bedsInWard.filter(b => String(b.room_id) === String(targetRoomId));
    let targetBedId = formData.bed_id;
    let targetBedNumber = formData.bed_number;
    const bedValid = bedsInRoom.some(b => String(b.bed_id) === String(targetBedId));
    if (!bedValid && bedsInRoom.length > 0) {
      targetBedId = String(bedsInRoom[0].bed_id);
      targetBedNumber = bedsInRoom[0].bed_number;
    }

    if (
      formData.ward_id !== targetWardId ||
      formData.room_id !== targetRoomId ||
      formData.room_number !== targetRoomNumber ||
      formData.bed_id !== targetBedId ||
      formData.bed_number !== targetBedNumber
    ) {
      setFormData(prev => ({
        ...prev,
        ward_id: targetWardId,
        room_id: targetRoomId || '',
        room_number: targetRoomNumber || '',
        bed_id: targetBedId || '',
        bed_number: targetBedNumber || ''
      }));
    }
  }, [formData.patient_type, availableWards, meta.beds]);

  const handleWardChange = (newWardId) => {
    const bedsInWard = (meta.beds || []).filter(b => String(b.ward_id) === String(newWardId));
    const firstBed = bedsInWard[0];
    const newRoomId = firstBed ? String(firstBed.room_id) : '';
    const newRoomNumber = firstBed ? firstBed.room_number : '';
    const bedsInRoom = bedsInWard.filter(b => String(b.room_id) === newRoomId);
    const newBedId = bedsInRoom.length > 0 ? String(bedsInRoom[0].bed_id) : '';
    const newBedNumber = bedsInRoom.length > 0 ? bedsInRoom[0].bed_number : '';

    setFormData(prev => ({
      ...prev,
      ward_id: newWardId,
      room_id: newRoomId,
      room_number: newRoomNumber,
      bed_id: newBedId,
      bed_number: newBedNumber
    }));
  };

  const handleRoomChange = (newRoomId) => {
    const bedsInWard = (meta.beds || []).filter(b => String(b.ward_id) === String(formData.ward_id));
    const roomBed = bedsInWard.find(b => String(b.room_id) === String(newRoomId));
    const roomNumber = roomBed ? roomBed.room_number : '';
    const bedsInRoom = bedsInWard.filter(b => String(b.room_id) === String(newRoomId));
    const newBedId = bedsInRoom.length > 0 ? String(bedsInRoom[0].bed_id) : '';
    const newBedNumber = bedsInRoom.length > 0 ? bedsInRoom[0].bed_number : '';

    setFormData(prev => ({
      ...prev,
      room_id: newRoomId,
      room_number: roomNumber,
      bed_id: newBedId,
      bed_number: newBedNumber
    }));
  };

  const handleBedChange = (newBedId) => {
    const foundBed = (meta.beds || []).find(b => String(b.bed_id) === String(newBedId));
    setFormData(prev => ({
      ...prev,
      bed_id: newBedId,
      bed_number: foundBed ? foundBed.bed_number : '',
      room_id: foundBed ? String(foundBed.room_id) : prev.room_id,
      room_number: foundBed ? foundBed.room_number : prev.room_number,
      ward_id: foundBed ? String(foundBed.ward_id) : prev.ward_id
    }));
  };

  const handleDepartmentChange = (newDept) => {
    const selectedDept = (newDept || '').trim().toLowerCase();
    const deptObj = meta.departments?.find(d => d.name?.trim().toLowerCase() === selectedDept);
    const allDocs = (meta.doctors && meta.doctors.length > 0) ? meta.doctors : [];

    const filtered = allDocs.filter(d => {
      if (deptObj && d.department_id && Number(d.department_id) === Number(deptObj.id)) return true;
      if (d.department_name) {
        const docDept = d.department_name.trim().toLowerCase();
        if (docDept === selectedDept || docDept.includes(selectedDept) || selectedDept.includes(docDept)) return true;
      }
      if (d.specialization) {
        const spec = d.specialization.trim().toLowerCase();
        if (spec === selectedDept || spec.includes(selectedDept) || selectedDept.includes(spec)) return true;
        const roots = ['cardio', 'ortho', 'neuro', 'pediatric', 'pedia', 'gyn', 'surger', 'surg', 'emergen', 'radio', 'patho', 'derma', 'onco', 'nephro', 'pulmo', 'gastro', 'psych', 'ophthalm', 'ent', 'uro', 'dent', 'icu', 'critical'];
        for (const root of roots) {
          if (selectedDept.includes(root) && spec.includes(root)) return true;
        }
      }
      return false;
    });

    setFormData(prev => ({
      ...prev,
      department: newDept,
      doctor: filtered.length > 0 ? filtered[0].name : ''
    }));
  };

  // Fetch dynamic next-id and metadata on mount
  useEffect(() => {
    let alive = true;

    async function initData() {
      setLoadingId(true);
      setError('');
      try {
        const [nextIdRes, metaRes] = await Promise.all([
          apiService.getNextPatientId().catch(() => null),
          apiService.getPatientRegistrationMeta().catch(() => null)
        ]);

        if (!alive) return;

        if (nextIdRes && nextIdRes.next_patient_code) {
          setFormData(prev => ({ ...prev, patient_code: nextIdRes.next_patient_code }));
        }

        if (metaRes && (metaRes.departments?.length > 0 || metaRes.wards?.length > 0 || metaRes.beds?.length > 0)) {
          setMeta(prev => ({
            ...prev,
            departments: metaRes.departments?.length > 0 ? metaRes.departments : prev.departments,
            doctors: metaRes.doctors?.length > 0 ? metaRes.doctors : prev.doctors,
            wards: metaRes.wards?.length > 0 ? metaRes.wards : prev.wards,
            beds: metaRes.beds?.length > 0 ? metaRes.beds : prev.beds,
            insurers: metaRes.insurers?.length > 0 ? metaRes.insurers : prev.insurers,
            blood_groups: metaRes.blood_groups || prev.blood_groups,
            languages: metaRes.languages || prev.languages
          }));
        }
      } catch (err) {
        console.error('Failed to load registration data:', err);
      } finally {
        if (alive) setLoadingId(false);
      }
    }

    initData();
    return () => { alive = false; };
  }, []);

  // Sync Age and Date of Birth
  const handleAgeChange = (e) => {
    const ageVal = e.target.value;
    const ageNum = parseInt(ageVal, 10);
    let newDob = formData.date_of_birth;
    if (!isNaN(ageNum) && ageNum >= 0 && ageNum <= 125) {
      const d = new Date();
      d.setFullYear(d.getFullYear() - ageNum);
      newDob = d.toISOString().split('T')[0];
    }
    setFormData(prev => ({ ...prev, age: ageVal, date_of_birth: newDob }));
  };

  const handleDobChange = (e) => {
    const dobVal = e.target.value;
    let newAge = formData.age;
    if (dobVal) {
      const birthDate = new Date(dobVal);
      const today = new Date();
      let diff = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        diff--;
      }
      if (!isNaN(diff) && diff >= 0) newAge = String(diff);
    }
    setFormData(prev => ({ ...prev, date_of_birth: dobVal, age: newAge }));
  };

  // Re-generate fresh dynamic ID from DB
  const handleRefreshId = async () => {
    setLoadingId(true);
    try {
      const res = await apiService.getNextPatientId({ forceRefresh: true });
      if (res && res.next_patient_code) {
        setFormData(prev => ({ ...prev, patient_code: res.next_patient_code }));
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingId(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.first_name.trim()) {
      setError('First name is required.');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Primary phone number is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        patient_code: formData.patient_code.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        age: parseInt(formData.age, 10) || 35,
        date_of_birth: formData.date_of_birth || undefined,
        gender: formData.gender,
        phone: formData.phone.trim(),
        whatsapp_number: formData.sameAsPhone ? formData.phone.trim() : (formData.whatsapp_number.trim() || formData.phone.trim()),
        email: formData.email.trim() || undefined,
        blood_group: formData.blood_group,
        preferred_language: formData.preferred_language,
        city: formData.city.trim(),
        state: formData.state.trim(),
        address: formData.address.trim() || undefined,
        patient_type: formData.patient_type,
        department: formData.department,
        doctor: formData.doctor,
        ward_id: formData.ward_id ? parseInt(formData.ward_id, 10) : undefined,
        room_id: formData.room_id ? parseInt(formData.room_id, 10) : undefined,
        room_number: formData.room_number || undefined,
        bed_id: formData.bed_id ? parseInt(formData.bed_id, 10) : undefined,
        bed_number: formData.bed_number || undefined,
        reason: formData.reason.trim() || (formData.patient_type === 'IP' ? 'Inpatient Admission' : formData.patient_type === 'ER' ? 'Emergency Triage' : 'Routine Consultation'),
        insurer: formData.insurer,
        policy_number: formData.policy_number.trim() || undefined
      };

      const result = await apiService.registerPatient(payload);
      setSuccessData(result.patient || result);
      if (onPatientRegistered) {
        onPatientRegistered(result.patient || result);
      }
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'Registration failed. Please check backend database connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        animation: 'fadeIn 0.15s ease-out'
      }}>

        {/* Modal Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #f8fafc, #f1f5f9)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              background: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <User size={20} />
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                Register New Patient
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Direct database registration with dynamic UHID generator
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Success Screen */}
        {successData ? (
          <div style={{ padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <CheckCircle2 size={36} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
              Patient Registered Successfully!
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '460px', marginBottom: '20px' }}>
              Saved into healthcare database. Master record generated and synchronized across all clinical modules.
            </p>

            {/* Generated Card Details */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px 22px',
              width: '100%',
              maxWidth: '480px',
              textAlign: 'left',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>PATIENT UHID</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                  {successData.patient_code || successData.uhid}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>NAME</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  {successData.patient_name || successData.name}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>CARE DOMAIN</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: successData.patient_type === 'IP' ? '#dbeafe' : successData.patient_type === 'ER' ? '#fee2e2' : '#f1f5f9',
                  color: successData.patient_type === 'IP' ? '#1e40af' : successData.patient_type === 'ER' ? '#991b1b' : '#334155'
                }}>
                  {successData.patient_type === 'IP' ? 'Inpatient (IP)' : successData.patient_type === 'ER' ? 'Emergency (ER)' : 'Outpatient (OP)'}
                </span>
              </div>
              {successData.admission_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>ADMISSION NO.</span>
                  <span style={{ fontSize: '12px', color: '#0f172a', fontFamily: 'monospace' }}>{successData.admission_number} ({successData.bed_number || 'Bed Allocated'})</span>
                </div>
              )}
              {successData.room_number && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>ALLOCATED ROOM & BED</span>
                  <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 700, fontFamily: 'monospace' }}>
                    {successData.room_number} / {successData.bed_number}
                  </span>
                </div>
              )}
              {successData.triage_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>ER TRIAGE & BAY</span>
                  <span style={{ fontSize: '12px', color: '#0f172a', fontFamily: 'monospace' }}>{successData.triage_id} ({successData.bay || successData.bed_number || 'Bay Allocated'})</span>
                </div>
              )}
              {successData.booking_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>BOOKING TOKEN</span>
                  <span style={{ fontSize: '12px', color: '#0f172a', fontFamily: 'monospace' }}>{successData.booking_id}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px dashed #e2e8f0' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>INSURANCE STATUS</span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: (formData.insurer && formData.insurer !== 'Self-Pay') ? '#f3e8ff' : '#f1f5f9',
                  color: (formData.insurer && formData.insurer !== 'Self-Pay') ? '#7e22ce' : '#64748b'
                }}>
                  {(formData.insurer && formData.insurer !== 'Self-Pay') 
                    ? `✓ ${formData.insurer} (${formData.policy_number || 'Covered'})` 
                    : 'Self-Pay (Non-Insured)'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  if (onSelectPatient) onSelectPatient(successData);
                  onClose();
                }}
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: 0,
                  background: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>View Patient 360</span>
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Dynamic UHID Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
                border: '1px solid #bae6fd',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Dynamic Registration UHID (Auto-Assigned from Database)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                      {formData.patient_code || (loadingId ? 'Allocating next ID...' : 'MER-PAT-0087435')}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '10px' }}>
                      ● Dynamic ID Ready
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleRefreshId}
                    disabled={loadingId}
                    style={{
                      height: '28px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid #93c5fd',
                      background: '#ffffff',
                      color: '#0284c7',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: loadingId ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={12} className={loadingId ? 'animate-spin' : ''} />
                    <span>Refresh ID</span>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#dc2626',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. Personal & Contact Details */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={15} color="#0284c7" />
                  <span>Demographics & Contact Information</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      First Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh"
                      value={formData.first_name}
                      onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kumar"
                      value={formData.last_name}
                      onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Age
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="125"
                      value={formData.age}
                      onChange={handleAgeChange}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={handleDobChange}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Gender <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '13px', outline: 'none', background: '#fff' }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Blood Group
                    </label>
                    <select
                      value={formData.blood_group}
                      onChange={e => setFormData({ ...formData, blood_group: e.target.value })}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '13px', outline: 'none', background: '#fff' }}
                    >
                      {meta.blood_groups.map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Phone Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="+91 98400 12345"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Preferred Language
                    </label>
                    <select
                      value={formData.preferred_language}
                      onChange={e => setFormData({ ...formData, preferred_language: e.target.value })}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '13px', outline: 'none', background: '#fff' }}
                    >
                      {meta.languages.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Clinical Care Encounter Selection */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HeartPulse size={15} color="#0284c7" />
                  <span>Clinical Care Type & Encounter Setup</span>
                </div>

                {/* Patient Type Switcher */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  {[
                    { id: 'OP', label: 'Outpatient Clinic (OP)', desc: 'Consultation & Follow-up' },
                    { id: 'IP', label: 'Inpatient Admission (IP)', desc: 'Ward & Bed Allocation' },
                    { id: 'ER', label: 'Emergency Trauma (ER)', desc: 'Immediate Bay Triage' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, patient_type: tab.id })}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: formData.patient_type === tab.id ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        background: formData.patient_type === tab.id ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: formData.patient_type === tab.id ? '#0369a1' : '#334155' }}>
                        {tab.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {tab.desc}
                      </div>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Department / Specialty
                    </label>
                    <select
                      value={formData.department}
                      onChange={e => handleDepartmentChange(e.target.value)}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '13px', outline: 'none', background: '#fff' }}
                    >
                      {meta.departments.length > 0 ? (
                        meta.departments.map(d => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))
                      ) : (
                        ['Cardiology', 'Internal Medicine', 'General Surgery', 'Orthopedics', 'Pediatrics', 'Neurology', 'Emergency Bay'].map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                        Consultant / Attending Doctor
                      </label>
                      {isDoctor ? (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Lock size={10} /> Locked to My Account
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', padding: '1px 6px', borderRadius: '4px' }}>
                          {formData.department ? `${formData.department}: ${displayedDoctors.length} Doctors` : `Doctors (${displayedDoctors.length})`}
                        </span>
                      )}
                    </div>
                    <select
                      value={formData.doctor}
                      disabled={isDoctor || displayedDoctors.length === 0}
                      onChange={e => setFormData({ ...formData, doctor: e.target.value })}
                      style={{
                        width: '100%',
                        height: '34px',
                        border: isDoctor ? '1px solid #94a3b8' : '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0 8px',
                        fontSize: '13px',
                        outline: 'none',
                        background: isDoctor ? '#f8fafc' : '#fff',
                        color: isDoctor ? '#1e293b' : '#0f172a',
                        fontWeight: isDoctor ? 600 : 400,
                        cursor: (isDoctor || displayedDoctors.length === 0) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {displayedDoctors.length === 0 ? (
                        <option value="">No doctors in {formData.department || 'department'}</option>
                      ) : (
                        displayedDoctors.map(d => (
                          <option key={d.id || d.name} value={d.name}>
                            {d.name} {d.specialization ? `(${d.specialization})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                    {isDoctor && (
                      <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '3px', fontWeight: 500 }}>
                        Auto-assigned to your doctor profile: {formData.doctor || loggedDoctorName}
                      </div>
                    )}
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Chief Complaint / Reason for Visit
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Acute chest discomfort, routine cardiac checkup, high fever"
                      value={formData.reason}
                      onChange={e => setFormData({ ...formData, reason: e.target.value })}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Available Ward, Room & Bed Allocation for IP & ER */}
                {formData.patient_type !== 'OP' && (
                  <div style={{
                    marginTop: '12px',
                    background: formData.patient_type === 'ER' ? '#fff1f2' : '#f0f9ff',
                    border: formData.patient_type === 'ER' ? '1px solid #fecdd3' : '1px solid #bae6fd',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {/* Header with live badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: formData.patient_type === 'ER' ? '#e11d48' : '#0284c7',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <BedDouble size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: formData.patient_type === 'ER' ? '#9f1239' : '#0369a1' }}>
                            {formData.patient_type === 'ER' ? 'Emergency Bay, Room & Bed Allocation' : 'Inpatient Ward, Room & Bed Allocation'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Real-time available bed & room inventory from hospital database
                          </div>
                        </div>
                      </div>

                      <div style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: formData.patient_type === 'ER' ? '#be123c' : '#0284c7',
                        background: formData.patient_type === 'ER' ? '#ffe4e6' : '#e0f2fe',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: formData.patient_type === 'ER' ? '#e11d48' : '#0284c7',
                          display: 'inline-block'
                        }} />
                        <span>{totalAvailableBedsForType} Available {formData.patient_type === 'ER' ? 'ER Bays' : 'IP Beds'}</span>
                      </div>
                    </div>

                    {/* 3 Selectors: Ward, Room, Bed */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
                      {/* 1. Ward */}
                      <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                          {formData.patient_type === 'ER' ? 'Emergency Unit' : 'Hospital Ward'} <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          value={formData.ward_id}
                          onChange={e => handleWardChange(e.target.value)}
                          style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12.5px', outline: 'none', background: '#fff', fontWeight: 500 }}
                        >
                          {availableWards.map(w => (
                            <option key={w.ward_id} value={w.ward_id}>
                              {w.name} ({w.type}) {w.available_beds ? `— ${w.available_beds} beds free` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Room */}
                      <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                          {formData.patient_type === 'ER' ? 'Trauma Room / Bay' : 'Available Room'} <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          value={formData.room_id}
                          onChange={e => handleRoomChange(e.target.value)}
                          style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12.5px', outline: 'none', background: '#fff', fontWeight: 500 }}
                        >
                          {availableRoomsForWard.length > 0 ? (
                            availableRoomsForWard.map(r => (
                              <option key={r.room_id} value={r.room_id}>
                                {r.room_number} ({r.room_type}) — {r.available_beds} {r.available_beds === 1 ? 'bed' : 'beds'} free
                              </option>
                            ))
                          ) : (
                            <option value="">No rooms available</option>
                          )}
                        </select>
                      </div>

                      {/* 3. Bed */}
                      <div>
                        <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                          Available Bed <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <select
                          value={formData.bed_id}
                          onChange={e => handleBedChange(e.target.value)}
                          style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '12.5px', outline: 'none', background: '#fff', fontWeight: 600, color: '#0f172a' }}
                        >
                          {availableBedsForRoom.length > 0 ? (
                            availableBedsForRoom.map(b => (
                              <option key={b.bed_id} value={b.bed_id}>
                                {b.bed_number} — {b.bed_type}
                              </option>
                            ))
                          ) : (
                            <option value="">No beds available in selected room</option>
                          )}
                        </select>
                      </div>
                    </div>

                    {/* Selected Allocation Confirmation Card */}
                    {selectedBedObj && (
                      <div style={{
                        background: '#ffffff',
                        border: formData.patient_type === 'ER' ? '1px dashed #f43f5e' : '1px dashed #38bdf8',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Selected Ward</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                              {selectedWardObj?.name || selectedBedObj?.ward_name}
                            </div>
                          </div>
                          <div style={{ borderLeft: '1px solid #e2e8f0', height: '22px' }} />
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Assigned Room</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                              {selectedBedObj?.room_number || formData.room_number || 'Room'} <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'inherit', fontWeight: 500 }}>({selectedBedObj?.room_type || 'Standard Care'})</span>
                            </div>
                          </div>
                          <div style={{ borderLeft: '1px solid #e2e8f0', height: '22px' }} />
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Allocated Bed</div>
                            <div style={{ fontSize: '12.5px', fontWeight: 800, color: formData.patient_type === 'ER' ? '#e11d48' : '#0284c7', fontFamily: 'monospace' }}>
                              {selectedBedObj?.bed_number} <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'inherit', fontWeight: 500 }}>— {selectedBedObj?.bed_type}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#16a34a',
                          background: '#dcfce7',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Check size={13} />
                          <span>Status: Available</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Insurance & Payer Details */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={15} color="#0284c7" />
                  <span>Insurance & Payor Coverage</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Insurer / TPA
                    </label>
                    <select
                      value={formData.insurer}
                      onChange={e => setFormData({ ...formData, insurer: e.target.value })}
                      style={{ width: '100%', height: '34px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 8px', fontSize: '13px', outline: 'none', background: '#fff' }}
                    >
                      {meta.insurers.map(ins => (
                        <option key={ins} value={ins}>{ins}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                      Policy / Card Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. POL-884029-TN"
                      disabled={formData.insurer === 'Self-Pay'}
                      value={formData.policy_number}
                      onChange={e => setFormData({ ...formData, policy_number: e.target.value })}
                      style={{
                        width: '100%',
                        height: '34px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0 10px',
                        fontSize: '13px',
                        outline: 'none',
                        background: formData.insurer === 'Self-Pay' ? '#f8fafc' : '#ffffff'
                      }}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Allocated ID: <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>{formData.patient_code || 'Auto'}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    height: '34px',
                    padding: '0 20px',
                    borderRadius: '6px',
                    border: 0,
                    background: submitting ? '#93c5fd' : '#0284c7',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {submitting && <RefreshCw size={14} className="animate-spin" />}
                  <span>{submitting ? 'Registering to DB...' : 'Save & Register Patient'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
