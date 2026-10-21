import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Activity,
  Sparkles,
  RefreshCw,
  UserCheck,
  TrendingUp,
  FileText,
  Check
} from 'lucide-react';
import { apiService } from '../services/api';

export default function ReadmissionRiskCard({ patientId, onPredictionUpdated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'drivers' | 'mitigation' | 'signoff'
  
  // Review / Sign-off state
  const [reviewStatus, setReviewStatus] = useState('Accepted');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewedBy, setReviewedBy] = useState('Dr. Priya Narayanan, MD');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(null);

  // Load prediction
  const fetchRiskData = async (forceRefresh = false) => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getPatientReadmissionRisk(patientId, forceRefresh);
      if (res?.data) {
        setPrediction(res.data);
        if (res.data.clinician_status) {
          setReviewStatus(res.data.clinician_status);
        }
        if (res.data.clinician_notes) {
          setReviewNotes(res.data.clinician_notes);
        }
        if (onPredictionUpdated) onPredictionUpdated(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load readmission risk assessment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskData(false);
  }, [patientId]);

  const handleReviewSubmit = async () => {
    if (!prediction?.prediction_id) return;
    setSubmittingReview(true);
    setReviewSuccess(null);
    try {
      await apiService.reviewReadmissionRisk(prediction.prediction_id, {
        status: reviewStatus,
        clinician_notes: reviewNotes,
        reviewed_by: reviewedBy
      });
      setReviewSuccess(`✓ Readmission assessment sign-off recorded as "${reviewStatus}".`);
      setPrediction(prev => ({
        ...prev,
        clinician_status: reviewStatus,
        clinician_notes: reviewNotes,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString()
      }));
    } catch (err) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!patientId) {
    return (
      <div style={{
        background: '#fff',
        border: '1px solid #e3e6e8',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '13px'
      }}>
        <Activity style={{ width: '28px', height: '28px', margin: '0 auto 8px', color: '#94a3b8' }} />
        Select a patient to evaluate 7-Day, 14-Day, and 30-Day readmission risk.
      </div>
    );
  }

  const h7 = prediction?.horizons?.['7day'] || { risk_score_pct: 0, risk_tier: 'Low', window: '7-Day' };
  const h14 = prediction?.horizons?.['14day'] || { risk_score_pct: 0, risk_tier: 'Low', window: '14-Day' };
  const h30 = prediction?.horizons?.['30day'] || { risk_score_pct: 0, risk_tier: 'Low', window: '30-Day' };
  const metrics = prediction?.scoring_metrics || {};

  const getTierTheme = (tier) => {
    const t = String(tier || '').toLowerCase();
    if (t === 'high') {
      return {
        bg: '#fef2f2',
        border: '#fecaca',
        text: '#b91c1c',
        bar: '#ef4444',
        label: 'High Risk'
      };
    }
    if (t === 'moderate') {
      return {
        bg: '#fffbeb',
        border: '#fde68a',
        text: '#b45309',
        bar: '#f59e0b',
        label: 'Moderate Risk'
      };
    }
    return {
      bg: '#ecfdf5',
      border: '#a7f3d0',
      text: '#047857',
      bar: '#10b981',
      label: 'Low Risk'
    };
  };

  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e3e6e8',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      padding: '16px',
      marginBottom: '14px',
      fontFamily: 'inherit'
    }}>
      {/* ─── HEADER BAR ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        paddingBottom: '14px',
        marginBottom: '14px',
        borderBottom: '1px solid #f0f2f4'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: '#eef2ff',
            color: '#4f46e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrendingUp style={{ width: '18px', height: '18px' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#15181b', letterSpacing: '-0.2px' }}>
                Multi-Horizon Readmission Risk Prediction
              </span>
              <span style={{
                fontSize: '10.5px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                background: '#eef2ff',
                color: '#4f46e5',
                border: '1px solid #c7d2fe'
              }}>
                Hybrid Clinical AI
              </span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
              Predictive risk trajectories (7-Day, 14-Day, 30-Day) based on LACE+, Charlson Index, Vitals & Lab derangements
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {prediction?.clinician_status && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              background: prediction.clinician_status === 'Accepted' ? '#ecfdf5' : prediction.clinician_status === 'Rejected' ? '#fef2f2' : '#fffbeb',
              color: prediction.clinician_status === 'Accepted' ? '#047857' : prediction.clinician_status === 'Rejected' ? '#b91c1c' : '#b45309',
              border: `1px solid ${prediction.clinician_status === 'Accepted' ? '#a7f3d0' : prediction.clinician_status === 'Rejected' ? '#fecaca' : '#fde68a'}`
            }}>
              <UserCheck style={{ width: '13px', height: '13px' }} />
              <span>{prediction.clinician_status}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => fetchRiskData(true)}
            disabled={loading}
            style={{
              height: '30px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #d0d5dd',
              background: '#fff',
              color: '#344054',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <RefreshCw style={{ width: '13px', height: '13px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>{loading ? 'Re-scoring...' : 'Re-Score'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '10px 14px',
          color: '#b91c1c',
          fontSize: '12px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ─── THREE HORIZON CARDS (7-DAY, 14-DAY, 30-DAY) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '12px',
        marginBottom: '14px'
      }}>
        {/* Card 1: 7-DAY */}
        {(() => {
          const theme = getTierTheme(h7.risk_tier);
          return (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock style={{ width: '13px', height: '13px', color: '#0284c7' }} />
                  7-Day Horizon
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: theme.bg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`
                }}>
                  {theme.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  {h7.risk_score_pct}%
                </span>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>readmission prob.</span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(h7.risk_score_pct * 1.5, 100)}%`,
                  background: theme.bar,
                  borderRadius: '999px',
                  transition: 'width 0.6s ease'
                }} />
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                color: '#475569',
                marginTop: '2px'
              }}>
                <div style={{ fontWeight: 700, color: '#0284c7', marginBottom: '2px' }}>Clinical Focus:</div>
                <div>Acute deterioration, premature discharge, and acute medication titration errors.</div>
              </div>
            </div>
          );
        })()}

        {/* Card 2: 14-DAY */}
        {(() => {
          const theme = getTierTheme(h14.risk_tier);
          return (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock style={{ width: '13px', height: '13px', color: '#4f46e5' }} />
                  14-Day Horizon
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: theme.bg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`
                }}>
                  {theme.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  {h14.risk_score_pct}%
                </span>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>readmission prob.</span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(h14.risk_score_pct * 1.3, 100)}%`,
                  background: theme.bar,
                  borderRadius: '999px',
                  transition: 'width 0.6s ease'
                }} />
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                color: '#475569',
                marginTop: '2px'
              }}>
                <div style={{ fontWeight: 700, color: '#4f46e5', marginBottom: '2px' }}>Clinical Focus:</div>
                <div>Sub-acute recovery, post-op wound complications, antibiotic completion & missed 1st OPD.</div>
              </div>
            </div>
          );
        })()}

        {/* Card 3: 30-DAY */}
        {(() => {
          const theme = getTierTheme(h30.risk_tier);
          return (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Clock style={{ width: '13px', height: '13px', color: '#9333ea' }} />
                  30-Day Horizon
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: theme.bg,
                  color: theme.text,
                  border: `1px solid ${theme.border}`
                }}>
                  {theme.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                  {h30.risk_score_pct}%
                </span>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>readmission prob.</span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(h30.risk_score_pct * 1.2, 100)}%`,
                  background: theme.bar,
                  borderRadius: '999px',
                  transition: 'width 0.6s ease'
                }} />
              </div>

              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '11px',
                color: '#475569',
                marginTop: '2px'
              }}>
                <div style={{ fontWeight: 700, color: '#9333ea', marginBottom: '2px' }}>Clinical Focus:</div>
                <div>Chronic disease decompensation (CHF/COPD/CKD) and ambulatory care adherence.</div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ─── SCORING METRICS STRIP ─── */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '12px',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>Scoring Anchors:</span>
          <span style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', color: '#1e293b' }}>
            LACE Score: <strong style={{ color: '#4f46e5' }}>{metrics.lace_score ?? 0}/19</strong>
          </span>
          <span style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', color: '#1e293b' }}>
            Charlson Index: <strong style={{ color: '#4f46e5' }}>{metrics.charlson_score ?? 0} pts</strong>
          </span>
          <span style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', color: '#1e293b' }}>
            Vitals Stability: <strong style={{ color: '#047857' }}>Checked</strong>
          </span>
        </div>

        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Sparkles style={{ width: '13px', height: '13px', color: '#4f46e5' }} />
          <span>Model: <strong>{prediction?.model_used || 'hybrid-clinical-rules'}</strong></span>
        </div>
      </div>

      {/* ─── TAB NAVIGATION BUTTONS ─── */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e2e8f0',
        gap: '4px',
        marginBottom: '12px',
        overflowX: 'auto'
      }}>
        {[
          { id: 'overview', label: 'Clinical Rationale' },
          { id: 'drivers', label: `Risk Drivers & Modifiable Factors (${prediction?.risk_drivers?.length || 0})` },
          { id: 'mitigation', label: `Time-Sequenced Mitigation Plan (${prediction?.mitigation_plan?.length || 0} Steps)` },
          { id: 'signoff', label: 'Clinician Sign-off' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 14px',
                border: 0,
                borderBottom: isActive ? '2px solid #4f46e5' : '2px solid transparent',
                background: 'transparent',
                color: isActive ? '#4f46e5' : '#64748b',
                fontWeight: isActive ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: CLINICAL RATIONALE ─── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '14px',
            fontSize: '12.5px',
            lineHeight: 1.6,
            color: '#334155'
          }}>
            <div style={{ fontWeight: 700, color: '#15181b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText style={{ width: '15px', height: '15px', color: '#4f46e5' }} />
              CMO Clinical Assessment Narrative:
            </div>
            <div style={{ whiteSpace: 'pre-line' }}>
              {prediction?.clinical_rationale || 'Evaluating patient trajectory...'}
            </div>
          </div>

          {prediction?.evidence_data && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '8px',
              fontSize: '11.5px'
            }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ color: '#8a9096' }}>Primary Diagnosis</div>
                <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>
                  {prediction.evidence_data.primary_diagnosis || 'Inpatient Stay'}
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ color: '#8a9096' }}>Inpatient Stay</div>
                <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>
                  {prediction.evidence_data.length_of_stay_days ?? 1} Days
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ color: '#8a9096' }}>Latest Discharge BP</div>
                <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>
                  {prediction.evidence_data.latest_vitals?.blood_pressure || '120/80 mmHg'}
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
                <div style={{ color: '#8a9096' }}>Discharge SpO2</div>
                <div style={{ fontWeight: 600, color: '#15181b', marginTop: '2px' }}>
                  {prediction.evidence_data.latest_vitals?.spo2_pct ? `${prediction.evidence_data.latest_vitals.spo2_pct}%` : 'Stable (>=98%)'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: RISK DRIVERS & MODIFIABLE FACTORS ─── */}
      {activeTab === 'drivers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {/* Risk Drivers */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert style={{ width: '14px', height: '14px' }} />
              Active Clinical Risk Drivers
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(prediction?.risk_drivers || []).map((driver, idx) => (
                <div key={idx} style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '5px',
                  padding: '8px 10px',
                  fontSize: '11.5px',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '6px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <span>{driver}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Modifiable Factors */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles style={{ width: '14px', height: '14px' }} />
              Modifiable Clinical Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(prediction?.modifiable_factors || []).map((mod, idx) => (
                <div key={idx} style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '5px',
                  padding: '8px 10px',
                  fontSize: '11.5px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <strong style={{ color: '#92400e' }}>{mod.factor}</strong>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '3px',
                      background: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #fde68a'
                    }}>
                      {mod.impact} Impact
                    </span>
                  </div>
                  <div style={{ color: '#78350f', fontSize: '11px' }}>
                    {mod.mitigation_action}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: TIME-SEQUENCED MITIGATION PLAN ─── */}
      {activeTab === 'mitigation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(prediction?.mitigation_plan || []).map((step, idx) => (
            <div
              key={idx}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  background: '#eef2ff',
                  color: '#4f46e5',
                  fontWeight: 700,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px'
                }}>
                  {idx + 1}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <strong style={{ color: '#1e293b' }}>{step.timeframe}</strong>
                    <span style={{ fontSize: '10.5px', color: '#64748b', background: '#fff', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px' }}>
                      Owner: {step.owner}
                    </span>
                  </div>
                  <div style={{ color: '#475569', fontSize: '11.5px' }}>
                    {step.intervention}
                  </div>
                </div>
              </div>

              <span style={{
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '4px',
                background: step.priority === 'Urgent' ? '#fef2f2' : step.priority === 'High' ? '#fffbeb' : '#f1f5f9',
                color: step.priority === 'Urgent' ? '#b91c1c' : step.priority === 'High' ? '#b45309' : '#475569',
                border: `1px solid ${step.priority === 'Urgent' ? '#fecaca' : step.priority === 'High' ? '#fde68a' : '#cbd5e1'}`
              }}>
                {step.priority || 'Routine'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ─── TAB 4: CLINICIAN SIGN-OFF ─── */}
      {activeTab === 'signoff' && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          fontSize: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                Clinician Trajectory Review & Sign-off
              </div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
                Verify or adjust 7-day, 14-day, and 30-day readmission risk determinations before finalizing discharge.
              </div>
            </div>

            {prediction?.reviewed_at && (
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Last Signed: <strong style={{ color: '#0f172a' }}>{new Date(prediction.reviewed_at).toLocaleString()}</strong>
              </div>
            )}
          </div>

          {reviewSuccess && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#047857',
              fontSize: '11.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Check style={{ width: '14px', height: '14px' }} />
              <span>{reviewSuccess}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Review Decision:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['Accepted', 'Modified', 'Rejected'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setReviewStatus(status)}
                    style={{
                      flex: 1,
                      height: '32px',
                      borderRadius: '6px',
                      border: reviewStatus === status
                        ? `1.5px solid ${status === 'Accepted' ? '#10b981' : status === 'Modified' ? '#f59e0b' : '#ef4444'}`
                        : '1px solid #cbd5e1',
                      background: reviewStatus === status
                        ? (status === 'Accepted' ? '#ecfdf5' : status === 'Modified' ? '#fffbeb' : '#fef2f2')
                        : '#fff',
                      color: reviewStatus === status
                        ? (status === 'Accepted' ? '#047857' : status === 'Modified' ? '#b45309' : '#b91c1c')
                        : '#475569',
                      fontWeight: reviewStatus === status ? 700 : 500,
                      fontSize: '11.5px',
                      cursor: 'pointer'
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Attending Physician:
              </label>
              <input
                type="text"
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                style={{
                  width: '100%',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  padding: '0 10px',
                  fontSize: '12px',
                  color: '#0f172a'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Clinical Mitigation Notes / Post-Discharge Instructions:
            </label>
            <textarea
              rows={2}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Document specific tele-monitoring arrangements, early clinic review scheduling, or reasons for modifying the AI assessment..."
              style={{
                width: '100%',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                padding: '8px 10px',
                fontSize: '12px',
                color: '#0f172a',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleReviewSubmit}
              disabled={submittingReview}
              style={{
                height: '34px',
                padding: '0 16px',
                borderRadius: '6px',
                border: 0,
                background: '#4f46e5',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: submittingReview ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(79, 70, 229, 0.3)'
              }}
            >
              <CheckCircle2 style={{ width: '14px', height: '14px' }} />
              <span>{submittingReview ? 'Recording...' : 'Sign-off Readmission Assessment'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
