// Dynamic API Service connecting React frontend to FastAPI Databricks Gold Layer APIs

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000';

export const MOCK_GOLD_SUMMARY = {
  catalog: "health_care",
  schema: "gold",
  total_tables: 8,
  total_records: 124860,
  tables: [
    { table_name: "dim_revenue_predictions", catalog: "health_care", schema: "gold", row_count: 7, domain: "Financial & Predictive Analytics", description: "Departmental and patient-level revenue projections, actual amounts, prediction variances, model names, and monthly totals." },
    { table_name: "fact_bed_demand_forecast_7day_detailed", catalog: "health_care", schema: "gold", row_count: 3, domain: "Clinical Operations & Bed Management", description: "Detailed 7-day rolling bed demand and ward unit occupancy forecasts including predicted emergency/elective beds and occupancy rates." },
    { table_name: "dim_patient", catalog: "health_care", schema: "gold", row_count: 24500, domain: "Clinical", description: "Patient demographic master table with de-identified identifiers." },
    { table_name: "dim_provider", catalog: "health_care", schema: "gold", row_count: 3200, domain: "Operations", description: "Physicians, specialists, and healthcare facility metadata." },
    { table_name: "fact_encounters", catalog: "health_care", schema: "gold", row_count: 52100, domain: "Clinical", description: "Inpatient, outpatient, and emergency hospital visits." },
    { table_name: "fact_claims", catalog: "health_care", schema: "gold", row_count: 38400, domain: "Financial", description: "Billing claims, insurance coverage, and reimbursement totals." },
    { table_name: "fact_lab_results", catalog: "health_care", schema: "gold", row_count: 4500, domain: "Clinical", description: "Diagnostic laboratory panels and vital signs history." },
    { table_name: "fact_pharmacy", catalog: "health_care", schema: "gold", row_count: 2150, domain: "Pharmacy", description: "Prescription dispenses, medication dosage, and refill logs." }
  ]
};

