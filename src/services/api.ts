import { getBrowserLiveEngine } from './browserLiveEngine';

const ACCESS_KEY = 'pp_access_token';
const REFRESH_KEY = 'pp_refresh_token';

function isKnownStaticCloudHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return (
    h.endsWith('.vercel.app') ||
    h.endsWith('.netlify.app') ||
    h.endsWith('.pages.dev') ||
    h.endsWith('.github.io') ||
    import.meta.env.VITE_STANDALONE_ENGINE === 'true'
  );
}

let browserEngineActive = isKnownStaticCloudHost();
const engineListeners = new Set<(active: boolean) => void>();

export function isBrowserEngineActive(): boolean {
  return browserEngineActive;
}

export function activateBrowserEngine() {
  if (browserEngineActive) return;
  browserEngineActive = true;
  for (const cb of engineListeners) {
    cb(true);
  }
}

export function onBrowserEngineModeChange(cb: (active: boolean) => void): () => void {
  engineListeners.add(cb);
  return () => {
    engineListeners.delete(cb);
  };
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  if (browserEngineActive) {
    try {
      const refreshed = await getBrowserLiveEngine().handleRequest<{
        accessToken: string;
        refreshToken: string;
      }>(
        '/api/auth/refresh',
        { method: 'POST', body: JSON.stringify({ refreshToken }) },
        getAccessToken()
      );
      setAuthTokens(refreshed.accessToken, refreshed.refreshToken);
      return refreshed.accessToken;
    } catch {
      clearAuthTokens();
      return null;
    }
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearAuthTokens();
        return null;
      }
      const json = await res.json();
      if (json?.success && json.data?.accessToken && json.data?.refreshToken) {
        setAuthTokens(json.data.accessToken, json.data.refreshToken);
        return json.data.accessToken as string;
      }
      clearAuthTokens();
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  if (browserEngineActive) {
    return getBrowserLiveEngine().handleRequest<T>(url, options, getAccessToken());
  }

  const makeReq = async (token: string | null) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  };

  let res: Response;
  try {
    res = await makeReq(getAccessToken());
  } catch {
    activateBrowserEngine();
    return getBrowserLiveEngine().handleRequest<T>(url, options, getAccessToken());
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isMissingServerlessBackend =
    !contentType.includes('application/json') ||
    res.status === 405 ||
    res.status === 502 ||
    res.status === 503 ||
    res.status === 504 ||
    (res.status === 404 && url.startsWith('/api/'));

  if (isMissingServerlessBackend) {
    activateBrowserEngine();
    return getBrowserLiveEngine().handleRequest<T>(url, options, getAccessToken());
  }

  if (res.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/refresh')) {
    const freshToken = await tryRefreshAccessToken();
    if (freshToken) {
      res = await makeReq(freshToken);
    }
  }

  const json = await res.json().catch(() => ({ success: false, message: 'Unexpected server response.' }));
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }
  return json.data as T;
}

export function formatINR(value: number, fractionDigits = 2): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${value < 0 ? '-' : ''}₹${formatted}`;
}

export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e7) {
    return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  }
  if (abs >= 1e5) {
    return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  }
  return formatINR(value, 0);
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCell = (cell: string | number | null | undefined) => {
    const str = cell === null || cell === undefined ? '' : String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
