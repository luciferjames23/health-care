// Dynamic API Service connecting React frontend to FastAPI Databricks Gold & Bronze Layer APIs

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = FETCH_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export const apiService = {
  // Gold Summary
  async getGoldSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // Gold Table Schema
  async getGoldTableSchema(tableName) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/schema/${tableName}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // Gold Dynamic Table Records
  async getGoldTableRecords(tableName, params = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/table/${tableName}?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // Query dim_revenue_predictions
  async getDimRevenuePredictions(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.department) queryParams.append("department", params.department);
    if (params.risk_level) queryParams.append("risk_level", params.risk_level);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/dim-revenue-predictions?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getDimRevenuePredictionsSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/dim-revenue-predictions/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // Query fact_bed_demand_forecast_7day_detailed
  async getFactBedDemandForecast7DayDetailed(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.ward_name) queryParams.append("ward_name", params.ward_name);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/fact-bed-demand-forecast-7day-detailed?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getFactBedDemandForecastSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/fact-bed-demand-forecast-7day-detailed/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // Query dim_admission_inputs / current-admission-llm-inputs
  async getCurrentAdmissionLlmInputs(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.patient_id) queryParams.append("patient_id", params.patient_id);
    if (params.patient_number) queryParams.append("patient_number", params.patient_number);
    if (params.admission_type) queryParams.append("admission_type", params.admission_type);
    if (params.admission_status) queryParams.append("admission_status", params.admission_status);
    if (params.gender) queryParams.append("gender", params.gender);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/current-admission-llm-inputs?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getCurrentAdmissionLlmInputsSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/current-admission-llm-inputs/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getCurrentAdmissionLlmInputById(admissionId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/current-admission-llm-inputs/${admissionId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // Query dim_generated_discharge_summaries / generated-discharge-summaries
  async getGeneratedDischargeSummaries(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.patient_id) queryParams.append("patient_id", params.patient_id);
    if (params.patient_number) queryParams.append("patient_number", params.patient_number);
    if (params.admission_id) queryParams.append("admission_id", params.admission_id);
    if (params.approval_status) queryParams.append("approval_status", params.approval_status);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/generated-discharge-summaries?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getGeneratedDischargeSummariesSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/generated-discharge-summaries/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getGeneratedDischargeSummaryById(summaryId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/generated-discharge-summaries/${summaryId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // Bronze Endpoints
  async getBronzeSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBronzeBeds(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.occupancy_status) queryParams.append("occupancy_status", params.occupancy_status);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/beds?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBronzeBedsSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/beds/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBronzeDoctors(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.specialty) queryParams.append("specialty", params.specialty);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/doctors?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBronzeDoctorById(doctorId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/doctors/${doctorId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBronzePatients(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.patient_id) queryParams.append("patient_id", params.patient_id);
    if (params.patient_number) queryParams.append("patient_number", params.patient_number);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/patients?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBronzePatientById(patientId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/patients/${patientId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // Trigger Databricks Notebook / Job Execution for Patient
  async runPatientNotebook(patientId, options = {}) {
    const notebookId = typeof options === 'object' && options?.notebookId ? options.notebookId : (typeof options === 'string' ? options : null);
    const timeoutSec = typeof options === 'object' && options?.timeoutSeconds ? options.timeoutSeconds : 300;

    const payload = {
      patient_id: String(patientId),
      timeout_seconds: timeoutSec,
    };
    if (notebookId) {
      payload.notebook_id = notebookId;
    }

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/notebook/run-patient`, {
      method: 'POST',
      timeoutMs: (timeoutSec + 30) * 1000,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  },
};
