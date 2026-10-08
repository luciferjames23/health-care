import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Search, ShieldAlert, CheckCircle2, AlertTriangle,
  FileText, ArrowRight, Info, Filter, Building2, Layers, Check, ChevronRight
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchical Code Systems Data Dictionary:
// Insurer ──▶ TPA ──▶ Code System ──▶ Denial Code ──▶ Denial Reason ──▶ Policy Clause
// ─────────────────────────────────────────────────────────────────────────────

export const INSURERS_LIST = [
  "Star Health & Allied Insurance",
  "ICICI Lombard General Insurance",
  "HDFC ERGO General Insurance",
  "New India Assurance",
  "Care Health Insurance"
];

export const TPAS_LIST = [
  "Medi Assist TPA",
  "Paramount TPA",
  "Vidal Health TPA",
  "In-House / Direct TPA Desk"
];

export const CODE_SYSTEMS = [
  { id: "INSURER_INTERNAL", label: "Insurer Internal Codes", badge: "Proprietary", desc: "Codes specific to the insurance company" },
  { id: "TPA_INTERNAL", label: "TPA Internal Codes", badge: "TPA Desk", desc: "Codes defined by the Third-Party Administrator" },
  { id: "ABDM_NRCES", label: "ABDM / NRCeS Standard", badge: "National Standard", desc: "Official ABDM/NRCeS CodeSystem (Excl01–18, IIB13–20)" },
  { id: "STANDARDIZED_IRDAI", label: "IRDAI Master Circular", badge: "IRDAI", desc: "Standardized IRDAI exclusion taxonomy" }
];

