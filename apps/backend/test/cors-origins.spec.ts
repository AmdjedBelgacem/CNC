import { describe, it, expect } from 'vitest';
import { corsOrigins, isOriginAllowed } from '../src/common/http/cors-origins';

/**
 * CORS allowlist behaviour.
 *
 * Written because REST and the Socket.IO gateway resolved the same variable two
 * different ways: `WsGateway` split `FRONTEND_URL` on commas while
 * `app.enableCors()` in main.ts passed the raw string. With one origin the
 * difference is invisible. The moment a preview + production allowlist appears —
 * which is exactly what a Vercel deployment needs — REST and websocket disagree
 * about who is allowed, and only the half nobody tested breaks.
 */

describe('corsOrigins', () => {
  it('defaults to localhost when nothing is configured', () => {
    expect(corsOrigins({} as NodeJS.ProcessEnv)).toEqual(['http://localhost:3000']);
  });

  it('accepts a single FRONTEND_URL', () => {
    expect(corsOrigins({ FRONTEND_URL: 'https://cnc-rho-lilac.vercel.app' } as NodeJS.ProcessEnv)).toEqual([
      'https://cnc-rho-lilac.vercel.app',
    ]);
  });

  it('splits a comma-separated list — the regression', () => {
    const origins = corsOrigins({
      FRONTEND_URL: 'https://cnc-rho-lilac.vercel.app,https://cnc-abc.vercel.app',
    } as NodeJS.ProcessEnv);
    expect(origins).toEqual(['https://cnc-rho-lilac.vercel.app', 'https://cnc-abc.vercel.app']);
  });

  it('merges CORS_ORIGINS and FRONTEND_URL and de-duplicates', () => {
    const origins = corsOrigins({
      CORS_ORIGINS: 'https://a.vercel.app,https://b.vercel.app',
      FRONTEND_URL: 'https://b.vercel.app',
    } as NodeJS.ProcessEnv);
    expect(origins).toEqual(['https://a.vercel.app', 'https://b.vercel.app']);
  });

  it('lets CORS_ORIGINS override when FRONTEND_URL is a single origin', () => {
    const origins = corsOrigins({
      CORS_ORIGINS: 'https://only-this.vercel.app',
      FRONTEND_URL: 'https://ignored.vercel.app',
    } as NodeJS.ProcessEnv);
    expect(origins).toEqual(['https://only-this.vercel.app', 'https://ignored.vercel.app']);
  });

  it('strips trailing slashes, because the browser Origin header has none', () => {
    const origins = corsOrigins({ FRONTEND_URL: 'https://cnc.vercel.app/' } as NodeJS.ProcessEnv);
    expect(origins).toEqual(['https://cnc.vercel.app']);
    expect(isOriginAllowed('https://cnc.vercel.app', origins)).toBe(true);
  });

  it('drops empty entries from a trailing comma', () => {
    expect(corsOrigins({ FRONTEND_URL: 'https://a.vercel.app,' } as NodeJS.ProcessEnv)).toEqual([
      'https://a.vercel.app',
    ]);
  });
});

describe('isOriginAllowed', () => {
  const allowed = corsOrigins({ FRONTEND_URL: 'https://cnc-rho-lilac.vercel.app' } as NodeJS.ProcessEnv);

  it('allows an exact match', () => {
    expect(isOriginAllowed('https://cnc-rho-lilac.vercel.app', allowed)).toBe(true);
  });

  it('refuses *.vercel.app previews unless they are explicitly opted back in', () => {
    // Single-origin production must not hand an ACAO header to any vercel.app
    // origin anybody can deploy to. Preview deployments are opt-in.
    expect(isOriginAllowed('https://cnc-abc123.vercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('https://cnc-x-y-z.vercel.app', allowed)).toBe(false);
  });

  it('allows *.vercel.app previews when CORS_ALLOW_VERCEL_PREVIEWS is set', () => {
    const on = { CORS_ALLOW_VERCEL_PREVIEWS: 'true' } as NodeJS.ProcessEnv;
    expect(isOriginAllowed('https://cnc-abc123.vercel.app', allowed, on)).toBe(true);
    expect(isOriginAllowed('https://cnc-x-y-z.vercel.app', allowed, on)).toBe(true);
  });

  it('rejects an unrelated origin', () => {
    expect(isOriginAllowed('https://evil.example.com', allowed)).toBe(false);
  });

  it('does not wildcard a lookalike suffix', () => {
    expect(isOriginAllowed('https://notvercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('https://vercel.app.evil.com', allowed)).toBe(false);
  });

  it('allows non-browser callers, so curl and health checks are not blocked', () => {
    // CORS does not apply when there is no Origin header. Refusing here would
    // break the Fly health check and any server-to-server call.
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
    expect(isOriginAllowed(null, allowed)).toBe(true);
    expect(isOriginAllowed('', allowed)).toBe(true);
  });

  it('ignores case in the host, which browsers normalise but config may not', () => {
    expect(isOriginAllowed('https://CNC-Rho-Lilac.Vercel.App', allowed)).toBe(true);
  });
});