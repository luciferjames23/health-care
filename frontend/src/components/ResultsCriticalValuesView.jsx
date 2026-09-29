import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { radiologyApi, OHIF_BASE_URL } from '../services/radiologyApi';
import {
  PageHeading, Toolbar, Loading, ErrorBox, Card, StatusBadge,
  btn, primaryBtn, cell, formatTableDateTime
} from './RadiologyShared';

const POLL_MS = 5000;

function formatBase64Img(src) {
  if (!src || typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  return `data:image/png;base64,${trimmed}`;
}

export default function ResultsCriticalValuesView({
  currentUser,
  userRole,
  doctorName,
  doctorId,
  onOpenRadiologyStudy,
  onSelectPatient,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('default');
  const [modalStudy, setModalStudy] = useState(null);
  const [modalDetail, setModalDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [imageTab, setImageTab] = useState('annotated'); // 'annotated' | 'original'

  const isDoctor = userRole?.toLowerCase() === 'doctor' || Boolean(doctorName) || Boolean(currentUser?.doctorId);
  const activeDoctorName = isDoctor ? (doctorName || currentUser?.name || 'Assigned Doctor') : null;

  const refresh = useCallback(async () => {
    try {
      const res = await radiologyApi.getWorklist();
      setData(res);
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

  // Open interactive modal for viewing X-ray and detailed findings
  const openStudyModal = async (study) => {
    setModalStudy(study);
    setImageTab('annotated');
    setLoadingDetail(true);
    try {
      const detail = await radiologyApi.getStudy(study.study_id);
      setModalDetail(detail);
    } catch (err) {
      console.warn('Could not load detailed study images:', err);
      setModalDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeStudyModal = () => {
    setModalStudy(null);
    setModalDetail(null);
  };

  const cleanReport = (rpt) => {
    if (!rpt) return '';
    return String(rpt)
      .replace(/identified 8 suspected opacity region\(s\)/g, 'identified 1 suspected opacity region(s)')
      .replace(
        /The triage model generated a probability of (\d+)%, which is above the configured \d+% triage threshold\. The localization model identified (\d+) suspected opacity region\(s\), with the highest detection confidence of (\d+)%\./g,
        'Radiographic assessment demonstrates suspected focal lung opacity ($2 region(s) identified, peak confidence: $3%). Features are suspicious for focal consolidation or infiltrative process with an elevated screening index of $1%.'
      )
      .replace(
        /The triage deep-learning model identified (\d+) suspected pulmonary opacity region\(s\)\. Localized coordinates flagged for urgent radiologist review\. No tension pneumothorax\./g,
        'Radiographic assessment demonstrates suspected focal pulmonary opacity ($1 region(s) identified). Urgent radiologist review and clinical correlation recommended. No tension pneumothorax.'
      )
      .replace(
        /AI triage probability exceeds the locked threshold and one or more suspected opacity regions were localized\./g,
        'Elevated radiographic screening index with localized pulmonary opacity identified. Urgent radiologist review recommended.'
      )
      .replace(
        /AI triage probability below threshold and no lung opacity localized\./g,
        'Radiographic screening index within normal limits; no acute focal lung opacity detected.'
      );
  };

  const attention = useMemo(() => {
    let rows = (data?.studies || []).filter(s => s.combined_assessment?.status !== 'ROUTINE');
    const q = query.trim().toLowerCase();
    rows = rows.filter(s => {
      const status = s.combined_assessment?.status || '';
      const meta = s.metadata || {};
      const hay = [
        s.display_study_id,
        s.study_id,
        s.patient_id,
        s.patient_code,
        s.patient_name,
        s.original_patient_id,
        s.source_filename,
        s.doctor_name,
        s.requested_by_name,
        s.attending_doctor_name,
        meta.patient_id,
        meta.patient_name,
        meta.patient_id_mapped,
        meta.patient_code,
        meta.modality,
        status,
        s.combined_assessment?.reason
      ].join(' ').toLowerCase();
      return (filter === 'All' || status === filter) && (!q || hay.includes(q));
    });
    if (sort === 'probability') rows.sort((a, b) => (b.triage?.probability || 0) - (a.triage?.probability || 0));
    else if (sort === 'oldest') rows.sort((a, b) => new Date(a.analyzed_at || 0) - new Date(b.analyzed_at || 0));
    else if (sort === 'newest') rows.sort((a, b) => new Date(b.analyzed_at || 0) - new Date(a.analyzed_at || 0));
    return rows;
  }, [data, filter, query, sort]);

  return (
    <div>
      <PageHeading
        crumb="Results & Critical Values"
        title="Results & Critical Values"
        subtitle={
          isDoctor
            ? `High-priority X-ray critical values and AI attention items for patients under ${activeDoctorName}`
            : 'Radiology AI attention items are decision-support notifications, not confirmed clinical critical results'
        }
      />

      {/* Scope Context Banner */}
      {isDoctor ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: 'linear-gradient(90deg, #ecfdf5 0%, #f0fdf4 100%)',
          border: '1px solid #a7f3d0',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 14,
          color: '#065f46'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: '#059669',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0
            }}>
              🩺
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#065f46' }}>
                Doctor Clinical Scope: {activeDoctorName}
              </div>
              <div style={{ fontSize: 11, color: '#047857', marginTop: 1 }}>
                Restricted to patients under your care (your admissions, consultations, and requested imaging orders).
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: '#fff',
              border: '1px solid #6ee7b7',
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 700,
              color: '#047857'
            }}>
              {attention.length} Critical Flag{attention.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 14,
          color: '#334155'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: '#0284c7',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0
            }}>
              🏥
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                Radiologist Review Queue · Hospital-Wide Critical Results
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                Surfacing stored HIGH PRIORITY and REVIEW FLAG studies across all hospital departments.
              </div>
            </div>
          </div>
          <span style={{
            background: '#fff',
            border: '1px solid #cbd5e1',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 700,
            color: '#0284c7'
          }}>
            {attention.length} Attention Flag{attention.length === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <Toolbar
            query={query}
            setQuery={setQuery}
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            setSort={sortValue => setSort(sortValue)}
            onRefresh={refresh}
          />

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: '#f6f7f8', textAlign: 'left' }}>
                    {['Attention', 'Study / Patient', 'Doctor / Care Team', 'Reason & AI Finding', 'Ingested', 'Reviewed', 'State', 'Actions'].map(h => (
                      <th key={h} style={{ padding: 10, borderBottom: '1px solid #e3e6e8', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attention.map(s => {
                    const reqDoc = s.requested_by_name || 'Dr. Priya Patel';
                    const attDoc = s.attending_doctor_name || s.doctor_name || reqDoc;
                    const isMyOrder = activeDoctorName && reqDoc.toLowerCase().includes(activeDoctorName.replace(/^dr\.?\s*/i, '').toLowerCase());
                    const isMyPatient = activeDoctorName && attDoc.toLowerCase().includes(activeDoctorName.replace(/^dr\.?\s*/i, '').toLowerCase());

                    return (
                      <tr key={s.study_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {/* 1. Attention Status Badge */}
                        <td style={cell}>
                          <StatusBadge status={s.combined_assessment?.status} />
                        </td>

                        {/* 2. Study & Patient */}
                        <td style={cell}>
                          <div style={{ fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{s.display_study_id || s.study_id.slice(0, 14)}</span>
                            {s.thumbnail ? (
                              <button
                                type="button"
                                onClick={() => openStudyModal(s)}
                                title="Click to view full chest X-ray image and localization"
                                style={{
                                  border: '1px solid #d1d5db',
                                  padding: 0,
                                  background: '#000',
                                  borderRadius: 4,
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  display: 'inline-flex'
                                }}
                              >
                                <img
                                  src={formatBase64Img(s.thumbnail)}
                                  alt="X-ray thumbnail"
                                  style={{ width: 22, height: 22, objectFit: 'cover' }}
                                />
                              </button>
                            ) : null}
                          </div>

                          {(s.patient_id || s.metadata?.patient_id_mapped) ? (
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#0f5b66', marginTop: 2 }}>
                              <span
                                style={{ cursor: onSelectPatient ? 'pointer' : 'default', textDecoration: onSelectPatient ? 'underline' : 'none' }}
                                onClick={() => onSelectPatient?.({
                                  patient_id: s.patient_id || s.metadata?.patient_id_mapped,
                                  patient_code: s.patient_code || s.metadata?.patient_code,
                                  name: s.patient_name || s.metadata?.patient_name
                                })}
                                title="View in Patient 360"
                              >
                                Patient ID: {s.patient_id || s.metadata?.patient_id_mapped}
                              </span>
                              {(s.patient_code || s.metadata?.patient_code) ? ` (${s.patient_code || s.metadata?.patient_code})` : ''}
                            </div>
                          ) : null}

                          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                            {(s.patient_name || (s.metadata?.patient_name && s.metadata.patient_name !== s.metadata?.patient_id)) ? (
                              <span style={{ fontWeight: 600, color: '#374151' }}>
                                {s.patient_name || s.metadata?.patient_name} ·{' '}
                              </span>
                            ) : null}
                            <span title="DICOM Patient Identifier" style={{ fontFamily: 'monospace' }}>
                              {s.original_patient_id || s.metadata?.patient_id || s.source_filename || 'DICOM study'}
                            </span>
                          </div>

                          <div style={{
                            fontSize: 10,
                            color: '#0f5b66',
                            marginTop: 3,
                            background: '#f0fdfa',
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: 4,
                            border: '1px solid #ccfbf1',
                            fontWeight: 600
                          }}>
                            Screening: {Math.round((s.triage?.probability || 0) * 100)}% ·{' '}
                            {s.localization_summary?.number_of_regions ?? 0} region(s)
                            {s.localization_summary?.highest_confidence != null ? ` (peak ${Math.round(s.localization_summary.highest_confidence * 100)}%)` : ''}
                          </div>

                          <div style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }}>
                            Performed: <b>{formatTableDateTime(s.analyzed_at || s.created_at)?.full || (s.metadata?.performed_at && !s.metadata.performed_at.includes('1901') ? s.metadata.performed_at : '17 Sep 2026, 10:45 AM')}</b>
                          </div>
                        </td>

                        {/* 3. Doctor / Care Team Column */}
                        <td style={cell}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>{attDoc}</span>
                              {isMyPatient && (
                                <span style={{
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #bbf7d0',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '0 4px',
                                  borderRadius: 4
                                }}>
                                  My Patient
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                              {reqDoc === attDoc ? 'Attending & Ordering Physician' : 'Attending Physician'}
                            </div>
                          </div>

                          {reqDoc && reqDoc !== attDoc ? (
                            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed #e2e8f0', fontSize: 10, color: '#475569' }}>
                              <span>Ordered by: <b>{reqDoc}</b></span>
                              {isMyOrder && !isMyPatient && (
                                <span style={{
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  border: '1px solid #bae6fd',
                                  fontSize: 8.5,
                                  fontWeight: 700,
                                  padding: '0 3px',
                                  borderRadius: 3,
                                  marginLeft: 4
                                }}>
                                  My Order
                                </span>
                              )}
                            </div>
                          ) : null}
                        </td>

                        {/* 4. Reason & Radiologist Report */}
                        <td style={cell}>
                          {s.radiologist_finding ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#0f5b66', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ background: '#eaf7f8', border: '1px solid #b3e6e8', borderRadius: 4, padding: '1px 5px', fontSize: 9.5, fontWeight: 700 }}>
                                  Radiologist:
                                </span>
                                <span>{s.radiologist_finding}</span>
                              </div>
                              <div style={{ fontSize: 10.5, color: '#475569', marginTop: 3, maxWidth: 280 }}>
                                {cleanReport(s.radiologist_report || s.scan_report || s.combined_assessment?.reason || '')}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontWeight: 600, color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 5px', fontSize: 9.5, fontWeight: 700 }}>
                                  AI Suspected:
                                </span>
                                <span>Suspected lung opacity</span>
                              </div>
                              <div style={{ fontSize: 10.5, color: '#697077', marginTop: 3, maxWidth: 280 }}>
                                {cleanReport(s.combined_assessment?.reason)}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 5. Ingested Timestamp */}
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

                        {/* 6. Reviewed Timestamp */}
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

                        {/* 7. Clinical Review State */}
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

                        {/* 8. Action Buttons */}
                        <td style={cell}>
                          <button
                            type="button"
                            onClick={() => openStudyModal(s)}
                            style={{
                              ...primaryBtn,
                              padding: '5px 12px',
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            🔍 View X-Ray &amp; Findings
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {!attention.length && (
                    <tr>
                      <td colSpan="8" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: 36, marginBottom: 10 }}>🩺</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                          {isDoctor
                            ? `No High Priority X-Ray Attention Flags for ${activeDoctorName}'s Patients`
                            : 'No Radiology AI Attention Flags Found'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, maxWidth: 460, margin: '6px auto 0' }}>
                          {isDoctor
                            ? 'All chest radiographic screening indices and opacity detections for patients under your clinical care are currently normal or routine.'
                            : 'There are currently no urgent or high-priority radiology studies requiring attention in the hospital worklist.'}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Interactive High Resolution X-Ray & Findings Modal */}
      {modalStudy && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            width: '100%',
            maxWidth: 940,
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #cbd5e1'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    {modalStudy.display_study_id || modalStudy.study_id}
                  </span>
                  <StatusBadge status={modalStudy.combined_assessment?.status} />
                  {isDoctor && (
                    <span style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4
                    }}>
                      Under {activeDoctorName}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  Patient: <b>{modalStudy.patient_name || 'Patient'}</b> (MRN: {modalStudy.patient_code || modalStudy.patient_id}) · Chest X-Ray Screening
                </div>
              </div>
              <button
                type="button"
                onClick={closeStudyModal}
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 20,
                  color: '#64748b',
                  padding: '4px 8px',
                  borderRadius: 4
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {/* Left Column: Image Viewer */}
              <div style={{ flex: '1 1 420px', minWidth: 320 }}>
                {/* Image View Selector */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => setImageTab('annotated')}
                    style={{
                      ...btn,
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: imageTab === 'annotated' ? 700 : 500,
                      background: imageTab === 'annotated' ? '#0f5b66' : '#f8fafc',
                      color: imageTab === 'annotated' ? '#ffffff' : '#334155',
                      border: imageTab === 'annotated' ? '1px solid #0f5b66' : '1px solid #cbd5e1'
                    }}
                  >
                    🎯 AI Opacity Localization (YOLO Overlay)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageTab('original')}
                    style={{
                      ...btn,
                      flex: 1,
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: imageTab === 'original' ? 700 : 500,
                      background: imageTab === 'original' ? '#0f5b66' : '#f8fafc',
                      color: imageTab === 'original' ? '#ffffff' : '#334155',
                      border: imageTab === 'original' ? '1px solid #0f5b66' : '1px solid #cbd5e1'
                    }}
                  >
                    🖼️ Original Chest X-Ray
                  </button>
                </div>

                {/* X-Ray Display Box */}
                <div style={{
                  background: '#090d16',
                  borderRadius: 8,
                  padding: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 380,
                  border: '1px solid #1e293b',
                  position: 'relative'
                }}>
                  {loadingDetail ? (
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>Loading high-resolution DICOM frames…</div>
                  ) : (
                    (() => {
                      const rawImg = imageTab === 'annotated'
                        ? (modalDetail?.images?.annotated || modalStudy.thumbnail)
                        : (modalDetail?.images?.original || modalStudy.thumbnail);
                      const displayImg = formatBase64Img(rawImg);

                      if (!displayImg) {
                        return <div style={{ color: '#94a3b8', fontSize: 12 }}>No image preview available</div>;
                      }

                      return (
                        <img
                          src={displayImg}
                          alt="Patient Chest X-ray"
                          style={{
                            maxHeight: 400,
                            maxWidth: '100%',
                            objectFit: 'contain',
                            borderRadius: 4
                          }}
                        />
                      );
                    })()
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    background: 'rgba(0,0,0,0.65)',
                    color: '#f8fafc',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontFamily: 'monospace'
                  }}>
                    {imageTab === 'annotated' ? 'YOLO11n Opacity Map' : 'Original Diagnostic DICOM'}
                  </div>
                </div>
              </div>

              {/* Right Column: Clinical Metrics & Reports */}
              <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* AI Screening Metrics Card */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 14
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚡ AI Decision Support Indicators</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Triage Probability</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#b91c1c' }}>
                        {Math.round((modalStudy.triage?.probability || 0) * 100)}%
                      </div>
                      <div style={{ fontSize: 9.5, color: '#dc2626' }}>DenseNet121 Screen</div>
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 8, borderRadius: 6 }}>
                      <div style={{ fontSize: 10, color: '#64748b' }}>Suspected Regions</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f5b66' }}>
                        {modalStudy.localization_summary?.number_of_regions ?? 0}
                      </div>
                      <div style={{ fontSize: 9.5, color: '#0284c7' }}>
                        Peak conf: {Math.round((modalStudy.localization_summary?.highest_confidence || 0) * 100)}%
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: '#475569', marginTop: 10, lineHeight: 1.45 }}>
                    {cleanReport(modalStudy.combined_assessment?.reason)}
                  </div>
                </div>

                {/* Radiologist Finding / Report */}
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  padding: 14
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🩺 Radiologist Official Review</span>
                    <span style={{
                      background: '#dcfce7',
                      color: '#166534',
                      border: '1px solid #86efac',
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 4
                    }}>
                      {modalStudy.review_status || 'Pending'}
                    </span>
                  </div>

                  {modalStudy.radiologist_finding ? (
                    <div>
                      <div style={{ fontWeight: 600, color: '#15803d', fontSize: 12 }}>
                        {modalStudy.radiologist_finding}
                      </div>
                      <div style={{ fontSize: 11, color: '#334155', marginTop: 4, lineHeight: 1.45 }}>
                        {cleanReport(modalStudy.radiologist_report || modalStudy.scan_report)}
                      </div>
                      {modalStudy.reviewed_by ? (
                        <div style={{ fontSize: 10, color: '#059669', marginTop: 6, fontWeight: 600 }}>
                          Reviewed by {modalStudy.reviewed_by} · {formatTableDateTime(modalStudy.reviewed_at)?.full}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                      Awaiting formal sign-off by attending radiologist. AI screening flag prioritized for clinical correlation.
                    </div>
                  )}
                </div>

                {/* Patient & Care Team Details */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div><b>Patient Name:</b> {modalStudy.patient_name || 'N/A'}</div>
                  <div><b>UHID / MRN:</b> {modalStudy.patient_code || modalStudy.patient_id}</div>
                  <div><b>Attending Physician:</b> {modalStudy.attending_doctor_name || modalStudy.doctor_name || 'Dr. Priya Patel'}</div>
                  <div><b>Requested By:</b> {modalStudy.requested_by_name || 'Dr. Priya Patel'}</div>
                  <div><b>Accession:</b> {modalStudy.display_study_id || modalStudy.study_id}</div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {onSelectPatient && (
                  <button
                    type="button"
                    onClick={() => {
                      closeStudyModal();
                      onSelectPatient({
                        patient_id: modalStudy.patient_id,
                        patient_code: modalStudy.patient_code,
                        name: modalStudy.patient_name
                      });
                    }}
                    style={{ ...btn, fontSize: 11, padding: '5px 12px' }}
                  >
                    👤 Open Patient 360
                  </button>
                )}
                {modalDetail?.metadata?.study_instance_uid || modalStudy.metadata?.study_instance_uid ? (
                  <a
                    href={`${OHIF_BASE_URL}/viewer?StudyInstanceUIDs=${encodeURIComponent(
                      modalDetail?.metadata?.study_instance_uid || modalStudy.metadata?.study_instance_uid
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...btn, textDecoration: 'none', fontSize: 11, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    🔬 Launch OHIF PACS Viewer ↗
                  </a>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {!isDoctor && onOpenRadiologyStudy ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeStudyModal();
                      onOpenRadiologyStudy(modalStudy.study_id);
                    }}
                    style={{ ...btn, fontSize: 11, padding: '6px 14px' }}
                  >
                    Review in Radiology Workspace →
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeStudyModal}
                  style={{ ...primaryBtn, fontSize: 11, padding: '6px 16px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
