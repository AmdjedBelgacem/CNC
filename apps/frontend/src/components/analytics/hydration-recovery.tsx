'use client';

/**
 * Recovers the page when hydration fails instead of leaving it blank.
 *
 * The reasoning is deliberately different from the fixes that came before it. Those chased
 * individual causes: a service worker serving cached HTML, `Intl` disagreeing between Node and
 * a browser, a store snapshot that differed on the server. Each was real and each was worth
 * fixing — but the pattern is that every one of them produced the *same* user-visible
 * failure, and I could only find the ones I happened to reproduce.
 *
 * A hydration mismatch is not recoverable by the app itself. React discards the server HTML
 * and re-renders on the client; if that render throws, the page is a blank white screen with a
 * 200 in the network tab, and the only cure is a reload. That is why the symptom looked
 * identical every time while the underlying cause changed.
 *
 * So rather than keep hunting, this makes the failure self-healing: catch it, reload once
 * from clean state, and let the fresh client render succeed. The guard is bounded to a single
 * attempt per session so a genuine, reproducible fault cannot turn into a reload loop — and if
 * the reload does not help, the user sees the real error rather than a spinner.
 *
 * Deliberately inline in the document head, before React hydrates, because the error is
 * raised *by* hydration and a component effect would run too late to observe it.
 *
 * The `nonce` is not optional in practice. The Content-Security-Policy is
 * `script-src 'self' 'nonce-…'` with a fresh per-request nonce, and Next.js only stamps that
 * nonce on scripts it emits itself. An inline script without one is blocked outright — which
 * is exactly what happened on the first deployment of this guard: it shipped, the tag was in
 * the HTML, and it never ran, so the page still went blank. The nonce comes from the same
 * `x-nonce` request header the middleware sets.
 */
export function HydrationRecovery({ nonce }: { nonce?: string }) {
  const script = `(function(){
  try {
    if (window.__hydraRecovered) return;
    var KEY = 'hydra:recovered';
    var already = false;
    try { already = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    if (already) return;
    window.__hydraRecovered = true;

    // React 418/423/425 are the minified hydration failures. The text forms are matched
    // because the unminified development builds word them out.
    var HYDRATION = /Minified React error #(418|423|425)|Hydration failed|hydrat/i;
    var recovering = false;

    function recover() {
      if (recovering) return;
      recovering = true;
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      try { window.location.reload(); } catch (e) { location.reload(); }
    }

    window.addEventListener('error', function (e) {
      var msg = (e && (e.message || (e.error && e.error.message))) || '';
      if (HYDRATION.test(String(msg))) recover();
    }, true);

    window.addEventListener('unhandledrejection', function (e) {
      var msg = (e && e.reason && (e.reason.message || e.reason)) || '';
      if (HYDRATION.test(String(msg))) recover();
    });

    /*
     * React does not throw a hydration mismatch — in a production build it *reports* it.
     * Verified against the live site: WebKit logged "Minified React error #418" through
     * console.error with no accompanying error or unhandledrejection event, so the listeners
     * above never fired and the guard sat idle while the page went blank. That is the whole
     * failure this exists to catch, so console.error has to be watched too.
     *
     * Errors are forwarded to the original console method so nothing is hidden from
     * developers, and the pattern still has to match, so ordinary logging never reloads.
     */
    var nativeError = console.error;
    console.error = function () {
      try {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) {
          var a = arguments[i];
          parts.push(a && a.message ? a.message : String(a));
        }
        if (HYDRATION.test(parts.join(' '))) recover();
      } catch (e) {}
      return nativeError.apply(console, arguments);
    };
  } catch (e) {}
})();`;

  return (
    <script
      id="hydration-recovery"
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}