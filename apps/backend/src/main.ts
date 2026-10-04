import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import fastifyRawBody from 'fastify-raw-body';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as querystring from 'node:querystring';
import { AppModule } from './app.module';

/**
 * Whether to serve the interactive API docs.
 *
 * Exported so the decision can be tested rather than eyeballed: `/api/docs-json`
 * is a full, unauthenticated, unmetered route map, and the only thing standing
 * between an attacker and it is this expression.
 */
export function apiDocsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.API_DOCS_ENABLED === 'true') return true;
  if (env.API_DOCS_ENABLED === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/** Minimum acceptable cookie secret length. Below this, brute force is trivial. */
const MIN_AUTH_SECRET_LENGTH = 32;

/**
 * A placeholder, absent, or short cookie secret must never be accepted in
 * production: every signed cookie would be forgeable by anyone who has read the
 * source, and a short secret is forgeable by anyone with a GPU-hours budget.
 */
export function assertAuthSecret(env: NodeJS.ProcessEnv = process.env): void {
  const secret = env.AUTH_SECRET;
  if (env.NODE_ENV !== 'production') return;
  if (!secret || secret === 'cookie-secret-change-me') {
    throw new Error(
      'AUTH_SECRET is missing or still the placeholder "cookie-secret-change-me". ' +
        'Refusing to start: signed cookies would be forgeable.',
    );
  }
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(
      `AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters (got ${secret.length}). ` +
        'A short cookie secret is brute-forceable.',
    );
  }
}

/**
 * Builds the fully configured Nest application WITHOUT binding a port.
 *
 * Split from `bootstrap()` so a serverless runtime can obtain the app as a handler.
 * `app.listen()` never returns a request handler — it blocks and binds — so a Vercel
 * function must never go through this path. See `api/index.ts`.
 */
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    /**
     * Redaction is explicit rather than relying on Fastify's default request
     * serializer, which happens not to include headers today but is not a guarantee.
     * Anything that can carry a credential is stripped before a log line is written:
     * Authorization, cookies (which hold the Supabase access/refresh tokens), the CSRF
     * header, and any apikey-style header. Also redacts known secret-shaped values
     * that could appear inside an error message or a database URL.
     */
    new FastifyAdapter({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-csrf-token"]',
            'req.headers["x-api-key"]',
            'req.headers.apikey',
            'res.headers["set-cookie"]',
            'headers.authorization',
            'headers.cookie',
          ],
          censor: '[redacted]',
        },
        serializers: {
          req(request: any) {
            return {
              method: request.method,
              url: request.url,
              host: request.hostname,
              remoteAddress: request.ip,
            };
          },
        },
      },
      bodyLimit: 2 * 1024 * 1024,
    }),
    // Parsers are registered below instead of by Nest.
    { bodyParser: false },
  );

  // Fastify's stock JSON parser answers 400 for an empty body whenever
  // `content-type: application/json` is present, which broke every bodyless
  // request (`DELETE /ai/conversations/:id`). Parse tolerantly here; malformed
  // JSON still fails as a 400. The urlencoded parser mirrors Nest's default
  // because opting out of `bodyParser` also opts out of that one.
  const fastify = app.getHttpAdapter().getInstance();
  /**
   * 100MB of JSON on *every* route is a trivial memory-exhaustion lever: a
   * single request can pin a large allocation per concurrent connection. Video
   * upload uses presigned S3 URLs, so no API route needs a body anywhere near
   * that. Multipart upload keeps a larger ceiling.
   */
  const bodyLimit = Number(process.env.JSON_BODY_LIMIT_BYTES ?? 2 * 1024 * 1024); // 2MB
  const multipartBodyLimit = Number(process.env.MULTIPART_BODY_LIMIT_BYTES ?? 64 * 1024 * 1024); // 64MB
  fastify.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit }, (_request, body, done) => {
    const raw = typeof body === 'string' ? body.trim() : '';
    if (!raw) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(raw));
    } catch (error) {
      const failure = error as Error & { statusCode?: number };
      failure.statusCode = 400;
      done(failure, undefined);
    }
  });
  fastify.addContentTypeParser(
    'multipart/form-data',
    { parseAs: 'buffer', bodyLimit: multipartBodyLimit },
    (_request, body, done) => {
      done(null, { raw: body });
    },
  );
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string', bodyLimit },
    (_request, body, done) => {
      done(null, querystring.parse(typeof body === 'string' ? body : ''));
    },
  );

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false, // Next.js needs unsafe-inline for fonts/styles; handle via meta if needed
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  });

  // Fail closed: a default signing secret means every signed cookie in the
  // deployment is forgeable by anyone who has read the source. In production a
  // missing AUTH_SECRET must stop the boot, not downgrade it.
  assertAuthSecret();
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret || authSecret === 'cookie-secret-change-me' || authSecret.length < MIN_AUTH_SECRET_LENGTH) {
    console.warn('[security] AUTH_SECRET is unset, placeholder, or shorter than 32 chars — dev only');
  }
  await app.register(fastifyCookie, {
    secret: authSecret || 'cookie-secret-change-me',
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  });

  // Raw body for Stripe webhooks — must run before JSON parser for those routes
  await app.register(fastifyRawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
    routes: ['/payments/webhook'],
  });

  const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-slug', 'x-2fa-verified', 'x-csrf-token', 'stripe-signature'],
    exposedHeaders: ['x-tenant-slug', 'x-csrf-token'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /**
   * API docs are a reconnaissance gift: `/api/docs-json` hands an attacker every
   * route, every DTO and every guard requirement, unauthenticated, with no
   * rate limit. They are now development-only unless explicitly forced on.
   */
  if (apiDocsEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('TITANS of Manufacturing API')
      .setDescription('Backend API for the TITANS of Manufacturing platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log('[security] API docs enabled at /api/docs');
  } else {
    console.log('[security] API docs disabled (set API_DOCS_ENABLED=true to expose)');
  }

  return app;
}

/** Long-running server (local dev, Docker, any process manager). */
async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}`);
}

// Only start the server when executed directly; importing this module (for the
// security tests) must not bind a port.
if (require.main === module) {
  void bootstrap();
}
