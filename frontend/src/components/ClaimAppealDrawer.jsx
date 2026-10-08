import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ModuleLoadingScreen from './ModuleLoadingScreen';
import {
  X, CheckCircle, ShieldAlert, FileText, Send,
  Sparkles, RefreshCw, Copy, Check,
  AlertTriangle, Stethoscope, FileCheck2,
  ChevronRight, Lock, CheckCircle2, XCircle, ArrowRight
} from 'lucide-react';
import { apiService } from '../services/api';

export default function ClaimAppealDrawer({
  isOpen,
  onClose,
  claimIdentifier = null,
  patientData = null,
  onAppealSubmitted = null
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingChecklist, setResolvingChecklist] = useState(false);
  const [dossier, setDossier] = useState(null);
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'evidence' | 'letter'
  const [activeLang, setActiveLang] = useState('en'); // 'en' | 'ta'
  const [editableLetter, setEditableLetter] = useState('');
  const [copied, setCopied] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);
  const [error, setError] = useState(null);

  const targetId = claimIdentifier || patientData?.claim_id || patientData?.patient_code || patientData?.patient_id || '45019';

  const fetchAppealDossier = async () => {
    try {
      setLoading(true);
      setError(null);
      setSubmissionSuccess(null);
      const res = await apiService.getClaimAppealDossier(targetId);
      if (res) {
        setDossier(res);
        setEditableLetter(res.appeal_letter || '');
        if (res.appeal_status === 'SUBMITTED_TPA') {
          setSubmissionSuccess({
            reference: `TPA-APL-${res.claim_id}`,
            message: 'This appeal has already been transmitted to the TPA Adjudication Portal.'
          });
        }
      }
    } catch (err) {
      console.error('Error fetching claim appeal dossier:', err);
      setError(err.message || 'Failed to retrieve claim appeal dossier');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAppealDossier();
    }
  }, [isOpen, claimIdentifier, patientData]);

  if (!isOpen) return null;

  const handleCopyLetter = () => {
    if (!editableLetter) return;
    navigator.clipboard.writeText(editableLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResolveMissingItem = async (itemId = 'medical_necessity') => {
    try {
      setResolvingChecklist(true);
      setError(null);
      const res = await apiService.resolveClaimChecklistItem(dossier?.claim_id || targetId, itemId);
      if (res) {
        setDossier(res);
        setEditableLetter(res.appeal_letter || '');
      }
    } catch (err) {
      console.error('Error resolving checklist item:', err);
      setError(err.message || 'Failed to scan and attach missing evidence from EMR');
    } finally {
      setResolvingChecklist(false);
    }
  };

  const handleSubmitAppeal = async () => {
    if (dossier?.gate_status === 'RE_SUBMISSION_BLOCKED') {
      setError(`Cannot submit: ${dossier?.blocked_reason || 'Missing required clinical justification'}`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const payload = {
        claim_id: dossier?.claim_id || patientData?.claim_id,
        patient_id: dossier?.patient_id || patientData?.patient_id,
        denial_code: dossier?.denial_code || 'Denial Code 204',
        disputed_amount: dossier?.disputed_amount || patientData?.rejected_amount || 80000,
        shortfall_reason: dossier?.rejection_reason || 'Disputed deduction',
        appeal_letter: editableLetter,
        submitted_by: 'R. Sundar (Revenue Cycle Lead)'
      };

      const res = await apiService.submitClaimAppeal(payload);
      if (res && res.success) {
        setSubmissionSuccess({
          reference: res.appeal_reference,
          message: res.message || 'Appeal successfully transmitted to TPA portal.'
        });
        if (onAppealSubmitted) {
          onAppealSubmitted(res);
        }
      }
    } catch (err) {
      console.error('Error submitting claim appeal:', err);
      setError(err.message || 'Failed to submit appeal to TPA');
    } finally {
      setSubmitting(false);
    }
  };

  const claimedAmt = Number(dossier?.claimed_amount || patientData?.estimated_cost || 150000);
  const approvedAmt = Number(dossier?.approved_amount || patientData?.approved_amount || 70000);
  const disputedAmt = Number(dossier?.disputed_amount || patientData?.rejected_amount || (claimedAmt - approvedAmt));

  const checklist = dossier?.resubmission_checklist || [
    { id: 'doc_recommendation', title: 'Updated doctor recommendation', status: 'AVAILABLE', mandatory: true },
    { id: 'clinical_diagnosis', title: 'Clinical diagnosis', status: 'AVAILABLE', mandatory: true },
    { id: 'investigation_reports', title: 'Relevant investigation reports', status: 'AVAILABLE', mandatory: true },
    { id: 'procedure_plan', title: 'Treatment/procedure plan', status: 'AVAILABLE', mandatory: true },
    { id: 'medical_necessity', title: 'Medical necessity justification', status: 'MISSING', mandatory: true },
    { id: 'cost_estimate', title: 'Updated cost estimate', status: 'AVAILABLE', mandatory: true },
  ];

  const isBlocked = dossier ? dossier.gate_status === 'RE_SUBMISSION_BLOCKED' : checklist.some(c => c.status === 'MISSING');
  const missingItem = checklist.find(c => c.status === 'MISSING');

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 9999,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '820px',
        height: '100%',
        background: '#ffffff',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>

        {/* ── Top Header ────────────────────────────────────────────────────── */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #fee2e2',
          background: 'linear-gradient(135deg, #fff1f2 0%, #ffffff 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}>
                <ShieldAlert size={13} />
                Claim Denial Gate · AG-20 Appeal Desk
              </span>
              <span style={{
                fontSize: '11px',
                color: '#991b1b',
                fontWeight: 600,
                background: '#fee2e2',
                padding: '2px 7px',
                borderRadius: '4px'
              }}>
                காப்பீட்டு மறுப்பு மேல்முறையீடு
              </span>
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '6px 0 2px 0' }}>
              Claim Denial &amp; Resubmission Validation Agent
            </h2>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Automated Rejection Parsing · Checklist Audit Gate · EMR Proof Extraction · Resubmit to TPA
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Interactive Workflow Stepper ──────────────────────────────────── */}
        <div style={{
          padding: '8px 20px',
          background: '#0f172a',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          overflowX: 'auto',
          gap: '6px'
        }}>
          <span style={{ color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            1. TPA Rejection <ArrowRight size={11} />
          </span>
          <span style={{ color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '3px' }}>
            2. Classify Reason <ArrowRight size={11} />
          </span>
          <span style={{ color: '#fde047', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            3. Required Docs Audit <ArrowRight size={11} />
          </span>
          <span style={{ color: isBlocked ? '#f87171' : '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            {isBlocked ? '4. Missing Document Blocked ✗' : '4. Documents Validated ✓'} <ArrowRight size={11} />
          </span>
          <span style={{ color: isBlocked ? '#64748b' : '#38bdf8', fontWeight: isBlocked ? 400 : 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
            5. Resubmit to TPA
          </span>
        </div>

        {/* ── Patient & Financial Summary Strip ───────────────────────────── */}
        <div style={{
          padding: '12px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                {dossier?.patient_name || patientData?.patient_name || 'Patient'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontFamily: 'monospace' }}>
                {dossier?.patient_code || patientData?.patient_code} · {dossier?.claim_number || patientData?.claim_number || 'MER-CLM-001'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                {dossier?.insurance_provider || patientData?.insurance_provider}
              </span>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 600,
                border: '1px solid #bfdbfe'
              }}>
                Pol: {dossier?.policy_number || patientData?.policy_number}
              </span>
            </div>
          </div>

          {/* 3 Metric Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 12px'
            }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Claimed
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                ₹{claimedAmt.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 12px'
            }}>
              <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Approved by TPA
              </div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace' }}>
                ₹{approvedAmt.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '8px 12px'
            }}>
              <div style={{ fontSize: '10.5px', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase' }}>
                Disputed / Denied Amount
              </div>
              <div style={{ fontSize: '17px', fontWeight: 900, color: '#dc2626', fontFamily: 'monospace' }}>
                -₹{disputedAmt.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sub-Navigation Tabs ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          padding: '0 20px'
        }}>
          {[
            { id: 'audit', label: '1. Rejection & Audit Gate', icon: <FileCheck2 size={14} /> },
            { id: 'evidence', label: '2. EMR Evidence Dossier', icon: <Stethoscope size={14} /> },
            { id: 'letter', label: '3. Corrected Appeal Letter', icon: <FileText size={14} /> }
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 14px',
                border: 'none',
                background: 'transparent',
                fontSize: '12.5px',
                fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? '#dc2626' : '#64748b',
                borderBottom: activeTab === t.id ? '2px solid #dc2626' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content Area ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f8fafc' }}>
          
          {loading ? (
            <ModuleLoadingScreen title="Loading Claim Appeal..." subtitle="Reviewing the denial reason and assembling appeal details..." badgeText="Live Data Sync" layout="cards" statCount={4} />
          ) : (
            <>
              {error && (
                <div style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '12px',
                  marginBottom: '14px'
                }}>
                  {error}
                </div>
              )}

              {/* ── TAB 1: REJECTION & AUDIT GATE ─────────────────────────── */}
              {activeTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  
                  {/* Step 1: Read Rejection Reason & Classify */}
                  <div style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1px solid #fecaca',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase' }}>
                          TPA Rejection Notice &amp; Classified Denial
                        </div>
                        <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#b91c1c', marginTop: '3px' }}>
                          {dossier?.denial_code || 'Denial Code 204'} · {dossier?.rejection_reason || 'Insufficient clinical justification for proposed surgery'}
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 8px',
                        background: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        {dossier?.denial_category || 'Clinical Justification'}
                      </span>
                    </div>

                    <div style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: '#fff1f2',
                      border: '1px solid #ffe4e6',
                      fontSize: '12px',
                      color: '#4c0519'
                    }}>
                      <strong>Policy Clause:</strong> {dossier?.policy_clause || dossier?.irda_guideline_reference || 'Policy Clause 4.2 · Pre-Existing Disease Exclusion'}
                    </div>
                  </div>

                  {/* Step 2: Required for Re-submission Audit Checklist */}
                  <div style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                          Required for Re-submission Audit
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          Validation gate enforces all mandatory clinical &amp; billing documents before submission to TPA.
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 9px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: isBlocked ? '#fee2e2' : '#dcfce7',
                        color: isBlocked ? '#991b1b' : '#166534',
                        border: isBlocked ? '1px solid #fecaca' : '1px solid #bbf7d0'
                      }}>
                        {isBlocked ? `${checklist.filter(c => c.status === 'AVAILABLE').length}/${checklist.length} Available` : '6/6 Available'}
                      </span>
                    </div>

                    {/* Checklist items list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {checklist.map((item) => {
                        const isAvail = item.status === 'AVAILABLE';
                        return (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              borderRadius: '6px',
                              background: isAvail ? '#f8fafc' : '#fef2f2',
                              border: isAvail ? '1px solid #e2e8f0' : '1px solid #fecaca'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {isAvail ? (
                                <CheckCircle2 size={17} style={{ color: '#16a34a', flexShrink: 0 }} />
                              ) : (
                                <XCircle size={17} style={{ color: '#dc2626', flexShrink: 0 }} />
                              )}
                              <div>
                                <div style={{
                                  fontSize: '12.5px',
                                  fontWeight: 600,
                                  color: isAvail ? '#0f172a' : '#991b1b'
                                }}>
                                  {item.title}
                                </div>
                                <div style={{ fontSize: '11px', color: isAvail ? '#64748b' : '#b91c1c' }}>
                                  {item.source || item.detail}
                                </div>
                              </div>
                            </div>

                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: isAvail ? '#dcfce7' : '#fee2e2',
                              color: isAvail ? '#15803d' : '#b91c1c'
                            }}>
                              {isAvail ? '✓ Available' : '✗ Missing'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 3: Result Gate Banner (Blocked vs Ready) */}
                  {isBlocked ? (
                    <div style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: '#fff1f2',
                      border: '1.5px solid #f87171',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Lock size={16} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#991b1b', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                            RESULT: RE-SUBMISSION BLOCKED
                          </div>
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#7f1d1d', marginTop: '2px' }}>
                            Reason: {dossier?.blocked_reason || `${missingItem?.title || 'Medical necessity justification'} is missing.`}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#991b1b', marginTop: '4px', lineHeight: 1.4 }}>
                            {dossier?.denial_code_number === '402'
                              ? 'The TPA will immediately reject a re-submission without treating doctor clarification establishing that this condition was an acute episode without manifestations prior to policy inception.'
                              : dossier?.denial_code_number === '102'
                              ? 'The TPA will reject an appeal without clinical essentiality justification for disputed surgical consumables.'
                              : 'The TPA will immediately reject a re-submission without required medical justification. The agent can synthesize this directly from EMR archives.'}
                          </div>
                        </div>
                      </div>

                      {/* Action to resolve missing doc */}
                      <button
                        type="button"
                        disabled={resolvingChecklist}
                        onClick={() => handleResolveMissingItem(missingItem?.id || 'medical_necessity')}
                        style={{
                          alignSelf: 'flex-start',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          background: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          cursor: resolvingChecklist ? 'not-allowed' : 'pointer',
                          boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)',
                          opacity: resolvingChecklist ? 0.7 : 1
                        }}
                      >
                        {resolvingChecklist ? (
                          <>
                            <RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                            Retrieving Historical EMR Records...
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            {dossier?.denial_code_number === '402'
                              ? "⚡ Scan EMR & Auto-Attach Doctor's Clarification on Pre-existing Condition"
                              : dossier?.denial_code_number === '102'
                              ? "⚡ Auto-Attach Sterile Consumable Essentiality Certificate"
                              : dossier?.denial_code_number === '405'
                              ? "⚡ Auto-Attach Inpatient Severity & Continuous Monitoring Justification"
                              : `⚡ Scan EMR & Auto-Attach ${missingItem?.title || 'Required Clinical Proof'}`}
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: '#ecfdf5',
                      border: '1.5px solid #34d399',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          background: '#16a34a',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <CheckCircle size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>
                            RESULT: RE-SUBMISSION PERMITTED (6/6 Available)
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#047857', marginTop: '1px' }}>
                            All clinical indications, MRI reports &amp; medical necessity proofs verified. Dossier ready for TPA dispatch.
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        background: '#d1fae5',
                        color: '#047857',
                        fontWeight: 700,
                        borderRadius: '6px'
                      }}>
                        Gate Unlocked
                      </span>
                    </div>
                  )}

                  {/* Bilingual Explainer Card */}
                  <div style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                        Desk Context &amp; Language Synthesis
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setActiveLang('en')}
                          style={{
                            padding: '2px 8px',
                            fontSize: '10.5px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            border: activeLang === 'en' ? '1px solid #dc2626' : '1px solid #cbd5e1',
                            background: activeLang === 'en' ? '#fef2f2' : '#ffffff',
                            color: activeLang === 'en' ? '#dc2626' : '#64748b',
                            cursor: 'pointer'
                          }}
                        >
                          English
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveLang('ta')}
                          style={{
                            padding: '2px 8px',
                            fontSize: '10.5px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            border: activeLang === 'ta' ? '1px solid #dc2626' : '1px solid #cbd5e1',
                            background: activeLang === 'ta' ? '#fef2f2' : '#ffffff',
                            color: activeLang === 'ta' ? '#dc2626' : '#64748b',
                            cursor: 'pointer'
                          }}
                        >
                          தமிழ் (Tamil)
                        </button>
                      </div>
                    </div>

                    {activeLang === 'ta' ? (
                      <div style={{
                        fontSize: '12.5px',
                        lineHeight: 1.6,
                        color: '#1e293b',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'system-ui, sans-serif',
                        background: '#f8fafc',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {dossier?.tamil_summary}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12.5px', lineHeight: 1.5, color: '#334155' }}>
                        The TPA rejected with reason: <em>"{dossier?.rejection_reason || 'Insufficient clinical justification'}"</em>. 
                        The agent assembled the 6-point checklist. Medical necessity documentation is enforced before re-submission to guarantee first-time reconsideration approval without queries.
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ── TAB 2: CLINICAL EVIDENCE LOCATED ─────────────────────── */}
              {activeTab === 'evidence' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                    Supporting clinical evidence retrieved by the agent to satisfy TPA surgical indications:
                  </div>

                  {(dossier?.clinical_evidence || []).map((ev, idx) => (
                    <div
                      key={ev.evidence_id || idx}
                      style={{
                        padding: '14px 16px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0'
                        }}>
                          ✓ {ev.status || 'Verified EMR Proof'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                          Ref: {ev.evidence_id}
                        </span>
                      </div>

                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                        {ev.title}
                      </div>

                      <div style={{
                        margin: '8px 0',
                        padding: '8px 10px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #f1f5f9',
                        fontSize: '12px',
                        color: '#334155',
                        lineHeight: 1.5
                      }}>
                        "{ev.finding}"
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                        <span>Signed by: <strong>{ev.doctor}</strong></span>
                        <span>Date: <strong>{ev.date}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── TAB 3: FORMAL APPEAL LETTER ───────────────────────────── */}
              {activeTab === 'letter' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Corrected Request Dossier formatted for TPA reconsideration appeal.
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyLetter}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: copied ? '#ecfdf5' : '#ffffff',
                        border: copied ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                        color: copied ? '#059669' : '#334155',
                        borderRadius: '5px',
                        cursor: 'pointer'
                      }}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied!' : 'Copy Letter'}
                    </button>
                  </div>

                  <textarea
                    value={editableLetter}
                    onChange={(e) => setEditableLetter(e.target.value)}
                    rows={18}
                    style={{
                      width: '100%',
                      padding: '14px',
                      fontSize: '12px',
                      lineHeight: 1.6,
                      fontFamily: 'monospace',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

            </>
          )}

        </div>

        {/* ── Submission Result Banner (if submitted) ─────────────────────── */}
        {submissionSuccess && (
          <div style={{
            padding: '12px 20px',
            background: '#ecfdf5',
            borderTop: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} style={{ color: '#059669' }} />
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#065f46' }}>
                  Appeal Transmitted: {submissionSuccess.reference}
                </div>
                <div style={{ fontSize: '11px', color: '#047857' }}>
                  {submissionSuccess.message} Moved to 'Under TPA Review'.
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: '#d1fae5',
              color: '#047857',
              fontWeight: 700
            }}>
              Live Synced
            </span>
          </div>
        )}

        {/* ── Bottom Action Footer ────────────────────────────────────────── */}
        <div style={{
          padding: '14px 20px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 600,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Close
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={submitting || !!submissionSuccess || isBlocked}
              onClick={handleSubmitAppeal}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 700,
                background: submissionSuccess
                  ? '#059669'
                  : isBlocked
                    ? '#94a3b8'
                    : '#dc2626',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: (submitting || !!submissionSuccess || isBlocked) ? 'not-allowed' : 'pointer',
                boxShadow: isBlocked ? 'none' : '0 2px 4px rgba(220, 38, 38, 0.2)',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Submitting to TPA...
                </>
              ) : submissionSuccess ? (
                <>
                  <CheckCircle size={14} />
                  Appeal Submitted (Under Review)
                </>
              ) : isBlocked ? (
                <>
                  <Lock size={14} />
                  Re-submission Blocked (Missing Justification)
                </>
              ) : (
                <>
                  <Send size={14} />
                  ⚡ Re-submit Corrected Request to TPA (1-Click)
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
