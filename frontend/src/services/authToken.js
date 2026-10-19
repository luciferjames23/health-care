// Keep API requests aligned with the account currently shown by the app.
// The application persists the same session in both user keys, while older
// builds may leave hc_auth_token pointing at a previously selected account.
export function getSessionAuthToken() {
  if (typeof sessionStorage === 'undefined') return '';
  for (const key of ['hx_auth', 'meridian_user']) {
    try {
      const user = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (user?.token) {
        if (sessionStorage.getItem('hc_auth_token') !== user.token) {
          sessionStorage.setItem('hc_auth_token', user.token);
        }
        return user.token;
      }
    } catch { }
  }
  return sessionStorage.getItem('hc_auth_token') || '';
}

export function clearSessionAuthToken(rejectedToken) {
  if (typeof sessionStorage === 'undefined' || !rejectedToken) return;
  if (sessionStorage.getItem('hc_auth_token') === rejectedToken) {
    sessionStorage.removeItem('hc_auth_token');
  }
  for (const key of ['hx_auth', 'meridian_user']) {
    try {
      const user = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (user?.token === rejectedToken) {
        delete user.token;
        sessionStorage.setItem(key, JSON.stringify(user));
      }
    } catch { }
  }
}
