const base = '';
export function getToken() { return localStorage.getItem('token'); }
export function setSession(token, user) { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }
export function getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } }
export function clearSession() { localStorage.removeItem('token'); localStorage.removeItem('user'); }
export async function api(path, opts = {}) {
  const res = await fetch(base + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
