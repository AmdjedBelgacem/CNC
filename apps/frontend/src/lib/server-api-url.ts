/**
 * Server-side resolution of the backend origin.
 *
 * One function, three consumers: the `/api/proxy/*` BFF, the `next.config.ts`
 * `/uploads/*` rewrite, and anything else that has to reach the backend from the
 * server. Centralised because the fallback order is a deployment decision, not a
 * detail to re-derive per call site — and because when the order drifts, the
 * frontend and its rewrites resolve to *different* backends.
 *
 * Precedence, highest first:
 *
 *  1. `API_URL`            the current target. Set this and nothing else changes
 *                          when moving between Fly, Hetzner, or a Vercel container.
 *  2. `API_INTERNAL_URL`   a Vercel service binding, used by the pre-Fly
 *                          single-project layout. Kept so the current deployment
 *                          keeps working unchanged.
 *  3. `NEXT_PUBLIC_API_URL` the public origin, for hosts where the backend really
 *                          is public (local, or a plain separate deployment).
 *  4. `http://localhost:4000` local development.
 *
 * Never reaches the browser: this is imported only from server-side modules.
 */
export function serverApiUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw =
    env.API_URL ||
    env.API_INTERNAL_URL ||
    env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000';
  return raw.replace(/\/+$/, '');
}

/** Absolute URL for a backend path, preserving an existing query string. */
export function serverApiPath(path: string, env: NodeJS.ProcessEnv = process.env): string {
  const base = serverApiUrl(env);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}