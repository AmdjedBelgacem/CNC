/**
 * Finding and rewriting the translatable strings inside a lesson's block tree.
 *
 * Blocks are authored content whose shape varies by type and changes whenever a block type gains
 * a field. Enumerating fields per block type would silently skip anything added later, so this
 * walks the content JSON and collects strings by key name instead — a new block type is translated
 * on arrival with no change here.
 */
import type { LessonBlock, LessonBlockContent } from './types/lesson';

/** Keys whose string values are author-written prose. */
const TRANSLATABLE_KEYS = new Set([
  'label',
  'text',
  'title',
  'caption',
  'alt',
  'prompt',
  'detail',
  'tooltip',
  'question',
  'heading',
  'body',
  'description',
  'placeholder',
  'summary',
  'content',
  'name',
]);

/** Keys that are ids, urls, types or numbers and must never be sent to a model. */
const OPAQUE_KEYS = new Set([
  'id',
  'slug',
  'src',
  'url',
  'videoUrl',
  'posterUrl',
  'captionsUrl',
  'storageKey',
  'source',
  'type',
  'sortOrder',
  'points',
  'correct',
  'isCorrect',
  'requiredToContinue',
  'maxAttempts',
  'passingScore',
  'x',
  'y',
  'width',
  'height',
  'html',
]);

/** A string found in the tree, with the path needed to write it back. */
export interface HarvestedField {
  /** Unique within a lesson; used as the label sent to the model. */
  key: string;
  path: string;
  value: string;
  /** True when `value` is joined HTML text segments. */
  isHtml?: boolean;
}

export interface HarvestOptions {
  /** Include `alt` text. Off by default: alt is usually a short accessibility hint, not prose. */
  includeAlt?: boolean;
}

function shouldTranslate(key: string, value: unknown, options: HarvestOptions): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (OPAQUE_KEYS.has(key)) return false;
  if (key === 'alt' && !options.includeAlt) return false;
  return TRANSLATABLE_KEYS.has(key);
}

/**
 * One HTML text node, split into the part a model sees and the whitespace around it.
 *
 * The padding is kept because `<b>Hello</b> <i>world</i>` has a meaningful space between two tags
 * that is not part of either word. Dropping it glues Arabic words onto their neighbours, so the
 * padding is held aside and restored around the translated text.
 */
export interface HtmlSegment {
  /** Trimmed text sent to the model. */
  text: string;
  prefix: string;
  suffix: string;
}

/**
 * Split HTML into tags and padded text segments.
 *
 * Tags are held aside and the text is joined with newlines, so the model sees prose rather than
 * markup and the tags are restored by index afterwards — translated output can therefore never
 * break a block's markup, however the model reformats the text.
 */
export function splitHtml(html: string): { segments: HtmlSegment[]; tags: string[] } {
  const segments: HtmlSegment[] = [];
  const tags: string[] = [];
  const pattern = /(<[^>]+>)|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    if (match[1] !== undefined) {
      tags.push(match[1]);
      continue;
    }
    const raw = match[2]!;
    const text = raw.trim();
    // Whitespace between two tags is kept as a segment with no text of its own — dropping it
    // would glue the words on either side of the tag together once translated.
    // Measure the suffix from the end of the text, not from the start of the trimmed string, so a
    // whitespace-only run is not counted as padding twice and doubled when written back.
    const leading = raw.length - raw.trimStart().length;
    segments.push({
      text,
      prefix: raw.slice(0, leading),
      suffix: raw.slice(leading + text.length),
    });
    tags.push('');
  }
  return { segments, tags };
}

/**
 * The text-only view of a split, i.e. exactly what should be sent to a model.
 *
 * `segments` here must line up with `joinHtml`'s first argument, which is indexed by text-bearing
 * segment only — passing the full `HtmlSegment[]` instead would shift every translation by one
 * slot per whitespace gap. Use this helper rather than `segments.map(s => s.text)`.
 */
export function htmlTexts(segments: HtmlSegment[]): string[] {
  return segments.filter((segment) => segment.text.length > 0).map((segment) => segment.text);
}

