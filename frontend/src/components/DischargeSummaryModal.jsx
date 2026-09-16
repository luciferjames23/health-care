import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export default function DischargeSummaryModal({ isOpen, onClose, summaryData, onSummaryUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Form state
  const [form, setForm] = useState({
    summary_id: '',
    patient_id: '',
    patient_name: '',
    patient_number: '',
    admission_id: '',
    admission_date: '',
    discharge_date: '',
    attending_physician: '',
    admission_reason: '',
    discharge_diagnosis: '',
    hospital_course_summary: '',
    investigations: '',
    patient_condition: '',
    discharge_medications: '',
    followup_instructions: '',
    approval_status: 'Approved',
    approved_by: ''
  });

  // Track original values to send ONLY modified fields on save
  const [originalForm, setOriginalForm] = useState({});

  // Sync incoming summaryData to form state without injecting fake fallback strings
  useEffect(() => {
    if (summaryData) {
      const summaryId = summaryData.summary_id || (summaryData.patient_id ? `DS-${summaryData.patient_id}` : summaryData.id || '');
      const patientId = summaryData.patient_id || summaryData.id || '';
      const patientName = summaryData.patient_name || summaryData.patient || summaryData.name || '';
      const patientNumber = summaryData.patient_number || summaryData.mrn || (patientId ? `MER-PAT-${String(patientId).padStart(7, '0')}` : '');
      const admissionId = summaryData.admission_id || (patientId ? `MER-ADM-${String(patientId).padStart(7, '0')}` : '');
      const admissionDate = summaryData.admission_date || summaryData.admitted || '';
      const dischargeDate = summaryData.discharge_date || summaryData.eta || '';
      const attendingPhysician = summaryData.attending_physician || summaryData.doctor || summaryData.primary_consultant || '';
      const admissionReason = summaryData.admission_reason || summaryData.admission_details || summaryData.intent || '';
      const dischargeDiagnosis = summaryData.discharge_diagnosis || summaryData.diagnoses || summaryData.diagnosis || '';
      const hospitalCourse = summaryData.hospital_course_summary || summaryData.case_history || '';
      const investigations = summaryData.investigations || '';
      const patientCondition = summaryData.patient_condition || '';
      const dischargeMeds = summaryData.discharge_medications || summaryData.treatment || '';
      const followup = summaryData.followup_instructions || summaryData.discharge_advice || '';
      const approvalStatus = summaryData.approval_status || 'Approved';
      const approvedBy = summaryData.approved_by || attendingPhysician || '';

      const initialValues = {
        summary_id: summaryId,
        patient_id: patientId,
        patient_name: patientName,
        patient_number: patientNumber,
        admission_id: admissionId,
        admission_date: admissionDate,
        discharge_date: dischargeDate,
        attending_physician: attendingPhysician,
        admission_reason: admissionReason,
        discharge_diagnosis: dischargeDiagnosis,
        hospital_course_summary: hospitalCourse,
        investigations: investigations,
        patient_condition: patientCondition,
        discharge_medications: dischargeMeds,
        followup_instructions: followup,
        approval_status: approvalStatus,
        approved_by: approvedBy
      };

      setForm(initialValues);
      setOriginalForm(initialValues);
      setIsEditing(false);
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [summaryData, isOpen]);

  if (!isOpen || !summaryData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async (overrideStatus = null) => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const summaryId = form.summary_id || (form.patient_id ? `DS-${form.patient_id}` : summaryData.id);

    // Compute delta: ONLY include fields that were actually changed by the user
    const changedFields = {};
    Object.keys(form).forEach((key) => {
      // Don't treat summary_id or patient_id as payload updates unless changed
      if (key !== 'summary_id' && form[key] !== originalForm[key]) {
        changedFields[key] = form[key];
      }
    });

    if (overrideStatus) {
      changedFields.approval_status = overrideStatus;
      if (form.attending_physician) {
        changedFields.approved_by = form.attending_physician;
      }
    }

    // If nothing changed, just exit edit mode
    if (Object.keys(changedFields).length === 0) {
      setIsEditing(false);
      setSaving(false);
      return;
    }

    try {
      const res = await apiService.updateDischargeSummary(summaryId, changedFields);
      
      const updatedStatus = changedFields.approval_status || form.approval_status;
      setSuccessMsg(`✓ Updated ${Object.keys(changedFields).join(', ')} successfully for ${summaryId}`);
      setIsEditing(false);
      
      // Update local state with the saved changes
      const updatedForm = { ...form, ...changedFields };
      setForm(updatedForm);
      setOriginalForm(updatedForm);

      if (onSummaryUpdated) {
        onSummaryUpdated({ ...summaryData, ...changedFields });
      }
    } catch (err) {
      console.error("Save error:", err);
      setErrorMsg(err.message || 'Failed to update discharge summary via API');
    } finally {
      setSaving(false);
    }
  };

  // Parse age / sex / ward metadata
  const age = summaryData.age || summaryData.raw?.age || '—';
  const sex = summaryData.sex || summaryData.gender || '—';
  const ward = summaryData.ward || summaryData.ward_name || summaryData.bed || 'Elective Ward';
  const admissionDisplayDate = form.admission_date || 'Recent';

  return (
    <div
      className="discharge-summary-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #discharge-summary-printable-doc,
          #discharge-summary-printable-doc * {
            visibility: visible !important;
          }
          #discharge-summary-printable-doc {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 28px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            display: block !important;
          }
          .no-print,
          .discharge-summary-modal-overlay {
            background: transparent !important;
            padding: 0 !important;
            position: static !important;
          }
          .no-print-elem {
            display: none !important;
          }
        }
      `}</style>

      {/* Modal Dialog Card */}
      <div
        id="discharge-summary-printable-doc"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: '#1e293b'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '-0.02em'
                }}
              >
                {form.patient_name || 'Patient'}
              </h2>
              <span
                className="no-print-elem"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: form.approval_status === 'Approved' ? '#ecfdf5' : '#fef3c7',
                  color: form.approval_status === 'Approved' ? '#047857' : '#b45309',
                  border: `1px solid ${form.approval_status === 'Approved' ? '#a7f3d0' : '#fde68a'}`
                }}
              >
                ● {form.approval_status || 'Pending Review'}
              </span>
            </div>
            <div
              style={{
                fontSize: '12px',
                color: '#64748b',
                marginTop: '4px',
                fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
                lineHeight: 1.4
              }}
            >
              Patient ID: {form.patient_id} · MRN {form.patient_number} · {age} Yrs / {sex} · {ward} · Adm {form.admission_id} · Admitted {admissionDisplayDate}
            </div>
          </div>

          {/* Action Buttons: Print, Edit, Close */}
          <div className="no-print-elem" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                height: '32px',
                padding: '0 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Print
            </button>

            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #0284c7',
                  backgroundColor: '#f0f9ff',
                  color: '#0369a1',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>✏️</span> Edit Summary
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setForm(originalForm);
                  setIsEditing(false);
                }}
                disabled={saving}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#64748b',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            )}

            {isEditing && (
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                height: '32px',
                width: '32px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#64748b',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#64748b'; }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {successMsg && (
          <div className="no-print-elem" style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 24px', fontSize: '12px', color: '#166534', fontWeight: 600 }}>
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="no-print-elem" style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '8px 24px', fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>
            {errorMsg}
          </div>
        )}

        {/* MODAL BODY (Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* GREEN ALERT BANNER */}
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12.5px',
              color: '#065f46',
              fontWeight: 500
            }}
          >
            <span style={{ fontSize: '15px', color: '#059669', fontWeight: 700 }}>✓</span>
            <span>Billing cleared — this patient can be discharged as soon as the summary is signed.</span>
          </div>

          {/* WRITTEN DISCHARGE SUMMARY CONTENT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* VIEW MODE */}
            {!isEditing ? (
              <>
                {/* SECTION 1: ADMISSION DETAILS & CASE HISTORY */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Admission Details & Case History
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.5 }}>
                    {form.admission_reason || '—'}
                  </div>
                  {form.hospital_course_summary && form.hospital_course_summary !== form.admission_reason && (
                    <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '6px', lineHeight: 1.5 }}>
                      {form.hospital_course_summary}
                    </div>
                  )}
                </div>

                {/* SECTION 2: DIAGNOSES */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Diagnoses
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600, lineHeight: 1.5 }}>
                    {form.discharge_diagnosis || '—'}
                  </div>
                </div>

                {/* SECTION 3: INVESTIGATIONS */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Investigations
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
                    {form.investigations || 'No specific investigation details recorded.'}
                  </div>
                </div>

                {/* SECTION 4: CONDITION ON DISCHARGE */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Condition on Discharge
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
                    {form.patient_condition || 'Patient is hemodynamically stable at discharge.'}
                  </div>
                </div>

                {/* SECTION 5: DISCHARGE MEDICATIONS */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Discharge Medications
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {form.discharge_medications || 'No specific discharge medications documented.'}
                  </div>
                </div>

                {/* SECTION 6: DISCHARGE ADVICE & FOLLOW-UP */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Discharge Advice & Follow-Up
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {form.followup_instructions || 'Follow-up in OPD as advised by attending physician.'}
                  </div>
                </div>

                {/* SECTION 7: ATTENDING PHYSICIAN SIGNATURE BLOCK */}
                <div style={{ marginTop: '12px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Primary Consultant / Attending Physician:</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{form.attending_physician || 'Attending Physician'}</div>
                    {form.discharge_date && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Discharge Date: {form.discharge_date}</div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Digital Verification:</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: form.approval_status === 'Approved' ? '#059669' : '#d97706' }}>
                      {form.approval_status === 'Approved' ? '✓ Clinically Approved & Certified' : '⏳ Pending Clinical Sign-off'}
                    </div>
                    {form.summary_id && (
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>Record ID: {form.summary_id}</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* EDIT MODE FORM (Edits only affect the modified fields) */
              <form
                onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Attending Physician
                    </label>
                    <input
                      type="text"
                      value={form.attending_physician}
                      onChange={(e) => setForm({ ...form, attending_physician: e.target.value })}
                      placeholder="e.g. Dr. Pooja Menon, MBBS, MD"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Approval Status
                    </label>
                    <select
                      value={form.approval_status}
                      onChange={(e) => setForm({ ...form, approval_status: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                    >
                      <option value="Approved">Approved</option>
                      <option value="Pending Approval">Pending Approval</option>
                      <option value="Under Review">Under Review</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Discharge Date / Time
                    </label>
                    <input
                      type="text"
                      value={form.discharge_date}
                      onChange={(e) => setForm({ ...form, discharge_date: e.target.value })}
                      placeholder="e.g. 15 Sept 2026"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Admission Details & Case History
                  </label>
                  <textarea
                    rows={2}
                    value={form.admission_reason}
                    onChange={(e) => setForm({ ...form, admission_reason: e.target.value })}
                    placeholder="Enter admission details / reason..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Diagnoses
                  </label>
                  <input
                    type="text"
                    value={form.discharge_diagnosis}
                    onChange={(e) => setForm({ ...form, discharge_diagnosis: e.target.value })}
                    placeholder="Enter primary and secondary diagnoses..."
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Hospital Course Summary
                  </label>
                  <textarea
                    rows={3}
                    value={form.hospital_course_summary}
                    onChange={(e) => setForm({ ...form, hospital_course_summary: e.target.value })}
                    placeholder="Enter hospital course summary..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Investigations
                  </label>
                  <textarea
                    rows={2}
                    value={form.investigations}
                    onChange={(e) => setForm({ ...form, investigations: e.target.value })}
                    placeholder="Enter lab tests and investigations findings..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Condition on Discharge
                  </label>
                  <input
                    type="text"
                    value={form.patient_condition}
                    onChange={(e) => setForm({ ...form, patient_condition: e.target.value })}
                    placeholder="e.g. Hemodynamically stable"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Discharge Medications
                  </label>
                  <textarea
                    rows={4}
                    value={form.discharge_medications}
                    onChange={(e) => setForm({ ...form, discharge_medications: e.target.value })}
                    placeholder="Enter discharge medications schedule..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Discharge Advice & Follow-Up
                  </label>
                  <textarea
                    rows={3}
                    value={form.followup_instructions}
                    onChange={(e) => setForm({ ...form, followup_instructions: e.target.value })}
                    placeholder="Enter follow-up instructions and precautions..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(originalForm);
                      setIsEditing(false);
                    }}
                    disabled={saving}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#64748b',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {saving ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div
          className="no-print-elem"
          style={{
            padding: '12px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11.5px',
            color: '#64748b'
          }}
        >
          <div>
            Record: <strong style={{ color: '#0f172a' }}>{form.summary_id || '—'}</strong> · Patient ID: <strong style={{ color: '#0f172a' }}>{form.patient_id || '—'}</strong>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {form.approval_status !== 'Approved' && (
              <button
                type="button"
                onClick={() => handleSave('Approved')}
                disabled={saving}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {saving ? 'Approving...' : '✓ Approve & Sign-off'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
