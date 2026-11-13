/**
 * A post-sign-in destination is accepted only as a same-origin relative path: one leading
 * `/`, never `//` or `/\` (both are read by browsers as a protocol-relative host), no
 * scheme, no backslashes and no control characters. Anything else is dropped, so the
 * caller falls back to its default instead of bouncing the user to another site.
 */
export function safeRedirectPath(value: unknown, maxLength = 400): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > maxLength) return null;
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return null;
  if (candidate.includes('\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return null;
  try {
    const base = 'https://internal.invalid';
    const url = new URL(candidate, base);
    if (url.origin !== base) return null;
    const decoded = decodeURIComponent(url.pathname);
    if (decoded.startsWith('//') || decoded.includes('\\') || /[\u0000-\u001f\u007f]/.test(decoded)) return null;
  } catch {
    return null;
  }
  return candidate;
}