export function joinHtml(segments: string[], tags: string[], padding?: HtmlSegment[]): string {
  let out = '';
  // `segmentIndex` walks `padding`, which advances only on text slots — tag entries in `tags` do
  // not consume a segment. `textIndex` walks the model output, which skips whitespace-only gaps.
  let segmentIndex = 0;
  let textIndex = 0;
  for (const tag of tags) {
    if (tag) {
      out += tag;
      continue;
    }
    const pad = padding?.[segmentIndex];
    if (pad && pad.text.length === 0) {
      // Whitespace-only gap: restore it verbatim, it carries no meaning of its own.
      out += `${pad.prefix}${pad.suffix}`;
      segmentIndex += 1;
      continue;
    }
    // Fall back to the original text when the model returned nothing, so a partial translation
    // cannot silently delete part of a paragraph.
    out += pad
      ? `${pad.prefix}${segments[textIndex] ?? pad.text}${pad.suffix}`
      : (segments[textIndex] ?? '');
    textIndex += 1;
    segmentIndex += 1;
  }
  return out;
}

function walk(
  node: unknown,
  basePath: string,
  fields: HarvestedField[],
  options: HarvestOptions,
): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${basePath}.${index}`, fields, options));
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = basePath ? `${basePath}.${key}` : key;
    if (key === 'html' && typeof value === 'string' && value.trim()) {
      const { segments } = splitHtml(value);
      const withText = segments.filter((segment) => segment.text.length > 0);
      if (withText.length > 0) {
        fields.push({ key: path, path, value: withText.map((segment) => segment.text).join('\n'), isHtml: true });
      }
      continue;
    }
    if (shouldTranslate(key, value, options)) {
      fields.push({ key: path, path, value: value as string });
      continue;
    }
    if (value && typeof value === 'object') walk(value, path, fields, options);
  }
}

/** Every translatable string in one block's content, with write-back paths. */
export function harvestBlock(block: LessonBlock, options: HarvestOptions = {}): HarvestedField[] {
  const fields: HarvestedField[] = [];
  const content = (block.content ?? {}) as Record<string, unknown>;
  walk(content, '', fields, options);
  return fields;
}

/** Every translatable string across a lesson's blocks. */
export function harvestLessonBlocks(
  blocks: LessonBlock[] | null | undefined,
  options: HarvestOptions = {},
): HarvestedField[] {
  const fields: HarvestedField[] = [];
  for (const block of blocks ?? []) {
    for (const field of harvestBlock(block, options)) {
      // Prefix with the block id so two blocks with the same field path stay distinct.
      fields.push({ ...field, key: `${block.id}:${field.key}` });
    }
  }
  return fields;
}

/** Label -> English text for the translate endpoint, skipping empties. */
export function toFieldMap(fields: HarvestedField[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const field of fields) if (field.value.trim()) map[field.key] = field.value;
  return map;
}

/**
 * Write translated text back into a block's content.
 *
 * Returns a new content object; the input is not mutated. Values are dropped rather than set to
 * empty when the model returned nothing, so a partial result never erases existing Arabic copy.
 */
export function applyBlockTranslations(
  content: LessonBlockContent,
  fields: HarvestedField[],
  translations: Record<string, string>,
): LessonBlockContent {
  const next = structuredClone(content) as unknown as Record<string, unknown>;

  const setAt = (path: string, value: string) => {
    const keys = path.split('.');
    let current: Record<string, unknown> = next;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const step = keys[i]!;
      const nextStep = current[step];
      if (!nextStep || typeof nextStep !== 'object') return;
      current = nextStep as Record<string, unknown>;
    }
    const last = keys[keys.length - 1]!;
    if (last in current) current[last] = value;
  };

  for (const field of fields) {
    const translated = translations[field.key];
    if (!translated || !translated.trim()) continue;
    if (field.isHtml) {
      const original = readAt(next, field.path);
      if (typeof original !== 'string') continue;
      const { segments, tags } = splitHtml(original);
      // Ordered like `htmlTexts`, so slot i is the i-th visible run of text.
      const incoming = translated
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      setAt(field.path, joinHtml(incoming, tags, segments));
      continue;
    }
    setAt(field.path, translated.trim());
  }
  return next as unknown as LessonBlockContent;
}

function readAt(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
