import { fetchWithTimeout } from './api';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

async function request(path, options = {}) {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Laboratory service error (${response.status})`);
  return body;
}

export const labCollectionEventsApi = {
  getLatestForOrders(orderIds = []) {
    const query = new URLSearchParams();
    orderIds.forEach((id) => query.append('lab_order_ids', String(id)));
    return request(`/api/v1/clinical-ops/labs/collection-events/latest?${query.toString()}`);
  },
  create(orderId, event) {
    return request(`/api/v1/clinical-ops/labs/${encodeURIComponent(orderId)}/collection-events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  },
};
