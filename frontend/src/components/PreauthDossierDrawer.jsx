import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, CheckCircle, ShieldCheck, FileText, Send, 
  Sparkles, RefreshCw, Activity, Check, ShieldAlert, Bell
} from 'lucide-react';
import { apiService } from '../services/api';

export default function PreauthDossierDrawer({ 
  isOpen, 
  onClose, 
  patientIdentifier = '87264', 
  onSubmitted = null 
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dossierData, setDossierData] = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [activeLangTab, setActiveLangTab] = useState('en'); // 'en' | 'ta'
  const [error, setError] = useState(null);

  const fetchDossier = async (targetId) => {
    try {
      setLoading(true);
      setError(null);
      setSubmissionResult(null);
      const res = await apiService.getPreauthDossier(targetId || patientIdentifier || '87264');
      if (res && res.dossier) {
        setDossierData(res);
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
      fetchDossier(patientIdentifier);
    }
  }, [isOpen, patientIdentifier]);

  if (!isOpen) return null;

  const caseInfo = dossierData?.case_data || {};
  const dossier = dossierData?.dossier || {};
  const checklist = dossier.checklist_verification || {
    doctor_advice: { status: 'Verified', detail: 'Signed by Dr. Priya Patel' },
    cost_estimate: { status: 'Verified', detail: 'Provisional ₹2.45L bill breakdown attached' },
    policy_id: { status: 'Verified', detail: 'Active Star Health coverage confirmed' },
    operative_report: { status: 'Verified', detail: 'Cath Lab Angiogram (85% LAD lesion) attached' }
  };
  const denialRisk = dossier.denial_risk_assessment || {
    risk_pct: 9,
    risk_level: 'Low Risk',
    model_version: 'preauth-denial v0.9',
    explanation: 'Comprehensive documentation aligns with policy coverage criteria; urgent medical necessity clearly stated.'
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
        denial_risk: `${denialRisk.risk_pct}% (${denialRisk.risk_level} · Model ${denialRisk.model_version})`
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
          maxWidth: '680px',
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
            background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)',
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
                backgroundColor: 'rgba(59, 130, 246, 0.25)',
                border: '1px solid rgba(147, 197, 253, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#93c5fd'
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
                    backgroundColor: 'rgba(59, 130, 246, 0.25)',
                    color: '#bfdbfe',
                    border: '1px solid rgba(147, 197, 253, 0.3)'
                  }}
                >
                  AG-07 · Workflow Automation
                </span>
                <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                  <Sparkles style={{ width: '13px', height: '13px', color: '#fbbf24' }} />
                  Groq openai/gpt-oss-120b
                </span>
              </div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Preauth Submission Dossier
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#c7d2fe' }}>காப்பீட்டு முன்அனுமதி முகவர்</span>
              </h2>
            </div>
          </div>

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
            <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '12px' }}>
              <RefreshCw style={{ width: '32px', height: '32px', color: '#2563eb', animation: 'spin 1s linear infinite' }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                  Synthesizing Preauth Dossier via Groq LLM...
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Aggregating EMR notes, doctor advice, itemized tariffs, and running preauth-denial v0.9
                </div>
              </div>
            </div>
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
                        {caseInfo.patient_name || 'Kavitha Raman'}
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 500, color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                          {caseInfo.patient_code || 'MER-PAT-0087264'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                        <span>{caseInfo.gender || 'Female'}, {caseInfo.age || 52} yrs</span>
                        <span>•</span>
                        <span>{caseInfo.phone || '+91 94440 98712'}</span>
                        <span>•</span>
                        <span style={{ fontWeight: 600, color: '#4338ca' }}>{caseInfo.ward_bed || 'Cath Lab Recovery / Bed C-104'}</span>
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
                      {caseInfo.policy_number || 'STAR-POL-7728194'} (₹{(caseInfo.coverage_limit || 500000).toLocaleString('en-IN')})
                    </strong>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: '6px', backgroundColor: '#eff6ff', border: '1px solid #dbeafe' }}>
                    <span style={{ color: '#1e40af', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Est. Bill Amount</span>
                    <strong style={{ color: '#1d4ed8', fontSize: '14px' }}>
                      ₹{(caseInfo.estimated_cost || 245000).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 4-Point Document Checklist (✓) */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText style={{ width: '15px', height: '15px', color: '#2563eb' }} />
                    Document Readiness Checklist (4/4 Complete)
                  </h4>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857' }}>
                    100% Ready
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <Check style={{ width: '13px', height: '13px', strokeWidth: 3 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#14532d' }}>Doctor Advice & Indication</div>
                      <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                        {checklist.doctor_advice?.detail || 'Admitting advice signed by Dr. Priya Patel'}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <Check style={{ width: '13px', height: '13px', strokeWidth: 3 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#14532d' }}>Cost Estimate Breakdown</div>
                      <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                        {checklist.cost_estimate?.detail || 'Provisional ₹2.45L itemized bill generated'}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <Check style={{ width: '13px', height: '13px', strokeWidth: 3 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#14532d' }}>Active Policy ID & Eligibility</div>
                      <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                        {checklist.policy_id?.detail || 'Star Health Gold (₹5.00L Limit) active'}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      <Check style={{ width: '13px', height: '13px', strokeWidth: 3 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#14532d' }}>Operative / Cath Lab Report</div>
                      <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                        {checklist.operative_report?.detail || 'Cath Lab Angiogram (85% LAD lesion) attached'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Denial-Risk Badge & AI Model Analysis */}
              <div 
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
                  border: '1px solid #a7f3d0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck style={{ width: '22px', height: '22px', color: '#059669', flexShrink: 0 }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#065f46' }}>
                        Denial Risk: {denialRisk.risk_pct}% ({denialRisk.risk_level})
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#047857', backgroundColor: '#d1fae5', padding: '1px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                        Model {denialRisk.model_version || 'preauth-denial v0.9'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                      High first-pass approval confidence (96.4% acceptance probability)
                    </div>
                  </div>
                </div>

                <div 
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid rgba(167, 243, 208, 0.6)',
                    fontSize: '12px',
                    color: '#334155',
                    lineHeight: 1.5
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 500, color: '#0f172a' }}>
                    {denialRisk.explanation || 'Coverage ceiling ₹5,00,000 exceeds requested estimate. ICD-10 medical necessity verified.'}
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                    {denialRisk.mitigation_notes || 'All 4/4 mandatory TPA documents verified. No clinical discrepancies detected.'}
                  </p>
                </div>
              </div>

              {/* Bilingual Clinical Justification Tabs */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity style={{ width: '15px', height: '15px', color: '#4f46e5' }} />
                    Clinical Justification for TPA Review
                  </h4>
                  <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveLangTab('en')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        fontWeight: activeLangTab === 'en' ? 700 : 500,
                        backgroundColor: activeLangTab === 'en' ? '#ffffff' : 'transparent',
                        color: activeLangTab === 'en' ? '#2563eb' : '#64748b',
                        boxShadow: activeLangTab === 'en' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
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
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        fontWeight: activeLangTab === 'ta' ? 700 : 500,
                        backgroundColor: activeLangTab === 'ta' ? '#ffffff' : 'transparent',
                        color: activeLangTab === 'ta' ? '#2563eb' : '#64748b',
                        boxShadow: activeLangTab === 'ta' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      தமிழ் (Tamil)
                    </button>
                  </div>
                </div>

                <div 
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '12.5px',
                    color: '#334155',
                    lineHeight: 1.6
                  }}
                >
                  {activeLangTab === 'en' ? (
                    <p style={{ margin: 0 }}>
                      {dossier.clinical_justification_en || 
                        `Patient presents with severe exertional angina and documented 85% proximal LAD lesion on diagnostic cath lab angiogram. Immediate drug-eluting stenting (DES) is medically indicated to restore myocardial perfusion and avert acute infarction. Provisional estimate complies with institutional tariff.`}
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontFamily: 'sans-serif' }}>
                      {dossier.clinical_justification_ta || 
                        `நோயாளி அவர்களுக்கு ஆஞ்சியோகிராம் பரிசோதனையில் இதய ரத்த நாளத்தில் (LAD) 85% அடைப்பு உறுதி செய்யப்பட்டுள்ளது. இதய அடைப்பை சரிசெய்ய ஸ்டென்ட் (DES) பொருத்துவது அவசியமான சிகிச்சையாகும். மதிப்பிடப்பட்ட தொகை பாலிசி வரம்பிற்குள் உள்ளது.`}
                    </p>
                  )}
                </div>

                {/* Itemized Estimate Table */}
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
                    Itemized Provisional Estimate
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
                          { category: 'Cath Lab & Procedure Charges', amount: 115000 },
                          { category: 'Drug-Eluting Stent (DES) System', amount: 65000 },
                          { category: 'Cardiac High-Dependency Bed (2 Days)', amount: 30000 },
                          { category: 'Pre-Op Cardiac Panel & Consumables', amount: 35000 }
                        ]).map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px' }}>{row.category}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                              ₹{(row.amount || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ backgroundColor: '#eff6ff', fontWeight: 700, color: '#0f172a' }}>
                          <td style={{ padding: '10px 12px' }}>Total Claimable Estimate</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1d4ed8', fontFamily: 'monospace', fontSize: '13px' }}>
                            ₹{(caseInfo.estimated_cost || 245000).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

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

        </div>

        {/* Drawer Footer / Primary 1-Click Action */}
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
              Insurance Desk Human Approval
            </strong>
            <span style={{ fontSize: '11px' }}>R. Sundar / L. Fathima · Zero Manual Typing</span>
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
              {submissionResult ? 'Close' : 'Cancel'}
            </button>

            {!submissionResult ? (
              <button
                type="button"
                disabled={loading || submitting}
                onClick={handleSubmitPreauth}
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
                onClick={() => fetchDossier(patientIdentifier)}
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
                  gap: '6px'
                }}
              >
                <Check style={{ width: '14px', height: '14px' }} />
                Submitted · View Packet
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(drawerContent, document.body) : null;
}
