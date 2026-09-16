const RADIOLOGY_API_BASE_URL = import.meta.env.VITE_RADIOLOGY_API_URL || 'http://localhost:8001';
export const OHIF_BASE_URL = import.meta.env.VITE_OHIF_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${RADIOLOGY_API_BASE_URL}${path}`, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Radiology service error (${res.status})`);
  return body;
}

export const radiologyApi = {
  getWorklist: () => request('/api/radiology/worklist'),
  getStudy: (id) => request(`/api/radiology/studies/${encodeURIComponent(id)}`),
  markViewed: (id) => request(`/api/radiology/studies/${encodeURIComponent(id)}/viewed`, { method: 'POST' }),
  finaliseReview: (id, review_status) => request(`/api/radiology/studies/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_status }),
  }),
  getPacsStudies: () => request('/api/pacs/studies'),
  getPacsHealth: () => request('/api/pacs/health'),
  getModelInfo: () => request('/api/radiology/model-info'),
  analyze: async (file) => {
    const body = new FormData();
    body.append('file', file);
    return request('/api/radiology/analyze', { method: 'POST', body });
  },
};
