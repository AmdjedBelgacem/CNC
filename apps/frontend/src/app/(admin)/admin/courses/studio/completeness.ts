import type { CourseStudioData } from './types';
export interface StepState {
  key: string;
  label: string;
  done: boolean;
  hint?: string;
}
export function stepStates(c: CourseStudioData): StepState[] {
  const totalLessons = c.series.reduce((n, s) => n + (s.lessons?.length ?? 0), 0);
  const basics = Boolean(c.title?.trim());
  const curriculum = c.series.length > 0 && totalLessons > 0;
  const media = Boolean(c.thumbnailUrl?.trim());
  const pricing = c.accessMode !== 'paid' || (typeof c.priceCents === 'number' && c.priceCents > 0);
  const seo = Boolean(c.seoTitle?.trim() && c.seoDescription?.trim());
  return [
    {
      key: 'basics',
      label: 'Basics',
      done: basics,
      hint: basics ? undefined : 'Add a compelling course title',
    },
    {
      key: 'curriculum',
      label: 'Curriculum',
      done: curriculum,
      hint: curriculum ? undefined : 'Add at least one section that contains a lesson',
    },
    {
      key: 'media',
      label: 'Media & Resources',
      done: media,
      hint: media ? undefined : 'Upload a thumbnail image (16:9 recommended)',
    },
    {
      key: 'pricing',
      label: 'Pricing & Access',
      done: pricing,
      hint: pricing ? undefined : 'Paid courses need a price greater than $0',
    },
    {
      key: 'seo',
      label: 'SEO & Publish',
      done: seo,
      hint: seo ? undefined : 'Add an SEO title and meta description',
    },
  ];
} /** Maps a publish-blocking reason (from the server) to the studio step index so the UI can jump to it. */
export function reasonToStep(reason: string): number {
  const r = reason.toLowerCase();
  if (r.includes('title') || r.includes('slug')) return 0;
  if (r.includes('section') || r.includes('lesson')) return 1;
  if (r.includes('thumbnail') || r.includes('image') || r.includes('media')) return 2;
  if (r.includes('price') || r.includes('paid')) return 3;
  if (r.includes('seo') || r.includes('description')) return 4;
  return 0;
}
export function allStepsDone(steps: StepState[]): boolean {
  return steps.every((s) => s.done);
}
