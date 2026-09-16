import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { radiologyApi, OHIF_BASE_URL } from '../services/radiologyApi';
import { PageHeading, SummaryCards, StudyTable, Toolbar, Loading, ErrorBox, Card, StatusBadge, InfoRow, btn, primaryBtn, statusRank } from './RadiologyShared';

const POLL_MS = 5000;

function safeName(detail) {
  return detail?.metadata?.patient_name || detail?.metadata?.PatientName || detail?.metadata?.patient_id || detail?.metadata?.PatientID || 'DICOM patient';
}

function studyLabel(detail) {
  return detail?.display_study_id || detail?.metadata?.study_id_dicom || detail?.study_id || '—';
}

function pct(v) { return `${Math.round(Number(v || 0) * 100)}%`; }

export default function RadiologyView({ requestedStudyId, onRequestedStudyHandled }) {
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

  async function finaliseReview(status) {
    if (!detail) return;
    setBusy(true);
    try {
      const d = await radiologyApi.finaliseReview(detail.study_id, status);
      setDetail(d);
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
      const hay = [s.display_study_id, s.study_id, s.source_filename, meta.patient_id, meta.patient_name, meta.PatientID, meta.PatientName, meta.modality, meta.Modality, status].join(' ').toLowerCase();
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

    {tab === 'analysis' && detail && <Analysis detail={detail} busy={busy} onBack={() => setTab('worklist')} onOhif={uid => setOhif(uid)} onFinalise={finaliseReview} />}

    {ohif && <div onClick={() => setOhif(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '97vw', height: '94vh', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '1px solid #ddd' }}>
          <b style={{ fontSize: 12 }}>OHIF Viewer · Demo PACS</b><button type="button" style={btn} onClick={() => setOhif(null)}>Close</button>
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

function Analysis({ detail, busy, onBack, onOhif, onFinalise }) {
  const uid = detail.source?.study_instance_uid || detail.metadata?.study_instance_uid;
  const status = detail.combined_assessment?.status || 'ROUTINE';
  const regions = detail.localization?.regions || [];
  const reviewStatus = detail.review_status || (detail.viewed ? 'Viewed' : 'Unread');
  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <button type="button" style={btn} onClick={onBack}>← Back to Worklist</button>
      <div style={{ display: 'flex', gap: 6 }}>{uid && <button type="button" style={primaryBtn} onClick={() => onOhif(uid)}>Open in OHIF · Demo PACS</button>}</div>
    </div>

    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><b style={{ fontSize: 15 }}>{detail.metadata?.series_description || 'Chest X-ray'} · {safeName(detail)}</b><StatusBadge status={status} /><span style={{ ...statusStyle('ROUTINE'), color: '#52585e', background: '#eef0f1', borderColor: '#d9dddf' }}>{reviewStatus}</span></div>
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
        <Card><b style={{ fontSize: 12 }}>Study information</b><div style={{ marginTop: 6 }}><InfoRow label="Study ID" value={studyLabel(detail)} /><InfoRow label="DICOM patient" value={safeName(detail)} /><InfoRow label="Patient ID" value={detail.metadata?.patient_id || detail.metadata?.PatientID || '—'} /><InfoRow label="Modality" value={detail.metadata?.modality || '—'} /><InfoRow label="Study status" value="AI analysis complete" /><InfoRow label="AI processing" value="DenseNet121 + YOLO11n complete" /><InfoRow label="Radiologist review" value={reviewStatus} /></div></Card>
        <Card><b style={{ fontSize: 12 }}>DenseNet121 triage signal</b><div style={{ fontSize: 24, fontWeight: 650, marginTop: 5 }}>{pct(detail.triage?.probability)}</div><div style={{ fontSize: 10.5, color: '#7b8288' }}>Locked classification threshold {detail.triage?.threshold ?? 0.20}</div></Card>
        <Card><b style={{ fontSize: 12 }}>YOLO11n localization</b><div style={{ fontSize: 13, marginTop: 6 }}>{detail.localization?.number_of_regions || 0} suspected opacity region(s)</div><div style={{ fontSize: 10.5, color: '#7b8288' }}>Locked localization threshold {detail.localization?.threshold ?? 0.10}</div>{regions.length > 0 && <div style={{ marginTop: 7 }}>{regions.map((r, i) => <div key={i} style={{ fontSize: 10.5, padding: '4px 0', borderTop: '1px solid #eef0f1' }}>Region {i + 1}: {pct(r.confidence)} · ({Math.round(r.x1)}, {Math.round(r.y1)}) → ({Math.round(r.x2)}, {Math.round(r.y2)})</div>)}</div>}</Card>
        <Card><b style={{ fontSize: 12 }}>Combined Assessment</b><div style={{ marginTop: 6 }}><InfoRow label="Status" value={status} /><InfoRow label="Agreement" value={detail.combined_assessment?.agreement ? 'Agreement' : 'Disagreement'} /><InfoRow label="Reason" value={detail.combined_assessment?.reason} /><InfoRow label="Finding" value={detail.interpretation?.finding || 'Suspected lung opacity'} /><InfoRow label="Recommended action" value={detail.interpretation?.recommended_action || 'Radiologist review recommended'} /></div></Card>
        <Card><b style={{ fontSize: 12 }}>Radiologist Review</b><div style={{ fontSize: 10.5, color: '#697077', margin: '6px 0 9px', lineHeight: 1.45 }}>Final interpretation belongs to the qualified radiologist. These actions only record the review workflow state; they do not modify the AI result.</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}><button disabled={busy} type="button" style={btn} onClick={() => onFinalise('No acute finding')}>Finalise: no acute finding</button><button disabled={busy} type="button" style={btn} onClick={() => onFinalise('Finding not confirmed')}>Finalise: finding not confirmed</button></div></Card>
      </div>
    </div>
  </div>;
}

function Image({ title, b64 }) {
  return <div><div style={{ fontSize: 10.5, color: '#697077', marginBottom: 5 }}>{title}</div>{b64 ? <img alt={title} src={`data:image/png;base64,${b64}`} style={{ width: '100%', display: 'block', borderRadius: 5, background: '#111' }} /> : <div style={{ height: 280, background: '#111', borderRadius: 5 }} />}</div>;
}

const cell = { padding: 10, borderTop: '1px solid #eef0f1' };
function statusStyle(status) { return { color: '#52585e', background: '#eef0f1', border: '1px solid #d9dddf', borderRadius: 999, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }; }
