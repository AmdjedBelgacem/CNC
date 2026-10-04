'use client';
import { AnimatePresence, m } from 'framer-motion';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme, type ColorMode } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';
import { spring } from '@/lib/motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS: { value: ColorMode; icon: typeof Sun; key: 'light' | 'dark' | 'system' }[] = [
  { value: 'light', icon: Sun, key: 'light' },
  { value: 'dark', icon: Moon, key: 'dark' },
  { value: 'system', icon: Monitor, key: 'system' },
];

export function ThemeToggle() {
  const { colorMode, setColorMode, resolvedMode, hydrated } = useTheme();
  const t = useTranslations('common');
  // SSR and the first client render both show Sun; swapping to Moon only after
  // hydration keeps server/client markup identical (no icon mismatch warning).
  const CurrentIcon = hydrated && resolvedMode === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('appearance')}>
          {/* The sun/moon swap crossfades and rotates instead of snapping. Both
              icons render the same `<svg>`, so the DOM shape is identical and
              this stays hydration-safe — `hydrated` above already guarantees
              server and client agree on which one is showing. */}
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={hydrated ? resolvedMode : 'light'}
              className="flex"
              initial={{ opacity: 0, rotate: -60, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1, transition: spring.snappy }}
              exit={{ opacity: 0, rotate: 60, scale: 0.7, transition: { duration: 0.1 } }}
            >
              <CurrentIcon />
            </m.span>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() => setColorMode(opt.value)}
              className={colorMode === opt.value ? 'font-semibold text-primary' : undefined}
            >
              <Icon />
              {t(opt.key)}
              {colorMode === opt.value && <span className="ms-auto text-xs">✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
