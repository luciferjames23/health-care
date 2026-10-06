import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, ShieldAlert, Upload, FileText, Send, RefreshCw, GraduationCap, X } from 'lucide-react';
import { aiTrainerApi } from '../services/ragApi';
import { answerSteps, buildRecallQuiz, formatCitation, simplifyAnswer } from './protocolCopilotUtils';
import './ProtocolCopilot.css';

const suggestions = [
  'What should I verify before starting a clinical procedure?',
  'What should I check before giving a high-alert medication?',
  'Do gloves replace hand hygiene?',
  'What should I do if the sterile field becomes contaminated?',
  'How do I activate Code Blue?',
  'Explain central-line care.'
];

export default function ProtocolCopilot({ currentUser, userRole }) {
  const [mode, setMode] = useState('ask');
  const [filters, setFilters] = useState({ department: '', category: '', document_id: '', version: '', status: '' });
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [results, setResults] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [source, setSource] = useState(null);
  const [quiz, setQuiz] = useState(false);
  const [trainingMode, setTrainingMode] = useState('answer');
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState({ document_id: '', title: '', version: '1.0', department: '', category: '', status: 'DRAFT' });
  const adminRoles = new Set(['admin', 'hospital management', 'ai administrator', 'it administrator']);
  const canManage = [userRole, currentUser?.role].some(role => adminRoles.has(String(role || '').toLowerCase()));
  const supersedingCandidates = documents.filter(doc =>
    doc.active && doc.title?.trim().toLowerCase() === meta.title.trim().toLowerCase() &&
    doc.document_id !== meta.document_id && String(doc.version) !== String(meta.version)
  );

  const refreshDocs = async () => {
    try { setDocuments((await aiTrainerApi.documents()).documents || []); } catch { /* query view shows API errors on demand */ }
  };
  useEffect(() => { refreshDocs(); }, []);

  const ask = async (text = question) => {
    if (!text.trim()) return;
    setBusy(true); setError(''); setResult(null); setQuiz(false); setTrainingMode('answer');
    try { setResult(await aiTrainerApi.query({ question: text.trim() })); setQuestion(text); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const search = async () => {
    if (!question.trim()) return;
    setBusy(true); setError('');
    try { setResults((await aiTrainerApi.search({ q: question.trim(), ...filters })).results || []); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const openSource = async (id) => {
    try { setSource(await aiTrainerApi.document(id)); }
    catch (e) { setError(e.message); }
  };

  const submitUpload = async (event) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError(''); setNotice('');
    const form = new FormData();
    Object.entries(meta).forEach(([key, value]) => form.append(key, value));
    form.append('file', file);
    try {
      const result = await aiTrainerApi.upload(form);
      setFile(null);
      setMeta({ document_id: '', title: '', version: '1.0', department: '', category: '', status: 'DRAFT' });
      setNotice(result.supersedes_version && ['APPROVED','DEMO'].includes(result.status)
        ? `Version ${result.version} is indexed. Previous version ${result.supersedes_version} was deactivated.`
        : result.supersedes_version
          ? `Version ${result.version} is indexed as a draft. The previous version stays active until this version is marked APPROVED or DEMO.`
          : `Document indexed successfully (${result.chunks} section${result.chunks === 1 ? '' : 's'}).`);
      await refreshDocs();
    }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const changeDocument = async (doc, updates) => {
    setError('');
    try { await aiTrainerApi.update(doc.document_id, updates); await refreshDocs(); }
    catch (e) { setError(e.message); }
  };

  const reindexDocument = async (doc) => {
    setError(''); setBusy(true);
    try { await aiTrainerApi.reindex(doc.document_id); await refreshDocs(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const cited = result?.citations || [];
  const displayedText = useMemo(() => {
    if (!result) return '';
    if (trainingMode === 'simple' && result.status === 'ANSWERED') return simplifyAnswer(result.answer);
    if (trainingMode === 'steps' && result.status === 'ANSWERED') return answerSteps(result.answer);
    return result.answer;
  }, [result, trainingMode]);

  return <div className="protocol-copilot">
    <div className="pc-heading"><div><div className="pc-eyebrow"><BookOpen size={15}/> AI TRAINER · PROTOCOL COPILOT</div><h1>Protocol Copilot</h1><p>Search and learn from hospital protocols and SOPs.</p></div>
      {canManage && <button className="pc-secondary" onClick={() => setMode(mode === 'admin' ? 'ask' : 'admin')}><Upload size={16}/>{mode === 'admin' ? 'Back to Copilot' : 'Manage knowledge'}</button>}
    </div>
    <div className="pc-demo"><ShieldAlert size={17}/><span><strong>Demo knowledge base:</strong> content is synthetic and is not approved for live patient-care use.</span></div>
    <div className="pc-tabs"><button className={mode === 'ask' || mode === 'simple' || mode === 'steps' ? 'selected' : ''} onClick={() => setMode('ask')}>Ask a protocol</button><button className={mode === 'search' ? 'selected' : ''} onClick={() => setMode('search')}>Search protocols</button></div>

    {mode === 'admin' ? <section className="pc-panel"><h2>Knowledge administration</h2><p>Uploads are indexed as drafts unless explicitly assigned another status. Only administrators can manage protocol content.</p>
      {error && <div className="pc-error" role="alert">{error}</div>}{notice && <div className="pc-success" role="status">{notice}</div>}
      <div className="pc-version-help"><strong>Uploading a new version:</strong> use the same document title, give this version a new unique Document ID (for example, <code>POLICY-001-V1.1</code>), enter the new version number, and choose the older version under “Supersedes version.” Upload as DRAFT to review first; set it to APPROVED or DEMO to activate it and deactivate the older version. To correct an uploaded version, re-upload using that version’s same ID, title, and version number.</div>
      <form className="pc-upload" onSubmit={submitUpload}><div className="pc-form-grid">
        {[['document_id','Document ID'],['title','Document title'],['version','Version'],['department','Department'],['category','Category'],['effective_date','Effective date'],['review_date','Review date'],['expiry_date','Expiry date']].map(([key,label])=><label key={key}>{label}<input type={key.endsWith('_date') ? 'date' : 'text'} required={['document_id','title'].includes(key)} value={meta[key] || ''} onChange={e=>setMeta({...meta,[key]:e.target.value})}/></label>)}
        <label>Supersedes version<select value={meta.supersedes_version || ''} onChange={e=>setMeta({...meta,supersedes_version:e.target.value})}><option value="">New document (no predecessor)</option>{supersedingCandidates.map(doc=><option key={doc.document_id} value={doc.version}>v{doc.version} · {doc.document_id}</option>)}</select></label>
        <label>Status<select value={meta.status} onChange={e=>setMeta({...meta,status:e.target.value})}><option>DRAFT</option><option>DEMO</option><option>APPROVED</option><option>ARCHIVED</option></select></label>
        <label className="pc-file">Protocol file (PDF, DOCX, TXT, Markdown)<input required type="file" accept=".pdf,.docx,.txt,.md,.markdown" onChange={e=>setFile(e.target.files?.[0] || null)}/></label>
      </div><button className="pc-primary" disabled={busy}><Upload size={16}/>{busy ? 'Indexing…' : 'Upload and index'}</button></form>
      <div className="pc-doc-list"><h3>Documents · {documents.length}</h3>{documents.map(doc=><div className="pc-doc-row" key={doc.document_id}><FileText size={17}/><div><strong>{doc.title}</strong><small>{doc.document_id} · v{doc.version} · {doc.department || 'Unassigned'} · {doc.ingestion_status}{doc.failure_detail ? ` · ${doc.failure_detail}` : ''}</small></div><span>{doc.chunk_count} sections</span><select aria-label={`Status for ${doc.title}`} value={doc.status} onChange={e=>changeDocument(doc,{status:e.target.value,approval_status:e.target.value})}><option>DEMO</option><option>DRAFT</option><option>APPROVED</option><option>SUPERSEDED</option><option>EXPIRED</option><option>ARCHIVED</option></select><button className="pc-link" onClick={()=>changeDocument(doc,{active:!doc.active})}>{doc.active ? 'Deactivate' : 'Activate'}</button><button className="pc-link" onClick={()=>reindexDocument(doc)} disabled={busy}>Reindex</button></div>)}</div>
    </section> : <>
      <section className="pc-panel">
        <div className="pc-input-head"><label htmlFor="pc-question">{mode === 'search' ? 'Search the protocol library' : 'Ask Hospital Protocol or SOP...'}</label><span>Protocol knowledge only · no patient records</span></div>
        <div className="pc-query"><textarea id="pc-question" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();mode==='search'?search():ask();}}} placeholder="Ask about medication safety, infection control, ICU procedures…" maxLength={1500}/><button className="pc-primary" disabled={busy || !question.trim()} onClick={mode==='search'?search:()=>ask()}>{busy?<RefreshCw className="pc-spin" size={16}/>:mode==='search'?<Search size={16}/>:<Send size={16}/>} {busy?'Searching…':mode==='search'?'Search':'Ask'}</button></div>
        {mode === 'search' && <div className="pc-filters">{[['department','Department'],['category','Category'],['document_id','Document'],['version','Version'],['status','Status']].map(([key,label])=><label key={key}>{label}{key === 'status' ? <select value={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">Any status</option><option>DEMO</option><option>APPROVED</option></select> : <select value={filters[key]} onChange={e=>setFilters({...filters,[key]:e.target.value})}><option value="">Any {label.toLowerCase()}</option>{[...new Set(documents.map(d=>key === 'document_id' ? d.document_id : d[key]).filter(Boolean))].map(value=><option key={value}>{value}</option>)}</select>}</label>)}</div>}
        {mode !== 'search' && <div className="pc-suggestions"><span>Try asking</span>{suggestions.map(text=><button key={text} onClick={()=>ask(text)}>{text}</button>)}</div>}
      </section>
      {error && <div className="pc-error" role="alert">{error}</div>}
      {mode === 'search' && (results.length > 0 ? <section className="pc-results"><h2>Search results</h2>{results.map((item,i)=><article className="pc-result" key={`${item.document_id}-${item.section}`}><div><strong>{item.document_title}</strong><span className="pc-status">{item.status}</span></div><p>{item.section_title} · {item.department} · v{item.version}</p><p className="pc-snippet">{item.snippet}</p><button className="pc-link" onClick={()=>openSource(item.document_id)}>View source</button></article>)}</section> : question && <div className="pc-empty">No matching protocol sections were found. Try a different term or filter.</div>)}
      {result && <section className="pc-answer" aria-live="polite"><div className="pc-answer-top"><div><span className={`pc-pill ${result.status.toLowerCase()}`}>{result.status.replaceAll('_',' ')}</span><h2>Protocol response</h2></div>{result.status === 'ANSWERED' && <div className="pc-training"><button onClick={()=>{setTrainingMode('simple');setQuiz(false);}}><GraduationCap size={15}/>Explain simply</button><button onClick={()=>{setTrainingMode('steps');setQuiz(false);}}>Step-by-step</button><button onClick={()=>{setQuiz(!quiz);setTrainingMode('answer');}}>Quiz me</button></div>}</div>
        <p className="pc-answer-text">{displayedText}</p>
        {result.warnings?.map((warning,i)=><div className="pc-warning" key={i}><ShieldAlert size={17}/>{warning}</div>)}
        {quiz && cited[0] && (()=>{const recall=buildRecallQuiz(result.answer,cited[0]);return <div className="pc-quiz"><strong>Recall check</strong><p>{recall.question}</p><details><summary>Show answer from the retrieved evidence</summary><p>{recall.answer}</p></details></div>;})()}
        {!!cited.length && <div className="pc-citations"><h3>Sources</h3>{cited.map((citation,i)=>{const display=formatCitation(citation);return <article className="pc-citation" key={`${citation.document_id}-${citation.section}-${i}`}><div><BookOpen size={17}/><strong>{display.title}</strong><span className="pc-status">{display.status}</span></div><p>{display.identity}</p><p>{display.location}</p><button className="pc-link" onClick={()=>openSource(citation.document_id)}>View source</button></article>;})}</div>}
      </section>}
    </>}
    {source && <div className="pc-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSource(null);}}><section className="pc-source-modal" role="dialog" aria-modal="true" aria-label="Protocol source"><button className="pc-close" onClick={()=>setSource(null)} aria-label="Close"><X size={18}/></button><span className="pc-eyebrow">SOURCE DOCUMENT · {source.status}</span><h2>{source.title}</h2><p>{source.document_id} · Version {source.version} · {source.department}</p><div className="pc-source-body">{source.sections?.map((section,i)=><article key={i}><h3>Section {section.section_number}: {section.section_title}</h3><pre>{section.content}</pre></article>)}</div></section></div>}
  </div>;
}
