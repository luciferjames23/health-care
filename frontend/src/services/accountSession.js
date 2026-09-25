const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

export async function selectAccount(username) {
  sessionStorage.removeItem('hc_auth_token');
  sessionStorage.removeItem('meridian_user');
  const response = await fetch(`${API_BASE_URL}/api/auth/select-account`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  const result = await response.json();
  if (!response.ok || !result.token) throw new Error(result.detail || 'Unable to sign in.');
  sessionStorage.setItem('hc_auth_token', result.token);
  const user = result.user;
  const userObj = {
    ...user,
    token: result.token,
    role: user.role.toLowerCase() === 'admin' ? 'Hospital Management' : user.role,
    dept: user.department,
    title: user.specialization || user.role
  };
  try {
    sessionStorage.setItem('meridian_user', JSON.stringify(userObj));
    sessionStorage.setItem('hx_auth', JSON.stringify(userObj));
  } catch {}
  return userObj;
}

export async function loginWithPassword(username, password) {
  sessionStorage.removeItem('hc_auth_token');
  sessionStorage.removeItem('meridian_user');
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const result = await response.json();
  if (!response.ok || !result.token) throw new Error(result.detail || 'Unable to sign in.');
  sessionStorage.setItem('hc_auth_token', result.token);
  const user = result.user;
  const userObj = {
    ...user,
    token: result.token,
    role: user.role.toLowerCase() === 'admin' ? 'Hospital Management' : user.role,
    dept: user.department,
    title: user.specialization || user.role
  };
  try {
    sessionStorage.setItem('meridian_user', JSON.stringify(userObj));
    sessionStorage.setItem('hx_auth', JSON.stringify(userObj));
  } catch {}
  return userObj;
}