// Universal ABDM / NRCeS CodeSystem
export const ABDM_NRCES_CODES = [
  // Standard Health-Insurance Exclusion Codes (Excl01 - Excl18)
  { code: "Excl01", title: "Pre-Existing Diseases", category: "Standard Exclusion", policyClause: "Policy Clause 4.2", description: "Pre-existing ailments or conditions diagnosed prior to inception of the first health policy." },
  { code: "Excl02", title: "Specified disease / procedure waiting period", category: "Standard Exclusion", policyClause: "Policy Clause 4.3", description: "Conditions subject to specific 24-month or 48-month waiting periods (e.g. hernia, cataract, joint replacement)." },
  { code: "Excl03", title: "30-day waiting period", category: "Standard Exclusion", policyClause: "Policy Clause 4.1", description: "Illness contracted within first 30 days of policy inception (excluding emergency accidental trauma care)." },
  { code: "Excl04", title: "Investigation & Evaluation", category: "Standard Exclusion", policyClause: "Policy Clause 2.4", description: "Hospitalization primarily for diagnostic evaluation without active surgical or active medical treatment." },
  { code: "Excl05", title: "Rest Cure, Rehabilitation and Respite Care", category: "Standard Exclusion", policyClause: "Policy Clause Excl05", description: "Admission for bed rest, respite, custodial care, or non-acute convalescent nursing." },
  { code: "Excl06", title: "Obesity / Weight Control", category: "Standard Exclusion", policyClause: "Policy Clause Excl06", description: "Surgical or medical treatment for morbid obesity not fulfilling clinical BMI threshold criteria." },
  { code: "Excl07", title: "Change-of-Gender treatments", category: "Standard Exclusion", policyClause: "Policy Clause Excl07", description: "Treatments and surgeries directly related to gender transition or reassignment." },
  { code: "Excl08", title: "Cosmetic or Plastic Surgery", category: "Standard Exclusion", policyClause: "Policy Clause Excl08", description: "Aesthetic procedures not necessitated by cancer reconstruction, burn contracture, or trauma." },
  { code: "Excl09", title: "Hazardous or Adventure Sports", category: "Standard Exclusion", policyClause: "Policy Clause Excl09", description: "Injuries sustained during participation in professional racing, extreme mountaineering, or skydiving." },
  { code: "Excl10", title: "Breach of Law", category: "Standard Exclusion", policyClause: "Policy Clause Excl10", description: "Expenses incurred for treatment directly arising from criminal intent or unlawful activities." },
  { code: "Excl11", title: "Excluded Providers", category: "Standard Exclusion", policyClause: "Policy Clause Excl11", description: "Treatment rendered in hospitals specifically de-listed or blacklisted by the insurer/TPA network." },
  { code: "Excl12", title: "Rehabilitation", category: "Standard Exclusion", policyClause: "Policy Clause Excl12", description: "Substance abuse detox, long-term psychiatric rehabilitation, or domestic care programs." },
  { code: "Excl13", title: "Hydrotherapy", category: "Standard Exclusion", policyClause: "Policy Clause Excl13", description: "Unproven spa therapies, naturopathy water cures, or experimental aquatic treatments." },
  { code: "Excl14", title: "Non-prescription", category: "Standard Exclusion", policyClause: "Policy Clause Excl14", description: "Over-the-counter vitamins, non-prescribed dietary supplements, and non-payable toiletries." },
  { code: "Excl15", title: "Refractive Error", category: "Standard Exclusion", policyClause: "Policy Clause Excl15", description: "Laser refractive eye procedures for refractive errors below 7.5 dioptres." },
  { code: "Excl16", title: "Unproven Treatments", category: "Standard Exclusion", policyClause: "Policy Clause Excl16", description: "Experimental devices, unapproved stem cell procedures, or therapies without peer-reviewed evidence." },
  { code: "Excl17", title: "Sterility and Infertility", category: "Standard Exclusion", policyClause: "Policy Clause Excl17", description: "Assisted reproductive treatments, IVF, ICSI, and fertility enhancement medications." },
  { code: "Excl18", title: "Maternity Expenses", category: "Standard Exclusion", policyClause: "Policy Clause Excl18", description: "Childbirth, caesarean section, or antenatal care where maternity rider is not attached." },
  // ABDM / NRCeS CodeSystem Additional Codes (IIB13 - IIB20)
  { code: "IIB13", title: "Fraudulent Claim", category: "ABDM / NRCeS Code", policyClause: "Policy Clause IIB13", description: "Suspected fabrication of medical documents, inflated billing, or identity impersonation." },
  { code: "IIB14", title: "Sum Insured Exhausted", category: "ABDM / NRCeS Code", policyClause: "Policy Clause IIB14", description: "Cumulative claims in current policy year have fully depleted total sum insured and recharge benefits." },
  { code: "IIB15", title: "Withdrawal by the Insured", category: "ABDM / NRCeS Code", policyClause: "Policy Clause IIB15", description: "Pre-authorization request cancelled or voluntarily withdrawn by patient/insured party." },
  { code: "IIB16", title: "Suppression of Material Information", category: "ABDM / NRCeS Code", policyClause: "Policy Clause IIB16", description: "Deliberate non-disclosure of past hospitalizations, chronic morbidities, or surgical history on proposal form." },
  { code: "IIB17", title: "Waiting Period beyond 30 days", category: "ABDM / NRCeS Code", policyClause: "Policy Clause IIB17", description: "Extended disease-specific moratorium stipulated in policy endorsement (e.g. 1st year moratorium)." },
  { code: "IIB20", title: "Not covered under the Terms and Conditions of the Contract", category: "ABDM / NRCeS Code", policyClause: "Policy Clause IIB20", description: "Procedure or admission condition falls outside the explicit scope of policy schedule and prospectus." }
];

