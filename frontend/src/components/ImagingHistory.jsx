import React, { useEffect, useRef, useState } from 'react';
import { imagingOrdersApi as api } from '../services/imagingOrdersApi';
import { OHIF_BASE_URL } from '../services/radiologyApi';
import { ClarificationButton } from './RadiologyClarifications';
import { btn, primaryBtn } from './RadiologyShared';
import { studyVersion } from '../services/imagingHistory';

const date = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending';
const input = { padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, maxWidth: '100%' };

export function ImagingHistoryButton({ orderId, onChanged, label = 'History / compare' }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  return <>
    <button type="button" style={btn} onClick={() => setOpen(true)}>{label}</button>
    <dialog ref={dialog} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-label="X-ray study history and comparison" style={{ width: 'min(1240px, 94vw)', maxHeight: '92vh', border: '1px solid #cbd5e1', borderRadius: 10, padding: 20 }}>
      {open && <><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h2 style={{ marginTop: 0 }}>X-ray study history</h2><button style={btn} onClick={() => setOpen(false)}>Close</button></div>
        <ImagingHistory key={orderId} orderId={orderId} onChanged={onChanged} /></>}
    </dialog>
  </>;
}

function ComparisonStudy({ study, title }) {
  const reviewed = Boolean(study.reviewed_at);
  return <article style={{ flex: '1 1 360px', minWidth: 0, border: '1px solid #dbe4ec', borderRadius: 8, padding: 12 }}>
    <h3 style={{ margin: '0 0 8px' }}>{title} — {studyVersion(study)}</h3>
    <b>{study.examination} · {study.accession_number}</b>
    <div>Ordered {date(study.created_at)} · Uploaded {date(study.uploaded_at)}</div>
    <div style={{ background: '#0f172a', minHeight: 200, margin: '12px 0', display: 'grid', placeItems: 'center', color: '#e2e8f0' }}>
      {study.image ? <img src={study.image.startsWith('data:') ? study.image : `data:image/png;base64,${study.image}`} alt={`${title} X-ray ${study.accession_number}`} style={{ width: '100%', height: 340, objectFit: 'contain' }} /> : <p>Image preview not yet available.</p>}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {study.study_instance_uid && <a style={btn} href={`${OHIF_BASE_URL}/viewer?StudyInstanceUIDs=${encodeURIComponent(study.study_instance_uid)}`} target="_blank" rel="noreferrer">Open original in OHIF</a>}
      <ClarificationButton orderId={study.order_id} />
    </div>
    <p><b>{reviewed ? 'Radiologist report' : 'Preliminary result — awaiting radiologist review'}</b> · {study.review_status || 'Pending'}</p>
    <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{study.scan_report || 'No report available yet.'}</p>
    {study.radiologist_finding && <p><b>Finding:</b> {study.radiologist_finding}</p>}
    {reviewed && <small>Reviewed by {study.reviewed_by || 'Radiologist'} · {date(study.reviewed_at)}</small>}
  </article>;
}

