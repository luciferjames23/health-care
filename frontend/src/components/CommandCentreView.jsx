import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export default function CommandCentreView({ onNavigate, onAskAi }) {
  const [liveKpis, setLiveKpis] = useState(null);
  const [liveWards, setLiveWards] = useState([]);
  const [liveExceptions, setLiveExceptions] = useState([]);
  const [liveApprovals, setLiveApprovals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCommandCentre() {
      setLoading(true);
      try {
        const res = await apiService.getCommandCentreData();
        if (res?.kpis) {
          setLiveKpis(res.kpis);
        }
        if (res?.ward_occupancy) {
          setLiveWards(res.ward_occupancy);
        }

        // Fetch live discharge candidates to populate exceptions & approvals from PostgreSQL
        const disRes = await apiService.getDischargeCandidates({ limit: 6 }).catch(() => null);
        const candidates = disRes?.data || disRes?.candidates || [];
        if (candidates.length > 0) {
          const exList = candidates.map((c, i) => ({
            ref: `${c.patient_name || 'Patient'} · ${c.bed_number || 'Bed'}`.trim(),
            owner: c.doctor_name || c.primary_consultant || 'Attending Physician',
            age: `${(i + 1) * 28} m`,
            pri: i < 2 ? 'High' : 'Medium',
            priC: i < 2 ? 'oklch(0.5 0.18 25)' : 'oklch(0.5 0.13 70)',
            reason: c.diagnoses ? `${c.diagnoses.slice(0, 45)}...` : 'Discharge clearance dependencies pending',
            next: 'Review clearance',
            target: 'discharge'
          }));
          setLiveExceptions(exList);

          const appList = candidates.slice(0, 4).map((c, i) => ({
            type: 'Discharge summary',
            patient: c.patient_name || c.patient_number,
            age: `${(i + 1) * 12}m`,
            owner: c.doctor_name || 'Attending Physician',
            agent: 'Discharge AI'
          }));
          setLiveApprovals(appList);
        }
      } catch (err) {
        console.warn("Using default Command Centre metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCommandCentre();
  }, []);

  const kpis = [
    { 
      id: 'appts', 
      t: 'Appointments recorded', 
      v: liveKpis ? liveKpis.appointments_total.toLocaleString() : '15,000', 
      sub: 'All scheduled clinical encounters in PostgreSQL', 
      c: '#15181b', 
      target: 'appointments' 
    },
    { 
      id: 'er', 
      t: 'Emergency load', 
      v: liveKpis ? liveKpis.emergency_cases.toLocaleString() : '333', 
      sub: 'Triage trauma and critical encounters', 
      c: '#15181b', 
      target: 'emergency' 
    },
    { 
      id: 'adm', 
      t: 'Active Admissions', 
      v: liveKpis ? liveKpis.active_admissions.toLocaleString() : '250', 
      sub: liveKpis ? `${liveKpis.available_beds} of ${liveKpis.total_beds} beds free` : '180 beds total', 
      c: '#15181b', 
      target: 'clinical' 
    },
    { 
      id: 'dis', 
      t: 'Discharge candidates', 
      v: liveKpis ? liveKpis.discharge_candidates.toLocaleString() : '250', 
      sub: 'Discharge summaries awaiting clearance', 
      c: '#15181b', 
      target: 'discharge' 
    },
    { 
      id: 'ins', 
      t: 'Insurance & Claims', 
      v: liveKpis ? `₹${liveKpis.total_collected.toLocaleString()}` : '₹19,30,750', 
      sub: 'Claims collected via TPA gateway', 
      c: 'oklch(0.5 0.18 25)', 
      target: 'billing' 
    },
    { 
      id: 'bill', 
      t: 'Total Invoiced Revenue', 
      v: liveKpis ? `₹${liveKpis.total_revenue.toLocaleString()}` : '₹19,30,750', 
      sub: liveKpis ? `${liveKpis.total_bills} bills generated` : '1000 bills generated', 
      c: 'oklch(0.5 0.1 200)', 
      target: 'revenue' 
    },
    { 
      id: 'comp', 
      t: 'Hospital Wards', 
      v: liveWards.length ? String(liveWards.length) : '6', 
      sub: 'Active inpatient care units', 
      c: '#15181b', 
      target: 'beds' 
    },
    { 
      id: 'appr', 
      t: 'Human approvals', 
      v: '9', 
      sub: 'clinical & discharge clearance queue', 
      c: '#15181b', 
      target: 'discharge' 
    },
    { 
      id: 'agents', 
      t: 'Agent runs recorded', 
      v: liveKpis ? liveKpis.agent_runs_today.toLocaleString() : '1,000', 
      sub: 'Live execution logs across active models', 
      c: '#15181b', 
      target: 'analytics' 
    },
    { 
      id: 'ex', 
      t: 'Exceptions', 
      v: '32', 
      sub: 'predicted pressure: High', 
      c: 'oklch(0.5 0.18 25)', 
      target: 'exceptions' 
    },
    { 
      id: 'lab', 
      t: 'Radiology Reports', 
      v: liveKpis ? liveKpis.radiology_reports.toLocaleString() : '500', 
      sub: 'Diagnostic studies & AI impressions', 
      c: '#15181b', 
      target: 'lab' 
    },
    { 
      id: 'inv', 
      t: 'Total Beds Capacity', 
      v: liveKpis ? String(liveKpis.total_beds) : '180', 
      sub: liveKpis ? `${liveKpis.available_beds} ready for intake` : '180 beds', 
      c: '#15181b', 
      target: 'beds' 
    },
  ];

  const defaultWards = [
    { name: 'Cardiology Ward (C)', o: 18, n: 20, pct: 90, color: 'oklch(0.5 0.18 25)' },
    { name: 'CTICU (Intensive)', o: 11, n: 12, pct: 92, color: 'oklch(0.5 0.18 25)' },
    { name: 'Orthopaedic (O)', o: 14, n: 18, pct: 78, color: 'oklch(0.5 0.13 70)' },
    { name: 'General Surgery (S)', o: 16, n: 24, pct: 67, color: 'oklch(0.5 0.1 200)' },
    { name: 'Nephrology (N)', o: 8, n: 14, pct: 57, color: 'oklch(0.5 0.1 200)' },
    { name: 'Oncology (ON)', o: 5, n: 10, pct: 50, color: 'oklch(0.5 0.1 200)' },
  ];

  const displayWards = liveWards.length > 0 ? liveWards.map(w => ({
    name: w.ward_name,
    o: w.occupied_beds,
    n: w.total_beds,
    pct: w.occupancy_rate || 0,
    color: (w.occupancy_rate > 80) ? 'oklch(0.5 0.18 25)' : (w.occupancy_rate > 50) ? 'oklch(0.5 0.13 70)' : 'oklch(0.5 0.1 200)'
  })) : defaultWards;

  const defaultExceptions = [
    { ref: 'Kavitha Raman · C-412', owner: 'Dr. Arjun Menon', age: '1 h 42 m', pri: 'High', priC: 'oklch(0.5 0.18 25)', reason: 'Star Health insurance enhancement pending ₹1,42,000', next: 'TPA escalation', target: 'discharge' },
    { ref: 'Fathima Begum · O-207', owner: 'Dr. Deepa Krishnan', age: '52 m', pri: 'High', priC: 'oklch(0.5 0.18 25)', reason: 'Enoxaparin medication verification in pharmacy', next: 'Pharmacy pack', target: 'discharge' },
    { ref: 'Murugan Selvam · CTICU-04', owner: 'Dr. Vikram Bose', age: '2 h 17 m', pri: 'High', priC: 'oklch(0.5 0.18 25)', reason: 'Awaiting consultant surgeon sign-off for release', next: 'Surgeon review', target: 'clinical' },
    { ref: 'Lakshmi Narayanan · N-305', owner: 'Dr. Ramesh Pillai', age: '25 m', pri: 'Medium', priC: 'oklch(0.5 0.13 70)', reason: 'Renal function test in analyzer queue #14', next: 'Lab expedite', target: 'clinical' },
    { ref: 'Ananya Deshmukh · CCU-01', owner: 'Dr. Arjun Menon', age: '30 m', pri: 'Medium', priC: 'oklch(0.5 0.13 70)', reason: 'Preliminary ECG report awaiting attending sign-off', next: 'Sign note', target: 'soap' },
  ];

  const defaultApprovals = [
    { type: 'Discharge summary', patient: 'Kavitha Raman', age: '14m', owner: 'Dr. Arjun Menon', agent: 'Discharge Agent' },
    { type: 'Preauth enhancement', patient: 'Murugan Selvam', age: '22m', owner: 'R. Sundar (TPA Desk)', agent: 'Insurance Agent' },
    { type: 'Radiology sign-off', patient: 'Lakshmi Narayanan', age: '35m', owner: 'Dr. Hemalatha Devi', agent: 'Radiology AI' },
    { type: 'Medication change', patient: 'Fathima Begum', age: '48m', owner: 'Dr. Deepa Krishnan', agent: 'Clinical Agent' },
  ];

  const exceptions = liveExceptions.length > 0 ? liveExceptions : defaultExceptions;
  const approvals = liveApprovals.length > 0 ? liveApprovals : defaultApprovals;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top breadcrumb & actions */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Clinical Workspace</span> › <span>Command Centre</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>Command Centre</div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            Fri 12 Sep 2026 · 11:20 · live from shared synthetic dataset · every number opens the workflow behind it
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => onAskAi && onAskAi('Which patients are currently blocked from discharge and why?')}
            style={{
              height: '30px', padding: '0 11px', border: '1px solid oklch(0.85 0.05 300)',
              borderRadius: '6px', background: '#fff', cursor: 'pointer',
              color: 'oklch(0.45 0.1 300)', fontWeight: 600, fontSize: '12px'
            }}
          >
            Ask: blocked discharges
          </button>
          <button
            type="button"
            onClick={() => alert('Simulating 15m advance across active agents...')}
            style={{
              height: '30px', padding: '0 11px', border: '1px solid #e3e6e8',
              borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '12px'
            }}
          >
            Run scenario ▶
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '10px'
      }}>
        {kpis.map((k) => (
          <div
            key={k.id}
            onClick={() => onNavigate && onNavigate(k.target)}
            style={{
              background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px',
              padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s'
            }}
          >
            <div style={{ color: '#8a9096', fontSize: '11px', fontWeight: 500 }}>{k.t}</div>
            <div style={{
              fontFamily: 'Newsreader, Georgia, serif', fontSize: '28px',
              lineHeight: 1.15, color: k.c, margin: '2px 0'
            }}>
              {k.v}
            </div>
            <div style={{ color: '#52585e', fontSize: '11px', lineHeight: 1.35 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Two Column Layout: Operational Exceptions + Side Panels */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px',
        gap: '14px', alignItems: 'start'
      }}>
        {/* Exceptions list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 600, fontSize: '13px' }}>
              Operational exceptions · 32 open
            </div>
            <a
              href="#exceptions"
              onClick={(e) => { e.preventDefault(); onNavigate('exceptions'); }}
              style={{ textDecoration: 'none', color: 'oklch(0.5 0.1 200)', fontSize: '12px', fontWeight: 500 }}
            >
              Exception centre →
            </a>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{
              display: 'flex', gap: '10px', padding: '8px 12px',
              borderBottom: '1px solid #eef0f1', fontWeight: 600, fontSize: '11.5px', background: '#f9fafa'
            }}>
              <span>Priority exceptions requiring immediate human resolution</span>
            </div>

            {exceptions.map((it, idx) => (
              <div
                key={idx}
                onClick={() => onNavigate(it.target)}
                style={{
                  display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) 75px 65px minmax(0, 2fr) 95px',
                  gap: '8px', padding: '8px 12px', borderBottom: '1px solid #f2f3f4',
                  alignItems: 'center', cursor: 'pointer', fontSize: '11.5px'
                }}
              >
                <span style={{ fontWeight: 600 }}>{it.ref}</span>
                <span style={{ color: '#52585e' }}>{it.owner}</span>
                <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096' }}>{it.age}</span>
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: it.priC }}>{it.pri}</span>
                <span style={{ color: '#52585e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.reason}</span>
                <span style={{ color: 'oklch(0.45 0.1 200)', fontWeight: 600 }}>{it.next} →</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Management Copilot AI card */}
          <div style={{
            background: '#fff', border: '1px solid oklch(0.85 0.05 300)',
            borderRadius: '8px', padding: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'oklch(0.5 0.1 300)' }} />
              <span style={{ fontWeight: 600, fontSize: '12.5px' }}>Management Copilot</span>
              <span style={{ marginLeft: 'auto', font: '500 10px ui-monospace, Menlo, monospace', color: 'oklch(0.5 0.1 300)' }}>
                AI GENERATED · 11:20
              </span>
            </div>
            <div style={{ lineHeight: 1.5, color: '#52585e', fontSize: '12px' }}>
              Discharge delays are concentrated in Star Health preauth enhancements (8 cases, avg age 2h 14m). Emergency room bed turnaround is slowed by 2 pending critical lab validations.
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#8a9096' }}>
              Sources: HMS EMR, TPA Gateway, LIS Middleware
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onAskAi && onAskAi('Show insurance cases older than 2 hours.')}
                style={{
                  height: '26px', padding: '0 9px', borderRadius: '6px', border: 0,
                  background: 'oklch(0.5 0.1 200)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '11px'
                }}
              >
                Insurance ageing
              </button>
              <button
                type="button"
                onClick={() => onAskAi && onAskAi('Which critical results are awaiting clinician acknowledgement?')}
                style={{
                  height: '26px', padding: '0 9px', borderRadius: '6px',
                  border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11px'
                }}
              >
                Critical results
              </button>
            </div>
          </div>

          {/* Human approval queue */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '8px' }}>Human approval queue</div>
            {approvals.map((a, i) => (
              <div
                key={i}
                onClick={() => onNavigate('discharge')}
                style={{
                  display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: '2px 8px', padding: '6px 0', borderBottom: '1px solid #f2f3f4', cursor: 'pointer'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '12px' }}>{a.type} · {a.patient}</span>
                <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', color: '#8a9096' }}>{a.age}</span>
                <span style={{ color: '#52585e', gridColumn: '1 / -1', fontSize: '11px' }}>{a.owner} · {a.agent}</span>
              </div>
            ))}
          </div>

          {/* Ward occupancy */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '10px' }}>Ward occupancy</div>
            {displayWards.map((w) => (
              <div key={w.name} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 40px', gap: '8px', alignItems: 'center', padding: '3px 0', fontSize: '11.5px' }}>
                <span style={{ color: '#52585e' }}>{w.name}</span>
                <div style={{ height: '7px', background: '#eef0f1', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${w.pct}%`, height: '100%', background: w.color }} />
                </div>
                <span style={{ textAlign: 'right', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px' }}>
                  {w.o}/{w.n}
                </span>
              </div>
            ))}
          </div>

          {/* Platform health */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '8px' }}>Platform health</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 12px', color: '#52585e', fontSize: '11.5px' }}>
              <span>Agents</span><span>18 active · 0 failing</span>
              <span>HMS · EMR · Billing · TPA</span><span style={{ color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>Healthy</span>
              <span>LIS</span><span style={{ color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>Healthy (3 analyzers online)</span>
              <span>WhatsApp · Voice</span><span style={{ color: 'oklch(0.4 0.12 150)', fontWeight: 600 }}>Healthy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
