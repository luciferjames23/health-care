// Meridian Data Service providing store initialization, demo accounts, and state management

export const DEMO_PASSWORD = 'Hospital@2026';
export const DEMO_OTP = '246810';

export const ALL_ROLES = [
  'Patient',
  'Doctor',
  'Nurse',
  'Front Office',
  'Billing',
  'Finance Manager',
  'Insurance',
  'Radiologist',
  'Laboratory',
  'Pathologist',
  'Pharmacy',
  'Store Manager',
  'Procurement Officer',
  'HR Manager',
  'Canteen Manager',
  'Hospital Management',
  'AI Administrator',
  'Governance Officer',
  'IT Administrator',
  'Auditor'
];

export const DEMO_ROLES = [
  { role: 'Patient', name: 'Kavitha Raman', username: 'kavitha.raman', title: 'Patient', dept: 'Patient Portal', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Doctor', name: 'Dr. Arjun Menon', username: 'arjun.menon', title: 'Consultant Cardiologist', dept: 'Cardiology', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Doctor', name: 'Dr. Priya Narayanan', username: 'priya.narayanan', title: 'Attending Physician', dept: 'Internal Medicine', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Nurse', name: 'Anitha Kumar', username: 'anitha.kumar', title: 'Staff Nurse', dept: 'Nursing', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Nurse', name: 'K. Selvi', username: 'k.selvi', title: 'Charge Nurse', dept: 'Inpatient Wards', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Front Office', name: 'Bhavani Kumar', username: 'bhavani.kumar', title: 'Front Desk Lead', dept: 'Front Office', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Billing', name: 'K. Meena', username: 'k.meena', title: 'Billing Executive', dept: 'Billing & Clearance', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Finance Manager', name: 'T. Venkat', username: 't.venkat', title: 'Finance Manager', dept: 'Finance & Accounts', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Insurance', name: 'R. Sundar', username: 'r.sundar', title: 'TPA Coordinator', dept: 'Insurance & Claims', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Radiologist', name: 'Jancy Selvam', username: 'jancy.selvam', title: 'Senior Radiologist', dept: 'Radiology / PACS', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Laboratory', name: 'M. Ganesh', username: 'm.ganesh', title: 'Senior Lab Technician', dept: 'Laboratory / LIS', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Pathologist', name: 'Dr. Senthil Nathan', username: 'senthil.nathan', title: 'Consultant Pathologist', dept: 'Pathology', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Pharmacy', name: 'S. Devi', username: 's.devi', title: 'Chief Pharmacist', dept: 'Pharmacy', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Store Manager', name: 'A. Murugan', username: 'a.murugan', title: 'Central Store Manager', dept: 'Central Stores', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Procurement Officer', name: 'N. Ramesh', username: 'n.ramesh', title: 'Procurement Lead', dept: 'Procurement', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'HR Manager', name: 'L. Revathi', username: 'l.revathi', title: 'HR Manager', dept: 'Human Resources', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Canteen Manager', name: 'P. Ganesan', username: 'p.ganesan', title: 'Dietary & Canteen Lead', dept: 'Dietary Services', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Hospital Management', name: 'Meera Iyer', username: 'meera.iyer', title: 'Hospital Administrator', dept: 'Administration', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'AI Administrator', name: 'Dr. Sanjay Gupta', username: 'sanjay.gupta', title: 'Chief AI Architect', dept: 'AI & Systems Governance', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Governance Officer', name: 'V. Lakshmi', username: 'v.lakshmi', title: 'Ethics & Compliance Officer', dept: 'Clinical Governance', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'IT Administrator', name: 'S. Prabhu', username: 's.prabhu', title: 'IT Systems Admin', dept: 'IT Infrastructure', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Auditor', name: 'G. Balaji', username: 'g.balaji', title: 'Chief Internal Auditor', dept: 'Internal Audit', bg: '#f6f7f8', bd: '#e3e6e8' },
];

