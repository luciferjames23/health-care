// Dynamic API Service connecting React frontend to FastAPI Databricks Gold & Bronze Layer APIs

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const FETCH_TIMEOUT_MS = 45000;

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
  // PostgreSQL Database & Generic Table APIs
  async getPostgresHealth() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/health`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getPostgresTables(schema = 'public') {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/tables?schema=${encodeURIComponent(schema)}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getTableSchema(tableName, schema = 'public') {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/tables/${encodeURIComponent(tableName)}/schema?schema=${encodeURIComponent(schema)}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getTableData(tableName, limit = null, offset = 0, params = {}) {
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append("limit", limit);
    if (offset) queryParams.append("offset", offset);
    if (params.schema) queryParams.append("schema", params.schema);
    if (params.order_by) queryParams.append("order_by", params.order_by);
    if (params.order_dir) queryParams.append("order_dir", params.order_dir);
    if (params.search) queryParams.append("search", params.search);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/tables/${encodeURIComponent(tableName)}/data?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async executeSqlQuery(query, limit = 100) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/query`, {
      method: 'POST',
      body: JSON.stringify({ query, limit })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.detail || `HTTP error ${res.status}`);
    }
    return await res.json();
  },

  // PostgreSQL UI Workspace Data APIs
  async getCommandCentreData() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/command-centre`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getClinicalPatients(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);
    if (params.search) queryParams.append("search", params.search);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/clinical-patients?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getPatient360(patientId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/patient-360/${encodeURIComponent(patientId)}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getDischargeCandidates(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/discharge-candidates?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBedDemandAnalytics() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/bed-demand`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBedDemandForecast(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);
    if (params.ward_name) queryParams.append("ward_name", params.ward_name);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/bed-demand/forecast?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBedDemandSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/bed-demand`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBedDemand7DayTrend() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/bed-demand/forecast?limit=100`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return { data: data?.summary?.trend || [] };
  },

  async getRevenueAnalytics(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);
    if (params.bill_status) queryParams.append("bill_status", params.bill_status);
    if (params.department_name) queryParams.append("department_name", params.department_name);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/revenue?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getRevenuePredictions(params = {}) {
    return await this.getRevenueAnalytics(params);
  },

  async getRevenuePredictionsSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/revenue?limit=1`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data?.summary || {};
  },

  async getRevenuePredictionById(id) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/revenue/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getSoapNotes(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/soap-notes?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getExecutiveAnalytics() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/postgres/ui/analytics`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

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

  // -------------------------------------------------------------------------
  // 1. Current Admitted Patient Details (/api/v1/gold/current-admission-llm-inputs)
  // -------------------------------------------------------------------------
  async getCurrentAdmissions(params = {}) {
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

  async getCurrentAdmissionLlmInputs(params = {}) {
    return await this.getCurrentAdmissions(params);
  },

  async getCurrentAdmissionLlmInputsSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/current-admission-llm-inputs/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getCurrentAdmissionById(admissionId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/current-admission-llm-inputs/${admissionId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getCurrentAdmissionLlmInputById(admissionId) {
    return await this.getCurrentAdmissionById(admissionId);
  },

  // -------------------------------------------------------------------------
  // 2. Discharged Patient Details (/api/v1/gold/generated-discharge-summaries)
  // -------------------------------------------------------------------------
  async getDischargedPatients(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.patient_id) queryParams.append("patient_id", params.patient_id);
    if (params.patient_number) queryParams.append("patient_number", params.patient_number);
    if (params.admission_id) queryParams.append("admission_id", params.admission_id);
    if (params.approval_status) queryParams.append("approval_status", params.approval_status);
    if (params.attending_physician) queryParams.append("attending_physician", params.attending_physician);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/generated-discharge-summaries?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getGeneratedDischargeSummaries(params = {}) {
    return await this.getDischargedPatients(params);
  },

  async getGeneratedDischargeSummariesSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/generated-discharge-summaries/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getDischargedPatientById(summaryId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/generated-discharge-summaries/${summaryId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getGeneratedDischargeSummaryById(summaryId) {
    return await this.getDischargedPatientById(summaryId);
  },

  // -------------------------------------------------------------------------
  // 3. Ward Details (/api/v1/bronze/wards)
  // -------------------------------------------------------------------------
  async getWards(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.ward_name) queryParams.append("ward_name", params.ward_name);
    if (params.ward_type) queryParams.append("ward_type", params.ward_type);
    if (params.status) queryParams.append("status", params.status);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/wards?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getWardById(wardId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/wards/${wardId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // -------------------------------------------------------------------------
  // 4. Bed Details (/api/v1/bronze/beds)
  // -------------------------------------------------------------------------
  async getBeds(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.ward_name) queryParams.append("ward_name", params.ward_name);
    if (params.bed_type) queryParams.append("bed_type", params.bed_type);
    if (params.occupancy_status) queryParams.append("occupancy_status", params.occupancy_status);
    if (params.patient_id) queryParams.append("patient_id", params.patient_id);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/beds?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getBronzeBeds(params = {}) {
    return await this.getBeds(params);
  },

  async getBronzeBedsSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/beds/summary`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // -------------------------------------------------------------------------
  // 5. Room Details (/api/v1/bronze/rooms)
  // -------------------------------------------------------------------------
  async getRooms(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.room_id) queryParams.append("room_id", params.room_id);
    if (params.room_number) queryParams.append("room_number", params.room_number);
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.room_type) queryParams.append("room_type", params.room_type);
    if (params.status) queryParams.append("status", params.status);
    if (params.limit) queryParams.append("limit", params.limit);
    if (params.offset) queryParams.append("offset", params.offset);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/rooms?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async getRoomById(roomId) {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/rooms/${roomId}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // -------------------------------------------------------------------------
  // 6. Combined Bed Management (/api/v1/gold/bed-management)
  // -------------------------------------------------------------------------
  async getBedManagementData(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.ward_id) queryParams.append("ward_id", params.ward_id);
    if (params.occupancy_status) queryParams.append("occupancy_status", params.occupancy_status);

    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/bed-management?${queryParams.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  // Bronze Endpoints
  async getBronzeSummary() {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/bronze/summary`);
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
};

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
  const admissionNumber = adm.admission_number || `MER-ADM-${record.admission_id}`;
  const attendingDoctor = adm.attending_doctor || `Consultant #${record.doctor_id || 1}`;

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
    mrn: admissionNumber,
    patient_number: admissionNumber,
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

  return {
    id: `DC-${String(record.summary_id || record.admission_id).padStart(2, '0')}`,
    summary_id: record.summary_id,
    admission_id: record.admission_id,
    patient_id: record.patient_id,
    doctor_id: record.doctor_id,
    patient: resolvedPatientName,
    patient_name: resolvedPatientName,
    name: resolvedPatientName,
    bed: record.bed_number || 'Released Bed',
    ward: record.ward_name || 'Discharged Ward',
    doctor: resolvedDoctorName,
    primary_consultant: resolvedDoctorName,
    doctor_name: resolvedDoctorName,
    admission_date: record.admission_date,
    discharge_date: record.discharge_date,
    intent: record.admission_date ? new Date(record.admission_date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent',
    eta: record.discharge_date ? new Date(record.discharge_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Completed',
    diagnoses: record.diagnoses || 'Clinical Discharge Completed',
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

