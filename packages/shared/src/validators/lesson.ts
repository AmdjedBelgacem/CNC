import { z } from 'zod';

const localeSchema = z.enum(['en', 'ar']);
const percentageSchema = z.number().min(0).max(100);
const uploadedMediaRefSchema = z.string().max(2000).refine(
  (value) => /^(?:tenants\/|uploads\/|\/uploads\/|\/images\/)[A-Za-z0-9._/-]+$/.test(value),
  'Media must reference an uploaded or bundled workspace asset',
);
const blockContentSchema = z.record(z.string(), z.unknown());
const blockTranslationsSchema = z.record(localeSchema, blockContentSchema);

const hotspotSchema = z.object({
  id: z.string().min(1).max(100),
  x: percentageSchema,
  y: percentageSchema,
  width: percentageSchema.optional(),
  height: percentageSchema.optional(),
  label: z.string().min(1).max(200),
  tooltip: z.string().max(1000).nullable().optional(),
  detail: z.string().max(10000).nullable().optional(),
}).superRefine((hotspot, ctx) => {
  if ((hotspot.width ?? 0) + hotspot.x > 100 || (hotspot.height ?? 0) + hotspot.y > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: 'Hotspot area must stay inside the image' });
  }
});

const quizOptionSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(1000),
});

const quizQuestionSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['single', 'multiple', 'true_false']),
  prompt: z.string().min(1).max(10000),
  options: z.array(quizOptionSchema).min(2).max(20),
  correctOptionIds: z.array(z.string().min(1).max(100)).max(20).optional(),
  explanation: z.string().max(10000).nullable().optional(),
  points: z.number().int().min(1).max(100).optional(),
});

export const lessonBlockSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['video', 'rich_text', 'interactive_image', 'quiz']),
  sortOrder: z.number().int().min(0).max(1000),
  content: blockContentSchema,
  translations: blockTranslationsSchema.optional(),
}).superRefine((block, ctx) => {
  const mediaPaths = ['source', 'storageKey', 'posterUrl', 'captionsUrl', 'src'] as const;
  const validateMedia = (content: unknown, path: (string | number)[]) => {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return;
    const record = content as Record<string, unknown>;
    for (const field of mediaPaths) {
      const value = record[field];
      if (value !== undefined && value !== null && !uploadedMediaRefSchema.safeParse(value).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, field], message: 'Media must be uploaded through Course Studio' });
      }
    }
  };
  const validateRichMedia = (content: unknown, path: (string | number)[]) => {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return;
    const record = content as Record<string, unknown>;
    if (record.images !== undefined) {
      const images = z.array(z.object({ src: uploadedMediaRefSchema, alt: z.string().max(500), caption: z.string().max(2000).nullable().optional() })).max(50).safeParse(record.images);
      if (!images.success) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, 'images'], message: 'Rich text images must be uploaded assets' });
    }
    if (typeof record.html === 'string' && /(?:src|href)\s*=\s*["'](?:https?:|\/\/|data:|javascript:)/i.test(record.html)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, 'html'], message: 'HTML media and links must use uploaded workspace assets' });
    }
  };
  validateMedia(block.content, ['content']);
  validateRichMedia(block.content, ['content']);
  for (const [locale, content] of Object.entries(block.translations ?? {})) {
    validateMedia(content, ['translations', locale]);
    validateRichMedia(content, ['translations', locale]);
  }

  if (block.type === 'video') {
    const content = block.content as { source?: unknown; storageKey?: unknown };
    if (typeof content.source !== 'string' && typeof content.storageKey !== 'string') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content'], message: 'Video block needs an uploaded source or storage key' });
    }
  }
  if (block.type === 'rich_text') {
    const content = block.content as { html?: unknown; text?: unknown; images?: unknown };
    if (typeof content.html !== 'string' && typeof content.text !== 'string' && content.images === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content'], message: 'Rich text block needs text, HTML, or images' });
    }
    if (content.images !== undefined) {
      const images = z.array(z.object({ src: uploadedMediaRefSchema, alt: z.string().max(500), caption: z.string().max(2000).nullable().optional() })).max(50).safeParse(content.images);
      if (!images.success) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'images'], message: 'Rich text images must be uploaded assets' });
    }
    if (typeof content.html === 'string' && /(?:src|href)\s*=\s*["'](?:https?:|\/\/|data:|javascript:)/i.test(content.html)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'html'], message: 'HTML media and links must use uploaded workspace assets' });
    }
  }
  if (block.type === 'interactive_image') {
    const result = z.object({
      src: uploadedMediaRefSchema,
      alt: z.string().max(500),
      caption: z.string().max(2000).nullable().optional(),
      hotspots: z.array(hotspotSchema).max(100),
    }).safeParse(block.content);
    if (!result.success) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content'], message: 'Interactive images must use an uploaded base image' });
  }
  if (block.type === 'quiz') {
    const result = z.object({
      passingScore: z.number().int().min(0).max(100),
      requiredToContinue: z.boolean(),
      maxAttempts: z.number().int().min(1).max(100).nullable().optional(),
      questions: z.array(quizQuestionSchema).min(1).max(100),
    }).safeParse(block.content);
    if (!result.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content'], message: 'Invalid quiz content' });
      return;
    }
    for (const question of result.data.questions) {
      const optionIds = new Set(question.options.map((option) => option.id));
      if (question.correctOptionIds?.some((id) => !optionIds.has(id))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content'], message: 'Quiz answer references an unknown option' });
      }
    }
  }
});

export const lessonContentDocumentSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  blocks: z.array(lessonBlockSchema).max(100),
});

export const courseTranslationsSchema = z.record(localeSchema, z.object({
  title: z.string().min(1).max(300).optional(),
  subtitle: z.string().max(500).nullable().optional(),
  description: z.string().max(50000).nullable().optional(),
  seoTitle: z.string().max(300).nullable().optional(),
  seoDescription: z.string().max(5000).nullable().optional(),
  seoKeywords: z.string().max(300).nullable().optional(),
}).strict());

export const seriesTranslationsSchema = z.record(localeSchema, z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(10000).nullable().optional(),
}).strict());

export const lessonTranslationsSchema = z.record(localeSchema, z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(10000).nullable().optional(),
}).strict());
