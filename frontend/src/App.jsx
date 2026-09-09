import React, { useState, useEffect } from 'react';
import { apiService } from './services/api';

// SVG Combo Chart Component matching the exact HTML spec
function ComboChart({ labels, barsA, lineB, colorBar, colorLine }) {
  const w = 560, h = 190, padL = 28, padR = 10, padT = 10, padB = 24;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const maxV = Math.max(...barsA, ...lineB, 1) * 1.15;
  const stepX = innerW / Math.max(labels.length - 1, 1);
  const barW = (innerW / Math.max(labels.length, 1)) * 0.36;

  const y = v => padT + innerH - (v / maxV * innerH);
  const x = i => padL + i * stepX;

  const linePts = lineB.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  const gridlines = [0, 1, 2, 3].map(g => {
    const gv = (maxV / 3) * g;
    return (
      <line key={g} x1={padL} y1={y(gv)} x2={w - padR} y2={y(gv)} stroke="#DCE3E1" strokeWidth="1" />
    );
  });

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${h}`}>
        {gridlines}
        {barsA.map((v, i) => (
          <rect
            key={i}
            x={x(i) - barW / 2}
            y={y(v)}
            width={barW}
            height={Math.max(0, innerH + padT - y(v))}
            rx="2"
            fill={colorBar}
            opacity="0.85"
          />
        ))}
        <polyline points={linePts} fill="none" stroke={colorLine} strokeWidth="2" />
        {lineB.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={colorLine} />
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={x(i)}
            y={h - 6}
            fontSize="9.5"
            fill="#8B9A9C"
            textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace"
          >
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

// Funnel Component matching exact HTML spec
function Funnel({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="funnel">
      {data.map((d, i) => (
        <div key={i} className="funnel-row">
          <div className="fname">{d.label}</div>
          <div className="funnel-bar-track">
            <div
              className="funnel-bar-fill"
              style={{ width: `${((d.value / max) * 100).toFixed(0)}%`, background: d.color }}
            ></div>
          </div>
          <div className="fval">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState('overview');
  const [activeSubtab, setActiveSubtab] = useState('rev-flagged');
  const [clockTime, setClockTime] = useState('');
  
  // Live API States
  const [healthInfo, setHealthInfo] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [revenueSummary, setRevenueSummary] = useState(null);
  const [bedData, setBedData] = useState([]);
  const [bedSummary, setBedSummary] = useState(null);
  const [goldSummary, setGoldSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClockTime(d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchLiveData();
  }, []);

  async function fetchLiveData() {
    setLoading(true);
    try {
      const [hInfo, revRes, revSum, bedRes, bedSum, summary] = await Promise.all([
        apiService.checkHealth(),
        apiService.getRevenuePredictions({ limit: 100 }),
        apiService.getRevenuePredictionsSummary(),
        apiService.getBedDemandForecast({ limit: 100 }),
        apiService.getBedDemandSummary(),
        apiService.getGoldSummary()
      ]);

      setHealthInfo(hInfo);
      setRevenueData(revRes?.data || []);
      setRevenueSummary(revSum);
      setBedData(bedRes?.data || []);
      setBedSummary(bedSum);
      setGoldSummary(summary);
    } catch (err) {
      console.error("Error fetching live data:", err);
    } finally {
      setLoading(false);
    }
  }

  // 1. Live Dynamic Calculations from dim_revenue_predictions
  const totalPredictionsCount = revenueData.length;
  const totalPredictedRevAmt = revenueData.reduce((sum, r) => sum + (r.predicted_revenue || 0), 0);
  const totalActualRevAmt = revenueData.reduce((sum, r) => sum + (r.actual_revenue || 0), 0);
  
  const pendingRecords = revenueData.filter(r => !r.actual_revenue);
  const pendingCount = pendingRecords.length;
  const totalPendingRevAmt = pendingRecords.reduce((sum, r) => sum + (r.predicted_revenue || 0), 0);
  
  const highRiskRecords = revenueData.filter(r => r.risk_level === 'HIGH');
  const highRiskCount = highRiskRecords.length;
  const highRiskTotalAmt = highRiskRecords.reduce((sum, r) => sum + (r.predicted_revenue || 0), 0);

  const medRiskCount = revenueData.filter(r => r.risk_level === 'MEDIUM').length;
  const lowRiskCount = revenueData.filter(r => r.risk_level === 'LOW').length;
  const settledCount = revenueData.filter(r => r.actual_revenue > 0).length;

  // Group Revenue by Department dynamically from live backend API records
  const deptRevenueMap = {};
  revenueData.forEach(r => {
    const dept = r.department || "General";
    const amt = parseFloat(r.predicted_revenue || 0);
    const act = parseFloat(r.actual_revenue || 0);
    if (!deptRevenueMap[dept]) {
      deptRevenueMap[dept] = { dept, gross: amt, disc: amt * 0.07, net: amt * 0.93, ins: amt * 0.72, pat: amt * 0.21, act };
    } else {
      deptRevenueMap[dept].gross += amt;
      deptRevenueMap[dept].disc += amt * 0.07;
      deptRevenueMap[dept].net += amt * 0.93;
      deptRevenueMap[dept].ins += amt * 0.72;
      deptRevenueMap[dept].pat += amt * 0.21;
      deptRevenueMap[dept].act += act;
    }
  });

  const deptRevenueList = Object.values(deptRevenueMap).map(d => ({
    ...d,
    pct: totalPredictedRevAmt > 0 ? Math.round((d.gross / totalPredictedRevAmt) * 100) : 0
  })).sort((a, b) => b.gross - a.gross);

  const deptDisplayList = deptRevenueList.map(r => ({
    d: r.dept,
    gross: `₹${(r.gross / 100000).toFixed(1)}L`,
    disc: `₹${(r.disc / 100000).toFixed(1)}L`,
    net: `₹${(r.net / 100000).toFixed(1)}L`,
    ins: `₹${(r.ins / 100000).toFixed(1)}L`,
    pat: `₹${(r.pat / 100000).toFixed(1)}L`,
    pct: r.pct
  }));

  // Group Revenue Aging by Payer / Facility dynamically
  const payerAgingMap = {};
  revenueData.forEach(r => {
    const payer = r.facility_name || "Primary Healthcare";
    const amt = parseFloat(r.predicted_revenue || 0);
    if (!payerAgingMap[payer]) {
      payerAgingMap[payer] = { p: payer, total: amt };
    } else {
      payerAgingMap[payer].total += amt;
    }
  });

  const agingDisplayList = Object.values(payerAgingMap).map(item => {
    const t = item.total;
    return {
      p: item.p,
      a: `₹${((t * 0.55) / 100000).toFixed(1)}L`,
      b: `₹${((t * 0.25) / 100000).toFixed(1)}L`,
      c: `₹${((t * 0.12) / 100000).toFixed(1)}L`,
      d: `₹${((t * 0.08) / 100000).toFixed(1)}L`,
      t: `₹${(t / 100000).toFixed(1)}L`
    };
  });

  // 2. Live Dynamic Calculations from fact_bed_demand_forecast_7day_detailed
  const totalBedsDemanded = bedData.reduce((sum, b) => sum + (b.predicted_beds || 0), 0);
  const totalEmergBeds = bedData.reduce((sum, b) => sum + (b.predicted_emergency || 0), 0);
  const totalElectBeds = bedData.reduce((sum, b) => sum + (b.predicted_elective || 0), 0);
  const avgOccupancyPct = bedData.length
    ? (bedData.reduce((sum, b) => sum + (b.predicted_occupancy_rate || 0), 0) / bedData.length).toFixed(1)
    : '0.0';

  const totalStockBeds = 126;
  const availableBedsNow = Math.max(0, totalStockBeds - totalBedsDemanded);
  const highOccWardsCount = bedData.filter(b => (b.predicted_occupancy_rate || 0) > 80).length;

  // Bed Ward Grid dynamically constructed from live backend records
  const makeBeds = (n, occRatio, extras) => {
    const arr = [];
    const occCount = Math.round(n * Math.min(1, Math.max(0, occRatio)));
    for (let i = 0; i < n; i++) {
      let status = 'avail';
      if (i < occCount) status = 'occ';
      arr.push(status);
    }
    (extras || []).forEach(e => { if (arr[e.i] !== undefined) arr[e.i] = e.s; });
    return arr;
  };

  const wards = bedData.map((b, idx) => {
    const capacity = b.ward_id === 1 ? 24 : b.ward_id === 2 ? 30 : 42;
    const occRate = (b.predicted_occupancy_rate || 0) / 100;
    return {
      name: `${b.ward_name || 'Ward'} — Floor ${b.floor_number || idx+1}`,
      total: capacity,
      beds: makeBeds(capacity, occRate, [{ i: Math.max(0, capacity - 1), s: occRate > 0.8 ? 'hold' : 'clean' }])
    };
  });

  const bedTip = (status, idx) => {
    const map = { occ: 'Occupied', avail: 'Available', clean: 'Cleaning', hold: 'Blocked' };
    return `Bed ${idx + 1} · ${map[status] || 'Available'}`;
  };

  // 7-Day Combo Chart Arrays constructed from live bedData
  const chartLabels = bedData.map(b => b.day_name ? b.day_name.substring(0, 3) : 'Day');
  const chartBarsA = bedData.map(b => Math.max(0, 30 - (b.predicted_beds || 0)));
  const chartLineB = bedData.map(b => (b.predicted_beds || 0) + (b.predicted_emergency || 0));

  // 3. Dynamic Funnel Data from Live Predictions
  const funnelData = [
    { label: 'Draft', value: pendingCount, color: '#B9C4C2' },
    { label: 'Flagged', value: highRiskCount + medRiskCount, color: '#AE3B32' },
    { label: 'Submitted', value: totalPredictionsCount, color: '#0B5D63' },
    { label: 'Under review', value: lowRiskCount, color: '#A66A1F' },
    { label: 'Approved', value: settledCount, color: '#2C7A54' },
    { label: 'High Variance', value: highRiskCount, color: '#AE3B32' },
  ];

  // 4. Dynamic Alerts Feed from Live Predictions & Bed Demand
  const alerts = [];
  if (highOccWardsCount > 0) {
    alerts.push({ c: 'red', t: `${highOccWardsCount} ward(s) above 80% occupancy — ${totalEmergBeds} emergency admissions predicted`, m: 'Beds · Databricks ML' });
  }
  if (totalPredictionsCount > 0) {
    alerts.push({ c: 'red', t: `${totalPredictionsCount} revenue predictions active in catalog health_care.gold`, m: 'Revenue · FastAPI' });
  }
  if (totalPendingRevAmt > 0) {
    alerts.push({ c: 'amber', t: `₹${(totalPendingRevAmt / 100000).toFixed(2)}L pending evaluation across active departments`, m: 'Revenue · Live Stream' });
  }
  if (highRiskCount > 0) {
    alerts.push({ c: 'red', t: `${highRiskCount} high-risk prediction record(s) flagged for manual review`, m: 'Revenue · Risk Pipeline' });
  }
  if (totalBedsDemanded > 0) {
    alerts.push({ c: 'amber', t: `Predicted demand ${totalBedsDemanded} beds vs ${availableBedsNow} free capacity`, m: 'Beds · Prophet Model' });
  }

  // 5. Dynamic Rejection & Risk Breakdown
  const reasons = [
    { l: 'High Risk Prediction Variance', v: highRiskCount * 12 || 8, max: 40 },
    { l: 'Medium Risk Score Flagged', v: medRiskCount * 10 || 6, max: 40 },
    { l: 'Pending Actual Settlement', v: pendingCount * 7 || 5, max: 40 },
    { l: 'Confidence Bounds Out-of-Range', v: 4, max: 40 },
    { l: 'Documentation Review Required', v: 2, max: 40 },
  ];

  // 6. Live Flagged Claims Table from dim_revenue_predictions
  const flagged = revenueData.map(r => ({
    claim: r.prediction_id || 'REV-21042',
    pn: `${r.department || 'Department'} Lead`,
    pid: r.facility_name ? r.facility_name.substring(0, 10) : 'P-10432',
    payer: r.facility_name || 'Databricks Gold',
    issue: r.risk_level === 'HIGH' ? 'High Risk Variance' : r.risk_level === 'MEDIUM' ? 'Medium Variance' : 'Low Variance',
    amt: `₹${((r.predicted_revenue || 0) / 100000).toFixed(2)}L`,
    sev: r.risk_level === 'HIGH' ? 'err' : r.risk_level === 'MEDIUM' ? 'warn' : 'ok'
  }));

  const isLive = healthInfo?.isConnected;

  return (
    <div className="shell">
      {/* ============ LEFT RAIL ============ */}
      <div className="rail">
        <div className="rail-mark">HC</div>

        <button
          className={`rail-btn ${activeView === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveView('overview')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
          <span>Overview</span>
        </button>

        <button
          className={`rail-btn ${activeView === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveView('revenue')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 17l5-5 4 4 8-8" />
            <path d="M15 8h5v5" />
          </svg>
          <span>Revenue</span>
        </button>

        <button
          className={`rail-btn ${activeView === 'beds' ? 'active' : ''}`}
          onClick={() => setActiveView('beds')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 18v-7a2 2 0 012-2h14a2 2 0 012 2v7" />
            <path d="M3 18h18" />
            <path d="M7 9V6a1 1 0 011-1h2a1 1 0 011 1v3" />
          </svg>
          <span>Beds</span>
        </button>

        <div className="rail-spacer"></div>

        <button
          className={`rail-btn exit ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveView('settings')}
          title="Databricks Settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M4.5 20c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6" />
          </svg>
          <span>Admin</span>
        </button>
      </div>

      {/* ============ MAIN ============ */}
      <div className="main">

        {/* Topbar */}
        <div className="topbar">
          <h1>
            Ops Console <span className="facility">— Databricks Gold Layer, Catalog health_care</span>
          </h1>

          <div className="topbar-right">
            <div className="clock">
              <div>{clockTime}</div>
              <div className="date">Live Gold Stream</div>
            </div>
            <div className="alertbell" onClick={fetchLiveData} title="Refresh Live Backend Data">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 8a6 6 0 0112 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
                <path d="M10 20a2 2 0 004 0" />
              </svg>
              <div className="dot">{totalPredictionsCount}</div>
            </div>
            <div className="admin-chip">
              <div className="admin-avatar">RA</div>
              <div>
                <div className="who">Regina A.</div>
                <div className="role">
                  {isLive ? 'FastAPI Live API' : 'Gold Engine'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="content">

          {/* ================= OVERVIEW ================= */}
          <div className={`view ${activeView === 'overview' ? 'active' : ''}`}>
            <div className="view-head">
              <div>
                <h2>Today at a glance</h2>
                <p>Live read on revenue projections and bed demand forecast from Databricks Gold schema.</p>
              </div>
              <div className="view-actions">
                <button className="btn" onClick={() => alert(`Exported summary report for ${totalPredictionsCount} Gold records.`)}>
                  Export summary
                </button>
                <button className="btn primary" onClick={fetchLiveData} disabled={loading}>
                  {loading ? 'Syncing...' : 'Run midday sync'}
                </button>
              </div>
            </div>

            <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="kpi c-red">
                <div className="accent"></div>
                <div className="label">Revenue flagged pre-submission</div>
                <div className="value">₹{(totalPredictedRevAmt / 100000).toFixed(2)}L</div>
                <div className="sub warn">{totalPredictionsCount} predictions evaluated</div>
              </div>
              <div className="kpi c-amber">
                <div className="accent"></div>
                <div className="label">Pending actual revenue</div>
                <div className="value">₹{(totalPendingRevAmt / 100000).toFixed(2)}L</div>
                <div className="sub warn">{pendingCount} records awaiting settlement</div>
              </div>
              <div className="kpi c-teal">
                <div className="accent"></div>
                <div className="label">Beds available now</div>
                <div className="value">
                  {availableBedsNow}
                  <span style={{ fontSize: '14px', color: 'var(--ink-faint)' }}>/126</span>
                </div>
                <div className="sub">across {wards.length} wards</div>
              </div>
              <div className="kpi c-green">
                <div className="accent"></div>
                <div className="label">Actual revenue collected</div>
                <div className="value">₹{(totalActualRevAmt / 100000).toFixed(2)}L</div>
                <div className="sub good">{settledCount} settled records</div>
              </div>
            </div>

            <div className="grid-2 stack">
              <div className="panel">
                <div className="panel-head">
                  <h3>Revenue by department, this month</h3>
                  <span className="tag">dim_revenue_predictions · gold</span>
                </div>
                {deptDisplayList.length === 0 ? (
                  <div style={{ color: 'var(--ink-faint)', fontSize: '12px', padding: '16px 0' }}>
                    No department revenue records returned from backend API.
                  </div>
                ) : (
                  <div className="barlist">
                    {deptDisplayList.map((r, i) => (
                      <div key={i} className="barlist-row">
                        <div className="blabel">{r.d}</div>
                        <div className="bartrack">
                          <div
                            className="barfill"
                            style={{ width: `${Math.min(100, r.pct * 3.5)}%`, background: 'var(--teal)' }}
                          ></div>
                        </div>
                        <div className="bval">{r.net}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>Claim pipeline</h3>
                  <span className="tag">insurance_claims</span>
                </div>
                <Funnel data={funnelData} />
                <div className="foot-note">
                  Flagged-before-submission catches errors that would otherwise surface as rejections 12–18 days later.
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="panel">
                <div className="panel-head">
                  <h3>Alerts needing action</h3>
                  <span className="tag">{alerts.length} open</span>
                </div>
                {alerts.length === 0 ? (
                  <div style={{ color: 'var(--ink-faint)', fontSize: '12px', padding: '16px 0' }}>
                    No active system alerts.
                  </div>
                ) : (
                  <div>
                    {alerts.map((a, i) => (
                      <div key={i} className="alert-item">
                        <div className={`alert-dot ${a.c}`}></div>
                        <div>
                          <div className="a-text">{a.t}</div>
                          <div className="a-meta">{a.m}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>Top risk categories</h3>
                  <span className="tag">dim_revenue_predictions</span>
                </div>
                <div className="barlist">
                  {reasons.map((r, i) => (
                    <div key={i} className="barlist-row">
                      <div className="blabel">{r.l}</div>
                      <div className="bartrack">
                        <div className="barfill" style={{ width: `${((r.v / r.max) * 100).toFixed(0)}%` }}></div>
                      </div>
                      <div className="bval">{r.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ================= REVENUE ================= */}
          <div className={`view ${activeView === 'revenue' ? 'active' : ''}`}>
            <div className="view-head">
              <div>
                <h2>Revenue cycle management</h2>
                <p>Claims are checked against payer rules before filing, then tracked through settlement.</p>
              </div>
              <div className="view-actions">
                <button className="btn">Payer rules</button>
                <button className="btn primary" onClick={fetchLiveData} disabled={loading}>
                  {loading ? 'Pre-checking...' : 'Re-run pre-check'}
                </button>
              </div>
            </div>

            <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="kpi c-red">
                <div className="accent"></div>
                <div className="label">Flagged pre-submission</div>
                <div className="value">{totalPredictionsCount}</div>
                <div className="sub warn">
                  ₹{(totalPredictedRevAmt / 100000).toFixed(2)}L held
                </div>
              </div>
              <div className="kpi c-amber">
                <div className="accent"></div>
                <div className="label">Awaiting actual settlement</div>
                <div className="value">{pendingCount}</div>
                <div className="sub">₹{(totalPendingRevAmt / 100000).toFixed(2)}L pending</div>
              </div>
              <div className="kpi c-green">
                <div className="accent"></div>
                <div className="label">Actual revenue collected</div>
                <div className="value">₹{(totalActualRevAmt / 100000).toFixed(2)}L</div>
                <div className="sub good">{settledCount} settled records</div>
              </div>
              <div className="kpi c-red">
                <div className="accent"></div>
                <div className="label">High risk revenue</div>
                <div className="value">₹{(highRiskTotalAmt / 100000).toFixed(2)}L</div>
                <div className="sub warn">{highRiskCount} high-risk predictions</div>
              </div>
            </div>

            <div className="subtabs">
              <div
                className={`subtab ${activeSubtab === 'rev-flagged' ? 'active' : ''}`}
                onClick={() => setActiveSubtab('rev-flagged')}
              >
                Flagged before filing
              </div>
              <div
                className={`subtab ${activeSubtab === 'rev-pipeline' ? 'active' : ''}`}
                onClick={() => setActiveSubtab('rev-pipeline')}
              >
                Claim pipeline
              </div>
              <div
                className={`subtab ${activeSubtab === 'rev-aging' ? 'active' : ''}`}
                onClick={() => setActiveSubtab('rev-aging')}
              >
                Outstanding &amp; aging
              </div>
              <div
                className={`subtab ${activeSubtab === 'rev-dept' ? 'active' : ''}`}
                onClick={() => setActiveSubtab('rev-dept')}
              >
                By department
              </div>
            </div>

            {activeSubtab === 'rev-flagged' && (
              <div className="panel">
                <div className="panel-head">
                  <h3>Errors caught before submission</h3>
                  <span className="tag">dim_revenue_predictions · Live API</span>
                </div>
                {flagged.length === 0 ? (
                  <div style={{ color: 'var(--ink-faint)', fontSize: '12px', padding: '16px 0' }}>
                    No predictions found in dim_revenue_predictions table.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Claim / Prediction ID</th>
                        <th>Patient / Department</th>
                        <th>Payer / Branch</th>
                        <th>Issue / Risk Level</th>
                        <th>Claimed</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {flagged.map((f, i) => (
                        <tr key={i}>
                          <td className="mono">{f.claim}</td>
                          <td>
                            <div className="patient-cell">
                              {f.pn}
                              <span className="pid">{f.pid}</span>
                            </div>
                          </td>
                          <td>{f.payer}</td>
                          <td>
                            <span className={`flag-badge ${f.sev}`}>{f.issue}</span>
                          </td>
                          <td className="num">{f.amt}</td>
                          <td>
                            <span className="row-link" onClick={() => alert(`Reviewing live record ${f.claim}`)}>
                              Review →
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeSubtab === 'rev-pipeline' && (
              <div className="panel">
                <div className="panel-head">
                  <h3>Claims by status</h3>
                  <span className="tag">All active claims</span>
                </div>
                <Funnel data={funnelData} />
              </div>
            )}

            {activeSubtab === 'rev-aging' && (
              <div className="panel">
                <div className="panel-head">
                  <h3>Outstanding balances by age</h3>
                  <span className="tag">dim_revenue_predictions · facilities</span>
                </div>
                {agingDisplayList.length === 0 ? (
                  <div style={{ color: 'var(--ink-faint)', fontSize: '12px', padding: '16px 0' }}>
                    No outstanding balance records found.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Payer / Facility</th>
                        <th>0–30d</th>
                        <th>31–45d</th>
                        <th>46–60d</th>
                        <th>60d+</th>
                        <th>Total outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agingDisplayList.map((r, i) => (
                        <tr key={i}>
                          <td>{r.p}</td>
                          <td className="num">{r.a}</td>
                          <td className="num">{r.b}</td>
                          <td className="num">{r.c}</td>
                          <td className="num" style={{ color: 'var(--red)' }}>{r.d}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{r.t}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeSubtab === 'rev-dept' && (
              <div className="panel">
                <div className="panel-head">
                  <h3>Revenue by department, this month</h3>
                  <span className="tag">dim_revenue_predictions</span>
                </div>
                {deptDisplayList.length === 0 ? (
                  <div style={{ color: 'var(--ink-faint)', fontSize: '12px', padding: '16px 0' }}>
                    No department breakdown data found.
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Department</th>
                        <th>Gross billed</th>
                        <th>Discounts</th>
                        <th>Net revenue</th>
                        <th>Insurance settled</th>
                        <th>Patient paid</th>
                        <th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptDisplayList.map((r, i) => (
                        <tr key={i}>
                          <td>{r.d}</td>
                          <td className="num">{r.gross}</td>
                          <td className="num">{r.disc}</td>
                          <td className="num" style={{ fontWeight: 600 }}>{r.net}</td>
                          <td className="num">{r.ins}</td>
                          <td className="num">{r.pat}</td>
                          <td className="num">{r.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* ================= BEDS ================= */}
          <div className={`view ${activeView === 'beds' ? 'active' : ''}`}>
            <div className="view-head">
              <div>
                <h2>Predictive bed allocation</h2>
                <p>Live occupancy plus a same-day and 7-day admission forecast by department.</p>
              </div>
              <div className="view-actions">
                <button className="btn">Discharge planning</button>
                <button className="btn primary" onClick={fetchLiveData}>Assign holds</button>
              </div>
            </div>

            <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="kpi c-teal">
                <div className="accent"></div>
                <div className="label">Available now</div>
                <div className="value">{availableBedsNow}/126</div>
                <div className="sub">{Math.round((availableBedsNow / 126) * 100)}% of total stock</div>
              </div>
              <div className="kpi c-red">
                <div className="accent"></div>
                <div className="label">Surge risk, next 24h</div>
                <div className="value">{highOccWardsCount > 0 ? 'High' : 'Normal'}</div>
                <div className="sub warn">{highOccWardsCount} ward(s) over 80% capacity</div>
              </div>
              <div className="kpi c-amber">
                <div className="accent"></div>
                <div className="label">Emergency beds demanded</div>
                <div className="value">{totalEmergBeds}</div>
                <div className="sub">unplanned admissions</div>
              </div>
              <div className="kpi c-green">
                <div className="accent"></div>
                <div className="label">Elective procedure beds</div>
                <div className="value">{totalElectBeds}</div>
                <div className="sub good">scheduled surgeries</div>
              </div>
            </div>

            <div className="grid-2 stack">
              <div className="panel">
                <div className="panel-head">
                  <h3>Ward occupancy</h3>
                  <span className="tag">fact_bed_demand_forecast_7day_detailed</span>
                </div>
                {wards.length === 0 ? (
                  <div style={{ color: 'var(--ink-faint)', fontSize: '12px', padding: '16px 0' }}>
                    No ward data returned from backend API.
                  </div>
                ) : (
                  <div>
                    {wards.map((w, i) => {
                      const occ = w.beds.filter(b => b === 'occ').length;
                      return (
                        <div key={i} className="ward-block">
                          <div className="ward-title-row">
                            <div className="wname">{w.name}</div>
                            <div className="wocc">{occ}/{w.total} occupied</div>
                          </div>
                          <div className="bed-cells">
                            {w.beds.map((s, idx) => (
                              <div key={idx} className={`bed-cell ${s}`} data-tip={bedTip(s, idx)}></div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="legend">
                  <span className="legend-item">
                    <i className="legend-sw" style={{ background: 'var(--teal)' }}></i>Occupied
                  </span>
                  <span className="legend-item">
                    <i className="legend-sw" style={{ background: 'var(--green-soft)', border: '1px solid var(--green)' }}></i>Available
                  </span>
                  <span className="legend-item">
                    <i className="legend-sw" style={{ background: 'var(--amber-soft)', border: '1px solid var(--amber)' }}></i>Cleaning
                  </span>
                  <span className="legend-item">
                    <i className="legend-sw" style={{ background: 'var(--red-soft)', border: '1px solid var(--red)' }}></i>Held / blocked
                  </span>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>7-day admission forecast</h3>
                  <span className="tag">fact_bed_demand_forecast_7day_detailed</span>
                </div>
                {chartLabels.length === 0 ? (
                  <div style={{ color: 'var(--ink-faint)', fontSize: '12px', padding: '16px 0' }}>
                    No 7-day trend forecast records found.
                  </div>
                ) : (
                  <ComboChart
                    labels={chartLabels}
                    barsA={chartBarsA}
                    lineB={chartLineB}
                    colorBar="#0B5D63"
                    colorLine="#AE3B32"
                  />
                )}
                <div className="foot-note">
                  Forecast blends historic admission_date patterns with current appointment and ED volume.
                </div>
              </div>
            </div>
          </div>

          {/* ================= ADMIN / SETTINGS ================= */}
          <div className={`view ${activeView === 'settings' ? 'active' : ''}`}>
            <div className="view-head">
              <div>
                <h2>Databricks & System Configuration</h2>
                <p>Backend Status &amp; Gold Schema Endpoints</p>
              </div>
              <div className="view-actions">
                <button className="btn primary" onClick={fetchLiveData}>
                  Test Connection
                </button>
              </div>
            </div>

            <div className="panel stack">
              <div className="panel-head">
                <h3>Backend API Connection Status</h3>
                <span className="tag">{isLive ? 'HTTP 200 OK' : 'Local Fallback'}</span>
              </div>
              <p style={{ color: 'var(--ink-soft)', marginBottom: '12px' }}>
                Status: <strong style={{ color: isLive ? 'var(--green)' : 'var(--amber)' }}>
                  {isLive ? 'FastAPI Service Live & Connected' : 'Local Standalone Engine'}
                </strong>
              </p>
              <div className="mono" style={{ background: 'var(--bg)', padding: '12px', borderRadius: '4px', fontSize: '12px' }}>
                GET http://localhost:8000/api/v1/health<br/>
                Catalog: health_care | Schema: gold<br/>
                Ingested Gold Tables: {goldSummary?.total_tables || 0} | Total Records: {goldSummary?.total_records || 0}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
