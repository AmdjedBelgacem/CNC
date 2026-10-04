import { BadRequestException } from '@nestjs/common';
import {
  courseTranslationsSchema,
  lessonContentDocumentSchema,
  lessonTranslationsSchema,
  seriesTranslationsSchema,
  type ContentLocale,
  type CourseContentTranslation,
  type LessonBlock,
  type LessonContentDocument,
  type LessonLocaleMetadata,
  type SeriesContentTranslation,
  type LessonContentTranslation,
  type QuizQuestionResult,
} from '@titan/shared';

export type CourseTranslationMap = Partial<Record<ContentLocale, CourseContentTranslation>>;
export type SeriesTranslationMap = Partial<Record<ContentLocale, SeriesContentTranslation>>;
export type LessonTranslationMap = Partial<Record<ContentLocale, LessonContentTranslation>>;
export type LessonBlockTranslationMap = Partial<Record<ContentLocale, Record<string, unknown>>>;

export interface LocaleCarrier {
  headers?: Record<string, unknown>;
  cookies?: Record<string, unknown>;
  query?: Record<string, unknown>;
  locale?: unknown;
}

export interface LocalizedFields<T extends Record<string, unknown>> {
  value: T;
  metadata: LessonLocaleMetadata;
}

export interface SafeBlockTextOptions {
  includeQuizPrompts?: boolean;
  includeGated?: boolean;
  includeTranslations?: boolean;
}

const LOCALES: ContentLocale[] = ['en', 'ar'];
const FALLBACK_LOCALE: ContentLocale = 'en';
const SENSITIVE_KEY = /^(?:correctOptionIds|correct_option_ids|explanation|answer|answers|solution|rationale|password|secret|token|credential)$/i;
const SAFE_TEXT_KEY = /^(?:text|title|heading|subtitle|description|content|body|html|label|value|caption|note|quote|kicker|eyebrow|alt|tooltip|detail|transcript|prompt|name)$/i;

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function localeValue(value: unknown): ContentLocale | null {
  const normalized = String(value ?? '').trim().toLowerCase().replace('_', '-').split('-')[0];
  return normalized === 'ar' ? 'ar' : normalized === 'en' ? 'en' : null;
}

function headerValue(headers: Record<string, unknown> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value = found?.[1];
  if (Array.isArray(value)) return value.length ? String(value[0]) : undefined;
  return value === undefined || value === null ? undefined : String(value);
}

function cookieValue(carrier: LocaleCarrier): string | undefined {
  const cookies = carrier.cookies ?? {};
  const direct = cookies.NEXT_LOCALE ?? cookies.next_locale;
  if (direct !== undefined && direct !== null) return String(direct);
  const cookieHeader = headerValue(carrier.headers, 'cookie');
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === 'NEXT_LOCALE' && rest.length) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return rest.join('=');
      }
    }
  }
  return undefined;
}

function acceptLanguageLocale(value: string | undefined): ContentLocale | null {
  if (!value) return null;
  const choices = value.split(',').map((item, index) => {
    const [language, ...parameters] = item.trim().split(';');
    const qualityParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith('q='));
    const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
    return { language: (language ?? '').trim(), quality: Number.isFinite(quality) ? quality : 0, index };
  }).filter((item) => item.quality > 0 && item.language !== '*');
  choices.sort((left, right) => right.quality - left.quality || left.index - right.index);
  for (const choice of choices) {
    const parsed = localeValue(choice.language);
    if (parsed) return parsed;
  }
  return null;
}

export function resolveContentLocale(input?: unknown): ContentLocale {
  if (typeof input === 'string') {
    const direct = localeValue(input);
    if (direct) return direct;
  }
  const carrier: LocaleCarrier = isRecord(input) ? input as LocaleCarrier : {};
  // Precedence is "most specific to least specific": what this request asked for
  // beats what the browser suggests, which beats a server-wide default. Reading
  // NEXT_LOCALE off the environment before the request would let a deploy-time
  // value silently override the visitor.
  const headerLocale = localeValue(headerValue(carrier.headers, 'x-locale'));
  if (headerLocale) return headerLocale;
  const nextLocale = localeValue(cookieValue(carrier));
  if (nextLocale) return nextLocale;
  // `?locale=ar` is the explicit form: it beats a cookie, because a link can
  // carry a language without changing the visitor's saved preference.
  const fromQuery = localeValue(
    (carrier.query as Record<string, unknown> | undefined)?.locale ??
      (carrier.query as Record<string, unknown> | undefined)?.lang,
  );
  if (fromQuery) return fromQuery;
  const explicit = localeValue(carrier.locale);
  if (explicit) return explicit;
  const accepted = acceptLanguageLocale(headerValue(carrier.headers, 'accept-language'));
  if (accepted) return accepted;
  return localeValue(process.env.NEXT_LOCALE) ?? FALLBACK_LOCALE;
}

