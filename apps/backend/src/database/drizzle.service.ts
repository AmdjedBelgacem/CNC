import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ConfigService } from '../config/config.service';
import * as schema from './schema';
import { safeErrorText } from '../common/security/redact';

/**
 * Arbitrary but fixed key for the advisory lock that serialises the schema
 * DDL below. Any process talking to this database uses the same key, which is
 * the point: it is a lock on the schema, not on this service instance.
 */
const SCHEMA_DDL_LOCK_KEY = 907_310_155;

@Injectable()
export class DrizzleService implements OnModuleInit {
  public db!: PostgresJsDatabase<typeof schema>;
  private client!: postgres.Sql;

  constructor(@Inject(ConfigService) private config: ConfigService) {}

  async onModuleInit() {
    const isSupabase = /pooler\.supabase\.com|supabase\.co/.test(this.config.get('DATABASE_URL') ?? '');

    this.client = postgres(this.config.get('DATABASE_URL'), {
      // Supabase's transaction-mode pooler (Supavisor, port 6543) does not support
      // prepared statements, so this must stay false when pointed at Supabase.
      prepare: false,
      max: this.config.get('DATABASE_POOL_MAX'),
      connect_timeout: this.config.get('DATABASE_CONNECT_TIMEOUT_MS'),
      idle_timeout: 20,
      /**
       * Supabase's pooler hands back an EMPTY search_path, which makes every
       * unqualified reference fail with `relation "tenants" does not exist` — the
       * whole application would be dead on arrival. Force it back to public.
       *
       * Its certificate chain is also not verifiable by the system trust store, so
       * verification has to be relaxed for the pooled host. postgres.js does not
       * honour `sslmode=no-verify`; `ssl: 'no-verify'` alone is not enough either,
       * hence the explicit rejectUnauthorized flag.
       */
      ...(isSupabase
        ? {
            ssl: { rejectUnauthorized: false },
            connection: { search_path: 'public' },
          }
        : {}),
      onnotice: (notice) => {
        if (notice?.message?.includes('already exists, skipping')) return;
        console.warn('[db]', notice?.message ?? notice);
      },
    });
    this.db = drizzle(this.client, { schema });

    // Every column and table ensured below is created by a numbered migration
    // (004, 005, 007, 014, 022, 023, 027), so on any migrated database this is
    // a no-op that still costs an AccessExclusiveLock on each table it names.
    // Tests set SKIP_SCHEMA_DDL because they construct a DrizzleService per
    // spec, and dozens of workers re-running the same ALTER TABLE against a
    // shared database deadlocks ordinary inserts (Postgres 40P01). Deployments
    // should leave it unset: it is the safety net for a clone that predates
    // those migrations.
    if (process.env.SKIP_SCHEMA_DDL === '1') return;

    // Concurrent boots must not race this DDL. `ALTER TABLE` takes an
    // AccessExclusiveLock, so a second process running the same statement
    // deadlocks against the first process's in-flight inserts and aborts
    // with 40P01. This bites two app instances starting together, and test
    // workers that each construct their own DrizzleService. Serialising the
    // DDL makes the loser wait for the lock instead of failing.
    await this.client.unsafe(`SELECT pg_advisory_lock($1)`, [SCHEMA_DDL_LOCK_KEY]);
    // The advisory lock only orders this DDL against other copies of itself.
    // Live traffic can still hold the table, and a deadlock here would take a
    // victim's transaction down with it — under load that victim is an ordinary
    // application write, not the boot that asked for the column. So the DDL
    // waits briefly and then gives up: every statement below is idempotent
    // `IF NOT EXISTS`, and a migration applies the same change properly.
    //
    // This has to beat Postgres' 1s `deadlock_timeout`, otherwise deadlock
    // detection fires before the lock wait expires and the deadlock still wins.
    await this.client.unsafe(`SET lock_timeout = '400ms'`);
    try {
      // Ensure branding/SEO image columns exist — idempotent for fresh clones that haven't run 005_* migration yet.
      try {
        await this.client.unsafe(`ALTER TABLE "academies" ADD COLUMN IF NOT EXISTS "seo_image_url" varchar(500)`);
      } catch (err) {
        // Non-fatal: migration will be applied via drizzle-kit on next deploy
        console.warn('[DrizzleService] ensure seo_image_url column failed (non-fatal)', err);
      }
      // Per-user theme tokens (007_user_theme_tokens) — same idempotent guard, because
      // the theme editor writes to this column and a missing one would 500 on save.
      try {
        await this.client.unsafe(`ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "theme_tokens" jsonb`);
      } catch (err) {
        console.warn(`[DrizzleService] ensure theme_tokens column failed (non-fatal): ${safeErrorText(err)}`);
      }
      // Product academy/course links + SEO + status fields
      try {
        await this.client.unsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "academy_id" uuid REFERENCES "academies"("id") ON DELETE SET NULL`);
        await this.client.unsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "course_id" uuid REFERENCES "courses"("id") ON DELETE SET NULL`);
        await this.client.unsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seo_title" varchar(200)`);
        await this.client.unsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "seo_description" varchar(500)`);
        await this.client.unsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "track_inventory" boolean DEFAULT true`);
        await this.client.unsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_archived" boolean DEFAULT false`);
        await this.client.unsafe(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'draft'`);
        await this.client.unsafe(`CREATE INDEX IF NOT EXISTS "prod_academy_idx" ON "products" ("academy_id")`);
        await this.client.unsafe(`CREATE INDEX IF NOT EXISTS "prod_course_idx" ON "products" ("course_id")`);
      } catch (err) {
        console.warn('[DrizzleService] ensure product relation columns failed (non-fatal)', err);
      }
      // Finance budgets table — idempotent CREATE for fresh clones
      try {
        await this.client.unsafe(`
          CREATE TABLE IF NOT EXISTS "finance_budgets" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
            "period" varchar(20) NOT NULL DEFAULT 'month',
            "category" varchar(50) NOT NULL DEFAULT 'revenue',
            "target_cents" integer NOT NULL DEFAULT 0,
            "notes" text,
            "created_at" timestamp NOT NULL DEFAULT now(),
            "updated_at" timestamp NOT NULL DEFAULT now()
          )
        `);
        await this.client.unsafe(`CREATE INDEX IF NOT EXISTS "finance_budgets_tenant_idx" ON "finance_budgets" ("tenant_id")`);
      } catch (err) {
        console.warn('[DrizzleService] ensure finance_budgets failed (non-fatal)', err);
      }
      try {
        await this.client.unsafe(`
          ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "translations" jsonb;
          ALTER TABLE "series" ADD COLUMN IF NOT EXISTS "translations" jsonb;
          ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "translations" jsonb;
          ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "content_blocks" jsonb;
          CREATE TABLE IF NOT EXISTS "lesson_quiz_attempts" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
            "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "lesson_id" uuid NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
            "quiz_id" varchar(100) NOT NULL,
            "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
            "score" integer NOT NULL,
            "passed" boolean NOT NULL,
            "attempt_number" integer NOT NULL,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
          );
          CREATE UNIQUE INDEX IF NOT EXISTS "lesson_quiz_attempts_tenant_user_lesson_quiz_attempt_idx" ON "lesson_quiz_attempts" ("tenant_id", "user_id", "lesson_id", "quiz_id", "attempt_number");
          CREATE INDEX IF NOT EXISTS "lesson_quiz_attempts_tenant_user_lesson_idx" ON "lesson_quiz_attempts" ("tenant_id", "user_id", "lesson_id");
          CREATE INDEX IF NOT EXISTS "lesson_quiz_attempts_tenant_lesson_quiz_idx" ON "lesson_quiz_attempts" ("tenant_id", "lesson_id", "quiz_id");
          CREATE INDEX IF NOT EXISTS "lesson_quiz_attempts_created_at_idx" ON "lesson_quiz_attempts" ("created_at");
        `);
      } catch (err) {
        console.warn('[DrizzleService] ensure course localization structures failed (non-fatal)', err);
      }
    } finally {
      // Restore the default before handing the connection back: this client is
      // the app's own pool, and a 400ms lock timeout would start aborting real
      // queries that legitimately wait on a contended row.
      await this.client.unsafe(`SET lock_timeout = DEFAULT`);
      await this.client.unsafe(`SELECT pg_advisory_unlock($1)`, [SCHEMA_DDL_LOCK_KEY]);
    }
  }

  async onModuleDestroy() {
    if (this.client) await this.client.end();
  }
}
