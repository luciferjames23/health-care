import { fetchWithTimeout } from './api';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

async function request(path, options = {}) {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item) => item?.msg || item?.detail || String(item)).join('; ')
      : body.detail;
    throw new Error(detail || `Laboratory service error (${response.status})`);
  }
  return body;
}

export const labCollectionEventsApi = {
  getLatestForOrders(orderIds = []) {
    const uniqueIds = Array.from(new Set(orderIds.filter((id) => id != null).map(String)));
    const batchSize = 200; // Matches the backend endpoint's maximum lab_order_ids count.
    const batches = [];
    for (let start = 0; start < uniqueIds.length; start += batchSize) {
      const query = new URLSearchParams();
      uniqueIds.slice(start, start + batchSize).forEach((id) => query.append('lab_order_ids', id));
      batches.push(request(`/api/v1/clinical-ops/labs/collection-events/latest?${query.toString()}`));
    }
    return Promise.all(batches).then((responses) => ({
      data: responses.flatMap((response) => response.data || []),
    }));
  },
  create(orderId, event) {
    return request(`/api/v1/clinical-ops/labs/${encodeURIComponent(orderId)}/collection-events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  },
};
