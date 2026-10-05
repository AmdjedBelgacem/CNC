import 'dotenv/config';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

/**
 * Values that must never sign anything in production. These are the defaults that used to
 * let a production boot succeed with publicly-known signing keys.
 */
const PLACEHOLDER_SECRETS = new Set([
  'access-secret-change-me',
  'refresh-secret-change-me',
  'cookie-secret-change-me',
  'change-me',
  'changeme',
  'secret',
  'password',
  'test',
  'dev',
]);

const MIN_PROD_SECRET_LENGTH = 32;

/** Secrets that must be strong whenever NODE_ENV=production. */
const PROD_REQUIRED_SECRETS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'AUTH_SECRET'] as const;

/**
 * Storage config that must be present in production.
 *
 * S3_PUBLIC_URL is what makes avatars and covers actually reachable. Without it the
 * upload service silently falls back to local disk, so every avatar URL would point at
 * an ephemeral filesystem and appear broken only after a deploy. S3_MEDIA_BUCKET must be
 * set and must differ from S3_BUCKET: sharing one bucket would put paid lesson video in
 * a public-read bucket.
 */
const PROD_REQUIRED_STORAGE = ['S3_BUCKET', 'S3_MEDIA_BUCKET', 'S3_PUBLIC_URL'] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4000),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    // Public origin of this API. OAuth providers call back here, so it must be the
    // address reachable from the internet — not the browser-facing frontend.
    API_PUBLIC_URL: z.string().url().optional(),
    DATABASE_URL: z.string().min(1),
    /**
     * Pool sizing. Supabase's pooler enforces a per-client connection cap (the
     * free tier's transaction pooler allows very few), and direct connections are
     * IPv6-only unless the IPv4 add-on is enabled. Keep `max` comfortably under the
     * project's limit so the pooler never rejects new connections under load.
     */
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
    REDIS_URL: z
      .string()
      .min(1)
      // Only shape-checked. The value is validated for "did anyone fill this in" at boot
      // (see warnOnPlaceholderSecrets) rather than here, because refusing to start over a
      // missing cache would take the whole API down for a rate-limit dependency.
      .refine((value) => !/YOUR[-_A-Z0-9]*|CHANGEME|<[^>]+>/i.test(value), {
        message:
          'REDIS_URL still contains a template placeholder. Set a real Redis URL, or unset it to run without Redis.',
      }),
    AUTH_SECRET: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(1).default('access-secret-change-me'),
    JWT_REFRESH_SECRET: z.string().min(1).default('refresh-secret-change-me'),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),
    JWT_REFRESH_EXPIRY_REMEMBER: z.string().default('30d'),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().email().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    // Currency the payment provider actually charges in. The storefront displays
    // prices converted from the product currency, so this must be an explicit
    // decision rather than a hardcoded literal that silently disagrees with the UI.
    PAYMENTS_CURRENCY: z
      .string()
      .length(3)
      .regex(/^[a-z]{3}$/i, 'must be a 3-letter ISO currency code')
      .default('usd'),
    MUX_TOKEN_ID: z.string().optional(),
    MUX_TOKEN_SECRET: z.string().optional(),
    // Optional at the schema level so a deploy without storage still boots; the
    // production gate below refuses to start without them.
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    /** Private bucket for paid lesson video. Must differ from S3_BUCKET. */
    S3_MEDIA_BUCKET: z.string().optional(),
    /** Public base URL serving S3_BUCKET, e.g. https://<ref>.supabase.co/storage/v1/object/public/<bucket> */
    S3_PUBLIC_URL: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_ENDPOINT: z.string().optional(),
    MEILISEARCH_HOST: z.string().default('http://localhost:7700'),
    MEILISEARCH_API_KEY: z.string().default('masterKey'),
    RESEND_API_KEY: z.string().optional(),
    ARGON2_TIME_COST: z.coerce.number().default(3),
    ARGON2_MEMORY_COST: z.coerce.number().default(65536),
    ARGON2_PARALLELISM: z.coerce.number().default(4),
    AI_ASSISTANT_ENCRYPTION_KEY: z.string().optional(),

    /**
     * Phase 2: Supabase Auth as the identity provider.
     *
     * Tenancy, RBAC and sessions stay in this application — Supabase only answers
     * "who is this?". `SUPABASE_JWT_SECRET` is the project JWT secret used to verify
     * tokens the backend receives; `SUPABASE_SERVICE_ROLE_KEY` is admin-only and must
     * never reach a browser. `SUPABASE_AUTH_ENABLED` gates the whole integration so it
     * can be switched off without a deploy.
     */
    SUPABASE_AUTH_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    SUPABASE_URL: z.string().url().optional(),
    /**
     * Modern Supabase projects publish an asymmetric signing key at the JWKS endpoint
     * (ES256 by default) instead of a shared HS256 secret. When SUPABASE_JWKS_URL is
     * present it is authoritative and the verifier checks those signatures; the shared
     * secret is only used by older projects that still sign with HS256.
     */
    SUPABASE_JWKS_URL: z.string().url().optional(),
    SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    SUPABASE_SECRET_KEY: z.string().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_JWT_SECRET: z.string().optional(),
    AI_SECRET_ENCRYPTION_KEY: z.string().optional(),
    AI_PROVIDER_ALLOWED_HOSTS: z.string().optional(),
    AI_PROVIDER_MAX_RESPONSE_BYTES: z.coerce.number().int().min(1024).max(10_000_000).default(1_048_576),
    AI_PROVIDER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15_000),
    AI_PROVIDER_ALLOW_PRIVATE_HOSTS: z.string().optional(),
    FX_RATES_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),

    // --- Moyasar (primary payment gateway) --------------------------------
    /** Master key for encrypting payment and OAuth secrets at rest (32 bytes, hex or base64). */
    SECRETS_ENCRYPTION_KEY: z.string().optional(),
    /** pk_test_ / pk_live_. Safe to expose to the browser. */
    MOYASAR_PUBLISHABLE_KEY: z.string().optional(),
    /** sk_test_ / sk_live_. Server-only. Never returned by any endpoint. */
    MOYASAR_SECRET_KEY: z.string().optional(),
    /** Shared secret Moyasar echoes in webhooks so they can be authenticated. */
    MOYASAR_WEBHOOK_SECRET: z.string().optional(),
    MOYASAR_CURRENCY: z.string().length(3).default('SAR'),

    // --- Google OAuth (platform-level integrations) -----------------------
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
    /** Required for Google Ads API calls. Without it Ads shows a blocked reason. */
    GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // Fail closed: a production boot must never proceed on placeholder or weak secrets.
    if (val.NODE_ENV !== 'production') return;
    for (const key of PROD_REQUIRED_SECRETS) {
      const value = val[key] as string | undefined;
      if (!value || PLACEHOLDER_SECRETS.has(value.toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is unset or still a placeholder — refusing to start with a publicly-known signing key in production`,
        });
      } else if (value.length < MIN_PROD_SECRET_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be at least ${MIN_PROD_SECRET_LENGTH} characters in production (got ${value.length})`,
        });
      }
    }
    for (const key of PROD_REQUIRED_STORAGE) {
      const value = val[key] as string | undefined;
      if (!value || !value.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required in production — without it uploads silently fall back to local disk (or media is served from a public bucket)`,
        });
      }
    }
    if (val.S3_BUCKET && val.S3_MEDIA_BUCKET && val.S3_BUCKET === val.S3_MEDIA_BUCKET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_MEDIA_BUCKET'],
        message:
          'S3_MEDIA_BUCKET must not equal S3_BUCKET: paid lesson video must live in a separate private bucket, never the public asset bucket',
      });
    }
    if (val.S3_PUBLIC_URL && !val.S3_PUBLIC_URL.includes(val.S3_BUCKET || '\u0000')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_PUBLIC_URL'],
        message: `S3_PUBLIC_URL must address S3_BUCKET ("${val.S3_BUCKET}") — it will otherwise serve the wrong paths`,
      });
    }

    const hasAiEncryptionKey = [val.AI_ASSISTANT_ENCRYPTION_KEY, val.AI_SECRET_ENCRYPTION_KEY]
      .some((value) => typeof value === 'string' && value.trim().length > 0);
    if (!hasAiEncryptionKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_ASSISTANT_ENCRYPTION_KEY'],
        message: 'AI encryption key is required in production',
      });
    }
    if (!val.AI_PROVIDER_ALLOWED_HOSTS?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_PROVIDER_ALLOWED_HOSTS'],
        message: 'AI_PROVIDER_ALLOWED_HOSTS is required in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

@Injectable()
export class ConfigService {
  readonly env: Env;

  constructor() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment variables:');
      for (const issue of result.error.issues) {
        console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
      }
      process.exit(1);
    }
    this.env = result.data;
  }

  get<T extends keyof Env>(key: T): Env[T] {
    return this.env[key];
  }
}