// Insurer-Specific Internal Codes Mapping
export const INSURER_INTERNAL_CODES = {
  "Star Health & Allied Insurance": [
    { code: "PED-01", title: "Pre-existing disease", category: "Insurer Internal (Star Health)", policyClause: "Policy Clause 4.2", description: "Condition or symptom documented prior to policy commencement date." },
    { code: "EX-W30", title: "30-day initial waiting period", category: "Insurer Internal (Star Health)", policyClause: "Policy Clause 4.1", description: "Admission within 30 days of initial policy commencement." },
    { code: "SPEC-24M", title: "Specified disease 24-month waiting period", category: "Insurer Internal (Star Health)", policyClause: "Policy Clause 4.3", description: "Disease-specific 24-month moratorium (calculus, hernia, cataract, arthritis)." },
    { code: "MED-NEC-04", title: "Conservative management / Clinical justification", category: "Insurer Internal (Star Health)", policyClause: "Policy Clause 5.1", description: "Surgery advised without adequate documented trial of non-operative medical treatment." },
    { code: "DOC-MIS-09", title: "Missing medical documents / Investigation reports", category: "Insurer Internal (Star Health)", policyClause: "Policy Clause 5.3", description: "Treating specialist prescription, pre-admission OPD notes, or histopathology report missing." },
    { code: "POL-EX-12", title: "Policy exclusion under general conditions", category: "Insurer Internal (Star Health)", policyClause: "Policy Clause 6.1", description: "Intervention not covered under standard terms of Star Health schedule." },
    { code: "SUM-EXH-07", title: "Sum insured exhausted", category: "Insurer Internal (Star Health)", policyClause: "Policy Clause 3.4", description: "Annual coverage limit exhausted for the policyholder." }
  ],
  "ICICI Lombard General Insurance": [
    { code: "402", title: "Pre-existing disease", category: "Insurer Internal (ICICI Lombard)", policyClause: "Policy Clause 4.2", description: "Pre-existing condition / 24-month waiting period exclusion invoked by ICICI Lombard." },
    { code: "204", title: "Lack of documented conservative management trial", category: "Insurer Internal (ICICI Lombard)", policyClause: "Policy Clause 5.1", description: "Insufficient clinical justification / conservative trial compliance." },
    { code: "102", title: "Room rent capping & proportionate deduction", category: "Insurer Internal (ICICI Lombard)", policyClause: "Policy Clause 3.1", description: "Room category exceeds base eligibility; proportionate deductions applied." },
    { code: "405", title: "Investigation & Evaluation / Non-inpatient care", category: "Insurer Internal (ICICI Lombard)", policyClause: "Policy Clause 2.4", description: "Active inpatient admission criteria not met; primarily investigative." },
    { code: "DOC-401", title: "Missing clinical documents & diagnostic imaging", category: "Insurer Internal (ICICI Lombard)", policyClause: "Policy Clause 5.3", description: "Pre-operative imaging, physician prescription, or operative records missing." },
    { code: "EX-30D", title: "30-day initial waiting period", category: "Insurer Internal (ICICI Lombard)", policyClause: "Policy Clause 4.1", description: "Incurred within 30 days of insurance policy inception." }
  ],
  "HDFC ERGO General Insurance": [
    { code: "HDFC-PED-99", title: "Pre-existing disease", category: "Insurer Internal (HDFC ERGO)", policyClause: "Policy Clause 4.2", description: "Pre-existing ailment clause invoked under HDFC ERGO terms." },
    { code: "HDFC-MED-03", title: "Insufficient clinical justification / Active line of treatment", category: "Insurer Internal (HDFC ERGO)", policyClause: "Policy Clause 5.1", description: "Active inpatient justification not established by treating doctor." },
    { code: "HDFC-DOC-11", title: "Missing doctor recommendation & diagnostic proof", category: "Insurer Internal (HDFC ERGO)", policyClause: "Policy Clause 5.3", description: "Doctor prescription or diagnostic lab/radiology confirmation pending." },
    { code: "HDFC-W30-01", title: "30-day initial waiting period", category: "Insurer Internal (HDFC ERGO)", policyClause: "Policy Clause 4.1", description: "Non-accidental claim within 30 days from policy issue date." },
    { code: "HDFC-SPEC-02", title: "Specified disease 24-month waiting period", category: "Insurer Internal (HDFC ERGO)", policyClause: "Policy Clause 4.3", description: "Specified procedure waiting period not satisfied." },
    { code: "HDFC-EX-GEN", title: "General policy exclusion", category: "Insurer Internal (HDFC ERGO)", policyClause: "Policy Clause 6.1", description: "Procedure excluded under Section 4 exclusion schedule." }
  ],
  "Default": [
    { code: "PED-IN-01", title: "Pre-existing disease", category: "Insurer Internal", policyClause: "Policy Clause 4.2", description: "Pre-existing ailment under policy waiting terms." },
    { code: "DOC-IN-02", title: "Missing medical documents", category: "Insurer Internal", policyClause: "Policy Clause 5.3", description: "Required diagnostic and clinical records incomplete." },
    { code: "MED-IN-03", title: "Medical necessity justification", category: "Insurer Internal", policyClause: "Policy Clause 5.1", description: "Lack of conservative management trial or specialist justification." },
    { code: "EXCL-IN-04", title: "Policy exclusion", category: "Insurer Internal", policyClause: "Policy Clause 6.1", description: "Not covered under terms and conditions of the insurance contract." }
  ]
};

