/**
 * Request guards for the `/api/proxy/*` BFF, kept free of Next.js runtime imports so
 * they can be unit-tested directly.
 *
 * A `_lib` folder is private in the App Router: nothing here is routable.
 */

/**
 * Body ceiling for a proxied request.
 *
 * The proxy forwards bodies as text with `Content-Type: application/json`, so multipart
 * uploads never come through here (files go straight to storage on a presigned PUT).
 * The backend's own JSON limit is 2 MB; 3 MB leaves headroom for that without letting
 * one request pin an unbounded allocation in the Next server before auth is even checked.
 */
export const MAX_PROXY_BODY_BYTES = 3 * 1024 * 1024;

/**
 * Server-to-server callbacks that carry no browser fetch metadata. Each verifies its own
 * signature/secret in the backend, so the same-origin check does not apply to them.
 * Exact paths only (relative to /api/proxy/).
 */
export const CSRF_EXEMPT_PATHS = new Set(['payments/webhook', 'payments/moyasar/webhook']);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/** Every origin this deployment answers on: its own Host, plus FRONTEND_URL entries. */
export function allowedOrigins(headers: Headers, env: NodeJS.ProcessEnv = process.env): Set<string> {
  const out = new Set<string>();
  const host = headers.get('x-forwarded-host')?.split(',')[0]?.trim() || headers.get('host')?.trim();
  if (host) {
    const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    // Proto may be absent on a direct hit; accept both schemes for the request's own host.
    for (const scheme of proto ? [proto] : ['https', 'http']) {
      const o = originOf(`${scheme}://${host}`);
      if (o) out.add(o);
    }
  }
  for (const entry of (env.FRONTEND_URL || '').split(',')) {
    const o = originOf(entry.trim());
    if (o) out.add(o);
  }
  return out;
}

/**
 * Same-origin gate for state-changing requests (CSRF defence in depth on top of the
 * SameSite=Lax cookies and the double-submit token).
 *
 * Returns null when allowed, or a reason string when the request must be refused.
 *   - `Sec-Fetch-Site` present (every current browser): must be `same-origin`.
 *   - absent (older browsers, non-browser clients): `Origin` must be one of ours.
 *   - neither header: refused.
 */
export function crossSiteRejection(
  method: string,
  path: string[],
  headers: Headers,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (SAFE_METHODS.has(method.toUpperCase())) return null;
  if (CSRF_EXEMPT_PATHS.has(path.join('/'))) return null;
  const site = headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' ? null : `cross-site request refused (sec-fetch-site: ${site})`;
  const origin = originOf(headers.get('origin'));
  if (!origin) return 'cross-site request refused (no Origin)';
  return allowedOrigins(headers, env).has(origin) ? null : 'cross-site request refused (origin mismatch)';
}

/** True when a declared Content-Length already exceeds the cap. */
export function declaredBodyTooLarge(headers: Headers, cap = MAX_PROXY_BODY_BYTES): boolean {
  const raw = headers.get('content-length');
  if (raw === null) return false;
  const n = Number(raw);
  return !Number.isFinite(n) || n < 0 || n > cap;
}

/**
 * Read a request body as UTF-8 text, stopping as soon as it exceeds `cap` bytes.
 * Returns `{ tooLarge: true }` on overflow, so a chunked body with no Content-Length
 * is bounded exactly like a declared one. Never buffers more than `cap` + one chunk.
 */
export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  cap = MAX_PROXY_BODY_BYTES,
): Promise<{ tooLarge: false; text: string | null } | { tooLarge: true }> {
  if (!body) return { tooLarge: false, text: null };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel().catch(() => undefined);
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { tooLarge: false, text: null };
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return { tooLarge: false, text: new TextDecoder().decode(merged) };
}
