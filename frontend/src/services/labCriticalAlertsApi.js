import { fetchWithTimeout } from './api';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

export const labCriticalAlertsApi = {
  async list({ limit = 200, offset = 0 } = {}) {
    const response = await fetchWithTimeout(
      API_BASE_URL + '/api/v1/clinical-ops/lab-critical-alerts?limit=' + limit + '&offset=' + offset,
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || ('Critical alert service error (' + response.status + ')'));
    return body;
  },
  async acknowledge(alertId) {
    return requestLifecycle('/api/v1/clinical-ops/lab-critical-alerts/' + encodeURIComponent(alertId) + '/acknowledgements');
  },
  async close(alertId, reason) {
    return requestLifecycle('/api/v1/clinical-ops/lab-critical-alerts/' + encodeURIComponent(alertId) + '/close', {
      reason,
    });
  },
};

async function requestLifecycle(path, body) {
  const response = await fetchWithTimeout(API_BASE_URL + path, {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(responseBody.detail || ('Critical alert service error (' + response.status + ')'));
    error.status = response.status;
    throw error;
  }
  return responseBody;
}
