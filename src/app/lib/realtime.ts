import { API_BASE_URL } from './api';

function joinUrlPath(basePath: string, childPath: string): string {
  const a = String(basePath || '');
  const b = String(childPath || '');
  const left = a.endsWith('/') ? a.slice(0, -1) : a;
  const right = b.startsWith('/') ? b : `/${b}`;
  return `${left}${right}`;
}

export function getApiWsUrl(wsPath = '/ws'): string {
  const base = String(API_BASE_URL || '/api');

  // Absolute base URL (e.g. http://127.0.0.1:8001/api)
  if (/^https?:\/\//i.test(base)) {
    const u = new URL(base);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = joinUrlPath(u.pathname || '', wsPath);
    return u.toString();
  }

  // Relative base URL (default: /api) - connect to same host.
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const path = joinUrlPath(base, wsPath);
  return `${proto}//${host}${path}`;
}
