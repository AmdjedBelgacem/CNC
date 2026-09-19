/**
 * Proxy fetch helper for Next.js API routes (/api/proxy/*).
 *
 * Auth rides on httpOnly cookies (`credentials: 'include'`), so no Bearer token is
 * attached here. What DOES need attaching is the double-submit CSRF token: the
 * backend compares the non-httpOnly `csrf-token` cookie against the `x-csrf-token`
 * header on every state-changing request and rejects the request when they differ.
 *
 * Historically neither helper sent the header, which forced the proxy route to mint
 * a token server-side for every mutation. Reading the cookie here restores a genuine
 * double-submit pair — and since the cookie is unreadable cross-origin, echoing it
 * proves same-origin execution in a way the proxy cannot fake on the caller's behalf.
 */

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/** Read a cookie by name from `document.cookie` (client only). */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/** Build the CSRF header for a mutating request, fetching a token if the cookie is absent. */
async function csrfHeaders(method: string | undefined): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {};
  if (SAFE_METHODS.includes((method || 'GET').toUpperCase())) return {};
  let token = readCookie('csrf-token');
  if (!token) {
    try {
      const res = await fetch('/api/proxy/auth/csrf-token', { credentials: 'include' });
      if (res.ok) token = (await res.json())?.csrfToken ?? null;
    } catch {
      /* fall through — the proxy will fall back to a server-minted token */
    }
  }
  return token ? { 'x-csrf-token': token } : {};
}

export function useApiProxy() {
  async function proxyFetch(input: string | URL | Request, init?: RequestInit) {
    const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
    if (init?.body != null) {
      headers['Content-Type'] = 'application/json';
    }
    Object.assign(headers, await csrfHeaders(init?.method));
    return fetch(input, { ...init, headers, credentials: 'include' });
  }
  return { fetch: proxyFetch };
}

export async function apiProxyFetch(input: string | URL | Request, init?: RequestInit) {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (init?.body != null) {
    headers['Content-Type'] = 'application/json';
  }
  Object.assign(headers, await csrfHeaders(init?.method));
  return fetch(input, { ...init, headers, credentials: 'include' });
}
