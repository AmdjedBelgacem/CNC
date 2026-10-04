/**
 * Root error boundary.
 *
 * This one is special: the root layout has already failed, so Next.js renders it
 * *instead of* `<html>` — there is no providers tree, no `next-intl`, no theme.
 * That rules out every shared component in the app (they all depend on context
 * from the root layout), so this file inlines its own `<html>`/`<body>` and
 * uses raw classes and Tailwind defaults only.
 *
 * Inlining Tailwind's preflight reset is deliberate: without it the unstyled
 * `<h1>`/`<button>` render as Times New Roman, which looks like a broken page
 * rather than an error screen.
 */
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

/** A message is only worth showing when it's more specific than Next's default. */
function isSpecificMessage(message: string): boolean {
  return (
    message.length > 0 &&
    message.length < 300 &&
    !/^An error occurred in the Server Components render/i.test(message) &&
    !/^An error occurred in the Client Components render/i.test(message) &&
    !/digest/i.test(message)
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  React.useEffect(() => {
    // Nothing to report to in this environment — kept as the hook point for a
    // real telemetry sink, and so the boundary always mounts cleanly.
    void error;
  }, [error]);

  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `*,*::before,*::after{box-sizing:border-box;border:0 solid #e5e7eb}
html{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.5;-webkit-text-size-adjust:100%}
body{margin:0;background:#fafafa;color:#18181b;min-height:100dvh}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion:no-preference){.fu{animation:fadeUp .4s cubic-bezier(.32,.72,0,1) both}}
:root{--f:.75rem}`,
          }}
        />
      </head>
      <body>
        <div className="fu flex min-h-[100dvh] items-center justify-center p-6">
          <div style={{ width: '100%', maxWidth: '28rem', textAlign: 'center' }}>
            <div
              style={{
                display: 'flex',
                width: '3.5rem',
                height: '3.5rem',
                margin: '0 auto 1.25rem',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '1rem',
                border: '1px solid #fecaca',
                background: '#fef2f2',
              }}
            >
              <AlertTriangle size={24} color="#dc2626" />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              Something went wrong
            </h1>
            <p
              style={{
                margin: '.75rem auto 0',
                maxWidth: '24rem',
                fontSize: '0.875rem',
                lineHeight: 1.65,
                color: '#71717a',
              }}
            >
              The app failed to start. Reloading usually clears it. If this keeps happening, the
              problem is with the application build rather than the page you were on.
            </p>

            {isSpecificMessage(error.message) && (
              <pre
                dir="ltr"
                style={{
                  margin: '1.5rem 0 0',
                  padding: '.75rem 1rem',
                  borderRadius: '.5rem',
                  background: '#f4f4f5',
                  fontSize: '0.75rem',
                  // Logical, so it resolves against the pinned ltr direction above.
                  textAlign: 'start',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {error.message}
              </pre>
            )}

            <div
              style={{
                display: 'flex',
                gap: '.75rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginTop: '1.75rem',
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '.5rem',
                  height: '2.5rem',
                  paddingInline: '1rem',
                  borderRadius: '.5rem',
                  border: 0,
                  background: '#18181b',
                  color: '#fafafa',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={16} />
                Reload
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '.5rem',
                  height: '2.5rem',
                  paddingInline: '1rem',
                  borderRadius: '.5rem',
                  border: '1px solid #e4e4e7',
                  background: '#fff',
                  color: '#18181b',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Home size={16} />
                Go home
              </button>
            </div>

            {error.digest && (
              <p style={{ margin: '1.5rem 0 0', fontSize: '0.6875rem', color: '#a1a1aa', fontFamily: 'ui-monospace,monospace' }}>
                Reference: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}