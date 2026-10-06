import { describe, it, expect } from 'vitest';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AuthController } from '../src/modules/auth/auth.controller';

/**
 * Regression: an unresolvable tenant used to become a fabricated
 * `{ id: '', slug: 'main' }`, and that empty string reached
 * `eq(users.tenantId, '')`. Postgres rejected it with
 *
 *   PostgresError: invalid input syntax for type uuid: ""
 *
 * so register / login / forgot-password answered an opaque 500 for an unknown
 * tenant slug — the first thing a misconfigured client or a prober tries.
 *
 * Drives the real controller with a stubbed DrizzleService. The stub answers
 * "what the database would return" from the slug the request asked for, because
 * the controller issues exactly one lookup per branch. Introspecting drizzle's
 * internal SQL object would couple the test to an implementation detail.
 */

type Row = { id: string; slug: string; isActive: boolean };

/**
 * @param rows  what the tenants table contains
 * @param requested  the slug the request carries, or undefined when it carries none
 */
function controller(rows: Row[], requested?: string) {
  const drizzle = {
    db: {
      query: {
        tenants: {
          findFirst: async () => {
            if (requested !== undefined) return rows.find((r) => r.slug === requested) ?? null;
            return rows.find((r) => r.isActive) ?? null;
          },
        },
      },
    },
  };
  return new AuthController(
    undefined as never, undefined as never, undefined as never, undefined as never,
    undefined as never, drizzle as never, undefined as never, undefined as never,
    undefined as never, undefined as never, undefined as never,
  );
}

const resolve = (c: AuthController, req: any) =>
  (c as any).resolveTenant(req) as Promise<{ id: string; slug: string }>;

const withSlug = (slug: string) => ({ tenant: null, headers: { 'x-tenant-slug': slug } });
const noSlug = () => ({ tenant: null, headers: {} });

describe('resolveTenant', () => {
  it('returns the tenant the guard already resolved, without querying', async () => {
    await expect(
      resolve(controller([]), { tenant: { id: 't1', slug: 'acme' } }),
    ).resolves.toEqual({ id: 't1', slug: 'acme' });
  });

  it('resolves an explicitly requested slug', async () => {
    // Inactive, so it can only be found by slug and never by the active fallback.
    await expect(
      resolve(controller([{ id: 't1', slug: 'acme', isActive: false }], 'acme'), withSlug('acme')),
    ).resolves.toEqual({ id: 't1', slug: 'acme' });
  });

  it('throws 404 for a slug that does not exist', async () => {
    await expect(
      resolve(controller([{ id: 't1', slug: 'acme', isActive: true }], 'ghost'), withSlug('ghost')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not fall back to an active tenant when a specific slug was asked for', async () => {
    // The old code had a single "find any active tenant" path, so a typo in the
    // slug silently registered people against the wrong tenant.
    await expect(
      resolve(controller([{ id: 't1', slug: 'acme', isActive: true }], 'ghost'), withSlug('ghost')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 503 when no tenant is configured at all', async () => {
    await expect(resolve(controller([]), noSlug())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('falls back to the active tenant when no slug is sent', async () => {
    await expect(
      resolve(
        controller([
          { id: 't1', slug: 'inactive', isActive: false },
          { id: 't2', slug: 'active-one', isActive: true },
        ]),
        noSlug(),
      ),
    ).resolves.toEqual({ id: 't2', slug: 'active-one' });
  });

  it('treats a blank tenant header as absent', async () => {
    await expect(
      resolve(controller([]), { tenant: null, headers: { 'x-tenant-slug': '   ' } }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('never resolves to a non-UUID id — the original defect', async () => {
    // Every unresolved path throws now. Returning { id: '' } is what produced
    // "invalid input syntax for type uuid: \"\"".
    for (const req of [noSlug(), withSlug('ghost'), { tenant: null, headers: { 'x-tenant-slug': '' } }]) {
      await expect(resolve(controller([]), req)).rejects.toThrow();
    }
  });
});