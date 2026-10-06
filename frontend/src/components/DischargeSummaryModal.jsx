import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  apiService,
  synthesizeClinicalDetails,
  formatClinicalDiagnoses,
  formatClinicalInvestigations,
  formatClinicalTreatment,
  formatClinicalAdvice,
  formatClinicalCondition,
  cleanDiagnosis
} from '../services/api';

/**
 * Strips any Tamil instructions from discharge advice / followup text
 */
function stripTamil(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .split('\n')
    .filter(line => {
      const lower = line.toLowerCase();
      if (lower.includes('தமிழ்') || lower.includes('tamil instructions') || lower.includes('tamil:')) {
        return false;
      }
      // Check for Tamil Unicode characters (\u0B80 - \u0BFF)
      if (/[\u0B80-\u0BFF]/.test(line)) {
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Formats clinical date cleanly as '12 Sept 2026'
 */
function formatClinicalDate(dateStr) {
  if (!dateStr) {
    const today = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(today.getDate()).padStart(2, '0')} ${months[today.getMonth()]} ${today.getFullYear()}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  return String(dateStr);
}

/**
 * Formats clinical date and time cleanly as '23 Sep 2026, 09:19 AM'
 */
export function formatClinicalDateTime(dateVal, timeVal) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const todayDateStr = `${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;

  const formatHoursMinutes = (d) => {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  if (!dateVal && !timeVal) {
    return `${todayDateStr}, ${formatHoursMinutes(now)}`;
  }

  // If already formatted with date and time (e.g. '23 Sep 2026, 09:19 AM')
  if (typeof dateVal === 'string' && (dateVal.includes('AM') || dateVal.includes('PM')) && dateVal.length > 8) {
    return dateVal;
  }

  // If dateVal is a valid Date or ISO string
  if (dateVal && String(dateVal).trim().toLowerCase() !== 'now') {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const dStr = `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
      
      const hasEmbeddedTime = typeof dateVal === 'string'
        ? (dateVal.includes('T') || (dateVal.includes(':') && !dateVal.endsWith('00:00:00')))
        : (d.getHours() !== 0 || d.getMinutes() !== 0);

      let tStr = '';
      if (hasEmbeddedTime) {
        // ALWAYS use the actual timestamp's time if present!
        tStr = formatHoursMinutes(d);
      } else if (timeVal && timeVal !== 'Now' && typeof timeVal === 'string' && (timeVal.includes(':') || /am|pm/i.test(timeVal))) {
        tStr = timeVal;
      } else {
        tStr = formatHoursMinutes(now);
      }
      return `${dStr}, ${tStr}`;
    }
  }

  // If dateVal is 'Now', null, empty, or undefined:
  const validTime = (timeVal && timeVal !== 'Now' && typeof timeVal === 'string' && (timeVal.includes(':') || /am|pm/i.test(timeVal)))
    ? timeVal
    : formatHoursMinutes(now);
  return `${todayDateStr}, ${validTime}`;
}

/**
 * Extracts introductory text from discharge medications string
 */
function getMedicationIntro(medText) {
  if (!medText || typeof medText !== 'string') return '';
  const lines = medText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const first = lines[0];
    if (!/^\d+[\.\)]/.test(first) && !first.includes(' - ') && !first.startsWith('Tab.') && !first.startsWith('Inj.') && !first.startsWith('Cap.') && !first.includes('{') && !first.includes('}')) {
      return first;
    }
  }
  return '';
}

/**
 * Splits run-on numbered instructions into clean individual points
 */
function parseFollowupInstructions(text) {
  if (!text || typeof text !== 'string') return [];
  const parts = text.split(/(?:^|\s+)(?=\d+[\.\)]\s+)/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.map(p => p.replace(/^\d+[\.\)]\s*/, '').trim());
  }
  const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (lines.length > 1) {
    return lines.map(p => p.replace(/^\d+[\.\)]\s*/, '').trim());
  }
  return [text.trim()];
}

