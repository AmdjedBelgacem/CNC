import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { PlatformAlertsController } from '../src/modules/notifications/platform-alerts.controller';
import { PlatformAlertsService } from '../src/modules/notifications/platform-alerts.service';

/**
 * Route-shape guard.
 *
 * The platform feed is a super-admin-only surface, so the paths the admin UI
 * calls have to match the paths the controller declares. Nothing else in the
 * suite exercises the routing layer, and the failure mode is silent: a handler
 * can carry `@Param('id')` while its path declares no `:id`, which registers
 * `POST /read` and leaves the client's `read/{id}` call answering 404 with no
 * test failing anywhere.
 *
 * The application runs on Fastify, so the assertions read the route tree the
 * real adapter builds rather than a hand-written copy of the decorators.
 */
describe('platform alert routes', () => {
  /** `METHOD /full/path` for every route the adapter registered. */
  let routes: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformAlertsController],
    })
      // Every dependency is stubbed: this suite inspects routing, not behaviour.
      .overrideProvider(PlatformAlertsService)
      .useValue({})
      .compile();

    const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    const instance = app.getHttpAdapter().getInstance();
    await instance.ready();

    // `printRoutes` emits an indented tree whose child paths are relative to
    // their parent, so the prefix has to be threaded down while walking it.
    const stack: string[] = [];
    routes = [];
    for (const line of instance.printRoutes({ commonPrefix: false }).split('\n')) {
      const match = line.match(/^(\s*)(?:[│├└]──\s*)?(\S*)\s*\(([^)]*)\)\s*$/);
      if (!match) continue;
      const [, indent, path, methods] = match;
      const depth = Math.floor(indent.length / 4);
      stack.length = depth;
      stack[depth] = `${stack[depth - 1] ?? ''}${path}`;
      for (const method of methods.split(',')) {
        routes.push(`${method.trim().toUpperCase()} ${stack[depth]}`);
      }
    }
    await app.close();
  });

  const serves = (method: string, path: string) => routes.includes(`${method} ${path}`);

  it('serves the feed, overview, settings and registry', () => {
    expect(serves('GET', '/admin/platform-alerts')).toBe(true);
    expect(serves('GET', '/admin/platform-alerts/overview')).toBe(true);
    expect(serves('GET', '/admin/platform-alerts/settings')).toBe(true);
    expect(serves('PUT', '/admin/platform-alerts/settings')).toBe(true);
    expect(serves('GET', '/admin/platform-alerts/groups')).toBe(true);
  });

  it('declares :id in the mark-read path, so the id actually binds', () => {
    expect(serves('POST', '/admin/platform-alerts/read/:id')).toBe(true);
    // A parameterless `read` route cannot receive the id the admin UI sends.
    expect(serves('POST', '/admin/platform-alerts/read')).toBe(false);
  });

  it('keeps read-all distinct from read-one', () => {
    expect(serves('POST', '/admin/platform-alerts/read-all')).toBe(true);
    // Exactly two read endpoints, so a later edit cannot add an ambiguous
    // alias that `read/:id` would shadow for the id-less POST.
    expect(routes.filter((r) => r.includes('/read')).sort()).toEqual([
      'POST /admin/platform-alerts/read-all',
      'POST /admin/platform-alerts/read/:id',
    ]);
  });

  it('exposes no personal-feed route on this controller', () => {
    // The personal feed is a separate controller; reusing it here would break
    // the two-stream separation.
    expect(routes.some((r) => r.includes('/notifications'))).toBe(false);
  });
});
