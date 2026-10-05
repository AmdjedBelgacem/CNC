import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DEFAULT_TENANT_SLUG } from '@/lib/tenant-config';
import { DEFAULT_LOCALE, LOCALE_COOKIE, coerceLocale, localeFromAcceptLanguage } from '@/i18n/config';

/**
 * Tenant resolution.
 *
 * The previous implementation took the FIRST LABEL of the Host header and used it as the
 * tenant slug. Served from `127.0.0.1` that produced the slug `"127"`, and from a LAN IP
 * `"192"` — neither exists, so the backend returned 500 and every DB-driven page rendered
 * empty. An arbitrary host label is attacker-controlled input and must never become a
 * tenant identifier.
 *
 * A slug is now accepted ONLY from an explicitly trusted source:
 *   1. TENANT_DOMAIN_MAP — an explicit host -> slug map (JSON), e.g.
 *      {"acme.titansofmanufacturing.com":"acme"}
 *   2. a single-label subdomain of TENANT_BASE_DOMAIN
 *   3. otherwise -> DEFAULT_TENANT_SLUG (a safe, real tenant)
 * IP addresses, localhost, *.local, unknown domains and malformed labels all fall back to
 * the default tenant, so the product renders real data instead of breaking.
 */
const BASE_DOMAIN = (process.env.TENANT_BASE_DOMAIN || 'titansofmanufacturing.com').toLowerCase();
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,99}$/;

function domainMap(): Record<string, string> {
  try {
    const raw = process.env.TENANT_DOMAIN_MAP;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Extract a bare hostname, handling IPv6 literals like `[::1]:3000`. */
function hostnameOf(hostHeader: string): string {
  const h = (hostHeader || '').trim().toLowerCase();
  if (!h) return '';
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    return end === -1 ? h : h.slice(1, end);
  }
  return h.split(':')[0] ?? '';
}

/** IP literals, localhost and mDNS names are never tenant identifiers. */
function isNonTenantHost(hostname: string): boolean {
  if (!hostname) return true;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname.endsWith('.local')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true; // IPv4
  if (hostname.includes(':')) return true;                    // IPv6
  if (/^\d+$/.test(hostname)) return true;                    // bare number
  return false;
}

function resolveTenantSlug(hostHeader: string): string {
  const hostname = hostnameOf(hostHeader);
  if (isNonTenantHost(hostname)) return DEFAULT_TENANT_SLUG;

  const explicit = domainMap()[hostname];
  if (explicit && SLUG_RE.test(explicit)) return explicit;

  if (hostname === BASE_DOMAIN) return DEFAULT_TENANT_SLUG;
  if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = hostname.slice(0, -(BASE_DOMAIN.length + 1));
    // Exactly one label, and it must look like a slug.
    if (sub && !sub.includes('.') && SLUG_RE.test(sub)) return sub;
  }

  // Unknown domain: fall back to the default tenant rather than inventing a slug.
  return DEFAULT_TENANT_SLUG;
}

