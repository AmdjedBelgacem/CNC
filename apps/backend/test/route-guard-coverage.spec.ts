import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Route-guard coverage.
 *
 * The audit found student/public write routes that were reachable without any
 * tenant scoping, so an authenticated user from tenant A could mutate tenant B's
 * data. Guards were added by hand; this test keeps them there.
 *
 * It is a static check over the controller sources — deliberately so, because it
 * must also cover routes that a runtime smoke test would never reach. Any route
 * that is neither `@Public()` nor explicitly tenant-scoped is flagged.
 */

const SRC = join(__dirname, '..', 'src');

/** Controllers that expose tenant-owned resources and MUST scope every route. */
const TENANT_SCOPED_CONTROLLERS = [
  'modules/courses/courses.controller.ts',
  'modules/events/events.controller.ts',
  'modules/academies/academies.controller.ts',
];

const ALL_DECORATORS = ['@Get(', '@Post(', '@Put(', '@Patch(', '@Delete('];
const TENANT_GUARDS = ['TenantGuard', 'TenantScopeGuard'];

interface RouteBlock {
  line: number;
  decorator: string;
  handler: string;
  decorators: string[];
}

/**
 * Collect each route's decorator block.
 *
 * In NestJS the HTTP decorator comes FIRST and the guard decorators follow it,
 * immediately above the handler signature:
 *
 *   @Post(':id/register')
 *   @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
 *   async register(...) {}
 *
 * so the block is gathered by walking FORWARD from the route decorator.
 */
function parseRoutes(source: string): RouteBlock[] {
  const lines = source.split('\n');
  const routes: RouteBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const routeDec = ALL_DECORATORS.find((d) => line.includes(d));
    if (!routeDec) continue;

    const decorators: string[] = [];
    let handler = '';
    for (let j = i + 1; j < Math.min(lines.length, i + 14); j++) {
      const candidate = lines[j]!.trim();
      if (candidate.startsWith('@')) {
        decorators.push(candidate);
        continue;
      }
      if (candidate === '' || candidate.startsWith('//') || candidate.startsWith('*')) continue;
      if (/^(async\s+)?[a-zA-Z_$][\w$]*\s*\(/.test(candidate)) {
        handler = candidate;
        break;
      }
      // A `}` or a non-decorator statement means the route decorator belongs to
      // something else (e.g. a stray call) — stop.
      if (candidate.startsWith('}')) break;
    }
    routes.push({ line: i + 1, decorator: routeDec, handler, decorators });
  }
  return routes;
}

const isWrite = (r: RouteBlock) =>
  ['@Post(', '@Put(', '@Patch(', '@Delete('].includes(r.decorator);

describe('Route-guard coverage — tenant-owned controllers', () => {
  for (const rel of TENANT_SCOPED_CONTROLLERS) {
    const path = join(SRC, rel);
    describe(rel, () => {
      it('source exists', () => {
        expect(existsSync(path)).toBe(true);
      });

      const source = existsSync(path) ? readFileSync(path, 'utf8') : '';
      // Class-level `@UseGuards(... TenantScopeGuard ...)` above `@Controller`
      // scopes every route in the file.
      const controllerIdx = source.indexOf('@Controller(');
      const classLevelScoped =
        controllerIdx > -1 &&
        /@UseGuards\([^)]*TenantScopeGuard/.test(source.slice(0, controllerIdx));
      const classLevelPublic = /@Public\(\)[\s\S]{0,80}@Controller\(/.test(source);

      const routes = parseRoutes(source);

      it('declares at least one route', () => {
        expect(routes.length).toBeGreaterThan(0);
      });

      for (const route of routes) {
        if (!isWrite(route)) continue;
        const isPublic = classLevelPublic || route.decorators.some((d) => d.startsWith('@Public('));
        const hasScope =
          classLevelScoped ||
          route.decorators.some((d) => TENANT_GUARDS.every((g) => d.includes(g)));

        it(`line ${route.line}: ${route.decorator}${route.handler.slice(0, 40)} is tenant-scoped or public`, () => {
          expect(
            isPublic || hasScope,
            `Route at line ${route.line} is neither @Public() nor guarded by ` +
              `TenantGuard + TenantScopeGuard. A cross-tenant write would be possible.`,
          ).toBe(true);
        });
      }
    });
  }
});

describe('Route-guard coverage — global guard stack', () => {
  const appModule = readFileSync(join(SRC, 'app.module.ts'), 'utf8');

  it('registers CsrfGuard globally (not only on two hand-picked routes)', () => {
    expect(appModule).toContain('CsrfGuard');
    expect(appModule).toMatch(/provide:\s*APP_GUARD[\s\S]{0,200}CsrfGuard/);
  });

  it('registers the throttler guard globally', () => {
    expect(appModule).toMatch(/provide:\s*APP_GUARD[\s\S]{0,200}ThrottlerGuard/);
  });

  it('registers a tenant-resolve guard globally', () => {
    expect(appModule).toMatch(/provide:\s*APP_GUARD[\s\S]{0,200}TenantResolveGuard/);
  });
});

describe('CSRF — bootstrap endpoints must not hard-require a token', () => {
  const auth = readFileSync(join(SRC, 'modules/auth/auth.controller.ts'), 'utf8');
  const guard = readFileSync(join(SRC, 'modules/auth/guards/csrf.guard.ts'), 'utf8');

  it('POST /auth/login is not @RequireCsrf (no session exists yet)', () => {
    const idx = auth.indexOf("@Post('login')");
    expect(idx).toBeGreaterThan(-1);
    const before = auth.slice(Math.max(0, idx - 200), idx);
    expect(before).not.toContain('@RequireCsrf()');
  });

  it('POST /auth/register is not @RequireCsrf', () => {
    const idx = auth.indexOf("@Post('register')");
    expect(idx).toBeGreaterThan(-1);
    const before = auth.slice(Math.max(0, idx - 200), idx);
    expect(before).not.toContain('@RequireCsrf()');
  });

  it('the guard still enforces CSRF whenever an auth cookie is present', () => {
    expect(guard).toContain('hasAuthCookie');
    expect(guard).toMatch(/if\s*\(!hasAuthCookie\s*&&\s*!csrfCookie\s*&&\s*!explicitlyRequired\)\s*return true/);
  });

  it('the guard exempts Bearer-only clients', () => {
    expect(guard).toMatch(/isBearer\s*&&\s*!hasAuthCookie/);
  });
});

describe('Production secret hardening', () => {
  const config = readFileSync(join(SRC, 'config/config.service.ts'), 'utf8');
  it('fails closed on placeholder secrets in production', () => {
    expect(config).toContain('PLACEHOLDER_SECRETS');
    expect(config).toMatch(/NODE_ENV[\s\S]{0,80}production/);
  });
});

describe('Upload hardening', () => {
  const constants = readFileSync(join(SRC, 'modules/upload/upload.constants.ts'), 'utf8');
  it('defines an explicit allowlist and excludes active content types', () => {
    expect(constants).toContain('ALLOWED_UPLOAD_CONTENT_TYPES');
    for (const banned of ['text/html', 'image/svg+xml', 'application/javascript']) {
      expect(constants).not.toContain(`'${banned}'`);
    }
  });
});