export const ROLE_PAGE_ACCESS = {
  'Hospital Management': null, // Full platform access
  'AI Administrator': null, // Full platform access
  'Doctor': [
    // 10 Live Data Pages (preserved)
    'command', 'patients', 'admissions', 'bedboard', 'discharge', 'clinical', 'criticalvalues', 'diagnostics', 'radiology', 'discharge-agent',
    // Operational & Clinical
    'appointments', 'emergency', 'schedules', 'soap', 'patient360', 'sbar', 'lab', 'surgery', 'otschedule', 'deathmlc',
    // Platform & Governance (no financial, no data)
    'approvals', 'knowledge', 'trainer', 'assistant', 'exceptions'
  ],
  'Nurse': [
    // Live Data Pages (preserved)
    'command', 'patients', 'admissions', 'bedboard', 'discharge', 'clinical', 'criticalvalues', 'diagnostics', 'discharge-agent',
    // Operational & Clinical
    'emergency', 'nursing', 'medications', 'bloodbank', 'sbar', 'soap', 'patient360', 'deathmlc', 'otschedule',
    // Platform (no financial, no data)
    'approvals', 'knowledge', 'trainer', 'assistant', 'exceptions'
  ],
  'Front Office': [
    // Live Data Pages (preserved)
    'command', 'patients', 'admissions', 'bedboard',
    // Operational
    'appointments', 'emergency', 'schedules', 'patient360', 'deathmlc',
    // Financial & Revenue (explicitly permitted in HTML prototype)
    'billing', 'insurance',
    // Platform (no data)
    'knowledge', 'trainer', 'assistant'
  ],
  'Billing': [
    // Live Data Pages (preserved)
    'command', 'patients', 'admissions', 'discharge', 'discharge-agent',
    // Financial & Revenue
    'billing', 'insurance', 'claims', 'finance', 'tax',
    // Data
    'data-financial', 'explorer',
    // Operational & Platform
    'patient360', 'approvals', 'exceptions', 'knowledge', 'assistant', 'deathmlc'
  ],
  'Finance Manager': [
    // Live Data Pages (preserved)
    'command', 'discharge-agent',
    // Financial & Revenue
    'billing', 'insurance', 'claims', 'finance', 'tax',
    // Data
    'data-patient', 'data-ops', 'data-clinical', 'data-financial', 'analytics', 'forecasting', 'scenario', 'beforeafter', 'data-quality', 'tables', 'explorer',
    // Platform
    'approvals', 'exceptions', 'audit', 'cost', 'assistant'
  ],
  'Insurance': [
    // Live Data Pages (preserved)
    'command', 'patients', 'admissions', 'discharge', 'discharge-agent',
    // Financial & Revenue
    'billing', 'insurance', 'claims',
    // Operational & Platform (no data)
    'patient360', 'approvals', 'exceptions', 'knowledge', 'assistant'
  ],
  'Radiologist': [
    // Live Data Pages (preserved)
    'command', 'patients', 'diagnostics', 'radiology',
    // Operational & Platform (no financial, no data)
    'clinical', 'patient360', 'knowledge', 'trainer', 'assistant'
  ],
  'Laboratory': [
    // Live Data Pages (preserved)
    'command', 'patients', 'criticalvalues', 'diagnostics',
    // Operational & Platform (no financial, no data)
    'lab', 'bloodbank', 'patient360', 'exceptions', 'knowledge', 'trainer', 'assistant'
  ],
  'Pathologist': [
    // Live Data Pages (preserved)
    'command', 'patients', 'criticalvalues', 'diagnostics',
    // Operational & Platform (no financial, no data)
    'lab', 'clinical', 'patient360', 'knowledge', 'trainer', 'assistant'
  ],
  'Pharmacy': [
    // Live Data Pages (preserved)
    'command', 'patients', 'discharge',
    // Operational & Platform (no financial, no data)
    'medications', 'patient360', 'exceptions', 'knowledge', 'assistant'
  ],
  'Store Manager': [
    'settings', 'explorer', 'exceptions', 'assistant'
  ],
  'Procurement Officer': [
    'billing', 'tax', 'settings', 'explorer', 'approvals', 'exceptions', 'assistant'
  ],
  'HR Manager': [
    'schedules', 'settings', 'trainer', 'approvals', 'assistant'
  ],
  'Canteen Manager': [
    'patients', 'settings', 'assistant'
  ],
  'Governance Officer': [
    // Live Data Pages (preserved)
    'command',
    // Financial & Revenue
    'tax',
    // Data
    'data-quality', 'analytics', 'tables', 'explorer', 'settings',
    // AI Platform & Governance
    'ai-command', 'agents', 'orchestrator', 'runs', 'approvals', 'exceptions', 'knowledge',
    'evals', 'observability', 'cost', 'incidents', 'risk', 'governance', 'audit', 'trainer', 'assistant', 'deathmlc'
  ],
  'IT Administrator': [
    // Live Data Pages (preserved)
    'command', 'bedboard',
    // Financial & Revenue
    'tax',
    // Data
    'data-quality', 'tables', 'explorer', 'sql', 'settings', 'analytics',
    // AI Platform & Admin
    'ai-command', 'observability', 'incidents', 'audit', 'assistant', 'schedules'
  ],
  'Auditor': [
    // Live Data Pages (preserved)
    'command', 'bedboard',
    // Financial & Revenue
    'billing', 'claims', 'finance',
    // Data
    'data-financial', 'data-quality', 'analytics', 'tables', 'explorer',
    // AI Platform & Clinical
    'ai-command', 'audit', 'analytics', 'exceptions', 'risk', 'governance', 'assistant', 'approvals', 'schedules', 'otschedule', 'deathmlc', 'soap'
  ],
  'Patient': [
    'patients', 'appointments', 'billing', 'assistant'
  ]
};