function translationLocales(value: unknown): ContentLocale[] {
  const locales = new Set<ContentLocale>([FALLBACK_LOCALE]);
  if (isRecord(value)) {
    for (const locale of LOCALES) {
      const translation = value[locale];
      if (isRecord(translation) && Object.keys(translation).length > 0) locales.add(locale);
    }
  }
  return LOCALES.filter((locale) => locales.has(locale));
}

function translationField(value: unknown, locale: ContentLocale, field: string): unknown {
  if (!isRecord(value)) return undefined;
  const localeValue = value[locale];
  if (!isRecord(localeValue)) return undefined;
  return localeValue[field];
}

function localizedValue<T extends Record<string, any>>(
  base: T,
  translations: unknown,
  locale: ContentLocale,
  fields: string[],
): LocalizedFields<T> {
  const availableLocales = translationLocales(translations);
  const translatedFields = new Set<string>();
  const output = { ...base } as T;
  for (const field of fields) {
    const candidate = translationField(translations, locale, field);
    if (candidate !== undefined && candidate !== null) {
      (output as Record<string, unknown>)[field] = candidate;
      if (locale !== FALLBACK_LOCALE) translatedFields.add(field);
    }
  }
  const fallbackFields = locale === FALLBACK_LOCALE
    ? []
    : fields.filter((field) => !translatedFields.has(field) && output[field] !== undefined && output[field] !== null);
  const resolvedLocale = locale === FALLBACK_LOCALE || translatedFields.size > 0 ? locale : FALLBACK_LOCALE;
  return {
    value: output,
    metadata: {
      locale,
      resolvedLocale,
      availableLocales,
      fallbackFields,
    },
  };
}

/**
 * Academies, products and events carry the same `translations` shape.
 *
 * The list of fields is deliberately limited to prose. A price, a capacity, a
 * start date and a coordinate are data: translating them would change what a
 * customer is charged or when they turn up.
 */
export function localizeAcademyFields(
  academy: Record<string, any>,
  locale: ContentLocale,
): LocalizedFields<Record<string, any>> {
  return localizedValue(academy, academy.translations, locale, ['title', 'description', 'seoTitle', 'seoDescription']);
}

export function localizeProductFields(
  product: Record<string, any>,
  locale: ContentLocale,
): LocalizedFields<Record<string, any>> {
  return localizedValue(product, product.translations, locale, ['title', 'tagline', 'description', 'features']);
}

export function localizeEventFields(
  event: Record<string, any>,
  locale: ContentLocale,
): LocalizedFields<Record<string, any>> {
  // `location` is deliberately NOT localized: the column holds
  // `{ lat, lng, city, venue }` and replacing it with a display string would break
  // every map, distance and timezone calculation downstream. The human-readable
  // venue name lives in `locationLabel`, which is additive.
  const localized = localizedValue(event, event.translations, locale, ['title', 'description']);
  const label = (event.translations as Record<string, any> | undefined)?.[locale === 'en' ? 'en' : 'ar']?.location;
  return {
    ...localized,
    value: { ...localized.value, locationLabel: typeof label === 'string' ? label : null },
  };
}

export function localizeCourseFields(
  course: Record<string, any>,
  locale: ContentLocale,
): LocalizedFields<Record<string, any>> {
  return localizedValue(course, course.translations, locale, ['title', 'subtitle', 'description', 'seoTitle', 'seoDescription', 'seoKeywords']);
}

export function localizeSeriesFields(
  item: Record<string, any>,
  locale: ContentLocale,
): LocalizedFields<Record<string, any>> {
  return localizedValue(item, item.translations, locale, ['title', 'description']);
}