// TPA-Specific Internal Codes Mapping
export const TPA_INTERNAL_CODES = {
  "Medi Assist TPA": [
    { code: "MA-PED-01", title: "Pre-existing disease", category: "TPA Internal (Medi Assist)", policyClause: "Policy Clause 4.2", description: "Medi Assist TPA pre-existing disease exclusion endorsement." },
    { code: "MA-MED-02", title: "Medical necessity justification / Conservative trial", category: "TPA Internal (Medi Assist)", policyClause: "Policy Clause 5.1", description: "Clinical protocol mandates documented conservative treatment prior to surgery." },
    { code: "MA-DOC-03", title: "Missing medical documents", category: "TPA Internal (Medi Assist)", policyClause: "Policy Clause 5.3", description: "Original indoor case papers, radiology scans, or prescription missing." },
    { code: "MA-POL-04", title: "Policy exclusion", category: "TPA Internal (Medi Assist)", policyClause: "Policy Clause 6.1", description: "Intervention not payable under standard policy terms." },
    { code: "MA-W30-05", title: "30-day waiting period", category: "TPA Internal (Medi Assist)", policyClause: "Policy Clause 4.1", description: "Moratorium clause within 30 days of risk inception." }
  ],
  "Paramount TPA": [
    { code: "PAR-PED-10", title: "Pre-existing disease", category: "TPA Internal (Paramount)", policyClause: "Policy Clause 4.2", description: "Pre-existing condition exclusion cited by Paramount TPA desk." },
    { code: "PAR-DOC-11", title: "Missing medical documents", category: "TPA Internal (Paramount)", policyClause: "Policy Clause 5.3", description: "Doctor prescription and investigation reports required for scrutiny." },
    { code: "PAR-MED-12", title: "Insufficient clinical justification", category: "TPA Internal (Paramount)", policyClause: "Policy Clause 5.1", description: "Conservative management compliance documentation required." },
    { code: "PAR-EXC-13", title: "Policy exclusion", category: "TPA Internal (Paramount)", policyClause: "Policy Clause 6.1", description: "Excluded under terms of the underwritten contract." }
  ],
  "Vidal Health TPA": [
    { code: "VH-PED-21", title: "Pre-existing disease", category: "TPA Internal (Vidal Health)", policyClause: "Policy Clause 4.2", description: "Pre-existing disease waiting period exclusion." },
    { code: "VH-DOC-22", title: "Missing medical documents", category: "TPA Internal (Vidal Health)", policyClause: "Policy Clause 5.3", description: "Discharge card, past consultation notes, or diagnostic images missing." },
    { code: "VH-MED-23", title: "Medical necessity justification", category: "TPA Internal (Vidal Health)", policyClause: "Policy Clause 5.1", description: "Inpatient admission criteria not substantiated by clinical vitals." },
    { code: "VH-POL-24", title: "Policy exclusion", category: "TPA Internal (Vidal Health)", policyClause: "Policy Clause 6.1", description: "Not payable as per Vidal Health exclusion register." }
  ],
  "Default": [
    { code: "TPA-PED-01", title: "Pre-existing disease", category: "TPA Internal", policyClause: "Policy Clause 4.2", description: "Pre-existing disease waiting period." },
    { code: "TPA-DOC-02", title: "Missing medical documents", category: "TPA Internal", policyClause: "Policy Clause 5.3", description: "Clinical documentation pending from hospital desk." },
    { code: "TPA-MED-03", title: "Medical necessity justification", category: "TPA Internal", policyClause: "Policy Clause 5.1", description: "Conservative management trial records required." },
    { code: "TPA-POL-04", title: "Policy exclusion", category: "TPA Internal", policyClause: "Policy Clause 6.1", description: "Clause exclusion applied by TPA." }
  ]
};

