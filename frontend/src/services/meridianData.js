// Meridian Data Service providing store initialization, demo accounts, and state management

export const DEMO_PASSWORD = 'Hospital@2026';
export const DEMO_OTP = '246810';

export const DEMO_ROLES = [
  { role: 'Doctor', name: 'Dr. Arjun Menon', username: 'arjun.menon', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Nurse', name: 'Anitha Kumar', username: 'anitha.kumar', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Laboratory', name: 'M. Ganesh', username: 'm.ganesh', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Radiologist', name: 'Jancy Selvam', username: 'jancy.selvam', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Pharmacy', name: 'S. Devi', username: 's.devi', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Billing', name: 'K. Meena', username: 'k.meena', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Insurance', name: 'R. Sundar', username: 'r.sundar', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Front Office', name: 'Bhavani Kumar', username: 'bhavani.kumar', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'Hospital Management', name: 'Meera Iyer', username: 'meera.iyer', bg: '#f6f7f8', bd: '#e3e6e8' },
  { role: 'IT Administrator', name: 'S. Prabhu', username: 's.prabhu', bg: '#f6f7f8', bd: '#e3e6e8' },
];

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
