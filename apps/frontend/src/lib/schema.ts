import { BRAND_NAME, SITE_URL, absoluteUrl } from './brand';

/**
 * schema.org builders.
 *
 * The site previously shipped exactly one JSON-LD block (an Organization on the homepage),
 * so course pages advertised themselves with no structured data at all. These builders keep
 * the node shapes in one place so every page emits the same `@id` graph and can be linked
 * rather than duplicated.
 *
 * Always serialise the result with `serializeJsonLd` from `lib/json-ld` — course titles and
 * descriptions are user-authored and would otherwise be able to close the script tag.
 */

type Loose = Record<string, unknown>;

/** Accepts typed API models as well as plain records. */
export type SchemaInput = object;

function text(input: unknown, max = 3000): string {
  if (typeof input !== 'string') return '';
  const stripped = input
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > max ? `${stripped.slice(0, max - 1)}…` : stripped;
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** Recursively attach the parent Organization so every node resolves to one entity. */
function withProvider<T extends Loose>(node: T): T & Loose {
  return { ...node, provider: { '@id': `${SITE_URL}/#organization` } };
}

/** Course node for a course detail page. */
export function courseJsonLd(input: SchemaInput): Record<string, unknown> {
  const course = input as Loose;
  const slug = String(course.slug ?? '');
  const lessons = Array.isArray(course.lessons) ? course.lessons.length : undefined;
  const series = Array.isArray(course.series)
    ? course.series.reduce((sum: number, entry: Loose) => sum + ((entry.lessons as unknown[])?.length ?? 0), 0)
    : undefined;

  const node: Loose = {
    '@type': 'Course',
    '@id': `${SITE_URL}/courses/${slug}#course`,
    name: text(course.title, 200) || 'Untitled course',
    url: absoluteUrl(`/courses/${slug}`),
    inLanguage: 'en',
  };

  const description = text(course.description) || text(course.subtitle);
  if (description) node.description = description;

  // Course has no `image` in the spec's required list but Google renders it as a rich
  // result, so include it whenever the course actually has artwork.
  const thumbnail = course.thumbnailUrl;
  if (typeof thumbnail === 'string' && thumbnail) {
    node.image = absoluteUrl(thumbnail.startsWith('http') ? thumbnail : thumbnail);
  }

  if (typeof course.priceCents === 'number') {
    const free = course.priceCents === 0;
    node.offers = {
      '@type': 'Offer',
      price: free ? '0' : (course.priceCents / 100).toFixed(2),
      priceCurrency: String(course.currency ?? 'SAR'),
      // Free courses must say Free, not 0 — Google treats "0" as a price, not free.
      availability: 'https://schema.org/InStock',
      category: free ? 'Free' : 'Paid',
      url: absoluteUrl(`/courses/${slug}`),
    };
  }

  const level = Number(course.difficulty ?? 0);
  if (level >= 1) {
    node.educationalLevel = level <= 1 ? 'Beginner' : level <= 3 ? 'Intermediate' : 'Advanced';
  }
  if (typeof course.estimatedHours === 'number' && course.estimatedHours > 0) {
    node.timeRequired = `PT${course.estimatedHours}H`;
  }

  const totalLessons = lessons ?? series;
  if (typeof totalLessons === 'number' && totalLessons > 0) {
    node.hasCourseInstance = {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: `PT${Math.max(1, Math.round((course.estimatedHours as number) || totalLessons))}H`,
    };
  }

  const published = isoDate(course.publishedAt) ?? isoDate(course.createdAt);
  if (published) node.datePublished = published;
  const modified = isoDate(course.updatedAt);
  if (modified) node.dateModified = modified;

  const instructor = course.instructor as Loose | undefined;
  if (instructor && typeof instructor === 'object') {
    node.instructor = { '@type': 'Person', name: text(instructor.name, 120) };
  } else if (typeof course.instructorName === 'string' && course.instructorName) {
    node.instructor = { '@type': 'Person', name: course.instructorName };
  } else {
    // No named instructor is a real gap, but an unattributed course is still better
    // attributed to the organisation than to nobody.
    node.instructor = { '@id': `${SITE_URL}/#organization` };
  }

  return withProvider(node);
}

/** Product node for a product page. */
export function productJsonLd(input: SchemaInput): Record<string, unknown> {
  const product = input as Loose;
  const slug = String(product.slug ?? '');
  const node: Loose = {
    '@type': 'Product',
    '@id': `${SITE_URL}/products/${slug}#product`,
    name: text(product.title ?? product.name, 200) || 'Untitled product',
    url: absoluteUrl(`/products/${slug}`),
  };
  const description = text(product.description);
  if (description) node.description = description;
  if (typeof product.brand === 'string' && product.brand) {
    node.brand = { '@type': 'Brand', name: product.brand };
  } else {
    node.brand = { '@id': `${SITE_URL}/#organization` };
  }
  if (typeof product.priceCents === 'number') {
    node.offers = {
      '@type': 'Offer',
      price: (product.priceCents / 100).toFixed(2),
      priceCurrency: String(product.currency ?? 'SAR'),
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(`/products/${slug}`),
    };
  }
  const modified = isoDate(product.updatedAt);
  if (modified) node.dateModified = modified;
  return withProvider(node);
}

/**
 * FAQPage node.
 *
 * `items` must be question/answer pairs. Google only surfaces FAQ rich results for
 * authoritative health/government sites, but the markup still helps answer engines extract
 * a clean Q→A pair, which is the actual goal here.
 */
export function faqJsonLd(items: { question: string; answer: string }[]): Record<string, unknown> {
  const usable = items
    .map((item) => ({ question: text(item.question, 200), answer: text(item.answer, 1200) }))
    .filter((item) => item.question && item.answer);
  if (usable.length === 0) return {};
  return {
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/#faq`,
    mainEntity: usable.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** BreadcrumbList from an ordered path. */
export function breadcrumbJsonLd(
  crumbs: { name: string; path: string }[],
): Record<string, unknown> {
  const usable = crumbs.filter((crumb) => crumb.name);
  return {
    '@type': 'BreadcrumbList',
    '@id': `${SITE_URL}/#breadcrumb`,
    itemListElement: usable.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** LocalBusiness / Organization hybrid for the About page (who/what/where). */
export function aboutJsonLd(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: BRAND_NAME,
    url: SITE_URL,
    description: `${BRAND_NAME} provides CNC machining education, simulation-first training and industry-recognised certification for manufacturing professionals.`,
    sameAs: ['https://www.linkedin.com/company/baroot-cnc-solutions'],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        availableLanguage: ['en', 'ar'],
        url: absoluteUrl('/about'),
      },
    ],
  };
}
