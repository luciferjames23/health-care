const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000';

const FETCH_TIMEOUT_MS = 60000;

async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = FETCH_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export async function checkHealth() {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/radiology/health`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
}

export async function getModelInfo() {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/radiology/model-info`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
}

export async function analyzeXray(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetchWithTimeout(`${API_BASE_URL}/api/radiology/analyze`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Analysis failed (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function getWorklist() {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/radiology/worklist`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Unable to load worklist (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function getStudyDetail(studyId) {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/radiology/studies/${encodeURIComponent(studyId)}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Study not found (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function markStudyViewed(studyId) {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/radiology/studies/${encodeURIComponent(studyId)}/viewed`,
    { method: "POST" }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `HTTP error ${res.status}`);
  }
  return await res.json();
}

export async function checkPacsHealth() {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/pacs/health`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `PACS service unavailable (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function getPacsStudies() {
  const res = await fetchWithTimeout(`${API_BASE_URL}/api/pacs/studies`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Unable to fetch PACS studies (HTTP ${res.status})`);
  }
  return await res.json();
}

export async function analyzePacsStudy(studyId) {
  const res = await fetchWithTimeout(
    `${API_BASE_URL}/api/pacs/analyze/${encodeURIComponent(studyId)}`,
    { method: "POST" }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.detail || `Unable to analyze PACS study (HTTP ${res.status})`);
  }
  return await res.json();
}