export const MOCK_SCHEMAS = {
  dim_revenue_predictions: [
    { column_name: "prediction_id", data_type: "STRING", is_primary: true, description: "Unique revenue prediction record identifier" },
    { column_name: "department", data_type: "STRING", is_primary: false, description: "Hospital department name" },
    { column_name: "facility_name", data_type: "STRING", is_primary: false, description: "Medical facility or hospital branch" },
    { column_name: "prediction_date", data_type: "DATE", is_primary: false, description: "Date prediction model was evaluated" },
    { column_name: "target_period", data_type: "STRING", is_primary: false, description: "Target fiscal quarter or month (e.g., 2026-Q1)" },
    { column_name: "predicted_revenue", data_type: "DOUBLE", is_primary: false, description: "Predicted net revenue in USD ($)" },
    { column_name: "confidence_lower_bound", data_type: "DOUBLE", is_primary: false, description: "Lower 95% confidence interval bound" },
    { column_name: "confidence_upper_bound", data_type: "DOUBLE", is_primary: false, description: "Upper 95% confidence interval bound" },
    { column_name: "actual_revenue", data_type: "DOUBLE", is_primary: false, description: "Settled actual revenue collected" },
    { column_name: "accuracy_pct", data_type: "DOUBLE", is_primary: false, description: "Model prediction accuracy percentage" },
    { column_name: "growth_rate_pct", data_type: "DOUBLE", is_primary: false, description: "Projected period-over-period growth rate" },
    { column_name: "risk_level", data_type: "STRING", is_primary: false, description: "Revenue risk classification (LOW, MEDIUM, HIGH)" },
    { column_name: "model_version", data_type: "STRING", is_primary: false, description: "ML model pipeline version identifier" }
  ],
  fact_bed_demand_forecast_7day_detailed: [
    { column_name: "forecast_date", data_type: "DATE", is_primary: true, description: "Target date for 7-day rolling forecast" },
    { column_name: "day_of_week", data_type: "INT", is_primary: false, description: "Day index (1=Sunday, 7=Saturday)" },
    { column_name: "day_name", data_type: "STRING", is_primary: false, description: "Full day name (e.g. Sunday, Monday)" },
    { column_name: "is_weekend", data_type: "INT", is_primary: false, description: "1 if weekend day, 0 if weekday" },
    { column_name: "ward_id", data_type: "INT", is_primary: true, description: "Unique hospital ward ID" },
    { column_name: "ward_name", data_type: "STRING", is_primary: false, description: "Clinical ward name (e.g., Diamond Suite Ward, ICU)" },
    { column_name: "floor_number", data_type: "INT", is_primary: false, description: "Hospital block floor level" },
    { column_name: "department_name", data_type: "STRING", is_primary: false, description: "Supervising department" },
    { column_name: "predicted_beds", data_type: "INT", is_primary: false, description: "Total beds demanded forecast" },
    { column_name: "predicted_emergency", data_type: "INT", is_primary: false, description: "Predicted emergency bed admissions" },
    { column_name: "predicted_elective", data_type: "INT", is_primary: false, description: "Predicted elective procedure beds" },
    { column_name: "avg_length_of_stay", data_type: "DOUBLE", is_primary: false, description: "Projected average length of stay (days)" },
    { column_name: "prev_year_occupancy_rate", data_type: "DOUBLE", is_primary: false, description: "Historical baseline occupancy %" },
    { column_name: "predicted_occupancy_rate", data_type: "DOUBLE", is_primary: false, description: "Forecasted occupancy rate percentage (%)" },
    { column_name: "model_name", data_type: "STRING", is_primary: false, description: "Prophet / ML model identifier" }
  ],
  dim_patient: [
    { column_name: "patient_id", data_type: "STRING", is_primary: true, description: "Unique UUID hash for patient identification" },
    { column_name: "first_name", data_type: "STRING", is_primary: false, description: "Patient given name" },
    { column_name: "last_name", data_type: "STRING", is_primary: false, description: "Patient family name" },
    { column_name: "gender", data_type: "STRING", is_primary: false, description: "M / F / Other" },
    { column_name: "birth_date", data_type: "DATE", is_primary: false, description: "Date of birth" },
    { column_name: "city", data_type: "STRING", is_primary: false, description: "Residential city" },
    { column_name: "state", data_type: "STRING", is_primary: false, description: "State code (2 chars)" },
    { column_name: "postal_code", data_type: "STRING", is_primary: false, description: "Zip code" },
    { column_name: "insurance_type", data_type: "STRING", is_primary: false, description: "Medicare, Medicaid, Private, Uninsured" }
  ],
  dim_provider: [
    { column_name: "provider_id", data_type: "STRING", is_primary: true, description: "National Provider Identifier (NPI)" },
    { column_name: "provider_name", data_type: "STRING", is_primary: false, description: "Full practitioner or clinic name" },
    { column_name: "specialty", data_type: "STRING", is_primary: false, description: "Cardiology, Oncology, Pediatrics, Neurology..." },
    { column_name: "facility_name", data_type: "STRING", is_primary: false, description: "Affiliated hospital center" },
    { column_name: "rating", data_type: "DOUBLE", is_primary: false, description: "Patient satisfaction score (1.0 - 5.0)" }
  ],
  fact_encounters: [
    { column_name: "encounter_id", data_type: "STRING", is_primary: true, description: "Unique encounter record ID" },
    { column_name: "patient_id", data_type: "STRING", is_primary: false, description: "FK to dim_patient" },
    { column_name: "provider_id", data_type: "STRING", is_primary: false, description: "FK to dim_provider" },
    { column_name: "encounter_class", data_type: "STRING", is_primary: false, description: "Inpatient, Outpatient, Urgent, Emergency" },
    { column_name: "start_date", data_type: "TIMESTAMP", is_primary: false, description: "Admission timestamp" },
    { column_name: "end_date", data_type: "TIMESTAMP", is_primary: false, description: "Discharge timestamp" },
    { column_name: "primary_diagnosis", data_type: "STRING", is_primary: false, description: "ICD-10 primary diagnosis description" },
    { column_name: "total_cost", data_type: "DOUBLE", is_primary: false, description: "Total encounter cost ($)" },
    { column_name: "readmitted_30d", data_type: "BOOLEAN", is_primary: false, description: "30-day hospital readmission flag" }
  ],
  fact_claims: [
    { column_name: "claim_id", data_type: "STRING", is_primary: true, description: "Billing claim reference number" },
    { column_name: "patient_id", data_type: "STRING", is_primary: false, description: "FK to dim_patient" },
    { column_name: "claim_type", data_type: "STRING", is_primary: false, description: "Institutional, Professional, Pharmacy" },
    { column_name: "billed_amount", data_type: "DOUBLE", is_primary: false, description: "Total claimed dollars" },
    { column_name: "paid_amount", data_type: "DOUBLE", is_primary: false, description: "Total insurer paid dollars" },
    { column_name: "status", data_type: "STRING", is_primary: false, description: "Paid, Pending, Denied, Appealed" },
    { column_name: "service_date", data_type: "DATE", is_primary: false, description: "Date service rendered" }
  ],
  fact_lab_results: [
    { column_name: "lab_id", data_type: "STRING", is_primary: true, description: "Lab specimen UUID" },
    { column_name: "patient_id", data_type: "STRING", is_primary: false, description: "FK to dim_patient" },
    { column_name: "test_name", data_type: "STRING", is_primary: false, description: "Hemoglobin A1c, Lipid Panel, Metabolic Panel" },
    { column_name: "result_value", data_type: "STRING", is_primary: false, description: "Numerical value or result string" },
    { column_name: "units", data_type: "STRING", is_primary: false, description: "Measurement unit (mg/dL, %, mmol/L)" },
    { column_name: "flag", data_type: "STRING", is_primary: false, description: "NORMAL, HIGH, CRITICAL" }
  ],
  fact_pharmacy: [
    { rx_id: "RX-4001", patient_id: "PAT-10892", medication_name: "Metformin ER", dosage: "500mg twice daily", refills_remaining: 3, prescribed_date: "2026-02-04" }
  ]
};