export function localizeLessonFields(
  lesson: Record<string, any>,
  locale: ContentLocale,
): LocalizedFields<Record<string, any>> {
  const translations = isRecord(lesson.translations) ? { ...lesson.translations } : {};
  const document = isRecord(lesson.contentBlocks) && Array.isArray(lesson.contentBlocks.blocks) ? lesson.contentBlocks : null;
  for (const block of document?.blocks ?? []) {
    if (!isRecord(block) || !isRecord(block.translations)) continue;
    for (const candidateLocale of LOCALES) {
      if (isRecord(block.translations[candidateLocale]) && Object.keys(block.translations[candidateLocale]).length > 0) {
        translations[candidateLocale] = { ...(isRecord(translations[candidateLocale]) ? translations[candidateLocale] : {}) };
      }
    }
  }
  const localized = localizedValue(lesson, translations, locale, ['title', 'description']);
  if (locale !== FALLBACK_LOCALE && localized.metadata.resolvedLocale === FALLBACK_LOCALE) {
    const hasLocalizedBlock = isRecord(translations[locale]) && Object.keys(translations[locale]).length > 0;
    if (hasLocalizedBlock) localized.metadata.resolvedLocale = locale;
  }
  return localized;
}

function mergeContentValue(baseValue: unknown, translatedValue: unknown): unknown {
  if (translatedValue === undefined || translatedValue === null) return baseValue;
  if (Array.isArray(baseValue) && Array.isArray(translatedValue)) {
    if (!baseValue.every((item) => isRecord(item)) || !translatedValue.every((item) => isRecord(item))) return translatedValue;
    return translatedValue.map((item, index) => {
      const translatedId = item.id;
      const baseItem = translatedId === undefined
        ? baseValue[index]
        : baseValue.find((candidate) => isRecord(candidate) && candidate.id === translatedId);
      return mergeContentValue(baseItem, item);
    });
  }
  if (isRecord(baseValue) && isRecord(translatedValue)) {
    const output = { ...baseValue };
    for (const [key, value] of Object.entries(translatedValue)) {
      output[key] = mergeContentValue(baseValue[key], value);
    }
    return output;
  }
  return translatedValue;
}

function localizedBlockContent(block: LessonBlock, locale: ContentLocale): Record<string, unknown> {
  const base = isRecord(block.content) ? block.content : {};
  const translations = block.translations;
  const translated = isRecord(translations) && isRecord(translations[locale]) ? translations[locale] : undefined;
  return mergeContentValue(base, translated) as Record<string, unknown>;
}

function blockIsGated(block: Partial<LessonBlock> & Record<string, any>): boolean {
  const content = isRecord(block.content) ? block.content as Record<string, any> : {};
  return block.gated === true
    || block.isGated === true
    || content.gated === true
    || content.isGated === true
    || content.requiresEnrollment === true
    || content.isPublic === false
    || content.access === 'gated'
    || content.visibility === 'gated';
}

export function isGatedLessonBlock(block: Partial<LessonBlock> & Record<string, any>): boolean {
  return blockIsGated(block);
}

function isUploadedMediaRef(value: unknown): value is string {
  return typeof value === 'string' && /^(?:tenants\/|uploads\/|\/uploads\/|\/images\/)[A-Za-z0-9._/-]+$/.test(value);
}

