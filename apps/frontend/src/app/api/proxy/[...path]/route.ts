import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, 'GET');
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, 'POST');
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, 'PATCH');
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, 'PUT');
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path, 'DELETE');
}

let cachedCsrfToken: string | null = null;

async function getCsrfToken(forceRefresh = false): Promise<string | null> {
  if (cachedCsrfToken && !forceRefresh) return cachedCsrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf-token`);
    if (!res.ok) return null;
    const data = await res.json();
    cachedCsrfToken = data.csrfToken || null;
    return cachedCsrfToken;
  } catch {
    return null;
  }
}

/** Return a Cookie header carrying exactly one `csrf-token` entry, set to `token`. */
function withCsrfCookie(cookieHeader: string | undefined, token: string): string {
  const kept = (cookieHeader || '')
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith('csrf-token='));
  kept.push(`csrf-token=${token}`);
  return kept.join('; ');
}

/**
 * Resolve the double-submit pair forwarded to the backend.
 *
 * The guard rejects outright when `csrfCookie !== csrfHeader`, and mints a fresh
 * token for the header while forwarding the browser's pre-existing `csrf-token`
 * cookie — a guaranteed 403 that broke every Course Studio mutation
 * (create/save/publish/upload/reorder).
 *
 * Two rules, in order:
 *  1. A client-supplied `x-csrf-token` is forwarded VERBATIM and the cookie is left
 *     alone. The proxy must never overwrite it with the cookie value, otherwise a
 *     forged header would be silently "corrected" and the double-submit check would
 *     become vacuous — a CSRF oracle.
 *  2. Only when the client sent no header at all do we mint a server-side token and
 *     pair it into BOTH the header and the cookie, so the backend's equality check
 *     passes. This compatibility path exists because most callers go through
 *     `apiProxyFetch`, which historically did not attach the header.
 *
 * Rule 2 is safe against CSRF because every credential cookie (`access-token`,
 * `refresh-token`, `csrf-token`) is `SameSite=Lax`: a cross-site POST carries none
 * of them, so an attacker can never reach this path with a victim's session. If any
 * of those cookies is ever relaxed to `SameSite=None`, this fallback MUST be removed
 * and every mutating client made to send the header itself.
 */
async function resolveCsrf(
  cookieHeader: string | undefined,
  clientToken: string | null,
): Promise<{ token: string | null; cookieHeader: string | undefined }> {
  if (clientToken) return { token: clientToken, cookieHeader };
  const token = await getCsrfToken();
  if (!token) return { token: null, cookieHeader };
  return { token, cookieHeader: withCsrfCookie(cookieHeader, token) };
}

async function proxyRequest(request: NextRequest, path: string[], method: string) {
  const store = await cookies();
  const tenantSlug = store.get('x-tenant-slug')?.value || DEFAULT_TENANT_SLUG;
  const url = `${API_BASE}/${path.join('/')}${request.nextUrl.search}`;
  const body = method !== 'GET' ? await request.text().catch(() => null) : null;
  const headers: Record<string, string> = { 'x-tenant-slug': tenantSlug };
  if (body && body.length > 0) {
    headers['Content-Type'] = 'application/json';
  }
  // Forward all cookies (including httpOnly access/refresh) to backend
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    headers['cookie'] = cookieHeader;
  }
  // For dual-write migration: also support Authorization header fallback
  const incomingAuth = request.headers.get('authorization');
  if (incomingAuth?.startsWith('Bearer ')) {
    headers['authorization'] = incomingAuth;
  }
  let synthesizedCsrf = false;
  if (method !== 'GET') {
    const clientToken = request.headers.get('x-csrf-token');
    const resolved = await resolveCsrf(headers['cookie'], clientToken);
    if (resolved.token) {
      headers['x-csrf-token'] = resolved.token;
      if (resolved.cookieHeader) headers['cookie'] = resolved.cookieHeader;
      synthesizedCsrf = !clientToken;
    }
  }
  let response = await fetch(url, { method, headers, body });
  // The signing secret is derived from AUTH_SECRET, so a cached token goes stale if
  // that secret rotates. Only our own minted token can be stale — a client-supplied
  // one is the client's business — so re-mint and replay once, on the fallback path.
  if (synthesizedCsrf && response.status === 403) {
    const peek = await response.clone().text();
    if (peek.includes('CSRF')) {
      const fresh = await getCsrfToken(true);
      if (fresh) {
        response = await fetch(url, {
          method,
          headers: {
            ...headers,
            'x-csrf-token': fresh,
            cookie: withCsrfCookie(headers['cookie'], fresh),
          },
          body,
        });
      }
    }
  }
  const data = await response.text();
  // Forward Set-Cookie headers from backend to client
  const responseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  const setCookie = response.headers.getSetCookie?.() || [];
  // Fallback for environments where getSetCookie not available
  if (setCookie.length === 0) {
    const single = response.headers.get('set-cookie');
    if (single) responseHeaders['set-cookie'] = single;
  }
  const nextResponse = new NextResponse(data, { status: response.status, headers: responseHeaders });
  // Forward each Set-Cookie
  for (const cookie of setCookie) {
    nextResponse.headers.append('set-cookie', cookie);
  }
  return nextResponse;
}
