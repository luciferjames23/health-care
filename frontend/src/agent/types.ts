// TypeScript definitions for Discharge Summary Agent (AG-19)

export interface PatientCandidate {
  admission_id: number;
  admission_number: string;
  patient_id: number;
  patient_number: string;
  patient_name: string;
  gender: string;
  age: number;
  blood_group: string;
  admission_date: string | null;
  admission_type: string;
  current_stay_days: number;
  attending_doctor: string;
  doctor_specialization: string;
  primary_diagnosis: string;
  bed_number: string;
  ward_name: string;
  room_number: string;
  bill_status: string;
  outstanding_balance: number;
  bill_clearance_status: string;
}

export interface PatientVitals {
  temperature_f: number;
  heart_rate_bpm: number;
  systolic_bp: number;
  diastolic_bp: number;
  oxygen_saturation_pct: number;
  bp_formatted: string;
}

export interface PatientLocation {
  ward_name: string;
  room_number: string;
  bed_number: string;
  bed_type: string;
}

export interface PatientBilling {
  bill_number: string;
  bill_net_amount: number;
  bill_status: string;
  bill_clearance_status: string;
  outstanding_balance: number;
}

export interface ExtractedClinicalData {
  patient_id: number;
  patient_number: string;
  admission_id: number;
  admission_number: string;
  patient_name: string;
  first_name: string;
  last_name: string;
  gender: string;
  age: number;
  blood_group: string;
  preferred_language: string;
  phone?: string;
  admission_date: string | null;
  stay_days: number;
  admission_type: string;
  attending_doctor: string;
  doctor_specialization: string;
  primary_diagnosis: string;
  secondary_diagnoses: string[];
  vitals: PatientVitals;
  location: PatientLocation;
  billing: PatientBilling;
  extraction_timestamp: string;
  status: string;
}

export interface ValidationGateDetail {
  name: string;
  passed: boolean;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  detail: string;
  checked_values: Record<string, any>;
}

export interface ValidationGatesResult {
  all_passed: boolean;
  can_auto_proceed: boolean;
  gates: {
    clinical_vitals: ValidationGateDetail;
    diagnostics: ValidationGateDetail;
    billing_clearance: ValidationGateDetail;
  };
  evaluated_at: string;
}

export interface DischargeMedication {
  id: number;
  prescription: string;
  verified: boolean;
}

export interface SummaryHeader {
  patient_name: string;
  patient_id: number;
  patient_number: string;
  admission_number: string;
  admission_date: string;
  discharge_date: string;
  attending_physician: string;
  department: string;
  ward_bed: string;
}

export interface GeneratedDischargeSummary {
  summary_header: SummaryHeader;
  clinical_diagnosis: string;
  case_history: string;
  hospital_course: string;
  surgical_details: string;
  investigations_summary: string;
  inpatient_treatments: string[];
  discharge_medications: DischargeMedication[];
  dietary_and_activity_advice: string[];
  red_flag_warning_signs: string[];
  condition_at_discharge: string;
  follow_up_instructions: string;
  generation_metadata: {
    agent_id: string;
    agent_name: string;
    model_name: string;
    generated_at: string;
    confidence_score: number;
    grounded_in_lakehouse: boolean;
  };
  status: string;
}

export interface SignOffResult {
  success: boolean;
  summary_id: number;
  admission_id: number;
  patient_id: number;
  approval_status: string;
  physician: string;
  sign_off_notes: string;
  signed_at: string;
  bed_released: boolean;
  message: string;
}

export interface SkippedPatient {
  patient_id: number | string;
  patient_number: string;
  patient_name: string;
  admission_id: number | string;
  admission_number?: string;
  bed_number?: string;
  ward_name?: string;
  room_number?: string;
  primary_diagnosis?: string;
  vitals_summary?: string;
  bill_status?: string;
  outstanding_balance?: number;
  admin_cleared?: boolean;
  clinical_cleared?: boolean;
  vitals_cleared?: boolean;
  is_eligible?: boolean;
  reason: string;
  failed_gates?: string[];
}

export interface EvaluatedPatient {
  admission_id: number | string;
  patient_id: number | string;
  patient_number: string;
  patient_name: string;
  bed_number?: string;
  ward_name?: string;
  primary_diagnosis?: string;
  vitals_summary?: string;
  bill_status?: string;
  outstanding_balance?: number;
  admin_cleared: boolean;
  clinical_cleared: boolean;
  vitals_cleared: boolean;
  is_eligible: boolean;
  reason: string;
}

export interface BatchSummaryItem {
  summary_id: number;
  admission_id: number;
  patient_id: number;
  patient_name?: string;
  primary_consultant: string;
  admission_date: string;
  discharge_date: string;
  diagnoses: string;
  case_history: string;
  investigations: string;
  treatment: string;
  discharge_advice: string;
  surgery_details: string;
  patient_condition: string;
  approval_status: string;
  model_name: string;
  generated_at: string;
}

export interface BatchDischargeSummaryResult {
  status: string;
  execution_timestamp?: string;
  total_checked: number;
  total_eligible: number;
  total_generated: number;
  total_skipped: number;
  total_failed?: number;
  eligible_patients: any[];
  skipped_patients: SkippedPatient[];
  generated_summaries: BatchSummaryItem[];
  message?: string;
}


