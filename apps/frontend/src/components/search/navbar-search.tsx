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
        className="group hidden h-10 w-52 items-center gap-2.5 rounded-full border border-border/80 bg-muted/50 px-3.5 text-start text-sm text-muted-foreground transition-[background-color,border-color,box-shadow,color] duration-200 hover:border-border-strong hover:bg-card hover:text-foreground hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex xl:w-64"
      >
        <Search className="size-4 shrink-0 transition-colors duration-200 group-hover:text-primary" />
        <span className="min-w-0 flex-1 truncate">{t('placeholder')}</span>
        <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shadow-xs xl:inline-flex"><Command className="size-3" />K</kbd>
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
