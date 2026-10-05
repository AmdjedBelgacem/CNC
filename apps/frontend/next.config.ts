import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

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
    remotePatterns: [
      { protocol: 'https', hostname: '**.titansofmanufacturing.com' },
      // Local MinIO/S3 uploads (http://localhost:9000/titans-local/...) + dev frontend
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '9000', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', port: '3000', pathname: '/**' },
      { protocol: 'http', hostname: 'localhost', pathname: '/**' },
      { protocol: 'https', hostname: 'localhost', pathname: '/**' },
      { protocol: 'http', hostname: '127.0.0.1', pathname: '/**' },
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [{ source: '/uploads/:path*', destination: `${apiUrl}/uploads/:path*` }];
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
