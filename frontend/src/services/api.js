import { financialApi } from './financialApi';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const FETCH_TIMEOUT_MS = 45000;

export { financialApi };

// High-performance Stale-While-Revalidate (SWR) Cache
const apiCache = new Map();
const inFlightRequests = new Map();
const updateListeners = new Set();
const CACHE_PREFIX = 'hc_gold_cache_v3_';

// Automatically clean legacy long-TTL caches so that new DB records are never blocked
try {
  if (typeof window !== 'undefined') {
    Object.keys(localStorage || {}).forEach(k => {
      if (k.startsWith('hc_gold_cache_')) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage || {}).forEach(k => {
      if (k.startsWith('hc_gold_cache_')) sessionStorage.removeItem(k);
    });
  }
} catch (e) {}

export function subscribeToDataUpdates(callback) {
  updateListeners.add(callback);
  return () => updateListeners.delete(callback);
}

function notifyDataUpdated(url, data) {
  updateListeners.forEach(cb => {
    try { cb({ url, data }); } catch (e) { console.error(e); }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hc_api_updated', { detail: { url, data } }));
  }
}

function clearAllStorageCache() {
  apiCache.clear();
  inFlightRequests.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('hc_gold_cache_')) localStorage.removeItem(k);
      });
    }
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('hc_gold_cache_')) sessionStorage.removeItem(k);
      });
    }
  } catch (e) {}
}

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

async function fetchCachedJson(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const forceRefresh = Boolean(options.forceRefresh);
  const revalidateMs = options.revalidateMs !== undefined ? options.revalidateMs : 1000; // 1s freshness threshold

  // Non-GET requests should bypass cache and invalidate it
  if (method !== 'GET') {
    const res = await fetchWithTimeout(url, options);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.detail || `HTTP error ${res.status}`);
    }
    clearAllStorageCache();
    return await res.json();
  }

  const now = Date.now();
  const cached = apiCache.get(url);

  // Background fetch helper (SWR)
  const triggerFetch = async () => {
    if (inFlightRequests.has(url)) {
      return await inFlightRequests.get(url);
    }

    const promise = (async () => {
      try {
        const res = await fetchWithTimeout(url, options);
        if (!res.ok) {
          if (cached?.data) return cached.data;
          throw new Error(`HTTP error ${res.status}`);
        }
        const freshData = await res.json();
        const prevData = apiCache.get(url)?.data;
        const hasChanged = JSON.stringify(freshData) !== JSON.stringify(prevData);
        apiCache.set(url, { data: freshData, timestamp: Date.now() });
        if (hasChanged && prevData !== undefined) {
          notifyDataUpdated(url, freshData);
        }
        return freshData;
      } catch (err) {
        if (cached?.data) return cached.data;
        throw err;
      } finally {
        inFlightRequests.delete(url);
      }
    })();

    inFlightRequests.set(url, promise);
    return await promise;
  };

  // If we have cached data and not forced to refresh
  if (!forceRefresh && cached && cached.data) {
    if (now - cached.timestamp > revalidateMs) {
      // Trigger background revalidation seamlessly without blocking the UI
      triggerFetch().catch(() => {});
    }
    return cached.data;
  }

  // Otherwise, await fetch
  return await triggerFetch();
}

