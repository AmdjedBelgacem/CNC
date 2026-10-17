-- 041: Enable Row-Level Security on every public table.
--
-- The frontend never talks to Supabase directly; all data access goes through the Nest backend,
-- which authenticates with the service-role key and therefore bypasses RLS. Enabling RLS with
-- no permissive policy therefore blocks the auto-generated PostgREST API (/rest/v1/*) for the
-- anon role without affecting the application.
--
-- This closes two Supabase security-advisor findings:
--   * rls_disabled_in_public  — tables exposed without RLS
--   * sensitive_columns_exposed — password hashes, tokens and PII reachable by anon
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
