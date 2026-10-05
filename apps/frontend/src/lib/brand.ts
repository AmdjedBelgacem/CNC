/**
 * Single source of truth for public identity.
 *
 * Everything indexable — titles, Open Graph, JSON-LD, sitemap, robots, canonical URLs —
 * reads from here. The brand strings used to be hardcoded per page, which is how the
 * public surface ended up advertising three different organisations at once
 * ("Machinist Pro" in <title>, "TITANS of Manufacturing" in Open Graph and most page
 * titles, "Ahmad CNC" in the Organization schema, and "Baroot CNC Solutions" in the
 * logo/on-page copy). Search and answer engines resolve an entity by consistent naming,
 * so that split is not cosmetic: it made the site look like four unrelated sites.
 *
 * `Baroot CNC Solutions` is the canonical public brand. Any product sub-brand must be
 * expressed as a child of it (`PARENT_ORG`), never as a sibling replacement.
 */

/** Canonical public brand name. */
export const BRAND_NAME = 'Baroot CNC Solutions';

/** Short form for tight spaces (nav, badges). */
export const BRAND_SHORT = 'Baroot CNC';

/**
 * Legal/footer identity. Kept separate from BRAND_NAME so a future registered-entity
 * rename touches one line instead of every template.
 */
export const BRAND_LEGAL = 'Baroot CNC Solutions';

/** Parent entity for any product sub-brand in schema. */
export const PARENT_ORG = {
  '@type': 'Organization',
  name: BRAND_NAME,
} as const;

/**
 * The public origin. One env var, one fallback, used for canonical URLs, Open Graph
 * URLs, the sitemap and robots.
 *
 * Two things this has to get right, both learned the hard way. It used to be hardcoded to
 * `https://titansofmanufacturing.com`, which meant the homepage canonicalised to an origin
 * that was not the one serving it. And because `NEXT_PUBLIC_*` values are *inlined at build
 * time*, a build made on a laptop picks up that machine's `.env.local` — so a local
 * `NEXT_PUBLIC_SITE_URL=http://localhost:3000` gets frozen into production HTML and every
 * canonical points at localhost. Hence the localhost guard below.
 *
 * Order: explicit runtime override, then Vercel's runtime values (never inlined, so they
 * cannot be stale), then the build-time public var, then a last-resort literal.
 */
function isLocalOrigin(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '::1' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
  );
}

function resolveSiteUrl(): string {
  const candidates: (string | undefined)[] = [
    // Runtime-only: cannot be inlined, so it always reflects the running deployment.
    process.env.SITE_URL_OVERRIDE,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    // Build-time inlined; correct only if the build ran with the right environment.
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  const production = process.env.NODE_ENV === 'production';
  let localFallback: string | null = null;

  for (const candidate of candidates) {
    if (!candidate) continue;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }
    // A localhost origin is legitimate in `next dev` and useless anywhere else. Keep it as
    // a last resort so local dev keeps working, but never let it win a production build.
    if (isLocalOrigin(parsed)) {
      localFallback ??= parsed.origin;
      continue;
    }
    return parsed.origin;
  }

  if (!production && localFallback) return localFallback;
  return 'https://frontend-ten-lilac-zvt9j29r04.vercel.app';
}

/** Public origin, no trailing slash. */
export const SITE_URL = resolveSiteUrl();

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Default social share image. */
export const OG_IMAGE = {
  url: absoluteUrl('/opengraph-image'),
  width: 1200,
  height: 630,
  alt: `${BRAND_NAME} — precision manufacturing education`,
};

/**
 * Organization node for JSON-LD. `sameAs` is what lets a search engine bind this site to
 * an existing entity profile, so it must stay populated as profiles are added.
 */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    legalName: BRAND_LEGAL,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/icon.svg'),
      width: 512,
      height: 512,
    },
    image: absoluteUrl('/opengraph-image'),
    description:
      'Baroot CNC Solutions provides CNC machining education, technical resources and industry-recognised certification for machinists, engineers and manufacturing teams.',
    sameAs: ['https://www.linkedin.com/company/baroot-cnc-solutions'],
  };
}

/** WebSite node, binding the site to the Organization via `@id`. */
export function webSiteJsonLd(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: BRAND_NAME,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en',
  };
}
