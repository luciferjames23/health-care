const BASE = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
async function request(path, options = {}) {
  const res = await fetch(`${BASE}/api/imaging-orders${path}`, {
    ...options, headers: { ...options.headers, Authorization: `Bearer ${sessionStorage.getItem('hc_auth_token') || ''}` },
  });
  const body = await res.json();
  if (!res.ok) {
    const error = new Error(typeof body.detail === 'string' ? body.detail : body.detail?.message || 'Unable to process this order.');
    error.detail = body.detail;
    throw error;
  }
  return body;
}
export const imagingOrdersApi = {
  list: patientId => request(patientId ? `?patient_id=${encodeURIComponent(patientId)}` : ''),
  create: body => request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  upload: (id, file, confirmed = false) => { const body = new FormData(); body.append('file', file); body.append('confirm_patient_match', String(confirmed)); return request(`/${id}/upload`, { method: 'POST', body }); },
};