// `/cart` is deliberately public: the cart lives in local storage, so guests browse
// and review it freely and only authenticate at `/checkout`.
const PROTECTED_ROUTES = ['/account', '/checkout', '/notifications', '/admin'];
export async function middleware(request: NextRequest) {
  const tenantSlug = resolveTenantSlug(request.headers.get('host') || '');
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
/**
 * Content-Security-Policy.
 *
 * This used to be a static header in next.config.ts with `script-src 'self'` and no
 * `'unsafe-inline'`. That works in development (which adds 'unsafe-inline' and
 * 'unsafe-eval') but blocks production outright: Next.js emits its hydration payload and
 * several bootstrap scripts as INLINE <script> elements, so every one of them was refused
 * and React never hydrated. The site sat on loading skeletons forever with a wall of
 * "Executing inline script violates ... script-src 'self'" console errors.
 *
 * `'unsafe-inline'` would fix hydration but hand back exactly the XSS exposure the
 * original policy was written to prevent. So a per-request nonce is used instead: it is
 * forwarded to Next via the `x-nonce` request header, Next stamps it onto every script it
 * emits, and the policy then only trusts scripts carrying this request's nonce. An
 * injected inline script has no way to know it.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL;
  let mediaOrigin = '';
  if (explicit) {
    try {
      mediaOrigin = new URL(explicit).origin;
    } catch {
      /* fall through */
    }
  }
  if (!mediaOrigin && isDev) mediaOrigin = 'http://localhost:4000';

  // Development keeps 'unsafe-eval' because the dev overlay and HMR need it.
  const scriptSrc = [`'self'`, `'nonce-${nonce}'`];
  if (isDev) scriptSrc.push("'unsafe-eval'", "'unsafe-inline'");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    // Styles must allow inline: the layout injects a <style> block built from tenant
    // theme tokens, and Tailwind injects rules at runtime.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${isDev ? ' http://localhost:* http://127.0.0.1:*' : ''}${mediaOrigin ? ` ${mediaOrigin}` : ''}`,
    "font-src 'self' data:",
    `media-src 'self' blob: https:${mediaOrigin ? ` ${mediaOrigin}` : ''}`,
    `connect-src 'self' https: wss:${isDev ? ' ws: http://localhost:*' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

  // A fresh nonce per request. It goes on the REQUEST so Next.js can stamp it onto the
  // scripts it renders, and on the RESPONSE so the browser only trusts that nonce.
  const nonce = randomBytes(16).toString('base64');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  response.headers.set('x-tenant-slug', tenantSlug);
  // Cookie-based locale resolution — no URL prefix, no redirect.
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale
    ? coerceLocale(cookieLocale)
    : (localeFromAcceptLanguage(request.headers.get('accept-language')) ?? DEFAULT_LOCALE);
  response.headers.set('x-locale', locale);

  // Only write these cookies when they would actually CHANGE.
  //
  // Every Set-Cookie forces the response to be `private, no-store`: a shared cache cannot
  // hold a response whose body is negotiated per visitor. Re-asserting an unchanged cookie on
  // every single request therefore guaranteed zero CDN caching for the whole site — one
  // function invocation and one full render per pageview, forever.
  //
  // Repeat visitors already send the right values, so there is nothing to tell them, and
  // skipping the write keeps the response cacheable. Same values, same behaviour, one fewer
  // reason for the edge to treat the response as uncacheable.
  if (request.cookies.get('x-tenant-slug')?.value !== tenantSlug) {
    response.cookies.set('x-tenant-slug', tenantSlug, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  if (cookieLocale !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }
  // The access cookie is the WRONG signal on its own: it lives 15 minutes, and the
  // browser deletes it on expiry while the refresh cookie is still good for 7 days.
  // Keying the redirect on it alone hard-bounced every live session to /login the
  // moment the access token aged out — server-side, before any client code could run,
  // so the rotation that would have fixed it never got the chance.
  //
  // Presence of either cookie means "this session may still be valid". Let the request
  // through and let the client settle it: the API client rotates on a 401, and the
  // admin gate still redirects once hydration confirms there is really no session.
  // Only a browser holding NEITHER cookie is certainly anonymous.
  const accessCookie =
    request.cookies.get('access-token') ||
    request.cookies.get('__Host-access') ||
    request.cookies.get('__Host-access-token');
  const refreshCookie =
    request.cookies.get('refresh-token') ||
    request.cookies.get('__Host-refresh') ||
    request.cookies.get('__refresh-fallback');
  const mayHaveSession = !!(accessCookie?.value || refreshCookie?.value);
  if (pathname.startsWith('/api/')) {
    return response;
  }
  // Note: /login and /register are intentionally never bounced here — a
  // cookie's presence alone can't prove the JWT is still valid (it expires
  // in 15m), and bouncing stale sessions out of /login locks users out.
if (isProtected && !mayHaveSession) { const loginUrl = new URL('/login', request.url); loginUrl.searchParams.set('returnUrl', pathname); return NextResponse.redirect(loginUrl); } return response;
}
export const config = {
  /**
   * Run on the Node.js runtime, not Edge.
   *
   * Middleware defaults to the Edge runtime, which made this build emit an Edge Function
   * (`_middleware`) — and a Vercel *services* project rejects Edge output outright:
   * "Edge Runtime is not supported in services." Nothing here needs an edge isolate; it
   * only uses web APIs plus `process.env`, both of which Node supports.
   */
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|opengraph-image|robots|sitemap).*)'],
};
