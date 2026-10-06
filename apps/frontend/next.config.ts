import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { serverApiUrl } from './src/lib/server-api-url';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  turbopack: {
    // Monorepo root, resolved from this file rather than hardcoded. An absolute
    // machine-specific path (`/Users/mac/...`) made Turbopack fail on CI with
    // "Invalid distDirRoot: \".next\". distDirRoot should not navigate out of the
    // projectPath", because the configured root did not exist on the runner.
    root: path.join(__dirname, '../..'),
  },
  images: {
    /**
     * Hosts Next is allowed to pull remote images through `/_next/image` for.
     *
     * This used to end with `{ hostname: '**' }` on both http and https, which is two
     * problems at once. It made Vercel an open image proxy — any visitor could point the
     * optimizer at an arbitrary host and have Vercel fetch it — and it meant every remote
     * image was re-served through Vercel (optimizer CPU + egress) even though the assets
     * already live on Supabase Storage's own CDN, which serves them for free.
     *
     * The allowlist is the hosts assets can actually come from: Supabase Storage (uploads and
     * generated covers) and the marketing domain. Local MinIO/backend origins stay for dev.
     * Same-origin paths such as `/uploads/*` need no entry — Next optimizes those without
     * consulting this list.
     */
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.titansofmanufacturing.com' },
      // Local MinIO/S3 uploads (http://localhost:9000/titans-local/...) + dev frontend
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '9000', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', port: '3000', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
      { protocol: 'https', hostname: 'localhost', pathname: '/**' },
      { protocol: 'http', hostname: '127.0.0.1', pathname: '/**' },
    ],
  },
  async rewrites() {
    // Same resolver as the /api/proxy BFF. They must agree: if the BFF talks to
    // Fly and this rewrite still pointed at a Vercel service binding, uploaded
    // images would 404 while every other API call worked, which is a miserable
    // thing to diagnose in production.
    const apiUrl = serverApiUrl();
    const backend = (path: string) => `${apiUrl}${path}`;

    /**
     * Same-origin paths that must reach the backend rather than Next.js.
     *
     * `/socket.io` needs both an exact rule and a `:path*` rule: Vercel strips the
     * trailing slash, so the Socket.IO handshake arrives as `/socket.io` with an empty
     * path, which `:path*` does not match — without the exact rule the request got a
     * 308 to itself and realtime never connected.
     *
     * These live here, not in vercel.json, because Vercel resolves `${VAR}` in
     * vercel.json destinations at the routing layer, which cannot read a Secret-type
     * variable. Here `process.env` is read inside the Node process, so the same
     * serverApiUrl() that serves /api/proxy applies and API_URL stays the only switch.
     */
    return [
      { source: '/uploads/:path*', destination: backend('/uploads/:path*') },
      { source: '/socket.io', destination: backend('/socket.io') },
      { source: '/socket.io/:path*', destination: backend('/socket.io/:path*') },
      // OAuth callbacks are handled by the backend, which owns the state cookie.
      { source: '/auth/oauth/:path*', destination: backend('/auth/oauth/:path*') },
    ];
  },
  /**
   * Security headers.
   *
   * The app previously shipped *none* of these: no CSP, no HSTS, no
   * clickjacking guard, no MIME-sniffing guard. Everything below is also applied
   * by the backend's helmet, but the public site is served by Next and never
   * touches the API middleware, so it needs its own.
   *
   * The CSP is as strict as the app tolerates: no `unsafe-eval` in production
   * (Next's dev overlay needs it, and it is scoped to development), and
   * Content-Security-Policy is NOT set here. It is issued per request by
   * src/middleware.ts with a nonce, because a static header cannot work: Next.js emits its
   * hydration payload as inline <script>, and `script-src 'self'` without 'unsafe-inline'
   * blocks every one of them, leaving the app permanently unhydrated on skeletons. The
   * nonce policy keeps `script-src` free of 'unsafe-inline'. Setting CSP in both places
   * would make the browser apply the stricter of the two and re-break hydration.
   */
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        // Camera/mic/geolocation are not used; payment and clipboard are.
        // `interest-cohort` was removed from the spec and Chrome warns on it
        // ('Unrecognized feature'), so it is deliberately absent.
        value: 'camera=(), microphone=(), geolocation=()',
      },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
    ];
    // HSTS is only meaningful — and only safe — over TLS.
    if (!isDev) security.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' });

    return [
      { source: '/:path*', headers: security },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  poweredByHeader: false,
  experimental: {
    proxyClientMaxBodySize: '1gb',
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Ensure PostCSS config is picked up from frontend app directory
  serverExternalPackages: ['@tailwindcss/postcss', 'autoprefixer'],
};

export default withNextIntl(nextConfig);
