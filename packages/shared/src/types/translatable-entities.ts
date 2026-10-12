/**
 * Which fields each entity exposes to translation, in one place.
 *
 * Adding a translatable field to an entity means adding it here as well, and the coverage bar,
 * the "translate missing" action and the review list all read from this — so they cannot disagree
 * about what is missing.
 */
import type { TranslatableField } from './translations';

export const COURSE_BASICS_FIELDS: TranslatableField[] = [
  { label: 'Title', path: 'title' },
  { label: 'Subtitle', path: 'subtitle' },
  { label: 'Description', path: 'description' },
];

/** Basics plus SEO — what the course studio shows when one panel is selected. */
export const COURSE_FIELDS: TranslatableField[] = [
  ...COURSE_BASICS_FIELDS,
  { label: 'SEO title', path: 'seoTitle' },
  { label: 'SEO description', path: 'seoDescription' },
];

export const COURSE_SEO_FIELDS: TranslatableField[] = [
  { label: 'SEO title', path: 'seoTitle' },
  { label: 'SEO description', path: 'seoDescription' },
  { label: 'SEO keywords', path: 'seoKeywords' },
];

export const SERIES_FIELDS: TranslatableField[] = [{ label: 'Section title', path: 'title' }];

export const LESSON_FIELDS: TranslatableField[] = [
  { label: 'Title', path: 'title' },
  { label: 'Description', path: 'description' },
];

export const PRODUCT_FIELDS: TranslatableField[] = [
  { label: 'Title', path: 'title' },
  { label: 'Tagline', path: 'tagline' },
  { label: 'Description', path: 'description' },
  // Sent as one block so bullets keep their order and count.
  { label: 'Bullet points', path: 'features', kind: 'list' },
  { label: 'SEO title', path: 'seoTitle' },
  { label: 'SEO description', path: 'seoDescription' },
];

export const ACADEMY_FIELDS: TranslatableField[] = [
  { label: 'Title', path: 'title' },
  { label: 'Subtitle', path: 'subtitle' },
  { label: 'Description', path: 'description' },
  { label: 'SEO title', path: 'seoTitle' },
  { label: 'SEO description', path: 'seoDescription' },
];

export const EVENT_FIELDS: TranslatableField[] = [
  { label: 'Title', path: 'title' },
  { label: 'Description', path: 'description' },
  { label: 'Location', path: 'location' },
];

/**
 * Hotspots are keyed by id rather than position.
 *
 * A positional array reattaches translated text to whatever pin happens to sit at that index after
 * a reorder, which is worse than having no translation at all.
 */
export const HOTSPOT_FIELDS: TranslatableField[] = [
  { label: 'Label', path: 'label' },
  { label: 'Tooltip', path: 'tooltip' },
  { label: 'Detail', path: 'detail' },
];
