import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  applyPageTranslations,
  expandHeroConsoleLayout,
  harvestPageLayout,
  arabicPageLayout,
  migrateLegacyLayout,
  type PageLayout,
} from '@titan/shared';
import { DrizzleService } from '../../database/drizzle.service';
import { pages } from '../../database/schema/pages';
import { AiTranslationService } from '../ai/ai-translation.service';

const ARABIC = /[؀-ۿ]/;
const LATIN_WORD = /[A-Za-z]{2,}/;
const CHUNK = 30;

/**
 * Fills in the Arabic copy of a published page.
 *
 * A page with no Arabic translation was published with its English layout copied in as the
 * "Arabic" version, so Arabic visitors read English headings inside a right-to-left page while
 * every live section around them was Arabic — the most visible case of the live site not
 * matching the builder. After each publish, every text field that is still English is translated
 * once with the configured AI provider and written into `translations.ar`. Text an editor has
 * already written in Arabic is never touched, and a field edited while the translation ran is
 * left alone.
 */
@Injectable()
export class PageAutoTranslateService {
  private readonly logger = new Logger(PageAutoTranslateService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly translator: AiTranslationService,
  ) {}

  /** Starts in the background; publishing never waits on it. */
  schedule(tenantId: string, pageId: string): void {
    if (this.running.has(pageId)) return;
    this.running.add(pageId);
    void this.fillArabic(tenantId, pageId)
      .catch((error: unknown) => {
        this.logger.warn(`Arabic auto-translation skipped for page ${pageId}: ${error instanceof Error ? error.message : error}`);
      })
      .finally(() => this.running.delete(pageId));
  }

  /** Returns how many fields were translated. */
  async fillArabic(tenantId: string, pageId: string): Promise<number> {
    const before = await this.load(pageId);
    if (!before) return 0;
    const draft = harvestPageLayout(before.arabic);
    const pending: Record<string, string> = {};
    for (const [key, value] of Object.entries(draft.fields)) {
      if (needsTranslation(value)) pending[key] = value;
    }
    const keys = Object.keys(pending);
    if (keys.length === 0) return 0;

    const translations: Record<string, string> = {};
    for (let index = 0; index < keys.length; index += CHUNK) {
      const fields = Object.fromEntries(keys.slice(index, index + CHUNK).map((key) => [key, pending[key]!]));
      const result = await this.translator.translateFields(tenantId, {
        sourceLocale: 'en',
        targetLocale: 'ar',
        fields,
        entity: 'website page',
      });
      Object.assign(translations, result.translations);
    }

    // Re-read: an editor may have saved Arabic text while the provider was working. Only fields
    // that still hold the exact English text that was sent are replaced.
    const after = await this.load(pageId);
    if (!after) return 0;
    const fresh = harvestPageLayout(after.arabic);
    const apply: Record<string, string> = {};
    for (const field of fresh.harvested) {
      const translated = translations[field.key];
      if (translated && field.value === pending[field.key]) apply[field.key] = translated;
    }
    if (Object.keys(apply).length === 0) return 0;
    const layout = applyPageTranslations(fresh, apply);
    const current = (after.row.translations ?? {}) as Record<string, Record<string, unknown>>;
    const titleAr =
      typeof current.ar?.title === 'string' && ARABIC.test(current.ar.title as string)
        ? (current.ar.title as string)
        : await this.translateTitle(tenantId, after.row.title).catch(() => current.ar?.title ?? after.row.title);
    await this.drizzle.db
      .update(pages)
      .set({ translations: { ...current, ar: { ...(current.ar ?? {}), title: titleAr, layout } } as never })
      .where(eq(pages.id, pageId));
    return Object.keys(apply).length;
  }

  private async translateTitle(tenantId: string, title: string): Promise<string> {
    if (!needsTranslation(title)) return title;
    const result = await this.translator.translateFields(tenantId, {
      sourceLocale: 'en',
      targetLocale: 'ar',
      fields: { title },
      entity: 'website page title',
    });
    return result.translations.title || title;
  }

  private async load(pageId: string) {
    const row = await this.drizzle.db.query.pages.findFirst({ where: eq(pages.id, pageId) });
    if (!row) return null;
    const english = expandHeroConsoleLayout(migrateLegacyLayout(row.layout as PageLayout));
    const stored = (row.translations as Record<string, { layout?: PageLayout }> | null)?.ar?.layout;
    // Built-in strings come from the shipped dictionary, so only text an admin wrote costs a call.
    const arabic = arabicPageLayout(english, stored ? expandHeroConsoleLayout(migrateLegacyLayout(stored)) : null);
    return { row, english, arabic };
  }
}

/** English copy that an Arabic visitor would otherwise read untranslated. */
export function needsTranslation(value: string): boolean {
  const text = value.trim();
  if (!text || ARABIC.test(text) || !LATIN_WORD.test(text)) return false;
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(text)) return false;
  return true;
}
