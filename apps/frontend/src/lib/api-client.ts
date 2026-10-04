import { LOCALE_COOKIE, coerceLocale, type Locale } from '@/i18n/config';

const isBrowser = typeof window !== 'undefined';
const BROWSER_BASE = '/api/proxy';
const API_BASE = isBrowser
  ? BROWSER_BASE
  : process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
let refreshPromise: Promise<boolean> | null = null;
let csrfToken: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function getActiveLocale(): Locale {
  const cookieLocale = readCookie(LOCALE_COOKIE);
  if (cookieLocale) return coerceLocale(cookieLocale);
  if (typeof document !== 'undefined') return coerceLocale(document.documentElement.lang);
  return coerceLocale(process.env.NEXT_LOCALE);
}

function applyLocaleHeaders(headers: Headers, locale: Locale) {
  if (!headers.has('x-locale')) headers.set('x-locale', locale);
  if (!headers.has('x-next-locale')) headers.set('x-next-locale', locale);
  if (!headers.has('x-client-locale')) headers.set('x-client-locale', locale);
  if (!headers.has('accept-language')) headers.set('accept-language', `${locale},en;q=0.8`);
}

export function setCsrfToken(token: string) {
  csrfToken = token;
}
export function getCsrfToken() {
  return csrfToken;
}
// Legacy no-ops for backward compat during migration (no longer store tokens in JS)
export function setTokens(_access: string | null, _refresh: string | null) {}
export function getAccessToken() {
  return null;
}
/** Read the non-httpOnly double-submit cookie the backend compares against the header. */
function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === 'csrf-token') {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/**
 * Resolve a CSRF token for a state-changing request, in cost order: the in-memory copy,
 * then the double-submit cookie, then a fresh one from the server.
 *
 * This matters most on a cold page load. `/auth/refresh` is a POST and the backend's
 * CSRF guard enforces the double-submit pair whenever the `csrf-token` cookie is
 * present — and it is present, because it outlives the 15-minute access token. With
 * only an in-memory token to hand, the very first refresh after the access token
 * expires went out with a cookie and no header, was rejected 403, and the session read
 * as signed out even though the refresh cookie was perfectly valid. That is the
 * /login bounce: not a missing session, a rejected rotation.
 */
async function csrfHeaderToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  const fromCookie = readCsrfCookie();
  if (fromCookie) return fromCookie;
  await fetchCsrfToken();
  return csrfToken;
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const post = (token: string | null) =>
      fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-csrf-token': token } : {}),
        },
        credentials: 'include',
      });

    let res = await post(await csrfHeaderToken());

    // A stale in-memory token can still lose to a cookie another tab rotated. Mint a
    // fresh pair and try once more rather than declaring the session dead.
    if (res.status === 403) {
      await fetchCsrfToken();
      res = await post(csrfToken);
    }

    if (!res.ok) return false;
    // New cookies are set via Set-Cookie header, no body tokens needed
    return true;
  } catch {
    return false;
  }
}
interface FetchOptions extends RequestInit {
  tenantSlug?: string;
  locale?: string;
  _retry?: boolean;
}
async function fetchApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { tenantSlug, locale, _retry, ...fetchOpts } = options;
  const resolvedLocale = coerceLocale(locale ?? getActiveLocale());
  const headers = new Headers(fetchOpts.headers);
  // Only declare JSON when a payload actually exists: Nest's body parser rejects
  // `content-type: application/json` on empty bodies, which broke every bodiless
  // request (`api.delete(url)`, `api.post(url)`).
  if (typeof fetchOpts.body === 'string' && fetchOpts.body.length > 0) {
    headers.set('Content-Type', 'application/json');
  }
  if (tenantSlug) headers.set('x-tenant-slug', tenantSlug);
  applyLocaleHeaders(headers, resolvedLocale);
  if (
    csrfToken &&
    !['GET', 'HEAD', 'OPTIONS'].includes((fetchOpts.method || 'GET').toUpperCase())
  ) {
    headers.set('x-csrf-token', csrfToken);
  }
  let res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers, credentials: 'include' });
  if (res.status === 401 && !_retry) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken();
    }
    const refreshed = await refreshPromise;
    refreshPromise = null;
    if (refreshed) {
      const retryHeaders = new Headers(headers);
      res = await fetch(`${API_BASE}${path}`, {
        ...fetchOpts,
        headers: retryHeaders,
        credentials: 'include',
      });
    }
  }
  if (res.status === 403 && !_retry) {
    await fetchCsrfToken();
    const newToken = csrfToken;
    if (newToken) {
      headers.set('x-csrf-token', newToken);
      res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers, credentials: 'include' });
    }
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    // Carry the status so callers can distinguish a transient failure (network blip,
    // a refresh that lost a race) from a definitive one (403/404). Without this every
    // caller only sees an opaque message and cannot decide whether retrying is sane.
    // The whole parsed body is attached too: backends return machine-readable detail
    // (code, upstream status, provider message) that `message` alone throws away.
    const err = new Error(error.message || 'API Error') as Error & {
      status?: number;
      body?: Record<string, unknown>;
    };
    err.status = res.status;
    if (error && typeof error === 'object') {
      err.body = error as Record<string, unknown>;
    }
    throw err;
  }
  // 204 No Content
if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}
async function fetchCsrfToken(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf-token`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    csrfToken = data.csrfToken;
    if (typeof document !== 'undefined') {
      // Must be a single line. A template literal spanning lines embeds raw newlines in
      // the cookie string, which browsers reject or truncate — and a cookie written
      // without an explicit path defaults to the CURRENT directory, so it would not be
      // sent from other routes and the double-submit pair would silently break.
      document.cookie = `csrf-token=${csrfToken}; path=/; SameSite=Lax`;
    }
  } catch {}
}
/**
 * Guarantee a CSRF token is loaded (and mirrored into the non-httpOnly `csrf-token`
 * cookie) before a state-changing request, then return it. Callers that hand-roll
 * `fetch` instead of using `api.*` should use this so the double-submit pair the
 * backend compares (`csrfCookie === csrfHeader`) is always consistent.
 */
export async function ensureCsrfToken(): Promise<string | null> {
  if (!csrfToken) await fetchCsrfToken();
  return csrfToken;
}
export const api = {
  get: <T>(path: string, opts?: FetchOptions) => fetchApi<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    fetchApi<T>(path, { ...opts, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    fetchApi<T>(path, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown, opts?: FetchOptions) =>
    fetchApi<T>(path, { ...opts, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string, opts?: FetchOptions) =>
    fetchApi<T>(path, { ...opts, method: 'DELETE' }),
  fetchCsrfToken,
};
