import { request } from './radiologyApi';
const base = '/api/radiology-clarifications';
const post = (path, body) => request(`${base}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
export const clarificationApi = {
  list: orderId => request(base + (orderId ? `?order_id=${encodeURIComponent(orderId)}` : '')),
  detail: id => request(`${base}/${encodeURIComponent(id)}`),
  create: body => post('', body),
  reply: (id, body) => post(`/${id}/messages`, body),
  read: (id, ids) => post(`/${id}/read`, { message_ids: ids }),
  action: (id, action) => post(`/${id}/actions`, { action }),
};
