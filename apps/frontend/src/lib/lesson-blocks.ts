import type {
  ContentLocale,
  InteractiveHotspot,
  LessonBlock,
  LessonContentDocument,
  QuizOption,
  QuizQuestion,
} from '@titan/shared';

export type BlockContent = Record<string, any>;

export function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function isUploadedMediaRef(value: unknown): value is string {
  return typeof value === 'string' && /^(?:tenants\/|uploads\/|\/uploads\/|\/images\/)[A-Za-z0-9._/-]+$/.test(value);
}

function mergeValue(base: unknown, translated: unknown): unknown {
  if (translated === undefined || translated === null) return base;
  if (Array.isArray(base) && Array.isArray(translated)) {
    if (!base.every((item) => item && typeof item === 'object') || !translated.every((item) => item && typeof item === 'object')) return translated;
    return translated.map((item) => {
      const id = (item as { id?: unknown }).id;
      const match = id === undefined ? base[translated.indexOf(item)] : base.find((candidate) => (candidate as { id?: unknown }).id === id);
      return mergeValue(match, item);
    });
  }
  if (base && translated && typeof base === 'object' && typeof translated === 'object') {
    return Object.entries(translated as Record<string, unknown>).reduce((output, [key, value]) => {
      output[key] = mergeValue((base as Record<string, unknown>)[key], value);
      return output;
    }, { ...(base as Record<string, unknown>) });
  }
  return translated;
}

export function cloneDocument(document: LessonContentDocument | null | undefined): LessonContentDocument {
  if (!document) return { schemaVersion: 1, blocks: [] };
  return {
    schemaVersion: 1,
    blocks: clone(document.blocks ?? []).map((block) => ({
      ...block,
      content: clone(block.content),
      ...(block.translations ? { translations: clone(block.translations) } : {}),
    })),
  };
}

export function localizedContent(block: LessonBlock, locale: ContentLocale): BlockContent {
  const base = (block.content ?? {}) as BlockContent;
  const translated = locale === 'en' ? undefined : block.translations?.[locale];
  return mergeValue(base, translated) as BlockContent;
}

export function withLocalizedValue(
  block: LessonBlock,
  locale: ContentLocale,
  field: string,
  value: unknown,
): LessonBlock {
  if (locale === 'en') {
    return { ...block, content: { ...(block.content as BlockContent), [field]: value } };
  }
  const current = block.translations?.[locale] ?? {};
  return {
    ...block,
    translations: {
      ...(block.translations ?? {}),
      [locale]: { ...current, [field]: value },
    },
  };
}

export function makeOption(label = 'Option'): QuizOption {
  return { id: makeId('option'), label };
}

export function makeQuestion(index = 1): QuizQuestion {
  const first = makeOption('First answer');
  const second = makeOption('Second answer');
  return {
    id: makeId('question'),
    type: 'single',
    prompt: `Question ${index}`,
    options: [first, second],
    correctOptionIds: [first.id],
    explanation: '',
    points: 1,
  };
}

export function makeBlock(type: LessonBlock['type'], sortOrder: number): LessonBlock {
  if (type === 'video') {
    return { id: makeId('video'), type, sortOrder, content: { source: '', posterUrl: '', transcript: '' } };
  }
  if (type === 'rich_text') {
    return { id: makeId('text'), type, sortOrder, content: { text: '', images: [] } };
  }
  if (type === 'interactive_image') {
    return { id: makeId('image'), type, sortOrder, content: { src: '', alt: '', caption: '', hotspots: [] } };
  }
  return {
    id: makeId('quiz'),
    type,
    sortOrder,
    content: { passingScore: 70, requiredToContinue: false, maxAttempts: null, questions: [makeQuestion(1)] },
  };
}

export function makeHotspot(index: number, x = Math.min(90, 20 + index * 10), y = 50): InteractiveHotspot {
  return {
    id: makeId('hotspot'),
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
    label: `Hotspot ${index + 1}`,
    tooltip: '',
    detail: '',
  };
}

export function isValidDocument(document: LessonContentDocument): boolean {
  if (document.schemaVersion !== 1 || document.blocks.length > 100) return false;
  const ids = new Set<string>();
  for (const block of document.blocks) {
    if (!block.id || ids.has(block.id)) return false;
    ids.add(block.id);
    const content = block.content as BlockContent;
    if (block.type === 'video' && !isUploadedMediaRef(content.source) && !isUploadedMediaRef(content.storageKey)) return false;
    if (block.type === 'rich_text') {
      if (typeof content.html !== 'string' && typeof content.text !== 'string' && !Array.isArray(content.images)) return false;
      if (Array.isArray(content.images) && content.images.some((image: { src?: unknown }) => !isUploadedMediaRef(image.src))) return false;
    }
    if (block.type === 'interactive_image') {
      if (!isUploadedMediaRef(content.src) || !Array.isArray(content.hotspots)) return false;
      if (content.hotspots.some((hotspot: InteractiveHotspot) => !hotspot.id || !hotspot.label || hotspot.x < 0 || hotspot.x > 100 || hotspot.y < 0 || hotspot.y > 100 || (hotspot.width ?? 0) + hotspot.x > 100 || (hotspot.height ?? 0) + hotspot.y > 100)) return false;
    }
    if (block.type === 'quiz') {
      if (!Array.isArray(content.questions) || content.questions.length === 0) return false;
      if (content.passingScore < 0 || content.passingScore > 100) return false;
      const questionIds = new Set<string>();
      for (const question of content.questions as QuizQuestion[]) {
        if (!question.id || questionIds.has(question.id) || !question.prompt || !Array.isArray(question.options) || question.options.length < 2) return false;
        questionIds.add(question.id);
        const optionIds = new Set(question.options.map((option) => option.id));
        if (question.correctOptionIds?.some((id) => !optionIds.has(id))) return false;
      }
    }
  }
  return true;
}

export function sortDocument(document: LessonContentDocument): LessonContentDocument {
  return { ...document, blocks: document.blocks.map((block, index) => ({ ...block, sortOrder: index })) };
}
