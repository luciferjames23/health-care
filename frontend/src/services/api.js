// Pure static dummy data for instant UI rendering without network dependencies

export const MOCK_GOLD_SUMMARY = {
  catalog: "health_care",
  schema: "gold",
  total_tables: 6,
  total_records: 124850,
  tables: [
    { table_name: "dim_patient", catalog: "health_care", schema: "gold", row_count: 24500, domain: "Clinical", description: "Patient demographic master table with de-identified identifiers." },
    { table_name: "dim_provider", catalog: "health_care", schema: "gold", row_count: 3200, domain: "Operations", description: "Physicians, specialists, and healthcare facility metadata." },
    { table_name: "fact_encounters", catalog: "health_care", schema: "gold", row_count: 52100, domain: "Clinical", description: "Inpatient, outpatient, and emergency hospital visits." },
    { table_name: "fact_claims", catalog: "health_care", schema: "gold", row_count: 38400, domain: "Financial", description: "Billing claims, insurance coverage, and reimbursement totals." },
    { table_name: "fact_lab_results", catalog: "health_care", schema: "gold", row_count: 4500, domain: "Clinical", description: "Diagnostic laboratory panels and vital signs history." },
    { table_name: "fact_pharmacy", catalog: "health_care", schema: "gold", row_count: 2150, domain: "Pharmacy", description: "Prescription dispenses, medication dosage, and refill logs." }
  ]
};

export const MOCK_SCHEMAS = {
  dim_patient: [
    { column_name: "patient_id", data_type: "STRING", is_primary: true, description: "Unique UUID hash for patient identification" },
    { column_name: "first_name", data_type: "STRING", is_primary: false, description: "Patient given name" },
    { column_name: "last_name", data_type: "STRING", is_primary: false, description: "Patient family name" },
    { column_name: "gender", data_type: "STRING", is_primary: false, description: "M / F / Other" },
    { column_name: "birth_date", data_type: "DATE", is_primary: false, description: "Date of birth" },
    { column_name: "city", data_type: "STRING", is_primary: false, description: "Residential city" },
    { column_name: "state", data_type: "STRING", is_primary: false, description: "State code (2 chars)" },
    { column_name: "postal_code", data_type: "STRING", is_primary: false, description: "Zip code" },
    { column_name: "insurance_type", data_type: "STRING", is_primary: false, description: "Medicare, Medicaid, Private, Uninsured" },
    { column_name: "created_at", data_type: "TIMESTAMP", is_primary: false, description: "Record ingestion timestamp" }
  ],
  dim_provider: [
    { column_name: "provider_id", data_type: "STRING", is_primary: true, description: "National Provider Identifier (NPI)" },
    { column_name: "provider_name", data_type: "STRING", is_primary: false, description: "Full practitioner or clinic name" },
    { column_name: "specialty", data_type: "STRING", is_primary: false, description: "Cardiology, Oncology, Pediatrics, Neurology..." },
    { column_name: "facility_name", data_type: "STRING", is_primary: false, description: "Affiliated hospital center" },
    { column_name: "rating", data_type: "DOUBLE", is_primary: false, description: "Patient satisfaction score (1.0 - 5.0)" },
    { column_name: "active_status", data_type: "BOOLEAN", is_primary: false, description: "Current active provider status" }
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
    { column_name: "rx_id", data_type: "STRING", is_primary: true, description: "Prescription record ID" },
    { column_name: "patient_id", data_type: "STRING", is_primary: false, description: "FK to dim_patient" },
    { column_name: "medication_name", data_type: "STRING", is_primary: false, description: "Pharmaceutical drug name" },
    { column_name: "dosage", data_type: "STRING", is_primary: false, description: "Strength & dosage (e.g. 500mg daily)" },
    { column_name: "refills_remaining", data_type: "INT", is_primary: false, description: "Authorized refills remaining" },
    { column_name: "prescribed_date", data_type: "DATE", is_primary: false, description: "Date written" }
  ]
};

