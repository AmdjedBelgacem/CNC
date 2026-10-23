'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AI_ARABIC_DIALECTS, type AiArabicDialect } from '@/lib/api/types';

const STORAGE_KEY = 'titans.ai.arabic-dialect';

const DIALECT_LABEL_KEYS: Record<AiArabicDialect, string> = {
  auto: 'dialect.auto',
  msa: 'dialect.msa',
  egyptian: 'dialect.egyptian',
  gulf: 'dialect.gulf',
  levantine: 'dialect.levantine',
  maghrebi: 'dialect.maghrebi',
  iraqi: 'dialect.iraqi',
};

function isDialect(value: unknown): value is AiArabicDialect {
  return typeof value === 'string' && (AI_ARABIC_DIALECTS as readonly string[]).includes(value);
}

/**
 * The preference is intentionally stored outside this component as well as in
 * localStorage: the full chat page and the floating widget are separate React
 * trees, and a member who chose Egyptian in one should not have to choose it
 * again in the other after a navigation.
 */
export function useArabicDialectPreference() {
  const [dialect, setDialectState] = useState<AiArabicDialect>('auto');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isDialect(saved)) setDialectState(saved);
    } catch {
      // Private browsing or a disabled storage API: auto is a safe default.
    }
  }, []);

  const setDialect = (next: AiArabicDialect) => {
    setDialectState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The in-memory choice still applies for this mounted chat surface.
    }
  };

  return [dialect, setDialect] as const;
}

export function ArabicDialectMenu({
  value,
  onChange,
}: {
  value: AiArabicDialect;
  onChange: (value: AiArabicDialect) => void;
}) {
  const t = useTranslations('aiAssistant');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          aria-label={t('dialect.title')}
          title={t('dialect.title')}
        >
          <Languages className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">{t(DIALECT_LABEL_KEYS[value])}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>{t('dialect.title')}</DropdownMenuLabel>
        {AI_ARABIC_DIALECTS.map((option) => (
          <DropdownMenuItem
            key={option}
            onSelect={() => onChange(option)}
            className="justify-between"
          >
            <span className="flex items-center gap-2">
              <span>{t(DIALECT_LABEL_KEYS[option])}</span>
              {option === 'auto' && (
                <span className="text-2xs text-muted-foreground">{t('dialect.autoHint')}</span>
              )}
            </span>
            {value === option && <Check className="size-3.5 text-primary" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
