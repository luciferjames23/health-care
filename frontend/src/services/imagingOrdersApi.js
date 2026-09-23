const BASE = import.meta.env?.VITE_API_BASE_URL ?? '';
async function request(path, options = {}) {
  const res = await fetch(`${BASE}/api/imaging-orders${path}`, {
    ...options, headers: { ...options.headers, Authorization: `Bearer ${sessionStorage.getItem('hc_auth_token') || ''}` },
  });
  const body = await res.json();
  if (!res.ok) {
    let msg = 'Unable to process this order.';
    if (typeof body.detail === 'string') {
      msg = body.detail;
    } else if (Array.isArray(body.detail)) {
      msg = body.detail.map(d => d.msg || JSON.stringify(d)).join('; ');
    } else if (body.detail?.message) {
      msg = body.detail.message;
    }
    const error = new Error(msg);
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
