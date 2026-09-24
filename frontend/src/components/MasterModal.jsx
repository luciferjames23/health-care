import React, { useState } from 'react';

export const MASTER_CONFIGS = {
  drugs: {
    title: 'Add Drug',
    fields: [
      { name: 'generic', label: 'Generic Name', type: 'text', placeholder: 'e.g. Paracetamol' },
      { name: 'name', label: 'Name (Strength · Form)', type: 'text', placeholder: 'e.g. Paracetamol 650mg Tablet' },
      { name: 'brand', label: 'Brand', type: 'text', placeholder: 'e.g. Calpol / Dolo' },
      { name: 'form', label: 'Form', type: 'select', options: ['Tablet', 'Injection', 'Capsule', 'Syrup', 'Tablet / Injection'] },
      { name: 'strength', label: 'Strength', type: 'text', placeholder: 'e.g. 650 mg' },
      { name: 'schedule', label: 'Schedule', type: 'select', options: ['H', 'OTC', 'H1', 'X (narcotic)'] },
      { name: 'route', label: 'Route', type: 'select', options: ['PO', 'IV', 'SC', 'IM', 'PO/IV', 'Topical'] }
    ]
  },
  patients: {
    title: 'Register Patient',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', placeholder: 'e.g. Ramesh Kumar' },
      { name: 'age', label: 'Age', type: 'number', placeholder: '45' },
      { name: 'sex', label: 'Sex', type: 'select', options: ['Female', 'Male', 'Other'] },
      { name: 'lang', label: 'Preferred Language', type: 'select', options: ['Tamil', 'English', 'Telugu', 'Malayalam', 'Hindi'] },
      { name: 'phone', label: 'Phone Number', type: 'text', placeholder: '+91 98400 12345' },
      { name: 'dept', label: 'Department', type: 'select', options: ['Cardiology', 'Internal Medicine', 'General Surgery', 'Orthopedics', 'Pediatrics', 'Neurology', 'Emergency Bay'] },
      { name: 'doctor', label: 'Consultant Doctor', type: 'select', options: ['Dr. Arjun Menon', 'Dr. Priya Narayanan', 'Dr. Sanjay Gupta', 'Dr. Rajesh Sharma', 'Dr. Anita Roy', 'Dr. Pooja Menon'] },
      { name: 'insurer', label: 'Insurer / TPA', type: 'select', options: ['Star Health & Allied', 'HDFC ERGO Health', 'Care Health Insurance', 'ICICI Lombard Health', 'Vidal Health TPA', 'Self-Pay'] },
      { name: 'blood', label: 'Blood Group', type: 'select', options: ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'] }
    ]
  },
  doctors: {
    title: 'Add Doctor / Consultant',
    fields: [
      { name: 'name', label: 'Name (Dr.)', type: 'text', placeholder: 'Dr. John Doe' },
      { name: 'dept', label: 'Department / Specialty', type: 'select', options: ['Cardiology', 'Internal Medicine', 'General Surgery', 'Orthopedics', 'Pediatrics', 'Neurology', 'Radiology', 'Pathology'] },
      { name: 'qualification', label: 'Qualification', type: 'text', placeholder: 'MBBS, MD, DM' },
      { name: 'regNo', label: 'Medical Council Reg No', type: 'text', placeholder: 'MCI-TN-2024-8841' }
    ]
  },
  staff: {
    title: 'Add User / Employee',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', placeholder: 'e.g. Priya Sundaram' },
      { name: 'role', label: 'Designation / Role', type: 'select', options: ['Staff Nurse', 'Front Office Executive', 'Insurance Executive', 'Billing Executive', 'Lab Technician', 'Pharmacist', 'Store Keeper', 'HR Executive'] },
      { name: 'unit', label: 'Department / Unit', type: 'select', options: ['Inpatient Wards', 'Emergency Bay', 'Front Office', 'Billing Desk', 'Central Laboratory', 'Pharmacy', 'Human Resources'] },
      { name: 'shift', label: 'Shift', type: 'select', options: ['Morning', 'Evening', 'Night', 'General'] },
      { name: 'status', label: 'Status', type: 'select', options: ['On duty', 'On leave'] }
    ]
  },
  departments: {
    title: 'Add Department',
    fields: [
      { name: 'name', label: 'Department Name', type: 'text', placeholder: 'e.g. Gastroenterology' },
      { name: 'head', label: 'Department Head', type: 'select', options: ['Dr. Arjun Menon', 'Dr. Priya Narayanan', 'Dr. Sanjay Gupta', 'Dr. Rajesh Sharma'] },
      { name: 'floor', label: 'Floor / Wing', type: 'text', placeholder: '3rd Floor, Block B' }
    ]
  },
  services: {
    title: 'Add Clinical / Hospital Service',
    fields: [
      { name: 'name', label: 'Service Description', type: 'text', placeholder: 'e.g. 2D Echocardiography' },
      { name: 'category', label: 'Category', type: 'select', options: ['Consultation', 'Room', 'Laboratory', 'Radiology', 'Procedure', 'Implant', 'Pharmacy', 'Canteen', 'Package'] },
      { name: 'price', label: 'Standard Price (₹)', type: 'number', placeholder: '3500' },
      { name: 'taxCode', label: 'Tax SAC / HSN Code', type: 'text', placeholder: 'SAC 9993 (Exempt)' }
    ]
  },
  vendors: {
    title: 'Add Empanelled Vendor',
    fields: [
      { name: 'name', label: 'Vendor Legal Name', type: 'text', placeholder: 'e.g. Apollo Diagnostics Supplies Ltd' },
      { name: 'type', label: 'Vendor Type', type: 'select', options: ['Medical Supplies', 'Pharmacy', 'Laboratory', 'Equipment', 'Maintenance', 'IT', 'Housekeeping', 'Food/Canteen'] },
      { name: 'contact', label: 'Contact Person', type: 'text', placeholder: 'S. Kothari' },
      { name: 'phone', label: 'Phone', type: 'text', placeholder: '+91 98410 55667' },
      { name: 'email', label: 'Email', type: 'text', placeholder: 'orders@vendor.com' },
      { name: 'gstin', label: 'GSTIN', type: 'text', placeholder: '33AABCP1234F1Z5' },
      { name: 'terms', label: 'Payment Terms', type: 'select', options: ['Net 30', 'Net 45', 'Net 60', 'Advance'] },
      { name: 'contractEnd', label: 'Contract End Date', type: 'date' }
    ]
  },
  insurers: {
    title: 'Add Insurer / TPA Provider',
    fields: [
      { name: 'name', label: 'Insurance Company', type: 'text', placeholder: 'e.g. Max Bupa Health' },
      { name: 'tpa', label: 'Designated TPA', type: 'text', placeholder: 'Medi Assist TPA' },
      { name: 'method', label: 'Settlement Method', type: 'select', options: ['Cashless', 'Reimbursement', 'Cashless + Reimbursement'] },
      { name: 'network', label: 'Network Status', type: 'select', options: ['In-network (Empanelled)', 'Out-of-network', 'Pending MoU'] },
      { name: 'auth', label: 'Pre-auth Window SLA', type: 'text', placeholder: '4 hours cashless TAT' }
    ]
  },
  taxes: {
    title: 'Add GST / Tax Rule',
    fields: [
      { name: 'name', label: 'Rule Description', type: 'text', placeholder: 'Pharmacy Consumables GST 12%' },
      { name: 'cgst', label: 'CGST Rate (%)', type: 'number', placeholder: '6' },
      { name: 'sgst', label: 'SGST Rate (%)', type: 'number', placeholder: '6' },
      { name: 'hsn', label: 'HSN / SAC Code', type: 'text', placeholder: '3004' },
      { name: 'applies', label: 'Applies To', type: 'text', placeholder: 'Medicines & Surgical Disposables' }
    ]
  }
};

