'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileSearch, Loader2, MessageSquareQuote, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth-store';
import { isAiAvailable, usePublicAiConfig } from '@/hooks/use-ai-assistant';
import { useAiAssistantContext } from '@/components/ai/ai-assistant-context';
import type { FeedPost } from '@/lib/api/types';

function excerpt(content: string, max = 400) {
  const flat = (content || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * Per-post AI actions. Both open the assistant modal already grounded in the
 * post, so the first answer acknowledges and analyses that specific item.
 */
export function PostAiActions({ post }: { post: FeedPost }) {
  const t = useTranslations('aiAssistant');
  const { data, isPending } = usePublicAiConfig();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { openAssistant } = useAiAssistantContext();
  const [busy, setBusy] = useState(false);

  if (isPending || !isAiAvailable(data, isAuthenticated) || !post?.id) return null;

  const author = post.author?.name || post.author?.username || t('member');
  const sourceRef = {
    type: 'post',
    id: post.id,
    href: '/feed',
    title: `${author} — ${t('postTitle')}`,
    author,
    excerpt: excerpt(post.content || ''),
  };

  const launch = (mode: 'fact_check' | 'ask_post') => {
    setBusy(true);
    openAssistant({
      sourceRef,
      mode,
      prefill: mode === 'fact_check' ? t('factCheckPrompt') : '',
    });
    // Clear on the next frame so the button does not look stuck.
    window.setTimeout(() => setBusy(false), 400);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('postActions')}
          title={t('postActions')}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MoreHorizontal className="size-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => launch('fact_check')}>
          <FileSearch className="size-4" />
          <span className="flex flex-col">
            <span className="font-medium">{t('factCheck')}</span>
            <span className="text-2xs text-muted-foreground">{t('factCheckHint')}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => launch('ask_post')}>
          <MessageSquareQuote className="size-4" />
          <span className="flex flex-col">
            <span className="font-medium">{t('askAboutPost')}</span>
            <span className="text-2xs text-muted-foreground">{t('askAboutPostHint')}</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
