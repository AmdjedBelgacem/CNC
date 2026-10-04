/**
 * Vercel Functions entrypoint for the backend service.
 *
 * `main.ts` binds a port via `app.listen()`, which is correct for a long-running process
 * but wrong for a function: a function must return a request handler and must never bind
 * a port. This file builds the same configured Nest app through `createApp()` and exports
 * an Express-style `(req, res)` handler for the Vercel Node.js runtime.
 *
 * Lives inside `src/` because the Nest build sets `rootDir: src`, so a sibling `api/`
 * directory is rejected by tsc (TS6059). It compiles to `dist/vercel-entry.js`, which is
 * the path referenced by `entrypoint` in vercel.json.
 *
 * CAVEAT: Nest-on-Fastify behind the Vercel Node runtime is the least certain part of
 * this deployment. Verify with `vercel dev` and a real deploy before relying on it.
 */
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from './main';

let cached: Promise<NestFastifyApplication> | null = null;

/**
 * A function instance is reused across invocations, so the app — and its connection
 * pool and schema setup — is built once and memoised rather than per request.
 */
function getApp(): Promise<NestFastifyApplication> {
  if (!cached) {
    cached = createApp().catch((error) => {
      // Never cache a failed boot, or one transient failure bricks the whole instance.
      cached = null;
      throw error;
    });
  }
  return cached;
}

const handler = async (req: unknown, res: unknown) => {
  const app = await getApp();
  // Fastify attaches its request listener to the underlying http.Server during `ready()`,
  // so emitting 'request' routes the invocation through the same listener that
  // `app.listen()` would have used, keeping local and deployed behaviour identical.
  return app.getHttpAdapter().getInstance().server.emit('request', req, res);
};

export default handler;
