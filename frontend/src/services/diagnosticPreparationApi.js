import { fetchWithTimeout } from './api';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

async function request(path, options = {}) {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Diagnostic preparation service error (${response.status})`);
  return body;
}

export const diagnosticPreparationApi = {
  getFastingEvidence(orderIds = []) {
    const batches = [];
    for (let index = 0; index < orderIds.length; index += 100) {
      batches.push(orderIds.slice(index, index + 100));
    }
    return Promise.all(batches.map((batch) => {
      const query = new URLSearchParams();
      batch.forEach((orderId) => query.append('order_ids', orderId));
      return request(`/api/v1/diagnostic-coordination/fasting-evidence?${query.toString()}`);
    })).then((responses) => ({ data: responses.flatMap((response) => response.data || []) }));
  },

  createFastingEvidence(orderId, evidence) {
    return request(`/api/v1/diagnostic-coordination/orders/${encodeURIComponent(orderId)}/fasting-evidence`, {
      method: 'POST',
      body: JSON.stringify(evidence),
    });
  },
};
