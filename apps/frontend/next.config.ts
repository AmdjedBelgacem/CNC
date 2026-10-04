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
   * `unsafe-inline` for styles only — required by the inline theme-token style
   * block and Tailwind's runtime style injection. `script-src` has no
   * `unsafe-inline`, so an injected `<script>` still cannot execute.
   */
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    // Uploaded media is served by the API, not by Next, so its origin has to be
    // an allowed image source. Without this every hero image, product thumbnail
    // and academy logo silently fails to load, and it fails silently because a
    // blocked image is not a console *error* the app surfaces.
    const mediaOrigin = (() => {
      const explicit = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL;
      if (explicit) {
        try {
          return new URL(explicit).origin;
        } catch {
          /* fall through */
        }
      }
      const port = process.env.API_PORT ?? process.env.BACKEND_PORT ?? '4000';
      return isDev ? `http://localhost:${port}` : '';
    })();
    const csp = [
      "default-src 'self'",
      `script-src 'self'${isDev ? " 'unsafe-eval'" : ''}${isDev ? " 'unsafe-inline'" : ''}`,
      // Styles must allow inline: the layout injects a <style> block built from
      // tenant theme tokens, and Tailwind/emotion inject rules at runtime.
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

    const security = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        // Camera/mic/geolocation are not used; payment and clipboard are.
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
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