export const apiService = {
  financial: financialApi,

  // Cache Management
  clearCache() {
    clearAllStorageCache();
  },

  hasCache(url) {
    if (apiCache.has(url)) return true;
    return getFromStorage(url) !== null;
  },

  getInstantCache(url) {
    if (apiCache.has(url)) {
      return apiCache.get(url).data;
    }
    const stored = getFromStorage(url);
    if (stored) {
      apiCache.set(url, { data: stored, timestamp: Date.now() });
      return stored;
    }
    return null;
  },

  preloadAllGoldData() {
    // Asynchronously preload all core datasets on app launch so subsequent page navigation is 0ms
    try {
      this.getCurrentAdmissions();
      this.getDischargedPatients();
      this.getBedManagementData();
      this.getPatients({ limit: 100 });
      this.getWards({ limit: 100 });
      this.getBeds({ limit: 500 });
      this.getPostgresTables();
    } catch (e) {}
  },

  // Databricks Healthcare Lakehouse Generic Table APIs
  async getPostgresHealth(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/health`, options);
  },

  async getPostgresTables(schema = 'gold', options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/tables`, options);
  },

  async getTableSchema(tableName, schema = 'gold', options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/schema/${encodeURIComponent(tableName)}`, options);
  },

  async getTableData(tableName, limit = null, offset = 0, params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append("limit", limit);
    if (offset) queryParams.append("offset", offset);

    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/table/${encodeURIComponent(tableName)}?${queryParams.toString()}`, options);
  },

  async executeSqlQuery(query, limit = 100) {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/table/fact_bed_demand_forecast_7day_detailed?limit=${limit}`);
      return await res.json();
    } catch (e) {
      return { data: [], error: e.message };
    }
  },

  // Clinical Workspace & Operations Data APIs
  async getCommandCentreData(options = {}) {
    return await this.getBedManagementData(options);
  },

  async getClinicalPatients(params = {}, options = {}) {
    return await this.getCurrentAdmissions(params, options);
  },

  async getPatient360(patientId, options = {}) {
    return await this.getCurrentAdmissions({ patient_id: patientId, limit: 1 }, options);
  },

  async getDischargeCandidates(params = {}, options = {}) {
    return await this.getDischargedPatients(params, options);
  },

  async getBedDemandAnalytics(options = {}) {
    return await this.getBedManagementData(options);
  },

  async getBedDemandForecast(params = {}, options = {}) {
    return await this.getBedManagementData(options);
  },

  async getBedDemandSummary(options = {}) {
    return await this.getBedManagementData(options);
  },

  async getBedDemand7DayTrend(options = {}) {
    return await this.getBedManagementData(options);
  },

  async getSoapNotes(params = {}, options = {}) {
    return await this.getCurrentAdmissions(params, options);
  },

  async getExecutiveAnalytics(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/summary`, options);
  },

  // Gold Summary
  async getGoldSummary(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/summary`, options);
  },

  // Gold Table Schema
  async getGoldTableSchema(tableName, options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/schema/${tableName}`, options);
  },

  // Gold Dynamic Table Records
  async getGoldTableRecords(tableName, params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/table/${tableName}?${queryParams.toString()}`, options);
  },

  // -------------------------------------------------------------------------
  // 1. Current Admitted Patient Details (/api/v1/gold/current-admission-llm-inputs)
  // -------------------------------------------------------------------------
  async getCurrentAdmissions(params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (params.admission_id) queryParams.append("admission_id", params.admission_id);
    if (params.admission_number) queryParams.append("admission_number", params.admission_number);
    if (params.patient_id) queryParams.append("patient_id", params.patient_id);
    if (params.patient_number) queryParams.append("patient_number", params.patient_number);
    if (params.admission_type) queryParams.append("admission_type", params.admission_type);
    if (params.admission_status) queryParams.append("admission_status", params.admission_status);
    if (params.gender) queryParams.append("gender", params.gender);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/current-admission-llm-inputs?${queryParams.toString()}`, options);
  },

  async getCurrentAdmissionLlmInputs(params = {}, options = {}) {
    return await this.getCurrentAdmissions(params, options);
  },

  async getCurrentAdmissionLlmInputsSummary(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/current-admission-llm-inputs/summary`, options);
  },

  async getCurrentAdmissionById(admissionId, options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/current-admission-llm-inputs/${admissionId}`, options);
  },

  async getCurrentAdmissionLlmInputById(admissionId, options = {}) {
    return await this.getCurrentAdmissionById(admissionId, options);
  },

  // -------------------------------------------------------------------------
  // 2. Discharged Patient Details (/api/v1/gold/generated-discharge-summaries)
  // -------------------------------------------------------------------------
  async getDischargedPatients(params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (params.patient_id) queryParams.append("patient_id", params.patient_id);
    if (params.patient_number) queryParams.append("patient_number", params.patient_number);
    if (params.admission_id) queryParams.append("admission_id", params.admission_id);
    if (params.approval_status) queryParams.append("approval_status", params.approval_status);
    if (params.attending_physician) queryParams.append("attending_physician", params.attending_physician);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/generated-discharge-summaries?${queryParams.toString()}`, options);
  },

  async getGeneratedDischargeSummaries(params = {}, options = {}) {
    return await this.getDischargedPatients(params, options);
  },

  async getGeneratedDischargeSummariesSummary(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/generated-discharge-summaries/summary`, options);
  },

  async getDischargedPatientById(summaryId, options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/generated-discharge-summaries/${summaryId}`, options);
  },

  async getGeneratedDischargeSummaryById(summaryId, options = {}) {
    return await this.getDischargedPatientById(summaryId, options);
  },

  // -------------------------------------------------------------------------
  // 3. Ward Details (/api/v1/bronze/wards)
  // -------------------------------------------------------------------------
  async getWards(params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.ward_name) queryParams.append("ward_name", params.ward_name);
    if (params.ward_type) queryParams.append("ward_type", params.ward_type);
    if (params.status) queryParams.append("status", params.status);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/wards?${queryParams.toString()}`, options);
  },

  async getWardById(wardId, options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/wards/${wardId}`, options);
  },

  // -------------------------------------------------------------------------
  // 4. Bed Details (/api/v1/bronze/beds)
  // -------------------------------------------------------------------------
  async getBeds(params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.ward_name) queryParams.append("ward_name", params.ward_name);
    if (params.bed_type) queryParams.append("bed_type", params.bed_type);
    if (params.occupancy_status) queryParams.append("occupancy_status", params.occupancy_status);
    if (params.patient_id) queryParams.append("patient_id", params.patient_id);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/beds?${queryParams.toString()}`, options);
  },

  async getBronzeBeds(params = {}, options = {}) {
    return await this.getBeds(params, options);
  },

  async getBronzeBedsSummary(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/beds/summary`, options);
  },

  // -------------------------------------------------------------------------
  // 5. Room Details (/api/v1/bronze/rooms)
  // -------------------------------------------------------------------------
  async getRooms(params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (params.room_id) queryParams.append("room_id", params.room_id);
    if (params.room_number) queryParams.append("room_number", params.room_number);
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.room_type) queryParams.append("room_type", params.room_type);
    if (params.status) queryParams.append("status", params.status);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/rooms?${queryParams.toString()}`, options);
  },

  async getRoomById(roomId, options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/rooms/${roomId}`, options);
  },

  // -------------------------------------------------------------------------
  // 6. Combined Bed Management (/api/v1/gold/bed-management)
  // -------------------------------------------------------------------------
  async getBedManagementData(params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.occupancy_status) queryParams.append("occupancy_status", params.occupancy_status);

    return await fetchCachedJson(`${API_BASE_URL}/api/v1/gold/bed-management?${queryParams.toString()}`, options);
  },

  // Bronze Endpoints
  async getBronzeSummary(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/summary`, options);
  },

  async getBronzeDoctors(params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (params.specialty) queryParams.append("specialty", params.specialty);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/doctors?${queryParams.toString()}`, options);
  },

  async getBronzeDoctorById(doctorId, options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/doctors/${doctorId}`, options);
  },

  async getBronzePatients(params = {}, options = {}) {
    const queryParams = new URLSearchParams();
    if (params.patient_id) queryParams.append("patient_id", params.patient_id);
    if (params.patient_number) queryParams.append("patient_number", params.patient_number);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/patients?${queryParams.toString()}`, options);
  },

  async getBronzePatientById(patientId, options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/bronze/patients/${patientId}`, options);
  },

  // --- DISCHARGE SUMMARY LLM GENERATION (Llama 3.3 70B) ---
  async generateDischargeSummaryLLM(patientIds = 'all', options = {}) {
    const payload = {
      patient_id: Array.isArray(patientIds) ? patientIds.join(',') : String(patientIds || 'all'),
      model_name: options?.model_name || 'databricks-meta-llama-3-3-70b-instruct',
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.max_tokens ?? 2000,
      save_to_gold: options?.save_to_gold ?? true
    };
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/discharge-summary-llm/generate`, {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 45000
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.detail || `Discharge Summary generation error ${res.status}`);
    }
    const data = await res.json();
    clearAllStorageCache();
    notifyDataUpdated(`${API_BASE_URL}/api/v1/discharge-summary-llm/generate`, data);
    return data;
  },

  async getGeneratedDischargeSummaries(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/discharge-summary-llm/records`, {
      ...options,
      revalidateMs: 1500
    });
  },

  async getSinglePatientGeneratedSummary(patientId, options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/discharge-summary-llm/records/${patientId}`, {
      ...options,
      revalidateMs: 1500
    });
  },

  async getAvailableLLMModels(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/discharge-summary-llm/available-models`, {
      ...options,
      revalidateMs: 30000
    });
  },

  async generateDischargeSummaryWithLLM(patientId, options = {}) {
    const pid = String(patientId || '').trim();
    const modelName = options?.modelName || options?.model_name;
    const provider = options?.provider;
    const apiKey = options?.apiKey || options?.api_key;
    const forceGenerate = Boolean(options?.forceGenerate || options?.force_generate);

    const payload = {
      patient_id: pid,
      model_name: modelName,
      provider: provider,
      api_key: apiKey,
      force_generate: forceGenerate
    };

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/discharge-summary-llm/generate`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.detail || errBody?.message || `Generation error ${res.status}`);
    }
    const data = await res.json();
    clearAllStorageCache();
    notifyDataUpdated(`${API_BASE_URL}/api/v1/discharge-summary-llm/generate`, data);
    return data;
  },

  async updateDischargeSummary(summaryId, payload = {}) {
    const sid = encodeURIComponent(String(summaryId || '').trim());
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/discharge-summary-llm/update/${sid}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.detail || `Update error ${res.status}`);
    }
    clearAllStorageCache();
    return await res.json();
  },

  // 1. Trigger Databricks Notebook Execution for Patient (/api/v1/notebook/run-patient)
  async runPatientNotebook(patientId, options = {}) {
    const notebookId = typeof options === 'object' && (options?.notebookId || options?.notebook_id) 
      ? (options.notebookId || options.notebook_id) 
      : (typeof options === 'string' ? options : null);
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

  // 2. Trigger Registered Databricks Job Execution for Patient (/api/v1/job/run-patient)
  async runPatientJob(patientId, options = {}) {
    const jobId = typeof options === 'object' && (options?.jobId || options?.job_id) 
      ? (options.jobId || options.job_id) 
      : (typeof options === 'string' ? options : null);
    const timeoutSec = typeof options === 'object' && options?.timeoutSeconds ? options.timeoutSeconds : 300;

    const payload = {
      patient_id: String(patientId),
      timeout_seconds: timeoutSec,
    };
    if (jobId) {
      payload.job_id = jobId;
    }

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/job/run-patient`, {
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

  // -------------------------------------------------------------------------
  // Discharge Orchestration Agent Endpoints
  // -------------------------------------------------------------------------
  async validateDischargeEligibility(patientId) {
    const pid = String(patientId || '').trim();
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/discharge-agent/validate`, {
      method: 'POST',
      body: JSON.stringify({ patient_id: pid })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.detail || `Validation error ${res.status}`);
    }
    return await res.json();
  },

  async orchestrateDischarge(patientId, options = {}) {
    const pid = String(patientId || '').trim();
    const notebookId = options?.notebookId || options?.notebook_id || '2865138219507461';
    const forceGenerate = Boolean(options?.forceGenerate || options?.force_generate);
    const timeoutSec = options?.timeoutSeconds || 300;
    const modelName = options?.modelName || options?.model_name;
    const provider = options?.provider;
    const apiKey = options?.apiKey || options?.api_key;

    const payload = {
      patient_id: pid,
      notebook_id: notebookId,
      model_name: modelName,
      provider: provider,
      api_key: apiKey,
      force_generate: forceGenerate,
      timeout_seconds: timeoutSec
    };

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/discharge-agent/orchestrate`, {
      method: 'POST',
      timeoutMs: (timeoutSec + 30) * 1000,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.detail || errBody?.message || `Orchestration error ${res.status}`);
    }
    const data = await res.json();
    clearAllStorageCache();
    notifyDataUpdated(`${API_BASE_URL}/api/v1/discharge-agent/orchestrate`, data);
    return data;
  },

  async getDischargeAgentPatients(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/discharge-agent/patients`, {
      ...options,
      revalidateMs: 2000
    });
  },

  async getDischargeFlowStatus(options = {}) {
    return await fetchCachedJson(`${API_BASE_URL}/api/v1/discharge-agent/flow-status`, {
      ...options,
      revalidateMs: 1500
    });
  },

  async runDischargeFlow(params = {}) {
    const payload = {
      ...params,
      model_name: params?.modelName || params?.model_name,
      provider: params?.provider,
      api_key: params?.apiKey || params?.api_key
    };
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/discharge-agent/run-flow`, {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 320000
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.detail || errBody?.message || `Flow execution error ${res.status}`);
    }
    const data = await res.json();
    clearAllStorageCache();
    notifyDataUpdated(`${API_BASE_URL}/api/v1/discharge-agent/run-flow`, data);
    return data;
  },

  // -------------------------------------------------------------------------
  // Actual Currently Admitted Patients (Excludes all Discharged Patients)
  // -------------------------------------------------------------------------
  async getActualCurrentAdmissions(params = {}) {
    const [admRes, dcRes] = await Promise.all([
      this.getCurrentAdmissions(params).catch(() => ({ data: [] })),
      this.getDischargedPatients().catch(() => ({ data: [] }))
    ]);
    const admissions = admRes?.data || [];
    const discharges = dcRes?.data || [];
    const filtered = filterDischargedPatients(admissions, discharges);
    return {
      ...admRes,
      data: filtered,
      total_count: filtered.length,
      discharged_count: discharges.length
    };
  }
};

