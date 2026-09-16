import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { radiologyApi } from '../services/radiologyApi';
import { PageHeading, SummaryCards, StudyTable, Toolbar, Loading, ErrorBox, Card, InfoRow, btn, primaryBtn } from './RadiologyShared';

const POLL_MS = 5000;

export default function DiagnosticsView({ onOpenRadiologyStudy }) {
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
      const hay = [s.display_study_id, s.study_id, s.source_filename, meta.patient_id, meta.patient_name, meta.modality, status].join(' ').toLowerCase();
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
      {selected && <DiagnosticsDetail study={data.studies.find(s => s.study_id === selected)} onOpen={() => open(selected)} onClose={() => setSelected(null)} />}
    </>}
  </div>;
}

function DiagnosticsDetail({ study, onOpen, onClose }) {
  if (!study) return null;
  const meta = study.metadata || {};
  return <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,.42)', display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 92vw)', height: '100%', background: '#fff', boxShadow: '-8px 0 30px rgba(0,0,0,.14)', padding: 18, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div><div style={{ fontSize: 16, fontWeight: 650 }}>Diagnostic Study</div><div style={{ fontSize: 10.5, color: '#7b8288' }}>{study.display_study_id || study.study_id}</div></div><button type="button" style={btn} onClick={onClose}>Close</button></div>
      <Card><InfoRow label="Study ID" value={study.display_study_id || study.study_id} /><InfoRow label="Patient" value={meta.patient_name || meta.PatientName || meta.patient_id || meta.PatientID || 'DICOM patient'} /><InfoRow label="Patient ID" value={meta.patient_id || meta.PatientID || '—'} /><InfoRow label="Modality" value={meta.modality || meta.Modality || '—'} /><InfoRow label="Study status" value="AI analysis complete" /><InfoRow label="AI processing status" value="DenseNet121 + YOLO11n complete" /><InfoRow label="AI triage status" value={study.combined_assessment?.status} /><InfoRow label="Radiologist review status" value={study.review_status || (study.viewed ? 'Viewed' : 'Unread')} /></Card>
      <Card style={{ marginTop: 10, background: '#fffdf7' }}><b style={{ fontSize: 12 }}>Shared result</b><div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 6 }}>This Diagnostic record points to the same stored Radiology study/result. Navigation to Radiology does not trigger another inference.</div><div style={{ marginTop: 9 }}><button type="button" style={primaryBtn} onClick={onOpen}>Open in Radiology</button></div></Card>
    </div>
  </div>;
}