let cachedInstance = null;

export function getMeridianStore(onUpdate) {
  if (cachedInstance) return cachedInstance;

  if (typeof window === 'undefined' || !window.__mm2 || !window.__mm2.views6) {
    return null;
  }

  const M = window.__mm2;
  const [st, vw, erp, v2, erp2, v3, erp3, v4b, erp4, v5, erp5, v6] = [
    M.store, M.views, M.erp, M.views2, M.erp2, M.views3, M.erp3, M.views4, M.erp4, M.views5, M.erp5, M.views6
  ];

  const api = st.createStore(() => {
    if (api && api.stampActors) api.stampActors();
    if (onUpdate) onUpdate();
  });

  erp.installErp(api);
  erp2.installErp2(api);
  erp3.installErp3(api);
  erp4.installErp4(api);
  erp5.installErp5(api);

  const v4 = {
    PAGES4: v4b.PAGES4.concat(v5.PAGES5),
    allowed4: (r, p) => {
      const a5 = v5.allowed5(r, p);
      return a5 !== undefined ? a5 : v4b.allowed4(r, p);
    },
    buildNav: navs => {
      const nav0 = v4b.buildNav(navs);
      Object.entries(v5.NAV5).forEach(([k, [g, l]]) => {
        const grp = nav0.find(x => x.g === g);
        if (grp) grp.items.push([k, l]);
      });
      return nav0;
    },
    buildList4: (page, api, ctx, base) => v5.buildList5(page, api, ctx, () => v4b.buildList4(page, api, ctx, base) || base()) || v4b.buildList4(page, api, ctx, base),
    buildDetail4: (k, id, api, ctx, base) => v5.buildDetail5(k, id, api, ctx, () => v4b.buildDetail4(k, id, api, ctx, base) || base()) || v4b.buildDetail4(k, id, api, ctx, base),
  };

  const V = {
    ...vw,
    NAV: v4.buildNav(vw.NAV.slice(0, 1).concat(v3.NAV3, v2.NAV2, vw.NAV.slice(1))),
    HOME: { ...vw.HOME, ...v2.HOME2, ...v3.HOME3, ...v4b.HOME4, ...v5.HOME5 },
    allowed: (r, p) => v4.allowed4(r, p),
    buildList: (page, ctx) => v4.buildList4(page, api, ctx, () => v3.buildList3(page, api, ctx, () => v2.buildList2(page, api, ctx, () => vw.buildList(page, api, ctx)))),
    buildDetail: (kind, id, ctx) => v4.buildDetail4(kind, id, api, ctx, () => v3.buildDetail3(kind, id, api, ctx, () => v2.buildDetail2(kind, id, api, ctx, () => vw.buildDetail(kind, id, api, ctx)))),
  };

  cachedInstance = { api, M, V, v6, erp5 };
  return cachedInstance;
}