export const MOCK_TABLE_DATA = {
  dim_patient: [
    { patient_id: "PAT-10892", first_name: "Eleanor", last_name: "Vance", gender: "F", birth_date: "1984-06-12", city: "Boston", state: "MA", postal_code: "02108", insurance_type: "Private", created_at: "2026-01-15T09:30:00" },
    { patient_id: "PAT-10893", first_name: "Marcus", last_name: "Brody", gender: "M", birth_date: "1972-11-04", city: "Cambridge", state: "MA", postal_code: "02138", insurance_type: "Medicare", created_at: "2026-01-16T11:15:00" },
    { patient_id: "PAT-10894", first_name: "Sophia", last_name: "Chen", gender: "F", birth_date: "1991-03-22", city: "Somerville", state: "MA", postal_code: "02143", insurance_type: "Private", created_at: "2026-01-18T14:40:00" },
    { patient_id: "PAT-10895", first_name: "David", last_name: "Garrison", gender: "M", birth_date: "1965-08-30", city: "Quincy", state: "MA", postal_code: "02169", insurance_type: "Medicaid", created_at: "2026-01-20T08:05:00" },
    { patient_id: "PAT-10896", first_name: "Amara", last_name: "Okonkwo", gender: "F", birth_date: "1988-12-01", city: "Newton", state: "MA", postal_code: "02458", insurance_type: "Private", created_at: "2026-01-22T16:20:00" },
    { patient_id: "PAT-10897", first_name: "Robert", last_name: "Sterling", gender: "M", birth_date: "1954-04-17", city: "Brookline", state: "MA", postal_code: "02445", insurance_type: "Medicare", created_at: "2026-01-25T10:00:00" }
  ],
  fact_encounters: [
    { encounter_id: "ENC-90021", patient_id: "PAT-10892", provider_id: "NPI-88210", encounter_class: "Inpatient", start_date: "2026-02-01T08:00:00", end_date: "2026-02-04T12:00:00", primary_diagnosis: "Type 2 Diabetes Mellitus with Complications", total_cost: 14250.00, readmitted_30d: false },
    { encounter_id: "ENC-90022", patient_id: "PAT-10893", provider_id: "NPI-99304", encounter_class: "Emergency", start_date: "2026-02-03T22:15:00", end_date: "2026-02-04T04:30:00", primary_diagnosis: "Acute Coronary Syndrome", total_cost: 8900.50, readmitted_30d: true },
    { encounter_id: "ENC-90023", patient_id: "PAT-10894", provider_id: "NPI-44102", encounter_class: "Outpatient", start_date: "2026-02-05T10:00:00", end_date: "2026-02-05T11:00:00", primary_diagnosis: "Essential Hypertension Annual Review", total_cost: 450.00, readmitted_30d: false },
    { encounter_id: "ENC-90024", patient_id: "PAT-10895", provider_id: "NPI-88210", encounter_class: "Inpatient", start_date: "2026-02-08T14:30:00", end_date: "2026-02-12T10:00:00", primary_diagnosis: "Chronic Obstructive Pulmonary Disease", total_cost: 18600.00, readmitted_30d: true }
  ],
  fact_claims: [
    { claim_id: "CLM-77001", patient_id: "PAT-10892", claim_type: "Institutional", billed_amount: 15800.00, paid_amount: 14250.00, status: "Paid", service_date: "2026-02-01" },
    { claim_id: "CLM-77002", patient_id: "PAT-10893", claim_type: "Professional", billed_amount: 9500.00, paid_amount: 8900.50, status: "Paid", service_date: "2026-02-03" },
    { claim_id: "CLM-77003", patient_id: "PAT-10894", claim_type: "Professional", billed_amount: 520.00, paid_amount: 450.00, status: "Paid", service_date: "2026-02-05" },
    { claim_id: "CLM-77004", patient_id: "PAT-10895", claim_type: "Institutional", billed_amount: 21000.00, paid_amount: 0.00, status: "Pending", service_date: "2026-02-08" }
  ],
  dim_provider: [
    { provider_id: "NPI-88210", provider_name: "Dr. Sarah Jenkins, MD", specialty: "Internal Medicine", facility_name: "Massachusetts General Hospital", rating: 4.9, active_status: true },
    { provider_id: "NPI-99304", provider_name: "Dr. Alex Rivera, MD", specialty: "Cardiology", facility_name: "Brigham and Women's Hospital", rating: 4.8, active_status: true },
    { provider_id: "NPI-44102", provider_name: "Dr. Elena Rostova, DO", specialty: "Endocrinology", facility_name: "Beth Israel Deaconess Center", rating: 4.9, active_status: true }
  ],
  fact_lab_results: [
    { lab_id: "LAB-5011", patient_id: "PAT-10892", test_name: "Hemoglobin A1c", result_value: "8.4", units: "%", flag: "HIGH" },
    { lab_id: "LAB-5012", patient_id: "PAT-10893", test_name: "Troponin I", result_value: "0.15", units: "ng/mL", flag: "CRITICAL" },
    { lab_id: "LAB-5013", patient_id: "PAT-10894", test_name: "Fasting Blood Glucose", result_value: "95", units: "mg/dL", flag: "NORMAL" }
  ],
  fact_pharmacy: [
    { rx_id: "RX-4001", patient_id: "PAT-10892", medication_name: "Metformin ER", dosage: "500mg twice daily", refills_remaining: 3, prescribed_date: "2026-02-04" },
    { rx_id: "RX-4002", patient_id: "PAT-10893", medication_name: "Atorvastatin Calcium", dosage: "40mg daily", refills_remaining: 5, prescribed_date: "2026-02-04" }
  ]
};

export const apiService = {
  // Synchronous health status
  async checkHealth() {
    return {
      isConnected: true,
      data: {
        status: "healthy",
        databricks_connected: true,
        catalog: "health_care",
        schema: "gold",
        mode: "Standalone UI Prototype (Static Data Engine)"
      }
    };
  },

  // Synchronous summary
  async getGoldSummary() {
    return MOCK_GOLD_SUMMARY;
  },

  // Synchronous schema columns
  async getTableSchema(tableName) {
    const cols = MOCK_SCHEMAS[tableName] || [
      { column_name: "id", data_type: "STRING", is_primary: true, description: "Primary Key" },
      { column_name: "name", data_type: "STRING", is_primary: false, description: "Record Title" },
      { column_name: "updated_at", data_type: "TIMESTAMP", is_primary: false, description: "Last Modified" }
    ];
    return {
      table_name: tableName,
      catalog: "health_care",
      schema: "gold",
      column_count: cols.length,
      columns: cols
    };
  },

  // Synchronous table data preview
  async getTableData(tableName, limit = 50, offset = 0) {
    const rawRows = MOCK_TABLE_DATA[tableName] || [];
    const sliced = rawRows.slice(offset, offset + limit);
    return {
      table_name: tableName,
      catalog: "health_care",
      schema: "gold",
      total_rows: rawRows.length,
      limit,
      offset,
      returned_rows: sliced.length,
      data: sliced
    };
  }
};
