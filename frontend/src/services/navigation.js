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
