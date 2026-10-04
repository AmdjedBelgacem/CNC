-- 022b: per-locale page layouts for the site builder

-- A builder page is a single JSON blob: hero, stats, program cards, testimonials,
-- FAQ and CTA all live in `layout`, with no per-field translation slot. An Arabic
-- visitor therefore saw the English marketing copy on every landing page.
--
-- Rather than reshape the document format (which the Puck editor and every block
-- renderer depend on), a locale gets its own full copy of the layout. That is
-- blunt, but it is the only option that does not break the editor, and it lets an
-- author translate a page independently of the English one.

ALTER TABLE "pages"
  ADD COLUMN IF NOT EXISTS "translations" jsonb;

COMMENT ON COLUMN "pages"."translations" IS 'Per-locale copy: {"ar":{"title":…,"layout":<full Arabic layout>}}';
