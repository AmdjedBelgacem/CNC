/**
 * CORS origin resolution, shared by the HTTP layer and the Socket.IO gateway.
 *
 * The two disagreed: `WsGateway` already split `FRONTEND_URL` on commas, while
 * `app.enableCors()` in `main.ts` passed the raw string. With a single origin that
 * difference is invisible, but the moment a comma appears — which is what a Vercel
 * preview plus production needs — REST and WebSocket quietly disagree about who is
 * allowed, and the failing half is whichever the operator was not testing.
 *
 * Both now call `corsOrigins()`, so the allowlist has one definition.
 */

/** Origins allowed when nothing is configured: local dev only. */
const DEFAULT_ORIGIN = 'http://localhost:3000';

/**
 * Wildcard hostname suffixes. Preview deployments are generated per commit, so a
 * Vercel preview origin cannot be enumerated ahead of time — `*.vercel.app` is the
 * only way to accept them without editing env on every push.
 */
const WILDCARD_SUFFIXES = ['.vercel.app'];

/**
 * Resolve the allowed-origin list.
 *
 * Precedence: `CORS_ORIGINS` wins, then `FRONTEND_URL`, then localhost. Both are
 * accepted because a dual deploy has several legitimate writers of the value — Fly
 * secrets for `FRONTEND_URL`, and the Vercel project env for `CORS_ORIGINS` — and
 * making them interchangeable avoids a class of "set the wrong one" outage.
 *
 * Entries are trimmed, empties dropped and duplicates removed. A trailing slash is
 * stripped: the browser sends `Origin` without one, and a mismatch there produces a
 * CORS failure that looks like a credentials bug.
 */
export function corsOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = [env.CORS_ORIGINS, env.FRONTEND_URL]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(',');

  const origins = raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) return [DEFAULT_ORIGIN];
  return [...new Set(origins)];
}

/**
 * True when `origin` may make a credentialed request.
 *
 * Exact match against the list, plus the wildcard suffixes. `null`/`undefined`
 * (non-browser callers: curl, health checks, server-to-server) returns true, since
 * CORS does not apply to them and refusing would break internal traffic.
 */
export function isOriginAllowed(origin: string | null | undefined, allowed: readonly string[]): boolean {
  if (!origin) return true;
  // Compare case-insensitively. The URL spec serialises an origin with a
  // lowercased scheme and host, so a browser always sends lower case — but a
  // hand-edited env var or an .env file can easily carry upper case, and a
  // case-sensitive compare then rejects a legitimate origin with no visible
  // cause. An origin is scheme + host + port with no path, so folding case
  // cannot change its meaning.
  const candidate = origin.replace(/\/+$/, '').toLowerCase();
  if (allowed.some((entry) => entry.replace(/\/+$/, '').toLowerCase() === candidate)) return true;
  return WILDCARD_SUFFIXES.some(
    (suffix) => candidate.endsWith(suffix) && !candidate.endsWith(`www${suffix}`),
  );
}

/** The value for `@WebSocketGateway({ cors: { origin } })`, which takes an array. */
export function wsCorsOrigin(env: NodeJS.ProcessEnv = process.env): string[] {
  return corsOrigins(env);
}