// frontend/src/services/ragApi.js
// Production API Client for Meridian Hospital AI Hybrid RAG Layer

const BASE = import.meta.env?.VITE_API_BASE_URL ?? '';

async function request(path, options = {}) {
  const token = sessionStorage.getItem('hc_auth_token') || '';
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}/api/rag${path}`, {
    ...options,
    headers
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = 'Unable to complete RAG request.';
    if (typeof body.detail === 'string') {
      msg = body.detail;
    } else if (Array.isArray(body.detail)) {
      msg = body.detail.map(d => d.msg || JSON.stringify(d)).join('; ');
    } else if (body.message) {
      msg = body.message;
    }
    const err = new Error(msg);
    err.status = res.status;
    err.detail = body.detail;
    throw err;
  }
  return body;
}

export const ragApi = {
  query: (params) => request('/query', {
    method: 'POST',
    body: JSON.stringify(params)
  }),

  createConversation: (params) => request('/conversations', {
    method: 'POST',
    body: JSON.stringify(params)
  }),

  getConversation: (conversationId) => request(`/conversations/${encodeURIComponent(conversationId)}`),

  getHealth: () => request('/health'),

  reindexPatient: (patientId) => request(`/reindex/patient/${encodeURIComponent(patientId)}`, {
    method: 'POST'
  }),

  reindexAdmission: (admissionId) => request(`/reindex/admission/${encodeURIComponent(admissionId)}`, {
    method: 'POST'
  }),

  reindexRadiologyOrder: (orderId) => request(`/reindex/radiology-order/${encodeURIComponent(orderId)}`, {
    method: 'POST'
  }),

  reindexDischarge: (admissionId) => request(`/reindex/discharge/${encodeURIComponent(admissionId)}`, {
    method: 'POST'
  })
};

async function trainerRequest(path, options = {}) {
  const token = sessionStorage.getItem('hc_auth_token') || '';
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BASE}/api/ai-trainer${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || 'AI Trainer request failed.');
  return body;
}

export const aiTrainerApi = {
  query: (params) => trainerRequest('/query', { method: 'POST', body: JSON.stringify(params) }),
  search: (params) => trainerRequest(`/search?${new URLSearchParams(params)}`),
  documents: () => trainerRequest('/documents'),
  document: (id) => trainerRequest(`/documents/${encodeURIComponent(id)}`),
  upload: (form) => trainerRequest('/documents', { method: 'POST', body: form }),
  reindex: (id) => trainerRequest(`/documents/${encodeURIComponent(id)}/reindex`, { method: 'POST' }),
  update: (id, params) => trainerRequest(`/documents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(params) }),
  audit: () => trainerRequest('/audit')
};
