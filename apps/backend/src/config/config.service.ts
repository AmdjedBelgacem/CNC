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

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4000),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
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
    MUX_TOKEN_ID: z.string().optional(),
    MUX_TOKEN_SECRET: z.string().optional(),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_REGION: z.string().default('us-east-1'),
    S3_ENDPOINT: z.string().optional(),
    MEILISEARCH_HOST: z.string().default('http://localhost:7700'),
    MEILISEARCH_API_KEY: z.string().default('masterKey'),
    RESEND_API_KEY: z.string().optional(),
    ARGON2_TIME_COST: z.coerce.number().default(3),
    ARGON2_MEMORY_COST: z.coerce.number().default(65536),
    ARGON2_PARALLELISM: z.coerce.number().default(4),
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
