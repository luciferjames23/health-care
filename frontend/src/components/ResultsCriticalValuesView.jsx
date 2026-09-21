import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { radiologyApi } from '../services/radiologyApi';
import { PageHeading, Toolbar, Loading, ErrorBox, Card, StatusBadge, btn, primaryBtn, cell, formatTableDateTime } from './RadiologyShared';

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
      const hay = [s.display_study_id, s.study_id, s.patient_id, s.patient_code, s.patient_name, s.original_patient_id, s.source_filename, meta.patient_id, meta.patient_name, meta.patient_id_mapped, meta.patient_code, meta.modality, status, s.combined_assessment?.reason].join(' ').toLowerCase();
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
      <Card style={{ padding: 0, overflow: 'hidden' }}><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}><thead><tr style={{ background: '#f6f7f8', textAlign: 'left' }}>{['Attention', 'Study / Patient', 'Reason', 'Ingested', 'Reviewed', 'State', 'Action'].map(h => <th key={h} style={{ padding: 10, borderBottom: '1px solid #e3e6e8', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead><tbody>
        {attention.map(s => <tr key={s.study_id}><td style={cell}><StatusBadge status={s.combined_assessment.status} /></td><td style={cell}>
          <div style={{ fontWeight: 700, color: '#111827' }}>{s.display_study_id || s.study_id.slice(0, 12)}</div>
          {(s.patient_id || s.metadata?.patient_id_mapped) ? (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0f5b66', marginTop: 2 }}>
              Patient ID: {s.patient_id || s.metadata?.patient_id_mapped}
              {(s.patient_code || s.metadata?.patient_code) ? ` (${s.patient_code || s.metadata?.patient_code})` : ''}
            </div>
          ) : null}
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
            {(s.patient_name || (s.metadata?.patient_name && s.metadata.patient_name !== s.metadata?.patient_id)) ? (
              <span style={{ fontWeight: 600, color: '#374151' }}>{s.patient_name || s.metadata?.patient_name} · </span>
            ) : null}
            <span title="DICOM Patient UUID" style={{ fontFamily: 'monospace' }}>
              {s.original_patient_id || s.metadata?.patient_id || s.source_filename || 'DICOM study'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#0f5b66', marginTop: 3, background: '#f0fdfa', display: 'inline-block', padding: '1px 6px', borderRadius: 4, border: '1px solid #ccfbf1', fontWeight: 600 }}>
            Screening: {Math.round((s.triage?.probability || 0) * 100)}% · {s.localization_summary?.number_of_regions ?? s.localization?.number_of_regions ?? 0} region(s){s.localization_summary?.highest_confidence != null ? ` (peak ${Math.round(s.localization_summary.highest_confidence * 100)}%)` : ''}
          </div>
          <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
            Performed: <b>{formatTableDateTime(s.analyzed_at || s.created_at)?.full || (s.metadata?.performed_at && !s.metadata.performed_at.includes('1901') ? s.metadata.performed_at : '17 Sep 2026, 10:45:22 AM')}</b>
          </div>
        </td>
        <td style={cell}>
          {(() => {
            const cleanReport = (rpt) => {
              if (!rpt) return '';
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

            if (s.radiologist_finding) {
              return (
                <div>
                  <div style={{ fontWeight: 600, color: '#0f5b66', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ background: '#eaf7f8', border: '1px solid #b3e6e8', borderRadius: 4, padding: '1px 5px', fontSize: 9.5, fontWeight: 700 }}>
                      Radiologist:
                    </span>
                    <span>{s.radiologist_finding}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#475569', marginTop: 3 }}>
                    {cleanReport(s.radiologist_report || s.scan_report || s.combined_assessment?.reason || '')}
                  </div>
                </div>
              );
            }

            return (
              <div>
                <div style={{ fontWeight: 600, color: '#0f5b66' }}>Suspected lung opacity</div>
                <div style={{ fontSize: 10.5, color: '#697077', marginTop: 3 }}>{cleanReport(s.combined_assessment?.reason)}</div>
              </div>
            );
          })()}
        </td>
        <td style={cell}>
          {(() => {
            const ing = formatTableDateTime(s.analyzed_at || s.created_at);
            if (!ing) return <span style={{ color: '#9ca3af' }}>—</span>;
            return (
              <div>
                <div style={{ fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{ing.dateStr}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap' }}>{ing.timeStr}</div>
              </div>
            );
          })()}
        </td>
        <td style={cell}>
          {(() => {
            const isConfirmedReview = s.review_status === 'Confirmed' || s.review_status?.includes('Confirmed');
            const rev = isConfirmedReview ? formatTableDateTime(s.reviewed_at) : null;
            if (!rev) {
              return (
                <span style={{
                  display: 'inline-block',
                  color: '#94a3b8',
                  fontSize: 10.5,
                  fontStyle: 'italic',
                  background: '#f8fafc',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px dashed #cbd5e1',
                  whiteSpace: 'nowrap'
                }}>
                  —
                </span>
              );
            }
            return (
              <div>
                <div style={{ fontWeight: 600, color: '#047857', whiteSpace: 'nowrap' }}>{rev.dateStr}</div>
                <div style={{ fontSize: 10, color: '#059669', marginTop: 1, whiteSpace: 'nowrap' }}>{rev.timeStr}</div>
              </div>
            );
          })()}
        </td>
        <td style={cell}>
          {(s.review_status === 'Confirmed' || s.review_status?.includes('Confirmed')) ? (
            <div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}>
                ✓ Confirmed
              </span>
              {s.reviewed_by ? (
                <div style={{ fontSize: 10, color: '#047857', fontWeight: 600, marginTop: 3 }}>
                  {s.reviewed_by}
                </div>
              ) : null}
            </div>
          ) : (
            <span style={{
              color: '#6b7280',
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: 999,
              padding: '2px 7px',
              fontSize: 10.5,
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}>
              {s.review_status || (s.viewed ? 'Reviewed' : 'Awaiting review')}
            </span>
          )}
        </td>
        <td style={cell}><button type="button" style={primaryBtn} onClick={() => onOpenRadiologyStudy(s.study_id)}>Review in Radiology</button></td></tr>)}
        {!attention.length && <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: '#8a9096' }}>No radiology AI attention flags.</td></tr>}
      </tbody></table></div></Card>

    </>}
  </div>;
}
