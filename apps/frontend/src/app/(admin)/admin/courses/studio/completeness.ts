import type { CourseStudioData } from './types';

export interface StepState {
  key: string;
  /** Message key under `courses.studio.steps`; resolved at the render site. */
  labelKey: string;
  done: boolean;
  /** Message key under `courses.studio.steps` shown when `done` is false. */
  hintKey?: string;
  /** Interpolation values for `hintKey` (e.g. the course's own currency). */
  hintValues?: Record<string, string | number | Date>;
  /**
   * Advisory steps are recommendations, not publish gates. SEO metadata is
   * optional by design — every field falls back to the course title and
   * description — so treating it as required would strand already-published
   * courses the moment this check was tightened.
   */
  advisory?: boolean;
}

/** Minimal shape of a next-intl translator, so this module stays hook-free. */
export type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

const CURRENCY_SYMBOL: Record<string, string> = { SAR: 'SAR', USD: '$', EUR: '€', GBP: '£' };

function moneyHint(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? currency;
}

/**
 * Per-step completion for the guided checklist.
 *
 * Takes a translator rather than returning hardcoded English: these labels and
 * hints are rendered in three places (the step rail, the summary panel and the
 * publish checklist) and were previously English-only in every locale.
 */
export function stepStates(course: CourseStudioData): StepState[] {
  const totalLessons = course.series.reduce((count, section) => count + (section.lessons?.length ?? 0), 0);
  const hasTitle = Boolean(course.title?.trim());
  const hasSections = course.series.length > 0 && totalLessons > 0;
  const hasThumbnail = Boolean(course.thumbnailUrl?.trim());
  const hasPrice = course.accessMode !== 'paid' || (typeof course.priceCents === 'number' && course.priceCents > 0);
  // The localization step edits SEO overrides, so its own completion is the
  // presence of SEO metadata — previously it re-checked `title`, which made it
  // a duplicate of the basics step and could never be independently incomplete.
  const hasSeo = Boolean(course.seoTitle?.trim() || course.seoDescription?.trim());
  // Once a course is live, "ready" is a historical fact: it passed these checks
  // at publish time. Re-deriving it live showed an incomplete Publish step on
  // every published course that later lost its thumbnail, which reads as a bug.
  const ready = course.isPublished || (hasTitle && hasSections && hasThumbnail && hasPrice);

  return [
    {
      key: 'basics',
      labelKey: 'basics',
      done: hasTitle,
      hintKey: hasTitle ? undefined : 'hintTitle',
    },
    {
      key: 'curriculum',
      labelKey: 'curriculum',
      done: hasSections,
      hintKey: hasSections ? undefined : 'hintCurriculum',
    },
    {
      key: 'media',
      labelKey: 'media',
      done: hasThumbnail,
      hintKey: hasThumbnail ? undefined : 'hintThumbnail',
    },
    {
      key: 'pricing',
      labelKey: 'pricing',
      done: hasPrice,
      hintKey: hasPrice ? undefined : 'hintPrice',
      // Interpolated at render time so the amount matches the currency the
      // course is actually sold in, rather than a hardcoded "$0".
      hintValues: { amount: moneyHint(course.currency) },
    },
    {
      key: 'localization',
      labelKey: 'localization',
      done: hasSeo,
      hintKey: hasSeo ? undefined : 'hintSeo',
      advisory: true,
    },
    {
      key: 'publish',
      labelKey: 'publish',
      done: ready,
      hintKey: ready ? undefined : 'hintPublish',
    },
  ];
}

/** Label for a step state, resolved through the caller's translator. */
export function stepLabel(step: StepState, t: Translate): string {
  return t(`studio.steps.${step.labelKey}`);
}

/** Advisory hint, or undefined when the step is complete. */
export function stepHint(step: StepState, t: Translate): string | undefined {
  if (step.done || !step.hintKey) return undefined;
  return t(`studio.steps.${step.hintKey}`, step.hintValues);
}

/** Maps a server-side publish blocker string onto a step index. */
export function reasonToStep(reason: string): number {
  const value = reason.toLowerCase();
  if (value.includes('publish') || value.includes('ready')) return 5;
  if (value.includes('seo') || value.includes('description') || value.includes('translation') || value.includes('arabic')) return 4;
  if (value.includes('title') || value.includes('slug')) return 0;
  if (value.includes('section') || value.includes('lesson') || value.includes('quiz')) return 1;
  if (value.includes('thumbnail') || value.includes('image') || value.includes('media')) return 2;
  if (value.includes('price') || value.includes('paid') || value.includes('access')) return 3;
  return 5;
}

/**
 * True when every non-advisory step is complete. Advisory steps are excluded so
 * a missing SEO override never blocks a publish.
 */
export function allStepsDone(steps: StepState[]): boolean {
  return steps
    .filter((step) => step.key !== 'publish' && !step.advisory)
    .every((step) => step.done);
}
