'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AnimatePresence, m } from 'framer-motion';
import { ExternalLink, FileText, Globe, MessageSquare, RotateCcw, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { safeExternalHref, safeInternalHref } from '@/lib/safe-href';
import { timeAgo } from '@/lib/format';
import type { AiChatCitation, AiSourceRef } from '@/lib/api/types';
import { AiMarkdown } from './ai-markdown';
import { cn } from '@/lib/utils';
import { ease, spring, transition } from '@/lib/motion';

export const AI_SOURCE_ICONS = {
  post: MessageSquare,
  lesson: FileText,
  web: Globe,
} as const;

/** True for a citation that came from outside TITANS. */
export function isWebCitation(citation: AiChatCitation): boolean {
  return citation.sourceType === 'web';
}

export function AiSourceBadge({ source }: { source: string }) {
  const t = useTranslations('aiAssistant');
  const label = t(`sources.${source}`, { default: source });
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border/70 bg-muted/60 px-2 py-0.5 text-2xs font-medium text-muted-foreground">
      {label}
    </span>
  );
}

/** Pinned card describing what the thread is grounded in. */
export function AiReferenceCard({
  sourceRef,
  onClear,
  className,
}: {
  sourceRef: AiSourceRef;
  onClear?: () => void;
  className?: string;
}) {
  const t = useTranslations('aiAssistant');
  const href = safeInternalHref(sourceRef.href);
  const Icon = AI_SOURCE_ICONS[sourceRef.type as keyof typeof AI_SOURCE_ICONS] ?? FileText;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3.5 shadow-xs',
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t('referenceLabel')}
        </p>
        <p className="mt-0.5 truncate font-display text-[0.95rem] font-medium text-foreground">
          {sourceRef.title || t(`sources.${sourceRef.type}`, { default: sourceRef.type })}
        </p>
        {sourceRef.author && (
          <p className="truncate text-xs text-muted-foreground">
            {t('referenceAuthor', { name: sourceRef.author })}
          </p>
        )}
        {sourceRef.excerpt && (
          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {sourceRef.excerpt}
          </p>
        )}
        {href && (
          <Link
            href={href}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {t('referenceOpen')}
            <ExternalLink className="size-3" />
          </Link>
        )}
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={t('referenceClear')}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function AiCitationList({ citations }: { citations: AiChatCitation[] }) {
  const t = useTranslations('aiAssistant');
  if (citations.length === 0) return null;

  const workspace = citations.filter((citation) => !isWebCitation(citation));
  const web = citations.filter(isWebCitation);

  return (
    <div id="ai-evidence" className="scroll-mt-4 space-y-3 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3">
      {workspace.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t('citations')}
          </p>
          {workspace.map((citation) => {
            const href = safeInternalHref(citation.href);
            const body = (
              <>
                <span className="min-w-0 flex-1 truncate">{citation.title}</span>
                {href && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />}
              </>
            );
            return href ? (
              <Link
                key={`${citation.sourceType}:${citation.sourceId}`}
                href={href}
                className="flex items-center gap-2 text-xs text-primary underline-offset-4 hover:underline"
              >
                {body}
              </Link>
            ) : (
              <span
                key={`${citation.sourceType}:${citation.sourceId}`}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                {body}
              </span>
            );
          })}
        </div>
      )}

      {web.length > 0 && (
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Globe className="size-3" aria-hidden />
            {t('webCitations')}
          </p>
          {web.map((citation) => {
            const href = safeExternalHref(citation.href);
            const body = (
              <>
                <span className="min-w-0 flex-1 truncate">{citation.title}</span>
                {href && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />}
              </>
            );
            // `noopener noreferrer` so a third-party page can never reach back
            // into this window.
            return href ? (
              <a
                key={`${citation.sourceType}:${citation.sourceId}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center gap-2 text-xs text-primary underline-offset-4 hover:underline"
              >
                {body}
              </a>
            ) : (
              <span
                key={`${citation.sourceType}:${citation.sourceId}`}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                {body}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type AiBubble = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AiChatCitation[];
  createdAt?: string;
  pending?: boolean;
  failed?: boolean;
  /** True when external web evidence informed this answer. */
  usedWeb?: boolean;
  /** The member's own vote, when one exists. */
  rating?: number;
};

/** Transcript shared by the modal and the full page. */
export function AiTranscript({
  messages,
  emptyState,
  isPending,
  onRetry,
  onRate,
  className,
}: {
  messages: AiBubble[];
  emptyState: React.ReactNode;
  isPending?: boolean;
  onRetry?: () => void;
  /** Present only for persisted answers — an unsaved turn cannot be rated. */
  onRate?: (messageId: string, rating: number) => void;
  className?: string;
}) {
  const t = useTranslations('aiAssistant');

  return (
    <div className={cn('space-y-6', className)} role="log" aria-live="polite">
      {messages.length === 0 ? emptyState : null}

      <AnimatePresence initial={false}>
        {messages.map((message) =>
          message.role === 'user' ? (
            <m.div
              key={message.id}
              layout="position"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: spring.smooth }}
              exit={{ opacity: 0, transition: transition.leave }}
              className="flex justify-end"
            >
              <div
                className={cn(
                  'max-w-[85%] space-y-2 rounded-2xl rounded-ee-md bg-muted px-4 py-2.5 text-[0.9375rem] leading-7 text-foreground',
                  message.pending && 'opacity-80',
                  message.failed && 'ring-1 ring-destructive/40',
                )}
              >
                {/* What a person typed is shown verbatim. Reformatting it would let
                    `2 * 3 * 4` turn into italics. */}
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.pending && (
                  <p className="text-xs text-muted-foreground">{t('sending')}</p>
                )}
                {message.failed && onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive underline-offset-4 hover:underline"
                  >
                    <RotateCcw className="size-3" aria-hidden />
                    {t('retry')}
                  </button>
                )}
              </div>
            </m.div>
          ) : (
            <m.div
              key={message.id}
              layout="position"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.42, ease: ease.emerge } }}
              exit={{ opacity: 0, transition: transition.leave }}
              className="flex items-start gap-3"
            >
              <AssistantMark />
              <div
                className={cn(
                  'min-w-0 flex-1 space-y-3 pt-0.5',
                  message.failed && 'rounded-xl ring-1 ring-destructive/40',
                )}
              >
                <AiMarkdown content={message.content} />
                {message.usedWeb && (
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    <Globe className="size-3" aria-hidden />
                    {t('usedWebLabel')}
                  </p>
                )}
                {message.citations && message.citations.length > 0 && (
                  <AiCitationList citations={message.citations} />
                )}
                {!message.pending && !message.failed && onRate && (
                  <div className="-ms-1.5 flex items-center gap-0.5">
                    <RateButton
                      active={message.rating === 1}
                      tone="primary"
                      label={t('markHelpful')}
                      onClick={() => onRate(message.id, message.rating === 1 ? 0 : 1)}
                    >
                      <ThumbsUp className={cn('size-3.5', message.rating === 1 && 'fill-current')} />
                    </RateButton>
                    <RateButton
                      active={message.rating === -1}
                      tone="destructive"
                      label={t('markNotHelpful')}
                      onClick={() => onRate(message.id, message.rating === -1 ? 0 : -1)}
                    >
                      <ThumbsDown className={cn('size-3.5', message.rating === -1 && 'fill-current')} />
                    </RateButton>
                  </div>
                )}
                {message.pending && (
                  <p className="text-xs text-muted-foreground">{t('sending')}</p>
                )}
                {message.failed && onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="text-xs font-medium underline underline-offset-4"
                  >
                    {t('retry')}
                  </button>
                )}
              </div>
            </m.div>
          ),
        )}

        {isPending && (
          <m.div
            key="ai-typing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: transition.enter }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="flex items-center gap-3"
            role="status"
          >
            <AssistantMark thinking />
            <TypingDots />
            <span className="text-xs text-muted-foreground">{t('thinking')}</span>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small clay mark that sits beside every assistant turn — Claude's spark. */
export function AssistantMark({ thinking = false, className }: { thinking?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary',
        className,
      )}
    >
      {thinking ? (
        <m.span
          className="flex"
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, ease: 'linear', repeat: Infinity }}
        >
          <Sparkles className="size-3.5" />
        </m.span>
      ) : (
        <Sparkles className="size-3.5" />
      )}
    </span>
  );
}

/** Three soft dots breathing in sequence. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden>
      {[0, 1, 2].map((dot) => (
        <m.span
          key={dot}
          className="size-1.5 rounded-full bg-primary/70"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          transition={{ duration: 1.1, ease: ease.standard, repeat: Infinity, delay: dot * 0.16 }}
        />
      ))}
    </span>
  );
}

function RateButton({
  active,
  tone,
  label,
  onClick,
  children,
}: {
  active: boolean;
  tone: 'primary' | 'destructive';
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.85, transition: spring.snappy }}
      className={cn(
        'grid size-7 place-items-center rounded-md transition-colors hover:bg-muted',
        active
          ? tone === 'primary'
            ? 'text-primary'
            : 'text-destructive'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </m.button>
  );
}

/** Claude-style composer: a rounded paper card with a soft, lifting shadow. */
export const AI_COMPOSER_CLASS =
  'rounded-2xl border border-border/80 bg-card shadow-md transition-[border-color,box-shadow] duration-200 focus-within:border-border-strong focus-within:shadow-lg';

/** The textarea inside the composer sheds its own chrome. */
export const AI_COMPOSER_TEXTAREA_CLASS =
  'min-h-0 resize-none border-0 bg-transparent px-4 pt-3.5 pb-1 text-[0.9375rem] leading-7 shadow-none hover:border-0 focus-visible:border-0 focus-visible:ring-0';

/** Groups conversations for the history rail. */
export function groupConversationsByTime<T extends { lastMessageAt: string }>(
  items: T[],
  now = Date.now(),
): { group: string; items: T[] }[] {
  const day = 24 * 60 * 60 * 1000;
  const buckets: Record<string, T[]> = {};
  for (const item of items) {
    const age = now - new Date(item.lastMessageAt).getTime();
    const key =
      age < day ? 'today' : age < 2 * day ? 'yesterday' : age < 7 * day ? 'week' : 'older';
    (buckets[key] ||= []).push(item);
  }
  const order = ['today', 'yesterday', 'week', 'older'];
  return order
    .map((key) => ({ group: key, items: buckets[key] }))
    .filter((entry): entry is { group: string; items: T[] } => !!entry.items?.length);
}

export function relativeTime(iso: string, locale = 'en') {
  return timeAgo(iso, locale);
}
