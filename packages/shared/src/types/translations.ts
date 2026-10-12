/**
 * Translatable content, shared by the admin UI and the API.
 *
 * These interfaces used to live in backend schema files, which meant the frontend could not
 * import them and re-declared product translations by hand — so the two drifted. They are here
 * now, and the backend schema imports from this file.
 */
import type { PageLayout } from './page';

// Course, series and lesson translations already live in `types/lesson.ts`; re-exported so this
// module is the one place an importer needs for entity translation shapes.
export type {
  ContentLocale,
  LocalizedContent,
  CourseContentTranslation,
  SeriesContentTranslation,
  LessonContentTranslation,
} from './lesson';

/** A single labelled point on a product image. */
export interface HotspotTranslation {
  label?: string;
  tooltip?: string;
  detail?: string;
}

export interface ProductContentTranslation {
  title?: string;
  tagline?: string | null;
  description?: string | null;
  features?: string[] | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  /**
   * Arabic copy for the image hotspots.
   *
   * Indexed by hotspot id so a translated label survives the hotspot being moved or a new one
   * added — a positional array would silently reattach Spanish text to a different pin.
   */
  hotspots?: Record<string, HotspotTranslation> | null;
}

export interface AcademyContentTranslation {
  title?: string;
  /**
   * `academies.subtitle` is a column and an editable field, but the translation interface had
   * no slot for it, so Arabic subtitles had nowhere to live.
   */
  subtitle?: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface EventContentTranslation {
  title?: string;
  description?: string | null;
  location?: string | null;
}

/**
 * A whole page in one language.
 *
 * The page builder stores an entire alternate layout per locale rather than per-block
 * translations, so the AI pass produces a second tree. This is a deliberate trade: it reuses the
 * existing read path untouched, at the cost of no field-level merge against the English page.
 */
export interface PageTranslation {
  title?: string;
  layout?: PageLayout;
}

/**
 * One translatable field, described once so every surface computes coverage identically.
 *
 * `path` is a dot path into the English source object; the Arabic counterpart is the same path
 * under `translations[locale]`. Descriptors are data rather than code so adding a field to an
 * entity cannot leave its coverage bar stale.
 */
export interface TranslatableField {
  /** Human label, used as the key sent to the model and shown in review. */
  label: string;
  /** Dot path into the English object, e.g. `title` or `cta.primary.label`. */
  path: string;
  /**
   * `text` is a plain string. `list` is a newline-separated field (bullet points) whose Arabic
   * value is a string array. `string[]` fields are translated as one block so the bullets keep
   * their order and count.
   */
  kind?: 'text' | 'list';
}

export interface TranslationCoverage {
  total: number;
  translated: number;
  /** Labels still empty in the target locale. */
  missing: string[];
  /** Labels that have Arabic copy present. */
  present: string[];
}

export function readPath(source: unknown, path: string): string {
  let current: unknown = source;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current === 'string') return current;
  // Array-valued fields arrive as lists and are joined for transport.
  if (Array.isArray(current)) return current.filter((v) => typeof v === 'string').join('\n');
  return '';
}

export function writePath(target: Record<string, unknown>, path: string, value: string, kind: 'text' | 'list' = 'text'): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i]!;
    const next = current[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1]!;
  if (kind === 'list') {
    current[last] = value.split('\n').map((line) => line.trim()).filter(Boolean);
  } else {
    current[last] = value.trim() || null;
  }
}

/**
 * How much of an entity is translated.
 *
 * A field counts as translated only when the English side has content AND the Arabic side has
 * content. Empty-in-both is not "missing" — there is simply nothing to translate yet.
 */
export function coverageOf(
  source: unknown,
  translated: Record<string, unknown> | null | undefined,
  fields: TranslatableField[],
): TranslationCoverage {
  const missing: string[] = [];
  const present: string[] = [];
  for (const field of fields) {
    const english = readPath(source, field.path).trim();
    if (!english) continue;
    const arabic = readPath(translated ?? {}, field.path).trim();
    if (arabic) present.push(field.label);
    else missing.push(field.label);
  }
  return { total: present.length + missing.length, translated: present.length, missing, present };
}

/** `fields` map for the translate endpoint: label -> English text, skipping empties. */
export function buildFieldMap(source: unknown, fields: TranslatableField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const field of fields) {
    const value = readPath(source, field.path);
    if (value.trim()) map[field.label] = value;
  }
  return map;
}
