/** True for in-app paths that should use Next.js `<Link>` (client-side nav). */
export function isInternalHref(href: string | undefined | null): href is string {
  if (!href) return false;
  if (href.startsWith('//'))
return false;
  if (href.startsWith('#')) return false;
  return href.startsWith('/') || href.startsWith('.');
}