// Standardized IRDAI Master Circular Codes
export const STANDARDIZED_IRDAI_CODES = [
  { code: "IRDAI-PED", title: "Pre-Existing Diseases", category: "IRDAI Master Circular", policyClause: "Policy Clause 4.2", description: "Standard IRDAI Definition 4.2 for pre-existing disease exclusion." },
  { code: "IRDAI-W30", title: "30-Day Waiting Period", category: "IRDAI Master Circular", policyClause: "Policy Clause 4.1", description: "Initial 30-day waiting period moratorium on non-accidental illness." },
  { code: "IRDAI-SPEC", title: "Specified Disease / Procedure Waiting Period", category: "IRDAI Master Circular", policyClause: "Policy Clause 4.3", description: "Standard 24-month or 48-month specific illness waiting schedule." },
  { code: "IRDAI-CON", title: "Clinical Justification & Conservative Management", category: "IRDAI Master Circular", policyClause: "Policy Clause 5.1", description: "Documented conservative management trial required prior to surgical intervention." },
  { code: "IRDAI-DOC", title: "Medical Records & Clinical Evidence", category: "IRDAI Master Circular", policyClause: "Policy Clause 5.3", description: "Treating specialist prescription and active diagnostic evidence required." },
  { code: "IRDAI-EXCL", title: "General Policy Exclusion", category: "IRDAI Master Circular", policyClause: "Policy Clause 6.1", description: "General exclusions under IRDAI Non-Medical Expenses Schedule." }
];

export const detectInsurerFromClaim = (claim) => {
  const raw = `${claim?.insurer || ''} ${claim?.insurance_provider || ''} ${claim?.tpa || ''} ${claim?.tpa_name || ''} ${claim?.policy || ''} ${claim?.policy_number || ''}`.toLowerCase();
  if (raw.includes("hdfc")) return "HDFC ERGO General Insurance";
  if (raw.includes("icici")) return "ICICI Lombard General Insurance";
  if (raw.includes("star")) return "Star Health & Allied Insurance";
  if (raw.includes("care") || raw.includes("religare")) return "Care Health Insurance";
  if (raw.includes("new india")) return "New India Assurance";
  return claim?.insurer || claim?.insurance_provider || claim?.tpa || "Star Health & Allied Insurance";
};

export const detectTpaFromClaim = (claim, insurerName) => {
  const raw = `${claim?.tpa || ''} ${claim?.tpa_name || ''} ${claim?.insurance_provider || ''}`.toLowerCase();
  if (raw.includes("medi assist") || raw.includes("mediassist")) return "Medi Assist TPA";
  if (raw.includes("paramount")) return "Paramount TPA";
  if (raw.includes("vidal")) return "Vidal Health TPA";
  if (claim?.tpa && !claim.tpa.toLowerCase().includes("general insurance")) return claim.tpa;
  return "Medi Assist TPA";
};

