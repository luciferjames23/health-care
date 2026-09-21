// Dynamic Financial & Revenue API Service

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const FETCH_TIMEOUT_MS = 15000;

async function request(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), options.timeoutMs || FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(id);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export const financialApi = {
  getOverview: () => request('/api/finance/overview'),
  
  getBills: (params = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page);
    if (params.pageSize || params.page_size) q.append('page_size', params.pageSize || params.page_size);
    if (params.status) q.append('status', params.status);
    if (params.search) q.append('search', params.search);
    if (params.sortBy || params.sort_by) q.append('sort_by', params.sortBy || params.sort_by);
    if (params.order) q.append('order', params.order);
    return request(`/api/finance/bills?${q.toString()}`);
  },
  
  getBillDetail: (billId) => request(`/api/finance/bills/${billId}`),
  getBillByAdmission: (admissionId) => request(`/api/finance/bills/admission/${admissionId}`),
  getBillByPatient: (patientId) => request(`/api/finance/bills/patient/${patientId}`),
  
  getInsuranceClaims: (params = {}) => {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page);
    if (params.pageSize || params.page_size) q.append('page_size', params.pageSize || params.page_size);
    if (params.status) q.append('status', params.status);
    if (params.provider) q.append('provider', params.provider);
    if (params.search) q.append('search', params.search);
    return request(`/api/finance/insurance-claims?${q.toString()}`);
  },
  
  getClaimsAnalytics: () => request('/api/finance/claims-analytics'),
  
  getFinanceDashboard: () => request('/api/finance/dashboard'),
  
  getTaxConfig: () => request('/api/finance/tax-config'),
  
  issueGatePass: (billId) => request(`/api/finance/bills/${billId}/gate-pass`, {
    method: 'POST'
  }),
  
  recordPayment: (payload) => request('/api/finance/payments', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};