function ImagingHistory({ orderId, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [current, setCurrent] = useState('');
  const [prior, setPrior] = useState('');
  const [comparisonResult, setComparison] = useState(null);
  const comparison = comparisonResult?.current.order_id === current && comparisonResult?.prior.order_id === prior && comparisonResult.revision === revision ? comparisonResult : null;
  const [candidates, setCandidates] = useState([]);
  const [linkTo, setLinkTo] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    let alive = true;
    api.history(orderId).then(async result => {
      if (!alive) return;
      setData(result);
      const chosen = result.studies.find(s => s.order_id === orderId);
      const selected = chosen?.root_order_id ? chosen : result.studies.at(-1);
      setCurrent(selected?.order_id || '');
      setPrior(result.studies.filter(s => s.study_version < selected?.study_version).at(-1)?.order_id || '');
      if (result.user.role === 'doctor' && chosen && !chosen.root_order_id && result.studies.length === 1) {
        const all = await api.list(chosen.patient_id);
        if (alive) setCandidates(all.orders.filter(s => s.order_id !== orderId && new Date(s.created_at) <= new Date(chosen.created_at)));
      } else setCandidates([]);
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [orderId, revision]);
  useEffect(() => {
    let alive = true;
    if (current && prior) api.compare(current, prior).then(result => { if (alive) setComparison({ ...result, revision }); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [current, prior, revision]);
  const changeLink = async separate => {
    setBusy(true); setError('');
    try {
      if (separate) await api.unlink(orderId, reason);
      else await api.link(orderId, linkTo, reason);
      setReason(''); setLinkTo(''); setRevision(n => n + 1); onChanged?.();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const source = data?.studies.find(s => s.order_id === orderId);
  const selected = data?.studies.find(s => s.order_id === current);
  return <section style={{ fontSize: 13 }}>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {!data ? !error && <p>Loading study history…</p> : <>
      <p><b>{source?.patient_name} · {source?.patient_code}</b><br />Clinical problem: {source?.clinical_problem}</p>
      <p>Baseline and follow-ups are separate examinations of the same problem. V1, V2 and later numbers identify studies, not revisions of a signed report.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {data.studies.map(s => <div key={s.order_id} style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: 10 }}><b>{studyVersion(s)}</b><div>{s.accession_number} · {s.examination}</div><div>{date(s.created_at)}</div><small>{s.status} · {s.review_status || 'Awaiting review'}</small></div>)}
      </div>
      <button style={btn} disabled={busy} onClick={() => { setError(''); setRevision(n => n + 1); }}>Refresh history</button>
      {data.studies.length > 1 ? <>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '16px 0' }}>
          <label>Current study <select style={input} value={current} onChange={e => { const next = data.studies.find(s => s.order_id === e.target.value); setCurrent(next.order_id); setPrior(data.studies.filter(s => s.study_version < next.study_version).at(-1)?.order_id || ''); setError(''); }}>
            {data.studies.filter(s => s.study_version > data.studies[0].study_version).map(s => <option key={s.order_id} value={s.order_id}>V{s.study_version} · {s.accession_number}</option>)}
          </select></label>
          <label>Compare with <select style={input} value={prior} onChange={e => { setPrior(e.target.value); setError(''); }}>
            {data.studies.filter(s => s.study_version < selected?.study_version).map(s => <option key={s.order_id} value={s.order_id}>V{s.study_version} · {s.accession_number}</option>)}
          </select></label>
        </div>
        {comparison ? <>
          {comparison.prior.examination !== comparison.current.examination && <p style={{ color: '#92400e' }}>Different projections: {comparison.prior.examination} versus {comparison.current.examination}. Account for technique differences when comparing.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}><ComparisonStudy title="Prior" study={comparison.prior} /><ComparisonStudy title="Current" study={comparison.current} /></div>
        </> : <p>Loading comparison…</p>}
      </> : <p>No linked follow-up yet. Use the X-Ray request form to order a follow-up for this problem, or link this examination to an earlier study below when available.</p>}
      {data.user.role === 'doctor' && ((source?.root_order_id && source.study_version === data.studies.at(-1)?.study_version) || candidates.length > 0) && <details style={{ marginTop: 16 }}>
        <summary>{source?.root_order_id ? 'Correct this clinical problem link' : 'Link this existing examination to an earlier study'}</summary>
        <p>Only link examinations when you confirm they concern the same clinical problem. Patient, images, reports and discussions remain unchanged.</p>
        {!source?.root_order_id && <label>Earlier study <select style={input} value={linkTo} onChange={e => setLinkTo(e.target.value)}><option value="">Select a prior study</option>{candidates.map(s => <option key={s.order_id} value={s.order_id}>{s.accession_number} · {s.clinical_problem || s.indication} · {date(s.created_at)}</option>)}</select></label>}
        <label style={{ display: 'block', margin: '12px 0' }}>Reason<textarea style={{ ...input, width: '100%', boxSizing: 'border-box', display: 'block' }} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button style={primaryBtn} disabled={busy || reason.trim().length < 3 || (!source?.root_order_id && !linkTo)} onClick={() => changeLink(Boolean(source?.root_order_id))}>{source?.root_order_id ? 'Separate as a different problem' : 'Confirm same problem and link'}</button>
      </details>}
      {data.events.length > 0 && <details style={{ marginTop: 16 }}><summary>Link history for this order</summary>{data.events.map(e => <p key={e.id}>{e.action} · {e.actor_name} · {date(e.created_at)}<br />{e.reason}</p>)}</details>}
    </>}
  </section>;
}
