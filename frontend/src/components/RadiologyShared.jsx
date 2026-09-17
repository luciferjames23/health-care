import React from 'react';

export const statusRank = { 'HIGH PRIORITY': 0, 'REVIEW FLAG': 1, 'ROUTINE': 2 };

export const statusStyle = (status) => ({
  color: status === 'HIGH PRIORITY' ? '#a52828' : status === 'REVIEW FLAG' ? '#8a5b00' : '#17606c',
  background: status === 'HIGH PRIORITY' ? '#fff0ef' : status === 'REVIEW FLAG' ? '#fff7df' : '#eaf7f8',
  border: `1px solid ${status === 'HIGH PRIORITY' ? '#f2c3bf' : status === 'REVIEW FLAG' ? '#efd99a' : '#b9dfe2'}`,
  borderRadius: 999, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap'
});

export function PageHeading({ crumb, title, subtitle, right }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
    <div>
      <div style={{ fontSize: 11, color: '#8a9096', marginBottom: 4 }}>Diagnostics · LIS & Imaging › {crumb}</div>
      <div style={{ fontSize: 20, fontWeight: 650 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: '#697077', marginTop: 3 }}>{subtitle}</div>
    </div>
    {right}
  </div>;
}

export function Card({ children, style = {} }) {
  return <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: 8, padding: 14, ...style }}>{children}</div>;
}

export function StatusBadge({ status = 'ROUTINE' }) { return <span style={statusStyle(status)}>{status}</span>; }

export function Loading({ text = 'Loading live radiology data…' }) {
  return <Card><div style={{ fontSize: 12, color: '#697077' }}>{text}</div></Card>;
}

export function ErrorBox({ error }) {
  return <Card style={{ borderColor: '#efc4c0', background: '#fff8f7' }}>
    <b style={{ fontSize: 12 }}>Radiology service unavailable</b>
    <div style={{ fontSize: 11.5, marginTop: 5, color: '#6f3b38' }}>{error}</div>
    <div style={{ fontSize: 11, marginTop: 6, color: '#8a5a57' }}>Start the included radiology backend on port 8001. Existing hospital modules are unaffected.</div>
  </Card>;
}

export function SummaryCards({ counts }) {
  const cards = [['Total Analyzed', counts?.total || 0], ['High Priority', counts?.high_priority || 0], ['Review Flag', counts?.review_flag || 0], ['Routine', counts?.routine || 0]];
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(120px,1fr))', gap: 10, marginBottom: 12 }}>
    {cards.map(([k, v]) => <Card key={k} style={{ padding: '11px 13px' }}><div style={{ fontSize: 10.5, color: '#777f86' }}>{k}</div><div style={{ fontSize: 22, fontWeight: 650, marginTop: 2 }}>{v}</div></Card>)}
  </div>;
}

export function Toolbar({ query, setQuery, filter, setFilter, sort, setSort, onRefresh }) {
  const filters = ['All', 'HIGH PRIORITY', 'REVIEW FLAG', 'ROUTINE'];
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 }}>
    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search study, patient, modality…" style={{ height: 30, minWidth: 220, flex: '1 1 220px', border: '1px solid #d9dddf', borderRadius: 6, padding: '0 9px', fontSize: 11.5, outline: 'none' }} />
    {filters.map(label => <button key={label} type="button" onClick={() => setFilter(label)} style={filter === label ? primaryBtn : btn}>{label}</button>)}
    <select value={sort} onChange={e => setSort(e.target.value)} style={{ height: 30, border: '1px solid #d9dddf', borderRadius: 6, padding: '0 8px', background: '#fff', fontSize: 11.5 }}>
      <option value="default">Default priority</option>
      <option value="probability">AI probability ↓</option>
      <option value="oldest">Oldest analyzed</option>
      <option value="newest">Newest analyzed</option>
    </select>
    <button type="button" onClick={onRefresh} style={btn}>Refresh</button>
  </div>;
}

export function StudyTable({ studies = [], onOpen }) {
  return <Card style={{ padding: 0, overflow: 'hidden' }}><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}><thead><tr style={{ background: '#f6f7f8', textAlign: 'left' }}>
    {['Priority', 'Study / Patient', 'Modality', 'AI Triage', 'AI Localization', 'Review', 'Action'].map(h => <th key={h} style={{ padding: '9px 10px', borderBottom: '1px solid #e3e6e8', fontSize: 10.5, color: '#596168' }}>{h}</th>)}
  </tr></thead><tbody>
    {studies.map(s => {
      const meta = s.metadata || {};
      const status = s.combined_assessment?.status || 'ROUTINE';
      const probability = Number(s.triage?.probability || 0);
      const regions = s.localization_summary?.number_of_regions ?? s.localization?.number_of_regions ?? 0;
      return <tr key={s.study_id} style={{ opacity: s.viewed ? 0.82 : 1 }}>
        <td style={cell}><StatusBadge status={status} /></td>
        <td style={cell}>
          <div style={{ fontWeight: 700, color: '#111827' }}>{s.display_study_id || meta.study_id_dicom || s.study_id?.slice(0, 12)}</div>
          {(s.patient_id || meta.patient_id_mapped) ? (
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0f5b66', marginTop: 2 }}>
              Patient ID: {s.patient_id || meta.patient_id_mapped}
              {(s.patient_code || meta.patient_code) ? ` (${s.patient_code || meta.patient_code})` : ''}
            </div>
          ) : null}
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
            {(s.patient_name || (meta.patient_name && meta.patient_name !== meta.patient_id)) ? (
              <span style={{ fontWeight: 600, color: '#374151' }}>{s.patient_name || meta.patient_name} · </span>
            ) : null}
            <span title="DICOM Patient UUID" style={{ fontFamily: 'monospace' }}>
              {s.original_patient_id || meta.patient_id || meta.PatientID || s.source_filename || 'DICOM study'}
            </span>
          </div>
        </td>
        <td style={cell}>{meta.modality || meta.Modality || 'CR/DX'}</td>
        <td style={cell}>{Math.round(probability * 100)}% <span style={{ color: '#8a9096' }}>(@ {s.triage?.threshold ?? 0.2})</span></td>
        <td style={cell}>{regions} suspected region(s){s.localization_summary?.highest_confidence != null ? <div style={{ fontSize: 10, color: '#7b8288' }}>max {Math.round(s.localization_summary.highest_confidence * 100)}%</div> : null}</td>
        <td style={cell}>{s.review_status || (s.viewed ? 'Viewed' : 'Pending')}</td>
        <td style={cell}><button type="button" onClick={() => onOpen(s.study_id)} style={btn}>View Analysis</button></td>
      </tr>;
    })}
    {!studies.length && <tr><td colSpan="7" style={{ padding: 24, textAlign: 'center', color: '#8a9096' }}>No matching radiology studies.</td></tr>}
  </tbody></table></div></Card>;
}

export function InfoRow({ label, value }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '145px 1fr', gap: 10, padding: '7px 0', borderBottom: '1px solid #eef0f1' }}><div style={{ fontSize: 10.5, color: '#7b8288' }}>{label}</div><div style={{ fontSize: 11.5, color: '#263238' }}>{value ?? '—'}</div></div>;
}

export const cell = { padding: 10, borderBottom: '1px solid #eef0f1', verticalAlign: 'top' };
export const btn = { height: 29, padding: '0 10px', borderRadius: 6, border: '1px solid #d9dddf', background: '#fff', cursor: 'pointer', fontSize: 11, color: '#263238' };
export const primaryBtn = { ...btn, border: 0, background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600 };
