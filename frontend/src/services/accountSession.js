import { resetSessionExpiredState } from './api';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

export async function selectAccount(username) {
  sessionStorage.removeItem('hc_auth_token');
  sessionStorage.removeItem('hospital_user');
  const response = await fetch(`${API_BASE_URL}/api/auth/select-account`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const result = await response.json();
  if (!response.ok || !result.token) throw new Error(result.detail || 'Unable to sign in.');
  sessionStorage.setItem('hc_auth_token', result.token);
  resetSessionExpiredState();
  const user = result.user;
  const userObj = {
    ...user,
    token: result.token,
    role: user.role.toLowerCase() === 'admin' 
      ? 'Hospital Management' 
      : (user.role.toLowerCase() === 'patient' ? 'Patient' : user.role),
    dept: user.department || (user.role.toLowerCase() === 'patient' ? 'Patient Portal' : undefined),
    departmentId: user.departmentId || user.department_id,
    doctorId: user.doctorId || user.doctor_id,
    title: user.specialization || (user.role.toLowerCase() === 'patient' ? user.patientCode || user.patient_code : user.role),
    qualification: user.qualification || undefined,
    phone: user.phone || undefined,
    email: user.email || undefined,
    consultation_fee: user.consultation_fee ?? user.consultationFee ?? undefined,
    designation: user.designation || user.specialization || user.title || user.role,
  };
    try {
      sessionStorage.setItem('hospital_user', JSON.stringify(userObj));
      sessionStorage.setItem('hx_auth', JSON.stringify(userObj));
      window.dispatchEvent(new Event('hospital_user_changed'));
    } catch {}
    return userObj;
}

export async function loginWithPassword(username, password) {
  sessionStorage.removeItem('hc_auth_token');
  sessionStorage.removeItem('hospital_user');
  sessionStorage.removeItem('hx_auth');
  window.dispatchEvent(new Event('hospital_user_changed'));
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const result = await response.json();
  if (!response.ok || !result.token) throw new Error(result.detail || 'Unable to sign in.');
  sessionStorage.setItem('hc_auth_token', result.token);
  resetSessionExpiredState();
  const user = result.user;
  const userObj = {
    ...user,
    token: result.token,
    role: user.role.toLowerCase() === 'admin' 
      ? 'Hospital Management' 
      : (user.role.toLowerCase() === 'patient' ? 'Patient' : user.role),
    dept: user.department || (user.role.toLowerCase() === 'patient' ? 'Patient Portal' : undefined),
    departmentId: user.departmentId || user.department_id,
    doctorId: user.doctorId || user.doctor_id,
    title: user.specialization || (user.role.toLowerCase() === 'patient' ? user.patientCode || user.patient_code : user.role),
    qualification: user.qualification || undefined,
    phone: user.phone || undefined,
    email: user.email || undefined,
    consultation_fee: user.consultation_fee ?? user.consultationFee ?? undefined,
    designation: user.designation || user.specialization || user.title || user.role,
  };
  try {
    sessionStorage.setItem('hospital_user', JSON.stringify(userObj));
    sessionStorage.setItem('hx_auth', JSON.stringify(userObj));
    window.dispatchEvent(new Event('hospital_user_changed'));
  } catch {}
  return userObj;
}

export async function fetchUserProfile(username = '') {
  const token = sessionStorage.getItem('hc_auth_token') || '';
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const query = username ? `?username=${encodeURIComponent(username)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/auth/profile${query}`, { headers });
  if (!response.ok) throw new Error('Unable to fetch profile.');
  const data = await response.json();
  return data.profile;
}

