import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { radiologyApi } from '../services/radiologyApi';
import { PageHeading, Toolbar, Loading, ErrorBox, Card, StatusBadge, btn, primaryBtn, cell } from './RadiologyShared';

const POLL_MS = 5000;

export default function ResultsCriticalValuesView({ onOpenRadiologyStudy }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('default');

  const refresh = useCallback(async () => {
    try { setData(await radiologyApi.getWorklist()); setError(''); }
    catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const attention = useMemo(() => {
    let rows = (data?.studies || []).filter(s => s.combined_assessment?.status !== 'ROUTINE');
    const q = query.trim().toLowerCase();
    rows = rows.filter(s => {
      const status = s.combined_assessment?.status || '';
      const meta = s.metadata || {};
      const hay = [s.display_study_id, s.study_id, s.source_filename, meta.patient_id, meta.patient_name, meta.modality, status, s.combined_assessment?.reason].join(' ').toLowerCase();
      return (filter === 'All' || status === filter) && (!q || hay.includes(q));
    });
    if (sort === 'probability') rows.sort((a, b) => (b.triage?.probability || 0) - (a.triage?.probability || 0));
    else if (sort === 'oldest') rows.sort((a, b) => new Date(a.analyzed_at || 0) - new Date(b.analyzed_at || 0));
    else if (sort === 'newest') rows.sort((a, b) => new Date(b.analyzed_at || 0) - new Date(a.analyzed_at || 0));
    return rows;
  }, [data, filter, query, sort]);

  return <div>
    <PageHeading crumb="Results & Critical Values" title="Results & Critical Values" subtitle="Radiology AI attention items are decision-support notifications, not confirmed clinical critical results" />
    <Card style={{ marginBottom: 12, background: '#fffdf7' }}><div style={{ fontSize: 11.5, lineHeight: 1.5 }}><b>Radiology AI Attention Flags</b> surface the same stored HIGH PRIORITY and REVIEW FLAG studies produced by the Radiology AI pipeline. No model is run on this page.</div></Card>
    {error ? <ErrorBox error={error} /> : !data ? <Loading /> : <>
      <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={sortValue => setSort(sortValue)} onRefresh={refresh} />
      <Card style={{ padding: 0, overflow: 'hidden' }}><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}><thead><tr style={{ background: '#f6f7f8', textAlign: 'left' }}>{['Attention', 'Study / Patient', 'Reason', 'State', 'Action'].map(h => <th key={h} style={{ padding: 10, borderBottom: '1px solid #e3e6e8' }}>{h}</th>)}</tr></thead><tbody>
        {attention.map(s => <tr key={s.study_id}><td style={cell}><StatusBadge status={s.combined_assessment.status} /></td><td style={cell}><b>{s.display_study_id || s.study_id.slice(0, 12)}</b><div style={{ fontSize: 10, color: '#7b8288' }}>{s.metadata?.patient_name || s.metadata?.patient_id || s.source_filename || 'DICOM study'}</div></td><td style={cell}><div>Suspected lung opacity</div><div style={{ fontSize: 10.5, color: '#697077', marginTop: 3 }}>{s.combined_assessment.reason}</div></td><td style={cell}>{s.review_status || (s.viewed ? 'Reviewed' : 'Awaiting review')}</td><td style={cell}><button type="button" style={primaryBtn} onClick={() => onOpenRadiologyStudy(s.study_id)}>Review in Radiology</button></td></tr>)}
        {!attention.length && <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: '#8a9096' }}>No radiology AI attention flags.</td></tr>}
      </tbody></table></div></Card>
    </>}
  </div>;
}
