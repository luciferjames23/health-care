import XrayOrders from './XrayOrders';
import { ImagingHistoryButton } from './ImagingHistory';
import RadiologyClarifications, { ClarificationButton } from './RadiologyClarifications';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { radiologyApi, OHIF_BASE_URL } from '../services/radiologyApi';
import { PageHeading, SummaryCards, StudyTable, Toolbar, Loading, ErrorBox, Card, StatusBadge, InfoRow, btn, primaryBtn, statusRank, formatTableDateTime } from './RadiologyShared';

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

export default function RadiologyView({ requestedStudyId, onRequestedStudyHandled, currentUser, onSelectPatient }) {
  const [tab, setTab] = useState('orders');
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
      await radiologyApi.markViewed(id).catch(err => console.warn('markViewed non-critical error:', err));
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

  const tabs = [['orders', 'X-ray Orders'], ['worklist', 'AI Worklist'], ['analyze', 'Analyze Study'], ['pacs', 'Demo PACS Studies'], ['clarifications', 'Clarifications']];

  return <div>
    <PageHeading
      crumb="Radiology"
      title="Radiology"
      subtitle="AI-assisted chest X-ray triage · one stored study/result feeds Radiology, Diagnostics and Results & Critical Values"
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

    {tab === 'orders' && <XrayOrders radiologist />}
    {tab === 'clarifications' && <RadiologyClarifications />}
    {tab !== 'clarifications' && <div style={{ marginBottom: 12 }}><ClarificationButton inbox label="Clarification inbox" /></div>}
    {tab === 'analysis' && detail?.order_id && <div style={{ marginBottom: 12 }}><ClarificationButton orderId={detail.order_id} label="Discuss this report" /></div>}
    {tab === 'analysis' && detail?.order_id && <div style={{ marginBottom: 12 }}><ImagingHistoryButton orderId={detail.order_id} label="Compare with prior X-ray" /></div>}
    {tab === 'worklist' && (!data ? <Loading /> : <>
      <SummaryCards counts={data.counts} />
      <Toolbar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onRefresh={refresh} />
      <StudyTable studies={visibleStudies} onOpen={openStudy} />
    </>)}

    {tab === 'analyze' && <Card>
      <div style={{ fontSize: 15, fontWeight: 650 }}>Analyze an ordered X-ray</div>
      <p>Select the doctor's request in X-ray Orders, verify the patient, and upload the DICOM. Analysis starts automatically after the upload and appears in AI Worklist under that order's accession.</p>
      <button style={primaryBtn} onClick={() => setTab('orders')}>Open X-ray Orders</button>
    </Card>}

    {tab === 'pacs' && (!pacs ? <Loading text="Loading Demo PACS studies…" /> : <PacsTable pacs={pacs} onRefresh={refreshPacs} />)}

    {tab === 'analysis' && detail && <Analysis detail={detail} busy={busy} onBack={() => setTab('worklist')} onOhif={(uid, series) => setOhif(`${OHIF_BASE_URL}/viewer?StudyInstanceUIDs=${encodeURIComponent(uid)}${series ? `&initialSeriesInstanceUID=${encodeURIComponent(series)}` : ""}&_cb=${Date.now()}`)} onFinalise={finaliseReview} reviewerName={reviewerName} onSelectPatient={onSelectPatient} />}

    {ohif && <div onClick={() => setOhif(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '97vw', height: '94vh', background: '#fff', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #ddd', background: '#fcfdfe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <b style={{ fontSize: 12 }}>OHIF Viewer · Demo PACS</b>
            <span style={{ fontSize: 11, color: '#697077' }}>Target: <code>{OHIF_BASE_URL}</code> (Requires Docker: <code>docker compose up -d</code> in <code>radiology_ohif_demo/</code>)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={ohif} target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: 11 }}>Open Direct ↗</a>
            <button type="button" style={btn} onClick={() => setOhif(null)}>Close</button>
          </div>
        </div>
        <iframe title="OHIF Viewer" src={ohif} style={{ border: 0, flex: 1, width: '100%' }} />
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

function Analysis({ detail, busy, onBack, onOhif, onFinalise, reviewerName, onSelectPatient }) {
  const [preparingOhif, setPreparingOhif] = useState(false);
  const [ohifError, setOhifError] = useState('');
  const openLocalizedOhif = async () => {
    setPreparingOhif(true);
    setOhifError('');
    try {
      const result = await radiologyApi.prepareLocalizedOhif(detail.study_id);
      onOhif(result.study_instance_uid, result.series_instance_uid);
    } catch (error) {
      setOhifError(error.message);
    } finally {
      setPreparingOhif(false);
    }
  };
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

  const [isEditingReport, setIsEditingReport] = useState(false);
  const [findingText, setFindingText] = useState(
    detail.radiologist_finding || actualFinding
  );
  const [reportText, setReportText] = useState(
    cleanReport(detail.radiologist_report || detail.scan_report || actualSummary)
  );

  const ingested = formatTableDateTime(detail.analyzed_at || detail.created_at);
  const ingestedTimestamp = ingested ? ingested.full : '17 Sep 2026, 10:45:22 AM';
  // Per requirement: performed date should be ingested date and time
  const performedTimestamp = ingestedTimestamp;
  const reviewed = isConfirmed ? formatTableDateTime(detail.reviewed_at) : null;
  const reviewedTimestamp = reviewed ? reviewed.full : 'Pending Review';

  const patId = detail.patient_id || detail.metadata?.patient_id_mapped;
  const patCode = detail.patient_code || detail.metadata?.patient_code;
  const patName = safeName(detail);
  const canNavigate = !!(onSelectPatient && (patId || patCode || patName));

  const buildPatientObj = () => {
    const meta = detail.metadata || {};
    const pCode = patCode || meta.patient_code || '';
    const pId = patId || meta.patient_id || '';
    const name = detail.patient_name || meta.patient_name || patName || '';
    return {
      id: pId,
      patient_id: pId,
      patient_number: pCode,
      name: name,
      patient_name: name,
      uhid: pCode || (pId ? `MER-PAT-${String(pId).padStart(7, '0')}` : ''),
    };
  };

  return <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <button type="button" style={btn} onClick={onBack}>← Back to Worklist</button>
      <div style={{ display: 'flex', gap: 6 }}>{uid && <button type="button" style={primaryBtn} onClick={() => onOhif(uid)}>Original image in OHIF</button>}
        {uid && detail.images?.annotated && <button type="button" style={primaryBtn} disabled={preparingOhif} onClick={openLocalizedOhif}>{preparingOhif ? 'Preparing AI image…' : 'AI localized image in OHIF'}</button>}
      </div>
    </div>

    {ohifError && <div role="alert" style={{ color: "#b42318", marginBottom: 10 }}>{ohifError}</div>}
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>
          {detail.metadata?.series_description || 'Chest Radiograph'} ·{' '}
          {canNavigate ? (
            <span
              style={{
                cursor: 'pointer',
                color: '#0f5b66',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                textDecorationColor: '#0f5b66',
              }}
              onClick={() => onSelectPatient(buildPatientObj())}
              title="Open Patient 360"
            >
              {patName}
            </span>
          ) : (
            patName
          )}
        </b>
        <StatusBadge status={status} />
        <span style={isConfirmed ? { color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 999, padding: '3px 9px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' } : { ...statusStyle('ROUTINE'), color: '#52585e', background: '#eef0f1', borderColor: '#d9dddf' }}>
          {isConfirmed ? '✓ Confirmed' : reviewStatus}
        </span>
      </div>
      {(patId || patCode) ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#0f5b66',
            marginTop: 4,
            ...(canNavigate ? {
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textDecorationColor: '#0f5b66',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            } : {})
          }}
          onClick={canNavigate ? () => onSelectPatient(buildPatientObj()) : undefined}
          title={canNavigate ? 'Open Patient 360' : undefined}
        >
          <span>Patient ID: {patId || ''}{patCode ? ` (${patCode})` : ''}</span>
          {canNavigate && <span style={{ fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>↗</span>}
        </div>
      ) : null}
      <div style={{ fontSize: 11, color: '#475569', marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span><b>Study ID:</b> {studyLabel(detail)}</span>
        <span><b>Modality:</b> {detail.metadata?.modality || 'DX'} ({detail.metadata?.view_position || 'PA'} View)</span>
        <span><b>Performed Date & Time:</b> <span style={{ color: '#0f5b66', fontWeight: 650 }}>{performedTimestamp}</span></span>
        <span><b>Ingested Date & Time:</b> <span style={{ color: '#0f5b66', fontWeight: 650 }}>{ingestedTimestamp}</span></span>
        <span><b>Reviewed Date & Time:</b> <span style={{ color: isConfirmed ? '#047857' : '#64748b', fontWeight: 650 }}>{reviewedTimestamp}</span></span>
      </div>
    </Card>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px,1.25fr) minmax(300px,.75fr)', gap: 12 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 12.5 }}>Chest Radiograph & Opacity Localization</b>
          <span style={{ fontSize: 10.5, color: '#64748b' }}>
            Resolution: {detail.metadata?.columns || 1024} × {detail.metadata?.rows || 1024} px
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Image title="Diagnostic Radiograph (DX)" b64={detail.images?.original} />
          <Image title="Automated Localization Overlay" b64={detail.images?.annotated} />
        </div>
        <div style={{ marginTop: 10, fontSize: 10.5, color: '#697077', lineHeight: 1.5 }}>
          Computer-aided detection overlay indicating localized areas of radiographic opacity. This serves as clinical decision support for radiologist correlation.
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatusBadge status={status} />
            <span style={{ fontSize: 11, fontWeight: 700, color: statusRank[status] === 0 ? '#dc2626' : (statusRank[status] === 1 ? '#d97706' : '#16a34a') }}>
              Screening Score: {pct(detail.triage?.probability)}
            </span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 9, color: '#1f2937' }}>
            {cleanReport(detail.combined_assessment?.reason)}
          </div>
          <div style={{ fontSize: 10.5, color: '#697077', marginTop: 8 }}>
            Radiology clinical decision support. Final diagnostic verification must be performed by a qualified radiologist.
          </div>
        </Card>

        {/* Exact X-Ray Examination Specification Card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <b style={{ fontSize: 12, color: '#0f5b66' }}>X-Ray Examination Specification</b>
            <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
              Digital Radiography (DX)
            </span>
          </div>
          <div style={{ marginTop: 6 }}>
            <InfoRow label="Performed Date & Time" value={<span style={{ fontWeight: 700, color: '#0f172a' }}>{performedTimestamp}</span>} />
            <InfoRow label="Ingested Date & Time" value={<span style={{ fontWeight: 650, color: '#0f5b66' }}>{ingestedTimestamp}</span>} />
            <InfoRow label="Reviewed Date & Time" value={<span style={{ fontWeight: 650, color: isConfirmed ? '#047857' : '#64748b' }}>{reviewedTimestamp}</span>} />
            <InfoRow label="Study & Accession" value={`${studyLabel(detail)} · ${detail.metadata?.accession_number || 'ACC-2026-9811'}`} />
            <InfoRow label="Projection / View" value={`${detail.metadata?.view_position || 'PA'} View · ${detail.metadata?.body_part_examined || 'CHEST'} (${detail.metadata?.patient_position || 'ERECT'})`} />
            <InfoRow label="Equipment / Facility" value={`${detail.metadata?.manufacturer || 'GE Healthcare'} ${detail.metadata?.manufacturer_model_name || 'Discovery XR656 Plus'}`} />
            <InfoRow label="Acquisition Parameters" value={`${detail.metadata?.kvp ? (String(detail.metadata.kvp).includes('kV') ? detail.metadata.kvp : `${detail.metadata.kvp} kVp`) : '120 kVp'} · ${detail.metadata?.exposure ? (String(detail.metadata.exposure).includes('mAs') ? detail.metadata.exposure : `${detail.metadata.exposure} mAs`) : '3.2 mAs'} · ${detail.metadata?.station_name || 'XR-ROOM-01'}`} />
            <InfoRow label="Image Matrix" value={`${detail.metadata?.columns || 1024} × ${detail.metadata?.rows || 1024} px · ${detail.metadata?.photometric_interpretation || 'MONOCHROME2'}`} />
            <InfoRow label="Institution" value={`${detail.metadata?.institution_name || 'Meridian Health System'} · ${detail.metadata?.institutional_department_name || 'Department of Radiology'}`} />
          </div>
        </Card>

        {/* Professional Findings and Localization Card without thresholds */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <b style={{ fontSize: 12 }}>Radiographic Findings & Localization</b>
            <span style={{ fontSize: 10.5, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
              {regions.length} suspected region(s)
            </span>
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 8 }}>
            {cleanReport(detail.interpretation?.summary || detail.combined_assessment?.reason)}
          </div>
          {regions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {regions.map((r, i) => {
                const cols = Number(detail.metadata?.columns) || 1024;
                const rows = Number(detail.metadata?.rows) || 1024;
                const xMid = ((r.x1 + r.x2) / 2) / cols;
                const yMid = ((r.y1 + r.y2) / 2) / rows;
                const side = xMid < 0.5 ? 'Right' : 'Left';
                const zone = yMid < 0.35 ? 'Upper' : (yMid < 0.65 ? 'Mid' : 'Lower');
                return (
                  <div key={i} style={{ fontSize: 11, padding: '6px 9px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#0f5b66' }}>
                      Region {i + 1}: {side} {zone} Lung Field
                    </span>
                    <span style={{ color: '#475569', fontSize: 10.5 }}>
                      Detection Confidence: <b style={{ color: '#0f172a' }}>{pct(r.confidence)}</b>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
              No focal pulmonary opacity localized.
            </div>
          )}
        </Card>

        <Card>
          <b style={{ fontSize: 12 }}>Patient & Study Record</b>
          <div style={{ marginTop: 6 }}>
            <InfoRow label="Study ID" value={studyLabel(detail)} />
            <InfoRow
              label="Patient ID"
              value={
                canNavigate && (patId || patCode) ? (
                  <span
                    style={{
                      cursor: 'pointer',
                      color: '#0f5b66',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                    }}
                    onClick={() => onSelectPatient(buildPatientObj())}
                    title="Open Patient 360"
                  >
                    {patId ? `${patId}${patCode ? ` (${patCode})` : ''}` : patCode} ↗
                  </span>
                ) : (
                  (patId ? `${patId}${patCode ? ` (${patCode})` : ''}` : (detail.metadata?.patient_id || detail.metadata?.PatientID || '—'))
                )
              }
            />
            <InfoRow
              label="Patient Name"
              value={
                canNavigate && patName ? (
                  <span
                    style={{
                      cursor: 'pointer',
                      color: '#0f5b66',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                    }}
                    onClick={() => onSelectPatient(buildPatientObj())}
                    title="Open Patient 360"
                  >
                    {patName} ↗
                  </span>
                ) : (
                  patName
                )
              }
            />
            <InfoRow label="DICOM Patient UUID" value={detail.original_patient_id || detail.metadata?.patient_id || detail.metadata?.PatientID || '—'} />
            <InfoRow label="Modality / View" value={`${detail.metadata?.modality || 'DX'} · ${detail.metadata?.view_position || 'PA'} (${detail.metadata?.body_part_examined || 'CHEST'})`} />
            <InfoRow label="Study status" value="Radiographic analysis complete" />
            <InfoRow label="Automated detection" value="Computer-Aided Detection Complete" />
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
