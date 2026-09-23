// TypeScript Agent API Service
import {
  PatientCandidate,
  ExtractedClinicalData,
  ValidationGatesResult,
  GeneratedDischargeSummary,
  SignOffResult,
  BatchDischargeSummaryResult
} from './types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const agentApi = {
  /**
   * Fetch eligible admitted patients for the Discharge Agent pipeline
   */
  async getDischargeCandidates(): Promise<PatientCandidate[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/agent/discharge/candidates`);
    if (!res.ok) {
      throw new Error(`Failed to load candidates (${res.status})`);
    }
    const json = await res.json();
    return json.data || [];
  },

  /**
   * Step 1: Extract clinical encounter and vitals for selected patient
   */
  async extractClinicalData(patientId: string | number): Promise<ExtractedClinicalData> {
    const res = await fetch(`${API_BASE_URL}/api/v1/agent/discharge/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: String(patientId) })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Clinical extraction failed (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Step 2: Evaluate Validation Gates (vitals, diagnostics, billing)
   */
  async validateGates(extractedData: ExtractedClinicalData): Promise<ValidationGatesResult> {
    const res = await fetch(`${API_BASE_URL}/api/v1/agent/discharge/validate-gates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extracted_data: extractedData })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Validation gates check failed (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Step 3: Generate LLM Discharge Summary Draft
   */
  async generateSummary(
    extractedData: ExtractedClinicalData,
    modelName: string = 'Meta-Llama-3.3-70B-Instruct'
  ): Promise<GeneratedDischargeSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/agent/discharge/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extracted_data: extractedData,
        model_name: modelName
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `LLM generation failed (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Step 4: Physician Sign-Off & Database Execution
   */
  async physicianSignOff(params: {
    admissionId: number;
    patientId: number;
    doctorName: string;
    notes?: string;
    summaryPayload?: GeneratedDischargeSummary;
  }): Promise<SignOffResult> {
    const res = await fetch(`${API_BASE_URL}/api/v1/agent/discharge/sign-off`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admission_id: params.admissionId,
        patient_id: params.patientId,
        doctor_name: params.doctorName,
        notes: params.notes || 'Clinical review approved.',
        summary_payload: params.summaryPayload
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Sign-off execution failed (${res.status})`);
    }
    const json = await res.json();
    return json.data;
  },

  /**
   * Fetch dynamic pre-flight status metrics for 1-Click Batch dashboard
   */
  async getBatchStatus(modelName?: string): Promise<BatchDischargeSummaryResult> {
    const url = modelName
      ? `${API_BASE_URL}/api/v1/agent/discharge/batch-status?model_name=${encodeURIComponent(modelName)}`
      : `${API_BASE_URL}/api/v1/agent/discharge/batch-status`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load discharge status (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Execute 1-Click Fully Automated Autonomous Discharge Summary Generation
   */
  async runBatchDischarge(modelName: string = 'Meta-Llama-3.3-70B-Instruct'): Promise<BatchDischargeSummaryResult> {
    const res = await fetch(`${API_BASE_URL}/api/v1/agent/discharge/batch-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_name: modelName })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Discharge summary generation failed (${res.status})`);
    }
    return await res.json();
  }
};

