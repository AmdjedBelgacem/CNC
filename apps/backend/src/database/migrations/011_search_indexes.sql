CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS academies_search_trgm_idx ON "academies" USING gin ((lower(coalesce("title", '') || ' ' || coalesce("subtitle", '') || ' ' || coalesce("description", '') || ' ' || coalesce("slug", ''))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS courses_search_trgm_idx ON "courses" USING gin ((lower(coalesce("title", '') || ' ' || coalesce("subtitle", '') || ' ' || coalesce("description", '') || ' ' || coalesce("slug", ''))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS series_search_trgm_idx ON "series" USING gin ((lower(coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("slug", ''))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS lessons_search_trgm_idx ON "lessons" USING gin ((lower(coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("slug", ''))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_search_trgm_idx ON "products" USING gin ((lower(coalesce("title", '') || ' ' || coalesce("tagline", '') || ' ' || coalesce("description", '') || ' ' || coalesce("slug", ''))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS posts_search_trgm_idx ON "posts" USING gin (lower(coalesce("content", '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS events_search_trgm_idx ON "events" USING gin ((lower(coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("slug", ''))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_search_trgm_idx ON "users" USING gin ((lower(coalesce("name", '') || ' ' || coalesce("username", '') || ' ' || coalesce("headline", '') || ' ' || coalesce("bio", '') || ' ' || coalesce("email", ''))) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS pages_search_trgm_idx ON "pages" USING gin ((lower(coalesce("title", '') || ' ' || coalesce("slug", ''))) gin_trgm_ops);
