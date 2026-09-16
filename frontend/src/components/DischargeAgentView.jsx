import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import DischargeSummaryModal from './DischargeSummaryModal';

export default function DischargeAgentView({ onNavigate, initialPatientId = '' }) {
  const [activeTab, setActiveTab] = useState('flow'); // 'flow' | 'inspector'
  
  // Single Inspector State
  const [patientIdInput, setPatientIdInput] = useState(initialPatientId || '87224');
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || '87224');
  const [patientsList, setPatientsList] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [modalSummaryData, setModalSummaryData] = useState(null);

  const [validationResult, setValidationResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState(null);

  const [orchestrating, setOrchestrating] = useState(false);
  const [orchestrationResult, setOrchestrationResult] = useState(null);
  const [orchestrationError, setOrchestrationError] = useState(null);
  const [execStep, setExecStep] = useState(0);

  // 3-Step Automated Flow State
  const [flowStatus, setFlowStatus] = useState(null);
  const [loadingFlow, setLoadingFlow] = useState(false);
  const [flowError, setFlowError] = useState(null);
  const [runningFlow, setRunningFlow] = useState(false);
  const [flowRunResult, setFlowRunResult] = useState(null);
  const [flowRunProgress, setFlowRunProgress] = useState(0);

  // Summary Edit & Approval State
  const [agentEditMode, setAgentEditMode] = useState(false);
  const [agentSaving, setAgentSaving] = useState(false);
  const [agentSaveSuccess, setAgentSaveSuccess] = useState(null);
  const [agentSaveError, setAgentSaveError] = useState(null);
  const [agentEditForm, setAgentEditForm] = useState({
    approval_status: 'Approved',
    approved_by: '',
    discharge_diagnosis: '',
    hospital_course_summary: '',
    discharge_medications: '',
    followup_instructions: '',
    patient_condition: ''
  });

  const handleStartAgentEdit = (summary) => {
    setAgentEditMode(true);
    setAgentSaveSuccess(null);
    setAgentSaveError(null);
    setAgentEditForm({
      approval_status: summary.approval_status || 'Pending Approval',
      approved_by: summary.attending_physician || summary.approved_by || 'Dr. Meenakshi Nair, MBBS, MD',
      discharge_diagnosis: summary.discharge_diagnosis || summary.admission_reason || '',
      hospital_course_summary: summary.hospital_course_summary || '',
      discharge_medications: summary.discharge_medications || '',
      followup_instructions: summary.followup_instructions || '',
      patient_condition: summary.patient_condition || 'Clinically stable at discharge'
    });
  };

  const handleSaveAgentSummary = async (summary, overrideStatus = null) => {
    if (!summary) return;
    setAgentSaving(true);
    setAgentSaveSuccess(null);
    setAgentSaveError(null);

    const summaryId = summary.summary_id || (summary.patient_id ? `DS-${summary.patient_id}` : selectedPatientId);
    const targetStatus = overrideStatus || agentEditForm.approval_status || 'Approved';
    const payload = {
      ...agentEditForm,
      approval_status: targetStatus
    };

    try {
      const res = await apiService.updateDischargeSummary(summaryId, payload);
      setAgentSaveSuccess(`✓ Summary ${summaryId} updated successfully (Status: ${targetStatus})`);
      setAgentEditMode(false);
      // Re-validate or update local state
      if (selectedPatientId) runValidation(selectedPatientId);
    } catch (err) {
      setAgentSaveError(err.message || 'Failed to update summary');
    } finally {
      setAgentSaving(false);
    }
  };

  // Load flow status & patients list
  useEffect(() => {
    let isMounted = true;
    
    async function loadData() {
      setLoadingPatients(true);
      setLoadingFlow(true);
      try {
        const [patientsRes, flowRes] = await Promise.all([
          apiService.getDischargeAgentPatients().catch(() => ({ data: [] })),
          apiService.getDischargeFlowStatus().catch(() => null)
        ]);

        if (isMounted) {
          const list = patientsRes?.data || [];
          setPatientsList(list);
          if (flowRes) setFlowStatus(flowRes);
          if (!initialPatientId && list.length > 0) {
            const firstEligible = list.find(p => p.is_eligible) || list[0];
            const firstId = firstEligible.patient_id;
            setPatientIdInput(String(firstId));
            setSelectedPatientId(String(firstId));
          }
        }
      } catch (err) {
        console.error('Failed to load initial discharge agent data:', err);
      } finally {
        if (isMounted) {
          setLoadingPatients(false);
          setLoadingFlow(false);
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [initialPatientId]);

  // Run validation whenever selectedPatientId changes
  useEffect(() => {
    if (!selectedPatientId || activeTab !== 'inspector') return;
    runValidation(selectedPatientId);
  }, [selectedPatientId, activeTab]);

  const runValidation = async (pid) => {
    if (!pid) return;
    setValidating(true);
    setValidateError(null);
    setOrchestrationResult(null);
    setOrchestrationError(null);
    setExecStep(0);
    try {
      const res = await apiService.validateDischargeEligibility(pid);
      setValidationResult(res);
    } catch (err) {
      setValidateError(err.message || 'Failed to validate patient eligibility');
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  const handleSelectPatient = (pid) => {
    setPatientIdInput(String(pid));
    setSelectedPatientId(String(pid));
  };

  const handleTriggerSingleOrchestration = async (force = false) => {
    if (!selectedPatientId) return;
    setOrchestrating(true);
    setOrchestrationError(null);
    setOrchestrationResult(null);
    setExecStep(1);

    const stepInterval = setInterval(() => {
      setExecStep(s => (s < 4 ? s + 1 : s));
    }, 600);

    try {
      const res = await apiService.orchestrateDischarge(selectedPatientId, {
        forceGenerate: force,
        timeoutSeconds: 300
      });
      clearInterval(stepInterval);
      setExecStep(5);
      setOrchestrationResult(res);
      await runValidation(selectedPatientId);
      // Refresh flow status
      const updatedFlow = await apiService.getDischargeFlowStatus();
      setFlowStatus(updatedFlow);
    } catch (err) {
      clearInterval(stepInterval);
      setOrchestrationError(err.message || 'Orchestration execution failed');
    } finally {
      setOrchestrating(false);
    }
  };

  // Run the Automated 3-Step Discharge Flow
  const handleExecuteAutomatedFlow = async () => {
    setRunningFlow(true);
    setFlowError(null);
    setFlowRunResult(null);
    setFlowRunProgress(15);

    const progTimer = setInterval(() => {
      setFlowRunProgress(p => (p < 85 ? p + 15 : p));
    }, 700);

    try {
      const res = await apiService.runDischargeFlow({
        notebook_id: '2865138219507461',
        timeout_seconds: 300
      });
      clearInterval(progTimer);
      setFlowRunProgress(100);
      setFlowRunResult(res);
      // Refresh flow status
      const updatedFlow = await apiService.getDischargeFlowStatus();
      setFlowStatus(updatedFlow);
    } catch (err) {
      clearInterval(progTimer);
      setFlowError(err.message || 'Automated flow execution failed');
    } finally {
      setRunningFlow(false);
    }
  };

  const filteredPatients = patientsList.filter(p => {
    if (!searchFilter.trim()) return true;
    const s = searchFilter.toLowerCase();
    return (p.patient_name && p.patient_name.toLowerCase().includes(s)) ||
           (p.patient_id && String(p.patient_id).includes(s)) ||
           (p.patient_number && p.patient_number.toLowerCase().includes(s)) ||
           (p.primary_diagnosis && p.primary_diagnosis.toLowerCase().includes(s));
  });

  const gates = validationResult?.gates || {};
  const isEligible = validationResult?.is_eligible;
  const pendingReqs = validationResult?.pending_requirements || [];

  const step1Paid = flowStatus?.step_1_bills_summary?.paid_or_completed_count || 0;
  const step1Pending = flowStatus?.step_1_bills_summary?.unpaid_or_pending_count || 0;
  const step2Normal = flowStatus?.step_2_vitals_summary?.normal_vitals_count || 0;
  const step2Unstable = flowStatus?.step_2_vitals_summary?.unstable_vitals_count || 0;
  const step3Ready = flowStatus?.step_3_notebook_ready_summary?.ready_count || 0;
  const unstablePatients = flowStatus?.step_2_vitals_summary?.unstable_indicated_patients || [];
  const readyPatients = flowStatus?.step_3_notebook_ready_summary?.ready_patients || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Hospital Operating Platform</span> › <span>AI PLATFORM</span> › <span style={{ color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}>DISCHARGE ORCHESTRATION AGENT (AG-19)</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Discharge Orchestration Agent</span>
            <span style={{
              fontSize: '11px', padding: '2px 8px', borderRadius: '12px',
              background: 'oklch(0.92 0.05 150)', color: 'oklch(0.35 0.14 150)', fontWeight: 600
            }}>
              ● Governed 3-Step Automated Engine
            </span>
          </div>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            <strong>Step 1:</strong> Find all patients with Paid/Completed Bills → <strong>Step 2:</strong> Check Vitals (Indicate Unstable) → <strong>Step 3:</strong> Execute <strong>Discharge Summary Run</strong> via API for eligible patients.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', border: '1px solid #e3e6e8', borderRadius: '6px', overflow: 'hidden', background: '#fff' }}>
            <button
              type="button"
              onClick={() => setActiveTab('flow')}
              style={{
                height: '32px', padding: '0 12px', border: 0,
                background: activeTab === 'flow' ? '#15181b' : '#fff',
                color: activeTab === 'flow' ? '#fff' : '#15181b',
                fontWeight: 600, fontSize: '11.5px', cursor: 'pointer'
              }}
            >
              ⚡ Automated 3-Step Flow
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inspector')}
              style={{
                height: '32px', padding: '0 12px', border: 0, borderLeft: '1px solid #e3e6e8',
                background: activeTab === 'inspector' ? '#15181b' : '#fff',
                color: activeTab === 'inspector' ? '#fff' : '#15181b',
                fontWeight: 600, fontSize: '11.5px', cursor: 'pointer'
              }}
            >
              🔍 Patient Inspector
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate && onNavigate('discharge')}
            style={{
              height: '32px', padding: '0 12px', borderRadius: '6px',
              border: '1px solid #e3e6e8', background: '#fff', fontSize: '11.5px',
              fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <span>Discharge Command Centre</span> →
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AUTOMATED 3-STEP DISCHARGE FLOW                                    */}
      {/* ========================================================================= */}
      {activeTab === 'flow' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 3-Step Workflow Visual Funnel Banner */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#8a9096' }}>
                  Governed Execution Pipeline
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#15181b' }}>
                  Automated 3-Step Discharge Orchestration Funnel
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExecuteAutomatedFlow}
                  disabled={runningFlow || step3Ready === 0}
                  style={{
                    height: '38px', padding: '0 20px', borderRadius: '6px', border: 0,
                    background: step3Ready > 0 ? 'oklch(0.5 0.1 200)' : '#94a3b8',
                    color: '#fff', fontSize: '12.5px', fontWeight: 700,
                    cursor: step3Ready > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                >
                  {runningFlow ? (
                    <span>⏳ Executing Discharge Summary Run ({flowRunProgress}%)...</span>
                  ) : (
                    <span>🚀 Run Discharge Summary Workflow ({step3Ready} Eligible)</span>
                  )}
                </button>
              </div>
            </div>

            {/* Funnel Step Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              
              {/* Step 1: Bills Paid / Completed */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px',
                display: 'flex', flexDirection: 'column', gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>STEP 1</span>
                  <span style={{
                    fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
                    background: 'oklch(0.92 0.05 150)', color: 'oklch(0.35 0.14 150)'
                  }}>
                    {step1Paid} Paid / Completed
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#15181b' }}>
                  Bill Status Filter
                </div>
                <div style={{ fontSize: '11.5px', color: '#52585e', lineHeight: 1.4 }}>
                  Scans all {flowStatus?.total_admitted_patients || 210} inpatients. Finds patients with cleared/settled bills (Status: Paid, Completed, Cleared).
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                  • {step1Paid} Paid & Cleared · {step1Pending} Pending Unpaid
                </div>
              </div>

              {/* Step 2: Vitals Normal vs Unstable */}
              <div style={{
                background: step2Unstable > 0 ? '#fff8f6' : '#f8fafc',
                border: step2Unstable > 0 ? '1px solid oklch(0.85 0.1 25)' : '1px solid #e2e8f0',
                borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>STEP 2</span>
                  <span style={{
                    fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
                    background: step2Unstable > 0 ? 'oklch(0.95 0.08 25)' : 'oklch(0.92 0.05 150)',
                    color: step2Unstable > 0 ? 'oklch(0.4 0.16 25)' : 'oklch(0.35 0.14 150)'
                  }}>
                    {step2Normal} Normal · {step2Unstable} Unstable
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#15181b' }}>
                  Vital Signs Evaluation
                </div>
                <div style={{ fontSize: '11.5px', color: '#52585e', lineHeight: 1.4 }}>
                  Evaluates SpO2 (&ge;96%), Heart Rate (60-100 bpm), Temperature (&lt;100.0&deg;F), Blood Pressure (&le;140/90 mmHg), and clinical flags.
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: step2Unstable > 0 ? 'oklch(0.4 0.16 25)' : '#64748b', fontWeight: step2Unstable > 0 ? 600 : 400 }}>
                  • {step2Normal} Hemodynamically Stable · ⚠️ {step2Unstable} Flagged Unstable
                </div>
              </div>

              {/* Step 3: Run Discharge Summary */}
              <div style={{
                background: '#f8fafc', border: '1px solid oklch(0.7 0.1 200)', borderRadius: '8px', padding: '14px',
                display: 'flex', flexDirection: 'column', gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'oklch(0.5 0.1 200)' }}>STEP 3</span>
                  <span style={{
                    fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
                    background: 'oklch(0.94 0.04 200)', color: 'oklch(0.4 0.12 200)'
                  }}>
                    {step3Ready} Ready for Generation
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#15181b' }}>
                  Discharge Summary Run
                </div>
                <div style={{ fontSize: '11.5px', color: '#52585e', lineHeight: 1.4 }}>
                  Executes Discharge Summary LLM generation specifically for patients with Paid Bills AND Normal Vitals.
                </div>
                <div style={{ marginTop: '4px', fontSize: '11px', color: 'oklch(0.5 0.1 200)', fontWeight: 600 }}>
                  • Commits to dim_generated_discharge_summaries
                </div>
              </div>

            </div>

            {/* Execution Progress Bar */}
            {runningFlow && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#52585e', marginBottom: '4px' }}>
                  <span>Executing Discharge Summary Run across {step3Ready} eligible inpatients...</span>
                  <span>{flowRunProgress}%</span>
                </div>
                <div style={{ height: '6px', width: '100%', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${flowRunProgress}%`, background: 'oklch(0.5 0.1 200)', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            )}
          </div>

          {flowError && (
            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '14px', color: '#c53030', fontSize: '12px' }}>
              <strong>Execution Error:</strong> {flowError}
            </div>
          )}

          {/* Flow Execution Results Banner */}
          {flowRunResult && (
            <div style={{ background: 'oklch(0.97 0.03 150)', border: '1px solid oklch(0.7 0.1 150)', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'oklch(0.3 0.14 150)', marginBottom: '4px' }}>
                ✓ {flowRunResult.message}
              </div>
              <div style={{ fontSize: '11.5px', color: '#334155' }}>
                Generated discharge summaries for {flowRunResult.summary?.step_3_notebook_executed_count} patients. Records are now committed to the Lakehouse Gold layer and available in the Discharge Command Centre.
              </div>
            </div>
          )}

          {/* SECTION A: ⚠️ INDICATED UNSTABLE PATIENTS (BILL PAID, BUT VITALS UNSTABLE) */}
          <div style={{ background: '#fff', border: '1px solid oklch(0.85 0.1 25)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'oklch(0.4 0.16 25)' }}>
                    Clinical Alert: Bill Paid, but Vital Signs Not Stable ({unstablePatients.length} Patients)
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    These patients have cleared all hospital billing, but summary generation is BLOCKED due to abnormal physiological readings.
                  </div>
                </div>
              </div>
              <span style={{
                fontSize: '10.5px', padding: '3px 8px', borderRadius: '4px', fontWeight: 700,
                background: 'oklch(0.95 0.08 25)', color: 'oklch(0.4 0.16 25)'
              }}>
                Discharge Blocked
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px', marginTop: '10px' }}>
              {unstablePatients.map((p) => (
                <div
                  key={p.patient_id}
                  style={{
                    background: '#fff8f6', border: '1px solid oklch(0.88 0.08 25)',
                    borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#15181b' }}>
                      {p.patient_name}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                      ID: {p.patient_id}
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    Diagnosis: <strong>{p.primary_diagnosis || 'Inpatient Evaluation'}</strong>
                  </div>

                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    Bill Status: <strong style={{ color: 'oklch(0.35 0.14 150)' }}>{p.bill_status} (Cleared)</strong>
                  </div>

                  {/* Vitals & Blocker Details */}
                  <div style={{
                    background: '#fff', border: '1px solid oklch(0.9 0.06 25)',
                    borderRadius: '4px', padding: '6px 8px', fontSize: '10.5px', color: 'oklch(0.38 0.16 25)'
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: '2px' }}>⚠️ Unstable Vitals Detected:</div>
                    <div>{p.vitals_issues?.join(' · ') || p.vital_signs_summary}</div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(String(p.patient_id));
                        setPatientIdInput(String(p.patient_id));
                        setActiveTab('inspector');
                      }}
                      style={{
                        height: '24px', padding: '0 8px', borderRadius: '4px',
                        border: '1px solid #cbd5e1', background: '#fff', fontSize: '10px',
                        fontWeight: 600, cursor: 'pointer', color: '#334155'
                      }}
                    >
                      Inspect Patient 4-Gates →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION B: ✅ ELIGIBLE PATIENTS (BILL PAID + NORMAL VITALS -> NOTEBOOK READY) */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'oklch(0.35 0.14 150)' }}>
                  ✓ Cleared for Discharge: Bill Paid & Vitals Normal ({readyPatients.length} Patients)
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  These patients satisfy all clinical and administrative requirements and are processed for Discharge Summary Generation.
                </div>
              </div>

              <span style={{
                fontSize: '10.5px', padding: '3px 8px', borderRadius: '4px', fontWeight: 700,
                background: 'oklch(0.92 0.05 150)', color: 'oklch(0.35 0.14 150)'
              }}>
                Ready for Discharge Summary Run
              </span>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '10.5px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px' }}>Patient ID</th>
                    <th style={{ padding: '8px 10px' }}>Patient Name</th>
                    <th style={{ padding: '8px 10px' }}>Primary Diagnosis</th>
                    <th style={{ padding: '8px 10px' }}>Bill Status (Step 1)</th>
                    <th style={{ padding: '8px 10px' }}>Vitals Status (Step 2)</th>
                    <th style={{ padding: '8px 10px' }}>Summary Status (Step 3)</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {readyPatients.map((p) => (
                    <tr key={p.patient_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#15181b' }}>
                        {p.patient_id}
                      </td>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#15181b' }}>
                        {p.patient_name}
                      </td>
                      <td style={{ padding: '10px', color: '#475569' }}>
                        {p.primary_diagnosis}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600,
                          background: 'oklch(0.92 0.05 150)', color: 'oklch(0.35 0.14 150)'
                        }}>
                          ✓ Paid (₹{p.bill_net_amount?.toLocaleString()})
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600,
                          background: 'oklch(0.92 0.05 150)', color: 'oklch(0.35 0.14 150)'
                        }}>
                          ✓ Stable ({p.vital_signs_summary})
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600,
                          background: p.has_generated_summary ? 'oklch(0.94 0.04 200)' : '#f1f5f9',
                          color: p.has_generated_summary ? 'oklch(0.4 0.12 200)' : '#64748b'
                        }}>
                          {p.has_generated_summary ? 'Summary Stored' : 'Ready to Run'}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPatientId(String(p.patient_id));
                            setPatientIdInput(String(p.patient_id));
                            setActiveTab('inspector');
                          }}
                          style={{
                            height: '26px', padding: '0 10px', borderRadius: '4px',
                            border: '1px solid #d0d5dd', background: '#fff', fontSize: '11px',
                            fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          View Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SINGLE PATIENT 4-GATE INSPECTOR                                   */}
      {/* ========================================================================= */}
      {activeTab === 'inspector' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px', alignItems: 'start' }}>
          
          {/* Left: Patient Selector & Inpatient Roster */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#15181b' }}>
              Select Patient by ID
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSelectedPatientId(patientIdInput.trim());
              }}
              style={{ display: 'flex', gap: '6px' }}
            >
              <input
                type="text"
                value={patientIdInput}
                onChange={(e) => setPatientIdInput(e.target.value)}
                placeholder="e.g. 87224 or 87227"
                style={{
                  flex: 1, height: '32px', padding: '0 10px', borderRadius: '6px',
                  border: '1px solid #d0d5dd', fontSize: '12px', fontFamily: 'monospace'
                }}
              />
              <button
                type="submit"
                disabled={validating}
                style={{
                  height: '32px', padding: '0 12px', borderRadius: '6px', border: 0,
                  background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '11.5px',
                  fontWeight: 600, cursor: 'pointer'
                }}
              >
                {validating ? 'Checking...' : 'Check'}
              </button>
            </form>

            {/* Search inpatient list */}
            <div style={{ marginTop: '6px' }}>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter inpatient roster..."
                style={{
                  width: '100%', height: '28px', padding: '0 8px', borderRadius: '5px',
                  border: '1px solid #e2e8f0', fontSize: '11px'
                }}
              />
            </div>

            <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#8a9096', textTransform: 'uppercase' }}>
              Inpatient Admissions ({filteredPatients.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '420px', overflowY: 'auto', paddingRight: '2px' }}>
              {loadingPatients && (
                <div style={{ fontSize: '11px', color: '#8a9096', padding: '8px', textAlign: 'center' }}>
                  Loading inpatient records...
                </div>
              )}
              {!loadingPatients && filteredPatients.length === 0 && (
                <div style={{ fontSize: '11px', color: '#8a9096', padding: '8px', textAlign: 'center' }}>
                  No matching patients found.
                </div>
              )}
              {filteredPatients.map((p) => {
                const isSelected = String(p.patient_id) === String(selectedPatientId);
                return (
                  <div
                    key={p.patient_id}
                    onClick={() => handleSelectPatient(p.patient_id)}
                    style={{
                      padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                      background: isSelected ? 'oklch(0.96 0.04 200)' : '#fbfbfc',
                      border: isSelected ? '1.5px solid oklch(0.5 0.1 200)' : '1px solid #eef0f1',
                      display: 'flex', flexDirection: 'column', gap: '3px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#15181b' }}>
                        {p.patient_name}
                      </span>
                      <span style={{
                        fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', fontWeight: 600,
                        background: p.is_eligible ? 'oklch(0.92 0.05 150)' : 'oklch(0.95 0.06 30)',
                        color: p.is_eligible ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)'
                      }}>
                        {p.is_eligible ? 'Ready' : 'Pending'}
                      </span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                      <span>ID: <code style={{ fontFamily: 'monospace' }}>{p.patient_id}</code></span>
                      <span>Age {p.age} · {p.gender}</span>
                    </div>
                    {p.primary_diagnosis && (
                      <div style={{ fontSize: '10px', color: '#8a9096', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.primary_diagnosis}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: 4-Gate Checklist & Orchestration Console */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Patient Overview Banner */}
            {validationResult && (
              <div style={{
                background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#8a9096', textTransform: 'uppercase' }}>
                    Patient Identity & Admission
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#15181b' }}>
                    {validationResult.patient_name}
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 400, marginLeft: '8px' }}>
                      ({validationResult.gender}, {validationResult.age}y) · ID: <strong>{validationResult.patient_id}</strong> · Adm: {validationResult.admission_id}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#52585e', marginTop: '2px' }}>
                    Attending: <strong>{validationResult.attending_doctor || 'Dr. Priya Narayanan'}</strong> · Admission: {validationResult.admission_type || 'Inpatient'} ({validationResult.admission_date})
                  </div>
                </div>

                <div>
                  <div style={{
                    padding: '6px 14px', borderRadius: '6px', textAlign: 'center',
                    background: isEligible ? 'oklch(0.94 0.06 150)' : 'oklch(0.96 0.05 30)',
                    border: isEligible ? '1px solid oklch(0.7 0.12 150)' : '1px solid oklch(0.8 0.1 30)'
                  }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: isEligible ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)' }}>
                      Discharge Eligibility Status
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: isEligible ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)' }}>
                      {isEligible ? 'PASSED · READY FOR SUMMARY' : 'BLOCKED · CONDITIONS PENDING'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {validating && (
              <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#52585e' }}>
                  Evaluating clinical & administrative discharge gates for Patient ID {selectedPatientId}...
                </div>
              </div>
            )}

            {validateError && (
              <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '16px', color: '#c53030' }}>
                <strong>Validation Error:</strong> {validateError}
              </div>
            )}

            {/* 4 Eligibility Gates Grid */}
            {validationResult && !validating && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                
                {/* Gate 1: Bill Clearance */}
                <div style={{
                  background: '#fff',
                  border: gates.bill_clearance?.passed ? '1px solid oklch(0.8 0.1 150)' : '1px solid oklch(0.85 0.1 25)',
                  borderRadius: '8px', padding: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: gates.bill_clearance?.passed ? 'oklch(0.9 0.08 150)' : 'oklch(0.95 0.08 25)',
                        color: gates.bill_clearance?.passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px'
                      }}>
                        {gates.bill_clearance?.passed ? '✓' : '✕'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>1. Bill Clearance (Step 1)</span>
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                      background: gates.bill_clearance?.passed ? 'oklch(0.92 0.05 150)' : 'oklch(0.95 0.06 25)',
                      color: gates.bill_clearance?.passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)'
                    }}>
                      {gates.bill_clearance?.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#15181b', lineHeight: 1.4 }}>
                    {gates.bill_clearance?.details}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#8a9096', borderTop: '1px solid #f0f2f4', paddingTop: '6px' }}>
                    Bill Status: <strong>{validationResult.billing?.bill_status}</strong> · Balance: ₹{validationResult.billing?.outstanding_balance?.toLocaleString()}
                  </div>
                </div>

                {/* Gate 2: Diagnoses */}
                <div style={{
                  background: '#fff',
                  border: gates.diagnoses?.passed ? '1px solid oklch(0.8 0.1 150)' : '1px solid oklch(0.85 0.1 25)',
                  borderRadius: '8px', padding: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: gates.diagnoses?.passed ? 'oklch(0.9 0.08 150)' : 'oklch(0.95 0.08 25)',
                        color: gates.diagnoses?.passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px'
                      }}>
                        {gates.diagnoses?.passed ? '✓' : '✕'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>2. Diagnoses</span>
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                      background: gates.diagnoses?.passed ? 'oklch(0.92 0.05 150)' : 'oklch(0.95 0.06 25)',
                      color: gates.diagnoses?.passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)'
                    }}>
                      {gates.diagnoses?.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#15181b', lineHeight: 1.4 }}>
                    {gates.diagnoses?.details}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#8a9096', borderTop: '1px solid #f0f2f4', paddingTop: '6px' }}>
                    Diagnosis: <strong>{validationResult.primary_diagnosis || 'None'}</strong>
                  </div>
                </div>

                {/* Gate 3: Clinical Status */}
                <div style={{
                  background: '#fff',
                  border: gates.clinical_status?.passed ? '1px solid oklch(0.8 0.1 150)' : '1px solid oklch(0.85 0.1 25)',
                  borderRadius: '8px', padding: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: gates.clinical_status?.passed ? 'oklch(0.9 0.08 150)' : 'oklch(0.95 0.08 25)',
                        color: gates.clinical_status?.passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px'
                      }}>
                        {gates.clinical_status?.passed ? '✓' : '✕'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>3. Clinical Condition</span>
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                      background: gates.clinical_status?.passed ? 'oklch(0.92 0.05 150)' : 'oklch(0.95 0.06 25)',
                      color: gates.clinical_status?.passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)'
                    }}>
                      {gates.clinical_status?.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#15181b', lineHeight: 1.4 }}>
                    {gates.clinical_status?.details}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#8a9096', borderTop: '1px solid #f0f2f4', paddingTop: '6px' }}>
                    Attending Physician: <strong>{validationResult.attending_doctor || 'Dr. Priya Narayanan'}</strong>
                  </div>
                </div>

                {/* Gate 4: Vitals */}
                <div style={{
                  background: '#fff',
                  border: gates.vitals?.passed ? '1px solid oklch(0.8 0.1 150)' : '1px solid oklch(0.85 0.1 25)',
                  borderRadius: '8px', padding: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: gates.vitals?.passed ? 'oklch(0.9 0.08 150)' : 'oklch(0.95 0.08 25)',
                        color: gates.vitals?.passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px'
                      }}>
                        {gates.vitals?.passed ? '✓' : '✕'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>4. Vital Signs (Step 2)</span>
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                      background: gates.vitals?.passed ? 'oklch(0.92 0.05 150)' : 'oklch(0.95 0.06 25)',
                      color: gates.vitals?.passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.4 0.16 25)'
                    }}>
                      {gates.vitals?.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#15181b', lineHeight: 1.4 }}>
                    {gates.vitals?.details}
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#8a9096', borderTop: '1px solid #f0f2f4', paddingTop: '6px' }}>
                    Vitals Summary: <strong>{validationResult.vital_signs_summary || 'Not recorded'}</strong>
                  </div>
                </div>

              </div>
            )}

            {/* Action Trigger Box */}
            {validationResult && !validating && (
              <div style={{
                background: isEligible ? 'oklch(0.98 0.02 150)' : '#fff8f6',
                border: isEligible ? '1px solid oklch(0.7 0.1 150)' : '1px solid oklch(0.8 0.1 25)',
                borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: isEligible ? 'oklch(0.3 0.14 150)' : 'oklch(0.4 0.16 25)' }}>
                      {isEligible
                        ? '✓ All 4 Mandatory Eligibility Conditions are Met'
                        : '⛔ Summary Generation Blocked: Unmet Mandatory Conditions'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#52585e', marginTop: '2px' }}>
                      {isEligible
                        ? 'The agent is cleared to collect patient context, generate the discharge summary, and commit to the Lakehouse.'
                        : `The agent has blocked summary generation due to pending requirements: ${pendingReqs.join(', ')}.`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isEligible ? (
                      <button
                        type="button"
                        onClick={() => handleTriggerSingleOrchestration(false)}
                        disabled={orchestrating}
                        style={{
                          height: '36px', padding: '0 18px', borderRadius: '6px', border: 0,
                          background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '12px',
                          fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}
                      >
                        {orchestrating ? (
                          <span>⏳ Generating Discharge Summary...</span>
                        ) : (
                          <span>🚀 Run Discharge Summary Generation</span>
                        )}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => alert(`Pending resolution required:\n${pendingReqs.map(r => '• ' + r).join('\n')}`)}
                          style={{
                            height: '34px', padding: '0 14px', borderRadius: '6px',
                            border: '1px solid oklch(0.8 0.1 25)', background: '#fff',
                            color: 'oklch(0.4 0.16 25)', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer'
                          }}
                        >
                          View {pendingReqs.length} Blockers
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Generated Discharge Summary Viewer with Dynamic Edit & Approval */}
            {(orchestrationResult?.discharge_summary || validationResult?.existing_summary) && (
              <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
                {(() => {
                  const summary = orchestrationResult?.discharge_summary || validationResult?.existing_summary;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f2f4', paddingBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#8a9096', fontWeight: 600 }}>
                            Gold Layer Record · {summary.summary_id}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: '#15181b' }}>
                            Generated Clinical Discharge Summary
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', fontFamily: 'monospace' }}>
                            /api/v1/discharge-summary-llm/update/{summary.summary_id}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '10.5px', padding: '3px 8px', borderRadius: '4px', fontWeight: 600,
                            background: summary.approval_status === 'Approved' ? 'oklch(0.92 0.05 150)' : 'oklch(0.95 0.06 70)',
                            color: summary.approval_status === 'Approved' ? 'oklch(0.35 0.14 150)' : 'oklch(0.45 0.15 60)'
                          }}>
                            Status: {summary.approval_status || 'Pending Approval'}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setModalSummaryData(summary);
                              setIsSummaryModalOpen(true);
                            }}
                            style={{
                              height: '28px', padding: '0 10px', borderRadius: '5px',
                              border: '1px solid #0284c7', background: '#f0f9ff',
                              color: '#0369a1', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            <span>🖨️</span> View, Edit & Print
                          </button>

                          {!agentEditMode ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartAgentEdit(summary)}
                                style={{
                                  height: '28px', padding: '0 10px', borderRadius: '5px',
                                  border: '1px solid #cbd5e1', background: '#f8fafc',
                                  color: '#334155', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                <span>✏️</span> Quick Edit
                              </button>
                              {summary.approval_status !== 'Approved' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleStartAgentEdit(summary);
                                    handleSaveAgentSummary(summary, 'Approved');
                                  }}
                                  disabled={agentSaving}
                                  style={{
                                    height: '28px', padding: '0 12px', borderRadius: '5px',
                                    border: 0, background: 'oklch(0.5 0.14 150)',
                                    color: '#fff', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  {agentSaving ? 'Saving...' : '✓ Approve'}
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setAgentEditMode(false)}
                                disabled={agentSaving}
                                style={{
                                  height: '28px', padding: '0 10px', borderRadius: '5px',
                                  border: '1px solid #cbd5e1', background: '#fff',
                                  color: '#64748b', fontSize: '11.5px', cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveAgentSummary(summary)}
                                disabled={agentSaving}
                                style={{
                                  height: '28px', padding: '0 14px', borderRadius: '5px',
                                  border: 0, background: 'oklch(0.5 0.1 200)',
                                  color: '#fff', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                              >
                                {agentSaving ? 'Saving...' : '💾 Save Changes'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {agentSaveSuccess && (
                        <div style={{ background: 'oklch(0.96 0.04 150)', border: '1px solid oklch(0.7 0.1 150)', borderRadius: '6px', padding: '8px 12px', color: 'oklch(0.3 0.14 150)', fontSize: '12px', fontWeight: 600 }}>
                          {agentSaveSuccess}
                        </div>
                      )}
                      {agentSaveError && (
                        <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '6px', padding: '8px 12px', color: '#c53030', fontSize: '12px', fontWeight: 600 }}>
                          <strong>Error:</strong> {agentSaveError}
                        </div>
                      )}

                      {!agentEditMode ? (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>
                            <div>
                              <span style={{ color: '#64748b' }}>Attending Physician:</span>
                              <div style={{ fontWeight: 600, color: '#15181b' }}>{summary.attending_physician || 'Dr. Priya Narayanan'}</div>
                            </div>
                            <div>
                              <span style={{ color: '#64748b' }}>Discharge Diagnosis:</span>
                              <div style={{ fontWeight: 600, color: '#15181b' }}>{summary.discharge_diagnosis || summary.admission_reason}</div>
                            </div>
                            <div>
                              <span style={{ color: '#64748b' }}>Model Pipeline:</span>
                              <div style={{ fontWeight: 600, color: '#15181b' }}>{summary.model_name || 'Discharge Summary AI (Llama-3-70B)'}</div>
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#15181b', marginBottom: '4px' }}>
                              1. Hospital Course Summary
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#334155', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', lineHeight: 1.5 }}>
                              {summary.hospital_course_summary}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#15181b', marginBottom: '4px' }}>
                              2. Discharge Medications
                            </div>
                            <pre style={{
                              fontSize: '11px', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0',
                              borderRadius: '6px', padding: '10px', margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap'
                            }}>
                              {summary.discharge_medications}
                            </pre>
                          </div>

                          <div>
                            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#15181b', marginBottom: '4px' }}>
                              3. Follow-up & Bilingual Home Instructions (Tamil + English)
                            </div>
                            <pre style={{
                              fontSize: '11px', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0',
                              borderRadius: '6px', padding: '10px', margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', whiteSpace: 'pre-wrap', lineHeight: 1.5
                            }}>
                              {summary.followup_instructions}
                            </pre>
                          </div>
                        </>
                      ) : (
                        <form onSubmit={(e) => { e.preventDefault(); handleSaveAgentSummary(summary); }} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                                Approval Status:
                              </label>
                              <select
                                value={agentEditForm.approval_status}
                                onChange={(e) => setAgentEditForm(prev => ({ ...prev, approval_status: e.target.value }))}
                                style={{
                                  width: '100%', height: '32px', padding: '0 8px', borderRadius: '5px',
                                  border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#fff'
                                }}
                              >
                                <option value="Approved">Approved</option>
                                <option value="Pending Approval">Pending Approval</option>
                                <option value="Under Revision">Under Revision</option>
                                <option value="Rejected">Rejected</option>
                              </select>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                                Attending Physician / Signee:
                              </label>
                              <input
                                type="text"
                                value={agentEditForm.approved_by}
                                onChange={(e) => setAgentEditForm(prev => ({ ...prev, approved_by: e.target.value }))}
                                style={{
                                  width: '100%', height: '32px', padding: '0 8px', borderRadius: '5px',
                                  border: '1px solid #cbd5e1', fontSize: '11.5px'
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                              Discharge Diagnosis:
                            </label>
                            <input
                              type="text"
                              value={agentEditForm.discharge_diagnosis}
                              onChange={(e) => setAgentEditForm(prev => ({ ...prev, discharge_diagnosis: e.target.value }))}
                              style={{
                                width: '100%', height: '32px', padding: '0 8px', borderRadius: '5px',
                                border: '1px solid #cbd5e1', fontSize: '11.5px'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                              Hospital Course Summary:
                            </label>
                            <textarea
                              rows={3}
                              value={agentEditForm.hospital_course_summary}
                              onChange={(e) => setAgentEditForm(prev => ({ ...prev, hospital_course_summary: e.target.value }))}
                              style={{
                                width: '100%', padding: '6px 8px', borderRadius: '5px',
                                border: '1px solid #cbd5e1', fontSize: '11.5px', fontFamily: 'inherit', lineHeight: 1.4
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                              Discharge Medications:
                            </label>
                            <textarea
                              rows={4}
                              value={agentEditForm.discharge_medications}
                              onChange={(e) => setAgentEditForm(prev => ({ ...prev, discharge_medications: e.target.value }))}
                              style={{
                                width: '100%', padding: '6px 8px', borderRadius: '5px',
                                border: '1px solid #cbd5e1', fontSize: '11px', fontFamily: 'monospace', lineHeight: 1.4
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' }}>
                              Follow-up & Instructions:
                            </label>
                            <textarea
                              rows={3}
                              value={agentEditForm.followup_instructions}
                              onChange={(e) => setAgentEditForm(prev => ({ ...prev, followup_instructions: e.target.value }))}
                              style={{
                                width: '100%', padding: '6px 8px', borderRadius: '5px',
                                border: '1px solid #cbd5e1', fontSize: '11.5px', fontFamily: 'inherit', lineHeight: 1.4
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            <button
                              type="button"
                              onClick={() => setAgentEditMode(false)}
                              disabled={agentSaving}
                              style={{
                                height: '32px', padding: '0 12px', borderRadius: '5px',
                                border: '1px solid #cbd5e1', background: '#fff', fontSize: '11.5px', cursor: 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={agentSaving}
                              style={{
                                height: '32px', padding: '0 16px', borderRadius: '5px', border: 0,
                                background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '12px',
                                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                              }}
                            >
                              {agentSaving ? 'Saving...' : '💾 Save Changes'}
                            </button>
                          </div>
                        </form>
                      )}

                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Full Discharge Summary Modal */}
      <DischargeSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        summaryData={modalSummaryData}
        onSummaryUpdated={(updated) => {
          setModalSummaryData(prev => ({ ...prev, ...updated }));
          if (selectedPatientId) runValidation(selectedPatientId);
        }}
      />
    </div>
  );
}