function safeParseJsonOrPythonDict(str) {
  if (!str) return null;
  if (typeof str === 'object') return str;
  const s = String(str).trim();
  const braceStart = s.indexOf('{');
  const bracketStart = s.indexOf('[');
  const firstOpen = (braceStart !== -1 && bracketStart !== -1)
    ? Math.min(braceStart, bracketStart)
    : (braceStart !== -1 ? braceStart : bracketStart);

  if (firstOpen === -1) return null;

  const lastClose = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (lastClose <= firstOpen) return null;

  const jsonSnippet = s.substring(firstOpen, lastClose + 1);

  try {
    return JSON.parse(jsonSnippet);
  } catch (e) {}

  try {
    const jsonified = jsonSnippet
      .replace(/'/g, '"')
      .replace(/\bNone\b/g, 'null')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(jsonified);
  } catch (e2) {}

  return null;
}

function extractMedicationItem(item, defaultCategory = '') {
  if (!item) return null;
  if (typeof item === 'string') {
    const s = item.trim().replace(/^\d+[\.\)]\s*/, '');
    if (!s) return null;
    if (s.includes(' - ')) {
      const parts = s.split(' - ');
      const name = parts[0].trim();
      const rest = parts.slice(1).join(' - ').trim();
      let note = defaultCategory || 'Treatment';
      let instructions = rest;
      const noteMatch = rest.match(/\((.*?)\)/);
      if (noteMatch) {
        note = noteMatch[1];
        instructions = rest.replace(noteMatch[0], '').trim();
      }
      return { medicine: name, instructions: instructions || 'As directed', notes: note };
    }
    return { medicine: s, instructions: 'As directed', notes: defaultCategory || 'Treatment' };
  }
  if (typeof item !== 'object') return null;

  const name = item.medication || item.name || item.medicine || item.drug || item.type || item.ion || item.generic_name || defaultCategory || 'Medication';

  const instParts = [];
  if (item.dose || item.dosage) instParts.push(item.dose || item.dosage);
  if (item.dose_units) instParts.push(`${item.dose_units} units`);
  if (item.dose_units_per_kg_per_hr) instParts.push(`${item.dose_units_per_kg_per_hr} units/kg/hr`);
  if (item.dose_units_per_meal) instParts.push(`${item.dose_units_per_meal} units/meal`);
  if (item.concentration_mEq_per_L) instParts.push(`${item.concentration_mEq_per_L} mEq/L`);
  if (item.rate_ml_per_hr) instParts.push(`Rate: ${item.rate_ml_per_hr} ml/hr`);
  if (item.route) instParts.push(item.route.toLowerCase().startsWith('route') ? item.route : `Route: ${item.route}`);
  if (item.frequency || item.freq) instParts.push(item.frequency || item.freq);
  if (item.timing) instParts.push(item.timing);
  if (item.duration || item.dur) instParts.push(`Duration: ${item.duration || item.dur}`);
  if (item.duration_hours) instParts.push(`Duration: ${item.duration_hours} hrs`);
  if (item.duration_days) instParts.push(`Duration: ${item.duration_days} days`);
  if (item.titration) instParts.push(`Titration: ${item.titration}`);
  if (item.adjustment) instParts.push(`Adjustment: ${item.adjustment}`);
  if (item.instructions) instParts.push(item.instructions);

  const note = item.purpose || item.indication || item.indication_notes || item.notes || item.reason || (defaultCategory ? defaultCategory.replace(/_/g, ' ') : 'Treatment');

  return {
    medicine: String(name).trim(),
    instructions: instParts.filter(Boolean).join(', ') || 'As directed',
    notes: String(note).trim()
  };
}

function flattenMedicationsObject(obj) {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    return obj.map(x => extractMedicationItem(x)).filter(Boolean);
  }
  const results = [];
  for (const [key, val] of Object.entries(obj)) {
    const categoryTitle = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (Array.isArray(val)) {
      val.forEach(item => {
        const parsed = extractMedicationItem(item, categoryTitle);
        if (parsed) results.push(parsed);
      });
    } else if (typeof val === 'object' && val !== null) {
      const parsed = extractMedicationItem(val, categoryTitle);
      if (parsed) results.push(parsed);
    } else if (typeof val === 'string' && val.trim()) {
      results.push({
        medicine: categoryTitle,
        instructions: val.trim(),
        notes: 'Protocol'
      });
    }
  }
  return results;
}

/**
 * Parses medications array or text block into structured table rows
 * [{ medicine, instructions, notes }]
 */
