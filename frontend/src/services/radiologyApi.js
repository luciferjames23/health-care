const RADIOLOGY_API_BASE_URL = import.meta.env?.VITE_RADIOLOGY_API_URL || import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
export const OHIF_BASE_URL = import.meta.env?.VITE_OHIF_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const token = sessionStorage.getItem('hc_auth_token');
  const res = await fetch(`${RADIOLOGY_API_BASE_URL}${path}`, {
    ...options, headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Radiology service error (${res.status})`);
  return body;
}

export const radiologyApi = {
  getWorklist: () => request('/api/radiology/worklist'),
  getStudy: (id) => request(`/api/radiology/studies/${encodeURIComponent(id)}`),
  prepareLocalizedOhif: (id) => request(`/api/radiology/studies/${encodeURIComponent(id)}/ohif-localized`, { method: 'POST' }),
  markViewed: (id) => request(`/api/radiology/studies/${encodeURIComponent(id)}/viewed`, { method: 'POST' }),
  finaliseReview: (id, review_status, report = null, finding = null, reviewed_by = null) => request(`/api/radiology/studies/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_status, report, finding, reviewed_by }),
  }),
  updateReviewStatus: (id, review_status, report = null, finding = null, reviewed_by = null) => request(`/api/radiology/studies/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_status, report, finding, reviewed_by }),
  }),

  // PostgreSQL Lakehouse Scans (`radiology_scan`)
  getScans: (params = {}) => {
    const q = new URLSearchParams();
    if (params.patient_id) q.set('patient_id', params.patient_id);
    if (params.patient_code) q.set('patient_code', params.patient_code);
    if (params.search) q.set('search', params.search);
    if (params.target !== undefined && params.target !== null) q.set('target', params.target);
    if (params.limit) q.set('limit', params.limit);
    if (params.offset) q.set('offset', params.offset);
    const qs = q.toString();
    return request(`/api/radiology/scans${qs ? `?${qs}` : ''}`);
  },
  getScanById: (scanId) => request(`/api/radiology/scans/${scanId}`),

  /**
   * Public patient scan lookup — no radiologist token required.
   * Uses the /api/v1/gold/patient-scans endpoint backed by radiology_scan table.
   */
  getPatientScans: (params = {}) => {
    const q = new URLSearchParams();
    if (params.patient_code) q.set('patient_code', params.patient_code);
    if (params.patient_id) q.set('patient_id', params.patient_id);
    if (params.limit) q.set('limit', params.limit);
    const qs = q.toString();
    // This endpoint is on the public gold router (no radiologist auth needed)
    return fetch(`${RADIOLOGY_API_BASE_URL}/api/v1/gold/patient-scans${qs ? `?${qs}` : ''}`)
      .then(r => r.json().then(body => { if (!r.ok) throw new Error(body.detail || `Error ${r.status}`); return body; }));
  },

  getPacsStudies: () => request('/api/pacs/studies'),
  getPacsHealth: () => request('/api/pacs/health'),
  getModelInfo: () => request('/api/radiology/model-info'),
  analyze: async (file) => {
    const body = new FormData();
    body.append('file', file);
    return request('/api/radiology/analyze', { method: 'POST', body });
  },
};
