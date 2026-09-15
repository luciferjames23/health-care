import React, { useState, useEffect } from 'react';
import { apiService, parseDischargeSummaryRecord } from '../services/api';

const Spinner = () => (
  <span style={{
    display: 'inline-block',
    width: '18px', height: '18px',
    border: '2px solid #e3e6e8',
    borderTop: '2px solid oklch(0.5 0.1 200)',
    borderRadius: '50%',
    animation: 'kpi-spin 0.7s linear infinite',
    verticalAlign: 'middle',
    marginTop: '6px'
  }} />
);

/* Keyframes injected once */
if (typeof document !== 'undefined' && !document.getElementById('kpi-spin-style')) {
  const s = document.createElement('style');
  s.id = 'kpi-spin-style';
  s.textContent = '@keyframes kpi-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}

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
        const [admRes, disRes, bmRes] = await Promise.all([
          apiService.getCurrentAdmissions().catch(() => ({ data: [] })),
          apiService.getDischargedPatients().catch(() => ({ data: [] })),
          apiService.getBedManagementData().catch(() => null)
        ]);

        const admissions = admRes?.data || [];
        const discharges = (disRes?.data || []).map(parseDischargeSummaryRecord).filter(Boolean);
        const kpisObj = bmRes?.kpis || {};
        const wardsList = bmRes?.wards || [];

        setLiveKpis({
          active_admissions: admissions.length,
          discharged_patients: discharges.length,
          total_beds: kpisObj.total_beds || 312,
          occupied_beds: kpisObj.occupied_beds || 210,
          available_beds: kpisObj.available_beds || 102,
          maintenance_beds: kpisObj.maintenance_beds || 0,
          occupancy_rate: kpisObj.occupancy_rate || 67.3,
          total_wards: wardsList.length || 8,
          total_rooms: kpisObj.total_rooms || 150
        });

        if (wardsList.length > 0) {
          setLiveWards(wardsList);
        }

        // Build live exceptions from active discharge cases
        if (discharges.length > 0) {
          const exList = discharges.slice(0, 5).map((c) => ({
            ref: `${c.patient} · ${c.bed || 'Released Bed'}`,
            owner: c.doctor || 'Attending Physician',
            age: 'Live Record',
            pri: c.approval_status === 'Approved' ? 'Low' : 'High',
            priC: c.approval_status === 'Approved' ? 'oklch(0.4 0.12 150)' : 'oklch(0.5 0.18 25)',
            reason: c.diagnoses ? (c.diagnoses.length > 55 ? `${c.diagnoses.slice(0, 55)}...` : c.diagnoses) : 'Clinical summary review',
            next: c.approval_status === 'Approved' ? 'Bed released' : 'Physician sign-off',
            target: 'discharge'
          }));
          setLiveExceptions(exList);

          const appList = discharges.slice(0, 4).map(c => ({
            type: 'Discharge summary',
            patient: c.patient,
            age: c.approval_status,
            owner: c.doctor || 'Attending Physician',
            agent: c.model_name || 'Llama 3.3 70B'
          }));
          setLiveApprovals(appList);
        }
      } catch (err) {
        console.warn("Failed to load Command Centre metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCommandCentre();
  }, []);

  const kpis = [
    { 
      id: 'adm', 
      t: 'Currently Admitted Patients', 
      v: liveKpis ? String(liveKpis.active_admissions) : null, 
      sub: 'Active inpatients across all wards', 
      c: 'oklch(0.5 0.1 200)', 
      target: 'clinical' 
    },
    { 
      id: 'dis', 
      t: 'Discharged Patient Records', 
      v: liveKpis ? String(liveKpis.discharged_patients) : null, 
      sub: 'Patients discharged from inpatient care', 
      c: 'oklch(0.4 0.12 150)', 
      target: 'discharge' 
    },
    { 
      id: 'inv', 
      t: 'Total Hospital Beds', 
      v: liveKpis ? String(liveKpis.total_beds) : '312', 
      sub: liveKpis ? `${liveKpis.available_beds} available · ${liveKpis.occupied_beds} occupied` : 'Real-time bed census', 
      c: '#15181b', 
      target: 'beds' 
    },
    { 
      id: 'occ', 
      t: 'Hospital Occupancy Rate', 
      v: liveKpis ? `${liveKpis.occupancy_rate}%` : '67.3%', 
      sub: liveKpis ? `${liveKpis.occupied_beds} of ${liveKpis.total_beds} beds in use` : 'Calculated capacity', 
      c: 'oklch(0.5 0.18 25)', 
      target: 'beds' 
    },
    { 
      id: 'wards', 
      t: 'Hospital Wards Count', 
      v: liveKpis ? String(liveKpis.total_wards) : '8', 
      sub: 'Across all floors and departments', 
      c: '#15181b', 
      target: 'beds' 
    },
    { 
      id: 'rooms', 
      t: 'Hospital Rooms Count', 
      v: liveKpis ? String(liveKpis.total_rooms) : '150', 
      sub: 'Across all wards and care units', 
      c: '#15181b', 
      target: 'beds' 
    },
    { 
      id: 'avail', 
      t: 'Available Vacant Beds', 
      v: liveKpis ? String(liveKpis.available_beds) : '102', 
      sub: 'Immediate intake capacity', 
      c: 'oklch(0.4 0.12 150)', 
      target: 'beds' 
    },
  ];

  const displayWards = liveWards.map(w => ({
    name: w.ward_name,
    o: w.occupied_beds,
    n: w.total_beds,
    pct: w.occupancy_rate || 0,
    color: (w.occupancy_rate > 80) ? 'oklch(0.5 0.18 25)' : (w.occupancy_rate > 50) ? 'oklch(0.5 0.13 70)' : 'oklch(0.4 0.12 150)'
  }));

  const exceptions = liveExceptions;
  const approvals = liveApprovals;

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
              lineHeight: 1.15, color: k.c, margin: '2px 0',
              minHeight: '34px', display: 'flex', alignItems: 'center'
            }}>
              {k.v === null ? <Spinner /> : k.v}
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