export default function ClaimExclusionModal({
  isOpen,
  onClose,
  claimData,
  onConfirm
}) {
  // 1. Insurer (auto-detected and locked from patient's claim)
  const [selectedInsurer, setSelectedInsurer] = useState(() => detectInsurerFromClaim(claimData));

  // 2. TPA (auto-detected and locked from patient's claim)
  const [selectedTpa, setSelectedTpa] = useState(() => detectTpaFromClaim(claimData, detectInsurerFromClaim(claimData)));

  // 3. Code System (defaults to INSURER_INTERNAL as requested)
  const [selectedCodeSystem, setSelectedCodeSystem] = useState("INSURER_INTERNAL");

  // Search filter
  const [search, setSearch] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sync state automatically whenever patient claimData changes
  useEffect(() => {
    if (claimData) {
      const ins = detectInsurerFromClaim(claimData);
      setSelectedInsurer(ins);
      setSelectedTpa(detectTpaFromClaim(claimData, ins));
    }
  }, [claimData]);

  // Available codes based on (Insurer ➔ TPA ➔ Code System)
  const availableCodes = useMemo(() => {
    if (selectedCodeSystem === "ABDM_NRCES") {
      return ABDM_NRCES_CODES;
    }
    if (selectedCodeSystem === "STANDARDIZED_IRDAI") {
      return STANDARDIZED_IRDAI_CODES;
    }
    if (selectedCodeSystem === "TPA_INTERNAL") {
      const match = TPA_INTERNAL_CODES[selectedTpa];
      return match || TPA_INTERNAL_CODES["Default"];
    }
    // INSURER_INTERNAL
    const match = INSURER_INTERNAL_CODES[selectedInsurer];
    return match || INSURER_INTERNAL_CODES["Default"];
  }, [selectedCodeSystem, selectedInsurer, selectedTpa]);

  // Selected code in list
  const [selectedCode, setSelectedCode] = useState(availableCodes[0] || ABDM_NRCES_CODES[0]);

  // Reset selected code when available codes change
  useEffect(() => {
    if (availableCodes && availableCodes.length > 0) {
      setSelectedCode(availableCodes[0]);
    }
  }, [availableCodes]);

  // Filtered by search
  const filteredCodes = useMemo(() => {
    if (!search.trim()) return availableCodes;
    const s = search.toLowerCase();
    return availableCodes.filter(item =>
      item.code.toLowerCase().includes(s) ||
      item.title.toLowerCase().includes(s) ||
      item.description.toLowerCase().includes(s) ||
      item.policyClause.toLowerCase().includes(s)
    );
  }, [availableCodes, search]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!selectedCode) return;
    try {
      setSubmitting(true);
      const fullReason = `[${selectedCodeSystem}] ${selectedCode.code}: ${selectedCode.title} under ${selectedCode.policyClause}${remarks.trim() ? ` (${remarks.trim()})` : ''}`;
      await onConfirm({
        claim_id: claimData?.claim_id,
        insurer: selectedInsurer,
        tpa: selectedTpa,
        code_system: selectedCodeSystem,
        exclusion_code: selectedCode.code,
        denial_code: selectedCode.code,
        exclusion_title: selectedCode.title,
        denial_reason: selectedCode.title,
        policy_clause: selectedCode.policyClause,
        remarks: remarks.trim(),
        full_reason: fullReason
      });
      onClose();
    } catch (err) {
      console.error('Error confirming rejection:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.72)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '16px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '880px',
        height: '88vh',
        maxHeight: '670px',
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #fee2e2'
      }}>

        {/* ── Modal Header (Fixed / No Shrink) ───────────────────────────────── */}
        <div style={{
          padding: '10px 18px',
          background: 'linear-gradient(135deg, #fff1f2 0%, #ffffff 100%)',
          borderBottom: '1px solid #fee2e2',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: '#ef4444',
                color: '#ffffff',
                fontSize: '10.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.4px'
              }}>
                <ShieldAlert size={12} />
                Multi-Insurer &amp; TPA Denial Taxonomy
              </span>
              <span style={{
                fontSize: '10.5px',
                color: '#991b1b',
                fontWeight: 600,
                background: '#fee2e2',
                padding: '2px 7px',
                borderRadius: '4px'
              }}>
                காப்பீட்டு மறுப்பு குறியீடு
              </span>
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '3px 0 1px 0' }}>
              TPA Rejection &amp; Exclusion Reason Classifier
            </h3>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
              Patient: <strong>{claimData?.patient_name || claimData?.patient || 'Patient'}</strong> · Claim: <code style={{ color: '#0f172a', fontWeight: 600 }}>{claimData?.claim_number || claimData?.claim || `CLM-${claimData?.claim_id}`}</code>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Single-Line Resolution Pipeline Tracker (Fixed / No Shrink) ───── */}
        <div style={{
          padding: '6px 18px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          scrollbarWidth: 'none'
        }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '4px' }}>
            Pipeline:
          </span>

          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Building2 size={11} />
            {selectedInsurer.split(' ')[0]}
          </span>
          <ChevronRight size={12} style={{ color: '#94a3b8' }} />

          <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
            {selectedTpa}
          </span>
          <ChevronRight size={12} style={{ color: '#94a3b8' }} />

          <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
            {selectedCodeSystem}
          </span>
          <ChevronRight size={12} style={{ color: '#94a3b8' }} />

          <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, fontFamily: 'monospace' }}>
            {selectedCode?.code || 'Code'}
          </span>
          <ChevronRight size={12} style={{ color: '#94a3b8' }} />

          <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
            {selectedCode?.title || 'Reason'}
          </span>
          <ChevronRight size={12} style={{ color: '#94a3b8' }} />

          <span style={{ background: '#ecfdf5', color: '#047857', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
            {selectedCode?.policyClause || 'Policy Clause'}
          </span>
        </div>

        {/* ── Level 1 & 2 Cards + Code System Tabs (Fixed / No Shrink) ───────── */}
        <div style={{
          padding: '8px 18px',
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1.35fr',
          gap: '10px',
          alignItems: 'stretch',
          flexShrink: 0
        }}>
          {/* Card 1: Insurer (Auto-Detected) */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '7px',
            padding: '6px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                1. Insurer
              </span>
              <span style={{ fontSize: '9.5px', background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                🔒 Auto-Detected
              </span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#14532d', display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Building2 size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedInsurer}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '1px', fontFamily: 'monospace' }}>
              Policy: {claimData?.policy || claimData?.policy_number || 'STAR-POL-941242'}
            </div>
          </div>

          {/* Card 2: TPA Desk (Auto-Linked) */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '7px',
            padding: '6px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                2. TPA Desk
              </span>
              <span style={{ fontSize: '9.5px', background: '#f1f5f9', color: '#475569', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                🔒 Auto-Linked
              </span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedTpa}
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '1px', fontFamily: 'monospace' }}>
              Claim: {claimData?.claim || claimData?.claim_number || `CLM-${claimData?.claim_id}`}
            </div>
          </div>

          {/* Card 3: Code System Toggle Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '3px' }}>
              3. Code System
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              {CODE_SYSTEMS.map(sys => {
                const isSelected = selectedCodeSystem === sys.id;
                const badgeLabel = sys.id === 'INSURER_INTERNAL' 
                  ? `${selectedInsurer.split(' ')[0]} Codes`
                  : sys.id === 'ABDM_NRCES'
                  ? 'ABDM / NRCeS'
                  : sys.badge;
                return (
                  <button
                    key={sys.id}
                    type="button"
                    onClick={() => setSelectedCodeSystem(sys.id)}
                    style={{
                      flex: 1,
                      padding: '5px 2px',
                      borderRadius: '5px',
                      border: isSelected ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      background: isSelected ? '#fef2f2' : '#ffffff',
                      color: isSelected ? '#991b1b' : '#475569',
                      fontSize: '10.5px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      textAlign: 'center',
                      lineHeight: '1.2',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={sys.desc}
                  >
                    {badgeLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Search Bar within Selected Code System (Fixed / No Shrink) ───── */}
        <div style={{
          padding: '6px 16px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0
        }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder={`Search in ${selectedCodeSystem} (${filteredCodes.length} codes available)...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 8px 5px 26px',
                borderRadius: '5px',
                border: '1px solid #cbd5e1',
                fontSize: '11.5px',
                outline: 'none',
                background: '#ffffff',
                height: '28px'
              }}
            />
          </div>
          <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>
            {filteredCodes.length} codes
          </span>
        </div>

        {/* ── Main Two-Column Body: Code List + Live Resolution Inspector (FLEX: 1) ───── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}>
          {/* Left Column: Denial Code Cards */}
          <div style={{
            overflowY: 'auto',
            padding: '10px 14px',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            background: '#ffffff'
          }}>
            {filteredCodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '12px' }}>
                No denial codes match "{search}" in {selectedCodeSystem}.
              </div>
            ) : (
              filteredCodes.map(item => {
                const isSelected = selectedCode?.code === item.code;
                return (
                  <div
                    key={item.code}
                    onClick={() => setSelectedCode(item)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: isSelected ? '2px solid #ef4444' : '1px solid #e2e8f0',
                      background: isSelected ? '#fff5f5' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: isSelected ? '#b91c1c' : '#0f172a',
                        background: isSelected ? '#fee2e2' : '#f1f5f9',
                        padding: '1px 5px',
                        borderRadius: '4px'
                      }}>
                        {item.code}
                      </span>
                      <span style={{
                        fontSize: '10.5px',
                        color: '#047857',
                        fontWeight: 600,
                        background: '#ecfdf5',
                        padding: '1px 5px',
                        borderRadius: '4px'
                      }}>
                        {item.policyClause}
                      </span>
                    </div>

                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: isSelected ? '#991b1b' : '#1e293b', marginBottom: '2px' }}>
                      {item.title}
                    </div>

                    <div style={{
                      fontSize: '11px',
                      color: '#64748b',
                      lineHeight: '1.3',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {item.description}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Live Resolution Details & Remarks */}
          <div style={{
            overflowY: 'auto',
            padding: '12px 14px',
            background: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Full Audit Resolution Map
            </div>

            {selectedCode ? (
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '7px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Denial Code
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#b91c1c', fontFamily: 'monospace' }}>
                      {selectedCode.code}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Policy Clause
                    </div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#047857' }}>
                      {selectedCode.policyClause}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                  <div style={{ fontSize: '9.5px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Underlying Denial Reason
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', marginTop: '1px' }}>
                    {selectedCode.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: '1.3' }}>
                    {selectedCode.description}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Remarks Textarea */}
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                Optional Insurer Letter Remarks
              </label>
              <textarea
                rows={2}
                placeholder="e.g. As cited on portal query letter ref ST-8812... "
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '11.5px',
                  outline: 'none',
                  background: '#ffffff',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Modal Footer: Actions (Fixed / No Shrink / 100% Always Visible) ── */}
        <div style={{
          padding: '10px 18px',
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            AG-20 will assemble the formal reconsideration dossier matching this code hierarchy.
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: '32px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!selectedCode || submitting}
              onClick={handleConfirm}
              style={{
                height: '32px',
                padding: '0 14px',
                borderRadius: '6px',
                border: '0',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: submitting ? 0.7 : 1
              }}
            >
              <AlertTriangle size={13} />
              {submitting ? 'Confirming...' : `Confirm Reject with ${selectedCode?.code || 'Code'}`}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