function stripExternalMedia(content: Record<string, unknown>): Record<string, unknown> {
  const safe = { ...content };
  for (const field of ['source', 'storageKey', 'posterUrl', 'captionsUrl', 'src']) {
    if (safe[field] !== undefined && !isUploadedMediaRef(safe[field])) delete safe[field];
  }
  if (Array.isArray(safe.images)) {
    safe.images = safe.images.filter((image) => isRecord(image) && isUploadedMediaRef(image.src));
  }
  if (typeof safe.html === 'string' && /(?:src|href)\s*=\s*["'](?:https?:|\/\/|data:|javascript:)/i.test(safe.html)) {
    delete safe.html;
  }
  return safe;
}

function publicBlock(block: LessonBlock, locale: ContentLocale): LessonBlock {
  const content = stripExternalMedia(localizedBlockContent(block, locale));
  if (block.type === 'video') {
    const safeVideo = { ...content };
    for (const key of ['source', 'storageKey']) {
      const value = safeVideo[key];
      if (typeof value === 'string' && value.startsWith('tenants/')) delete safeVideo[key];
    }
    return {
      id: block.id,
      type: block.type,
      sortOrder: block.sortOrder,
      content: safeVideo,
    };
  }
  if (block.type === 'quiz') {
    const questions = Array.isArray(content.questions) ? content.questions : [];
    return {
      id: block.id,
      type: block.type,
      sortOrder: block.sortOrder,
      content: {
        passingScore: Number(content.passingScore ?? 0),
        requiredToContinue: Boolean(content.requiredToContinue),
        ...(content.maxAttempts === null || content.maxAttempts === undefined ? {} : { maxAttempts: Number(content.maxAttempts) }),
        questions: questions.map((question) => {
          if (!isRecord(question)) return question;
          const safeQuestion: Record<string, unknown> = {
            id: String(question.id ?? ''),
            type: question.type,
            prompt: String(question.prompt ?? ''),
            options: Array.isArray(question.options) ? question.options.map((option) => ({
              id: String(isRecord(option) ? option.id ?? '' : ''),
              label: String(isRecord(option) ? option.label ?? '' : ''),
            })) : [],
            points: Number(question.points ?? 1),
          };
          return safeQuestion;
        }),
      },
    };
  }
  return {
    id: block.id,
    type: block.type,
    sortOrder: block.sortOrder,
    content,
  };
}

export function localizeLessonDocument(
  document: LessonContentDocument,
  locale: ContentLocale,
  options: { public?: boolean; canAccess?: boolean } = {},
): LessonContentDocument {
  const publicMode = options.public ?? false;
  const canAccess = options.canAccess ?? true;
  const blocks = (document.blocks ?? [])
    .filter((block) => canAccess || !blockIsGated(block))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((block) => publicMode ? publicBlock(block, locale) : {
      id: block.id,
      type: block.type,
      sortOrder: block.sortOrder,
      content: localizedBlockContent(block, locale),
    });
  return { schemaVersion: 1, blocks };
}

function validateDocument(input: unknown): LessonContentDocument {
  const result = lessonContentDocumentSchema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException({
      message: 'Invalid lesson content blocks',
      details: result.error.flatten(),
    });
  }
  const document = result.data as LessonContentDocument;
  const rawBlocks = isRecord(input) && Array.isArray(input.blocks) ? input.blocks : [];
  document.blocks.forEach((block, index) => {
    const rawBlock = rawBlocks[index];
    if (!isRecord(rawBlock)) return;
    for (const key of ['gated', 'isGated', 'access', 'visibility']) {
      if (rawBlock[key] !== undefined) (block as unknown as Record<string, unknown>)[key] = rawBlock[key];
    }
  });
  const blockIds = new Set<string>();
  for (const block of document.blocks) {
    if (blockIds.has(block.id)) {
      throw new BadRequestException({ message: 'Lesson content blocks must have unique ids', details: { blockId: block.id } });
    }
    blockIds.add(block.id);
    if (block.type === 'quiz' && isRecord(block.content) && Array.isArray((block.content as Record<string, any>).questions)) {
      const questionIds = new Set<string>();
      for (const question of (block.content as Record<string, any>).questions) {
        if (!isRecord(question) || typeof question.id !== 'string' || questionIds.has(question.id)) {
          throw new BadRequestException({ message: 'Quiz questions must have unique ids' });
        }
        questionIds.add(question.id);
      }
    }
  }
  return document;
}

export function parseLessonContentDocument(input: unknown): LessonContentDocument {
  return validateDocument(input);
}

export function parseLessonBlock(input: unknown): LessonBlock {
  return validateDocument({ schemaVersion: 1, blocks: [input] }).blocks[0]!;
}

function validateTranslation<T>(input: unknown, schema: { safeParse: (value: unknown) => { success: boolean; data?: T; error?: { flatten: () => unknown } } }, label: string): T | null {
  if (input === null) return null;
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException({ message: `Invalid ${label} translations`, details: result.error?.flatten?.() });
  }
  return result.data as T;
}

export function parseCourseTranslations(input: unknown): CourseTranslationMap | null | undefined {
  if (input === undefined) return undefined;
  return validateTranslation<CourseTranslationMap>(input, courseTranslationsSchema, 'course') ?? null;
}

export function parseSeriesTranslations(input: unknown): SeriesTranslationMap | null | undefined {
  if (input === undefined) return undefined;
  return validateTranslation<SeriesTranslationMap>(input, seriesTranslationsSchema, 'series') ?? null;
}

export function parseLessonTranslations(input: unknown): LessonTranslationMap | null | undefined {
  if (input === undefined) return undefined;
  return validateTranslation<LessonTranslationMap>(input, lessonTranslationsSchema, 'lesson') ?? null;
}

export function parseContentDocumentOrLegacy(input: unknown, lesson: {
  videoUrl?: string | null;
  content?: string | null;
  thumbnailUrl?: string | null;
}): LessonContentDocument {
  if (input !== null && input !== undefined) {
    try {
      return parseLessonContentDocument(input);
    } catch {
      return synthesizeLegacyLessonDocument(lesson);
    }
  }
  return synthesizeLegacyLessonDocument(lesson);
}