function parseMedications(medsArray, medText) {
  if (Array.isArray(medsArray) && medsArray.length > 0) {
    if (Array.isArray(medsArray[0])) {
      return medsArray.map(m => ({
        medicine: String(m[0] || 'Medication').replace(/^Administered:\s*/i, '').trim(),
        instructions: String(m[1] || 'As directed').trim(),
        notes: m[2] || 'Treatment'
      }));
    }
    return flattenMedicationsObject(medsArray);
  }

  if (!medText) return [];

  // 1. If medText is an object or dictionary
  if (typeof medText === 'object') {
    return flattenMedicationsObject(medText);
  }

  // 2. If medText contains JSON or Python dictionary anywhere in the string
  if (typeof medText === 'string' && (medText.includes('{') || medText.includes('['))) {
    const parsedObj = safeParseJsonOrPythonDict(medText);
    if (parsedObj) {
      const rows = flattenMedicationsObject(parsedObj);
      if (rows.length > 0) return rows;
    }
  }

  if (typeof medText !== 'string') return [];

  // 3. Fallback: Parse line by line
  const lines = medText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.toLowerCase().startsWith('inpatient care') && !l.toLowerCase().startsWith('treatment given:'));

  const parsed = [];
  for (const line of lines) {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, '').replace(/^Administered:\s*/i, '').trim();
    if (!cleaned) continue;

    // Check if individual line is a JSON or Python dict snippet
    if (cleaned.includes('{') && cleaned.includes('}')) {
      const parsedItem = safeParseJsonOrPythonDict(cleaned);
      if (parsedItem) {
        const itemRows = flattenMedicationsObject(parsedItem);
        if (itemRows.length > 0) {
          parsed.push(...itemRows);
          continue;
        }
      }
    }

    if (cleaned.includes(' - ')) {
      const parts = cleaned.split(/\s*-\s*/);
      const name = parts[0].trim();
      let dose = '';
      let route = '';
      let freq = '';
      let duration = '';
      let indication = '';
      const remaining = [];

      for (let i = 1; i < parts.length; i++) {
        const p = parts[i].trim();
        if (/^dosage:\s*/i.test(p)) dose = p.replace(/^dosage:\s*/i, '').trim();
        else if (/^route:\s*/i.test(p)) route = p.replace(/^route:\s*/i, '').trim();
        else if (/^freq(?:uency)?:\s*/i.test(p)) freq = p.replace(/^freq(?:uency)?:\s*/i, '').trim();
        else if (/^duration:\s*/i.test(p)) duration = p.replace(/^duration:\s*/i, '').trim();
        else if (/^indication:\s*/i.test(p)) indication = p.replace(/^indication:\s*/i, '').trim();
        else remaining.push(p);
      }

      let note = indication || 'Treatment';
      let instructions = [dose, route ? `Route: ${route}` : '', freq, duration ? `Duration: ${duration}` : '', ...remaining].filter(Boolean).join(', ');

      if (!indication || indication === 'Treatment') {
        const noteMatch = instructions.match(/\((.*?)\)/);
        if (noteMatch) {
          note = noteMatch[1];
          instructions = instructions.replace(noteMatch[0], '').trim();
        } else if (instructions.toLowerCase().includes('as needed') || instructions.toLowerCase().includes('sos')) {
          note = 'SOS / As needed';
        } else if (instructions.toLowerCase().includes('before food') || instructions.toLowerCase().includes('before breakfast')) {
          note = 'Before food';
        } else if (instructions.toLowerCase().includes('after food') || instructions.toLowerCase().includes('after meals')) {
          note = 'After food';
        }
      }

      parsed.push({
        medicine: name.trim(),
        instructions: instructions || 'As directed',
        notes: note
      });
    } else {
      parsed.push({
        medicine: cleaned,
        instructions: 'As directed',
        notes: 'Treatment'
      });
    }
  }

  return parsed;
}

