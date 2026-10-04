'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePublicAiConfig, isAiAvailable } from '@/hooks/use-ai-assistant';
import { useAuthStore } from '@/stores/auth-store';
import { useAiAssistantContext } from './ai-assistant-context';
import { Button } from '@/components/ui/button';

export function LessonAssistantButton({
  courseId,
  lessonId,
  canAccess = true,
}: {
  courseId: string;
  lessonId: string;
  canAccess?: boolean;
}) {
  const t = useTranslations('aiAssistant');
  const { openAssistant } = useAiAssistantContext();
  const { data, isPending } = usePublicAiConfig();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isPending || !isAiAvailable(data, isAuthenticated) || !canAccess || !courseId || !lessonId) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        // Same sourceRef path as the community post actions.
        openAssistant({
          context: { courseId, lessonId },
          mode: 'ask_lesson',
          sourceRef: {
            type: 'lesson',
            id: lessonId,
            href: null,
            title: null,
            author: null,
            excerpt: null,
          },
        })
      }
      aria-label={t('askAboutLesson')}
    >
      <Sparkles />
      {t('askAboutLesson')}
    </Button>
  );
}