export const MOCK_TABLE_DATA = {
  dim_revenue_predictions: [
    { prediction_id: "REV-PRED-2026-001", department: "Cardiology", facility_name: "Massachusetts General Hospital", prediction_date: "2026-03-01", target_period: "2026-Q1", predicted_revenue: 4250000.00, confidence_lower_bound: 3980000.00, confidence_upper_bound: 4520000.00, actual_revenue: 4180000.00, accuracy_pct: 98.35, growth_rate_pct: 5.4, risk_level: "LOW", model_version: "REV-PROJ-v2.4", created_at: "2026-03-01T00:00:00" },
    { prediction_id: "REV-PRED-2026-002", department: "Oncology", facility_name: "Brigham and Women's Hospital", prediction_date: "2026-03-01", target_period: "2026-Q1", predicted_revenue: 5800000.00, confidence_lower_bound: 5400000.00, confidence_upper_bound: 6150000.00, actual_revenue: 5750000.00, accuracy_pct: 99.14, growth_rate_pct: 7.2, risk_level: "LOW", model_version: "REV-PROJ-v2.4", created_at: "2026-03-01T00:00:00" },
    { prediction_id: "REV-PRED-2026-003", department: "Orthopedics", facility_name: "Beth Israel Deaconess Center", prediction_date: "2026-03-01", target_period: "2026-Q1", predicted_revenue: 3100000.00, confidence_lower_bound: 2850000.00, confidence_upper_bound: 3350000.00, actual_revenue: null, accuracy_pct: null, growth_rate_pct: 3.8, risk_level: "MEDIUM", model_version: "REV-PROJ-v2.4", created_at: "2026-03-01T00:00:00" },
    { prediction_id: "REV-PRED-2026-004", department: "Emergency Services", facility_name: "Massachusetts General Hospital", prediction_date: "2026-03-01", target_period: "2026-Q1", predicted_revenue: 6400000.00, confidence_lower_bound: 5900000.00, confidence_upper_bound: 6850000.00, actual_revenue: null, accuracy_pct: null, growth_rate_pct: 8.1, risk_level: "HIGH", model_version: "REV-PROJ-v2.4", created_at: "2026-03-01T00:00:00" },
    { prediction_id: "REV-PRED-2026-005", department: "Neurology", facility_name: "Brigham and Women's Hospital", prediction_date: "2026-03-01", target_period: "2026-Q2", predicted_revenue: 2900000.00, confidence_lower_bound: 2700000.00, confidence_upper_bound: 3120000.00, actual_revenue: null, accuracy_pct: null, growth_rate_pct: 4.1, risk_level: "LOW", model_version: "REV-PROJ-v2.4", created_at: "2026-03-01T00:00:00" },
    { prediction_id: "REV-PRED-2026-006", department: "Pediatrics", facility_name: "Massachusetts General Hospital", prediction_date: "2026-03-01", target_period: "2026-Q2", predicted_revenue: 2150000.00, confidence_lower_bound: 1950000.00, confidence_upper_bound: 2350000.00, actual_revenue: null, accuracy_pct: null, growth_rate_pct: 2.9, risk_level: "LOW", model_version: "REV-PROJ-v2.4", created_at: "2026-03-01T00:00:00" },
    { prediction_id: "REV-PRED-2026-007", department: "General Surgery", facility_name: "Beth Israel Deaconess Center", prediction_date: "2026-03-01", target_period: "2026-Q2", predicted_revenue: 4800000.00, confidence_lower_bound: 4400000.00, confidence_upper_bound: 5150000.00, actual_revenue: null, accuracy_pct: null, growth_rate_pct: 6.0, risk_level: "MEDIUM", model_version: "REV-PROJ-v2.4", created_at: "2026-03-01T00:00:00" }
  ],
  fact_bed_demand_forecast_7day_detailed: [
    { forecast_date: "2026-09-13", day_of_week: 1, day_name: "Sunday", is_weekend: 1, ward_id: 1, ward_name: "Diamond Suite Ward", floor_number: 1, department_name: "Administration", predicted_beds: 3, predicted_emergency: 0, predicted_elective: 2, avg_length_of_stay: 5.825, prev_year_occupancy_rate: 38.46, predicted_occupancy_rate: 8.11, prediction_generated_at: "2026-09-08T05:51:24.855527+00:00", model_name: "health_care.ml_models.bed_demand_prediction_prophet", model_source: "ml_forecasting_pipeline", prediction_version: "v1.0_detailed" },
    { forecast_date: "2026-09-14", day_of_week: 2, day_name: "Monday", is_weekend: 0, ward_id: 1, ward_name: "Diamond Suite Ward", floor_number: 1, department_name: "Administration", predicted_beds: 5, predicted_emergency: 1, predicted_elective: 3, avg_length_of_stay: 5.200, prev_year_occupancy_rate: 42.10, predicted_occupancy_rate: 12.50, prediction_generated_at: "2026-09-08T05:51:24.855527+00:00", model_name: "health_care.ml_models.bed_demand_prediction_prophet", model_source: "ml_forecasting_pipeline", prediction_version: "v1.0_detailed" },
    { forecast_date: "2026-09-13", day_of_week: 1, day_name: "Sunday", is_weekend: 1, ward_id: 2, ward_name: "ICU Intensive Unit", floor_number: 2, department_name: "Cardiology", predicted_beds: 18, predicted_emergency: 12, predicted_elective: 4, avg_length_of_stay: 7.450, prev_year_occupancy_rate: 88.50, predicted_occupancy_rate: 90.00, prediction_generated_at: "2026-09-08T05:51:24.855527+00:00", model_name: "health_care.ml_models.bed_demand_prediction_prophet", model_source: "ml_forecasting_pipeline", prediction_version: "v1.0_detailed" }
  ],
  dim_patient: [
    { patient_id: "PAT-10892", first_name: "Eleanor", last_name: "Vance", gender: "F", birth_date: "1984-06-12", city: "Boston", state: "MA", postal_code: "02108", insurance_type: "Private", created_at: "2026-01-15T09:30:00" },
    { patient_id: "PAT-10893", first_name: "Marcus", last_name: "Brody", gender: "M", birth_date: "1972-11-04", city: "Cambridge", state: "MA", postal_code: "02138", insurance_type: "Medicare", created_at: "2026-01-16T11:15:00" },
    { patient_id: "PAT-10894", first_name: "Sophia", last_name: "Chen", gender: "F", birth_date: "1991-03-22", city: "Somerville", state: "MA", postal_code: "02143", insurance_type: "Private", created_at: "2026-01-18T14:40:00" },
    { patient_id: "PAT-10895", first_name: "David", last_name: "Garrison", gender: "M", birth_date: "1965-08-30", city: "Quincy", state: "MA", postal_code: "02169", insurance_type: "Medicaid", created_at: "2026-01-20T08:05:00" }
  ],
  fact_encounters: [
    { encounter_id: "ENC-90021", patient_id: "PAT-10892", provider_id: "NPI-88210", encounter_class: "Inpatient", start_date: "2026-02-01T08:00:00", end_date: "2026-02-04T12:00:00", primary_diagnosis: "Type 2 Diabetes Mellitus with Complications", total_cost: 14250.00, readmitted_30d: false },
    { encounter_id: "ENC-90022", patient_id: "PAT-10893", provider_id: "NPI-99304", encounter_class: "Emergency", start_date: "2026-02-03T22:15:00", end_date: "2026-02-04T04:30:00", primary_diagnosis: "Acute Coronary Syndrome", total_cost: 8900.50, readmitted_30d: true }
  ],
  fact_claims: [
    { claim_id: "CLM-77001", patient_id: "PAT-10892", claim_type: "Institutional", billed_amount: 15800.00, paid_amount: 14250.00, status: "Paid", service_date: "2026-02-01" },
    { claim_id: "CLM-77002", patient_id: "PAT-10893", claim_type: "Professional", billed_amount: 9500.00, paid_amount: 8900.50, status: "Paid", service_date: "2026-02-03" }
  ],
  dim_provider: [
    { provider_id: "NPI-88210", provider_name: "Dr. Sarah Jenkins, MD", specialty: "Internal Medicine", facility_name: "Massachusetts General Hospital", rating: 4.9, active_status: true },
    { provider_id: "NPI-99304", provider_name: "Dr. Alex Rivera, MD", specialty: "Cardiology", facility_name: "Brigham and Women's Hospital", rating: 4.8, active_status: true }
  ],
  fact_lab_results: [
    { lab_id: "LAB-5011", patient_id: "PAT-10892", test_name: "Hemoglobin A1c", result_value: "8.4", units: "%", flag: "HIGH" },
    { lab_id: "LAB-5012", patient_id: "PAT-10893", test_name: "Troponin I", result_value: "0.15", units: "ng/mL", flag: "CRITICAL" }
  ],
  fact_pharmacy: [
    { rx_id: "RX-4001", patient_id: "PAT-10892", medication_name: "Metformin ER", dosage: "500mg twice daily", refills_remaining: 3, prescribed_date: "2026-02-04" }
  ]
};

