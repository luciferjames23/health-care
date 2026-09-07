import React, { useState, useEffect } from 'react';

// SVG Combo Chart Component matching the exact HTML spec
function ComboChart({ labels, barsA, lineB, colorBar, colorLine }) {
  const w = 560, h = 190, padL = 28, padR = 10, padT = 10, padB = 24;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const maxV = Math.max(...barsA, ...lineB) * 1.15;
  const stepX = innerW / (labels.length - 1);
  const barW = (innerW / labels.length) * 0.36;

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
            height={innerH + padT - y(v)}
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

// Funnel Component
function Funnel({ data }) {
  const max = Math.max(...data.map(d => d.value));
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

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClockTime(d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, []);

  const funnelData = [
    { label: 'Draft', value: 64, color: '#B9C4C2' },
    { label: 'Flagged', value: 37, color: '#AE3B32' },
    { label: 'Submitted', value: 203, color: '#0B5D63' },
    { label: 'Under review', value: 112, color: '#A66A1F' },
    { label: 'Approved', value: 341, color: '#2C7A54' },
    { label: 'Rejected', value: 44, color: '#AE3B32' },
  ];

  const alerts = [
    { c: 'red', t: 'Ward 3B (ICU) at 96% occupancy — 4 admissions predicted in next 12h', m: 'Beds · 2 min ago' },
    { c: 'red', t: '12 claims flagged: diagnosis–procedure code mismatch, Apex Health payer', m: 'Revenue · 8 min ago' },
    { c: 'amber', t: 'Ortho ward turnaround slipping — 3 beds idle over 6 hours', m: 'Beds · 22 min ago' },
    { c: 'amber', t: '₹1.4L outstanding on claim CLM-20984 crosses 60-day aging today', m: 'Revenue · 41 min ago' },
    { c: 'red', t: 'Policy coverage_end_date lapsed for 6 patients with claims in Draft', m: 'Revenue · 1h ago' },
    { c: 'amber', t: 'Predicted surge tomorrow AM exceeds free capacity by 9 beds', m: 'Beds · 1h ago' },
  ];

  const reasons = [
    { l: 'Diagnosis–procedure mismatch', v: 38, max: 40 },
    { l: 'Missing pre-authorization', v: 29, max: 40 },
    { l: 'Coverage lapsed at service date', v: 21, max: 40 },
    { l: 'Duplicate billing service line', v: 14, max: 40 },
    { l: 'Documentation incomplete', v: 9, max: 40 },
  ];

  const flagged = [
    { claim: 'CLM-21042', pn: 'Rekha Suresh', pid: 'P-10432', payer: 'Star Health', issue: 'Diagnosis–procedure mismatch', amt: '₹42,000', sev: 'err' },
    { claim: 'CLM-21055', pn: "Antony D'Souza", pid: 'P-10488', payer: 'Apex Health', issue: 'Missing pre-authorization', amt: '₹1,18,500', sev: 'err' },
    { claim: 'CLM-21061', pn: 'Meera Pillai', pid: 'P-10501', payer: 'HDFC Ergo', issue: 'Coverage lapsed on service date', amt: '₹27,300', sev: 'err' },
    { claim: 'CLM-21070', pn: 'Joseph Fernandes', pid: 'P-10517', payer: 'Star Health', issue: 'Duplicate billing line', amt: '₹9,600', sev: 'warn' },
    { claim: 'CLM-21073', pn: 'Lakshmi Narayan', pid: 'P-10522', payer: 'Care Insurance', issue: 'Claimed > coverage limit', amt: '₹2,04,000', sev: 'err' },
    { claim: 'CLM-21081', pn: 'Thomas Mathew', pid: 'P-10540', payer: 'Apex Health', issue: 'Documentation incomplete', amt: '₹15,800', sev: 'warn' },
  ];

  const aging = [
    { p: 'Star Health', a: '₹2.1L', b: '₹0.9L', c: '₹0.4L', d: '₹0.2L', t: '₹3.6L' },
    { p: 'Apex Health', a: '₹1.4L', b: '₹1.1L', c: '₹0.6L', d: '₹0.5L', t: '₹3.6L' },
    { p: 'HDFC Ergo', a: '₹0.8L', b: '₹0.5L', c: '₹0.3L', d: '₹0.1L', t: '₹1.7L' },
    { p: 'Care Insurance', a: '₹0.6L', b: '₹0.4L', c: '₹0.3L', d: '₹0.3L', t: '₹1.6L' },
    { p: 'National Mutual', a: '₹0.3L', b: '₹0.2L', c: '₹0.2L', d: '₹0.1L', t: '₹0.8L' },
  ];

  const makeBeds = (n, occRatio, extras) => {
    const arr = [];
    const occCount = Math.round(n * occRatio);
    for (let i = 0; i < n; i++) {
      let status = 'avail';
      if (i < occCount) status = 'occ';
      arr.push(status);
    }
    (extras || []).forEach(e => { arr[e.i] = e.s; });
    return arr;
  };

  const wards = [
    { name: 'ICU — Ward 3B', total: 24, beds: makeBeds(24, 0.96, [{ i: 23, s: 'clean' }]) },
    { name: 'Orthopedics — Ward 2A', total: 30, beds: makeBeds(30, 0.90, [{ i: 28, s: 'hold' }, { i: 29, s: 'clean' }]) },
    { name: 'General Medicine — Ward 1C', total: 42, beds: makeBeds(42, 0.71, [{ i: 40, s: 'clean' }, { i: 41, s: 'clean' }]) },
    { name: 'Maternity — Ward 4A', total: 30, beds: makeBeds(30, 0.60, [{ i: 27, s: 'hold' }]) },
  ];

  const bedTip = (status, idx) => {
    const map = { occ: 'Occupied', avail: 'Available', clean: 'Cleaning', hold: 'Blocked' };
    return `Bed ${idx + 1} · ${map[status]}`;
  };

  const turn = [
    { w: 'ICU — Ward 3B', beds: 24, occ: 23, avg: '2.1h', longest: 'Bed 14 · 5.2h', status: 'ok' },
    { w: 'Orthopedics — Ward 2A', beds: 30, occ: 27, avg: '6.4h', longest: 'Bed 29 · 11.8h', status: 'warn' },
    { w: 'General Medicine — Ward 1C', beds: 42, occ: 30, avg: '3.0h', longest: 'Bed 40 · 6.5h', status: 'ok' },
    { w: 'Maternity — Ward 4A', beds: 30, occ: 18, avg: '2.8h', longest: 'Bed 27 · 4.1h', status: 'ok' },
  ];

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

        <button className="rail-btn exit">
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
            Ops Console <span className="facility">— St. Aloysius Multispecialty, Ward Block A–D</span>
          </h1>
          <div className="topbar-right">
            <div className="clock">
              <div>{clockTime || '10:42 AM'}</div>
              <div className="date">Wed, 02 Sep 2026</div>
            </div>
            <div className="alertbell">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 8a6 6 0 0112 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
                <path d="M10 20a2 2 0 004 0" />
              </svg>
              <div className="dot">9</div>
            </div>
            <div className="admin-chip">
              <div className="admin-avatar">RA</div>
              <div>
                <div className="who">Regina A.</div>
                <div className="role">Admin — Ops</div>
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
                <p>Cross-module read on cash at risk and capacity at risk — refreshed every 15 minutes.</p>
              </div>
              <div className="view-actions">
                <button className="btn">Export summary</button>
                <button className="btn primary">Run midday sync</button>
              </div>
            </div>

            <div className="kpi-row">
              <div className="kpi c-red">
                <div className="accent"></div>
                <div className="label">Revenue flagged pre-submission</div>
                <div className="value">₹4.82L</div>
                <div className="sub warn">37 claims held before filing</div>
              </div>
              <div className="kpi c-amber">
                <div className="accent"></div>
                <div className="label">Outstanding &gt; 45 days</div>
                <div className="value">₹11.3L</div>
                <div className="sub warn">14 payers, 3 over ₹1L</div>
              </div>
              <div className="kpi c-teal">
                <div className="accent"></div>
                <div className="label">Beds available now</div>
                <div className="value">
                  18<span style={{ fontSize: '14px', color: 'var(--ink-faint)' }}>/126</span>
                </div>
                <div className="sub">across 4 wards</div>
              </div>
              <div className="kpi c-red">
                <div className="accent"></div>
                <div className="label">Predicted admissions, next 24h</div>
                <div className="value">27</div>
                <div className="sub warn">9 more than free beds</div>
              </div>
              <div className="kpi c-green">
                <div className="accent"></div>
                <div className="label">Avg bed turnaround</div>
                <div className="value">
                  3.4<span style={{ fontSize: '14px', color: 'var(--ink-faint)' }}>h</span>
                </div>
                <div className="sub good">↓ 0.6h vs last week</div>
              </div>
            </div>

            <div className="grid-2 stack">
              <div className="panel">
                <div className="panel-head">
                  <h3>Capacity vs. incoming load — next 7 days</h3>
                  <span className="tag">Predictive · Departments &amp; Admissions</span>
                </div>
                <ComboChart
                  labels={['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue']}
                  barsA={[18, 22, 15, 11, 9, 20, 24]}
                  lineB={[27, 24, 19, 14, 12, 26, 29]}
                  colorBar="#0B5D63"
                  colorLine="#AE3B32"
                />
                <div className="chart-legend">
                  <span><i className="lg-line" style={{ background: 'var(--teal)' }}></i> Beds free at day start</span>
                  <span><i className="lg-line" style={{ background: 'var(--red)' }}></i> Predicted admissions</span>
                </div>
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
                  <span className="tag">9 open</span>
                </div>
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
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>Top rejection reasons, this month</h3>
                  <span className="tag">insurance_claim_items</span>
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
                <button className="btn primary">Re-run pre-check</button>
              </div>
            </div>

            <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="kpi c-red">
                <div className="accent"></div>
                <div className="label">Flagged pre-submission</div>
                <div className="value">37</div>
                <div className="sub warn">₹4.82L held</div>
              </div>
              <div className="kpi c-amber">
                <div className="accent"></div>
                <div className="label">Awaiting payer response</div>
                <div className="value">112</div>
                <div className="sub">avg 9.2 days out</div>
              </div>
              <div className="kpi c-green">
                <div className="accent"></div>
                <div className="label">Approved this month</div>
                <div className="value">₹38.6L</div>
                <div className="sub good">91% first-pass rate</div>
              </div>
              <div className="kpi c-red">
                <div className="accent"></div>
                <div className="label">Rejected this month</div>
                <div className="value">₹6.1L</div>
                <div className="sub warn">44 claims</div>
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
            </div>

            {activeSubtab === 'rev-flagged' && (
              <div className="panel">
                <div className="panel-head">
                  <h3>Errors caught before submission</h3>
                  <span className="tag">Checked against payer policy_number &amp; coverage rules</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Claim</th>
                      <th>Patient</th>
                      <th>Payer</th>
                      <th>Issue</th>
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
                          <span className="row-link">Review →</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  <span className="tag">outstanding_amount &gt; 0</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Payer</th>
                      <th>0–30d</th>
                      <th>31–45d</th>
                      <th>46–60d</th>
                      <th>60d+</th>
                      <th>Total outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map((r, i) => (
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
                <button className="btn primary">Assign holds</button>
              </div>
            </div>

            <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="kpi c-teal">
                <div className="accent"></div>
                <div className="label">Available now</div>
                <div className="value">18/126</div>
                <div className="sub">14% of total stock</div>
              </div>
              <div className="kpi c-red">
                <div className="accent"></div>
                <div className="label">Surge risk, next 24h</div>
                <div className="value">High</div>
                <div className="sub warn">ICU &amp; Ortho over capacity</div>
              </div>
              <div className="kpi c-amber">
                <div className="accent"></div>
                <div className="label">Beds in cleaning hold</div>
                <div className="value">7</div>
                <div className="sub">avg 41 min to ready</div>
              </div>
              <div className="kpi c-green">
                <div className="accent"></div>
                <div className="label">Discharge-ready today</div>
                <div className="value">11</div>
                <div className="sub good">frees capacity by 2 PM</div>
              </div>
            </div>

            <div className="grid-2 stack">
              <div className="panel">
                <div className="panel-head">
                  <h3>Ward occupancy</h3>
                  <span className="tag">beds · bed_assignments</span>
                </div>
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
                    <i className="legend-sw" style={{ background: 'var(--red-soft)', border: '1px solid var(--red)' }}></i>Blocked
                  </span>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>7-day admission forecast</h3>
                  <span className="tag">admission_source · seasonality</span>
                </div>
                <ComboChart
                  labels={['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue']}
                  barsA={[18, 22, 15, 11, 9, 20, 24]}
                  lineB={[27, 24, 19, 14, 12, 26, 29]}
                  colorBar="#0B5D63"
                  colorLine="#AE3B32"
                />
                <div className="foot-note">
                  Forecast blends historic admission_date patterns with current appointment and ED volume.
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>Turnaround by ward</h3>
                <span className="tag">Time from released_date to next assigned_date</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Ward</th>
                    <th>Beds</th>
                    <th>Occupied</th>
                    <th>Avg turnaround</th>
                    <th>Longest idle bed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {turn.map((r, i) => (
                    <tr key={i}>
                      <td>{r.w}</td>
                      <td className="num">{r.beds}</td>
                      <td className="num">{r.occ}</td>
                      <td className="num">{r.avg}</td>
                      <td className="num">{r.longest}</td>
                      <td>
                        {r.status === 'ok' ? (
                          <span className="flag-badge ok">On target</span>
                        ) : (
                          <span className="flag-badge warn">Slipping</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