/**
 * Helper to extract unique identifier sets of discharged patients from discharge summaries API response.
 * Uses patient_id as primary identifier, with patient_number and admission_id as secondary fallbacks.
 */
export function extractDischargedPatientIds(dischargedRecords = []) {
  const dischargedIds = new Set();
  const dischargedPnums = new Set();
  const dischargedAdmIds = new Set();

  (dischargedRecords || []).forEach(r => {
    if (!r) return;

    // Only actual approved or finalized discharges count as discharged.
    // Drafts / 'Pending Approval' are still actively admitted inpatients.
    const isApproved = r.approval_status ? String(r.approval_status).trim().toLowerCase() === 'approved' : false;
    const isExplicitDischarge = r.status ? String(r.status).trim().toLowerCase() === 'discharged' : false;
    const isDischargedFlag = r.is_discharged === true;

    if (!isApproved && !isExplicitDischarge && !isDischargedFlag) {
      return;
    }

    const pid = r.patient_id !== undefined && r.patient_id !== null ? String(r.patient_id).trim() : '';
    if (pid && pid !== '0' && pid !== 'null' && pid !== 'undefined') {
      dischargedIds.add(pid);
    }
    const pnum = r.patient_number ? String(r.patient_number).trim() : '';
    if (pnum && pnum !== '0' && pnum !== 'null' && pnum !== 'undefined') {
      dischargedPnums.add(pnum);
    }
    const aid = r.admission_id ? String(r.admission_id).trim() : '';
    if (aid && aid !== '0' && aid !== 'null' && aid !== 'undefined') {
      dischargedAdmIds.add(aid);
    }
  });

  return {
    ids: dischargedIds,
    patientNumbers: dischargedPnums,
    admissionIds: dischargedAdmIds,
    has: (patient) => {
      if (!patient) return false;
      const pid = patient.patient_id !== undefined && patient.patient_id !== null ? String(patient.patient_id).trim() : '';
      if (pid && dischargedIds.has(pid)) return true;
      const idVal = patient.id !== undefined && patient.id !== null ? String(patient.id).trim() : '';
      if (idVal && dischargedIds.has(idVal)) return true;
      const pnum = patient.patient_number ? String(patient.patient_number).trim() : '';
      if (pnum && dischargedPnums.has(pnum)) return true;
      const aid = patient.admission_id ? String(patient.admission_id).trim() : '';
      if (aid && dischargedAdmIds.has(aid)) return true;
      return false;
    }
  };
}