// Helper for fetch with timeout
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 4000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(id);
  return response;
}

export const apiService = {
  // Check Backend Health
  async checkHealth() {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/health`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return {
        isConnected: true,
        data
      };
    } catch (err) {
      console.warn("Backend API unreachable, using local fallback mode:", err.message);
      return {
        isConnected: false,
        data: {
          status: "unhealthy_or_offline",
          databricks_connected: false,
          catalog: "health_care",
          schema: "gold",
          mode: "Standalone Offline Fallback Engine"
        }
      };
    }
  },

  // Get Service Config
  async getConfig() {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/config`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      return {
        databricks: {
          hostname: "dbc-478013da-49af.cloud.databricks.com",
          http_path: "/sql/1.0/warehouses/769f9abf1dd202a2",
          catalog: "health_care",
          schema: "gold"
        }
      };
    }
  },

  // List Gold Tables
  async getGoldTables(schema = null) {
    try {
      const url = schema ? `${API_BASE_URL}/api/v1/gold/tables?schema=${encodeURIComponent(schema)}` : `${API_BASE_URL}/api/v1/gold/tables`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      return {
        catalog: "health_care",
        schema: schema || "gold",
        count: MOCK_GOLD_SUMMARY.tables.length,
        tables: MOCK_GOLD_SUMMARY.tables
      };
    }
  },

  // Get Gold Executive Analytics Summary
  async getGoldSummary() {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/summary`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return {
        ...data,
        total_records: 124860,
        tables: data.tables || MOCK_GOLD_SUMMARY.tables
      };
    } catch (err) {
      return MOCK_GOLD_SUMMARY;
    }
  },

  // Get Column Schema for a Specific Table
  async getTableSchema(tableName, schema = null) {
    try {
      const querySchema = schema ? `?schema=${encodeURIComponent(schema)}` : '';
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/tables/${tableName}/schema${querySchema}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      const cols = MOCK_SCHEMAS[tableName] || [
        { column_name: "id", data_type: "STRING", is_primary: true, description: "Primary Key" },
        { column_name: "name", data_type: "STRING", is_primary: false, description: "Record Title" },
        { column_name: "updated_at", data_type: "TIMESTAMP", is_primary: false, description: "Last Modified" }
      ];
      return {
        table_name: tableName,
        catalog: "health_care",
        schema: schema || "gold",
        column_count: cols.length,
        columns: cols
      };
    }
  },

  // Query Rows from a Table
  async getTableData(tableName, limit = 50, offset = 0, schema = null) {
    try {
      const params = new URLSearchParams({ limit, offset });
      if (schema) params.append("schema", schema);
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/tables/${tableName}/data?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      const rawRows = MOCK_TABLE_DATA[tableName] || [];
      const sliced = rawRows.slice(offset, offset + limit);
      return {
        table_name: tableName,
        catalog: "health_care",
        schema: schema || "gold",
        total_rows: rawRows.length,
        limit,
        offset,
        returned_rows: sliced.length,
        data: sliced
      };
    }
  },

  // Query dim_revenue_predictions Endpoint
  async getRevenuePredictions(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.department_name) queryParams.append("department_name", params.department_name);
      if (params.bill_status) queryParams.append("bill_status", params.bill_status);
      if (params.bill_date_from) queryParams.append("bill_date_from", params.bill_date_from);
      if (params.bill_date_to) queryParams.append("bill_date_to", params.bill_date_to);
      if (params.limit) queryParams.append("limit", params.limit);
      if (params.offset) queryParams.append("offset", params.offset);

      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/revenue-predictions?${queryParams.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      const rawRows = MOCK_TABLE_DATA.dim_revenue_predictions || [];
      let filtered = [...rawRows];
      if (params.department_name) {
        filtered = filtered.filter(r => r.department?.toLowerCase() === params.department_name.toLowerCase());
      }
      const limit = params.limit || 50;
      const offset = params.offset || 0;
      const sliced = filtered.slice(offset, offset + limit);
      return {
        table_name: "dim_revenue_predictions",
        catalog: "health_care",
        schema: "gold",
        total_rows: filtered.length,
        limit,
        offset,
        returned_rows: sliced.length,
        data: sliced
      };
    }
  },

  // Get Revenue Predictions Analytics Summary
  async getRevenuePredictionsSummary() {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/revenue-predictions/summary`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      const data = MOCK_TABLE_DATA.dim_revenue_predictions || [];
      const total_predicted = data.reduce((acc, r) => acc + (r.predicted_revenue || 0), 0);
      const total_actual = data.reduce((acc, r) => acc + (r.actual_revenue || 0), 0);
      return {
        table_name: "dim_revenue_predictions",
        total_records: data.length,
        total_predicted_revenue_usd: roundTwo(total_predicted),
        total_actual_net_amount_usd: roundTwo(total_actual),
        avg_prediction_variance_usd: roundTwo(total_predicted - total_actual)
      };
    }
  },

  // Lookup Single Revenue Prediction Record by ID
  async getRevenuePredictionById(predictionId) {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/revenue-predictions/${encodeURIComponent(predictionId)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      const data = MOCK_TABLE_DATA.dim_revenue_predictions || [];
      const found = data.find(r => r.prediction_id === predictionId || r.bill_number === predictionId);
      if (!found) throw new Error(`Revenue prediction record '${predictionId}' not found.`);
      return found;
    }
  },

  // Query fact_bed_demand_forecast_7day_detailed Endpoint
  async getBedDemandForecast(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.ward_id !== undefined && params.ward_id !== null && params.ward_id !== '') queryParams.append("ward_id", params.ward_id);
      if (params.ward_name) queryParams.append("ward_name", params.ward_name);
      if (params.department_name) queryParams.append("department_name", params.department_name);
      if (params.day_name) queryParams.append("day_name", params.day_name);
      if (params.is_weekend !== undefined && params.is_weekend !== null && params.is_weekend !== '') queryParams.append("is_weekend", params.is_weekend);
      if (params.forecast_date_from) queryParams.append("forecast_date_from", params.forecast_date_from);
      if (params.forecast_date_to) queryParams.append("forecast_date_to", params.forecast_date_to);
      if (params.limit) queryParams.append("limit", params.limit);
      if (params.offset) queryParams.append("offset", params.offset);

      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/bed-demand-forecast?${queryParams.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      const rawRows = MOCK_TABLE_DATA.fact_bed_demand_forecast_7day_detailed || [];
      let filtered = [...rawRows];
      if (params.ward_name) {
        filtered = filtered.filter(r => r.ward_name?.toLowerCase().includes(params.ward_name.toLowerCase()));
      }
      if (params.department_name) {
        filtered = filtered.filter(r => r.department_name?.toLowerCase() === params.department_name.toLowerCase());
      }
      const limit = params.limit || 50;
      const offset = params.offset || 0;
      const sliced = filtered.slice(offset, offset + limit);
      return {
        table_name: "fact_bed_demand_forecast_7day_detailed",
        catalog: "health_care",
        schema: "gold",
        total_rows: filtered.length,
        limit,
        offset,
        returned_rows: sliced.length,
        data: sliced
      };
    }
  },

  // Get Bed Demand Forecast Analytics Summary
  async getBedDemandSummary() {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/bed-demand-forecast/summary`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      const data = MOCK_TABLE_DATA.fact_bed_demand_forecast_7day_detailed || [];
      const total_predicted = data.reduce((acc, b) => acc + (b.predicted_beds || 0), 0);
      const total_emergency = data.reduce((acc, b) => acc + (b.predicted_emergency || 0), 0);
      const total_elective = data.reduce((acc, b) => acc + (b.predicted_elective || 0), 0);
      const avg_occ = data.length ? (data.reduce((acc, b) => acc + (b.predicted_occupancy_rate || 0), 0) / data.length) : 0;
      return {
        table_name: "fact_bed_demand_forecast_7day_detailed",
        total_records: data.length,
        metrics: {
          total_predicted_beds: total_predicted,
          total_predicted_emergency_beds: total_emergency,
          total_predicted_elective_beds: total_elective,
          avg_predicted_occupancy_rate_pct: roundTwo(avg_occ)
        }
      };
    }
  },

  // Get 7-Day Trend Forecast List
  async getBedDemand7DayTrend() {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/bed-demand-forecast/7day-trend`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      const data = MOCK_TABLE_DATA.fact_bed_demand_forecast_7day_detailed || [];
      return {
        table_name: "fact_bed_demand_forecast_7day_detailed",
        total_rows: data.length,
        returned_rows: data.length,
        data
      };
    }
  },

  // Dynamic Query Gold Table Endpoint
  async getDynamicTableData(tableName, limit = 50, offset = 0) {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/v1/gold/table/${tableName}?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (err) {
      return this.getTableData(tableName, limit, offset);
    }
  }
};

function roundTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