const WIZARD_STEPS = [
  'Identity',
  'Instructions',
  'Knowledge',
  'Tools',
  'Memory',
  'Access',
  'Model',
  'Review'
];

const AVAILABLE_TOOLS = [
  'Patient Search',
  'Appointment API',
  'HMS',
  'EMR',
  'LIS',
  'RIS',
  'PACS',
  'Billing',
  'Insurance / TPA',
  'Pharmacy',
  'Housekeeping',
  'Scheduling',
  'Messaging',
  'Notification',
  'Document Generator'
];

export default function MasterModal({ modal, onClose, onSubmit, role = 'Hospital Management' }) {
  if (!modal) return null;

  const { kind, title, coll, text, data: initialData = {} } = modal;
  const [formData, setFormData] = useState(initialData || {});
  const [reason, setReason] = useState(modal.reason || '');
  const [step, setStep] = useState(modal.step || 0);
  const [error, setError] = useState('');

  const handleChange = (k, v) => {
    setFormData(prev => ({ ...prev, [k]: v }));
    setError('');
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const config = MASTER_CONFIGS[coll];
    if (config?.fields?.some(f => f.name === 'name') && !formData.name) {
      setError('Name is required');
      return;
    }
    if (onSubmit) onSubmit({ kind, coll, data: formData });
    alert(`Successfully saved ${config?.title || 'Record'}!`);
    onClose();
  };

  const handleAdmitSubmit = (e) => {
    e.preventDefault();
    if (!formData.reason) {
      setError('Clinical reason for admission is required');
      return;
    }
    if (onSubmit) onSubmit({ kind: 'admit', data: formData });
    alert(`Admission confirmed for patient encounter. Allocated bed.`);
    onClose();
  };

  const handleApptSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit({ kind: 'appt', data: formData });
    alert(`Appointment successfully scheduled! Token generated.`);
    onClose();
  };

  const handleReasonSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }
    if (modal.on) modal.on(reason);
    if (onSubmit) onSubmit({ kind: 'reason', reason });
    onClose();
  };

  const handleConfirmSubmit = () => {
    if (modal.on) modal.on();
    if (onSubmit) onSubmit({ kind: 'confirm' });
    onClose();
  };

  const handleWizardCreate = () => {
    if (onSubmit) onSubmit({ kind: 'wizard', data: formData });
    alert(`Agent "${formData.nameEn || 'Clinical Agent'}" successfully configured and registered!`);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(21, 24, 27, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.16s ease-out'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          width: 'min(640px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '22px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          animation: 'modalIn 0.18s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              {title || 'Action Window'}
            </div>
            {coll && MASTER_CONFIGS[coll] && (
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                Master registry · Governed platform catalogue
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '30px',
                width: '30px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#64748b',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
            ⚠️ {error}
          </div>
        )}

        {/* 1. CONFIRM MODAL */}
        {kind === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#475569', fontSize: '13px' }}>
              {text || 'Please confirm this action.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                style={{ height: '32px', padding: '0 16px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
              >
                Confirm as {role}
              </button>
            </div>
          </div>
        )}

        {/* 2. REASON MODAL (Reject, Request Changes, Break-glass, Pause, Upload) */}
        {kind === 'reason' && (
          <form onSubmit={handleReasonSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ color: '#475569', fontSize: '13px', lineHeight: 1.5 }}>
              {text || 'Please provide details or reason for this audit event:'}
            </div>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              placeholder="Reason or justification (recorded in the audit trail and presented to downstream reviewers)..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ height: '32px', padding: '0 16px', borderRadius: '6px', border: 0, background: 'oklch(0.45 0.17 25)', color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
              >
                Submit Audit Entry
              </button>
            </div>
          </form>
        )}

        {/* 3. CREATE / EDIT MASTER FORM */}
        {kind === 'create' && coll && MASTER_CONFIGS[coll] && (
          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {MASTER_CONFIGS[coll].fields.map((field) => (
                <label key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>{field.label}</span>
                  {field.type === 'select' ? (
                    <select
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                    >
                      <option value="">Select...</option>
                      {(field.options || []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      placeholder={field.placeholder || ''}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleChange(field.name, e.target.value)}
                      style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  )}
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
              >
                Save {MASTER_CONFIGS[coll].title}
              </button>
            </div>
          </form>
        )}

        {/* 4. ADMIT PATIENT MODAL */}
        {kind === 'admit' && (
          <form onSubmit={handleAdmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Patient ID / Name</span>
                <input
                  type="text"
                  value={formData.patientId || formData.name || 'Kavitha Raman'}
                  onChange={(e) => handleChange('patientId', e.target.value)}
                  style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Department</span>
                <select
                  value={formData.dept || 'Cardiology'}
                  onChange={(e) => handleChange('dept', e.target.value)}
                  style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                >
                  <option value="Cardiology">Cardiology</option>
                  <option value="General Surgery">General Surgery</option>
                  <option value="Internal Medicine">Internal Medicine</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Neurology">Neurology</option>
                  <option value="ICU / Critical Care">ICU / Critical Care</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Bed Class</span>
                <select
                  value={formData.cls || 'General'}
                  onChange={(e) => handleChange('cls', e.target.value)}
                  style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                >
                  <option value="General">General Ward</option>
                  <option value="Semi-Private">Semi-Private Room</option>
                  <option value="Single Private">Single Private Suite</option>
                  <option value="ICU">Intensive Care Unit (ICU)</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Estimated Cost Package (₹)</span>
                <input
                  type="number"
                  value={formData.estimate || 120000}
                  onChange={(e) => handleChange('estimate', e.target.value)}
                  style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </label>

              <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Clinical Admission Diagnosis & Reason</span>
                <textarea
                  rows={3}
                  value={formData.reason || ''}
                  onChange={(e) => handleChange('reason', e.target.value)}
                  placeholder="Primary clinical indication, admission orders, surgical procedure planned..."
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
              >
                Confirm Admission
              </button>
            </div>
          </form>
        )}

        {/* 5. NEW APPOINTMENT MODAL */}
        {kind === 'appt' && (
          <form onSubmit={handleApptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Patient Name</span>
                <input
                  type="text"
                  value={formData.patientName || 'Kavitha Raman'}
                  onChange={(e) => handleChange('patientName', e.target.value)}
                  style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Doctor</span>
                <select
                  value={formData.doctorId || 'Dr. Arjun Menon'}
                  onChange={(e) => handleChange('doctorId', e.target.value)}
                  style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                >
                  <option value="Dr. Arjun Menon">Dr. Arjun Menon (Cardiology)</option>
                  <option value="Dr. Priya Narayanan">Dr. Priya Narayanan (Internal Med)</option>
                  <option value="Dr. Sanjay Gupta">Dr. Sanjay Gupta (Neurology)</option>
                  <option value="Dr. Rajesh Sharma">Dr. Rajesh Sharma (Orthopedics)</option>
                  <option value="Dr. Anita Roy">Dr. Anita Roy (Pediatrics)</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Preferred Time Slot</span>
                <select
                  value={formData.time || '10:30 AM'}
                  onChange={(e) => handleChange('time', e.target.value)}
                  style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                >
                  <option value="09:30 AM">09:30 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="10:30 AM">10:30 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="02:00 PM">02:00 PM</option>
                  <option value="04:30 PM">04:30 PM</option>
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: '#475569', fontWeight: 600 }}>Consultation Type</span>
                <select
                  value={formData.type || 'In-Person Consultation'}
                  onChange={(e) => handleChange('type', e.target.value)}
                  style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                >
                  <option value="In-Person Consultation">In-Person Consultation</option>
                  <option value="Follow-up Review">Follow-up Review</option>
                  <option value="Pre-Op Assessment">Pre-Op Assessment</option>
                  <option value="Telehealth Video Call">Telehealth Video Call</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
              >
                Book Appointment
              </button>
            </div>
          </form>
        )}

        {/* 6. AGENT STUDIO 8-STEP WIZARD */}
        {kind === 'wizard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px' }}>
              {WIZARD_STEPS.map((sName, i) => (
                <div
                  key={sName}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: i === step ? 700 : 500,
                    background: i === step ? 'oklch(0.5 0.1 200)' : i < step ? '#e2e8f0' : '#f8fafc',
                    color: i === step ? '#ffffff' : i < step ? '#1e293b' : '#94a3b8',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {i + 1}. {sName}
                </div>
              ))}
            </div>

            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Agent Name (English)</span>
                  <input
                    type="text"
                    value={formData.nameEn || 'Discharge Orchestration Agent v1'}
                    onChange={(e) => handleChange('nameEn', e.target.value)}
                    style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Agent Name (Tamil / Regional)</span>
                  <input
                    type="text"
                    value={formData.nameTa || 'டிஸ்சார்ஜ் ஒருங்கிணைப்பு முகவர்'}
                    onChange={(e) => handleChange('nameTa', e.target.value)}
                    style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>Purpose & Domain Scope</span>
                  <textarea
                    rows={3}
                    value={formData.purpose || 'Coordinate inpatient discharge dependencies, identify clinical blockers, generate discharge summary, and release ward beds.'}
                    onChange={(e) => handleChange('purpose', e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                  />
                </label>
              </div>
            )}

            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>System Prompt & Behavioral Guidelines</span>
                  <textarea
                    rows={6}
                    value={formData.prompt || 'You are an AI Clinical Assistant governed under NABH & hospital protocols. Always verify patient identities with MRN and enforce clinician sign-offs on any discharge action.'}
                    onChange={(e) => handleChange('prompt', e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                  />
                </label>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>Governed Knowledge Corpus Access</span>
                {['Hospital Discharge SOP v3.2', 'NABH Clinical Standards 2026', 'Medication Safety Guidelines', 'TPA Cashless Pre-Auth Protocols'].map((doc) => (
                  <label key={doc} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                    <input type="checkbox" defaultChecked />
                    <span>{doc}</span>
                  </label>
                ))}
              </div>
            )}

            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>Enabled Tools & Integration Capabilities</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {AVAILABLE_TOOLS.map(t => {
                    const selected = (formData.tools || ['Patient Search', 'EMR', 'LIS', 'RIS', 'Document Generator']).includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          const current = formData.tools || ['Patient Search', 'EMR', 'LIS', 'RIS', 'Document Generator'];
                          const next = selected ? current.filter(x => x !== t) : [...current, t];
                          handleChange('tools', next);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: selected ? '1px solid #0f172a' : '1px solid #cbd5e1',
                          background: selected ? '#0f172a' : '#ffffff',
                          color: selected ? '#ffffff' : '#475569'
                        }}
                      >
                        {selected ? '✓ ' : '+ '}{t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step >= 4 && (
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px', lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                  {step === 4 && 'Memory & Context Window Configuration: 128k context, short-term session state, audit log persistence.'}
                  {step === 5 && 'Access Control & Guardrails: Governed by role-based authorization. High-tier actions require Human-in-the-Loop.'}
                  {step === 6 && 'Foundation Model Selection: Meta-Llama-3-3-70b-Instruct (Serving Endpoint active).'}
                  {step === 7 && 'Review & Publish: Ready for deployment to active orchestrator.'}
                </div>
                <div style={{ color: '#64748b' }}>
                  Agent configuration is validated against hospital AI safety parameters.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step === 0}
                style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: step === 0 ? 'not-allowed' : 'pointer', opacity: step === 0 ? 0.5 : 1 }}
              >
                Previous
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ height: '32px', padding: '0 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                {step < WIZARD_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep(s => Math.min(WIZARD_STEPS.length - 1, s + 1))}
                    style={{ height: '32px', padding: '0 16px', borderRadius: '6px', border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Next Step →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleWizardCreate}
                    style={{ height: '32px', padding: '0 18px', borderRadius: '6px', border: 0, background: 'oklch(0.4 0.12 150)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    🚀 Publish Agent
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
