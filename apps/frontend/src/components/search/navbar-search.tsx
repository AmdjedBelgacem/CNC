'use client';

import { Command, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { openPublicSearch } from '@/components/search/public-search-palette';
import { Button } from '@/components/ui/button';

export function NavbarSearch() {
  const t = useTranslations('search');
  return (
    <>
      <button
        type="button"
        onClick={openPublicSearch}
        aria-haspopup="dialog"
        aria-label={t('openCommand')}
        className="group hidden h-10 w-52 items-center gap-2.5 rounded-xl border border-border bg-muted/45 px-3 text-start text-sm text-muted-foreground transition hover:border-primary/30 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex xl:w-64"
      >
        <Search className="size-4 shrink-0 text-primary transition group-hover:scale-105" />
        <span className="min-w-0 flex-1 truncate">{t('placeholder')}</span>
        <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground xl:inline-flex"><Command className="size-3" />K</kbd>
      </button>
      {/* Below `xl` the header has no room for the wide field — ⌘K still opens it. */}
      <Button
        variant="ghost"
        size="icon"
        className="xl:hidden"
        aria-label={t('openCommand')}
        aria-haspopup="dialog"
        onClick={openPublicSearch}
      >
        <Search />
      </Button>
    </>
  );
}
