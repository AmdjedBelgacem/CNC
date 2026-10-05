-- Indexes for the hot public read paths.
--
-- Found while load-testing the course detail endpoint: `series` and `lessons` carried only
-- their primary keys, so both lookups the detail page depends on were sequential scans:
--
--   EXPLAIN SELECT * FROM series  WHERE course_id = $1;
--     -> Seq Scan on series  (Filter: course_id = ...)
--   EXPLAIN SELECT * FROM lessons WHERE series_id = $1;
--     -> Seq Scan on lessons (Filter: series_id = ...)
--
-- That is cheap at seed size (12 series / 36 lessons) and expensive at catalogue size, and it
-- is on the single most requested read path in the product. `courses` was already indexed
-- correctly (`tenant_slug_idx`, `published_idx`), which is why the listing was faster than
-- the detail page.
--
-- Composite keys include the sort column where the query orders by it, so Postgres can use
-- the index for ordering instead of sorting after the fact.

CREATE INDEX IF NOT EXISTS "series_course_id_sort_idx"
  ON "series" ("course_id", "sort_order");

CREATE INDEX IF NOT EXISTS "lessons_series_id_sort_idx"
  ON "lessons" ("series_id", "sort_order");

-- Course detail also reads the owning academy and the tenant on every request.
CREATE INDEX IF NOT EXISTS "lessons_tenant_id_idx"
  ON "lessons" ("tenant_id");

CREATE INDEX IF NOT EXISTS "series_tenant_id_idx"
  ON "series" ("tenant_id");

-- "Continue watching" is always (user, newest first); without this the learner's dashboard
-- sorts the whole table. Note the table has no `course_id` — progress is tracked per lesson.
CREATE INDEX IF NOT EXISTS "lesson_progress_user_created_idx"
  ON "lesson_progress" ("user_id", "created_at" DESC);

-- Notifications poll on (user, created_at desc).
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx"
  ON "notifications" ("user_id", "created_at" DESC);
