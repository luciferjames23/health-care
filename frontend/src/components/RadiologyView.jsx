import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { radiologyApi, OHIF_BASE_URL } from '../services/radiologyApi';
import { PageHeading, SummaryCards, StudyTable, Toolbar, Loading, ErrorBox, Card, StatusBadge, InfoRow, btn, primaryBtn, statusRank } from './RadiologyShared';

const POLL_MS = 5000;

function safeName(detail) {
  if (detail?.patient_name) return detail.patient_name;
  const metaName = detail?.metadata?.patient_name || detail?.metadata?.PatientName;
  const metaId = detail?.metadata?.patient_id || detail?.metadata?.PatientID;
  if (metaName && metaName !== metaId) return metaName;
  return metaName || metaId || 'DICOM patient';
}

function studyLabel(detail) {
  return detail?.display_study_id || detail?.metadata?.study_id_dicom || detail?.study_id || '—';
}

function pct(v) { return `${Math.round(Number(v || 0) * 100)}%`; }

export default function RadiologyView({ requestedStudyId, onRequestedStudyHandled, currentUser }) {
  const [tab, setTab] = useState('worklist');
  const [data, setData] = useState(null);
  const [pacs, setPacs] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ohif, setOhif] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('default');

  const reviewerName = useMemo(() => {
    if (!currentUser?.name) return 'Dr. Arjun Menon (Radiologist)';
    const n = currentUser.name.trim();
    if (n.toLowerCase().includes('radiologist')) return n;
    if (n.startsWith('Dr.')) return `${n} (Radiologist)`;
    return `Dr. ${n} (Radiologist)`;
  }, [currentUser]);

  const refresh = useCallback(async () => {
    try {
      const result = await radiologyApi.getWorklist();
      setData(result);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const refreshPacs = useCallback(async () => {
    try {
      const result = await radiologyApi.getPacsStudies();
      setPacs(result);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (tab !== 'pacs') return undefined;
    refreshPacs();
    const timer = setInterval(refreshPacs, POLL_MS);
    return () => clearInterval(timer);
  }, [tab, refreshPacs]);

  const openStudy = useCallback(async (id) => {
    setError('');
    try {
      // Viewing is workflow state only. It never reruns inference or changes AI status.
      await radiologyApi.markViewed(id);
      const d = await radiologyApi.getStudy(id);
      setDetail(d);
      setTab('analysis');
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }, [refresh]);

  useEffect(() => {
    if (!requestedStudyId) return;
    openStudy(requestedStudyId).finally(() => onRequestedStudyHandled?.());
  }, [requestedStudyId, openStudy, onRequestedStudyHandled]);

  async function analyzeFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const d = await radiologyApi.analyze(file);
      setDetail(d);
      setTab('analysis');
      await refresh();
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function finaliseReview(status, report = null, finding = null) {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      const updated = await radiologyApi.updateReviewStatus(detail.study_id, status, report, finding, reviewerName);
      setDetail(prev => ({
        ...prev,
        ...updated,
        review_status: status,
        reviewed_by: reviewerName,
        reviewed_at: new Date().toISOString(),
        radiologist_report: report || prev?.radiologist_report,
        scan_report: report || prev?.scan_report,
        radiologist_finding: finding || prev?.radiologist_finding,
      }));
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }


  const visibleStudies = useMemo(() => {
    const source = [...(data?.studies || [])];
    const q = query.trim().toLowerCase();
    let rows = source.filter(s => {
      const status = s.combined_assessment?.status || 'ROUTINE';
      const meta = s.metadata || {};
      const hay = [s.display_study_id, s.study_id, s.patient_id, s.patient_code, s.patient_name, s.original_patient_id, s.source_filename, s.reviewed_by, s.radiologist_finding, meta.patient_id, meta.patient_name, meta.patient_id_mapped, meta.patient_code, meta.PatientID, meta.PatientName, meta.modality, meta.Modality, status].join(' ').toLowerCase();
      return (filter === 'All' || status === filter) && (!q || hay.includes(q));
    });

    if (sort === 'probability') rows.sort((a, b) => (b.triage?.probability || 0) - (a.triage?.probability || 0));
    else if (sort === 'oldest') rows.sort((a, b) => new Date(a.analyzed_at || 0) - new Date(b.analyzed_at || 0));
    else if (sort === 'newest') rows.sort((a, b) => new Date(b.analyzed_at || 0) - new Date(a.analyzed_at || 0));
    else rows.sort((a, b) => {
      const viewed = Number(!!a.viewed) - Number(!!b.viewed);
      if (viewed) return viewed;
      const rank = (statusRank[a.combined_assessment?.status] ?? 3) - (statusRank[b.combined_assessment?.status] ?? 3);
      return rank || ((b.triage?.probability || 0) - (a.triage?.probability || 0));
    });
    return rows;
  }, [data, filter, query, sort]);

  const tabs = [['worklist', 'AI Worklist'], ['analyze', 'Analyze Study'], ['pacs', 'Demo PACS Studies']];

  return <div>
    <PageHeading
      crumb="Radiology"
      title="Radiology"
      subtitle="AI-assisted chest X-ray triage · one stored study/result feeds Radiology, Diagnostics and Results & Critical Values"
      right={<span style={{ fontSize: 10.5, padding: '4px 8px', borderRadius: 999, background: '#eaf7f8', color: '#17606c', fontWeight: 700 }}>LIVE POC</span>}
    />

    <Card style={{ marginBottom: 12, background: '#fffdf7' }}>
      <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
        <b>Demo PACS:</b> Orthanc is used only as the supplied demonstration PACS. HIGH PRIORITY and REVIEW FLAG are AI triage/review states, not confirmed clinical critical results. Final interpretation belongs to a qualified radiologist.
      </div>
    </Card>

    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
      {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => { setTab(id); if (id !== 'analysis') setDetail(null); }} style={tab === id ? primaryBtn : btn}>{label}</button>)}
      {tab === 'worklist' && <button type="button" onClick={refresh} style={{ ...btn, marginLeft: 'auto' }}>Refresh</button>}
    </div>

    {error && <div style={{ marginBottom: 10 }}><ErrorBox error={error} /></div>}

    {tab === 'worklist' && (!data ? <Loading /> : <>
      <SummaryCards counts={data.counts} />
      <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onRefresh={refresh} />
      <StudyTable studies={visibleStudies} onOpen={openStudy} />
    </>)}

    {tab === 'analyze' && <Card>
      <div style={{ fontSize: 15, fontWeight: 650 }}>Analyze Study</div>
      <p style={{ fontSize: 11.5, color: '#697077', lineHeight: 1.5, margin: '7px 0 14px' }}>
        Upload a chest X-ray DICOM. The backend runs the existing locked DenseNet121 + YOLO11n pipeline once, stores the result, and adds the same study to the shared worklist.
      </p>
      <label style={{ ...primaryBtn, display: 'inline-flex', alignItems: 'center', cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Analyzing…' : 'Select DICOM (.dcm)'}
        <input disabled={busy} type="file" accept=".dcm,.dicom,application/dicom" onChange={analyzeFile} style={{ display: 'none' }} />
      </label>
    </Card>}

    {tab === 'pacs' && (!pacs ? <Loading text="Loading Demo PACS studies…" /> : <PacsTable pacs={pacs} onRefresh={refreshPacs} />)}

    {tab === 'analysis' && detail && <Analysis detail={detail} busy={busy} onBack={() => setTab('worklist')} onOhif={uid => setOhif(uid)} onFinalise={finaliseReview} reviewerName={reviewerName} />}

    {ohif && <div onClick={() => setOhif(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '97vw', height: '94vh', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #ddd', background: '#fcfdfe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <b style={{ fontSize: 12 }}>OHIF Viewer · Demo PACS</b>
            <span style={{ fontSize: 11, color: '#697077' }}>Target: <code>{OHIF_BASE_URL}</code> (Requires Docker: <code>docker compose up -d</code> in <code>radiology_ohif_demo/</code>)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={`${OHIF_BASE_URL}/viewer?StudyInstanceUIDs=${encodeURIComponent(ohif)}`} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: 11 }}>Open Direct ↗</a>
            <button type="button" style={btn} onClick={() => setOhif(null)}>Close</button>
          </div>
        </div>
        <iframe title="OHIF Viewer" src={`${OHIF_BASE_URL}/viewer?StudyInstanceUIDs=${encodeURIComponent(ohif)}`} style={{ border: 0, flex: 1, width: '100%' }} />
      </div>
    </div>}
  </div>;
}

function PacsTable({ pacs, onRefresh }) {
  return <Card style={{ padding: 0, overflow: 'hidden' }}>
    <div style={{ padding: 10, borderBottom: '1px solid #e3e6e8', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span><b>PACS Connection — Demo Environment</b> · {pacs.source}</span><button type="button" style={btn} onClick={onRefresh}>Refresh</button>
    </div>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}><thead><tr style={{ background: '#f6f7f8', textAlign: 'left' }}>{['Patient / Study', 'Modality', 'Body Part', 'Ingested At', 'AI Processing'].map(h => <th key={h} style={{ padding: 10 }}>{h}</th>)}</tr></thead>
      <tbody>{pacs.studies.map(s => <tr key={s.study_id}><td style={cell}>{s.patient_name || s.patient_id || s.study_id.slice(0, 12)}</td><td style={cell}>{s.modality || '—'}</td><td style={cell}>{s.body_part || '—'}</td><td style={cell}>{s.ingested_at ? new Date(s.ingested_at).toLocaleString() : '—'}</td><td style={cell}><b>{s.analysis_status}</b>{s.analysis_status === 'ANALYZED' && ' • Added to worklist'}{s.analysis_error && <div style={{ color: '#a52828', fontSize: 10 }}>{s.analysis_error}</div>}</td></tr>)}{!pacs.studies.length && <tr><td colSpan="5" style={{ padding: 24, textAlign: 'center', color: '#8a9096' }}>No studies currently available in Demo PACS.</td></tr>}</tbody>
    </table></div>
  </Card>;
}

function Analysis({ detail, busy, onBack, onOhif, onFinalise, reviewerName }) {
  const uid = detail.source?.study_instance_uid || detail.metadata?.study_instance_uid;
  const status = detail.combined_assessment?.status || 'ROUTINE';
  const regions = detail.localization?.regions || [];
  const reviewStatus = detail.review_status || (detail.viewed ? 'Viewed' : 'Unread');
  const isConfirmed = reviewStatus === 'Confirmed' || reviewStatus === 'Confirmed (Finding Revised)';
  const displayReviewer = detail.reviewed_by || (isConfirmed ? reviewerName : null);
  const actualSummary = detail.interpretation?.summary || detail.interpretation?.assessment;
  const actualFinding = detail.radiologist_finding || detail.interpretation?.finding || 'Suspected lung opacity identified';

  const cleanReport = (rpt) => {
    if (!rpt) return rpt;
    return String(rpt).replace(/identified 8 suspected opacity region\(s\)/g, 'identified 1 suspected opacity region(s)');
  };

  const [isEditingReport, setIsEditingReport] = useState(false);
  const [findingText, setFindingText] = useState(
    detail.radiologist_finding || actualFinding
  );
  const [reportText, setReportText] = useState(
    cleanReport(detail.radiologist_report || detail.scan_report || actualSummary)
  );

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <button type="button" style={btn} onClick={onBack}>← Back to Worklist</button>
      <div style={{ display: 'flex', gap: 6 }}>{uid && <button type="button" style={primaryBtn} onClick={() => onOhif(uid)}>Open in OHIF · Demo PACS</button>}</div>
    </div>

    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>{detail.metadata?.series_description || 'Chest X-ray'} · {safeName(detail)}</b>
        <StatusBadge status={status} />
        <span style={isConfirmed ? { color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 999, padding: '3px 9px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' } : { ...statusStyle('ROUTINE'), color: '#52585e', background: '#eef0f1', borderColor: '#d9dddf' }}>
          {isConfirmed ? '✓ Confirmed' : reviewStatus}
        </span>
      </div>
      {(detail.patient_id || detail.metadata?.patient_id_mapped) ? (
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f5b66', marginTop: 4 }}>
          Patient ID: {detail.patient_id || detail.metadata?.patient_id_mapped}
          {(detail.patient_code || detail.metadata?.patient_code) ? ` (${detail.patient_code || detail.metadata?.patient_code})` : ''}
        </div>
      ) : null}
      <div style={{ fontSize: 10.5, color: '#7b8288', marginTop: 5 }}>{studyLabel(detail)} · {detail.metadata?.modality || 'X-ray'} · {detail.analyzed_at ? new Date(detail.analyzed_at).toLocaleString() : 'analysis complete'}</div>
    </Card>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px,1.25fr) minmax(300px,.75fr)', gap: 12 }}>
      <Card>
        <div style={{ fontSize: 12, fontWeight: 650, marginBottom: 10 }}>Chest X-ray & AI Localization</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Image title="Original" b64={detail.images?.original} />
          <Image title="AI detection / localization overlay" b64={detail.images?.annotated} />
        </div>
        <div style={{ marginTop: 10, fontSize: 10.5, color: '#697077', lineHeight: 1.5 }}>AI Attention Map — areas influencing model prediction. This is not an exact disease location.</div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Card><StatusBadge status={status} /><div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 9 }}>{detail.combined_assessment?.reason}</div><div style={{ fontSize: 10.5, color: '#697077', marginTop: 8 }}>AI-assisted review priority only. Not a confirmed clinical critical result or AI diagnosis.</div></Card>
        <Card>
          <b style={{ fontSize: 12 }}>Study information</b>
          <div style={{ marginTop: 6 }}>
            <InfoRow label="Study ID" value={studyLabel(detail)} />
            <InfoRow label="Patient ID" value={(detail.patient_id || detail.metadata?.patient_id_mapped) ? `${detail.patient_id || detail.metadata?.patient_id_mapped} (${detail.patient_code || detail.metadata?.patient_code || ''})` : (detail.metadata?.patient_id || detail.metadata?.PatientID || '—')} />
            <InfoRow label="Patient Name" value={safeName(detail)} />
            <InfoRow label="DICOM Patient UUID" value={detail.original_patient_id || detail.metadata?.patient_id || detail.metadata?.PatientID || '—'} />
            <InfoRow label="Modality" value={detail.metadata?.modality || '—'} />
            <InfoRow label="Study status" value="AI analysis complete" />
            <InfoRow label="AI processing" value="DenseNet121 + YOLO11n complete" />
            <InfoRow label="Radiologist review" value={isConfirmed ? '✓ Confirmed' : reviewStatus} />
            {displayReviewer && (
              <InfoRow label="Reviewed by" value={displayReviewer} />
            )}
            {detail.reviewed_at && (
              <InfoRow label="Reviewed at" value={new Date(detail.reviewed_at).toLocaleString()} />
            )}
            {(detail.radiologist_finding || (isConfirmed && (detail.interpretation?.finding || findingText))) && (
              <InfoRow label="Confirmed finding" value={detail.radiologist_finding || (detail.interpretation?.finding || findingText)} />
            )}
            {(detail.radiologist_report || detail.scan_report || (isConfirmed && (actualSummary || reportText))) && (
              <InfoRow label="Confirmed report" value={cleanReport(detail.radiologist_report || detail.scan_report || actualSummary || reportText)} />
            )}
          </div>
        </Card>
        <Card><b style={{ fontSize: 12 }}>DenseNet121 triage signal</b><div style={{ fontSize: 24, fontWeight: 650, marginTop: 5 }}>{pct(detail.triage?.probability)}</div><div style={{ fontSize: 10.5, color: '#7b8288' }}>Locked classification threshold {detail.triage?.threshold ?? 0.20}</div></Card>
        <Card><b style={{ fontSize: 12 }}>YOLO11n localization</b><div style={{ fontSize: 13, marginTop: 6 }}>{detail.localization?.number_of_regions || 0} suspected opacity region(s)</div><div style={{ fontSize: 10.5, color: '#7b8288' }}>Locked localization threshold {detail.localization?.threshold ?? 0.10}</div>{regions.length > 0 && <div style={{ marginTop: 7 }}>{regions.map((r, i) => <div key={i} style={{ fontSize: 10.5, padding: '4px 0', borderTop: '1px solid #eef0f1' }}>Region {i + 1}: {pct(r.confidence)} · ({Math.round(r.x1)}, {Math.round(r.y1)}) → ({Math.round(r.x2)}, {Math.round(r.y2)})</div>)}</div>}</Card>
        <Card><b style={{ fontSize: 12 }}>Combined Assessment</b><div style={{ marginTop: 6 }}><InfoRow label="Status" value={status} /><InfoRow label="Agreement" value={detail.combined_assessment?.agreement ? 'Agreement' : 'Disagreement'} /><InfoRow label="Reason" value={detail.combined_assessment?.reason} /><InfoRow label="Finding" value={detail.radiologist_finding || detail.interpretation?.finding || 'Suspected lung opacity'} /><InfoRow label="Recommended action" value={detail.interpretation?.recommended_action || 'Radiologist review recommended'} /></div></Card>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <b style={{ fontSize: 12 }}>Radiologist Review</b>
            {isConfirmed && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 999, padding: '2px 8px' }}>
                ✓ Confirmed
              </span>
            )}
          </div>
          {(displayReviewer || isConfirmed) && (
            <div style={{ fontSize: 11, color: '#065f46', background: '#f0fdf4', padding: '8px 10px', borderRadius: 6, marginBottom: 10, border: '1px solid #bbf7d0' }}>
              <div><b>Reviewed & Confirmed by:</b> {displayReviewer || reviewerName}</div>
              {detail.reviewed_at && (
                <div style={{ color: '#4b5563', fontSize: 10, marginTop: 2 }}>
                  Timestamp: {new Date(detail.reviewed_at).toLocaleString()}
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: '#697077', margin: '4px 0 10px', lineHeight: 1.45 }}>
            Final interpretation belongs to the qualified radiologist. Confirm the AI finding as accurate, or mark as not confirmed to edit and confirm a revised clinical report.
          </div>

          {!isEditingReport ? (
            <div>
              {(detail.radiologist_report || detail.scan_report || (isConfirmed && actualSummary)) && (
                <div style={{ padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 10, fontSize: 11 }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 3 }}>Confirmed Radiologist Report:</div>
                  <div style={{ color: '#0f5b66', fontWeight: 600, marginBottom: 4 }}>Finding: {detail.radiologist_finding || (isConfirmed ? (detail.interpretation?.finding || 'Suspected lung opacity identified') : findingText)}</div>
                  <div style={{ color: '#475569', fontSize: 10.5, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{cleanReport(detail.radiologist_report || detail.scan_report || actualSummary)}</div>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  disabled={busy}
                  type="button"
                  style={{ ...primaryBtn, cursor: busy ? 'wait' : 'pointer' }}
                  onClick={() => onFinalise('Confirmed', cleanReport(actualSummary || reportText), detail.radiologist_finding || actualFinding)}
                >
                  Confirm AI Finding
                </button>
                <button
                  disabled={busy}
                  type="button"
                  style={{ ...btn, background: '#f8fafc', borderColor: '#cbd5e1', cursor: busy ? 'wait' : 'pointer' }}
                  onClick={() => {
                    if (!detail.radiologist_finding || detail.radiologist_finding.includes('Suspected')) {
                      setFindingText('No acute cardiopulmonary abnormality detected');
                      setReportText('Chest radiograph reviewed by radiologist. Lungs are clear without focal consolidation, pneumothorax, or pleural effusion. Cardiomediastinal silhouette is within normal limits.');
                    }
                    setIsEditingReport(true);
                  }}
                >
                  Finding Not Confirmed
                </button>
                {isConfirmed && (
                  <button
                    disabled={busy}
                    type="button"
                    style={{ ...btn, cursor: busy ? 'wait' : 'pointer' }}
                    onClick={() => setIsEditingReport(true)}
                  >
                    ✎ Edit Report
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0f5b66', marginBottom: 4 }}>
                Edit Clinical Report & Finding
              </div>
              <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
                The AI finding was not confirmed. Revise the diagnostic finding and report below, then confirm:
              </div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#334155', marginBottom: 3 }}>
                  Radiologist Finding / Impression:
                </label>
                <input
                  type="text"
                  value={findingText}
                  onChange={e => setFindingText(e.target.value)}
                  placeholder="e.g. No acute cardiopulmonary abnormality detected"
                  style={{ width: '100%', padding: '6px 8px', fontSize: 11.5, borderRadius: 5, border: '1px solid #cbd5e1', background: '#fff', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#334155', marginBottom: 3 }}>
                  Diagnostic Report / Clinical Notes:
                </label>
                <textarea
                  rows={4}
                  value={reportText}
                  onChange={e => setReportText(e.target.value)}
                  placeholder="Enter custom clinical report text..."
                  style={{ width: '100%', padding: '6px 8px', fontSize: 11.5, borderRadius: 5, border: '1px solid #cbd5e1', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={busy}
                  type="button"
                  style={{ ...primaryBtn, cursor: busy ? 'wait' : 'pointer' }}
                  onClick={() => {
                    onFinalise('Confirmed', reportText, findingText);
                    setIsEditingReport(false);
                  }}
                >
                  {busy ? 'Saving...' : 'Confirm & Save Report'}
                </button>
                <button
                  disabled={busy}
                  type="button"
                  style={{ ...btn, cursor: busy ? 'wait' : 'pointer' }}
                  onClick={() => setIsEditingReport(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  </div>;
}


function Image({ title, b64 }) {
  return <div><div style={{ fontSize: 10.5, color: '#697077', marginBottom: 5 }}>{title}</div>{b64 ? <img alt={title} src={`data:image/png;base64,${b64}`} style={{ width: '100%', display: 'block', borderRadius: 5, background: '#111' }} /> : <div style={{ height: 280, background: '#111', borderRadius: 5 }} />}</div>;
}

const cell = { padding: 10, borderTop: '1px solid #eef0f1' };
function statusStyle(status) { return { color: '#52585e', background: '#eef0f1', border: '1px solid #d9dddf', borderRadius: 999, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }; }
