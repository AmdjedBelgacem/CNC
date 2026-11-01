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

  // The root layout (and with it globals.css and the theme tokens) is gone when
  // this renders, so the Ivory & Clay palette is restated here in a tiny inline
  // sheet — including dark mode — rather than inherited.
  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `*,*::before,*::after{box-sizing:border-box;border:0 solid}
:root{--bg:#faf9f5;--fg:#141413;--muted:#5e5d59;--line:#e6e3da;--card:#fff;--well:#f0eee6;--clay:#b65433;--danger:#b3372b;--danger-bg:rgba(179,55,43,.08)}
@media (prefers-color-scheme:dark){:root{--bg:#1f1e1d;--fg:#f5f4ee;--muted:#a6a39a;--line:#3a3936;--card:#2a2927;--well:#30302e;--clay:#c15f3c;--danger:#e0705f;--danger-bg:rgba(224,112,95,.12)}}
html{font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.5;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);min-height:100dvh;background-image:radial-gradient(60% 50% at 15% 0%,rgba(182,84,51,.08),transparent 70%)}
.ge-wrap{display:flex;min-height:100dvh;align-items:center;justify-content:center;padding:1.5rem}
.ge{width:100%;max-width:28rem;text-align:center}
.ge-icon{display:flex;width:3.5rem;height:3.5rem;margin:0 auto 1.5rem;align-items:center;justify-content:center;border-radius:9999px;background:var(--danger-bg);color:var(--danger);box-shadow:0 0 0 8px var(--danger-bg)}
.ge h1{font-family:"Source Serif 4","Source Serif Pro",Georgia,"Times New Roman",serif;font-size:2rem;font-weight:500;letter-spacing:-.022em;line-height:1.15;margin:0}
.ge-lead{margin:1rem auto 0;max-width:24rem;font-size:.9375rem;line-height:1.65;color:var(--muted)}
.ge pre{margin:1.5rem 0 0;padding:.75rem 1rem;border-radius:.75rem;border:1px solid var(--line);background:var(--well);font-size:.75rem;text-align:start;overflow-x:auto;white-space:pre-wrap;word-break:break-word;color:var(--muted)}
.ge-actions{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:2rem}
.ge-btn{display:inline-flex;align-items:center;gap:.5rem;height:2.5rem;padding-inline:1rem;border-radius:.5rem;font-size:.875rem;font-weight:500;cursor:pointer;transition:transform .12s cubic-bezier(.32,.72,0,1),background-color .15s}
.ge-btn:active{transform:scale(.975)}
.ge-primary{background:var(--clay);color:#fff}
.ge-primary:hover{filter:brightness(.95)}
.ge-outline{border:1px solid var(--line);background:var(--card);color:var(--fg)}
.ge-outline:hover{background:var(--well)}
.ge-ref{margin:2rem 0 0;font-size:.75rem;color:var(--muted)}
.ge-ref code{font-family:ui-monospace,monospace;font-size:.6875rem;background:var(--well);padding:.125rem .375rem;border-radius:.375rem}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion:no-preference){.fu{animation:fadeUp .5s cubic-bezier(.32,.72,0,1) both}}`,
          }}
        />
      </head>
      <body>
        <div className="fu ge-wrap">
          <div className="ge">
            <div className="ge-icon">
              <AlertTriangle size={24} />
            </div>
            <h1>Something went wrong</h1>
            <p className="ge-lead">
              The app failed to start. Reloading usually clears it. If this keeps happening, the
              problem is with the application build rather than the page you were on.
            </p>

            {isSpecificMessage(error.message) && <pre dir="ltr">{error.message}</pre>}

            <div className="ge-actions">
              <button type="button" onClick={reset} className="ge-btn ge-primary">
                <RefreshCw size={16} />
                Reload
              </button>
              <button type="button" onClick={() => router.push('/')} className="ge-btn ge-outline">
                <Home size={16} />
                Go home
              </button>
            </div>

            {error.digest && (
              <p className="ge-ref">
                Reference: <code>{error.digest}</code>
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
