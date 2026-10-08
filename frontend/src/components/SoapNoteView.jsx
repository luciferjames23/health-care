import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';

const vitalFindingLabels = {
  TEMPERATURE: 'Temperature', BLOOD_PRESSURE: 'Blood pressure',
  PULSE: 'Pulse', SPO2: 'Oxygen saturation'
};

function formatVitalFinding(action) {
  if (action.finding_type === 'BLOOD_PRESSURE') return `${action.systolic}/${action.diastolic} ${action.unit || 'mmHg'}`;
  if (action.finding_type === 'TEMPERATURE') return action.unit ? `${action.value} \u00b0${action.unit}` : `${action.value} (unit not stated)`;
  if (action.finding_type === 'PULSE') return `${action.value} ${action.unit || 'bpm'}`;
  if (action.finding_type === 'SPO2') return `${action.value}${action.unit || '%'}`;
  return null;
}

export default function SoapNoteView({ patient, doctorName = 'Dr. Arjun Menon', currentUser, onBack, onOpenPatient }) {
  const [lang, setLang] = useState('EN'); // 'EN' | 'TA'
  const [recState, setRecState] = useState('idle'); // idle | recording | transcribing | done
  const [recSeconds, setRecSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [aiDraft, setAiDraft] = useState(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [activeNote, setActiveNote] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clinicalValidation, setClinicalValidation] = useState(null);
  const [clinicalValidationPending, setClinicalValidationPending] = useState(false);
  const [clinicalActions, setClinicalActions] = useState([]);
  const [selectedActionIds, setSelectedActionIds] = useState([]);
  const [actionDrafts, setActionDrafts] = useState({});
  const [actionOutcomes, setActionOutcomes] = useState({});
  const [actionBusy, setActionBusy] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [readOnlyHistory, setReadOnlyHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [visitChoices, setVisitChoices] = useState([]);
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const noteIdRef = useRef(null);
  const clinicalValidationRequestRef = useRef(0);
  const visitId = selectedVisitId || patient?.visit_id || patient?.raw?.visit_id || patient?.visitId || activeNote?.visit_id;
  const admissionId = patient?.admission_id || patient?.raw?.admission_id || patient?.admission?.admission_id || null;
  const patientId = patient?.patient_id || patient?.raw?.patient_id || patient?.id;

  useEffect(() => {
    const noteId = activeNote?.soap_note_id;
    if (!noteId) { setClinicalActions([]); setSelectedActionIds([]); return; }
    let cancelled = false;
    apiService.getSoapActions(noteId).then(result => {
      if (!cancelled) setClinicalActions(result.actions || []);
    }).catch(err => {
      if (!cancelled) setError(err.message || 'Unable to load clinical actions.');
    });
    return () => { cancelled = true; };
  }, [activeNote?.soap_note_id, activeNote?.status, activeNote?.updated_at, transcript]);

  const handleDetectActions = async () => {
    const noteId = activeNote?.soap_note_id;
    if (!noteId || actionBusy || isSigned || readOnlyHistory) return;
    setActionBusy(true); setError('');
    try {
      const result = await apiService.detectSoapActions(noteId);
      setClinicalActions(result.actions || []); setSelectedActionIds([]);
    } catch (err) { setError(err.message || 'Clinical action detection failed.'); }
    finally { setActionBusy(false); }
  };

  const handlePatchAction = async (actionId) => {
    setActionBusy(true); setError('');
    try {
      const updated = await apiService.updateSoapAction(actionId, actionDrafts[actionId] || {});
      setClinicalActions(rows => rows.map(row => row.action_id === actionId ? updated : row));
      setActionDrafts(rows => { const next = { ...rows }; delete next[actionId]; return next; });
    } catch (err) { setError(err.message || 'Unable to save action changes.'); }
    finally { setActionBusy(false); }
  };

  const handleConfirmActions = async () => {
    const noteId = activeNote?.soap_note_id;
    if (!noteId || !selectedActionIds.length || actionBusy) return;
    setActionBusy(true); setError('');
    try {
      const result = await apiService.confirmSoapActions(noteId, selectedActionIds);
      const resolved = new Map((result.results || []).filter(item => item.success).map(item => [item.action_id, item.action]));
      setActionOutcomes(Object.fromEntries((result.results || []).filter(item => !item.success).map(item => [item.action_id, item.error || 'Confirmation failed.'])));
      setClinicalActions(rows => rows.map(row => resolved.get(row.action_id) || row));
      setSelectedActionIds([]);
    } catch (err) { setError(err.message || 'Unable to confirm selected actions.'); }
    finally { setActionBusy(false); }
  };

  const handleRejectAction = async (actionId) => {
    setActionBusy(true); setError('');
    try {
      const updated = await apiService.rejectSoapAction(actionId);
      setClinicalActions(rows => rows.map(row => row.action_id === actionId ? updated : row));
      setSelectedActionIds(ids => ids.filter(id => id !== actionId));
    } catch (err) { setError(err.message || 'Unable to reject action.'); }
    finally { setActionBusy(false); }
  };

  const handleRetryDispatch = async () => {
    const noteId = activeNote?.soap_note_id;
    if (!noteId || actionBusy || !isSigned) return;
    setActionBusy(true); setError('');
    try {
      const result = await apiService.dispatchSoapActions(noteId);
      const latest = await apiService.getSoapActions(noteId);
      setClinicalActions(latest.actions || []);
      const failures = (result.results || []).filter(item => item.outcome === 'FAILED');
      if (failures.length) setError(failures.map(item => item.error).join('; '));
    } catch (err) { setError(err.message || 'Unable to retry clinical action dispatch.'); }
    finally { setActionBusy(false); }
  };

  // Clinical record form fields initialized dynamically based on selected patient
  const [soapFields, setSoapFields] = useState(() => {
    if (!patient) {
      return { s: '', o: '', a: '', p: '' };
    }
    const pName = patient.name || patient.patient_name || patient.patient || 'Patient';
    return { s: '', o: '', a: '', p: '' };
  });

  useEffect(() => {
    async function loadDbDrafts() {
      if (!patientId) {
        setError('Patient context is missing a patient_id.'); setHistory([]); setSoapFields({ s: '', o: '', a: '', p: '' });
        return;
      }
      try {
        let resolvedVisitId = visitId;
        let resolvedAdmissionId = admissionId;
        const details = await apiService.getSoapVisitContext(patientId);
        const visits = details?.visits || [];
        const admissions = details?.admissions || [];
        if (!resolvedVisitId) {
          const fromAdmission = resolvedAdmissionId && admissions.find(a => String(a.admission_id) === String(resolvedAdmissionId))?.visit_id;
          if (fromAdmission) resolvedVisitId = fromAdmission;
          else if (visits.length === 1) resolvedVisitId = visits[0].visit_id;
          else if (visits.length > 1) { setVisitChoices(visits); setError('Select the specific visit for this SOAP note.'); return; }
        }
        if (!resolvedVisitId) { setError('No explicit visit is linked to this patient context. Saving and signing are disabled.'); return; }
        const matchingVisit = visits.find(v => String(v.visit_id) === String(resolvedVisitId));
        if (!matchingVisit || String(matchingVisit.patient_id) !== String(patientId)) {
          setError('The selected visit does not belong to this patient.'); return;
        }
        let linkedAdmission = null;
        if (resolvedAdmissionId) {
          linkedAdmission = admissions.find(a => String(a.admission_id) === String(resolvedAdmissionId));
          if (!linkedAdmission || String(linkedAdmission.patient_id) !== String(patientId) || String(linkedAdmission.visit_id) !== String(resolvedVisitId)) {
            setError('The selected admission does not belong to this patient and visit.'); return;
          }
        } else {
          linkedAdmission = admissions.find(a => String(a.patient_id) === String(patientId) && String(a.visit_id) === String(resolvedVisitId)) || null;
          resolvedAdmissionId = linkedAdmission?.admission_id || null;
        }
        if (String(selectedVisitId || '') !== String(resolvedVisitId)) setSelectedVisitId(Number(resolvedVisitId));
        setError('');
        const res = await apiService.getSoapNotes({ patient_id: patientId });
        setHistory(res?.notes || []);
        const mine = await apiService.getSoapNotes({ patient_id: patientId, visit_id: resolvedVisitId, mine: true });
        const selectedHistoryNote = patient?.soap_note_id ? await apiService.getSoapNote(patient.soap_note_id) : null;
        const match = selectedHistoryNote || (mine?.notes || []).find(n => n.status === 'DRAFT');
        if (match) {
          noteIdRef.current = match.status === 'DRAFT' ? match.soap_note_id : null; setActiveNote(match);
          setIsSigned(match.status !== 'DRAFT'); setReadOnlyHistory(Boolean(patient?.soap_note_id) && match.status !== 'DRAFT');
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
          if (match.ai_draft) setAiDraft({ s: match.ai_draft.subjective || '', o: match.ai_draft.objective || '', a: match.ai_draft.assessment || '', p: match.ai_draft.plan || '' });
        } else {
          const created = await apiService.createSoapNote({ patient_id: Number(patientId), visit_id: Number(resolvedVisitId), admission_id: resolvedAdmissionId ? Number(resolvedAdmissionId) : null, source: 'VOICE' });
          noteIdRef.current = created.soap_note_id; setActiveNote(created); setIsSigned(false); setReadOnlyHistory(false);
          setSoapFields({ s: '', o: '', a: '', p: '' }); setTranscript(''); setRecState('idle');
        }
      } catch (err) {
        setError(err.message || 'Unable to load SOAP history.');
      }
    }
    loadDbDrafts();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    };
  }, [patientId, visitId, admissionId, selectedVisitId, currentUser?.user_id, patient?.soap_note_id]);

  useEffect(() => {
    const noteId = noteIdRef.current;
    if (!noteId || activeNote?.status !== 'DRAFT' || !transcript.trim()) {
      clinicalValidationRequestRef.current += 1;
      setClinicalValidation(null);
      setClinicalValidationPending(false);
      return undefined;
    }
    const requestId = ++clinicalValidationRequestRef.current;
    setClinicalValidationPending(true);
    const timer = setTimeout(async () => {
      try {
        const validation = await apiService.validateSoapClinicalRecord(noteId, {
          subjective: soapFields.s,
          objective: soapFields.o,
          assessment: soapFields.a,
          plan: soapFields.p,
        });
        if (requestId === clinicalValidationRequestRef.current) setClinicalValidation(validation);
      } catch (err) {
        if (requestId === clinicalValidationRequestRef.current) {
          setClinicalValidation(null);
          setError(err.message || 'Clinical validation failed.');
        }
      } finally {
        if (requestId === clinicalValidationRequestRef.current) setClinicalValidationPending(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [activeNote?.soap_note_id, activeNote?.status, transcript, aiDraft, soapFields]);

  const handleStartRec = async () => {
    try {
      setError('');
      if (!noteIdRef.current) throw new Error('A SOAP draft for a specific visit is required before recording.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream); mediaRecorderRef.current = recorder; audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data?.size) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (!audioChunksRef.current.length) { setError('No audio was recorded. Please try again.'); setRecState('idle'); return; }
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecState('transcribing');
        try {
          const result = await apiService.transcribeSoapAudio(noteIdRef.current, blob, lang === 'TA' ? 'tamil' : lang === 'MIXED' ? 'auto' : 'english');
          setTranscript(result.transcript || ''); setRecState('done'); setActiveNote(result.note);
        } catch (err) { setError(err.message || 'Transcription failed.'); setRecState('idle'); }
      };
      recorder.onerror = () => { setError('Microphone recording failed.'); setRecState('idle'); };
      recorder.start(); setRecSeconds(0); setRecState('recording');
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'Microphone access was denied.' : err.message || 'Unable to start recording.'); setRecState('idle');
    }
  };
  const handleStopRec = () => {
    if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  const handleGenDraft = async () => {
    if (isDrafting || !transcript.trim() || !noteIdRef.current) return;
    setIsDrafting(true); setError('');
    try {
      const result = await apiService.generateSoapDraft(noteIdRef.current);
      setAiDraft({ s: result.soap.subjective, o: result.soap.objective, a: result.soap.assessment, p: result.soap.plan }); setActiveNote(result.note);
    } catch (err) { setError(err.message || 'SOAP generation failed.'); }
    finally { setIsDrafting(false); }
  };

  const handleApplyDraft = () => {
    if (aiDraft) {
      setSoapFields(aiDraft);
      apiService.soapEvent(noteIdRef.current, 'loaded-for-review').catch(err => setError(err.message));
    }
  };

  const handleNewNote = async () => {
    if (!patientId || !visitId || busy) return;
    setBusy(true); setError('');
    try {
      const linkedAdmissionId = admissionId || activeNote?.admission_id;
      const created = await apiService.createSoapNote({ patient_id: Number(patientId), visit_id: Number(visitId), admission_id: linkedAdmissionId ? Number(linkedAdmissionId) : null, source: 'VOICE' });
      noteIdRef.current = created.soap_note_id; setActiveNote(created); setIsSigned(false); setReadOnlyHistory(false); setAmendmentMode(false);
      setSoapFields({ s: '', o: '', a: '', p: '' }); setTranscript(''); setAiDraft(null); setRecState('idle');
      setHistory(prev => [created, ...prev]);
    } catch (err) { setError(err.message || 'Unable to create a new SOAP note.'); }
    finally { setBusy(false); }
  };

  const [signedAt, setSignedAt] = useState('');
  const [amendmentMode, setAmendmentMode] = useState(false);
  const handleSaveDraft = async () => {
    if (busy || !noteIdRef.current) return;
    setBusy(true); setError('');
    try {
      const saved = await apiService.updateSoapNote(noteIdRef.current, { subjective: soapFields.s, objective: soapFields.o, assessment: soapFields.a, plan: soapFields.p, dictation_language: lang });
      await apiService.soapEvent(saved.soap_note_id, 'saved');
      setActiveNote(saved); setHistory(prev => [saved, ...prev.filter(n => n.soap_note_id !== saved.soap_note_id)]);
    } catch (err) { setError(err.message || 'Draft save failed.'); }
    finally { setBusy(false); }
  };
  const handleSign = async () => {
    if (busy || !noteIdRef.current) return;
    setBusy(true); setError('');
    try {
      const saved = await apiService.updateSoapNote(noteIdRef.current, { subjective: soapFields.s, objective: soapFields.o, assessment: soapFields.a, plan: soapFields.p, dictation_language: lang });
      const signed = await apiService.signSoapNote(saved.soap_note_id);
      noteIdRef.current = null; setActiveNote(signed); setIsSigned(true); setReadOnlyHistory(false);
      const dispatchFailures = (signed.action_dispatch?.results || []).filter(item => item.outcome === 'FAILED');
      if (signed.action_dispatch?.error) setError(`SOAP signed; action dispatch needs retry: ${signed.action_dispatch.error}`);
      else if (dispatchFailures.length) setError(`SOAP signed; ${dispatchFailures.length} clinical action(s) failed to dispatch. See action details.`);
      setSignedAt(new Date(signed.signed_at).toLocaleString());
      setHistory(prev => [signed, ...prev.filter(n => n.soap_note_id !== signed.soap_note_id)]);
    } catch (err) { setError(err.message || 'Signing failed.'); }
    finally { setBusy(false); }
  };
  const handleResolveClinicalMismatch = async () => {
    if (busy || !noteIdRef.current || !clinicalValidation?.can_resolve) return;
    setBusy(true); setError('');
    try {
      const result = await apiService.resolveSoapClinicalMismatch(noteIdRef.current, {
        subjective: soapFields.s,
        objective: soapFields.o,
        assessment: soapFields.a,
        plan: soapFields.p,
      });
      setActiveNote(result.note);
      setClinicalValidation(result.validation);
    } catch (err) { setError(err.message || 'Clinical mismatch resolution failed.'); }
    finally { setBusy(false); }
  };
  const handleSaveAmendment = async () => {
    if (busy || !activeNote?.soap_note_id) return;
    setBusy(true); setError('');
    try {
      const amended = await apiService.amendSoapNote(activeNote.soap_note_id, { subjective: soapFields.s, objective: soapFields.o, assessment: soapFields.a, plan: soapFields.p, dictation_language: lang });
      setActiveNote(amended); setHistory(prev => [amended, ...prev]); setAmendmentMode(false); setIsSigned(true); setReadOnlyHistory(false); setSignedAt(new Date(amended.signed_at).toLocaleString());
    } catch (err) { setError(err.message || 'Amendment failed.'); }
    finally { setBusy(false); }
  };
  const loadHistoryNote = async entry => {
    try {
      const full = await apiService.getSoapNote(entry.soap_note_id);
      noteIdRef.current = full.status === 'DRAFT' ? full.soap_note_id : null;
      setActiveNote(full); setIsSigned(full.status !== 'DRAFT'); setReadOnlyHistory(full.status !== 'DRAFT');
      setSignedAt(full.signed_at ? new Date(full.signed_at).toLocaleString() : '');
      setSoapFields({ s: full.subjective || '', o: full.objective || '', a: full.assessment || '', p: full.plan || '' });
      setTranscript(full.raw_transcript || ''); setHistoryOpen(false);
    } catch (err) { setError(err.message || 'Unable to load SOAP history item.'); }
  };

  const pName = patient?.name || patient?.patient_name || patient?.patient || 'Patient';
  const rawBed = patient?.bed_number || patient?.bed || 'BED-0193';
  const isSyntheticBed = typeof rawBed === 'string' && /^bed \d+$/i.test(rawBed.trim());
  const pBed = (!isSyntheticBed && rawBed) ? (rawBed.startsWith('BED-') ? rawBed : (rawBed.toLowerCase().startsWith('bed') ? rawBed : `Bed ${rawBed}`)) : 'BED-0193';
  const pMrn = patient?.uhid || patient?.patient_number || patient?.mrn || (patient?.patient_id ? `MER-PAT-${String(patient.patient_id).padStart(7, '0')}` : 'MER-PAT-0000001');
  const pEncounter = patient?.encounter || (patient?.admission_number ? `ENC-${patient.admission_number}` : (patient?.admission_id ? `ENC-MER-ADM-${String(patient.admission_id).padStart(7, '0')}` : 'ENC-ADM-0000001'));
  const attendingDoc = doctorName || patient?.doctor || 'Attending Physician';
  const clinicalSignBlocked = Boolean(transcript.trim() && (
    clinicalValidationPending || !clinicalValidation || clinicalValidation.final_has_mismatch ||
    (clinicalValidation.has_mismatch && !clinicalValidation.reviewed)
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Navigation Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#687076' }}>
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
            {visitChoices.length > 1 && <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>Visit
              <select value={selectedVisitId || ''} onChange={e => { setSelectedVisitId(e.target.value); setVisitChoices([]); }}>
                <option value="">Select visit</option>
                {visitChoices.map(v => <option key={v.visit_id} value={v.visit_id}>Visit {v.visit_id} ? {v.visit_type || 'Consultation'} ? {v.visit_date || ''}</option>)}
              </select>
            </label>}
            <button type="button" onClick={() => setHistoryOpen(v => !v)} style={{ height: '30px', padding: '0 10px', border: '1px solid #e3e6e8', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>
              {historyOpen ? 'Hide SOAP history' : `SOAP history (${history.length})`}
            </button>
            <button type="button" onClick={handleNewNote} disabled={busy || !visitId} style={{ height: '30px', padding: '0 10px', border: '1px solid #e3e6e8', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>New SOAP note</button>
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

      {error && <div role="alert" style={{ padding: '10px 12px', border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '12px' }}>{error}</div>}
      {historyOpen && <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
        <strong style={{ fontSize: '13px' }}>Previous SOAP notes for this patient</strong>
        {history.length ? history.map(entry => <div key={entry.soap_note_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid #eef0f2', fontSize: '12px' }}>
          <span>{new Date(entry.signed_at || entry.created_at).toLocaleString()} · Visit {entry.visit_id}{entry.admission_id ? ` · Admission ${entry.admission_id}` : ''} · {entry.author_name} · {entry.status}<br/>{entry.assessment || 'No assessment recorded'}{entry.parent_note_id ? ` · Amendment v${entry.version}` : ''}</span>
          <button type="button" onClick={() => loadHistoryNote(entry)}>View</button>
        </div>) : <p>No previous notes for this visit.</p>}
      </div>}
      {!visitId && <div role="alert" style={{ padding: '10px 12px', border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', borderRadius: '6px', fontSize: '12px' }}>An explicit visit_id is required. Saving and signing are disabled until the patient is opened from a specific visit.</div>}
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
                Click to record clinical encounter or consultation notes. Audio is sent securely for transcription after you stop recording.
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
                <span style={{ fontWeight: 600, fontSize: '12px' }}>🔴 Recording — {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:{String(recSeconds % 60).padStart(2, '0')}</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px' }}>Listening...</span>
              </div>
              <button type="button" onClick={handleStopRec} style={{ height: '34px', border: 0, borderRadius: '6px', background: '#b91c1c', color: '#fff' }}>Stop recording</button>
            </div>
          )}

          {recState === 'transcribing' && <div role="status" style={{ padding: '12px', color: '#52585e' }}>Transcribing audio?</div>}
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
                  disabled={isDrafting || !transcript.trim() || !noteIdRef.current}
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

          <section aria-label="Clinical Actions Detected" style={{ border: '1px solid #e3e6e8', borderRadius: '6px', padding: '9px', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong>Clinical Actions Detected ({clinicalActions.length})</strong>
            <button type="button" onClick={handleDetectActions} disabled={!transcript.trim() || !aiDraft || actionBusy || isSigned || readOnlyHistory} style={{ marginLeft: 'auto' }}>
                {actionBusy ? 'Working…' : 'Detect actions'}
              </button>
            </div>
            {!clinicalActions.length && <div style={{ color: '#737b82', marginTop: '6px' }}>Detect actions after reviewing the transcript and SOAP draft.</div>}
            {!!clinicalActions.length && <>
              <div style={{ display: 'flex', gap: '6px', margin: '7px 0' }}>
              <button type="button" onClick={handleConfirmActions} disabled={!selectedActionIds.length || actionBusy || isSigned || readOnlyHistory}>Confirm selected</button>
                {isSigned && clinicalActions.some(action => action.status === 'FAILED') && <button type="button" onClick={handleRetryDispatch} disabled={actionBusy}>Retry dispatch</button>}
                <span style={{ alignSelf: 'center', color: '#737b82' }}>Confirmation records review status only.</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                {clinicalActions.map(action => {
                  const unresolved = ['DETECTED', 'PENDING_CONFIRMATION'].includes(action.status);
                  const canReview = !isSigned && !readOnlyHistory && !action.stale && unresolved;
                  const fields = action.action_type === 'CLINICAL_FINDING' && action.finding_type ? ['finding_type', 'value', 'systolic', 'diastolic', 'unit']
                    : action.action_type === 'MEDICATION_ORDER' ? ['name', 'dose', 'unit', 'route', 'frequency', 'duration']
                    : action.action_type === 'LAB_ORDER' ? ['name', 'code', 'priority']
                      : action.action_type === 'IMAGING_ORDER' ? ['name', 'projection', 'priority', 'clinical_indication']
                        : action.action_type === 'FOLLOW_UP' ? ['duration']
                          : action.action_type === 'DIAGNOSIS_CANDIDATE' ? ['name', 'code'] : ['name'];
                  return <div key={action.action_id} style={{ borderTop: '1px solid #edf0f2', paddingTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input type="checkbox" aria-label={`Select ${action.name}`} checked={selectedActionIds.includes(action.action_id)} disabled={!canReview} onChange={e => setSelectedActionIds(ids => e.target.checked ? [...ids, action.action_id] : ids.filter(id => id !== action.action_id))} />
                      <strong>{vitalFindingLabels[action.finding_type] || action.name}</strong><span style={{ color: '#737b82' }}>· {action.action_type.replaceAll('_', ' ')}</span>
                      <span style={{ marginLeft: 'auto', color: action.stale ? '#b45309' : '#737b82' }}>{action.stale ? 'STALE — re-detect' : action.status}</span>
                    </div>
                    {action.finding_type && <div style={{ fontWeight: 600, margin: '2px 0 3px 22px' }}>{formatVitalFinding(action)}</div>}
                    <div style={{ color: '#737b82', margin: '3px 0' }}>Transcript: {action.source_text}</div>
                    {canReview && <details>
                      <summary style={{ cursor: 'pointer' }}>Edit action details</summary>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '5px' }}>
                        {fields.map(field => <label key={field} style={{ display: 'flex', flexDirection: 'column', minWidth: '90px', flex: '1 1 90px' }}>
                          <span style={{ color: '#737b82', textTransform: 'capitalize' }}>{field}</span>
                          {field === 'projection' ? <select aria-label="Projection/View" value={(actionDrafts[action.action_id] || {})[field] ?? action[field] ?? ''} onChange={e => setActionDrafts(drafts => ({ ...drafts, [action.action_id]: { ...(drafts[action.action_id] || {}), [field]: e.target.value || null } }))}>
                            <option value="">Select projection</option><option value="PA">PA</option><option value="AP">AP</option>
                          </select> : <input type={['dose', 'value', 'systolic', 'diastolic'].includes(field) ? 'number' : 'text'} value={(actionDrafts[action.action_id] || {})[field] ?? action[field] ?? ''} onChange={e => setActionDrafts(drafts => ({ ...drafts, [action.action_id]: { ...(drafts[action.action_id] || {}), [field]: ['dose', 'value', 'systolic', 'diastolic'].includes(field) && e.target.value !== '' ? Number(e.target.value) : e.target.value } }))} />}
                        </label>)}
                        <button type="button" onClick={() => handlePatchAction(action.action_id)} disabled={actionBusy}>Save</button>
                      </div>
                    </details>}
                    {canReview && <button type="button" onClick={() => handleRejectAction(action.action_id)} disabled={actionBusy} style={{ marginTop: '4px' }}>Reject</button>}
                    {actionOutcomes[action.action_id] && <div role="alert" style={{ color: '#991b1b', marginTop: '3px' }}>{actionOutcomes[action.action_id]}</div>}
                    {action.error_message && <div role="status" style={{ color: action.status === 'FAILED' ? '#991b1b' : '#92400e', marginTop: '3px' }}>{action.error_message}</div>}
                  </div>;
                })}
              </div>
            </>}
          </section>

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
              readOnly={(isSigned || readOnlyHistory) && !amendmentMode}
              style={{ border: '1px solid #e3e6e8', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', resize: 'vertical' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096' }}>Objective</span>
            <textarea
              rows={2}
              value={soapFields.o}
              onChange={e => setSoapFields({ ...soapFields, o: e.target.value })}
              readOnly={(isSigned || readOnlyHistory) && !amendmentMode}
              style={{ border: '1px solid #e3e6e8', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', resize: 'vertical' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096' }}>Assessment</span>
            <textarea
              rows={2}
              value={soapFields.a}
              onChange={e => setSoapFields({ ...soapFields, a: e.target.value })}
              readOnly={(isSigned || readOnlyHistory) && !amendmentMode}
              style={{ border: '1px solid #e3e6e8', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', resize: 'vertical' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.04em', color: '#8a9096' }}>Plan</span>
            <textarea
              rows={3}
              value={soapFields.p}
              onChange={e => setSoapFields({ ...soapFields, p: e.target.value })}
              readOnly={(isSigned || readOnlyHistory) && !amendmentMode}
              style={{ border: '1px solid #e3e6e8', borderRadius: '6px', padding: '6px 8px', fontSize: '11.5px', resize: 'vertical' }}
            />
          </label>

          {(clinicalValidation?.final_has_mismatch || (clinicalValidation?.has_mismatch && !clinicalValidation?.reviewed)) && (
            <div role="alert" style={{ padding: '10px 12px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '12px' }}>
              <strong>Clinical review required</strong>
              {(clinicalValidation.mismatches || []).filter(mismatch => clinicalValidation.final_has_mismatch && mismatch.document === 'final_record').map((mismatch, index) => (
                <div key={`${mismatch.document}-${mismatch.entity_type}-${index}`} style={{ marginTop: '8px' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{mismatch.entity_type.replace('_', ' ')} mismatch:</strong>
                  <div>Transcript: {mismatch.missing?.join(', ') || 'none'}</div>
                  <div>Final record: {mismatch.introduced?.join(', ') || 'none'}</div>
                </div>
              ))}
              {!clinicalValidation.final_has_mismatch && <div style={{ marginTop: '7px' }}>The AI draft differs from the transcript. Review the final clinical record and record your review before signing.</div>}
              <div style={{ marginTop: '7px' }}>Resolve before signing.</div>
              {clinicalValidation.can_resolve && !clinicalValidation.reviewed && (
                <button type="button" onClick={handleResolveClinicalMismatch} disabled={busy || clinicalValidationPending} style={{ marginTop: '8px' }}>
                  I reviewed and corrected the clinical record
                </button>
              )}
              {clinicalValidation.reviewed && <div style={{ marginTop: '7px' }}>Clinician review recorded. The final record matches the transcript.</div>}
            </div>
          )}

          {isSigned || readOnlyHistory ? (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px',
              borderRadius: '6px', background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)', fontSize: '11.5px'
            }}>
              <span style={{ fontWeight: 700 }}>✓ Signed by {doctorName} · {signedAt}</span>
              <span style={{ fontSize: '10.5px', color: '#52585e' }}>
                Digitally authenticated with clinical audit provenance.
              </span>
              {!amendmentMode && activeNote?.status !== 'DRAFT' && <button type="button" onClick={() => setAmendmentMode(true)} disabled={busy}>Create amendment</button>}
              {amendmentMode && <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" onClick={handleSaveAmendment} disabled={busy}>{busy ? 'Saving…' : 'Save signed amendment'}</button>
                <button type="button" onClick={() => { setAmendmentMode(false); setSoapFields({ s: activeNote.subjective || '', o: activeNote.objective || '', a: activeNote.assessment || '', p: activeNote.plan || '' }); }}>Cancel</button>
              </div>}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleSign}
                disabled={busy || !visitId || isSigned || clinicalSignBlocked}
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
                onClick={handleSaveDraft}
                disabled={busy || !visitId || isSigned}
                style={{
                  height: '34px', padding: '0 12px', borderRadius: '6px',
                  border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11.5px'
                }}
              >
                {busy ? 'Saving?' : 'Save draft'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
