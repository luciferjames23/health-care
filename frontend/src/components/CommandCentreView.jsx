import React, { useState, useEffect } from 'react';
import { apiService, parseDischargeSummaryRecord, extractDischargedPatientIds } from '../services/api';

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

export default function CommandCentreView({ onNavigate, onAskAi }) {
  const [liveKpis, setLiveKpis] = useState(null);
  const [liveWards, setLiveWards] = useState([]);
  const [liveExceptions, setLiveExceptions] = useState([]);
  const [liveApprovals, setLiveApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCommandCentre(isSilent = false) {
      if (!isSilent && !liveKpis) {
        setLoading(true);
      }
      try {
        const results = await Promise.allSettled([
          apiService.getCurrentAdmissions({}, { forceRefresh: true }),
          apiService.getDischargedPatients({}, { forceRefresh: true }),
          apiService.getBedManagementData({}, { forceRefresh: true })
        ]);

        if (!isMounted) return;

        const [admSettled, disSettled, bmSettled] = results;

        const isAdmRejected = admSettled.status === 'rejected';
        const isDisRejected = disSettled.status === 'rejected';
        const isBmRejected = bmSettled.status === 'rejected';

        // If all APIs failed (e.g. backend server offline / connection refused)
        if (isAdmRejected && isDisRejected && isBmRejected) {
          const errMsg = bmSettled.reason?.message || admSettled.reason?.message || 'Connection refused';
          setApiError(`Backend API unreachable (${errMsg}). Verify server is running on http://127.0.0.1:8000.`);
          setLiveKpis(null);
          setLiveWards([]);
          setLiveExceptions([]);
          setLiveApprovals([]);
          return;
        }

        setApiError(null);
        setLastSyncTime(new Date());

        const rawAdmissions = admSettled.status === 'fulfilled' ? (admSettled.value?.data || []) : [];
        const rawDischarges = disSettled.status === 'fulfilled' ? (disSettled.value?.data || []) : [];
        const bmRes = bmSettled.status === 'fulfilled' ? bmSettled.value : null;

        const dischargedTracker = extractDischargedPatientIds(rawDischarges);
        
        // Discharge API and admission status: remove actually discharged patients from current admissions
        const actualAdmissions = rawAdmissions.filter(p => {
          const st = (p.discharge_status || p.admission_status || '').toLowerCase();
          if (st === 'discharged') return false;
          return !dischargedTracker.has(p);
        });

        // Only count summaries that are ACTUALLY approved / signed off as discharged patients
        const actuallyDischargedCount = rawDischarges.filter(r => {
          const st = String(r.approval_status || r.status || '').trim().toLowerCase();
          return st === 'approved' || st === 'signed' || st === 'signed off' || st === 'completed';
        }).length;

        const discharges = rawDischarges.map(parseDischargeSummaryRecord).filter(Boolean);
        const kpisObj = bmRes?.kpis || {};
        const wardsList = bmRes?.wards || [];

        // Dynamic metrics directly from API - strictly mathematically consistent
        let totalBeds = kpisObj.total_beds !== undefined 
          ? kpisObj.total_beds 
          : wardsList.reduce((acc, w) => acc + (w.total_beds || 0), 0);
        let occupiedBeds = actualAdmissions.length > 0 
          ? actualAdmissions.length 
          : (kpisObj.occupied_beds !== undefined ? kpisObj.occupied_beds : 0);
        let maintenanceBeds = kpisObj.maintenance_beds || 0;
        let availableBeds = totalBeds > 0 ? Math.max(0, totalBeds - occupiedBeds - maintenanceBeds) : 0;
        let occupancyRate = totalBeds > 0 ? Number(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0;
        let totalWards = kpisObj.total_wards !== undefined 
          ? kpisObj.total_wards 
          : wardsList.length;
        let totalRooms = kpisObj.total_rooms !== undefined 
          ? kpisObj.total_rooms 
          : wardsList.reduce((acc, w) => acc + (w.rooms_count || w.rooms?.length || 0), 0);
        // Active inpatients in hospital matches actual admissions
        let activeAdmissionsCount = actualAdmissions.length;

        setLiveKpis({
          active_admissions: activeAdmissionsCount,
          discharged_patients: actuallyDischargedCount,
          total_beds: totalBeds,
          occupied_beds: occupiedBeds,
          available_beds: availableBeds,
          maintenance_beds: maintenanceBeds,
          occupancy_rate: occupancyRate,
          total_wards: totalWards,
          total_rooms: totalRooms
        });

        setLiveWards(wardsList);

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
        } else {
          setLiveExceptions([]);
          setLiveApprovals([]);
        }
      } catch (err) {
        console.warn("Failed to load Command Centre metrics:", err);
        if (isMounted) {
          setApiError(err.message || "Failed to load live metrics from backend API");
          setLiveKpis(null);
          setLiveWards([]);
          setLiveExceptions([]);
          setLiveApprovals([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCommandCentre();

    const timer = setInterval(() => {
      loadCommandCentre(true);
    }, 6000);

    const handleUpdate = () => loadCommandCentre(true);
    window.addEventListener('hc_api_updated', handleUpdate);

    return () => {
      isMounted = false;
      clearInterval(timer);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, []);

  const kpis = [
    { 
      id: 'adm', 
      t: 'Currently Admitted Patients', 
      v: liveKpis ? String(liveKpis.active_admissions) : (apiError ? '—' : null), 
      sub: liveKpis ? `Active inpatients across ${liveKpis.total_wards} wards` : (apiError ? 'API Offline · No live data' : 'Active inpatients across all wards'), 
      c: 'oklch(0.5 0.1 200)', 
      target: 'clinical' 
    },
    { 
      id: 'dis', 
      t: 'Discharged Patient Records', 
      v: liveKpis ? String(liveKpis.discharged_patients) : (apiError ? '—' : null), 
      sub: apiError ? 'API Offline · No live data' : 'Patients discharged from inpatient care', 
      c: 'oklch(0.4 0.12 150)', 
      target: 'discharge' 
    },
    { 
      id: 'inv', 
      t: 'Total Hospital Beds', 
      v: liveKpis ? String(liveKpis.total_beds) : (apiError ? '—' : null), 
      sub: liveKpis ? `${liveKpis.available_beds} available · ${liveKpis.occupied_beds} occupied` : (apiError ? 'API Offline · Bed census unavailable' : 'Real-time bed census'), 
      c: '#15181b', 
      target: 'beds' 
    },
    { 
      id: 'occ', 
      t: 'Hospital Occupancy Rate', 
      v: liveKpis ? `${liveKpis.occupancy_rate}%` : (apiError ? '—' : null), 
      sub: liveKpis ? `${liveKpis.occupied_beds} of ${liveKpis.total_beds} beds in use` : (apiError ? 'API Offline · Capacity unknown' : 'Calculated capacity'), 
      c: 'oklch(0.5 0.18 25)', 
      target: 'beds' 
    },
    { 
      id: 'wards', 
      t: 'Hospital Wards Count', 
      v: liveKpis ? String(liveKpis.total_wards) : (apiError ? '—' : null), 
      sub: apiError ? 'API Offline · Wards unavailable' : 'Across all floors and departments', 
      c: '#15181b', 
      target: 'beds' 
    },
    { 
      id: 'rooms', 
      t: 'Hospital Rooms Count', 
      v: liveKpis ? String(liveKpis.total_rooms) : (apiError ? '—' : null), 
      sub: apiError ? 'API Offline · Rooms unavailable' : 'Across all wards and care units', 
      c: '#15181b', 
      target: 'beds' 
    },
    { 
      id: 'avail', 
      t: 'Available Vacant Beds', 
      v: liveKpis ? String(liveKpis.available_beds) : (apiError ? '—' : null), 
      sub: apiError ? 'API Offline · Intake capacity unknown' : 'Immediate intake capacity', 
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
            {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · Live Clinical Operational Intelligence
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

      {/* API Connection & Health Alert Banner */}
      {apiError ? (
        <div style={{
          background: 'oklch(0.97 0.04 25)',
          border: '1px solid oklch(0.85 0.08 25)',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'oklch(0.4 0.16 25)' }}>
                Live API Offline · Backend Unreachable
              </div>
              <div style={{ fontSize: '11.5px', color: '#667085', marginTop: '2px' }}>
                {apiError} All static mock data has been removed. Live dynamic data will display once backend responds.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const evt = new CustomEvent('hc_api_updated');
              window.dispatchEvent(evt);
            }}
            style={{
              height: '30px',
              padding: '0 14px',
              borderRadius: '6px',
              border: 0,
              background: 'oklch(0.5 0.18 25)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Retry Connection 🔄
          </button>
        </div>
      ) : null}

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
              Operational exceptions · {exceptions.length} open
            </div>
            <a
              href="#exceptions"
              onClick={(e) => { e.preventDefault(); onNavigate('discharge'); }}
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

            {exceptions.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: '#8a9096', fontSize: '12px' }}>
                {apiError ? '⚠️ Live discharge exceptions cannot be loaded because the API is offline.' : 'No active operational exceptions.'}
              </div>
            ) : (
              exceptions.map((it, idx) => (
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
              ))
            )}
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
                {apiError ? 'OFFLINE' : 'LIVE AI'}
              </span>
            </div>
            <div style={{ lineHeight: 1.5, color: '#52585e', fontSize: '12px' }}>
              {apiError
                ? 'Copilot telemetry is paused while the backend is unreachable. Connect the FastAPI server to resume live operational intelligence.'
                : 'Discharge delays are concentrated in insurance preauthorization reviews. Ward turnaround and bed releases are monitored dynamically.'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#8a9096' }}>
              Sources: Clinical EHR Database, LIS &amp; Hospital Registry
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
            <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '8px' }}>
              Human approval queue ({approvals.length})
            </div>
            {approvals.length === 0 ? (
              <div style={{ padding: '14px 4px', textAlign: 'center', color: '#8a9096', fontSize: '11.5px' }}>
                {apiError ? 'Approval queue unavailable (API offline).' : 'No items awaiting approval.'}
              </div>
            ) : (
              approvals.map((a, i) => (
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
              ))
            )}
          </div>

          {/* Ward occupancy */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '10px' }}>
              Ward occupancy ({displayWards.length} wards)
            </div>
            {displayWards.length === 0 ? (
              <div style={{ padding: '14px 4px', textAlign: 'center', color: '#8a9096', fontSize: '11.5px' }}>
                {apiError ? 'Ward occupancy unavailable (API offline).' : 'No active wards found.'}
              </div>
            ) : (
              displayWards.map((w) => (
                <div key={w.name} style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr) 40px', gap: '8px', alignItems: 'center', padding: '3px 0', fontSize: '11.5px' }}>
                  <span style={{ color: '#52585e' }}>{w.name}</span>
                  <div style={{ height: '7px', background: '#eef0f1', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${w.pct}%`, height: '100%', background: w.color }} />
                  </div>
                  <span style={{ textAlign: 'right', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px' }}>
                    {w.o}/{w.n}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Platform health */}
          <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '8px' }}>Platform health</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '5px 12px', color: '#52585e', fontSize: '11.5px' }}>
              <span>Backend API</span>
              <span style={{ color: apiError ? 'oklch(0.5 0.18 25)' : 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                {apiError ? 'Offline (Port 8000)' : 'Online · Port 8000'}
              </span>
              <span>Clinical Records Database</span>
              <span style={{ color: apiError ? 'oklch(0.5 0.18 25)' : 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                {apiError ? 'Unreachable' : 'Connected · Online'}
              </span>
              <span>Live Bed Tracker</span>
              <span style={{ color: apiError ? '#8a9096' : 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                {apiError ? '—' : `${liveKpis?.total_beds ?? 0} beds dynamic`}
              </span>
              <span>Active Inpatients</span>
              <span style={{ color: apiError ? '#8a9096' : 'oklch(0.4 0.12 150)', fontWeight: 600 }}>
                {apiError ? '—' : `${liveKpis?.active_admissions ?? 0} admitted`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
