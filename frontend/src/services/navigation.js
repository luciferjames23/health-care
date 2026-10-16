const PAGE_ALIASES = {
  'executive-dashboard': 'command',
  'lab-dashboard': 'lab',
  'card-lab': 'lab',
};

const ACTIVE_ITEM_ALIASES = {
  patients: ['patient360', 'patient'],
  clinical: ['soap', 'doctor-portal'],
  discharge: ['discharge-case', 'discharge-agent'],
  agents: ['agent'],
  runs: ['execution'],
  approvals: ['approval'],
  assistant: ['chat', 'patient-chat', 'ask'],
  criticalvalues: ['laboratory'],
  radiology: ['xray-orders'],
  medications: ['mar'],
  surgery: ['ot'],
  deathmlc: ['deaths'],
  sbar: ['handover'],
};

export function normalizePageId(page) {
  if (typeof page !== 'string') return page;
  const normalized = page.trim().toLowerCase();
  return PAGE_ALIASES[normalized] || normalized;
}

export function isNavigationItemActive(activePage, itemId) {
  const currentPage = normalizePageId(activePage);
  const currentItem = normalizePageId(itemId);
  return currentPage === currentItem || ACTIVE_ITEM_ALIASES[currentItem]?.includes(currentPage) === true;
}

export function getPostLoginPage(role) {
  return String(role || '').trim().toLowerCase() === 'patient'
    ? 'portal'
    : 'command';
}

export function getPathForPage(page, role) {
  const norm = normalizePageId(page);
  const isDoctor = String(role || '').trim().toLowerCase() === 'doctor';

  if (isDoctor) {
    if (norm === 'appointments') return '/doctor/appointments';
    if (norm === 'doctor-portal') return '/doctor/dashboard';
    if (norm === 'todays-queue') return '/doctor/queue';
    if (norm === 'clinical') return '/doctor/clinical';
    if (norm === 'patients' || norm === 'doctor-patient-records' || norm === 'patients-op' || norm === 'patient-records') {
      return '/doctor/patient-records';
    }
    if (norm === 'admissions') return '/doctor/admissions';
    if (norm === 'profile') return '/doctor/profile';
  }

  if (norm === 'command') return '/';
  if (norm === 'appointments') return '/appointments';
  if (norm === 'patients' || norm === 'patients-op') return '/patients';
  if (norm === 'patient360') return '/patient360';
  if (norm === 'soap') return '/soap';
  if (norm === 'create-full-details' || norm === 'create-full') return '/create-full/details';
  if (norm === 'portal' || norm === 'patient-portal') return '/portal';

  return `/${norm}`;
}