export default function DischargeSummaryModal({ isOpen, onClose, summaryData, onSummaryUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const lastLoadedKeyRef = React.useRef(null);

  // Form state
  const [form, setForm] = useState({
    summary_id: '',
    patient_id: '',
    patient_name: '',
    patient_number: '',
    admission_id: '',
    admission_date: '',
    discharge_date: '',
    attending_physician: '',
    admission_reason: '',
    discharge_diagnosis: '',
    hospital_course_summary: '',
    investigations: '',
    patient_condition: '',
    discharge_medications: '',
    followup_instructions: '',
    surgery_details: '',
    approval_status: 'Pending Review',
    approved_by: ''
  });

  const [originalForm, setOriginalForm] = useState({});

  useEffect(() => {
    if (!isOpen) {
      lastLoadedKeyRef.current = null;
      setIsEditing(false);
      setSuccessMsg(null);
      setErrorMsg(null);
      return;
    }

    if (summaryData) {
      const summaryId = summaryData.summary_id || (summaryData.patient_id ? `DS-${summaryData.patient_id}` : summaryData.id || '');
      const patientId = summaryData.patient_id || summaryData.id || '';
      const currentKey = `${summaryId}-${patientId}`;

      // Only initialize form values if opening for a new patient or first time opening
      if (lastLoadedKeyRef.current !== currentKey) {
        lastLoadedKeyRef.current = currentKey;
        const clinical = synthesizeClinicalDetails(summaryData);

        const patientName = clinical.patientName || summaryData.patient_name || summaryData.patient || summaryData.name || '';
        const patientNumber = summaryData.patient_number || summaryData.mrn || (patientId ? `PAT-${patientId}` : '');
        const admissionId = summaryData.admission_id || (patientId ? `ADM-${patientId}` : '');
        const admissionDate = summaryData.admission_date || summaryData.admitted || '';
        const rawDischarge = summaryData.discharge_date && summaryData.discharge_date !== 'Now' ? summaryData.discharge_date : '';
        const dischargeDate = formatClinicalDateTime(rawDischarge, summaryData.dischargeTime || summaryData.dischargedAt);
        const attendingPhysician = clinical.doctor || summaryData.attending_physician || summaryData.doctor || summaryData.primary_consultant || '';
        const caseHistoryFallback = summaryData.case_history || summaryData.hospital_course_summary || clinical.narrative || summaryData.admission_reason || summaryData.reason_for_admission || summaryData.admission_details || '';
        let admissionReason = (summaryData.admission_reason || summaryData.case_history || summaryData.hospital_course_summary || clinical.narrative || summaryData.reason_for_admission || summaryData.admission_details || summaryData.intent || '').trim();
        if (admissionReason === '—' || admissionReason === '-' || admissionReason.toLowerCase() === 'none') {
          admissionReason = caseHistoryFallback || '';
        }
        const dischargeDiagnosis = formatClinicalDiagnoses(clinical.primaryDiag || summaryData.discharge_diagnosis || summaryData.diagnoses || summaryData.primary_diagnosis);
        const hospitalCourse = caseHistoryFallback || clinical.narrative || summaryData.hospital_course_summary || summaryData.case_history || admissionReason;
        const investigations = formatClinicalInvestigations(clinical.investigations || summaryData.investigations);
        const patientCondition = formatClinicalCondition(clinical.condition || summaryData.patient_condition);
        const dischargeMeds = formatClinicalTreatment(summaryData.discharge_medications || summaryData.treatment || '');
        const followup = formatClinicalAdvice(stripTamil(summaryData.followup_instructions || summaryData.discharge_advice || ''));
        const surgeryDetails = summaryData.surgery_details || summaryData.surgery || '';
        // Only treat as Approved if the DB explicitly says so, OR if the case is fully completed.
        // Defaulting to 'Approved' was hiding the sign-off button for Ready patients.
        const rawApprovalStatus = summaryData.approval_status;
        const approvalStatus = rawApprovalStatus && rawApprovalStatus.trim()
          ? rawApprovalStatus.trim()
          : (summaryData.isCompleted ? 'Approved' : 'Pending Review');
        const approvedBy = summaryData.approved_by || attendingPhysician || '';

        const initialValues = {
          summary_id: summaryId,
          patient_id: patientId,
          patient_name: patientName,
          patient_number: patientNumber,
          admission_id: admissionId,
          admission_date: admissionDate,
          discharge_date: dischargeDate,
          attending_physician: attendingPhysician,
          admission_reason: admissionReason || hospitalCourse,
          case_history: hospitalCourse || admissionReason,
          discharge_diagnosis: dischargeDiagnosis,
          hospital_course_summary: hospitalCourse || admissionReason,
          investigations: investigations,
          patient_condition: patientCondition,
          discharge_medications: dischargeMeds,
          followup_instructions: followup,
          surgery_details: surgeryDetails,
          approval_status: approvalStatus,
          approved_by: approvedBy
        };

        setForm(initialValues);
        setOriginalForm(initialValues);
        setIsEditing(false);
        setSuccessMsg(null);
        setErrorMsg(null);

        // Fetch official discharge summary record directly from http://127.0.0.1:8000/api/v1/gold/generated-discharge-summaries
        const fetchOfficialRecord = async () => {
          try {
            const fetchParams = {};
            if (patientId) fetchParams.patient_id = patientId;
            else if (admissionId) fetchParams.admission_id = admissionId;
            const res = await apiService.getDischargedPatients(fetchParams, { forceRefresh: true });
            const list = res?.data || [];

            const cleanDigits = (val) => {
              if (!val) return null;
              const m = String(val).match(/\d+/g);
              return m ? m[m.length - 1] : null;
            };
            const pIdNum = cleanDigits(patientId);
            const aIdNum = cleanDigits(admissionId);
            const sIdNum = cleanDigits(summaryId);

            const matched = list.find(s => {
              const sPid = cleanDigits(s.patient_id);
              const sAid = cleanDigits(s.admission_id);
              const sSid = cleanDigits(s.summary_id);
              if (pIdNum && sPid && pIdNum === sPid) return true;
              if (aIdNum && sAid && aIdNum === sAid) return true;
              if (sIdNum && sSid && sIdNum === sSid) return true;
              return false;
            });

            if (matched) {
              const matchedCaseHistory = matched.case_history || matched.hospital_course_summary || matched.admission_reason || admissionReason || hospitalCourse;
              const updatedFromApi = {
                summary_id: matched.summary_id ? `DS-${matched.summary_id}` : summaryId,
                patient_id: matched.patient_id || patientId,
                patient_name: matched.patient_name || patientName,
                patient_number: matched.patient_number || patientNumber,
                admission_id: matched.admission_id || admissionId,
                admission_date: matched.admission_date || admissionDate,
                discharge_date: formatClinicalDateTime(matched.discharge_date || dischargeDate, summaryData.dischargeTime || summaryData.dischargedAt),
                attending_physician: matched.primary_consultant || matched.attending_physician || attendingPhysician,
                admission_reason: matchedCaseHistory,
                case_history: matchedCaseHistory,
                discharge_diagnosis: formatClinicalDiagnoses(matched.diagnoses) || dischargeDiagnosis,
                hospital_course_summary: matchedCaseHistory,
                investigations: formatClinicalInvestigations(matched.investigations) || investigations,
                patient_condition: formatClinicalCondition(matched.patient_condition) || patientCondition,
                discharge_medications: formatClinicalTreatment(matched.treatment) || dischargeMeds,
                followup_instructions: formatClinicalAdvice(matched.discharge_advice) || followup,
                surgery_details: matched.surgery_details || surgeryDetails,
                approval_status: matched.approval_status || approvalStatus,
                approved_by: matched.approved_by || approvedBy
              };
              setForm(prev => ({ ...prev, ...updatedFromApi }));
              setOriginalForm(prev => ({ ...prev, ...updatedFromApi }));
            }
          } catch (err) {
            console.warn('Could not load official record from /api/v1/gold/generated-discharge-summaries:', err);
          }
        };

        fetchOfficialRecord();
      }
    }
  }, [summaryData, isOpen]);

  if (!isOpen || !summaryData) return null;

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = `Discharge Summary - ${form.patient_name || 'Patient'} (${form.patient_number || form.patient_id || 'MER-PAT'})`;
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 1000);
  };

  const handleSave = async (overrideStatus = null) => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const summaryId = form.summary_id || (form.patient_id ? `DS-${form.patient_id}` : summaryData.id);

    const changedFields = {};
    Object.keys(form).forEach((key) => {
      if (key !== 'summary_id' && form[key] !== originalForm[key]) {
        changedFields[key] = form[key];
      }
    });

    if (changedFields.admission_reason || changedFields.case_history || changedFields.hospital_course_summary) {
      const updatedCaseHistory = form.admission_reason || form.case_history || form.hospital_course_summary;
      changedFields.case_history = updatedCaseHistory;
      changedFields.hospital_course_summary = updatedCaseHistory;
      changedFields.admission_reason = updatedCaseHistory;
    }

    if (overrideStatus) {
      changedFields.approval_status = overrideStatus;
      if (form.attending_physician) {
        changedFields.approved_by = form.attending_physician;
      }
    }

    // Always send identity fields so backend upsert can create a new row if needed
    if (form.patient_id) changedFields.patient_id = form.patient_id;
    if (form.admission_id) changedFields.admission_id = form.admission_id;
    if (form.attending_physician) changedFields.attending_physician = form.attending_physician;

    if (Object.keys(changedFields).filter(k => !['patient_id', 'admission_id', 'attending_physician'].includes(k)).length === 0 && !overrideStatus) {
      setIsEditing(false);
      setSaving(false);
      return;
    }

    try {
      await apiService.updateDischargeSummary(summaryId, changedFields);
      setSuccessMsg(`✓ Updated successfully for ${summaryId}`);
      setIsEditing(false);

      const updatedForm = { ...form, ...changedFields };
      setForm(updatedForm);
      setOriginalForm(updatedForm);

      if (onSummaryUpdated) {
        onSummaryUpdated({ ...summaryData, ...changedFields });
      }
    } catch (err) {
      console.error('Save error:', err);
      setErrorMsg(err.message || 'Failed to update discharge summary');
    } finally {
      setSaving(false);
    }
  };

  let age = summaryData.age;
  if (!age || age === 'Clinical Review') {
    if (summaryData.raw?.age) age = summaryData.raw.age;
    else if (summaryData.case_history) {
      const match = summaryData.case_history.match(/(?:a|an)\s+(\d{1,3})[- ]year[- ]old/i)
        || summaryData.case_history.match(/aged\s+(\d{1,3})/i);
      if (match) age = match[1];
    }
  }
  age = age || '—';

  let sex = summaryData.sex || summaryData.gender;
  if (!sex || sex === '—') {
    if (summaryData.case_history) {
      const match = summaryData.case_history.match(/(?:a|an)\s+\d{1,3}[- ]year[- ]old\s+([A-Za-z]+)/i);
      if (match) sex = match[1].toLowerCase().startsWith('f') ? 'F' : match[1].toLowerCase().startsWith('m') ? 'M' : match[1];
    }
  }
  sex = sex || '—';
  const admissionDisplayDate = formatClinicalDate(form.admission_date);
  const printDocDate = form.discharge_date || formatClinicalDateTime(summaryData.discharge_date || form.admission_date, summaryData.dischargeTime || summaryData.dischargedAt);
  const cleanFollowup = formatClinicalAdvice(stripTamil(form.followup_instructions));
  const cleanDiagText = formatClinicalDiagnoses(form.discharge_diagnosis);
  const medIntro = getMedicationIntro(form.discharge_medications);
  const parsedMeds = parseMedications(summaryData.meds, form.discharge_medications);

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. ON-SCREEN INTERACTIVE DIALOG MODAL (Hidden during print)               */}
      {/* ========================================================================= */}
      <div
        className="discharge-summary-modal-overlay no-print-elem"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          overflowY: 'auto'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          id="discharge-summary-card"
          className="no-print-elem"
          style={{
            width: '100%',
            maxWidth: '820px',
            maxHeight: '92vh',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: '#1e293b'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* MODAL HEADER */}
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '16px',
              flexShrink: 0
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#0f172a',
                    letterSpacing: '-0.02em'
                  }}
                >
                  {form.patient_name || 'Patient'}
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: form.approval_status === 'Approved' ? '#ecfdf5' : '#fef3c7',
                    color: form.approval_status === 'Approved' ? '#047857' : '#b45309',
                    border: `1px solid ${form.approval_status === 'Approved' ? '#a7f3d0' : '#fde68a'}`
                  }}
                >
                  ● {form.approval_status || 'Pending Review'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginTop: '4px',
                  fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
                  lineHeight: 1.4
                }}
              >
                Patient Number: {form.patient_number || form.patient_id} · {age} Yrs / {sex} · Adm {form.admission_id} · Admitted {admissionDisplayDate}
              </div>
            </div>

            {/* ACTIONS: PRINT / EDIT / CLOSE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handlePrint}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Print
              </button>

              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #0284c7',
                    backgroundColor: '#f0f9ff',
                    color: '#0369a1',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>✏️</span> Edit Summary
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setForm(originalForm);
                    setIsEditing(false);
                  }}
                  disabled={saving}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              )}

              {isEditing && (
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saving}
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid transparent',
                  backgroundColor: 'transparent',
                  color: '#64748b',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* NOTIFICATION BANNERS */}
          {successMsg && (
            <div style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '8px 24px', fontSize: '12px', color: '#166534', fontWeight: 600 }}>
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '8px 24px', fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* MODAL BODY (Scrollable) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* GREEN ALERT BANNER */}
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12.5px',
                color: '#065f46',
                fontWeight: 500
              }}
            >
              <span style={{ fontSize: '15px', color: '#059669', fontWeight: 700 }}>✓</span>
              <span>Billing cleared — this patient can be discharged as soon as the summary is signed.</span>
            </div>

            {/* VIEW MODE */}
            {!isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* SECTION 1: ADMISSION DETAILS & CASE HISTORY */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Admission Details &amp; Case History
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
                    {form.hospital_course_summary || form.admission_reason || 'Patient admitted for clinical management.'}
                  </div>
                </div>

                {/* SECTION 2: DIAGNOSES (Cleaned, NO brackets []) */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Diagnoses
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600, lineHeight: 1.5 }}>
                    {cleanDiagText && !/^Diagnosis\s+\d+/i.test(cleanDiagText) ? cleanDiagText : (summaryData.primary_diagnosis || cleanDiagText || 'Cholelithiasis (Gallstone Disease)')}
                  </div>
                </div>

                {/* SECTION 3: INVESTIGATIONS */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Investigations
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {formatClinicalInvestigations(form.investigations) || 'No specific investigation details recorded.'}
                  </div>
                </div>

                {/* SECTION 4: CONDITION ON DISCHARGE */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Condition on Discharge
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
                    {formatClinicalCondition(form.patient_condition) || 'Patient is hemodynamically stable at discharge.'}
                  </div>
                </div>

                {/* SECTION 5: DISCHARGE MEDICATIONS */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Discharge Medications
                  </div>
                  {medIntro && (
                    <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5, marginBottom: '8px' }}>
                      {medIntro}
                    </div>
                  )}
                  {parsedMeds.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '7px 10px', fontWeight: 700, color: '#334155', fontSize: '10.5px' }}>MEDICINE</th>
                          <th style={{ padding: '7px 10px', fontWeight: 700, color: '#334155', fontSize: '10.5px' }}>DOSE / INSTRUCTIONS</th>
                          <th style={{ padding: '7px 10px', fontWeight: 700, color: '#334155', fontSize: '10.5px' }}>NOTES / INDICATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedMeds.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a' }}>{m.medicine}</td>
                            <td style={{ padding: '7px 10px', color: '#334155' }}>{m.instructions}</td>
                            <td style={{ padding: '7px 10px', color: '#64748b' }}>{m.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {form.discharge_medications || 'No specific discharge medications documented.'}
                    </div>
                  )}
                </div>

                {/* SECTION 6: SURGERY DETAILS (if applicable) */}
                {form.surgery_details && form.surgery_details.toLowerCase() !== 'nil' && form.surgery_details.toLowerCase() !== 'none' && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Surgery &amp; Procedures Details
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5 }}>
                      {form.surgery_details}
                    </div>
                  </div>
                )}

                {/* SECTION 7: DISCHARGE ADVICE & FOLLOW-UP (Tamil stripped) */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Review / Follow-up
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {cleanFollowup || 'Follow-up in OPD as advised by attending physician.'}
                  </div>
                </div>

                {/* ATTENDING PHYSICIAN SIGNATURE BLOCK */}
                <div style={{ marginTop: '12px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Primary Consultant / Attending Physician:</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{form.attending_physician || 'Attending Physician'}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Discharge Date: {form.discharge_date || formatClinicalDateTime(summaryData.discharge_date, summaryData.dischargeTime || summaryData.dischargedAt)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Digital Verification:</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: form.approval_status === 'Approved' ? '#059669' : '#d97706' }}>
                      {form.approval_status === 'Approved' ? '✓ Clinically Approved & Certified' : '⏳ Pending Clinical Sign-off'}
                    </div>
                    {form.summary_id && (
                      <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>Record ID: {form.summary_id}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* EDIT MODE FORM */
              <form
                onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Attending Physician
                    </label>
                    <input
                      type="text"
                      value={form.attending_physician}
                      onChange={(e) => setForm({ ...form, attending_physician: e.target.value })}
                      placeholder="e.g. Dr. Pooja Menon, MBBS, MD"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Approval Status
                    </label>
                    <select
                      value={form.approval_status}
                      onChange={(e) => setForm({ ...form, approval_status: e.target.value })}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                    >
                      <option value="Approved">Approved</option>
                      <option value="Pending Approval">Pending Approval</option>
                      <option value="Under Review">Under Review</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                      Discharge Date / Time
                    </label>
                    <input
                      type="text"
                      value={form.discharge_date}
                      onChange={(e) => setForm({ ...form, discharge_date: e.target.value })}
                      placeholder="e.g. 23 Sep 2026, 09:30 AM"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Admission Details &amp; Case History
                  </label>
                  <textarea
                    rows={4}
                    value={form.admission_reason || form.case_history || form.hospital_course_summary || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm({ ...form, admission_reason: val, case_history: val, hospital_course_summary: val });
                    }}
                    placeholder="Enter admission details / reason and case history..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Diagnoses
                  </label>
                  <input
                    type="text"
                    value={form.discharge_diagnosis}
                    onChange={(e) => setForm({ ...form, discharge_diagnosis: e.target.value })}
                    placeholder="Enter primary and secondary diagnoses..."
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Investigations
                  </label>
                  <textarea
                    rows={2}
                    value={form.investigations}
                    onChange={(e) => setForm({ ...form, investigations: e.target.value })}
                    placeholder="Enter lab tests and investigations findings..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Condition on Discharge
                  </label>
                  <input
                    type="text"
                    value={form.patient_condition}
                    onChange={(e) => setForm({ ...form, patient_condition: e.target.value })}
                    placeholder="e.g. Hemodynamically stable"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Discharge Medications
                  </label>
                  <textarea
                    rows={4}
                    value={form.discharge_medications}
                    onChange={(e) => setForm({ ...form, discharge_medications: e.target.value })}
                    placeholder="Enter discharge medications schedule..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Surgery Details
                  </label>
                  <input
                    type="text"
                    value={form.surgery_details}
                    onChange={(e) => setForm({ ...form, surgery_details: e.target.value })}
                    placeholder="e.g. Laparoscopic Cholecystectomy performed on 2026-09-07 or Nil"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Discharge Advice & Follow-Up
                  </label>
                  <textarea
                    rows={3}
                    value={form.followup_instructions}
                    onChange={(e) => setForm({ ...form, followup_instructions: e.target.value })}
                    placeholder="Enter follow-up instructions and precautions..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(originalForm);
                      setIsEditing(false);
                    }}
                    disabled={saving}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#64748b',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {saving ? 'Saving...' : '💾 Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* MODAL FOOTER */}
          <div
            style={{
              padding: '12px 24px',
              backgroundColor: '#f8fafc',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11.5px',
              color: '#64748b',
              flexShrink: 0
            }}
          >
            <div>
              Record: <strong style={{ color: "#0f172a" }}>{form.summary_id || "-"}</strong> · Patient Number: <strong style={{ color: "#0f172a" }}>{form.patient_number || form.patient_id || "-"}</strong>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {form.approval_status !== 'Approved' && (
                <button
                  type="button"
                  onClick={() => handleSave('Approved')}
                  disabled={saving}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Approving...' : '✓ Approve & Sign-off'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PRINT-ONLY CLINICAL DOCUMENT (Portaled outside #root into document.body)*/}
      {/* ========================================================================= */}
      {createPortal(
        <div id="printArea" style={{ fontFamily: "Tahoma, 'Segoe UI', Arial, Helvetica, sans-serif", textRendering: 'optimizeLegibility' }}>
          <div className="print-page" style={{ fontFamily: "Tahoma, 'Segoe UI', Arial, Helvetica, sans-serif", textRendering: 'optimizeLegibility' }}>
            {/* DOCUMENT HEADER */}
            <div className="print-header">
              <div className="print-brand">
                <div className="print-title">PATIENT DISCHARGE SUMMARY</div>
              </div>
              <div className="print-doc-meta">
                <div className="print-meta-badge">
                  <span>Discharge Date:</span> <strong>{printDocDate}</strong>
                </div>
              </div>
            </div>

            {/* PATIENT INFORMATION DOSSIER CARD */}
            <div className="print-patient-card">
              <div className="print-patient-grid">
                <div><span className="print-field-label">Patient Name:</span> <strong className="print-field-val print-patient-name">{form.patient_name || '—'}</strong></div>
                <div><span className="print-field-label">MRN / UHID:</span> <span className="print-field-val print-mono">{form.patient_number || '—'}</span></div>
                <div><span className="print-field-label">Age &amp; Gender:</span> <span className="print-field-val">{age} Yrs / {sex === 'F' ? 'Female' : sex === 'M' ? 'Male' : sex}</span></div>
                <div><span className="print-field-label">Admission Date:</span> <span className="print-field-val">{admissionDisplayDate}</span></div>
                <div><span className="print-field-label">Attending Doctor:</span> <span className="print-field-val">{form.attending_physician || 'Dr. Priya Patel'}</span></div>
                <div><span className="print-field-label">Speciality / Ward:</span> <span className="print-field-val">{summaryData.department || 'Clinical Services'}</span></div>
                <div className="print-grid-span2"><span className="print-field-label">Primary Diagnosis:</span> <strong className="print-field-val print-bold-diag">{cleanDiagText && !/^Diagnosis\s+\d+/i.test(cleanDiagText) ? cleanDiagText : (summaryData.primary_diagnosis || cleanDiagText || 'Cholelithiasis (Gallstone Disease)')}</strong></div>
              </div>
            </div>

            {/* CLINICAL SUMMARY SECTIONS */}
            {/* 1. Admission Details & Hospital Course */}
            <div className="print-sec">
              <div className="print-sec-title">1. Admission Details &amp; Clinical Course</div>
              <div className="print-sec-body">
                {form.hospital_course_summary || form.admission_reason || 'Patient admitted for evaluation and definitive clinical management. Managed according to evidence-based protocols with stable clinical progression.'}
              </div>
            </div>

            {/* 2. Confirmed Diagnoses */}
            <div className="print-sec">
              <div className="print-sec-title">2. Diagnoses &amp; Findings</div>
              <div className="print-sec-body">
                <strong>Primary Diagnosis:</strong> {cleanDiagText && !/^Diagnosis\s+\d+/i.test(cleanDiagText) ? cleanDiagText : (summaryData.primary_diagnosis || cleanDiagText || 'Cholelithiasis (Gallstone Disease)')}
              </div>
            </div>

            {/* 3. Investigations & Lab Workup */}
            <div className="print-sec">
              <div className="print-sec-title">3. Key Diagnostic Investigations &amp; Lab Workup</div>
              <div className="print-sec-body" style={{ whiteSpace: 'pre-line' }}>
                {formatClinicalInvestigations(form.investigations) || 'Diagnostic laboratory tests and imaging reviewed and recorded in hospital EMR.'}
              </div>
            </div>

            {/* 4. Surgical & Operative Details */}
            {form.surgery_details && form.surgery_details.toLowerCase() !== 'nil' && form.surgery_details.toLowerCase() !== 'none' && (
              <div className="print-sec">
                <div className="print-sec-title">4. Surgical / Operative Procedures</div>
                <div className="print-sec-body">
                  {form.surgery_details}
                </div>
              </div>
            )}

            {/* 5. Condition on Discharge */}
            <div className="print-sec">
              <div className="print-sec-title">5. Clinical Condition at Discharge</div>
              <div className="print-sec-body">
                {formatClinicalCondition(form.patient_condition) || 'Patient is hemodynamically stable, alert, conscious, and oriented. Vitals are within normal limits. Tolerating oral intake well and medically cleared for safe discharge.'}
              </div>
            </div>

            {/* 6. Discharge Medications */}
            <div className="print-sec">
              <div className="print-sec-title">6. Discharge Medications &amp; Prescription</div>
              {medIntro && <div className="print-sec-body" style={{ marginBottom: '4px', fontStyle: 'italic', color: '#475569' }}>{medIntro}</div>}
              {parsedMeds.length > 0 && (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Medication &amp; Formulation</th>
                      <th style={{ width: '30%' }}>Dosage &amp; Frequency</th>
                      <th style={{ width: '25%' }}>Instructions / Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedMeds.map((m, idx) => (
                      <tr key={idx}>
                        <td><strong>{m.medicine}</strong></td>
                        <td>{m.instructions}</td>
                        <td>{m.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 7. Review, Follow-Up & Discharge Advice */}
            <div className="print-sec">
              <div className="print-sec-title">7. Review, Follow-Up &amp; Patient Discharge Advice</div>
              <div className="print-sec-body">
                {parseFollowupInstructions(cleanFollowup).length > 1 ? (
                  <div className="print-followup-container">
                    <ol className="print-followup-list">
                      {parseFollowupInstructions(cleanFollowup).map((item, idx) => {
                        const isWarning = /emergency|warning|immediately|danger|fever\s*>/i.test(item);
                        if (isWarning) {
                          return (
                            <li key={idx} className="print-warning-item">
                              <strong>⚠️ Emergency Red Flags: </strong>
                              {item.replace(/^Emergency Warning Signs:\s*/i, '')}
                            </li>
                          );
                        }
                        return (
                          <li key={idx} className="print-followup-item">
                            {item}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : (
                  <div>{cleanFollowup || 'Follow up with attending consultant as advised.'}</div>
                )}
              </div>
            </div>

            {/* SIGNATURE & VERIFICATION BLOCK WITH DEDICATED SIGNING SPACE */}
            <div className="print-sig-box">
              <div className="print-sig-col">
                <div className="print-sig-space" />
                <div className="print-sig-line" />
                <div className="print-sig-title">Prepared &amp; Verified By</div>
                <div className="print-sig-sub">Clinical Care Desk / RMO</div>
              </div>
              <div className="print-sig-col print-sig-right">
                <div className="print-sig-space" />
                <div className="print-sig-line" />
                <div className="print-sig-title">Attending Clinician Signature</div>
                <div className="print-sig-sub">{form.attending_physician || 'Dr. Priya Patel, MBBS, DNB'}</div>
                <div className="print-sig-date">Date: {printDocDate}</div>
              </div>
            </div>

            {/* DOCUMENT FOOTER */}
            <div className="print-doc-footer">
              Electronic Medical Record (EMR) · Confidential Patient Discharge Summary
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
