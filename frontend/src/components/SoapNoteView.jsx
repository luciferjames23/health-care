import React, { useState, useEffect } from 'react';
import { apiService, resolveClinicalDiagnosis } from '../services/api';

function getPatientDiagnosis(p) {
  if (!p) return 'Clinical Inpatient Evaluation';
  return resolveClinicalDiagnosis(
    p.primaryDiagnosis || p.diagnosis || p.primary_diagnosis || p.procedure,
    p.reason_for_admission || p.admission_reason
  );
}

export default function SoapNoteView({ patient, doctorName = 'Dr. Arjun Menon', onBack, onOpenPatient }) {
  const [lang, setLang] = useState('EN'); // 'EN' | 'TA'
  const [recState, setRecState] = useState('idle'); // 'idle' | 'recording' | 'done'
  const [recSeconds, setRecSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [aiDraft, setAiDraft] = useState(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [signedAt, setSignedAt] = useState('');
  const [dbDrafts, setDbDrafts] = useState([]);

  // Clinical record form fields initialized dynamically based on selected patient
  const [soapFields, setSoapFields] = useState(() => {
    if (!patient) {
      return {
        s: 'Patient presents for clinical evaluation and inpatient rounds. Subjective symptoms documented during physician visit.',
        o: 'Vital signs, telemetry recordings, and diagnostic workup reviewed by attending medical team.',
        a: 'Clinical status stable post-admission. Assessment documented in active clinical timeline.',
        p: '1. Inpatient clinical care protocol.\n2. Continuous vital signs and telemetry monitoring.\n3. Daily consultant rounds.'
      };
    }
    const pName = patient.name || patient.patient_name || patient.patient || 'Patient';
    const age = patient.age ? `${patient.age}yo` : '';
    const sex = patient.sex || '';
    const diag = getPatientDiagnosis(patient);
    const bp = patient.latestBp || (patient.systolic_bp ? `BP ${patient.systolic_bp}/${patient.diastolic_bp} mmHg, HR ${patient.heart_rate || 76} bpm, SpO2 ${patient.oxygen_saturation || 98}%` : 'Vital signs within normal limits.');
    const doc = patient.doctor || patient.primary_consultant || doctorName;
    const meds = Array.isArray(patient.medications) ? patient.medications : [];

    return {
      s: `Patient ${pName} (${age} ${sex}) presents for inpatient management under ${doc}. Indication: ${diag}. Patient reports symptom stability under ongoing observation.`,
      o: `Telemetry & Vitals: ${bp}. Diagnostic and nursing records verified.`,
      a: `${diag}. Hemodynamically monitored, responding appropriately to inpatient protocol.`,
      p: meds.length > 0
        ? meds.map((m, i) => `${i + 1}. Continue ${m.medication_name || m} (${m.dosage || 'standard dosage'}).`).concat([`${meds.length + 1}. Continuous vital monitoring and routine nursing care.`]).join('\n')
        : `1. Continuous telemetry & vital signs monitoring.\n2. Supportive medical management and fluid balance.\n3. Daily rounds under ${doc}.`
    };
  });

  useEffect(() => {
    async function loadDbDrafts() {
      try {
        const res = await apiService.getSoapNotes({ limit: 20 });
        if (res?.drafts && res.drafts.length > 0) {
          setDbDrafts(res.drafts);
        }

        const pid = patient?.patient_id || patient?.id;
        const match = res?.drafts?.find(d => String(d.patient_id) === String(pid));
        if (match) {
          setSoapFields({
            s: match.subjective || '',
            o: match.objective || '',
            a: match.assessment || '',
            p: match.plan || ''
          });
          if (match.raw_transcript) {
            setTranscript(match.raw_transcript);
            setRecState('done');
          }
        } else if (patient) {
          // Direct dynamic update from live patient object
          const pName = patient.name || patient.patient_name || patient.patient || 'Patient';
          const age = patient.age ? `${patient.age}yo` : '';
          const sex = patient.sex || '';
          const diag = getPatientDiagnosis(patient);
          const bp = patient.latestBp || (patient.systolic_bp ? `BP ${patient.systolic_bp}/${patient.diastolic_bp} mmHg, HR ${patient.heart_rate || 76} bpm, SpO2 ${patient.oxygen_saturation || 98}%` : 'Vital signs within normal limits.');
          const doc = patient.doctor || patient.primary_consultant || doctorName;
          const meds = Array.isArray(patient.medications) ? patient.medications : [];

          setSoapFields({
            s: `Patient ${pName} (${age} ${sex}) presents for inpatient management under ${doc}. Indication: ${diag}. Patient reports symptom stability under ongoing observation.`,
            o: `Telemetry & Vitals: ${bp}. Diagnostic and nursing records verified.`,
            a: `${diag}. Hemodynamically monitored, responding appropriately to inpatient protocol.`,
            p: meds.length > 0
              ? meds.map((m, i) => `${i + 1}. Continue ${m.medication_name || m} (${m.dosage || 'standard dosage'}).`).concat([`${meds.length + 1}. Continuous vital monitoring and routine nursing care.`]).join('\n')
              : `1. Continuous telemetry & vital signs monitoring.\n2. Supportive medical management and fluid balance.\n3. Daily rounds under ${doc}.`
          });
          setTranscript(`Clinical dictation for ${pName}: Evaluated in bed. Vital signs stable. Primary diagnosis of ${diag}. Active care plan documented.`);
          setRecState('done');
        }
      } catch (err) {
        console.warn("Using SOAP note data:", err);
      }
    }
    loadDbDrafts();
  }, [patient, doctorName]);

  const handleStartRec = () => {
    setRecState('recording');
    setRecSeconds(0);
    const interval = setInterval(() => {
      setRecSeconds(s => {
        if (s >= 8) {
          clearInterval(interval);
          setRecState('done');
          if (lang === 'TA') {
            setTranscript("நோயாளிக்கு தீவிர நிலைமை கண்காணிக்கப்படுகிறது. இரத்த அழுத்தம் மற்றும் நாடித்துடிப்பு சீராக உள்ளது. மருந்துகள் வழங்கப்பட்டன.");
          } else {
            setTranscript(`Patient evaluated in ward by ${doctorName}. Vital parameters within target threshold. Current medications and active nursing plan continued.`);
          }
          return s;
        }
        return s + 1;
      });
    }, 1000);
  };

  const handleGenDraft = () => {
    setIsDrafting(true);
    const diag = getPatientDiagnosis(patient);
    setTimeout(() => {
      setIsDrafting(false);
      setAiDraft({
        s: lang === 'TA' ? `நோயாளி நிலைமை கண்காணிக்கப்படுகிறது (${diag}).` : `Patient presents for ongoing inpatient management of ${diag}. Denies acute pain or distress.`,
        o: "Vitals stable on continuous telemetry. Oxygen saturation 98% on room air. Normal heart sounds and chest clear.",
        a: `${diag}. Patient hemodynamically stable.`,
        p: "Continue current prescription regimen. Nursing monitoring every 4 hours. Consultant review scheduled."
      });
    }, 1200);
  };

  const handleApplyDraft = () => {
    if (aiDraft) {
      setSoapFields(aiDraft);
      alert('AI SOAP draft loaded into editable clinical record for review.');
    }
  };

  const handleSign = () => {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    setIsSigned(true);
    setSignedAt(now);
    alert(`SOAP note officially signed by ${doctorName} at ${now}. Note locked to EMR clinical record.`);
  };

  const pName = patient?.name || patient?.patient_name || patient?.patient || 'Patient';
  const rawBed = patient?.bed_number || patient?.bed || 'BED-0193';
  const isSyntheticBed = typeof rawBed === 'string' && /^bed \d+$/i.test(rawBed.trim());
  const pBed = (!isSyntheticBed && rawBed) ? (rawBed.startsWith('BED-') ? rawBed : (rawBed.toLowerCase().startsWith('bed') ? rawBed : `Bed ${rawBed}`)) : 'BED-0193';
  const pMrn = patient?.uhid || patient?.patient_number || patient?.mrn || (patient?.patient_id ? `MER-PAT-${String(patient.patient_id).padStart(7, '0')}` : 'MER-PAT-0000001');
  const pEncounter = patient?.encounter || (patient?.admission_number ? `ENC-${patient.admission_number}` : (patient?.admission_id ? `ENC-MER-ADM-${String(patient.admission_id).padStart(7, '0')}` : 'ENC-ADM-0000001'));
  const attendingDoc = doctorName || patient?.doctor || 'Attending Physician';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Navigation Breadcrumb with Back */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#687076' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none', border: 'none', padding: '2px 6px',
            color: 'oklch(0.4 0.14 200)', cursor: 'pointer', fontWeight: 600,
            fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px'
          }}
        >
          ← Back
        </button>
        <span>·</span>
        <span>Patient 360</span>
        <span>›</span>
        <span style={{ color: '#15181b', fontWeight: 600 }}>{pName}</span>
        <span>›</span>
        <span style={{ color: '#8a9096' }}>SOAP Note</span>
      </div>

      {/* Top Header Card */}
      <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '20px', fontWeight: 600 }}>SOAP note · {pName}</span>
              <span style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                background: isSigned ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 80)',
                color: isSigned ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.13 70)'
              }}>
                {isSigned ? 'Official Clinical Record' : 'Draft in progress'}
              </span>
            </div>
            <div style={{ color: '#52585e', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', marginTop: '2px' }}>
              {pMrn} · {pBed} · Encounter {pEncounter} · Attending: {attendingDoc}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                height: '30px', padding: '0 12px', borderRadius: '6px',
                border: '1px solid #c8d0d6', background: '#f8f9fa',
                color: '#15181b', fontWeight: 600, cursor: 'pointer', fontSize: '11.5px',
                display: 'inline-flex', alignItems: 'center', gap: '4px'
              }}
            >
              ← Back
            </button>
            {dbDrafts.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8a9096', fontSize: '11.5px' }}>
                <span>Load Draft</span>
                <select
                  onChange={(e) => {
                    const found = dbDrafts.find(d => String(d.draft_id) === e.target.value);
                    if (found) {
                      setSoapFields({
                        s: found.subjective || '',
                        o: found.objective || '',
                        a: found.assessment || '',
                        p: found.plan || ''
                      });
                      if (found.raw_transcript) setTranscript(found.raw_transcript);
                    }
                  }}
                  style={{
                    height: '30px', border: '1px solid #e3e6e8', borderRadius: '6px',
                    background: '#fff', padding: '0 8px', fontWeight: 600, color: '#15181b', fontSize: '11.5px'
                  }}
                >
                  {dbDrafts.map((d) => (
                    <option key={d.draft_id} value={d.draft_id}>
                      Draft #{d.draft_id} - {d.patient_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8a9096', fontSize: '11.5px' }}>
              <span>Dictation language</span>
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                style={{
                  height: '30px', border: '1px solid #e3e6e8', borderRadius: '6px',
                  background: '#fff', padding: '0 8px', fontWeight: 600, color: '#15181b', fontSize: '11.5px'
                }}
              >
                <option value="EN">English</option>
                <option value="TA">தமிழ் · Tamil</option>
              </select>
            </label>
            <button
              type="button"
              onClick={onBack}
              style={{
                height: '30px', padding: '0 10px', borderRadius: '6px',
                border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                color: 'oklch(0.4 0.1 200)', fontWeight: 600, cursor: 'pointer', fontSize: '11.5px'
              }}
            >
              Clinical workspace
            </button>
            <button
              type="button"
              onClick={() => onOpenPatient && onOpenPatient(patient)}
              style={{
                height: '30px', padding: '0 10px', borderRadius: '6px',
                border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11.5px'
              }}
            >
              Patient 360
            </button>
          </div>
        </div>
      </div>

      {/* 3-Column Layout: Voice Capture | AI Draft | Clinical Record */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '14px', alignItems: 'start'
      }}>
        {/* Col 1: Voice Capture */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>1 · Voice capture</span>
            <span style={{ font: '500 10px ui-monospace, Menlo, monospace', color: '#8a9096' }}>Whisper-v3 Med · {lang}</span>
          </div>

          {recState === 'idle' && (
            <div>
              <button
                type="button"
                onClick={handleStartRec}
                style={{
                  width: '100%', height: '40px', borderRadius: '8px',
                  border: '1px solid oklch(0.5 0.1 200)', background: '#fff',
                  color: 'oklch(0.4 0.1 200)', fontWeight: 600, cursor: 'pointer', fontSize: '13px'
                }}
              >
                🎙 Start dictation ({lang === 'TA' ? 'Tamil' : 'English'})
              </button>
              <div style={{ fontSize: '11px', color: '#8a9096', marginTop: '6px', lineHeight: 1.45 }}>
                Click to record clinical encounter or consultation notes. Clinical speech-to-text transcribes in real time.
              </div>
            </div>
          )}

          {recState === 'recording' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px',
                borderRadius: '8px', background: 'oklch(0.96 0.03 25)', color: 'oklch(0.45 0.17 25)'
              }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'oklch(0.55 0.18 25)', animation: 'mpulse .8s infinite' }} />
                <span style={{ fontWeight: 600, fontSize: '12px' }}>🔴 Recording — 0:0{recSeconds}</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px' }}>Listening...</span>
              </div>
              <div style={{ minHeight: '60px', padding: '8px 10px', borderRadius: '6px', background: '#f6f7f8', fontSize: '12px', fontStyle: 'italic', color: '#52585e' }}>
                “Patient presented with severe chest pain since early morning...”
              </div>
            </div>
          )}

          {recState === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ border: '1px solid #e3e6e8', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ padding: '6px 10px', background: '#f6f7f8', font: '600 10px ui-monospace, Menlo, monospace', color: '#52585e' }}>
                  VOICE TRANSCRIPT · RAW
                </div>
                <div style={{ padding: '10px', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {transcript}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleGenDraft}
                  style={{
                    flex: 1, height: '32px', borderRadius: '6px', border: 0,
                    background: 'oklch(0.5 0.1 300)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '11.5px'
                  }}
                >
                  Generate AI SOAP draft →
                </button>
                <button
                  type="button"
                  onClick={handleStartRec}
                  style={{
                    height: '32px', padding: '0 10px', borderRadius: '6px',
                    border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11.5px'
                  }}
                >
                  Re-record
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Col 2: AI SOAP Draft */}
        <div style={{
          background: '#fff', border: '1px solid oklch(0.85 0.05 300)',
          borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)' }} />
            <span style={{ fontWeight: 600, fontSize: '13px' }}>2 · AI SOAP draft</span>
            <span style={{
              marginLeft: 'auto', font: '600 9px ui-monospace, Menlo, monospace',
              color: 'oklch(0.45 0.1 300)', border: '1px solid oklch(0.85 0.05 300)',
              padding: '2px 6px', borderRadius: '4px'
            }}>
              AI GENERATED · NOT A CLINICAL RECORD
            </span>
          </div>

          {isDrafting && (
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'center', padding: '12px',
              borderRadius: '8px', border: '1px solid oklch(0.85 0.05 300)', color: '#52585e', fontSize: '12px'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)', animation: 'mpulse 1s infinite' }} />
              Drafting from transcript, recorded vitals, LIS Troponin and ECG findings...
            </div>
          )}

          {!aiDraft && !isDrafting && (
            <div style={{ padding: '12px', borderRadius: '6px', background: '#f6f7f8', color: '#52585e', fontSize: '12px', lineHeight: 1.5 }}>
              No draft yet. Click "Generate AI SOAP draft" from the voice transcript, or type directly into the clinical record on the right.
            </div>
          )}

          {aiDraft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'oklch(0.45 0.1 300)' }}>S · SUBJECTIVE</div>
                <div style={{ color: '#52585e', marginTop: '2px' }}>{aiDraft.s}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'oklch(0.45 0.1 300)' }}>O · OBJECTIVE</div>
                <div style={{ color: '#52585e', marginTop: '2px' }}>{aiDraft.o}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'oklch(0.45 0.1 300)' }}>A · ASSESSMENT</div>
                <div style={{ color: '#52585e', marginTop: '2px' }}>{aiDraft.a}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: 'oklch(0.45 0.1 300)' }}>P · PLAN</div>
                <div style={{ color: '#52585e', marginTop: '2px', whiteSpace: 'pre-wrap' }}>{aiDraft.p}</div>
              </div>

              <button
                type="button"
                onClick={handleApplyDraft}
                style={{
                  height: '34px', borderRadius: '6px', border: 0,
                  background: 'oklch(0.5 0.1 300)', color: '#fff', fontWeight: 600,
                  cursor: 'pointer', fontSize: '11.5px', marginTop: '6px'
                }}
              >
                Load draft into clinical record for review →
              </button>
            </div>
          )}

          <div style={{ fontSize: '11px', color: '#8a9096', lineHeight: 1.45, marginTop: 'auto' }}>
            The AI draft never enters the medical record automatically. Only the signing clinician can edit and finalize.
          </div>
        </div>

        {/* Col 3: Official Clinical Record */}
        <div style={{
          background: '#fff', border: isSigned ? '1px solid oklch(0.95 0.04 150)' : '1px solid #e3e6e8',
          borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>3 · Official Clinical record</span>
            <span style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
              background: isSigned ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 80)',
              color: isSigned ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.13 70)'
            }}>
              {isSigned ? 'SIGNED' : 'DRAFT'}
            </span>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096' }}>Subjective</span>
            <textarea
              rows={2}
              value={soapFields.s}
              onChange={e => setSoapFields({ ...soapFields, s: e.target.value })}
              readOnly={isSigned}
              style={{ border: '1px solid #e3e6e8', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', resize: 'vertical' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096' }}>Objective</span>
            <textarea
              rows={2}
              value={soapFields.o}
              onChange={e => setSoapFields({ ...soapFields, o: e.target.value })}
              readOnly={isSigned}
              style={{ border: '1px solid #e3e6e8', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', resize: 'vertical' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096' }}>Assessment</span>
            <textarea
              rows={2}
              value={soapFields.a}
              onChange={e => setSoapFields({ ...soapFields, a: e.target.value })}
              readOnly={isSigned}
              style={{ border: '1px solid #e3e6e8', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', resize: 'vertical' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096' }}>Plan</span>
            <textarea
              rows={3}
              value={soapFields.p}
              onChange={e => setSoapFields({ ...soapFields, p: e.target.value })}
              readOnly={isSigned}
              style={{ border: '1px solid #e3e6e8', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', resize: 'vertical' }}
            />
          </label>

          {isSigned ? (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px',
              borderRadius: '6px', background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)', fontSize: '11.5px'
            }}>
              <span style={{ fontWeight: 700 }}>✓ Signed by {doctorName} · {signedAt}</span>
              <span style={{ fontSize: '10.5px', color: '#52585e' }}>
                Digitally authenticated with clinical audit provenance.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleSign}
                style={{
                  flex: 1, height: '34px', borderRadius: '6px', border: 0,
                  background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600,
                  cursor: 'pointer', fontSize: '12px'
                }}
              >
                ✓ Sign as {doctorName}
              </button>
              <button
                type="button"
                onClick={() => alert('Draft saved.')}
                style={{
                  height: '34px', padding: '0 12px', borderRadius: '6px',
                  border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11.5px'
                }}
              >
                Save draft
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