export function synthesizeLegacyLessonDocument(lesson: {
  videoUrl?: string | null;
  content?: string | null;
  thumbnailUrl?: string | null;
}): LessonContentDocument {
  const blocks: LessonBlock[] = [];
  if (lesson.videoUrl) {
    blocks.push({
      id: 'legacy-video',
      type: 'video',
      sortOrder: blocks.length,
      content: {
        source: lesson.videoUrl,
        ...(lesson.thumbnailUrl ? { posterUrl: lesson.thumbnailUrl } : {}),
      },
    });
  }
  if (lesson.content) {
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(lesson.content);
    blocks.push({
      id: 'legacy-content',
      type: 'rich_text',
      sortOrder: blocks.length,
      content: isHtml ? { html: lesson.content } : { text: lesson.content },
    });
  }
  return { schemaVersion: 1, blocks };
}

export function getQuizBlocks(document: LessonContentDocument | null | undefined): LessonBlock[] {
  return (document?.blocks ?? []).filter((block) => block.type === 'quiz');
}

export function gradeQuizBlock(
  block: LessonBlock,
  answers: Record<string, string | string[]>,
): { score: number; passed: boolean; results: QuizQuestionResult[] } {
  const content = isRecord(block.content) ? block.content as Record<string, any> : {};
  const questions = Array.isArray(content.questions) ? content.questions as Array<Record<string, any>> : [];
  const totalPoints = questions.reduce((total, question) => total + (Number.isFinite(Number(question.points)) ? Number(question.points) : 1), 0);
  let earnedPoints = 0;
  const results = questions.map((question) => {
    const answer = answers[question.id];
    const expected = Array.isArray(question.correctOptionIds) ? [...new Set(question.correctOptionIds)].sort() : [];
    const actual = Array.isArray(answer) ? [...new Set(answer)].sort() : answer === undefined ? [] : [answer];
    const correct = expected.length > 0 && expected.length === actual.length && expected.every((value, index) => value === actual[index]);
    if (correct) earnedPoints += Number.isFinite(Number(question.points)) ? Number(question.points) : 1;
    return {
      questionId: String(question.id),
      correct,
      ...(question.explanation !== undefined ? { explanation: question.explanation } : {}),
    };
  });
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  return { score, passed: score >= Number(content.passingScore ?? 0), results };
}

export function getRequiredQuizIds(document: LessonContentDocument | null | undefined): string[] {
  return getQuizBlocks(document)
    .filter((block) => isRecord(block.content) && (block.content as Record<string, any>).requiredToContinue === true)
    .map((block) => block.id);
}

function collectText(value: unknown, key: string, output: string[], depth: number): void {
  if (depth > 8 || output.length >= 500) return;
  if (typeof value === 'string') {
    if (SAFE_TEXT_KEY.test(key) && !SENSITIVE_KEY.test(key)) {
      const text = value.trim();
      if (text) output.push(text);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, key, output, depth + 1);
    return;
  }
  if (!isRecord(value)) return;
  for (const [childKey, childValue] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(childKey)) continue;
    collectText(childValue, childKey, output, depth + 1);
  }
}

export function extractTranslationText(value: unknown): string {
  const output: string[] = [];
  collectText(value, 'text', output, 0);
  return output.join(' ').slice(0, 20000);
}

export function extractLessonBlockText(
  document: LessonContentDocument | null | undefined,
  options: SafeBlockTextOptions = {},
): string {
  const output: string[] = [];
  for (const block of document?.blocks ?? []) {
    if (!options.includeGated && blockIsGated(block)) continue;
    const content = localizedBlockContent(block, FALLBACK_LOCALE);
    if (block.type === 'quiz' && !options.includeQuizPrompts) continue;
    collectText(content, 'content', output, 0);
    if (options.includeTranslations && block.translations) {
      for (const locale of LOCALES) collectText(block.translations[locale], 'content', output, 0);
    }
  }
  return output.join(' ').replace(/\s+/g, ' ').trim().slice(0, 80000);
}

export function redactPublicLessonBlocks(
  document: LessonContentDocument | null | undefined,
  locale: ContentLocale,
  canAccess: boolean,
): LessonContentDocument {
  return localizeLessonDocument(document ?? { schemaVersion: 1, blocks: [] }, locale, { public: true, canAccess });
}
