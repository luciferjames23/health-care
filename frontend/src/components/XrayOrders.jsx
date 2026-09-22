import React, { useCallback, useEffect, useRef, useState } from 'react';
import { imagingOrdersApi } from '../services/imagingOrdersApi';
import { OHIF_BASE_URL } from '../services/radiologyApi';
import { Card, btn, primaryBtn } from './RadiologyShared';

export default function XrayOrders({ patient, radiologist = false }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [patientReview, setPatientReview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [examination, setExamination] = useState('Chest X-ray PA');
  const [priority, setPriority] = useState('Routine');
  const [indication, setIndication] = useState('');
  const requestId = useRef(null);
  const patientId = patient?.patient_id;
  const refresh = useCallback(async () => {
    if (!radiologist && !patientId) { setLoading(false); return; }
    try { setOrders((await imagingOrdersApi.list(patientId)).orders); setError(''); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [patientId, radiologist]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 10000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => { requestId.current = null; setIndication(''); setMessage(''); setSelected(null); setFile(null); }, [patientId]);

  useEffect(() => { setPatientReview(null); setConfirmed(false); }, [file, selected?.order_id]);

  const create = async e => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    requestId.current ||= crypto.randomUUID();
    try {
      const order = await imagingOrdersApi.create({ patient_id: Number(patientId), examination, priority, indication, request_id: requestId.current });
      setMessage(`Order ${order.accession_number} sent to Radiology.`);
      setIndication(''); requestId.current = null;
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const upload = async e => {
    e.preventDefault(); if (!selected || !file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await imagingOrdersApi.upload(selected.order_id, file, Boolean(patientReview && confirmed));
      setMessage(`${selected.accession_number}: X-ray uploaded to Orthanc.`);
      setSelected(null); setFile(null); await refresh();
    } catch (e) {
      if (e.detail?.code === 'patient_mapping_required') { setPatientReview(e.detail); setConfirmed(false); }
      setError(e.message);
    }
    finally { setBusy(false); }
  };
  const input = { padding: 8, border: '1px solid #d9dddf', borderRadius: 6, font: 'inherit' };
  return <Card>
    <h3 style={{ marginTop: 0 }}>{radiologist ? 'Requested X-rays' : 'Request an X-ray'}</h3>
    <p style={{ fontSize: 12, color: '#52585e' }}>{radiologist ? 'Requests from doctors. Select an order, confirm the patient, then upload the DICOM X-ray to Orthanc.' : `Patient: ${patient?.name || patient?.patient_name || '—'} · ${patient?.uhid || patientId || 'No patient selected'}`}</p>
    {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
    {message && <p role="status" style={{ color: '#047857' }}>{message}</p>}
    {!radiologist && patientId && <form onSubmit={create} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
      <label>Examination <select style={input} value={examination} disabled={busy} onChange={e => { setExamination(e.target.value); requestId.current = null; }}>{['Chest X-ray PA', 'Chest X-ray AP'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Priority <select style={input} value={priority} disabled={busy} onChange={e => { setPriority(e.target.value); requestId.current = null; }}><option>Routine</option><option>Urgent</option></select></label>
      <label>Clinical indication<textarea style={{ ...input, display: 'block', width: '100%', boxSizing: 'border-box' }} required minLength={3} maxLength={2000} value={indication} disabled={busy} onChange={e => { setIndication(e.target.value); requestId.current = null; }} /></label>
      <button style={{ ...primaryBtn, justifySelf: 'start' }} disabled={busy || indication.trim().length < 3}>{busy ? 'Sending…' : 'Send X-ray request'}</button>
    </form>}
    {loading ? <p>Loading requests…</p> : !orders.length ? <p>No X-ray requests yet.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
      <thead><tr>{['Accession / requested', 'Patient', 'Examination / indication', 'Requested by', 'Priority', 'Status', 'Action'].map(label => <th key={label} style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #ddd' }}>{label}</th>)}</tr></thead>
      <tbody>{orders.map(order => <tr key={order.order_id}>
        <td style={{ padding: 8 }}>{order.accession_number}<br />{new Date(order.created_at).toLocaleString()}</td>
        <td>{order.patient_name}<br />{order.patient_code}</td><td>{order.examination}<br />{order.indication}</td><td>{order.requested_by_name}</td><td>{order.priority}</td><td>{order.status}</td>
        <td>{radiologist && order.status !== 'Uploaded' && <button type="button" style={btn} disabled={busy} onClick={() => { setSelected(order); setFile(null); setError(''); }}>Upload X-ray</button>}
          {radiologist && order.status === 'Uploaded' && order.study_instance_uid && <a href={`${OHIF_BASE_URL}/viewer?StudyInstanceUIDs=${encodeURIComponent(order.study_instance_uid)}`} target="_blank" rel="noreferrer">Open in OHIF</a>}</td>
      </tr>)}</tbody>
    </table></div>}
    {radiologist && selected && <form onSubmit={upload} style={{ padding: 16, marginTop: 16, border: '1px solid #b2dfdf', borderRadius: 8 }}>
      <b>Upload for {selected.patient_name} · {selected.patient_code}</b>
      <p>{selected.accession_number} · {selected.examination}</p>
      <p style={{ fontSize: 12 }}>DICOM PatientID must match {selected.patient_code}, {selected.patient_id}, or a registered DICOM ID for this patient. New IDs require patient verification below before upload. Accession must be blank or {selected.accession_number}. CR/DX DICOM only, up to 30 MB.</p>
      <input key={selected.order_id} aria-label="X-ray DICOM file" type="file" accept=".dcm,application/dicom" required disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} />
      {patientReview && <section aria-label="Verify image patient" style={{ marginTop: 12, padding: 12, background: '#fff8e6', borderRadius: 6 }}>
        <b>Verify this image belongs to the order patient</b>
        <p>Order: {selected.patient_name} · {selected.patient_code} · {selected.accession_number}</p>
        <p>DICOM PatientID: {patientReview.dicom_patient_id}<br />
          Name: {patientReview.dicom_patient_name || 'Not provided'}<br />
          Date of birth: {patientReview.dicom_patient_birth_date || 'Not provided'} · Sex: {patientReview.dicom_patient_sex || 'Not provided'}</p>
        <p>Check the acquisition record or source image to verify identity. An unknown or anonymized ID alone does not establish a match.</p>
        <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> I verified that this image belongs to {selected.patient_name} ({selected.patient_code}). Register this DICOM ID for this patient.</label>
        <p style={{ fontSize: 12 }}>Your confirmation is recorded with your account, this order, and this file.</p>
      </section>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button disabled={busy || !file || (patientReview && !confirmed)} style={primaryBtn}>{busy ? 'Uploading…' : patientReview ? 'Confirm patient and upload' : 'Upload to Orthanc'}</button><button type="button" style={btn} disabled={busy} onClick={() => setSelected(null)}>Cancel</button></div>
    </form>}
  </Card>;
}
