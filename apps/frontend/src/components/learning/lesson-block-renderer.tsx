'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import DOMPurify from 'isomorphic-dompurify';
import { AlertCircle, CheckCircle2, CircleHelp, Loader2, RotateCcw, Send, XCircle } from 'lucide-react';
import type { ContentLocale, InteractiveHotspot, LessonBlock, LessonContentDocument, QuizAttemptResult } from '@titan/shared';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { CinematicVideoPlayer } from '@/components/media/cinematic-player';
import { localizedContent, type BlockContent } from '@/lib/lesson-blocks';

export interface LessonBlockRendererProps {
  blocks?: LessonContentDocument | LessonBlock[] | null;
  courseSlug?: string;
  lessonSlug?: string;
  locale?: ContentLocale;
  preview?: boolean;
  videoUrl?: string | null;
  onQuizResult?: (result: QuizAttemptResult, quizId?: string) => void;
  onVideoError?: () => void;
}

type RenderBlock = LessonBlock & { content: BlockContent };

function asBlocks(value: LessonBlockRendererProps['blocks']): RenderBlock[] {
  const list = Array.isArray(value) ? value : value?.blocks ?? [];
  return list
    .map((block) => ({ ...block, content: (block.content ?? {}) as BlockContent }))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function safeHtml(value: string): string {
  return DOMPurify.sanitize(value, { USE_PROFILES: { html: true } });
}

function isUploadedMediaRef(value: unknown): value is string {
  return typeof value === 'string' && /^(?:tenants\/|uploads\/|\/uploads\/|\/images\/)[A-Za-z0-9._/-]+$/.test(value);
}

function RichTextBlock({ content }: { content: BlockContent }) {
  const images = Array.isArray(content.images) ? content.images : [];
  const html = typeof content.html === 'string' && !/(?:src|href)\s*=\s*["'](?:https?:|\/\/|data:|javascript:)/i.test(content.html) ? content.html : '';
  return (
    <section className="space-y-4 text-sm leading-relaxed text-foreground">
      {html.trim() && <div className="prose prose-sm max-w-none text-foreground dark:prose-invert" dangerouslySetInnerHTML={{ __html: safeHtml(html) }} />}
      {typeof content.text === 'string' && content.text.trim() && <p className="whitespace-pre-wrap text-foreground">{content.text}</p>}
      {images.length > 0 && <div className="grid gap-4 sm:grid-cols-2">{images.map((image: { src?: string; alt?: string; caption?: string | null }, index: number) => isUploadedMediaRef(image?.src) ? <figure key={`${image.src}-${index}`} className="overflow-hidden rounded-xl border border-border bg-muted"><img src={image.src} alt={image.alt ?? ''} className="max-h-[30rem] w-full object-contain" /><figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">{image.caption || image.alt}</figcaption></figure> : null)}</div>}
    </section>
  );
}

function VideoBlock({ content, videoUrl, locale = 'en', onVideoError }: { content: BlockContent; videoUrl?: string | null; locale?: ContentLocale; onVideoError?: () => void }) {
  const t = useTranslations('lesson');
  const source = videoUrl || (isUploadedMediaRef(content.source) ? content.source : isUploadedMediaRef(content.storageKey) ? content.storageKey : null);
  const isStorageKey = typeof source === 'string' && source.startsWith('tenants/');
  if (!source || isStorageKey) return <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-border bg-muted text-sm text-muted-foreground">{t('videoAfterEnroll', { default: 'Video is available after enrollment.' })}</div>;
  const poster = isUploadedMediaRef(content.posterUrl) ? content.posterUrl : undefined;
  const captionsUrl = isUploadedMediaRef(content.captionsUrl) ? content.captionsUrl : undefined;
  return <CinematicVideoPlayer src={source} poster={poster} captionsUrl={captionsUrl} locale={locale} variant="inline" className="w-full" onError={onVideoError} />;
}

function InteractiveImageBlock({ content, locale }: { content: BlockContent; locale: ContentLocale }) {
  const [selected, setSelected] = useState<string | null>(null);
  const t = useTranslations('lesson');
  const hotspots: InteractiveHotspot[] = Array.isArray(content.hotspots) ? content.hotspots : [];
  if (!isUploadedMediaRef(content.src)) return <div className="rounded-2xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">{t('interactiveImagePreview', { default: 'Interactive image preview' })}</div>;
  return (
    <section className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted" dir="ltr">
        <img src={content.src} alt={content.alt ?? ''} className="block max-h-[40rem] w-full object-contain" />
        {hotspots.map((hotspot) => (
          <div key={hotspot.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${Math.max(0, Math.min(100, hotspot.x))}%`, top: `${Math.max(0, Math.min(100, hotspot.y))}%` }}>
            <button type="button" aria-label={`${hotspot.label}${hotspot.tooltip ? `: ${hotspot.tooltip}` : ''}`} aria-expanded={selected === hotspot.id} onClick={() => setSelected((current) => current === hotspot.id ? null : hotspot.id)} className="group relative flex size-8 items-center justify-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow-lg transition hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40">
              <span className="text-sm font-bold">{hotspots.indexOf(hotspot) + 1}</span>
              {hotspot.tooltip && <span role="tooltip" dir={locale === 'ar' ? 'rtl' : 'ltr'} className="pointer-events-none absolute bottom-[calc(100%+0.6rem)] start-1/2 z-10 w-max max-w-56 -translate-x-1/2 translate-y-1 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-visible:opacity-100">{hotspot.tooltip}</span>}
            </button>
          </div>
        ))}
      </div>
      {content.caption && <p className="text-center text-xs text-muted-foreground">{content.caption}</p>}
      {selected && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground" dir={locale === 'ar' ? 'rtl' : 'ltr'}><p className="font-semibold">{hotspots.find((hotspot) => hotspot.id === selected)?.label}</p>{hotspots.find((hotspot) => hotspot.id === selected)?.detail && <p className="mt-1 text-muted-foreground">{hotspots.find((hotspot) => hotspot.id === selected)?.detail}</p>}</div>}
      {hotspots.length > 0 && !selected && <p className="text-center text-xs text-muted-foreground">{t('selectHotspotHint', { default: 'Select a numbered marker to explore the image.' })}</p>}
    </section>
  );
}

function QuizBlock({
  block,
  courseSlug,
  lessonSlug,
  preview,
  onQuizResult,
}: {
  block: RenderBlock;
  courseSlug?: string;
  lessonSlug?: string;
  preview?: boolean;
  onQuizResult?: (result: QuizAttemptResult, quizId?: string) => void;
}) {
  const content = block.content;
  const t = useTranslations('lesson');
  const tCommon = useTranslations('common');
  const questions = Array.isArray(content.questions) ? content.questions : [];
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultByQuestion = useMemo(() => new Map(result?.results.map((item) => [item.questionId, item]) ?? []), [result]);
  const hasAnswer = (questionId: string) => {
    const answer = answers[questionId];
    return Array.isArray(answer) ? answer.length > 0 : Boolean(answer);
  };
  const allAnswered = questions.length > 0 && questions.every((question: { id: string }) => hasAnswer(question.id));

  const setAnswer = (questionId: string, optionId: string, multiple: boolean) => {
    setResult(null);
    setAnswers((current) => {
      if (!multiple) return { ...current, [questionId]: optionId };
      const selected = Array.isArray(current[questionId]) ? current[questionId] as string[] : [];
      return { ...current, [questionId]: selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId] };
    });
  };

  const submit = async () => {
    if (preview || !courseSlug || !lessonSlug || !allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await api.post<QuizAttemptResult>(`/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}/quizzes/${encodeURIComponent(block.id)}/attempts`, { answers });
      setResult(response);
      onQuizResult?.(response, block.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('quizSubmitFailed', { default: 'The quiz could not be submitted.' }));
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    setAnswers({});
    setResult(null);
    setError(null);
  };

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{t('knowledgeCheck', { default: 'Knowledge check' })}</p><h2 className="mt-1 font-display text-xl font-semibold text-foreground">{t('passScore', { score: content.passingScore, default: 'Pass score: {score}%' })}</h2></div>
        {content.requiredToContinue && <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning"><CircleHelp className="size-3.5" /> {t('requiredToContinue', { default: 'Required to continue' })}</span>}
      </div>
      {questions.map((question: { id: string; prompt: string; type: string; options: { id: string; label: string }[] }, questionIndex: number) => {
        const questionResult = resultByQuestion.get(question.id);
        return (
          <fieldset key={question.id} className="rounded-xl border border-border bg-background p-4">
            <legend className="px-1 text-sm font-semibold text-foreground">{questionIndex + 1}. {question.prompt}</legend>
            <div className="mt-3 grid gap-2">
              {(question.options ?? []).map((option) => {
                const multiple = question.type === 'multiple';
                const selected = Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).includes(option.id) : answers[question.id] === option.id;
                return <label key={option.id} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition', selected ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-muted')}><input type={multiple ? 'checkbox' : question.type === 'true_false' ? 'radio' : 'radio'} name={`${block.id}-${question.id}`} checked={selected} onChange={() => setAnswer(question.id, option.id, multiple)} className="size-4 accent-primary" /><span>{option.label}</span></label>;
              })}
            </div>
            {result && <div className={cn('mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs', questionResult?.correct ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>{questionResult?.correct ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <XCircle className="mt-0.5 size-3.5 shrink-0" />}<span>{questionResult?.correct ? t('correct', { default: 'Correct' }) : t('reviewAndRetry', { default: 'Review the lesson and try again.' })}{questionResult?.explanation ? ` ${questionResult.explanation}` : ''}</span></div>}
          </fieldset>
        );
      })}
      {preview && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t('previewMode', { default: 'Preview mode: answers are not graded or saved.' })}</p>}
      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"><span className="flex items-center gap-2"><AlertCircle className="size-3.5" />{error}</span><button type="button" onClick={() => void submit()} className="font-semibold underline">{tCommon('retry', { default: 'Retry' })}</button></div>}
      {result && <div role="status" aria-live="polite" className={cn('rounded-xl px-4 py-3 text-sm', result.passed ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}><p className="font-semibold">{result.passed ? t('passedWith', { score: result.score, default: 'Passed with {score}%' }) : t('scoreRequired', { score: result.score, passing: content.passingScore, default: 'You scored {score}%. A score of {passing}% is required.' })}</p><p className="mt-1 text-xs opacity-80">{t('attemptNumber', { number: result.attemptNumber, default: 'Attempt {number}' })}</p></div>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {result && <button type="button" onClick={retry} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-muted"><RotateCcw className="size-4" /> {t('tryAgain', { default: 'Try again' })}</button>}
        {!result && <button type="button" disabled={preview || !allAnswered || submitting} onClick={() => void submit()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{submitting ? t('submitting', { default: 'Submitting…' }) : t('submitAnswers', { default: 'Submit answers' })}</button>}
      </div>
      {content.maxAttempts && <p className="text-end text-xs text-muted-foreground">{t('maximumAttempts', { count: content.maxAttempts, default: 'Maximum attempts: {count}' })}</p>}
    </section>
  );
}

export function LessonBlockRenderer({
  blocks,
  courseSlug,
  lessonSlug,
  locale = 'en',
  preview = false,
  videoUrl,
  onQuizResult,
  onVideoError,
}: LessonBlockRendererProps) {
  const renderBlocks = asBlocks(blocks);
  if (renderBlocks.length === 0) return null;
  return (
    <div className="space-y-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {renderBlocks.map((block) => {
        const content = localizedContent(block, locale);
        if (block.type === 'video') return <VideoBlock key={block.id} content={content} videoUrl={videoUrl} locale={locale} onVideoError={onVideoError} />;
        if (block.type === 'rich_text') return <RichTextBlock key={block.id} content={content} />;
        if (block.type === 'interactive_image') return <InteractiveImageBlock key={block.id} content={content} locale={locale} />;
        return <QuizBlock key={block.id} block={{ ...block, content }} courseSlug={courseSlug} lessonSlug={lessonSlug} preview={preview} onQuizResult={onQuizResult} />;
      })}
    </div>
  );
}
