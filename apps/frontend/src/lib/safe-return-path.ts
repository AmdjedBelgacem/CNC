import { isSafeInternalHref } from './safe-href';

/**
 * Where to send the browser after sign-in, from an untrusted `returnUrl`/`returnTo` query
 * parameter. Only a same-origin relative path is honoured: one leading `/`, never `//` or
 * `/\` (browsers read both as another host), no scheme, no control characters. Anything
 * else falls back to `fallback`, so a crafted login link cannot bounce the user off-site.
 */
export function safeReturnPath(value: unknown, fallback = '/'): string {
  return isSafeInternalHref(value) ? value.trim() : fallback;
}
