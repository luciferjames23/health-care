import { request } from './radiologyApi';
const base = '/api/radiology-clarifications';
const post = (path, body) => request(`${base}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
export const clarificationApi = {
  list: (orderId, scanId) => {
    const query = new URLSearchParams();
    if (orderId) query.set('order_id', orderId);
    if (scanId != null) query.set('scan_id', scanId);
    return request(base + (query.size ? `?${query}` : ''));
  },
  detail: id => request(`${base}/${encodeURIComponent(id)}`),
  create: body => post('', body),
  reply: (id, body) => post(`/${id}/messages`, body),
  read: (id, ids) => post(`/${id}/read`, { message_ids: ids }),
  action: (id, action) => post(`/${id}/actions`, { action }),
};
