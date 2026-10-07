import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import {
  X, AlertTriangle, CheckCircle2, ShieldCheck, FileText, Sparkles,
  Printer, ArrowUpRight, Clock, Stethoscope, RefreshCw, Languages, ChevronRight, HelpCircle, Download
} from 'lucide-react';

export default function BillingTransparencyDrawer({ isOpen, onClose, patientId = '87221', onApproved }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [language, setLanguage] = useState('en'); // Default initial language to English
  const [showNecessityDrawer, setShowNecessityDrawer] = useState(false);
  const [necessityData, setNecessityData] = useState(null);
  const [necessityLoading, setNecessityLoading] = useState(false);
  const [approvedStatus, setApprovedStatus] = useState(null);
  const [isApproving, setIsApproving] = useState(false);
  const [showPrintInvoice, setShowPrintInvoice] = useState(false);

  useEffect(() => {
    if (isOpen && patientId) {
      loadBreakdown(patientId);
      setLanguage('en'); // Reset to English on open
    }
  }, [isOpen, patientId]);

  const loadBreakdown = async (id) => {
    try {
      setLoading(true);
      setApprovedStatus(null);
      const res = await apiService.getBillingBreakdown(id);
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error loading billing breakdown:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvestigateNecessity = async (itemCode = 'MAT-CATH-NC') => {
    try {
      setNecessityLoading(true);
      setShowNecessityDrawer(true);
      const res = await apiService.getClinicalNecessityProof(patientId, itemCode);
      if (res && res.data) {
        setNecessityData(res.data);
      }
    } catch (err) {
      console.error('Error loading clinical necessity proof:', err);
    } finally {
      setNecessityLoading(false);
    }
  };

  const handleApproveAndPrint = async () => {
    if (!data) return;
    try {
      setIsApproving(true);
      await apiService.approveBillingExplanationForPrint({
        invoice_id: data.invoice_id,
        approver_name: 'S. Murugan (Chief Cashier)',
        notes: 'Verified against Doctor Intra-Op Note and approved for bilingual invoice rendering.'
      });
      setApprovedStatus('APPROVED');
      setShowPrintInvoice(true);
      if (onApproved) onApproved(data.invoice_id);
    } catch (err) {
      console.error('Error approving explanation:', err);
      setShowPrintInvoice(true);
    } finally {
      setIsApproving(false);
    }
  };

  // Robust isolated iframe printing that NEVER produces a blank page
  const triggerBrowserPrint = () => {
    if (!data) return;
    const breakdown = data.breakdown || {};
    const items = data.itemized_items || [];

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice - ${data.invoice_id} - ${data.patient_name}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 10px;
            font-size: 12px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2.5px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .hospital-name {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.02em;
          }
          .hospital-sub {
            font-size: 11px;
            color: #475569;
            margin-top: 2px;
          }
          .invoice-title {
            text-align: right;
          }
          .invoice-tag {
            font-size: 18px;
            font-weight: 800;
            color: #0284c7;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 16px;
          }
          .grid-label {
            font-size: 10px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
          }
          .grid-val {
            font-size: 12.5px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11.5px;
          }
          th {
            background: #f1f5f9;
            border-bottom: 1.5px solid #cbd5e1;
            padding: 8px 10px;
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            color: #475569;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          .totals-wrap {
            display: flex;
            justify-content: flex-end;
            margin-top: 14px;
          }
          .totals-box {
            width: 300px;
            font-size: 12px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            color: #475569;
          }
          .totals-total {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-weight: 800;
            font-size: 14px;
            color: #0f172a;
            border-top: 1.5px solid #cbd5e1;
            border-bottom: 1.5px solid #cbd5e1;
            margin: 4px 0;
          }
          .due-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-weight: 800;
            font-size: 14px;
            color: #dc2626;
          }
          .ai-box {
            margin-top: 18px;
            background: #fff7ed !important;
            border: 1.5px solid #fed7aa;
            border-radius: 8px;
            padding: 14px 16px;
            page-break-inside: avoid;
          }
          .ai-title {
            color: #9a3412;
            font-weight: 800;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .ai-text {
            font-size: 11.5px;
            color: #1e293b;
            line-height: 1.55;
            margin-bottom: 6px;
          }
          .ai-proof {
            font-size: 10.5px;
            color: #0284c7;
            border-top: 1px dashed #fed7aa;
            padding-top: 6px;
            margin-top: 6px;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            margin-top: 35px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #64748b;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">PATIENT INVOICE & DISCHARGE CLEARANCE</div>
            <div class="hospital-sub">NABH Accredited Tertiary Healthcare Services</div>
          </div>
          <div class="invoice-title">
            <div class="invoice-tag">${data.invoice_id}</div>
            <div style="color: #64748b; font-size: 11px; margin-top: 2px;">Date: ${new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>

        <div class="grid">
          <div>
            <div class="grid-label">Patient Demographics</div>
            <div class="grid-val">${data.patient_name}</div>
            <div style="color: #64748b; font-size: 11px;">UHID: ${data.uhid}</div>
          </div>
          <div>
            <div class="grid-label">Department & Doctor</div>
            <div class="grid-val">${data.doctor}</div>
            <div style="color: #64748b; font-size: 11px;">${data.department}</div>
          </div>
          <div>
            <div class="grid-label">Insurance / TPA Coverage</div>
            <div class="grid-val" style="color: #059669;">Star Health & Allied Insurance</div>
            <div style="color: #64748b; font-size: 11px;">Approved: ₹2,20,000</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 45%;">Item / Medical Service</th>
              <th style="width: 25%;">Category</th>
              <th style="width: 10%; text-align: center;">Qty</th>
              <th style="width: 20%; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr>
                <td><strong>${it.desc}</strong>${it.is_variance_driver ? ' <span style="color: #ea580c; font-weight: 800;">*</span>' : ''}</td>
                <td style="color: #64748b;">${it.category}</td>
                <td style="text-align: center;">${it.qty}</td>
                <td style="text-align: right; font-weight: 600;">₹${Number(it.total || 0).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-wrap">
          <div class="totals-box">
            <div class="totals-row">
              <span>Initial Pre-Admission Estimate:</span>
              <span>₹${Number(data.initial_estimate || 0).toLocaleString()}</span>
            </div>
            <div class="totals-total">
              <span>Gross Bill Amount:</span>
              <span>₹${Number(data.current_total || 0).toLocaleString()}</span>
            </div>
            <div class="totals-row" style="color: #059669;">
              <span>Insurance Settled Share:</span>
              <span>-₹2,20,000</span>
            </div>
            <div class="due-row">
              <span>Patient Co-Pay Due:</span>
              <span>₹48,450</span>
            </div>
          </div>
        </div>

        <div class="ai-box">
          <div class="ai-title">✨ Plain-Language Charge Breakdown (கட்டண விளக்கம்)</div>
          <div class="ai-text">
            <strong>English Explanation for Family:</strong> ${breakdown.summary_en || ''}
          </div>
          <div class="ai-text">
            <strong>தமிழ் விளக்கம்:</strong> ${breakdown.summary_ta || ''}
          </div>
          ${breakdown.clinical_proof ? `
            <div class="ai-proof">
              ✓ Clinically verified by <strong>${breakdown.clinical_proof.doctor_name}</strong> · Source: ${breakdown.clinical_proof.source_document} (${breakdown.clinical_proof.timestamp})
            </div>
          ` : ''}
        </div>

        <div class="footer">
          <div>
            <div>Authorized Billing Officer: <strong>S. Murugan (Chief Cashier)</strong></div>
            <div>Generated: ${new Date().toLocaleString('en-IN')}</div>
          </div>
          <div style="text-align: right;">
            <div>Authorized Signatory</div>
            <div style="margin-top: 24px; font-weight: 700; color: #0f172a;">[ Stamp & Signature ]</div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create a temporary hidden iframe for printing
    let iframe = document.getElementById('print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 400);
  };

  if (!isOpen) return null;

  const breakdown = data?.breakdown || {};
  const isHighVariance = (data?.variance_pct || 0) > 10;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 9999,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '740px',
        height: '100%',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.25)',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(234, 88, 12, 0.35)'
            }}>
              <Sparkles size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                  AG-08 · Billing Transparency Desk
                </h3>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                கட்டண வெளிப்படைத்தன்மை முகவர் · Automated Financial & Clinical Interpreter
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#f8fafc' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <RefreshCw className="animate-spin" size={32} style={{ margin: '0 auto 12px', color: '#ea580c' }} />
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Auditing Running Bill & Synthesizing Clinical Notes...</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Generating plain-language English & Tamil breakdown</div>
            </div>
          ) : data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Patient & Financial Overview Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '16px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{data.patient_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      UHID: <span style={{ fontWeight: 600, color: '#334155' }}>{data.uhid}</span> · Inv: <span style={{ fontWeight: 600 }}>{data.invoice_id}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '4px', fontWeight: 500 }}>
                      👨‍⚕️ {data.doctor} ({data.department})
                    </div>
                  </div>

                  {/* Variance Badge */}
                  <div style={{
                    backgroundColor: data.flag_level === 'HIGH' ? '#ffedd5' : data.flag_level === 'MODERATE' ? '#fef3c7' : '#dcfce7',
                    border: `1px solid ${data.flag_level === 'HIGH' ? '#fdba74' : data.flag_level === 'MODERATE' ? '#fde68a' : '#86efac'}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    textAlign: 'right'
                  }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: data.flag_level === 'HIGH' ? '#c2410c' : data.flag_level === 'MODERATE' ? '#92400e' : '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      justifyContent: 'flex-end'
                    }}>
                      <AlertTriangle size={14} />
                      {data.flag_level === 'HIGH' ? 'Estimate Variance > 10%' : 'Variance Flag'}
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: data.flag_level === 'HIGH' ? '#ea580c' : '#b45309', marginTop: '2px' }}>
                      +₹{Number(data.variance_amount || 0).toLocaleString()} (+{data.variance_pct}%)
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  marginTop: '16px',
                  paddingTop: '14px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Initial Estimate</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#334155', marginTop: '2px' }}>
                      ₹{Number(data.initial_estimate || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Current Total Bill</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      ₹{Number(data.current_total || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '10px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: 600 }}>Unexplained Variance</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#ea580c', marginTop: '2px' }}>
                      ₹{Number(data.variance_amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bilingual Plain-Language Breakdown Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #fed7aa',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.08)',
                overflow: 'hidden'
              }}>
                {/* Header with Language Tabs */}
                <div style={{
                  padding: '12px 18px',
                  background: '#fff7ed',
                  borderBottom: '1px solid #fed7aa',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} color="#ea580c" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#9a3412' }}>
                      Plain-Language Bill Breakdown (கட்டண விளக்கம்)
                    </span>
                  </div>

                  {/* Bilingual Toggle (English First) */}
                  <div style={{ display: 'flex', background: '#ffffff', borderRadius: '6px', padding: '2px', border: '1px solid #fdba74' }}>
                    <button
                      onClick={() => setLanguage('en')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: language === 'en' ? '#ea580c' : 'transparent',
                        color: language === 'en' ? '#ffffff' : '#64748b'
                      }}
                    >
                      English
                    </button>
                    <button
                      onClick={() => setLanguage('ta')}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: language === 'ta' ? '#ea580c' : 'transparent',
                        color: language === 'ta' ? '#ffffff' : '#64748b'
                      }}
                    >
                      தமிழ் (Tamil)
                    </button>
                  </div>
                </div>

                {/* Explanation Content */}
                <div style={{ padding: '16px 18px' }}>
                  <div style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#1e293b',
                    fontWeight: 500,
                    backgroundColor: '#fafafa',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    borderLeft: '4px solid #ea580c'
                  }}>
                    {language === 'en' ? (
                      <div>
                        <div style={{ fontWeight: 700, color: '#ea580c', marginBottom: '4px', fontSize: '12px' }}>
                          📢 Plain-Language Charge Summary for Family & Cashier:
                        </div>
                        {breakdown.summary_en}
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontWeight: 700, color: '#ea580c', marginBottom: '4px', fontSize: '12px' }}>
                          📢 கட்டண அதிகரிப்பிற்கான எளிய விளக்கம்:
                        </div>
                        {breakdown.summary_ta || breakdown.summary_en}
                      </div>
                    )}
                  </div>

                  {/* Key Drivers List */}
                  {breakdown.key_drivers && breakdown.key_drivers.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Specific Additional Line Items & Clinical Reasons:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {breakdown.key_drivers.map((drv, idx) => (
                          <div key={idx} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            padding: '10px 12px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px'
                          }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{drv.item_name}</div>
                              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                                {language === 'en' ? drv.reason_en : drv.reason_ta}
                              </div>
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 800, color: '#c2410c', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                              +₹{Number(drv.amount || 0).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verified Clinical Proof Snippet */}
                  {breakdown.clinical_proof && (
                    <div style={{
                      marginTop: '16px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      padding: '12px 14px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1d4ed8', fontWeight: 700, fontSize: '12px' }}>
                          <ShieldCheck size={16} />
                          Clinical Verification Audit (Intra-Operative & Ward Logs)
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{breakdown.clinical_proof.timestamp}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#1e3a8a', fontStyle: 'italic', marginTop: '6px', lineHeight: '1.5' }}>
                        "{breakdown.clinical_proof.verbatim_quote}"
                      </div>
                      <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '6px', fontWeight: 600 }}>
                        — Source: {breakdown.clinical_proof.source_document} ({breakdown.clinical_proof.doctor_name})
                      </div>
                    </div>
                  )}

                  {/* Actions Bar inside Card */}
                  <div style={{
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <button
                      onClick={() => handleInvestigateNecessity('MAT-CATH-NC')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        background: '#ffffff',
                        border: '1px solid #0284c7',
                        borderRadius: '6px',
                        color: '#0284c7',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <Stethoscope size={14} />
                      [Investigate Clinical Necessity]
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => loadBreakdown(patientId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          background: '#f1f5f9',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#475569',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <RefreshCw size={14} />
                        Re-Synthesize
                      </button>

                      <button
                        onClick={handleApproveAndPrint}
                        disabled={isApproving}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 18px',
                          background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)'
                        }}
                      >
                        <Printer size={15} />
                        {isApproving ? 'Generating Invoice...' : 'Print Explanation on Invoice'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Complete Itemized Ledger */}
              {data.itemized_items && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                    📋 Itemized Consumables & Surgical Bill Lines
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item / Service</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Category</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Variance Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.itemized_items.map((it, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: it.is_variance_driver ? '#fffbeb' : 'transparent' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1e293b' }}>
                            {it.desc}
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>{it.code}</div>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#64748b' }}>{it.category}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{it.qty}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: it.is_variance_driver ? '#ea580c' : '#0f172a' }}>
                            ₹{Number(it.total || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {it.is_variance_driver ? (
                              <span style={{ fontSize: '10px', fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px' }}>
                                ⚠️ Variance Item
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>✓ Planned</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              No billing records found for this patient.
            </div>
          )}
        </div>

        {/* Secondary Clinical Necessity Proof Drawer */}
        {showNecessityDrawer && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            maxWidth: '520px',
            backgroundColor: '#ffffff',
            boxShadow: '-8px 0 24px rgba(0,0,0,0.2)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.2s ease-out'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>🔍 Verified Clinical Proof Drawer</h4>
                <div style={{ fontSize: '11px', color: '#e0f2fe', marginTop: '2px' }}>
                  Intra-Operative Record & NABH Necessity Audit
                </div>
              </div>
              <button
                onClick={() => setShowNecessityDrawer(false)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#f8fafc' }}>
              {necessityLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 8px', color: '#0284c7' }} />
                  <div>Loading verified clinical audit trail...</div>
                </div>
              ) : necessityData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Contested Item</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                      {necessityData.item_name}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#ea580c', marginTop: '4px' }}>
                      Amount: ₹{Number(necessityData.charge_amount || 0).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>
                      Clinical Indication
                    </div>
                    <div style={{ fontSize: '13px', color: '#1e3a8a', marginTop: '4px', fontWeight: 500, lineHeight: '1.5' }}>
                      {necessityData.clinical_indication}
                    </div>
                    <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '8px' }}>
                      ✍️ Signed by: <strong>{necessityData.doctor_signed}</strong> at {necessityData.timestamp}
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                      ⏱️ Intra-Operative Timeline
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {necessityData.audit_trail && necessityData.audit_trail.map((st, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px' }}>
                            {st.time}
                          </span>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{st.step}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{st.finding}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>
                      ⚖️ NABH Clinical Governance Rule
                    </div>
                    <div style={{ fontSize: '11px', color: '#14532d', marginTop: '4px' }}>
                      {necessityData.nabh_compliance_rule}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
              <button
                onClick={() => setShowNecessityDrawer(false)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0284c7',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Done / Return to Bill
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OFFICIAL PRINTABLE PATIENT INVOICE MODAL                                 */}
        {/* ========================================================================= */}
        {showPrintInvoice && data && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 20000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '820px',
              maxHeight: '94vh',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden'
            }}>
              {/* Print Action Bar */}
              <div style={{
                padding: '12px 20px',
                background: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={18} color="#38bdf8" />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>
                    Print Final Hospital Invoice · {data.invoice_id}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={triggerBrowserPrint}
                    style={{
                      padding: '8px 16px',
                      background: '#0284c7',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Printer size={15} />
                    Print to Printer / PDF
                  </button>
                  <button
                    onClick={() => setShowPrintInvoice(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '6px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Printable Invoice Page Body */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '30px',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                {/* Invoice Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                      PATIENT INVOICE & DISCHARGE CLEARANCE
                    </h2>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      NABH Accredited Tertiary Healthcare Services
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7' }}>{data.invoice_id}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Date: {new Date().toLocaleDateString('en-IN')}</div>
                  </div>
                </div>

                {/* Patient Information Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '14px',
                  padding: '14px 0',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '12px'
                }}>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>PATIENT NAME</div>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{data.patient_name}</div>
                    <div style={{ color: '#64748b' }}>UHID: {data.uhid}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>DEPARTMENT & DOCTOR</div>
                    <div style={{ fontWeight: 600 }}>{data.doctor}</div>
                    <div style={{ color: '#64748b' }}>{data.department}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>PAYMENT / TPA STATUS</div>
                    <div style={{ fontWeight: 700, color: '#059669' }}>Star Health & Allied Insurance</div>
                    <div style={{ color: '#64748b' }}>Pre-Auth: ₹2,20,000</div>
                  </div>
                </div>

                {/* Itemized Table */}
                <div style={{ marginTop: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', textTransform: 'uppercase', fontSize: '10px', color: '#475569' }}>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Item / Medical Service</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Category</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.itemized_items && data.itemized_items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', fontWeight: it.is_variance_driver ? 700 : 500 }}>
                            {it.desc}
                            {it.is_variance_driver && <span style={{ fontSize: '10px', color: '#ea580c', marginLeft: '6px' }}>*</span>}
                          </td>
                          <td style={{ padding: '8px', color: '#64748b' }}>{it.category}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{it.qty}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                            ₹{Number(it.total || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bill Totals Summary */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', borderTop: '2px solid #e2e8f0', paddingTop: '10px' }}>
                  <div style={{ width: '280px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#64748b' }}>
                      <span>Pre-Admission Estimate:</span>
                      <span>₹{Number(data.initial_estimate || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                      <span>Gross Invoice Total:</span>
                      <span>₹{Number(data.current_total || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#059669' }}>
                      <span>Insurance Approved Share:</span>
                      <span>-₹2,20,000</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 800, fontSize: '14px', color: '#dc2626', borderTop: '1px solid #cbd5e1', marginTop: '4px' }}>
                      <span>Patient Co-Pay Balance:</span>
                      <span>₹48,450</span>
                    </div>
                  </div>
                </div>

                {/* ✨ OFFICIAL BILINGUAL PLAIN-LANGUAGE TRANSPARENCY EXPLANATION BOX */}
                <div style={{
                  marginTop: '18px',
                  backgroundColor: '#fff7ed',
                  border: '1.5px solid #fed7aa',
                  borderRadius: '8px',
                  padding: '14px 16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9a3412', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase' }}>
                    <span>✨ Plain-Language Charge Breakdown (கட்டண விளக்கம்)</span>
                  </div>

                  {/* English Explanation */}
                  <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '6px', lineHeight: '1.5' }}>
                    <strong>English Note for Family:</strong> {breakdown.summary_en}
                  </div>

                  {/* Tamil Explanation */}
                  <div style={{ fontSize: '12px', color: '#1e293b', marginTop: '6px', lineHeight: '1.5' }}>
                    <strong>தமிழ் விளக்கம்:</strong> {breakdown.summary_ta}
                  </div>

                  {/* Verified Clinical Footnote */}
                  {breakdown.clinical_proof && (
                    <div style={{ fontSize: '10.5px', color: '#0284c7', marginTop: '8px', borderTop: '1px dashed #fed7aa', paddingTop: '6px' }}>
                      ✓ Clinically verified by <strong>{breakdown.clinical_proof.doctor_name}</strong> · Record: {breakdown.clinical_proof.source_document} ({breakdown.clinical_proof.timestamp})
                    </div>
                  )}
                </div>

                {/* Sign-off Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                  <div>
                    <div>Authorized Billing Executive: <strong>S. Murugan</strong></div>
                    <div>Printed on: {new Date().toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>Authorized Signatory</div>
                    <div style={{ marginTop: '20px', fontWeight: 700, color: '#0f172a' }}>[ Stamp & Signature ]</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
