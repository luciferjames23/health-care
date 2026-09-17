import React, { useState, useEffect } from 'react';
import { agentApi } from './agentApi';
import {
  PatientCandidate,
  ExtractedClinicalData,
  ValidationGatesResult,
  GeneratedDischargeSummary,
  SignOffResult
} from './types';

interface Props {
  onNavigate?: (page: string) => void;
  doctorName?: string;
  initialPatientId?: string | number;
}

export default function DischargeAgentPipeline({
  onNavigate,
  doctorName = 'Dr. Meera Iyer, MD',
  initialPatientId
}: Props) {
  // Candidate patients & selection
  const [candidates, setCandidates] = useState<PatientCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId ? String(initialPatientId) : ''
  );
  const [candidateSearch, setCandidateSearch] = useState<string>('');

  // Pipeline Step (1: Extract, 2: Gates, 3: Generate, 4: Sign-off, 5: Success)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step Data States
  const [extractedData, setExtractedData] = useState<ExtractedClinicalData | null>(null);
  const [validationGates, setValidationGates] = useState<ValidationGatesResult | null>(null);
  const [summaryDraft, setSummaryDraft] = useState<GeneratedDischargeSummary | null>(null);
  const [signOffResult, setSignOffResult] = useState<SignOffResult | null>(null);

  // Busy/Loading states for each step
  const [extracting, setExtracting] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [signingOff, setSigningOff] = useState<boolean>(false);
  const [isRunningAutonomous, setIsRunningAutonomous] = useState<boolean>(false);
  const [autonomousStatus, setAutonomousStatus] = useState<string>('');

  // Errors
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Configuration
  const [selectedModel, setSelectedModel] = useState<string>('Meta-Llama-3.3-70B-Instruct');
  const [physicianNotes, setPhysicianNotes] = useState<string>(
    'Clinical examination confirmed hemodynamically stable. Patient fit for discharge with home prescriptions.'
  );

  // FULL AUTONOMOUS PIPELINE: Clinical Extraction -> Validation Gates -> LLM Summary Generation
  const runAutonomousPipeline = async (targetPatientId?: string, targetModel?: string) => {
    const pid = targetPatientId || selectedPatientId;
    if (!pid) return;

    setIsRunningAutonomous(true);
    setPipelineError(null);
    setExtractedData(null);
    setValidationGates(null);
    setSummaryDraft(null);
    setSignOffResult(null);

    const model = targetModel || selectedModel;

    try {
      // Step 1: Clinical Data Extraction
      setCurrentStep(1);
      setExtracting(true);
      setAutonomousStatus('Step 1/3: Extracting encounter vitals, lab reports & billing from Lakehouse...');
      const data = await agentApi.extractClinicalData(pid);
      setExtractedData(data);
      setExtracting(false);

      // Step 2: Autonomous Validation Gates
      setCurrentStep(2);
      setValidating(true);
      setAutonomousStatus('Step 2/3: Autonomous safety verification: hemodynamic, drug reconciliation & clearance gates...');
      const gates = await agentApi.validateGates(data);
      setValidationGates(gates);
      setValidating(false);

      // Step 3: LLM Discharge Summary Generation
      setCurrentStep(3);
      setGenerating(true);
      setAutonomousStatus(`Step 3/3: Synthesizing discharge summary via ${model}...`);
      const draft = await agentApi.generateSummary(data, model);
      setSummaryDraft(draft);
      setGenerating(false);

      // Step 4: Ready for Physician Review & Sign-Off
      setCurrentStep(4);
      setAutonomousStatus('Autonomous pipeline complete. Ready for physician review & sign-off.');
    } catch (err: any) {
      setPipelineError(err.message || 'Autonomous pipeline execution encountered an error');
    } finally {
      setExtracting(false);
      setValidating(false);
      setGenerating(false);
      setIsRunningAutonomous(false);
    }
  };

  // 1. Fetch eligible candidates dynamically from PostgreSQL
  useEffect(() => {
    let isMounted = true;
    async function loadCandidates() {
      setLoadingCandidates(true);
      setPipelineError(null);
      try {
        const list = await agentApi.getDischargeCandidates();
        if (!isMounted) return;
        setCandidates(list);
        if (list.length > 0) {
          const firstPid = initialPatientId ? String(initialPatientId) : String(list[0].patient_id);
          setSelectedPatientId(firstPid);
          // Run full autonomous pipeline immediately for the first candidate
          runAutonomousPipeline(firstPid);
        }
      } catch (err: any) {
        if (isMounted) {
          setPipelineError(err.message || 'Failed to load candidates from API');
        }
      } finally {
        if (isMounted) setLoadingCandidates(false);
      }
    }
    loadCandidates();
    return () => {
      isMounted = false;
    };
  }, []);

  // When patient selection changes, autonomously run all pipeline steps for the selected patient
  const handleSelectPatient = (pid: string) => {
    setSelectedPatientId(pid);
    runAutonomousPipeline(pid);
  };

  // When model changes, re-run autonomous synthesis
  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    if (selectedPatientId) {
      runAutonomousPipeline(selectedPatientId, newModel);
    }
  };

  // Manual fallback triggers if needed
  const executeStep1Extract = async () => {
    runAutonomousPipeline(selectedPatientId);
  };

  const executeStep2Validate = async (dataToValidate?: ExtractedClinicalData) => {
    const targetData = dataToValidate || extractedData;
    if (!targetData) return;
    setValidating(true);
    try {
      const results = await agentApi.validateGates(targetData);
      setValidationGates(results);
    } catch (err: any) {
      setPipelineError(err.message || 'Validation gates evaluation failed');
    } finally {
      setValidating(false);
    }
  };

  const executeStep3Generate = async () => {
    if (!extractedData) return;
    setGenerating(true);
    try {
      const draft = await agentApi.generateSummary(extractedData, selectedModel);
      setSummaryDraft(draft);
      setCurrentStep(4);
    } catch (err: any) {
      setPipelineError(err.message || 'LLM discharge summary generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // STEP 4: Physician Sign-Off & Database Persistence
  const executeStep4SignOff = async () => {
    if (!extractedData || !summaryDraft) return;
    setSigningOff(true);
    setPipelineError(null);
    try {
      const result = await agentApi.physicianSignOff({
        admissionId: extractedData.admission_id,
        patientId: extractedData.patient_id,
        doctorName: doctorName || extractedData.attending_doctor,
        notes: physicianNotes,
        summaryPayload: summaryDraft
      });
      setSignOffResult(result);
      setCurrentStep(5); // Success confirmation
      // Trigger global event so Bed Board and Command Centre refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hc_api_updated'));
      }
    } catch (err: any) {
      setPipelineError(err.message || 'Physician sign-off execution failed');
    } finally {
      setSigningOff(false);
    }
  };

  const selectedCandidate = candidates.find(
    c => String(c.patient_id) === String(selectedPatientId)
  );

  const filteredCandidates = candidates.filter(c => {
    if (!candidateSearch.trim()) return true;
    const q = candidateSearch.toLowerCase();
    return (
      c.patient_name.toLowerCase().includes(q) ||
      c.patient_number.toLowerCase().includes(q) ||
      c.primary_diagnosis.toLowerCase().includes(q) ||
      c.ward_name.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Breadcrumb & Agent Identity Header */}
      <div style={{
        background: '#fff',
        border: '1px solid #e3e6e8',
        borderRadius: '10px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '11.5px', color: '#8a9096' }}>
            <span style={{ cursor: 'pointer', color: 'oklch(0.5 0.1 200)' }} onClick={() => onNavigate && onNavigate('agents')}>
              Agent Studio
            </span>
            {' › '}
            <span>AG-19</span>
            {' › '}
            <strong style={{ color: '#15181b' }}>Live Pipeline</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'oklch(0.95 0.05 150)',
              color: 'oklch(0.35 0.14 150)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              Published
            </span>
            <span style={{
              background: 'oklch(0.96 0.04 25)',
              color: 'oklch(0.45 0.17 25)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              Risk Tier High
            </span>
            <span style={{
              background: '#f2f3f4',
              color: '#52585e',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              v1.1.0 · Medical Records
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: '#15181b' }}>
              Discharge Summary Agent
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#52585e' }}>
              Autonomous 4-step pipeline: Clinical Data Extraction → Validation Gates → LLM Generation → Physician Sign-Off &amp; Bed Release.
            </p>
          </div>

          {/* Model selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#52585e' }}>Synthesizer LLM:</label>
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid #d0d5dd',
                background: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                color: '#15181b'
              }}
            >
              <option value="Meta-Llama-3.3-70B-Instruct">Meta-Llama-3.3-70B-Instruct (Recommended)</option>
              <option value="GPT-4o-Clinical">GPT-4o Clinical (Azure HIPAA)</option>
              <option value="Claude-3.5-Sonnet">Claude 3.5 Sonnet</option>
              <option value="Databricks-DBRX-Instruct">Databricks DBRX Instruct</option>
            </select>
          </div>
        </div>
      </div>

      {/* Global Error Alert */}
      {pipelineError && (
        <div style={{
          background: 'oklch(0.97 0.04 25)',
          border: '1px solid oklch(0.85 0.08 25)',
          borderRadius: '8px',
          padding: '10px 14px',
          color: 'oklch(0.4 0.16 25)',
          fontSize: '12.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>⚠️</span>
          <span><strong>Agent Pipeline Alert:</strong> {pipelineError}</span>
        </div>
      )}

      {/* Step Progress Stepper */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        background: '#fff',
        border: '1px solid #e3e6e8',
        borderRadius: '10px',
        padding: '12px 16px'
      }}>
        {[
          { num: 1, label: '1. Clinical Extraction', desc: 'Demographics, Stay, Vitals' },
          { num: 2, label: '2. Validation Gates', desc: 'Hemodynamics, Labs, Billing' },
          { num: 3, label: '3. LLM Generation', desc: 'Summary & Medications' },
          { num: 4, label: '4. Physician Sign-Off', desc: 'DB Commit & Bed Release' }
        ].map((st) => {
          const isActive = currentStep === st.num;
          const isDone = currentStep > st.num || (st.num === 4 && signOffResult !== null);
          return (
            <div
              key={st.num}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: isActive ? 'oklch(0.95 0.04 200)' : isDone ? 'oklch(0.97 0.02 150)' : '#f8f9fa',
                border: isActive
                  ? '1.5px solid oklch(0.5 0.1 200)'
                  : isDone
                    ? '1px solid oklch(0.85 0.06 150)'
                    : '1px solid #e3e6e8',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: isActive ? 'oklch(0.4 0.14 200)' : isDone ? 'oklch(0.35 0.12 150)' : '#667085'
              }}>
                {isDone ? '✓ ' : ''}{st.label}
              </div>
              <div style={{ fontSize: '11px', color: '#8a9096', marginTop: '2px' }}>
                {st.desc}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main 2-Column Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>
        {/* Left Column: Live Inpatient Candidates Selector */}
        <div style={{
          background: '#fff',
          border: '1px solid #e3e6e8',
          borderRadius: '10px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#15181b' }}>
              Admitted Inpatients ({candidates.length})
            </span>
            <span style={{ fontSize: '10.5px', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
              ● Live PostgreSQL
            </span>
          </div>

          <input
            type="text"
            value={candidateSearch}
            onChange={(e) => setCandidateSearch(e.target.value)}
            placeholder="Search patient, UHID, ward..."
            style={{
              height: '30px',
              padding: '0 10px',
              border: '1px solid #d0d5dd',
              borderRadius: '6px',
              fontSize: '11.5px',
              outline: 'none'
            }}
          />

          {loadingCandidates ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#8a9096', fontSize: '12px' }}>
              Loading active inpatients from Lakehouse...
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#8a9096', fontSize: '12px' }}>
              No active candidates match filter.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredCandidates.map((c) => {
                const isSelected = String(c.patient_id) === String(selectedPatientId);
                return (
                  <div
                    key={c.admission_id}
                    onClick={() => handleSelectPatient(String(c.patient_id))}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'oklch(0.95 0.04 200)' : '#fff',
                      border: isSelected ? '1.5px solid oklch(0.5 0.1 200)' : '1px solid #eef0f1',
                      transition: 'all 0.12s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong style={{ fontSize: '12.5px', color: isSelected ? 'oklch(0.35 0.14 200)' : '#15181b' }}>
                        {c.patient_name}
                      </strong>
                      <span style={{ fontSize: '10.5px', fontFamily: 'ui-monospace, monospace', color: '#8a9096' }}>
                        {c.patient_number}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#52585e', marginTop: '3px' }}>
                      {c.primary_diagnosis}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10.5px', color: '#8a9096' }}>
                      <span>{c.ward_name} · {c.bed_number}</span>
                      {isSelected && isRunningAutonomous ? (
                        <span style={{ color: 'oklch(0.5 0.1 200)', fontWeight: 700 }}>⚡ Generating...</span>
                      ) : (
                        <span>Stay: {c.current_stay_days}d</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Multi-Step Interactive Pipeline Execution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Patient Overview Banner */}
          {selectedCandidate && (
            <div style={{
              background: '#fff',
              border: '1px solid #e3e6e8',
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#15181b' }}>
                    {selectedCandidate.patient_name}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#667085', fontFamily: 'ui-monospace, monospace' }}>
                    ({selectedCandidate.patient_number})
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'oklch(0.95 0.04 200)',
                    color: 'oklch(0.4 0.12 200)'
                  }}>
                    {selectedCandidate.admission_type}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#52585e', marginTop: '4px' }}>
                  {selectedCandidate.gender}, {selectedCandidate.age} yrs · Blood Group: {selectedCandidate.blood_group} · Attending: {selectedCandidate.attending_doctor} ({selectedCandidate.doctor_specialization})
                </div>
                <div style={{ fontSize: '11.5px', color: '#8a9096', marginTop: '2px' }}>
                  Location: {selectedCandidate.ward_name} · Room {selectedCandidate.room_number} · Bed {selectedCandidate.bed_number}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => runAutonomousPipeline(selectedPatientId)}
                  disabled={isRunningAutonomous}
                  style={{
                    height: '36px',
                    padding: '0 18px',
                    borderRadius: '6px',
                    border: 0,
                    background: isRunningAutonomous ? '#475467' : 'oklch(0.5 0.1 200)',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: isRunningAutonomous ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isRunningAutonomous ? (
                    <>
                      <span style={{ display: 'inline-block', width: '13px', height: '13px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Running Autonomous Pipeline...
                    </>
                  ) : summaryDraft ? (
                    <>⚡ Re-run Autonomous Pipeline</>
                  ) : (
                    <>⚡ Run Autonomous Discharge Agent</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Autonomous Live Pipeline Banner */}
          {isRunningAutonomous && (
            <div style={{
              background: 'oklch(0.97 0.04 200)',
              border: '1.5px solid oklch(0.85 0.08 200)',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid oklch(0.45 0.14 200)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <strong style={{ fontSize: '13px', color: 'oklch(0.35 0.14 200)' }}>
                    Autonomous Discharge Agent Running
                  </strong>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'oklch(0.92 0.06 200)', color: 'oklch(0.35 0.14 200)' }}>
                  Active Step {currentStep} of 4
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#15181b', fontWeight: 500 }}>
                {autonomousStatus}
              </div>
            </div>
          )}

          {/* STEP 1: Extracted Clinical Data Cards */}
          {extractedData && (
            <div style={{
              background: '#fff',
              border: '1px solid #e3e6e8',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13.5px', color: '#15181b' }}>
                  Step 1: Extracted Clinical Encounter &amp; Vitals
                </strong>
                <span style={{ fontSize: '11px', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                  ✓ Ingested from Lakehouse
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #eef0f1' }}>
                  <div style={{ fontSize: '11px', color: '#8a9096' }}>Heart Rate</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#15181b', marginTop: '2px' }}>
                    {extractedData.vitals.heart_rate_bpm} <span style={{ fontSize: '11px', fontWeight: 400 }}>bpm</span>
                  </div>
                </div>
                <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #eef0f1' }}>
                  <div style={{ fontSize: '11px', color: '#8a9096' }}>Blood Pressure</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#15181b', marginTop: '2px' }}>
                    {extractedData.vitals.bp_formatted}
                  </div>
                </div>
                <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #eef0f1' }}>
                  <div style={{ fontSize: '11px', color: '#8a9096' }}>Temperature</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#15181b', marginTop: '2px' }}>
                    {extractedData.vitals.temperature_f}°F
                  </div>
                </div>
                <div style={{ padding: '10px', background: '#f8f9fa', borderRadius: '6px', border: '1px solid #eef0f1' }}>
                  <div style={{ fontSize: '11px', color: '#8a9096' }}>Oxygen Saturation</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#15181b', marginTop: '2px' }}>
                    {extractedData.vitals.oxygen_saturation_pct}%
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                <div style={{ padding: '10px', background: '#fcfdfe', border: '1px solid #eef0f1', borderRadius: '6px' }}>
                  <strong style={{ color: '#15181b' }}>Primary Diagnosis:</strong> {extractedData.primary_diagnosis}
                </div>
                <div style={{ padding: '10px', background: '#fcfdfe', border: '1px solid #eef0f1', borderRadius: '6px' }}>
                  <strong style={{ color: '#15181b' }}>Billing Clearance:</strong> {extractedData.billing.bill_clearance_status} (Balance: ₹{extractedData.billing.outstanding_balance.toLocaleString()})
                </div>
              </div>
            </div>
          )}

          {/* Validating Spinner/Banner */}
          {validating && (
            <div style={{
              background: 'oklch(0.97 0.03 200)',
              border: '1px solid oklch(0.88 0.06 200)',
              borderRadius: '10px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: 'oklch(0.35 0.12 200)',
              fontSize: '13px',
              fontWeight: 500
            }}>
              <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid oklch(0.4 0.12 200)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Autonomous Verification: Evaluating hemodynamic stability, medication reconciliation & billing clearance gates...
            </div>
          )}

          {/* STEP 2: Validation Gates Review */}
          {validationGates && (
            <div style={{
              background: '#fff',
              border: '1px solid #e3e6e8',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13.5px', color: '#15181b' }}>
                  Step 2: Autonomous Validation Gates
                </strong>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: validationGates.all_passed ? 'oklch(0.95 0.05 150)' : 'oklch(0.96 0.05 80)',
                  color: validationGates.all_passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.45 0.14 70)'
                }}>
                  {validationGates.all_passed ? '✓ All 3 Gates Passed' : '⚠️ Gate Warning Evaluated'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(validationGates.gates).map(([key, gate]) => (
                  <div
                    key={key}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: gate.passed ? '1px solid oklch(0.85 0.08 150)' : '1px solid oklch(0.85 0.1 25)',
                      background: gate.passed ? 'oklch(0.98 0.02 150)' : 'oklch(0.98 0.03 25)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#15181b' }}>
                        {gate.passed ? '✓' : '⚠️'} {gate.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#52585e', marginTop: '2px' }}>
                        {gate.detail}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: gate.passed ? 'oklch(0.35 0.14 150)' : 'oklch(0.45 0.18 25)'
                    }}>
                      {gate.passed ? 'PASSED' : 'FLAGGED'}
                    </span>
                  </div>
                ))}
              </div>

              {!summaryDraft && !isRunningAutonomous && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={executeStep3Generate}
                    disabled={generating}
                    style={{
                      height: '34px',
                      padding: '0 16px',
                      borderRadius: '6px',
                      border: 0,
                      background: 'oklch(0.5 0.1 200)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {generating ? 'Generating Discharge Summary Draft...' : 'Generate LLM Discharge Summary (Step 3) ⚡'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: LLM Generated Summary Draft */}
          {summaryDraft && (
            <div style={{
              background: '#fff',
              border: '1px solid #e3e6e8',
              borderRadius: '10px',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eef0f1', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#15181b' }}>
                    Step 3: Discharge Summary Draft
                  </h3>
                  <div style={{ fontSize: '11px', color: '#8a9096', marginTop: '2px' }}>
                    Drafted by {summaryDraft.generation_metadata.agent_name} ({summaryDraft.generation_metadata.model_name}) · Confidence {summaryDraft.generation_metadata.confidence_score * 100}%
                  </div>
                </div>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'oklch(0.95 0.04 200)',
                  color: 'oklch(0.4 0.12 200)'
                }}>
                  Draft Ready for Review
                </span>
              </div>

              {/* Case History & Hospital Course */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '12px', color: '#15181b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Clinical Case History &amp; Presentation
                </strong>
                <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.55, color: '#344054' }}>
                  {summaryDraft.case_history}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '12px', color: '#15181b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Hospital Course &amp; Inpatient Management
                </strong>
                <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.55, color: '#344054' }}>
                  {summaryDraft.hospital_course}
                </p>
              </div>

              {/* Discharge Medications Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <strong style={{ fontSize: '12px', color: '#15181b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Discharge Prescriptions ({summaryDraft.discharge_medications.length} items)
                </strong>
                <div style={{ border: '1px solid #eef0f1', borderRadius: '6px', overflow: 'hidden' }}>
                  {summaryDraft.discharge_medications.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #f2f3f4',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ color: '#15181b', fontWeight: 500 }}>{m.prescription}</span>
                      <span style={{ fontSize: '11px', color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                        ✓ Formulary Verified
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Red Flag Warning Signs */}
              <div style={{ padding: '12px', background: 'oklch(0.98 0.02 25)', border: '1px solid oklch(0.9 0.05 25)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'oklch(0.4 0.16 25)', marginBottom: '4px' }}>
                  EMERGENCY WARNING SIGNS (Seek Immediate ER Care):
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#475467' }}>
                  {summaryDraft.red_flag_warning_signs.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>

              {/* STEP 4: Physician Sign-Off Panel */}
              {currentStep < 5 && (
                <div style={{
                  borderTop: '1px solid #eef0f1',
                  paddingTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: '#fbfcfd',
                  margin: '0 -22px -18px',
                  padding: '16px 22px',
                  borderBottomLeftRadius: '10px',
                  borderBottomRightRadius: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: '#15181b' }}>
                      Step 4: Attending Physician Electronic Sign-Off
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#52585e' }}>
                      Signing as: <strong>{doctorName}</strong>
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#52585e', marginBottom: '4px' }}>
                      Attending Clinician Approval Notes:
                    </label>
                    <input
                      type="text"
                      value={physicianNotes}
                      onChange={(e) => setPhysicianNotes(e.target.value)}
                      style={{
                        width: '100%',
                        height: '32px',
                        padding: '0 10px',
                        border: '1px solid #d0d5dd',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={executeStep4SignOff}
                      disabled={signingOff}
                      style={{
                        height: '38px',
                        padding: '0 22px',
                        borderRadius: '6px',
                        border: 0,
                        background: 'oklch(0.4 0.12 150)',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      {signingOff ? 'Writing to Lakehouse & Releasing Bed...' : '✓ Approve & Discharge Patient'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Success & Bed Release Confirmation */}
          {signOffResult && currentStep === 5 && (
            <div style={{
              background: 'oklch(0.97 0.03 150)',
              border: '1.5px solid oklch(0.7 0.12 150)',
              borderRadius: '10px',
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'oklch(0.4 0.12 150)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px'
              }}>
                ✓
              </div>

              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'oklch(0.25 0.1 150)' }}>
                  Discharge Summary Approved &amp; Executed
                </h3>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#475467' }}>
                  {signOffResult.message}
                </p>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                background: '#fff',
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid oklch(0.85 0.08 150)',
                fontSize: '12px',
                color: '#344054'
              }}>
                <span>Summary ID: <strong>#{signOffResult.summary_id}</strong></span>
                <span>•</span>
                <span>Signed By: <strong>{signOffResult.physician}</strong></span>
                <span>•</span>
                <span>Bed Released: <strong>{signOffResult.bed_released ? 'Yes (Available)' : 'N/A'}</strong></span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('discharge')}
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '6px',
                    border: '1px solid #d0d5dd',
                    background: '#fff',
                    color: '#344054',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  View in Discharge Command Centre →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Reload candidates and reset pipeline
                    setCurrentStep(1);
                    setExtractedData(null);
                    setValidationGates(null);
                    setSummaryDraft(null);
                    setSignOffResult(null);
                    agentApi.getDischargeCandidates().then(setCandidates).catch(() => { });
                  }}
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '6px',
                    border: 0,
                    background: 'oklch(0.5 0.1 200)',
                    color: '#fff',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Discharge Next Inpatient ↻
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
