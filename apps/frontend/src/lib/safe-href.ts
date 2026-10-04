const INTERNAL_BASE = 'https://internal.invalid';

export function isSafeInternalHref(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const candidate = value.trim();
  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return false;
  }
  try {
    const url = new URL(candidate, INTERNAL_BASE);
    const decodedPath = decodeURIComponent(url.pathname);
    return (
      url.origin === INTERNAL_BASE &&
      url.pathname.startsWith('/') &&
      !url.pathname.startsWith('//') &&
      !decodedPath.startsWith('//') &&
      !decodedPath.includes('\\') &&
      !/[\u0000-\u001f\u007f]/.test(decodedPath)
    );
  } catch {
    return false;
  }
}

export function safeInternalHref(value: unknown, fallback?: string): string | null {
  if (isSafeInternalHref(value)) return value.trim();
  if (fallback && isSafeInternalHref(fallback)) return fallback;
  return null;
}

/**
 * External links, for web-search citations only.
 *
 * Deliberately stricter than `safeInternalHref`: https only, no credentials, no
 * loopback or bare-IP hosts, and nothing that could smuggle a `javascript:` or
 * `data:` scheme past a naive prefix check.
 */
export function safeExternalHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return null;
  return url.toString();
}