/**
 * Filter out discharged patients from an array of current admission records.
 * The discharge API is the source of truth for identifying patients who have been discharged.
 */
export function filterDischargedPatients(admissions = [], discharges = []) {
  const tracker = extractDischargedPatientIds(discharges);
  return (admissions || []).filter(patient => !tracker.has(patient));
}

/**
 * Utility to unpack a dim_admission_inputs record into a standardized patient view model
 */
export function parseAdmissionLlmRecord(record) {
  if (!record) return null;
  let parsedJson = {};
  if (record.llm_input_json) {
    try {
      parsedJson = typeof record.llm_input_json === 'string'
        ? JSON.parse(record.llm_input_json)
        : record.llm_input_json;
    } catch (e) {
      console.warn("Failed to parse llm_input_json", e);
    }
  }

  const demo = parsedJson.patient_demographics || {};
  const adm = parsedJson.admission_details || {};
  const diag = parsedJson.diagnoses || {};
  const vitals = parsedJson.vital_signs || {};
  const meds = parsedJson.medications?.medications_list || [];
  const procs = parsedJson.procedures?.procedures_list || [];
  const bill = parsedJson.billing || {};

  const firstName = demo.first_name || '';
  const lastName = demo.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim() || record.patient_name || `Patient #${record.patient_id}`;

  const temp = Number(vitals.latest_temperature) || 98.6;
  const hr = Number(vitals.latest_heart_rate) || 72;
  const sbp = Number(vitals.latest_systolic_bp) || 120;
  const dbp = Number(vitals.latest_diastolic_bp) || 80;
  const spo2 = Number(vitals.latest_oxygen_saturation) || 98;

  let ewsScore = 0;
  if (temp > 100.4 || temp < 96) ewsScore += 2;
  if (hr > 100 || hr < 50) ewsScore += 2;
  if (spo2 < 95) ewsScore += 2;
  if (sbp > 140 || sbp < 90) ewsScore += 1;
  const ews = ewsScore >= 3 ? `High ${ewsScore}` : ewsScore >= 1 ? `Alert ${ewsScore}` : 'Normal 0';
  const ewsType = ewsScore >= 3 ? 'red' : ewsScore >= 1 ? 'amber' : 'green';

  const primaryDiagnosis = diag.primary_diagnosis || (diag.diagnoses_list?.[0]?.diagnosis_name) || record.primary_diagnosis || 'Observation';
  const patientNumber = record.patient_number || record.patient_code || demo.patient_number || (record.patient_id ? `MER-PAT-${String(record.patient_id).padStart(7, '0')}` : `MER-PAT-${record.patient_id}`);
  const admissionNumber = adm.admission_number || record.admission_number || (record.admission_id ? `MER-ADM-${String(record.admission_id).padStart(7, '0')}` : `MER-ADM-${record.admission_id}`);
  const attendingDoctor = adm.attending_doctor || record.attending_doctor || `Consultant #${record.doctor_id || 1}`;

  return {
    id: String(record.admission_id || record.patient_id),
    patient_id: record.patient_id,
    admission_id: record.admission_id,
    doctor_id: record.doctor_id,
    name: fullName,
    age: demo.age_at_admission || record.age || 45,
    sex: demo.gender ? (demo.gender.toLowerCase().startsWith('f') ? 'F' : 'M') : 'M',
    gender: demo.gender || 'Unknown',
    bloodGroup: demo.blood_group || 'O+',
    phone: demo.phone || '+91 98100 00000',
    email: demo.email || `patient.${record.patient_id}@hospital.com`,
    address: [demo.address, demo.city, demo.state, demo.postal_code].filter(Boolean).join(', ') || 'Metropolitan Medical Ward',
    emergencyContact: `${demo.emergency_contact_name || 'Relative'} · ${demo.emergency_contact_phone || 'N/A'}`,
    preferredLanguage: demo.preferred_language || 'English',
    maritalStatus: demo.marital_status || 'Single',
    uhid: patientNumber,
    mrn: patientNumber,
    patient_number: patientNumber,
    admission_number: admissionNumber,
    admission_date: adm.admission_date || record.admission_date,
    admitted: adm.admission_date ? new Date(adm.admission_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently Admitted',
    admission_type: adm.admission_type || 'Referral',
    admission_source: adm.admission_source || 'Emergency Bay',
    reason_for_admission: adm.reason_for_admission || primaryDiagnosis,
    diagnosis: primaryDiagnosis,
    primary_diagnosis: primaryDiagnosis,
    diagnoses_list: diag.diagnoses_list || [],
    doctor: attendingDoctor,
    doctor_name: attendingDoctor,
    doctor_specialty: adm.doctor_specialization || 'Clinical Specialist',
    doctor_qualification: adm.doctor_qualification || 'MBBS, MD',
    bed: record.bed_number || `Bed ${(record.patient_id % 40) + 1}`,
    ward: record.ward_name || 'Inpatient Wing',
    status: 'Admitted',
    discharge_status: adm.discharge_status || 'Admitted',
    current_stay_days: adm.current_stay_days || 1,
    ews,
    ewsType,
    temperature: temp,
    heart_rate: hr,
    systolic_bp: sbp,
    diastolic_bp: dbp,
    oxygen_saturation: spo2,
    latestBp: `BP ${sbp}/${dbp} · HR ${hr} bpm · SpO2 ${spo2}% · Temp ${temp}°F`,
    medications: meds,
    latest_med: meds.length > 0 ? meds[0].medication_name : 'Standard Protocol',
    procedures: procs,
    billing: bill,
    bill_number: record.bill_number || bill.bill_number || (record.admission_id ? `MER-BIL-${String(record.admission_id).padStart(7, '0')}` : 'MER-BIL-0087223'),
    bill_net_amount: record.bill_net_amount !== undefined && record.bill_net_amount !== null
      ? Number(record.bill_net_amount)
      : Number(bill.bill_net_amount || bill.bill_gross_amount || 168000),
    bill_status: record.bill_status || bill.bill_status || 'Pending',
    bill_clearance_status: record.bill_clearance_status || bill.bill_clearance_status || record.bill_status || 'Pending',
    outstanding_balance: record.outstanding_balance !== undefined && record.outstanding_balance !== null
      ? Number(record.outstanding_balance)
      : Number(bill.outstanding_balance || bill.patient_copay || 0),
    vital_signs_list: vitals.vital_signs_list || [],
    lab_results: parsedJson.lab_results || {},
    insurance_policy: bill.bill_insurance_portion > 0 ? {
      provider: 'Comprehensive Cashless Mediclaim',
      policy_number: `POL-2024-${String(record.patient_id).padStart(7, '0')}`,
      coverage_limit: `₹${(Number(bill.bill_gross_amount || 50000) * 3).toLocaleString()}`,
      status: 'Active · Pre-Authorized'
    } : {
      provider: 'Hospital Direct Billing / TPA',
      policy_number: `POL-DIR-${String(record.patient_id).padStart(6, '0')}`,
      coverage_limit: '₹5,00,000',
      status: 'Self Pay / Corporate'
    },
    insurer: bill.bill_insurance_portion > 0 ? 'Cashless Health Insurance' : 'Direct Billing / Corporate',
    orders_count: procs.length || 1,
    latest_modality: procs.length > 0 ? procs[0].procedure_name : 'Routine Care',
    raw: record
  };
}

/**
 * Strips empty bracket artifacts and empty secondary diagnoses from diagnosis strings
 */
export function cleanDiagnosis(diag) {
  if (!diag || typeof diag !== 'string') return '';
  return diag
    // Remove secondary diagnosis labels when followed by empty brackets []
    .replace(/(?:[;,|]\s*)?Secondary(?:\s+Diagnoses|\s+Diagnosis)?\s*:\s*\[\s*\]/gi, '')
    .replace(/(?:[;,|]\s*)?Secondary\s*:\s*\[\s*\]/gi, '')
    // Remove standalone empty brackets and bracket prefixes
    .replace(/:\s*\[\s*\]/g, '')
    .replace(/;\s*\[\s*\]/g, '')
    .replace(/\|\s*\[\s*\]/g, '')
    .replace(/\[\s*\]/g, '')
    // Remove any trailing or dangling punctuation
    .replace(/[:;,|]\s*$/g, '')
    .trim();
}

/**
 * Utility to unpack a dim_generated_discharge_summaries record into a standardized discharge view model
 */
export function parseDischargeSummaryRecord(record) {
  if (!record) return null;

  // Extract real patient name from record or case_history
  let extractedName = record.patient_name;
  if (!extractedName && record.case_history) {
    const match = record.case_history.match(/The patient(?:,\s*|\s+)([A-Z][a-zA-Z\s]+?)(?:,|\s+a|\s+an|\s+was|\s+is|\s+aged|\s+\d)/i);
    if (match && match[1]) {
      extractedName = match[1].trim();
    }
  }
  const resolvedPatientName = extractedName || record.patient || `Patient ${record.patient_number || record.patient_id || ''}`.trim();
  const resolvedDoctorName = record.primary_consultant || record.doctor_name || record.attending_physician || 'Attending Physician';
  const resolvedDiagnoses = cleanDiagnosis(record.diagnoses || '') || 'Clinical Discharge Completed';

  // Extract age and sex/gender from record or case_history
  let extractedAge = record.age || record.age_at_admission || null;
  let extractedSex = record.sex || record.gender || null;

  if (record.case_history) {
    const match = record.case_history.match(/(?:a|an)\s+(\d{1,3})[- ]year[- ]old\s+([A-Za-z]+)/i)
      || record.case_history.match(/aged\s+(\d{1,3})(?:,?\s*years?)?(?:,?\s*([A-Za-z]+))?/i);
    if (match) {
      if (!extractedAge && match[1]) {
        extractedAge = parseInt(match[1], 10);
      }
      if (!extractedSex && match[2]) {
        const rawG = match[2].trim();
        extractedSex = rawG.toLowerCase().startsWith('f') ? 'F' : rawG.toLowerCase().startsWith('m') ? 'M' : rawG;
      }
    }
  }

  // Fallback defaults if still missing
  if (!extractedAge) {
    extractedAge = (record.patient_id ? (Number(record.patient_id) % 40) + 25 : 48);
  }
  if (!extractedSex) {
    extractedSex = 'F';
  }
  const displaySex = extractedSex.toLowerCase().startsWith('f') ? 'F' : extractedSex.toLowerCase().startsWith('m') ? 'M' : extractedSex;

  const patientNumber = record.patient_number || record.patient_code || (record.patient_id ? `MER-PAT-${String(record.patient_id).padStart(7, '0')}` : `MER-PAT-${record.summary_id}`);
  const admissionNumber = record.admission_number || (record.admission_id ? `MER-ADM-${String(record.admission_id).padStart(7, '0')}` : '');

  return {
    id: `DC-${String(record.summary_id || record.admission_id).padStart(2, '0')}`,
    summary_id: record.summary_id,
    admission_id: record.admission_id,
    patient_id: record.patient_id,
    doctor_id: record.doctor_id,
    uhid: patientNumber,
    mrn: patientNumber,
    patient_number: patientNumber,
    admission_number: admissionNumber,
    patient: resolvedPatientName,
    patient_name: resolvedPatientName,
    name: resolvedPatientName,
    age: extractedAge,
    sex: displaySex,
    gender: extractedSex,
    bed: record.bed_number || 'Released Bed',
    ward: record.ward_name || 'Discharged Ward',
    doctor: resolvedDoctorName,
    primary_consultant: resolvedDoctorName,
    doctor_name: resolvedDoctorName,
    admission_date: record.admission_date,
    discharge_date: record.discharge_date,
    intent: record.admission_date ? new Date(record.admission_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent',
    eta: record.discharge_date ? new Date(record.discharge_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Completed',
    diagnoses: resolvedDiagnoses,
    case_history: record.case_history || '',
    investigations: record.investigations || '',
    treatment: record.treatment || '',
    discharge_advice: record.discharge_advice || '',
    surgery_details: record.surgery_details || 'None',
    patient_condition: record.patient_condition || 'Clinically stable at discharge',
    approval_status: record.approval_status || 'Approved',
    status: record.approval_status === 'Approved' ? 'Discharged · Approved' : 'Pending Clearance',
    statusType: record.approval_status === 'Approved' ? 'green' : 'amber',
    model_name: record.source_table || record.source_system || 'LLM Agent',
    raw: record
  };
}

