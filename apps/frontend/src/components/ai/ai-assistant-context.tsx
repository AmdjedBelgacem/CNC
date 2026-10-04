'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AiChatMode, AiLessonContext, AiSourceRef } from '@/lib/api/types';

export type AiMode = AiChatMode;

interface AiAssistantContextValue {
  lessonContext: AiLessonContext | null;
  /** Post / lesson / page the next question is grounded in. */
  sourceRef: AiSourceRef | null;
  mode: AiMode;
  /** Prefilled composer text (e.g. the fact-check request). */
  prefill: string;
  isOpen: boolean;
  /** The persisted thread the modal is showing, if any. */
  conversationId: string | null;
  openAssistant: (options?: {
    context?: AiLessonContext | null;
    sourceRef?: AiSourceRef | null;
    mode?: AiMode;
    prefill?: string;
    conversationId?: string | null;
  }) => void;
  /** Continue an existing thread without clearing the reference. */
  continueConversation: (conversationId: string) => void;
  closeAssistant: () => void;
  clearLessonContext: () => void;
  setConversationId: (id: string | null) => void;
  resetThread: () => void;
}

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null);

export function AiAssistantProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [lessonContext, setLessonContext] = useState<AiLessonContext | null>(null);
  const [sourceRef, setSourceRef] = useState<AiSourceRef | null>(null);
  const [mode, setMode] = useState<AiMode>('general');
  const [prefill, setPrefill] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Navigating away drops any page-scoped grounding.
  useEffect(() => {
    setLessonContext(null);
    setSourceRef(null);
    setMode('general');
    setPrefill('');
    setIsOpen(false);
    // Only on route change: the ref keeps the effect from firing on mount.
  }, [pathname]);

  const openAssistant = useCallback(
    (options: {
      context?: AiLessonContext | null;
      sourceRef?: AiSourceRef | null;
      mode?: AiMode;
      prefill?: string;
      conversationId?: string | null;
    } = {}) => {
      setLessonContext(options.context ?? null);
      setSourceRef(options.sourceRef ?? null);
      setMode(options.mode ?? 'general');
      setPrefill(options.prefill ?? '');
      // A supplied conversation wins; otherwise the thread starts fresh.
      setConversationId(options.conversationId ?? null);
      setIsOpen(true);
    },
    [],
  );

  const continueConversation = useCallback((id: string) => {
    setConversationId(id);
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => setIsOpen(false), []);
  const clearLessonContext = useCallback(() => {
    setLessonContext(null);
    setSourceRef(null);
    setMode('general');
    setPrefill('');
  }, []);
  const resetThread = useCallback(() => {
    setConversationId(null);
    setPrefill('');
  }, []);

  const value = useMemo(
    () => ({
      lessonContext,
      sourceRef,
      mode,
      prefill,
      isOpen,
      conversationId,
      openAssistant,
      continueConversation,
      closeAssistant,
      clearLessonContext,
      setConversationId,
      resetThread,
    }),
    [
      clearLessonContext,
      closeAssistant,
      conversationId,
      continueConversation,
      isOpen,
      lessonContext,
      mode,
      openAssistant,
      prefill,
      resetThread,
      sourceRef,
    ],
  );

  return <AiAssistantContext.Provider value={value}>{children}</AiAssistantContext.Provider>;
}

export function useAiAssistantContext() {
  const value = useContext(AiAssistantContext);
  if (!value) throw new Error('useAiAssistantContext must be used inside AiAssistantProvider');
  return value;
}
