'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bot, ExternalLink, FileText, Globe, MessageSquare, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { safeExternalHref, safeInternalHref } from '@/lib/safe-href';
import { timeAgo } from '@/lib/format';
import type { AiChatCitation, AiSourceRef } from '@/lib/api/types';
import { AiMarkdown } from './ai-markdown';
import { cn } from '@/lib/utils';

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
    <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/60 px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.08em] text-muted-foreground">
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
        'flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3',
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-2xs uppercase tracking-[0.12em] text-primary">
          {t('referenceLabel')}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">
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
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
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
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
    <div id="ai-evidence" className="scroll-mt-4 space-y-2 border-t border-border/60 pt-2">
      {workspace.length > 0 && (
        <div className="space-y-1">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                className="flex items-center gap-2 text-xs text-primary hover:underline"
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
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                className="flex items-center gap-2 text-xs text-primary hover:underline"
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
    <div className={cn('space-y-4', className)} role="log" aria-live="polite">
      {messages.length === 0 ? emptyState : null}

      {messages.map((message) => (
        <div
          key={message.id}
          className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
        >
          <div
            className={cn(
              'max-w-[92%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
              message.role === 'user'
                ? 'rounded-tr-sm bg-primary text-primary-foreground'
                : 'rounded-tl-sm bg-muted text-foreground',
              message.failed && 'ring-1 ring-destructive/40',
            )}
          >
            {message.role === 'assistant' ? (
              <AiMarkdown content={message.content} />
            ) : (
              // What a person typed is shown verbatim. Reformatting it would let
              // `2 * 3 * 4` turn into italics.
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
            {message.usedWeb && (
              <p className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.1em] text-muted-foreground">
                <Globe className="size-3" aria-hidden />
                {t('usedWebLabel')}
              </p>
            )}
            {message.citations && message.citations.length > 0 && (
              <AiCitationList citations={message.citations} />
            )}
            {message.role === 'assistant' && !message.pending && !message.failed && onRate && (
              <div className="flex items-center gap-1 border-t border-border/60 pt-1.5">
                <button
                  type="button"
                  onClick={() => onRate(message.id, message.rating === 1 ? 0 : 1)}
                  aria-pressed={message.rating === 1}
                  aria-label={t('markHelpful')}
                  title={t('markHelpful')}
                  className={cn(
                    'rounded p-1 transition-colors',
                    message.rating === 1
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ThumbsUp className={cn('size-3.5', message.rating === 1 && 'fill-current')} />
                </button>
                <button
                  type="button"
                  onClick={() => onRate(message.id, message.rating === -1 ? 0 : -1)}
                  aria-pressed={message.rating === -1}
                  aria-label={t('markNotHelpful')}
                  title={t('markNotHelpful')}
                  className={cn(
                    'rounded p-1 transition-colors',
                    message.rating === -1
                      ? 'text-destructive'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ThumbsDown className={cn('size-3.5', message.rating === -1 && 'fill-current')} />
                </button>
              </div>
            )}
            {message.pending && (
              <p className="font-mono text-2xs uppercase tracking-[0.1em] opacity-70">
                {t('sending')}
              </p>
            )}
            {message.failed && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-xs font-semibold underline underline-offset-2"
              >
                {t('retry')}
              </button>
            )}
          </div>
        </div>
      ))}

      {isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Bot className="size-3.5 animate-pulse" />
          {t('thinking')}
        </div>
      )}
    </div>
  );
}

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
