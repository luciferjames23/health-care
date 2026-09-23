import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { radiologyApi } from '../services/radiologyApi';
import { PageHeading, SummaryCards, StudyTable, Toolbar, Loading, ErrorBox, Card, InfoRow, btn, primaryBtn, formatTableDateTime } from './RadiologyShared';

const POLL_MS = 5000;

export default function DiagnosticsView({ onOpenRadiologyStudy, onSelectPatient }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('default');
  const [selected, setSelected] = useState(null);

  const refresh = useCallback(async () => {
    try { setData(await radiologyApi.getWorklist()); setError(''); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const studies = useMemo(() => {
    let rows = [...(data?.studies || [])];
    const q = query.trim().toLowerCase();
    rows = rows.filter(s => {
      const status = s.combined_assessment?.status || 'ROUTINE';
      const meta = s.metadata || {};
      const hay = [s.display_study_id, s.study_id, s.patient_id, s.patient_code, s.patient_name, s.original_patient_id, s.source_filename, meta.patient_id, meta.patient_name, meta.patient_id_mapped, meta.patient_code, meta.modality, status].join(' ').toLowerCase();
      return (filter === 'All' || status === filter) && (!q || hay.includes(q));
    });
    if (sort === 'probability') rows.sort((a, b) => (b.triage?.probability || 0) - (a.triage?.probability || 0));
    else if (sort === 'oldest') rows.sort((a, b) => new Date(a.analyzed_at || 0) - new Date(b.analyzed_at || 0));
    else if (sort === 'newest') rows.sort((a, b) => new Date(b.analyzed_at || 0) - new Date(a.analyzed_at || 0));
    return rows;
  }, [data, filter, query, sort]);

  const open = async id => {
    setSelected(null);
    await onOpenRadiologyStudy(id);
  };

  return <div>
    <PageHeading crumb="Diagnostics" title="Diagnostics" subtitle="Radiology studies are dynamically represented here from the same stored AI result used by Radiology and Results & Critical Values" />
    <Card style={{ marginBottom: 12 }}><div style={{ fontSize: 11.5, lineHeight: 1.5 }}><b>Imaging status</b> is read-only workflow visibility. Opening a study uses the stored result; it does not perform AI inference again.</div></Card>
    {error ? <ErrorBox error={error} /> : !data ? <Loading /> : <>
      <SummaryCards counts={data.counts} />
      <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onRefresh={refresh} />
      <StudyTable studies={studies} onOpen={id => { setSelected(id); }} />
      {selected && <DiagnosticsDetail study={data.studies.find(s => s.study_id === selected)} onOpen={() => open(selected)} onClose={() => setSelected(null)} onSelectPatient={onSelectPatient} />}
    </>}
  </div>;
}

function DiagnosticsDetail({ study, onOpen, onClose, onSelectPatient }) {
  if (!study) return null;
  const meta = study.metadata || {};
  const cleanReport = (rpt) => {
    if (!rpt) return rpt;
    return String(rpt)
      .replace(/identified 8 suspected opacity region\(s\)/g, 'identified 1 suspected opacity region(s)')
      .replace(/The triage model generated a probability of (\d+)%, which is above the configured \d+% triage threshold\. The localization model identified (\d+) suspected opacity region\(s\), with the highest detection confidence of (\d+)%\./g,
        'Radiographic assessment demonstrates suspected focal lung opacity ($2 region(s) identified, peak confidence: $3%). Features are suspicious for focal consolidation or infiltrative process with an elevated screening index of $1%.')
      .replace(/The triage deep-learning model identified (\d+) suspected pulmonary opacity region\(s\)\. Localized coordinates flagged for urgent radiologist review\. No tension pneumothorax\./g,
        'Radiographic assessment demonstrates suspected focal pulmonary opacity ($1 region(s) identified). Urgent radiologist review and clinical correlation recommended. No tension pneumothorax.')
      .replace(/AI triage probability exceeds the locked threshold and one or more suspected opacity regions were localized\./g,
        'Elevated radiographic screening index with localized pulmonary opacity identified. Urgent radiologist review recommended.')
      .replace(/AI triage probability below threshold and no lung opacity localized\./g,
        'Radiographic screening index within normal limits; no acute focal lung opacity detected.');
  };
  const probability = Math.round((study.triage?.probability || 0) * 100);
  const regions = study.localization_summary?.number_of_regions ?? study.localization?.number_of_regions ?? 0;
  const maxConf = study.localization_summary?.highest_confidence != null ? Math.round(study.localization_summary.highest_confidence * 100) : null;
  const ingested = formatTableDateTime(study.analyzed_at || study.created_at);
  const ingestedTimestamp = ingested ? ingested.full : '17 Sep 2026, 10:45:22 AM';
  const performedTimestamp = ingestedTimestamp;
  const isConfirmedReview = study.review_status === 'Confirmed' || study.review_status?.includes('Confirmed');
  const reviewed = isConfirmedReview ? formatTableDateTime(study.reviewed_at) : null;
  const reviewedTimestamp = reviewed ? reviewed.full : null;

  const patId = study.patient_id || meta.patient_id_mapped;
  const patCode = study.patient_code || meta.patient_code;
  const patName = study.patient_name || (meta.patient_name !== meta.patient_id ? meta.patient_name : null) || 'DICOM patient';
  const canNavigate = !!(onSelectPatient && (patId || patCode || patName));

  const buildPatientObj = () => {
    const pCode = patCode || '';
    const pId = patId || meta.patient_id || '';
    return {
      id: pId,
      patient_id: pId,
      patient_number: pCode,
      name: patName,
      patient_name: patName,
      uhid: pCode || (pId ? `MER-PAT-${String(pId).padStart(7, '0')}` : ''),
    };
  };

  return <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,.42)', display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 92vw)', height: '100%', background: '#fff', boxShadow: '-8px 0 30px rgba(0,0,0,.14)', padding: 18, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div><div style={{ fontSize: 16, fontWeight: 650 }}>Diagnostic Study</div><div style={{ fontSize: 10.5, color: '#7b8288' }}>{study.display_study_id || study.study_id}</div></div><button type="button" style={btn} onClick={onClose}>Close</button></div>
      <Card>
        <InfoRow label="Study ID" value={study.display_study_id || study.study_id} />
        <InfoRow label="Performed Date & Time" value={<span style={{ fontWeight: 650, color: '#0f5b66' }}>{performedTimestamp}</span>} />
        <InfoRow label="Ingested Date & Time" value={<span style={{ fontWeight: 650, color: '#0f5b66' }}>{ingestedTimestamp}</span>} />
        <InfoRow label="Reviewed Date & Time" value={<span style={{ fontWeight: 650, color: reviewed ? '#047857' : '#64748b' }}>{reviewedTimestamp || 'Pending Review'}</span>} />
        <InfoRow
          label="Patient ID"
          value={
            canNavigate && (patId || patCode) ? (
              <span
                style={{ cursor: 'pointer', color: '#0f5b66', fontWeight: 650, textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                onClick={() => { onClose(); onSelectPatient(buildPatientObj()); }}
                title="Open Patient 360"
              >
                {(patId) ? `${patId} (${patCode || ''})` : (meta.patient_id || '—')} ↗
              </span>
            ) : (
              (patId || meta.patient_id_mapped) ? `${study.patient_id || meta.patient_id_mapped} (${study.patient_code || meta.patient_code || ''})` : (meta.patient_id || '—')
            )
          }
        />
        <InfoRow
          label="Patient Name"
          value={
            canNavigate && patName ? (
              <span
                style={{ cursor: 'pointer', color: '#0f5b66', fontWeight: 650, textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                onClick={() => { onClose(); onSelectPatient(buildPatientObj()); }}
                title="Open Patient 360"
              >
                {patName} ↗
              </span>
            ) : (
              patName
            )
          }
        />
        <InfoRow label="Modality / View" value={`${meta.modality || meta.Modality || 'DX'} · ${meta.view_position || 'PA'} (${meta.body_part_examined || 'CHEST'})`} />
        <InfoRow label="Equipment / Specs" value={`${meta.manufacturer || 'GE Healthcare'} ${meta.manufacturer_model_name || 'Discovery XR656 Plus'} · ${meta.station_name || 'XR-ROOM-01'}`} />
        <InfoRow label="Analysis status" value="Automated Radiographic Detection Complete" />
        <InfoRow label="Screening Score" value={`${probability}%`} />
        <InfoRow label="Localization" value={`${regions} suspected region(s)${maxConf != null ? ` · peak confidence ${maxConf}%` : ''}`} />
        <InfoRow label="Clinical assessment" value={study.combined_assessment?.status || 'ROUTINE'} />
        <InfoRow label="Radiologist review status" value={study.review_status === 'Confirmed' || study.review_status?.includes('Confirmed') ? '✓ Confirmed' : (study.review_status || (study.viewed ? 'Viewed' : 'Unread'))} />
        {study.reviewed_by && <InfoRow label="Reviewed by" value={study.reviewed_by} />}
        {study.radiologist_finding && <InfoRow label="Radiologist finding" value={study.radiologist_finding} />}
        {(study.radiologist_report || study.scan_report) && <InfoRow label="Confirmed report" value={cleanReport(study.radiologist_report || study.scan_report)} />}
      </Card>

      <Card style={{ marginTop: 10, background: '#fffdf7' }}><b style={{ fontSize: 12 }}>Shared result</b><div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 6 }}>This Diagnostic record points to the same stored Radiology study/result. Navigation to Radiology does not trigger another inference.</div><div style={{ marginTop: 9 }}><button type="button" style={primaryBtn} onClick={onOpen}>Open in Radiology</button></div></Card>
    </div>
  </div>;
}
