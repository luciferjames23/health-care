import React, { useEffect, useRef, useState } from 'react';
import { clarificationApi as api } from '../services/clarificationApi';
import { OHIF_BASE_URL } from '../services/radiologyApi';
import { btn, primaryBtn } from './RadiologyShared';

const date = value => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'long' }) : '—';
const box = { border: '1px solid #dbe4ec', borderRadius: 8, padding: 14, background: '#fff' };
const field = { width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 5, boxSizing: 'border-box' };

export function ClarificationButton({ orderId, scanId, projection, disabled = false, label = 'Report discussions', inbox = false }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const trigger = useRef(null);
  const dialog = useRef(null);
  useEffect(() => {
    if (!inbox) return undefined;
    let alive = true;
    const poll = () => api.list().then(r => { if (alive) setUnread(r.threads.reduce((n, t) => n + Number(t.unread), 0)); }).catch(() => {});
    poll(); const timer = setInterval(poll, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [inbox, open]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else { dialog.current?.close(); trigger.current?.focus(); }
  }, [open]);
  return <>
    <button ref={trigger} disabled={disabled} type="button" style={btn} onClick={() => setOpen(true)}>{label}{unread > 0 ? ` (${unread} unread)` : ''}</button>
    <dialog ref={dialog} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-label="X-ray report discussions" style={{ width: 'min(1050px, 92vw)', maxHeight: '90vh', border: '1px solid #cbd5e1', borderRadius: 10, padding: 20 }}>
      {open && <><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><h2 style={{ margin: 0, fontSize: 18 }}>{projection ? `${projection} report discussions` : 'X-ray report discussions'}</h2><button style={btn} onClick={() => setOpen(false)}>Close</button></div>
        <RadiologyClarifications key={`${orderId || 'inbox'}-${scanId || 'all'}`} orderId={orderId} scanId={scanId} /></>}
    </dialog>
  </>;
}

export default function RadiologyClarifications({ orderId, scanId }) {
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState(false);
  const [draftReport, setDraftReport] = useState(null);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('Routine');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef(null);
  const replyRequest = useRef(null);
  const active = useRef(selected);
  useEffect(() => { active.current = selected; }, [selected]);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const result = await api.list(orderId, scanId);
        if (alive) { setList(result); setError(''); }
      } catch (e) { if (alive) setError(e.message); }
    };
    refresh(); const timer = setInterval(refresh, 10000);
    return () => { alive = false; clearInterval(timer); };
  }, [orderId, scanId, revision]);
  useEffect(() => {
    if (!selected) return undefined;
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const result = await api.detail(selected);
        if (alive) setDetail(result);
      } catch (e) { if (alive) setError(e.message); }
    };
    refresh(); const timer = setInterval(refresh, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [selected, revision]);
  // Acknowledge only messages rendered in the opened discussion, never inbox polling.
  useEffect(() => {
    if (!detail || detail.thread.id !== selected || document.visibilityState === 'hidden') return;
    const ids = detail.messages.filter(m => m.sender_id !== detail.user.user_id && !detail.reads.some(r => r.message_id === m.id && r.user_id === detail.user.user_id)).map(m => m.id);
    if (ids.length) api.read(selected, ids.slice(0, 500)).then(() => setRevision(n => n + 1)).catch(e => setError(e.message));
  }, [detail, selected]);
  const choose = id => { setSelected(id); setDetail(null); setReply(''); replyRequest.current = null; setCompose(false); setError(''); };
  const action = async value => {
    setBusy(true); setError('');
    try { await api.action(selected, value); setRevision(n => n + 1); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const send = async e => {
    e.preventDefault(); setBusy(true); setError('');
    const target = selected;
    try {
      if (compose) {
        const payload = { order_id: orderId, ...(scanId != null ? { scan_id: scanId } : {}), subject, priority, body, report_fingerprint: draftReport.report_fingerprint };
        if (!request.current || request.current.signature !== JSON.stringify(payload)) request.current = { signature: JSON.stringify(payload), id: crypto.randomUUID() };
        const result = await api.create({ ...payload, id: request.current.id });
        request.current = null; setSubject(''); setBody(''); choose(result.id);
      } else {
        if (!replyRequest.current || replyRequest.current.body !== reply) replyRequest.current = { id: crypto.randomUUID(), body: reply };
        await api.reply(target, replyRequest.current);
        if (active.current === target) { setReply(''); replyRequest.current = null; }
      }
      setRevision(n => n + 1);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const selectedRow = list?.threads.find(t => t.id === selected);
  const user = list?.user;
  return <section style={{ fontSize: 13 }}>
    {list?.context && <div style={{ ...box, marginBottom: 12 }}><b>{list.context.patient_name} · {list.context.patient_code}</b><div>{list.context.examination}{scanId != null ? ` · Scan #${scanId}` : ''} · {list.context.accession_number} · Ordered {date(list.context.created_at)}</div><div>Reporting radiologist: {list.context.reviewed_by || 'Awaiting review'}</div></div>}
    <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>Questions and replies stay linked to the original study and report snapshot.</span>
      {orderId && user?.role === 'doctor' && <button style={primaryBtn} disabled={busy || compose || !list.context?.reviewed_at || !list.context?.scan_report} onClick={() => { choose(null); setDraftReport(list.context); setCompose(true); }}>Request clarification</button>}
      <button style={btn} onClick={() => setRevision(n => n + 1)}>Refresh</button>
    </div>
    {orderId && list && !list.context?.reviewed_at && <p>Clarification becomes available after the radiologist reviews the report.</p>}
    {error && <p role="alert" style={{ color: '#b91c1c', whiteSpace: 'pre-wrap' }}>{error}</p>}
    {!list && !error && <p>Loading discussions…</p>}
    {list && <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 260px' }}>
        {!list.threads.length && <p>No clarification requests yet.</p>}
        {list.threads.map(t => <button key={t.id} disabled={busy} onClick={() => choose(t.id)} style={{ ...box, display: 'block', width: '100%', textAlign: 'left', marginBottom: 8, cursor: 'pointer', borderColor: selected === t.id ? '#07828a' : '#dbe4ec' }}>
          <strong>{t.subject}</strong>{Number(t.unread) > 0 && <b style={{ color: '#087e8b' }}> · {t.unread} unread</b>}
          <div>{t.patient_name} · {t.patient_code}</div><div>{t.examination} · {t.accession_number}</div>
          <div>{t.priority} · {t.status === 'Open' ? 'Awaiting radiologist' : t.status}</div>
          <div>Assigned: {t.assigned_name || 'Shared radiology queue'}</div><small>Updated {date(t.updated_at)}</small>
        </button>)}
      </div>
      <div style={{ ...box, flex: '2 1 380px', minWidth: 0 }}>
        {compose ? <form onSubmit={send} style={{ display: 'grid', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Request clarification</h3>
          <details><summary>Report being discussed</summary><p style={{ whiteSpace: 'pre-wrap' }}>{draftReport?.scan_report}</p><small>Reviewed {date(draftReport?.reviewed_at)}</small></details>
          <label>Subject<input style={field} required minLength={3} maxLength={200} value={subject} disabled={busy} onChange={e => setSubject(e.target.value)} /></label>
          <label>Priority<select style={field} value={priority} disabled={busy} onChange={e => setPriority(e.target.value)}><option>Routine</option><option>Urgent</option></select></label>
          <label>Question<textarea style={field} rows={5} required maxLength={8000} value={body} disabled={busy} onChange={e => setBody(e.target.value)} /></label>
          <button style={primaryBtn} disabled={busy || !body.trim() || subject.trim().length < 3}>Send to radiology</button>
          <button type="button" style={btn} disabled={busy} onClick={() => setCompose(false)}>Close draft</button>
        </form> : detail && detail.thread.id === selected ? <>
          <h3 style={{ marginTop: 0 }}>{selectedRow?.subject}</h3>
          <p>{selectedRow?.patient_name} · {selectedRow?.patient_code}<br />{selectedRow?.examination} · {selectedRow?.accession_number}</p>
          {selectedRow?.study_instance_uid && <a href={`${OHIF_BASE_URL}/viewer?StudyInstanceUIDs=${encodeURIComponent(selectedRow.study_instance_uid)}`} target="_blank" rel="noreferrer">Open this study in OHIF</a>}
          <details style={{ margin: '12px 0' }}><summary>Original report referenced by this discussion</summary>
            <p style={{ whiteSpace: 'pre-wrap' }}>{detail.thread.report_snapshot.scan_report}</p>
            <small>Reviewed by {detail.thread.report_snapshot.reviewed_by} · {date(detail.thread.report_snapshot.reviewed_at)}</small>
          </details>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {user.role === 'doctor' && <button style={btn} disabled={busy} onClick={() => action(detail.thread.status === 'Resolved' ? 'reopen' : 'resolve')}>{detail.thread.status === 'Resolved' ? 'Reopen discussion' : 'Mark resolved'}</button>}
            {user.role === 'radiologist' && detail.thread.assigned_to !== user.user_id && <button style={btn} disabled={busy} onClick={() => action('claim')}>{detail.thread.assigned_to ? 'Take over discussion' : 'Claim discussion'}</button>}
          </div>
          {detail.messages.map(m => <article key={m.id} style={{ padding: 12, marginBottom: 10, background: m.sender_role === 'doctor' ? '#eff9fa' : '#f4f5f9', borderRadius: 6 }}>
            <b>{m.sender_name} · {m.sender_role}</b><div><small>{date(m.created_at)}</small></div>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</p>
            {detail.reads.filter(r => r.message_id === m.id).map(r => <div key={r.user_id}><small>Read by {r.reader_name} · {date(r.read_at)}</small></div>)}
          </article>)}
          <details><summary>Discussion activity</summary>{detail.events.map(e => <p key={e.id}>{e.action} — {e.actor_name}<br /><small>{date(e.created_at)}</small></p>)}</details>
          {detail.thread.status !== 'Resolved' ? <form onSubmit={send} style={{ marginTop: 12 }}>
            <label>Reply<textarea style={field} required rows={3} maxLength={8000} disabled={busy} value={reply} onChange={e => setReply(e.target.value)} /></label>
            <button style={primaryBtn} disabled={busy || !reply.trim() || (user.role === 'radiologist' && detail.thread.assigned_to && detail.thread.assigned_to !== user.user_id)}>Send reply</button>
          </form> : <p>Resolved. History remains available.</p>}
        </> : <p>{selected ? 'Loading discussion…' : 'Select a discussion to view its history.'}</p>}
      </div>
    </div>}
  </section>;
}
