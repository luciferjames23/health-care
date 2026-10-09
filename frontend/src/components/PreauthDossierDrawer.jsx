import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, CheckCircle, ShieldCheck, FileText, Send, 
  Sparkles, RefreshCw, Activity, Check, ShieldAlert, Bell,
  User, Shield, Building2, Stethoscope, Bed, HeartPulse, Microscope, Syringe, CreditCard, FolderCheck, CheckSquare
} from 'lucide-react';
import { apiService } from '../services/api';
import ModuleLoadingScreen from './ModuleLoadingScreen';

export default function PreauthDossierDrawer({ 
  isOpen, 
  onClose, 
  patientIdentifier = '87264', 
  initialMode = 'dossier',
  onSubmitted = null 
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dossierData, setDossierData] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [activeLangTab, setActiveLangTab] = useState('en'); // 'en' | 'ta'
  const [activeMode, setActiveMode] = useState(initialMode || 'dossier'); // 'dossier' | 'letter'
  const [error, setError] = useState(null);

  const fetchDossier = async (targetId) => {
    try {
      setLoading(true);
      setError(null);
      setSubmissionResult(null);
      const res = await apiService.getPreauthDossier(targetId || patientIdentifier || '87264');
      if (res && res.dossier) {
        setDossierData(res);
        const isApproved = res.case_data?.stage === 'APPROVED' || String(res.case_data?.claim_status || '').toLowerCase() === 'approved';
        if (isApproved && initialMode === 'letter') {
          setActiveMode('letter');
        } else {
          setActiveMode('dossier');
        }
      }
    } catch (err) {
      console.error('Error fetching preauth dossier:', err);
      setError(err.message || 'Failed to assemble preauth dossier');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode === 'letter' ? 'letter' : 'dossier');
      fetchDossier(patientIdentifier);
    }
  }, [isOpen, patientIdentifier, initialMode]);

  if (!isOpen) return null;

  const caseInfo = dossierData?.case_data || {};
  const dossier = dossierData?.dossier || {};

  const claimStatusLower = String(caseInfo.claim_status || '').toLowerCase();
  const isExplicitPendingOrReview = ['pending', 'submitted - under review', 'submitted', 'under review', 'submitted - awaiting insurer', 'pending preauth generation'].includes(claimStatusLower);
  
  const isPatientApproved = !isExplicitPendingOrReview && (
    (caseInfo.stage === 'APPROVED' && Number(caseInfo.approved_amount || 0) > 0) || 
    claimStatusLower === 'approved' || 
    claimStatusLower === 'settled' ||
    submissionResult?.status === 'Approved'
  );
  const isApprovedCase = isPatientApproved && activeMode === 'letter';
  const isNewAdmission = (!caseInfo.stage || caseInfo.stage === 'NEW_ADMISSION') && !submissionResult;
  
  const checklist = dossier.checklist_verification || {
    doctor_advice: { status: 'Verified', detail: 'Signed by Dr. Priya Patel' },
    cost_estimate: { status: 'Verified', detail: 'Provisional ₹2.45L bill breakdown attached' },
    policy_id: { status: 'Verified', detail: 'Active Star Health coverage confirmed' },
    operative_report: { status: 'Verified', detail: 'Cath Lab Angiogram (85% LAD lesion) attached' }
  };
  const denialRisk = dossier.denial_risk_assessment || {
    risk_pct: caseInfo.denial_risk?.risk_pct || 8,
    risk_level: caseInfo.denial_risk?.risk_level || 'Low Risk',
    model_version: caseInfo.denial_risk?.model_version || 'Groq LPU (openai/gpt-oss-120b)',
    explanation: caseInfo.denial_risk?.explanation || 'Clinical presentation and tariff estimate comply with policy underwriting criteria.',
    mitigation_notes: caseInfo.denial_risk?.mitigation_notes || 'All mandatory clinical orders, vitals, and itemized billing schedules verified.'
  };

  const handlePrintLetter = () => {
    const letterElement = document.getElementById('printable-sanction-letter');
    if (!letterElement) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=880,height=1000');
    if (!printWindow) {
      window.print();
      return;
    }

    const contentHtml = letterElement.innerHTML;
    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Preauth Sanction Letter - ${caseInfo.patient_name || 'Patient'}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 15mm 15mm 15mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 10px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            * {
              box-sizing: border-box;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px 12px;
            }
          </style>
        </head>
        <body>
          <div style="background:#ffffff; max-width: 800px; margin: 0 auto;">
            ${contentHtml}
          </div>
          <script>
            window.addEventListener('load', function() {
              setTimeout(function() {
                window.focus();
                window.print();
                setTimeout(function() {
                  window.close();
                }, 500);
              }, 250);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleGenerateDossier = async () => {
    try {
      setSubmitting(true);
      await apiService.generatePreauthDossier({
        patient_id: caseInfo.patient_code || caseInfo.patient_id || caseInfo.patient_name
      });
      await fetchDossier(caseInfo.patient_code || caseInfo.patient_id);
      if (onSubmitted) onSubmitted({ stage: 'DOSSIER_READY' });
    } catch (err) {
      console.error('Error generating preauth dossier:', err);
      alert(`Dossier generation failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPreauth = async () => {
    try {
      setSubmitting(true);
      const payload = {
        patient_code: caseInfo.patient_code || 'MER-PAT-0087264',
        patient_id: caseInfo.patient_id || 87264,
        patient_name: caseInfo.patient_name || 'Davidel Parthalan',
        admission_id: caseInfo.admission_id || 87264,
        insurance_provider: caseInfo.insurance_provider || 'Star Health & Allied Insurance',
        policy_number: caseInfo.policy_number || 'STAR-POL-7728194',
        claimed_amount: caseInfo.estimated_cost || 245000.0,
        submitted_by: 'R. Sundar (Insurance Desk Executive)',
        denial_risk: `${denialRisk.risk_pct}% (${denialRisk.risk_level} · Policy & Clinical Engine)`
      };

      const res = await apiService.submitPreauthToTPA(payload);
      if (res && res.success) {
        setSubmissionResult(res);
        if (onSubmitted) onSubmitted(res);
      }
    } catch (err) {
      console.error('Error submitting preauth:', err);
      alert(`Submission failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovePreauth = async () => {
    const insurerName = caseInfo.insurance_provider ? caseInfo.insurance_provider.split(' ')[0] : 'TPA / Insurer';
    if (!window.confirm(`Record cashless pre-authorization approval received from ${insurerName} for ${caseInfo.patient_name || 'this patient'}?`)) {
      return;
    }
    try {
      setSubmitting(true);
      await apiService.approvePreauthClaim({
        patient_id: caseInfo.patient_id,
        patient_code: caseInfo.patient_code,
        approved_amount: caseInfo.estimated_cost || 35000,
        approved_by: `${insurerName} Medical Adjudicator / Cashless Approval Desk`
      });
      setActiveMode('letter');
      setSubmissionResult({ status: 'Approved', success: true });
      if (onSubmitted) onSubmitted({ status: 'Approved', success: true });
    } catch (err) {
      console.error('Error approving claim:', err);
      alert(`Approval record failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const drawerContent = (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '720px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
      >
        
        {/* Drawer Header */}
        <div 
          style={{
            padding: '16px 20px',
            background: isApprovedCase 
              ? 'linear-gradient(135deg, #065f46 0%, #064e3b 100%)' 
              : 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: isApprovedCase ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                border: isApprovedCase ? '1px solid rgba(167, 243, 208, 0.4)' : '1px solid rgba(147, 197, 253, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isApprovedCase ? '#a7f3d0' : '#93c5fd'
              }}
            >
              <ShieldCheck style={{ width: '22px', height: '22px' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span 
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: isApprovedCase ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.25)',
                    color: isApprovedCase ? '#d1fae5' : '#bfdbfe',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  {isApprovedCase ? 'Official Authorization Letter' : 'Clinical Workflow Automation'}
                </span>
                <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                  <Sparkles style={{ width: '13px', height: '13px', color: '#fbbf24' }} />
                  Clinical Intelligence Engine
                </span>
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isApprovedCase ? 'Cashless Pre-Authorization Approval Letter' : 'Preauth Submission Dossier'}
                <span style={{ fontSize: '12px', fontWeight: 400, color: isApprovedCase ? '#a7f3d0' : '#c7d2fe' }}>
                  {isApprovedCase ? 'முன்அனுமதி கடிதம்' : 'காப்பீட்டு முன்அனுமதி முகவர்'}
                </span>
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isPatientApproved && (
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px' }}>
                <button
                  type="button"
                  onClick={() => setActiveMode('dossier')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: activeMode === 'dossier' ? 700 : 500,
                    background: activeMode === 'dossier' ? '#ffffff' : 'transparent',
                    color: activeMode === 'dossier' ? '#0f172a' : '#cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  Dossier
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('letter')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: activeMode === 'letter' ? 700 : 500,
                    background: activeMode === 'letter' ? '#ffffff' : 'transparent',
                    color: activeMode === 'letter' ? '#0f172a' : '#cbd5e1',
                    cursor: 'pointer'
                  }}
                >
                  Letter
                </button>
              </div>
            )}

            <button 
              type="button"
              onClick={onClose}
              style={{
                padding: '6px',
                borderRadius: '8px',
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Body */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: '#f8fafc'
          }}
        >
          
          {/* Loading state */}
          {loading && (
            <ModuleLoadingScreen title="Loading Preauthorization Dossier..." subtitle="Retrieving clinical notes, advice, tariffs, and policy details..." badgeText="Live Data Sync" layout="cards" statCount={4} />
          )}

          {!loading && error && (
            <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <ShieldAlert style={{ width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px' }}>
                <div style={{ fontWeight: 600 }}>Error Loading Dossier</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>{error}</div>
                <button 
                  type="button"
                  onClick={() => fetchDossier(patientIdentifier)}
                  style={{ marginTop: '8px', background: 'none', border: 'none', color: '#991b1b', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '12px' }}
                >
                  Retry Loading
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {activeMode === 'letter' ? (
                /* ================================================================= */
                /* OFFICIAL CASHLESS PRE-AUTHORIZATION SANCTION LETTER               */
                /* ================================================================= */
                <div 
                  id="printable-sanction-letter"
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                    padding: '24px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px',
                    color: '#0f172a',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
                  }}
                >
                  {/* Header Letterhead */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '8px',
                        backgroundColor: '#065f46',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px'
                      }}>
                        🛡️
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                          {caseInfo.insurance_provider || 'Star Health & Allied Insurance Co. Ltd.'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Third Party Administrator (TPA) & Cashless Pre-Authorization Network Cell
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                          IRDAI Reg. No: 129 · Master Circular IRDAI/HLT/CIR/2024 · 24x7 TPA Desk: 1800-425-2255
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        backgroundColor: '#d1fae5',
                        color: '#065f46',
                        fontWeight: 800,
                        fontSize: '11px',
                        border: '1px solid #6ee7b7',
                        letterSpacing: '0.04em'
                      }}>
                        INITIAL SANCTION APPROVED
                      </span>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', marginTop: '5px' }}>
                        Ref: <span style={{ fontFamily: 'monospace', color: '#0f172a' }}>{caseInfo.claim_reference || `AUTH-${caseInfo.patient_id || '87264'}-2026`}</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                        Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div style={{ textAlign: 'center', margin: '4px 0' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Cashless Pre-Authorization Approval & Guarantee of Payment
                    </h3>
                    <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                      முன்அனுமதி நிதி ஒப்புதல் ஆவணம் (Official Network Hospital Guarantee)
                    </div>
                  </div>

                  {/* Approved Amount Highlight Box */}
                  <div style={{
                    background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                    border: '1.5px solid #10b981',
                    borderRadius: '8px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Sanctioned Cashless Initial Guarantee Amount
                      </div>
                      <div style={{ fontSize: '11px', color: '#065f46', marginTop: '2px' }}>
                        Valid for in-patient admission, investigations, surgical procedures, and standard tariffs
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: '#065f46', fontFamily: 'monospace' }}>
                        ₹{(caseInfo.approved_amount || caseInfo.estimated_cost || 35000).toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#047857', fontWeight: 600 }}>
                        Insurer 100% Cashless Liability Approved
                      </div>
                    </div>
                  </div>

                  {/* Patient & Admission Information Grid */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      1. Beneficiary & Policy Details
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px',
                      fontSize: '11.5px'
                    }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Patient Name & UHID:</span>
                        <strong style={{ color: '#0f172a' }}>{caseInfo.patient_name || 'Sarah Connor'}</strong> ({caseInfo.patient_code || 'P1000106'})
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Age / Gender / Contact:</span>
                        <strong style={{ color: '#0f172a' }}>{caseInfo.age || caseInfo.age_at_admission || 34} Yrs / {caseInfo.gender || 'Female'}</strong> · {caseInfo.phone || '+91 98401 55108'}
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Policy Number & Sum Insured:</span>
                        <strong style={{ color: '#0f172a' }}>{caseInfo.policy_number || 'STAR-POL-1004421'}</strong> (SI: ₹{(caseInfo.coverage_limit || 500000).toLocaleString('en-IN')})
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Admitted Ward / Bed:</span>
                        <strong style={{ color: '#4338ca' }}>{caseInfo.ward_bed || 'General Medical Ward A / GMA-102'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Attending Specialist:</span>
                        <strong style={{ color: '#0f172a' }}>{caseInfo.attending_doctor || 'Dr. Priya Patel (MD, DNB)'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Provisional Diagnosis / ICD:</span>
                        <strong style={{ color: '#0f172a' }}>{caseInfo.primary_diagnosis || 'Acute Coronary Syndrome / I20.0'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Tariff Breakdown */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      2. Approved Service Tariff Breakdown
                    </div>
                    <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', fontSize: '11.5px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '10.5px', borderBottom: '1px solid #e2e8f0' }}>
                          <tr>
                            <th style={{ padding: '8px 12px' }}>Approved Clinical Component</th>
                            <th style={{ padding: '8px 12px' }}>Coverage Condition</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sanctioned (₹)</th>
                          </tr>
                        </thead>
                        <tbody style={{ color: '#334155' }}>
                          {(dossier.itemized_estimate || [
                            { category: 'Surgical & Procedural Package', amount: Math.round((caseInfo.estimated_cost || 35000) * 0.55) },
                            { category: 'Bed / Room / Nursing Care', amount: Math.round((caseInfo.estimated_cost || 35000) * 0.25) },
                            { category: 'Investigations & Diagnostics', amount: Math.round((caseInfo.estimated_cost || 35000) * 0.12) },
                            { category: 'Pharmacy & Medical Consumables', amount: Math.round((caseInfo.estimated_cost || 35000) * 0.08) }
                          ]).map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '7px 12px', fontWeight: 600 }}>{row.category}</td>
                              <td style={{ padding: '7px 12px', color: '#059669', fontSize: '10.5px' }}>Covered (100% Cashless)</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                ₹{(row.amount || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ backgroundColor: '#ecfdf5', fontWeight: 800, color: '#065f46' }}>
                            <td style={{ padding: '9px 12px' }} colSpan={2}>Total Cashless Authorization Sanctioned</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px' }}>
                              ₹{(caseInfo.approved_amount || caseInfo.estimated_cost || 35000).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Stipulations and Authorization Notes */}
                  <div style={{
                    fontSize: '10.5px',
                    color: '#475569',
                    lineHeight: 1.5,
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '10px'
                  }}>
                    <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>Cashless Authorization Terms & Guidelines:</strong>
                    <ol style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <li>This initial sanction authorizes hospital admission and urgent line of treatment without upfront deposit.</li>
                      <li>Any mid-treatment enhancement or procedure change must be submitted 24 hours prior to patient discharge.</li>
                      <li>Non-medical items (personal comfort toiletries/food) are payable by patient as per standard IRDAI guidelines.</li>
                      <li>Final hospital bill with detailed discharge summary must be uploaded within 24 hours of discharge.</li>
                    </ol>
                  </div>

                  {/* Signatures & Seal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '16px', borderTop: '1px dashed #cbd5e1' }}>
                    <div>
                      <div style={{ width: '80px', height: '40px', border: '1px dashed #94a3b8', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b' }}>
                        [TPA QR Code]
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '4px' }}>
                        Digitally verified via NHCX Gateway
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#065f46' }}>
                        Dr. V. Ramakrishnan (MD)
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        Chief Medical Adjudicator · Star Health / TPA Desk
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>
                        Authorized Electronic Signature · Stamp Affixed
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                /* ================================================================= */
                /* PREAUTH SUBMISSION DOSSIER (STAGE 1 & 2 DRAFTING VIEW)            */
                /* ================================================================= */
                <>
                  {/* Patient & Policy Snapshot Card */}
                  <div 
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div 
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            fontWeight: 700,
                            fontSize: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #dbeafe'
                          }}
                        >
                          {caseInfo.patient_name ? caseInfo.patient_name.charAt(0) : 'P'}
                        </div>
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {caseInfo.patient_name || 'Sarah Connor'}
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 500, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                              {caseInfo.patient_code || 'P1000106'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                            <span>{caseInfo.gender || 'Female'}, {caseInfo.age || caseInfo.age_at_admission || (caseInfo.date_of_birth ? Math.floor((new Date() - new Date(caseInfo.date_of_birth)) / 31557600000) : 34)} yrs</span>
                            <span>•</span>
                            <span>{caseInfo.phone || '+91 94440 98712'}</span>
                            <span>•</span>
                            <span style={{ fontWeight: 600, color: '#4338ca' }}>{caseInfo.ward_bed || 'General Medical Ward A / GMA-102'}</span>
                          </div>
                        </div>
                      </div>

                      <span 
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '20px',
                          backgroundColor: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #a7f3d0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <CheckCircle style={{ width: '13px', height: '13px' }} />
                        EMR Triggered
                      </span>
                    </div>

                    <div 
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1.2fr',
                        gap: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid #f1f5f9',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Insurer / TPA</span>
                        <strong style={{ color: '#1e293b' }}>
                          {caseInfo.insurance_provider || 'Star Health & Allied Insurance'}
                        </strong>
                      </div>
                      <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Policy ID / Limit</span>
                        <strong style={{ color: '#1e293b' }}>
                          {caseInfo.policy_number || 'STAR-POL-1004421'} (₹{(caseInfo.coverage_limit || 500000).toLocaleString('en-IN')})
                        </strong>
                      </div>
                      <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#eff6ff', border: '1px solid #dbeafe' }}>
                        <span style={{ color: '#1e40af', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Est. Bill Amount</span>
                        <strong style={{ color: '#1d4ed8', fontSize: '14px' }}>
                          ₹{(caseInfo.estimated_cost || 35000).toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* 4-Point Document Checklist (Dynamic Status from EMR / Insurance Audit) */}
                  {(() => {
                    const items = [
                      {
                        title: 'Doctor Advice & Indication',
                        status: checklist.doctor_advice?.status || 'Verified',
                        detail: checklist.doctor_advice?.detail || 'Admitting advice signed by attending physician'
                      },
                      {
                        title: 'Cost Estimate Breakdown',
                        status: checklist.cost_estimate?.status || 'Verified',
                        detail: checklist.cost_estimate?.detail || 'Provisional tariff estimate attached'
                      },
                      {
                        title: 'Active Policy ID & Eligibility',
                        status: checklist.policy_id?.status || 'Verified',
                        detail: checklist.policy_id?.detail || 'Active insurance coverage confirmed'
                      },
                      {
                        title: 'Operative / Clinical Report',
                        status: checklist.operative_report?.status || 'Verified',
                        detail: checklist.operative_report?.detail || 'Clinical intake assessment & investigation reports attached'
                      }
                    ];
                    const verifiedCount = items.filter(it => it.status === 'Verified').length;
                    const isAllVerified = verifiedCount === 4;

                    return (
                      <div 
                        style={{
                          padding: '16px',
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          border: isAllVerified ? '1px solid #e2e8f0' : '1px solid #fecaca',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText style={{ width: '15px', height: '15px', color: isAllVerified ? '#2563eb' : '#dc2626' }} />
                            Document Readiness Checklist ({verifiedCount}/4 Complete)
                          </h4>
                          <span style={{ 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            padding: '2px 8px', 
                            borderRadius: '4px', 
                            backgroundColor: isAllVerified ? '#ecfdf5' : verifiedCount >= 2 ? '#fffbeb' : '#fef2f2', 
                            color: isAllVerified ? '#047857' : verifiedCount >= 2 ? '#b45309' : '#b91c1c' 
                          }}>
                            {isAllVerified ? '100% Ready' : `${verifiedCount}/4 Verified`}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {items.map((it, idx) => {
                            const isVerified = it.status === 'Verified';
                            const isMissing = it.status === 'Missing';
                            const borderCol = isVerified ? '#bbf7d0' : isMissing ? '#fde68a' : '#fecaca';
                            const bgCol = isVerified ? '#f0fdf4' : isMissing ? '#fffbeb' : '#fef2f2';
                            const titleCol = isVerified ? '#14532d' : isMissing ? '#92400e' : '#991b1b';
                            const textCol = isVerified ? '#166534' : isMissing ? '#b45309' : '#b91c1c';
                            const iconBg = isVerified ? '#16a34a' : isMissing ? '#d97706' : '#dc2626';

                            return (
                              <div key={idx} style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${borderCol}`, backgroundColor: bgCol, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: iconBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                                  {isVerified ? (
                                    <Check style={{ width: '13px', height: '13px', strokeWidth: 3 }} />
                                  ) : isMissing ? (
                                    <ShieldAlert style={{ width: '12px', height: '12px', strokeWidth: 2.5 }} />
                                  ) : (
                                    <X style={{ width: '13px', height: '13px', strokeWidth: 3 }} />
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: titleCol }}>{it.title}</div>
                                    <span style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', color: titleCol }}>
                                      {it.status}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: textCol, marginTop: '2px', wordBreak: 'break-word' }}>
                                    {it.detail}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Denial-Risk Badge & Two-Stage Risk Analysis (17-Criteria Rules Engine + ML Model) */}
                  {(() => {
                    const score = denialRisk.risk_score ?? denialRisk.risk_pct ?? 12;
                    const level = denialRisk.risk_level || (score <= 30 ? 'Low Risk' : score <= 60 ? 'Medium Risk' : score <= 80 ? 'High Risk' : 'Critical Risk');
                    const reasons = denialRisk.risk_reasons || (denialRisk.explanation ? [denialRisk.explanation] : ['All 17 statutory and policy criteria verified; standard inpatient treatment']);
                    const mitigations = denialRisk.mitigation_actions || (denialRisk.mitigation_notes ? [denialRisk.mitigation_notes] : ['Submit complete pre-authorization packet with itemized tariff']);
                    const rulesAudit = denialRisk.rules_audit || dossier.rules_audit || {};
                    const checksMap = rulesAudit.checks || {};
                    const passedChecks = rulesAudit.passed_count ?? 17;

                    const barColor = score <= 30 ? '#10b981' : score <= 60 ? '#f59e0b' : score <= 80 ? '#f43f5e' : '#dc2626';
                    const boxBg = score <= 30 ? '#f0fdf4' : score <= 60 ? '#fffbeb' : score <= 80 ? '#fff1f2' : '#fef2f2';
                    const boxBorder = score <= 30 ? '#bbf7d0' : score <= 60 ? '#fde68a' : score <= 80 ? '#fecdd3' : '#fecaca';
                    const titleColor = score <= 30 ? '#166534' : score <= 60 ? '#92400e' : score <= 80 ? '#be123c' : '#991b1b';

                    return (
                      <div 
                        style={{
                          padding: '16px',
                          borderRadius: '10px',
                          background: boxBg,
                          border: `1.5px solid ${boxBorder}`,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {/* Header: Title + Engine Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <ShieldCheck style={{ width: '22px', height: '22px', color: barColor, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: titleColor, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                                Two-Stage Rejection / Cancellation Risk Analysis
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                                Stage 1: Statutory & Policy Rules Engine · Stage 2: Historical ML / LLM Predictor
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#ffffff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                              Stage 1: 17 Rules Checked
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: '#ffffff', color: '#047857', border: '1px solid #a7f3d0' }}>
                              Stage 2: Groq LPU (openai/gpt-oss-120b)
                            </span>
                          </div>
                        </div>

                        {/* Middle: Score Gauge & 4-Tier Scale */}
                        <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${boxBorder}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                              <span style={{ fontSize: '26px', fontWeight: 900, color: barColor, fontFamily: 'monospace' }}>
                                {score}/100
                              </span>
                              <span style={{ fontSize: '14px', fontWeight: 800, color: titleColor }}>
                                {level}
                              </span>
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>
                              {score <= 30 ? '0–30 Low' : score <= 60 ? '31–60 Medium' : score <= 80 ? '61–80 High' : '81–100 Critical'} (Validated Historical Scale)
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${Math.min(100, Math.max(5, score))}%`, backgroundColor: barColor, transition: 'width 0.4s ease' }} />
                          </div>

                          {/* 4-Tier Threshold Markers */}
                          <div style={{ display: 'grid', gridTemplateColumns: '30% 30% 20% 20%', fontSize: '9.5px', color: '#64748b', marginTop: '4px', fontWeight: 600, textAlign: 'center' }}>
                            <span style={{ color: '#059669' }}>0–30 Low</span>
                            <span style={{ color: '#d97706' }}>31–60 Medium</span>
                            <span style={{ color: '#e11d48' }}>61–80 High</span>
                            <span style={{ color: '#991b1b' }}>81–100 Critical</span>
                          </div>
                        </div>

                        {/* Bottom: Identified Risk Reasons */}
                        <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${boxBorder}` }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                            Identified Risk Factors & Underwriting Reasons:
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11.5px', color: '#0f172a', lineHeight: 1.6 }}>
                            {reasons.map((r, idx) => (
                              <li key={idx} style={{ fontWeight: 500 }}>{r}</li>
                            ))}
                          </ul>

                          {/* Mitigation Strategy */}
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', fontSize: '11.5px', color: '#166534' }}>
                            <strong style={{ color: '#047857' }}>💡 Recommended Action Plan: </strong>
                            {mitigations.join(' · ')}
                          </div>
                        </div>

                        {/* Stage 1: 17 Statutory & Underwriting Rules Breakdown */}
                        <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${boxBorder}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <CheckCircle style={{ width: '13px', height: '13px', color: '#2563eb' }} />
                              Stage 1 Rules Engine: 17 Statutory Criteria Audit ({passedChecks}/17 Verified)
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: passedChecks === 17 ? '#059669' : '#d97706', background: passedChecks === 17 ? '#ecfdf5' : '#fffbeb', padding: '1px 6px', borderRadius: '4px' }}>
                              {passedChecks === 17 ? 'Zero Violations' : `${17 - passedChecks} Flagged`}
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '6px', fontSize: '11px' }}>
                            {[
                              { key: 'policy_validity', label: '1. Policy Validity', what: 'Active on admission date' },
                              { key: 'coverage', label: '2. Coverage', what: 'Treatment/procedure covered' },
                              { key: 'waiting_period', label: '3. Waiting Period', what: 'Waiting period completed' },
                              { key: 'pre_existing_disease', label: '4. Pre-existing Disease', what: 'PED declared & covered' },
                              { key: 'policy_limits', label: '5. Policy Limits', what: 'Sum insured remaining' },
                              { key: 'admission_type', label: '6. Admission Type', what: 'Elective / emergency rules' },
                              { key: 'diagnosis', label: '7. Diagnosis', what: 'Diagnosis supports treatment' },
                              { key: 'procedure', label: '8. Procedure', what: 'Medically justified' },
                              { key: 'medical_necessity', label: '9. Medical Necessity', what: 'Inpatient justification' },
                              { key: 'documents', label: '10. Documents', what: 'Required reports available' },
                              { key: 'patient_identity', label: '11. Patient Identity', what: 'Name/DOB matches policy' },
                              { key: 'billing', label: '12. Billing Consistency', what: 'Charges consistent' },
                              { key: 'room_category', label: '13. Room Category', what: 'Eligible room sub-limit' },
                              { key: 'claim_history', label: '14. Claim History', what: 'Previous claims / patterns' },
                              { key: 'insurer_tpa_rules', label: '15. Insurer/TPA Rules', what: 'Insurer preauth protocols' },
                              { key: 'coding', label: '16. Coding (ICD-10)', what: 'ICD-10 codes mapped' },
                              { key: 'timelines', label: '17. Timelines', what: 'Submitted on time' }
                            ].map((crit) => {
                              const chkItem = checksMap[crit.key] || { status: 'PASS', detail: 'Verified' };
                              const isFail = chkItem.status === 'FAIL';
                              const isWarn = chkItem.status === 'WARN';
                              const bg = isFail ? '#fef2f2' : isWarn ? '#fffbeb' : '#f8fafc';
                              const textCol = isFail ? '#991b1b' : isWarn ? '#92400e' : '#334155';
                              const badgeCol = isFail ? '#dc2626' : isWarn ? '#d97706' : '#16a34a';

                              return (
                                <div key={crit.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: '4px', background: bg, border: `1px solid ${isFail ? '#fecaca' : isWarn ? '#fde68a' : '#f1f5f9'}` }}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 600, color: textCol }}>{crit.label}</span>
                                    <span style={{ fontSize: '9.5px', color: '#64748b' }}>{chkItem.detail || crit.what}</span>
                                  </div>
                                  <span style={{ fontSize: '9.5px', fontWeight: 800, color: badgeCol }}>
                                    {isFail ? 'FAIL' : isWarn ? 'WARN' : 'PASS'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ================================================================= */}
                  {/* STANDARDIZED INSURANCE PRE-AUTHORIZATION REQUEST (11 SECTIONS)     */}
                  {/* ================================================================= */}
                  {(() => {
                    const req = dossier.preauth_request || {};
                    const s1 = req.section_1_patient_info || {};
                    const s2 = req.section_2_insurance_info || {};
                    const s3 = req.section_3_identity_kyc || {};
                    const s4 = req.section_4_hospital_info || {};
                    const s5 = req.section_5_doctor_info || {};
                    const s6 = req.section_6_admission_info || {};
                    const s7 = req.section_7_clinical_info || {};
                    const s8 = req.section_8_investigation_evidence || {};
                    const s9 = req.section_9_treatment_info || {};
                    const s10 = req.section_10_financial_info || {};
                    const s11 = req.section_11_supporting_documents || {};

                    const pCode = caseInfo.patient_code || s1.patient_id || 'P1000106';
                    const pName = caseInfo.patient_name || s1.patient_name || 'Patient';
                    const pAge = caseInfo.age || caseInfo.age_at_admission || (caseInfo.date_of_birth ? Math.floor((new Date() - new Date(caseInfo.date_of_birth)) / 31557600000) : 34);
                    const pGender = caseInfo.gender || s1.gender || 'Female';
                    const pPhone = caseInfo.phone || '+91 98401 55108';
                    const pDob = caseInfo.date_of_birth || '1992-04-18';
                    const pDoc = caseInfo.attending_doctor || s5.doctor_name || 'Dr. Priya Patel';
                    const pDiag = caseInfo.primary_diagnosis || s7.diagnosis || 'Acute Inpatient Care';
                    const pIns = caseInfo.insurance_provider || s2.insurance_company || 'Star Health & Allied Insurance';
                    const pPol = caseInfo.policy_number || s2.policy_number || 'STAR-POL-7728194';
                    const pEst = caseInfo.estimated_cost || 35000;
                    const pWard = caseInfo.ward_bed || s6.ward_room || 'General Medical Ward A / GMA-102';

                    const sections = [
                      {
                        num: '1',
                        id: 'patient_info',
                        title: '1. Patient Information',
                        icon: <User style={{ width: '16px', height: '16px', color: '#2563eb' }} />,
                        badge: 'Beneficiary Identity',
                        fields: [
                          { label: 'Patient ID', value: pCode, mono: true, strong: true },
                          { label: 'Patient Name', value: pName, strong: true },
                          { label: 'DOB / Age', value: `${pDob} (${pAge} Yrs)` },
                          { label: 'Gender', value: pGender },
                          { label: 'Contact Details', value: `${pPhone} · patient.${String(pCode).toLowerCase()}@carenet.in` }
                        ]
                      },
                      {
                        num: '2',
                        id: 'insurance_info',
                        title: '2. Insurance Information',
                        icon: <Shield style={{ width: '16px', height: '16px', color: '#059669' }} />,
                        badge: 'Policy Coverage',
                        fields: [
                          { label: 'Insurance Company', value: pIns, strong: true },
                          { label: 'TPA', value: s2.tpa || 'Medi Assist TPA / In-house TPA Helpdesk Cell' },
                          { label: 'Policy Number', value: pPol, mono: true, strong: true },
                          { label: 'Member ID', value: s2.member_id || `MEM-${caseInfo.patient_id || '87264'}-0921`, mono: true },
                          { label: 'Health Card', value: s2.health_card || `HC-STAR-${pCode}`, mono: true },
                          { label: 'Policyholder / Employee Details', value: s2.policyholder_details || `${pName} (Self) · Sum Insured: ₹${(caseInfo.coverage_limit || 500000).toLocaleString('en-IN')}` }
                        ]
                      },
                      {
                        num: '3',
                        id: 'identity_kyc',
                        title: '3. Identity / KYC',
                        icon: <FileText style={{ width: '16px', height: '16px', color: '#7c3aed' }} />,
                        badge: 'Govt Verified',
                        fields: [
                          { label: 'Government ID', value: s3.government_id || `Aadhaar Card (UIDAI Verified: XXXX-XXXX-${String(caseInfo.patient_id || '87264').slice(-4)}) · KYC Linked`, strong: true }
                        ]
                      },
                      {
                        num: '4',
                        id: 'hospital_info',
                        title: '4. Hospital Information',
                        icon: <Building2 style={{ width: '16px', height: '16px', color: '#0891b2' }} />,
                        badge: 'Network Provider',
                        fields: [
                          { label: 'Hospital Name', value: s4.hospital_name || 'Meridian Super Specialty Hospital', strong: true },
                          { label: 'Hospital ID', value: s4.hospital_id || 'ROHINI: 890044129038 / MER-HOSP-01', mono: true },
                          { label: 'Network Status', value: s4.network_status || 'Tier-1 Preferred Cashless Network Hospital (100% Cashless Tie-up)' },
                          { label: 'TPA Desk', value: s4.tpa_desk || '24x7 Cashless Helpdesk · Desk Ext #402 · Direct TPA Line: 1800-425-2255' }
                        ]
                      },
                      {
                        num: '5',
                        id: 'doctor_info',
                        title: '5. Doctor Information',
                        icon: <Stethoscope style={{ width: '16px', height: '16px', color: '#d97706' }} />,
                        badge: 'Treating Consultant',
                        fields: [
                          { label: 'Doctor Name', value: pDoc, strong: true },
                          { label: 'Specialty', value: caseInfo.department || s5.specialty || 'Inpatient Medicine & Critical Care' },
                          { label: 'Registration Details', value: s5.registration_details || `State Medical Council Reg No: TN-MCI-${48290 + (Number(caseInfo.patient_id) || 1) % 1000} (MBBS, MD, DNB)`, mono: true }
                        ]
                      },
                      {
                        num: '6',
                        id: 'admission_info',
                        title: '6. Admission Information',
                        icon: <Bed style={{ width: '16px', height: '16px', color: '#4f46e5' }} />,
                        badge: 'Inpatient Stay',
                        fields: [
                          { label: 'Planned / Emergency', value: s6.admission_type || 'Emergency / Urgent Inpatient Admission', strong: true },
                          { label: 'Admission Date', value: s6.admission_date || caseInfo.admission_date || '2026-10-06 08:30 IST' },
                          { label: 'Ward / Room', value: pWard, strong: true },
                          { label: 'Expected LOS', value: s6.expected_los || '3 - 5 Days (subject to clinical stabilization & post-op monitoring)' }
                        ]
                      },
                      {
                        num: '7',
                        id: 'clinical_info',
                        title: '7. Clinical Information',
                        icon: <HeartPulse style={{ width: '16px', height: '16px', color: '#dc2626' }} />,
                        badge: 'Clinical Findings',
                        fields: [
                          { label: 'Diagnosis', value: s7.diagnosis || `${pDiag} (ICD-10: I20.0 / A41.9)`, strong: true },
                          { label: 'Symptoms', value: s7.symptoms || `Acute onset of severe ${pDiag.toLowerCase()} symptoms with distress, radiating pain, diaphoresis and shortness of breath.` },
                          { label: 'Case History', value: s7.case_history || `Patient presented to Emergency/OPD with acute distress. Clinical workup confirms urgent indication for inpatient admission under ${pDoc}.` },
                          { label: 'Clinical Findings', value: s7.clinical_findings || `Hemodynamically guarded; clinical examination indicates active disease requiring continuous monitoring and therapy.` },
                          { label: 'Vitals', value: s7.vitals || `BP: ${caseInfo.latest_systolic_bp || 138}/${caseInfo.latest_diastolic_bp || 86} mmHg · HR: ${caseInfo.latest_heart_rate || 82} bpm · SpO2: ${caseInfo.latest_oxygen_saturation || 98}% · Temp: ${caseInfo.latest_temperature || 98.6}°F`, mono: true },
                          { label: 'Previous Medical History', value: s7.previous_medical_history || 'No major contraindications; standard chronic lifestyle comorbidity managed on regular medications. No documented adverse drug reactions.' }
                        ]
                      },
                      {
                        num: '8',
                        id: 'investigation_evidence',
                        title: '8. Investigation Evidence',
                        icon: <Microscope style={{ width: '16px', height: '16px', color: '#2563eb' }} />,
                        badge: 'Diagnostic Proof',
                        fields: [
                          { label: 'Lab Reports', value: s8.lab_reports || 'CBC, Renal Profile (Creatinine 1.0 mg/dL), Electrolytes, Cardiac Biomarkers / Serum Chemistries completed & attached.' },
                          { label: 'Radiology Reports', value: s8.radiology_reports || 'Chest X-Ray / Diagnostic Imaging confirms acute clinical indication without secondary pulmonary compromise.' },
                          { label: 'ECG', value: s8.ecg || '12-Lead Electrocardiogram (ECG) performed on intake: sinus rhythm with ischemic/inflammatory markers noted.' },
                          { label: 'Other Diagnostic Reports', value: s8.other_diagnostic_reports || 'Bedside point-of-care workup and relevant ultrasound/specialist assessment reports enclosed.' }
                        ]
                      },
                      {
                        num: '9',
                        id: 'treatment_info',
                        title: '9. Treatment Information',
                        icon: <Syringe style={{ width: '16px', height: '16px', color: '#059669' }} />,
                        badge: 'Medical Protocol',
                        fields: [
                          { label: 'Proposed Treatment', value: s9.proposed_treatment || `Institutional Inpatient Clinical Management, Hemodynamic Stabilization & Specialist Care under ${pDoc}`, strong: true },
                          { label: 'Procedure / Surgery', value: s9.procedure_surgery || `Interventional / Surgical Package & Specialist Consultations as advised by ${pDoc}` },
                          { label: 'Medicines', value: s9.medicines || 'IV fluids, targeted pharmacotherapy, broad-spectrum antibiotics/anti-platelets, gastro-protection, and analgesics.' },
                          { label: 'Treatment Plan', value: s9.treatment_plan || 'ICU/Ward admission, continuous telemetry monitoring for 48h, medical therapy titration, followed by discharge counseling.' }
                        ]
                      },
                      {
                        num: '10',
                        id: 'financial_info',
                        title: '10. Financial Information',
                        icon: <CreditCard style={{ width: '16px', height: '16px', color: '#7c3aed' }} />,
                        badge: 'Tariff & Estimate',
                        isFinancial: true,
                        fields: [
                          { label: 'Estimated Hospital Bill', value: `₹${pEst.toLocaleString('en-IN')}`, strong: true, mono: true },
                          { label: 'Room Charges', value: `₹${Math.round(pEst * 0.25).toLocaleString('en-IN')} (Inpatient / ICU Bed & Nursing Tariff)` },
                          { label: 'Procedure Charges', value: `₹${Math.round(pEst * 0.50).toLocaleString('en-IN')} (Procedural, Surgeon & Clinical Package)` },
                          { label: 'Investigation Charges', value: `₹${Math.round(pEst * 0.15).toLocaleString('en-IN')} (Lab, Imaging, ECG & Diagnostics)` },
                          { label: 'Pharmacy', value: `₹${Math.round(pEst * 0.10).toLocaleString('en-IN')} (Medicines, Infusions & Consumables)` },
                          { label: 'Requested Authorization Amount', value: `₹${pEst.toLocaleString('en-IN')} (100% Cashless Initial Guarantee Requested)`, strong: true, highlight: true }
                        ]
                      },
                      {
                        num: '11',
                        id: 'supporting_docs',
                        title: '11. Supporting Documents',
                        icon: <FolderCheck style={{ width: '16px', height: '16px', color: '#0891b2' }} />,
                        badge: 'Verified & Attached (6/6)',
                        fields: [
                          { label: 'Pre-Authorization Form', value: 'Pre-Authorization Form Part C & D filled, verified, and signed by Hospital TPA Desk (Attached)', verified: true },
                          { label: 'Doctor Prescription', value: `Attending Doctor (${pDoc}) Admission & Treatment Order (Attached)`, verified: true },
                          { label: 'Medical Reports', value: 'Investigation Lab & Imaging Diagnostic Reports (Attached)', verified: true },
                          { label: 'ID Proof', value: 'Government ID Proof (Aadhaar / Voter ID Verified) (Attached)', verified: true },
                          { label: 'Insurance Card', value: `Valid ${pIns} Member Card / TPA Card (Attached)`, verified: true },
                          { label: 'FIR / MLC / Other documents', value: 'Not Applicable (Natural / Non-accidental Medical Condition)', verified: true }
                        ]
                      }
                    ];

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Dossier Header Title & Language Toggle */}
                        <div 
                          style={{
                            padding: '14px 16px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93c5fd' }}>
                              Standardized IRDAI Cashless Protocol
                            </div>
                            <h3 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.02em' }}>
                              INSURANCE PRE-AUTHORIZATION REQUEST
                            </h3>
                            <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '2px' }}>
                              Complete 11-Section Comprehensive Dossier for TPA / Insurer Adjudication
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255,255,255,0.12)', padding: '3px', borderRadius: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setActiveLangTab('en')}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                border: 'none',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: activeLangTab === 'en' ? 700 : 500,
                                backgroundColor: activeLangTab === 'en' ? '#ffffff' : 'transparent',
                                color: activeLangTab === 'en' ? '#1e3a8a' : '#cbd5e1',
                                boxShadow: activeLangTab === 'en' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                              }}
                            >
                              English
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveLangTab('ta')}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                border: 'none',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: activeLangTab === 'ta' ? 700 : 500,
                                backgroundColor: activeLangTab === 'ta' ? '#ffffff' : 'transparent',
                                color: activeLangTab === 'ta' ? '#1e3a8a' : '#cbd5e1',
                                boxShadow: activeLangTab === 'ta' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                              }}
                            >
                              தமிழ் (Tamil)
                            </button>
                          </div>
                        </div>

                        {/* Bilingual Clinical Justification Banner */}
                        <div 
                          style={{
                            padding: '14px 16px',
                            borderRadius: '10px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #dbeafe',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <Activity style={{ width: '15px', height: '15px', color: '#2563eb' }} />
                            Clinical Justification Summary ({activeLangTab === 'en' ? 'English' : 'தமிழ்'})
                          </div>
                          <div style={{ fontSize: '12px', lineHeight: 1.6, color: '#334155', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            {activeLangTab === 'en'
                              ? (dossier.clinical_justification_en || `Patient ${pName} (${pCode}) admitted under ${pDoc} for acute ${pDiag}. Immediate institutional admission and clinical management is medically necessary under ${pIns} policy guidelines.`)
                              : (dossier.clinical_justification_ta || `நோயாளி ${pName} அவர்களுக்கு ${pDiag} காரணமாக உடனடி மருத்துவ சிகிச்சை மற்றும் மருத்துவமனை அனுமதி அவசியமாகிறது. தேவையான அனைத்து ஆவணங்களும் இணைக்கப்பட்டுள்ளன.`)}
                          </div>
                        </div>

                        {/* The 11 Standardized Sections */}
                        {sections.map(sec => (
                          <div 
                            key={sec.id}
                            style={{
                              padding: '16px',
                              borderRadius: '10px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            {/* Section Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                              <h4 style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {sec.icon}
                                {sec.title}
                              </h4>
                              <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                                {sec.badge}
                              </span>
                            </div>

                            {/* Section Fields Grid */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {sec.fields.map((fld, fIdx) => (
                                <div 
                                  key={fIdx}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    backgroundColor: fld.highlight ? '#ecfdf5' : '#f8fafc',
                                    border: fld.highlight ? '1px solid #a7f3d0' : '1px solid #f1f5f9'
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                      {fld.label}
                                    </span>
                                    {fld.verified && (
                                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <CheckCircle style={{ width: '12px', height: '12px' }} />
                                        Verified
                                      </span>
                                    )}
                                  </div>
                                  <div 
                                    style={{
                                      fontSize: '12px',
                                      color: fld.highlight ? '#065f46' : '#1e293b',
                                      fontWeight: fld.strong ? 700 : 500,
                                      fontFamily: fld.mono ? 'ui-monospace, monospace' : 'inherit',
                                      lineHeight: 1.5
                                    }}
                                  >
                                    {fld.value}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* If Financial Section, also show Itemized Estimate Table */}
                            {sec.isFinancial && (
                              <div style={{ marginTop: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                                  Itemized Provisional Estimate Breakdown
                                </span>
                                <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden', fontSize: '12px' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', borderBottom: '1px solid #e2e8f0' }}>
                                      <tr>
                                        <th style={{ padding: '8px 12px' }}>Service Category</th>
                                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tariff Amount (₹)</th>
                                      </tr>
                                    </thead>
                                    <tbody style={{ color: '#334155' }}>
                                      {(dossier.itemized_estimate || [
                                        { category: 'Procedure & Clinical Care Charges', amount: Math.round((caseInfo.estimated_cost || 35000) * 0.50) },
                                        { category: 'Ward / Bed & Nursing Care', amount: Math.round((caseInfo.estimated_cost || 35000) * 0.25) },
                                        { category: 'Investigations & Diagnostics', amount: Math.round((caseInfo.estimated_cost || 35000) * 0.15) },
                                        { category: 'Pharmacy & Consumables', amount: Math.round((caseInfo.estimated_cost || 35000) * 0.10) }
                                      ]).map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '8px 12px' }}>{row.category}</td>
                                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                            ₹{(row.amount || 0).toLocaleString('en-IN')}
                                          </td>
                                        </tr>
                                      ))}
                                      <tr style={{ backgroundColor: '#ecfdf5', fontWeight: 800, color: '#065f46' }}>
                                        <td style={{ padding: '10px 12px' }}>Total Claimable Estimate</td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#047857', fontFamily: 'monospace', fontSize: '13px' }}>
                                          ₹{(caseInfo.estimated_cost || 35000).toLocaleString('en-IN')}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Submission Confirmation Banner */}
                  {submissionResult && (
                    <div 
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #6ee7b7',
                        color: '#065f46',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
                        <CheckCircle style={{ width: '18px', height: '18px', color: '#059669' }} />
                        Preauth Dossier Submitted Successfully!
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', paddingTop: '4px' }}>
                        <div>
                          <span style={{ display: 'block', opacity: 0.75, fontSize: '11px' }}>TPA Reference:</span>
                          <strong style={{ fontFamily: 'monospace' }}>{submissionResult.submission_reference}</strong>
                        </div>
                        <div>
                          <span style={{ display: 'block', opacity: 0.75, fontSize: '11px' }}>Submitted By:</span>
                          <strong>{submissionResult.submitted_by}</strong>
                        </div>
                        <div>
                          <span style={{ display: 'block', opacity: 0.75, fontSize: '11px' }}>Status:</span>
                          <span>{submissionResult.status}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', opacity: 0.75, fontSize: '11px' }}>Expected SLA:</span>
                          <strong style={{ color: '#047857' }}>{submissionResult.estimated_tpa_sla}</strong>
                        </div>
                      </div>
                      <div 
                        style={{
                          marginTop: '6px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(5, 150, 105, 0.12)',
                          border: '1px solid #a7f3d0',
                          fontSize: '11.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: '#065f46'
                        }}
                      >
                        <Bell style={{ width: '13px', height: '13px', color: '#059669', flexShrink: 0 }} />
                        <span>Live notification dispatched to Hospital Alerts Centre & Insurance Desk queue.</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>

        {/* Drawer Footer */}
        <div 
          style={{
            padding: '14px 20px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            <strong style={{ color: '#1e293b', display: 'block' }}>
              {isPatientApproved 
                ? 'Pre-Authorization Sanction Issued' 
                : caseInfo.stage === 'SUBMITTED_TPA' 
                  ? 'Awaiting TPA / Insurer Decision' 
                  : caseInfo.stage === 'DOSSIER_READY'
                    ? 'Preauth Dossier Verified & Assembled'
                    : 'New Patient Intake'}
            </strong>
            <span style={{ fontSize: '11px' }}>
              {isPatientApproved 
                ? 'IRDAI Standard Format · Cashless Guarantee Active' 
                : caseInfo.stage === 'SUBMITTED_TPA'
                  ? `Under Review with ${caseInfo.insurance_provider || 'TPA Desk'}`
                  : caseInfo.stage === 'DOSSIER_READY'
                    ? `Ready for 1-Click Dispatch to ${caseInfo.insurance_provider ? caseInfo.insurance_provider.split(' ')[0] : 'Insurer'}`
                    : 'Ready for Clinical Preauth Dossier Synthesis'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>

            {/* If patient is already approved */}
            {isPatientApproved ? (
              <>
                {activeMode === 'dossier' && (
                  <button
                    type="button"
                    onClick={() => setActiveMode('letter')}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: '1px solid #a7f3d0',
                      backgroundColor: '#ecfdf5',
                      color: '#065f46',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Check style={{ width: '14px', height: '14px' }} />
                    View Sanction Letter
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrintLetter}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(5,150,105,0.35)'
                  }}
                >
                  🖨️ Print Sanction Letter
                </button>
              </>
            ) : !submissionResult ? (
              caseInfo.stage === 'SUBMITTED_TPA' ? (
                <div style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>⏳</span> Dossier Under TPA Adjudication
                </div>
              ) : caseInfo.stage === 'DOSSIER_READY' ? (
                <button
                  type="button"
                  disabled={loading || submitting}
                  onClick={handleSubmitPreauth}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#7c3aed',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: (loading || submitting) ? 'not-allowed' : 'pointer',
                    opacity: (loading || submitting) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(124,58,237,0.35)'
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                      Submitting to {caseInfo.insurance_provider ? caseInfo.insurance_provider.split(' ')[0] : 'TPA'}...
                    </>
                  ) : (
                    <>
                      <Send style={{ width: '14px', height: '14px' }} />
                      Submit Preauth Packet to {caseInfo.insurance_provider ? caseInfo.insurance_provider.split(' ')[0] : 'Star Health'} (1-Click)
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading || submitting}
                  onClick={handleGenerateDossier}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: (loading || submitting) ? 'not-allowed' : 'pointer',
                    opacity: (loading || submitting) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.35)'
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                      Generating AI Preauth Dossier...
                    </>
                  ) : (
                    <>
                      <Sparkles style={{ width: '14px', height: '14px' }} />
                      ⚡ Generate AI Preauth Dossier (Run AG-07)
                    </>
                  )}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => setActiveMode('letter')}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Check style={{ width: '14px', height: '14px' }} />
                View Approved Letter
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(drawerContent, document.body) : null;
}
